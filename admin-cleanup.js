/**
 * admin-cleanup.js — THÊM 25/10/2026 · XOÁ BÀI LÀM KHÔNG PHẢN ÁNH ĐÚNG (em bấm thử / làm lung tung vài câu rồi nộp)
 *  • Nhận diện "nghi làm ẩu": làm dở, trả lời quá ít câu, làm quá nhanh (< 15 giây/câu), điểm rất thấp mà nộp rất nhanh.
 *  • Xoá = CHUYỂN VÀO THÙNG RÁC (students/{id}/attemptsTrash) — khôi phục được; sau đó TÍNH LẠI điểm TB, dự đoán,
 *    bản đồ lỗ hổng, sổ câu sai của em đó (paperRefreshStats trong admin.html).
 *  • Dọn cả lớp 1 lần: quét mọi em, liệt kê bài nghi làm ẩu trong N ngày gần đây, chọn rồi xoá.
 * Xuất: window.OPC_CLEAN = { suspicious, CleanupModal, TrashModal, removeAttempts }
 */
(function(window){
  'use strict';
  var React = window.React; if(!React) return;
  var h = React.createElement;
  function OPC(){ return window.OPC; }
  var TYPE = { practice: 'Luyện tập', diagnostic: 'Kiểm tra đầu vào', adaptive: 'Luyện thích ứng', drill: 'Luyện trọng tâm', assigned: 'Đề được giao', mistakes: 'Sửa câu sai', paper: 'Bài giấy' };
  function p2(n){ return (n < 10 ? '0' : '') + n; }
  function fmtDate(v){ try{ var d = v && v.toDate ? v.toDate() : new Date(v); return isNaN(d) ? '—' : p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); }catch(e){ return '—'; } }
  function answeredCount(a){
    var ans = a.answers || {}, n = 0;
    Object.keys(ans).forEach(function(k){ var v = ans[k]; if(v == null || v === '') return; if(typeof v === 'object'){ if(Object.keys(v).length) n++; } else n++; });
    return n;
  }
  // Trả về [] nếu bình thường, hoặc danh sách lí do nghi làm ẩu
  function suspicious(a){
    if(!a || a.type === 'ping' || a.type === 'paper' || a.source === 'paper') return [];
    var why = [], total = Number(a.totalQuestions) || 0, ans = a.answers ? answeredCount(a) : null;
    if(a.partial) why.push('làm dở, chưa nộp');
    if(total >= 4 && ans != null && ans / total < 0.4) why.push('chỉ trả lời ' + ans + '/' + total + ' câu');
    if(total >= 4 && a.timeUsedSec != null && a.timeUsedSec / total < 15) why.push('làm quá nhanh (' + Math.round(a.timeUsedSec) + ' giây cho ' + total + ' câu)');
    if(total >= 4 && typeof a.scaledScore10 === 'number' && a.scaledScore10 < 2.5 && a.timeUsedSec != null && a.timeUsedSec / total < 40) why.push('điểm rất thấp (' + a.scaledScore10.toFixed(2) + ') và nộp vội');
    return why;
  }
  // Chuyển các lượt vào thùng rác rồi tính lại số liệu của em
  async function removeAttempts(studentId, list, reason){
    var O = OPC();
    for(var i = 0; i < list.length; i++) await O.attempts.trash(studentId, list[i], reason || 'manual');
    var H = window.OPC_ADMIN_HELP;
    if(H && H.refreshStats){ try{ await H.refreshStats(studentId); }catch(e){ console.warn('Chưa tính lại được số liệu:', e); } }
  }

  function Modal(props){
    return h('div', { className: 'sm-overlay', style: { zIndex: props.z || 1200 }, onClick: function(e){ if(e.target === e.currentTarget && !props.busy) props.onClose(); } },
      h('div', { className: 'sm-modal', role: 'dialog', 'aria-modal': 'true', style: { maxWidth: props.width || '860px' } },
        h('div', { className: 'sm-modal-head' }, h('h3', null, props.title), h('button', { type: 'button', className: 'sm-modal-close', disabled: !!props.busy, onClick: props.onClose }, '✕')),
        props.children));
  }

  // ---------------------------------------------------------------- dọn cả lớp
  function CleanupModal(props){
    var O = OPC(), fire = props.fireToast;
    var ds = React.useState(7); var days = ds[0], setDays = ds[1];
    var ls = React.useState('all'); var lop = ls[0], setLop = ls[1];
    var rs = React.useState(null); var rows = rs[0], setRows = rs[1];       // [{ st, a, why }]
    var ps = React.useState({}); var pick = ps[0], setPick = ps[1];
    var bs = React.useState(''); var busy = bs[0], setBusy = bs[1];
    var students = (props.students || []).filter(function(s){ return s.status !== 'inactive'; });
    var classes = Array.from(new Set(students.map(function(s){ return s.lop || ''; }).filter(Boolean))).sort();
    async function scan(){
      var list = students.filter(function(s){ return lop === 'all' || s.lop === lop; }), out = [], since = Date.now() - days * 86400000;
      for(var i = 0; i < list.length; i++){
        setBusy('Đang quét ' + (i + 1) + '/' + list.length + ' — ' + list[i].name + '…');
        var at = []; try{ at = await O.attempts.loadForStudent(list[i].id); }catch(e){}
        at.forEach(function(a){
          var t = new Date(a.createdAt && a.createdAt.toDate ? a.createdAt.toDate() : a.createdAt).getTime();
          if(!(t >= since)) return;
          var why = suspicious(a); if(why.length) out.push({ st: list[i], a: a, why: why });
        });
      }
      var p = {}; out.forEach(function(r){ p[r.st.id + '/' + r.a.id] = true; });
      setRows(out); setPick(p); setBusy('');
    }
    async function run(){
      var sel = rows.filter(function(r){ return pick[r.st.id + '/' + r.a.id]; });
      if(!sel.length) return;
      if(!window.confirm('Xoá ' + sel.length + ' bài làm đã chọn? (Chuyển vào thùng rác của từng em — khôi phục được trong hồ sơ học sinh.)')) return;
      var by = {}; sel.forEach(function(r){ (by[r.st.id] = by[r.st.id] || { st: r.st, list: [] }).list.push(r.a); });
      var ids = Object.keys(by);
      for(var i = 0; i < ids.length; i++){ setBusy('Đang xoá & tính lại điểm ' + (i + 1) + '/' + ids.length + ' — ' + by[ids[i]].st.name + '…'); await removeAttempts(ids[i], by[ids[i]].list, 'cleanup'); }
      setBusy(''); fire('Đã xoá ' + sel.length + ' bài làm ẩu của ' + ids.length + ' em và tính lại điểm.');
      setRows(rows.filter(function(r){ return !pick[r.st.id + '/' + r.a.id]; })); setPick({});
    }
    var nSel = rows ? rows.filter(function(r){ return pick[r.st.id + '/' + r.a.id]; }).length : 0;
    return h(Modal, { title: '🧹 Dọn bài làm ẩu của cả lớp', onClose: props.onClose, busy: busy, width: '900px' },
      h('p', { className: 'sm-sub', style: { margin: '0 0 10px' } }, 'Tìm các lượt em bấm thử / làm lung tung: làm dở, trả lời dưới 40% số câu, dưới 15 giây/câu, hoặc điểm rất thấp mà nộp vội. Bài giấy (thầy nhập/quét phiếu) không bị quét. Xoá xong, điểm trung bình, điểm dự đoán và bản đồ lỗ hổng của em được tính lại.'),
      h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '10px' } },
        h('div', { className: 'sm-field' }, h('label', null, 'Trong'), h('select', { value: days, onChange: function(e){ setDays(Number(e.target.value)); } }, [1, 3, 7, 14, 30, 90, 365].map(function(d){ return h('option', { key: d, value: d }, d === 1 ? 'Hôm nay' : d + ' ngày gần đây'); }))),
        h('div', { className: 'sm-field' }, h('label', null, 'Lớp'), h('select', { value: lop, onChange: function(e){ setLop(e.target.value); } }, h('option', { value: 'all' }, 'Tất cả (' + students.length + ' em)'), classes.map(function(c){ return h('option', { key: c, value: c }, 'Lớp ' + c); }))),
        h('button', { type: 'button', className: 'btn btn-primary', disabled: !!busy, onClick: scan }, rows ? '🔄 Quét lại' : '🔍 Quét')),
      busy ? h('div', { className: 'banner info', style: { marginBottom: '10px' } }, h('span', null, '⏳'), h('div', null, busy)) : null,
      rows && !rows.length && !busy ? h('p', { style: { color: 'var(--good)', fontWeight: 700 } }, '✓ Không thấy bài nào nghi làm ẩu trong khoảng này.') : null,
      rows && rows.length ? h('div', null,
        h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' } },
          h('b', null, rows.length + ' bài nghi làm ẩu'),
          h('button', { type: 'button', className: 'sm-link-btn', onClick: function(){ var p = {}; rows.forEach(function(r){ p[r.st.id + '/' + r.a.id] = true; }); setPick(p); } }, 'Chọn hết'),
          h('button', { type: 'button', className: 'sm-link-btn', onClick: function(){ setPick({}); } }, 'Bỏ chọn'),
          h('span', { style: { flex: 1 } }),
          h('button', { type: 'button', className: 'btn btn-primary', style: { background: 'var(--critical)', borderColor: 'var(--critical)' }, disabled: !nSel || !!busy, onClick: run }, '🗑 Xoá ' + nSel + ' bài đã chọn')),
        h('div', { className: 'sm-table-wrap', style: { marginTop: 0, maxHeight: '420px', overflow: 'auto' } }, h('table', { className: 'sm-table' },
          h('thead', null, h('tr', null, ['', 'Học sinh', 'Lúc', 'Loại', 'Điểm', 'Đúng/Tổng', 'Lí do'].map(function(t, i){ return h('th', { key: i }, t); }))),
          h('tbody', null, rows.map(function(r){
            var k = r.st.id + '/' + r.a.id;
            return h('tr', { key: k },
              h('td', null, h('input', { type: 'checkbox', checked: !!pick[k], onChange: function(e){ var p = Object.assign({}, pick); p[k] = e.target.checked; setPick(p); } })),
              h('td', null, h('b', null, r.st.name), r.st.lop ? h('div', { style: { fontSize: '0.72rem', color: 'var(--muted)' } }, r.st.lop) : null),
              h('td', { style: { whiteSpace: 'nowrap' } }, fmtDate(r.a.createdAt)),
              h('td', null, TYPE[r.a.type] || r.a.type || '—'),
              h('td', null, typeof r.a.scaledScore10 === 'number' && !r.a.partial ? r.a.scaledScore10.toFixed(2) : '—'),
              h('td', null, (r.a.correctCount != null ? r.a.correctCount : '—') + '/' + (r.a.totalQuestions != null ? r.a.totalQuestions : '—')),
              h('td', { style: { fontSize: '0.8rem', color: 'var(--warning)' } }, r.why.join(' · ')));
          }))))) : null);
  }

  // ---------------------------------------------------------------- thùng rác của 1 em
  function TrashModal(props){
    var O = OPC(), st = props.student, fire = props.fireToast;
    var ls = React.useState(null); var list = ls[0], setList = ls[1];
    var bs = React.useState(''); var busy = bs[0], setBusy = bs[1];
    function load(){ O.attempts.loadTrash(st.id).then(setList).catch(function(){ setList([]); }); }
    React.useEffect(load, [st.id]);
    async function restore(t){
      setBusy('Đang khôi phục…');
      try{ await O.attempts.restore(st.id, t); if(window.OPC_ADMIN_HELP && window.OPC_ADMIN_HELP.refreshStats) await window.OPC_ADMIN_HELP.refreshStats(st.id); fire('Đã khôi phục bài làm và tính lại điểm.'); load(); }
      catch(e){ fire('Không khôi phục được: ' + (e && e.message), true); }
      setBusy('');
    }
    async function purge(t){
      if(!window.confirm('Xoá VĨNH VIỄN bài này? Không khôi phục được nữa.')) return;
      await O.attempts.purge(st.id, t.id); load();
    }
    return h(Modal, { title: '🗑 Thùng rác bài làm — ' + st.name, onClose: props.onClose, busy: busy, z: 1300, width: '760px' },
      busy ? h('div', { className: 'banner info' }, h('span', null, '⏳'), h('div', null, busy)) : null,
      !list ? h('p', null, 'Đang tải…') : !list.length ? h('p', { style: { color: 'var(--ink-2)' } }, 'Thùng rác trống.') :
      h('div', { className: 'sm-table-wrap', style: { marginTop: 0 } }, h('table', { className: 'sm-table' },
        h('thead', null, h('tr', null, ['Làm lúc', 'Loại', 'Điểm', 'Đúng/Tổng', 'Đã xoá', ''].map(function(t, i){ return h('th', { key: i }, t); }))),
        h('tbody', null, list.map(function(t){
          var a = t.data || {};
          return h('tr', { key: t.id },
            h('td', null, fmtDate(a.createdAt)), h('td', null, TYPE[a.type] || a.type || '—'),
            h('td', null, typeof a.scaledScore10 === 'number' && !a.partial ? a.scaledScore10.toFixed(2) : '—'),
            h('td', null, (a.correctCount != null ? a.correctCount : '—') + '/' + (a.totalQuestions != null ? a.totalQuestions : '—')),
            h('td', { style: { fontSize: '0.78rem' } }, fmtDate(t.deletedAt), t.reason === 'cleanup' ? ' · dọn cả lớp' : ''),
            h('td', { style: { whiteSpace: 'nowrap' } },
              h('button', { type: 'button', className: 'btn btn-secondary', style: { fontSize: '0.75rem', padding: '4px 9px' }, disabled: !!busy, onClick: function(){ restore(t); } }, '↩ Khôi phục'), ' ',
              h('button', { type: 'button', className: 'sm-link-btn', style: { color: 'var(--critical)' }, onClick: function(){ purge(t); } }, 'Xoá hẳn')));
        })))),
      h('p', { style: { fontSize: '0.78rem', color: 'var(--ink-2)', marginTop: '8px' } }, 'Bài trong thùng rác không tính vào điểm, dự đoán hay bản đồ lỗ hổng. Khôi phục thì bài được tính lại như cũ.'));
  }

  window.OPC_CLEAN = { suspicious: suspicious, CleanupModal: CleanupModal, TrashModal: TrashModal, removeAttempts: removeAttempts, answeredCount: answeredCount };
})(window);
