/**
 * faraday-extras.js — THÊM 23/10/2026 · dùng CHUNG cho trang học sinh (index.html) và admin.html
 *  1) TRÌNH PHÁT BÀI GIẢNG FARADAYAI ("video" lý thuyết có logo): kịch bản cảnh → chữ/công thức hiện dần,
 *     đọc lời giảng bằng giọng tiếng Việt của máy (Web Speech), có phụ đề, tua, tốc độ, toàn màn hình.
 *     + Video YouTube (ứng dụng thực tế) phát trong khung có logo FaradayAI, cắt đúng đoạn (start/end).
 *  2) GIẤY KHEN / CHỨNG NHẬN thi thử (ảnh PNG có logo, tải về hoặc chia sẻ Zalo/Facebook).
 *  3) BỘ BÀI GIẢNG MẪU do Claude soạn (SEED_LESSONS) — thầy nạp vào thư viện ở admin › 📺 Video bài giảng.
 *
 * Dữ liệu bài giảng (collection video_lessons/{id}):
 *   { kind:'faraday'|'youtube', title, chuDeKey, baiKey, nanoIds:[], script (faraday), youtubeId, start, end,
 *     note, level ('co-ban'|'nang-cao'), published:true, order, createdAt, updatedAt }
 *
 * CÚ PHÁP KỊCH BẢN (kind 'faraday') — mỗi dòng 1 bước, hiện lần lượt:
 *   # Tiêu đề cảnh          → sang cảnh mới
 *   - Ý chính (có $công thức$ trong dòng)
 *   $$ công thức lớn $$
 *   ! Lưu ý / mẹo (khung vàng)
 *   ? Câu hỏi nhanh cho em nghĩ
 *   [ảnh: https://…]
 *   > Lời giảng đọc cho bước NGAY TRÊN (không có thì đọc chính dòng chữ; công thức không có lời thì im 3 giây)
 */
