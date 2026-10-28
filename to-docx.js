/* ================= FaradayAI — XUẤT 3 FILE WORD ĐỀ TỔ (đề / đề có đáp án / bảng đáp án) ngay trên trình duyệt =================
 * THÊM 27/10/2026. Port từ build_de.py của Tổ Vật lí – Công nghệ (cùng cấu trúc de.json, cùng file mẫu mau_to.docx, cùng bố cục)
 * nhưng KHÔNG cần Python/pandoc: công thức LaTeX ($...$) được chuyển thẳng sang Word Equation (OMML) bằng bộ chuyển nhỏ bên dưới
 * (phân số, chỉ số trên/dưới, căn, vectơ, kí hiệu hạt nhân ^{A}_{Z}X ở dạng m:sPre, chữ Hi Lạp, đơn vị…).
 * Sau khi tải về, thầy vẫn mở Word → MathType → Convert Equations như quy định của Tổ.
 * Xuất: window.OPC_TODOCX = { buildAll, latexToOmml, validate, estimatePages, imageSize }
 * Cần: JSZip (window.JSZip) và mẫu mau_to.docx (window.OPC_TO_TEMPLATE_B64 trong to-template.js) — hoặc truyền qua opts.
 */
(function(root){
  'use strict';

  // ------------------------------------------------------------------ tiện ích XML
  function esc(s){ return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // ------------------------------------------------------------------ LaTeX -> OMML
  var GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'ϕ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
    Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω', ell: 'ℓ', hbar: 'ℏ', partial: '∂', nabla: '∇', infty: '∞' };
  var OPS = { cdot: '⋅', times: '×', pm: '±', mp: '∓', approx: '≈', neq: '≠', ne: '≠', leq: '≤', le: '≤', geq: '≥', ge: '≥', rightarrow: '→', to: '→', leftarrow: '←', Rightarrow: '⇒', Leftrightarrow: '⇔', leftrightarrow: '↔', propto: '∝', sim: '∼', equiv: '≡', circ: '∘', degree: '°', div: '÷', ll: '≪', gg: '≫', cdots: '⋯', ldots: '…', dots: '…', angle: '∠', perp: '⊥', parallel: '∥', in: '∈', Delta2: 'Δ' };
  var FUNCS = { sin: 1, cos: 1, tan: 1, cot: 1, sec: 1, csc: 1, ln: 1, log: 1, lg: 1, exp: 1, lim: 1, max: 1, min: 1, arcsin: 1, arccos: 1, arctan: 1, sinh: 1, cosh: 1, tanh: 1 };
  var SPACES = { ',': 1, ';': 1, ':': 1, ' ': 1, quad: 1, qquad: 1, '!': 0, '>': 1 };
  var PLAIN_OP = /^[=+\-−×⋅±∓≈≠≤≥→←⇒⇔↔∝∼≡∘÷≪≫<>]$/;

  function mrun(text, o){
    o = o || {};
    if(text === '') return '';
    var rp = '';
    if(o.nor) rp += '<m:nor/>';
    if(o.sty) rp += '<m:sty m:val="' + o.sty + '"/>';
    return '<m:r>' + (rp ? '<m:rPr>' + rp + '</m:rPr>' : '') + '<m:t xml:space="preserve">' + esc(text) + '</m:t></m:r>';
  }

  function tokenize(s){
    var t = [], i = 0;
    while(i < s.length){
      var c = s[i];
      if(c === '\\'){
        var m = /^\\([a-zA-Z]+)/.exec(s.slice(i));
        if(m){ t.push({ k: 'cmd', v: m[1] }); i += m[0].length; }
        else { t.push({ k: 'cmd', v: s[i + 1] || '' }); i += 2; }
      } else if(c === '{'){ t.push({ k: '{' }); i++; }
      else if(c === '}'){ t.push({ k: '}' }); i++; }
      else if(c === '^'){ t.push({ k: '^' }); i++; }
      else if(c === '_'){ t.push({ k: '_' }); i++; }
      else if(/\s/.test(c)){ i++; }
      else if(/[0-9]/.test(c)){ var d = /^[0-9]+/.exec(s.slice(i))[0]; t.push({ k: 'num', v: d }); i += d.length; }
      else { t.push({ k: 'ch', v: c }); i++; }
    }
    return t;
  }

  function latexToOmml(src, warn){
    warn = warn || function(){};
    var tex = String(src);
    tex = tex.replace(/(?<![\\a-zA-Z])(\d+,\d+)/g, '\\text{$1}');   // số thập phân kiểu VN: giữ nguyên "2,83"
    tex = tex.replace(/\^\{?\\circ\}?/g, '°');                       // độ
    var toks = tokenize(tex), p = 0;

    function peek(){ return toks[p]; }
    function group(){ // đọc {...} hoặc 1 token → xml
      var t = peek();
      if(!t) return '';
      if(t.k === '{'){ p++; var xml = seq('}'); if(peek() && peek().k === '}') p++; return xml; }
      return atom() || '';
    }
    function argRaw(){ // đọc nội dung chữ thuần của {..}
      var t = peek(), out = '';
      if(t && t.k === '{'){ p++; var depth = 1; while(p < toks.length && depth){ var x = toks[p++]; if(x.k === '{') depth++; else if(x.k === '}'){ depth--; if(!depth) break; } else out += (x.v != null ? (x.k === 'cmd' ? (SPACES[x.v] ? ' ' : '') : x.v) : ''); } }
      else if(t){ p++; out = t.v || ''; }
      return out;
    }
    function textOf(styMode){ // \text{..} / \mathrm{..} → run
      var raw = argRaw();
      return styMode === 'text' ? mrun(raw, { nor: true, sty: 'p' }) : mrun(raw, { sty: 'p' });
    }
    function scripts(base){ // gắn ^ _ sau 1 cơ sở
      var sub = null, sup = null;
      for(;;){
        var t = peek();
        if(t && t.k === '_' && sub === null){ p++; sub = group(); }
        else if(t && t.k === '^' && sup === null){ p++; sup = group(); }
        else break;
      }
      if(sub === null && sup === null) return base;
      if(sub !== null && sup !== null) return '<m:sSubSup><m:e>' + base + '</m:e><m:sub>' + sub + '</m:sub><m:sup>' + sup + '</m:sup></m:sSubSup>';
      if(sub !== null) return '<m:sSub><m:e>' + base + '</m:e><m:sub>' + sub + '</m:sub></m:sSub>';
      return '<m:sSup><m:e>' + base + '</m:e><m:sup>' + sup + '</m:sup></m:sSup>';
    }
    function prescript(){ // ^{A}_{Z}X hoặc _{Z}^{A}X ở đầu: m:sPre (chỉ số đứng trước kí hiệu)
      var sub = '', sup = '';
      for(var n = 0; n < 2; n++){
        var t = peek();
        if(t && t.k === '_'){ p++; sub = group(); }
        else if(t && t.k === '^'){ p++; sup = group(); }
      }
      var e = atom() || '';
      return '<m:sPre><m:sub>' + sub + '</m:sub><m:sup>' + sup + '</m:sup><m:e>' + e + '</m:e></m:sPre>';
    }
    function atom(){
      var t = peek(); if(!t) return '';
      var base = '';
      if(t.k === '{'){ p++; base = seq('}'); if(peek() && peek().k === '}') p++; return scripts(base); }
      if(t.k === 'num'){ p++; return scripts(mrun(t.v)); }
      if(t.k === 'ch'){
        p++;
        var v = t.v === '-' ? '−' : t.v;
        base = PLAIN_OP.test(v) ? mrun(v, { sty: 'p' }) : mrun(v);
        return scripts(base);
      }
      if(t.k === 'cmd'){
        p++;
        var c = t.v;
        if(c === 'frac' || c === 'dfrac' || c === 'tfrac'){ var n = group(), d = group(); return scripts('<m:f><m:fPr><m:type m:val="bar"/></m:fPr><m:num>' + n + '</m:num><m:den>' + d + '</m:den></m:f>'); }
        if(c === 'sqrt'){
          var deg = null;
          if(peek() && peek().k === 'ch' && peek().v === '['){ p++; var buf = []; while(peek() && !(peek().k === 'ch' && peek().v === ']')) buf.push(atom() || (p++, '')); p++; deg = buf.join(''); }
          var e = group();
          return scripts('<m:rad><m:radPr>' + (deg == null ? '<m:degHide m:val="on"/>' : '') + '</m:radPr><m:deg>' + (deg || '') + '</m:deg><m:e>' + e + '</m:e></m:rad>');
        }
        if(c === 'vec' || c === 'overrightarrow'){ return scripts('<m:acc><m:accPr><m:chr m:val="⃗"/></m:accPr><m:e>' + group() + '</m:e></m:acc>'); }
        if(c === 'hat'){ return scripts('<m:acc><m:accPr><m:chr m:val="̂"/></m:accPr><m:e>' + group() + '</m:e></m:acc>'); }
        if(c === 'bar'){ return scripts('<m:acc><m:accPr><m:chr m:val="̅"/></m:accPr><m:e>' + group() + '</m:e></m:acc>'); }
        if(c === 'dot'){ return scripts('<m:acc><m:accPr><m:chr m:val="̇"/></m:accPr><m:e>' + group() + '</m:e></m:acc>'); }
        if(c === 'tilde'){ return scripts('<m:acc><m:accPr><m:chr m:val="̃"/></m:accPr><m:e>' + group() + '</m:e></m:acc>'); }
        if(c === 'overline'){ return scripts('<m:bar><m:barPr><m:pos m:val="top"/></m:barPr><m:e>' + group() + '</m:e></m:bar>'); }
        if(c === 'underline'){ return scripts('<m:bar><m:barPr><m:pos m:val="bot"/></m:barPr><m:e>' + group() + '</m:e></m:bar>'); }
        if(c === 'text' || c === 'textrm' || c === 'textnormal'){ return scripts(textOf('text')); }
        if(c === 'mathrm' || c === 'operatorname' || c === 'rm' || c === 'mathsf'){ return scripts(textOf('rm')); }
        if(c === 'mathbf' || c === 'boldsymbol' || c === 'bm' || c === 'textbf'){ return scripts(mrun(argRaw(), { sty: 'b' })); }
        if(c === 'mathit' || c === 'textit'){ return scripts(mrun(argRaw(), { sty: 'i' })); }
        if(c === 'left' || c === 'right'){
          var bt = peek(); var ch = bt ? (bt.k === 'cmd' ? (bt.v === '{' ? '{' : (bt.v === '}' ? '}' : (bt.v === '|' ? '‖' : ''))) : (bt.v || '')) : ''; if(bt) p++;
          if(ch === '.') ch = '';
          return mrun(ch === '-' ? '−' : ch);
        }
        if(c === 'big' || c === 'Big' || c === 'bigg' || c === 'Bigg' || c === 'displaystyle' || c === 'textstyle' || c === 'limits' || c === 'nolimits'){ return ''; }
        if(c === '{' || c === '}'){ return scripts(mrun(c)); }
        if(c === '%' || c === '$' || c === '&' || c === '#'){ return scripts(mrun(c)); }
        if(c === '|'){ return scripts(mrun('‖')); }
        if(c === '\\'){ return ''; }
        if(c === '!'){ return ''; }
        if(SPACES[c]){ return mrun(' ', { nor: true }); }
        if(GREEK[c]){ return scripts(mrun(GREEK[c], (c === 'ell' || c === 'hbar' || c === 'partial' || c === 'nabla' || c === 'infty') ? { sty: 'p' } : null)); }
        if(OPS[c]){ return scripts(mrun(OPS[c], { sty: 'p' })); }
        if(FUNCS[c]){ return scripts(mrun(c, { sty: 'p' })); }
        if(c === 'sum' || c === 'int'){
          var chr = c === 'sum' ? '∑' : '∫', lo = '', hi = '';
          for(var q = 0; q < 2; q++){ var tt = peek(); if(tt && tt.k === '_'){ p++; lo = group(); } else if(tt && tt.k === '^'){ p++; hi = group(); } }
          return '<m:nary><m:naryPr><m:chr m:val="' + chr + '"/><m:limLoc m:val="' + (c === 'sum' ? 'undOvr' : 'subSup') + '"/>' + (lo ? '' : '<m:subHide m:val="on"/>') + (hi ? '' : '<m:supHide m:val="on"/>') + '</m:naryPr><m:sub>' + lo + '</m:sub><m:sup>' + hi + '</m:sup><m:e></m:e></m:nary>';
        }
        warn('lệnh LaTeX chưa hỗ trợ: \\' + c);
        return scripts(mrun('\\' + c, { nor: true }));
      }
      if(t.k === '^' || t.k === '_'){ return prescript(); }
      p++;
      return '';
    }
    function seq(stop){
      var out = '';
      while(p < toks.length){
        var t = peek();
        if(stop && t.k === stop) break;
        if(t.k === '}' ){ p++; continue; }
        if((t.k === '^' || t.k === '_')) { out += prescript(); continue; }
        var a = atom();
        out += a;
      }
      return out;
    }
    var body = seq(null);
    // kí hiệu hạt nhân dạng "_{Z}^{A}\mathrm{X}" đã thành sPre ở prescript(); chữ trong sPre.e viết đứng (nor)
    body = body.replace(/(<m:sPre>(?:<m:sub>.*?<\/m:sub>)(?:<m:sup>.*?<\/m:sup>)<m:e>)(.*?)(<\/m:e><\/m:sPre>)/g, function(_, a, e, b){ return a + e.replace(/<m:rPr>/g, '<m:rPr><m:nor/>').replace(/<m:r><m:t /g, '<m:r><m:rPr><m:nor/></m:rPr><m:t ') + b; });
    // thêm font Cambria Math cho mọi run công thức (như build_de.py)
    var mr = '<w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>';
    body = body.replace(/(<m:r>(?:<m:rPr>.*?<\/m:rPr>)?)/g, function(_, g){ return g + mr; });
    return '<m:oMath>' + body + '</m:oMath>';
  }

  // ------------------------------------------------------------------ chạy chữ (run) / đoạn văn
  var RPR = '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>{extra}<w:sz w:val="24"/><w:szCs w:val="24"/>';
  var TABS4 = '<w:tabs><w:tab w:val="left" w:pos="283"/><w:tab w:val="left" w:pos="2835"/><w:tab w:val="left" w:pos="5386"/><w:tab w:val="left" w:pos="7937"/></w:tabs>';
  var TABS2 = '<w:tabs><w:tab w:val="left" w:pos="283"/><w:tab w:val="left" w:pos="4820"/></w:tabs>';
  var TABS1 = '<w:tabs><w:tab w:val="left" w:pos="283"/></w:tabs>';

  function rpr(o){
    o = o || {};
    var x = '';
    if(o.b) x += '<w:b/><w:bCs/>';
    if(o.i) x += '<w:i/><w:iCs/>';
    if(o.red) x += '<w:color w:val="EE0000"/>';
    x = RPR.replace('{extra}', x);
    if(o.hl) x += '<w:highlight w:val="yellow"/>';
    if(o.u) x += '<w:u w:val="single"/>';
    return '<w:rPr>' + x + '</w:rPr>';
  }
  function run(text, o){
    if(text === '') return '';
    var out = [], parts = String(text).split('\t');
    parts.forEach(function(p, k){
      if(k) out.push('<w:r>' + rpr(o) + '<w:tab/></w:r>');
      if(p) out.push('<w:r>' + rpr(o) + '<w:t xml:space="preserve">' + esc(p) + '</w:t></w:r>');
    });
    return out.join('');
  }
  function mk(o, extra){ return Object.assign({}, o || {}, extra); }

  // rich: "$..$" công thức, "**..**" đậm, "*..*" nghiêng
  function rich(text, o, warnings){
    var out = [];
    String(text).split(/(\$[^$]+\$)/).forEach(function(seg){
      if(!seg) return;
      if(seg.length > 1 && seg[0] === '$' && seg[seg.length - 1] === '$'){
        out.push(latexToOmml(seg.slice(1, -1), function(w){ if(warnings) warnings.push(w + '  ($' + seg.slice(1, -1).slice(0, 40) + '$)'); }));
        return;
      }
      seg.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).forEach(function(s){
        if(!s) return;
        if(s.slice(0, 2) === '**') out.push(run(s.slice(2, -2), mk(o, { b: true })));
        else if(s[0] === '*' && s.length > 1) out.push(run(s.slice(1, -1), mk(o, { i: true })));
        else out.push(run(s, o));
      });
    });
    return out.join('');
  }
  function visLen(text){
    var t = String(text).replace(/\$([^$]+)\$/g, function(_, g){
      g = g.replace(/\\(?:d?frac)\{([^}]*)\}\{([^}]*)\}/g, function(__, a, b){ return 'x'.repeat(Math.max(a.length, b.length)); });
      g = g.replace(/\\[a-zA-Z]+/g, 'x').replace(/[{}^_ ]/g, '');
      return 'x'.repeat(g.length);
    });
    return t.replace(/\*\*/g, '').replace(/\*/g, '').length;
  }

  // ------------------------------------------------------------------ ảnh
  function imageSize(b){ // PNG / JPEG / GIF → {w,h}
    if(b[0] === 0x89 && b[1] === 0x50){ var dv = new DataView(b.buffer, b.byteOffset, b.byteLength); return { w: dv.getUint32(16), h: dv.getUint32(20) }; }
    if(b[0] === 0x47 && b[1] === 0x49){ return { w: b[6] | (b[7] << 8), h: b[8] | (b[9] << 8) }; }
    if(b[0] === 0xFF && b[1] === 0xD8){
      var i = 2;
      while(i < b.length){
        if(b[i] !== 0xFF){ i++; continue; }
        var m = b[i + 1]; if(m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)){ i += 2; continue; }
        var len = (b[i + 2] << 8) | b[i + 3];
        if(m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
        i += 2 + len;
      }
    }
    return { w: 4, h: 3 };
  }
  function ImageBank(images){ this.images = images || {}; this.files = []; this.missing = []; }
  ImageBank.prototype.anchor = function(spec){
    var im = this.images[spec.file];
    if(!im){ this.missing.push(spec.file); return ''; }
    var sz = imageSize(im.bytes), wcm = Number(spec.width_cm || 5.0);
    var cx = Math.round(wcm * 360000), cy = Math.round(cx * sz.h / sz.w);
    var n = this.files.length + 1, rid = 'rIdImg' + n;
    var ext = (/\.(png|jpe?g|gif)$/i.exec(spec.file) || ['', 'png'])[1].toLowerCase().replace('jpeg', 'jpg');
    this.files.push({ rid: rid, bytes: im.bytes, target: 'media/hinh' + n + '.' + ext });
    var graphic = '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
      + '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="' + n + '" name="hinh' + n + '"/><pic:cNvPicPr/></pic:nvPicPr>'
      + '<pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
      + '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic>';
    return '<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="114300" distR="0" simplePos="0" relativeHeight="' + (251660000 + n) + '" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">'
      + '<wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="margin"><wp:align>right</wp:align></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>'
      + '<wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapSquare wrapText="bothSides"/><wp:docPr id="' + (5000 + n) + '" name="hinh' + n + '"/><wp:cNvGraphicFramePr/>' + graphic + '</wp:anchor></w:drawing></w:r>';
  };

  // ------------------------------------------------------------------ đoạn / câu hỏi
  function para(content, o){
    o = o || {};
    var ppr = o.tabs || '';
    if(o.keepNext) ppr = '<w:keepNext/>' + ppr;
    if(o.after !== false) ppr += '<w:spacing w:after="40"/>';
    if(o.first0 !== false) ppr += '<w:ind w:firstLine="0"/>';
    if(o.jc) ppr += '<w:jc w:val="' + o.jc + '"/>';
    return '<w:p><w:pPr>' + ppr + '</w:pPr>' + content + '</w:p>';
  }
  function qPara(no, stem, img, W){ return para(img + run('Câu ' + no + '. ', { b: true }) + rich(stem, null, W), { keepNext: true }); }
  function optionsBlock(opts, ans, show, W){
    var L = ['A', 'B', 'C', 'D'], mx = Math.max.apply(null, opts.map(visLen)), cols, tabs;
    if(mx <= 18){ cols = 4; tabs = TABS4; } else if(mx <= 40){ cols = 2; tabs = TABS2; } else { cols = 1; tabs = TABS1; }
    var cells = opts.map(function(o, k){ var mark = show && L[k] === ans; return run(L[k] + '.', { b: true, u: mark }) + run(' ', { b: true }) + rich(o, null, W); });
    var out = [];
    for(var r0 = 0; r0 < 4; r0 += cols){
      var row = cells.slice(r0, r0 + cols);
      out.push(para(row[0] + row.slice(1).map(function(c){ return run('\t') + c; }).join(''), { tabs: tabs, first0: false, keepNext: (r0 + cols < 4) }));
    }
    return out.join('');
  }
  function answerBox(ans){
    ans = String(ans);
    var cell = function(t){ return '<w:tc><w:tcPr><w:tcW w:w="518" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:pStyle w:val="NoSpacing"/><w:spacing w:before="40"/><w:jc w:val="center"/></w:pPr>' + run(t) + '</w:p></w:tc>'; };
    var label = '<w:tc><w:tcPr><w:tcW w:w="1075" w:type="dxa"/><w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:pStyle w:val="NoSpacing"/><w:spacing w:before="40"/></w:pPr>' + run('Đáp án:', { b: true }) + '</w:p></w:tc>';
    var chars = Array.from(ans);
    var grid = '<w:gridCol w:w="1075"/>' + chars.map(function(){ return '<w:gridCol w:w="518"/>'; }).join('');
    return '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:jc w:val="right"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>'
      + '<w:tblGrid>' + grid + '</w:tblGrid><w:tr><w:trPr><w:jc w:val="right"/></w:trPr>' + label + chars.map(cell).join('') + '</w:tr></w:tbl>';
  }
  function isTrue(d){ return d === true || d === 'Đ' || d === 'Đúng' || d === 1; }

  function buildBody(de, show, imgs, W){
    var out = [], P1 = de.phan1, P2 = de.phan2, P3 = de.phan3;
    var n1 = P1.length, n2 = P2.length, n3 = P3.reduce(function(a, g){ return a + g.cau.length; }, 0);
    out.push(para(run('PHẦN I. Thí sinh trả lời từ câu 1 đến câu ' + n1 + '. Mỗi câu hỏi thí sinh chỉ chọn một phương án', { b: true }), { keepNext: true }));
    P1.forEach(function(q, k){ out.push(qPara(k + 1, q.de, q.hinh ? imgs.anchor(q.hinh) : '', W)); out.push(optionsBlock(q.pa, q.da, show, W)); });
    out.push(para('', { after: false }));
    out.push(para(run('PHẦN II. Thí sinh trả lời từ câu 1 đến ' + n2 + '. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai', { b: true }), { keepNext: true }));
    P2.forEach(function(q, k){
      out.push(qPara(k + 1, q.de, q.hinh ? imgs.anchor(q.hinh) : '', W));
      q.y.forEach(function(y, j){
        var c = run('abcd'[j] + ')', { b: true }) + run(' ') + rich(y, null, W);
        if(show) c += run(' (' + (isTrue(q.da[j]) ? 'Đúng' : 'Sai') + ')', { b: true, red: true, hl: true });
        out.push(para(c, { first0: false, keepNext: j < 3 }));
      });
    });
    out.push(para('', { after: false }));
    out.push(para(run('PHẦN III. Thí sinh trả lời từ câu 1 đến câu ' + n3 + ' (Không làm tròn kết quả các phép tính trung gian ở các câu từ câu 1 đến câu ' + n3 + ')', { b: true }), { keepNext: true }));
    var k = 0;
    P3.forEach(function(g){
      var nums = g.cau.map(function(_, i){ return k + 1 + i; });
      if(g.chung){
        var lab = 'Nội dung câu ' + (nums.length <= 2 ? nums.join(' và ') : nums.slice(0, -1).join(', ') + ' và ' + nums[nums.length - 1]) + ':';
        out.push(para((g.hinh ? imgs.anchor(g.hinh) : '') + run(lab, { i: true }) + run(' ') + rich(g.chung, null, W), { keepNext: true }));
      }
      g.cau.forEach(function(q){
        k++;
        out.push(qPara(k, q.de, q.hinh ? imgs.anchor(q.hinh) : '', W));
        if(show) out.push(answerBox(q.da));
      });
    });
    out.push(para('', { after: false }));
    out.push(para(run('----------HẾT----------', { b: true }), { jc: 'center' }));
    out.push(para(run('- Thí sinh không được sử dụng tài liệu;', { i: true })));
    out.push(para(run('- Giám thị không giải thích gì thêm.', { i: true })));
    return out.join('');
  }

  // ------------------------------------------------------------------ mẫu của Tổ
  function replaceText(xml, old, nw){ // chuỗi có thể vắt qua nhiều run trong 1 đoạn
    return xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, function(p){
      var ts = []; var re = /(<w:t(?: [^>]*)?>)([^<]*)(<\/w:t>)/g, m;
      while((m = re.exec(p)) !== null) ts.push({ s2: m.index + m[1].length, e2: m.index + m[1].length + m[2].length, txt: m[2] });
      var joined = ts.map(function(t){ return t.txt; }).join('');
      if(joined.indexOf(old) < 0) return p;
      var start = joined.indexOf(old), end = start + old.length, pos = 0, res = [];
      ts.forEach(function(t){
        var a = pos, b = pos + t.txt.length; pos = b;
        if(b <= start || a >= end) return;
        var nt;
        if(a <= start) nt = t.txt.slice(0, start - a) + esc(nw) + (b >= end ? t.txt.slice(end - a) : '');
        else nt = b > end ? t.txt.slice(end - a) : '';
        res.push([t.s2, t.e2, nt]);
      });
      res.reverse().forEach(function(r){ p = p.slice(0, r[0]) + r[2] + p.slice(r[1]); });
      return p;
    });
  }
  function pad2(n){ return (n < 10 ? '0' : '') + n; }
  function fillHeader(xml, meta, pages){
    xml = replaceText(xml, '(Đề thi có 04 trang)', '(Đề thi có ' + pad2(pages) + ' trang)');
    xml = replaceText(xml, 'Mã đề: 0201', 'Mã đề: ' + meta.ma_de);
    xml = replaceText(xml, 'ĐỀ ÔN LUYỆN SỐ 1', meta.ten_de || 'ĐỀ ÔN LUYỆN SỐ 1');
    xml = replaceText(xml, 'Trần Văn Lượng', meta.gv_ra_de);
    xml = replaceText(xml, 'Phùng Thị Tuyết', meta.gv_phan_bien || '……………………');
    if(meta.truong) xml = replaceText(xml, 'LÊ THÁNH TÔNG', meta.truong);
    if(meta.thoi_gian) xml = replaceText(xml, 'Thời gian làm bài: 50', 'Thời gian làm bài: ' + meta.thoi_gian);
    return xml;
  }
  function fillFooter(xml, meta, pages){
    xml = replaceText(xml, 'Mã đề thi 0201', 'Mã đề thi ' + meta.ma_de);
    return replaceText(xml, '/4', '/' + pages);
  }
  function splitTemplate(doc){
    var bodyStart = doc.indexOf('<w:body>') + '<w:body>'.length, sect = doc.lastIndexOf('<w:sectPr');
    var body = doc.slice(bodyStart, sect), els = body.match(/<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>|<w:tbl>[\s\S]*?<\/w:tbl>/g) || [];
    return { head: doc.slice(0, bodyStart), els: els, tail: doc.slice(sect) };
  }
  function fillBang(els, de){
    var tbls = []; els.forEach(function(e, i){ if(e.indexOf('<w:tbl>') === 0) tbls.push(i); });
    var t1 = tbls[2], t2 = tbls[3], t3 = tbls[4];
    function setTs(tbl, idxs, vals){
      var ts = []; var re = /(<w:t(?: [^>]*)?>)([^<]*)(<\/w:t>)/g, m;
      while((m = re.exec(tbl)) !== null) ts.push({ s2: m.index + m[1].length, e2: m.index + m[1].length + m[2].length });
      idxs.map(function(ix, k){ return [ix, vals[k]]; }).sort(function(a, b){ return b[0] - a[0]; }).forEach(function(pr){ var t = ts[pr[0]]; if(t) tbl = tbl.slice(0, t.s2) + esc(pr[1]) + tbl.slice(t.e2); });
      return tbl;
    }
    var e2 = els.slice();
    e2[t1] = setTs(e2[t1], Array.from({ length: 18 }, function(_, i){ return 1 + 2 * i; }), de.phan1.map(function(q){ return q.da; }));
    var vals = []; for(var r = 0; r < 4; r++) de.phan2.forEach(function(q){ vals.push(isTrue(q.da[r]) ? 'Đúng' : 'Sai'); });
    e2[t2] = setTs(e2[t2], Array.from({ length: 16 }, function(_, k){ return 6 + 2 * k + 1; }), vals);
    var p3 = []; de.phan3.forEach(function(g){ g.cau.forEach(function(q){ p3.push(String(q.da)); }); });
    e2[t3] = setTs(e2[t3], [8, 9, 10, 11, 12, 13], p3);
    return e2;
  }

  // ------------------------------------------------------------------ kiểm tra cấu trúc (cùng luật build_de.py)
  function validate(de){
    var err = [], warn = [];
    if(!de || !de.meta) return { err: ['Thiếu phần meta'], warn: warn };
    if(de.phan1.length !== 18) err.push('Phần I phải có 18 câu (đang ' + de.phan1.length + ')');
    if(de.phan2.length !== 4) err.push('Phần II phải có 4 câu (đang ' + de.phan2.length + ')');
    var n3 = de.phan3.reduce(function(a, g){ return a + g.cau.length; }, 0);
    if(n3 !== 6) err.push('Phần III phải có 6 câu (đang ' + n3 + ')');
    de.phan1.forEach(function(q, k){ if(!q.pa || q.pa.length !== 4 || 'ABCD'.indexOf(q.da) < 0 || !q.da) err.push('Phần I câu ' + (k + 1) + ': cần 4 phương án và đáp án A–D'); });
    de.phan2.forEach(function(q, k){ if(!q.y || q.y.length !== 4 || !q.da || q.da.length !== 4) err.push('Phần II câu ' + (k + 1) + ': cần 4 ý và 4 đáp án'); });
    de.phan3.forEach(function(g){ g.cau.forEach(function(q, k){ var a = String(q.da == null ? '' : q.da); if(a.length > 4 || !/^-?[0-9,]+$/.test(a)) err.push('Phần III: đáp án "' + a + '" phải ≤ 4 ký tự (số, dấu phẩy, dấu -)'); }); });
    var tags = de.phan1.concat(de.phan2).map(function(q){ return String(q.loai || ''); }).join(' ').toLowerCase() + ' ' + de.phan3.map(function(g){ return String(g.loai || ''); }).join(' ').toLowerCase();
    if(tags.trim()){
      var need = { 'đơn vị': 'câu hỏi về đơn vị', 'tên đại lượng': 'câu hỏi về tên đại lượng trong công thức', 'công thức': 'câu hỏi về công thức', 'thực tế': 'bài đọc thiết bị/ứng dụng thực tế', 'thực nghiệm': 'câu thực nghiệm', 'hình': 'câu có hình vẽ/đồ thị/bảng số liệu' };
      Object.keys(need).forEach(function(k){ if(tags.indexOf(k) < 0 && !(k === 'hình' && (tags.indexOf('đồ thị') > -1 || tags.indexOf('bảng') > -1))) warn.push('Chưa thấy ' + need[k] + ' (nhãn "' + k + '")'); });
    }
    var a = de.phan1.map(function(q){ return q.da; });
    'ABCD'.split('').forEach(function(L){ var n = a.filter(function(x){ return x === L; }).length; if(n < 3 || n > 6) warn.push('Phần I có ' + n + ' đáp án ' + L + ' (nên 3–6)'); });
    return { err: err, warn: warn };
  }

  // Ước lượng số trang (build_de.py đo bằng LibreOffice; trình duyệt không đo được → ước lượng, thầy chỉnh lại nếu cần)
  function estimatePages(de){
    var lines = 9; // khung tiêu đề
    de.phan1.forEach(function(q){ var mx = Math.max.apply(null, q.pa.map(visLen)); lines += Math.ceil(visLen(q.de) / 92) + (mx <= 18 ? 1 : (mx <= 40 ? 2 : 4)) + 0.25; });
    de.phan2.forEach(function(q){ lines += Math.ceil(visLen(q.de) / (q.hinh ? 60 : 92)) + q.y.reduce(function(a, y){ return a + Math.ceil(visLen(y) / 90); }, 0) + 0.5; if(q.hinh) lines += 3; });
    de.phan3.forEach(function(g){ lines += Math.ceil(visLen(g.chung || '') / 90) + 0.5; g.cau.forEach(function(q){ lines += Math.ceil(visLen(q.de) / 92) + 0.25; }); });
    return Math.max(1, Math.ceil(lines / 50.5));
  }

  function toU8(x){ return x instanceof Uint8Array ? x : new Uint8Array(x); }
  function b64ToU8(b64){
    if(typeof atob === 'function'){ var s = atob(b64), u = new Uint8Array(s.length); for(var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }

  // ------------------------------------------------------------------ dựng 3 file
  // opts: { templateBytes | templateB64, images: { 'hinh_x.png': { bytes } }, pages, JSZip }
  async function buildAll(de, opts){
    opts = opts || {};
    var JSZip = opts.JSZip || root.JSZip;
    if(!JSZip) throw new Error('Thiếu JSZip');
    var tplBytes = opts.templateBytes ? toU8(opts.templateBytes) : b64ToU8(opts.templateB64 || root.OPC_TO_TEMPLATE_B64 || '');
    if(!tplBytes.length) throw new Error('Thiếu file mẫu mau_to.docx');
    var v = validate(de);
    if(v.err.length) throw new Error('LỖI CẤU TRÚC ĐỀ:\n- ' + v.err.join('\n- '));
    var tz = await JSZip.loadAsync(tplBytes);
    var doc = await tz.file('word/document.xml').async('string');
    if(doc.slice(0, 6000).indexOf('xmlns:wp=') < 0) doc = doc.replace('<w:document ', '<w:document xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ');
    var footers = {};
    for(var name of Object.keys(tz.files)){ if(/^word\/footer\d+\.xml$/.test(name)) footers[name] = await tz.file(name).async('string'); }
    var sp = splitTemplate(doc), headerEls = sp.els.slice(0, 6), meta = de.meta;
    var warnings = [], missing = [];
    var built = {};
    ['de', 'dapan'].forEach(function(kind){ var imgs = new ImageBank(opts.images); built[kind] = { body: buildBody(de, kind === 'dapan', imgs, warnings), imgs: imgs }; missing = missing.concat(imgs.missing); });
    var pages = opts.pages || estimatePages(de);

    async function render(kind){
      var xml, imgs = null;
      if(kind === 'bang') xml = sp.head + fillBang(sp.els, de).join('') + sp.tail;
      else { xml = sp.head + headerEls.join('') + built[kind].body + sp.tail; imgs = built[kind].imgs; }
      xml = fillHeader(xml, meta, pages);
      var out = new JSZip();
      for(var fn of Object.keys(tz.files)){
        var f = tz.files[fn]; if(f.dir){ continue; }
        var data;
        if(fn === 'word/document.xml') data = xml;
        else if(footers[fn]) data = fillFooter(footers[fn], meta, pages);
        else if(fn === '[Content_Types].xml' && imgs && imgs.files.length){
          var s = await f.async('string');
          [['png', 'image/png'], ['jpg', 'image/jpeg'], ['gif', 'image/gif']].forEach(function(e){ if(s.indexOf('Extension="' + e[0] + '"') < 0) s = s.replace('<Default Extension="xml"', '<Default Extension="' + e[0] + '" ContentType="' + e[1] + '"/><Default Extension="xml"'); });
          data = s;
        } else if(fn === 'word/_rels/document.xml.rels' && imgs && imgs.files.length){
          var r = await f.async('string');
          data = r.replace('</Relationships>', imgs.files.map(function(x){ return '<Relationship Id="' + x.rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="' + x.target + '"/>'; }).join('') + '</Relationships>');
        } else if(fn === 'word/styles.xml'){ data = (await f.async('string')).replace('<w:sz w:val="26"/>', '<w:sz w:val="24"/>'); }
        else data = await f.async('uint8array');
        out.file(fn, data);
      }
      if(imgs) imgs.files.forEach(function(x){ out.file('word/' + x.target, x.bytes); });
      return out.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    }
    var res = { de: await render('de'), dapan: await render('dapan'), bang: await render('bang'), pages: pages, warnings: v.warn.concat(warnings.map(function(w){ return 'Công thức: ' + w; }), missing.map(function(m){ return 'Thiếu ảnh: ' + m; })) };
    return res;
  }

  var api = { buildAll: buildAll, latexToOmml: latexToOmml, validate: validate, estimatePages: estimatePages, imageSize: imageSize };
  root.OPC_TODOCX = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {}));
