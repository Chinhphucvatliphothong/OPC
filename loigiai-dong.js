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
 *   [3d: tên | xoay | T=400 | ghi chú]  mô hình 3D xoay được (mohinh3d.js: binh-khi, hat-nhan, nam-cham, day-dan, khung-day)
 *
 * BẢN THẦY GHI (THÊM 4/11/2026 · loigiai-dong-admin.js › Thầy chiếu): rec.teacher = { mime, dur, n, at, ar } —
 *   giọng thầy chia n mẩu base64 ở audio/stp0…stp<n-1> (khoá 'tp0'…), nét bút + cảnh ở audio/stk (khoá 'tk', { ink: JSON }).
 *
 * Xuất: window.OPC_LGD = { parse, says, estimateSec, Player, TeacherPlayer, Board, drawInk, icon, open, init, register, forQuestion, button, qidOf, toPlayerQuestion }
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
      if((m = line.match(/^\[(?:bẫy|bay|trap)\s*([A-Da-d])?\s*\]$/i))){ cur.items.push({ t: 'trap', key: m[1] ? m[1] : '' }); return; }
      if((m = line.match(/^\$\$([\s\S]*)\$\$$/))) cur.items.push({ t: 'math', v: m[1].trim() });
      else if(/^[-•*]\s+/.test(line)) cur.items.push({ t: 'li', v: line.replace(/^[-•*]\s+/, '') });
      else if(/^!\s*/.test(line)) cur.items.push({ t: 'note', v: line.replace(/^!\s*/, '') });
      else if(/^\?\s*/.test(line)){
        var body = line.replace(/^\?\s*/, ''), parts = body.split(/\s*\|\s*gợi ý\s*:\s*/i);
        cur.items.push({ t: 'ask', v: parts[0], hint: parts[1] || '' });
      }
      else if((m = line.match(/^\[(?:svg|hình|hinh|sơ đồ|so do)\s*:\s*(<svg[\s\S]*<\/svg>)\s*\]$/i))) cur.items.push({ t: 'svg', v: m[1].trim() });
      else if((m = line.match(/^\[3d\s*:\s*([^\]]+)\]$/i))) cur.items.push({ t: '3d', v: m[1].trim() });
      else if((m = line.match(/^\[(?:ảnh|anh|img|image)\s*:\s*([^\]]+)\]$/i))) cur.items.push({ t: 'img', v: m[1].trim() });
      else cur.items.push({ t: 'p', v: line });
    });
    // bước: mỗi cảnh = 1 bước tiêu đề + mỗi mục 1 bước. Chỉ số bước trong trình phát: 0 = thẻ mở đầu, 1..n = bước, n+1 = kết.
    var steps = [], traps = {}, sceneStart = [];
    scenes.forEach(function(sc, si){
      sceneStart.push(steps.length + 1);
      steps.push({ scene: si, upto: 0, say: sc.say || (sc.title ? sc.title + '.' : '') });
      sc.items.forEach(function(it, ii){
        var visual = it.t === 'math' || it.t === 'img' || it.t === 'svg' || it.t === '3d';
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
    if(!rec || !rec.qid || !(rec.audio || rec.teacher) || !audioLoader) return Promise.resolve({});
    var key = rec.qid + '|' + (rec.audio ? rec.audio.at || '' : '') + '|' + (rec.teacher ? rec.teacher.at || '' : '');
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
  // SỬA 4/11/2026 — theo thiết kế "Lời giải động" (canvas): đầu trang kiểu điện thoại (quay lại · tiêu đề giữa · tốc độ),
  // thẻ lời giải chứa đề tô sáng + khung hình + phụ đề + thanh 5 chặng, nút tròn, thẻ "Dừng lại: em thử trước nhé" nằm dưới,
  // thẻ "Em đã chọn B · Xem n giây: vì sao B sai" cuối cùng. Thêm bảng (Board) + nét bút dùng chung cho "Thầy giảng".
  var SERIF = '"Noto Serif",Literata,Georgia,serif';
  var CSS = [
    '.lgd-ov{position:fixed;inset:0;z-index:4100;background:rgba(21,23,28,.55);display:flex;align-items:center;justify-content:center;padding:12px;}',
    '.lgd-box{width:min(1000px,100%);max-height:100%;background:#FAF8F3;color:#15171C;border-radius:20px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.35);font-family:"Be Vietnam Pro",system-ui,sans-serif;}',
    '.lgd-box.fs{width:100vw;height:100vh;height:100dvh;max-height:none;border-radius:0;}',
    '.lgd-box button:focus-visible,.lgd-box a:focus-visible,.lgd-box input:focus-visible{outline:2px solid #7A4E16;outline-offset:2px;}',
    '.lgd-head{display:grid;grid-template-columns:minmax(44px,auto) minmax(0,1fr) minmax(44px,auto);align-items:center;gap:10px;padding:12px 16px 6px;min-height:48px;}',
    '.lgd-head .t{display:flex;flex-direction:column;align-items:center;text-align:center;min-width:0;}',
    '.lgd-head .t small{font-size:12px;color:#5E5A51;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.lgd-head .t b{font-size:16px;font-weight:700;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.lgd-head .r{display:flex;gap:6px;justify-content:flex-end;}',
    '.lgd-ib{min-width:44px;height:44px;padding:0 12px;border:1px solid #E4DFD3;background:#fff;border-radius:12px;cursor:pointer;font:inherit;font-weight:600;font-size:14px;color:#15171C;display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;}',
    '.lgd-ib:hover{background:#F3EBDA;} .lgd-ib.dark{background:#15171C;color:#fff;border-color:#15171C;} .lgd-ib.dark:hover{background:#2A2C31;} .lgd-ib.on{background:#F3EBDA;border-color:#C9A24A;} .lgd-ib.sq{padding:0;width:44px;}',
    '.lgd-body{flex:1;min-height:0;overflow:auto;padding:4px 16px 16px;display:flex;flex-direction:column;gap:10px;}',
    '.lgd-card{background:#FFFDF8;border:1px solid #E4DFD3;border-radius:20px;padding:16px;display:flex;flex-direction:column;gap:12px;flex-shrink:0;}',
    '.lgd-row{display:flex;align-items:center;justify-content:space-between;gap:8px;}',
    '.lgd-kick{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7A4E16;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.lgd-tm{font-size:12px;color:#5E5A51;font-variant-numeric:tabular-nums;white-space:nowrap;}',
    '.lgd-q{font-size:14px;line-height:1.55;color:#3D3A33;} .lgd-q mark{background:#F3E3B8;color:#15171C;padding:1px 4px;border-radius:4px;}',
    '.lgd-q .clip{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}',
    '.lgd-q .more{border:0;background:none;color:#7A4E16;font:inherit;font-weight:600;font-size:13px;padding:0;min-height:32px;cursor:pointer;}',
    '.lgd-q img{max-width:100%;max-height:220px;border-radius:8px;margin-top:6px;display:block;}',
    '.lgd-opts{display:grid;gap:6px;margin-top:8px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));}',
    '.lgd-opt{border:1px solid #E4DFD3;border-radius:10px;padding:6px 10px;background:#fff;} .lgd-opt.ok{border:2px solid #1F7A4D;background:#E8F4EC;} .lgd-opt.bad{border:2px solid #B42318;background:#FCE9E7;}',
    '.lgd-opt .tag{float:right;font-size:12px;font-weight:600;margin-left:6px;} .lgd-opt.ok .tag{color:#1F6B43;} .lgd-opt.bad .tag{color:#B42318;}',
    '.lgd-stage{position:relative;width:100%;height:min(48vw, calc(100vh - 470px));min-height:280px;background:#FAF8F3;border:1px solid #EFE9DC;border-radius:14px;overflow:hidden;cursor:pointer;flex-shrink:0;}',
    '@supports (height:100dvh){.lgd-stage{height:min(48vw, calc(100dvh - 470px));}}',
    '.lgd-box.fs .lgd-stage{height:calc(100dvh - 330px);}',
    '.lgd-scene{position:absolute;inset:6% 6% 8% 6%;display:flex;flex-direction:column;gap:.5em;overflow:hidden;}',
    '.lgd-scene h2{font-family:' + SERIF + ';font-weight:700;font-size:1.5em;margin:0 0 .3em;color:#15171C;}',
    '.lgd-scene h2:after{content:"";display:block;width:2.2em;height:.13em;background:#C9A24A;border-radius:9px;margin-top:.3em;}',
    '.lgd-it{opacity:0;transform:translateY(.5em);transition:opacity .45s,transform .45s;font-size:1.04em;line-height:1.45;color:#3D3A33;}',
    '.lgd-it.on{opacity:1;transform:none;} .lgd-it.cur{color:#15171C;}',
    '.lgd-li{padding-left:1.1em;position:relative;} .lgd-li:before{content:"";position:absolute;left:0;top:.6em;width:.42em;height:.42em;border-radius:50%;background:#C9A24A;}',
    '.lgd-math{text-align:center;font-size:1.3em;padding:.2em 0;color:#15171C;}',
    '.lgd-note{background:#F3EBDA;padding:.45em .7em;border-radius:.5em;color:#15171C;}',
    '.lgd-ask{background:#EAF1FA;padding:.45em .7em;border-radius:.5em;color:#15171C;}',
    '.lgd-trapl{align-self:flex-start;background:#FCE9E7;color:#B42318;font-weight:700;border-radius:.45em;padding:.2em .7em;font-size:.92em;}',
    '.lgd-img{text-align:center;} .lgd-img img{max-height:9em;max-width:100%;border-radius:.4em;}',
    '.lgd-scene.has-svg{display:grid;grid-template-columns:1.1fr .95fr;column-gap:1.2em;row-gap:0;grid-auto-rows:min-content;align-content:start;}',
    '.lgd-scene.has-svg > h2{grid-column:1/-1;} .lgd-scene.has-svg > .lgd-it{grid-column:1;margin-bottom:.5em;}',
    '.lgd-scene.has-svg > .lgd-svg{grid-column:2;grid-row:2 / span 14;align-self:center;margin:0;padding:.4em;background:#FFFDF8;border:1px solid #EFE9DC;border-radius:.7em;}',
    '.lgd-svg svg{display:block;width:100%;height:auto;max-height:15em;}',
    '.lgd-3d{cursor:default;}',
    '.lgd-figsw{position:absolute;top:6px;right:6px;height:36px;min-width:36px;padding:0 10px;font-size:12px;z-index:1;}',
    '.lgd-cap{font-size:14px;line-height:1.45;background:#F3EBDA;color:#15171C;padding:8px 10px;border-radius:10px;}',
    '.lgd-wm{position:absolute;right:2.4%;top:3%;display:flex;align-items:center;gap:.3em;font-weight:800;font-size:.72em;color:#5E5A51;} .lgd-wm img{width:1.5em;height:1.5em;} .lgd-wm b{color:#7A4E16;}',
    '.lgd-title{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:.4em;padding:0 8%;}',
    '.lgd-title img{width:3.6em;height:3.6em;} .lgd-title .k{color:#7A4E16;font-weight:800;letter-spacing:.14em;font-size:.8em;}',
    '.lgd-title h1{font-family:' + SERIF + ';font-size:2em;margin:.1em 0;color:#15171C;line-height:1.2;} .lgd-title .s{color:#5E5A51;font-size:.92em;}',
    '.lgd-title .acts{display:flex;gap:.5em;flex-wrap:wrap;justify-content:center;margin-top:.6em;font-size:14px;}',
    '.lgd-chap{display:flex;gap:4px;} .lgd-chap button{flex:1;min-width:0;border:0;background:transparent;padding:0;min-height:32px;cursor:pointer;text-align:left;font:inherit;display:flex;flex-direction:column;gap:4px;}',
    '.lgd-chap i{display:block;height:4px;border-radius:2px;background:#E4DFD3;overflow:hidden;width:100%;} .lgd-chap i em{display:block;height:100%;}',
    '.lgd-chap span{display:block;font-size:11px;color:#5E5A51;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;} .lgd-chap .cur span{color:#15171C;font-weight:700;}',
    '.lgd-ctl{display:flex;align-items:center;justify-content:center;gap:20px;min-height:56px;flex-shrink:0;}',
    '.lgd-rb{width:48px;height:48px;border-radius:24px;border:1px solid #E4DFD3;background:#fff;color:#15171C;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;flex-shrink:0;}',
    '.lgd-rb:hover{background:#F3EBDA;} .lgd-rb.main{width:56px;height:56px;border-radius:28px;border:0;background:#15171C;color:#fff;} .lgd-rb.main:hover{background:#2A2C31;}',
    '.lgd-rb.sm{width:44px;height:44px;border-radius:22px;} .lgd-rb.on{background:#F3EBDA;border-color:#C9A24A;}',
    '.lgd-try{background:#fff;border:1px solid #E4DFD3;border-radius:16px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;flex-shrink:0;}',
    '.lgd-try .hd{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;} .lgd-try .q{font-size:14px;color:#3D3A33;line-height:1.5;}',
    '.lgd-try .hint{background:#EAF1FA;border-radius:10px;padding:8px 10px;font-size:14px;line-height:1.5;}',
    '.lgd-try .row{display:flex;gap:8px;} .lgd-try .row .go{flex:1 1 auto;}',
    '.lgd-trap{background:#F3EBDA;border-radius:16px;padding:12px 14px;display:flex;align-items:center;gap:12px;color:#15171C;border:0;width:100%;text-align:left;font:inherit;cursor:pointer;flex-shrink:0;}',
    '.lgd-trap:hover{background:#EDE2CB;} .lgd-trap .k{width:40px;height:40px;border-radius:20px;background:#fff;color:#B42318;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
    '.lgd-trap small{display:block;font-size:12px;color:#5E5A51;} .lgd-trap b{display:block;font-size:14px;color:#7A4E16;}',
    '.lgd-vc{font-size:12px;color:#7A4E16;font-weight:600;}',
    '.lgd-seek{flex:1;min-width:80px;accent-color:#7A4E16;height:32px;}',
    // bảng (Board): dùng chung cho "Thầy chiếu" (admin) và "Thầy giảng" (học sinh xem lại) — mọi cỡ theo em để nét bút khớp chữ
    '.lgd-bd{position:relative;background:#FFFDF8;border:1px solid #E4DFD3;border-radius:18px;overflow:hidden;width:100%;color:#15171C;}',
    '.lgd-bd-in{position:absolute;inset:0;padding:1.4em 1.8em;overflow:hidden;}',
    '.lgd-bd-lab{display:block;font-family:"Be Vietnam Pro",system-ui,sans-serif;font-size:.74em;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7A4E16;margin-bottom:1em;}',
    '.lgd-bd-fig{float:right;width:38%;margin:0 0 .8em 1.2em;} .lgd-bd-fig svg{display:block;width:100%;height:auto;}',
    '.lgd-bd-it{margin:0 0 .75em;font-size:1.05em;line-height:1.5;color:#3D3A33;} .lgd-bd-it.lgd-li{padding-left:1.1em;}',
    '.lgd-bd-math{margin:0 0 .6em;font-size:1.45em;color:#15171C;font-family:' + SERIF + ';font-style:italic;}',
    '.lgd-bd-blank{position:absolute;inset:0;background-image:radial-gradient(#E4DFD3 1px,transparent 1px);background-size:2em 2em;opacity:.7;}',
    '.lgd-ink{position:absolute;inset:0;width:100%;height:100%;}',
    '@media (max-width:640px){.lgd-ov{padding:0;} .lgd-box{border-radius:0;height:100%;} .lgd-stage{height:max(280px, calc(100dvh - 560px));min-height:240px;} .lgd-body{padding:4px 16px 16px;}',
    '  .lgd-scene.has-svg{display:flex;} .lgd-scene.has-svg > .lgd-svg{order:5;} .lgd-wide{display:none !important;} .lgd-chap span{font-size:10px;}}'
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

    var s12 = React.useState(false); var stemOpen = s12[0], setStemOpen = s12[1];
    var s13 = React.useState(false); var fig3d = s13[0], setFig3d = s13[1];   // cảnh có cả hình 2D và mô hình 3D: đang xem cái nào
    var isTitle = idx === 0, isEnd = idx >= total - 1, stp = (!isTitle && !isEnd) ? steps[idx - 1] : null;
    var curScene = stp ? stp.scene : (isEnd ? parsed.scenes.length - 1 : -1);
    var accent = '#C9A24A', nScenes = parsed.scenes.length;
    var isTF = !!(q && q.statements), trapName = trap ? (isTF ? 'ý ' + trap.key : trap.key) : '';
    // tô sáng: gom [hl] của các cảnh đã tới
    var hl = [];
    parsed.scenes.forEach(function(sc, si){ if(si <= curScene) hl = hl.concat(sc.hl); });
    function cycleRate(){ var r = rate >= 1.5 ? 1 : (rate >= 1.25 ? 1.5 : 1.25); setRate(r); try{ localStorage.setItem('lgd-rate', r); }catch(e){} }
    function playPause(){ if(isEnd){ go(1); setPlaying(true); } else if(waiting) resume(); else setPlaying(!playing); }

    // thời lượng (giọng đã lưu nếu có, không thì ước lượng)
    var tSec = 0, curSec = 0, nClip = 0, stepSec = [];
    steps.forEach(function(s, i){ var c = clipFor(i + 1); var d = c ? (c.dur / rate + 0.3 + (s.pause ? Math.min(s.pause, 1500) / 1000 : 0)) : durMs(s, rate) / 1000; stepSec.push(d); tSec += d; if(i < idx - 1) curSec += d; if(c) nClip++; });
    // đoạn [bẫy] của em dài bao nhiêu giây (tới đoạn bẫy kế tiếp / hết cảnh)
    var trapSec = 0;
    if(trap){
      for(var ti = trap.step - 1; ti < steps.length; ti++){
        var tst = steps[ti], tit = parsed.scenes[tst.scene].items[tst.upto - 1];
        if(ti > trap.step - 1 && (tst.scene !== steps[trap.step - 1].scene || (tit && tit.t === 'trap'))) break;
        trapSec += stepSec[ti] || 0;
      }
      trapSec = Math.max(5, Math.round(trapSec / 5) * 5);
    }

    var head = h('div', { className: 'lgd-head' },
      h('button', { type: 'button', className: 'lgd-ib sq', onClick: props.onClose, 'aria-label': 'Quay lại' }, icon('back', 20)),
      h('div', { className: 't' }, h('small', null, rec.examTitle || 'FaradayAI'), h('b', null, 'Câu ' + (rec.index != null ? rec.index : '') + ' · Lời giải')),
      h('div', { className: 'r' },
        props.onTeacher ? h('button', { type: 'button', className: 'lgd-ib', onClick: props.onTeacher, title: 'Xem bản thầy ghi bút + giọng' }, icon('pen', 18), h('span', { className: 'lgd-wide' }, 'Thầy giảng')) : null,
        h('button', { type: 'button', className: 'lgd-ib', onClick: cycleRate, 'aria-label': 'Tốc độ phát ' + String(rate).replace('.', ',') + ' lần' }, String(rate === 1 ? '1' : rate).replace('.', ',') + '×'),
        h('button', { type: 'button', className: 'lgd-ib sq lgd-wide', onClick: toggleFs, 'aria-label': fs ? 'Thu nhỏ' : 'Toàn màn hình' }, icon(fs ? 'shrink' : 'expand', 18))));

    // đề bài (gọn 3 dòng trên điện thoại, bấm "Xem đủ đề" mới hiện phương án)
    var stemEl = null, narrow = (window.innerWidth || 1000) <= 640, showFull = stemOpen || !narrow;
    if(q && (q.stem || q.groupPassage) && !fs){
      var optRows = null;
      if(showFull && q.options && q.options.length){
        optRows = h('div', { className: 'lgd-opts' }, q.options.map(function(o){
          var ok = o.key === q.correctKey, bad = !ok && props.chosen === o.key;
          return h('div', { key: o.key, className: 'lgd-opt' + (ok ? ' ok' : (bad ? ' bad' : '')) },
            ok ? h('span', { className: 'tag' }, 'Đáp án') : (bad ? h('span', { className: 'tag' }, 'Em chọn') : null),
            h('b', null, o.key + '. '), h('span', { dangerouslySetInnerHTML: { __html: stemHtml(o.text, []) } }));
        }));
      } else if(showFull && q.statements && q.statements.length){
        optRows = h('div', { className: 'lgd-opts', style: { gridTemplateColumns: '1fr' } }, q.statements.map(function(s){
          var ch = props.chosen && typeof props.chosen === 'object' ? props.chosen[s.key] : null;
          var bad = ch != null && ch !== s.isTrue;
          return h('div', { key: s.key, className: 'lgd-opt' + (bad ? ' bad' : ' ok') },
            h('span', { className: 'tag' }, (s.isTrue ? 'Đúng' : 'Sai') + (bad ? ' · em chọn ' + (ch ? 'Đúng' : 'Sai') : '')),
            h('b', null, s.key + ') '), h('span', { dangerouslySetInnerHTML: { __html: stemHtml(s.text, []) } }));
        }));
      } else if(showFull && q.correctAnswer != null){
        optRows = h('div', { className: 'lgd-opts' }, h('div', { className: 'lgd-opt ok' }, h('span', { className: 'tag' }, 'Đáp số'), String(q.correctAnswer)));
      }
      var img = showFull && q.images && q.images[0] && q.images[0].url ? h('img', { src: q.images[0].url, alt: 'Hình của đề' }) : null;
      stemEl = h('div', { className: 'lgd-q' },
        h('div', { className: showFull ? '' : 'clip' },
          q.groupPassage ? h('div', { style: { color: '#5E5A51' }, dangerouslySetInnerHTML: { __html: stemHtml(q.groupPassage, hl) } }) : null,
          h('div', { dangerouslySetInnerHTML: { __html: stemHtml(q.stem, hl) } })),
        img, optRows,
        narrow ? h('button', { type: 'button', className: 'more', 'aria-expanded': stemOpen ? 'true' : 'false', onClick: function(){ setStemOpen(!stemOpen); } }, stemOpen ? 'Thu gọn đề' : 'Xem đủ đề và phương án') : null);
    }

    var stage;
    if(isTitle) stage = h('div', { className: 'lgd-title' }, h('img', { src: '/logo-mark.svg', alt: '' }), h('div', { className: 'k' }, 'FARADAYAI · LỜI GIẢI ĐỘNG'),
      h('h1', null, 'Câu ' + (rec.index != null ? rec.index : '')), h('div', { className: 's' }, rec.examTitle || ''));
    else if(isEnd) stage = h('div', { className: 'lgd-title', onClick: function(e){ e.stopPropagation(); } },
      h('div', { className: 'k' }, 'HẾT LỜI GIẢI'), h('h1', null, 'Giờ em làm lại câu này nhé!'),
      h('div', { className: 'acts' },
        h('button', { type: 'button', className: 'lgd-ib dark', onClick: function(){ go(1); setPlaying(true); } }, icon('replay', 18), 'Xem lại'),
        trap ? h('button', { type: 'button', className: 'lgd-ib', onClick: function(){ go(trap.step); setPlaying(true); } }, 'Vì sao ' + trapName + ' sai') : null,
        h('button', { type: 'button', className: 'lgd-ib', onClick: props.onClose }, 'Đóng')));
    else {
      var sc = parsed.scenes[stp.scene], upto = stp.upto;
      var both = sc.items.some(function(x){ return x.t === 'svg'; }) && sc.items.some(function(x){ return x.t === '3d'; });
      var swap = function(to3d){ return h('button', { type: 'button', className: 'lgd-ib lgd-figsw', onClick: function(e){ e.stopPropagation(); setFig3d(to3d); }, 'aria-label': to3d ? 'Xem mô hình 3D' : 'Xem hình 2D' }, to3d ? icon('cube', 16) : null, to3d ? '3D' : '2D'); };
      stage = h('div', { className: 'lgd-scene' + (sc.items.some(function(x){ return x.t === 'svg' || x.t === '3d'; }) ? ' has-svg' : '') },
        sc.title ? h('h2', null, sc.title) : null,
        sc.items.map(function(it, i){
          var cls = 'lgd-it ' + (i < upto ? 'on' : '') + (i === upto - 1 ? ' cur' : '');
          var other = it.t === 'svg' ? '3d' : '2d', otherShown = sc.items.some(function(x, j){ return j < upto && x.t === (other === '3d' ? '3d' : 'svg'); });
          if((it.t === 'svg' || it.t === '3d') && both && (it.t === '3d') !== fig3d && otherShown) return null;   // chỉ hiện 1 hình, có nút đổi
          if(it.t === 'svg') return i < upto
            ? h('div', { key: i, className: cls + ' lgd-svg', style: { position: 'relative' } },
                h('div', { dangerouslySetInnerHTML: { __html: (FX().sanitizeSvg ? FX().sanitizeSvg(it.v) : '') } }), (both && otherShown) ? swap(true) : null)
            : h('div', { key: i, className: 'lgd-it lgd-svg', style: { visibility: 'hidden', padding: 0, border: 0 } });
          if(it.t === '3d') return i < upto
            ? h('div', { key: i, className: cls + ' lgd-svg lgd-3d', style: { position: 'relative' } }, model3d(it.v, { compact: true, aspect: 16 / 10, maxH: Math.round(Math.max(110, ((stageRef.current && stageRef.current.clientHeight) || 300) * 0.48)) + 'px' }), (both && otherShown) ? swap(false) : null)
            : h('div', { key: i, className: 'lgd-it lgd-svg', style: { visibility: 'hidden', padding: 0, border: 0 } });
          if(it.t === 'math') return h('div', { key: i, className: cls + ' lgd-math', dangerouslySetInnerHTML: { __html: mathHtml(it.v, true) } });
          if(it.t === 'img') return h('div', { key: i, className: cls + ' lgd-img' }, h('img', { src: it.v, alt: '' }));
          if(it.t === 'trap') return h('div', { key: i, className: cls + ' lgd-trapl' }, it.key ? ('Nếu em chọn ' + it.key) : 'Lỗi hay gặp');
          return h('div', { key: i, className: cls + ' lgd-' + it.t, dangerouslySetInnerHTML: { __html: rich(it.v) } });
        }));
    }
    var curSay = (!isTitle && !isEnd && stp) ? stp.say : '';
    var stageEl = h('div', { className: 'lgd-stage', ref: stageRef, style: { fontSize: fontPx + 'px' }, onClick: function(){ if(!waiting && !isEnd) setPlaying(!playing); } },
      stage,
      h('div', { className: 'lgd-wm' }, h('img', { src: '/logo-mark.svg', alt: '' }), h('span', null, 'Faraday', h('b', null, 'AI'))));

    // thanh chặng: mỗi cảnh 1 đoạn (Đọc đề · Định luật · Giải · Bẫy · Mẹo nhớ)
    var chap = h('div', { className: 'lgd-chap' }, parsed.scenes.map(function(sc, si){
      var a = parsed.sceneStart[si], b = (si + 1 < parsed.sceneStart.length ? parsed.sceneStart[si + 1] : total - 1);
      var n = Math.max(1, b - a), pct = idx >= b ? 100 : (idx < a ? 0 : Math.round((idx - a + 1) / n * 100));
      return h('button', { key: si, type: 'button', className: si === curScene ? 'cur' : '', onClick: function(){ go(a); setPlaying(true); }, 'aria-label': 'Tới chặng ' + (sc.title || (si + 1)) },
        h('i', null, h('em', { style: { width: pct + '%', background: accent } })), h('span', null, shortTitle(sc.title) || ('Phần ' + (si + 1))));
    }));

    var kick = isTitle ? 'Mở đầu' : (isEnd ? 'Hết lời giải' : ('Bước ' + (curScene + 1) + ' / ' + nScenes + (parsed.scenes[curScene] && parsed.scenes[curScene].title ? ' · ' + parsed.scenes[curScene].title : '')));
    var card = h('div', { className: 'lgd-card' },
      h('div', { className: 'lgd-row' }, h('span', { className: 'lgd-kick' }, kick),
        h('span', { className: 'lgd-tm' }, audioMap === null ? 'Đang tải giọng…' : (fmtTime(curSec) + ' / ' + fmtTime(tSec)))),
      stemEl, stageEl,
      (caps && curSay && !waiting) ? h('div', { className: 'lgd-cap', 'aria-live': 'polite' }, curSay) : null,
      chap);

    var ctl = h('div', { className: 'lgd-ctl' },
      h('button', { type: 'button', className: 'lgd-rb sm' + (caps ? ' on' : ''), onClick: function(){ setCaps(!caps); }, 'aria-label': caps ? 'Tắt phụ đề' : 'Bật phụ đề', 'aria-pressed': caps ? 'true' : 'false' }, icon('cc', 18)),
      h('button', { type: 'button', className: 'lgd-rb', onClick: function(){ go(idx - 1); }, 'aria-label': 'Lùi một bước' }, icon('replay', 20)),
      h('button', { type: 'button', className: 'lgd-rb main', onClick: playPause, 'aria-label': isEnd ? 'Xem lại' : ((playing && !waiting) ? 'Tạm dừng' : 'Phát') }, icon(isEnd ? 'replay' : ((playing && !waiting) ? 'pause' : 'play'), 22)),
      h('button', { type: 'button', className: 'lgd-rb', onClick: function(){ if(waiting) resume(); else go(idx + 1); }, 'aria-label': 'Sang bước tiếp' }, icon('next', 20)),
      h('button', { type: 'button', className: 'lgd-rb sm', onClick: function(){ setMuted(!muted); }, 'aria-label': muted ? 'Bật tiếng' : 'Tắt tiếng' }, icon(muted ? 'mute' : 'vol', 18)));

    var askItem = (waiting && stp) ? parsed.scenes[stp.scene].items[stp.upto - 1] : null;
    var tryCard = askItem ? h('div', { className: 'lgd-try', role: 'region', 'aria-label': 'Dừng lại cho em thử' },
      h('div', { className: 'hd' }, icon('clock', 18, '#7A4E16'), 'Dừng lại: em thử trước nhé'),
      h('div', { className: 'q', dangerouslySetInnerHTML: { __html: rich(askItem.v) } }),
      (showHint && askItem.hint) ? h('div', { className: 'hint', dangerouslySetInnerHTML: { __html: rich(askItem.hint) } }) : null,
      h('div', { className: 'row' },
        h('button', { type: 'button', className: 'lgd-ib dark go', onClick: resume, autoFocus: true }, 'Em làm xong, xem tiếp'),
        askItem.hint && !showHint ? h('button', { type: 'button', className: 'lgd-ib', onClick: function(){ setShowHint(true); } }, 'Gợi ý') : null)) : null;

    var chosenTxt = '';
    if(trap && q && q.options){ var co = q.options.filter(function(o){ return o.key === trap.key; })[0]; if(co) chosenTxt = co.text; }
    var trapBtn = (trap && !isEnd) ? h('button', { type: 'button', className: 'lgd-trap', onClick: function(){ go(trap.step); setPlaying(true); } },
      h('span', { className: 'k' }, trap.key),
      h('span', { style: { flex: 1, minWidth: 0 } },
        h('small', null, isTF ? ('Em chọn "' + (trap.tf ? 'Đúng' : 'Sai') + '" ở ý ' + trap.key) : h('span', null, 'Em đã chọn ' + trap.key, chosenTxt ? h('span', { dangerouslySetInnerHTML: { __html: ' · ' + stemHtml(chosenTxt, []) } }) : null)),
        h('b', null, (trapSeen ? 'Xem lại' : 'Xem ' + trapSec + ' giây') + ': vì sao ' + trapName + ' sai')),
      icon('chev', 18, '#7A4E16')) : null;

    return h('div', { className: 'lgd-ov', onClick: function(e){ if(e.target === e.currentTarget && !fs) props.onClose(); } },
      h('div', { className: 'lgd-box' + (fs ? ' fs' : ''), ref: boxRef, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Lời giải động câu ' + (rec.index || '') },
        head,
        h('div', { className: 'lgd-body' }, card, ctl, tryCard, trapBtn,
          nClip ? h('div', { className: 'lgd-vc', style: { textAlign: 'center' } }, 'Giọng FaradayAI đã lưu') : null)));
  }
  function shortTitle(t){ t = String(t || ''); t = t.replace(/^chọn\s+/i, ''); return t.charAt(0).toUpperCase() + t.slice(1); }

  // ------------------------------------------------------------ biểu tượng (nét, theo màu chữ)
  var ICONS = {
    back: ['M15 18l-6-6 6-6'], chev: ['M9 6l6 6-6 6'], close: ['M6 6l12 12', 'M18 6L6 18'],
    replay: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5'], pause: ['M8 5v14', 'M16 5v14'], play: ['M7 5l12 7-12 7z'], next: ['M5 5l10 7-10 7z', 'M19 5v14'],
    prev: ['M19 5L9 12l10 7z', 'M5 5v14'],
    clock: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18', 'M12 7v5l3 2'], cc: ['M3 6h18v12H3z', 'M10.5 10a2 2 0 1 0 0 4', 'M17 10a2 2 0 1 0 0 4'],
    vol: ['M11 5L6 9H3v6h3l5 4z', 'M16 9a4 4 0 0 1 0 6'], mute: ['M11 5L6 9H3v6h3l5 4z', 'M22 9l-6 6', 'M16 9l6 6'],
    expand: ['M4 9V4h5', 'M20 9V4h-5', 'M4 15v5h5', 'M20 15v5h-5'], shrink: ['M9 4v5H4', 'M15 4v5h5', 'M9 20v-5H4', 'M15 20v-5h5'],
    pen: ['M4 20l4-1 11-11-3-3L5 16z'], hl: ['M9 15l-4 5h6l2-2', 'M9 15l7-11 4 3-7 11z'], eraser: ['M7 20h11', 'M4 15l9-9 6 6-7 7H8z'],
    undo: ['M9 14L4 9l5-5', 'M4 9h11a5 5 0 0 1 0 10h-3'], arrow: ['M5 12h14', 'M13 6l6 6-6 6'], chart: ['M3 20h18', 'M6 16V9', 'M11 16V5', 'M16 16v-4'],
    spark: ['M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z', 'M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z'],
    mic: ['M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3', 'M5 11a7 7 0 0 0 14 0', 'M12 18v3'],
    eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6'],
    check: ['M5 12l5 5 9-10'],
    cube: ['M12 3l8 4.5v9L12 21l-8-4.5v-9z', 'M12 12l8-4.5', 'M12 12v9', 'M12 12L4 7.5'],
    rotate: ['M21 12a9 9 0 1 1-3-6.7', 'M21 4v5h-5']
  };
  function icon(name, size, color){
    var d = ICONS[name] || [], filled = name === 'play';
    return React.createElement('svg', { width: size || 20, height: size || 20, viewBox: '0 0 24 24', fill: filled ? (color || 'currentColor') : 'none', stroke: color || 'currentColor',
      strokeWidth: name === 'pause' ? 2.5 : 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true', focusable: 'false' },
      d.map(function(p, i){ return React.createElement('path', { key: i, d: p }); }));
  }

  // ------------------------------------------------------------ bảng + nét bút (dùng chung: thầy chiếu ↔ học sinh xem lại)
  // Nét bút lưu theo TỈ LỆ khung bảng (0..1) + mốc thời gian (ms) tính từ lúc bắt đầu ghi câu đó:
  //   stroke = { c: màu, m: 'pen' | 'hl', p: [[x, y, t], …], x: (ms lúc bị tẩy/hoàn tác) | undefined }
  //   cảnh = [[t, chỉ số cảnh], …]  — bảng hiện cảnh nào của kịch bản tại thời điểm t
  function drawInk(cv, strokes, tMax){
    if(!cv) return;
    var ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    (strokes || []).forEach(function(s){
      if(s.x != null && (tMax == null || s.x <= tMax)) return;
      var pts = tMax == null ? s.p : s.p.filter(function(p){ return p[2] <= tMax; });
      if(!pts || !pts.length) return;
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = s.c || '#D14332';
      if(s.m === 'hl'){ ctx.globalAlpha = 0.3; ctx.lineWidth = W * 0.02; } else ctx.lineWidth = Math.max(2, W * 0.0034);
      ctx.beginPath(); ctx.moveTo(pts[0][0] * W, pts[0][1] * H);
      if(pts.length === 1) ctx.lineTo(pts[0][0] * W + 0.5, pts[0][1] * H + 0.5);
      for(var i = 1; i < pts.length - 1; i++){
        ctx.quadraticCurveTo(pts[i][0] * W, pts[i][1] * H, (pts[i][0] + pts[i + 1][0]) / 2 * W, (pts[i][1] + pts[i + 1][1]) / 2 * H);
      }
      if(pts.length > 1){ var l = pts[pts.length - 1]; ctx.lineTo(l[0] * W, l[1] * H); }
      ctx.stroke(); ctx.restore();
    });
  }
  function sceneAt(log, t){ var s = 0; (log || []).forEach(function(e){ if(e[0] <= t) s = e[1]; }); return s; }
  // props: scene (cảnh đã parse | null), label, aspect (rộng / cao), canvasRef, canvasProps, children (lớp phủ: thanh công cụ…)
  function Board(props){
    var h = React.createElement, ref = React.useRef(null);
    var s = React.useState(16); var fp = s[0], setFp = s[1];
    var pRef = React.useRef(props); pRef.current = props;
    React.useEffect(function(){
      function fit(){
        var el = ref.current; if(!el) return;
        setFp(Math.max(9, el.clientWidth / 44));
        var cv = pRef.current.canvasRef && pRef.current.canvasRef.current;
        if(cv){ var dpr = window.devicePixelRatio || 1, w = Math.round(el.clientWidth * dpr), hh = Math.round(el.clientHeight * dpr); if(cv.width !== w || cv.height !== hh){ cv.width = w; cv.height = hh; } }
        if(pRef.current.onSize) pRef.current.onSize(el.clientWidth, el.clientHeight);
      }
      fit(); var ro = window.ResizeObserver ? new ResizeObserver(fit) : null; if(ro && ref.current) ro.observe(ref.current);
      window.addEventListener('resize', fit);
      return function(){ if(ro) ro.disconnect(); window.removeEventListener('resize', fit); };
    }, []);
    var sc = props.scene, svg = null, m3 = null, items = [];
    if(sc) sc.items.forEach(function(it){ if(it.t === 'svg'){ if(!svg) svg = it; } else if(it.t === '3d'){ if(!m3) m3 = it; } else items.push(it); });
    var fig = (m3 && (props.show3d || !svg)) ? m3 : svg;
    var style = Object.assign({ fontSize: fp + 'px' }, props.aspect ? { aspectRatio: String(props.aspect) } : {}, props.style || {});
    return h('div', { className: 'lgd-bd', ref: ref, style: style },
      sc ? null : h('div', { className: 'lgd-bd-blank', 'aria-hidden': 'true' }),
      h('div', { className: 'lgd-bd-in' },
        props.label ? h('span', { className: 'lgd-bd-lab' }, props.label) : null,
        (fig && fig.t === '3d') ? h('div', { className: 'lgd-bd-fig' }, model3d(fig.v, { 'static': true, spin: !!props.spin3d })) : null,
        (fig && fig.t === 'svg') ? h('div', { className: 'lgd-bd-fig', dangerouslySetInnerHTML: { __html: FX().sanitizeSvg ? FX().sanitizeSvg(fig.v) : '' } }) : null,
        items.map(function(it, i){
          if(it.t === 'math') return h('div', { key: i, className: 'lgd-bd-math', dangerouslySetInnerHTML: { __html: mathHtml(it.v, false) } });
          if(it.t === 'img') return h('div', { key: i, className: 'lgd-bd-it' }, h('img', { src: it.v, alt: '', style: { maxWidth: '50%', maxHeight: '8em' } }));
          if(it.t === 'trap') return h('div', { key: i, className: 'lgd-bd-it lgd-trapl', style: { display: 'inline-block' } }, it.key ? ('Nếu em chọn ' + it.key) : 'Lỗi hay gặp');
          return h('div', { key: i, className: 'lgd-bd-it lgd-' + it.t, dangerouslySetInnerHTML: { __html: rich(it.v) } });
        })),
      h('canvas', Object.assign({ className: 'lgd-ink', ref: props.canvasRef, 'aria-hidden': 'true' }, props.canvasProps || {})),
      props.children);
  }
  // mô hình 3D (mohinh3d.js) — thiếu file thì hiện chữ thay thế
  function model3d(spec, o){
    if(!window.OPC_3D) return React.createElement('div', { style: { padding: '.6em', fontSize: '.8em', color: '#5E5A51' } }, 'Mô hình 3D: ' + spec);
    return React.createElement(window.OPC_3D.View, Object.assign({ spec: spec }, o || {}));
  }
  function viewAt(log, t){ var v = [0, 0]; (log || []).forEach(function(e){ if(e[0] <= t) v = [e[1], e[2]]; }); return v; }
  function b64ToUrl(b64, mime){
    try{ var bin = atob(b64), n = bin.length, u = new Uint8Array(n); for(var i = 0; i < n; i++) u[i] = bin.charCodeAt(i); return URL.createObjectURL(new Blob([u], { type: mime || 'audio/webm' })); }
    catch(e){ return 'data:' + (mime || 'audio/webm') + ';base64,' + b64; }
  }
  // bản thầy ghi (giọng + nét bút) đã lưu → { url, ink: { s: [stroke], sc: [[t, cảnh]] } }
  function teacherTake(rec, map){
    var T = rec && rec.teacher; if(!T || !map) return null;
    var parts = [];
    for(var k = 0; k < (T.n || 0); k++){ var c = map['tp' + k]; if(!c || !c.b64) return null; parts.push(c.b64); }
    var ink = { s: [], sc: [] };
    try{ if(map.tk && map.tk.ink) ink = JSON.parse(map.tk.ink); }catch(e){}
    return { url: b64ToUrl(parts.join(''), T.mime), ink: ink };
  }

  // ------------------------------------------------------------ "Thầy giảng": phát lại giọng + nét bút thầy ghi trên iPad
  function TeacherPlayer(props){
    var h = React.createElement, rec = props.rec || {}, q = props.q || null, T = rec.teacher || {};
    ensureCss();
    var parsed = React.useMemo(function(){ return parse(rec.script); }, [rec.qid, rec.script]);
    var s1 = React.useState(null); var take = s1[0], setTake = s1[1];
    var s2 = React.useState(false); var playing = s2[0], setPlaying = s2[1];
    var s3 = React.useState(0); var t = s3[0], setT = s3[1];
    var s4 = React.useState(function(){ try{ return Number(localStorage.getItem('lgd-rate')) || 1; }catch(e){ return 1; } }); var rate = s4[0], setRate = s4[1];
    var s5 = React.useState(0); var sizeTick = s5[0], setSizeTick = s5[1];
    var audioRef = React.useRef(null), cvRef = React.useRef(null);
    React.useEffect(function(){
      var done = false, url = null;
      loadAudio(rec).then(function(m){ if(done) return; var tk = teacherTake(rec, m); if(tk){ url = tk.url; setTake(tk); } else setTake({ err: true }); });
      return function(){ done = true; if(url && /^blob:/.test(url)) try{ URL.revokeObjectURL(url); }catch(e){} };
    }, [rec.qid]);
    React.useEffect(function(){
      var a = audioRef.current; if(!a || !playing) return;
      var raf = 0; function tick(){ setT(a.currentTime * 1000); raf = requestAnimationFrame(tick); } tick();
      return function(){ cancelAnimationFrame(raf); };
    }, [playing, take]);
    React.useEffect(function(){ if(take && take.ink) drawInk(cvRef.current, take.ink.s, t); }, [t, take, sizeTick]);
    React.useEffect(function(){ if(audioRef.current) audioRef.current.playbackRate = rate; }, [rate, take]);
    React.useEffect(function(){
      function onKey(e){ var tg = e.target && e.target.tagName; if(tg === 'INPUT' && e.target.type !== 'range') return; if(e.key === 'Escape') props.onClose(); else if(e.key === ' '){ e.preventDefault(); toggle(); } }
      window.addEventListener('keydown', onKey); return function(){ window.removeEventListener('keydown', onKey); };
    });
    function toggle(){ var a = audioRef.current; if(!a) return; if(a.paused){ var p = a.play(); if(p && p.catch) p.catch(function(){}); } else a.pause(); }
    function cycleRate(){ var r = rate >= 1.5 ? 1 : (rate >= 1.25 ? 1.5 : 1.25); setRate(r); try{ localStorage.setItem('lgd-rate', r); }catch(e){} }
    var dur = (audioRef.current && isFinite(audioRef.current.duration) && audioRef.current.duration) || T.dur || 0;
    var si = sceneAt(take && take.ink ? take.ink.sc : [], t), sc = parsed.scenes[si] || null, vw = viewAt(take && take.ink ? take.ink.v : [], t);
    var hl = []; parsed.scenes.forEach(function(x, i){ if(i <= si) hl = hl.concat(x.hl); });
    var label = sc ? ('Bước ' + (si + 1) + ' / ' + parsed.scenes.length + (sc.title ? ' · ' + sc.title : '')) : 'Thầy giảng';
    return h('div', { className: 'lgd-ov', onClick: function(e){ if(e.target === e.currentTarget) props.onClose(); } },
      h('div', { className: 'lgd-box', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Thầy giảng câu ' + (rec.index || '') },
        h('div', { className: 'lgd-head' },
          h('button', { type: 'button', className: 'lgd-ib sq', onClick: props.onClose, 'aria-label': 'Quay lại' }, icon('back', 20)),
          h('div', { className: 't' }, h('small', null, rec.examTitle || 'FaradayAI'), h('b', null, 'Câu ' + (rec.index != null ? rec.index : '') + ' · Thầy giảng')),
          h('div', { className: 'r' },
            props.onScript ? h('button', { type: 'button', className: 'lgd-ib', onClick: props.onScript, title: 'Xem lời giải động từng bước' }, icon('spark', 18), h('span', { className: 'lgd-wide' }, 'Lời giải động')) : null,
            h('button', { type: 'button', className: 'lgd-ib', onClick: cycleRate, 'aria-label': 'Tốc độ phát' }, String(rate === 1 ? '1' : rate).replace('.', ',') + '×'))),
        h('div', { className: 'lgd-body' },
          (q && q.stem) ? h('div', { className: 'lgd-card', style: { padding: '12px 14px' } },
            h('div', { className: 'lgd-q', dangerouslySetInnerHTML: { __html: stemHtml(q.stem, hl) } })) : null,
          h(Board, { scene: sc, label: label, aspect: T.ar || 1.6, show3d: !!vw[0], spin3d: !!vw[1] && playing, canvasRef: cvRef, onSize: function(){ setSizeTick(function(x){ return x + 1; }); } },
            take === null ? h('div', { className: 'lgd-title', style: { fontSize: '14px', color: '#5E5A51' } }, 'Đang tải bản ghi của thầy…') : null,
            (take && take.err) ? h('div', { className: 'lgd-title', style: { fontSize: '14px', color: '#B42318' } }, 'Chưa tải được bản ghi. Em thử lại sau nhé.') : null),
          h('div', { className: 'lgd-ctl', style: { gap: '12px' } },
            h('button', { type: 'button', className: 'lgd-rb', onClick: function(){ var a = audioRef.current; if(a){ a.currentTime = Math.max(0, a.currentTime - 5); setT(a.currentTime * 1000); } }, 'aria-label': 'Lùi 5 giây' }, icon('replay', 20)),
            h('button', { type: 'button', className: 'lgd-rb main', onClick: toggle, disabled: !take || take.err, 'aria-label': playing ? 'Tạm dừng' : 'Phát' }, icon(playing ? 'pause' : 'play', 22)),
            h('input', { type: 'range', className: 'lgd-seek', min: 0, max: Math.max(1, Math.round(dur * 1000)), step: 100, value: Math.round(t), 'aria-label': 'Tua bản ghi',
              onChange: function(e){ var a = audioRef.current, v = Number(e.target.value); if(a){ a.currentTime = v / 1000; } setT(v); } }),
            h('span', { className: 'lgd-tm' }, fmtTime(t / 1000) + ' / ' + fmtTime(dur))),
          (take && take.url) ? h('audio', { ref: audioRef, src: take.url, preload: 'auto',
            onPlay: function(){ setPlaying(true); }, onPause: function(){ setPlaying(false); setT(audioRef.current.currentTime * 1000); },
            onEnded: function(){ setPlaying(false); if(props.onDone) props.onDone(rec); }, onLoadedMetadata: function(){ setT(0); } }) : null)));
  }

  // mở trình phát ở bất cứ đâu
  var hostEl = null;
  function open(rec, opts){
    if(!ReactDOM || !rec) return;
    opts = opts || {};
    if(!hostEl){ hostEl = document.createElement('div'); hostEl.id = 'lgd-host'; document.body.appendChild(hostEl); }
    function close(){ try{ ReactDOM.unmountComponentAtNode(hostEl); }catch(e){} if(opts.onClose) opts.onClose(); }
    function onDone(r){ if(tracker && !opts.preview) try{ tracker(r, true); }catch(e){} if(opts.onDone) opts.onDone(r); }
    var hasScript = !!String(rec.script || '').trim(), hasTeacher = !!(rec.teacher && rec.teacher.n && (!rec.teacher.pending || opts.preview));
    // THÊM 4/11/2026 — câu có bản THẦY GHI (bút + giọng): mặc định mở bản thầy, chuyển qua lại với lời giải động
    function show(mode){
      var key = rec.qid + ':' + mode + ':' + Date.now();
      if(mode === 'teacher') ReactDOM.render(React.createElement(TeacherPlayer, { key: key, rec: rec, q: opts.q || null, onClose: close, onDone: onDone,
        onScript: hasScript ? function(){ show('script'); } : null }), hostEl);
      else ReactDOM.render(React.createElement(Player, { key: key, rec: rec, q: opts.q || null, chosen: opts.chosen, audioMap: opts.audioMap || null, startAt: opts.startAt || 0, onClose: close, onDone: onDone,
        onTeacher: hasTeacher ? function(){ show('teacher'); } : null }), hostEl);
    }
    show(hasTeacher && (opts.mode === 'teacher' || !hasScript) && opts.mode !== 'script' ? 'teacher' : 'script');
    if(tracker && !opts.preview) try{ tracker(rec, false); }catch(e){}
  }

  // ------------------------------------------------------------ bảng tra phía học sinh
  var registry = {}, tracker = null, listeners = [];
  // bản thầy ghi chỉ hiện cho học sinh khi thầy đã bấm "Duyệt và phát" (teacher.pending = false)
  function teacherOk(r){ return !!(r && r.teacher && r.teacher.n && !r.teacher.pending); }
  function register(list){
    registry = {};
    (list || []).forEach(function(r){ if(r && r.qid && r.status === 'published' && (r.script || teacherOk(r))) registry[r.qid] = r; });
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
    var label = teacherOk(rec) ? ('✍️ Thầy giảng câu này · ' + fmtTime(rec.teacher.dur || 0)) : ('✨ Lời giải động · ' + fmtTime(estimateSec(rec.script)));
    return h('div', { style: { margin: '0 0 8px' } },
      h('button', { type: 'button', className: 'btn ' + (o.wrong ? 'btn-primary' : 'btn-secondary') + ' lgd-btn', style: { fontSize: '0.86rem' },
        onClick: function(){ open(rec, { q: q && q.stem ? q : null, chosen: o.chosen }); } }, label));
  }

  window.OPC_LGD = {
    parse: parse, says: says, estimateSec: estimateSec, fmtTime: fmtTime, normSay: normSay,
    teacherOk: teacherOk, viewAt: viewAt,
    Player: Player, TeacherPlayer: TeacherPlayer, Board: Board, drawInk: drawInk, sceneAt: sceneAt, icon: icon, stemHtml: stemHtml, mathHtml: mathHtml, rich: rich, ensureCss: ensureCss,
    open: open, init: init, register: register, onChange: onChange, forQuestion: forQuestion, button: button,
    qidOf: qidOf, toPlayerQuestion: toPlayerQuestion, clearAudioCache: function(){ audioCache = {}; },
    setAudioLoader: function(f){ audioLoader = f; audioCache = {}; }
  };
})(window);
