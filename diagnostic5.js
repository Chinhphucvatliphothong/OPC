/**
 * THÊM 15/10/2026 — "CHẨN ĐOÁN 5 PHÚT": phễu thu hút học sinh mới trên trang chủ faradayai.vn.
 *  • Khách KHÔNG cần đăng nhập: làm ~10 câu trắc nghiệm trong 5 phút (bộ câu do thầy chọn ở admin, tab "⚡ Chẩn đoán 5 phút",
 *    lưu settings/diagnostic5 — đọc công khai).
 *  • Xong bài thấy ngay điểm + mức hiện tại; để lại Họ tên + SĐT/Zalo thì mở BÁO CÁO CHI TIẾT (chuyên đề mạnh/yếu, lộ trình
 *    4 tuần gợi ý, xem lại đáp án) → lead ghi vào diag_leads cho thầy liên hệ.
 *  • Link quảng cáo / Facebook / Zalo: https://faradayai.vn/#chan-doan (tự mở). Gắn ?utm_source=facebook để biết nguồn.
 *  • Đếm lượt bắt đầu / hoàn thành / để lại liên hệ (diag_events) để đo tỉ lệ chuyển đổi.
 * Nút mở: mọi phần tử có thuộc tính data-diag-open, + nút nổi góc phải màn hình.
 */
