/**
 * loigiai-dong-admin.js — THÊM 4/11/2026 · ✨ LỜI GIẢI ĐỘNG (admin) — theo thiết kế canvas "Lời giải động FaradayAI"
 * Nạp SAU loigiai-dong.js và admin-growth.js (dùng OPC_LGD, OPC_VOICE, OPC.loiGiai, OPC.attempts).
 *
 *  • Block   — khối trong Ngân hàng đề › Chi tiết đề: danh sách câu xếp theo TỈ LỆ SAI của lớp (Sai nhiều / Sai vừa / Ít sai /
 *              Cả lớp đúng) kèm trạng thái (Thầy ghi bút · Nên ghi bút · AI đã duyệt · AI chờ duyệt · Chưa có), trình soạn kịch bản
 *              tô màu cú pháp ([hl:] ? [bẫy B] [svg:]), xem trước cảnh đang soạn, tạo giọng AI 1 lần, duyệt & phát.
 *  • Projector — "Thầy chiếu / chia sẻ màn hình (iPad)": đề bên trái (đáp án + phương án lớp hay chọn), bảng bên phải hiện
 *              từng bước của kịch bản, thầy viết Apple Pencil + nói; bấm "Câu tiếp · tự ghi mốc" → bản ghi câu đó tự gắn vào câu,
 *              sang câu sau. Chỉ chữa câu có người sai (câu cả lớp đúng tự bỏ qua).
 *
 * Bản thầy ghi lưu ở loi_giai_dong/{qid}: teacher = { mime, dur, n, at, ar } + audio/stp<k> (mẩu giọng base64) + audio/stk (nét bút)
 * — xem loigiai-dong.js (TeacherPlayer).
 */
