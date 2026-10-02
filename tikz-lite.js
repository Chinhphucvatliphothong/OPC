/* tikz-lite.js — THÊM 2/10/2026
 * Bộ vẽ TikZ rút gọn chạy ngay trong trình duyệt: đổi mã \begin{tikzpicture}...\end{tikzpicture}
 * trong đề thành hình SVG, thay vì hiện mã thô ra màn hình học sinh. Không cần build, không
 * gọi máy chủ ngoài.
 *
 * Dùng:  var svg = window.OPC_TIKZ.render(code);   // code = phần nằm GIỮA \begin{tikzpicture} và \end{tikzpicture}
 *        svg là chuỗi "<svg ...>...</svg>" hoặc null nếu hình dùng cú pháp chưa hỗ trợ.
 *
 * Phạm vi hỗ trợ (đủ cho đồ thị/sơ đồ thí nghiệm đơn giản):
 *   \draw \fill \filldraw \path \node \coordinate \foreach, scope chỉ đổi kiểu (không dịch/xoay/co giãn)
 *   đường: -- -| |- to(không tuỳ chọn) cycle ; hình: circle ellipse rectangle arc
 *   toạ độ: (x,y) (góc:bán kính) (tên) +(dx,dy) ++(dx,dy), biểu thức + - * / ( ) sin cos sqrt, đơn vị cm mm pt
 *   kiểu: màu cơ bản (kể cả red!50), thin/thick/very thick, line width, dashed/dotted, -> <- <->,
 *         fill=, draw=, opacity=; node: above/below/left/right (+ góc, =khoảng cách), anchor=, rotate=,
 *         pos=/midway, draw/circle/rectangle (chỉ khi căn giữa), font=\small...
 *   chữ: $...$ với chỉ số trên/dưới, chữ Hy Lạp, \textbf, \text, \frac(dạng a/b), ^\circ...
 * Gặp thứ chưa hỗ trợ (circuitikz, plot, scope có biến đổi, calc, to[...], ...) -> trả null để giao diện báo
 * "hình chưa hiển thị được" thay vì vẽ thiếu (vẽ thiếu có thể làm học sinh hiểu sai đề).
 */
