/**
 * dgnl.js — THÊM 26/10/2026 · LUYỆN THI ĐÁNH GIÁ NĂNG LỰC ĐHQG-HCM (V-ACT) cho học sinh (index.html)
 * Cấu trúc đề thật (tham khảo 2026): 120 câu 4 lựa chọn, 150 phút — Tiếng Việt 30 · Tiếng Anh 30 · Toán học 30 ·
 * Tư duy khoa học 30 (Logic & phân tích số liệu 12 + Suy luận khoa học 18); thang 1.200 (mỗi phần lớn 300).
 * FaradayAI tập trung Toán học + Tư duy khoa học. Đề nạp ở admin › 🏆 HSG · Olympic · ĐGNL (collection de_thi_dgnl),
 * phần thi lấy từ ô thứ 2 của tag %[M?][Phần thi][Dạng bài]. Em được thầy mở khoá 'dgnl' mới thấy đề.
 * Làm trên máy như thi thật: chia phần, đồng hồ (1,25 phút/câu), đánh dấu câu, tự lưu nháp; nộp → chấm tự động,
 * điểm từng phần, điểm QUY ĐỔI THAM KHẢO thang 1.200 (đề thật chấm theo IRT — đây chỉ là ước tính), xem lời giải.
 * Xuất: window.OPC_DGNL = { openList(student) }
 */
