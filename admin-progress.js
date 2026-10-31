/**
 * admin-progress.js — THÊM 29/10/2026 · 📈 TIẾN BỘ HỌC SINH (tab trong admin)
 *  • Dựa trên LỊCH SỬ LÀM BÀI đã lưu (students/{id}/attempts) của MỌI dạng bài: thi thử/đề giao, luyện thích ứng, luyện trọng tâm,
 *    kiểm tra đầu vào, sửa câu sai, bài giấy.
 *  • Tự LOẠI các lượt nghi làm ẩu (bấm nhầm vài câu rồi bỏ, làm dở, bấm thử tính năng…) bằng ĐÚNG bộ lọc của admin-cleanup.js
 *    (OPC_CLEAN.suspicious) — có công tắc "tính cả bài nghi làm ẩu" để đối chiếu.
 *  • Xoá bài làm ẩu ngay tại đây: dùng lại OPC_CLEAN.removeAttempts (chuyển vào thùng rác, khôi phục được, tính lại điểm/lỗ hổng).
 *  • Cả lớp: bảng so sánh đầu kỳ → cuối kỳ + xu hướng; từng em: biểu đồ tỉ lệ đúng theo thời gian, theo tuần, mức thành thạo từng
 *    chủ đề (đầu kỳ → nay), lỗ hổng đã vá / còn yếu.
 * Xuất: window.OPC_PROGRESS = { ProgressPanel, analyze }
 */