(function(global){
  'use strict';

  var PT_PER_CM = 28.4528;
  var PX_CM = 44;                 // 1cm TikZ = 44px màn hình
  var PX_PT = PX_CM / PT_PER_CM;  // 1pt ≈ 1,55px
  var INNER_SEP_PT = 3.3333;

  function Unsupported(msg){ this.message = msg; this.isUnsupported = true; }
  function bad(msg){ throw new Unsupported(msg); }

  function esc(s){
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function r2(n){ return Math.round(n * 100) / 100; }

  // ------------------------------------------------------------------ biểu thức số
  var UNIT_CM = { cm: 1, mm: 0.1, pt: 1 / PT_PER_CM, 'in': 2.54, em: 10 / PT_PER_CM, ex: 4.3 / PT_PER_CM };
  function evalExpr(src){
    var s = String(src).replace(/\s+/g, ''), p = 0;
    function peek(){ return s.charAt(p); }
    function num(){
      var m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(p));
      if(!m) bad('số: ' + s);
      p += m[0].length;
      var v = parseFloat(m[0]);
      var u = /^(cm|mm|pt|in|em|ex)/.exec(s.slice(p));
      if(u){ p += u[0].length; v *= UNIT_CM[u[0]]; }
      return v;
    }
    function atom(){
      var c = peek();
      if(c === '('){ p++; var v = expr(); if(peek() !== ')') bad('ngoặc'); p++; return v; }
      var f = /^(sin|cos|tan|sqrt|abs|deg|rad)\(/.exec(s.slice(p));
      if(f){
        p += f[0].length; var a = expr(); if(peek() !== ')') bad('ngoặc hàm'); p++;
        switch(f[1]){
          case 'sin': return Math.sin(a * Math.PI / 180);
          case 'cos': return Math.cos(a * Math.PI / 180);
          case 'tan': return Math.tan(a * Math.PI / 180);
          case 'sqrt': return Math.sqrt(a);
          case 'abs': return Math.abs(a);
          case 'deg': return a * 180 / Math.PI;
          default: return a * Math.PI / 180;
        }
      }
      if(s.slice(p, p + 2) === 'pi'){ p += 2; return Math.PI; }
      return num();
    }
    function factor(){
      var c = peek();
      if(c === '-'){ p++; return -factor(); }
      if(c === '+'){ p++; return factor(); }
      var v = atom();
      if(peek() === '^'){ p++; v = Math.pow(v, factor()); }
      return v;
    }
    function term(){
      var v = factor();
      while(peek() === '*' || peek() === '/'){
        var o = s.charAt(p++); var r = factor();
        v = (o === '*') ? v * r : v / r;
      }
      return v;
    }
    function expr(){
      var v = term();
      while(peek() === '+' || peek() === '-'){
        var o = s.charAt(p++); var r = term();
        v = (o === '+') ? v + r : v - r;
      }
      return v;
    }
    if(!s) bad('biểu thức rỗng');
    var out = expr();
    if(p < s.length) bad('thừa ký tự trong biểu thức: ' + s);
    if(!isFinite(out)) bad('biểu thức không hữu hạn');
    return out;
  }

  // ------------------------------------------------------------------ màu
  var COLORS = {
    black: null, white: '#ffffff', red: '#e60000', green: '#00a651', blue: '#0033cc',
    cyan: '#00aeef', magenta: '#d4008f', yellow: '#f2c200', gray: '#808080', grey: '#808080',
    darkgray: '#404040', lightgray: '#bfbfbf', orange: '#ff8000', brown: '#996633',
    purple: '#a000a0', violet: '#8000bf', pink: '#ff8099', lime: '#80bf00', olive: '#808000',
    teal: '#008080'
  };
  function hexToRgb(h){ return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function rgbToHex(a){ return '#' + a.map(function(v){ var x = Math.max(0, Math.min(255, Math.round(v))).toString(16); return x.length < 2 ? '0' + x : x; }).join(''); }
  // trả 'currentColor' cho đen (tự đổi theo giao diện sáng/tối), chuỗi hex cho màu khác, undefined nếu không phải màu
  function parseColor(spec){
    spec = String(spec).trim();
    var parts = spec.split('!');
    var base = parts[0].trim();
    if(!(base in COLORS)) return undefined;
    var hex = COLORS[base] === null ? '#000000' : COLORS[base];
    if(parts.length === 1) return COLORS[base] === null ? 'currentColor' : hex;
    var pct = parseFloat(parts[1]);
    if(!isFinite(pct)) return undefined;
    var other = parts[2] ? parts[2].trim() : 'white';
    if(!(other in COLORS)) return undefined;
    var oh = COLORS[other] === null ? '#000000' : COLORS[other];
    var a = hexToRgb(hex), b = hexToRgb(oh), k = pct / 100;
    return rgbToHex([a[0] * k + b[0] * (1 - k), a[1] * k + b[1] * (1 - k), a[2] * k + b[2] * (1 - k)]);
  }
  function cssFill(c){ return c === '#ffffff' ? 'var(--surface,#ffffff)' : c; }

  // ------------------------------------------------------------------ tách chuỗi
  function skipGroup(s, i, open, close){
    var d = 0;
    for(; i < s.length; i++){
      var c = s.charAt(i);
      if(c === '\\'){ i++; continue; }
      if(c === open) d++;
      else if(c === close){ d--; if(d === 0) return i; }
    }
    bad('thiếu ngoặc ' + close);
  }
  function splitTop(s, sep){
    var out = [], depth = 0, cur = '', inMath = false;
    for(var i = 0; i < s.length; i++){
      var c = s.charAt(i);
      if(c === '\\'){ cur += c + (s.charAt(i + 1) || ''); i++; continue; }
      if(c === '$') inMath = !inMath;
      if(!inMath){
        if(c === '{' || c === '[' || c === '(') depth++;
        else if(c === '}' || c === ']' || c === ')') depth--;
      }
      if(c === sep && depth === 0 && !inMath){ out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur);
    return out;
  }
  function parseOpts(str){
    return splitTop(str, ',').map(function(t){ return t.trim(); }).filter(Boolean).map(function(t){
      var eq = t.indexOf('=');
      if(eq < 0) return { k: t, v: null };
      return { k: t.slice(0, eq).trim(), v: t.slice(eq + 1).trim() };
    });
  }
  function stripComments(s){ return s.replace(/(^|[^\\])%[^\n]*/g, '$1'); }

  // ------------------------------------------------------------------ kiểu vẽ
  var FONT_PT = { tiny: 5, scriptsize: 7, footnotesize: 8, small: 9, normalsize: 10, large: 12, Large: 14, LARGE: 17, huge: 20 };
  function fontPtFrom(v){
    var m = /\\([a-zA-Z]+)/.exec(v || '');
    if(m && FONT_PT[m[1]]) return FONT_PT[m[1]];
    return null;
  }
  function lwPx(pt){ return Math.max(1.1, pt * 2.5); }
  var LW = { 'ultra thin': 0.6, 'very thin': 0.8, thin: 1.1, semithick: 1.5, thick: 2, 'very thick': 3, 'ultra thick': 4 };
  var DASH = {
    dashed: '6 5', 'densely dashed': '6 2.5', 'loosely dashed': '6 8',
    dotted: '1.2 4', 'densely dotted': '1.2 2.6', 'loosely dotted': '1.2 7',
    'dash dot': '6 3 1.2 3'
  };
  function cloneStyle(st){ return JSON.parse(JSON.stringify(st)); }
  function baseStyle(){
    return { color: null, draw: null, fill: null, lw: 1.1, dash: null, arrowStart: false, arrowEnd: false,
             opacity: null, fillOpacity: null, drawOpacity: null, fontPt: 10 };
  }
  // áp danh sách tuỳ chọn (cho \draw/\fill/scope/tikzpicture/node) vào kiểu; trả về phần chưa hiểu cho node xử lý
  function applyStyleOpts(st, opts, ctx, forNode){
    var rest = [];
    opts.forEach(function(o){
      var k = o.k, v = o.v;
      if(v === null){
        var c = parseColor(k);
        if(c !== undefined){ st.color = c; return; }
        if(LW[k] !== undefined){ st.lw = LW[k]; return; }
        if(DASH[k]){ st.dash = DASH[k]; return; }
        if(k === 'solid'){ st.dash = null; return; }
        if(k === '->' || k === '-stealth' || k === '-latex' || k === '-to' || k === '-Stealth' || k === '-Latex'){ st.arrowEnd = true; return; }
        if(k === '<-' || k === 'stealth-' || k === 'latex-' || k === 'to-' || k === 'Stealth-' || k === 'Latex-'){ st.arrowStart = true; return; }
        if(k === '<->' || k === 'stealth-stealth' || k === 'latex-latex' || k === 'Stealth-Stealth' || k === 'Latex-Latex'){ st.arrowStart = true; st.arrowEnd = true; return; }
        if(k === '-'){ st.arrowStart = false; st.arrowEnd = false; return; }
        if(k === 'draw'){ st.draw = st.draw || (st.color || 'currentColor'); st.forceDraw = true; return; }
        if(k === 'fill'){ st.fill = st.color || 'currentColor'; return; }
        if(k === 'rounded corners' || k === 'line cap=round' || k === 'sharp corners'){ return; }
        rest.push(o); return;
      }
      if(k === 'color'){ var cc = parseColor(v); if(cc === undefined) bad('màu ' + v); st.color = cc; return; }
      if(k === 'draw'){
        if(v === 'none'){ st.draw = 'none'; return; }
        var dc = parseColor(v); if(dc === undefined) bad('màu draw ' + v); st.draw = dc; st.forceDraw = true; return;
      }
      if(k === 'fill'){
        if(v === 'none'){ st.fill = null; return; }
        var fc = parseColor(v); if(fc === undefined) bad('màu fill ' + v); st.fill = fc; return;
      }
      if(k === 'line width'){ st.lw = lwPx(evalExpr(v) * PT_PER_CM); return; }
      if(k === 'opacity'){ st.opacity = evalExpr(v); return; }
      if(k === 'fill opacity'){ st.fillOpacity = evalExpr(v); return; }
      if(k === 'draw opacity'){ st.drawOpacity = evalExpr(v); return; }
      if(k === 'font'){ var fp = fontPtFrom(v); if(fp === null) bad('font ' + v); st.fontPt = fp; return; }
      if(k === '>' ){ return; } // kiểu đầu mũi tên — luôn vẽ dạng tam giác
      if(k === 'line cap' || k === 'line join' || k === 'inner sep' || k === 'outer sep'){ return; }
      rest.push(o);
    });
    return rest;
  }

  // ------------------------------------------------------------------ chữ / công thức -> <tspan>
  var GREEK = {
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ',
    vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ',
    tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω'
  };
  var GREEK_UP = { Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω' };
  var SYMS = {
    circ: '°', degree: '°', pm: '±', mp: '∓', times: '×', cdot: '·', div: '÷', approx: '≈', neq: '≠', leq: '≤',
    geq: '≥', le: '≤', ge: '≥', infty: '∞', rightarrow: '→', to: '→', leftarrow: '←', Rightarrow: '⇒',
    leftrightarrow: '↔', ldots: '…', dots: '…', cdots: '⋯', propto: '∝', parallel: '∥', perp: '⊥', angle: '∠',
    prime: '′', partial: '∂', nabla: '∇', sim: '∼', equiv: '≡', ll: '≪', gg: '≫', uparrow: '↑', downarrow: '↓'
  };
  function charW(c, fs){
    if(c === ' ') return fs * 0.28;
    if('il.,:;\'|!jI()[]{}1tfr'.indexOf(c) >= 0) return fs * 0.34;
    if('mwMW'.indexOf(c) >= 0) return fs * 0.86;
    if(c >= 'A' && c <= 'Z') return fs * 0.68;
    return fs * 0.52;
  }

  // Trả { m: markup, w: độ rộng ước lượng }.
  function layText(src, fs, flags){
    var out = '', w = 0, i = 0;
    var st = { math: false, bold: !!(flags && flags.bold), ital: false, up: false };

    function emitRun(str, italic, bold, size){
      if(!str) return;
      var sty = '';
      if(italic) sty += 'font-style:italic;';
      if(bold) sty += 'font-weight:700;';
      if(size && size !== fs) sty += 'font-size:' + r2(size) + 'px;';
      out += sty ? '<tspan style="' + sty + '">' + esc(str) + '</tspan>' : esc(str);
      for(var q = 0; q < str.length; q++) w += charW(str.charAt(q), size || fs);
    }
    function readGroup(){
      // đọc 1 "token" tham số: {nhóm} hoặc 1 ký tự hoặc 1 lệnh
      while(src.charAt(i) === ' ') i++;
      var c = src.charAt(i);
      if(c === '{'){
        var e = skipGroup(src, i, '{', '}');
        var inner = src.slice(i + 1, e); i = e + 1; return inner;
      }
      if(c === '\\'){
        var m = /^\\([a-zA-Z]+)/.exec(src.slice(i));
        if(m){ i += m[0].length; return m[0]; }
        i += 2; return src.slice(i - 2, i);
      }
      i++; return c;
    }
    function sub(str, up, size){
      // chỉ số trên/dưới
      var inner = layText(str, size, { bold: st.bold, mathMode: st.math });
      var shift = up ? -0.34 * fs : 0.22 * fs;
      out += '<tspan dy="' + r2(shift) + 'px" style="font-size:' + r2(size) + 'px;">' + inner.m + '</tspan>' +
             '<tspan dy="' + r2(-shift) + 'px">\u200b</tspan>';
      w += inner.w;
    }
    if(flags && flags.mathMode) st.math = true;

    var buf = '';
    function flushBuf(){ if(buf){ emitRun(buf, false, st.bold); buf = ''; } }
    function mathChar(c){
      // chữ cái trong chế độ toán -> nghiêng; số/ký hiệu -> thẳng
      if(/[A-Za-z]/.test(c) && !st.up){ flushBuf(); emitRun(c, true, st.bold); }
      else if(/[\u03b1-\u03c9]/.test(c) && !st.up){ flushBuf(); emitRun(c, true, st.bold); }
      else buf += c;
    }

    while(i < src.length){
      var c = src.charAt(i);
      if(c === '$'){ flushBuf(); st.math = !st.math; i++; continue; }
      if(c === '\\'){
        var n = src.charAt(i + 1);
        if(n && '%&_$#{}'.indexOf(n) >= 0){ if(st.math) mathChar(n); else buf += n; i += 2; continue; }
        if(n && ',;: !'.indexOf(n) >= 0){ buf += (n === '!' ? '' : ' '); i += 2; continue; }
        var m = /^\\([a-zA-Z]+)/.exec(src.slice(i));
        if(!m){ i += 2; continue; }
        var name = m[1]; i += m[0].length;
        if(SYMS[name] !== undefined){ buf += SYMS[name]; continue; }
        if(GREEK[name]){ if(st.math) mathChar(GREEK[name]); else buf += GREEK[name]; continue; }
        if(GREEK_UP[name]){ buf += GREEK_UP[name]; continue; }
        if(name === 'textbf' || name === 'bf' || name === 'mathbf' || name === 'boldsymbol'){
          flushBuf(); var g1 = readGroup(); var r1 = layText(g1, fs, { bold: true, mathMode: st.math }); out += r1.m; w += r1.w; continue;
        }
        if(name === 'textit' || name === 'emph' || name === 'mathit'){
          flushBuf(); var g2 = readGroup(); var r3 = layText(g2, fs, { bold: st.bold, mathMode: st.math });
          out += '<tspan style="font-style:italic;">' + r3.m + '</tspan>'; w += r3.w; continue;
        }
        if(name === 'text' || name === 'mathrm' || name === 'textrm' || name === 'mbox' || name === 'textnormal' || name === 'operatorname'){
          flushBuf(); var g3 = readGroup(); var r4 = layText(g3, fs, { bold: st.bold, mathMode: false }); out += r4.m; w += r4.w; continue;
        }
        if(name === 'frac' || name === 'dfrac' || name === 'tfrac'){
          flushBuf(); var a = readGroup(), b = readGroup();
          var ra = layText(a, fs, { bold: st.bold, mathMode: true }), rb = layText(b, fs, { bold: st.bold, mathMode: true });
          out += (a.length > 1 ? '(' : '') + ra.m + (a.length > 1 ? ')' : '') + '/' + (b.length > 1 ? '(' : '') + rb.m + (b.length > 1 ? ')' : '');
          w += ra.w + rb.w + fs * 0.4; continue;
        }
        if(name === 'sqrt'){ flushBuf(); var gs = readGroup(); var rs = layText(gs, fs, { bold: st.bold, mathMode: true }); out += '√' + rs.m; w += rs.w + fs * 0.5; continue; }
        if(name === 'vec' || name === 'overrightarrow'){ flushBuf(); var gv = readGroup(); var rv = layText(gv, fs, { bold: st.bold, mathMode: true }); out += rv.m + '\u20d7'; w += rv.w; continue; }
        if(name === 'quad'){ buf += '  '; continue; }
        if(name === 'qquad'){ buf += '    '; continue; }
        // lệnh khác (left, right, small, hspace…): bỏ tên lệnh, giữ nội dung
        continue;
      }
      if(c === '{' || c === '}'){ i++; continue; }
      if(st.math && (c === '_' || c === '^')){
        flushBuf(); i++;
        var g = readGroup();
        if(c === '^' && (g === '\\circ' || g === '\\degree' || g === '∘' || g === '°')){ buf += '°'; continue; }
        sub(g, c === '^', fs * 0.72);
        continue;
      }
      if(!st.math && c === '^'){ i++; continue; }
      if(st.math){
        if(c === ' ' || c === '~'){ i++; continue; }
        if(c === '-'){ flushBuf(); buf += '−'; i++; continue; }
        mathChar(c); i++; continue;
      }
      if(c === '~'){ buf += ' '; i++; continue; }
      buf += c; i++;
    }
    flushBuf();
    return { m: out, w: w };
  }

  // ------------------------------------------------------------------ bối cảnh vẽ
  function Ctx(uid){
    this.uid = uid;
    this.names = {};
    this.elems = [];
    this.defs = [];
    this.markerIds = {};
    this.scale = 1;
    this.minX = Infinity; this.minY = Infinity; this.maxX = -Infinity; this.maxY = -Infinity;
  }
  Ctx.prototype.ext = function(x, y, pad){
    pad = pad || 0;
    if(x - pad < this.minX) this.minX = x - pad;
    if(x + pad > this.maxX) this.maxX = x + pad;
    if(y - pad < this.minY) this.minY = y - pad;
    if(y + pad > this.maxY) this.maxY = y + pad;
  };
  Ctx.prototype.px = function(pt){ return { x: pt.x * this.scale * PX_CM, y: -pt.y * this.scale * PX_CM }; };
  Ctx.prototype.marker = function(color, atStart){
    var key = color;
    if(!this.markerIds[key]){
      var id = 'tk' + this.uid + 'm' + (this.defs.length);
      this.markerIds[key] = id;
      this.defs.push('<marker id="' + id + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse">' +
        '<path d="M0,0.8 L10,5 L0,9.2 L3,5 Z" style="fill:' + color + ';stroke:none"/></marker>');
    }
    return this.markerIds[key];
  };

  function styleAttr(ctx, st, mode){
    // mode: {draw:boolean, fill:boolean}
    var strokeC = mode.draw ? (st.draw && st.draw !== 'none' ? st.draw : (st.color || 'currentColor')) : null;
    if(st.draw === 'none') strokeC = null;
    var fillC = null;
    if(mode.fill) fillC = st.fill || st.color || 'currentColor';
    else if(st.fill) fillC = st.fill;
    var s = '';
    s += 'fill:' + (fillC ? cssFill(fillC) : 'none') + ';';
    if(strokeC){
      s += 'stroke:' + strokeC + ';stroke-width:' + r2(st.lw) + ';stroke-linejoin:round;';
      if(st.dash) s += 'stroke-dasharray:' + st.dash + ';stroke-linecap:' + (/^1\.2/.test(st.dash) ? 'round' : 'butt') + ';';
    } else s += 'stroke:none;';
    if(st.opacity !== null) s += 'opacity:' + st.opacity + ';';
    if(st.fillOpacity !== null) s += 'fill-opacity:' + st.fillOpacity + ';';
    if(st.drawOpacity !== null) s += 'stroke-opacity:' + st.drawOpacity + ';';
    return { css: s, stroke: strokeC };
  }

  // ------------------------------------------------------------------ toạ độ
  function resolveCoord(ctx, raw, cur){
    var s = raw.trim();
    var rel = 0;
    if(s.indexOf('++') === 0){ rel = 2; s = s.slice(2).trim(); }
    else if(s.charAt(0) === '+'){ rel = 1; s = s.slice(1).trim(); }
    if(s.charAt(0) !== '(' || s.charAt(s.length - 1) !== ')') bad('toạ độ: ' + raw);
    var inner = s.slice(1, -1).trim();
    if(inner.indexOf('$') >= 0 || inner.indexOf('|') >= 0 || inner.indexOf('!') >= 0 || /cs:/.test(inner)) bad('toạ độ phức tạp: ' + inner);
    var pt;
    if(/^[A-Za-z][\w.\- ]*$/.test(inner) && inner.indexOf(',') < 0){
      var nm = inner.replace(/\.center$/, '').trim();
      if(/\.[a-z ]+$/.test(nm)) bad('anchor của node: ' + inner);
      if(!ctx.names[nm]) bad('chưa có toạ độ tên: ' + nm);
      pt = { x: ctx.names[nm].x, y: ctx.names[nm].y };
    } else if(inner.indexOf(':') > 0 && inner.indexOf(',') < 0){
      var pr = inner.split(':');
      if(pr.length !== 2) bad('toạ độ cực');
      var ang = evalExpr(pr[0]) * Math.PI / 180, rad = evalExpr(pr[1]);
      pt = { x: rad * Math.cos(ang), y: rad * Math.sin(ang) };
    } else {
      var xy = splitTop(inner, ',');
      if(xy.length !== 2) bad('toạ độ cần đúng 2 số: ' + inner);
      pt = { x: evalExpr(xy[0]), y: evalExpr(xy[1]) };
    }
    if(rel){
      if(!cur) bad('toạ độ tương đối khi chưa có điểm hiện tại');
      pt = { x: cur.x + pt.x, y: cur.y + pt.y };
    }
    return { pt: pt, rel: rel };
  }

  // ------------------------------------------------------------------ node
  function emitNode(ctx, st, optsRaw, textSrc, at){
    var opts = parseOpts(optsRaw || '');
    var nst = cloneStyle(st);
    var rest = applyStyleOpts(nst, opts, ctx, true);
    var dir = { h: 0, v: 0 }, dist = 0, rotate = 0, shape = null, drawBox = !!nst.forceDraw, anchorKey = null;
    var minW = 0, minH = 0;
    rest.forEach(function(o){
      var k = o.k, v = o.v;
      var d = v !== null ? evalExpr(v) * PT_PER_CM : 0; // pt
      if(k === 'above'){ dir.v = 1; if(v !== null) dist = d; }
      else if(k === 'below'){ dir.v = -1; if(v !== null) dist = d; }
      else if(k === 'left'){ dir.h = -1; if(v !== null) dist = d; }
      else if(k === 'right'){ dir.h = 1; if(v !== null) dist = d; }
      else if(k === 'above left'){ dir.v = 1; dir.h = -1; if(v !== null) dist = d; }
      else if(k === 'above right'){ dir.v = 1; dir.h = 1; if(v !== null) dist = d; }
      else if(k === 'below left'){ dir.v = -1; dir.h = -1; if(v !== null) dist = d; }
      else if(k === 'below right'){ dir.v = -1; dir.h = 1; if(v !== null) dist = d; }
      else if(k === 'anchor'){
        // anchor=west nghĩa là mép TRÁI của chữ đặt tại điểm => chữ nằm bên PHẢI điểm
        var map = { west: [1, 0], east: [-1, 0], north: [0, -1], south: [0, 1], 'north west': [1, -1], 'north east': [-1, -1],
                    'south west': [1, 1], 'south east': [-1, 1], center: [0, 0], base: [0, 0], 'base west': [1, 0], 'base east': [-1, 0] };
        if(!map[v]) bad('anchor=' + v);
        dir.h = map[v][0]; dir.v = map[v][1];
      }
      else if(k === 'rotate'){ rotate = evalExpr(v); }
      else if(k === 'circle' || k === 'rectangle' || k === 'ellipse'){ shape = k; }
      else if(k === 'minimum size'){ minW = minH = evalExpr(v) * PT_PER_CM; }
      else if(k === 'minimum width'){ minW = evalExpr(v) * PT_PER_CM; }
      else if(k === 'minimum height'){ minH = evalExpr(v) * PT_PER_CM; }
      else if(k === 'text'){ var tc = parseColor(v); if(tc === undefined) bad('text=' + v); nst.color = tc; }
      else if(k === 'align' || k === 'text centered' || k === 'text width' || k === 'anchor' || k === 'pos' || k === 'midway' ||
              k === 'near start' || k === 'near end' || k === 'at start' || k === 'at end'){ /* pos xử lý bên ngoài */ }
      else bad('tuỳ chọn node: ' + k);
    });
    if(shape) drawBox = drawBox || false;
    var fs = nst.fontPt * PX_PT;
    var lines = String(textSrc).split(/\\\\/);
    var laid = lines.map(function(l){ return layText(l.trim(), fs, {}); });
    var lineH = fs * 1.2;
    var H = laid.length * lineH;
    var W = 0; laid.forEach(function(l){ if(l.w > W) W = l.w; });
    var ins = INNER_SEP_PT * PX_PT, dpx = dist * PX_PT;
    var p = ctx.px(at);
    var x = p.x, y = p.y, anchor = 'middle', top;
    if(dir.h === -1){ anchor = 'end'; x = p.x - ins - dpx; }
    else if(dir.h === 1){ anchor = 'start'; x = p.x + ins + dpx; }
    if(dir.v === 1) top = p.y - ins - dpx - H;
    else if(dir.v === -1) top = p.y + ins + dpx;
    else top = p.y - H / 2;
    var hasBox = shape || drawBox || nst.fill;
    if(hasBox && (dir.h !== 0 || dir.v !== 0)) bad('node có viền/nền mà không căn giữa');
    var bw = Math.max(W + 2 * ins, minW * PX_PT), bh = Math.max(H + 2 * ins, minH * PX_PT);
    var g = '';
    if(hasBox){
      var bst = styleAttr(ctx, nst, { draw: drawBox, fill: !!nst.fill });
      if(shape === 'circle'){
        var rr = Math.max(bw, bh) / 2;
        g += '<circle cx="' + r2(p.x) + '" cy="' + r2(p.y) + '" r="' + r2(rr) + '" style="' + bst.css + '"/>';
        ctx.ext(p.x, p.y, rr);
      } else if(shape === 'ellipse'){
        g += '<ellipse cx="' + r2(p.x) + '" cy="' + r2(p.y) + '" rx="' + r2(bw / 2 * 1.2) + '" ry="' + r2(bh / 2 * 1.2) + '" style="' + bst.css + '"/>';
        ctx.ext(p.x, p.y, bw / 2 * 1.2);
      } else {
        g += '<rect x="' + r2(p.x - bw / 2) + '" y="' + r2(p.y - bh / 2) + '" width="' + r2(bw) + '" height="' + r2(bh) + '" style="' + bst.css + '"/>';
        ctx.ext(p.x - bw / 2, p.y - bh / 2); ctx.ext(p.x + bw / 2, p.y + bh / 2);
      }
    }
    var colorStyle = nst.color && nst.color !== 'currentColor' ? 'fill:' + nst.color + ';' : '';
    laid.forEach(function(l, idx){
      if(!l.m) return;
      var by = top + idx * lineH + 0.92 * fs;
      g += '<text x="' + r2(x) + '" y="' + r2(by) + '" text-anchor="' + anchor + '" style="font-size:' + r2(fs) + 'px;' + colorStyle + '">' + l.m + '</text>';
    });
    // phạm vi (ước lượng, đủ để không bị cắt chữ)
    var x0 = anchor === 'end' ? x - W : (anchor === 'start' ? x : x - W / 2);
    ctx.ext(x0, top); ctx.ext(x0 + W, top + H);
    if(rotate){
      // xoay quanh điểm neo (đúng cách TikZ xoay node)
      ctx.elems.push('<g transform="rotate(' + r2(-rotate) + ' ' + r2(p.x) + ' ' + r2(p.y) + ')">' + g + '</g>');
      var big = Math.max(W, H); ctx.ext(p.x, p.y, big);
    } else ctx.elems.push(g);
  }

  // ------------------------------------------------------------------ đọc node trong đường vẽ
  function readNode(ctx, src, pos){
    // src[pos..] bắt đầu ngay sau chữ "node"
    var p = pos, optsRaw = '', name = null, atRaw = null;
    for(;;){
      while(/\s/.test(src.charAt(p))) p++;
      var c = src.charAt(p);
      if(c === '['){ var e = skipGroup(src, p, '[', ']'); optsRaw += (optsRaw ? ',' : '') + src.slice(p + 1, e); p = e + 1; continue; }
      if(c === '('){ var e2 = skipGroup(src, p, '(', ')'); name = src.slice(p + 1, e2).trim(); p = e2 + 1; continue; }
      if(src.substr(p, 2) === 'at' && /\s|\(/.test(src.charAt(p + 2))){
        p += 2; while(/\s/.test(src.charAt(p))) p++;
        if(src.charAt(p) !== '(') bad('node at');
        var e3 = skipGroup(src, p, '(', ')'); atRaw = src.slice(p, e3 + 1); p = e3 + 1; continue;
      }
      break;
    }
    while(/\s/.test(src.charAt(p))) p++;
    if(src.charAt(p) !== '{') bad('node thiếu {chữ}');
    var e4 = skipGroup(src, p, '{', '}');
    var text = src.slice(p + 1, e4);
    return { optsRaw: optsRaw, name: name, atRaw: atRaw, text: text, end: e4 + 1 };
  }
  function nodePos(optsRaw){
    var pos = null;
    parseOpts(optsRaw || '').forEach(function(o){
      if(o.k === 'pos') pos = evalExpr(o.v);
      else if(o.k === 'midway') pos = 0.5;
      else if(o.k === 'near start') pos = 0.25;
      else if(o.k === 'near end') pos = 0.75;
      else if(o.k === 'at start') pos = 0;
      else if(o.k === 'at end') pos = 1;
      else if(o.k === 'sloped' || o.k === 'auto' || o.k === 'swap') bad('node ' + o.k);
    });
    return pos;
  }

  // ------------------------------------------------------------------ một câu lệnh đường vẽ
  function execPath(ctx, cmd, optsRaw, pathSrc, baseSt){
    var st = cloneStyle(baseSt);
    applyStyleOpts(st, parseOpts(optsRaw || ''), ctx, false);
    var mode = { draw: cmd === 'draw' || cmd === 'filldraw', fill: cmd === 'fill' || cmd === 'filldraw' };
    if(cmd === 'path'){ mode.draw = !!st.forceDraw; }
    if(st.forceDraw) mode.draw = true;
    if(st.draw === 'none') mode.draw = false;

    var sa = styleAttr(ctx, st, mode);
    var marker = (st.arrowEnd || st.arrowStart) && sa.stroke ? ctx.marker(sa.stroke === 'currentColor' ? 'currentColor' : sa.stroke) : null;

    var pos = 0, cur = null, prev = null, pendingOp = null, midNodes = [];
    var subs = []; // mỗi phần tử: { pts:[{x,y}], d:string, closed:bool }
    var shapes = [];
    var sub = null;
    function ensureSub(pt){ sub = { d: '', closed: false, count: 0 }; subs.push(sub); var px = ctx.px(pt); sub.d += 'M' + r2(px.x) + ' ' + r2(px.y); sub.count++; ctx.ext(px.x, px.y); }
    function lineTo(pt){ var px = ctx.px(pt); sub.d += 'L' + r2(px.x) + ' ' + r2(px.y); sub.count++; ctx.ext(px.x, px.y); }
    function skipWs(){ while(pos < pathSrc.length && /\s/.test(pathSrc.charAt(pos))) pos++; }

    while(true){
      skipWs();
      if(pos >= pathSrc.length) break;
      var rest = pathSrc.slice(pos);
      var c = rest.charAt(0);

      if(rest.indexOf('--') === 0){ pendingOp = '--'; pos += 2; continue; }
      if(rest.indexOf('-|') === 0){ pendingOp = '-|'; pos += 2; continue; }
      if(rest.indexOf('|-') === 0){ pendingOp = '|-'; pos += 2; continue; }
      if(/^cycle\b/.test(rest)){ if(sub){ sub.d += 'Z'; sub.closed = true; } pos += 5; pendingOp = null; continue; }
      if(/^to\b/.test(rest)){
        var after = rest.slice(2).replace(/^\s+/, '');
        if(after.charAt(0) === '[' || /^node\b/.test(after)) bad('to có tuỳ chọn');
        pendingOp = '--'; pos += 2; continue;
      }
      if(c === '(' || c === '+'){
        var endIdx = skipGroup(pathSrc, pos + (c === '+' ? (pathSrc.charAt(pos + 1) === '+' ? 2 : 1) : 0), '(', ')');
        var raw = pathSrc.slice(pos, endIdx + 1);
        var rc = resolveCoord(ctx, raw, cur);
        var pt = rc.pt;
        pos = endIdx + 1;
        if(pendingOp === null || !sub){
          if(pendingOp !== null) bad('toán tử nối khi chưa có điểm đầu');
          ensureSub(pt);
        } else {
          if(pendingOp === '-|') lineTo({ x: pt.x, y: cur.y });
          else if(pendingOp === '|-') lineTo({ x: cur.x, y: pt.y });
          lineTo(pt);
          midNodes.forEach(function(mn){
            var a = cur; // đầu đoạn thẳng đang nối
            var f = mn.pos === null ? 0.5 : mn.pos;
            emitNode(ctx, st, mn.optsRaw, mn.text, { x: a.x + (pt.x - a.x) * f, y: a.y + (pt.y - a.y) * f });
          });
          midNodes = [];
        }
        // +(dx,dy) vẽ tới điểm mới nhưng KHÔNG đổi điểm gốc cho các toạ độ tương đối kế tiếp
        if(rc.rel !== 1){ prev = cur; cur = pt; }
        pendingOp = null;
        continue;
      }
      if(/^circle\b/.test(rest)){
        if(!cur) bad('circle khi chưa có tâm');
        pos += 6; skipWs();
        var rad;
        if(pathSrc.charAt(pos) === '('){
          var e5 = skipGroup(pathSrc, pos, '(', ')');
          var rs = pathSrc.slice(pos + 1, e5); pos = e5 + 1;
          if(/\band\b/.test(rs)){
            var ab = rs.split(/\band\b/); var rx = evalExpr(ab[0]), ry = evalExpr(ab[1]);
            var pc = ctx.px(cur);
            shapes.push('<ellipse cx="' + r2(pc.x) + '" cy="' + r2(pc.y) + '" rx="' + r2(rx * ctx.scale * PX_CM) + '" ry="' + r2(ry * ctx.scale * PX_CM) + '" style="' + sa.css + '"/>');
            ctx.ext(pc.x, pc.y, Math.max(rx, ry) * ctx.scale * PX_CM);
            continue;
          }
          rad = evalExpr(rs);
        } else if(pathSrc.charAt(pos) === '['){
          var e6 = skipGroup(pathSrc, pos, '[', ']');
          var o6 = parseOpts(pathSrc.slice(pos + 1, e6)); pos = e6 + 1;
          o6.forEach(function(o){ if(o.k === 'radius') rad = evalExpr(o.v); else bad('circle ' + o.k); });
          if(rad === undefined) bad('circle thiếu radius');
        } else bad('circle thiếu bán kính');
        var pc2 = ctx.px(cur);
        var rpx = Math.max(rad * ctx.scale * PX_CM, 0);
        // chấm tròn rất nhỏ (bán kính vài pt) vẫn phải nhìn thấy được
        var rr = (rad * PT_PER_CM <= 4) ? Math.max(rpx, 1.8) : rpx;
        shapes.push('<circle cx="' + r2(pc2.x) + '" cy="' + r2(pc2.y) + '" r="' + r2(rr) + '" style="' + sa.css + '"/>');
        ctx.ext(pc2.x, pc2.y, rr + st.lw);
        pendingOp = null; continue;
      }
      if(/^ellipse\b/.test(rest)){
        if(!cur) bad('ellipse khi chưa có tâm');
        pos += 7; skipWs();
        if(pathSrc.charAt(pos) !== '(') bad('ellipse');
        var e7 = skipGroup(pathSrc, pos, '(', ')');
        var es = pathSrc.slice(pos + 1, e7); pos = e7 + 1;
        if(!/\band\b/.test(es)) bad('ellipse cần "a and b"');
        var ab2 = es.split(/\band\b/);
        var pcE = ctx.px(cur), erx = evalExpr(ab2[0]) * ctx.scale * PX_CM, ery = evalExpr(ab2[1]) * ctx.scale * PX_CM;
        shapes.push('<ellipse cx="' + r2(pcE.x) + '" cy="' + r2(pcE.y) + '" rx="' + r2(erx) + '" ry="' + r2(ery) + '" style="' + sa.css + '"/>');
        ctx.ext(pcE.x, pcE.y, Math.max(erx, ery)); continue;
      }
      if(/^rectangle\b/.test(rest)){
        if(!cur) bad('rectangle khi chưa có góc');
        pos += 9; skipWs();
        var e8 = skipGroup(pathSrc, pos + (pathSrc.charAt(pos) === '+' ? (pathSrc.charAt(pos + 1) === '+' ? 2 : 1) : 0), '(', ')');
        var rc2 = resolveCoord(ctx, pathSrc.slice(pos, e8 + 1), cur); pos = e8 + 1;
        var a1 = ctx.px(cur), a2 = ctx.px(rc2.pt);
        shapes.push('<rect x="' + r2(Math.min(a1.x, a2.x)) + '" y="' + r2(Math.min(a1.y, a2.y)) + '" width="' + r2(Math.abs(a2.x - a1.x)) + '" height="' + r2(Math.abs(a2.y - a1.y)) + '" style="' + sa.css + '"/>');
        ctx.ext(a1.x, a1.y); ctx.ext(a2.x, a2.y);
        prev = cur; cur = rc2.pt; sub = null; continue;
      }
      if(/^arc\b/.test(rest)){
        if(!cur || !sub) bad('arc khi chưa có điểm đầu');
        pos += 3; skipWs();
        if(pathSrc.charAt(pos) !== '(') bad('arc');
        var e9 = skipGroup(pathSrc, pos, '(', ')');
        var as = pathSrc.slice(pos + 1, e9).split(':'); pos = e9 + 1;
        if(as.length !== 3) bad('arc cần (đầu:cuối:bán kính)');
        var s0 = evalExpr(as[0]), s1 = evalExpr(as[1]), ar = evalExpr(as[2]);
        var cx = cur.x - ar * Math.cos(s0 * Math.PI / 180), cy = cur.y - ar * Math.sin(s0 * Math.PI / 180);
        var endPt = { x: cx + ar * Math.cos(s1 * Math.PI / 180), y: cy + ar * Math.sin(s1 * Math.PI / 180) };
        var pe = ctx.px(endPt), rpx2 = ar * ctx.scale * PX_CM;
        var large = Math.abs(s1 - s0) > 180 ? 1 : 0, sweep = s1 > s0 ? 0 : 1;
        sub.d += 'A' + r2(rpx2) + ' ' + r2(rpx2) + ' 0 ' + large + ' ' + sweep + ' ' + r2(pe.x) + ' ' + r2(pe.y);
        sub.count++;
        // phạm vi: lấy cả tâm ± bán kính cho an toàn
        var pcn = ctx.px({ x: cx, y: cy }); ctx.ext(pcn.x, pcn.y, rpx2); ctx.ext(pe.x, pe.y);
        prev = cur; cur = endPt; continue;
      }
      if(/^node\b/.test(rest)){
        var nd = readNode(ctx, pathSrc, pos + 4);
        pos = nd.end;
        var nPos = nodePos(nd.optsRaw);
        if(pendingOp !== null && !nd.atRaw){
          midNodes.push({ optsRaw: nd.optsRaw, text: nd.text, pos: nPos });
          if(nd.name) bad('node có tên nằm giữa đường nối');
          continue;
        }
        var where;
        if(nd.atRaw){ where = resolveCoord(ctx, nd.atRaw, cur).pt; }
        else {
          if(!cur) bad('node khi chưa có điểm hiện tại');
          where = cur;
          if(nPos !== null && prev && sub && nPos !== 1) where = { x: prev.x + (cur.x - prev.x) * nPos, y: prev.y + (cur.y - prev.y) * nPos };
        }
        emitNode(ctx, st, nd.optsRaw, nd.text, where);
        if(nd.name) ctx.names[nd.name] = { x: where.x, y: where.y };
        continue;
      }
      bad('thành phần đường vẽ: ' + rest.slice(0, 14));
    }
    if(midNodes.length) bad('node giữa đường nối không có điểm cuối');

    // xuất phần đường
    subs.forEach(function(sb){
      if(sb.count < 2 && !sb.closed) return; // chỉ có điểm di chuyển -> không vẽ gì
      var extra = '';
      if(marker && !sb.closed){
        if(st.arrowEnd) extra += ' marker-end="url(#' + marker + ')"';
        if(st.arrowStart) extra += ' marker-start="url(#' + marker + ')"';
      }
      ctx.elems.push('<path d="' + sb.d + '" style="' + sa.css + '"' + extra + '/>');
    });
    shapes.forEach(function(s){ ctx.elems.push(s); });
  }

  // ------------------------------------------------------------------ foreach
  function expandList(listSrc){
    var items = splitTop(listSrc, ',').map(function(t){ return t.trim(); }).filter(function(t){ return t !== ''; });
    var di = items.indexOf('...');
    if(di < 0){ di = items.indexOf('…'); }
    if(di < 0) return items;
    if(di < 1 || di >= items.length - 1) bad('danh sách foreach có dấu ...');
    var before = items.slice(0, di), end = items[di + 1];
    var a = evalExpr(before[0]), e = evalExpr(end);
    var step = before.length >= 2 ? evalExpr(before[1]) - a : (e >= a ? 1 : -1);
    if(!step) bad('bước foreach = 0');
    var out = [], v = a, guard = 0;
    while((step > 0 ? v <= e + 1e-9 : v >= e - 1e-9) && guard++ < 500){ out.push(String(Math.round(v * 1e6) / 1e6)); v += step; }
    return out;
  }
  function execForeach(ctx, src, pos, baseSt, runStatements){
    // src[pos] ngay sau "\foreach"
    var p = pos;
    while(/\s/.test(src.charAt(p))) p++;
    var vm = /^((?:\\[a-zA-Z]+)(?:\s*\/\s*\\[a-zA-Z]+)*)\s*(?:\[[^\]]*\])?\s*in\b/.exec(src.slice(p));
    if(!vm) bad('foreach cú pháp');
    if(/\[/.test(vm[0])) bad('foreach có tuỳ chọn [..]');
    var vars = vm[1].split('/').map(function(s){ return s.trim().slice(1); });
    p += vm[0].length;
    while(/\s/.test(src.charAt(p))) p++;
    if(src.charAt(p) !== '{') bad('foreach thiếu {danh sách}');
    var le = skipGroup(src, p, '{', '}');
    var list = expandList(src.slice(p + 1, le));
    p = le + 1;
    while(/\s/.test(src.charAt(p))) p++;
    var body, endPos;
    if(src.charAt(p) === '{'){
      var be = skipGroup(src, p, '{', '}');
      body = src.slice(p + 1, be); endPos = be + 1;
      // cho phép dấu ; thừa ngay sau }
      var q = endPos; while(/\s/.test(src.charAt(q))) q++;
      if(src.charAt(q) === ';') endPos = q + 1;
    } else {
      var semi = findStmtEnd(src, p);
      body = src.slice(p, semi + 1); endPos = semi + 1;
    }
    list.forEach(function(item){
      var vals = vars.length > 1 ? item.split('/') : [item];
      if(vals.length < vars.length) bad('foreach thiếu giá trị cho biến');
      var b = body;
      vars.forEach(function(name, k){
        b = b.replace(new RegExp('\\\\' + name + '(?![A-Za-z])', 'g'), function(){ return vals[k].trim(); });
      });
      runStatements(b);
    });
    return endPos;
  }

  function findStmtEnd(src, from){
    var d = 0, inMath = false;
    for(var i = from; i < src.length; i++){
      var c = src.charAt(i);
      if(c === '\\'){ i++; continue; }
      if(c === '$') inMath = !inMath;
      if(inMath) continue;
      if(c === '{' || c === '[' || c === '(') d++;
      else if(c === '}' || c === ']' || c === ')') d--;
      else if(c === ';' && d === 0) return i;
    }
    return src.length; // không có dấu ; cuối -> lấy hết phần còn lại
  }

  // ------------------------------------------------------------------ chạy các câu lệnh
  function runStatements(ctx, src, st){
    var pos = 0;
    function self(sub){ runStatements(ctx, sub, st); }
    while(true){
      while(pos < src.length && /\s/.test(src.charAt(pos))) pos++;
      if(pos >= src.length) break;
      if(src.charAt(pos) === ';'){ pos++; continue; }
      if(src.charAt(pos) !== '\\') bad('ký tự lạ: ' + src.slice(pos, pos + 10));
      var m = /^\\([a-zA-Z]+)/.exec(src.slice(pos));
      if(!m) bad('lệnh');
      var cmd = m[1]; pos += m[0].length;

      if(cmd === 'foreach'){ pos = execForeach(ctx, src, pos, st, self); continue; }
      if(cmd === 'usetikzlibrary' || cmd === 'tikzset' || cmd === 'pgfplotsset'){
        while(/\s/.test(src.charAt(pos))) pos++;
        if(src.charAt(pos) === '{'){ pos = skipGroup(src, pos, '{', '}') + 1; }
        if(cmd === 'tikzset') bad('tikzset');
        continue;
      }
      if(cmd === 'begin'){
        var bm = /^\s*\{scope\}\s*(\[[^\]]*\])?/.exec(src.slice(pos));
        if(!bm) bad('môi trường ' + src.slice(pos, pos + 16));
        var scopeOpts = bm[1] ? bm[1].slice(1, -1) : '';
        var after = pos + bm[0].length;
        // tìm \end{scope} khớp (có lồng nhau)
        var depth = 1, scan = after, endAt = -1, mm;
        var re = /\\(begin|end)\{scope\}/g; re.lastIndex = after;
        while((mm = re.exec(src))){ if(mm[1] === 'begin') depth++; else { depth--; if(depth === 0){ endAt = mm.index; break; } } }
        if(endAt < 0) bad('thiếu \\end{scope}');
        var sst = cloneStyle(st);
        var left = applyStyleOpts(sst, parseOpts(scopeOpts), ctx, false);
        if(left.length) bad('scope có biến đổi: ' + left[0].k);
        runStatements(ctx, src.slice(after, endAt), sst);
        pos = endAt + ('\\end{scope}').length;
        continue;
      }
      if(cmd === 'node' || cmd === 'coordinate'){
        var e = findStmtEnd(src, pos);
        var body = src.slice(pos, e);
        pos = e + 1;
        if(cmd === 'coordinate'){
          var cm = /^\s*(\[[^\]]*\])?\s*\(([^)]*)\)\s*at\s*(\([^)]*\))\s*$/.exec(body);
          if(!cm || cm[1]) bad('coordinate');
          ctx.names[cm[2].trim()] = resolveCoord(ctx, cm[3], null).pt;
          continue;
        }
        var nd = readNode(ctx, body, 0);
        if(!nd.atRaw) bad('\\node thiếu at');
        var where = resolveCoord(ctx, nd.atRaw, null).pt;
        emitNode(ctx, st, nd.optsRaw, nd.text, where);
        if(nd.name) ctx.names[nd.name] = { x: where.x, y: where.y };
        continue;
      }
      if(cmd === 'draw' || cmd === 'fill' || cmd === 'filldraw' || cmd === 'path'){
        var e2 = findStmtEnd(src, pos);
        var seg = src.slice(pos, e2);
        pos = e2 + 1;
        var optsRaw = '';
        var t = seg.replace(/^\s+/, '');
        if(t.charAt(0) === '['){ var oe = skipGroup(t, 0, '[', ']'); optsRaw = t.slice(1, oe); t = t.slice(oe + 1); }
        execPath(ctx, cmd, optsRaw, t, st);
        continue;
      }
      bad('lệnh chưa hỗ trợ: \\' + cmd);
    }
  }

  // ------------------------------------------------------------------ hàm chính
  function hashStr(s){
    var h = 5381;
    for(var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }
  var cache = {};

  function render(code){
    code = String(code == null ? '' : code);
    if(Object.prototype.hasOwnProperty.call(cache, code)) return cache[code];
    var out = null;
    try{
      out = renderUncached(code);
    }catch(e){
      if(e && e.isUnsupported){
        if(global.console && console.warn) console.warn('[tikz-lite] chưa hỗ trợ:', e.message);
        out = null;
      } else {
        if(global.console && console.error) console.error('[tikz-lite] lỗi:', e);
        out = null;
      }
    }
    cache[code] = out;
    return out;
  }

  function renderUncached(code){
    var src = stripComments(code).replace(/^\s+/, '');
    var st = baseStyle();
    var ctx = new Ctx(hashStr(code));
    if(src.charAt(0) === '['){
      var oe = skipGroup(src, 0, '[', ']');
      var pic = parseOpts(src.slice(1, oe));
      src = src.slice(oe + 1);
      var restOpts = [];
      pic.forEach(function(o){
        if(o.k === 'scale'){ ctx.scale = evalExpr(o.v); }
        else restOpts.push(o);
      });
      var left = applyStyleOpts(st, restOpts, ctx, false);
      if(left.length) bad('tuỳ chọn tikzpicture: ' + left[0].k);
    }
    if(!(ctx.scale > 0)) bad('scale');
    runStatements(ctx, src, st);
    if(!ctx.elems.length || !isFinite(ctx.minX)) bad('hình rỗng');
    var pad = 10;
    var x0 = ctx.minX - pad, y0 = ctx.minY - pad;
    var w = ctx.maxX - ctx.minX + 2 * pad, h = ctx.maxY - ctx.minY + 2 * pad;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" class="ps-tikz-svg" role="img" aria-label="Hình vẽ minh họa" ' +
      'viewBox="' + r2(x0) + ' ' + r2(y0) + ' ' + r2(w) + ' ' + r2(h) + '" width="' + r2(w) + '" height="' + r2(h) + '" ' +
      'style="max-width:100%;height:auto;overflow:visible;fill:currentColor;font-family:\'Latin Modern Roman\',\'STIX Two Text\',\'Times New Roman\',serif;">' +
      (ctx.defs.length ? '<defs>' + ctx.defs.join('') + '</defs>' : '') +
      ctx.elems.join('') + '</svg>';
    return svg;
  }

  global.OPC_TIKZ = { render: render, version: '2026-10-02' };
})(typeof window !== 'undefined' ? window : this);