(function(window){
  'use strict';
  var React = window.React, ReactDOM = window.ReactDOM; if(!React || !ReactDOM) return;
  var h = React.createElement;
  function live(){ return window.OPC_LIVE || null; }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // LaTeX trong đề → HTML (KaTeX nếu có)
  function tex(t){
    var s = String(t || '').replace(/\\textbf\{([^{}]*)\}/g, '**$1**').replace(/\\textit\{([^{}]*)\}/g, '$1').replace(/\\\\/g, '\n').replace(/~/g, ' ');
    var out = '';
    s.split(/(\$\$[\s\S]+?\$\$|\$[^$]+\$)/g).forEach(function(p){
      var m = /^\$\$([\s\S]+)\$\$$/.exec(p) || /^\$([^$]+)\$$/.exec(p);
      if(m){ try{ out += window.katex ? window.katex.renderToString(m[1], { displayMode: p.indexOf('$$') === 0, throwOnError: false }) : esc(p); }catch(e){ out += esc(p); } }
      else out += esc(p).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
    });
    return out;
  }
  function T(t, tag){ return h(tag || 'span', { dangerouslySetInnerHTML: { __html: tex(t) } }); }
  function fmtT(s){ s = Math.max(0, Math.floor(s)); var hh = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return (hh ? hh + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (ss < 10 ? '0' : '') + ss; }
  function norm(s){ return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase(); }
  // phần thi → nhóm chấm điểm (mỗi nhóm tối đa 300 điểm như đề thật)
  var SECTIONS = [
    { key: 'tv', name: 'Tiếng Việt', group: 'tv', test: /tieng viet|ngu van|van hoc/ },
    { key: 'ta', name: 'Tiếng Anh', group: 'ta', test: /tieng anh|english/ },
    { key: 'toan', name: 'Toán học', group: 'toan', test: /toan/ },
    { key: 'logic', name: 'Logic & phân tích số liệu', group: 'tdkh', test: /logic|so lieu|phan tich|du lieu/ },
    { key: 'kh', name: 'Suy luận khoa học', group: 'tdkh', test: /suy luan|khoa hoc|vat li|vat ly|hoa hoc|sinh hoc|tu duy/ }
  ];
  var GROUPS = { tv: 'Tiếng Việt', ta: 'Tiếng Anh', toan: 'Toán học', tdkh: 'Tư duy khoa học' };
  function sectionOf(q){
    var s = norm(q.section || '') + ' ' + norm(q.topic || '');
    for(var i = 0; i < SECTIONS.length; i++) if(SECTIONS[i].test.test(s)) return SECTIONS[i];
    return { key: 'khac', name: q.section || 'Khác', group: 'khac' };
  }
  function correctKey(q){ var o = (q.options || []).filter(function(x){ return x.isTrue; })[0]; return o ? o.key : null; }
  function score(qs, ans){
    var by = {}, grp = {}, correct = 0;
    qs.forEach(function(q){
      var sec = sectionOf(q), ok = ans[q.index] && ans[q.index] === correctKey(q);
      if(ok) correct++;
      (by[sec.key] = by[sec.key] || { name: sec.name, group: sec.group, total: 0, correct: 0 }); by[sec.key].total++; if(ok) by[sec.key].correct++;
      (grp[sec.group] = grp[sec.group] || { total: 0, correct: 0 }); grp[sec.group].total++; if(ok) grp[sec.group].correct++;
    });
    var scaled = 0, groupsN = 0;
    Object.keys(grp).forEach(function(g){ if(g === 'khac') return; grp[g].points = Math.round(grp[g].correct / grp[g].total * 300); scaled += grp[g].points; groupsN++; });
    var est1200 = groupsN ? Math.round(scaled / (groupsN * 300) * 1200) : null;
    return { correct: correct, total: qs.length, sections: by, groups: grp, scaled: scaled, maxScaled: groupsN * 300, est1200: est1200, full: groupsN === 4 };
  }

  var CSS = [
    '.dg2-ov{position:fixed;inset:0;z-index:3600;background:var(--bg,#f6f4ee);color:var(--ink,#111);overflow:auto;}',
    '.dg2-top{position:sticky;top:0;z-index:5;background:var(--surface,#fff);border-bottom:1px solid var(--line,#e5e0d4);padding:10px 16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;}',
    '.dg2-top .t{font-weight:800;flex:1;min-width:180px;} .dg2-timer{font-family:"IBM Plex Mono",monospace;font-weight:800;font-size:1.15rem;padding:4px 12px;border-radius:8px;background:var(--surface-2,#f1ede3);} .dg2-timer.low{color:#fff;background:#dc2626;}',
    '.dg2-b{border:1px solid var(--line,#ddd);background:var(--surface,#fff);color:inherit;border-radius:9px;padding:8px 14px;font-weight:700;cursor:pointer;font-family:inherit;font-size:.9rem;} .dg2-b.p{background:#b88a3e;border-color:#b88a3e;color:#fff;} .dg2-b:disabled{opacity:.5;cursor:default;}',
    '.dg2-wrap{max-width:1180px;margin:0 auto;padding:16px;display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:16px;} @media(max-width:860px){.dg2-wrap{grid-template-columns:1fr;}}',
    '.dg2-card{background:var(--surface,#fff);border:1px solid var(--line,#e5e0d4);border-radius:14px;padding:16px 18px;}',
    '.dg2-sec{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;} .dg2-sec button{border:1px solid var(--line,#ddd);background:transparent;color:inherit;border-radius:999px;padding:5px 12px;font-weight:700;font-size:.82rem;cursor:pointer;} .dg2-sec button.on{background:#b88a3e;border-color:#b88a3e;color:#fff;}',
    '.dg2-pass{background:var(--surface-2,#f6f3ec);border-left:3px solid #b88a3e;padding:10px 12px;border-radius:0 8px 8px 0;margin-bottom:10px;font-size:.95rem;line-height:1.65;}',
    '.dg2-stem{font-size:1.02rem;line-height:1.7;} .dg2-img{max-width:100%;max-height:340px;display:block;margin:8px auto;border-radius:6px;background:#fff;}',
    '.dg2-opt{display:flex;gap:10px;align-items:flex-start;width:100%;text-align:left;border:1.5px solid var(--line,#ddd);background:var(--surface,#fff);color:inherit;border-radius:10px;padding:10px 12px;margin-top:8px;cursor:pointer;font:inherit;line-height:1.55;}',
    '.dg2-opt b{flex:none;width:26px;height:26px;border-radius:50%;border:1.5px solid currentColor;display:inline-flex;align-items:center;justify-content:center;font-size:.85rem;}',
    '.dg2-opt.sel{border-color:#b88a3e;background:rgba(201,162,95,.13);} .dg2-opt.sel b{background:#b88a3e;color:#fff;border-color:#b88a3e;}',
    '.dg2-opt.ok{border-color:#16a34a;background:rgba(22,163,74,.1);} .dg2-opt.bad{border-color:#dc2626;background:rgba(220,38,38,.08);}',
    '.dg2-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:5px;} .dg2-grid button{border:1px solid var(--line,#ddd);background:var(--surface,#fff);color:inherit;border-radius:6px;padding:5px 0;font-size:.78rem;font-weight:700;cursor:pointer;position:relative;}',
    '.dg2-grid button.a{background:#b88a3e;color:#fff;border-color:#b88a3e;} .dg2-grid button.c{outline:2px solid #111;outline-offset:1px;} .dg2-grid button.f:after{content:"";position:absolute;top:2px;right:2px;width:6px;height:6px;border-radius:50%;background:#f59e0b;}',
    '.dg2-grid button.ok{background:#16a34a;color:#fff;border-color:#16a34a;} .dg2-grid button.bad{background:#dc2626;color:#fff;border-color:#dc2626;}',
    '.dg2-gh{font-size:.78rem;font-weight:800;color:var(--ink-2,#555);margin:10px 0 5px;}',
    '.dg2-sol{margin-top:12px;padding:10px 12px;border-radius:8px;background:var(--surface-2,#f6f3ec);font-size:.92rem;line-height:1.6;}',
    '.dg2-score{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-top:12px;} .dg2-score div{background:var(--surface-2,#f6f3ec);border-radius:10px;padding:10px 12px;} .dg2-score b{display:block;font-size:1.5rem;}',
    '.dg2-ex{display:flex;justify-content:space-between;align-items:center;gap:10px;border:1px solid var(--line,#e5e0d4);border-radius:10px;padding:10px 12px;margin-top:8px;flex-wrap:wrap;}'
  ].join('\n');
  function ensureCss(){ if(document.getElementById('dg2-css')) return; var s = document.createElement('style'); s.id = 'dg2-css'; s.textContent = CSS; document.head.appendChild(s); }

  function Exam(props){
    var qs = props.questions, ex = props.exam, st = props.student;
    var storeKey = 'dgnl-draft-' + st.id + '-' + ex.id;
    var draft0 = (function(){ try{ return JSON.parse(localStorage.getItem(storeKey) || 'null'); }catch(e){ return null; } })();
    var as = React.useState((draft0 && draft0.ans) || {}); var ans = as[0], setAns = as[1];
    var fs = React.useState((draft0 && draft0.flag) || {}); var flag = fs[0], setFlag = fs[1];
    var is = React.useState(0); var cur = is[0], setCur = is[1];
    var ss = React.useState((draft0 && draft0.startedAt) || Date.now()); var startedAt = ss[0];
    var ns = React.useState(Date.now()); var now = ns[0], setNow = ns[1];
    var rs = React.useState(null); var result = rs[0], setResult = rs[1];
    var vs = React.useState(false); var saved = vs[0], setSaved = vs[1];
    var minutes = ex.minutes || Math.ceil(qs.length * 1.25);
    var left = minutes * 60 - (now - startedAt) / 1000;
    var secs = []; qs.forEach(function(q, i){ var s = sectionOf(q); var g = secs.filter(function(x){ return x.key === s.key; })[0]; if(!g){ g = { key: s.key, name: s.name, idx: [] }; secs.push(g); } g.idx.push(i); });
    React.useEffect(function(){ if(result) return; var t = setInterval(function(){ setNow(Date.now()); }, 1000); return function(){ clearInterval(t); }; }, [result]);
    React.useEffect(function(){ if(!result){ try{ localStorage.setItem(storeKey, JSON.stringify({ ans: ans, flag: flag, startedAt: startedAt })); }catch(e){} } }, [ans, flag]);
    React.useEffect(function(){ if(!result && left <= 0) finish(true); }, [now]);
    React.useEffect(function(){ try{ document.querySelector('.dg2-ov').scrollTo(0, 0); }catch(e){} }, [cur, !!result]);
    function finish(auto){
      if(result) return;
      if(!auto){ var miss = qs.length - Object.keys(ans).length; if(!window.confirm(miss ? 'Còn ' + miss + ' câu chưa làm. Vẫn nộp bài?' : 'Nộp bài và xem kết quả?')) return; }
      var r = score(qs, ans); r.minutesUsed = Math.round(Math.min(minutes * 60, (Date.now() - startedAt) / 1000) / 60);
      setResult(r); try{ localStorage.removeItem(storeKey); }catch(e){}
      var L = live();
      if(L && L.saveSpecialAttempt){
        var sec = {}; Object.keys(r.sections).forEach(function(k){ sec[k] = { name: r.sections[k].name, correct: r.sections[k].correct, total: r.sections[k].total }; });
        L.saveSpecialAttempt(st.id, { track: 'dgnl', examId: ex.id, examTitle: ex.title, autoScore: r.est1200, scaled: r.scaled, maxScaled: r.maxScaled, correct: r.correct, total: r.total,
          sections: sec, minutesUsed: r.minutesUsed, maxScore: 1200, selfScore: r.est1200 != null ? Math.round(r.est1200 / 60 * 100) / 100 : null, answers: ans, auto: !!auto })
          .then(function(res){ setSaved(!!(res && res.ok)); });
      }
    }
    var q = qs[cur], review = !!result, ck = correctKey(q);
    function optCls(o){ var c = 'dg2-opt'; if(review){ if(o.key === ck) c += ' ok'; else if(ans[q.index] === o.key) c += ' bad'; } else if(ans[q.index] === o.key) c += ' sel'; return c; }
    var curSec = sectionOf(q).key;
    return h('div', null,
      h('div', { className: 'dg2-top' },
        h('div', { className: 't' }, '🎯 ' + ex.title, h('div', { style: { fontSize: '.78rem', fontWeight: 500, color: 'var(--ink-2,#666)' } }, review ? 'Kết quả & lời giải' : (qs.length + ' câu · ' + minutes + ' phút · đã làm ' + Object.keys(ans).length + '/' + qs.length))),
        !review ? h('span', { className: 'dg2-timer' + (left < 300 ? ' low' : '') }, '⏱ ' + fmtT(left)) : null,
        !review ? h('button', { type: 'button', className: 'dg2-b p', onClick: function(){ finish(false); } }, 'Nộp bài') : null,
        h('button', { type: 'button', className: 'dg2-b', onClick: function(){ if(review || window.confirm('Thoát? Bài làm được lưu nháp trên máy này, quay lại làm tiếp được (đồng hồ vẫn chạy).')) props.onExit(); } }, review ? '← Danh sách đề' : 'Thoát')),
      review ? h('div', { style: { maxWidth: '1180px', margin: '16px auto 0', padding: '0 16px' } }, h('div', { className: 'dg2-card' },
        h('div', { style: { display: 'flex', gap: '16px', alignItems: 'baseline', flexWrap: 'wrap' } },
          h('div', null, h('div', { style: { fontSize: '.8rem', fontWeight: 700, color: 'var(--ink-2)' } }, result.full ? 'ĐIỂM QUY ĐỔI THAM KHẢO' : 'ĐIỂM QUY ĐỔI CÁC PHẦN ĐÃ LÀM'),
            h('div', { style: { fontFamily: 'Literata,serif', fontSize: '2.4rem', fontWeight: 700, color: '#8a5a12' } }, result.full ? result.est1200 : result.scaled, h('span', { style: { fontSize: '1rem', color: 'var(--ink-2)' } }, ' / ' + (result.full ? 1200 : result.maxScaled)))),
          h('div', { style: { fontSize: '.92rem' } }, 'Đúng ', h('b', null, result.correct + '/' + result.total), ' câu · ' + result.minutesUsed + ' phút',
            !result.full && result.est1200 != null ? h('div', { style: { fontSize: '.84rem', color: 'var(--ink-2)' } }, 'Nếu các phần còn lại đạt tương đương → khoảng ', h('b', null, result.est1200 + '/1.200')) : null,
            h('div', { style: { fontSize: '.76rem', color: 'var(--ink-2)', marginTop: '4px' } }, 'Đề thật chấm theo độ khó từng câu (IRT) nên điểm thật có thể lệch — dùng để theo dõi tiến bộ.'),
            saved ? h('div', { style: { fontSize: '.8rem', color: '#15803d', fontWeight: 700 } }, '✓ Đã lưu kết quả — thầy xem được.') : null)),
        h('div', { className: 'dg2-score' }, Object.keys(result.sections).map(function(k){ var s = result.sections[k];
          return h('div', { key: k }, h('span', { style: { fontSize: '.78rem', fontWeight: 700 } }, s.name), h('b', null, s.correct + '/' + s.total), h('span', { style: { fontSize: '.76rem', color: 'var(--ink-2)' } }, Math.round(s.correct / s.total * 100) + '% đúng')); })))) : null,
      h('div', { className: 'dg2-wrap' },
        h('div', null,
          h('div', { className: 'dg2-sec' }, secs.map(function(s){ var done = s.idx.filter(function(i){ return ans[qs[i].index]; }).length;
            return h('button', { key: s.key, type: 'button', className: s.key === curSec ? 'on' : '', onClick: function(){ setCur(s.idx[0]); } }, s.name + ' (' + done + '/' + s.idx.length + ')'); })),
          h('div', { className: 'dg2-card' },
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' } },
              h('b', null, 'Câu ' + (cur + 1) + ' · ', h('span', { style: { fontWeight: 600, color: 'var(--ink-2)' } }, sectionOf(q).name)),
              !review ? h('button', { type: 'button', className: 'dg2-b', style: { padding: '4px 10px', fontSize: '.8rem' }, onClick: function(){ var f = Object.assign({}, flag); if(f[q.index]) delete f[q.index]; else f[q.index] = 1; setFlag(f); } }, flag[q.index] ? '🚩 Bỏ đánh dấu' : '🏳 Đánh dấu xem lại') : null),
            q.groupPassage ? h('div', { className: 'dg2-pass' }, T(q.groupPassage, 'div'), (q.groupImages || []).map(function(im, k){ return h('img', { key: k, className: 'dg2-img', src: im.url, alt: '' }); })) : null,
            h('div', { className: 'dg2-stem' }, T(q.stem, 'div')),
            (q.images || []).map(function(im, k){ return h('img', { key: k, className: 'dg2-img', src: im.url, alt: '' }); }),
            (q.options || []).map(function(o){ return h('button', { key: o.key, type: 'button', className: optCls(o), disabled: review, onClick: function(){ var a = Object.assign({}, ans); a[q.index] = o.key; setAns(a); } }, h('b', null, o.key), T(o.text, 'div')); }),
            review ? h('div', { className: 'dg2-sol' }, h('b', null, ans[q.index] ? (ans[q.index] === ck ? '✅ Em chọn đúng ' + ck + '. ' : '❌ Em chọn ' + ans[q.index] + ', đáp án đúng ' + ck + '. ') : '⚪ Em bỏ trống — đáp án ' + ck + '. '), q.loiGiai ? T(q.loiGiai, 'div') : h('span', { style: { color: 'var(--ink-2)' } }, 'Thầy chưa nạp lời giải.')) : null,
            h('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: '14px' } },
              h('button', { type: 'button', className: 'dg2-b', disabled: cur === 0, onClick: function(){ setCur(cur - 1); } }, '← Câu trước'),
              cur < qs.length - 1 ? h('button', { type: 'button', className: 'dg2-b p', onClick: function(){ setCur(cur + 1); } }, 'Câu sau →') : (!review ? h('button', { type: 'button', className: 'dg2-b p', onClick: function(){ finish(false); } }, 'Nộp bài') : null)))),
        h('div', null, h('div', { className: 'dg2-card', style: { position: 'sticky', top: '70px' } },
          secs.map(function(s){
            return h('div', { key: s.key }, h('div', { className: 'dg2-gh' }, s.name),
              h('div', { className: 'dg2-grid' }, s.idx.map(function(i){ var qq = qs[i], c = '';
                if(review) c = ans[qq.index] === correctKey(qq) ? 'ok' : (ans[qq.index] ? 'bad' : ''); else c = ans[qq.index] ? 'a' : '';
                if(flag[qq.index] && !review) c += ' f'; if(i === cur) c += ' c';
                return h('button', { key: i, type: 'button', className: c, onClick: function(){ setCur(i); } }, i + 1); })));
          }),
          h('div', { style: { fontSize: '.74rem', color: 'var(--ink-2)', marginTop: '10px', lineHeight: 1.5 } }, review ? '🟩 đúng · 🟥 sai · ⬜ bỏ trống' : '🟫 đã làm · 🟠 đánh dấu xem lại · khung đen: câu đang xem')))));
  }

    function List(props){
    var st = props.student;
    var ls = React.useState(null); var list = ls[0], setList = ls[1];
    var hs = React.useState([]); var hist = hs[0], setHist = hs[1];
    var es = React.useState(null); var exam = es[0], setExam = es[1];
    var bs = React.useState(''); var busy = bs[0], setBusy = bs[1];
    
    var ts = React.useState(150); var targetMinutes = ts[0], setTargetMinutes = ts[1];

    function load(){
      var L = live(); if(!L) return;
      L.loadSpecialExamList('dgnl').then(function(r){ setList(r.ok ? r.list : { locked: r.locked, error: r.error }); });
      if(L.loadSpecialAttempts) L.loadSpecialAttempts(st.id, 'dgnl').then(setHist);
    }
    React.useEffect(load, []);

    function start(ex){
      setBusy('Đang tải đề…');
      live().loadSpecialExam('dgnl', ex).then(function(qs){
        qs = qs.filter(function(q){ return (q.options || []).length >= 2; });
        if(!qs.length){ setBusy(''); alert('Đề chưa có câu trắc nghiệm.'); return; }
        
        if (targetMinutes < 150) {
           var ratio = targetMinutes / 150;
           var targetCount = Math.max(5, Math.round(qs.length * ratio));
           qs = qs.sort(function() { return 0.5 - Math.random() }).slice(0, targetCount);
        }

        setBusy(''); 
        ex.minutes = targetMinutes; 
        setExam({ meta: ex, questions: qs });
      }).catch(function(){ setBusy(''); alert('Không tải được đề — thử lại.'); });
    }

    var body;
    if(exam) body = h(Exam, { exam: exam.meta, questions: exam.questions, student: st, onExit: function(){ setExam(null); load(); } });
    else body = h('div', null,
      h('div', { className: 'dg2-top' }, h('div', { className: 't' }, '🎯 Luyện thi Đánh giá năng lực (Thích Ứng)'), h('button', { type: 'button', className: 'dg2-b', onClick: props.onClose }, '✕ Đóng')),
      h('div', { style: { maxWidth: '900px', margin: '0 auto', padding: '16px' } },
        h('div', { className: 'dg2-card', style: { marginBottom: '12px' } },
          h('b', null, '⏱ Chọn thời gian làm bài (Hệ thống tự động căn chỉnh số lượng câu hỏi):'),
          h('div', { style: { display: 'flex', gap: '10px', marginTop: '10px' } },
            [45, 75, 150].map(function(m) {
              return h('button', { 
                key: m, 
                onClick: function() { setTargetMinutes(m); },
                style: { padding: '8px 16px', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer', border: '1px solid #0d6efd', background: targetMinutes === m ? '#0d6efd' : '#fff', color: targetMinutes === m ? '#fff' : '#0d6efd' }
              }, m + ' phút' + (m === 150 ? ' (Chuẩn)' : ' (Rút gọn)'));
            })
          )
        ),
        h('div', { className: 'dg2-card' }, h('b', null, '📚 Danh sách Đề luyện'),
          !list ? h('p', { style: { color: 'var(--ink-2)' } }, 'Đang tải…') :
          (list.error || list.locked ? h('p', { style: { color: 'var(--ink-2)' } }, list.error || 'Em cần được thầy mở khoá chức năng này.') :
           list.map(function(ex){ return h('div', { key: ex.id, style: { padding: '8px 0', borderBottom: '1px solid #eee' } },
             h('b', null, ex.title), ' ',
             h('button', { type: 'button', className: 'dg2-b pri', style: { float: 'right' }, onClick: function(){ start(ex); } }, 'Vào thi')
           ); }))
        ),
        h('div', { className: 'dg2-card', style: { marginTop: '12px' } }, h('b', null, '🕒 Lịch sử bài làm'),
           hist.length === 0 ? h('p', { style: { color: 'var(--ink-2)' } }, 'Chưa có bài nào.') :
           hist.map(function(h_){ return h('div', { key: h_.id, style: { padding: '8px 0', borderBottom: '1px dashed #ccc' } },
             h('b', null, h_.examTitle), h('br'),
             h('small', { style: { color: '#666'} }, new Date(h_.time).toLocaleString('vi-VN'), ' — ', h('b', { style: { color: 'var(--accent-strong)' } }, h_.scaled, '/1.200'), ' (đúng ', h_.correct, '/', h_.total, ')')
           ); })
        )
      )
    );
    return h('div', { className: 'dg2-fs' }, body);
  }
  var host;
  function openList(student){
    if(!student || !student.id) return;
    ensureCss();
    if(!host){ host = document.createElement('div'); host.id = 'dgnl-host'; document.body.appendChild(host); }
    function close(){ try{ ReactDOM.unmountComponentAtNode(host); }catch(e){} }
    ReactDOM.render(h(List, { student: student, onClose: close }), host);
  }
  window.OPC_DGNL = { openList: openList, _score: score, _sectionOf: sectionOf };
})(window);