(function(window){
  'use strict';
  var React = window.React; if(!React) return;
  var h = React.createElement;
  function OPC(){ return window.OPC; }
  var DAY = 86400000;
  var TYPE_LABEL = { assigned: 'Đề được giao', exam: 'Thi thử', adaptive: 'Luyện thích ứng', drill: 'Luyện trọng tâm', diagnostic: 'Kiểm tra đầu vào', mistakes: 'Sửa câu sai', paper: 'Bài làm giấy', practice: 'Luyện tập' };
  var TYPE_COLOR = { assigned: '#f59e0b', exam: '#c9a25f', adaptive: '#60a5fa', drill: '#34d399', diagnostic: '#a78bfa', mistakes: '#fb7185', paper: '#94a3b8', practice: '#38bdf8' };
  var WINDOWS = [[30, '30 ngày'], [60, '60 ngày'], [90, '90 ngày'], [180, '6 tháng'], [365, '1 năm'], [0, 'Tất cả']];

  // ------------------------------------------------------------------ tiện ích
  function p2(n){ return (n < 10 ? '0' : '') + n; }
  function tms(a){
    var t = a && (a.createdAt || a.updatedAt);
    try{ if(t && t.toDate) return t.toDate().getTime(); var m = new Date(t).getTime(); return isNaN(m) ? NaN : m; }catch(e){ return NaN; }
  }
  function fmtD(ms){ var d = new Date(ms); return p2(d.getDate()) + '/' + p2(d.getMonth() + 1); }
  function fmtDT(ms){ var d = new Date(ms); return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(2) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); }
  function mean(arr){ return arr.length ? arr.reduce(function(s, x){ return s + x; }, 0) / arr.length : null; }
  function r1(x){ return x == null ? null : Math.round(x * 10) / 10; }
  function counts(a){
    var tot = Number(a.totalQuestions), cor = Number(a.correctCount);
    if(isFinite(tot) && tot > 0 && isFinite(cor)) return { c: cor, t: tot };
    var w = (a.wrongQuestions || []).length, r = (a.rightQuestions || []).length;
    return (w + r) > 0 ? { c: r, t: w + r } : null;
  }
  function weighted(list){ var c = 0, t = 0; list.forEach(function(x){ var k = counts(x.a); if(k){ c += k.c; t += k.t; } }); return t ? { acc: c / t * 100, q: t } : null; }
  function typeKey(a){ return a.type || 'other'; }
  function monday(ms){ var d = new Date(ms); d.setHours(0, 0, 0, 0); var wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return d.getTime(); }
  function dtxt(d){ return d == null ? '—' : (d > 0 ? '+' : '') + Math.round(d) + '%'; }
  function dcolor(d){ return d == null ? 'var(--muted)' : (d >= 5 ? 'var(--good)' : (d <= -5 ? 'var(--critical)' : 'var(--ink-2)')); }

  // ------------------------------------------------------------------ phân tích 1 học sinh
  // all: mọi lượt của em; opts: { days, types:{key:bool}, includeSus, metric:'acc'|'score' }
  function analyze(all, opts, khoi){
    var CL = window.OPC_CLEAN, E = window.PrepScholarEngine, now = Date.now();
    var since = opts.days ? now - opts.days * DAY : 0;
    var list = (all || []).filter(function(a){ return a && a.type !== 'ping'; }).map(function(a){
      return { a: a, t: tms(a), sus: CL ? CL.suspicious(a) : [] };
    }).filter(function(x){ return isFinite(x.t); }).sort(function(x, y){ return x.t - y.t; });
    var inWin = list.filter(function(x){ return x.t >= since && opts.types[typeKey(x.a)] !== false; });
    var kept = inWin.filter(function(x){ return opts.includeSus || !x.sus.length; });
    var dropped = inWin.filter(function(x){ return !opts.includeSus && x.sus.length; });
    // chuỗi điểm để vẽ: lượt đã nộp, đủ số câu tối thiểu
    var series = [];
    kept.forEach(function(x){
      if(x.a.partial) return;
      var k = counts(x.a), v = null;
      if(opts.metric === 'score'){ if(typeof x.a.scaledScore10 === 'number' && k && k.t >= 10) v = x.a.scaledScore10 * 10; }
      else if(k && k.t >= 3) v = k.c / k.t * 100;
      if(v != null) series.push({ t: x.t, v: v, a: x.a, w: k ? k.t : 1 });
    });
    var half = Math.floor(series.length / 2), first = null, last = null, delta = null;
    if(series.length >= 4){
      var fa = series.slice(0, half), la = series.slice(series.length - half);
      first = weighted(fa.map(function(s){ return { a: s.a }; })); last = weighted(la.map(function(s){ return { a: s.a }; }));
      if(opts.metric === 'score'){ first = { acc: mean(fa.map(function(s){ return s.v; })) }; last = { acc: mean(la.map(function(s){ return s.v; })) }; }
      delta = last.acc - first.acc;
    }
    // theo tuần
    var wk = {};
    kept.forEach(function(x){ if(x.a.partial) return; var k = counts(x.a); if(!k) return; var w = monday(x.t); var o = wk[w] || (wk[w] = { ws: w, n: 0, c: 0, t: 0 }); o.n++; o.c += k.c; o.t += k.t; });
    var weeks = Object.keys(wk).map(function(k){ var o = wk[k]; return { ws: o.ws, n: o.n, q: o.t, acc: o.t ? o.c / o.t * 100 : null }; }).sort(function(a, b){ return a.ws - b.ws; });
    // mức thành thạo (engine) — dùng mọi dạng bài còn hợp lệ, không phụ thuộc ô lọc loại bài
    var valid = list.filter(function(x){ return opts.includeSus || !x.sus.length; }).map(function(x){ return x.a; });
    var nowSt = null, thenSt = null;
    if(E && E.computeStudentStatsFromAttempts && valid.length){
      try{ nowSt = E.computeStudentStatsFromAttempts(valid, khoi); }catch(e){ nowSt = null; }
      var before = list.filter(function(x){ return x.t < since && (opts.includeSus || !x.sus.length); }).map(function(x){ return x.a; });
      if(since && before.length){ try{ thenSt = E.computeStudentStatsFromAttempts(before, khoi); }catch(e){ thenSt = null; } }
    }
    var keys = E && E.getTopicKeysForKhoi ? E.getTopicKeysForKhoi(khoi) : [];
    function mAvg(st){ if(!st || !st.mastery) return null; var v = keys.map(function(k){ return st.mastery[k]; }).filter(function(x){ return x != null; }); return v.length ? mean(v) : null; }
    var N = window.OPC_NANO;
    function nname(id){ var n = N && N.getNano ? N.getNano(id) : null; return n ? n.name : id; }
    var fixed = [], weak = [];
    if(nowSt && nowSt.nanoMastery){
      var nm = nowSt.nanoMastery, om = (thenSt && thenSt.nanoMastery) || {};
      Object.keys(nm).forEach(function(id){
        if(om[id] != null && om[id] < 50 && nm[id] >= 50) fixed.push({ id: id, name: nname(id), v: Math.round(nm[id]), was: Math.round(om[id]) });
        if(E.classifyMastery && E.classifyMastery(nm[id]) === 'red') weak.push({ id: id, name: nname(id), v: Math.round(nm[id]) });
      });
      weak.sort(function(a, b){ return a.v - b.v; });
    }
    var w = weighted(kept);
    return {
      since: since, inWin: inWin, kept: kept, dropped: dropped, series: series, weeks: weeks,
      first: first, last: last, delta: delta,
      nAttempts: kept.length, nQuestions: w ? w.q : 0, acc: w ? w.acc : null,
      lastAt: list.length ? list[list.length - 1].t : null,
      masteryNow: mAvg(nowSt), masteryThen: mAvg(thenSt), topicNow: nowSt ? nowSt.mastery : null, topicThen: thenSt ? thenSt.mastery : null,
      keys: keys, fixed: fixed, weak: weak
    };
  }

  // ------------------------------------------------------------------ biểu đồ SVG
  function Spark(p){
    var pts = (p.points || []).slice(-14), W = 84, H = 24;
    if(pts.length < 2) return h('span', { style: { color: 'var(--muted)', fontSize: '0.74rem' } }, '—');
    var d = pts.map(function(s, i){ return (i ? 'L' : 'M') + (2 + i / (pts.length - 1) * (W - 4)).toFixed(1) + ' ' + (H - 3 - Math.max(0, Math.min(100, s.v)) / 100 * (H - 6)).toFixed(1); }).join(' ');
    return h('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, 'aria-hidden': 'true' }, h('path', { d: d, fill: 'none', stroke: p.color || '#c9a25f', strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' }));
  }
  function TrendChart(p){
    var pts = p.points || [], W = 700, H = 220, L = 34, R = 12, T = 12, B = 26;
    if(!pts.length) return h('p', { style: { color: 'var(--muted)', fontSize: '0.84rem' } }, 'Chưa có đủ bài hợp lệ để vẽ biểu đồ.');
    var t0 = pts[0].t, t1 = pts[pts.length - 1].t; if(t1 === t0) t1 = t0 + DAY;
    function X(t){ return L + (t - t0) / (t1 - t0) * (W - L - R); }
    function Y(v){ return T + (1 - Math.max(0, Math.min(100, v)) / 100) * (H - T - B); }
    var ma = pts.map(function(pt, i){ return { t: pt.t, v: mean(pts.slice(Math.max(0, i - 4), i + 1).map(function(x){ return x.v; })) }; });
    var maPath = ma.map(function(m, i){ return (i ? 'L' : 'M') + X(m.t).toFixed(1) + ' ' + Y(m.v).toFixed(1); }).join(' ');
    return h('svg', { viewBox: '0 0 ' + W + ' ' + H, style: { width: '100%', height: 'auto', display: 'block' }, role: 'img', 'aria-label': 'Biểu đồ ' + (p.label || '') + ' theo thời gian' },
      [0, 25, 50, 75, 100].map(function(g){ return h('g', { key: g }, h('line', { x1: L, x2: W - R, y1: Y(g), y2: Y(g), stroke: 'var(--line, #e5e7eb)', strokeWidth: 1, strokeDasharray: g === 50 ? '' : '3 4' }), h('text', { x: L - 6, y: Y(g) + 3, fontSize: 10, textAnchor: 'end', fill: 'var(--muted)' }, g)); }),
      h('text', { x: L, y: H - 6, fontSize: 10, fill: 'var(--muted)' }, fmtD(t0)), h('text', { x: W - R, y: H - 6, fontSize: 10, textAnchor: 'end', fill: 'var(--muted)' }, fmtD(t1)),
      h('path', { d: maPath, fill: 'none', stroke: 'var(--accent, #c9a25f)', strokeWidth: 2.5, strokeLinejoin: 'round' }),
      pts.map(function(pt, i){
        var k = counts(pt.a);
        return h('circle', { key: i, cx: X(pt.t), cy: Y(pt.v), r: 4, fill: TYPE_COLOR[typeKey(pt.a)] || '#64748b', stroke: 'var(--card, #fff)', strokeWidth: 1.5 },
          h('title', null, fmtDT(pt.t) + ' · ' + (TYPE_LABEL[pt.a.type] || pt.a.type || 'Bài') + ' · ' + Math.round(pt.v) + (p.unit || '%') + (k ? ' (' + k.c + '/' + k.t + ' câu)' : '')));
      }));
  }
  function WeekBars(p){
    var ws = p.weeks || [], W = 700, H = 150, L = 34, R = 12, T = 10, B = 30;
    if(!ws.length) return null;
    var bw = (W - L - R) / ws.length;
    return h('svg', { viewBox: '0 0 ' + W + ' ' + H, style: { width: '100%', height: 'auto', display: 'block' }, role: 'img', 'aria-label': 'Tỉ lệ đúng theo tuần' },
      [0, 50, 100].map(function(g){ var y = T + (1 - g / 100) * (H - T - B); return h('g', { key: g }, h('line', { x1: L, x2: W - R, y1: y, y2: y, stroke: 'var(--line, #e5e7eb)', strokeDasharray: '3 4' }), h('text', { x: L - 6, y: y + 3, fontSize: 10, textAnchor: 'end', fill: 'var(--muted)' }, g)); }),
      ws.map(function(w, i){
        var hh = (H - T - B) * (w.acc || 0) / 100, x = L + i * bw + bw * 0.15;
        var col = w.acc >= 70 ? 'var(--good, #16a34a)' : (w.acc >= 45 ? 'var(--warning, #d9a406)' : 'var(--critical, #dc2626)');
        return h('g', { key: w.ws },
          h('rect', { x: x, y: H - B - hh, width: Math.max(3, bw * 0.7), height: hh, rx: 2, fill: col, opacity: 0.85 }, h('title', null, 'Tuần ' + fmtD(w.ws) + ': ' + Math.round(w.acc) + '% đúng · ' + w.n + ' bài · ' + w.q + ' câu')),
          (ws.length <= 16 || i % 2 === 0) ? h('text', { x: x + bw * 0.35, y: H - 16, fontSize: 9, textAnchor: 'middle', fill: 'var(--muted)' }, fmtD(w.ws)) : null,
          (ws.length <= 16 || i % 2 === 0) ? h('text', { x: x + bw * 0.35, y: H - 5, fontSize: 9, textAnchor: 'middle', fill: 'var(--ink-2)' }, w.q + 'c') : null);
      }));
  }

  // ------------------------------------------------------------------ khối nhỏ
  function Card(p){ return h('div', { style: { border: '1px solid var(--line, #e5e7eb)', borderRadius: '10px', padding: '10px 14px', minWidth: '132px', flex: '1 1 132px', background: 'var(--card, transparent)' } },
    h('div', { style: { fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 700 } }, p.label),
    h('div', { style: { fontSize: '1.35rem', fontWeight: 800, color: p.color || 'inherit', lineHeight: 1.25 } }, p.value),
    p.sub ? h('div', { style: { fontSize: '0.74rem', color: 'var(--ink-2)' } }, p.sub) : null); }
  function Chip(p){ return h('button', { type: 'button', className: 'eb-nano-chip' + (p.on ? ' active' : ''), onClick: p.onClick, 'aria-pressed': !!p.on }, p.children); }

  // ------------------------------------------------------------------ chi tiết 1 học sinh
  function Detail(props){
    var st = props.student, an = props.an, O = OPC(), CL = window.OPC_CLEAN, fire = props.fireToast || function(){};
    var ps = React.useState({}); var pick = ps[0], setPick = ps[1];
    var bs = React.useState(''); var busy = bs[0], setBusy = bs[1];
    var ms = React.useState(30); var showN = ms[0], setShowN = ms[1];
    var ts = React.useState(false); var trashOpen = ts[0], setTrashOpen = ts[1];
    var rows = an.inWin.slice().reverse();
    var picked = rows.filter(function(x){ return pick[x.a.id]; });
    function del(){
      if(!picked.length || !CL) return;
      if(!window.confirm('Xoá ' + picked.length + ' bài làm của ' + st.name + '? Bài chuyển vào thùng rác (khôi phục được); điểm TB, dự đoán và bản đồ lỗ hổng được tính lại.')) return;
      setBusy('Đang xoá & tính lại…');
      CL.removeAttempts(st.id, picked.map(function(x){ return x.a; }), 'progress')
        .then(function(){ setPick({}); setBusy(''); fire('Đã xoá ' + picked.length + ' bài của ' + st.name + '.'); props.onChanged(); })
        .catch(function(e){ setBusy(''); fire('Không xoá được: ' + (e && (e.code || e.message)), true); });
    }
    var metricName = props.metric === 'score' ? 'Điểm /10 (×10)' : 'Tỉ lệ đúng';
    var topicRows = (an.keys || []).filter(function(k){ return an.topicNow && an.topicNow[k] != null; });
    var CD = window.PrepScholarEngine && window.PrepScholarEngine.CHU_DE_MAP || {};
    return h('div', null,
      h('div', { style: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 } },
        h('button', { type: 'button', className: 'btn btn-secondary', onClick: props.onBack }, '← Cả lớp'),
        h('h3', { style: { margin: 0 } }, st.name || 'Học sinh'),
        h('span', { style: { color: 'var(--muted)', fontSize: '0.84rem' } }, 'Khối ' + props.khoi + (st.lop ? ' · ' + st.lop : '')),
        h('span', { style: { flex: 1 } }),
        CL ? h('button', { type: 'button', className: 'sm-link-btn', onClick: function(){ setTrashOpen(true); } }, '🗑 Thùng rác') : null),
      h('div', { style: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 } },
        h(Card, { label: 'Bài hợp lệ', value: an.nAttempts, sub: an.dropped.length ? 'đã loại ' + an.dropped.length + ' bài nghi làm ẩu' : 'trong khoảng đã chọn' }),
        h(Card, { label: 'Số câu đã làm', value: an.nQuestions }),
        h(Card, { label: metricName + ' TB', value: an.acc == null ? '—' : Math.round(an.acc) + (props.metric === 'score' ? '' : '%') }),
        h(Card, { label: 'Đầu kỳ → cuối kỳ', value: an.delta == null ? '—' : Math.round(an.first.acc) + ' → ' + Math.round(an.last.acc), color: dcolor(an.delta), sub: an.delta == null ? 'cần ≥ 4 bài đã nộp' : dtxt(an.delta) }),
        h(Card, { label: 'Thành thạo TB', value: an.masteryNow == null ? '—' : Math.round(an.masteryNow) + '%', sub: an.masteryThen != null ? 'đầu kỳ ' + Math.round(an.masteryThen) + '% (' + dtxt(an.masteryNow - an.masteryThen) + ')' : 'chưa có mốc đầu kỳ', color: an.masteryThen != null ? dcolor(an.masteryNow - an.masteryThen) : null })),
      h('div', { className: 'sm-info-block' },
        h('div', { className: 'sm-info-title' }, '📈 ' + metricName + ' theo thời gian'),
        h(TrendChart, { points: an.series, label: metricName, unit: props.metric === 'score' ? '' : '%' }),
        h('div', { style: { display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: '0.74rem', color: 'var(--ink-2)', marginTop: 4 } },
          h('span', { style: { color: 'var(--accent, #c9a25f)', fontWeight: 700 } }, '━ trung bình 5 bài gần nhất'),
          Object.keys(TYPE_LABEL).filter(function(k){ return an.series.some(function(s){ return typeKey(s.a) === k; }); }).map(function(k){ return h('span', { key: k }, h('span', { style: { color: TYPE_COLOR[k] } }, '● '), TYPE_LABEL[k]); }))),
      an.weeks.length ? h('div', { className: 'sm-info-block' }, h('div', { className: 'sm-info-title' }, '🗓 Tỉ lệ đúng theo tuần (số dưới cột = số câu đã làm)'), h(WeekBars, { weeks: an.weeks })) : null,
      h('div', { className: 'sm-info-block' },
        h('div', { className: 'sm-info-title' }, '🧭 Mức thành thạo từng chủ đề'),
        !topicRows.length ? h('p', { style: { color: 'var(--muted)', fontSize: '0.82rem' } }, 'Chưa có dữ liệu chủ đề.') :
          h('table', { className: 'sm-history-table' }, h('thead', null, h('tr', null, h('th', null, 'Chủ đề'), h('th', null, 'Đầu kỳ'), h('th', null, 'Hiện tại'), h('th', null, 'Thay đổi'))),
            h('tbody', null, topicRows.map(function(k){
              var now = an.topicNow[k], was = an.topicThen ? an.topicThen[k] : null, d = was != null ? now - was : null;
              return h('tr', { key: k }, h('td', null, (CD[k] && CD[k].name) || k), h('td', null, was != null ? Math.round(was) + '%' : '—'), h('td', null, Math.round(now) + '%'), h('td', { style: { color: dcolor(d), fontWeight: 700 } }, dtxt(d)));
            }))),
        an.fixed.length ? h('p', { style: { fontSize: '0.82rem', margin: '10px 0 2px' } }, h('b', { style: { color: 'var(--good)' } }, '✅ Lỗ hổng đã vá (' + an.fixed.length + '): '), an.fixed.slice(0, 8).map(function(f){ return f.name + ' (' + f.was + '→' + f.v + '%)'; }).join(' · ')) : null,
        an.weak.length ? h('p', { style: { fontSize: '0.82rem', margin: '6px 0 0' } }, h('b', { style: { color: 'var(--critical)' } }, '🔴 Còn yếu nhất: '), an.weak.slice(0, 6).map(function(f){ return f.name + ' (' + f.v + '%)'; }).join(' · ')) : null),
      h('div', { className: 'sm-info-block' },
        h('div', { className: 'sm-info-title' }, '🕓 Các lượt làm bài trong khoảng (' + rows.length + ')'),
        h('p', { style: { color: 'var(--muted)', fontSize: '0.76rem', margin: '0 0 6px' } }, '⚠ = nghi làm ẩu (làm dở, trả lời quá ít câu, quá nhanh…): bị loại khỏi thống kê trừ khi bật "tính cả bài nghi làm ẩu". Tick rồi xoá để dọn hẳn (vào thùng rác, khôi phục được).'),
        CL ? h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 } },
          an.inWin.some(function(x){ return x.sus.length; }) ? h('button', { type: 'button', className: 'btn btn-secondary', style: { fontSize: '0.76rem', padding: '4px 9px' }, onClick: function(){ var p = {}; an.inWin.forEach(function(x){ if(x.sus.length) p[x.a.id] = true; }); setPick(p); } }, '⚠ Chọn các bài nghi làm ẩu') : null,
          picked.length ? h('button', { type: 'button', className: 'btn btn-primary', disabled: !!busy, style: { fontSize: '0.76rem', padding: '4px 9px', background: 'var(--critical)', borderColor: 'var(--critical)' }, onClick: del }, busy || ('🗑 Xoá ' + picked.length + ' bài đã chọn')) : null,
          picked.length ? h('button', { type: 'button', className: 'sm-link-btn', onClick: function(){ setPick({}); } }, 'Bỏ chọn') : null) : null,
        h('table', { className: 'sm-history-table' },
          h('thead', null, h('tr', null, CL ? h('th', { style: { width: 26 } }, '') : null, h('th', null, 'Ngày'), h('th', null, 'Loại'), h('th', null, 'Đúng/Tổng'), h('th', null, 'Điểm'), h('th', null, 'Ghi chú'))),
          h('tbody', null, rows.slice(0, showN).map(function(x){
            var a = x.a, k = counts(a), out = !an.kept.some(function(y){ return y === x; });
            return h('tr', { key: a.id, style: { opacity: out ? 0.55 : 1, background: pick[a.id] ? 'rgba(220,38,38,.08)' : null } },
              CL ? h('td', null, h('input', { type: 'checkbox', checked: !!pick[a.id], onChange: function(e){ var p = Object.assign({}, pick); if(e.target.checked) p[a.id] = true; else delete p[a.id]; setPick(p); } })) : null,
              h('td', null, fmtDT(x.t)), h('td', null, TYPE_LABEL[a.type] || a.type || '—'),
              h('td', null, k ? k.c + '/' + k.t : '—'), h('td', null, a.partial ? '—' : (typeof a.scaledScore10 === 'number' ? a.scaledScore10.toFixed(2) : '—')),
              h('td', { style: { fontSize: '0.74rem', color: x.sus.length ? 'var(--warning)' : 'var(--muted)' } }, x.sus.length ? '⚠ ' + x.sus.join(' · ') + (out ? ' — đã loại' : ' — vẫn tính') : (a.partial ? 'làm dở' : '')));
          }))),
        rows.length > showN ? h('button', { type: 'button', className: 'sm-link-btn', style: { marginTop: 8 }, onClick: function(){ setShowN(showN + 40); } }, 'Xem thêm ' + Math.min(40, rows.length - showN) + ' lượt') : null),
      (trashOpen && CL) ? h(CL.TrashModal, { student: st, fireToast: fire, onClose: function(){ setTrashOpen(false); props.onChanged(); } }) : null);
  }

  // ------------------------------------------------------------------ panel chính
  function ProgressPanel(props){
    var fire = props.fireToast || function(){};
    var CUR = window.OPC_CURRICULUM, CL = window.OPC_CLEAN;
    var S = React.useState([]); var students = S[0], setStudents = S[1];
    var KH = React.useState('all'); var khoiF = KH[0], setKhoiF = KH[1];
    var LP = React.useState('all'); var lopF = LP[0], setLopF = LP[1];
    var DY = React.useState(60); var days = DY[0], setDays = DY[1];
    var TY = React.useState({}); var types = TY[0], setTypes = TY[1];
    var IS = React.useState(false); var includeSus = IS[0], setIncludeSus = IS[1];
    var MT = React.useState('acc'); var metric = MT[0], setMetric = MT[1];
    var SO = React.useState('gain'); var sortBy = SO[0], setSortBy = SO[1];
    var SL = React.useState(null); var sel = SL[0], setSel = SL[1];
    var DA = React.useState({}); var data = DA[0], setData = DA[1];     // id -> [attempts]
    var LD = React.useState(''); var loading = LD[0], setLoading = LD[1];
    var CO = React.useState(false); var cleanOpen = CO[0], setCleanOpen = CO[1];
    var loadingRef = React.useRef({});

    React.useEffect(function(){
      var O = OPC(); if(!O || !O.students) return;
      return O.students.subscribe(function(snap){
        var l = []; snap.forEach(function(d){ l.push(Object.assign({ id: d.id }, d.data())); });
        setStudents(l.filter(function(x){ return x.status !== 'inactive'; }));
      }, function(){});
    }, []);
    var khoiOf = function(s){ return CUR ? CUR.khoiOf(s) : 12; };
    var classes = Array.from(new Set(students.map(function(s){ return s.lop || ''; }).filter(Boolean))).sort();
    var shown = students.filter(function(s){ return (khoiF === 'all' || khoiOf(s) === Number(khoiF)) && (lopF === 'all' || s.lop === lopF); });

    async function loadOne(id, force){
      var O = OPC(); if(!O) return;
      if(!force && (data[id] || loadingRef.current[id])) return;
      loadingRef.current[id] = true;
      var list = [];
      try{ list = O.qfix && O.qfix.listAttempts ? await O.qfix.listAttempts(id) : await O.attempts.loadForStudent(id); }  // listAttempts: TẤT CẢ lượt (loadForStudent chỉ 100 lượt gần nhất)
      catch(e){ try{ list = await O.attempts.loadForStudent(id); }catch(e2){ list = []; } }
      loadingRef.current[id] = false;
      setData(function(p){ var n = Object.assign({}, p); n[id] = list; return n; });
    }
    async function loadAll(force){
      var ids = shown.filter(function(s){ return force || !data[s.id]; }).map(function(s){ return s.id; });
      var done = 0;
      if(!ids.length) return;
      setLoading('Đang tải lịch sử làm bài 0/' + ids.length + '…');
      var queue = ids.slice();
      async function worker(){ while(queue.length){ var id = queue.shift(); await loadOne(id, force); done++; setLoading('Đang tải lịch sử làm bài ' + done + '/' + ids.length + '…'); } }
      await Promise.all([worker(), worker(), worker(), worker()]);
      setLoading('');
    }
    var shownKey = shown.map(function(s){ return s.id; }).join(',');
    React.useEffect(function(){ if(shown.length) loadAll(false); }, [shownKey]);

    var opts = { days: days, types: types, includeSus: includeSus, metric: metric };
    var rows = shown.filter(function(s){ return data[s.id]; }).map(function(s){ return { s: s, an: analyze(data[s.id], opts, khoiOf(s)) }; });
    var sorters = {
      gain: function(a, b){ return (b.an.delta == null ? -1e9 : b.an.delta) - (a.an.delta == null ? -1e9 : a.an.delta); },
      drop: function(a, b){ return (a.an.delta == null ? 1e9 : a.an.delta) - (b.an.delta == null ? 1e9 : b.an.delta); },
      name: function(a, b){ return String(a.s.name || '').localeCompare(String(b.s.name || ''), 'vi'); },
      recent: function(a, b){ return (b.an.lastAt || 0) - (a.an.lastAt || 0); },
      few: function(a, b){ return a.an.nAttempts - b.an.nAttempts; }
    };
    rows.sort(sorters[sortBy] || sorters.gain);
    var nUp = rows.filter(function(r){ return r.an.delta != null && r.an.delta >= 5; }).length;
    var nDown = rows.filter(function(r){ return r.an.delta != null && r.an.delta <= -5; }).length;
    var nFlat = rows.filter(function(r){ return r.an.delta != null && Math.abs(r.an.delta) < 5; }).length;
    var nNo = rows.filter(function(r){ return r.an.delta == null; }).length;
    var nDropped = rows.reduce(function(s, r){ return s + r.an.dropped.length; }, 0);
    var selRow = sel ? rows.filter(function(r){ return r.s.id === sel; })[0] : null;
    var typeKeys = Object.keys(TYPE_LABEL);

    return h('div', null,
      h('div', { className: 'sm-toolbar' }, h('div', null,
        h('h3', null, '📈 Tiến bộ học sinh'),
        h('p', { className: 'sm-sub' }, 'Tổng hợp từ lịch sử làm bài của mọi dạng bài. Các lượt nghi làm ẩu (bấm nhầm vài câu rồi bỏ, làm dở, bấm thử tính năng…) tự bị loại khỏi thống kê theo đúng bộ lọc của "Dọn bài làm ẩu"; thầy xoá hẳn được ngay tại đây (vào thùng rác, khôi phục được).')),
        h('div', { className: 'sm-actions' },
          CL ? h('button', { type: 'button', className: 'btn btn-secondary', onClick: function(){ setCleanOpen(true); } }, '🧹 Dọn bài làm ẩu cả lớp') : null,
          h('button', { type: 'button', className: 'btn btn-secondary', disabled: !!loading, onClick: function(){ loadAll(true); } }, '🔄 Tải lại'))),
      // bộ lọc
      h('div', { style: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', margin: '8px 0' } },
        h('div', { className: 'sm-field' }, h('label', null, 'Khối'), h('select', { value: khoiF, onChange: function(e){ setKhoiF(e.target.value); setSel(null); } }, h('option', { value: 'all' }, 'Tất cả'), [12, 11, 10].map(function(k){ return h('option', { key: k, value: k }, 'Lớp ' + k); }))),
        h('div', { className: 'sm-field' }, h('label', null, 'Lớp'), h('select', { value: lopF, onChange: function(e){ setLopF(e.target.value); setSel(null); } }, h('option', { value: 'all' }, 'Tất cả'), classes.map(function(c){ return h('option', { key: c, value: c }, c); }))),
        h('div', { className: 'sm-field' }, h('label', null, 'Khoảng thời gian'), h('select', { value: days, onChange: function(e){ setDays(Number(e.target.value)); } }, WINDOWS.map(function(w){ return h('option', { key: w[0], value: w[0] }, w[1]); }))),
        h('div', { className: 'sm-field' }, h('label', null, 'Chỉ số'), h('select', { value: metric, onChange: function(e){ setMetric(e.target.value); } }, h('option', { value: 'acc' }, 'Tỉ lệ đúng (%) — mọi dạng bài'), h('option', { value: 'score' }, 'Điểm /10 — bài từ 10 câu'))),
        h('div', { className: 'sm-field' }, h('label', null, 'Sắp xếp'), h('select', { value: sortBy, onChange: function(e){ setSortBy(e.target.value); } }, h('option', { value: 'gain' }, 'Tiến bộ nhiều nhất'), h('option', { value: 'drop' }, 'Sa sút nhiều nhất'), h('option', { value: 'recent' }, 'Làm bài gần đây'), h('option', { value: 'few' }, 'Ít bài nhất'), h('option', { value: 'name' }, 'Tên A→Z')))),
      h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 } },
        h('span', { style: { fontSize: '0.8rem', fontWeight: 700 } }, 'Dạng bài:'),
        typeKeys.map(function(k){ return h(Chip, { key: k, on: types[k] !== false, onClick: function(){ var n = Object.assign({}, types); n[k] = types[k] === false; setTypes(n); } }, TYPE_LABEL[k]); }),
        h('label', { style: { display: 'flex', gap: 5, alignItems: 'center', fontSize: '0.82rem', marginLeft: 10 } }, h('input', { type: 'checkbox', checked: includeSus, onChange: function(e){ setIncludeSus(e.target.checked); } }), 'Tính cả bài nghi làm ẩu')),
      loading ? h('div', { className: 'banner info', style: { marginBottom: 10 } }, h('span', null, '⏳'), h('div', null, loading)) : null,
      !shown.length ? h('p', { style: { color: 'var(--ink-2)' } }, 'Không có học sinh nào khớp bộ lọc.') :
      selRow ? h(Detail, { key: selRow.s.id, student: selRow.s, an: selRow.an, khoi: khoiOf(selRow.s), metric: metric, fireToast: fire, onBack: function(){ setSel(null); }, onChanged: function(){ loadOne(selRow.s.id, true); } }) :
      h('div', null,
        h('div', { style: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 } },
          h(Card, { label: 'Đang tiến bộ (≥ +5%)', value: nUp, color: 'var(--good)' }),
          h(Card, { label: 'Ổn định', value: nFlat }),
          h(Card, { label: 'Sa sút (≤ −5%)', value: nDown, color: nDown ? 'var(--critical)' : null }),
          h(Card, { label: 'Chưa đủ dữ liệu', value: nNo, sub: 'cần ≥ 4 bài đã nộp trong kỳ' }),
          h(Card, { label: includeSus ? 'Bài nghi làm ẩu (đang tính)' : 'Bài nghi làm ẩu đã loại', value: nDropped, sub: nDropped ? 'mở từng em để xem & xoá' : 'không có' })),
        h('div', { className: 'sm-table-wrap' }, h('table', { className: 'sm-table' },
          h('thead', null, h('tr', null, h('th', null, 'Học sinh'), h('th', { style: { textAlign: 'center' } }, 'Bài hợp lệ'), h('th', { style: { textAlign: 'center' } }, 'Số câu'), h('th', { style: { textAlign: 'center' } }, metric === 'score' ? 'Điểm TB' : 'Đúng TB'), h('th', { style: { textAlign: 'center' } }, 'Đầu kỳ → cuối kỳ'), h('th', null, 'Xu hướng'), h('th', { style: { textAlign: 'center' } }, 'Thành thạo'), h('th', null, 'Làm bài gần nhất'))),
          h('tbody', null, rows.map(function(r){
            var an = r.an, s = r.s, md = (an.masteryThen != null && an.masteryNow != null) ? an.masteryNow - an.masteryThen : null;
            return h('tr', { key: s.id, onClick: function(){ setSel(s.id); }, style: { cursor: 'pointer' } },
              h('td', null, h('div', { style: { fontWeight: 700 } }, s.name || '—'), h('div', { style: { fontSize: '0.74rem', color: 'var(--muted)' } }, 'Khối ' + khoiOf(s) + (s.lop ? ' · ' + s.lop : ''))),
              h('td', { style: { textAlign: 'center' } }, an.nAttempts, an.dropped.length ? h('span', { title: 'Đã loại ' + an.dropped.length + ' bài nghi làm ẩu', style: { color: 'var(--warning)', marginLeft: 5, fontSize: '0.74rem' } }, '⚠' + an.dropped.length) : null),
              h('td', { style: { textAlign: 'center' } }, an.nQuestions),
              h('td', { style: { textAlign: 'center' } }, an.acc == null ? '—' : Math.round(an.acc) + (metric === 'score' ? '' : '%')),
              h('td', { style: { textAlign: 'center', whiteSpace: 'nowrap' } }, an.delta == null ? h('span', { style: { color: 'var(--muted)' } }, '—') : [Math.round(an.first.acc) + ' → ' + Math.round(an.last.acc) + ' ', h('b', { key: 'd', style: { color: dcolor(an.delta) } }, '(' + dtxt(an.delta) + ')')]),
              h('td', null, h(Spark, { points: an.series, color: an.delta != null ? (an.delta >= 5 ? '#16a34a' : (an.delta <= -5 ? '#dc2626' : '#c9a25f')) : '#94a3b8' })),
              h('td', { style: { textAlign: 'center', whiteSpace: 'nowrap' } }, an.masteryNow == null ? '—' : [Math.round(an.masteryNow) + '% ', md != null ? h('span', { key: 'm', style: { color: dcolor(md), fontSize: '0.74rem' } }, '(' + dtxt(md) + ')') : null]),
              h('td', { style: { fontSize: '0.8rem' } }, an.lastAt ? fmtDT(an.lastAt) : '—'));
          })))),
        h('p', { style: { fontSize: '0.74rem', color: 'var(--muted)', marginTop: 8 } }, 'Đầu kỳ / cuối kỳ = nửa đầu và nửa sau các bài đã nộp trong khoảng đã chọn (bài dưới 3 câu không tính). Thành thạo = mức thành thạo trung bình các chủ đề của khối, tính trên mọi dạng bài còn hợp lệ, so với thời điểm bắt đầu khoảng.')),
      cleanOpen && CL ? h(CL.CleanupModal, { students: students, fireToast: fire, onClose: function(){ setCleanOpen(false); loadAll(true); } }) : null);
  }

  window.OPC_PROGRESS = { ProgressPanel: ProgressPanel, analyze: analyze };
})(window);
