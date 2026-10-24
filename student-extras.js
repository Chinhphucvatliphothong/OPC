/**
 * student-extras.js — THÊM 23/10/2026 · trang học sinh (index.html), nạp SAU faraday-extras.js
 *  • Thanh "🏆 Thi thử tháng" (làm bài · điểm · hạng · giấy khen · bảng xếp hạng) — dữ liệu mock_exams (admin tạo).
 *  • "📺 Video ôn lý thuyết": thư viện bài giảng FaradayAI + video ứng dụng thực tế (video_lessons), xếp theo chương.
 *  • KHẢO SÁT HÀI LÒNG kiểu "hỏi nhẹ" (như Claude thỉnh thoảng hỏi): thẻ nhỏ góc màn hình sau khi em nộp bài,
 *    tối đa 1 lần / N ngày (settings/survey), có "Để sau". Kết quả vào surveys (chỉ thầy đọc).
 * Không sửa cây React của trang luyện tập: tự gắn 1 khung #opc-extras-root ngay trên #prepscholar-app-root.
 */
(function(window){
  'use strict';
  var React = window.React, ReactDOM = window.ReactDOM;
  if(!React || !ReactDOM) return;
  var h = React.createElement;

  function live(){ return window.OPC_LIVE || null; }
  function fmt2(n){ return n == null || isNaN(n) ? '—' : (Math.round(Number(n) * 100) / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 }); }
  function vnDate(s){ if(!s) return ''; var p = String(s).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] : s; }
  function today(){ var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  var DAY = 86400000;

  var CSS = [
    '#opc-extras-root{margin:0;padding:0;}',
    '.sx-strip{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0 4px;}',
    '.sx-card{flex:1 1 300px;background:var(--surface,#fff);border:1px solid var(--line,#e5e0d4);border-radius:14px;padding:12px 14px;display:flex;gap:12px;align-items:center;}',
    '.sx-card .ic{font-size:1.6rem;flex:none;} .sx-card .tx{flex:1;min-width:0;} .sx-card b{display:block;font-size:.95rem;} .sx-card small{color:var(--ink-2,#555);font-size:.8rem;line-height:1.4;display:block;}',
    '.sx-card.mock{border-color:#d9b97a;background:linear-gradient(135deg,rgba(201,162,95,.13),transparent 60%),var(--surface,#fff);}',
    '.sx-btns{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;}',
    '.sx-b{border:1px solid var(--line,#ddd);background:var(--surface-2,#f4f1ea);color:var(--ink,#111);border-radius:9px;padding:6px 11px;font-weight:700;font-size:.82rem;cursor:pointer;}',
    '.sx-b.pri{background:#b88a3e;border-color:#b88a3e;color:#fff;}',
    '.sx-ov{position:fixed;inset:0;z-index:3500;background:rgba(10,12,16,.55);display:flex;align-items:center;justify-content:center;padding:14px;}',
    '.sx-modal{background:var(--surface,#fff);color:var(--ink,#111);border-radius:16px;width:min(920px,100%);max-height:92vh;overflow:auto;padding:18px 20px;box-shadow:0 30px 80px rgba(0,0,0,.35);}',
    '.sx-modal h3{margin:0;font-size:1.15rem;} .sx-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;}',
    '.sx-x{border:0;background:var(--surface-2,#eee);border-radius:8px;padding:6px 10px;cursor:pointer;font-weight:700;color:inherit;}',
    '.sx-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 12px;}',
    '.sx-tab{border:1px solid var(--line,#ddd);background:transparent;color:inherit;border-radius:999px;padding:5px 12px;font-size:.82rem;font-weight:700;cursor:pointer;} .sx-tab.on{background:#b88a3e;color:#fff;border-color:#b88a3e;}',
    '.sx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;align-items:start;}',
    '.sx-ls{border:1px solid var(--line,#e5e0d4);border-radius:12px;padding:10px 12px;cursor:pointer;background:var(--surface,#fff);text-align:left;color:inherit;font:inherit;}',
    '.sx-ls:hover{border-color:#b88a3e;} .sx-ls .k{font-size:.72rem;font-weight:800;color:#b88a3e;letter-spacing:.04em;} .sx-ls .n{font-weight:700;font-size:.92rem;margin:3px 0;} .sx-ls .m{font-size:.76rem;color:var(--ink-2,#666);}',
    '.sx-thumb{height:86px;border-radius:8px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;background:radial-gradient(120% 90% at 20% 10%,#1a2233,#0b0f19);color:#f5d48a;font-weight:800;position:relative;overflow:hidden;}',
    '.sx-thumb img.lg{position:absolute;left:8px;top:8px;width:22px;height:22px;opacity:.9;} .sx-thumb .tt{position:absolute;left:10px;right:10px;bottom:8px;font-size:.72rem;color:#f5f1e6;font-weight:700;line-height:1.25;text-align:left;} .sx-thumb img.yt{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.85;} .sx-thumb .pl{position:absolute;font-size:1.6rem;color:#fff;text-shadow:0 2px 8px #000;}',
    '.sx-table{width:100%;border-collapse:collapse;font-size:.88rem;} .sx-table td,.sx-table th{padding:7px 8px;border-bottom:1px solid var(--line,#eee);text-align:left;} .sx-table tr.me{background:rgba(201,162,95,.16);font-weight:700;}',
    '.sx-sv{position:fixed;right:16px;bottom:16px;z-index:3400;width:min(380px,calc(100vw - 32px));background:var(--surface,#fff);color:var(--ink,#111);border:1px solid var(--line,#e5e0d4);border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.25);padding:14px 16px;animation:sxin .35s ease;}',
    '@keyframes sxin{from{transform:translateY(20px);opacity:0}to{transform:none;opacity:1}}',
    '.sx-sv h4{margin:0 0 8px;font-size:.98rem;padding-right:22px;} .sx-sv .cl{position:absolute;top:8px;right:10px;border:0;background:none;font-size:1.05rem;cursor:pointer;color:var(--ink-2,#666);}',
    '.sx-faces{display:flex;justify-content:space-between;gap:4px;} .sx-face{flex:1;border:1px solid var(--line,#e5e0d4);background:transparent;border-radius:10px;padding:6px 2px;cursor:pointer;font-size:1.5rem;line-height:1;color:inherit;} .sx-face small{display:block;font-size:.64rem;margin-top:4px;color:var(--ink-2,#666);} .sx-face.on{border-color:#b88a3e;background:rgba(201,162,95,.15);}',
    '.sx-q{font-size:.84rem;font-weight:700;margin:10px 0 5px;} .sx-chips{display:flex;gap:5px;flex-wrap:wrap;}',
    '.sx-chip{border:1px solid var(--line,#ddd);background:transparent;color:inherit;border-radius:999px;padding:4px 10px;font-size:.78rem;cursor:pointer;} .sx-chip.on{background:#b88a3e;color:#fff;border-color:#b88a3e;}',
    '.sx-sv textarea{width:100%;box-sizing:border-box;border:1px solid var(--line,#ddd);border-radius:10px;padding:8px;font:inherit;font-size:.86rem;background:var(--surface-2,#faf8f3);color:inherit;resize:vertical;}',
    '.sx-mini{font-size:.76rem;color:var(--ink-2,#666);}'
  ].join('\n');
  function ensureCss(){ if(document.getElementById('sx-css')) return; var s = document.createElement('style'); s.id = 'sx-css'; s.textContent = CSS; document.head.appendChild(s); }

  var LIKES = ['Luyện tập thích ứng', 'Đề thầy giao', 'Lời giải chi tiết', 'Video bài giảng', 'Học online với thầy', 'Dự đoán điểm', 'Sổ tay câu sai', 'Thi thử tháng'];
  var FACES = [['😞', 'Chưa tốt'], ['😕', 'Tạm'], ['😐', 'Bình thường'], ['🙂', 'Tốt'], ['😍', 'Rất tốt']];

  // ------------------------------------------------------------ khảo sát
  function SurveyCard(props){
    var st = React.useState(0); var rating = st[0], setRating = st[1];
    var hp = React.useState(''); var helpful = hp[0], setHelpful = hp[1];
    var lk = React.useState([]); var likes = lk[0], setLikes = lk[1];
    var im = React.useState(''); var improve = im[0], setImprove = im[1];
    var rc = React.useState(''); var rec = rc[0], setRec = rc[1];
    var dn = React.useState(''); var done = dn[0], setDone = dn[1];
    var cfg = props.config || {};
    function chip(val, cur, set){ return h('button', { key: val, type: 'button', className: 'sx-chip' + (cur === val ? ' on' : ''), onClick: function(){ set(cur === val ? '' : val); } }, val); }
    function send(){
      setDone('sending');
      props.onSubmit({ rating: rating, helpful: helpful, likes: likes, improve: improve.trim().slice(0, 1500), recommend: rec, extra: cfg.extraQuestion ? (props.extraAns || '') : '' })
        .then(function(){ setDone('ok'); setTimeout(props.onClose, 2600); })
        .catch(function(){ setDone('err'); });
    }
    if(done === 'ok') return h('div', { className: 'sx-sv', role: 'status' }, h('h4', null, '💛 Cảm ơn em!'), h('p', { className: 'sx-mini', style: { margin: 0 } }, 'Thầy đọc hết từng góp ý để FaradayAI giúp em ôn luyện tốt hơn.'));
    return h('div', { className: 'sx-sv', role: 'dialog', 'aria-label': 'Khảo sát' },
      h('button', { type: 'button', className: 'cl', title: 'Để sau', onClick: props.onSnooze }, '✕'),
      h('h4', null, cfg.question || 'FaradayAI đang giúp em ôn luyện thế nào?'),
      h('div', { className: 'sx-faces' }, FACES.map(function(f, i){
        return h('button', { key: i, type: 'button', className: 'sx-face' + (rating === i + 1 ? ' on' : ''), onClick: function(){ setRating(i + 1); }, 'aria-label': f[1] }, f[0], h('small', null, f[1]));
      })),
      rating ? h('div', null,
        h('div', { className: 'sx-q' }, 'FaradayAI có giúp em ôn luyện hiệu quả hơn không?'),
        h('div', { className: 'sx-chips' }, ['Rất nhiều', 'Khá nhiều', 'Một chút', 'Chưa thấy'].map(function(v){ return chip(v, helpful, setHelpful); })),
        h('div', { className: 'sx-q' }, 'Em thích nhất phần nào? (chọn nhiều)'),
        h('div', { className: 'sx-chips' }, LIKES.map(function(v){ var on = likes.indexOf(v) > -1; return h('button', { key: v, type: 'button', className: 'sx-chip' + (on ? ' on' : ''), onClick: function(){ setLikes(on ? likes.filter(function(x){ return x !== v; }) : likes.concat([v])); } }, v); })),
        h('div', { className: 'sx-q' }, rating <= 3 ? 'Điều gì làm em chưa hài lòng? FaradayAI cần cải thiện gì?' : 'Em muốn FaradayAI có thêm / cải thiện điều gì?'),
        h('textarea', { rows: 3, value: improve, maxLength: 1500, placeholder: 'Ví dụ: lời giải câu Đúng/Sai khó hiểu, muốn thêm video phần hạt nhân, đề hơi dài…', onChange: function(e){ setImprove(e.target.value); } }),
        h('div', { className: 'sx-q' }, 'Em có muốn giới thiệu FaradayAI cho bạn bè không?'),
        h('div', { className: 'sx-chips' }, ['Chắc chắn', 'Có thể', 'Chưa'].map(function(v){ return chip(v, rec, setRec); })),
        h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px', alignItems: 'center' } },
          done === 'err' ? h('span', { className: 'sx-mini', style: { color: '#b91c1c', marginRight: 'auto' } }, 'Chưa gửi được, thử lại nhé.') : null,
          h('button', { type: 'button', className: 'sx-b', onClick: props.onSnooze }, 'Để sau'),
          h('button', { type: 'button', className: 'sx-b pri', disabled: done === 'sending', onClick: send }, done === 'sending' ? 'Đang gửi…' : 'Gửi góp ý'))) :
        h('p', { className: 'sx-mini', style: { margin: '8px 0 0' } }, 'Chỉ mất 30 giây · ẩn danh với các bạn, chỉ thầy đọc.'));
  }

  function baiOrder(k){ var B = window.OPC_NANO ? window.OPC_NANO.BAI : []; for(var i = 0; i < B.length; i++) if(B[i].key === k) return i; return 999; }
  // ------------------------------------------------------------ thư viện video
  function Library(props){
    var NANO = window.OPC_NANO;
    var lessons = props.lessons, views = props.views || {};
    var chuDes = (NANO ? NANO.CHU_DE : []).filter(function(c){ return lessons.some(function(l){ return l.chuDeKey === c.key; }); });
    var tb = React.useState('all'); var tab = tb[0], setTab = tb[1];
    var kd = React.useState('all'); var kind = kd[0], setKind = kd[1];
    var shown = lessons.filter(function(l){ return (tab === 'all' || l.chuDeKey === tab) && (kind === 'all' || (kind === 'yt' ? l.kind === 'youtube' : l.kind !== 'youtube')); })
      .sort(function(a, b){ return baiOrder(a.baiKey) - baiOrder(b.baiKey) || (a.kind === 'youtube' ? 1 : 0) - (b.kind === 'youtube' ? 1 : 0) || (Number(a.order) || 0) - (Number(b.order) || 0); });
    return h('div', { className: 'sx-ov', onClick: function(e){ if(e.target === e.currentTarget) props.onClose(); } },
      h('div', { className: 'sx-modal' },
        h('div', { className: 'sx-head' }, h('h3', null, '📺 Video ôn lý thuyết'), h('button', { type: 'button', className: 'sx-x', onClick: props.onClose }, '✕')),
        h('p', { className: 'sx-mini', style: { margin: '0 0 6px' } }, 'Bài giảng ngắn FaradayAI (có lời giảng + phụ đề) và video ứng dụng thực tế thầy chọn. Làm sai câu nào, nút "📺 Ôn lý thuyết" cũng hiện ngay dưới câu đó.'),
        h('div', { className: 'sx-tabs' },
          h('button', { type: 'button', className: 'sx-tab' + (tab === 'all' ? ' on' : ''), onClick: function(){ setTab('all'); } }, 'Tất cả (' + lessons.length + ')'),
          chuDes.map(function(c){ return h('button', { key: c.key, type: 'button', className: 'sx-tab' + (tab === c.key ? ' on' : ''), onClick: function(){ setTab(c.key); } }, c.icon + ' ' + c.name); }),
          h('span', { style: { flex: 1 } }),
          [['all', 'Mọi loại'], ['fx', '🎓 Bài giảng'], ['yt', '🎬 Thực tế']].map(function(x){ return h('button', { key: x[0], type: 'button', className: 'sx-tab' + (kind === x[0] ? ' on' : ''), onClick: function(){ setKind(x[0]); } }, x[1]); })),
        !shown.length ? h('p', { className: 'sx-mini' }, 'Chưa có video ở mục này.') :
        h('div', { className: 'sx-grid' }, shown.map(function(l){
          var bai = NANO && l.baiKey ? NANO.getBai(l.baiKey) : null, v = views[l.id];
          var yt = l.kind === 'youtube' ? (l.youtubeId || (window.OPC_FX && window.OPC_FX.youtubeId(l.url))) : null;
          var dur = l.kind === 'youtube' ? (l.end && l.start != null ? Math.max(0, window.OPC_FX.parseTime(l.end) - (window.OPC_FX.parseTime(l.start) || 0)) : null) : window.OPC_FX.estimateSec(l.script);
          return h('button', { key: l.id, type: 'button', className: 'sx-ls', onClick: function(){ window.OPC_FX.openLesson(l, { onOpen: props.onOpen, onDone: props.onDone }); } },
            h('div', { className: 'sx-thumb' },
              yt ? h('img', { className: 'yt', src: 'https://i.ytimg.com/vi/' + yt + '/mqdefault.jpg', alt: '' }) : h('img', { className: 'lg', src: '/logo-mark.svg', alt: '' }),
              h('span', { className: 'pl' }, '▶'), yt ? null : h('span', { className: 'tt' }, 'Faraday', h('span', { style: { color: '#c9a25f' } }, 'AI'), ' · ' + (bai ? bai.name.replace(/:.*/, '') : 'Lý thuyết'))),
            h('div', { className: 'k' }, l.kind === 'youtube' ? '🎬 ỨNG DỤNG THỰC TẾ' : '🎓 BÀI GIẢNG FARADAYAI'),
            h('div', { className: 'n' }, l.title),
            h('div', { className: 'm' }, (bai ? bai.name : '') + (dur ? ' · ' + window.OPC_FX.fmtTime(dur) : '') + (v ? (v.completed ? ' · ✓ Đã xem' : ' · đã mở') : '')));
        }))));
  }

  // ------------------------------------------------------------ bảng xếp hạng
  function Board(props){
    var m = props.mock, me = props.me, board = m.board || [];
    var byScore = board.slice().sort(function(a, b){ return b.score - a.score; });
    var byDelta = board.filter(function(r){ return r.delta != null; }).sort(function(a, b){ return b.delta - a.delta; }).slice(0, 5);
    function row(r, i, showDelta){
      return h('tr', { key: r.sid + (showDelta ? 'd' : ''), className: r.sid === me ? 'me' : '' },
        h('td', null, showDelta ? (i + 1) : r.rank), h('td', null, r.sid === me ? 'Em' : r.short),
        h('td', null, fmt2(r.score)), h('td', { style: { color: r.delta > 0 ? '#15803d' : (r.delta < 0 ? '#b91c1c' : 'inherit') } }, r.delta == null ? '—' : (r.delta > 0 ? '+' : '') + fmt2(r.delta)));
    }
    var mine = board.filter(function(r){ return r.sid === me; })[0];
    return h('div', { className: 'sx-ov', onClick: function(e){ if(e.target === e.currentTarget) props.onClose(); } },
      h('div', { className: 'sx-modal', style: { width: 'min(700px,100%)' } },
        h('div', { className: 'sx-head' }, h('h3', null, '🏆 ' + m.title), h('button', { type: 'button', className: 'sx-x', onClick: props.onClose }, '✕')),
        mine ? h('p', { style: { margin: '0 0 10px' } }, 'Em đạt ', h('b', null, fmt2(mine.score) + ' điểm'), ' · hạng ', h('b', null, mine.rank + '/' + board.length),
          mine.delta != null ? h('span', null, ' · ', h('b', { style: { color: mine.delta >= 0 ? '#15803d' : '#b91c1c' } }, (mine.delta > 0 ? '+' : '') + fmt2(mine.delta)), ' so với kỳ trước') : null) : null,
        byDelta.length ? h('div', null, h('h4', { style: { margin: '6px 0' } }, '🚀 Tiến bộ nhiều nhất'),
          h('table', { className: 'sx-table' }, h('thead', null, h('tr', null, ['#', 'Bạn', 'Điểm', 'Tăng'].map(function(t){ return h('th', { key: t }, t); }))), h('tbody', null, byDelta.map(function(r, i){ return row(r, i, true); })))) : null,
        h('h4', { style: { margin: '14px 0 6px' } }, '⭐ Điểm cao nhất'),
        h('table', { className: 'sx-table' }, h('thead', null, h('tr', null, ['Hạng', 'Bạn', 'Điểm', 'So kỳ trước'].map(function(t){ return h('th', { key: t }, t); }))),
          h('tbody', null, byScore.slice(0, 10).map(function(r, i){ return row(r, i, false); }), (mine && mine.rank > 10) ? row(mine, 0, false) : null)),
        h('p', { className: 'sx-mini', style: { marginTop: '10px' } }, 'Bảng chỉ hiện tên rút gọn. Quan trọng nhất là em tiến bộ hơn chính mình của tháng trước 💪')));
  }

  // ------------------------------------------------------------ ứng dụng
  function Extras(){
    var stuS = React.useState(function(){ return window.OPC_CURRENT_STUDENT || null; }); var stu = stuS[0], setStu = stuS[1];
    var lsS = React.useState([]); var lessons = lsS[0], setLessons = lsS[1];
    var mkS = React.useState([]); var mocks = mkS[0], setMocks = mkS[1];
    var atS = React.useState([]); var attempts = atS[0], setAttempts = atS[1];
    var vwS = React.useState({}); var views = vwS[0], setViews = vwS[1];
    var libS = React.useState(false); var libOpen = libS[0], setLibOpen = libS[1];
    var bdS = React.useState(null); var boardMock = bdS[0], setBoardMock = bdS[1];
    var svS = React.useState(null); var survey = svS[0], setSurvey = svS[1];   // null | { trigger }
    var exS = React.useState(false); var inExam = exS[0], setInExam = exS[1];
    var cfgRef = React.useRef({ survey: null, state: null });
    var stuRef = React.useRef(null); stuRef.current = stu;

    React.useEffect(function(){
      function onAuth(e){
        var d = (e && e.detail) || {};
        if(d.loggedIn && d.student && d.student.id) setStu(d.student);
        else if(!d.loggedIn){ setStu(null); setSurvey(null); setLibOpen(false); }
      }
      window.addEventListener('opc-student-auth', onAuth);
      var t = setInterval(function(){ var b = window.OPC_APP_BRIDGE; setInExam(!!(b && b.inExam && b.inExam())); }, 1200);
      return function(){ window.removeEventListener('opc-student-auth', onAuth); clearInterval(t); };
    }, []);

    function reloadAttempts(id){
      var L = live(); if(!L || !L.loadAttempts) return Promise.resolve([]);
      return L.loadAttempts(id, 150).then(function(list){ setAttempts(list || []); return list || []; }).catch(function(){ return []; });
    }
    // khi vào: tải thư viện, thi thử, lịch sử, cấu hình khảo sát
    React.useEffect(function(){
      if(!stu) return;
      var L = live(); if(!L) return;
      var cancelled = false;
      (L.loadLessons ? L.loadLessons() : Promise.resolve([])).then(function(list){ if(cancelled) return; setLessons(list); if(window.OPC_FX) window.OPC_FX.setLessons(list); });
      (L.loadMocks ? L.loadMocks() : Promise.resolve([])).then(function(list){ if(!cancelled) setMocks(list); });
      (L.loadLessonViews ? L.loadLessonViews(stu.id) : Promise.resolve({})).then(function(v){ if(!cancelled) setViews(v || {}); });
      Promise.all([reloadAttempts(stu.id), L.loadSettingsDoc ? L.loadSettingsDoc('survey') : null, L.getSurveyState ? L.getSurveyState(stu.id) : {}]).then(function(r){
        if(cancelled) return;
        cfgRef.current = { survey: r[1] || {}, state: r[2] || {} };
        // thầy bấm "Hỏi tất cả học sinh" → hỏi ngay lần vào tới (nếu em chưa trả lời sau mốc đó)
        var c = cfgRef.current.survey, s = cfgRef.current.state;
        if(c && c.enabled !== false && c.askAllAfter && (!s.lastAt || s.lastAt < c.askAllAfter) && (!s.snoozeUntil || s.snoozeUntil < Date.now()))
          setTimeout(function(){ if(!cancelled) setSurvey({ trigger: 'teacher' }); }, 4000);
      });
      if(window.OPC_FX && L.loadLessonAudio) window.OPC_FX.setAudioLoader(L.loadLessonAudio); // THÊM 24/10/2026 — giọng AI / giọng thầy đã lưu
      if(window.OPC_FX) window.OPC_FX.setTracker(function(l){ if(L.recordLessonView) L.recordLessonView(stu.id, l, false); setViews(function(p){ var n = Object.assign({}, p); n[l.id] = Object.assign({}, n[l.id], { opened: true }); return n; }); });
      // bọc saveAttempt: em vừa NỘP BÀI (không phải lưu làm dở) → cập nhật thi thử + có thể hỏi khảo sát
      if(L.saveAttempt && !L.__sxWrapped){
        var orig = L.saveAttempt;
        L.saveAttempt = function(sid, attempt){
          var p = orig.apply(this, arguments);
          try{
            if(attempt && !attempt.partial && attempt.type !== 'ping'){
              Promise.resolve(p).then(function(){ setTimeout(function(){ onSubmitted(attempt); }, 2500); });
            }
          }catch(e){}
          return p;
        };
        L.__sxWrapped = true;
      }
      return function(){ cancelled = true; };
    }, [stu && stu.id]);

    function onSubmitted(attempt){
      var s0 = stuRef.current; if(!s0) return;
      reloadAttempts(s0.id).then(function(list){
        var c = cfgRef.current.survey || {}, s = cfgRef.current.state || {};
        if(c.enabled === false) return;
        var n = list.filter(function(a){ return a && !a.partial && a.type !== 'ping'; }).length;
        var every = (Number(c.everyDays) || 14) * DAY, minN = Number(c.minAttempts) || 3, now = Date.now();
        if(n < minN) return;
        if(s.snoozeUntil && s.snoozeUntil > now) return;
        if(s.lastAt && now - s.lastAt < every) return;
        setSurvey({ trigger: 'auto' });
      });
    }
    function snooze(){
      var s0 = stuRef.current, L = live();
      var st2 = Object.assign({}, cfgRef.current.state || {}, { snoozeUntil: Date.now() + 3 * DAY, snoozes: ((cfgRef.current.state || {}).snoozes || 0) + 1 });
      cfgRef.current.state = st2; setSurvey(null);
      if(s0 && L && L.saveSurveyState) L.saveSurveyState(s0.id, st2);
    }
    function submitSurvey(data){
      var s0 = stuRef.current, L = live();
      if(!s0 || !L || !L.submitSurvey) return Promise.reject(new Error('offline'));
      var n = attempts.filter(function(a){ return a && !a.partial && a.type !== 'ping'; }).length;
      return L.submitSurvey(s0.id, Object.assign({ name: s0.name || '', lop: s0.lop || '', trigger: (survey && survey.trigger) || 'manual', attempts: n }, data)).then(function(){
        var st2 = Object.assign({}, cfgRef.current.state || {}, { lastAt: Date.now(), snoozeUntil: 0, count: ((cfgRef.current.state || {}).count || 0) + 1 });
        cfgRef.current.state = st2; if(L.saveSurveyState) L.saveSurveyState(s0.id, st2);
      });
    }

    if(!stu) return null;
    var me = stu.id;
    // thi thử của em
    var myMocks = mocks.filter(function(m){
      if(m.hidden) return false;
      var inList = m.mode !== 'paper' && (!m.studentIds || !m.studentIds.length || m.studentIds.indexOf(me) > -1);
      return inList || (m.board || []).some(function(r){ return r.sid === me; });
    }).sort(function(a, b){ return String(b.openDate || '').localeCompare(String(a.openDate || '')); }).slice(0, 2);
    var t = today();
    var mockCards = myMocks.map(function(m){
      var aeId = m.assigned && m.assigned[me];
      var att = aeId ? attempts.filter(function(a){ return a.assignedExamId === aeId && !a.partial; })[0] : null;
      var mine = (m.board || []).filter(function(r){ return r.sid === me; })[0];
      var open = (!m.openDate || m.openDate <= t) && (!m.closeDate || m.closeDate >= t);
      var before = m.openDate && m.openDate > t;
      var score = att ? att.scaledScore10 : (mine ? mine.score : null);
      var sub, btns = [];
      if(score != null){
        sub = 'Em đạt ' + fmt2(score) + ' điểm' + (m.published && mine ? ' · hạng ' + mine.rank + '/' + (m.board || []).length + (mine.delta != null ? ' · ' + (mine.delta >= 0 ? '+' : '') + fmt2(mine.delta) + ' so với kỳ trước' : '') : (m.published ? '' : ' · thầy sẽ công bố bảng xếp hạng sau khi hết hạn'));
        if(m.published && mine) btns.push(h('button', { key: 'c', type: 'button', className: 'sx-b pri', onClick: function(){
          window.OPC_FX.downloadCertificate({ name: stu.name, award: mine.award || 'complete', examTitle: m.title, score: mine.score, delta: mine.delta, rank: mine.rank, of: (m.board || []).length, date: m.certDate || new Date().toLocaleDateString('vi-VN'), signer: m.signer || '', note: mine.note || '', code: (m.id || '').slice(0, 4).toUpperCase() + '-' + me.slice(0, 4).toUpperCase() });
        } }, mine.award === 'progress' ? '🎖 Giấy khen tiến bộ' : (mine.award === 'top' ? '🎖 Giấy khen' : '🎖 Giấy chứng nhận')));
        if(m.published) btns.push(h('button', { key: 'b', type: 'button', className: 'sx-b', onClick: function(){ setBoardMock(m); } }, '🏆 Bảng xếp hạng'));
      } else if(before){ sub = 'Mở từ ' + vnDate(m.openDate) + (m.closeDate ? ' đến ' + vnDate(m.closeDate) : '') + ' · ' + (m.durationMin || 50) + ' phút';
      } else if(open && aeId){
        sub = (m.closeDate ? 'Hạn đến hết ' + vnDate(m.closeDate) : 'Đang mở') + ' · ' + (m.durationMin || 50) + ' phút · ' + (m.totalQuestions || '') + ' câu';
        btns.push(h('button', { key: 's', type: 'button', className: 'sx-b pri', onClick: function(){
          if(!window.confirm('Bắt đầu bài thi thử "' + m.title + '"? Thời gian ' + (m.durationMin || 50) + ' phút — làm như thi thật nhé!')) return;
          var b = window.OPC_APP_BRIDGE; if(b) b.startAssigned(aeId).then(function(ok){ if(!ok) alert('Chưa mở được đề — tải lại trang rồi thử lại.'); });
        } }, '▶ Làm bài thi thử'));
      } else if(m.mode === 'paper'){ sub = 'Thi trên giấy tại lớp' + (m.published ? '' : ' · thầy đang chấm');
      } else sub = 'Đã hết hạn làm bài.';
      return h('div', { key: m.id, className: 'sx-card mock' }, h('span', { className: 'ic' }, '🏆'),
        h('div', { className: 'tx' }, h('b', null, m.title), h('small', null, sub), btns.length ? h('div', { className: 'sx-btns' }, btns) : null));
    });
    var nFx = lessons.filter(function(l){ return l.kind !== 'youtube'; }).length, nYt = lessons.length - nFx;
    return h('div', null,
      inExam ? null : h('div', { className: 'sx-strip' },
        mockCards,
        lessons.length ? h('div', { className: 'sx-card' }, h('span', { className: 'ic' }, '📺'),
          h('div', { className: 'tx' }, h('b', null, 'Video ôn lý thuyết'), h('small', null, nFx + ' bài giảng FaradayAI' + (nYt ? ' · ' + nYt + ' video ứng dụng thực tế' : '')),
            h('div', { className: 'sx-btns' }, h('button', { type: 'button', className: 'sx-b', onClick: function(){ setLibOpen(true); } }, 'Mở thư viện')))) : null,
        h('div', { className: 'sx-card', style: { flex: '0 1 230px' } }, h('span', { className: 'ic' }, '💬'),
          h('div', { className: 'tx' }, h('b', null, 'Góp ý cho FaradayAI'), h('small', null, '30 giây · thầy đọc hết'),
            h('div', { className: 'sx-btns' }, h('button', { type: 'button', className: 'sx-b', onClick: function(){ setSurvey({ trigger: 'manual' }); } }, 'Gửi góp ý'))))),
      libOpen ? h(Library, { lessons: lessons, views: views, onClose: function(){ setLibOpen(false); },
        onDone: function(l){ var L = live(); if(L && L.recordLessonView) L.recordLessonView(stu.id, l, true); setViews(function(p){ var n = Object.assign({}, p); n[l.id] = { completed: true }; return n; }); } }) : null,
      boardMock ? h(Board, { mock: boardMock, me: me, onClose: function(){ setBoardMock(null); } }) : null,
      (survey && !inExam) ? h(SurveyCard, { config: cfgRef.current.survey, onSnooze: snooze, onClose: function(){ setSurvey(null); }, onSubmit: submitSurvey }) : null);
  }

  function mount(){
    ensureCss();
    var app = document.getElementById('prepscholar-app-root');
    if(!app) return;
    var el = document.getElementById('opc-extras-root');
    if(!el){ el = document.createElement('div'); el.id = 'opc-extras-root'; app.parentNode.insertBefore(el, app); }
    ReactDOM.render(h(Extras), el);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})(window);