(function(window, document){
  'use strict';
  var cfg = null, state = null, timerId = null, root = null, loadPromise = null;

  // ---------------- tiện ích ----------------
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function texText(t){
    return esc(t)
      .replace(/\\textbf\{([^{}]*)\}/g, '<b>$1</b>')
      .replace(/\\textit\{([^{}]*)\}|\\emph\{([^{}]*)\}/g, function(m, a, b){ return '<i>' + (a || b || '') + '</i>'; })
      .replace(/\\begin\{center\}|\\end\{center\}|\\noindent|\\centering/g, '')
      .replace(/\\\\(\s*)/g, '<br>')
      .replace(/\{,\}/g, ',').replace(/\\%/g, '%').replace(/~/g, ' ')
      .replace(/\\(dots|ldots)\b/g, '…')
      .replace(/\\[a-zA-Z]+\*?/g, '')
      .replace(/[{}]/g, '');
  }
  function renderTex(str){
    var s = String(str || ''), out = '', re = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$]+?)\$|\\\(([\s\S]+?)\\\)/g, last = 0, m;
    while((m = re.exec(s)) !== null){
      out += texText(s.slice(last, m.index));
      var math = m[1] || m[2] || m[3] || m[4] || '', disp = !!(m[1] || m[2]);
      try{ out += window.katex ? window.katex.renderToString(math, { throwOnError: false, displayMode: disp }) : esc(math); }
      catch(e){ out += esc(math); }
      last = re.lastIndex;
    }
    return out + texText(s.slice(last));
  }
  function fmtTime(sec){ sec = Math.max(0, Math.floor(sec)); return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2); }
  function waitLive(ms){
    if(window.OPC_LIVE && window.OPC_LIVE.loadDiagnostic5) return Promise.resolve(window.OPC_LIVE);
    return new Promise(function(resolve){
      var done = false;
      function ok(){ if(done) return; done = true; window.removeEventListener('opc-live-ready', ok); resolve(window.OPC_LIVE || null); }
      window.addEventListener('opc-live-ready', ok);
      setTimeout(ok, ms || 6000);
    });
  }
  function load(){
    if(!loadPromise){
      loadPromise = waitLive(8000).then(function(live){
        if(!live || !live.loadDiagnostic5) return null;
        return live.loadDiagnostic5();
      }).then(function(r){
        cfg = (r && r.ok && r.data && (r.data.questions || []).length) ? r.data : null;
        return cfg;
      }).catch(function(){ cfg = null; return null; });
    }
    return loadPromise;
  }
  function log(type, score){ try{ if(window.OPC_LIVE && window.OPC_LIVE.logDiagEvent) window.OPC_LIVE.logDiagEvent(type, score); }catch(e){} }

  // ---------------- giao diện ----------------
  var CSS = '' +
    '.dg-ov{position:fixed;inset:0;z-index:9999;background:rgba(10,13,18,.62);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px 12px;}' +
    '.dg-box{position:relative;width:100%;max-width:680px;background:var(--surface,#fff);color:var(--ink,#12161c);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.35);padding:22px 20px 20px;font-family:"Be Vietnam Pro",system-ui,sans-serif;}' +
    '.dg-x{position:absolute;top:10px;right:12px;border:0;background:transparent;font-size:1.5rem;line-height:1;cursor:pointer;color:var(--ink-2,#4a5262);padding:4px 8px;}' +
    '.dg-kick{font-size:.74rem;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:var(--accent-strong,#8f5714);}' +
    '.dg-h{font-size:1.35rem;font-weight:800;margin:6px 0 8px;line-height:1.3;}' +
    '.dg-p{font-size:.95rem;line-height:1.6;color:var(--ink-2,#4a5262);margin:0 0 10px;}' +
    '.dg-list{margin:10px 0 16px;padding:0;list-style:none;}' +
    '.dg-list li{padding:6px 0 6px 28px;position:relative;font-size:.95rem;line-height:1.5;}' +
    '.dg-list li:before{content:"✓";position:absolute;left:4px;top:6px;color:var(--good,#0ca30c);font-weight:800;}' +
    '.dg-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;border-radius:10px;padding:12px 18px;font:700 .98rem "Be Vietnam Pro",system-ui,sans-serif;cursor:pointer;background:var(--accent,#a86a1c);color:var(--accent-ink,#fffaf1);text-decoration:none;}' +
    '.dg-btn:disabled{opacity:.55;cursor:default;}' +
    '.dg-btn.ghost{background:var(--surface-2,#eceee5);color:var(--ink,#12161c);}' +
    '.dg-btn.zalo{background:#0068ff;color:#fff;}' +
    '.dg-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;}' +
    '.dg-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:2px 34px 10px 0;}' +
    '.dg-prog{flex:1;height:6px;background:var(--surface-2,#eceee5);border-radius:99px;overflow:hidden;}' +
    '.dg-prog i{display:block;height:100%;background:var(--accent,#a86a1c);transition:width .25s;}' +
    '.dg-time{font:800 1rem ui-monospace,Menlo,monospace;padding:4px 10px;border-radius:8px;background:var(--surface-2,#eceee5);}' +
    '.dg-time.low{background:#fde2e2;color:#b91c1c;}' +
    '.dg-qn{font-size:.82rem;color:var(--ink-2,#4a5262);font-weight:700;margin-bottom:6px;}' +
    '.dg-stem{font-size:1rem;line-height:1.65;margin-bottom:14px;overflow-x:auto;}' +
    '.dg-opt{display:flex;gap:10px;align-items:flex-start;width:100%;text-align:left;border:1.5px solid var(--line,#dde1d5);background:var(--surface,#fff);color:inherit;border-radius:10px;padding:11px 12px;margin-bottom:8px;cursor:pointer;font:inherit;font-size:.95rem;line-height:1.5;}' +
    '.dg-opt:hover{border-color:var(--accent,#a86a1c);}' +
    '.dg-opt.sel{border-color:var(--accent,#a86a1c);background:color-mix(in srgb,var(--accent,#a86a1c) 10%,var(--surface,#fff));}' +
    '.dg-opt b{flex:none;width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:var(--surface-2,#eceee5);font-size:.85rem;}' +
    '.dg-opt.sel b{background:var(--accent,#a86a1c);color:var(--accent-ink,#fff);}' +
    '.dg-dots{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0;}' +
    '.dg-dot{width:30px;height:30px;border-radius:8px;border:1.5px solid var(--line,#dde1d5);background:var(--surface,#fff);color:inherit;font:700 .8rem system-ui;cursor:pointer;}' +
    '.dg-dot.done{background:var(--surface-2,#eceee5);}' +
    '.dg-dot.cur{border-color:var(--accent,#a86a1c);}' +
    '.dg-score{display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin:8px 0 14px;}' +
    '.dg-ring{width:112px;height:112px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:800;flex:none;}' +
    '.dg-ring .big{font-size:2rem;line-height:1;}' +
    '.dg-ring .sm{font-size:.75rem;font-weight:600;opacity:.8;margin-top:4px;}' +
    '.dg-card{border:1px solid var(--line,#dde1d5);border-radius:12px;padding:14px;margin:12px 0;background:var(--surface,#fff);}' +
    '.dg-card h4{margin:0 0 8px;font-size:1rem;}' +
    '.dg-bar{display:grid;grid-template-columns:minmax(120px,1fr) 2fr 48px;gap:8px;align-items:center;font-size:.86rem;margin:6px 0;}' +
    '.dg-bar .tr{height:10px;background:var(--surface-2,#eceee5);border-radius:99px;overflow:hidden;}' +
    '.dg-bar .tr i{display:block;height:100%;border-radius:99px;}' +
    '.dg-lock{position:relative;}' +
    '.dg-lock .blur{filter:blur(5px);user-select:none;pointer-events:none;}' +
    '.dg-form{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;}' +
    '.dg-form label{display:block;font-size:.8rem;font-weight:700;margin-bottom:4px;}' +
    '.dg-form input,.dg-form select{width:100%;box-sizing:border-box;padding:10px 11px;border:1.5px solid var(--line,#dde1d5);border-radius:9px;font:inherit;font-size:.95rem;background:var(--surface,#fff);color:inherit;}' +
    '.dg-form .full{grid-column:1/-1;}' +
    '.dg-err{color:var(--critical,#d03b3b);font-size:.85rem;min-height:1.2em;margin-top:6px;}' +
    '.dg-note{font-size:.78rem;color:var(--muted,#868d7c);margin-top:8px;line-height:1.5;}' +
    '.dg-rv{border-top:1px solid var(--line,#dde1d5);padding:10px 0;font-size:.9rem;line-height:1.55;}' +
    '.dg-rv .tag{display:inline-block;font-size:.75rem;font-weight:700;padding:2px 8px;border-radius:99px;margin-right:6px;}' +
    '.dg-week{display:grid;grid-template-columns:76px 1fr;gap:8px;font-size:.9rem;line-height:1.5;padding:6px 0;border-top:1px dashed var(--line,#dde1d5);}' +
    '.dg-fab{position:fixed;right:16px;bottom:16px;z-index:900;border:0;border-radius:99px;padding:12px 16px;font:800 .92rem "Be Vietnam Pro",system-ui,sans-serif;background:var(--accent,#a86a1c);color:var(--accent-ink,#fffaf1);box-shadow:0 8px 24px rgba(0,0,0,.25);cursor:pointer;}' +
    'body.opc-app-mode .dg-fab,body.opc-app-mode [data-diag-open]{display:none !important;}' +
    '@media (max-width:560px){.dg-form{grid-template-columns:1fr;}.dg-box{padding:18px 14px;}.dg-bar{grid-template-columns:1fr 1.3fr 42px;}.dg-fab{right:12px;bottom:12px;padding:10px 14px;}}';

  function ensureStyle(){
    if(document.getElementById('dg-style')) return;
    var st = document.createElement('style'); st.id = 'dg-style'; st.textContent = CSS; document.head.appendChild(st);
  }
  function mount(html){
    ensureStyle();
    if(!root){
      root = document.createElement('div'); root.className = 'dg-ov'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
      root.addEventListener('click', function(e){ if(e.target === root) close(); });
      document.body.appendChild(root);
      document.documentElement.style.overflow = 'hidden';
    }
    root.innerHTML = '<div class="dg-box"><button class="dg-x" aria-label="Đóng" data-act="close">×</button>' + html + '</div>';
    root.scrollTop = 0;
    root.querySelectorAll('[data-act]').forEach(function(el){ el.addEventListener('click', onAct); });
  }
  function close(){
    if(state && state.phase === 'quiz' && !window.confirm('Thoát bài chẩn đoán? Kết quả đang làm sẽ không được lưu.')) return;
    if(timerId){ clearInterval(timerId); timerId = null; }
    if(root){ root.remove(); root = null; }
    document.documentElement.style.overflow = '';
    if(location.hash === '#chan-doan'){ try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){} }
    state = null;
  }

  function open(){
    ensureStyle();
    mount('<div class="dg-p" style="padding:30px 0;text-align:center">Đang tải bài chẩn đoán…</div>');
    load().then(function(c){
      if(!root) return;
      if(!c){ mount('<div class="dg-h">Bài chẩn đoán đang được cập nhật</div><p class="dg-p">Em quay lại sau ít phút nhé, hoặc để lại thông tin ở mục Đăng ký học để thầy liên hệ.</p><button class="dg-btn" data-act="toSignup">Đến mục đăng ký</button>'); return; }
      intro();
    });
  }
  function intro(){
    var n = cfg.questions.length, min = Number(cfg.minutes) || 5;
    state = { phase: 'intro' };
    mount(
      '<div class="dg-kick">Miễn phí · Không cần đăng ký</div>' +
      '<div class="dg-h">' + esc(cfg.title || 'Chẩn đoán Vật lí 12 trong 5 phút') + '</div>' +
      '<p class="dg-p">Làm nhanh ' + n + ' câu trắc nghiệm bám sát đề thi tốt nghiệp THPT — FaradayAI chấm ngay và chỉ ra em đang vững, đang hổng ở chuyên đề nào.</p>' +
      '<ul class="dg-list"><li>' + n + ' câu · ' + min + ' phút · làm trên điện thoại được</li><li>Biết ngay số câu đúng và mức hiện tại của em</li><li>Báo cáo chuyên đề mạnh/yếu + lộ trình ôn 4 tuần gợi ý riêng cho em</li></ul>' +
      '<div class="dg-row"><button class="dg-btn" data-act="start">⚡ Bắt đầu làm bài</button></div>' +
      '<p class="dg-note">Mẹo: chuẩn bị giấy nháp và máy tính cầm tay. Hết giờ hệ thống tự nộp bài.</p>');
  }
  function start(){
    var min = Number(cfg.minutes) || 5;
    state = { phase: 'quiz', i: 0, ans: {}, startAt: Date.now(), endAt: Date.now() + min * 60000 };
    log('start');
    renderQ();
    if(timerId) clearInterval(timerId);
    timerId = setInterval(tick, 500);
  }
  function tick(){
    if(!state || state.phase !== 'quiz'){ clearInterval(timerId); timerId = null; return; }
    var left = (state.endAt - Date.now()) / 1000;
    var el = root && root.querySelector('.dg-time');
    if(el){ el.textContent = '⏱ ' + fmtTime(left); el.classList.toggle('low', left < 60); }
    if(left <= 0) finish(true);
  }
  function renderQ(){
    var qs = cfg.questions, q = qs[state.i], n = qs.length, picked = state.ans[q.id];
    var left = (state.endAt - Date.now()) / 1000;
    var answered = Object.keys(state.ans).length;
    mount(
      '<div class="dg-top"><div class="dg-prog"><i style="width:' + Math.round(answered / n * 100) + '%"></i></div><span class="dg-time' + (left < 60 ? ' low' : '') + '">⏱ ' + fmtTime(left) + '</span></div>' +
      '<div class="dg-qn">Câu ' + (state.i + 1) + '/' + n + (q.topicName ? ' · ' + esc(q.topicName) : '') + '</div>' +
      '<div class="dg-stem">' + renderTex(q.stem) + '</div>' +
      (q.options || []).map(function(o){ return '<button class="dg-opt' + (picked === o.key ? ' sel' : '') + '" data-act="pick" data-k="' + esc(o.key) + '"><b>' + esc(o.key) + '</b><span>' + renderTex(o.text) + '</span></button>'; }).join('') +
      '<div class="dg-dots">' + qs.map(function(x, k){ return '<button class="dg-dot' + (state.ans[x.id] ? ' done' : '') + (k === state.i ? ' cur' : '') + '" data-act="go" data-k="' + k + '">' + (k + 1) + '</button>'; }).join('') + '</div>' +
      '<div class="dg-row" style="justify-content:space-between">' +
        '<button class="dg-btn ghost" data-act="prev"' + (state.i === 0 ? ' disabled' : '') + '>← Câu trước</button>' +
        (state.i < n - 1 ? '<button class="dg-btn" data-act="next">Câu tiếp →</button>' : '<button class="dg-btn" data-act="submit">Nộp bài ✓</button>') +
      '</div>');
  }
  function finish(auto){
    if(!state || state.phase !== 'quiz') return;
    if(!auto){
      var miss = cfg.questions.length - Object.keys(state.ans).length;
      if(miss > 0 && !window.confirm('Em còn ' + miss + ' câu chưa chọn đáp án. Nộp bài luôn?')) return;
    }
    if(timerId){ clearInterval(timerId); timerId = null; }
    var qs = cfg.questions, correct = 0, topics = {}, levels = {};
    qs.forEach(function(q){
      var ok = state.ans[q.id] === q.correctKey; if(ok) correct++;
      var tk = q.topicName || 'Khác';
      topics[tk] = topics[tk] || { right: 0, total: 0 }; topics[tk].total++; if(ok) topics[tk].right++;
      var lv = { M1: 'Nhận biết', M2: 'Thông hiểu', M3: 'Vận dụng', M4: 'Vận dụng cao' }[q.level] || 'Khác';
      levels[lv] = levels[lv] || { right: 0, total: 0 }; levels[lv].total++; if(ok) levels[lv].right++;
    });
    var topicList = Object.keys(topics).map(function(k){ return { name: k, right: topics[k].right, total: topics[k].total, pct: topics[k].right / topics[k].total }; })
      .sort(function(a, b){ return a.pct - b.pct; });
    state = {
      phase: 'result', ans: state.ans, auto: !!auto, correct: correct, total: qs.length,
      score10: Math.round(correct / qs.length * 100) / 10,
      seconds: Math.round((Date.now() - state.startAt) / 1000), topics: topicList, levels: levels, unlocked: false
    };
    log('finish', correct / qs.length * 100);
    renderResult();
  }
  function levelOf(s10){
    if(s10 >= 8.5) return { name: 'Giỏi', color: '#0ca30c', msg: 'Nền tảng rất tốt! Em cần luyện thêm câu vận dụng cao để chắc điểm 9+.' };
    if(s10 >= 7) return { name: 'Khá – Giỏi', color: '#2f7d32', msg: 'Em nắm khá chắc kiến thức. Vá vài chuyên đề còn hổng là bứt lên 8–9 điểm.' };
    if(s10 >= 5) return { name: 'Trung bình – Khá', color: '#b8790a', msg: 'Em đã có nền, nhưng còn mất điểm ở một số chuyên đề quan trọng.' };
    return { name: 'Cần củng cố nền tảng', color: '#d03b3b', msg: 'Đừng lo — lộ trình đúng chuyên đề sẽ giúp em tiến bộ rất nhanh trong vài tuần.' };
  }
  function barColor(p){ return p >= 0.8 ? '#0ca30c' : (p >= 0.5 ? '#e0a838' : '#d03b3b'); }
  function topicBars(list){
    return list.map(function(t){ return '<div class="dg-bar"><span>' + esc(t.name) + '</span><span class="tr"><i style="width:' + Math.max(4, Math.round(t.pct * 100)) + '%;background:' + barColor(t.pct) + '"></i></span><b style="text-align:right">' + t.right + '/' + t.total + '</b></div>'; }).join('');
  }
  function renderResult(){
    var r = state, lv = levelOf(r.score10);
    var weak = r.topics.filter(function(t){ return t.pct < 0.6; }), strong = r.topics.filter(function(t){ return t.pct >= 0.8; });
    var head =
      '<div class="dg-kick">Kết quả chẩn đoán' + (r.auto ? ' · hết giờ, tự nộp' : '') + '</div>' +
      '<div class="dg-score"><div class="dg-ring" style="background:' + lv.color + '1f;color:' + lv.color + ';border:4px solid ' + lv.color + '"><span class="big">' + r.correct + '/' + r.total + '</span><span class="sm">câu đúng</span></div>' +
      '<div style="flex:1;min-width:200px"><div class="dg-h" style="margin:0 0 4px">Mức hiện tại: ' + lv.name + '</div><p class="dg-p" style="margin:0">' + lv.msg + '</p>' +
      '<p class="dg-note">Thời gian làm: ' + fmtTime(r.seconds) + ' · Quy đổi thang 10: ' + String(r.score10).replace('.', ',') + '</p></div></div>';
    var report = '<div class="dg-card"><h4>📊 Theo chuyên đề</h4>' + topicBars(r.topics) + '</div>';
    if(!r.unlocked){
      mount(head +
        '<div class="dg-lock">' + '<div class="blur">' + report + '</div>' +
        '<div class="dg-card" style="position:relative;margin-top:-90px;box-shadow:0 10px 30px rgba(0,0,0,.18)">' +
          '<h4>🔓 Xem báo cáo chi tiết + lộ trình ôn 4 tuần cho em</h4>' +
          '<p class="dg-p" style="margin:0">Em có <b>' + weak.length + '</b> chuyên đề cần củng cố' + (strong.length ? ' và <b>' + strong.length + '</b> chuyên đề đã vững' : '') + '. Để lại thông tin để xem chi tiết — thầy có thể gửi thêm tài liệu ôn đúng phần em hổng qua Zalo.</p>' +
          '<div class="dg-form">' +
            '<div class="full"><label for="dg-name">Họ tên học sinh *</label><input id="dg-name" autocomplete="name" placeholder="Nguyễn Văn A"></div>' +
            '<div><label for="dg-phone">SĐT / Zalo (em hoặc phụ huynh) *</label><input id="dg-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="09xxxxxxxx"></div>' +
            '<div><label for="dg-grade">Đang học lớp</label><select id="dg-grade"><option>12</option><option>11</option><option>10</option><option>Khác</option></select></div>' +
            '<div><label for="dg-target">Mục tiêu điểm Vật lí</label><select id="dg-target"><option>7+</option><option selected>8+</option><option>9+</option><option>10</option></select></div>' +
            '<div><label for="dg-school">Trường (không bắt buộc)</label><input id="dg-school" placeholder="THPT …"></div>' +
            '<div style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden" aria-hidden="true"><input id="dg-web" tabindex="-1" autocomplete="off"></div>' +
          '</div>' +
          '<div class="dg-err" id="dg-err"></div>' +
          '<div class="dg-row" style="margin-top:6px"><button class="dg-btn" data-act="lead" id="dg-lead">Xem báo cáo chi tiết →</button></div>' +
          '<p class="dg-note">Thông tin chỉ dùng để thầy liên hệ tư vấn học tập cho em, không chia sẻ cho bên khác.</p>' +
        '</div></div>');
      return;
    }
    // ---- báo cáo đầy đủ ----
    var lvKeys = ['Nhận biết', 'Thông hiểu', 'Vận dụng', 'Vận dụng cao'].filter(function(k){ return r.levels[k]; });
    var levelBars = lvKeys.map(function(k){ var x = r.levels[k]; return { name: k, right: x.right, total: x.total, pct: x.right / x.total }; });
    var weakNames = weak.map(function(t){ return t.name; });
    var plan = [
      ['Tuần 1', weakNames.length ? 'Ôn lại lý thuyết + công thức trọng tâm: <b>' + esc(weakNames.slice(0, 2).join(', ')) + '</b>. Mỗi ngày 15 phút, 10 câu nhận biết – thông hiểu.' : 'Hệ thống lại công thức toàn chương, làm 10 câu thông hiểu mỗi ngày để giữ nhịp.'],
      ['Tuần 2', weakNames.length > 2 ? 'Tiếp tục vá: <b>' + esc(weakNames.slice(2).join(', ')) + '</b>; luyện dạng bài tính toán cơ bản.' : 'Luyện các dạng bài tính toán của chuyên đề vừa ôn, chú ý đơn vị và làm tròn.'],
      ['Tuần 3', 'Chuyển sang câu vận dụng (M3) và câu Đúng/Sai, trả lời ngắn — đúng cấu trúc đề tốt nghiệp mới.'],
      ['Tuần 4', 'Thi thử 1 đề đủ 28 câu có bấm giờ, chữa kỹ câu sai, ôn lại theo Sổ tay câu sai.']
    ];
    var review = cfg.questions.map(function(q, k){
      var a = r.ans[q.id], ok = a === q.correctKey;
      return '<div class="dg-rv"><span class="tag" style="background:' + (ok ? '#dcfce7;color:#166534' : '#fee2e2;color:#991b1b') + '">Câu ' + (k + 1) + (ok ? ' ✓' : ' ✗') + '</span>' +
        renderTex(q.stem) + '<div style="margin-top:4px;font-size:.86rem">Em chọn: <b>' + (a || '—') + '</b> · Đáp án đúng: <b>' + esc(q.correctKey) + '</b></div>' +
        (q.loiGiai ? '<details style="margin-top:4px"><summary style="cursor:pointer;font-size:.85rem;color:var(--accent-strong,#8f5714)">💡 Lời giải</summary><div style="font-size:.88rem;margin-top:4px">' + renderTex(q.loiGiai) + '</div></details>' : '') + '</div>';
    }).join('');
    var zalo = cfg.zaloLink ? '<a class="dg-btn zalo" href="' + esc(cfg.zaloLink) + '" target="_blank" rel="noopener">💬 Nhắn Zalo thầy</a>' : '';
    mount(head +
      '<div class="dg-card"><h4>📊 Theo chuyên đề</h4>' + topicBars(r.topics) + '</div>' +
      (levelBars.length ? '<div class="dg-card"><h4>🎯 Theo mức độ câu hỏi</h4>' + topicBars(levelBars) + '</div>' : '') +
      '<div class="dg-card"><h4>🗺️ Lộ trình 4 tuần gợi ý cho ' + esc(r.leadName || 'em') + '</h4>' + plan.map(function(w){ return '<div class="dg-week"><b>' + w[0] + '</b><span>' + w[1] + '</span></div>'; }).join('') +
        '<p class="dg-note">Học cùng FaradayAI: hệ thống tự chọn đề đúng chuyên đề em đang yếu, cập nhật lộ trình mỗi tuần và gửi báo cáo cho phụ huynh.</p></div>' +
      '<div class="dg-row" style="margin:6px 0 4px"><button class="dg-btn" data-act="toSignup">🚀 Đăng ký học thử</button>' + zalo + '<button class="dg-btn ghost" data-act="share">🔗 Rủ bạn cùng thử</button></div>' +
      '<p class="dg-note" id="dg-share-note"></p>' +
      '<div class="dg-card"><h4>📝 Xem lại bài làm</h4>' + review + '</div>');
  }
  function submitLead(){
    var g = function(id){ var el = root.querySelector('#' + id); return el ? el.value.trim() : ''; };
    var err = root.querySelector('#dg-err'), btn = root.querySelector('#dg-lead');
    var name = g('dg-name'), phone = g('dg-phone').replace(/[\s.\-]/g, '');
    if(name.length < 2){ err.textContent = 'Em nhập họ tên giúp thầy nhé.'; return; }
    if(!/^(\+?84|0)\d{8,10}$/.test(phone)){ err.textContent = 'Số điện thoại chưa đúng (ví dụ 0912345678).'; return; }
    err.textContent = '';
    var r = state;
    var payload = {
      name: name, phone: phone, grade: g('dg-grade'), target: g('dg-target'), school: g('dg-school'),
      diag: {
        correct: r.correct, total: r.total, score10: r.score10, seconds: r.seconds,
        weak: r.topics.filter(function(t){ return t.pct < 0.6; }).map(function(t){ return t.name + ' ' + t.right + '/' + t.total; }).join('; '),
        strong: r.topics.filter(function(t){ return t.pct >= 0.8; }).map(function(t){ return t.name; }).join('; ')
      }
    };
    function unlock(){ state.unlocked = true; state.leadName = name; state.leadPhone = phone; renderResult(); }
    if(g('dg-web')){ unlock(); return; } // ô bẫy bot
    btn.disabled = true; btn.textContent = 'Đang gửi…';
    waitLive(4000).then(function(live){
      return live && live.submitDiagLead ? live.submitDiagLead(payload) : { ok: false };
    }).then(function(res){
      if(res && res.ok) log('lead', r.correct / r.total * 100);
      unlock(); // không bắt em chờ / không khoá báo cáo chỉ vì mạng lỗi
    }).catch(function(){ unlock(); });
  }
  function toSignup(){
    var name = state && state.leadName, phone = state && state.leadPhone;
    if(timerId){ clearInterval(timerId); timerId = null; }
    state = null; close();
    var sec = document.getElementById('lien-he');
    if(sec) sec.scrollIntoView({ behavior: 'smooth' });
    setTimeout(function(){
      var n = document.getElementById('dk-name'), p = document.getElementById('dk-phone');
      if(n && name && !n.value) n.value = name;
      if(p && phone && !p.value) p.value = phone;
    }, 400);
  }
  function share(){
    var url = location.origin + '/#chan-doan';
    var text = 'Mình vừa làm bài chẩn đoán Vật lí 12 trong 5 phút của FaradayAI — thử xem bạn được mấy điểm nhé!';
    var note = root && root.querySelector('#dg-share-note');
    if(navigator.share){ navigator.share({ title: 'Chẩn đoán Vật lí 12 – 5 phút', text: text, url: url }).catch(function(){}); return; }
    try{ navigator.clipboard.writeText(text + ' ' + url).then(function(){ if(note) note.textContent = 'Đã chép link — dán vào Zalo/Messenger gửi bạn nhé!'; }); }
    catch(e){ if(note) note.textContent = url; }
  }
  function onAct(e){
    var el = e.currentTarget, act = el.getAttribute('data-act');
    if(act === 'close') return close();
    if(act === 'start') return start();
    if(act === 'toSignup') return toSignup();
    if(act === 'share') return share();
    if(act === 'lead') return submitLead();
    if(!state || state.phase !== 'quiz') return;
    var n = cfg.questions.length;
    if(act === 'pick'){
      state.ans[cfg.questions[state.i].id] = el.getAttribute('data-k');
      renderQ();
      if(state.i < n - 1) setTimeout(function(){ if(state && state.phase === 'quiz' && state.i < n - 1){ state.i++; renderQ(); } }, 260);
      return;
    }
    if(act === 'go'){ state.i = Number(el.getAttribute('data-k')) || 0; return renderQ(); }
    if(act === 'prev' && state.i > 0){ state.i--; return renderQ(); }
    if(act === 'next' && state.i < n - 1){ state.i++; return renderQ(); }
    if(act === 'submit') return finish(false);
  }
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && root) close(); });

  // ---------------- nút mở + tự mở theo link ----------------
  function init(){
    ensureStyle();
    document.addEventListener('click', function(e){
      var t = e.target && e.target.closest ? e.target.closest('[data-diag-open]') : null;
      if(t){ e.preventDefault(); open(); }
    });
    load().then(function(c){
      var btns = document.querySelectorAll('[data-diag-open]');
      if(!c){ btns.forEach(function(b){ b.style.display = 'none'; }); return; }
      if(!document.querySelector('.dg-fab')){
        var fab = document.createElement('button');
        fab.type = 'button'; fab.className = 'dg-fab'; fab.setAttribute('data-diag-open', '');
        fab.textContent = '⚡ Chẩn đoán 5 phút';
        document.body.appendChild(fab);
      }
    });
    var wantOpen = location.hash === '#chan-doan' || /[?&]chandoan=1\b/.test(location.search);
    if(wantOpen) open();
    window.addEventListener('hashchange', function(){ if(location.hash === '#chan-doan' && !root) open(); });
  }
  window.OPC_DIAG = { open: open, renderTex: renderTex };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window, document);
