/**
 * loigiai-dong.js — THÊM 4/11/2026 · LỜI GIẢI ĐỘNG (mỗi câu một clip, gắn thẳng vào câu hỏi)
 * Dùng CHUNG cho trang học sinh (index.html) và admin.html (xem thử). Cần nạp SAU faraday-extras.js
 * (dùng lại OPC_FX.richHtml, OPC_FX.sanitizeSvg). Không cần build: React UMD (h = React.createElement).
 *
 * DỮ LIỆU — collection loi_giai_dong/{qid}  (qid = examId + '_q' + index, giống mọi chế độ khác):
 *   { qid, examId, index, examTitle, script, status: 'draft' | 'published', source: 'ai' | 'teacher',
 *     audio: { voice, n, at } | null, createdAt, updatedAt }
 *   Giọng đã tạo: loi_giai_dong/{qid}/audio/s<chỉ số> = { b64 (MP3), mime, dur, text, source }  (giống video_lessons)
 *
 * CÚ PHÁP KỊCH BẢN — giống bài giảng FaradayAI, thêm 3 thẻ:
 *   # Tiêu đề cảnh                 (mỗi cảnh = 1 chặng trên thanh tiến trình: Đọc đề · Định luật · Giải · Bẫy · Mẹo nhớ)
 *   - Ý  ·  $$ công thức $$  ·  ! Lưu ý  ·  [svg: <svg…>]  ·  [ảnh: url]  ·  > lời giảng cho dòng ngay trên
 *   [hl: cụm 1 | cụm 2]            tô sáng các cụm đó trong ĐỀ BÀI (chép y nguyên chữ trong đề) từ cảnh này trở đi
 *   ? Câu hỏi cho em | Gợi ý: …    video TỰ DỪNG, em bấm "Em làm xong, xem tiếp" mới chạy tiếp (Gợi ý không bắt buộc)
 *   [bẫy B]                        bắt đầu đoạn riêng cho phương án nhiễu B (Đúng/Sai: [bẫy a]…). Em chọn B →
 *                                  hiện thẻ "Em đã chọn B · xem vì sao B sai" nhảy thẳng tới đoạn đó.
 *   [3d: …]                        (giai đoạn 3 — hiện tại bỏ qua)
 *
 * Xuất: window.OPC_LGD = { parse, says, estimateSec, Player, open, init, register, forQuestion, button, qidOf, toPlayerQuestion }
 */