(function(window){
  'use strict';
  var React = window.React, ReactDOM = window.ReactDOM;

  // ------------------------------------------------------------ tiện ích
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mathHtml(tex, display){
    try{ if(window.katex) return window.katex.renderToString(tex, { displayMode: !!display, throwOnError: false }); }catch(e){}
    return '<code>' + esc(tex) + '</code>';
  }
  // chữ thường có $…$ → HTML (KaTeX), **đậm**
  function richHtml(text){
    var out = '', parts = String(text || '').split(/(\$[^$]+\$)/g);
    parts.forEach(function(p){
      if(/^\$[^$]+\$$/.test(p)) out += mathHtml(p.slice(1, -1), false);
      else out += esc(p).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    });
    return out;
  }
  // LaTeX → lời đọc gần đúng (chỉ dùng khi bước chữ có công thức nhỏ mà không có lời giảng riêng)
  function speakable(text){
    return String(text || '')
      .replace(/\$([^$]+)\$/g, function(_, t){
        return ' ' + t.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1 trên $2').replace(/\\Delta\s*/g, 'đen ta ').replace(/\\alpha/g, 'an pha')
          .replace(/\\cdot|\\times/g, ' nhân ').replace(/\^\{?2\}?/g, ' bình phương').replace(/\^\{?3\}?/g, ' lập phương').replace(/\^\{?(-?\d+)\}?/g, ' mũ $1').replace(/-(\d)/g, ' trừ $1')
          .replace(/_\{?([^}\s]+)\}?/g, ' $1').replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}]/g, '').replace(/=/g, ' bằng ') + ' ';
      })
      .replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  }
  function youtubeId(url){
    var s = String(url || '').trim(), m;
    if(/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    if((m = s.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/))) return m[1];
    return null;
  }
  function parseTime(t){
    if(t == null || t === '') return null;
    if(typeof t === 'number') return t;
    var m = String(t).trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
    if(m) return (Number(m[1] || 0) * 3600) + Number(m[2]) * 60 + Number(m[3]);
    var n = Number(t); return isNaN(n) ? null : n;
  }
  function fmtTime(s){ s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

  // ------------------------------------------------------------ kịch bản → các bước
  function parseScript(script){
    var scenes = [], cur = null;
    String(script || '').split(/\r?\n/).forEach(function(raw){
      var line = raw.trim(); if(!line) return;
      if(/^#\s*/.test(line)){ cur = { title: line.replace(/^#\s*/, ''), items: [], say: '' }; scenes.push(cur); return; }
      if(!cur){ cur = { title: '', items: [], say: '' }; scenes.push(cur); }
      if(/^>\s*/.test(line)){
        var say = line.replace(/^>\s*/, '');
        var last = cur.items[cur.items.length - 1];
        if(last) last.say = (last.say ? last.say + ' ' : '') + say; else cur.say = (cur.say ? cur.say + ' ' : '') + say;
        return;
      }
      var m;
      if((m = line.match(/^\$\$([\s\S]*)\$\$$/))) cur.items.push({ t: 'math', v: m[1].trim() });
      else if(/^[-•*]\s+/.test(line)) cur.items.push({ t: 'li', v: line.replace(/^[-•*]\s+/, '') });
      else if(/^!\s*/.test(line)) cur.items.push({ t: 'note', v: line.replace(/^!\s*/, '') });
      else if(/^\?\s*/.test(line)) cur.items.push({ t: 'ask', v: line.replace(/^\?\s*/, '') });
      else if((m = line.match(/^\[(?:ảnh|anh|img|image)\s*:\s*([^\]]+)\]$/i))) cur.items.push({ t: 'img', v: m[1].trim() });
      else cur.items.push({ t: 'p', v: line });
    });
    // các bước: mỗi cảnh = 1 bước tiêu đề (đọc cur.say) + mỗi mục 1 bước
    var steps = [];
    scenes.forEach(function(sc, si){
      steps.push({ scene: si, upto: 0, say: sc.say || (sc.title ? sc.title + '.' : '') });
      sc.items.forEach(function(it, ii){
        var say = it.say || (it.t === 'math' || it.t === 'img' ? '' : speakable(it.v));
        steps.push({ scene: si, upto: ii + 1, say: say, pause: it.t === 'math' || it.t === 'img' ? 3200 : (it.t === 'ask' ? 2500 : 0) });
      });
    });
    return { scenes: scenes, steps: steps };
  }
  function estimateSec(script){
    var p = parseScript(script), ms = 0;
    p.steps.forEach(function(s){ ms += durMs(s, 1); });
    return Math.round(ms / 1000) + 6;
  }
  function durMs(step, rate){
    var words = String(step.say || '').split(/\s+/).filter(Boolean).length;
    return Math.max(1600, words * 380 / (rate || 1)) + (step.pause || 0) + 350;
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
  if(window.speechSynthesis){ pickVoice(); try{ window.speechSynthesis.onvoiceschanged = pickVoice; }catch(e){} }

  // ------------------------------------------------------------ CSS
  var CSS = [
    '.fx-ov{position:fixed;inset:0;z-index:4000;background:rgba(8,10,14,.82);display:flex;align-items:center;justify-content:center;padding:14px;}',
    '.fx-box{width:min(1100px,100%);background:#0f1115;color:#f5f1e6;border-radius:16px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.5);display:flex;flex-direction:column;max-height:100%;}',
    '.fx-box.fs{width:100vw;height:100vh;height:100dvh;border-radius:0;max-height:none;}',
    '.fx-head{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #262a33;}',
    '.fx-head img{width:26px;height:26px;} .fx-head .t{font-weight:800;font-size:.98rem;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.fx-head .b{font-size:.72rem;color:#c9a25f;font-weight:800;letter-spacing:.06em;}',
    '.fx-x{border:0;background:#1d212a;color:#f5f1e6;border-radius:8px;padding:6px 10px;cursor:pointer;font-weight:700;}',
    '.fx-stage-wrap{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;background:#0b0d11;}',
    '.fx-stage{position:relative;width:100%;aspect-ratio:16/9;max-height:100%;background:radial-gradient(120% 90% at 20% 10%,#1a2233 0%,#0e1320 55%,#0a0d15 100%);overflow:hidden;color:#f3efe4;font-family:"Be Vietnam Pro",system-ui,sans-serif;}',
    '.fx-box.fs .fx-stage{width:auto;height:100%;max-width:100%;}',
    '.fx-scene{position:absolute;inset:6% 7% 14% 7%;display:flex;flex-direction:column;gap:.55em;}',
    '.fx-scene h2{font-family:Literata,Georgia,serif;font-weight:700;font-size:1.75em;margin:0 0 .35em;color:#fff;letter-spacing:-.01em;}',
    '.fx-scene h2:after{content:"";display:block;width:2.2em;height:.12em;background:#c9a25f;border-radius:9px;margin-top:.3em;}',
    '.fx-it{opacity:0;transform:translateY(.5em);transition:opacity .45s,transform .45s;font-size:1.06em;line-height:1.45;}',
    '.fx-it.on{opacity:1;transform:none;} .fx-it.cur{color:#fff;}',
    '.fx-li{padding-left:1.1em;position:relative;} .fx-li:before{content:"";position:absolute;left:0;top:.6em;width:.42em;height:.42em;border-radius:50%;background:#c9a25f;}',
    '.fx-math{text-align:center;font-size:1.35em;padding:.25em 0;} .fx-math .katex{color:#fff;}',
    '.fx-note{background:rgba(201,162,95,.14);border-left:.22em solid #c9a25f;padding:.45em .7em;border-radius:.4em;}',
    '.fx-ask{background:rgba(96,165,250,.14);border-left:.22em solid #60a5fa;padding:.45em .7em;border-radius:.4em;}',
    '.fx-ask:before{content:"🤔 ";} .fx-note:before{content:"💡 ";}',
    '.fx-img{text-align:center;} .fx-img img{max-height:9em;max-width:100%;border-radius:.4em;background:#fff;}',
    '.fx-wm{position:absolute;right:2.2%;bottom:3%;display:flex;align-items:center;gap:.35em;font-weight:800;font-size:.8em;color:rgba(255,255,255,.75);letter-spacing:.02em;}',
    '.fx-wm img{width:1.6em;height:1.6em;} .fx-wm b{color:#c9a25f;}',
    '.fx-cap{position:absolute;left:8%;right:8%;bottom:9%;text-align:center;font-size:.86em;line-height:1.4;background:rgba(0,0,0,.55);padding:.3em .7em;border-radius:.4em;}',
    '.fx-title{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:.4em;padding:0 8%;}',
    '.fx-title img{width:4.2em;height:4.2em;} .fx-title .k{color:#c9a25f;font-weight:800;letter-spacing:.14em;font-size:.82em;}',
    '.fx-title h1{font-family:Literata,Georgia,serif;font-size:2.1em;margin:.1em 0;color:#fff;line-height:1.2;}',
    '.fx-title .s{color:#cbd5e1;font-size:.95em;}',
    '.fx-bar{display:flex;align-items:center;gap:8px;padding:8px 12px;border-top:1px solid #262a33;flex-wrap:wrap;}',
    '.fx-bar button{border:0;background:#1d212a;color:#f5f1e6;border-radius:8px;padding:7px 11px;cursor:pointer;font-weight:700;font-size:.88rem;}',
    '.fx-bar button.on{background:#c9a25f;color:#111;}',
    '.fx-prog{flex:1;min-width:120px;display:flex;gap:2px;height:8px;cursor:pointer;}',
    '.fx-prog i{flex:1;background:#2b303b;border-radius:3px;} .fx-prog i.d{background:#c9a25f;} .fx-prog i.c{background:#f5d48a;}',
    '.fx-time{font-size:.8rem;color:#9ca3af;min-width:74px;text-align:right;}',
    '.fx-yt{position:relative;width:100%;aspect-ratio:16/9;max-height:100%;background:#000;} .fx-yt iframe{position:absolute;inset:0;width:100%;height:100%;border:0;}',
    '.fx-box.fs .fx-yt{width:auto;height:100%;}',
    '.fx-notebar{padding:8px 14px;font-size:.86rem;color:#e5e7eb;background:#151922;border-top:1px solid #262a33;}',
    '.fx-btn-lesson{display:inline-flex;align-items:center;gap:6px;}'
  ].join('\n');
  function ensureCss(){ if(document.getElementById('fx-css')) return; var s = document.createElement('style'); s.id = 'fx-css'; s.textContent = CSS; document.head.appendChild(s); }

  // ------------------------------------------------------------ trình phát
  function LessonPlayer(props){
    var h = React.createElement, L = props.lesson || {};
    ensureCss();
    var isYt = L.kind === 'youtube';
    var parsed = React.useMemo(function(){ return isYt ? null : parseScript(L.script); }, [L.id, L.script]);
    var steps = parsed ? parsed.steps : [];
    var total = steps.length + 2; // + thẻ mở đầu + thẻ kết
    var st = React.useState(0); var idx = st[0], setIdx = st[1];          // 0 = thẻ mở đầu, 1..n = bước, n+1 = kết
    var pl = React.useState(!isYt); var playing = pl[0], setPlaying = pl[1];
    var rt = React.useState(function(){ try{ return Number(localStorage.getItem('fx-rate')) || 1; }catch(e){ return 1; } }); var rate = rt[0], setRate = rt[1];
    var mu = React.useState(false); var muted = mu[0], setMuted = mu[1];
    var cc = React.useState(true); var caps = cc[0], setCaps = cc[1];
    var fsS = React.useState(false); var fs = fsS[0], setFs = fsS[1];
    var boxRef = React.useRef(null), stageRef = React.useRef(null);
    var fz = React.useState(16); var fontPx = fz[0], setFontPx = fz[1];
    var seen = React.useRef({ max: 0, done: false });
    // cỡ chữ theo bề rộng khung (giống video co giãn)
    React.useEffect(function(){
      if(isYt) return;
      function fit(){ var el = stageRef.current; if(el) setFontPx(Math.max(10, el.clientWidth / 44)); }
      fit(); var ro = window.ResizeObserver ? new ResizeObserver(fit) : null; if(ro && stageRef.current) ro.observe(stageRef.current);
      window.addEventListener('resize', fit);
      return function(){ if(ro) ro.disconnect(); window.removeEventListener('resize', fit); };
    }, [fs]);
    // phát: đọc lời của bước hiện tại rồi tự sang bước sau
    React.useEffect(function(){
      if(isYt || !playing) return;
      var cancelled = false, timer = 0;
      var synth = window.speechSynthesis;
      function next(){ if(cancelled) return; setIdx(function(i){ return i + 1 < total ? i + 1 : i; }); if(idx + 1 >= total - 1) {} }
      if(idx >= total - 1){ setPlaying(false); return; }
      var step = idx === 0 ? { say: (L.title || '') + '. Bài giảng của FaradayAI.', pause: 600 } : steps[idx - 1];
      seen.current.max = Math.max(seen.current.max, idx);
      var say = step && step.say;
      var canSpeak = !muted && synth && say && (viVoice || pickVoice());
      if(canSpeak){
        try{
          synth.cancel();
          var u = new SpeechSynthesisUtterance(say); u.lang = 'vi-VN'; if(viVoice) u.voice = viVoice; u.rate = rate;
          var fired = false;
          u.onend = function(){ if(fired) return; fired = true; timer = setTimeout(next, 350 + (step.pause || 0)); };
          u.onerror = function(){ if(fired) return; fired = true; timer = setTimeout(next, durMs(step, rate)); };
          synth.speak(u);
          // lưới an toàn (một số trình duyệt không gọi onend)
          timer = setTimeout(function(){ if(!fired){ fired = true; next(); } }, durMs(step, rate) * 2.2 + 4000);
        }catch(e){ timer = setTimeout(next, durMs(step, rate)); }
      } else timer = setTimeout(next, durMs(step || {}, rate));
      return function(){ cancelled = true; clearTimeout(timer); try{ if(synth) synth.cancel(); }catch(e){} };
    }, [idx, playing, muted, rate]);
    React.useEffect(function(){ return function(){ try{ window.speechSynthesis && window.speechSynthesis.cancel(); }catch(e){} }; }, []);
    React.useEffect(function(){
      if(!isYt && idx >= total - 1 && !seen.current.done){ seen.current.done = true; if(props.onDone) props.onDone(L); }
    }, [idx]);
    React.useEffect(function(){
      function onKey(e){
        if(e.key === 'Escape'){ if(fs) setFs(false); else props.onClose(); }
        else if(!isYt && e.key === ' '){ e.preventDefault(); setPlaying(function(p){ return !p; }); }
        else if(!isYt && e.key === 'ArrowRight') setIdx(function(i){ return Math.min(total - 1, i + 1); });
        else if(!isYt && e.key === 'ArrowLeft') setIdx(function(i){ return Math.max(0, i - 1); });
      }
      window.addEventListener('keydown', onKey); return function(){ window.removeEventListener('keydown', onKey); };
    }, [fs, total]);
    function toggleFs(){
      var el = boxRef.current, iOS = /iP(ad|hone|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if(!fs){ setFs(true); if(!iOS && el && el.requestFullscreen) el.requestFullscreen().catch(function(){}); }
      else { setFs(false); if(document.fullscreenElement) document.exitFullscreen().catch(function(){}); }
    }
    React.useEffect(function(){ function onCh(){ if(!document.fullscreenElement) setFs(false); } document.addEventListener('fullscreenchange', onCh); return function(){ document.removeEventListener('fullscreenchange', onCh); }; }, []);

    var logo = h('img', { src: '/logo-mark.svg', alt: '' });
    var head = h('div', { className: 'fx-head' }, logo,
      h('div', { className: 't' }, L.title || 'Bài giảng'),
      h('span', { className: 'b' }, isYt ? 'FARADAYAI · ỨNG DỤNG THỰC TẾ' : 'FARADAYAI · BÀI GIẢNG'),
      h('button', { type: 'button', className: 'fx-x', onClick: toggleFs, title: 'Toàn màn hình' }, fs ? '🗗' : '⛶'),
      h('button', { type: 'button', className: 'fx-x', onClick: props.onClose, title: 'Đóng (Esc)' }, '✕'));

    var body;
    if(isYt){
      var vid = L.youtubeId || youtubeId(L.url);
      var s0 = parseTime(L.start), e0 = parseTime(L.end);
      var src = vid ? ('https://www.youtube-nocookie.com/embed/' + vid + '?rel=0&modestbranding=1&playsinline=1&autoplay=1' + (s0 ? '&start=' + Math.floor(s0) : '') + (e0 ? '&end=' + Math.floor(e0) : '')) : '';
      body = h('div', { className: 'fx-stage-wrap' },
        vid ? h('div', { className: 'fx-yt' }, h('iframe', { src: src, title: L.title || 'Video', allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowFullScreen: true })) :
          h('p', { style: { padding: '30px', color: '#fca5a5' } }, 'Link YouTube chưa đúng.'));
    } else {
      var sc = null, upto = 0, isTitle = idx === 0, isEnd = idx >= total - 1;
      if(!isTitle && !isEnd){ var stp = steps[idx - 1]; sc = parsed.scenes[stp.scene]; upto = stp.upto; }
      var bm = window.OPC_NANO && L.baiKey ? window.OPC_NANO.getBai(L.baiKey) : null;
      var stage;
      if(isTitle) stage = h('div', { className: 'fx-title' }, h('img', { src: '/logo-mark.svg', alt: '' }), h('div', { className: 'k' }, 'FARADAYAI · ÔN LÝ THUYẾT'), h('h1', null, L.title || ''), h('div', { className: 's' }, bm ? bm.name : ''));
      else if(isEnd) stage = h('div', { className: 'fx-title' }, h('img', { src: '/logo-mark.svg', alt: '' }), h('div', { className: 'k' }, 'HẾT BÀI GIẢNG'), h('h1', null, 'Giờ mình luyện vài câu nhé!'),
        h('div', { className: 's' }, 'Xem lại bất cứ lúc nào trong mục 📺 Video ôn lý thuyết.'));
      else stage = h('div', { className: 'fx-scene' },
        sc.title ? h('h2', null, sc.title) : null,
        sc.items.map(function(it, i){
          var cls = 'fx-it ' + (i < upto ? 'on' : '') + (i === upto - 1 ? ' cur' : '');
          if(it.t === 'math') return h('div', { key: i, className: cls + ' fx-math', dangerouslySetInnerHTML: { __html: mathHtml(it.v, true) } });
          if(it.t === 'img') return h('div', { key: i, className: cls + ' fx-img' }, h('img', { src: it.v, alt: '' }));
          return h('div', { key: i, className: cls + ' fx-' + it.t, dangerouslySetInnerHTML: { __html: richHtml(it.v) } });
        }));
      var curSay = isTitle ? '' : (!isEnd && steps[idx - 1] ? steps[idx - 1].say : '');
      body = h('div', { className: 'fx-stage-wrap' },
        h('div', { className: 'fx-stage', ref: stageRef, style: { fontSize: fontPx + 'px' }, onClick: function(){ setPlaying(!playing); } },
          stage,
          (caps && curSay) ? h('div', { className: 'fx-cap' }, curSay) : null,
          h('div', { className: 'fx-wm' }, h('img', { src: '/logo-mark.svg', alt: '' }), h('span', null, 'Faraday', h('b', null, 'AI')))));
    }
    var bar = isYt ? null : (function(){
      var tSec = 0, curSec = 0;
      steps.forEach(function(s, i){ var d = durMs(s, rate) / 1000; tSec += d; if(i < idx - 1) curSec += d; });
      return h('div', { className: 'fx-bar' },
        h('button', { type: 'button', onClick: function(){ setIdx(Math.max(0, idx - 1)); }, title: 'Bước trước (←)' }, '⏮'),
        h('button', { type: 'button', className: 'on', onClick: function(){ if(idx >= total - 1){ setIdx(0); setPlaying(true); } else setPlaying(!playing); }, title: 'Phát / dừng (Space)' }, idx >= total - 1 ? '↻ Xem lại' : (playing ? '⏸ Dừng' : '▶ Phát')),
        h('button', { type: 'button', onClick: function(){ setIdx(Math.min(total - 1, idx + 1)); }, title: 'Bước sau (→)' }, '⏭'),
        h('div', { className: 'fx-prog', title: 'Bấm để tua' }, Array.apply(null, Array(total)).map(function(_, i){ return h('i', { key: i, className: i < idx ? 'd' : (i === idx ? 'c' : ''), onClick: function(){ setIdx(i); } }); })),
        h('span', { className: 'fx-time' }, fmtTime(curSec) + ' / ' + fmtTime(tSec)),
        h('button', { type: 'button', onClick: function(){ var r = rate >= 1.25 ? 0.85 : (rate >= 1 ? 1.25 : 1); setRate(r); try{ localStorage.setItem('fx-rate', r); }catch(e){} }, title: 'Tốc độ đọc' }, rate + '×'),
        h('button', { type: 'button', className: caps ? 'on' : '', onClick: function(){ setCaps(!caps); }, title: 'Phụ đề' }, 'CC'),
        h('button', { type: 'button', onClick: function(){ setMuted(!muted); }, title: muted ? 'Bật tiếng' : 'Tắt tiếng' }, muted ? '🔇' : '🔊'),
        (!viVoice && !muted) ? h('span', { style: { fontSize: '.74rem', color: '#9ca3af', flexBasis: '100%' } }, 'Máy này chưa có giọng đọc tiếng Việt — bài giảng chạy kèm phụ đề. (Điện thoại/iPad và Chrome thường có sẵn giọng Việt.)') : null);
    })();
    var note = L.note ? h('div', { className: 'fx-notebar' }, '📝 ', L.note) : null;
    return h('div', { className: 'fx-ov', onClick: function(e){ if(e.target === e.currentTarget && !fs) props.onClose(); } },
      h('div', { className: 'fx-box' + (fs ? ' fs' : ''), ref: boxRef }, head, body, bar, note));
  }

  // mở trình phát ở bất cứ đâu (không cần chỗ chứa trong cây React của trang)
  var hostEl = null;
  function openLesson(lesson, opts){
    if(!React || !ReactDOM || !lesson) return;
    if(!hostEl){ hostEl = document.createElement('div'); hostEl.id = 'fx-host'; document.body.appendChild(hostEl); }
    opts = opts || {};
    function close(){ try{ ReactDOM.unmountComponentAtNode(hostEl); }catch(e){} if(opts.onClose) opts.onClose(); }
    ReactDOM.render(React.createElement(LessonPlayer, { lesson: lesson, onClose: close, onDone: opts.onDone }), hostEl);
    if(opts.onOpen) opts.onOpen(lesson);
  }

  // ------------------------------------------------------------ thư viện + ghép câu hỏi ↔ bài giảng
  var registry = [];
  var listeners = [];
  function setLessons(list){ registry = (list || []).filter(function(l){ return l && l.published !== false; }); listeners.forEach(function(f){ try{ f(registry); }catch(e){} }); }
  function onLessons(f){ listeners.push(f); return function(){ listeners = listeners.filter(function(x){ return x !== f; }); }; }
  function lessonsFor(q, list){
    list = list || registry; if(!q) return [];
    var nanos = (q.nanoIds && q.nanoIds.length) ? q.nanoIds : (q.nanoId ? [q.nanoId] : []);
    var bai = q.baiKey || '';
    var scored = list.map(function(l){
      var s = 0;
      if(nanos.length && (l.nanoIds || []).some(function(n){ return nanos.indexOf(n) > -1; })) s += 3;
      if(bai && l.baiKey === bai) s += 2;
      if(!s && q.topicKey && l.chuDeKey === q.topicKey && !l.baiKey) s += 1;
      return { l: l, s: s };
    }).filter(function(x){ return x.s > 0; }).sort(function(a, b){ return b.s - a.s || ((a.l.kind === 'faraday' ? 0 : 1) - (b.l.kind === 'faraday' ? 0 : 1)); });
    return scored.map(function(x){ return x.l; });
  }
  // nút "📺 Ôn lý thuyết" dưới câu hỏi (prepscholar-ui gọi: OPC_FX.lessonButton(h, q, wrong))
  function lessonButton(h, q, wrong){
    var ls = lessonsFor(q); if(!ls.length) return null;
    var fx = ls.filter(function(l){ return l.kind !== 'youtube'; })[0], yt = ls.filter(function(l){ return l.kind === 'youtube'; })[0];
    return h('div', { className: 'ps-wt-row', style: { margin: '0 0 12px', display: 'flex', gap: '8px', flexWrap: 'wrap' } },
      fx ? h('button', { type: 'button', className: 'btn ' + (wrong ? 'btn-primary' : 'btn-secondary') + ' fx-btn-lesson', style: { fontSize: '0.86rem' }, onClick: function(){ openLesson(fx, { onOpen: track }); } }, '📺 Ôn lý thuyết: ' + fx.title) : null,
      yt ? h('button', { type: 'button', className: 'btn btn-secondary fx-btn-lesson', style: { fontSize: '0.86rem' }, onClick: function(){ openLesson(yt, { onOpen: track }); } }, '🎬 Ứng dụng thực tế') : null);
  }
  var trackFn = null;
  function track(l){ if(trackFn) try{ trackFn(l); }catch(e){} }

  // ------------------------------------------------------------ giấy khen (PNG)
  var logoImgP = null;
  function loadLogo(){
    if(!logoImgP) logoImgP = new Promise(function(ok){ var im = new Image(); im.onload = function(){ ok(im); }; im.onerror = function(){ ok(null); }; im.src = '/logo-mark.svg'; });
    return logoImgP;
  }
  function wrapText(ctx, text, maxW){
    var words = String(text || '').split(/\s+/), lines = [], cur = '';
    words.forEach(function(w){ var t = cur ? cur + ' ' + w : w; if(ctx.measureText(t).width > maxW && cur){ lines.push(cur); cur = w; } else cur = t; });
    if(cur) lines.push(cur); return lines;
  }
  // c = { name, award ('progress'|'top'|'complete'), examTitle, score, delta, rank, of, date, signer, note }
  async function makeCertificate(c){
    var W = 1600, H = 1130, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var x = cv.getContext('2d');
    try{ if(document.fonts && document.fonts.load){ await Promise.all([document.fonts.load('700 40px Literata'), document.fonts.load('700 40px "Be Vietnam Pro"')]); } }catch(e){}
    var SERIF = 'Literata, "Times New Roman", serif', SANS = '"Be Vietnam Pro", Arial, sans-serif';
    // nền
    var g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#f6ecd6');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // hoạ tiết đường sức (logo) mờ phía sau
    x.save(); x.globalAlpha = 0.06; x.strokeStyle = '#a07a33'; x.lineWidth = 6;
    for(var k = 0; k < 7; k++){ x.beginPath(); x.ellipse(W / 2, H / 2 + 40, 240 + k * 70, 300 + k * 80, 0, 0, Math.PI * 2); x.stroke(); }
    x.restore();
    // khung đôi
    x.strokeStyle = '#b88a3e'; x.lineWidth = 10; x.strokeRect(38, 38, W - 76, H - 76);
    x.strokeStyle = '#d9b97a'; x.lineWidth = 3; x.strokeRect(62, 62, W - 124, H - 124);
    // logo + thương hiệu
    var logo = await loadLogo();
    if(logo){ x.drawImage(logo, W / 2 - 46, 96, 92, 92); }
    x.textAlign = 'center'; x.fillStyle = '#1c1a17';
    x.font = '800 30px ' + SANS; x.fillText('FARADAY', W / 2 - 22, 232); var fw = x.measureText('FARADAY').width;
    x.fillStyle = '#b88a3e'; x.textAlign = 'left'; x.fillText('AI', W / 2 - 22 + fw / 2 + 4, 232); x.textAlign = 'center';
    x.fillStyle = '#6b6457'; x.font = '500 22px ' + SANS; x.fillText('Luyện thi Vật lí 12 · faradayai.vn', W / 2, 266);
    // tiêu đề
    var award = c.award || 'complete';
    var TITLE = award === 'progress' ? 'GIẤY KHEN TIẾN BỘ' : (award === 'top' ? 'GIẤY KHEN' : 'GIẤY CHỨNG NHẬN');
    x.fillStyle = '#8a5a12'; x.font = '700 76px ' + SERIF; x.fillText(TITLE, W / 2, 380);
    x.fillStyle = '#4b463d'; x.font = '400 28px ' + SANS; x.fillText('FaradayAI trân trọng ' + (award === 'complete' ? 'chứng nhận' : 'khen tặng'), W / 2, 438);
    // tên
    x.fillStyle = '#14110d'; var nfs = 92; x.font = '700 ' + nfs + 'px ' + SERIF;
    while(x.measureText(c.name || '').width > W - 360 && nfs > 50){ nfs -= 4; x.font = '700 ' + nfs + 'px ' + SERIF; }
    x.fillText(c.name || '', W / 2, 548);
    x.strokeStyle = '#d9b97a'; x.lineWidth = 2; x.beginPath(); x.moveTo(W / 2 - 360, 578); x.lineTo(W / 2 + 360, 578); x.stroke();
    // lí do
    var reason = award === 'progress' ? ('Đã có bước tiến vượt bậc' + (c.delta != null ? ': tăng +' + fmt2(c.delta) + ' điểm so với kỳ trước' : ''))
      : (award === 'top' ? ('Đạt thành tích ' + (c.rank ? 'hạng ' + c.rank + (c.of ? '/' + c.of : '') : 'xuất sắc')) : 'Đã hoàn thành');
    x.fillStyle = '#2b2720'; x.font = '500 34px ' + SANS;
    wrapText(x, reason, W - 420).forEach(function(l, i){ x.fillText(l, W / 2, 648 + i * 46); });
    x.font = '400 30px ' + SANS; x.fillStyle = '#4b463d';
    var line2 = (c.examTitle || 'Kỳ thi thử') + (c.score != null ? ' — ' + fmt2(c.score) + ' điểm' : '');
    wrapText(x, line2, W - 420).forEach(function(l, i){ x.fillText(l, W / 2, 712 + i * 42); });
    if(c.note){ x.font = 'italic 400 26px ' + SERIF; x.fillStyle = '#6b6457'; wrapText(x, '“' + c.note + '”', W - 520).forEach(function(l, i){ x.fillText(l, W / 2, 790 + i * 36); }); }
    // huy hiệu
    x.save(); x.translate(250, 880);
    x.fillStyle = award === 'progress' ? '#16a34a' : '#b88a3e';
    x.beginPath(); for(var a = 0; a < 24; a++){ var r = a % 2 ? 78 : 92, ang = a / 24 * Math.PI * 2; x.lineTo(Math.cos(ang) * r, Math.sin(ang) * r); } x.closePath(); x.fill();
    x.fillStyle = '#fff'; x.font = '800 30px ' + SANS; x.textAlign = 'center';
    x.fillText(award === 'progress' ? '+' + fmt2(c.delta || 0) : (c.rank ? '#' + c.rank : '✓'), 0, 6);
    x.font = '700 15px ' + SANS; x.fillText(award === 'progress' ? 'TIẾN BỘ' : (award === 'top' ? 'XUẤT SẮC' : 'HOÀN THÀNH'), 0, 34);
    x.restore();
    // ngày + chữ ký
    x.textAlign = 'center'; x.fillStyle = '#4b463d'; x.font = '400 24px ' + SANS;
    x.fillText(c.date || new Date().toLocaleDateString('vi-VN'), W - 380, 860);
    x.font = '700 26px ' + SANS; x.fillStyle = '#2b2720'; x.fillText(c.signer || 'Giáo viên phụ trách', W - 380, 960);
    x.strokeStyle = '#b88a3e'; x.lineWidth = 2; x.beginPath(); x.moveTo(W - 520, 920); x.lineTo(W - 240, 920); x.stroke();
    x.font = '400 18px ' + SANS; x.fillStyle = '#8b8477'; x.fillText('Mã xác nhận: ' + (c.code || Math.random().toString(36).slice(2, 8).toUpperCase()), W / 2, H - 92);
    return cv;
  }
  function fmt2(n){ return (Math.round(Number(n) * 100) / 100).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
  async function downloadCertificate(c, fileName){
    var cv = await makeCertificate(c);
    var name = (fileName || ('giay-khen-' + String(c.name || 'hoc-sinh').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9]+/g, '-'))) + '.png';
    return new Promise(function(ok){
      cv.toBlob(function(blob){
        var file = null; try{ file = new File([blob], name, { type: 'image/png' }); }catch(e){}
        if(file && navigator.canShare && navigator.canShare({ files: [file] }) && /Mobi|iPad|iPhone|Android/i.test(navigator.userAgent)){
          navigator.share({ files: [file], title: 'Giấy khen FaradayAI' }).catch(function(){}).then(function(){ ok(true); });
          return;
        }
        var url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function(){ URL.revokeObjectURL(url); }, 4000); ok(true);
      }, 'image/png');
    });
  }

  // ------------------------------------------------------------ BÀI GIẢNG MẪU (Claude soạn, 23/10/2026)
  var SEED_LESSONS = [
    { seedKey: 'claude-nhiet-2', kind: 'faraday', chuDeKey: 'nhiet', baiKey: 'nhiet-2', nanoIds: [], title: 'Nội năng và Định luật I nhiệt động lực học', level: 'co-ban',
      script: [
        '# Nội năng là gì?',
        '> Chào em! Hôm nay mình ôn nhanh nội năng và định luật một của nhiệt động lực học.',
        '- Nội năng $U$ = tổng động năng chuyển động nhiệt và thế năng tương tác của các phân tử.',
        '- Động năng phân tử phụ thuộc **nhiệt độ**; thế năng tương tác phụ thuộc **thể tích**.',
        '> Vậy nội năng phụ thuộc vào nhiệt độ và thể tích của vật.',
        '! Khí lí tưởng bỏ qua tương tác → nội năng chỉ phụ thuộc nhiệt độ.',
        '# Hai cách làm thay đổi nội năng',
        '- **Thực hiện công**: cọ xát, nén khí… ($A$)',
        '- **Truyền nhiệt**: cho tiếp xúc vật nóng hơn ($Q$)',
        '> Có hai cách: thực hiện công, và truyền nhiệt.',
        '# Định luật I',
        '$$\\Delta U = A + Q$$',
        '> Độ biến thiên nội năng bằng tổng công và nhiệt lượng mà vật nhận được.',
        '- $A > 0$: vật **nhận** công · $A < 0$: vật **thực hiện** công',
        '- $Q > 0$: vật **nhận** nhiệt · $Q < 0$: vật **toả** nhiệt',
        '! Quy ước dấu là chỗ hay sai nhất — luôn hỏi: vật NHẬN hay CHO?',
        '? Khí nhận 100 J nhiệt và sinh công 40 J. Nội năng tăng bao nhiêu?',
        '> Thử nghĩ nhé. Q bằng cộng một trăm, A bằng trừ bốn mươi, nên đen ta U bằng sáu mươi jun.'
      ].join('\n') },
    { seedKey: 'claude-nhiet-4', kind: 'faraday', chuDeKey: 'nhiet', baiKey: 'nhiet-4', nanoIds: [], title: 'Nhiệt lượng: nhiệt dung riêng, nóng chảy, hoá hơi', level: 'co-ban',
      script: [
        '# Ba công thức nhiệt lượng',
        '> Bài này em cần nhớ ba công thức nhiệt lượng, dùng cho ba tình huống khác nhau.',
        '$$Q = mc\\,\\Delta t$$',
        '> Khi vật nóng lên hoặc lạnh đi mà không chuyển thể: Q bằng m nhân c nhân đen ta t.',
        '$$Q = \\lambda m$$',
        '> Khi nóng chảy hoặc đông đặc ở nhiệt độ không đổi: Q bằng lam-đa nhân m.',
        '$$Q = L m$$',
        '> Khi hoá hơi hoặc ngưng tụ: Q bằng L nhân m.',
        '! Trong lúc chuyển thể, nhiệt độ KHÔNG đổi — đừng dùng $mc\\Delta t$ cho đoạn này.',
        '# Bài toán đun nước đá thành hơi',
        '- Đoạn 1: nước đá $-10^\\circ$C → $0^\\circ$C: $Q_1 = m c_{đá} \\Delta t$',
        '- Đoạn 2: nóng chảy ở $0^\\circ$C: $Q_2 = \\lambda m$',
        '- Đoạn 3: nước $0^\\circ$C → $100^\\circ$C: $Q_3 = m c_{nước} \\Delta t$',
        '- Đoạn 4: hoá hơi ở $100^\\circ$C: $Q_4 = L m$',
        '> Chia quá trình thành từng đoạn, tính nhiệt lượng từng đoạn rồi cộng lại.',
        '! Đổi khối lượng ra kg và để ý đơn vị J/kg của $\\lambda$, $L$.'
      ].join('\n') },
    { seedKey: 'claude-khi-2', kind: 'faraday', chuDeKey: 'khi', baiKey: 'khi-2', nanoIds: ['khi-2.1', 'khi-2.2'], title: 'Định luật Boyle — quá trình đẳng nhiệt', level: 'co-ban',
      script: [
        '# Quá trình đẳng nhiệt',
        '> Quá trình đẳng nhiệt là quá trình biến đổi trạng thái khi nhiệt độ được giữ không đổi.',
        '- Lượng khí xác định, nhiệt độ $T$ không đổi.',
        '# Định luật Boyle',
        '$$pV = \\text{hằng số} \\quad\\Rightarrow\\quad p_1V_1 = p_2V_2$$',
        '> Áp suất tỉ lệ nghịch với thể tích: nén khí lại một nửa thì áp suất tăng gấp đôi.',
        '- Thể tích giảm bao nhiêu lần thì áp suất tăng bấy nhiêu lần.',
        '# Đồ thị đẳng nhiệt',
        '- Trong hệ $(p, V)$: đường **hypebol**.',
        '- Trong hệ $(p, T)$ hoặc $(V, T)$: đường thẳng song song trục $p$ hoặc $V$ (vuông góc trục $T$).',
        '! Đường hypebol càng xa gốc toạ độ thì nhiệt độ càng cao.',
        '? Nén đẳng nhiệt khí từ 6 lít xuống 2 lít, áp suất thay đổi thế nào?',
        '> Thể tích giảm ba lần nên áp suất tăng ba lần.'
      ].join('\n') },
    { seedKey: 'claude-khi-3', kind: 'faraday', chuDeKey: 'khi', baiKey: 'khi-3', nanoIds: [], title: 'Định luật Charles — quá trình đẳng áp', level: 'co-ban',
      script: [
        '# Quá trình đẳng áp',
        '> Quá trình đẳng áp: áp suất giữ không đổi.',
        '$$\\frac{V}{T} = \\text{hằng số} \\quad\\Rightarrow\\quad \\frac{V_1}{T_1} = \\frac{V_2}{T_2}$$',
        '> Thể tích tỉ lệ thuận với nhiệt độ tuyệt đối.',
        '! $T$ phải là nhiệt độ **kelvin**: $T = t + 273$. Dùng độ C là sai ngay!',
        '# Đồ thị đẳng áp',
        '- Hệ $(V, T)$: đường thẳng **kéo dài đi qua gốc toạ độ**.',
        '- Hệ $(V, t)$: đường thẳng cắt trục nhiệt độ tại $-273^\\circ$C.',
        '> Nếu kéo dài đường thẳng về phía nhiệt độ thấp, nó cắt trục tại âm hai trăm bảy mươi ba độ C, chính là không độ tuyệt đối.',
        '? Khí ở $27^\\circ$C, nung đẳng áp đến $127^\\circ$C. Thể tích tăng bao nhiêu lần?',
        '> Đổi ra kelvin: ba trăm và bốn trăm. Thể tích tăng bốn phần ba lần, không phải gần năm lần.'
      ].join('\n') },
    { seedKey: 'claude-khi-4', kind: 'faraday', chuDeKey: 'khi', baiKey: 'khi-4', nanoIds: ['khi-4.1', 'khi-4.2'], title: 'Phương trình trạng thái khí lí tưởng', level: 'co-ban',
      script: [
        '# Phương trình trạng thái',
        '> Khi cả áp suất, thể tích và nhiệt độ cùng thay đổi, ta dùng phương trình trạng thái.',
        '$$\\frac{p_1V_1}{T_1} = \\frac{p_2V_2}{T_2}$$',
        '- Gộp cả ba định luật: Boyle ($T$ không đổi), Charles ($p$ không đổi), đẳng tích ($V$ không đổi).',
        '# Phương trình Clapeyron',
        '$$pV = nRT = \\frac{m}{M}RT$$',
        '> p V bằng n R T, với n là số mol, R bằng tám phẩy ba mốt.',
        '- $R = 8{,}31$ J/(mol·K) · $n$: số mol · $M$: khối lượng mol',
        '! Đơn vị SI: $p$ (Pa), $V$ (m³), $T$ (K). 1 lít = $10^{-3}$ m³.',
        '# Cách giải nhanh',
        '- Bước 1: liệt kê trạng thái 1 và trạng thái 2 ($p, V, T$).',
        '- Bước 2: đổi $T$ sang kelvin, các đơn vị cùng loại hai vế.',
        '- Bước 3: thay vào phương trình, giải ẩn.',
        '> Lập bảng hai trạng thái, đổi đơn vị, rồi thay số. Đây là cách làm chắc chắn nhất.'
      ].join('\n') },
    { seedKey: 'claude-khi-5', kind: 'faraday', chuDeKey: 'khi', baiKey: 'khi-5', nanoIds: [], title: 'Áp suất khí theo mô hình động học phân tử', level: 'nang-cao',
      script: [
        '# Áp suất do đâu mà có?',
        '> Áp suất chất khí sinh ra do vô số phân tử va chạm vào thành bình.',
        '$$p = \\frac{1}{3}\\mu\\, m_0\\, \\overline{v^2}$$',
        '- $\\mu$: mật độ phân tử (số phân tử/m³) · $m_0$: khối lượng 1 phân tử',
        '# Liên hệ với nhiệt độ',
        '$$\\overline{W_đ} = \\frac{3}{2}kT$$',
        '> Động năng trung bình của phân tử tỉ lệ với nhiệt độ tuyệt đối.',
        '- $k = 1{,}38\\cdot10^{-23}$ J/K (hằng số Boltzmann)',
        '$$v_{rms} = \\sqrt{\\frac{3RT}{M}}$$',
        '! $T$ tăng 4 lần → tốc độ căn quân phương tăng **2 lần** (căn bậc hai!).'
      ].join('\n') },
    { seedKey: 'claude-tt-2', kind: 'faraday', chuDeKey: 'tu-truong', baiKey: 'tt-2', nanoIds: [], title: 'Lực từ lên dây dẫn mang dòng điện. Cảm ứng từ', level: 'co-ban',
      script: [
        '# Lực từ',
        '> Dây dẫn mang dòng điện đặt trong từ trường sẽ chịu một lực từ.',
        '$$F = B I \\ell \\sin\\alpha$$',
        '- $\\alpha$: góc giữa dây dẫn (chiều dòng điện) và vectơ $\\vec B$.',
        '! Dây song song với đường sức ($\\alpha = 0$) → lực từ bằng 0.',
        '# Chiều lực từ — quy tắc bàn tay trái',
        '- Đặt bàn tay trái để đường sức từ **xuyên vào lòng bàn tay**.',
        '- Chiều từ cổ tay đến ngón giữa là **chiều dòng điện**.',
        '- Ngón cái choãi ra $90^\\circ$ chỉ **chiều lực từ**.',
        '> Bàn tay trái: từ xuyên lòng bàn tay, dòng điện theo ngón giữa, lực theo ngón cái.',
        '# Cảm ứng từ',
        '$$B = \\frac{F}{I\\ell\\sin\\alpha}$$',
        '- Đơn vị: tesla (T). Đặc trưng cho độ mạnh yếu của từ trường.'
      ].join('\n') },
    { seedKey: 'claude-tt-3', kind: 'faraday', chuDeKey: 'tu-truong', baiKey: 'tt-3', nanoIds: ['tt-3.1', 'tt-3.3'], title: 'Từ thông và hiện tượng cảm ứng điện từ', level: 'co-ban',
      script: [
        '# Từ thông',
        '$$\\Phi = B S \\cos\\alpha$$',
        '> Từ thông bằng B nhân S nhân cô-sin an-pha.',
        '- $\\alpha$: góc giữa $\\vec B$ và **pháp tuyến** $\\vec n$ của mặt (không phải góc với mặt phẳng!).',
        '- Đơn vị: vêbe (Wb). Khung có $N$ vòng: $\\Phi = NBS\\cos\\alpha$.',
        '! Đề cho góc giữa $\\vec B$ và mặt phẳng khung là $30^\\circ$ thì $\\alpha = 60^\\circ$.',
        '# Hiện tượng cảm ứng điện từ',
        '- Từ thông qua mạch kín **biến thiên** → xuất hiện dòng điện cảm ứng.',
        '$$e_c = -\\frac{\\Delta\\Phi}{\\Delta t}$$',
        '> Suất điện động cảm ứng bằng trừ đen ta phi trên đen ta t. Dấu trừ thể hiện định luật Len-xơ.',
        '# Định luật Lenz',
        '- Dòng cảm ứng có chiều sao cho từ trường nó sinh ra **chống lại** sự biến thiên của từ thông.',
        '> Từ thông tăng thì từ trường cảm ứng ngược chiều; từ thông giảm thì cùng chiều.',
        '? Nam châm tiến lại gần vòng dây: từ trường cảm ứng cùng hay ngược chiều từ trường nam châm?'
      ].join('\n') },
    { seedKey: 'claude-tt-7', kind: 'faraday', chuDeKey: 'tu-truong', baiKey: 'tt-7', nanoIds: [], title: 'Máy biến áp và truyền tải điện năng', level: 'co-ban',
      script: [
        '# Máy biến áp',
        '$$\\frac{U_2}{U_1} = \\frac{N_2}{N_1}$$',
        '> Tỉ số điện áp bằng tỉ số số vòng dây.',
        '- $N_2 > N_1$: máy **tăng áp** · $N_2 < N_1$: máy **hạ áp**',
        '- Máy lí tưởng: $U_1I_1 = U_2I_2$ → tăng áp thì dòng điện giảm.',
        '# Hao phí trên đường dây',
        '$$P_{hp} = \\frac{P^2 R}{U^2\\cos^2\\varphi}$$',
        '> Công suất hao phí tỉ lệ nghịch với bình phương điện áp truyền đi.',
        '! Tăng điện áp lên 10 lần → hao phí giảm **100 lần**.',
        '- Vì vậy điện được truyền đi xa ở điện áp rất cao (110 kV, 220 kV, 500 kV).'
      ].join('\n') },
    { seedKey: 'claude-hn-3', kind: 'faraday', chuDeKey: 'hat-nhan', baiKey: 'hn-3', nanoIds: [], title: 'Hiện tượng phóng xạ và định luật phân rã', level: 'co-ban',
      script: [
        '# Phóng xạ',
        '> Phóng xạ là quá trình hạt nhân không bền tự phát phân rã, phát ra các tia phóng xạ.',
        '- Tia $\\alpha$ (hạt nhân $^4_2$He), tia $\\beta^-$ (electron), tia $\\beta^+$ (pôzitron), tia $\\gamma$ (sóng điện từ).',
        '- Phóng xạ **không phụ thuộc** nhiệt độ, áp suất bên ngoài.',
        '# Định luật phóng xạ',
        '$$N = N_0\\, 2^{-t/T}$$',
        '> Sau mỗi chu kì bán rã T, số hạt nhân còn lại giảm một nửa.',
        '- Sau $t = 3T$: còn $\\frac{1}{8}N_0$, đã phân rã $\\frac{7}{8}N_0$.',
        '$$H = \\lambda N, \\quad \\lambda = \\frac{\\ln 2}{T}$$',
        '! Đề hỏi "đã phân rã" hay "còn lại" — đọc kĩ trước khi tính!'
      ].join('\n') }
  ];

  window.OPC_FX = {
    parseScript: parseScript, estimateSec: estimateSec, youtubeId: youtubeId, parseTime: parseTime, fmtTime: fmtTime,
    LessonPlayer: LessonPlayer, openLesson: openLesson,
    setLessons: setLessons, onLessons: onLessons, getLessons: function(){ return registry; }, lessonsFor: lessonsFor, lessonButton: lessonButton,
    setTracker: function(f){ trackFn = f; },
    makeCertificate: makeCertificate, downloadCertificate: downloadCertificate,
    SEED_LESSONS: SEED_LESSONS, richHtml: richHtml
  };
})(window);
