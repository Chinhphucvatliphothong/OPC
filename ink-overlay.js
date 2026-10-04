// ink-overlay.js
// Lớp viết tay (Apple Pencil / bút cảm ứng) phủ lên nội dung — dùng ở trang admin khi giảng online.
// Tạo ngày 04/10/2026. Không cần build: dùng React 18 UMD (React.createElement), nạp SAU React.
//
// Cách dùng (trong admin.html):
//   h(InkBoard, { resetKey: cauHoi.id }, h(KhungCauHoi, {...}))
//
// Props:
//   resetKey    : khi giá trị đổi (vd. đổi sang câu khác) -> tự xoá nét vẽ
//   scrollEl    : (tuỳ chọn) phần tử có thanh cuộn riêng; mặc định cuộn cả trang (window)
//   fingerDraws : (tuỳ chọn) true = ngón tay cũng vẽ (mặc định false: ngón tay chỉ cuộn)
//   onReady     : (tuỳ chọn) nhận {undo, clear, getStrokes, setStrokes} để điều khiển từ ngoài
//   children    : nội dung (câu hỏi, lời giải...) nằm bên dưới lớp viết
(function (global) {
  'use strict';

  var React = global.React;
  if (!React) {
    console.error('[InkBoard] Chưa nạp React trước ink-overlay.js');
    return;
  }
  var h = React.createElement;
  var useRef = React.useRef;
  var useState = React.useState;
  var useEffect = React.useEffect;

  var COLORS = [
    { v: '#e11d48', t: 'Đỏ' },
    { v: '#2563eb', t: 'Xanh dương' },
    { v: '#16a34a', t: 'Xanh lá' },
    { v: '#111827', t: 'Đen' }
  ];
  var WIDTHS = [
    { v: 2, t: 'Mỏng' },
    { v: 4, t: 'Vừa' },
    { v: 8, t: 'Dày' }
  ];
  var MAX_CANVAS_PIXELS = 12e6; // Safari giới hạn ~16,7 triệu pixel/canvas -> chừa an toàn
  var MAX_HISTORY = 60;         // số bước hoàn tác tối đa
  var PALM_GRACE_MS = 500;      // sau khi nhấc bút, bỏ qua chạm ngón/lòng bàn tay trong khoảng này
  var TAP_SLOP = 8;             // dịch chuyển (px) tối đa để vẫn tính là "chạm" chứ không phải "cuộn"

  // Hệ số độ dày theo lực nhấn: bút có cảm biến lực -> 0.5x..1.5x; chuột/ngón -> 1x
  function pressureFactor(p, type) {
    if (type !== 'pen') return 1;
    var q = p > 0 ? p : 0.5;
    return 0.5 + q;
  }

  // Vẽ một nét: nối các điểm bằng đường cong bậc 2 (qua trung điểm) cho mượt
  function drawStroke(ctx, s) {
    var pts = s.points;
    var n = pts.length;
    if (!n) return;
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (n === 1) {
      ctx.beginPath();
      ctx.arc(pts[0][0], pts[0][1], (s.width * pts[0][2]) / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    var lx = pts[0][0];
    var ly = pts[0][1];
    for (var i = 1; i < n; i++) {
      var a = pts[i - 1];
      var b = pts[i];
      var mx = (a[0] + b[0]) / 2;
      var my = (a[1] + b[1]) / 2;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.quadraticCurveTo(a[0], a[1], mx, my);
      ctx.lineWidth = (s.width * (a[2] + b[2])) / 2;
      ctx.stroke();
      lx = mx;
      ly = my;
    }
    var last = pts[n - 1];
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(last[0], last[1]);
    ctx.lineWidth = s.width * last[2];
    ctx.stroke();
  }

  // Bình phương khoảng cách từ điểm (x,y) tới đoạn thẳng a-b
  function distSegSq(x, y, a, b) {
    var dx = b[0] - a[0];
    var dy = b[1] - a[1];
    var len2 = dx * dx + dy * dy;
    var t = len2 ? ((x - a[0]) * dx + (y - a[1]) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    var px = a[0] + t * dx - x;
    var py = a[1] + t * dy - y;
    return px * px + py * py;
  }

  function strokeHit(s, x, y, r) {
    var r2 = r * r;
    var pts = s.points;
    if (pts.length === 1) {
      var ddx = pts[0][0] - x;
      var ddy = pts[0][1] - y;
      return ddx * ddx + ddy * ddy <= r2;
    }
    for (var i = 1; i < pts.length; i++) {
      if (distSegSq(x, y, pts[i - 1], pts[i]) <= r2) return true;
    }
    return false;
  }

  function InkBoard(props) {
    var wrapRef = useRef(null);
    var canvasRef = useRef(null);
    var baseRef = useRef(null);     // canvas ẩn chứa các nét đã hoàn tất (để vẽ lại nhanh)
    var dprRef = useRef(1);
    var strokesRef = useRef([]);    // các nét đã hoàn tất
    var historyRef = useRef([]);    // lịch sử để hoàn tác
    var currentRef = useRef(null);  // nét đang vẽ
    var activeRef = useRef(null);   // thao tác đang diễn ra: {id, kind: 'draw'|'erase'|'scroll'}
    var lastPenRef = useRef(0);     // thời điểm bút chạm gần nhất (chống chạm nhầm lòng bàn tay)
    var rafRef = useRef(0);

    var s1 = useState(true);   var writing = s1[0];   var setWriting = s1[1];
    var s2 = useState('pen');  var tool = s2[0];      var setTool = s2[1];
    var s3 = useState(COLORS[0].v); var color = s3[0]; var setColor = s3[1];
    var s4 = useState(WIDTHS[1].v); var width = s4[0]; var setWidth = s4[1];
    var s5 = useState(false);  var collapsed = s5[0]; var setCollapsed = s5[1];
    var s6 = useState(0);      var setRev = s6[1];   // chỉ để buộc render lại (nút hoàn tác)

    // Các handler luôn đọc giá trị mới nhất qua ref
    var optRef = useRef({});
    optRef.current = {
      tool: tool,
      color: color,
      width: width,
      fingerDraws: !!props.fingerDraws,
      scrollEl: props.scrollEl || null
    };

    function bump() {
      setRev(function (x) { return x + 1; });
    }

    // ---- Vẽ ----
    function paint() {
      rafRef.current = 0;
      var cv = canvasRef.current;
      if (!cv) return;
      var ctx = cv.getContext('2d');
      var d = dprRef.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      if (baseRef.current) ctx.drawImage(baseRef.current, 0, 0);
      if (currentRef.current) {
        ctx.setTransform(d, 0, 0, d, 0, 0);
        drawStroke(ctx, currentRef.current);
      }
    }

    function schedule() {
      if (!rafRef.current) rafRef.current = requestAnimationFrame(paint);
    }

    function renderBase() {
      var b = baseRef.current;
      if (!b) return;
      var ctx = b.getContext('2d');
      var d = dprRef.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, b.width, b.height);
      ctx.setTransform(d, 0, 0, d, 0, 0);
      strokesRef.current.forEach(function (s) { drawStroke(ctx, s); });
    }

    // Đồng bộ kích thước canvas với khung nội dung (nội dung dài ra khi mở lời giải)
    function resize() {
      var wrap = wrapRef.current;
      var cv = canvasRef.current;
      if (!wrap || !cv) return;
      var w = Math.max(1, wrap.clientWidth);
      var hh = Math.max(1, wrap.clientHeight);
      var d = Math.min(global.devicePixelRatio || 1, Math.sqrt(MAX_CANVAS_PIXELS / (w * hh)));
      d = Math.max(0.5, d);
      dprRef.current = d;
      cv.width = Math.round(w * d);
      cv.height = Math.round(hh * d);
      if (!baseRef.current) baseRef.current = document.createElement('canvas');
      baseRef.current.width = cv.width;
      baseRef.current.height = cv.height;
      renderBase();
      paint();
    }

    useEffect(function () {
      resize();
      var ro = null;
      if (typeof ResizeObserver !== 'undefined' && wrapRef.current) {
        ro = new ResizeObserver(function () { resize(); });
        ro.observe(wrapRef.current);
      } else {
        global.addEventListener('resize', resize);
      }
      return function () {
        if (ro) ro.disconnect();
        else global.removeEventListener('resize', resize);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }, []);

    // Đổi câu hỏi -> xoá nét vẽ
    useEffect(function () {
      strokesRef.current = [];
      historyRef.current = [];
      currentRef.current = null;
      activeRef.current = null;
      renderBase();
      paint();
      bump();
    }, [props.resetKey]);

    // ---- Hành động ----
    function pushHistory() {
      historyRef.current.push(strokesRef.current.slice());
      if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    }

    function undo() {
      if (!historyRef.current.length) return;
      strokesRef.current = historyRef.current.pop();
      renderBase();
      paint();
      bump();
    }

    function clearAll() {
      if (!strokesRef.current.length) return;
      pushHistory();
      strokesRef.current = [];
      renderBase();
      paint();
      bump();
    }

    useEffect(function () {
      if (typeof props.onReady === 'function') {
        props.onReady({
          undo: undo,
          clear: clearAll,
          getStrokes: function () { return strokesRef.current; },
          setStrokes: function (arr) {
            strokesRef.current = Array.isArray(arr) ? arr : [];
            historyRef.current = [];
            renderBase();
            paint();
            bump();
          }
        });
      }
    }, []);

    function eraseAt(x, y, a, o) {
      var r = Math.max(10, o.width * 3);
      var kept = strokesRef.current.filter(function (s) { return !strokeHit(s, x, y, r); });
      if (kept.length !== strokesRef.current.length) {
        if (!a.pushed) {
          pushHistory();
          a.pushed = true;
        }
        strokesRef.current = kept;
        renderBase();
        schedule();
      }
    }

    // ---- Xử lý Pointer Events ----
    function onDown(e) {
      var o = optRef.current;
      var cv = canvasRef.current;
      if (!cv || activeRef.current) return;
      var now = Date.now();

      if (e.pointerType === 'touch' && !o.fingerDraws) {
        // Chống chạm nhầm: đang viết (hoặc vừa nhấc bút) thì bỏ qua ngón tay / lòng bàn tay
        if (now - lastPenRef.current < PALM_GRACE_MS) return;
        activeRef.current = {
          id: e.pointerId, kind: 'scroll',
          x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false
        };
        try { cv.setPointerCapture(e.pointerId); } catch (err) {}
        return;
      }
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.pointerType === 'pen') lastPenRef.current = now;

      var r = cv.getBoundingClientRect();
      var x = e.clientX - r.left;
      var y = e.clientY - r.top;
      var erasing = o.tool === 'erase' || (e.buttons & 32) === 32; // đầu tẩy của bút (nếu có)

      if (erasing) {
        activeRef.current = { id: e.pointerId, kind: 'erase', pushed: false };
        eraseAt(x, y, activeRef.current, o);
      } else {
        currentRef.current = {
          color: o.color,
          width: o.width,
          points: [[x, y, pressureFactor(e.pressure, e.pointerType)]]
        };
        activeRef.current = { id: e.pointerId, kind: 'draw' };
      }
      try { cv.setPointerCapture(e.pointerId); } catch (err2) {}
      e.preventDefault();
      schedule();
    }

    function onMove(e) {
      var a = activeRef.current;
      var cv = canvasRef.current;
      if (!a || !cv || a.id !== e.pointerId) return;
      var o = optRef.current;

      if (a.kind === 'scroll') {
        var dx = e.clientX - a.x;
        var dy = e.clientY - a.y;
        a.x = e.clientX;
        a.y = e.clientY;
        if (Math.abs(e.clientX - a.sx) > TAP_SLOP || Math.abs(e.clientY - a.sy) > TAP_SLOP) a.moved = true;
        if (o.scrollEl) {
          o.scrollEl.scrollLeft -= dx;
          o.scrollEl.scrollTop -= dy;
        } else {
          global.scrollBy(-dx, -dy);
        }
        return;
      }

      if (e.pointerType === 'pen') lastPenRef.current = Date.now();
      var native = e.nativeEvent;
      var evs = native.getCoalescedEvents ? native.getCoalescedEvents() : [];
      if (!evs.length) evs = [native];
      var r = cv.getBoundingClientRect();
      for (var i = 0; i < evs.length; i++) {
        var x = evs[i].clientX - r.left;
        var y = evs[i].clientY - r.top;
        if (a.kind === 'draw' && currentRef.current) {
          currentRef.current.points.push([x, y, pressureFactor(evs[i].pressure, e.pointerType)]);
        } else if (a.kind === 'erase') {
          eraseAt(x, y, a, o);
        }
      }
      schedule();
    }

    function onEnd(e, commit) {
      var a = activeRef.current;
      var cv = canvasRef.current;
      if (!a || !cv || a.id !== e.pointerId) return;
      activeRef.current = null;
      try { cv.releasePointerCapture(e.pointerId); } catch (err) {}

      if (a.kind === 'scroll') {
        // Ngón tay chạm nhẹ (không kéo) -> chuyển cú chạm xuống phần tử bên dưới (vd. nút "Hiện lời giải")
        if (commit && !a.moved) {
          cv.style.pointerEvents = 'none';
          var el = document.elementFromPoint(e.clientX, e.clientY);
          cv.style.pointerEvents = 'auto';
          if (el) {
            if (el.focus) el.focus();
            if (el.click) el.click();
          }
        }
        return;
      }

      if (e.pointerType === 'pen') lastPenRef.current = Date.now();

      if (a.kind === 'draw') {
        var s = currentRef.current;
        currentRef.current = null;
        if (commit && s && s.points.length) {
          pushHistory();
          strokesRef.current = strokesRef.current.concat([s]);
          var b = baseRef.current;
          if (b) {
            var ctx = b.getContext('2d');
            var d = dprRef.current;
            ctx.setTransform(d, 0, 0, d, 0, 0);
            drawStroke(ctx, s);
          }
          bump();
        }
      } else if (a.kind === 'erase') {
        bump();
      }
      schedule();
    }

    // ---- Giao diện ----
    function btn(label, onClick, opts) {
      opts = opts || {};
      return h('button', {
        type: 'button',
        onClick: onClick,
        disabled: !!opts.disabled,
        title: opts.title || label,
        style: {
          minWidth: 44, minHeight: 44, padding: '0 12px',
          // SỬA 04/10/2026 — dùng biến màu của trang admin (có màu dự phòng khi chạy riêng như ink-demo.html)
          border: opts.active ? '2px solid var(--accent, #1d4ed8)' : '1px solid var(--line, #cbd5e1)',
          borderRadius: 10,
          background: opts.active ? 'color-mix(in srgb, var(--accent, #1d4ed8) 16%, var(--surface, #ffffff))' : 'var(--surface, #ffffff)',
          color: 'var(--ink, #0f172a)', fontSize: 15, fontWeight: 600, fontFamily: 'inherit',
          opacity: opts.disabled ? 0.4 : 1,
          touchAction: 'manipulation', cursor: 'pointer'
        }
      }, label);
    }

    var toolbar;
    if (collapsed) {
      toolbar = h('div', { style: toolbarBox() },
        btn(writing ? '✏️' : '✋', function () { setCollapsed(false); }, { title: 'Mở thanh công cụ' }));
    } else {
      toolbar = h('div', { style: toolbarBox() },
        btn(writing ? '✏️ Đang viết' : '✋ Đang cuộn', function () { setWriting(!writing); },
          { active: writing, title: 'Bật/tắt chế độ viết' }),
        COLORS.map(function (c) {
          return h('button', {
            key: c.v, type: 'button', title: c.t,
            onClick: function () { setColor(c.v); setTool('pen'); },
            style: {
              width: 36, height: 36, borderRadius: 18, background: c.v,
              border: color === c.v && tool === 'pen' ? '3px solid var(--accent, #1d4ed8)' : '2px solid var(--surface, #ffffff)',
              boxShadow: '0 0 0 1px #94a3b8', touchAction: 'manipulation', cursor: 'pointer'
            }
          });
        }),
        WIDTHS.map(function (w) {
          return btn(String(w.v), function () { setWidth(w.v); },
            { active: width === w.v, title: 'Nét ' + w.t.toLowerCase() });
        }),
        btn('🧽 Tẩy', function () { setTool(tool === 'erase' ? 'pen' : 'erase'); },
          { active: tool === 'erase', title: 'Tẩy từng nét' }),
        btn('↶', undo, { disabled: !historyRef.current.length, title: 'Hoàn tác' }),
        btn('🗑', clearAll, { disabled: !strokesRef.current.length, title: 'Xoá hết nét vẽ' }),
        btn('✕', function () { setCollapsed(true); }, { title: 'Thu gọn' }));
    }

    return h('div', { ref: wrapRef, style: { position: 'relative' } },
      props.children,
      h('canvas', {
        ref: canvasRef,
        onPointerDown: onDown,
        onPointerMove: onMove,
        onPointerUp: function (e) { onEnd(e, true); },
        onPointerCancel: function (e) { onEnd(e, false); },
        onContextMenu: function (e) { e.preventDefault(); },
        style: {
          position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', zIndex: 10,
          touchAction: writing ? 'none' : 'auto',
          pointerEvents: writing ? 'auto' : 'none',
          cursor: writing ? 'crosshair' : 'default',
          userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none'
        }
      }),
      toolbar);
  }

  function toolbarBox() {
    return {
      position: 'fixed', left: '50%', bottom: 16, transform: 'translateX(-50%)', zIndex: 20,
      display: 'flex', alignItems: 'center', gap: 8, padding: 8, flexWrap: 'wrap', justifyContent: 'center',
      maxWidth: '96vw', background: 'color-mix(in srgb, var(--surface, #ffffff) 96%, transparent)', border: '1px solid var(--line, #cbd5e1)',
      borderRadius: 14, boxShadow: '0 6px 24px rgba(15,23,42,0.18)', touchAction: 'manipulation'
    };
  }

  global.InkBoard = InkBoard;
})(window);
