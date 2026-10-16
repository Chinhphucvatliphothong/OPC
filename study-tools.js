/**
 * study-tools.js — THÊM 16/10/2026
 * Công cụ hỗ trợ khi làm bài online (trang học sinh) và khi giảng (Phòng dạy ở admin):
 *  1) BÚT DẠ QUANG TÔ CHỮ: bật "🖍️ Tô dữ kiện" rồi kéo ngón tay / bút / chuột lướt qua chữ trong đề để tô màu (vàng, xanh,
 *     hồng) như bút dạ quang thật; 🧽 kéo qua chỗ đã tô để xoá. Không sửa nội dung đề (dùng CSS Custom Highlight API), nhớ
 *     phần đã tô theo từng câu trong lúc làm bài (đi câu khác rồi quay lại vẫn còn).
 *  2) MÁY TÍNH KHOA HỌC NỔI (thao tác theo kiểu máy fx-580VN mà học sinh quen dùng): kéo thả được, thu nhỏ được; có SHIFT,
 *     sin/cos/tan (+ hàm ngược), log, ln, 10ˣ, eˣ, x², xʸ, √, x⁻¹, π, e, ×10ˣ, Ans, chế độ Deg/Rad, S⇔D (phân số ↔ thập phân),
 *     SOLVE (giải phương trình theo biến X), con trỏ ◀ ▶, lịch sử. Gõ bằng bàn phím máy tính cũng được.
 *     Đây là máy tính mô phỏng thao tác, KHÔNG phải phần mềm chính hãng.
 * Xuất: window.OPC_TOOLS = { HighlightZone, StudyBar, toggleCalc, openCalc, closeCalc, clearMarks }
 * Cần React 18 UMD nạp TRƯỚC file này.
 */