(function(window){
  'use strict';
  var React = window.React, ReactDOM = window.ReactDOM;
  if(!React) return;
  var h = React.createElement;
  function L(){ return window.OPC_LGD; }
  function O(){ return window.OPC; }
  function V(){ return window.OPC_VOICE || null; }

  var SERIF = '"Noto Serif",Literata,Georgia,serif', MONO = '"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace';
  var CSS = [
    '.lga{background:#FAF8F3;color:#15171C;font-family:"Be Vietnam Pro",system-ui,sans-serif;border:1px solid #E4DFD3;border-radius:18px;padding:20px;margin-top:16px;display:flex;flex-direction:column;gap:18px;}',
    '.lga button:focus-visible,.lga textarea:focus-visible,.lga select:focus-visible,.lga-pj button:focus-visible{outline:2px solid #7A4E16;outline-offset:2px;}',
    '.lga-top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;}',
    '.lga-crumb{font-size:13px;color:#5E5A51;} .lga-h1{margin:0;font-family:' + SERIF + ';font-size:28px;font-weight:700;color:#15171C;line-height:1.25;}',
    '.lga-acts{display:flex;flex-wrap:wrap;gap:10px;}',
    '.lga-btn{height:44px;padding:0 16px;border-radius:12px;border:1px solid #E4DFD3;background:#fff;color:#15171C;font:inherit;font-size:14px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;}',
    '.lga-btn:hover{background:#F3EBDA;} .lga-btn:disabled{opacity:.5;cursor:not-allowed;}',
    '.lga-btn.dark{background:#15171C;border-color:#15171C;color:#fff;} .lga-btn.dark:hover{background:#2A2C31;}',
    '.lga-btn.green{background:#1F6B43;border-color:#1F6B43;color:#fff;} .lga-btn.green:hover{background:#185636;}',
    '.lga-btn.clay{border-color:#7A4E16;color:#7A4E16;} .lga-btn.sm{height:36px;padding:0 12px;font-size:13px;border-radius:10px;}',
    '.lga-dot{width:10px;height:10px;border-radius:5px;background:#B42318;flex-shrink:0;}',
    '.lga-cols{display:flex;flex-wrap:wrap;gap:18px;align-items:stretch;}',
    '.lga-card{background:#fff;border:1px solid #E4DFD3;border-radius:16px;}',
    '.lga-list{flex:1 1 260px;max-width:340px;min-width:0;padding:12px;display:flex;flex-direction:column;gap:4px;max-height:720px;overflow:auto;}',
    '.lga-list-hd{display:flex;justify-content:space-between;align-items:center;padding:6px 8px 10px;gap:8px;}',
    '.lga-row{display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;border:0;background:transparent;width:100%;text-align:left;font:inherit;color:#15171C;cursor:pointer;min-height:44px;}',
    '.lga-row:hover{background:#FAF5EA;} .lga-row.on{background:#F3EBDA;} .lga-row b{width:34px;flex-shrink:0;}',
    '.lga-lv{font-size:12px;color:#5E5A51;white-space:nowrap;} .lga-lv.hot{color:#B42318;font-weight:600;}',
    '.lga-bdg{margin-left:auto;font-size:12px;font-weight:600;padding:4px 8px;border-radius:8px;white-space:nowrap;}',
    '.lga-ed{flex:999 1 420px;min-width:0;display:flex;flex-direction:column;overflow:hidden;}',
    '.lga-ed-hd{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #EFECE4;}',
    '.lga-chip{font-size:12px;font-family:' + MONO + ';font-weight:500;padding:4px 8px;border-radius:6px;background:#F3EBDA;color:#5C3A10;border:0;cursor:pointer;min-height:28px;}',
    '.lga-chip.blue{background:#EAF1FA;color:#1F4E8A;} .lga-chip:hover{filter:brightness(.96);}',
    '.lga-box{position:relative;flex:1;min-height:520px;}',
    '.lga-hl,.lga-ta{position:absolute;inset:0;margin:0;box-sizing:border-box;padding:16px 18px;font-family:' + MONO + ';font-weight:500;font-size:13.5px;line-height:1.7;letter-spacing:0;tab-size:2;white-space:pre-wrap;overflow-wrap:break-word;word-break:normal;overflow-y:scroll;overflow-x:hidden;}',
    '.lga-hl{color:#2A2C31;pointer-events:none;overflow-y:hidden;scrollbar-gutter:stable;}',
    '.lga-ta{width:100%;height:100%;background:transparent;color:transparent;caret-color:#15171C;border:0;resize:none;outline:none;scrollbar-gutter:stable;}',
    '.lga-ta::selection{background:rgba(201,162,74,.35);color:transparent;} .lga-ta::placeholder{color:#8A857A;}',
    '.lga-ed-ft{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 14px;border-top:1px solid #EFECE4;font-size:12px;color:#5E5A51;}',
    '.lga-side{flex:1 1 280px;max-width:360px;min-width:0;display:flex;flex-direction:column;gap:14px;}',
    '.lga-pv{background:#FFFDF8;border:1px solid #E4DFD3;border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:8px;}',
    '.lga-kick{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7A4E16;}',
    '.lga-pv-box{display:flex;flex-direction:column;align-items:center;gap:6px;background:#FAF8F3;border:1px solid #EFE9DC;border-radius:12px;padding:8px;min-height:120px;justify-content:center;text-align:center;}',
    '.lga-pv-box svg{display:block;width:100%;max-width:270px;height:auto;} .lga-pv-math{font-family:' + SERIF + ';font-style:italic;font-size:20px;color:#15171C;max-width:100%;overflow-x:auto;}',
    '.lga-bar{height:4px;border-radius:2px;background:#E4DFD3;overflow:hidden;} .lga-bar i{display:block;height:100%;background:#C9A24A;}',
    '.lga-pane{padding:14px;display:flex;flex-direction:column;gap:10px;}',
    '.lga-pane label{display:flex;flex-direction:column;gap:6px;font-size:13px;color:#5E5A51;}',
    '.lga-pane select{height:44px;border-radius:10px;border:1px solid #E4DFD3;padding:0 10px;font:inherit;font-size:14px;color:#15171C;background:#fff;}',
    '.lga-note{font-size:12px;color:#5E5A51;line-height:1.45;} .lga-err{font-size:12px;color:#B42318;line-height:1.45;}',
    '.lga-teach{background:#F3EBDA;border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:10px;}',
    // ---- Thầy chiếu (iPad / chia sẻ màn hình)
    '.lga-pj{position:fixed;inset:0;z-index:4200;background:#FAF8F3;color:#15171C;font-family:"Be Vietnam Pro",system-ui,sans-serif;display:flex;flex-direction:column;gap:18px;padding:20px 28px;box-sizing:border-box;}',
    '.lga-pj-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;min-height:48px;}',
    '.lga-pj-brand{display:flex;align-items:center;gap:14px;min-width:0;} .lga-pj-brand img{width:40px;height:40px;flex-shrink:0;}',
    '.lga-pj-brand .n{font-family:' + SERIF + ';font-size:22px;font-weight:700;} .lga-pj-brand .n span{color:#7A4E16;}',
    '.lga-pj-brand .sep{width:1px;height:24px;background:#E4DFD3;} .lga-pj-brand .ctx{font-size:15px;color:#5E5A51;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.lga-pj-r{display:flex;align-items:center;gap:12px;flex-wrap:wrap;}',
    '.lga-pill{display:flex;align-items:center;gap:8px;height:40px;padding:0 14px;border-radius:20px;background:#FCE9E7;color:#B42318;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;}',
    '.lga-pill.calm{background:#EFECE4;color:#3D3A33;}',
    '.lga-pj-main{flex:1;min-height:0;display:flex;gap:20px;}',
    '.lga-pj-q{width:min(440px,36%);flex-shrink:0;background:#fff;border:1px solid #E4DFD3;border-radius:18px;padding:22px;display:flex;flex-direction:column;gap:14px;box-sizing:border-box;overflow:auto;}',
    '.lga-pj-q .stem{margin:0;font-size:17px;line-height:1.6;} .lga-pj-q mark{background:#F3E3B8;color:inherit;padding:1px 4px;border-radius:4px;}',
    '.lga-opt{display:flex;align-items:center;gap:10px;min-height:44px;padding:6px 14px;border-radius:10px;border:1px solid #E4DFD3;font-size:16px;box-sizing:border-box;}',
    '.lga-opt.ok{border:2px solid #1F7A4D;background:#E8F4EC;} .lga-opt.bad{border:2px solid #B42318;background:#FCE9E7;}',
    '.lga-opt .tag{margin-left:auto;font-size:13px;font-weight:600;white-space:nowrap;padding-left:8px;} .lga-opt.ok b,.lga-opt.ok .tag{color:#1F7A4D;} .lga-opt.bad b,.lga-opt.bad .tag{color:#B42318;}',
    '.lga-pj-b{flex:1;min-width:0;display:flex;}',
    '.lga-tb{position:absolute;left:50%;bottom:20px;transform:translateX(-50%);display:flex;align-items:center;gap:6px;padding:6px;border-radius:16px;background:#fff;border:1px solid #E4DFD3;box-shadow:0 6px 20px rgba(21,23,28,.08);z-index:2;font-size:14px;}',
    '.lga-tb button{width:44px;height:44px;border-radius:12px;border:0;background:transparent;color:#15171C;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;}',
    '.lga-tb button:hover{background:#F3EBDA;} .lga-tb button.on{background:#15171C;color:#fff;} .lga-tb button:disabled{opacity:.35;cursor:default;}',
    '.lga-tb .sw{width:20px;height:20px;border-radius:10px;display:block;} .lga-tb button.ring .sw{box-shadow:0 0 0 3px #fff,0 0 0 5px #15171C;} .lga-tb .div{width:1px;height:28px;background:#E4DFD3;margin:0 2px;}',
    '.lga-pj-bot{display:flex;align-items:center;gap:8px;min-height:52px;flex-wrap:wrap;}',
    '.lga-mk{height:40px;padding:0 12px;border-radius:10px;background:#fff;border:1px solid #E4DFD3;display:flex;align-items:center;gap:6px;font:inherit;font-size:13px;color:#15171C;cursor:pointer;}',
    '.lga-mk span{color:#5E5A51;font-variant-numeric:tabular-nums;} .lga-mk.on{background:#15171C;border-color:#15171C;color:#fff;} .lga-mk.on span{color:#C9A24A;}',
    '@media (max-width:900px){.lga-pj{padding:14px;gap:12px;overflow:auto;} .lga-pj-main{flex-direction:column;min-height:auto;} .lga-pj-q{width:100%;max-height:40vh;} .lga-pj-b{min-height:56vh;}}'
  ].join('\n');
  function ensureCss(){ if(document.getElementById('lga-css')) return; var s = document.createElement('style'); s.id = 'lga-css'; s.textContent = CSS; document.head.appendChild(s); }

  // ------------------------------------------------------------ tiện ích
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function qidFor(exam, q){ return String(exam.id) + '_q' + q.index; }
  function cName(q){ return 'C' + q.index; }
  function nowIso(){ return new Date().toISOString(); }
  function fmt(s){ return L() ? L().fmtTime(s) : String(Math.round(s)); }
  function icon(n, s, c){ return L() ? L().icon(n, s, c) : null; }
  function sleep(ms){ return new Promise(function(ok){ setTimeout(ok, ms); }); }

  // tỉ lệ sai từng câu của đề (lượt mới nhất của mỗi em có câu đó) — cache 30 phút
  var statsCache = {};
  async function computeStats(exam, force){
    var key = String(exam.id), c = statsCache[key];
    if(!force && c && Date.now() - c.at < 30 * 60 * 1000) return c.data;
    var ids = await O().loiGiai.studentIds(), pre = key + '_q', out = {};
    async function one(id){
      var list = [];
      try{ list = await O().attempts.loadForStudent(id); }catch(e){ return; }
      var seen = {};
      (list || []).forEach(function(a){
        var w = {}, r = {};
        (a.wrongQuestions || []).forEach(function(x){ if(x && x.qId) w[x.qId] = 1; });
        (a.rightQuestions || []).forEach(function(x){ if(x && x.qId) r[x.qId] = 1; });
        Object.keys(w).concat(Object.keys(r)).forEach(function(qid){
          if(qid.indexOf(pre) !== 0 || !/^\d+$/.test(qid.slice(pre.length)) || seen[qid]) return;
          seen[qid] = 1;
          var st = out[qid] || (out[qid] = { n: 0, wrong: 0, dist: {}, pick: {} });
          var ch = a.answers ? a.answers[qid] : null, k = (typeof ch === 'string' && /^[A-Da-d]$/.test(ch)) ? ch.toUpperCase() : null;
          st.n++;
          if(k) st.pick[k] = (st.pick[k] || 0) + 1;
          if(w[qid]){ st.wrong++; if(k) st.dist[k] = (st.dist[k] || 0) + 1; }
        });
      });
    }
    for(var i = 0; i < ids.length; i += 6) await Promise.all(ids.slice(i, i + 6).map(one));
    statsCache[key] = { at: Date.now(), data: out };
    return out;
  }
  function level(st){
    if(!st || !st.n) return { t: 'Chưa ai làm', rate: -1 };
    var rate = st.wrong / st.n;
    if(!st.wrong) return { t: 'Cả lớp đúng', rate: 0, allRight: true };
    if(rate >= 0.4) return { t: 'Sai nhiều', rate: rate, hot: true };
    if(rate >= 0.15) return { t: 'Sai vừa', rate: rate };
    return { t: 'Ít sai', rate: rate };
  }
  function hasTeacher(rec){ return !!(rec && rec.teacher && rec.teacher.n); }
  function badge(rec, lv){
    if(hasTeacher(rec)) return { t: 'Thầy ghi bút', bg: '#15171C', c: '#F3E3B8' };
    if(lv.hot) return { t: 'Nên ghi bút', bg: '#FCE9E7', c: '#B42318' };
    if(rec && String(rec.script || '').trim()){
      var who = rec.source === 'teacher' ? 'Thầy' : 'AI';
      return rec.status === 'published' ? { t: who + ' · đã duyệt', bg: '#E8F4EC', c: '#1F6B43' } : { t: who + ' · chờ duyệt', bg: '#EFECE4', c: '#3D3A33' };
    }
    return { t: 'Chưa có', bg: 'transparent', c: '#5E5A51', dashed: true };
  }
  async function aiScript(exam, q, st, mode, script){
    var body = { examTitle: exam.title || '', index: q.index, stem: q.stem || '', groupPassage: q.groupPassage || '', type: q.type || 'choice',
      options: (q.options || []).map(function(o){ return { key: o.key, text: o.text, isTrue: !!o.isTrue }; }), shortans: q.shortans, loigiai: q.loigiai || '',
      wrongDist: st && st.dist && Object.keys(st.dist).length ? st.dist : null, mode: mode || 'draft', script: script || '' };
    var r = await fetch('/api/ai-loigiai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    var j = await r.json().catch(function(){ return {}; });
    if(!r.ok) throw new Error(j.error || ('Lỗi ' + r.status));
    return j;
  }
  // tô màu cú pháp (lớp nằm DƯỚI textarea trong suốt — cùng phông, cùng cỡ để con trỏ khớp chữ)
  function hlScript(text){
    return String(text || '').split('\n').map(function(line){
      var e = esc(line), t = line.trim();
      if(/^#/.test(t)) return '<span style="color:#7A4E16">' + e + '</span>';
      if(/^&gt;|^>/.test(t)) return e.replace(/^(\s*)&gt;/, '$1<span style="color:#5E5A51">&gt;</span>');
      if(/^\[(?:hl|tô sáng|to sang)\s*:/i.test(t) || /^\?/.test(t)) return '<span style="color:#1F5FA8">' + e + '</span>';
      if(/^\[(?:svg|hình|hinh|sơ đồ|so do|3d|ảnh|anh|img|image)\s*:/i.test(t)) return '<span style="color:#1F4E8A">' + e + '</span>';
      if(/^\[(?:bẫy|bay|trap)/i.test(t)) return '<span style="color:#B42318">' + e + '</span>';
      if(/^!/.test(t)) return e.replace(/^(\s*)!/, '$1<span style="color:#B42318">!</span>');
      return e;
    }).join('\n') + '\n ';
  }
  function sceneOfCaret(text, pos){
    var before = String(text || '').slice(0, pos), n = 0;
    before.split('\n').forEach(function(l){ if(/^\s*#/.test(l)) n++; });
    return Math.max(0, n - 1);
  }
  function blobToB64(blob){
    return new Promise(function(ok, bad){ var fr = new FileReader(); fr.onload = function(){ ok(String(fr.result).split(',')[1] || ''); }; fr.onerror = function(){ bad(fr.error); }; fr.readAsDataURL(blob); });
  }
  function pickMime(){
    if(!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
    var c = ['audio/webm;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'];
    for(var i = 0; i < c.length; i++) if(MediaRecorder.isTypeSupported(c[i])) return c[i];
    return '';
  }

  // ============================================================ KHỐI SOẠN (Chi tiết đề)
  function Block(props){
    ensureCss(); if(L()) L().ensureCss();
    var exam = props.exam || {}, toast = props.fireToast || function(){};
    var qs = React.useMemo(function(){ return (exam.questions || []).filter(function(q){ return q && q.index != null; }); }, [exam.id, exam.questions]);
    var s1 = React.useState(function(){ try{ return localStorage.getItem('lga-open') !== '0'; }catch(e){ return true; } }); var open = s1[0], setOpen = s1[1];
    var s2 = React.useState(null); var recs = s2[0], setRecs = s2[1];
    var s3 = React.useState(null); var stats = s3[0], setStats = s3[1];
    var s4 = React.useState(false); var statsBusy = s4[0], setStatsBusy = s4[1];
    var s5 = React.useState(null); var sel = s5[0], setSel = s5[1];
    var s6 = React.useState(''); var draft = s6[0], setDraft = s6[1];
    var s7 = React.useState(false); var dirty = s7[0], setDirty = s7[1];
    var s8 = React.useState(''); var busy = s8[0], setBusy = s8[1];      // việc đang chạy cho câu đang chọn
    var s9 = React.useState(''); var bulk = s9[0], setBulk = s9[1];      // AI viết hàng loạt
    var s10 = React.useState(0); var caretScene = s10[0], setCaretScene = s10[1];
    var s11 = React.useState(function(){ return V() ? V().voicePref() : { voice: 'Charon', accent: 'nam', style: '' }; }); var pref = s11[0], setPref = s11[1];
    var s12 = React.useState(null); var proj = s12[0], setProj = s12[1];
    var s13 = React.useState(''); var err = s13[0], setErr = s13[1];
    var taRef = React.useRef(null), hlRef = React.useRef(null), bulkStop = React.useRef(false), recsRef = React.useRef(null);
    recsRef.current = recs;

    React.useEffect(function(){
      if(!open || recs !== null || !O() || !O().loiGiai) return;
      var off = false;
      O().loiGiai.listByExam(exam.id).then(function(list){ if(off) return; var m = {}; (list || []).forEach(function(r){ m[r.qid || r.id] = r; }); setRecs(m); })
        .catch(function(e){ if(!off){ setRecs({}); setErr('Không đọc được lời giải đã lưu: ' + ((e && e.message) || e)); } });
      return function(){ off = true; };
    }, [open, exam.id]);
    function loadStats(force){
      if(!O() || !O().attempts || !O().loiGiai.studentIds) return;
      setStatsBusy(true);
      computeStats(exam, force).then(function(s){ setStats(s || {}); }).catch(function(){ setStats({}); }).then(function(){ setStatsBusy(false); });
    }
    React.useEffect(function(){ if(open && stats === null && !statsBusy) loadStats(false); }, [open, exam.id]);

    // danh sách xếp theo tỉ lệ sai (câu chưa ai làm xuống cuối)
    var rows = qs.map(function(q){ var qid = qidFor(exam, q), st = stats ? stats[qid] : null; return { q: q, qid: qid, st: st, lv: level(st), rec: recs ? recs[qid] : null }; });
    rows.sort(function(a, b){ return (b.lv.rate - a.lv.rate) || (a.q.index - b.q.index); });
    var cur = rows.filter(function(r){ return r.qid === sel; })[0] || rows[0] || null;
    React.useEffect(function(){ if(!sel && rows[0] && recs !== null && (stats !== null || !statsBusy)) pick(rows[0].qid, true); }, [recs, stats, statsBusy]);

    function pick(qid, silent){
      if(qid === sel) return;
      if(dirty && !silent && !window.confirm('Kịch bản câu đang soạn chưa lưu. Bỏ thay đổi để chuyển câu?')) return;
      var r = recsRef.current ? recsRef.current[qid] : null;
      setSel(qid); setDraft(r && r.script ? r.script : ''); setDirty(false); setCaretScene(0); setErr('');
    }
    function setOpenP(v){ setOpen(v); try{ localStorage.setItem('lga-open', v ? '1' : '0'); }catch(e){} }
    function patchRec(qid, patch){ setRecs(function(m){ var n = Object.assign({}, m || {}); n[qid] = Object.assign({}, n[qid] || {}, patch); return n; }); }
    function baseFor(q){ return { qid: qidFor(exam, q), examId: String(exam.id), index: q.index, examTitle: exam.title || '' }; }

    async function save(status){
      if(!cur) return;
      var r = cur.rec, data = Object.assign(baseFor(cur.q), { script: draft, status: status || (r && r.status) || 'draft', source: (r && r.source) || 'teacher' });
      if(!r || !r.createdAt) data.createdAt = nowIso();
      setBusy('save');
      try{ await O().loiGiai.save(cur.qid, data); patchRec(cur.qid, data); setDirty(false); toast(status === 'published' ? 'Đã duyệt — học sinh xem được lời giải ' + cName(cur.q) + '.' : 'Đã lưu kịch bản ' + cName(cur.q) + '.'); }
      catch(e){ toast('Chưa lưu được: ' + ((e && e.message) || e), true); }
      setBusy('');
    }
    async function unpublish(){
      if(!cur || !cur.rec) return;
      setBusy('save');
      try{ await O().loiGiai.save(cur.qid, { status: 'draft' }); patchRec(cur.qid, { status: 'draft' }); toast('Đã gỡ ' + cName(cur.q) + ' khỏi trang học sinh.'); }
      catch(e){ toast('Chưa gỡ được: ' + ((e && e.message) || e), true); }
      setBusy('');
    }
    async function aiWrite(){
      if(!cur) return;
      if(String(draft).trim() && !window.confirm('AI viết lại sẽ thay kịch bản đang có trong ô soạn. Tiếp tục?')) return;
      setBusy('ai'); setErr('');
      try{
        var j = await aiScript(exam, cur.q, cur.st, 'draft');
        setDraft(j.script || ''); setDirty(true);
        if(j.hlDropped) toast('AI viết xong. Đã bỏ ' + j.hlDropped + ' cụm tô sáng không có trong đề.');
        if(!cur.rec || !cur.rec.source || cur.rec.source !== 'ai') patchRec(cur.qid, { source: 'ai' });
      }catch(e){ setErr(String((e && e.message) || e)); }
      setBusy('');
    }
    async function aiDraw(){
      if(!cur || !String(draft).trim()) return;
      setBusy('draw'); setErr('');
      try{ var j = await aiScript(exam, cur.q, cur.st, 'visuals', draft); setDraft(j.script || draft); setDirty(true); toast('Đã chèn ' + (j.nSvg || 1) + ' hình minh hoạ — xem trước rồi lưu.'); }
      catch(e){ setErr(String((e && e.message) || e)); }
      setBusy('');
    }
    async function aiBulk(){
      if(bulk){ bulkStop.current = true; return; }
      var todo = rows.filter(function(r){ return !(r.rec && String(r.rec.script || '').trim()); });
      if(!todo.length){ toast('Câu nào cũng đã có kịch bản.'); return; }
      if(!window.confirm('AI viết kịch bản nháp cho ' + todo.length + ' câu chưa có? Thầy đọc và duyệt từng câu trước khi phát.')) return;
      bulkStop.current = false;
      var ok = 0;
      for(var i = 0; i < todo.length; i++){
        if(bulkStop.current) break;
        var r = todo[i];
        setBulk('Đang viết ' + cName(r.q) + ' (' + (i + 1) + '/' + todo.length + ')…');
        try{
          var j = await aiScript(exam, r.q, r.st, 'draft');
          var data = Object.assign(baseFor(r.q), { script: j.script || '', status: 'draft', source: 'ai', createdAt: nowIso() });
          if(r.rec) delete data.createdAt;
          await O().loiGiai.save(r.qid, data); patchRec(r.qid, data); ok++;
          if(r.qid === sel && !dirty) setDraft(data.script);
        }catch(e){
          if(/giới hạn/.test(String(e && e.message))){ setBulk('Chạm giới hạn của Google, chờ 30 giây…'); await sleep(30000); i--; continue; }
          toast(cName(r.q) + ': ' + ((e && e.message) || e), true);
        }
      }
      setBulk(''); toast('AI đã viết ' + ok + ' kịch bản nháp — chờ thầy duyệt.');
    }
    async function genVoice(){
      if(!cur || !V()) return;
      if(!String(draft).trim()){ toast('Chưa có kịch bản để đọc.', true); return; }
      if(dirty || !cur.rec) await save();
      var r = Object.assign({}, recsRef.current[cur.qid] || {}, { index: cur.q.index, script: draft });
      var says = L().says(r), have = {};
      try{ have = await O().loiGiai.loadAudio(cur.qid); }catch(e){}
      var todo = [];
      says.forEach(function(t, i){ if(!L().normSay(t)) return; var c = have[i]; if(!c || L().normSay(c.text) !== L().normSay(t) || (c.voice && c.voice !== pref.voice)) todo.push(i); });
      V().saveVoicePref(pref);
      try{
        for(var k = 0; k < todo.length; k++){
          setBusy('voice:' + (k + 1) + '/' + todo.length);
          var i = todo[k], clip = null, tries = 0;
          while(!clip){
            try{ clip = await V().ttsClip(says[i], pref); }
            catch(e){ tries++; var lim = /giới hạn/.test(e.message); if((lim ? tries >= 10 : tries >= 3) || /GEMINI_API_KEY|không hỗ trợ|404/.test(e.message)) throw e; await sleep(lim ? 30000 : 2500); }
          }
          await O().loiGiai.saveAudio(cur.qid, i, clip);
        }
        Object.keys(have).forEach(function(key){ if(/^\d+$/.test(key) && Number(key) >= says.length) O().loiGiai.removeAudio(cur.qid, Number(key)).catch(function(){}); });
        var audio = { voice: pref.voice, n: says.length, at: nowIso() };
        await O().loiGiai.save(cur.qid, { audio: audio }); patchRec(cur.qid, { audio: audio });
        if(L().clearAudioCache) L().clearAudioCache();
        toast(todo.length ? 'Đã tạo giọng ' + cName(cur.q) + ' (' + todo.length + ' đoạn).' : 'Giọng đã đủ, không cần tạo thêm.');
      }catch(e){ toast('Chưa tạo được giọng: ' + ((e && e.message) || e), true); }
      setBusy('');
    }
    function preview(mode){
      if(!cur || !L()) return;
      var r = Object.assign({}, cur.rec || {}, baseFor(cur.q), { script: draft });
      L().open(r, { q: L().toPlayerQuestion(cur.q, exam.id), preview: true, mode: mode });
    }
    async function removeTake(){
      if(!cur || !hasTeacher(cur.rec) || !window.confirm('Xoá bản thầy ghi bút + giọng của ' + cName(cur.q) + '?')) return;
      try{
        for(var k = 0; k < cur.rec.teacher.n; k++) await O().loiGiai.removeAudio(cur.qid, 'tp' + k).catch(function(){});
        await O().loiGiai.removeAudio(cur.qid, 'tk').catch(function(){});
        await O().loiGiai.save(cur.qid, { teacher: null }); patchRec(cur.qid, { teacher: null });
        toast('Đã xoá bản ghi.');
      }catch(e){ toast('Chưa xoá được: ' + ((e && e.message) || e), true); }
    }
    function openProjector(startQid){
      // chỉ chữa câu có người sai (theo số liệu lớp); chưa có số liệu → chiếu đủ đề theo thứ tự
      var known = rows.some(function(r){ return r.st && r.st.n; });
      var queue = qs.filter(function(q){ var st = stats && stats[qidFor(exam, q)]; return !known || !st || !st.n || st.wrong > 0 || qidFor(exam, q) === startQid; });
      var skipped = known ? qs.filter(function(q){ return queue.indexOf(q) < 0; }) : [];
      var start = Math.max(0, queue.findIndex(function(q){ return qidFor(exam, q) === startQid; }));
      setProj({ queue: queue, skipped: skipped, start: start });
    }

    function onTaScroll(){ if(hlRef.current && taRef.current) hlRef.current.scrollTop = taRef.current.scrollTop; }
    function onCaret(){ var ta = taRef.current; if(ta) setCaretScene(sceneOfCaret(ta.value, ta.selectionStart)); }
    function insert(snip, caretBack){
      var ta = taRef.current, a = ta ? ta.selectionStart : draft.length, b = ta ? ta.selectionEnd : a;
      var before = draft.slice(0, a), lead = (before && !/\n$/.test(before)) ? '\n' : '';
      var nv = before + lead + snip + draft.slice(b), pos = (before + lead + snip).length - (caretBack || 0);
      setDraft(nv); setDirty(true);
      setTimeout(function(){ if(taRef.current){ taRef.current.focus(); taRef.current.setSelectionRange(pos, pos); onCaret(); } }, 0);
    }

    // ---------------------------------------------------------------- giao diện
    var head = h('div', { className: 'lga-top' },
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 } },
        h('span', { className: 'lga-crumb' }, 'Ngân hàng đề › ' + (exam.title || 'Đề')),
        h('h2', { className: 'lga-h1' }, 'Lời giải động')),
      h('div', { className: 'lga-acts' },
        open ? h('button', { type: 'button', className: 'lga-btn', disabled: !qs.length, onClick: function(){ openProjector(cur ? cur.qid : null); } }, icon('pen', 18), 'Chữa cả đề trên iPad') : null,
        open ? h('button', { type: 'button', className: 'lga-btn dark', disabled: recs === null, onClick: aiBulk, 'aria-live': 'polite' },
          bulk ? null : icon('spark', 18, '#C9A24A'), bulk ? bulk + ' · Dừng' : 'AI viết kịch bản cho các câu chưa có') : null,
        h('button', { type: 'button', className: 'lga-btn', 'aria-expanded': open ? 'true' : 'false', onClick: function(){ setOpenP(!open); } }, open ? 'Thu gọn' : 'Mở')));
    if(!open) return h('section', { className: 'lga', 'aria-label': 'Lời giải động' }, head);
    if(!qs.length) return h('section', { className: 'lga' }, head, h('p', { className: 'lga-note' }, 'Đề chưa có câu hỏi.'));

    var list = h('div', { className: 'lga-card lga-list', role: 'listbox', 'aria-label': 'Các câu của đề' },
      h('div', { className: 'lga-list-hd' }, h('span', { style: { fontSize: '14px', fontWeight: 700 } }, qs.length + ' câu'),
        h('button', { type: 'button', className: 'lga-btn sm', style: { border: 0, background: 'transparent', color: '#5E5A51', fontWeight: 500, padding: 0 }, disabled: statsBusy, onClick: function(){ loadStats(true); }, title: 'Tính lại tỉ lệ sai từ bài làm của lớp' },
          statsBusy ? 'Đang tính tỉ lệ sai…' : 'Xếp theo tỉ lệ sai')),
      rows.map(function(r){
        var bd = badge(r.rec, r.lv), on = cur && r.qid === cur.qid;
        return h('button', { key: r.qid, type: 'button', role: 'option', 'aria-selected': on ? 'true' : 'false', className: 'lga-row' + (on ? ' on' : ''), onClick: function(){ pick(r.qid); },
          title: r.st && r.st.n ? (r.st.wrong + '/' + r.st.n + ' em sai') : 'Chưa có em nào làm câu này' },
          h('b', null, cName(r.q)), h('span', { className: 'lga-lv' + (r.lv.hot ? ' hot' : '') }, r.lv.t),
          h('span', { className: 'lga-bdg', style: { background: bd.bg, color: bd.c, border: bd.dashed ? '1px dashed #C9C3B5' : '0' } }, bd.t));
      }));

    var parsed = L() ? L().parse(draft) : { scenes: [] }, nSc = parsed.scenes.length, scI = Math.min(caretScene, Math.max(0, nSc - 1)), sc = parsed.scenes[scI];
    var isPub = !!(cur && cur.rec && cur.rec.status === 'published');
    var editor = h('div', { className: 'lga-card lga-ed' },
      h('div', { className: 'lga-ed-hd' },
        h('span', { style: { fontSize: '14px', fontWeight: 700, marginRight: '8px' } }, 'Kịch bản ' + (cur ? 'câu ' + cur.q.index : '')),
        h('button', { type: 'button', className: 'lga-chip', onClick: function(){ insert('[hl: ]', 1); }, title: 'Tô sáng cụm chữ trong đề (chép y nguyên)' }, '[hl: …] tô sáng đề'),
        h('button', { type: 'button', className: 'lga-chip', onClick: function(){ insert('? | Gợi ý: ', 10); }, title: 'Video dừng chờ em tự làm' }, '? dừng cho em thử'),
        h('button', { type: 'button', className: 'lga-chip', onClick: function(){ var k = (cur && cur.st && Object.keys(cur.st.dist || {}).sort(function(a, b){ return cur.st.dist[b] - cur.st.dist[a]; })[0]) || 'B'; insert('[bẫy ' + k + ']\n> ', 0); }, title: 'Đoạn riêng cho phương án sai' }, '[bẫy B] đoạn riêng'),
        h('button', { type: 'button', className: 'lga-chip blue', onClick: function(){ insert('[svg: <svg viewBox="0 0 400 240"></svg>]', 8); }, title: 'Hình minh hoạ SVG (1 dòng)' }, '[svg: …] hình minh hoạ')),
      h('div', { className: 'lga-box' },
        h('pre', { className: 'lga-hl', ref: hlRef, 'aria-hidden': 'true', dangerouslySetInnerHTML: { __html: hlScript(draft) } }),
        h('textarea', { className: 'lga-ta', ref: taRef, value: draft, spellCheck: false, 'aria-label': 'Kịch bản lời giải ' + (cur ? cName(cur.q) : ''),
          placeholder: recs === null ? 'Đang tải…' : '# Đọc đề\n> Câu này có một bẫy…\n[hl: cụm chữ trong đề]\n\n# Chọn định luật\n…\n\nHoặc bấm "AI viết" để có bản nháp.',
          onChange: function(e){ setDraft(e.target.value); setDirty(true); onCaret(); }, onScroll: onTaScroll, onSelect: onCaret, onKeyUp: onCaret, onClick: onCaret })),
      h('div', { className: 'lga-ed-ft' },
        h('button', { type: 'button', className: 'lga-btn sm dark', disabled: !!busy || !cur, onClick: aiWrite }, icon('spark', 16, '#C9A24A'), busy === 'ai' ? 'AI đang viết…' : 'AI viết'),
        h('button', { type: 'button', className: 'lga-btn sm', disabled: !!busy || !dirty, onClick: function(){ save(); } }, busy === 'save' ? 'Đang lưu…' : (isPub ? 'Lưu' : 'Lưu nháp')),
        h('span', { style: { marginLeft: 'auto' } }, dirty ? 'Có thay đổi chưa lưu' : (cur && cur.rec && cur.rec.updatedAt ? 'Đã lưu ' + new Date(cur.rec.updatedAt).toLocaleString('vi-VN') : '')),
        err ? h('span', { className: 'lga-err', role: 'alert', style: { flexBasis: '100%' } }, err) : null));

    // xem trước cảnh đang soạn (theo vị trí con trỏ)
    var fig = null, math = null, firstTxt = null;
    if(sc) sc.items.forEach(function(it){ if(it.t === 'svg' && !fig) fig = it.v; else if(it.t === 'math' && !math) math = it.v; else if(!firstTxt && (it.t === 'li' || it.t === 'p' || it.t === 'note')) firstTxt = it.v; });
    var FXs = window.OPC_FX && window.OPC_FX.sanitizeSvg;
    var pv = h('div', { className: 'lga-pv' },
      h('span', { className: 'lga-kick' }, 'Xem trước · ' + (sc ? 'Bước ' + (scI + 1) + (sc.title ? ' · ' + sc.title : '') : 'chưa có cảnh')),
      h('div', { className: 'lga-pv-box' },
        fig && FXs ? h('div', { style: { width: '100%' }, dangerouslySetInnerHTML: { __html: FXs(fig) } }) : null,
        math ? h('div', { className: 'lga-pv-math', dangerouslySetInnerHTML: { __html: L().mathHtml(math, false) } }) : null,
        (!fig && !math) ? h('div', { style: { fontSize: '13px', color: '#5E5A51', lineHeight: 1.5 } }, sc ? h('span', { dangerouslySetInnerHTML: { __html: firstTxt ? L().rich(firstTxt) : esc(sc.title || '') } }) : 'Đặt con trỏ trong một cảnh (# …) để xem trước.') : null),
      h('div', { style: { display: 'flex', gap: '6px' } },
        h('button', { type: 'button', className: 'lga-btn sm dark', style: { flex: '1 1 auto' }, disabled: !String(draft).trim(), onClick: function(){ preview('script'); } }, icon('eye', 16), 'Xem thử cả clip'),
        h('button', { type: 'button', className: 'lga-btn sm', style: { flex: '1 1 auto' }, disabled: !!busy || !String(draft).trim(), onClick: aiDraw }, busy === 'draw' ? 'AI đang vẽ…' : 'AI vẽ lại hình')),
      h('div', { className: 'lga-bar', role: 'img', 'aria-label': 'Cảnh ' + (scI + 1) + ' trên ' + nSc }, h('i', { style: { width: (nSc ? Math.round((scI + 1) / nSc * 100) : 0) + '%' } })));

    var VL = V() ? V().VOICE_LIST : [];
    var aud = cur && cur.rec && cur.rec.audio;
    var voiceBusy = /^voice:/.test(busy);
    var voice = h('div', { className: 'lga-card lga-pane' },
      h('span', { style: { fontSize: '14px', fontWeight: 700 } }, 'Giọng đọc'),
      V() ? h('label', null, 'Giọng AI cố định của FaradayAI',
        h('select', { value: pref.voice, onChange: function(e){ setPref(Object.assign({}, pref, { voice: e.target.value })); } },
          VL.map(function(v){ return h('option', { key: v[0], value: v[0] }, v[0] + ' · ' + v[1]); }))) : h('span', { className: 'lga-note' }, 'Chưa nạp bộ giọng AI (admin-growth.js).'),
      h('button', { type: 'button', className: 'lga-btn dark', disabled: !V() || !!busy || !String(draft).trim(), onClick: genVoice, 'aria-live': 'polite' },
        voiceBusy ? 'Đang tạo giọng ' + busy.slice(6) + '…' : 'Tạo giọng 1 lần · lưu sẵn'),
      h('span', { className: 'lga-note' }, aud ? ('Đã có giọng ' + (aud.voice || '') + ' · ' + new Date(aud.at).toLocaleDateString('vi-VN') + '. ') : 'Chưa tạo giọng: học sinh nghe giọng máy của trình duyệt. ',
        'Học sinh phát lại file đã lưu, không gọi API mỗi lượt xem.'));

    var take = cur && hasTeacher(cur.rec) ? cur.rec.teacher : null;
    var teach = h('div', { className: 'lga-teach' },
      h('span', { style: { fontSize: '14px', fontWeight: 700 } }, 'Hoặc thầy tự giảng'),
      h('span', { style: { fontSize: '13px', color: '#3D3A33', lineHeight: 1.45 } }, 'Ghi nét bút Apple Pencil + giọng thầy ngay trên đề. Bản ghi tự gắn vào ' + (cur ? 'câu ' + cur.q.index : 'câu') + ', không cần YouTube.'),
      h('button', { type: 'button', className: 'lga-btn clay', disabled: !cur, onClick: function(){ openProjector(cur.qid); } }, h('span', { className: 'lga-dot', 'aria-hidden': 'true' }), take ? 'Ghi lại bằng bút trên iPad' : 'Ghi bằng bút trên iPad'),
      take ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '13px' } },
        h('span', null, 'Đã có bản ghi · ' + fmt(take.dur || 0)),
        h('button', { type: 'button', className: 'lga-btn sm', onClick: function(){ preview('teacher'); } }, 'Xem lại'),
        h('button', { type: 'button', className: 'lga-btn sm', style: { color: '#B42318' }, onClick: removeTake }, 'Xoá')) : null);

    var approve = h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
      (!isPub || dirty) ? h('button', { type: 'button', className: 'lga-btn green', style: { flex: '1 1 auto' }, disabled: !!busy || !cur || (!String(draft).trim() && !take), onClick: function(){ save('published'); } }, 'Duyệt và phát cho học sinh')
        : h('div', { style: { flex: '1 1 auto', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#1F6B43' } }, icon('check', 18), 'Đang phát cho học sinh'),
      (isPub && !dirty) ? h('button', { type: 'button', className: 'lga-btn', disabled: !!busy, onClick: unpublish }, 'Gỡ xuống') : null);

    return h('section', { className: 'lga', 'aria-label': 'Lời giải động' },
      head,
      h('div', { className: 'lga-cols' }, list, editor, h('div', { className: 'lga-side' }, pv, voice, teach, approve)),
      proj && ReactDOM ? ReactDOM.createPortal(h(Projector, {
        exam: exam, queue: proj.queue, skipped: proj.skipped, startIdx: proj.start, recs: recs || {}, stats: stats || {}, fireToast: toast,
        onSaved: function(qid, patch){ patchRec(qid, patch); },
        onClose: function(){ setProj(null); }
      }), document.body) : null);
  }

  // ============================================================ THẦY CHIẾU · ghi nét bút + giọng (iPad / chia sẻ màn hình)
  var INK = [{ v: '#B07A1E', t: 'Màu vàng' }, { v: '#D14332', t: 'Màu đỏ' }, { v: '#1F5FA8', t: 'Màu xanh' }];
  function Projector(props){
    ensureCss(); if(L()) L().ensureCss();
    var exam = props.exam, queue = props.queue || [], toast = props.fireToast || function(){};
    var s1 = React.useState(props.startIdx || 0); var pos = s1[0], setPos = s1[1];
    var s2 = React.useState('idle'); var rs = s2[0], setRs = s2[1];          // idle | rec
    var s3 = React.useState(0); var elapsed = s3[0], setElapsed = s3[1];
    var s4 = React.useState([]); var marks = s4[0], setMarks = s4[1];
    var s5 = React.useState({ m: 'pen', c: '#D14332' }); var tool = s5[0], setTool = s5[1];
    var s6 = React.useState(0); var sceneIdx = s6[0], setSceneIdx = s6[1];
    var s7 = React.useState(0); var saving = s7[0], setSaving = s7[1];
    var s8 = React.useState(0); var inkN = s8[0], setInkN = s8[1];
    var cvRef = React.useRef(null), strokes = React.useRef([]), sceneLog = React.useRef([[0, 0]]), curStroke = React.useRef(null), erasing = React.useRef(false);
    var qStart = React.useRef(performance.now()), sessStart = React.useRef(0), stream = React.useRef(null), mr = React.useRef(null);
    var chain = React.useRef(Promise.resolve()), penSeen = React.useRef(false), size = React.useRef({ w: 1, h: 1 }), raf = React.useRef(0), alive = React.useRef(true), recsRef = React.useRef(props.recs);
    recsRef.current = props.recs;
    var q = queue[pos], qid = q ? qidFor(exam, q) : '', rec = props.recs[qid], st = props.stats[qid] || null;
    var parsed = React.useMemo(function(){ return L().parse(rec && rec.script); }, [qid, rec && rec.script]);
    var sc = parsed.scenes[sceneIdx] || null;

    React.useEffect(function(){
      alive.current = true;
      var prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
      return function(){ alive.current = false; document.body.style.overflow = prevOverflow; stopStream(); };
    }, []);
    React.useEffect(function(){
      if(rs !== 'rec') return;
      var t = setInterval(function(){ setElapsed((performance.now() - sessStart.current) / 1000); }, 500);
      return function(){ clearInterval(t); };
    }, [rs]);
    React.useEffect(function(){
      function onKey(e){
        var tg = e.target && e.target.tagName; if(tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return;
        if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z'){ e.preventDefault(); undo(); }
        else if(e.key === 'ArrowRight' && e.shiftKey) goScene(sceneIdx + 1);
        else if(e.key === 'ArrowLeft' && e.shiftKey) goScene(sceneIdx - 1);
      }
      window.addEventListener('keydown', onKey); return function(){ window.removeEventListener('keydown', onKey); };
    });

    function relT(){ return Math.round(performance.now() - qStart.current); }
    function draw(){ if(raf.current) return; raf.current = requestAnimationFrame(function(){ raf.current = 0; L().drawInk(cvRef.current, strokes.current, null); }); }
    function resetInk(scene0){ strokes.current = []; curStroke.current = null; qStart.current = performance.now(); sceneLog.current = [[0, scene0 || 0]]; setSceneIdx(scene0 || 0); setInkN(0); draw(); }
    function goScene(i){ i = Math.max(0, Math.min(parsed.scenes.length - 1, i)); if(i === sceneIdx || i < 0) return; setSceneIdx(i); sceneLog.current.push([relT(), i]); }
    function live(){ return strokes.current.filter(function(s){ return s.x == null; }); }
    function undo(){ var l = live(); if(!l.length) return; l[l.length - 1].x = relT(); setInkN(live().length); draw(); }

    function startRecorder(){
      if(!stream.current) return;
      var mime = pickMime(), opt = { audioBitsPerSecond: 32000 }; if(mime) opt.mimeType = mime;
      var r; try{ r = new MediaRecorder(stream.current, opt); }catch(e){ r = new MediaRecorder(stream.current); }
      var cs = []; r.ondataavailable = function(e){ if(e.data && e.data.size) cs.push(e.data); }; r._cs = cs;
      r.start(1000); mr.current = r;
    }
    function stopRecorder(){
      return new Promise(function(ok){
        var r = mr.current; mr.current = null;
        if(!r || r.state === 'inactive'){ ok(null); return; }
        r.onstop = function(){ ok(new Blob(r._cs, { type: r.mimeType || 'audio/webm' })); };
        try{ r.stop(); }catch(e){ ok(null); }
      });
    }
    function stopStream(){ try{ if(mr.current && mr.current.state !== 'inactive') mr.current.stop(); }catch(e){} if(stream.current){ stream.current.getTracks().forEach(function(t){ t.stop(); }); stream.current = null; } }
    async function begin(){
      if(!navigator.mediaDevices || !window.MediaRecorder){ toast('Trình duyệt này chưa ghi âm được. Thầy dùng Safari / Chrome bản mới nhé.', true); return; }
      try{ stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
      catch(e){ toast('Chưa mở được micro — thầy cho phép micro rồi bấm lại.', true); return; }
      sessStart.current = performance.now(); setElapsed(0);
      resetInk(sceneIdx); startRecorder(); setRs('rec');
      setMarks([{ qid: qid, t: 0 }]);
    }
    // gói bản ghi của câu đang chiếu → lưu nền (giọng chia mẩu + nét bút), rồi gắn vào câu
    function finishCurrent(){
      var qq = q, ink = { s: strokes.current.map(function(s){ return s; }), sc: sceneLog.current.slice() }, dur = (performance.now() - qStart.current) / 1000;
      var ar = size.current.w / Math.max(1, size.current.h), p = stopRecorder();
      chain.current = chain.current.then(function(){ return p; }).then(function(blob){
        if(!blob || !blob.size || dur < 2) return null;
        return saveTake(qq, blob, ink, dur, ar);
      }).catch(function(e){ toast('Chưa lưu được bản ghi ' + cName(qq) + ': ' + ((e && e.message) || e), true); });
      return chain.current;
    }
    async function saveTake(qq, blob, ink, dur, ar){
      var id = qidFor(exam, qq);
      if(alive.current) setSaving(function(n){ return n + 1; });
      try{
        var b64 = await blobToB64(blob), CH = 800000, n = Math.max(1, Math.ceil(b64.length / CH)), mime = (blob.type || 'audio/webm').split(';')[0];
        for(var k = 0; k < n; k++) await O().loiGiai.saveAudio(id, 'tp' + k, { b64: b64.slice(k * CH, (k + 1) * CH), mime: mime, part: k, source: 'teacher' });
        var prev = recsRef.current[id], old = prev && prev.teacher && prev.teacher.n || 0;
        for(var j = n; j < old; j++) await O().loiGiai.removeAudio(id, 'tp' + j).catch(function(){});
        ink.s = ink.s.filter(function(s){ return s.p && s.p.length; });
        var inkStr = JSON.stringify(ink);
        if(inkStr.length > 900000){ ink.s.forEach(function(s){ s.p = s.p.filter(function(pt, i){ return i % 2 === 0 || i === s.p.length - 1; }); }); inkStr = JSON.stringify(ink); }
        await O().loiGiai.saveAudio(id, 'tk', { ink: inkStr, source: 'teacher' });
        var patch = { qid: id, examId: String(exam.id), index: qq.index, examTitle: exam.title || '', teacher: { mime: mime, dur: Math.round(dur * 10) / 10, n: n, at: nowIso(), ar: Math.round(ar * 1000) / 1000 } };
        if(!prev){ patch.status = 'published'; patch.script = ''; patch.source = 'teacher'; patch.createdAt = nowIso(); }
        await O().loiGiai.save(id, patch);
        if(props.onSaved) props.onSaved(id, patch);
        if(L().clearAudioCache) L().clearAudioCache();
      } finally { if(alive.current) setSaving(function(n){ return Math.max(0, n - 1); }); }
    }
    function goTo(np){
      if(np < 0 || np >= queue.length || np === pos) return;
      if(rs === 'rec') finishCurrent();
      setPos(np); resetInk(0);
      if(rs === 'rec'){ startRecorder(); var nq = queue[np]; setMarks(function(m){ return m.concat([{ qid: qidFor(exam, nq), t: (performance.now() - sessStart.current) / 1000 }]); }); }
    }
    function end(){
      if(rs !== 'rec') return Promise.resolve();
      var n = marks.length, p = finishCurrent();
      setRs('idle'); if(stream.current){ stream.current.getTracks().forEach(function(t){ t.stop(); }); stream.current = null; }
      return p.then(function(){ toast('Đã lưu bản ghi ' + n + ' câu — gắn thẳng vào từng câu.'); });
    }
    function close(){
      if(rs === 'rec'){ if(!window.confirm('Đang ghi. Dừng và lưu bản ghi câu này rồi thoát?')) return; end(); }
      props.onClose();
    }

    // ---- bút
    function pt(e){
      var r = cvRef.current.getBoundingClientRect();
      return [Math.round((e.clientX - r.left) / r.width * 1000) / 1000, Math.round((e.clientY - r.top) / r.height * 1000) / 1000, relT()];
    }
    function eraseAt(p){
      var W = size.current.w, H = size.current.h, hit = false;
      for(var i = strokes.current.length - 1; i >= 0 && !hit; i--){
        var s = strokes.current[i]; if(s.x != null) continue;
        for(var k = 0; k < s.p.length; k++){ var dx = (s.p[k][0] - p[0]) * W, dy = (s.p[k][1] - p[1]) * H; if(dx * dx + dy * dy < 196){ s.x = p[2]; hit = true; break; } }
      }
      if(hit){ setInkN(live().length); draw(); }
    }
    var canvasProps = {
      style: { touchAction: 'none', cursor: tool.m === 'erase' ? 'cell' : 'crosshair' },
      onPointerDown: function(e){
        if(e.pointerType === 'pen') penSeen.current = true;
        if(e.pointerType === 'touch' && penSeen.current) return;   // có Apple Pencil rồi: tay chạm không vẽ (tì tay)
        if(e.button > 0) return;
        e.preventDefault(); try{ e.currentTarget.setPointerCapture(e.pointerId); }catch(x){}
        var p = pt(e);
        if(tool.m === 'erase'){ erasing.current = true; eraseAt(p); return; }
        var s = { c: tool.c, m: tool.m, p: [p] }; strokes.current.push(s); curStroke.current = s; draw();
      },
      onPointerMove: function(e){
        if(erasing.current){ eraseAt(pt(e)); return; }
        var s = curStroke.current; if(!s) return;
        var evs = (e.nativeEvent && e.nativeEvent.getCoalescedEvents) ? e.nativeEvent.getCoalescedEvents() : []; if(!evs.length) evs = [e];
        evs.forEach(function(ev){ var p = pt(ev), l = s.p[s.p.length - 1]; if(Math.abs(p[0] - l[0]) + Math.abs(p[1] - l[1]) > 0.0015) s.p.push(p); });
        draw();
      },
      onPointerUp: function(){ if(curStroke.current) setInkN(live().length); curStroke.current = null; erasing.current = false; },
      onPointerCancel: function(){ curStroke.current = null; erasing.current = false; }
    };

    if(!q) return h('div', { className: 'lga-pj' }, h('p', null, 'Không có câu nào cần chữa.'), h('button', { type: 'button', className: 'lga-btn', onClick: props.onClose }, 'Đóng'));

    // ---- đề bên trái
    var hl = []; parsed.scenes.forEach(function(x){ hl = hl.concat(x.hl); });
    var dist = (st && st.pick) || {}, wrongDist = (st && st.dist) || {};
    var topWrong = Object.keys(wrongDist).sort(function(a, b){ return wrongDist[b] - wrongDist[a]; })[0] || null;
    var trapKeys = {}; parsed.scenes.forEach(function(x){ x.items.forEach(function(it){ if(it.t === 'trap' && it.key) trapKeys[it.key.toUpperCase()] = 1; }); });
    var opts = null;
    if(q.type === 'choiceTF') opts = (q.options || []).map(function(o){
      return h('div', { key: o.key, className: 'lga-opt ' + (o.isTrue ? 'ok' : 'bad'), style: { fontSize: '15px' } }, h('b', null, o.key + ')'),
        h('span', { dangerouslySetInnerHTML: { __html: L().stemHtml(o.text, []) } }), h('span', { className: 'tag' }, o.isTrue ? 'Đúng' : 'Sai'));
    });
    else if(q.type === 'shortans') opts = [h('div', { key: 'a', className: 'lga-opt ok' }, h('b', null, 'Đáp số'), h('span', null, String(q.shortans == null ? '' : q.shortans)))];
    else opts = (q.options || []).map(function(o){
      var ok = !!o.isTrue, bad = !ok && o.key === topWrong;
      var tag = ok ? 'Đáp án' : (bad ? ((trapKeys[o.key] ? 'Bẫy · ' : '') + wrongDist[o.key] + ' em chọn') : null);
      return h('div', { key: o.key, className: 'lga-opt' + (ok ? ' ok' : (bad ? ' bad' : '')) }, h('b', null, o.key + '.'),
        h('span', { dangerouslySetInnerHTML: { __html: L().stemHtml(o.text, []) } }), tag ? h('span', { className: 'tag' }, tag) : null);
    });
    var classLine = st && st.n
      ? ((q.options && q.type !== 'choiceTF' && q.type !== 'shortans' && Object.keys(dist).length)
        ? 'Lớp chọn: ' + (q.options || []).map(function(o){ return o.key + ' ' + (dist[o.key] || 0) + ' em'; }).join(' · ')
        : st.wrong + '/' + st.n + ' em làm sai')
      : 'Chưa có số liệu lớp cho câu này';
    var left = h('div', { className: 'lga-pj-q' },
      h('span', { className: 'lga-kick', style: { fontSize: '13px' } }, 'Câu ' + q.index),
      q.groupPassage ? h('p', { className: 'stem', style: { color: '#5E5A51', fontSize: '15px' }, dangerouslySetInnerHTML: { __html: L().stemHtml(q.groupPassage, hl) } }) : null,
      h('p', { className: 'stem', dangerouslySetInnerHTML: { __html: L().stemHtml(q.stem, hl) } }),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, opts),
      h('div', { style: { marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#5E5A51' } }, icon('chart', 18), classLine));

    // ---- bảng bên phải + thanh công cụ bút
    var label = sc ? ('Bước ' + (sceneIdx + 1) + ' / ' + parsed.scenes.length + (sc.title ? ' · ' + sc.title : '')) : 'Bảng trắng · câu này chưa có kịch bản';
    function tb(name, lab, on, onClick, dis, body){ return h('button', { type: 'button', 'aria-label': lab, title: lab, className: on ? 'on' : '', 'aria-pressed': on == null ? undefined : (on ? 'true' : 'false'), disabled: dis, onClick: onClick }, body || icon(name, 20)); }
    var toolbar = h('div', { className: 'lga-tb', role: 'toolbar', 'aria-label': 'Bút viết' },
      tb('pen', 'Bút', tool.m === 'pen', function(){ setTool({ m: 'pen', c: tool.c }); }),
      tb('hl', 'Bút tô sáng', tool.m === 'hl', function(){ setTool({ m: 'hl', c: tool.c }); }),
      INK.map(function(c){
        return h('button', { key: c.v, type: 'button', 'aria-label': c.t, title: c.t, 'aria-pressed': tool.c === c.v ? 'true' : 'false', className: tool.c === c.v ? 'ring' : '',
          onClick: function(){ setTool({ m: tool.m === 'erase' ? 'pen' : tool.m, c: c.v }); } }, h('span', { className: 'sw', style: { background: c.v } }));
      }),
      tb('eraser', 'Tẩy', tool.m === 'erase', function(){ setTool({ m: 'erase', c: tool.c }); }),
      tb('undo', 'Hoàn tác', null, undo, !inkN),
      parsed.scenes.length > 1 ? h('span', { className: 'div', 'aria-hidden': 'true' }) : null,
      parsed.scenes.length > 1 ? tb('prev', 'Bước trước', null, function(){ goScene(sceneIdx - 1); }, sceneIdx <= 0) : null,
      parsed.scenes.length > 1 ? tb('next', 'Bước sau', null, function(){ goScene(sceneIdx + 1); }, sceneIdx >= parsed.scenes.length - 1) : null);
    var board = h(L().Board, { scene: sc, label: label, canvasRef: cvRef, canvasProps: canvasProps, style: { height: '100%' },
      onSize: function(w, hh){ size.current = { w: w, h: hh }; draw(); } }, toolbar);

    // ---- đầu trang
    var last = pos >= queue.length - 1;
    var top = h('div', { className: 'lga-pj-top' },
      h('div', { className: 'lga-pj-brand' }, h('img', { src: '/logo-mark.svg', alt: '' }),
        h('span', { className: 'n' }, 'Faraday', h('span', null, 'AI')), h('span', { className: 'sep', 'aria-hidden': 'true' }),
        h('span', { className: 'ctx' }, 'Chữa đề · ' + (exam.title || ''))),
      h('div', { className: 'lga-pj-r' },
        saving ? h('span', { className: 'lga-pill calm', 'aria-live': 'polite' }, 'Đang lưu ' + saving + ' bản ghi…') : null,
        rs === 'rec'
          ? h('span', { className: 'lga-pill', role: 'status' }, h('span', { className: 'lga-dot' }), 'Đang ghi bút + giọng · ' + fmt(elapsed))
          : h('button', { type: 'button', className: 'lga-btn', onClick: begin }, h('span', { className: 'lga-dot', 'aria-hidden': 'true' }), 'Bắt đầu ghi bút + giọng'),
        rs === 'rec' ? h('button', { type: 'button', className: 'lga-btn', onClick: end }, 'Dừng ghi') : null,
        h('button', { type: 'button', className: 'lga-btn dark', onClick: function(){ if(last){ if(rs === 'rec') end(); else close(); } else goTo(pos + 1); } },
          last ? (rs === 'rec' ? 'Kết thúc · lưu bản ghi' : 'Xong') : (rs === 'rec' ? 'Câu tiếp · tự ghi mốc' : 'Câu tiếp'), last ? null : icon('arrow', 18)),
        h('button', { type: 'button', className: 'lga-btn', style: { width: '44px', padding: 0 }, 'aria-label': 'Thoát chế độ chiếu', onClick: close }, icon('close', 18))));

    // ---- mốc tự ghi
    var markOf = {}; marks.forEach(function(m){ markOf[m.qid] = m.t; });
    var bottom = h('div', { className: 'lga-pj-bot' },
      h('span', { style: { fontSize: '13px', color: '#5E5A51', marginRight: '6px' } }, rs === 'rec' || marks.length ? 'Mốc tự ghi' : 'Các câu chữa'),
      queue.map(function(qq, i){
        var id = qidFor(exam, qq), on = i === pos, t = markOf[id];
        return h('button', { key: id, type: 'button', className: 'lga-mk' + (on ? ' on' : ''), onClick: function(){ goTo(i); }, 'aria-current': on ? 'true' : undefined },
          h('b', null, cName(qq)), (t != null || on) ? h('span', null, (t != null ? fmt(t) : '') + (on ? (t != null ? ' · ' : '') + (rs === 'rec' ? 'đang ghi' : 'đang chiếu') : '')) : null);
      }),
      h('span', { style: { fontSize: '13px', color: '#5E5A51', marginLeft: 'auto' } },
        props.skipped && props.skipped.length ? 'Chỉ chữa câu có người sai · ' + props.skipped.map(cName).join(', ') + ' bỏ qua (cả lớp đúng)' : 'Chiếu ' + queue.length + ' câu'));

    return h('div', { className: 'lga-pj', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Chữa đề và ghi nét bút' },
      top, h('div', { className: 'lga-pj-main' }, left, h('div', { className: 'lga-pj-b' }, board)), bottom);
  }

  window.OPC_LGD_ADMIN = { Block: Block, Projector: Projector, computeStats: computeStats };
})(window);
