// ink-overlay.js
// Lớp viết tay (Apple Pencil / bút cảm ứng) phủ lên nội dung — dùng ở trang admin khi giảng online.
// Tạo ngày 04/10/2026. Không cần build: dùng React 18 UMD (React.createElement), nạp SAU React.
//
// SỬA 9/10/2026 — nét bút đẹp hơn + giấy ô li:
//   • Nét bút dựng thành "dải mực" có độ dày thay đổi mượt (lọc rung tay, làm mượt lực nhấn, vuốt nhọn đầu/cuối nét)
//     thay cho các đoạn thẳng nối nhau. Chuột/ngón tay: độ dày theo tốc độ (viết nhanh nét mảnh hơn), giống bút thật.
//   • Thêm công cụ: bút dạ quang (tô nền trong suốt), đường thẳng, mũi tên (vẽ vectơ lực/vận tốc).
//   • Thêm màu cam, tím và 4 cỡ nét.
//   • "📄 + Giấy": nối thêm trang giấy trống dưới câu hỏi để viết tự do — kiểu ô li (vở học sinh), ô vuông (vẽ đồ thị)
//     hoặc trắng. Giấy nằm chung lớp viết nên viết tràn từ đề xuống giấy được.
//
// SỬA 09/11/2026 — bút laser + chống "đơ bút" khi dạy lâu trên iPad:
//   • Thêm 🔴 bút laser: vệt sáng chạy theo bút rồi tự mờ sau ~1,2 giây, không lưu vào nét vẽ / hoàn tác.
//   • Chống kẹt: trước đây nếu iPadOS làm mất sự kiện nhấc bút (pointerup) thì lớp viết tưởng vẫn đang viết và bỏ qua
//     mọi lần chạm sau -> bút "đơ". Nay bút chạm xuống luôn được ưu tiên (huỷ thao tác cũ bị kẹt / lòng bàn tay đang
//     đè), xử lý thêm lostpointercapture, ẩn tab, chuyển ứng dụng.
//   • Giải phóng bộ nhớ canvas khi đóng/đổi câu (Safari giới hạn tổng bộ nhớ canvas; vượt là không vẽ được nữa),
//     không cấp phát lại canvas khi kích thước không đổi, giảm độ phân giải tối đa.
//   • Mượt hơn: nét dài tự chốt dần vào lớp nền (không chậm dần theo độ dài nét), tẩy chỉ vẽ lại 1 lần/khung hình,
//     bút Pencil bám tay hơn.
//
// SỬA 10/11/2026 — thanh bút kéo được + giấy chèn đúng câu đang xem:
//   • Thanh công cụ có tay nắm "⠿" ở đầu: kéo (ngón tay / bút / chuột) để dời thanh bút tới bất kỳ đâu trên màn hình,
//     chạm đúp tay nắm để về vị trí mặc định (giữa đáy). Vị trí được nhớ cho lần mở sau (localStorage, có try/catch).
//   • "📄 + Giấy": trước đây luôn nối giấy ở CUỐI cả đề. Nay giấy chèn NGAY DƯỚI CÂU ĐANG HIỆN TRÊN MÀN HÌNH (câu chiếm
//     nhiều diện tích nhìn thấy nhất; nếu đang nhìn một tờ giấy thì thêm trang vào tờ đó). Nút "−" bớt trang của tờ giấy
//     đang xem. Nét viết nằm bên dưới chỗ chèn tự dời xuống/lên theo để vẫn khớp với nội dung.
//   • Cách nhận biết "câu": phần tử con có thuộc tính data-ink-anchor="..." hoặc data-hvi="..." (admin đã có sẵn data-hvi
//     ở mỗi câu của màn "Xem lại bài làm"). Không có phần tử nào như vậy (vd. màn giảng 1 câu) -> giấy nối ở cuối như cũ.
//
// Cách dùng (trong admin.html):
//   h(InkBoard, { resetKey: cauHoi.id }, h(KhungCauHoi, {...}))
//
// Props:
//   resetKey    : khi giá trị đổi (vd. đổi sang câu khác) -> tự xoá nét vẽ + giấy nháp
//   scrollEl    : (tuỳ chọn) phần tử có thanh cuộn riêng; mặc định cuộn cả trang (window)
//   fingerDraws : (tuỳ chọn) true = ngón tay cũng vẽ (mặc định false: ngón tay chỉ cuộn)
//   onReady     : (tuỳ chọn) nhận {undo, clear, getStrokes, setStrokes, getState, setState} để điều khiển từ ngoài
//                 getState() -> { strokes, pages, paper, blocks } ; setState(cùng dạng) — dùng để nhớ nét vẽ theo từng câu
//                 (blocks = các tờ giấy chèn sau từng câu: [{key, pages}]; pages = số trang giấy ở cuối)
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
  var useLayoutEffect = React.useLayoutEffect || React.useEffect;

  var COLORS = [
    { v: '#e11d48', t: 'Đỏ' },
    { v: '#2563eb', t: 'Xanh dương' },
    { v: '#16a34a', t: 'Xanh lá' },
    { v: '#111827', t: 'Đen' },
    { v: '#ea580c', t: 'Cam' },
    { v: '#7c3aed', t: 'Tím' }
  ];
  var WIDTHS = [
    { v: 1.6, t: 'Mảnh', dot: 3 },
    { v: 2.8, t: 'Vừa', dot: 5 },
    { v: 4.5, t: 'Đậm', dot: 7 },
    { v: 7.5, t: 'Rất đậm', dot: 10 }
  ];
  var TOOLS = [
    { v: 'pen', icon: '✒️', t: 'Bút' },
    { v: 'laser', icon: '🔴', t: 'Bút laser (chỉ trỏ, tự mờ)' },
    { v: 'hl', icon: '🖍️', t: 'Bút dạ quang' },
    { v: 'line', icon: '📏', t: 'Đường thẳng' },
    { v: 'arrow', icon: '↗', t: 'Mũi tên (vectơ)' },
    { v: 'erase', icon: '🧽', t: 'Tẩy từng nét' }
  ];
  var PAPERS = [
    { v: 'oli', t: 'Ô li' },
    { v: 'grid', t: 'Ô vuông' },
    { v: 'blank', t: 'Trắng' }
  ];
  var PAGE_H = 620;             // chiều cao 1 trang giấy nháp (px)
  var MAX_PAGES = 10;            // tổng số trang giấy (cộng tất cả các câu)
  var MAX_CANVAS_PIXELS = 8e6;  // Safari giới hạn ~16,7 triệu pixel/canvas và tổng bộ nhớ canvas -> chừa an toàn
  var MAX_HISTORY = 60;         // số bước hoàn tác tối đa
  var PALM_GRACE_MS = 500;      // sau khi nhấc bút, bỏ qua chạm ngón/lòng bàn tay trong khoảng này
  var TAP_SLOP = 8;             // dịch chuyển (px) tối đa để vẫn tính là "chạm" chứ không phải "cuộn"
  var STALE_MS = 1500;          // thao tác không có sự kiện nào quá lâu -> coi như bị kẹt (mất pointerup)
  var CHUNK_PTS = 400;          // nét bút dài hơn số điểm này -> chốt phần đầu vào lớp nền
  var LASER_MS = 1200;          // thời gian vệt laser tồn tại
  var ANCHOR_SEL = '[data-ink-anchor],[data-hvi]'; // THÊM 10/11/2026 — phần tử đánh dấu "một câu" để chèn giấy sau nó
  var END_KEY = '__end';        // khối giấy ở cuối (khi không có phần tử câu nào)
  var POS_KEY = 'faraday_ink_toolbar_pos_v1'; // nhớ vị trí thanh bút
  var EDGE = 4;                 // chừa mép màn hình khi kéo thanh bút (px)

  function nowMs() {
    return (global.performance && global.performance.now) ? global.performance.now() : Date.now();
  }
  function releaseCanvas(c) {
    if (!c) return;
    try { c.width = 0; c.height = 0; } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // Nhập điểm: lọc rung tay (streamline) + làm mượt độ dày (lực nhấn / tốc độ)
  // Mỗi điểm lưu [x, y, hệ số độ dày ~0.4..1.5]
  // ---------------------------------------------------------------------------
  function targetFactor(pressure, type, speed) {
    if (type === 'pen') {
      var p = pressure > 0 ? pressure : 0.5;
      return 0.4 + 1.1 * Math.sqrt(p);          // nhấn nhẹ: mảnh, nhấn mạnh: đậm (đường cong êm)
    }
    // chuột / ngón tay: không có lực nhấn -> mô phỏng theo tốc độ (px/ms)
    return Math.max(0.6, Math.min(1.15, 1.15 - speed * 0.22));
  }
  function addPoint(st, x, y, pressure, type, t) {
    var pts = st.points;
    var last = pts[pts.length - 1];
    if (!last) {
      pts.push([x, y, targetFactor(pressure, type, 0)]);
      st._t = t;
      return;
    }
    var stream = type === 'pen' ? 0.35 : 0.5;  // 0 = bám sát tay, gần 1 = rất mượt nhưng trễ
    var nx = last[0] + (x - last[0]) * (1 - stream);
    var ny = last[1] + (y - last[1]) * (1 - stream);
    var dx = nx - last[0], dy = ny - last[1];
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.6) return;                    // bỏ điểm quá sát (gây răng cưa)
    var dt = Math.max(1, (t || 0) - (st._t || 0));
    st._t = t;
    var target = targetFactor(pressure, type, dist / dt);
    var w = last[2] + (target - last[2]) * 0.28;
    pts.push([nx, ny, w]);
  }

  // ---------------------------------------------------------------------------
  // Vẽ
  // ---------------------------------------------------------------------------
  function hexToRgba(hex, a) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return hex;
    var n = parseInt(m[1], 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  // Bút: dựng đường bao hai bên (trái/phải) theo pháp tuyến, tô kín -> nét có độ dày thay đổi liền mạch
  // SỬA 09/11/2026 — dùng lại mảng tạm (không cấp phát mảng mới mỗi khung hình); s.noTS / s.noTE = phần nét dài đã
  // được tách khúc -> không vuốt nhọn ở chỗ nối.
  var SCR = { acc: [], rad: [], lx: [], ly: [], rx: [], ry: [] };
  function drawPen(ctx, s) {
    var pts = s.points;
    var n = pts.length;
    if (!n) return;
    var base = s.width;
    ctx.fillStyle = s.color;
    if (n === 1) {
      ctx.beginPath();
      ctx.arc(pts[0][0], pts[0][1], Math.max(0.6, base * pts[0][2] * 0.55), 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    var acc = SCR.acc, radii = SCR.rad, lx = SCR.lx, ly = SCR.ly, rx = SCR.rx, ry = SCR.ry;
    // độ dài tích luỹ để vuốt nhọn đầu/cuối nét
    acc[0] = 0;
    for (var i = 1; i < n; i++) {
      var ddx = pts[i][0] - pts[i - 1][0], ddy = pts[i][1] - pts[i - 1][1];
      acc[i] = acc[i - 1] + Math.sqrt(ddx * ddx + ddy * ddy);
    }
    var L = acc[n - 1];
    var taperS = s.noTS ? 0 : Math.min(L * 0.3, 6 + base * 2.2);
    var taperE = s.noTE ? 0 : Math.min(L * 0.3, 4 + base * 1.6);
    for (var k = 0; k < n; k++) {
      var r = (base * pts[k][2]) / 2;
      if (taperS > 0) r *= 0.45 + 0.55 * Math.min(1, acc[k] / taperS);
      if (taperE > 0) r *= 0.6 + 0.4 * Math.min(1, (L - acc[k]) / taperE);
      radii[k] = Math.max(0.35, r);
    }
    for (var j = 0; j < n; j++) {
      var a = pts[j > 0 ? j - 1 : 0], b = pts[j < n - 1 ? j + 1 : n - 1];
      var tx = b[0] - a[0], ty = b[1] - a[1];
      var len = Math.sqrt(tx * tx + ty * ty) || 1;
      var nx = -ty / len, ny = tx / len;
      lx[j] = pts[j][0] + nx * radii[j]; ly[j] = pts[j][1] + ny * radii[j];
      rx[j] = pts[j][0] - nx * radii[j]; ry[j] = pts[j][1] - ny * radii[j];
    }
    ctx.beginPath();
    ctx.moveTo(lx[0], ly[0]);
    for (var p = 1; p < n; p++) {
      ctx.quadraticCurveTo(lx[p - 1], ly[p - 1], (lx[p - 1] + lx[p]) / 2, (ly[p - 1] + ly[p]) / 2);
    }
    ctx.lineTo(lx[n - 1], ly[n - 1]);
    ctx.lineTo(rx[n - 1], ry[n - 1]);
    for (var q = n - 1; q > 0; q--) {
      ctx.quadraticCurveTo(rx[q], ry[q], (rx[q] + rx[q - 1]) / 2, (ry[q] + ry[q - 1]) / 2);
    }
    ctx.lineTo(rx[0], ry[0]);
    ctx.closePath();
    ctx.fill();
    // đầu tròn hai đầu nét
    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], radii[0], 0, Math.PI * 2);
    ctx.moveTo(pts[n - 1][0] + radii[n - 1], pts[n - 1][1]);
    ctx.arc(pts[n - 1][0], pts[n - 1][1], radii[n - 1], 0, Math.PI * 2);
    ctx.fill();
  }

  // THÊM 09/11/2026 — Bút laser: vệt sáng, mỗi điểm mờ dần theo tuổi; trả về true nếu còn điểm cần vẽ tiếp
  function drawLaser(ctx, trails, t) {
    var alive = false;
    for (var i = trails.length - 1; i >= 0; i--) {
      var tr = trails[i];
      var pts = tr.pts;
      var cut = 0;
      while (cut < pts.length && t - pts[cut][2] > LASER_MS) cut++;
      if (cut) pts.splice(0, Math.min(cut, pts.length - 1)); // giữ điểm cuối để còn chấm đầu bút khi đang chạm
      if (!tr.live && (!pts.length || t - pts[pts.length - 1][2] > LASER_MS)) { trails.splice(i, 1); continue; }
      alive = true;
      var n = pts.length;
      ctx.save();
      ctx.lineCap = 'butt'; // đầu bằng: chỗ nối giữa các mức mờ không chồng lên nhau
      ctx.lineJoin = 'round';
      for (var layer = 0; layer < 2; layer++) {
        ctx.strokeStyle = layer ? 'rgba(255,240,240,1)' : tr.color;
        ctx.lineWidth = layer ? 2.2 : 9;
        // gom các đoạn cùng mức mờ (8 mức) thành 1 đường -> không bị "chuỗi hạt" do chồng nét trong suốt
        var bucket = -1, open = false;
        for (var k = 1; k < n; k++) {
          var age = (t - pts[k][2]) / LASER_MS;
          var bk = age >= 1 ? 0 : Math.ceil((1 - age) * 8);
          if (bk !== bucket) {
            if (open) ctx.stroke();
            open = false;
            bucket = bk;
            if (!bk) continue;
            ctx.globalAlpha = (layer ? 0.9 : 0.38) * bk / 8;
            ctx.beginPath();
            ctx.moveTo(pts[k - 1][0], pts[k - 1][1]);
            open = true;
          }
          if (open) ctx.lineTo(pts[k][0], pts[k][1]);
        }
        if (open) ctx.stroke();
      }
      if (tr.live && n) {
        var tip = pts[n - 1];
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = tr.color;
        ctx.beginPath(); ctx.arc(tip[0], tip[1], 11, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(tip[0], tip[1], 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(tip[0], tip[1], 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    return alive;
  }

  // Bút dạ quang: 1 nét rộng, trong suốt, vẽ 1 lần (chỗ chồng trong cùng nét không đậm thêm)
  function drawHighlighter(ctx, s) {
    var pts = s.points;
    var n = pts.length;
    if (!n) return;
    ctx.save();
    ctx.strokeStyle = hexToRgba(s.color, 0.3);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(14, s.width * 4.5);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    if (n === 1) ctx.lineTo(pts[0][0] + 0.1, pts[0][1]);
    for (var i = 1; i < n; i++) {
      ctx.quadraticCurveTo(pts[i - 1][0], pts[i - 1][1], (pts[i - 1][0] + pts[i][0]) / 2, (pts[i - 1][1] + pts[i][1]) / 2);
    }
    if (n > 1) ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
    ctx.stroke();
    ctx.restore();
  }

  // Đường thẳng / mũi tên
  function drawLine(ctx, s) {
    var pts = s.points;
    if (pts.length < 2) return;
    var a = pts[0], b = pts[pts.length - 1];
    var w = Math.max(1.2, s.width * 1.05);
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineCap = 'round';
    ctx.lineWidth = w;
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var len = Math.sqrt(dx * dx + dy * dy);
    var ex = b[0], ey = b[1];
    var head = Math.min(len * 0.45, 9 + w * 2.6);
    if (s.kind === 'arrow' && len > 2) {
      // thân dừng ở gốc đầu mũi tên để đầu nhọn sắc
      ex = b[0] - (dx / len) * head * 0.8;
      ey = b[1] - (dy / len) * head * 0.8;
    }
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    if (s.kind === 'arrow' && len > 2) {
      var ang = Math.atan2(dy, dx), spread = 0.42;
      ctx.beginPath();
      ctx.moveTo(b[0], b[1]);
      ctx.lineTo(b[0] - head * Math.cos(ang - spread), b[1] - head * Math.sin(ang - spread));
      ctx.lineTo(b[0] - head * 0.72 * Math.cos(ang), b[1] - head * 0.72 * Math.sin(ang));
      ctx.lineTo(b[0] - head * Math.cos(ang + spread), b[1] - head * Math.sin(ang + spread));
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawStroke(ctx, s) {
    if (s.kind === 'hl') return drawHighlighter(ctx, s);
    if (s.kind === 'line' || s.kind === 'arrow') return drawLine(ctx, s);
    return drawPen(ctx, s);
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
    var pts = s.points;
    if (s.kind === 'hl') r += Math.max(7, s.width * 2.2);
    var r2 = r * r;
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

  // THÊM 10/11/2026 — tiện ích cho giấy chèn giữa đề + vị trí thanh bút
  function sumPages(blocks) {
    var n = 0;
    for (var i = 0; i < blocks.length; i++) n += blocks[i].pages;
    return n;
  }
  function findBlock(blocks, key) {
    for (var i = 0; i < blocks.length; i++) if (blocks[i].key === key) return blocks[i];
    return null;
  }
  function anchorKey(el, idx) {
    return 'a:' + (el.getAttribute('data-ink-anchor') || el.getAttribute('data-hvi') || ('#' + idx));
  }
  // Dời các nét có điểm đầu nằm từ y trở xuống một đoạn dy (chèn giấy -> xuống, bớt giấy -> lên).
  // Tạo nét mới (không sửa nét cũ) và dùng chung bản đồ cache để các bản trong lịch sử hoàn tác vẫn dùng chung đối tượng.
  function shiftStrokes(arr, y, dy, cache) {
    return arr.map(function (s) {
      if (!s.points || !s.points.length || s.points[0][1] < y) return s;
      var hit = cache.get(s);
      if (hit) return hit;
      var n = {};
      for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) n[k] = s[k];
      n.points = s.points.map(function (p) { return [p[0], p[1] + dy, p[2]]; });
      cache.set(s, n);
      return n;
    });
  }
  function loadToolbarPos() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(POS_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (p && isFinite(p.x) && isFinite(p.y)) return { x: Number(p.x), y: Number(p.y) };
    } catch (e) {}
    return null;
  }
  function saveToolbarPos(p) {
    try {
      if (!global.localStorage) return;
      if (p) global.localStorage.setItem(POS_KEY, JSON.stringify(p));
      else global.localStorage.removeItem(POS_KEY);
    } catch (e) {}
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // Mẫu giấy nháp (CSS nền, không tốn canvas)
  function paperStyle(kind, pages) {
    var st = {
      position: 'relative', height: pages * PAGE_H, marginTop: 14, borderRadius: 10,
      border: '1px solid #d6d3cc', backgroundColor: '#fffdf8', overflow: 'hidden'
    };
    var pageBreaks = 'repeating-linear-gradient(to bottom, transparent 0, transparent ' + (PAGE_H - 2) + 'px, rgba(176,129,47,0.55) ' + (PAGE_H - 2) + 'px, rgba(176,129,47,0.55) ' + PAGE_H + 'px)';
    if (kind === 'oli') {
      // Vở ô li: ô lớn 32px (đường đậm ngang + dọc), mỗi ô chia 4 dòng li mảnh; lề đỏ bên trái
      st.backgroundImage = [
        pageBreaks,
        'linear-gradient(to right, transparent 63px, rgba(225,29,72,0.55) 63px, rgba(225,29,72,0.55) 65px, transparent 65px)',
        'linear-gradient(to right, rgba(91,120,190,0.42) 1px, transparent 1px)',
        'linear-gradient(to bottom, rgba(91,120,190,0.5) 1px, transparent 1px)',
        'linear-gradient(to bottom, rgba(91,120,190,0.2) 1px, transparent 1px)'
      ].join(',');
      st.backgroundSize = '100% ' + PAGE_H + 'px, 100% 100%, 32px 32px, 32px 32px, 8px 8px';
      st.backgroundPosition = '0 0, 0 0, 1px 0, 0 0, 0 0';
    } else if (kind === 'grid') {
      // Giấy ô vuông 5 mm (vẽ đồ thị): ô nhỏ 20px, ô lớn 100px
      st.backgroundImage = [
        pageBreaks,
        'linear-gradient(to right, rgba(91,120,190,0.45) 1px, transparent 1px)',
        'linear-gradient(to bottom, rgba(91,120,190,0.45) 1px, transparent 1px)',
        'linear-gradient(to right, rgba(91,120,190,0.18) 1px, transparent 1px)',
        'linear-gradient(to bottom, rgba(91,120,190,0.18) 1px, transparent 1px)'
      ].join(',');
      st.backgroundSize = '100% ' + PAGE_H + 'px, 100px 100px, 100px 100px, 20px 20px, 20px 20px';
    } else {
      st.backgroundImage = pageBreaks;
      st.backgroundSize = '100% ' + PAGE_H + 'px';
    }
    return st;
  }

  function InkBoard(props) {
    var ReactDOM = global.ReactDOM; // lấy lúc dựng (react-dom đã nạp)
    var wrapRef = useRef(null);
    var canvasRef = useRef(null);
    var endRef = useRef(null);      // SỬA 10/11/2026 — khối giấy ở cuối đề (khi không có câu nào để neo)
    var hostsRef = useRef({});      // THÊM 10/11/2026 — khoá câu -> <div> chứa tờ giấy, chèn ngay sau câu đó trong DOM
    var pendingRef = useRef(null);  // thay đổi giấy đang chờ đo độ cao thực để dời nét viết: {y, h0}
    var scrollKeyRef = useRef(null);// khối giấy vừa thêm -> cuộn tới
    var tbRef = useRef(null);       // thanh công cụ
    var dragRef = useRef(null);     // đang kéo thanh bút
    var lastTapRef = useRef(0);     // chạm đúp tay nắm -> về vị trí mặc định
    var baseRef = useRef(null);     // canvas ẩn chứa các nét đã hoàn tất (để vẽ lại nhanh)
    var dprRef = useRef(1);
    var strokesRef = useRef([]);    // các nét đã hoàn tất
    var historyRef = useRef([]);    // lịch sử để hoàn tác
    var currentRef = useRef(null);  // nét đang vẽ
    var activeRef = useRef(null);   // thao tác đang diễn ra: {id, kind: 'draw'|'erase'|'scroll'}
    var lastPenRef = useRef(0);     // thời điểm bút chạm gần nhất (chống chạm nhầm lòng bàn tay)
    var rafRef = useRef(0);
    var laserRef = useRef([]);      // THÊM 09/11/2026 — các vệt laser (không lưu, không hoàn tác)
    var baseDirtyRef = useRef(false); // lớp nền cần vẽ lại (gom lại 1 lần/khung hình)
    var sizeRef = useRef({ w: 0, h: 0, d: 0 });
    var resizeRafRef = useRef(0);

    var s1 = useState(true);   var writing = s1[0];   var setWriting = s1[1];
    var s2 = useState('pen');  var tool = s2[0];      var setTool = s2[1];
    var s3 = useState(COLORS[0].v); var color = s3[0]; var setColor = s3[1];
    var s4 = useState(WIDTHS[1].v); var width = s4[0]; var setWidth = s4[1];
    var s5 = useState(false);  var collapsed = s5[0]; var setCollapsed = s5[1];
    var s6 = useState(0);      var setRev = s6[1];   // chỉ để buộc render lại (nút hoàn tác)
    var s7 = useState([]);     var blocks = s7[0];    var setBlocks = s7[1]; // SỬA 10/11/2026 — [{key, pages}] thay cho 1 số trang
    var s9 = useState(loadToolbarPos); var pos = s9[0]; var setPos = s9[1];  // vị trí thanh bút (null = mặc định giữa đáy)
    var s8 = useState('oli');  var paper = s8[0];     var setPaper = s8[1];

    // Các handler luôn đọc giá trị mới nhất qua ref
    var optRef = useRef({});
    optRef.current = {
      tool: tool,
      color: color,
      width: width,
      fingerDraws: !!props.fingerDraws,
      scrollEl: props.scrollEl || null
    };
    var paperStateRef = useRef({ blocks: [], paper: 'oli' });
    paperStateRef.current = { blocks: blocks, paper: paper };
    var blocksRef = useRef([]);
    blocksRef.current = blocks;
    var pages = sumPages(blocks); // tổng số trang giấy

    function bump() {
      setRev(function (x) { return x + 1; });
    }

    // ---- Vẽ ----
    function paint() {
      rafRef.current = 0;
      var cv = canvasRef.current;
      if (!cv) return;
      var ctx = cv.getContext('2d');
      if (!ctx) {
        // Safari hết bộ nhớ canvas -> thử cấp phát lại 1 lần
        sizeRef.current = { w: 0, h: 0, d: 0 };
        resize();
        ctx = cv.getContext('2d');
        if (!ctx) return;
      }
      var more = false;
      try {
        if (baseDirtyRef.current) renderBase();
        var d = dprRef.current;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cv.width, cv.height);
        if (baseRef.current && baseRef.current.width) ctx.drawImage(baseRef.current, 0, 0);
        ctx.setTransform(d, 0, 0, d, 0, 0);
        if (currentRef.current) drawStroke(ctx, currentRef.current);
        if (laserRef.current.length) more = drawLaser(ctx, laserRef.current, nowMs());
      } catch (err) {
        if (global.console) console.warn('[InkBoard] paint', err);
      }
      if (more) schedule();
    }

    function schedule() {
      if (!rafRef.current) rafRef.current = requestAnimationFrame(paint);
    }

    function renderBase() {
      baseDirtyRef.current = false;
      var b = baseRef.current;
      if (!b) return;
      var ctx = b.getContext('2d');
      if (!ctx) return;
      var d = dprRef.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, b.width, b.height);
      ctx.setTransform(d, 0, 0, d, 0, 0);
      var arr = strokesRef.current;
      for (var i = 0; i < arr.length; i++) {
        try { drawStroke(ctx, arr[i]); } catch (e) {}
      }
    }

    // Đồng bộ kích thước canvas với khung nội dung (nội dung dài ra khi mở lời giải / thêm giấy)
    // SỬA 09/11/2026 — không cấp phát lại khi kích thước không đổi (mỗi lần cấp phát tốn hàng chục MB trên iPad)
    function resize() {
      var wrap = wrapRef.current;
      var cv = canvasRef.current;
      if (!wrap || !cv) return;
      var w = Math.max(1, wrap.clientWidth);
      var hh = Math.max(1, wrap.clientHeight);
      var d = Math.min(global.devicePixelRatio || 1, Math.sqrt(MAX_CANVAS_PIXELS / (w * hh)));
      d = Math.max(0.5, d);
      var sz = sizeRef.current;
      if (sz.w === w && sz.h === hh && Math.abs(sz.d - d) < 0.001 && baseRef.current) return;
      sizeRef.current = { w: w, h: hh, d: d };
      dprRef.current = d;
      var pw = Math.round(w * d), ph = Math.round(hh * d);
      if (!baseRef.current) baseRef.current = document.createElement('canvas');
      // về 0 trước để Safari trả bộ nhớ cũ ngay, rồi mới cấp phát cỡ mới
      releaseCanvas(cv);
      releaseCanvas(baseRef.current);
      cv.width = pw;
      cv.height = ph;
      baseRef.current.width = pw;
      baseRef.current.height = ph;
      renderBase();
      paint();
    }

    function scheduleResize() {
      if (resizeRafRef.current) return;
      resizeRafRef.current = requestAnimationFrame(function () {
        resizeRafRef.current = 0;
        resize();
      });
    }

    // Huỷ thao tác đang dở (bị kẹt do mất pointerup, chuyển ứng dụng…); commit = giữ nét đang viết
    function abortActive(commit) {
      var a = activeRef.current;
      activeRef.current = null;
      if (!a) return;
      if (a.kind === 'draw') {
        if (commit) commitCurrent(a);
        currentRef.current = null;
      } else if (a.kind === 'laser') {
        if (a.trail) a.trail.live = false;
      } else if (a.kind === 'erase' && a.pushed) {
        bump();
      }
      schedule();
    }

    useEffect(function () {
      var cvEl = canvasRef.current; // React xoá ref trước khi chạy dọn dẹp -> giữ lại phần tử để giải phóng
      resize();
      var ro = null;
      if (typeof ResizeObserver !== 'undefined' && wrapRef.current) {
        ro = new ResizeObserver(scheduleResize);
        ro.observe(wrapRef.current);
      } else {
        global.addEventListener('resize', scheduleResize);
      }
      function onHide() {
        abortActive(true);
        laserRef.current = [];
        schedule();
      }
      function onVis() { if (document.hidden) onHide(); }
      global.addEventListener('blur', onHide);
      document.addEventListener('visibilitychange', onVis);
      return function () {
        if (ro) ro.disconnect();
        else global.removeEventListener('resize', scheduleResize);
        global.removeEventListener('blur', onHide);
        document.removeEventListener('visibilitychange', onVis);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current);
        rafRef.current = 0;
        resizeRafRef.current = 0;
        // SỬA 09/11/2026 — trả bộ nhớ canvas ngay khi đóng (Safari giải phóng rất chậm -> dạy lâu bị "đơ")
        releaseCanvas(cvEl);
        releaseCanvas(baseRef.current);
        baseRef.current = null;
        laserRef.current = [];
      };
    }, []);

    // Đổi câu hỏi -> xoá nét vẽ + giấy nháp
    useEffect(function () {
      strokesRef.current = [];
      historyRef.current = [];
      currentRef.current = null;
      activeRef.current = null;
      laserRef.current = [];
      pendingRef.current = null;
      scrollKeyRef.current = null;
      setBlocks([]);
      renderBase();
      paint();
      bump();
    }, [props.resetKey]);

    // THÊM 10/11/2026 — sau mỗi lần thêm/bớt giấy (DOM đã đổi, chưa vẽ lên màn hình): đo độ cao thật của nội dung,
    // dời các nét nằm bên dưới chỗ chèn cho khớp, dọn các <div> giấy không còn dùng, rồi cấp lại canvas.
    useLayoutEffect(function () {
      var wrap = wrapRef.current;
      var p = pendingRef.current;
      pendingRef.current = null;
      var list = blocksRef.current;
      // dọn khối giấy đã bỏ (hết trang, hoặc đổi câu)
      var hosts = hostsRef.current;
      for (var k in hosts) {
        if (!Object.prototype.hasOwnProperty.call(hosts, k)) continue;
        if (!findBlock(list, k)) {
          if (hosts[k].parentNode) hosts[k].parentNode.removeChild(hosts[k]);
          delete hosts[k];
        }
      }
      if (p && wrap) {
        var delta = wrap.getBoundingClientRect().height - p.h0;
        if (Math.abs(delta) > 0.5) {
          var cache = new Map();
          strokesRef.current = shiftStrokes(strokesRef.current, p.y, delta, cache);
          historyRef.current = historyRef.current.map(function (snap) { return shiftStrokes(snap, p.y, delta, cache); });
        }
      }
      sizeRef.current = { w: 0, h: 0, d: 0 }; // chiều cao đổi -> buộc cấp lại canvas đúng cỡ
      resize();
      renderBase();
      paint();
      bump();
    }, [blocks]);

    // Câu bị React dựng lại (đổi bộ lọc…) -> đưa tờ giấy về ngay sau câu của nó
    useEffect(function () {
      var hosts = hostsRef.current;
      for (var k in hosts) {
        if (!Object.prototype.hasOwnProperty.call(hosts, k)) continue;
        var an = findAnchor(k);
        if (an && an.parentNode && hosts[k].previousSibling !== an) an.parentNode.insertBefore(hosts[k], an.nextSibling);
      }
    });

    // Vừa thêm giấy -> cuộn tới trang mới (chỉ khi trang mới chưa nằm trong tầm nhìn)
    useEffect(function () {
      var key = scrollKeyRef.current;
      if (!key) return;
      scrollKeyRef.current = null;
      var b = findBlock(blocks, key);
      var el = key === END_KEY ? endRef.current : hostsRef.current[key];
      if (!b || !el) return;
      try {
        var vp = viewportRect();
        var top = el.getBoundingClientRect().top + (b.pages - 1) * PAGE_H;
        if (top >= vp.top + 8 && top <= vp.bottom - 240) return;
        var want = vp.top + (vp.bottom - vp.top) * 0.3;
        var host = props.scrollEl;
        if (host) host.scrollTo({ top: host.scrollTop + (top - want), behavior: 'smooth' });
        else global.scrollTo({ top: global.pageYOffset + (top - want), behavior: 'smooth' });
      } catch (e) {}
    }, [blocks]);

    // Kẹp thanh bút trong màn hình khi xoay iPad / đổi cỡ cửa sổ / mở-thu gọn thanh
    useLayoutEffect(function () {
      var tb = tbRef.current;
      if (!tb || !pos || dragRef.current) return;
      var r = tb.getBoundingClientRect();
      var nx = clamp(r.left, EDGE, Math.max(EDGE, global.innerWidth - r.width - EDGE));
      var ny = clamp(r.top, EDGE, Math.max(EDGE, global.innerHeight - r.height - EDGE));
      if (Math.abs(nx - pos.x) > 0.5 || Math.abs(ny - pos.y) > 0.5) setPos({ x: nx, y: ny });
    });
    useEffect(function () {
      function onWinResize() { bump(); }
      global.addEventListener('resize', onWinResize);
      return function () { global.removeEventListener('resize', onWinResize); };
    }, []);

    // THÊM 10/11/2026 — tìm câu / tờ giấy đang chiếm nhiều chỗ nhất trên màn hình
    function viewportRect() {
      var top = 0, bottom = global.innerHeight || document.documentElement.clientHeight;
      var host = optRef.current.scrollEl;
      if (host) {
        var hr = host.getBoundingClientRect();
        top = Math.max(top, hr.top);
        bottom = Math.min(bottom, hr.bottom);
      }
      if (bottom < top) bottom = top;
      return { top: top, bottom: bottom };
    }
    function getAnchors() {
      var wrap = wrapRef.current;
      if (!wrap) return [];
      var out = [];
      var nodes = wrap.querySelectorAll(ANCHOR_SEL);
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        var inPaper = false;
        for (var hk in hostsRef.current) if (hostsRef.current[hk].contains(el)) inPaper = true;
        if (!inPaper) out.push({ el: el, key: anchorKey(el, out.length) });
      }
      return out;
    }
    function findAnchor(key) {
      var as = getAnchors();
      for (var i = 0; i < as.length; i++) if (as[i].key === key) return as[i].el;
      return null;
    }
    // Trả về { key, anchor } của nơi đang xem: tờ giấy hoặc câu có diện tích nhìn thấy lớn nhất (không có thì gần giữa màn hình nhất)
    function currentTarget() {
      var as = getAnchors();
      if (!as.length || !ReactDOM || !ReactDOM.createPortal) return null;
      var vp = viewportRect();
      var mid = (vp.top + vp.bottom) / 2;
      var best = null, bestVis = 0, near = null, nearD = Infinity;
      function consider(el, key, anchorEl) {
        var r = el.getBoundingClientRect();
        var vis = Math.min(r.bottom, vp.bottom) - Math.max(r.top, vp.top);
        if (vis > bestVis) { bestVis = vis; best = { key: key, anchor: anchorEl }; }
        var d = Math.abs((r.top + r.bottom) / 2 - mid);
        if (d < nearD) { nearD = d; near = { key: key, anchor: anchorEl }; }
      }
      for (var i = 0; i < as.length; i++) consider(as[i].el, as[i].key, as[i].el);
      for (var i2 = 0; i2 < as.length; i2++) {
        var hst = hostsRef.current[as[i2].key];
        if (hst && findBlock(blocksRef.current, as[i2].key)) consider(hst, as[i2].key, as[i2].el);
      }
      return best || near;
    }
    // Đảm bảo có <div> chứa giấy ngay sau câu `key` (tạo mới nếu chưa có); null nếu không tìm thấy câu
    function ensureHost(key) {
      if (hostsRef.current[key]) return hostsRef.current[key];
      var an = findAnchor(key);
      if (!an || !an.parentNode) return null;
      var host = document.createElement('div');
      an.parentNode.insertBefore(host, an.nextSibling);
      hostsRef.current[key] = host;
      return host;
    }

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

    // SỬA 10/11/2026 — thêm giấy ngay dưới câu đang xem (hoặc thêm trang vào tờ giấy đang xem)
    function addPage() {
      var wrap = wrapRef.current;
      if (!wrap || pages >= MAX_PAGES) return;
      var list = blocksRef.current;
      var tg = currentTarget();
      var key = END_KEY;
      var y = Infinity;
      if (tg) {
        var host = ensureHost(tg.key);
        if (host) {
          key = tg.key;
          var wr = wrap.getBoundingClientRect();
          var exist0 = findBlock(list, key);
          // nét có điểm đầu nằm dưới mép dưới của câu (hoặc của tờ giấy hiện có) sẽ bị đẩy xuống
          y = (exist0 ? host : tg.anchor).getBoundingClientRect().bottom - wr.top - 1;
        }
      }
      pendingRef.current = { y: y, h0: wrap.getBoundingClientRect().height };
      scrollKeyRef.current = key;
      var exist = findBlock(list, key);
      setBlocks(exist
        ? list.map(function (b) { return b.key === key ? { key: key, pages: b.pages + 1 } : b; })
        : list.concat([{ key: key, pages: 1 }]));
    }
    function removePage() {
      var wrap = wrapRef.current;
      var list = blocksRef.current;
      if (!wrap || !list.length) return;
      // chọn tờ giấy để bớt: tờ ở câu đang xem; không có thì tờ gần giữa màn hình nhất
      var tg = currentTarget();
      var target = tg ? findBlock(list, tg.key) : null;
      var vp = viewportRect();
      var mid = (vp.top + vp.bottom) / 2;
      if (!target) {
        var nd = Infinity;
        list.forEach(function (b) {
          var el = b.key === END_KEY ? endRef.current : hostsRef.current[b.key];
          if (!el) return;
          var r = el.getBoundingClientRect();
          var d = Math.abs((r.top + r.bottom) / 2 - mid);
          if (d < nd) { nd = d; target = b; }
        });
      }
      if (!target) target = list[list.length - 1];
      var el2 = target.key === END_KEY ? endRef.current : hostsRef.current[target.key];
      var wr = wrap.getBoundingClientRect();
      var top = el2 ? el2.getBoundingClientRect().top - wr.top : Infinity;
      var lastTop = top + (target.pages - 1) * PAGE_H;
      var lastBottom = top + target.pages * PAGE_H;
      var inLast = function (s) { return s.points.some(function (p) { return p[1] >= lastTop && p[1] < lastBottom; }); };
      var lost = strokesRef.current.some(inLast);
      if (lost && !global.confirm('Trang giấy này có nét viết. Vẫn bỏ trang này (xoá luôn các nét trên đó)?')) return;
      if (lost) {
        pushHistory();
        strokesRef.current = strokesRef.current.filter(function (s) { return !inLast(s); });
      }
      pendingRef.current = { y: lastBottom - 1, h0: wr.height };
      setBlocks(target.pages > 1
        ? list.map(function (b) { return b === target ? { key: b.key, pages: b.pages - 1 } : b; })
        : list.filter(function (b) { return b !== target; }));
    }

    function setStrokesExternal(arr) {
      strokesRef.current = Array.isArray(arr) ? arr : [];
      historyRef.current = [];
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
          setStrokes: setStrokesExternal,
          getState: function () {
            var bl = paperStateRef.current.blocks;
            var endB = findBlock(bl, END_KEY);
            return { strokes: strokesRef.current.slice(), pages: endB ? endB.pages : 0, paper: paperStateRef.current.paper, blocks: bl.slice() };
          },
          setState: function (st) {
            st = st || {};
            var nb = [];
            if (Array.isArray(st.blocks)) {
              st.blocks.forEach(function (b) {
                if (!b || !(b.pages > 0)) return;
                if (b.key !== END_KEY && !ensureHost(b.key)) return; // câu không còn trong danh sách -> bỏ tờ giấy
                if (sumPages(nb) >= MAX_PAGES) return;
                nb.push({ key: b.key, pages: Math.min(b.pages | 0, MAX_PAGES - sumPages(nb)) });
              });
            } else {
              var np = Math.max(0, Math.min(MAX_PAGES, Number(st.pages) || 0));
              if (np) nb.push({ key: END_KEY, pages: np });
            }
            setBlocks(nb);
            if (st.paper) setPaper(st.paper);
            // để giấy dựng xong (canvas đủ cao) rồi mới vẽ lại nét
            setTimeout(function () { setStrokesExternal(st.strokes || []); }, 0);
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
        baseDirtyRef.current = true; // vẽ lại nền 1 lần ở khung hình kế tiếp
        schedule();
      }
    }

    function drawOnBase(s) {
      var b = baseRef.current;
      if (!b) return;
      var ctx = b.getContext('2d');
      if (!ctx) return;
      var d = dprRef.current;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      try { drawStroke(ctx, s); } catch (e) {}
    }

    // Chốt nét đang vẽ vào danh sách nét (gọi khi nhấc bút, hoặc khi huỷ thao tác bị kẹt)
    function commitCurrent(a) {
      var s = currentRef.current;
      currentRef.current = null;
      if (s && a.shape) {
        // đường thẳng/mũi tên quá ngắn (chạm nhầm) thì bỏ
        var ddx = s.points[1][0] - s.points[0][0], ddy = s.points[1][1] - s.points[0][1];
        if (ddx * ddx + ddy * ddy < 16) s = null;
      }
      if (s && s.points.length) {
        delete s._t;
        if (!a.pushed) pushHistory();
        a.pushed = true;
        strokesRef.current = strokesRef.current.concat([s]);
        drawOnBase(s);
        bump();
      }
    }

    // Nét bút quá dài -> chốt phần đã viết vào lớp nền, phần tiếp nối bắt đầu từ 2 điểm cuối (liền mạch, không vuốt nhọn
    // ở chỗ nối). Cả nét vẫn là 1 bước hoàn tác.
    function chunkCurrent(a) {
      var s = currentRef.current;
      if (!s || s.kind !== 'pen' || s.points.length < CHUNK_PTS) return;
      var pts = s.points;
      var head = { kind: s.kind, color: s.color, width: s.width, points: pts.slice() };
      if (s.noTS) head.noTS = true;
      head.noTE = true;
      if (!a.pushed) { pushHistory(); a.pushed = true; }
      strokesRef.current = strokesRef.current.concat([head]);
      drawOnBase(head);
      s.points = pts.slice(pts.length - 2);
      s.noTS = true;
    }

    // ---- Xử lý Pointer Events ----
    function onDown(e) {
      var o = optRef.current;
      var cv = canvasRef.current;
      if (!cv) return;
      var now = Date.now();
      var prev = activeRef.current;
      if (prev) {
        // SỬA 09/11/2026 — trước đây có thao tác đang dở là bỏ qua luôn -> mất pointerup một lần là bút đơ mãi.
        // Bút luôn được ưu tiên (kể cả khi lòng bàn tay đang đè); thao tác im lặng quá lâu coi như bị kẹt.
        if (prev.id === e.pointerId || e.pointerType === 'pen' || now - (prev.t || 0) > STALE_MS) abortActive(true);
        else return;
      }

      if (e.pointerType === 'touch' && !o.fingerDraws) {
        // Chống chạm nhầm: đang viết (hoặc vừa nhấc bút) thì bỏ qua ngón tay / lòng bàn tay
        if (now - lastPenRef.current < PALM_GRACE_MS) return;
        activeRef.current = {
          id: e.pointerId, kind: 'scroll', t: now,
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
        activeRef.current = { id: e.pointerId, kind: 'erase', pushed: false, t: now };
        eraseAt(x, y, activeRef.current, o);
      } else if (o.tool === 'laser') {
        var tr = { color: o.color, live: true, pts: [[x, y, nowMs()]] };
        laserRef.current.push(tr);
        if (laserRef.current.length > 12) laserRef.current.shift();
        activeRef.current = { id: e.pointerId, kind: 'laser', trail: tr, t: now };
      } else if (o.tool === 'line' || o.tool === 'arrow') {
        currentRef.current = { kind: o.tool, color: o.color, width: o.width, points: [[x, y, 1], [x, y, 1]] };
        activeRef.current = { id: e.pointerId, kind: 'draw', shape: true, t: now };
      } else {
        var st = { kind: o.tool === 'hl' ? 'hl' : 'pen', color: o.color, width: o.width, points: [] };
        addPoint(st, x, y, e.pressure, e.pointerType, e.timeStamp || now);
        currentRef.current = st;
        activeRef.current = { id: e.pointerId, kind: 'draw', type: e.pointerType, t: now };
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
      a.t = Date.now();

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
      var tl = nowMs();
      for (var i = 0; i < evs.length; i++) {
        var x = evs[i].clientX - r.left;
        var y = evs[i].clientY - r.top;
        if (a.kind === 'laser') {
          var lp = a.trail.pts, lq = lp[lp.length - 1];
          if (!lq || Math.abs(lq[0] - x) + Math.abs(lq[1] - y) > 1) lp.push([x, y, tl]);
          else lq[2] = tl;
        } else if (a.kind === 'draw' && currentRef.current) {
          if (a.shape) {
            currentRef.current.points[1] = [x, y, 1];
          } else {
            addPoint(currentRef.current, x, y, evs[i].pressure, e.pointerType, evs[i].timeStamp || Date.now());
          }
        } else if (a.kind === 'erase') {
          eraseAt(x, y, a, o);
        }
      }
      if (a.kind === 'draw' && !a.shape) chunkCurrent(a);
      schedule();
    }

    // commit: true = nhấc bút bình thường, false = huỷ (pointercancel), 'lost' = mất pointer capture
    function onEnd(e, commit) {
      var a = activeRef.current;
      var cv = canvasRef.current;
      if (!a || !cv || a.id !== e.pointerId) return;
      activeRef.current = null;
      if (commit !== 'lost') {
        try { cv.releasePointerCapture(e.pointerId); } catch (err) {}
      }

      if (a.kind === 'scroll') {
        // Ngón tay chạm nhẹ (không kéo) -> chuyển cú chạm xuống phần tử bên dưới (vd. nút "Hiện lời giải")
        if (commit === true && !a.moved) {
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

      if (a.kind === 'laser') {
        a.trail.live = false;
      } else if (a.kind === 'draw') {
        if (commit) commitCurrent(a);
        else if (a.pushed) bump(); // phần đầu nét dài đã chốt vẫn giữ
        currentRef.current = null;
      } else if (a.kind === 'erase') {
        bump();
      }
      schedule();
    }

    // ---- Giao diện ----
    function btn(label, onClick, opts) {
      opts = opts || {};
      return h('button', {
        key: opts.key, // SỬA 7/10/2026 — React cảnh báo thiếu key ở danh sách nút độ dày nét
        type: 'button',
        onClick: onClick,
        disabled: !!opts.disabled,
        title: opts.title || label,
        style: {
          minWidth: 40, minHeight: 40, padding: '0 10px',
          // SỬA 04/10/2026 — dùng biến màu của trang admin (có màu dự phòng khi chạy riêng như ink-demo.html)
          border: opts.active ? '2px solid var(--accent, #1d4ed8)' : '1px solid var(--line, #cbd5e1)',
          borderRadius: 10,
          background: opts.active ? 'color-mix(in srgb, var(--accent, #1d4ed8) 16%, var(--surface, #ffffff))' : 'var(--surface, #ffffff)',
          color: 'var(--ink, #0f172a)', fontSize: 15, fontWeight: 600, fontFamily: 'inherit',
          opacity: opts.disabled ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          touchAction: 'manipulation', cursor: 'pointer'
        }
      }, label);
    }
    function sep(k) {
      return h('span', { key: k, style: { width: 1, alignSelf: 'stretch', background: 'var(--line, #cbd5e1)', margin: '0 2px' } });
    }

    // THÊM 10/11/2026 — tay nắm để kéo thanh bút
    function onGripDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var tb = tbRef.current;
      if (!tb) return;
      var r = tb.getBoundingClientRect();
      dragRef.current = { id: e.pointerId, ox: e.clientX - r.left, oy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, moved: false, x: r.left, y: r.top };
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
      e.stopPropagation();
    }
    function onGripMove(e) {
      var d = dragRef.current;
      var tb = tbRef.current;
      if (!d || !tb || d.id !== e.pointerId) return;
      if (!d.moved && Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) < 4) return;
      d.moved = true;
      var r = tb.getBoundingClientRect();
      d.x = clamp(e.clientX - d.ox, EDGE, Math.max(EDGE, global.innerWidth - r.width - EDGE));
      d.y = clamp(e.clientY - d.oy, EDGE, Math.max(EDGE, global.innerHeight - r.height - EDGE));
      // đổi style trực tiếp cho mượt (không render lại); thả tay mới lưu vào state
      tb.style.left = d.x + 'px';
      tb.style.top = d.y + 'px';
      tb.style.bottom = 'auto';
      tb.style.transform = 'none';
      e.preventDefault();
    }
    function onGripEnd(e) {
      var d = dragRef.current;
      if (!d || d.id !== e.pointerId) return;
      dragRef.current = null;
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {}
      if (d.moved) {
        var np = { x: d.x, y: d.y };
        setPos(np);
        saveToolbarPos(np);
        lastTapRef.current = 0;
      } else {
        var t = Date.now();
        if (t - lastTapRef.current < 400) { // chạm đúp -> về vị trí mặc định
          setPos(null);
          saveToolbarPos(null);
          lastTapRef.current = 0;
          var tb = tbRef.current;
          if (tb) { tb.style.left = ''; tb.style.top = ''; tb.style.bottom = ''; tb.style.transform = ''; }
        } else {
          lastTapRef.current = t;
        }
      }
    }
    var grip = h('span', {
      key: 'grip',
      title: 'Kéo để dời thanh bút (chạm đúp: về giữa đáy)',
      onPointerDown: onGripDown,
      onPointerMove: onGripMove,
      onPointerUp: onGripEnd,
      onPointerCancel: onGripEnd,
      style: {
        minWidth: 28, minHeight: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, lineHeight: 1, color: 'var(--muted, #64748b)', cursor: 'grab', touchAction: 'none',
        userSelect: 'none', WebkitUserSelect: 'none', borderRadius: 8, background: 'color-mix(in srgb, var(--line, #cbd5e1) 45%, transparent)'
      }
    }, '⠿');

    var toolbar;
    if (collapsed) {
      toolbar = h('div', { ref: tbRef, style: toolbarBox(pos) },
        grip,
        btn(writing ? '✏️' : '✋', function () { setCollapsed(false); }, { title: 'Mở thanh công cụ' }));
    } else {
      var paperIdx = 0;
      for (var pi = 0; pi < PAPERS.length; pi++) if (PAPERS[pi].v === paper) paperIdx = pi;
      toolbar = h('div', { ref: tbRef, style: toolbarBox(pos) },
        grip,
        btn(writing ? '✏️ Viết' : '✋ Cuộn', function () { setWriting(!writing); },
          { active: writing, title: 'Bật/tắt chế độ viết' }),
        sep('s1'),
        TOOLS.map(function (t) {
          return btn(t.icon, function () { setTool(t.v); if (!writing) setWriting(true); },
            { key: 't' + t.v, active: tool === t.v, title: t.t });
        }),
        sep('s2'),
        COLORS.map(function (c) {
          var on = color === c.v && tool !== 'erase';
          return h('button', {
            key: c.v, type: 'button', title: c.t,
            onClick: function () { setColor(c.v); if (tool === 'erase') setTool('pen'); },
            style: {
              width: 30, height: 30, borderRadius: 15, background: c.v, padding: 0,
              border: on ? '3px solid var(--surface, #ffffff)' : '2px solid var(--surface, #ffffff)',
              boxShadow: on ? '0 0 0 2px ' + c.v : '0 0 0 1px #94a3b8',
              touchAction: 'manipulation', cursor: 'pointer'
            }
          });
        }),
        sep('s3'),
        WIDTHS.map(function (w) {
          return btn(h('span', { style: { display: 'inline-block', width: w.dot, height: w.dot, borderRadius: '50%', background: tool === 'erase' ? '#64748b' : color } }),
            function () { setWidth(w.v); }, { key: 'w' + w.v, active: width === w.v, title: 'Nét ' + w.t.toLowerCase() });
        }),
        sep('s4'),
        btn('↶', undo, { disabled: !historyRef.current.length, title: 'Hoàn tác' }),
        btn('🗑', clearAll, { disabled: !strokesRef.current.length, title: 'Xoá hết nét vẽ' }),
        sep('s5'),
        btn('📄 + Giấy', addPage, { disabled: pages >= MAX_PAGES, title: 'Thêm 1 trang giấy nháp ngay dưới câu đang xem để viết tự do' }),
        pages ? btn('−', removePage, { title: 'Bớt 1 trang giấy (ở câu đang xem)' }) : null,
        pages ? btn(PAPERS[paperIdx].t, function () { setPaper(PAPERS[(paperIdx + 1) % PAPERS.length].v); }, { title: 'Đổi kiểu giấy: ô li / ô vuông / trắng' }) : null,
        btn('✕', function () { setCollapsed(true); }, { title: 'Thu gọn' }));
    }

    function paperBlock(b, ref) {
      return h('div', { key: b.key, ref: ref, style: paperStyle(paper, b.pages) },
        h('div', { style: { position: 'absolute', right: 10, top: 6, fontSize: 11, color: '#a8a29e', fontFamily: 'inherit', pointerEvents: 'none' } },
          'Giấy nháp · ' + b.pages + ' trang'));
    }
    // Giấy chèn sau từng câu: portal vào <div> đã chèn ngay sau câu trong DOM; giấy ở cuối đề: vẽ thẳng như cũ
    var paperNodes = [];
    for (var bi = 0; bi < blocks.length; bi++) {
      var blk = blocks[bi];
      if (blk.key === END_KEY) paperNodes.push(paperBlock(blk, endRef));
      else if (hostsRef.current[blk.key] && ReactDOM && ReactDOM.createPortal) {
        paperNodes.push(ReactDOM.createPortal(paperBlock(blk), hostsRef.current[blk.key], blk.key));
      }
    }

    return h('div', { ref: wrapRef, style: { position: 'relative' } },
      props.children,
      paperNodes,
      h('canvas', {
        ref: canvasRef,
        onPointerDown: onDown,
        onPointerMove: onMove,
        onPointerUp: function (e) { onEnd(e, true); },
        onPointerCancel: function (e) { onEnd(e, false); },
        onLostPointerCapture: function (e) { onEnd(e, 'lost'); },
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

  function toolbarBox(pos) {
    // SỬA 10/11/2026 — có vị trí do thầy kéo thì dùng left/top, chưa có thì giữa đáy như cũ
    var place = pos
      ? { left: pos.x, top: pos.y, width: 'max-content' }
      : { left: '50%', bottom: 16, transform: 'translateX(-50%)' };
    return {
      position: 'fixed', left: place.left, top: place.top, bottom: place.bottom, transform: place.transform, width: place.width, zIndex: 20,
      display: 'flex', alignItems: 'center', gap: 6, padding: 8, flexWrap: 'wrap', justifyContent: 'center',
      maxWidth: '96vw', background: 'color-mix(in srgb, var(--surface, #ffffff) 96%, transparent)', border: '1px solid var(--line, #cbd5e1)',
      borderRadius: 14, boxShadow: '0 6px 24px rgba(15,23,42,0.18)', touchAction: 'manipulation'
    };
  }

  global.InkBoard = InkBoard;
})(window);