(function(window, document){
  'use strict';
  var React = window.React;
  if(!React){ console.error('[study-tools] Chưa nạp React'); return; }
  var h = React.createElement;

  // ============================================================ CSS dùng chung
  var STYLE_CSS = '' +
    '::highlight(opc-hl-y){background-color:rgba(255,226,52,.62);color:inherit;}' +
    '::highlight(opc-hl-g){background-color:rgba(110,231,140,.55);color:inherit;}' +
    '::highlight(opc-hl-p){background-color:rgba(249,148,206,.55);color:inherit;}' +
    '::highlight(opc-hl-tmp){background-color:rgba(255,200,0,.38);color:inherit;}' +
    '.opc-hlzone.on{cursor:text;touch-action:none;-webkit-user-select:none;user-select:none;outline:2px dashed rgba(234,179,8,.55);outline-offset:4px;border-radius:6px;}' +
    '.opc-sbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:4px 0 8px;font:600 .8rem "Be Vietnam Pro",system-ui,sans-serif;}' +
    '.opc-sbar button{border:1px solid var(--line,#dde1d5);background:var(--surface,#fff);color:var(--ink,#12161c);border-radius:999px;padding:5px 11px;font:inherit;cursor:pointer;touch-action:manipulation;}' +
    '.opc-sbar button.on{background:#fde047;border-color:#eab308;color:#422006;}' +
    '.opc-sbar .dot{width:26px;height:26px;padding:0;border-radius:50%;}' +
    '.opc-sbar .dot.sel{outline:3px solid var(--ink,#12161c);outline-offset:1px;}' +
    '.opc-sbar .hint{font-weight:500;color:var(--muted,#868d7c);font-size:.75rem;}' +
    // máy tính
    '.opc-calc{position:fixed;z-index:3000;width:292px;background:#1f2633;color:#e8ecf2;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.45);font-family:"Be Vietnam Pro",system-ui,sans-serif;user-select:none;-webkit-user-select:none;touch-action:none;}' +
    '.opc-calc .hd{display:flex;align-items:center;gap:6px;padding:8px 10px 6px;cursor:move;font-size:.78rem;font-weight:700;color:#aeb8c8;}' +
    '.opc-calc .hd b{flex:1;}' +
    '.opc-calc .hd button{border:0;background:#2e3747;color:#dfe5ee;border-radius:7px;width:26px;height:24px;cursor:pointer;font-size:.85rem;}' +
    '.opc-calc .scr{margin:0 10px;background:#c9d6b8;color:#1b2414;border-radius:8px;padding:6px 8px;min-height:74px;font-family:ui-monospace,Menlo,Consolas,monospace;box-shadow:inset 0 2px 6px rgba(0,0,0,.25);}' +
    '.opc-calc .ind{display:flex;gap:8px;font-size:.62rem;font-weight:800;min-height:12px;opacity:.85;}' +
    '.opc-calc .ind .off{opacity:.18;}' +
    '.opc-calc .in{font-size:1rem;line-height:1.35;min-height:1.4em;word-break:break-all;white-space:pre-wrap;}' +
    '.opc-calc .in .cur{display:inline-block;width:2px;height:1.05em;background:#1b2414;vertical-align:-2px;animation:opcblink 1s steps(1) infinite;}' +
    '@keyframes opcblink{50%{opacity:0;}}' +
    '.opc-calc .out{font-size:1.45rem;font-weight:700;text-align:right;min-height:1.4em;overflow-x:auto;white-space:nowrap;}' +
    '.opc-calc .out.err{font-size:1rem;color:#7f1d1d;}' +
    '.opc-calc .keys{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;padding:10px;}' +
    '.opc-calc .k{position:relative;border:0;border-radius:9px;height:38px;font:700 .86rem "Be Vietnam Pro",system-ui,sans-serif;cursor:pointer;background:#3a4456;color:#f1f4f8;box-shadow:0 2px 0 rgba(0,0,0,.35);touch-action:manipulation;padding:0;}' +
    '.opc-calc .k:active{transform:translateY(1px);box-shadow:none;}' +
    '.opc-calc .k.num{background:#e9edf2;color:#111827;font-size:1rem;}' +
    '.opc-calc .k.op{background:#5b6578;}' +
    '.opc-calc .k.del{background:#d97706;}' +
    '.opc-calc .k.ac{background:#dc2626;}' +
    '.opc-calc .k.eq{background:#2563eb;}' +
    '.opc-calc .k.shift{background:#ca8a04;color:#1f1500;}' +
    '.opc-calc .k.shift.on{background:#fde047;}' +
    '.opc-calc .k small{position:absolute;top:-1px;left:0;right:0;font-size:.55rem;color:#facc15;font-weight:700;line-height:1;}' +
    '.opc-calc .k.num small{color:#a16207;}' +
    '.opc-calc .hist{max-height:110px;overflow:auto;margin:0 10px 8px;font:.72rem ui-monospace,Menlo,monospace;color:#b9c3d3;}' +
    '.opc-calc .hist div{display:flex;justify-content:space-between;gap:8px;padding:2px 0;border-bottom:1px dashed #3a4456;cursor:pointer;}' +
    '.opc-calc.min .scr,.opc-calc.min .keys,.opc-calc.min .hist{display:none;}' +
    '.opc-calc .ft{font-size:.6rem;color:#7f8aa0;text-align:center;padding:0 10px 8px;}';
  function ensureStyle(){
    if(document.getElementById('opc-tools-style')) return;
    var st = document.createElement('style'); st.id = 'opc-tools-style'; st.textContent = STYLE_CSS; document.head.appendChild(st);
  }
  ensureStyle();

  // ============================================================ 1) BÚT DẠ QUANG
  var HL_SUPPORTED = !!(window.CSS && CSS.highlights && window.Highlight);
  var HL_NAMES = { y: 'opc-hl-y', g: 'opc-hl-g', p: 'opc-hl-p' };
  var hlObjs = {};
  function hlObj(name){
    if(!HL_SUPPORTED) return null;
    if(!hlObjs[name]){ hlObjs[name] = new window.Highlight(); CSS.highlights.set(name, hlObjs[name]); }
    return hlObjs[name];
  }
  // trạng thái dùng chung (bật/tắt, màu, dấu tô theo từng câu)
  var store = { active: false, color: 'y', marks: {} }, subs = [];
  function emit(){ subs.slice().forEach(function(f){ try{ f(); }catch(e){} }); }
  function useStore(){
    var st = React.useState(0), force = st[1];
    React.useEffect(function(){ var f = function(){ force(function(x){ return x + 1; }); }; subs.push(f); return function(){ subs.splice(subs.indexOf(f), 1); }; }, []);
    return store;
  }
  function setActive(v){ store.active = !!v; emit(); }
  function setColor(c){ store.color = c; store.active = true; emit(); }
  function clearMarks(key){ if(key == null) store.marks = {}; else delete store.marks[key]; emit(); }

  function textNodes(root){
    var out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n;
    while((n = w.nextNode())) out.push(n);
    return out;
  }
  function offsetOf(root, node, off){
    var nodes = textNodes(root), total = 0;
    if(node.nodeType !== 3){
      // vị trí giữa các phần tử con → quy về text node gần nhất
      var r = document.createRange(); r.setStart(node, off); r.collapse(true);
      for(var i = 0; i < nodes.length; i++){
        var rr = document.createRange(); rr.selectNodeContents(nodes[i]);
        if(rr.compareBoundaryPoints(Range.START_TO_START, r) >= 0) return total;
        total += nodes[i].length;
      }
      return total;
    }
    for(var j = 0; j < nodes.length; j++){
      if(nodes[j] === node) return total + off;
      total += nodes[j].length;
    }
    return -1;
  }
  function rangeFromOffsets(root, s, e){
    var nodes = textNodes(root), total = 0, r = document.createRange(), started = false;
    for(var i = 0; i < nodes.length; i++){
      var len = nodes[i].length;
      if(!started && s <= total + len){ r.setStart(nodes[i], Math.max(0, s - total)); started = true; }
      if(started && e <= total + len){ r.setEnd(nodes[i], Math.max(0, e - total)); return r; }
      total += len;
    }
    return started ? r : null;
  }
  function caretAt(x, y){
    if(document.caretPositionFromPoint){ var p = document.caretPositionFromPoint(x, y); return p ? { node: p.offsetNode, off: p.offset } : null; }
    if(document.caretRangeFromPoint){ var r = document.caretRangeFromPoint(x, y); return r ? { node: r.startContainer, off: r.startOffset } : null; }
    return null;
  }
  // gộp/xoá dấu tô
  function addMark(list, s, e, c){
    var out = [];
    list.forEach(function(m){
      if(m.e <= s || m.s >= e){ out.push(m); return; }
      if(m.c === c){ s = Math.min(s, m.s); e = Math.max(e, m.e); return; }
      if(m.s < s) out.push({ s: m.s, e: s, c: m.c });
      if(m.e > e) out.push({ s: e, e: m.e, c: m.c });
    });
    if(c !== 'erase') out.push({ s: s, e: e, c: c });
    return out.sort(function(a, b){ return a.s - b.s; });
  }

  function HighlightZone(props){
    var st = useStore();
    var ref = React.useRef(null), ranges = React.useRef([]), drag = React.useRef(null), tmp = React.useRef(null);
    var key = props.zoneKey || 'default';
    function unregister(){
      ranges.current.forEach(function(x){ var o = hlObj(x.n); if(o) o.delete(x.r); });
      ranges.current = [];
    }
    function apply(){
      if(!HL_SUPPORTED || !ref.current) return;
      unregister();
      (store.marks[key] || []).forEach(function(m){
        var r = rangeFromOffsets(ref.current, m.s, m.e);
        if(r){ var n = HL_NAMES[m.c] || HL_NAMES.y; hlObj(n).add(r); ranges.current.push({ n: n, r: r }); }
      });
    }
    // vẽ lại sau MỖI lần render (React có thể thay text node → range cũ mất hiệu lực)
    React.useEffect(apply);
    React.useEffect(function(){ return function(){ unregister(); if(tmp.current){ var o = hlObj('opc-hl-tmp'); if(o) o.clear(); } }; }, []);
    var on = st.active && HL_SUPPORTED;
    function down(e){
      if(!on) return;
      var c = caretAt(e.clientX, e.clientY);
      if(!c || !ref.current.contains(c.node)) return;
      var s = offsetOf(ref.current, c.node, c.off); if(s < 0) return;
      e.preventDefault();
      try{ e.currentTarget.setPointerCapture(e.pointerId); }catch(err){}
      drag.current = { s: s, e: s };
    }
    function move(e){
      if(!drag.current) return;
      var c = caretAt(e.clientX, e.clientY);
      if(!c || !ref.current.contains(c.node)) return;
      var o = offsetOf(ref.current, c.node, c.off); if(o < 0) return;
      drag.current.e = o;
      var a = Math.min(drag.current.s, o), b = Math.max(drag.current.s, o);
      var t = hlObj('opc-hl-tmp'); t.clear();
      var r = b > a ? rangeFromOffsets(ref.current, a, b) : null;
      if(r && store.color !== 'erase') t.add(r);
      tmp.current = r;
    }
    function up(){
      var d = drag.current; drag.current = null;
      var t = hlObj('opc-hl-tmp'); if(t) t.clear();
      if(!d) return;
      var a = Math.min(d.s, d.e), b = Math.max(d.s, d.e);
      if(b - a < 1) return;
      store.marks[key] = addMark(store.marks[key] || [], a, b, store.color);
      emit();
    }
    return h('div', { ref: ref, className: 'opc-hlzone' + (on ? ' on' : ''), onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up }, props.children);
  }

  function StudyBar(props){
    var st = useStore();
    var key = props.zoneKey || 'default';
    var n = (st.marks[key] || []).length;
    var calcOpen = !!calcState.open;
    var colors = [{ c: 'y', bg: '#fde047', t: 'Vàng' }, { c: 'g', bg: '#86efac', t: 'Xanh' }, { c: 'p', bg: '#f9a8d4', t: 'Hồng' }];
    return h('div', { className: 'opc-sbar' },
      props.noHighlight ? null : h('button', { type: 'button', className: st.active ? 'on' : '', title: 'Kéo qua chữ trong đề để tô như bút dạ quang',
        onClick: function(){ if(!HL_SUPPORTED){ window.alert('Trình duyệt này chưa hỗ trợ tô chữ. Em cập nhật Safari / Chrome bản mới nhé.'); return; } setActive(!st.active); } },
        st.active ? '🖍️ Đang tô — bấm để tắt' : '🖍️ Tô dữ kiện'),
      (!props.noHighlight && st.active) ? colors.map(function(x){
        return h('button', { key: x.c, type: 'button', className: 'dot' + (st.color === x.c ? ' sel' : ''), title: x.t, style: { background: x.bg }, onClick: function(){ setColor(x.c); } });
      }) : null,
      (!props.noHighlight && st.active) ? h('button', { type: 'button', className: st.color === 'erase' ? 'on' : '', title: 'Kéo qua chỗ đã tô để xoá', onClick: function(){ setColor('erase'); } }, '🧽') : null,
      (!props.noHighlight && n) ? h('button', { type: 'button', title: 'Xoá hết phần đã tô ở câu này', onClick: function(){ clearMarks(key); } }, 'Xoá tô') : null,
      props.noCalc ? null : h('button', { type: 'button', className: calcOpen ? 'on' : '', onClick: toggleCalc, title: 'Máy tính khoa học nổi trên màn hình' }, '🧮 Máy tính'),
      (!props.noHighlight && st.active) ? h('span', { className: 'hint' }, 'Kéo ngón tay / bút qua chữ để tô · tắt để cuộn trang') : null);
  }

  // ============================================================ 2) MÁY TÍNH KHOA HỌC
  // Biểu thức = mảng "token". Mỗi token: { t: chữ hiển thị, k: loại, v: giá trị }.
  var FN = {
    sin: { t: 'sin(', f: function(x, d){ return Math.sin(d ? x * Math.PI / 180 : x); } },
    cos: { t: 'cos(', f: function(x, d){ return Math.cos(d ? x * Math.PI / 180 : x); } },
    tan: { t: 'tan(', f: function(x, d){ var a = d ? x * Math.PI / 180 : x; if(d && Math.abs(((x % 180) + 180) % 180 - 90) < 1e-12) throw new Error('Math ERROR'); return Math.tan(a); } },
    asin: { t: 'sin⁻¹(', f: function(x, d){ if(Math.abs(x) > 1) throw new Error('Math ERROR'); var r = Math.asin(x); return d ? r * 180 / Math.PI : r; } },
    acos: { t: 'cos⁻¹(', f: function(x, d){ if(Math.abs(x) > 1) throw new Error('Math ERROR'); var r = Math.acos(x); return d ? r * 180 / Math.PI : r; } },
    atan: { t: 'tan⁻¹(', f: function(x, d){ var r = Math.atan(x); return d ? r * 180 / Math.PI : r; } },
    log: { t: 'log(', f: function(x){ if(x <= 0) throw new Error('Math ERROR'); return Math.log10(x); } },
    ln: { t: 'ln(', f: function(x){ if(x <= 0) throw new Error('Math ERROR'); return Math.log(x); } },
    tenx: { t: '10^(', f: function(x){ return Math.pow(10, x); } },
    ex: { t: 'e^(', f: function(x){ return Math.exp(x); } },
    sqrt: { t: '√(', f: function(x){ if(x < 0) throw new Error('Math ERROR'); return Math.sqrt(x); } },
    cbrt: { t: '³√(', f: function(x){ return Math.cbrt(x); } },
    abs: { t: 'Abs(', f: function(x){ return Math.abs(x); } }
  };
  function tok(k, t, v){ return { k: k, t: t, v: v }; }

  function parse(tokens, env){
    var i = 0;
    function peek(){ return tokens[i]; }
    function next(){ return tokens[i++]; }
    function isStartOfFactor(t){ return t && (t.k === 'num' || t.k === 'const' || t.k === 'fn' || t.k === 'lp' || t.k === 'var'); }
    function expr(){
      var v = term();
      while(peek() && (peek().k === 'add' || peek().k === 'sub')){ var op = next().k; var r = term(); v = op === 'add' ? v + r : v - r; }
      return v;
    }
    function term(){
      var v = unary();
      while(true){
        var t = peek();
        if(t && (t.k === 'mul' || t.k === 'div')){ next(); var r = unary(); if(t.k === 'div'){ if(r === 0) throw new Error('Math ERROR'); v = v / r; } else v = v * r; }
        else if(isStartOfFactor(t)){ v = v * unary(); } // nhân ngầm: 2π, 3sin(30), 2(3+1)
        else break;
      }
      return v;
    }
    function unary(){
      if(peek() && (peek().k === 'neg' || peek().k === 'sub')){ next(); return -unary(); }
      if(peek() && peek().k === 'add'){ next(); return unary(); }
      return power();
    }
    function power(){
      var b = postfix();
      if(peek() && peek().k === 'pow'){ next(); var e = unary(); var r = Math.pow(b, e); if(isNaN(r)) throw new Error('Math ERROR'); return r; }
      return b;
    }
    function postfix(){
      var v = primary();
      while(peek() && (peek().k === 'sq' || peek().k === 'inv' || peek().k === 'cube' || peek().k === 'fact' || peek().k === 'exp10')){
        var t = next();
        if(t.k === 'sq') v = v * v;
        else if(t.k === 'cube') v = v * v * v;
        else if(t.k === 'inv'){ if(v === 0) throw new Error('Math ERROR'); v = 1 / v; }
        else if(t.k === 'fact'){ if(v < 0 || v !== Math.floor(v) || v > 170) throw new Error('Math ERROR'); var f = 1; for(var q = 2; q <= v; q++) f *= q; v = f; }
        else if(t.k === 'exp10'){ var neg = false; if(peek() && (peek().k === 'neg' || peek().k === 'sub')){ next(); neg = true; } var e = primary(); v = v * Math.pow(10, neg ? -e : e); }
      }
      return v;
    }
    function primary(){
      var t = next();
      if(!t) throw new Error('Syntax ERROR');
      if(t.k === 'num'){
        var s = t.v; while(peek() && peek().k === 'num'){ s += next().v; }
        if((s.match(/\./g) || []).length > 1 || s === '.') throw new Error('Syntax ERROR');
        return parseFloat(s);
      }
      if(t.k === 'const') return t.v === 'pi' ? Math.PI : (t.v === 'e' ? Math.E : (t.v === 'ans' ? env.ans : 0));
      if(t.k === 'var'){ if(env.x == null) env.x = 0; return env.x; }
      if(t.k === 'lp'){ var v = expr(); if(peek() && peek().k === 'rp') next(); return v; }
      if(t.k === 'fn'){ var a = expr(); if(peek() && peek().k === 'rp') next(); var r = FN[t.v].f(a, env.deg); if(!isFinite(r)) throw new Error('Math ERROR'); return r; }
      throw new Error('Syntax ERROR');
    }
    var out = expr();
    if(i < tokens.length) throw new Error('Syntax ERROR');
    if(!isFinite(out)) throw new Error('Math ERROR');
    return out;
  }
  function evaluate(tokens, env){
    var eq = -1; tokens.forEach(function(t, k){ if(t.k === 'eqs') eq = k; });
    if(eq > -1){ // "vế trái = vế phải" → giá trị vế trái - vế phải (dùng cho SOLVE)
      var l = parse(tokens.slice(0, eq), env), r = parse(tokens.slice(eq + 1), env);
      return l - r;
    }
    return parse(tokens, env);
  }
  function solve(tokens, env){
    if(!tokens.some(function(t){ return t.k === 'var'; })) throw new Error('Chưa có biến X');
    function f(x){ var e = { ans: env.ans, deg: env.deg, x: x }; return evaluate(tokens, e); }
    function newton(x0){
      var x = x0;
      for(var it = 0; it < 80; it++){
        var fx = f(x); if(Math.abs(fx) < 1e-13) return x;
        var hh = Math.max(1e-7, Math.abs(x) * 1e-7), d = (f(x + hh) - f(x - hh)) / (2 * hh);
        if(!isFinite(d) || d === 0) break;
        var nx = x - fx / d; if(!isFinite(nx)) break;
        if(Math.abs(nx - x) < 1e-13 * Math.max(1, Math.abs(x))){ x = nx; break; }
        x = nx;
      }
      return Math.abs(f(x)) < 1e-8 ? x : null;
    }
    var starts = [env.x || 0, 1, -1, 10, -10, 0.1, 100, -100, 1000, 0.001, 1e5, 1e-5];
    for(var s = 0; s < starts.length; s++){
      try{ var r = newton(starts[s]); if(r != null && isFinite(r)) return r; }catch(e){}
    }
    // quét đổi dấu rồi chia đôi
    var prev = null, px = null;
    for(var k = -2000; k <= 2000; k++){
      var x = k / 4, v; try{ v = f(x); }catch(e){ prev = null; continue; }
      if(prev != null && prev * v <= 0){
        var a = px, b = x; for(var q = 0; q < 100; q++){ var m = (a + b) / 2, fm = f(m); if(f(a) * fm <= 0) b = m; else a = m; }
        return (a + b) / 2;
      }
      prev = v; px = x;
    }
    throw new Error('Không tìm được nghiệm');
  }
  function fmt(v){
    if(!isFinite(v)) return 'Math ERROR';
    if(v === 0) return '0';
    var a = Math.abs(v);
    if(a >= 1e10 || a < 1e-9){
      var s = v.toExponential(9).replace(/\.?0+e/, 'e');
      var p = s.split('e');
      return p[0] + '×10^' + Number(p[1]);
    }
    var r = Number(v.toPrecision(10));
    return String(r);
  }
  function toFraction(v){
    if(!isFinite(v) || Math.abs(v) >= 1e10) return null;
    var sign = v < 0 ? -1 : 1, x = Math.abs(v), h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = x;
    for(var i = 0; i < 40; i++){
      var a = Math.floor(b), h2 = a * h1 + h0, k2 = a * k1 + k0;
      h0 = h1; h1 = h2; k0 = k1; k1 = k2;
      if(Math.abs(x - h1 / k1) < 1e-10 * Math.max(1, x)) break;
      b = 1 / (b - a); if(!isFinite(b)) break;
    }
    if(k1 > 9999 || k1 === 1 || h1 > 9999999) return null;
    return (sign < 0 ? '−' : '') + h1 + '⌟' + k1;
  }

  var calcState = { open: false, min: false, x: null, y: null };
  var calcHost = null, calcRoot = null;
  function loadPos(){ try{ var p = JSON.parse(localStorage.getItem('opc-calc-pos') || 'null'); if(p){ calcState.x = p.x; calcState.y = p.y; } }catch(e){} }
  function savePos(){ try{ localStorage.setItem('opc-calc-pos', JSON.stringify({ x: calcState.x, y: calcState.y })); }catch(e){} }

  function Calculator(){
    var st = React.useState({ tokens: [], cur: 0, out: '', err: false, shift: false, deg: true, ans: 0, x: 0, frac: false, last: null, hist: [], showHist: false });
    var s = st[0], setS = st[1];
    var boxRef = React.useRef(null);
    var minState = React.useState(calcState.min); var min = minState[0], setMin = minState[1];
    var posState = React.useState(function(){
      loadPos();
      var w = window.innerWidth, hh = window.innerHeight;
      var x = calcState.x != null ? calcState.x : Math.max(8, w - 310), y = calcState.y != null ? calcState.y : Math.max(8, hh - 600);
      return { x: Math.min(Math.max(0, x), w - 120), y: Math.min(Math.max(0, y), hh - 60) };
    });
    var pos = posState[0], setPos = posState[1];
    function upd(patch){ setS(function(p){ return Object.assign({}, p, typeof patch === 'function' ? patch(p) : patch); }); }
    function insert(t){
      upd(function(p){
        var base = p;
        // vừa tính xong mà bấm phép toán → nối với Ans (giống máy thật); bấm số → bắt đầu biểu thức mới
        if(p.last != null && p.out){
          if(['add', 'sub', 'mul', 'div', 'pow', 'sq', 'inv', 'cube', 'fact', 'exp10'].indexOf(t.k) > -1) base = Object.assign({}, p, { tokens: [tok('const', 'Ans', 'ans')], cur: 1 });
          else base = Object.assign({}, p, { tokens: [], cur: 0 });
        }
        var arr = base.tokens.slice(); arr.splice(base.cur, 0, t);
        return { tokens: arr, cur: base.cur + 1, out: p.last != null ? '' : p.out, err: false, last: null, shift: false, frac: false };
      });
    }
    function press(key){
      var sh = s.shift;
      switch(key){
        case 'shift': return upd({ shift: !s.shift });
        case 'mode': return upd({ deg: !s.deg, shift: false });
        case 'ac': return upd({ tokens: [], cur: 0, out: '', err: false, last: null, shift: false, frac: false });
        case 'del': return upd(function(p){ if(p.last != null) return { last: null, out: '', err: false, shift: false }; if(p.cur === 0) return { shift: false }; var a = p.tokens.slice(); a.splice(p.cur - 1, 1); return { tokens: a, cur: p.cur - 1, shift: false }; });
        case 'left': return upd(function(p){ return { cur: p.last != null ? p.tokens.length : Math.max(0, p.cur - 1), last: null, shift: false }; });
        case 'right': return upd(function(p){ return { cur: p.last != null ? 0 : Math.min(p.tokens.length, p.cur + 1), last: null, shift: false }; });
        case 'eq': return calc(false);
        case 'solve': return calc(true);
        case 'sd': return upd(function(p){ return p.last != null ? { frac: !p.frac } : {}; });
        case 'sin': return insert(tok('fn', sh ? FN.asin.t : FN.sin.t, sh ? 'asin' : 'sin'));
        case 'cos': return insert(tok('fn', sh ? FN.acos.t : FN.cos.t, sh ? 'acos' : 'cos'));
        case 'tan': return insert(tok('fn', sh ? FN.atan.t : FN.tan.t, sh ? 'atan' : 'tan'));
        case 'log': return insert(tok('fn', sh ? FN.tenx.t : FN.log.t, sh ? 'tenx' : 'log'));
        case 'ln': return insert(tok('fn', sh ? FN.ex.t : FN.ln.t, sh ? 'ex' : 'ln'));
        case 'sqrt': return insert(tok('fn', sh ? FN.cbrt.t : FN.sqrt.t, sh ? 'cbrt' : 'sqrt'));
        case 'sq': return insert(sh ? tok('cube', '³') : tok('sq', '²'));
        case 'pow': return insert(tok('pow', '^'));
        case 'inv': return insert(sh ? tok('fact', '!') : tok('inv', '⁻¹'));
        case 'lp': return insert(tok('lp', '('));
        case 'rp': return insert(tok('rp', ')'));
        case 'pi': return insert(sh ? tok('const', 'e', 'e') : tok('const', 'π', 'pi'));
        case 'x': return insert(sh ? tok('eqs', '=') : tok('var', 'X'));
        case 'ans': return insert(tok('const', 'Ans', 'ans'));
        case 'exp10': return insert(tok('exp10', '×10^'));
        case 'neg': return insert(tok('neg', '(−)'.replace('(−)', '−')));
        case 'abs': return insert(tok('fn', FN.abs.t, 'abs'));
        case 'add': return insert(tok('add', '+'));
        case 'sub': return insert(tok('sub', '−'));
        case 'mul': return insert(tok('mul', '×'));
        case 'div': return insert(tok('div', '÷'));
        case '.': return insert(tok('num', '.', '.'));
        default:
          if(/^\d$/.test(key)) return insert(tok('num', key, key));
      }
    }
    function calc(isSolve){
      var tokens = s.tokens;
      if(!tokens.length){ if(s.last != null) return; return; }
      try{
        var env = { ans: s.ans, deg: s.deg, x: s.x };
        if(isSolve){
          var root = solve(tokens, env);
          var line = tokens.map(function(t){ return t.t; }).join('');
          upd({ out: 'X = ' + fmt(root), err: false, x: root, ans: root, last: root, shift: false, frac: false,
            hist: [{ q: line, a: 'X=' + fmt(root), v: root }].concat(s.hist).slice(0, 20) });
        } else {
          if(tokens.some(function(t){ return t.k === 'eqs'; })) throw new Error('Dùng SOLVE cho phương trình');
          var v = evaluate(tokens, env);
          var line2 = tokens.map(function(t){ return t.t; }).join('');
          upd({ out: fmt(v), err: false, ans: v, last: v, shift: false, frac: false, hist: [{ q: line2, a: fmt(v), v: v }].concat(s.hist).slice(0, 20) });
        }
      }catch(e){
        upd({ out: e && e.message ? e.message : 'Syntax ERROR', err: true, shift: false, last: null });
      }
    }
    // bàn phím
    React.useEffect(function(){
      function onKey(e){
        var box = boxRef.current; if(!box) return;
        var tag = (document.activeElement && document.activeElement.tagName) || '';
        if(/INPUT|TEXTAREA|SELECT/.test(tag) && !box.contains(document.activeElement)) return;
        if(!box.matches(':hover') && !box.contains(document.activeElement)) return;
        var map = { '+': 'add', '-': 'sub', '*': 'mul', 'x': 'mul', '/': 'div', '^': 'pow', '(': 'lp', ')': 'rp', '.': '.', ',': '.', 'Enter': 'eq', '=': 'eq', 'Backspace': 'del', 'Delete': 'ac', 'Escape': 'ac', 'ArrowLeft': 'left', 'ArrowRight': 'right' };
        var k = /^\d$/.test(e.key) ? e.key : map[e.key];
        if(k){ e.preventDefault(); press(k); }
      }
      window.addEventListener('keydown', onKey);
      return function(){ window.removeEventListener('keydown', onKey); };
    });
    // kéo thả
    var dragRef = React.useRef(null);
    function dDown(e){
      if(e.target.closest('button')) return;
      dragRef.current = { sx: e.clientX, sy: e.clientY, x: pos.x, y: pos.y };
      try{ e.currentTarget.setPointerCapture(e.pointerId); }catch(err){}
    }
    function dMove(e){
      var d = dragRef.current; if(!d) return;
      var nx = Math.min(Math.max(0, d.x + e.clientX - d.sx), window.innerWidth - 80), ny = Math.min(Math.max(0, d.y + e.clientY - d.sy), window.innerHeight - 40);
      setPos({ x: nx, y: ny });
    }
    function dUp(){ if(dragRef.current){ dragRef.current = null; calcState.x = pos.x; calcState.y = pos.y; savePos(); } }

    function K(key, label, cls, small){
      return h('button', { key: key + label, type: 'button', className: 'k ' + (cls || ''), onClick: function(){ press(key); } },
        small ? h('small', null, small) : null, label);
    }
    var inputView = [];
    s.tokens.forEach(function(t, i){ if(i === s.cur && s.last == null) inputView.push(h('span', { key: 'c', className: 'cur' })); inputView.push(t.t); });
    if(s.cur >= s.tokens.length && s.last == null) inputView.push(h('span', { key: 'c2', className: 'cur' }));
    var outText = s.out;
    if(s.frac && s.last != null && !/^X/.test(s.out)){ var fr = toFraction(s.last); outText = fr || s.out; }
    var keys = [
      K('shift', 'SHIFT', 'shift' + (s.shift ? ' on' : '')), K('mode', s.deg ? 'Deg' : 'Rad', 'op', 'Deg/Rad'), K('left', '◀', 'op'), K('right', '▶', 'op'), K('sd', 'S⇔D', 'op'),
      K('x', 'X', 'op', '='), K('solve', 'SOLVE', 'op'), K('inv', 'x⁻¹', '', 'x!'), K('sqrt', '√', '', '³√'), K('sq', 'x²', '', 'x³'),
      K('pow', 'xʸ', ''), K('log', 'log', '', '10ˣ'), K('ln', 'ln', '', 'eˣ'), K('pi', 'π', '', 'e'), K('abs', 'Abs', ''),
      K('sin', 'sin', '', 'sin⁻¹'), K('cos', 'cos', '', 'cos⁻¹'), K('tan', 'tan', '', 'tan⁻¹'), K('lp', '(', ''), K('rp', ')', ''),
      K('7', '7', 'num'), K('8', '8', 'num'), K('9', '9', 'num'), K('del', 'DEL', 'del'), K('ac', 'AC', 'ac'),
      K('4', '4', 'num'), K('5', '5', 'num'), K('6', '6', 'num'), K('mul', '×', 'op'), K('div', '÷', 'op'),
      K('1', '1', 'num'), K('2', '2', 'num'), K('3', '3', 'num'), K('add', '+', 'op'), K('sub', '−', 'op'),
      K('0', '0', 'num'), K('.', '.', 'num'), K('exp10', '×10ˣ', 'num'), K('ans', 'Ans', 'op', '(−)'), K('eq', '=', 'eq')
    ];
    // SHIFT + Ans = số âm (−)
    keys[38] = h('button', { key: 'ansneg', type: 'button', className: 'k op', onClick: function(){ press(s.shift ? 'neg' : 'ans'); } }, h('small', null, '(−)'), 'Ans');
    return h('div', { ref: boxRef, className: 'opc-calc' + (min ? ' min' : ''), style: { left: pos.x + 'px', top: pos.y + 'px' }, tabIndex: -1 },
      h('div', { className: 'hd', onPointerDown: dDown, onPointerMove: dMove, onPointerUp: dUp, onPointerCancel: dUp },
        h('b', null, '🧮 Máy tính khoa học'),
        h('button', { type: 'button', title: 'Lịch sử', onClick: function(){ upd({ showHist: !s.showHist }); } }, '🕘'),
        h('button', { type: 'button', title: min ? 'Mở rộng' : 'Thu nhỏ', onClick: function(){ calcState.min = !min; setMin(!min); } }, min ? '▢' : '–'),
        h('button', { type: 'button', title: 'Đóng', onClick: closeCalc }, '✕')),
      h('div', { className: 'scr' },
        h('div', { className: 'ind' }, h('span', { className: s.shift ? '' : 'off' }, 'S'), h('span', null, s.deg ? 'D' : 'R'), h('span', { className: s.frac ? '' : 'off' }, 'a⌟b')),
        h('div', { className: 'in' }, inputView),
        h('div', { className: 'out' + (s.err ? ' err' : '') }, outText)),
      s.showHist && s.hist.length ? h('div', { className: 'hist' }, s.hist.map(function(x, i){
        return h('div', { key: i, title: 'Bấm để dùng kết quả này', onClick: function(){ upd({ ans: x.v }); insert(tok('const', 'Ans', 'ans')); } }, h('span', null, x.q), h('b', null, x.a));
      })) : null,
      h('div', { className: 'keys' }, keys),
      h('div', { className: 'ft' }, 'Mô phỏng thao tác máy tính cầm tay · SOLVE: nhập phương trình có X (SHIFT X để gõ "=")'));
  }
  // khi có phần tử đang TOÀN MÀN HÌNH (vd. màn giảng ở Phòng dạy) thì chỉ phần tử đó hiện → gắn máy tính vào trong nó
  function calcParent(){ return document.fullscreenElement || document.webkitFullscreenElement || document.body; }
  function reparentCalc(){ if(calcHost && calcHost.parentNode !== calcParent()) calcParent().appendChild(calcHost); }
  document.addEventListener('fullscreenchange', reparentCalc);
  document.addEventListener('webkitfullscreenchange', reparentCalc);
  function openCalc(){
    calcState.open = true;
    if(!calcHost){ calcHost = document.createElement('div'); calcHost.id = 'opc-calc-host'; }
    reparentCalc();
    if(!calcRoot){ calcRoot = window.ReactDOM && window.ReactDOM.createRoot ? window.ReactDOM.createRoot(calcHost) : null; }
    if(calcRoot) calcRoot.render(h(Calculator)); else if(window.ReactDOM) window.ReactDOM.render(h(Calculator), calcHost);
    emit();
  }
  function closeCalc(){
    calcState.open = false;
    if(calcRoot){ calcRoot.unmount(); calcRoot = null; } else if(calcHost && window.ReactDOM && window.ReactDOM.unmountComponentAtNode){ window.ReactDOM.unmountComponentAtNode(calcHost); }
    emit();
  }
  function toggleCalc(){ if(calcState.open) closeCalc(); else openCalc(); }

  window.OPC_TOOLS = {
    HighlightZone: HighlightZone, StudyBar: StudyBar, clearMarks: clearMarks, highlightSupported: HL_SUPPORTED,
    openCalc: openCalc, closeCalc: closeCalc, toggleCalc: toggleCalc,
    _calc: { tokens: tok, evaluate: evaluate, solve: solve, fmt: fmt, toFraction: toFraction } // để kiểm thử
  };
})(window, document);