(function(window){
  'use strict';
  var React = window.React, ReactDOM = window.ReactDOM;
  if(!React) return;
  function FX(){ return window.OPC_FX || {}; }

  // ------------------------------------------------------------ tiện ích
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mathHtml(tex, display){
    try{ if(window.katex) return window.katex.renderToString(tex, { displayMode: !!display, throwOnError: false }); }catch(e){}
    return '<code>' + esc(tex) + '</code>';
  }
  // bỏ bớt lệnh LaTeX trình bày trong đề (\textbf, \\ …) để hiện như chữ thường; công thức $…$ giữ nguyên
  function cleanTex(s){
    return String(s || '')
      .replace(/\\(?:textbf|textit|emph|underline)\{([^{}]*)\}/g, '**$1**')
      .replace(/\\(?:text|mathrm)\{([^{}]*)\}(?![^$]*\$)/g, '$1')
      .replace(/\\\\/g, '\n').replace(/~/g, ' ').replace(/\\%/g, '%')
      .replace(/\\(?:vspace|hspace)\*?\{[^}]*\}/g, '');
  }
  function rich(text){
    var f = FX().richHtml;
    return f ? f(text) : esc(text);
  }
  function normSay(t){ return String(t || '').replace(/\s+/g, ' ').trim(); }
  // LaTeX → lời đọc gần đúng (khi dòng có công thức nhỏ mà thầy/AI không viết lời giảng riêng)
  function speakable(text){
    return String(text || '')
      .replace(/\$([^$]+)\$/g, function(_, t){
        return ' ' + t.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1 trên $2').replace(/\\Delta\s*/g, 'đen ta ').replace(/\\alpha/g, 'an pha')
          .replace(/\\cdot|\\times/g, ' nhân ').replace(/\^\{?2\}?/g, ' bình phương').replace(/\^\{?3\}?/g, ' lập phương').replace(/\^\{?(-?\d+)\}?/g, ' mũ $1')
          .replace(/_\{?([^}\s]+)\}?/g, ' $1').replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}]/g, '').replace(/=/g, ' bằng ') + ' ';
      })
      .replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  }
  function fmtTime(s){ s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function qidOf(q){
    if(!q) return '';
    if(q.id && /_q\d+$/.test(String(q.id))) return String(q.id);
    if(q.examId && q.index != null) return q.examId + '_q' + q.index;
    return '';
  }
  function indexOfQid(qid){ var m = String(qid || '').match(/_q(\d+)$/); return m ? Number(m[1]) : null; }

  // ------------------------------------------------------------ kịch bản → cảnh + bước
  function parse(script){
    var scenes = [], cur = null;
    function scene(title){ cur = { title: title, items: [], say: '', hl: [] }; scenes.push(cur); }
    String(script || '').split(/\r?\n/).forEach(function(raw){
      var line = raw.trim(); if(!line) return;
      if(/^#\s*/.test(line)){ scene(line.replace(/^#\s*/, '')); return; }
      if(!cur) scene('');
      if(/^>\s*/.test(line)){
        var say = line.replace(/^>\s*/, '');
        var last = cur.items[cur.items.length - 1];
        if(last) last.say = (last.say ? last.say + ' ' : '') + say; else cur.say = (cur.say ? cur.say + ' ' : '') + say;
        return;
      }
      var m;
      if((m = line.match(/^\[(?:hl|tô sáng|to sang)\s*:\s*([^\]]+)\]$/i))){
        m[1].split('|').forEach(function(p){ p = p.trim(); if(p) cur.hl.push(p); });
        return;
      }
      if(/^\[3d\s*:/i.test(line)) return; // giai đoạn 3
      if((m = line.match(/^\[(?:bẫy|bay|trap)\s*([A-Da-d])?\s*\]$/i))){ cur.items.push({ t: 'trap', key: m[1] ? m[1] : '' }); return; }
      if((m = line.match(/^\$\$([\s\S]*)\$\$$/))) cur.items.push({ t: 'math', v: m[1].trim() });
      else if(/^[-•*]\s+/.test(line)) cur.items.push({ t: 'li', v: line.replace(/^[-•*]\s+/, '') });
      else if(/^!\s*/.test(line)) cur.items.push({ t: 'note', v: line.replace(/^!\s*/, '') });
      else if(/^\?\s*/.test(line)){
        var body = line.replace(/^\?\s*/, ''), parts = body.split(/\s*\|\s*gợi ý\s*:\s*/i);
        cur.items.push({ t: 'ask', v: parts[0], hint: parts[1] || '' });
      }
      else if((m = line.match(/^\[(?:svg|hình|hinh|sơ đồ|so do)\s*:\s*(<svg[\s\S]*<\/svg>)\s*\]$/i))) cur.items.push({ t: 'svg', v: m[1].trim() });
      else if((m = line.match(/^\[(?:ảnh|anh|img|image)\s*:\s*([^\]]+)\]$/i))) cur.items.push({ t: 'img', v: m[1].trim() });
      else cur.items.push({ t: 'p', v: line });
    });
    // bước: mỗi cảnh = 1 bước tiêu đề + mỗi mục 1 bước. Chỉ số bước trong trình phát: 0 = thẻ mở đầu, 1..n = bước, n+1 = kết.
    var steps = [], traps = {}, sceneStart = [];
    scenes.forEach(function(sc, si){
      sceneStart.push(steps.length + 1);
      steps.push({ scene: si, upto: 0, say: sc.say || (sc.title ? sc.title + '.' : '') });
      sc.items.forEach(function(it, ii){
        var visual = it.t === 'math' || it.t === 'img' || it.t === 'svg';
        var say = it.say || (visual ? '' : (it.t === 'trap' ? '' : speakable(it.v)));
        var st = { scene: si, upto: ii + 1, say: say, pause: visual ? 3000 : (it.t === 'trap' ? 500 : 0), wait: it.t === 'ask' };
        steps.push(st);
        if(it.t === 'trap'){ var k = (it.key || '*'); if(traps[k] == null) traps[k] = steps.length; }
      });
    });
    return { scenes: scenes, steps: steps, traps: traps, sceneStart: sceneStart };
  }
  function introSay(rec){ return 'Lời giải câu ' + (rec && rec.index != null ? rec.index : '') + '.'; }
  // lời đọc theo thứ tự phát: [0] = thẻ mở đầu, [1..n] = từng bước (dùng chung khi TẠO giọng và khi PHÁT)
  function says(rec){ var p = parse(rec && rec.script); return [introSay(rec)].concat(p.steps.map(function(x){ return x.say || ''; })); }
  function durMs(step, rate){
    var words = String(step.say || '').split(/\s+/).filter(Boolean).length;
    return Math.max(1500, words * 380 / (rate || 1)) + (step.pause || 0) + 350;
  }
  function estimateSec(script){
    var p = parse(script), ms = 0;
    p.steps.forEach(function(s){ ms += durMs(s, 1); });
    return Math.round(ms / 1000) + 3;
  }

  // ------------------------------------------------------------ giọng đọc
  var viVoice = null;
  function pickVoice(){
    try{
      var vs = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
      viVoice = vs.filter(function(v){ return /^vi/i.test(v.lang); }).sort(function(a, b){ return (/google|natural|online/i.test(b.name) ? 1 : 0) - (/google|natural|online/i.test(a.name) ? 1 : 0); })[0] || null;
    }catch(e){ viVoice = null; }
    return viVoice;
  }
  if(window.speechSynthesis){ pickVoice(); try{ window.speechSynthesis.addEventListener('voiceschanged', pickVoice); }catch(e){} }
  var audioLoader = null, audioCache = {};
  function loadAudio(rec){
    if(!rec || !rec.qid || !rec.audio || !audioLoader) return Promise.resolve({});
    var key = rec.qid + '|' + (rec.audio.at || '');
    if(!audioCache[key]) audioCache[key] = Promise.resolve(audioLoader(rec.qid)).catch(function(){ delete audioCache[key]; return {}; });
    return audioCache[key];
  }

  // ------------------------------------------------------------ đề bài có tô sáng
  var HL_A = '\u0001', HL_B = '\u0002';
  function stemHtml(text, phrases){
    var src = cleanTex(text);
    if(phrases && phrases.length){
      src = src.split(/(\$[^$]+\$)/g).map(function(part){
        if(/^\$[^$]+\$$/.test(part)) return part;
        phrases.forEach(function(p){
          if(!p) return;
          var i = part.indexOf(p);
          if(i > -1) part = part.slice(0, i) + HL_A + p + HL_B + part.slice(i + p.length);
        });
        return part;
      }).join('');
    }
    return rich(src).split(HL_A).join('<mark>').split(HL_B).join('</mark>').replace(/\n/g, '<br>');
  }
  // câu hỏi kiểu admin (de_thi: options[].isTrue, type) → kiểu trình phát (giống trang học sinh)
  function toPlayerQuestion(q, examId){
    if(!q) return null;
    var out = { id: (examId ? examId + '_q' + q.index : q.id), stem: q.stem || '', groupPassage: q.groupPassage || null, images: [] };
    if(q.type === 'choiceTF') out.statements = (q.options || []).map(function(o){ return { key: o.key, text: o.text, isTrue: !!o.isTrue }; });
    else if(q.type === 'shortans') out.correctAnswer = q.shortans;
    else {
      out.options = (q.options || []).map(function(o){ return { key: o.key, text: o.text }; });
      var c = (q.options || []).filter(function(o){ return o.isTrue; })[0];
      out.correctKey = c ? c.key : null;
    }
    return out;
  }
  // phương án em chọn sai có đoạn [bẫy] riêng → { key, step } (trắc nghiệm: 'B'; Đúng/Sai: phát biểu đầu tiên em sai)
  function wrongTrap(q, chosen, traps){
    if(!q || chosen == null) return null;
    if(q.options && typeof chosen === 'string'){
      if(chosen === q.correctKey) return null;
      var k = chosen.toUpperCase();
      var st = traps[k] != null ? traps[k] : traps[chosen.toLowerCase()];
      return st != null ? { key: k, step: st } : null;
    }
    if(q.statements && typeof chosen === 'object'){
      for(var i = 0; i < q.statements.length; i++){
        var s = q.statements[i], v = chosen[s.key];
        if(v == null || v === s.isTrue) continue;
        var st2 = traps[String(s.key).toLowerCase()] != null ? traps[String(s.key).toLowerCase()] : traps[String(s.key).toUpperCase()];
        if(st2 != null) return { key: String(s.key).toLowerCase(), step: st2, tf: v };
      }
    }
    return null;
  }

  // ------------------------------------------------------------ CSS (nền trắng ngà)
  var CSS = [
    '.lgd-ov{position:fixed;inset:0;z-index:4100;background:rgba(21,23,28,.55);display:flex;align-items:center;justify-content:center;padding:12px;}',
    '.lgd-box{width:min(1000px,100%);max-height:100%;background:#FAF8F3;color:#15171C;border-radius:18px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.35);font-family:"Be Vietnam Pro",system-ui,sans-serif;}',
    '.lgd-box.fs{width:100vw;height:100vh;height:100dvh;max-height:none;border-radius:0;}',
    '.lgd-head{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #E4DFD3;background:#FFFDF8;}',
    '.lgd-head img{width:30px;height:30px;flex-shrink:0;} .lgd-head .t{flex:1;min-width:0;} .lgd-head .t b{display:block;font-size:.98rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.lgd-head .t span{display:block;font-size:.76rem;color:#5E5A51;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.lgd-ib{min-width:44px;height:44px;padding:0 10px;border:1px solid #E4DFD3;background:#fff;border-radius:12px;cursor:pointer;font:inherit;font-weight:700;font-size:.9rem;color:#15171C;}',
    '.lgd-ib:hover{background:#F3EBDA;} .lgd-ib.dark{background:#15171C;color:#fff;border-color:#15171C;} .lgd-ib.on{background:#F3EBDA;border-color:#C9A24A;}',
    '.lgd-body{flex:1;min-height:0;overflow:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;}',
    '.lgd-trap{display:flex;align-items:center;gap:12px;background:#F3EBDA;border-radius:14px;padding:10px 12px;border:0;cursor:pointer;text-align:left;font:inherit;color:#15171C;width:100%;}',
    '.lgd-trap .k{width:38px;height:38px;border-radius:50%;background:#fff;color:#B42318;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
    '.lgd-trap small{display:block;color:#5E5A51;font-size:.76rem;} .lgd-trap b{display:block;color:#7A4E16;font-size:.92rem;}',
    '.lgd-q{background:#fff;border:1px solid #E4DFD3;border-radius:14px;padding:10px 12px;font-size:.92rem;line-height:1.55;}',
    '.lgd-q summary{cursor:pointer;font-weight:700;font-size:.76rem;color:#7A4E16;letter-spacing:.06em;text-transform:uppercase;list-style:none;}',
    '.lgd-q summary::-webkit-details-marker{display:none;} .lgd-q summary:after{content:" ▾";} .lgd-q[open] summary:after{content:" ▴";}',
    '.lgd-q mark{background:#F3E3B8;color:inherit;padding:0 3px;border-radius:4px;} .lgd-q .stem{margin-top:6px;}',
    '.lgd-q img{max-width:100%;max-height:220px;border-radius:8px;margin-top:6px;display:block;}',
    '.lgd-opts{display:grid;gap:6px;margin-top:8px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));}',
    '.lgd-opt{border:1px solid #E4DFD3;border-radius:10px;padding:6px 10px;} .lgd-opt.ok{border:2px solid #1F7A4D;background:#E8F4EC;} .lgd-opt.bad{border:2px solid #B42318;background:#FCE9E7;}',
    '.lgd-opt .tag{float:right;font-size:.72rem;font-weight:700;margin-left:6px;} .lgd-opt.ok .tag{color:#1F6B43;} .lgd-opt.bad .tag{color:#B42318;}',
    '.lgd-stage{position:relative;width:100%;height:min(56vw, calc(100vh - 430px));min-height:300px;background:#FFFDF8;border:1px solid #E4DFD3;border-radius:16px;overflow:hidden;cursor:pointer;flex-shrink:0;}',
    '@supports (height:100dvh){.lgd-stage{height:min(56vw, calc(100dvh - 430px));}}',
    '.lgd-box.fs .lgd-stage{height:auto;flex:1;min-height:320px;}',
    '.lgd-scene{position:absolute;inset:6% 6% 16% 6%;display:flex;flex-direction:column;gap:.5em;overflow:hidden;}',
    '.lgd-scene h2{font-family:"Noto Serif",Literata,Georgia,serif;font-weight:700;font-size:1.5em;margin:0 0 .3em;color:#15171C;}',
    '.lgd-scene h2:after{content:"";display:block;width:2.2em;height:.13em;background:#C9A24A;border-radius:9px;margin-top:.3em;}',
    '.lgd-it{opacity:0;transform:translateY(.5em);transition:opacity .45s,transform .45s;font-size:1.04em;line-height:1.45;color:#3D3A33;}',
    '.lgd-it.on{opacity:1;transform:none;} .lgd-it.cur{color:#15171C;}',
    '.lgd-li{padding-left:1.1em;position:relative;} .lgd-li:before{content:"";position:absolute;left:0;top:.6em;width:.42em;height:.42em;border-radius:50%;background:#C9A24A;}',
    '.lgd-math{text-align:center;font-size:1.3em;padding:.2em 0;color:#15171C;}',
    '.lgd-note{background:#F3EBDA;border-left:.22em solid #B07A1E;padding:.45em .7em;border-radius:.4em;}',
    '.lgd-ask{background:#EAF1FA;border-left:.22em solid #1F5FA8;padding:.45em .7em;border-radius:.4em;}',
    '.lgd-trapl{align-self:flex-start;background:#FCE9E7;color:#B42318;font-weight:700;border-radius:.45em;padding:.2em .7em;font-size:.92em;}',
    '.lgd-img{text-align:center;} .lgd-img img{max-height:9em;max-width:100%;border-radius:.4em;}',
    '.lgd-scene.has-svg{display:grid;grid-template-columns:1.1fr .95fr;column-gap:1.2em;row-gap:0;grid-auto-rows:min-content;align-content:start;}',
    '.lgd-scene.has-svg > h2{grid-column:1/-1;} .lgd-scene.has-svg > .lgd-it{grid-column:1;margin-bottom:.5em;}',
    '.lgd-scene.has-svg > .lgd-svg{grid-column:2;grid-row:2 / span 14;align-self:center;margin:0;padding:.4em;background:#FAF8F3;border:1px solid #EFE9DC;border-radius:.7em;}',
    '.lgd-svg svg{display:block;width:100%;height:auto;max-height:15em;}',
    '.lgd-cap{position:absolute;left:6%;right:6%;bottom:4%;text-align:center;font-size:.84em;line-height:1.4;background:#F3EBDA;color:#15171C;padding:.35em .7em;border-radius:.5em;}',
    '.lgd-wm{position:absolute;right:2.4%;top:3%;display:flex;align-items:center;gap:.3em;font-weight:800;font-size:.72em;color:#5E5A51;} .lgd-wm img{width:1.5em;height:1.5em;} .lgd-wm b{color:#7A4E16;}',
    '.lgd-title{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:.4em;padding:0 8%;}',
    '.lgd-title img{width:3.6em;height:3.6em;} .lgd-title .k{color:#7A4E16;font-weight:800;letter-spacing:.14em;font-size:.8em;}',
    '.lgd-title h1{font-family:"Noto Serif",Literata,Georgia,serif;font-size:2em;margin:.1em 0;color:#15171C;line-height:1.2;} .lgd-title .s{color:#5E5A51;font-size:.92em;}',
    '.lgd-title .acts{display:flex;gap:.5em;flex-wrap:wrap;justify-content:center;margin-top:.6em;font-size:14px;}',
    '.lgd-wait{position:absolute;inset:0;background:rgba(250,248,243,.93);display:flex;align-items:center;justify-content:center;padding:4%;cursor:default;}',
    '.lgd-wait .card{background:#fff;border:1px solid #E4DFD3;border-radius:16px;padding:16px;max-width:520px;width:100%;display:flex;flex-direction:column;gap:10px;font-size:15px;box-shadow:0 10px 30px rgba(21,23,28,.08);}',
    '.lgd-wait .hd{font-weight:800;color:#7A4E16;} .lgd-wait .q{line-height:1.5;} .lgd-wait .hint{background:#EAF1FA;border-radius:10px;padding:8px 10px;line-height:1.5;}',
    '.lgd-wait .row{display:flex;gap:8px;flex-wrap:wrap;} .lgd-wait .row .lgd-ib{flex:1 1 auto;}',
    '.lgd-chap{display:flex;gap:4px;} .lgd-chap button{flex:1;min-width:0;border:0;background:transparent;padding:4px 0 0;cursor:pointer;text-align:left;font:inherit;}',
    '.lgd-chap i{display:block;height:5px;border-radius:3px;background:#E4DFD3;overflow:hidden;} .lgd-chap i em{display:block;height:100%;background:#C9A24A;}',
    '.lgd-chap span{display:block;font-size:.7rem;color:#5E5A51;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;} .lgd-chap .cur span{color:#15171C;font-weight:700;}',
    '.lgd-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;border-top:1px solid #E4DFD3;background:#FFFDF8;}',
    '.lgd-bar .tm{font-size:.8rem;color:#5E5A51;font-variant-numeric:tabular-nums;margin-left:auto;}',
    '.lgd-bar .vc{font-size:.72rem;color:#7A4E16;font-weight:700;}',
    '.lgd-btn{display:inline-flex;align-items:center;gap:6px;}',
    '@media (max-width:640px){.lgd-ov{padding:0;} .lgd-box{border-radius:0;height:100%;} .lgd-stage{height:calc(100vh - 330px);min-height:320px;} .lgd-body{padding:10px;}',
    '  .lgd-scene.has-svg{display:flex;} .lgd-scene.has-svg > .lgd-svg{order:5;} .lgd-chap span{font-size:.62rem;}}'
  ].join('\n');
  function ensureCss(){ if(document.getElementById('lgd-css')) return; var s = document.createElement('style'); s.id = 'lgd-css'; s.textContent = CSS; document.head.appendChild(s); }

  // ------------------------------------------------------------ trình phát
  // props: rec (bản ghi lời giải), q (câu hỏi kiểu trình phát, có thể thiếu), chosen (đáp án em chọn), audioMap, onClose, onDone, startAt
  function Player(props){
    var h = React.createElement, rec = props.rec || {}, q = props.q || null;
    ensureCss();
    var parsed = React.useMemo(function(){ return parse(rec.script); }, [rec.qid, rec.script]);
    var steps = parsed.steps, total = steps.length + 2;
    var sayList = React.useMemo(function(){ return says(rec); }, [rec.qid, rec.script, rec.index]);
    var trap = React.useMemo(function(){ return wrongTrap(q, props.chosen, parsed.traps); }, [parsed, props.chosen]);
    var s1 = React.useState(props.startAt || 0); var idx = s1[0], setIdx = s1[1];
    var s2 = React.useState(true); var playing = s2[0], setPlaying = s2[1];
    var s3 = React.useState(false); var waiting = s3[0], setWaiting = s3[1];
    var s4 = React.useState(false); var showHint = s4[0], setShowHint = s4[1];
    var s5 = React.useState(function(){ try{ return Number(localStorage.getItem('lgd-rate')) || 1; }catch(e){ return 1; } }); var rate = s5[0], setRate = s5[1];
    var s6 = React.useState(false); var muted = s6[0], setMuted = s6[1];
    var s7 = React.useState(true); var caps = s7[0], setCaps = s7[1];
    var s8 = React.useState(false); var fs = s8[0], setFs = s8[1];
    var s9 = React.useState(16); var fontPx = s9[0], setFontPx = s9[1];
    var s10 = React.useState(props.audioMap || null); var audioMap = s10[0], setAudioMap = s10[1];
    var s11 = React.useState(false); var trapSeen = s11[0], setTrapSeen = s11[1];
    var boxRef = React.useRef(null), stageRef = React.useRef(null), audioRef = React.useRef(null), doneRef = React.useRef(false), passedRef = React.useRef({});

    React.useEffect(function(){
      if(props.audioMap){ setAudioMap(props.audioMap); return; }
      if(!rec.audio){ setAudioMap({}); return; }
      var done = false, t = setTimeout(function(){ if(!done){ done = true; setAudioMap({}); } }, 8000);
      loadAudio(rec).then(function(m){ if(!done){ done = true; clearTimeout(t); setAudioMap(m || {}); } });
      return function(){ done = true; clearTimeout(t); };
    }, [rec.qid]);
    function clipFor(i){ var c = audioMap && audioMap[i]; return (c && c.b64 && normSay(c.text) === normSay(sayList[i])) ? c : null; }
    // cỡ chữ theo bề rộng khung (giống video co giãn)
    React.useEffect(function(){
      function fit(){ var el = stageRef.current; if(el) setFontPx(Math.max(12, el.clientWidth / 42)); }
      fit(); var ro = window.ResizeObserver ? new ResizeObserver(fit) : null; if(ro && stageRef.current) ro.observe(stageRef.current);
      window.addEventListener('resize', fit);
      return function(){ if(ro) ro.disconnect(); window.removeEventListener('resize', fit); };
    }, [fs]);
    // phát: đọc lời của bước hiện tại rồi tự sang bước sau; bước "?" thì dừng chờ em
    React.useEffect(function(){
      if(!playing || waiting || audioMap === null) return;
      if(idx >= total - 1){ setPlaying(false); return; }
      var cancelled = false, timer = 0, synth = window.speechSynthesis;
      var step = idx === 0 ? { say: sayList[0], pause: 500 } : steps[idx - 1];
      function next(){
        if(cancelled) return;
        if(step && step.wait && !passedRef.current[idx]){ setWaiting(true); setShowHint(false); return; }
        setIdx(function(i){ return i + 1 < total ? i + 1 : i; });
      }
      var say = step && step.say, clip = clipFor(idx);
      if(clip && !muted){
        try{
          var a = audioRef.current || (audioRef.current = new Audio());
          a.pause(); a.src = 'data:' + (clip.mime || 'audio/mpeg') + ';base64,' + clip.b64; a.playbackRate = rate;
          var fin = false;
          a.onended = function(){ if(fin) return; fin = true; timer = setTimeout(next, 300 + (step.pause ? Math.min(step.pause, 1500) : 0)); };
          a.onerror = function(){ if(fin) return; fin = true; timer = setTimeout(next, durMs(step, rate)); };
          var pr = a.play(); if(pr && pr.catch) pr.catch(function(){ if(!fin){ fin = true; setPlaying(false); } });
          timer = setTimeout(function(){ if(!fin){ fin = true; next(); } }, ((clip.dur || 8) / rate) * 1000 + 6000);
        }catch(e){ timer = setTimeout(next, durMs(step, rate)); }
        return function(){ cancelled = true; clearTimeout(timer); try{ audioRef.current && audioRef.current.pause(); }catch(e){} };
      }
      if(!muted && synth && say && (viVoice || pickVoice())){
        try{
          synth.cancel();
          var u = new SpeechSynthesisUtterance(say); u.lang = 'vi-VN'; if(viVoice) u.voice = viVoice; u.rate = rate;
          var fired = false;
          u.onend = function(){ if(fired) return; fired = true; timer = setTimeout(next, 350 + (step.pause || 0)); };
          u.onerror = function(){ if(fired) return; fired = true; timer = setTimeout(next, durMs(step, rate)); };
          synth.speak(u);
          timer = setTimeout(function(){ if(!fired){ fired = true; next(); } }, durMs(step, rate) * 2.2 + 4000);
        }catch(e){ timer = setTimeout(next, durMs(step, rate)); }
      } else timer = setTimeout(next, durMs(step || {}, rate));
      return function(){ cancelled = true; clearTimeout(timer); try{ if(synth) synth.cancel(); }catch(e){} };
    }, [idx, playing, waiting, muted, rate, audioMap]);
    React.useEffect(function(){ return function(){ try{ window.speechSynthesis && window.speechSynthesis.cancel(); }catch(e){} try{ audioRef.current && audioRef.current.pause(); }catch(e){} }; }, []);
    React.useEffect(function(){
      if(idx >= total - 1 && !doneRef.current){ doneRef.current = true; if(props.onDone) props.onDone(rec); }
      if(trap && idx >= trap.step) setTrapSeen(true);
    }, [idx]);
    function go(i){ i = Math.max(0, Math.min(total - 1, i)); setWaiting(false); setIdx(i); }
    function resume(){ passedRef.current[idx] = true; setWaiting(false); setIdx(function(i){ return Math.min(total - 1, i + 1); }); setPlaying(true); }
    React.useEffect(function(){
      function onKey(e){
        var tg = e.target && e.target.tagName;
        if(tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return;
        if(e.key === 'Escape'){ if(fs) setFs(false); else props.onClose(); }
        else if(e.key === ' '){ e.preventDefault(); if(waiting) resume(); else setPlaying(function(p){ return !p; }); }
        else if(e.key === 'ArrowRight'){ if(waiting) resume(); else go(idx + 1); }
        else if(e.key === 'ArrowLeft') go(idx - 1);
      }
      window.addEventListener('keydown', onKey); return function(){ window.removeEventListener('keydown', onKey); };
    }, [fs, idx, waiting, total]);
    function toggleFs(){
      var el = boxRef.current, iOS = /iP(ad|hone|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if(!fs){ setFs(true); if(!iOS && el && el.requestFullscreen) el.requestFullscreen().catch(function(){}); }
      else { setFs(false); if(document.fullscreenElement) document.exitFullscreen().catch(function(){}); }
    }
    React.useEffect(function(){ function onCh(){ if(!document.fullscreenElement) setFs(false); } document.addEventListener('fullscreenchange', onCh); return function(){ document.removeEventListener('fullscreenchange', onCh); }; }, []);

    var isTitle = idx === 0, isEnd = idx >= total - 1, stp = (!isTitle && !isEnd) ? steps[idx - 1] : null;
    var curScene = stp ? stp.scene : (isEnd ? parsed.scenes.length - 1 : -1);
    // tô sáng: gom [hl] của các cảnh đã tới
    var hl = [];
    parsed.scenes.forEach(function(sc, si){ if(si <= curScene) hl = hl.concat(sc.hl); });
    var logo = h('img', { src: '/logo-mark.svg', alt: '' });
    var head = h('div', { className: 'lgd-head' }, logo,
      h('div', { className: 't' }, h('b', null, 'Câu ' + (rec.index != null ? rec.index : '') + ' · Lời giải động'), h('span', null, rec.examTitle || 'FaradayAI')),
      h('button', { type: 'button', className: 'lgd-ib', onClick: toggleFs, 'aria-label': fs ? 'Thu nhỏ' : 'Toàn màn hình' }, fs ? '🗗' : '⛶'),
      h('button', { type: 'button', className: 'lgd-ib', onClick: props.onClose, 'aria-label': 'Đóng' }, '✕'));

    var trapBtn = (trap && !isEnd) ? h('button', { type: 'button', className: 'lgd-trap', onClick: function(){ go(trap.step); setPlaying(true); } },
      h('span', { className: 'k' }, trap.key),
      h('span', { style: { flex: 1, minWidth: 0 } },
        h('small', null, q && q.statements ? ('Em chọn "' + (trap.tf ? 'Đúng' : 'Sai') + '" ở ý ' + trap.key) : ('Em đã chọn ' + trap.key)),
        h('b', null, trapSeen ? 'Xem lại: vì sao ' + (q && q.statements ? 'ý ' + trap.key : trap.key) + ' chưa đúng' : 'Xem ngay: vì sao ' + (q && q.statements ? 'ý ' + trap.key : trap.key) + ' chưa đúng')),
      h('span', { 'aria-hidden': 'true', style: { color: '#7A4E16', fontWeight: 800 } }, '›')) : null;

    var qCard = null, narrow = (window.innerWidth || 1000) <= 640;
    if(q && (q.stem || q.groupPassage)){
      var optRows = null;
      if(q.options && q.options.length){
        optRows = h('div', { className: 'lgd-opts' }, q.options.map(function(o){
          var ok = o.key === q.correctKey, bad = !ok && props.chosen === o.key;
          return h('div', { key: o.key, className: 'lgd-opt' + (ok ? ' ok' : (bad ? ' bad' : '')) },
            ok ? h('span', { className: 'tag' }, 'Đáp án') : (bad ? h('span', { className: 'tag' }, 'Em chọn') : null),
            h('b', null, o.key + '. '), h('span', { dangerouslySetInnerHTML: { __html: stemHtml(o.text, []) } }));
        }));
      } else if(q.statements && q.statements.length){
        optRows = h('div', { className: 'lgd-opts', style: { gridTemplateColumns: '1fr' } }, q.statements.map(function(s){
          var ch = props.chosen && typeof props.chosen === 'object' ? props.chosen[s.key] : null;
          var bad = ch != null && ch !== s.isTrue;
          return h('div', { key: s.key, className: 'lgd-opt' + (bad ? ' bad' : ' ok') },
            h('span', { className: 'tag' }, (s.isTrue ? 'Đúng' : 'Sai') + (bad ? ' · em chọn ' + (ch ? 'Đúng' : 'Sai') : '')),
            h('b', null, s.key + ') '), h('span', { dangerouslySetInnerHTML: { __html: stemHtml(s.text, []) } }));
        }));
      } else if(q.correctAnswer != null){
        optRows = h('div', { className: 'lgd-opts' }, h('div', { className: 'lgd-opt ok' }, h('span', { className: 'tag' }, 'Đáp số'), String(q.correctAnswer)));
      }
      var img = q.images && q.images[0] && q.images[0].url ? h('img', { src: q.images[0].url, alt: 'Hình của đề' }) : null;
      qCard = h('details', { className: 'lgd-q', open: !narrow },
        h('summary', null, narrow ? 'Đề bài (bấm để xem)' : 'Đề bài'),
        q.groupPassage ? h('div', { className: 'stem', style: { color: '#5E5A51' }, dangerouslySetInnerHTML: { __html: stemHtml(q.groupPassage, hl) } }) : null,
        h('div', { className: 'stem', dangerouslySetInnerHTML: { __html: stemHtml(q.stem, hl) } }), img, optRows);
    }

    var stage;
    if(isTitle) stage = h('div', { className: 'lgd-title' }, h('img', { src: '/logo-mark.svg', alt: '' }), h('div', { className: 'k' }, 'FARADAYAI · LỜI GIẢI ĐỘNG'),
      h('h1', null, 'Câu ' + (rec.index != null ? rec.index : '')), h('div', { className: 's' }, rec.examTitle || ''));
    else if(isEnd) stage = h('div', { className: 'lgd-title', onClick: function(e){ e.stopPropagation(); } },
      h('div', { className: 'k' }, 'HẾT LỜI GIẢI'), h('h1', null, 'Giờ em làm lại câu này nhé!'),
      h('div', { className: 'acts' },
        h('button', { type: 'button', className: 'lgd-ib dark', onClick: function(){ go(1); setPlaying(true); } }, '↺ Xem lại'),
        trap ? h('button', { type: 'button', className: 'lgd-ib', onClick: function(){ go(trap.step); setPlaying(true); } }, 'Vì sao ' + trap.key + ' chưa đúng') : null,
        h('button', { type: 'button', className: 'lgd-ib', onClick: props.onClose }, 'Đóng')));
    else {
      var sc = parsed.scenes[stp.scene], upto = stp.upto;
      stage = h('div', { className: 'lgd-scene' + (sc.items.some(function(x){ return x.t === 'svg'; }) ? ' has-svg' : '') },
        sc.title ? h('h2', null, sc.title) : null,
        sc.items.map(function(it, i){
          var cls = 'lgd-it ' + (i < upto ? 'on' : '') + (i === upto - 1 ? ' cur' : '');
          if(it.t === 'svg') return i < upto
            ? h('div', { key: i, className: cls + ' lgd-svg', dangerouslySetInnerHTML: { __html: (FX().sanitizeSvg ? FX().sanitizeSvg(it.v) : '') } })
            : h('div', { key: i, className: 'lgd-it lgd-svg', style: { visibility: 'hidden', padding: 0, border: 0 } });
          if(it.t === 'math') return h('div', { key: i, className: cls + ' lgd-math', dangerouslySetInnerHTML: { __html: mathHtml(it.v, true) } });
          if(it.t === 'img') return h('div', { key: i, className: cls + ' lgd-img' }, h('img', { src: it.v, alt: '' }));
          if(it.t === 'trap') return h('div', { key: i, className: cls + ' lgd-trapl' }, it.key ? ('Nếu em chọn ' + it.key) : 'Lỗi hay gặp');
          if(it.t === 'ask') return h('div', { key: i, className: cls + ' lgd-ask', dangerouslySetInnerHTML: { __html: '🤔 ' + rich(it.v) } });
          return h('div', { key: i, className: cls + ' lgd-' + it.t, dangerouslySetInnerHTML: { __html: (it.t === 'note' ? '💡 ' : '') + rich(it.v) } });
        }));
    }
    var askItem = (waiting && stp) ? parsed.scenes[stp.scene].items[stp.upto - 1] : null;
    var waitCard = askItem ? h('div', { className: 'lgd-wait', onClick: function(e){ e.stopPropagation(); } },
      h('div', { className: 'card' },
        h('div', { className: 'hd' }, '⏸ Dừng lại: em thử trước nhé'),
        h('div', { className: 'q', dangerouslySetInnerHTML: { __html: rich(askItem.v) } }),
        (showHint && askItem.hint) ? h('div', { className: 'hint', dangerouslySetInnerHTML: { __html: '💡 ' + rich(askItem.hint) } }) : null,
        h('div', { className: 'row' },
          h('button', { type: 'button', className: 'lgd-ib dark', onClick: resume, autoFocus: true }, 'Em làm xong, xem tiếp'),
          askItem.hint && !showHint ? h('button', { type: 'button', className: 'lgd-ib', onClick: function(){ setShowHint(true); } }, 'Gợi ý') : null))) : null;
    var curSay = (!isTitle && !isEnd && stp) ? stp.say : '';
    var stageEl = h('div', { className: 'lgd-stage', ref: stageRef, style: { fontSize: fontPx + 'px' }, onClick: function(){ if(!waiting && !isEnd) setPlaying(!playing); } },
      stage,
      (caps && curSay && !waiting) ? h('div', { className: 'lgd-cap' }, curSay) : null,
      h('div', { className: 'lgd-wm' }, h('img', { src: '/logo-mark.svg', alt: '' }), h('span', null, 'Faraday', h('b', null, 'AI'))),
      waitCard);

    // thanh chặng: mỗi cảnh 1 đoạn, dài theo số bước
    var chap = h('div', { className: 'lgd-chap' }, parsed.scenes.map(function(sc, si){
      var a = parsed.sceneStart[si], b = (si + 1 < parsed.sceneStart.length ? parsed.sceneStart[si + 1] : total - 1);
      var n = Math.max(1, b - a), pct = idx >= b ? 100 : (idx < a ? 0 : Math.round((idx - a + 1) / n * 100));
      return h('button', { key: si, type: 'button', className: si === curScene ? 'cur' : '', style: { flexGrow: n }, onClick: function(){ go(a); setPlaying(true); }, 'aria-label': 'Tới chặng ' + (sc.title || (si + 1)) },
        h('i', null, h('em', { style: { width: pct + '%' } })), h('span', null, sc.title || ('Phần ' + (si + 1))));
    }));

    var tSec = 0, curSec = 0, nClip = 0;
    steps.forEach(function(s, i){ var c = clipFor(i + 1); var d = c ? (c.dur / rate + 0.3 + (s.pause ? Math.min(s.pause, 1500) / 1000 : 0)) : durMs(s, rate) / 1000; tSec += d; if(i < idx - 1) curSec += d; if(c) nClip++; });
    var bar = h('div', { className: 'lgd-bar' },
      h('button', { type: 'button', className: 'lgd-ib', onClick: function(){ go(idx - 1); }, 'aria-label': 'Bước trước' }, '⏮'),
      h('button', { type: 'button', className: 'lgd-ib dark', onClick: function(){ if(isEnd){ go(1); setPlaying(true); } else if(waiting) resume(); else setPlaying(!playing); } }, isEnd ? '↺ Xem lại' : (waiting ? '▶ Xem tiếp' : (playing ? '⏸ Dừng' : '▶ Phát'))),
      h('button', { type: 'button', className: 'lgd-ib', onClick: function(){ if(waiting) resume(); else go(idx + 1); }, 'aria-label': 'Bước sau' }, '⏭'),
      h('button', { type: 'button', className: 'lgd-ib', onClick: function(){ var r = rate >= 1.5 ? 1 : (rate >= 1.25 ? 1.5 : 1.25); setRate(r); try{ localStorage.setItem('lgd-rate', r); }catch(e){} }, 'aria-label': 'Tốc độ' }, String(rate).replace('.', ',') + '×'),
      h('button', { type: 'button', className: 'lgd-ib' + (caps ? ' on' : ''), onClick: function(){ setCaps(!caps); }, 'aria-label': 'Phụ đề' }, 'CC'),
      h('button', { type: 'button', className: 'lgd-ib', onClick: function(){ setMuted(!muted); }, 'aria-label': muted ? 'Bật tiếng' : 'Tắt tiếng' }, muted ? '🔇' : '🔊'),
      audioMap === null ? h('span', { className: 'vc', style: { color: '#5E5A51' } }, 'Đang tải giọng…') : (nClip ? h('span', { className: 'vc' }, '🎙 Giọng FaradayAI') : null),
      h('span', { className: 'tm' }, fmtTime(curSec) + ' / ' + fmtTime(tSec)));

    return h('div', { className: 'lgd-ov', onClick: function(e){ if(e.target === e.currentTarget && !fs) props.onClose(); } },
      h('div', { className: 'lgd-box' + (fs ? ' fs' : ''), ref: boxRef, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Lời giải động câu ' + (rec.index || '') },
        head,
        h('div', { className: 'lgd-body' }, trapBtn, fs ? null : qCard, stageEl, chap),
        bar));
  }

  // mở trình phát ở bất cứ đâu
  var hostEl = null;
  function open(rec, opts){
    if(!ReactDOM || !rec) return;
    opts = opts || {};
    if(!hostEl){ hostEl = document.createElement('div'); hostEl.id = 'lgd-host'; document.body.appendChild(hostEl); }
    function close(){ try{ ReactDOM.unmountComponentAtNode(hostEl); }catch(e){} if(opts.onClose) opts.onClose(); }
    ReactDOM.render(React.createElement(Player, { key: rec.qid + ':' + Date.now(), rec: rec, q: opts.q || null, chosen: opts.chosen, audioMap: opts.audioMap || null, startAt: opts.startAt || 0, onClose: close,
      onDone: function(r){ if(tracker && !opts.preview) try{ tracker(r, true); }catch(e){} if(opts.onDone) opts.onDone(r); } }), hostEl);
    if(tracker && !opts.preview) try{ tracker(rec, false); }catch(e){}
  }

  // ------------------------------------------------------------ bảng tra phía học sinh
  var registry = {}, tracker = null, listeners = [];
  function register(list){
    registry = {};
    (list || []).forEach(function(r){ if(r && r.qid && r.status === 'published' && r.script) registry[r.qid] = r; });
    listeners.forEach(function(f){ try{ f(registry); }catch(e){} });
  }
  function onChange(f){ listeners.push(f); return function(){ listeners = listeners.filter(function(x){ return x !== f; }); }; }
  // o = { load(): Promise<[rec]>, loadAudio(qid): Promise<map>, track(rec, done) }
  function init(o){
    o = o || {};
    if(o.loadAudio){ audioLoader = o.loadAudio; audioCache = {}; }
    tracker = o.track || null;
    if(o.load) return Promise.resolve(o.load()).then(function(list){ register(list || []); return list; }).catch(function(){ return []; });
    return Promise.resolve([]);
  }
  function forQuestion(q){ var id = qidOf(q); return id ? (registry[id] || null) : null; }
  // nút dưới câu hỏi (prepscholar-ui gọi: OPC_LGD.button(h, q, { wrong, chosen }))
  function button(h, q, o){
    var rec = forQuestion(q); if(!rec) return null;
    o = o || {};
    if(rec.index == null) rec.index = indexOfQid(rec.qid);
    var label = '✨ Lời giải động · ' + fmtTime(estimateSec(rec.script));
    return h('div', { style: { margin: '0 0 8px' } },
      h('button', { type: 'button', className: 'btn ' + (o.wrong ? 'btn-primary' : 'btn-secondary') + ' lgd-btn', style: { fontSize: '0.86rem' },
        onClick: function(){ open(rec, { q: q && q.stem ? q : null, chosen: o.chosen }); } }, label));
  }

  window.OPC_LGD = {
    parse: parse, says: says, estimateSec: estimateSec, fmtTime: fmtTime, normSay: normSay,
    Player: Player, open: open, init: init, register: register, onChange: onChange, forQuestion: forQuestion, button: button,
    qidOf: qidOf, toPlayerQuestion: toPlayerQuestion, clearAudioCache: function(){ audioCache = {}; },
    setAudioLoader: function(f){ audioLoader = f; audioCache = {}; }
  };
})(window);
