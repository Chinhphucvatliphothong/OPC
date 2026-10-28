/**
 * dgnl.js — THÊM 26/10/2026 · LUYỆN THI ĐÁNH GIÁ NĂNG LỰC ĐHQG-HCM (V-ACT) cho học sinh (index.html)
 * Cấu trúc đề thật (tham khảo 2026): 120 câu 4 lựa chọn, 150 phút — Tiếng Việt 30 · Tiếng Anh 30 · Toán học 30 ·
 * Tư duy khoa học 30 (Logic & phân tích số liệu 12 + Suy luận khoa học 18); thang 1.200 (mỗi phần lớn 300).
 * FaradayAI tập trung Toán học + Tư duy khoa học. Đề nạp ở admin › 🏆 HSG · Olympic · ĐGNL (collection de_thi_dgnl),
 * phần thi lấy từ ô thứ 2 của tag %[M?][Phần thi][Dạng bài]. Em được thầy mở khoá 'dgnl' mới thấy đề.
 * Làm trên máy như thi thật: chia phần, đồng hồ (1,25 phút/câu), đánh dấu câu, tự lưu nháp; nộp → chấm tự động,
 * điểm từng phần, điểm QUY ĐỔI THAM KHẢO thang 1.200 (đề thật chấm theo IRT — đây chỉ là ước tính), xem lời giải.
 * SỬA 27/10/2026 — (1) LỖI KHÔNG VÀO ĐƯỢC: khung danh sách bọc class 'dg2-fs' không có CSS nên bị đẩy xuống cuối trang → đổi sang 'dg2-ov' (toàn màn hình).
 *   (2) MINI TEST THÍCH ỨNG: gom câu từ mọi đề ĐGNL, chọn phần thi + số câu (5/10/20/30), ưu tiên câu chưa làm/từng sai, giữ nguyên cụm câu chung dữ kiện; lưu track 'dgnl-mini' (không lẫn điểm 1.200).
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
    // SỬA 27/10/2026 — bỏ comment LaTeX (dòng tag %[M3][..][..], % @nano…) còn sót trong dữ liệu cũ; giữ \% (phần trăm thật)
    t = String(t || '').replace(/%\s*\[M[1-4]\]\s*\[[^\]\n]*\]\s*\[[^\]\n]*\]/gi, '').replace(/(^|\n)[ \t]*%[^\n]*/g, '$1').replace(/%\s*(?:@nano[\w-]*\s*:|AI_TU_GIAI|AI_CAN_KIEM_TRA|CHUA_CO_DAP_AN)[^\n]*/gi, '');
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

  // THÊM 27/10/2026 — các nano (đơn vị kiến thức nhỏ) em làm sai trong bài này, nhiều lỗi nhất trước
  function weakNanoList(qs, ans){
    var m = {};
    qs.forEach(function(q){ if(!q.nano) return; var x = m[q.nano] = m[q.nano] || { name: q.nano, wrong: 0, total: 0 }; x.total++; if(ans[q.index] !== correctKey(q)) x.wrong++; });
    return Object.keys(m).map(function(k){ return m[k]; }).filter(function(x){ return x.wrong > 0; }).sort(function(a, b){ return b.wrong - a.wrong; }).slice(0, 8);
  }
  function nanoSummary(qs, ans){
    var m = {};
    qs.forEach(function(q){ if(!q.nano) return; var k = q.nano.slice(0, 60).replace(/[.\/#$\[\]]/g, ' '); var x = m[k] = m[k] || { correct: 0, total: 0 }; x.total++; if(ans[q.index] === correctKey(q)) x.correct++; });
    return m;
  }
  function Exam(props){
    var qs = props.questions, ex = props.exam, st = props.student;
    var isMini = !!ex.mini; // SỬA 27/10/2026 — mini test: không lưu nháp, không quy đổi 1.200
    var storeKey = 'dgnl-draft-' + st.id + '-' + ex.id;
    var draft0 = isMini ? null : (function(){ try{ return JSON.parse(localStorage.getItem(storeKey) || 'null'); }catch(e){ return null; } })();
    var isRO = !!props.reviewAns; // THÊM 27/10/2026 — chế độ chỉ xem lại các câu đã sai (từ lịch sử bài làm), không nộp/không lưu
    var as = React.useState(isRO ? props.reviewAns : ((draft0 && draft0.ans) || {})); var ans = as[0], setAns = as[1];
    var fs = React.useState((draft0 && draft0.flag) || {}); var flag = fs[0], setFlag = fs[1];
    var is = React.useState(0); var cur = is[0], setCur = is[1];
    var ss = React.useState((draft0 && draft0.startedAt) || Date.now()); var startedAt = ss[0];
    var ns = React.useState(Date.now()); var now = ns[0], setNow = ns[1];
    var rs = React.useState(isRO ? Object.assign(score(qs, props.reviewAns), { minutesUsed: 0 }) : null); var result = rs[0], setResult = rs[1];
    var vs = React.useState(isRO); var saved = vs[0], setSaved = vs[1];
    var minutes = ex.minutes || Math.ceil(qs.length * 1.25);
    var left = minutes * 60 - (now - startedAt) / 1000;
    var secs = []; qs.forEach(function(q, i){ var s = sectionOf(q); var g = secs.filter(function(x){ return x.key === s.key; })[0]; if(!g){ g = { key: s.key, name: s.name, idx: [] }; secs.push(g); } g.idx.push(i); });
    React.useEffect(function(){ if(result) return; var t = setInterval(function(){ setNow(Date.now()); }, 1000); return function(){ clearInterval(t); }; }, [result]);
    React.useEffect(function(){ if(!result && !isMini){ try{ localStorage.setItem(storeKey, JSON.stringify({ ans: ans, flag: flag, startedAt: startedAt })); }catch(e){} } }, [ans, flag]);
    React.useEffect(function(){ if(!result && left <= 0) finish(true); }, [now]);
    React.useEffect(function(){ try{ document.querySelector('.dg2-ov').scrollTo(0, 0); }catch(e){} }, [cur, !!result]);
    function finish(auto){
      if(result) return;
      if(!auto){ var miss = qs.length - Object.keys(ans).length; if(!window.confirm(miss ? 'Còn ' + miss + ' câu chưa làm. Vẫn nộp bài?' : 'Nộp bài và xem kết quả?')) return; }
      var r = score(qs, ans); r.minutesUsed = Math.round(Math.min(minutes * 60, (Date.now() - startedAt) / 1000) / 60);
      setResult(r); if(!isMini){ try{ localStorage.removeItem(storeKey); }catch(e){} }
      var L = live();
      if(L && L.saveSpecialAttempt){
        var sec = {}; Object.keys(r.sections).forEach(function(k){ sec[k] = { name: r.sections[k].name, correct: r.sections[k].correct, total: r.sections[k].total }; });
        if(isMini){
          L.saveSpecialAttempt(st.id, { track: 'dgnl-mini', mini: true, examId: 'mini', examTitle: ex.title, correct: r.correct, total: r.total, pct: Math.round(r.correct / Math.max(1, r.total) * 100),
            sections: sec, nanos: nanoSummary(qs, ans), minutesUsed: r.minutesUsed, answers: ans, qids: qs.map(function(x){ return x.index; }), auto: !!auto }).then(function(res){ setSaved(!!(res && res.ok)); });
          return;
        }
        L.saveSpecialAttempt(st.id, { track: 'dgnl', examId: ex.id, examTitle: ex.title, autoScore: r.est1200, scaled: r.scaled, maxScaled: r.maxScaled, correct: r.correct, total: r.total,
          sections: sec, nanos: nanoSummary(qs, ans), minutesUsed: r.minutesUsed, maxScore: 1200, selfScore: r.est1200 != null ? Math.round(r.est1200 / 60 * 100) / 100 : null, answers: ans, auto: !!auto })
          .then(function(res){ setSaved(!!(res && res.ok)); });
      }
    }
    var q = qs[cur], review = !!result, ck = correctKey(q);
    function optCls(o){ var c = 'dg2-opt'; if(review){ if(o.key === ck) c += ' ok'; else if(ans[q.index] === o.key) c += ' bad'; } else if(ans[q.index] === o.key) c += ' sel'; return c; }
    var curSec = sectionOf(q).key;
    return h('div', null,
      h('div', { className: 'dg2-top' },
        h('div', { className: 't' }, '🎯 ' + ex.title, h('div', { style: { fontSize: '.78rem', fontWeight: 500, color: 'var(--ink-2,#666)' } }, review ? (isRO ? 'Ôn lại câu đã sai' : 'Kết quả & lời giải') : (qs.length + ' câu · ' + minutes + ' phút · đã làm ' + Object.keys(ans).length + '/' + qs.length))),
        !review ? h('span', { className: 'dg2-timer' + (left < 300 ? ' low' : '') }, '⏱ ' + fmtT(left)) : null,
        !review ? h('button', { type: 'button', className: 'dg2-b p', onClick: function(){ finish(false); } }, 'Nộp bài') : null,
        h('button', { type: 'button', className: 'dg2-b', onClick: function(){ if(review || window.confirm(isMini ? 'Thoát? Mini test chưa nộp sẽ không được lưu.' : 'Thoát? Bài làm được lưu nháp trên máy này, quay lại làm tiếp được (đồng hồ vẫn chạy).')) props.onExit(); } }, review ? '← Danh sách đề' : 'Thoát')),
      isRO ? h('div', { style: { maxWidth: '1180px', margin: '16px auto 0', padding: '0 16px' } }, h('div', { className: 'dg2-card' },
        h('b', { style: { fontSize: '1.05rem' } }, '🔍 Ôn lại ' + qs.length + ' câu em đã làm sai'),
        h('div', { style: { fontSize: '.84rem', color: 'var(--ink-2)', margin: '4px 0' } }, 'Đọc lời giải từng câu rồi tự làm lại trên giấy. Ô màu xanh là đáp án đúng, màu đỏ là đáp án em đã chọn.'),
        (function(){ var wn = weakNanoList(qs, ans); return wn.length ? h('div', { style: { marginTop: '8px', fontSize: '.88rem' } }, h('b', null, '🔬 Kiến thức cần ôn: '), wn.map(function(x, i){ return h('span', { key: i, style: { display: 'inline-block', margin: '3px 6px 0 0', padding: '3px 10px', borderRadius: '999px', background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.35)' } }, x.name + ' (' + x.wrong + ' câu)'); })) : null; })())) : null,
      review && !isRO ? h('div', { style: { maxWidth: '1180px', margin: '16px auto 0', padding: '0 16px' } }, h('div', { className: 'dg2-card' },
        h('div', { style: { display: 'flex', gap: '16px', alignItems: 'baseline', flexWrap: 'wrap' } },
          isMini
            ? h('div', null, h('div', { style: { fontSize: '.8rem', fontWeight: 700, color: 'var(--ink-2)' } }, 'KẾT QUẢ MINI TEST'),
              h('div', { style: { fontFamily: 'Literata,serif', fontSize: '2.4rem', fontWeight: 700, color: '#8a5a12' } }, result.correct, h('span', { style: { fontSize: '1rem', color: 'var(--ink-2)' } }, ' / ' + result.total + ' câu · ' + Math.round(result.correct / Math.max(1, result.total) * 100) + '%')))
            : h('div', null, h('div', { style: { fontSize: '.8rem', fontWeight: 700, color: 'var(--ink-2)' } }, result.full ? 'ĐIỂM QUY ĐỔI THAM KHẢO' : 'ĐIỂM QUY ĐỔI CÁC PHẦN ĐÃ LÀM'),
            h('div', { style: { fontFamily: 'Literata,serif', fontSize: '2.4rem', fontWeight: 700, color: '#8a5a12' } }, result.full ? result.est1200 : result.scaled, h('span', { style: { fontSize: '1rem', color: 'var(--ink-2)' } }, ' / ' + (result.full ? 1200 : result.maxScaled)))),
          h('div', { style: { fontSize: '.92rem' } }, 'Đúng ', h('b', null, result.correct + '/' + result.total), ' câu · ' + result.minutesUsed + ' phút',
            !isMini && !result.full && result.est1200 != null ? h('div', { style: { fontSize: '.84rem', color: 'var(--ink-2)' } }, 'Nếu các phần còn lại đạt tương đương → khoảng ', h('b', null, result.est1200 + '/1.200')) : null,
            isMini ? null : h('div', { style: { fontSize: '.76rem', color: 'var(--ink-2)', marginTop: '4px' } }, 'Đề thật chấm theo độ khó từng câu (IRT) nên điểm thật có thể lệch — dùng để theo dõi tiến bộ.'),
            saved ? h('div', { style: { fontSize: '.8rem', color: '#15803d', fontWeight: 700 } }, '✓ Đã lưu kết quả.') : null)),
        h('div', { className: 'dg2-score' }, Object.keys(result.sections).map(function(k){ var s = result.sections[k];
          return h('div', { key: k }, h('span', { style: { fontSize: '.78rem', fontWeight: 700 } }, s.name), h('b', null, s.correct + '/' + s.total), h('span', { style: { fontSize: '.76rem', color: 'var(--ink-2)' } }, Math.round(s.correct / s.total * 100) + '% đúng')); })),
        (function(){ var wn = weakNanoList(qs, ans); return wn.length ? h('div', { style: { marginTop: '12px', fontSize: '.88rem' } }, h('b', null, '🔬 Kiến thức cần ôn lại: '), wn.map(function(x, i){ return h('span', { key: i, style: { display: 'inline-block', margin: '3px 6px 0 0', padding: '3px 10px', borderRadius: '999px', background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.35)' } }, x.name + ' (sai ' + x.wrong + '/' + x.total + ')'); })) : null; })())) : null,
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
            review ? h('div', { className: 'dg2-sol' }, q.nano ? h('div', { style: { fontSize: '.76rem', fontWeight: 700, color: '#8a5a12', marginBottom: '6px' } }, '🔬 Kiến thức: ' + q.nano) : null, h('b', null, ans[q.index] ? (ans[q.index] === ck ? '✅ Em chọn đúng ' + ck + '. ' : '❌ Em chọn ' + ans[q.index] + ', đáp án đúng ' + ck + '. ') : '⚪ Em bỏ trống — đáp án ' + ck + '. '), q.loiGiai ? T(q.loiGiai, 'div') : h('span', { style: { color: 'var(--ink-2)' } }, 'Thầy chưa nạp lời giải.')) : null,
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

  // ===== THÊM 27/10/2026 — MINI TEST THÍCH ỨNG: gom câu từ mọi đề ĐGNL, chọn theo phần thi + lịch sử làm bài =====
  function nanoKey(n){ return norm(n).replace(/[^a-z0-9]+/g, ' ').trim(); }
  var SEC_ORDER = ['toan', 'logic', 'kh', 'tv', 'ta', 'khac'];
  function rawSec(q){ return sectionOf({ section: q.chuDeLon || '', topic: q.dangBai || '' }); }
  function rawCorrect(q){ var o = (q.options || []).filter(function(x){ return x.isTrue; })[0]; return o ? o.key : null; }
  function refersPrev(stem){ try{ var E = window.PrepScholarEngine; return !!(E && E.refersPrevQuestion && E.refersPrevQuestion(stem)); }catch(e){ return false; } }
  // Dựng kho câu + gom thành "cụm" (câu chung dữ kiện / câu dựa vào câu trên phải đi cùng nhau)
  function buildPool(list){
    var units = [], byUid = {};
    (list || []).forEach(function(ex){
      var qs = (ex.questions || []).filter(function(q){ return q && q.type !== 'essay' && (q.options || []).length >= 2 && rawCorrect(q); });
      qs.sort(function(a, b){ return Number(a.index) - Number(b.index); });
      var cur = null, prev = null;
      qs.forEach(function(q){
        var uid = ex.id + '_q' + q.index, sec = rawSec(q);
        var dep = prev && (q.ctxFrom != null || (q.groupPassage && q.groupPassage === prev.groupPassage) || refersPrev(q.stem));
        var item = { uid: uid, exId: ex.id, index: q.index, sec: sec.key, ck: rawCorrect(q), nano: q.nanoName ? nanoKey(q.nanoName) : '', nanoName: q.nanoName || '' };
        byUid[uid] = item;
        if(dep && cur){ cur.items.push(item); }
        else { cur = { exId: ex.id, sec: sec.key, items: [item] }; units.push(cur); }
        prev = q;
      });
    });
    return { units: units, byUid: byUid };
  }
  // Lịch sử: uid → 1 (lần gần nhất đúng) / 0 (sai); suy ra cả từ bài đầy đủ cũ (answers theo số câu)
  function buildHistory(attempts, byUid){
    var st = {};
    (attempts || []).forEach(function(a){ // attempts đã sắp mới nhất trước → chỉ ghi nếu chưa có
      if(a.track !== 'dgnl' && a.track !== 'dgnl-mini') return;
      Object.keys(a.answers || {}).forEach(function(k){
        var uid = String(k).indexOf('_q') > -1 ? String(k) : String(a.examId) + '_q' + k;
        var it = byUid[uid]; if(!it || st[uid] != null) return;
        st[uid] = a.answers[k] === it.ck ? 1 : 0;
      });
    });
    return st;
  }
  // THÊM 27/10/2026 — độ thành thạo từng nano (theo lần làm gần nhất của mỗi câu): { nanoKey: { seen, ok } }
  function buildNanoStats(history, byUid){
    var ns = {};
    Object.keys(history).forEach(function(uid){ var it = byUid[uid]; if(!it || !it.nano) return; var x = ns[it.nano] = ns[it.nano] || { seen: 0, ok: 0 }; x.seen++; x.ok += history[uid]; });
    return ns;
  }
  function pickMini(pool, hist, secKeys, n, adaptive, nanoStats){
    nanoStats = nanoStats || {};
    var cand = pool.units.filter(function(u){ return secKeys.indexOf(u.sec) > -1; });
    if(!cand.length) return [];
    // trọng số từng phần: phần em yếu hơn → được nhiều câu hơn
    var acc = {}, w = {}, sumW = 0;
    secKeys.forEach(function(k){
      var seen = 0, ok = 0;
      cand.forEach(function(u){ if(u.sec !== k) return; u.items.forEach(function(it){ if(hist[it.uid] != null){ seen++; ok += hist[it.uid]; } }); });
      acc[k] = seen >= 3 ? ok / seen : null;
      w[k] = !adaptive ? 1 : (acc[k] == null ? 1.2 : 1.8 - acc[k]);
      if(!cand.some(function(u){ return u.sec === k; })) w[k] = 0;
      sumW += w[k];
    });
    var quota = {}, assigned = 0;
    secKeys.forEach(function(k){ quota[k] = Math.floor(n * w[k] / (sumW || 1)); assigned += quota[k]; });
    secKeys.slice().sort(function(a, b){ return w[b] - w[a]; }).forEach(function(k){ if(assigned < n && w[k] > 0){ quota[k]++; assigned++; } });
    function unitScore(u){
      var sc = 0; u.items.forEach(function(it){ var v = hist[it.uid]; var base = !adaptive ? 1 : (v == null ? 2 : (v === 0 ? 3 : 0.5));
        if(adaptive && it.nano){ var ns = nanoStats[it.nano]; if(!ns) base += 0.5; else if(ns.seen >= 2 && ns.ok / ns.seen < 0.6) base += 1.5; } // nano em còn yếu → ưu tiên
        sc += base; });
      return sc / u.items.length * (0.7 + Math.random() * 0.6);
    }
    var chosen = [], used = {}, total = 0;
    function take(u){ used[u.items[0].uid] = 1; chosen.push(u); total += u.items.length; }
    secKeys.forEach(function(k){
      var got = 0, us = cand.filter(function(u){ return u.sec === k; }).map(function(u){ return { u: u, s: unitScore(u) }; }).sort(function(a, b){ return b.s - a.s; });
      us.forEach(function(x){ if(got >= quota[k] || used[x.u.items[0].uid]) return; if(got + x.u.items.length > quota[k] + 2 && got > 0) return; take(x.u); got += x.u.items.length; });
    });
    if(total < n){ // thiếu → bù từ các cụm còn lại của các phần đã chọn
      cand.map(function(u){ return { u: u, s: unitScore(u) }; }).sort(function(a, b){ return b.s - a.s; }).forEach(function(x){ if(total >= n || used[x.u.items[0].uid]) return; if(total + x.u.items.length > n + 2) return; take(x.u); });
    }
    chosen.sort(function(a, b){ var d = SEC_ORDER.indexOf(a.sec) - SEC_ORDER.indexOf(b.sec); return d; });
    return chosen;
  }
  var SEC_NAMES = { toan: 'Toán học', logic: 'Logic & phân tích số liệu', kh: 'Suy luận khoa học', tv: 'Tiếng Việt', ta: 'Tiếng Anh', khac: 'Khác' };

  function List(props){
    var st = props.student;
    var ls = React.useState(null); var list = ls[0], setList = ls[1];
    var hs = React.useState([]); var hist = hs[0], setHist = hs[1];
    var es = React.useState(null); var exam = es[0], setExam = es[1];
    var bs = React.useState(''); var busy = bs[0], setBusy = bs[1];
    var ms = React.useState('mini'); var mode = ms[0], setMode = ms[1];
    var ns = React.useState(10); var nQ = ns[0], setNQ = ns[1];
    var ps = React.useState(null); var picked = ps[0], setPicked = ps[1]; // null = mặc định tất cả phần có sẵn
    var as = React.useState(true); var adaptive = as[0], setAdaptive = as[1];

    function load(){
      var L = live(); if(!L) return;
      L.loadSpecialExamList('dgnl').then(function(r){ setList(r.ok ? r.list : { locked: r.locked, error: r.error }); });
      if(L.loadSpecialAttempts) L.loadSpecialAttempts(st.id).then(function(a){ setHist(a || []); });
    }
    React.useEffect(load, []);

    var okList = list && Array.isArray(list) ? list : null;
    var pool = React.useMemo(function(){ return okList ? buildPool(okList) : { units: [], byUid: {} }; }, [list]);
    var avail = {}; pool.units.forEach(function(u){ avail[u.sec] = (avail[u.sec] || 0) + u.items.length; });
    var secKeys = SEC_ORDER.filter(function(k){ return avail[k]; });
    var defaultSel = secKeys.filter(function(k){ return k === 'toan' || k === 'logic' || k === 'kh'; });
    if(!defaultSel.length) defaultSel = secKeys;
    var sel = (picked || defaultSel).filter(function(k){ return avail[k]; });
    var history = React.useMemo(function(){ return buildHistory(hist, pool.byUid); }, [hist, list]);
    var nanoStats = React.useMemo(function(){ return buildNanoStats(history, pool.byUid); }, [history, pool]);
    var weakNanos = Object.keys(nanoStats).filter(function(k){ return nanoStats[k].seen >= 2 && nanoStats[k].ok / nanoStats[k].seen < 0.6; }).length;
    var seenCount = Object.keys(history).length, wrongCount = Object.keys(history).filter(function(k){ return history[k] === 0; }).length;

    function toggleSec(k){ var cur = sel.slice(); var i = cur.indexOf(k); if(i > -1) cur.splice(i, 1); else cur.push(k); setPicked(cur); }

    function startFull(ex){
      setBusy('Đang tải đề…');
      live().loadSpecialExam('dgnl', ex).then(function(qs){
        qs = qs.filter(function(q){ return (q.options || []).length >= 2; });
        setBusy('');
        if(!qs.length){ alert('Đề chưa có câu trắc nghiệm.'); return; }
        setExam({ meta: Object.assign({}, ex, { minutes: ex.minutes || 150 }), questions: qs });
      }).catch(function(){ setBusy(''); alert('Không tải được đề — thử lại.'); });
    }

    // THÊM 27/10/2026 — xem lại các câu đã sai của một bài trong lịch sử (làm lại đọc lời giải)
    function attemptWrong(a, includeBlank){
      var res = [], seen = {};
      Object.keys(a.answers || {}).forEach(function(k){
        var uid = String(k).indexOf('_q') > -1 ? String(k) : String(a.examId) + '_q' + k, it = pool.byUid[uid];
        if(it && a.answers[k] !== it.ck && !seen[uid]){ seen[uid] = 1; res.push(uid); }
      });
      if(includeBlank && a.qids){ a.qids.forEach(function(k){ var uid = String(k).indexOf('_q') > -1 ? String(k) : String(a.examId) + '_q' + k; if(pool.byUid[uid] && !(a.answers || {})[k] && !seen[uid]){ seen[uid] = 1; res.push(uid); } }); }
      return res;
    }
    function reviewWrong(a){
      var uids = attemptWrong(a, true);
      if(!uids.length){ alert('Bài này không có câu sai để xem lại.'); return; }
      var need = {}; uids.forEach(function(u){ need[pool.byUid[u].exId] = 1; });
      setBusy('Đang tải các câu sai…');
      Promise.all(Object.keys(need).map(function(id){
        var ex = okList.filter(function(e){ return e.id === id; })[0];
        return live().loadSpecialExam('dgnl', ex).then(function(qs){ return { id: id, qs: qs }; });
      })).then(function(res){
        var map = {}; res.forEach(function(r){ r.qs.forEach(function(q){ map[r.id + '_q' + q.index] = q; }); });
        var out = [], ra = {};
        uids.forEach(function(u){ var q = map[u]; if(!q) return; out.push(Object.assign({}, q, { uid: u, index: u })); var k = Object.keys(a.answers || {}).filter(function(k){ return (String(k).indexOf('_q') > -1 ? String(k) : String(a.examId) + '_q' + k) === u; })[0]; if(k != null) ra[u] = a.answers[k]; });
        setBusy('');
        if(!out.length){ alert('Không tải được câu hỏi — thử lại.'); return; }
        setExam({ meta: { id: 'review-' + a.id, ro: true, title: 'Ôn lại câu sai · ' + (a.examTitle || 'bài làm'), minutes: 1 }, questions: out, reviewAns: ra });
      }).catch(function(){ setBusy(''); alert('Không tải được câu hỏi — thử lại.'); });
    }

    function startMini(){
      if(!sel.length){ alert('Chọn ít nhất 1 phần thi.'); return; }
      var units = pickMini(pool, history, sel, nQ, adaptive, nanoStats);
      if(!units.length){ alert('Chưa có câu phù hợp trong các phần đã chọn.'); return; }
      var need = {}; units.forEach(function(u){ need[u.exId] = 1; });
      setBusy('Đang chuẩn bị mini test…');
      Promise.all(Object.keys(need).map(function(id){
        var ex = okList.filter(function(e){ return e.id === id; })[0];
        return live().loadSpecialExam('dgnl', ex).then(function(qs){ return { id: id, qs: qs }; });
      })).then(function(res){
        var map = {}; res.forEach(function(r){ r.qs.forEach(function(q){ map[r.id + '_q' + q.index] = q; }); });
        var out = [];
        units.forEach(function(u){ u.items.forEach(function(it){ var q = map[it.uid]; if(q) out.push(Object.assign({}, q, { uid: it.uid, index: it.uid })); }); });
        setBusy('');
        if(!out.length){ alert('Không tải được câu hỏi — thử lại.'); return; }
        var mins = Math.max(5, Math.ceil(out.length * 1.25));
        setExam({ meta: { id: 'mini', mini: true, title: 'Mini test ĐGNL · ' + out.length + ' câu', minutes: mins }, questions: out });
      }).catch(function(){ setBusy(''); alert('Không tải được câu hỏi — thử lại.'); });
    }

    var body;
    if(exam) body = h(Exam, { exam: exam.meta, questions: exam.questions, reviewAns: exam.reviewAns, student: st, onExit: function(){ setExam(null); load(); } });
    else {
      var locked = list && !Array.isArray(list);
      var tabBtn = function(k, label){ return h('button', { type: 'button', className: 'dg2-b' + (mode === k ? ' p' : ''), onClick: function(){ setMode(k); } }, label); };
      body = h('div', null,
        h('div', { className: 'dg2-top' }, h('div', { className: 't' }, '🎯 Luyện thi Đánh giá năng lực ĐHQG-HCM'), h('button', { type: 'button', className: 'dg2-b', onClick: props.onClose }, '✕ Đóng')),
        h('div', { style: { maxWidth: '900px', margin: '0 auto', padding: '16px' } },
          busy ? h('div', { className: 'dg2-card', style: { marginBottom: '12px', fontWeight: 700 } }, '⏳ ' + busy) : null,
          !list ? h('div', { className: 'dg2-card' }, 'Đang tải…') :
          locked ? h('div', { className: 'dg2-card' }, list.locked ? 'Em cần được thầy mở khoá chức năng này.' : ('Không tải được đề (' + (list.error || 'lỗi') + ') — thử lại sau.')) :
          h('div', null,
            h('div', { style: { display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' } }, tabBtn('mini', '⚡ Mini test thích ứng'), tabBtn('full', '📝 Làm cả đề (150 phút)')),
            mode === 'mini' ? h('div', { className: 'dg2-card' },
              h('b', null, 'Chọn phần thi'),
              h('div', { className: 'dg2-sec', style: { marginTop: '8px' } }, secKeys.map(function(k){ return h('button', { key: k, type: 'button', className: sel.indexOf(k) > -1 ? 'on' : '', onClick: function(){ toggleSec(k); } }, SEC_NAMES[k] + ' (' + avail[k] + ')'); })),
              h('b', null, 'Số câu'),
              h('div', { style: { display: 'flex', gap: '8px', margin: '8px 0 12px', flexWrap: 'wrap' } }, [5, 10, 20, 30].map(function(n){ return h('button', { key: n, type: 'button', className: 'dg2-b' + (nQ === n ? ' p' : ''), onClick: function(){ setNQ(n); } }, n + ' câu · ~' + Math.max(5, Math.ceil(n * 1.25)) + ' phút'); })),
              h('label', { style: { display: 'flex', gap: '8px', alignItems: 'center', fontSize: '.9rem', cursor: 'pointer' } },
                h('input', { type: 'checkbox', checked: adaptive, onChange: function(e){ setAdaptive(e.target.checked); } }),
                'Thích ứng: ưu tiên câu em chưa làm, câu từng sai, và phần em còn yếu'),
              h('div', { style: { fontSize: '.78rem', color: 'var(--ink-2)', margin: '8px 0 12px' } }, 'Câu được gom từ tất cả đề ĐGNL; các câu chung dữ kiện luôn đi cùng nhau (nên số câu có thể lệch 1–2 câu). Em đã làm ' + seenCount + ' câu' + (wrongCount ? ', trong đó ' + wrongCount + ' câu sai gần nhất' : '') + (weakNanos ? '; còn ' + weakNanos + ' đơn vị kiến thức (nano) cần ôn thêm.' : '.')),
              h('button', { type: 'button', className: 'dg2-b p', disabled: !!busy || !sel.length, onClick: startMini }, 'Bắt đầu mini test ➔')
            ) : h('div', { className: 'dg2-card' }, h('b', null, '📚 Danh sách đề đầy đủ'),
              !list.length ? h('p', { style: { color: 'var(--ink-2)' } }, 'Thầy chưa nạp đề nào.') :
              list.map(function(ex){ return h('div', { key: ex.id, className: 'dg2-ex' },
                h('div', null, h('b', null, ex.title), h('div', { style: { fontSize: '.78rem', color: 'var(--ink-2)' } }, ex.total + ' câu')),
                h('button', { type: 'button', className: 'dg2-b p', disabled: !!busy, onClick: function(){ startFull(ex); } }, 'Vào thi')); })
            ),
            h('div', { className: 'dg2-card', style: { marginTop: '12px' } }, h('b', null, '🕒 Lịch sử bài làm'),
              (function(){ var hh = hist.filter(function(a){ return a.track === 'dgnl' || a.track === 'dgnl-mini'; }).slice(0, 15);
                return hh.length === 0 ? h('p', { style: { color: 'var(--ink-2)' } }, 'Chưa có bài nào.') :
                hh.map(function(a){ return h('div', { key: a.id, style: { padding: '8px 0', borderBottom: '1px dashed var(--line,#ccc)' } },
                  h('b', null, a.track === 'dgnl-mini' ? '⚡ ' + (a.examTitle || 'Mini test') : (a.examTitle || 'Đề đầy đủ')), h('br'),
                  h('small', { style: { color: 'var(--ink-2)' } }, new Date(a.createdAt || a.time || Date.now()).toLocaleString('vi-VN'), ' — ',
                    a.track === 'dgnl-mini' ? h('b', null, a.correct + '/' + a.total + ' câu (' + (a.pct != null ? a.pct : Math.round(a.correct / Math.max(1, a.total) * 100)) + '%)') : h('b', null, (a.autoScore != null ? a.autoScore : '—') + '/1.200', ' (đúng ' + a.correct + '/' + a.total + ')')),
                  (function(){ var nw = attemptWrong(a, true).length; return nw ? h('div', { style: { marginTop: '6px' } }, h('button', { type: 'button', className: 'dg2-b', style: { padding: '4px 12px', fontSize: '.8rem' }, disabled: !!busy, onClick: function(){ reviewWrong(a); } }, '🔍 Xem lại ' + nw + ' câu sai')) : null; })()); }); })()
            )
          )
        )
      );
    }
    return h('div', { className: 'dg2-ov' }, body); // SỬA 27/10/2026 — trước đây 'dg2-fs' (không có CSS) → danh sách nằm cuối trang, em không thấy
  }
  var host;
  function openList(student){
    if(!student || !student.id) return;
    ensureCss();
    if(!host){ host = document.createElement('div'); host.id = 'dgnl-host'; document.body.appendChild(host); }
    function close(){ try{ ReactDOM.unmountComponentAtNode(host); }catch(e){} }
    ReactDOM.render(h(List, { student: student, onClose: close }), host);
  }
  window.OPC_DGNL = { openList: openList, _score: score, _sectionOf: sectionOf, _buildPool: buildPool, _buildHistory: buildHistory, _pickMini: pickMini, _buildNanoStats: buildNanoStats };
})(window);
