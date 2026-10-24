/**
 * admin-growth.js — THÊM 23/10/2026 · 3 tab mới trong admin.html (nạp sau faraday-extras.js)
 *  🏆 THI THỬ THÁNG: chọn đề trong ngân hàng → giao online cho cả lớp/nhóm (giờ làm bài, ngày mở–đóng) hoặc lấy điểm
 *     từ bài kiểm tra giấy; tổng hợp điểm, so với kỳ trước (tiến bộ), xếp hạng, trao giấy khen (PNG có logo), công bố cho học sinh.
 *  📺 VIDEO BÀI GIẢNG: thư viện bài giảng FaradayAI (kịch bản → "video" có lời giảng + phụ đề + logo) và video YouTube
 *     ứng dụng thực tế; gắn theo bài / nano-point → học sinh làm sai câu nào thấy ngay nút "📺 Ôn lý thuyết".
 *  💬 KHẢO SÁT: cấu hình hỏi nhẹ định kỳ, xem mức hài lòng, % thấy hữu ích, phần các em thích, góp ý cần cải thiện.
 * Xuất: window.OPC_GROWTH = { MockPanel, LessonsPanel, SurveyPanel }
 */
(function(window){
  'use strict';
  var React = window.React; if(!React) return;
  var h = React.createElement;
  function OPC(){ return window.OPC; }
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function ymd(d){ d = d ? new Date(d) : new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(n){ var d = new Date(); d.setDate(d.getDate() + n); return ymd(d); }
  function vnDate(s){ if(!s) return '—'; var p = String(s).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s; }
  function fmt2(n){ return n == null || isNaN(n) ? '—' : (Math.round(Number(n) * 100) / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 }); }
  function shortName(n){ var w = String(n || '').trim().split(/\s+/); return w.length > 2 ? w.slice(-2).join(' ') : w.join(' '); }
  function useSnap(fn, deps){
    var st = React.useState(null); var v = st[0], set = st[1];
    React.useEffect(function(){ var u = fn(set); return function(){ try{ u && u(); }catch(e){} }; }, deps || []);
    return v;
  }
  function docs(snap){ return snap ? snap.docs.map(function(d){ return Object.assign({}, d.data() || {}, { id: d.id }); }) : []; }
  function Modal(props){
    return h('div', { className: 'sm-overlay', onClick: function(e){ if(e.target === e.currentTarget) props.onClose(); } },
      h('div', { className: 'sm-modal', role: 'dialog', 'aria-modal': 'true', style: { maxWidth: props.width || '640px' } },
        h('div', { className: 'sm-modal-head' }, h('h3', null, props.title), h('button', { type: 'button', className: 'sm-modal-close', onClick: props.onClose }, '✕')),
        props.children));
  }
  function Field(label, el, hint){ return h('div', { className: 'sm-field', style: { marginBottom: '10px' } }, h('label', null, label), el, hint ? h('div', { style: { fontSize: '0.76rem', color: 'var(--ink-2)', marginTop: '3px' } }, hint) : null); }
  function Stat(label, val, sub){ return h('div', { style: { flex: '1 1 150px', background: 'var(--surface-2)', borderRadius: '10px', padding: '10px 12px' } },
    h('div', { style: { fontSize: '0.75rem', color: 'var(--ink-2)', fontWeight: 700 } }, label), h('div', { style: { fontSize: '1.4rem', fontWeight: 800 } }, val), sub ? h('div', { style: { fontSize: '0.74rem', color: 'var(--ink-2)' } }, sub) : null); }
  function copy(t){ try{ return navigator.clipboard.writeText(t); }catch(e){ window.prompt('Chép nội dung:', t); return Promise.resolve(); } }

  // =================================================================== 🏆 THI THỬ THÁNG
  function useStudents(){ var s = useSnap(function(set){ return OPC().students.subscribe(set, function(){ set({ docs: [] }); }); }); return s ? docs(s) : null; }
  function MockCreate(props){
    var O = OPC(), students = props.students.filter(function(s){ return s.status !== 'inactive'; });
    var exams = useSnap(function(set){ return O.examBank.subscribe(set, function(){ set({ docs: [] }); }); });
    var tests = useSnap(function(set){ return O.classTests ? O.classTests.subscribe(set, function(){ set({ docs: [] }); }) : null; });
    var d = new Date();
    var fs = React.useState({ title: 'Thi thử tháng ' + (d.getMonth() + 1) + '/' + d.getFullYear(), mode: 'online', examId: '', classTestId: '', openDate: ymd(), closeDate: addDays(7), durationMin: 50, signer: '' });
    var f = fs[0], setF = fs[1];
    var classes = Array.from(new Set(students.map(function(s){ return s.lop || '(chưa có lớp)'; }))).sort();
    var ps = React.useState(function(){ var m = {}; students.forEach(function(s){ m[s.id] = true; }); return m; }); var pick = ps[0], setPick = ps[1];
    var bs = React.useState(''); var busy = bs[0], setBusy = bs[1];
    function set(k, v){ setF(function(p){ var n = Object.assign({}, p); n[k] = v; return n; }); }
    var examList = docs(exams).filter(function(e){ return (e.questions || e.stats) && !e.hidden; }).sort(function(a, b){ return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); });
    var testList = docs(tests).filter(function(t){ return t.kind !== 'review'; });
    var chosen = students.filter(function(s){ return pick[s.id]; });
    async function create(){
      var helpers = window.OPC_ADMIN_HELP;
      if(!f.title.trim()) return props.fireToast('Nhập tên kỳ thi thử.', true);
      if(f.mode === 'online' && !f.examId) return props.fireToast('Chọn đề trong ngân hàng.', true);
      if(f.mode === 'paper' && !f.classTestId) return props.fireToast('Chọn bài kiểm tra giấy.', true);
      if(f.mode === 'online' && !chosen.length) return props.fireToast('Chọn ít nhất 1 em.', true);
      var id = O.mockExams.newId(), assigned = {}, total = 0, examTitle = '';
      try{
        if(f.mode === 'online'){
          setBusy('Đang tải đề…');
          var ex = await O.examBank.getExam(f.examId);
          if(!ex || !(ex.questions || []).length) throw new Error('Đề không có câu hỏi.');
          examTitle = ex.title || '';
          var imgs = []; try{ imgs = await O.examBank.loadExamImages(f.examId, ex.images); }catch(e){ console.warn(e); }
          var qs = ex.questions.map(function(q){ return helpers.toStudentQuestionShape(q, f.examId, ex.title || '', imgs); });
          total = qs.length;
          for(var i = 0; i < chosen.length; i++){
            var st = chosen[i]; setBusy('Đang giao đề ' + (i + 1) + '/' + chosen.length + ' — ' + st.name + '…');
            var seq = 1; try{ seq = (await O.assignedExams.countForStudent(st.id)) + 1; }catch(e){}
            var ref = await O.assignedExams.save(st.id, { title: '🏆 ' + f.title.trim(), seq: seq, sourceType: 'mock', mockId: id, durationMin: Number(f.durationMin) || 50,
              openDate: f.openDate, closeDate: f.closeDate, totalQuestions: qs.length, questions: qs });
            if(ref && ref.id) assigned[st.id] = ref.id;
          }
        } else {
          var t = testList.filter(function(x){ return x.id === f.classTestId; })[0];
          examTitle = t ? t.title : ''; total = t && t.questions ? t.questions.length : 0;
        }
        setBusy('Đang lưu kỳ thi…');
        await O.mockExams.set(id, { title: f.title.trim(), mode: f.mode, examId: f.examId || null, examTitle: examTitle, classTestId: f.classTestId || null,
          openDate: f.openDate, closeDate: f.closeDate, durationMin: Number(f.durationMin) || 50, signer: f.signer.trim(), totalQuestions: total,
          studentIds: f.mode === 'online' ? chosen.map(function(s){ return s.id; }) : [], assigned: assigned, board: [], published: false, createdAt: new Date().toISOString() });
        props.fireToast(f.mode === 'online' ? ('Đã giao "' + f.title + '" cho ' + Object.keys(assigned).length + ' em — các em thấy ngay ở trang luyện tập.') : 'Đã tạo kỳ thi thử từ bài kiểm tra giấy.');
        props.onClose(id);
      }catch(err){ console.error(err); props.fireToast('Không tạo được: ' + (err && (err.message || err.code)), true); setBusy(''); }
    }
    return h(Modal, { title: '🏆 Tạo kỳ thi thử', onClose: function(){ if(!busy) props.onClose(); }, width: '720px' },
      Field('Tên kỳ thi', h('input', { value: f.title, onChange: function(e){ set('title', e.target.value); } })),
      h('div', { style: { display: 'flex', gap: '6px', marginBottom: '10px' } },
        [['online', '💻 Làm online trên FaradayAI'], ['paper', '📝 Thi giấy tại lớp (lấy điểm quét phiếu)']].map(function(x){ return h('button', { key: x[0], type: 'button', className: 'eb-nano-chip' + (f.mode === x[0] ? ' active' : ''), onClick: function(){ set('mode', x[0]); } }, x[1]); })),
      f.mode === 'online' ? h('div', null,
        Field('Đề trong ngân hàng', h('select', { value: f.examId, onChange: function(e){ set('examId', e.target.value); } },
          h('option', { value: '' }, exams ? '— Chọn đề —' : 'Đang tải…'),
          examList.map(function(e){ var n = (e.stats && e.stats.total) || (e.questions || []).length; return h('option', { key: e.id, value: e.id }, (e.title || e.id) + (n ? ' · ' + n + ' câu' : '')); }))),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '10px' } },
          Field('Mở từ ngày', h('input', { type: 'date', value: f.openDate, onChange: function(e){ set('openDate', e.target.value); } })),
          Field('Hạn cuối', h('input', { type: 'date', value: f.closeDate, onChange: function(e){ set('closeDate', e.target.value); } })),
          Field('Thời gian (phút)', h('input', { type: 'number', min: 10, max: 180, value: f.durationMin, onChange: function(e){ set('durationMin', e.target.value); } }))),
        h('div', { className: 'sm-field' }, h('label', null, 'Học sinh làm bài (' + chosen.length + ' em)'),
          h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '4px 0 6px' } },
            h('button', { type: 'button', className: 'eb-nano-chip', onClick: function(){ var m = {}; students.forEach(function(s){ m[s.id] = true; }); setPick(m); } }, 'Tất cả'),
            h('button', { type: 'button', className: 'eb-nano-chip', onClick: function(){ setPick({}); } }, 'Bỏ chọn'),
            classes.map(function(c){ return h('button', { key: c, type: 'button', className: 'eb-nano-chip', onClick: function(){ var m = Object.assign({}, pick), all = students.filter(function(s){ return (s.lop || '(chưa có lớp)') === c; }); var on = all.every(function(s){ return m[s.id]; }); all.forEach(function(s){ m[s.id] = !on; }); setPick(m); } }, 'Lớp ' + c); })),
          h('div', { style: { maxHeight: '180px', overflow: 'auto', border: '1px solid var(--line)', borderRadius: '8px', padding: '6px 10px', columns: '2 220px' } },
            students.map(function(s){ return h('label', { key: s.id, style: { display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.86rem', breakInside: 'avoid', padding: '2px 0' } },
              h('input', { type: 'checkbox', checked: !!pick[s.id], onChange: function(e){ var m = Object.assign({}, pick); m[s.id] = e.target.checked; setPick(m); } }), s.name + (s.lop ? ' · ' + s.lop : '')); })))) :
        Field('Bài kiểm tra giấy (đã quét phiếu ở tab 📋 Kiểm tra lớp)', h('select', { value: f.classTestId, onChange: function(e){ set('classTestId', e.target.value); } },
          h('option', { value: '' }, '— Chọn bài —'), testList.map(function(t){ return h('option', { key: t.id, value: t.id }, t.title + ' · ' + (t.lop || '') + ' · ' + Object.keys(t.results || {}).length + ' em đã chấm'); }))),
      Field('Người ký trên giấy khen', h('input', { value: f.signer, placeholder: 'Vd: Thầy Võ Văn Thái', onChange: function(e){ set('signer', e.target.value); } })),
      h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' } },
        busy ? h('span', { style: { fontSize: '0.85rem', color: 'var(--ink-2)', marginRight: 'auto' } }, busy) : null,
        h('button', { type: 'button', className: 'btn btn-secondary', disabled: !!busy, onClick: function(){ props.onClose(); } }, 'Huỷ'),
        h('button', { type: 'button', className: 'btn btn-primary', disabled: !!busy, onClick: create }, f.mode === 'online' ? 'Giao đề thi thử' : 'Tạo kỳ thi')));
  }

  // tính bảng điểm của 1 kỳ (đọc lượt làm bài của từng em / kết quả bài giấy), so với kỳ trước liền kề
  async function computeBoard(m, allMocks, students){
    var O = OPC(), byId = {}; students.forEach(function(s){ byId[s.id] = s; });
    var rows = [];
    if(m.mode === 'paper'){
      var tSnap = null;
      await new Promise(function(ok){ var u = O.classTests.subscribe(function(s){ tSnap = s; ok(); setTimeout(function(){ try{ u(); }catch(e){} }, 0); }, function(){ ok(); }); });
      var t = docs(tSnap).filter(function(x){ return x.id === m.classTestId; })[0];
      Object.keys((t && t.results) || {}).forEach(function(sid){ var r = t.results[sid]; if(r && r.score != null) rows.push({ sid: sid, score: Number(r.score), at: r.at || '' }); });
    } else {
      var ids = Object.keys(m.assigned || {});
      for(var i = 0; i < ids.length; i++){
        var sid = ids[i], list = [];
        try{ list = await O.attempts.loadForStudent(sid); }catch(e){}
        var a = list.filter(function(x){ return x.assignedExamId === m.assigned[sid] && !x.partial && typeof x.scaledScore10 === 'number'; })
          .sort(function(x, y){ return String(x.createdAt || '').localeCompare(String(y.createdAt || '')); })[0]; // lượt ĐẦU TIÊN mới tính
        if(a) rows.push({ sid: sid, score: a.scaledScore10, at: a.createdAt || '', usedSec: a.timeUsedSec || null });
      }
    }
    // kỳ trước liền kề (đã có bảng điểm) của từng em
    var prevs = allMocks.filter(function(x){ return x.id !== m.id && (x.board || []).length && String(x.openDate || '') < String(m.openDate || ''); })
      .sort(function(a, b){ return String(b.openDate || '').localeCompare(String(a.openDate || '')); });
    rows.forEach(function(r){
      var s = byId[r.sid] || {}; r.name = s.name || r.sid; r.short = shortName(s.name); r.lop = s.lop || '';
      for(var k = 0; k < prevs.length; k++){ var pr = (prevs[k].board || []).filter(function(x){ return x.sid === r.sid; })[0]; if(pr){ r.prev = pr.score; r.prevTitle = prevs[k].title; r.delta = Math.round((r.score - pr.score) * 100) / 100; break; } }
      if(r.delta == null) r.delta = null;
    });
    rows.sort(function(a, b){ return b.score - a.score; });
    rows.forEach(function(r, i){ r.rank = (i > 0 && rows[i - 1].score === r.score) ? rows[i - 1].rank : i + 1; });
    // giấy khen mặc định: top 3 điểm → "top"; top 3 tiến bộ (tăng > 0) → "progress"; còn lại → "complete"
    var old = {}; (m.board || []).forEach(function(r){ old[r.sid] = r; });
    var prog = rows.filter(function(r){ return r.delta != null && r.delta > 0; }).sort(function(a, b){ return b.delta - a.delta; }).slice(0, 3).map(function(r){ return r.sid; });
    rows.forEach(function(r){
      r.award = (old[r.sid] && old[r.sid].awardManual) ? old[r.sid].award : (prog.indexOf(r.sid) > -1 ? 'progress' : (r.rank <= 3 ? 'top' : 'complete'));
      if(old[r.sid] && old[r.sid].awardManual) r.awardManual = true;
      if(old[r.sid] && old[r.sid].note) r.note = old[r.sid].note;
    });
    return rows.map(function(r){ var o = {}; Object.keys(r).forEach(function(k){ if(r[k] !== undefined) o[k] = r[k]; }); return o; });
  }

  function MockDetail(props){
    var O = OPC(), m = props.mock, fire = props.fireToast;
    var bs = React.useState(false); var busy = bs[0], setBusy = bs[1];
    var board = m.board || [];
    var assignedN = Object.keys(m.assigned || {}).length;
    async function refresh(){
      setBusy(true);
      try{ var rows = await computeBoard(m, props.mocks, props.students); await O.mockExams.update(m.id, { board: rows, boardAt: new Date().toISOString() }); fire('Đã cập nhật bảng điểm: ' + rows.length + ' em có kết quả.'); }
      catch(e){ console.error(e); fire('Không tổng hợp được: ' + (e && e.message), true); }
      setBusy(false);
    }
    function setAward(sid, award){ var nb = board.map(function(r){ return r.sid === sid ? Object.assign({}, r, { award: award, awardManual: true }) : r; }); O.mockExams.update(m.id, { board: nb }); }
    function setNote(sid){ var r = board.filter(function(x){ return x.sid === sid; })[0]; var t = window.prompt('Lời khen ngắn in trên giấy khen của ' + r.name + ':', r.note || ''); if(t == null) return; var nb = board.map(function(x){ return x.sid === sid ? Object.assign({}, x, { note: t.slice(0, 120) }) : x; }); O.mockExams.update(m.id, { board: nb }); }
    function cert(r){
      return window.OPC_FX.downloadCertificate({ name: r.name, award: r.award, examTitle: m.title, score: r.score, delta: r.delta, rank: r.rank, of: board.length, date: new Date().toLocaleDateString('vi-VN'), signer: m.signer || '', note: r.note || '', code: m.id.slice(0, 4).toUpperCase() + '-' + r.sid.slice(0, 4).toUpperCase() });
    }
    async function certAll(){ var list = board.filter(function(r){ return r.award !== 'complete'; }); for(var i = 0; i < list.length; i++){ await cert(list[i]); await new Promise(function(ok){ setTimeout(ok, 600); }); } }
    function honorText(){
      var top = board.slice(0, 3), prog = board.filter(function(r){ return r.award === 'progress'; });
      var avg = board.length ? board.reduce(function(s, r){ return s + r.score; }, 0) / board.length : 0;
      var lines = ['🏆 KẾT QUẢ ' + m.title.toUpperCase(), board.length + ' em tham gia · điểm trung bình ' + fmt2(avg), ''];
      if(top.length){ lines.push('⭐ Điểm cao nhất:'); top.forEach(function(r){ lines.push('  ' + r.rank + '. ' + r.name + ' — ' + fmt2(r.score) + ' điểm'); }); lines.push(''); }
      if(prog.length){ lines.push('🚀 Tiến bộ vượt bậc:'); prog.forEach(function(r){ lines.push('  • ' + r.name + ': +' + fmt2(r.delta) + ' điểm (' + fmt2(r.prev) + ' → ' + fmt2(r.score) + ')'); }); lines.push(''); }
      lines.push('Chúc mừng các em! Xem điểm, hạng và tải giấy khen tại faradayai.vn 💪');
      return lines.join('\n');
    }
    var avg = board.length ? board.reduce(function(s, r){ return s + r.score; }, 0) / board.length : null;
    var withDelta = board.filter(function(r){ return r.delta != null; });
    var avgDelta = withDelta.length ? withDelta.reduce(function(s, r){ return s + r.delta; }, 0) / withDelta.length : null;
    var AW = { progress: '🚀 Tiến bộ', top: '⭐ Giấy khen', complete: '✓ Chứng nhận' };
    return h('div', null,
      h('div', { className: 'card' },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center' } },
          h('div', null, h('button', { type: 'button', className: 'sm-link-btn', onClick: props.onBack }, '← Tất cả kỳ thi thử'),
            h('h3', { style: { margin: '6px 0 2px' } }, '🏆 ' + m.title),
            h('p', { className: 'sm-sub', style: { margin: 0 } }, (m.mode === 'paper' ? 'Thi giấy · ' : 'Online · ' + (m.durationMin || 50) + ' phút · ') + (m.examTitle || '') + (m.openDate ? ' · ' + vnDate(m.openDate) + ' → ' + vnDate(m.closeDate) : ''))),
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            h('button', { type: 'button', className: 'btn btn-secondary', disabled: busy, onClick: refresh }, busy ? 'Đang tổng hợp…' : '📊 Cập nhật kết quả'),
            h('button', { type: 'button', className: m.published ? 'btn btn-secondary' : 'btn btn-primary', disabled: !board.length, onClick: function(){ O.mockExams.update(m.id, { published: !m.published }).then(function(){ fire(m.published ? 'Đã ẩn bảng xếp hạng với học sinh.' : 'Đã công bố — học sinh thấy điểm, hạng và tải được giấy khen.'); }); } }, m.published ? '🙈 Ẩn khỏi học sinh' : '📣 Công bố cho học sinh'),
            h('button', { type: 'button', className: 'btn btn-secondary', disabled: !board.length, onClick: function(){ copy(honorText()).then(function(){ fire('Đã chép tin vinh danh — dán vào nhóm Zalo lớp/phụ huynh.'); }); } }, '📋 Chép tin vinh danh'),
            h('button', { type: 'button', className: 'btn btn-secondary', disabled: !board.length, onClick: certAll }, '🎖 Tải giấy khen (khen + tiến bộ)'))),
        h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' } },
          Stat('Đã làm', board.length + (m.mode === 'online' ? '/' + assignedN : '') + ' em', m.mode === 'online' && assignedN ? Math.round(board.length / assignedN * 100) + '% số em được giao' : ''),
          Stat('Điểm trung bình', fmt2(avg)),
          Stat('Tiến bộ trung bình', avgDelta == null ? '—' : (avgDelta >= 0 ? '+' : '') + fmt2(avgDelta), withDelta.length + ' em có kỳ trước để so'),
          Stat('Trạng thái', m.published ? 'Đã công bố' : 'Chưa công bố', m.boardAt ? 'cập nhật ' + new Date(m.boardAt).toLocaleString('vi-VN') : 'bấm "Cập nhật kết quả"'))),
      h('div', { className: 'card' },
        !board.length ? h('p', { style: { color: 'var(--ink-2)' } }, 'Chưa có kết quả. Khi các em làm xong, bấm "📊 Cập nhật kết quả".') :
        h('div', { className: 'sm-table-wrap', style: { marginTop: 0 } }, h('table', { className: 'sm-table' },
          h('thead', null, h('tr', null, ['Hạng', 'Học sinh', 'Điểm', 'Kỳ trước', 'Tiến bộ', 'Giấy khen', ''].map(function(t){ return h('th', { key: t }, t); }))),
          h('tbody', null, board.map(function(r){
            return h('tr', { key: r.sid },
              h('td', null, h('b', null, r.rank)),
              h('td', null, h('b', null, r.name), r.lop ? h('div', { style: { fontSize: '0.74rem', color: 'var(--muted)' } }, 'Lớp ' + r.lop) : null),
              h('td', null, h('b', null, fmt2(r.score))),
              h('td', null, r.prev != null ? fmt2(r.prev) : '—'),
              h('td', { style: { fontWeight: 800, color: r.delta > 0 ? 'var(--good)' : (r.delta < 0 ? 'var(--critical)' : 'inherit') } }, r.delta == null ? 'Lần đầu' : (r.delta > 0 ? '+' : '') + fmt2(r.delta)),
              h('td', null, h('select', { value: r.award || 'complete', onChange: function(e){ setAward(r.sid, e.target.value); } }, Object.keys(AW).map(function(k){ return h('option', { key: k, value: k }, AW[k]); }))),
              h('td', { style: { whiteSpace: 'nowrap' } },
                h('button', { type: 'button', className: 'btn btn-secondary', style: { fontSize: '0.75rem', padding: '4px 9px' }, onClick: function(){ cert(r); } }, '🎖 Tải'), ' ',
                h('button', { type: 'button', className: 'btn btn-secondary', style: { fontSize: '0.75rem', padding: '4px 9px' }, title: 'Lời khen in trên giấy khen', onClick: function(){ setNote(r.sid); } }, r.note ? '✎ Lời khen' : '＋ Lời khen')));
          })))),
        board.length ? h('p', { style: { fontSize: '0.78rem', color: 'var(--ink-2)', marginTop: '8px' } }, 'Tiến bộ = điểm kỳ này − điểm kỳ thi thử gần nhất trước đó của chính em. Mặc định: 3 em tiến bộ nhiều nhất nhận "Giấy khen tiến bộ", 3 em điểm cao nhất nhận "Giấy khen", còn lại "Giấy chứng nhận" — thầy đổi được ở cột Giấy khen. Học sinh chỉ thấy tên rút gọn của bạn.') : null),
      h('div', { style: { textAlign: 'right' } },
        h('button', { type: 'button', className: 'sm-link-btn', style: { color: 'var(--critical)' }, onClick: function(){ if(window.confirm('Xoá kỳ thi thử "' + m.title + '"? (Đề đã giao cho học sinh và bài làm KHÔNG bị xoá.)')) O.mockExams.remove(m.id).then(props.onBack); } }, 'Xoá kỳ thi thử')));
  }

  function MockPanel(props){
    var O = OPC();
    var snap = useSnap(function(set){ return O.mockExams.subscribe(set, function(e){ console.error(e); set({ docs: [] }); }); });
    var students = useStudents();
    var cs = React.useState(false); var creating = cs[0], setCreating = cs[1];
    var ss = React.useState(null); var selId = ss[0], setSelId = ss[1];
    if(!snap || !students) return h('div', { className: 'card' }, h('p', { style: { color: 'var(--ink-2)' } }, 'Đang tải…'));
    var mocks = docs(snap).sort(function(a, b){ return String(b.openDate || b.createdAt || '').localeCompare(String(a.openDate || a.createdAt || '')); });
    var sel = mocks.filter(function(x){ return x.id === selId; })[0];
    if(sel) return h(MockDetail, { mock: sel, mocks: mocks, students: students, fireToast: props.fireToast, onBack: function(){ setSelId(null); } });
    // xu hướng điểm TB qua các kỳ
    var withBoard = mocks.filter(function(x){ return (x.board || []).length; }).slice().reverse();
    var t = ymd();
    return h('div', null,
      h('div', { className: 'card' },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center' } },
          h('div', null, h('h3', { style: { margin: 0 } }, '🏆 Thi thử định kỳ & bảng tiến bộ'),
            h('p', { className: 'sm-sub', style: { margin: '4px 0 0' } }, 'Mỗi tháng 1 đề chung → so điểm với kỳ trước của chính em → vinh danh em tiến bộ nhất, giấy khen có logo FaradayAI để các em chia sẻ. Vừa tạo động lực, vừa là bằng chứng hiệu quả cho phụ huynh.')),
          h('button', { type: 'button', className: 'btn btn-primary', onClick: function(){ setCreating(true); } }, '＋ Tạo kỳ thi thử')),
        withBoard.length >= 2 ? h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px', alignItems: 'flex-end' } },
          withBoard.map(function(x){ var b = x.board, a = b.reduce(function(s, r){ return s + r.score; }, 0) / b.length;
            return h('div', { key: x.id, style: { textAlign: 'center', fontSize: '0.75rem', color: 'var(--ink-2)' } },
              h('div', { style: { height: Math.max(8, a * 12) + 'px', width: '46px', background: 'var(--accent)', borderRadius: '6px 6px 0 0', margin: '0 auto' } }),
              h('b', { style: { display: 'block', color: 'var(--ink)' } }, fmt2(a)), x.title.replace(/^Thi thử\s*/i, '')); }),
          h('span', { style: { fontSize: '0.8rem', color: 'var(--ink-2)', marginLeft: '6px' } }, '← điểm trung bình các kỳ')) : null),
      h('div', { className: 'card' },
        !mocks.length ? h('p', { style: { color: 'var(--ink-2)' } }, 'Chưa có kỳ thi thử nào. Bấm "＋ Tạo kỳ thi thử" để giao đề tháng này.') :
        h('div', { className: 'sm-table-wrap', style: { marginTop: 0 } }, h('table', { className: 'sm-table' },
          h('thead', null, h('tr', null, ['Kỳ thi', 'Hình thức', 'Thời gian', 'Đã làm', 'Điểm TB', 'Trạng thái', ''].map(function(x){ return h('th', { key: x }, x); }))),
          h('tbody', null, mocks.map(function(x){
            var b = x.board || [], a = b.length ? b.reduce(function(s, r){ return s + r.score; }, 0) / b.length : null;
            var state = x.published ? '📣 Đã công bố' : (x.openDate && x.openDate > t ? '⏳ Sắp mở' : (x.closeDate && x.closeDate < t ? '⌛ Hết hạn' : '🟢 Đang mở'));
            return h('tr', { key: x.id },
              h('td', null, h('b', null, x.title), h('div', { style: { fontSize: '0.74rem', color: 'var(--muted)' } }, x.examTitle || '')),
              h('td', null, x.mode === 'paper' ? '📝 Giấy' : '💻 Online'),
              h('td', null, x.mode === 'paper' ? '—' : vnDate(x.openDate) + ' → ' + vnDate(x.closeDate)),
              h('td', null, b.length + (x.mode === 'online' ? '/' + Object.keys(x.assigned || {}).length : '')),
              h('td', null, fmt2(a)), h('td', null, state),
              h('td', null, h('button', { type: 'button', className: 'btn btn-secondary', style: { fontSize: '0.78rem', padding: '4px 10px' }, onClick: function(){ setSelId(x.id); } }, 'Mở')));
          }))))),
      creating ? h(MockCreate, { students: students, fireToast: props.fireToast, onClose: function(id){ setCreating(false); if(id) setSelId(id); } }) : null);
  }

  // =================================================================== 📺 VIDEO BÀI GIẢNG
  var SCRIPT_HELP = '# Tiêu đề cảnh  ·  - Ý chính (có $công thức$)  ·  $$ công thức lớn $$  ·  ! Lưu ý  ·  ? Câu hỏi nhanh  ·  [ảnh: link]  ·  > Lời giảng đọc cho dòng ngay trên';
  function LessonEdit(props){
    var NANO = window.OPC_NANO, l0 = props.lesson || {};
    var fs = React.useState(Object.assign({ kind: 'faraday', title: '', chuDeKey: '', baiKey: '', nanoIds: [], script: '# Tiêu đề cảnh\n> Lời mở đầu…\n- Ý thứ nhất\n$$ công thức $$\n> Lời giảng cho công thức\n! Lưu ý hay sai', url: '', start: '', end: '', note: '', level: 'co-ban', published: true, order: 0 }, l0));
    var f = fs[0], setF = fs[1];
    var bs = React.useState(''); var busy = bs[0], setBusy = bs[1];
    function set(k, v){ setF(function(p){ var n = Object.assign({}, p); n[k] = v; return n; }); }
    var bais = NANO ? (f.chuDeKey ? NANO.getBaiByChuDe(f.chuDeKey) : NANO.BAI) : [];
    var nanos = NANO && f.baiKey ? NANO.getNanoByBai(f.baiKey) : [];
    function save(){
      if(!f.title.trim()) return props.fireToast('Nhập tên bài giảng.', true);
      var data = { kind: f.kind, title: f.title.trim(), chuDeKey: f.chuDeKey || (f.baiKey && NANO && NANO.getBai(f.baiKey) ? NANO.getBai(f.baiKey).chuDeKey : ''), baiKey: f.baiKey || '', nanoIds: f.nanoIds || [],
        note: (f.note || '').trim(), level: f.level || 'co-ban', published: f.published !== false, order: Number(f.order) || 0, createdAt: l0.createdAt || new Date().toISOString() };
      if(f.seedKey) data.seedKey = f.seedKey;
      if(l0.audio) data.audio = l0.audio; // giữ giọng đã tạo (câu nào sửa lời thì tự quay về giọng máy cho câu đó)
      if(l0.author) data.author = l0.author;
      if(f.kind === 'youtube'){
        var vid = window.OPC_FX.youtubeId(f.url); if(!vid) return props.fireToast('Link YouTube chưa đúng.', true);
        Object.assign(data, { url: f.url.trim(), youtubeId: vid, start: f.start || '', end: f.end || '' });
      } else data.script = f.script || '';
      setBusy('Đang lưu…');
      OPC().lessons.save(l0.id || null, data).then(function(){ props.fireToast('Đã lưu "' + data.title + '".'); props.onClose(); }).catch(function(e){ setBusy(''); props.fireToast('Không lưu được: ' + (e && e.message), true); });
    }
    function aiDraft(){
      var bai = NANO && f.baiKey ? NANO.getBai(f.baiKey) : null;
      if(!bai && !f.title.trim()) return props.fireToast('Chọn bài hoặc nhập tên bài giảng trước.', true);
      setBusy('AI đang soạn kịch bản…');
      fetch('/api/ai-lesson', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: f.title, baiName: bai ? bai.name : '', nanoNames: (f.nanoIds || []).map(function(id){ var n = NANO.getNano(id); return n ? n.name : id; }), level: f.level, note: f.note }) })
        .then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error(j.error || 'Lỗi'); return j; }); })
        .then(function(j){ set('script', j.script || ''); if(!f.title.trim() && j.title) set('title', j.title); setBusy(''); props.fireToast('AI đã soạn nháp — thầy xem lại, sửa rồi Lưu.'); })
        .catch(function(e){ setBusy(''); props.fireToast('AI chưa soạn được: ' + e.message, true); });
    }
    var preview = Object.assign({}, f, { youtubeId: f.kind === 'youtube' ? window.OPC_FX.youtubeId(f.url) : null });
    return h(Modal, { title: (l0.id ? 'Sửa' : 'Thêm') + (f.kind === 'youtube' ? ' video YouTube' : ' bài giảng FaradayAI'), onClose: function(){ if(!busy) props.onClose(); }, width: '820px' },
      h('div', { style: { display: 'flex', gap: '6px', marginBottom: '10px' } },
        [['faraday', '🎓 Bài giảng FaradayAI (kịch bản)'], ['youtube', '🎬 Video YouTube ứng dụng thực tế']].map(function(x){ return h('button', { key: x[0], type: 'button', className: 'eb-nano-chip' + (f.kind === x[0] ? ' active' : ''), onClick: function(){ set('kind', x[0]); } }, x[1]); })),
      Field('Tên bài giảng / video', h('input', { value: f.title, onChange: function(e){ set('title', e.target.value); }, placeholder: f.kind === 'youtube' ? 'Vd: Máy biến áp trong trạm điện thật' : 'Vd: Phương trình trạng thái khí lí tưởng' })),
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '10px' } },
        Field('Chương / chuyên đề', h('select', { value: f.chuDeKey, onChange: function(e){ set('chuDeKey', e.target.value); set('baiKey', ''); set('nanoIds', []); } },
          h('option', { value: '' }, '— Chọn —'), (NANO ? NANO.CHU_DE : []).map(function(c){ return h('option', { key: c.key, value: c.key }, c.icon + ' ' + c.name); }))),
        Field('Bài', h('select', { value: f.baiKey, onChange: function(e){ set('baiKey', e.target.value); set('nanoIds', []); if(!f.chuDeKey && NANO && NANO.getBai(e.target.value)) set('chuDeKey', NANO.getBai(e.target.value).chuDeKey); } },
          h('option', { value: '' }, '— Chọn bài —'), bais.map(function(b){ return h('option', { key: b.key, value: b.key }, b.name); }))),
        Field('Mức', h('select', { value: f.level, onChange: function(e){ set('level', e.target.value); } }, h('option', { value: 'co-ban' }, 'Cơ bản'), h('option', { value: 'nang-cao' }, 'Nâng cao')))),
      nanos.length ? Field('Gắn nano-point (học sinh sai câu thuộc nano này sẽ thấy video trước tiên)', h('div', { style: { display: 'flex', gap: '5px', flexWrap: 'wrap' } },
        nanos.map(function(n){ var on = (f.nanoIds || []).indexOf(n.id) > -1; return h('button', { key: n.id, type: 'button', className: 'eb-nano-chip' + (on ? ' active' : ''), onClick: function(){ set('nanoIds', on ? f.nanoIds.filter(function(x){ return x !== n.id; }) : (f.nanoIds || []).concat([n.id])); } }, n.id + ' · ' + n.name); }))) : null,
      f.kind === 'youtube' ? h('div', null,
        Field('Link YouTube', h('input', { value: f.url, onChange: function(e){ set('url', e.target.value); }, placeholder: 'https://youtu.be/…' })),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '10px' } },
          Field('Bắt đầu từ (phút:giây)', h('input', { value: f.start, onChange: function(e){ set('start', e.target.value); }, placeholder: '1:20' })),
          Field('Dừng ở (phút:giây)', h('input', { value: f.end, onChange: function(e){ set('end', e.target.value); }, placeholder: '4:05' })))) :
        Field('Kịch bản bài giảng', h('textarea', { rows: 14, value: f.script, onChange: function(e){ set('script', e.target.value); }, style: { width: '100%', boxSizing: 'border-box', fontFamily: '"IBM Plex Mono",monospace', fontSize: '0.84rem', lineHeight: 1.55, padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)' } }),
          SCRIPT_HELP + ' · Ước tính ' + window.OPC_FX.fmtTime(window.OPC_FX.estimateSec(f.script)) + '.'),
      Field('Ghi chú hiện dưới video (không bắt buộc)', h('input', { value: f.note, onChange: function(e){ set('note', e.target.value); }, placeholder: 'Vd: Chú ý đoạn 2:10 — vì sao dây điện cao thế treo trên sứ cách điện' })),
      h('label', { style: { display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.86rem', margin: '4px 0 10px' } }, h('input', { type: 'checkbox', checked: f.published !== false, onChange: function(e){ set('published', e.target.checked); } }), 'Hiện cho học sinh'),
      h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' } },
        busy ? h('span', { style: { fontSize: '0.85rem', color: 'var(--ink-2)', marginRight: 'auto' } }, busy) : null,
        f.kind === 'faraday' ? h('button', { type: 'button', className: 'btn btn-secondary', disabled: !!busy, onClick: aiDraft, title: 'Gọi AI (Gemini của FaradayAI) soạn nháp theo bài/nano đã chọn' }, '✨ AI soạn nháp') : null,
        h('button', { type: 'button', className: 'btn btn-secondary', onClick: function(){ window.OPC_FX.openLesson(preview); } }, '▶ Xem thử'),
        h('button', { type: 'button', className: 'btn btn-secondary', disabled: !!busy, onClick: props.onClose }, 'Huỷ'),
        h('button', { type: 'button', className: 'btn btn-primary', disabled: !!busy, onClick: save }, 'Lưu')));
  }


  // =================================================================== 🎙 GIỌNG ĐỌC (THÊM 24/10/2026)
  // Giọng AI tự nhiên (Gemini TTS qua /api/ai-voice) hoặc GIỌNG THẦY thu bằng micro — tạo 1 lần, nén MP3, lưu kèm bài
  // (video_lessons/{id}/audio/s<i>); học sinh nghe bản đã lưu. Câu nào chưa có / đã sửa lời → trình phát dùng giọng máy.
  var VOICE_LIST = [
    ['Charon', 'Nam · trầm ấm, rõ ràng (khuyên dùng)'], ['Orus', 'Nam · chững chạc'], ['Iapetus', 'Nam · rõ, trong'], ['Algieba', 'Nam · êm'],
    ['Achird', 'Nam · thân thiện'], ['Puck', 'Nam · vui, năng động'], ['Fenrir', 'Nam · hào hứng'], ['Sadaltager', 'Nam · am hiểu'],
    ['Kore', 'Nữ · chắc chắn, rõ ràng'], ['Sulafat', 'Nữ · ấm áp'], ['Aoede', 'Nữ · nhẹ nhàng'], ['Leda', 'Nữ · trẻ trung'],
    ['Despina', 'Nữ · mượt'], ['Vindemiatrix', 'Nữ · dịu dàng'], ['Achernar', 'Nữ · mềm mại'], ['Zephyr', 'Nữ · tươi sáng']
  ];
  function voicePref(){ try{ return Object.assign({ voice: 'Charon', accent: 'nam', style: '' }, JSON.parse(localStorage.getItem('fx-voice-pref') || '{}')); }catch(e){ return { voice: 'Charon', accent: 'nam', style: '' }; } }
  function saveVoicePref(p){ try{ localStorage.setItem('fx-voice-pref', JSON.stringify(p)); }catch(e){} }
  var lameP = null;
  function loadLame(){
    if(window.lamejs) return Promise.resolve(window.lamejs);
    if(!lameP) lameP = new Promise(function(ok, no){ var sc = document.createElement('script'); sc.src = '/lame.min.js'; sc.onload = function(){ window.lamejs ? ok(window.lamejs) : no(new Error('Không nạp được bộ nén MP3')); }; sc.onerror = function(){ lameP = null; no(new Error('Không tải được /lame.min.js (đã upload file này chưa?)')); }; document.head.appendChild(sc); });
    return lameP;
  }
  function b64ToBytes(b64){ var bin = atob(b64), u = new Uint8Array(bin.length); for(var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  function bytesToB64(u8){ var s2 = '', CH = 0x8000; for(var i = 0; i < u8.length; i += CH) s2 += String.fromCharCode.apply(null, u8.subarray(i, i + CH)); return btoa(s2); }
  // Int16 (mono) → MP3 base64 · cắt bớt im lặng 2 đầu (giọng AI hay có khoảng lặng dài)
  function trimSilence(pcm, rate){
    var thr = 450, a = 0, b = pcm.length - 1, keep = Math.round(rate * 0.12);
    while(a < pcm.length && Math.abs(pcm[a]) < thr) a++;
    while(b > a && Math.abs(pcm[b]) < thr) b--;
    return pcm.subarray(Math.max(0, a - keep), Math.min(pcm.length, b + keep));
  }
  async function encodeMp3(pcm, rate){
    var lame = await loadLame();
    var enc = new lame.Mp3Encoder(1, rate, rate >= 32000 ? 64 : 48), out = [], BL = 1152;
    for(var i = 0; i < pcm.length; i += BL){ var buf = enc.encodeBuffer(pcm.subarray(i, i + BL)); if(buf.length) out.push(new Uint8Array(buf)); }
    var end = enc.flush(); if(end.length) out.push(new Uint8Array(end));
    var n = out.reduce(function(s2, x){ return s2 + x.length; }, 0), all = new Uint8Array(n), o = 0;
    out.forEach(function(x){ all.set(x, o); o += x.length; });
    return { b64: bytesToB64(all), dur: Math.round(pcm.length / rate * 100) / 100, bytes: n };
  }
  function pcmFromB64(b64){ var u = b64ToBytes(b64); return new Int16Array(u.buffer, u.byteOffset, Math.floor(u.byteLength / 2)); }
  function floatToInt16(f32){ var o = new Int16Array(f32.length); for(var i = 0; i < f32.length; i++){ var v = Math.max(-1, Math.min(1, f32[i])); o[i] = v < 0 ? v * 0x8000 : v * 0x7fff; } return o; }
  async function ttsClip(text, pref){
    var r = await fetch('/api/ai-voice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text, voice: pref.voice, accent: pref.accent, style: pref.style }) });
    var j = await r.json().catch(function(){ return {}; });
    if(!r.ok) throw new Error(j.error || ('Lỗi ' + r.status));
    var pcm = trimSilence(pcmFromB64(j.audio), j.rate || 24000);
    var mp3 = await encodeMp3(pcm, j.rate || 24000);
    return { b64: mp3.b64, mime: 'audio/mpeg', dur: mp3.dur, text: text, source: 'ai', voice: j.voice, model: j.model || '' };
  }
  // tạo giọng AI cho các câu còn thiếu (hoặc tất cả) của 1 bài
  async function generateLessonVoice(lesson, pref, opts){
    var O = OPC(), says = window.OPC_FX.stepSays(lesson), have = opts && opts.existing ? opts.existing : await O.lessons.loadAudio(lesson.id);
    var todo = [];
    says.forEach(function(t, i){
      if(!window.OPC_FX.normSay(t)) return;
      var c = have[i];
      if(opts && opts.all && !(c && c.source === 'teacher' && window.OPC_FX.normSay(c.text) === window.OPC_FX.normSay(t))) { todo.push(i); return; }
      if(!c || window.OPC_FX.normSay(c.text) !== window.OPC_FX.normSay(t)) todo.push(i);
    });
    for(var k = 0; k < todo.length; k++){
      if(opts && opts.cancelled && opts.cancelled()) break;
      var i = todo[k];
      if(opts && opts.onProgress) opts.onProgress(k, todo.length, says[i]);
      var clip = null, tries = 0;
      while(!clip){
        try{ clip = await ttsClip(says[i], pref); }
        catch(e){ tries++; var lim = /giới hạn/.test(e.message); if((lim ? tries >= 10 : tries >= 3) || /GEMINI_API_KEY|không hỗ trợ|404/.test(e.message)) throw e; if(lim && opts && opts.onProgress) opts.onProgress(k, todo.length, '(chờ giới hạn của Google… lần ' + tries + ')'); await new Promise(function(ok){ setTimeout(ok, lim ? 30000 : 2500); }); }
      }
      await O.lessons.saveAudio(lesson.id, i, clip);
      have[i] = clip;
    }
    var nAi = 0, nT = 0; Object.keys(have).forEach(function(k2){ if(have[k2].source === 'teacher') nT++; else nAi++; });
    var audio = { source: nT && nAi ? 'mixed' : (nT ? 'teacher' : 'ai'), voice: pref.voice, accent: pref.accent, n: nAi + nT, at: new Date().toISOString() };
    await O.lessons.patch(lesson.id, { audio: audio });
    if(window.OPC_FX.clearAudioCache) window.OPC_FX.clearAudioCache();
    return { done: todo.length, audio: audio, map: have };
  }

  function VoiceStudio(props){
    var O = OPC(), L = props.lesson, fire = props.fireToast;
    var says = React.useMemo(function(){ return window.OPC_FX.stepSays(L); }, [L.id, L.script]);
    var ms = React.useState(null); var map = ms[0], setMap = ms[1];
    var ps = React.useState(voicePref); var pref = ps[0], setPref = ps[1];
    var ts = React.useState('ai'); var tab = ts[0], setTab = ts[1];
    var bs = React.useState(''); var busy = bs[0], setBusy = bs[1];
    var rs = React.useState(null); var rec = rs[0], setRec = rs[1];   // { i, mr, chunks, t0 }
    var cancelRef = React.useRef(false), playRef = React.useRef(null);
    React.useEffect(function(){ O.lessons.loadAudio(L.id).then(setMap).catch(function(){ setMap({}); }); return function(){ cancelRef.current = true; try{ playRef.current && playRef.current.pause(); }catch(e){} }; }, [L.id]);
    function setP(k, v){ var n = Object.assign({}, pref); n[k] = v; setPref(n); saveVoicePref(n); }
    if(!map) return h(Modal, { title: '🎙 Giọng đọc — ' + L.title, onClose: props.onClose }, h('p', null, 'Đang tải…'));
    var norm = window.OPC_FX.normSay;
    var idxs = says.map(function(t, i){ return i; }).filter(function(i){ return norm(says[i]); });
    function st(i){ var c = map[i]; if(!c) return 'none'; return norm(c.text) === norm(says[i]) ? c.source : 'stale'; }
    var cnt = { ai: 0, teacher: 0, stale: 0, none: 0 }; idxs.forEach(function(i){ cnt[st(i)]++; });
    var totalDur = idxs.reduce(function(s2, i){ var c = map[i]; return s2 + (c && st(i) !== 'stale' ? c.dur || 0 : 0); }, 0);
    function play(b64, mime){ try{ var a = playRef.current || (playRef.current = new Audio()); a.pause(); a.src = 'data:' + (mime || 'audio/mpeg') + ';base64,' + b64; a.play(); }catch(e){} }
    async function sample(){
      setBusy('Đang tạo câu nghe thử…');
      try{ var c = await ttsClip(says[idxs[1] != null ? idxs[1] : idxs[0]], pref); play(c.b64, c.mime); setBusy(''); }
      catch(e){ setBusy(''); fire('Chưa tạo được giọng: ' + e.message, true); }
    }
    async function genAll(all){
      cancelRef.current = false;
      setBusy('Bắt đầu…');
      try{
        var r = await generateLessonVoice(L, pref, { all: all, existing: Object.assign({}, map), cancelled: function(){ return cancelRef.current; },
          onProgress: function(k, n, t){ setBusy('Đang tạo giọng câu ' + (k + 1) + '/' + n + ': “' + String(t).slice(0, 60) + '…”'); } });
        setMap(Object.assign({}, r.map)); setBusy('');
        fire(r.done ? 'Đã tạo giọng AI cho ' + r.done + ' câu — bấm "▶ Xem bài giảng" để nghe.' : 'Tất cả câu đã có giọng.');
      }catch(e){ setBusy(''); fire('Dừng lại: ' + e.message, true); O.lessons.loadAudio(L.id).then(setMap); }
    }
    async function startRec(i){
      if(rec) return;
      try{
        var stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        var mr = new MediaRecorder(stream), chunks = [];
        mr.ondataavailable = function(e){ if(e.data && e.data.size) chunks.push(e.data); };
        mr.onstop = async function(){
          stream.getTracks().forEach(function(t){ t.stop(); });
          setBusy('Đang nén MP3…');
          try{
            var blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
            var ac = new (window.AudioContext || window.webkitAudioContext)();
            var buf = await ac.decodeAudioData(await blob.arrayBuffer());
            var rate = buf.sampleRate, ch = buf.getChannelData(0);
            var pcm = trimSilence(floatToInt16(ch), rate);
            var mp3 = await encodeMp3(pcm, rate);
            try{ ac.close(); }catch(e){}
            var clip = { b64: mp3.b64, mime: 'audio/mpeg', dur: mp3.dur, text: says[i], source: 'teacher' };
            await O.lessons.saveAudio(L.id, i, clip);
            var nm = Object.assign({}, map); nm[i] = clip; setMap(nm);
            var nAi = 0, nT = 0; Object.keys(nm).forEach(function(k){ if(nm[k].source === 'teacher') nT++; else nAi++; });
            await O.lessons.patch(L.id, { audio: { source: nT && nAi ? 'mixed' : (nT ? 'teacher' : 'ai'), voice: pref.voice, accent: pref.accent, n: nAi + nT, at: new Date().toISOString() } });
            if(window.OPC_FX.clearAudioCache) window.OPC_FX.clearAudioCache();
            setBusy(''); play(clip.b64);
          }catch(e){ setBusy(''); fire('Không lưu được bản thu: ' + e.message, true); }
        };
        mr.start(); setRec({ i: i, mr: mr, t0: Date.now() });
      }catch(e){ fire('Không mở được micro: ' + (e && e.message) + ' (cho phép trình duyệt dùng micro).', true); }
    }
    function stopRec(){ if(rec){ try{ rec.mr.stop(); }catch(e){} setRec(null); } }
    async function removeClip(i){ await O.lessons.removeAudio(L.id, i); var nm = Object.assign({}, map); delete nm[i]; setMap(nm); if(window.OPC_FX.clearAudioCache) window.OPC_FX.clearAudioCache(); }
    var BADGE = { ai: ['🎙 AI', 'var(--good)'], teacher: ['🎤 Thầy', 'var(--accent)'], stale: ['⚠ lời đã sửa', 'var(--warning)'], none: ['— giọng máy', 'var(--muted)'] };
    function preview(){ window.OPC_FX.openLesson(Object.assign({}, L, { audio: L.audio || { at: 'x' } }), { audioMap: map }); }
    return h(Modal, { title: '🎙 Giọng đọc — ' + L.title, onClose: function(){ if(!busy && !rec) props.onClose(); }, width: '860px' },
      h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' } },
        Stat('Câu có lời đọc', idxs.length), Stat('Giọng AI', cnt.ai), Stat('Giọng thầy', cnt.teacher), Stat('Còn giọng máy', cnt.none + cnt.stale, cnt.stale ? cnt.stale + ' câu đã sửa lời' : ''), Stat('Thời lượng', window.OPC_FX.fmtTime(totalDur))),
      h('div', { style: { display: 'flex', gap: '6px', marginBottom: '10px' } },
        [['ai', '🎙 Giọng AI tự nhiên'], ['teacher', '🎤 Thầy tự thu giọng']].map(function(x){ return h('button', { key: x[0], type: 'button', className: 'eb-nano-chip' + (tab === x[0] ? ' active' : ''), onClick: function(){ setTab(x[0]); } }, x[1]); })),
      tab === 'ai' ? h('div', null,
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '10px' } },
          Field('Giọng', h('select', { value: pref.voice, onChange: function(e){ setP('voice', e.target.value); } }, VOICE_LIST.map(function(v){ return h('option', { key: v[0], value: v[0] }, v[0] + ' — ' + v[1]); }))),
          Field('Vùng miền', h('select', { value: pref.accent, onChange: function(e){ setP('accent', e.target.value); } }, h('option', { value: 'nam' }, 'Miền Nam'), h('option', { value: 'bac' }, 'Miền Bắc'), h('option', { value: 'trung' }, 'Miền Trung'))),
          Field('Phong cách (không bắt buộc)', h('input', { value: pref.style, placeholder: 'ấm áp, rõ ràng, như thầy đang giảng…', onChange: function(e){ setP('style', e.target.value); } }))),
        h('p', { style: { fontSize: '0.8rem', color: 'var(--ink-2)', margin: '0 0 10px' } }, 'Giọng AI của Google Gemini (dùng chung GEMINI_API_KEY trên Vercel). Tạo 1 lần rồi lưu — học sinh nghe bản đã lưu, không tốn thêm. Chi phí ước tính dưới 1.000đ cho mỗi phút giọng đọc (gói miễn phí của Google có giới hạn số lần/phút: nếu báo giới hạn, hệ thống tự chờ rồi chạy tiếp).'),
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
          h('button', { type: 'button', className: 'btn btn-secondary', disabled: !!busy, onClick: sample }, '🔊 Nghe thử 1 câu'),
          h('button', { type: 'button', className: 'btn btn-primary', disabled: !!busy || !(cnt.none + cnt.stale), onClick: function(){ genAll(false); } }, '🎙 Tạo giọng cho ' + (cnt.none + cnt.stale) + ' câu còn thiếu'),
          h('button', { type: 'button', className: 'btn btn-secondary', disabled: !!busy, onClick: function(){ if(window.confirm('Tạo lại giọng AI cho TẤT CẢ câu (giữ nguyên các câu thầy tự thu)?')) genAll(true); } }, '↻ Tạo lại tất cả bằng giọng này'),
          busy && /Đang tạo giọng câu/.test(busy) ? h('button', { type: 'button', className: 'btn btn-secondary', onClick: function(){ cancelRef.current = true; } }, '⏹ Dừng') : null)) :
        h('p', { style: { fontSize: '0.84rem', color: 'var(--ink-2)', margin: '0 0 6px' } }, 'Bấm ● Thu, đọc câu đó, bấm ■ Dừng — tự nén MP3 và lưu. Nên thu ở nơi yên tĩnh, cách micro 20–30 cm. Câu thầy thu được ưu tiên hơn giọng AI; "✕" để bỏ và quay về giọng AI/máy.'),
      busy ? h('div', { className: 'banner info', style: { margin: '10px 0' } }, h('span', null, '⏳'), h('div', null, busy)) : null,
      h('div', { style: { maxHeight: '340px', overflow: 'auto', border: '1px solid var(--line)', borderRadius: '10px', marginTop: '10px' } },
        idxs.map(function(i){
          var s0 = st(i), c = map[i], isRec = rec && rec.i === i;
          return h('div', { key: i, style: { display: 'flex', gap: '10px', alignItems: 'center', padding: '7px 10px', borderTop: '1px solid var(--line)', background: isRec ? 'rgba(220,38,38,.08)' : 'transparent' } },
            h('span', { style: { fontSize: '0.72rem', color: 'var(--muted)', width: '24px' } }, i === 0 ? 'Mở' : i),
            h('div', { style: { flex: 1, fontSize: '0.86rem', lineHeight: 1.45 } }, says[i]),
            h('span', { style: { fontSize: '0.72rem', fontWeight: 700, color: BADGE[s0][1], whiteSpace: 'nowrap' } }, BADGE[s0][0] + (c && s0 !== 'stale' ? ' · ' + c.dur.toFixed(1) + 's' : '')),
            c ? h('button', { type: 'button', className: 'btn btn-secondary', style: { fontSize: '0.72rem', padding: '3px 8px' }, onClick: function(){ play(c.b64, c.mime); } }, '▶') : null,
            tab === 'teacher' ? (isRec ? h('button', { type: 'button', className: 'btn btn-primary', style: { fontSize: '0.72rem', padding: '3px 8px', background: '#dc2626', borderColor: '#dc2626' }, onClick: stopRec }, '■ Dừng')
              : h('button', { type: 'button', className: 'btn btn-secondary', disabled: !!rec || !!busy, style: { fontSize: '0.72rem', padding: '3px 8px' }, onClick: function(){ startRec(i); } }, '● Thu')) : null,
            c ? h('button', { type: 'button', className: 'sm-link-btn', style: { color: 'var(--muted)' }, title: 'Xoá giọng câu này', onClick: function(){ removeClip(i); } }, '✕') : null);
        })),
      h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' } },
        h('button', { type: 'button', className: 'btn btn-secondary', onClick: preview }, '▶ Xem bài giảng'),
        h('button', { type: 'button', className: 'btn btn-primary', disabled: !!busy || !!rec, onClick: props.onClose }, 'Xong')));
  }

  function baiIdx(k){ var B = window.OPC_NANO ? window.OPC_NANO.BAI : []; for(var i = 0; i < B.length; i++) if(B[i].key === k) return i; return 999; }
  function LessonsPanel(props){
    var O = OPC(), NANO = window.OPC_NANO, fire = props.fireToast;
    var snap = useSnap(function(set){ return O.lessons.subscribe(set, function(e){ console.error(e); set({ docs: [] }); }); });
    var es = React.useState(null); var edit = es[0], setEdit = es[1];
    var fs = React.useState('all'); var filt = fs[0], setFilt = fs[1];
    var bs = React.useState(false); var busy = bs[0], setBusy = bs[1];
    var vs = React.useState(null); var voiceOf = vs[0], setVoiceOf = vs[1];
    var gs = React.useState(''); var batch = gs[0], setBatch = gs[1];
    var stopRef = React.useRef(false);
    if(!snap) return h('div', { className: 'card' }, h('p', { style: { color: 'var(--ink-2)' } }, 'Đang tải…'));
    var lessons = docs(snap);
    var seedKeys = {}; lessons.forEach(function(l){ if(l.seedKey) seedKeys[l.seedKey] = 1; });
    var seedLeft = (window.OPC_FX.SEED_LESSONS || []).filter(function(s){ return !seedKeys[s.seedKey]; });
    async function loadSeeds(){
      setBusy(true);
      try{ for(var i = 0; i < seedLeft.length; i++){ var s = seedLeft[i]; await O.lessons.save(null, Object.assign({}, s, { published: true, order: i, createdAt: new Date().toISOString(), author: 'Claude (FaradayAI)' })); } fire('Đã nạp ' + seedLeft.length + ' bài giảng mẫu — thầy xem thử, sửa nếu cần.'); }
      catch(e){ fire('Không nạp được: ' + (e && e.message), true); }
      setBusy(false);
    }
    var noVoice = lessons.filter(function(l){ return l.kind !== 'youtube' && !l.audio; });
    async function batchVoice(){
      var pref = voicePref();
      if(!window.confirm('Tạo giọng AI (' + pref.voice + ', miền ' + ({ nam: 'Nam', bac: 'Bắc', trung: 'Trung' })[pref.accent] + ') cho ' + noVoice.length + ' bài giảng chưa có giọng? (đổi giọng: mở "🎙 Giọng" của 1 bài, chọn giọng rồi quay lại)')) return;
      stopRef.current = false;
      for(var k = 0; k < noVoice.length; k++){
        if(stopRef.current) break;
        var l = noVoice[k];
        try{ await generateLessonVoice(l, pref, { cancelled: function(){ return stopRef.current; }, onProgress: function(i, n){ setBatch('Bài ' + (k + 1) + '/' + noVoice.length + ' “' + l.title + '” — câu ' + (i + 1) + '/' + n); } }); }
        catch(e){ fire('Dừng ở bài "' + l.title + '": ' + e.message, true); break; }
      }
      setBatch(''); fire('Đã xong phần tạo giọng.');
    }
    var shown = lessons.filter(function(l){ return filt === 'all' || l.chuDeKey === filt; })
      .sort(function(a, b){ return baiIdx(a.baiKey) - baiIdx(b.baiKey) || (Number(a.order) || 0) - (Number(b.order) || 0); });
    var baiWith = {}; lessons.forEach(function(l){ if(l.baiKey) baiWith[l.baiKey] = (baiWith[l.baiKey] || 0) + 1; });
    var missing = NANO ? NANO.BAI.filter(function(b){ return !baiWith[b.key] && /^(nhiet|khi|tt|hn)-/.test(b.key); }) : [];
    return h('div', null,
      h('div', { className: 'card' },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center' } },
          h('div', null, h('h3', { style: { margin: 0 } }, '📺 Video bài giảng & ứng dụng thực tế'),
            h('p', { className: 'sm-sub', style: { margin: '4px 0 0' } }, 'Bài giảng FaradayAI: viết kịch bản (hoặc nhờ AI soạn nháp) → học sinh xem như video có logo FaradayAI, lời giảng tiếng Việt + phụ đề. Video YouTube: dán link, cắt đúng đoạn. Gắn theo bài/nano-point — em làm sai câu nào sẽ thấy nút "📺 Ôn lý thuyết" ngay dưới câu đó.')),
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            noVoice.length ? h('button', { type: 'button', className: 'btn btn-secondary', disabled: !!batch, onClick: batchVoice, title: 'Giọng AI tự nhiên thay cho giọng máy' }, '🎙 Tạo giọng AI cho ' + noVoice.length + ' bài') : null,
            seedLeft.length ? h('button', { type: 'button', className: 'btn btn-secondary', disabled: busy, onClick: loadSeeds }, busy ? 'Đang nạp…' : '✨ Nạp ' + seedLeft.length + ' bài giảng mẫu (Claude soạn)') : null,
            h('button', { type: 'button', className: 'btn btn-secondary', onClick: function(){ setEdit({ kind: 'youtube' }); } }, '＋ Video YouTube'),
            h('button', { type: 'button', className: 'btn btn-primary', onClick: function(){ setEdit({ kind: 'faraday' }); } }, '＋ Bài giảng FaradayAI'))),
        h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' } },
          Stat('Bài giảng FaradayAI', lessons.filter(function(l){ return l.kind !== 'youtube'; }).length),
          Stat('Video thực tế', lessons.filter(function(l){ return l.kind === 'youtube'; }).length),
          Stat('Bài SGK đã có video', Object.keys(baiWith).length, missing.length ? 'còn ' + missing.length + ' bài chưa có' : 'đủ cả 4 chương'),
          Stat('Có giọng AI / giọng thầy', lessons.filter(function(l){ return l.kind !== 'youtube' && l.audio; }).length + '/' + lessons.filter(function(l){ return l.kind !== 'youtube'; }).length, 'còn lại dùng giọng máy')),
        batch ? h('div', { className: 'banner info', style: { marginTop: '10px' } }, h('span', null, '🎙'), h('div', { style: { flex: 1 } }, batch), h('button', { type: 'button', className: 'btn btn-secondary', onClick: function(){ stopRef.current = true; } }, '⏹ Dừng')) : null),
      h('div', { className: 'card' },
        h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' } },
          h('button', { type: 'button', className: 'eb-nano-chip' + (filt === 'all' ? ' active' : ''), onClick: function(){ setFilt('all'); } }, 'Tất cả (' + lessons.length + ')'),
          (NANO ? NANO.CHU_DE : []).filter(function(c){ return lessons.some(function(l){ return l.chuDeKey === c.key; }); }).map(function(c){
            return h('button', { key: c.key, type: 'button', className: 'eb-nano-chip' + (filt === c.key ? ' active' : ''), onClick: function(){ setFilt(c.key); } }, c.icon + ' ' + c.name + ' (' + lessons.filter(function(l){ return l.chuDeKey === c.key; }).length + ')'); })),
        !shown.length ? h('p', { style: { color: 'var(--ink-2)' } }, 'Chưa có video nào. Bấm "✨ Nạp bài giảng mẫu" để có ngay ' + (window.OPC_FX.SEED_LESSONS || []).length + ' bài giảng Claude soạn sẵn cho 4 chương.') :
        h('div', { className: 'sm-table-wrap', style: { marginTop: 0 } }, h('table', { className: 'sm-table' },
          h('thead', null, h('tr', null, ['Loại', 'Tên', 'Bài', 'Thời lượng', 'Giọng', 'Hiện', ''].map(function(t){ return h('th', { key: t }, t); }))),
          h('tbody', null, shown.map(function(l){
            var bai = NANO && l.baiKey ? NANO.getBai(l.baiKey) : null;
            var dur = l.kind === 'youtube' ? (l.end ? window.OPC_FX.fmtTime((window.OPC_FX.parseTime(l.end) || 0) - (window.OPC_FX.parseTime(l.start) || 0)) : '—') : window.OPC_FX.fmtTime(window.OPC_FX.estimateSec(l.script));
            return h('tr', { key: l.id },
              h('td', null, l.kind === 'youtube' ? '🎬 YouTube' : '🎓 FaradayAI'),
              h('td', null, h('b', null, l.title), (l.nanoIds || []).length ? h('div', { style: { fontSize: '0.72rem', color: 'var(--muted)' } }, (l.nanoIds || []).join(', ')) : null),
              h('td', { style: { fontSize: '0.82rem' } }, bai ? bai.name : '—'),
              h('td', null, dur),
              h('td', { style: { fontSize: '0.78rem', whiteSpace: 'nowrap' } }, l.kind === 'youtube' ? '—' : (l.audio ? (l.audio.source === 'teacher' ? '🎤 Thầy' : (l.audio.source === 'mixed' ? '🎙🎤 AI + thầy' : '🎙 AI · ' + (l.audio.voice || ''))) : h('span', { style: { color: 'var(--muted)' } }, 'máy'))),
              h('td', null, h('input', { type: 'checkbox', checked: l.published !== false, onChange: function(e){ O.lessons.save(l.id, Object.assign({}, l, { published: e.target.checked })); } })),
              h('td', { style: { whiteSpace: 'nowrap' } },
                h('button', { type: 'button', className: 'btn btn-secondary', style: { fontSize: '0.75rem', padding: '4px 9px' }, onClick: function(){ window.OPC_FX.openLesson(l); } }, '▶ Xem'), ' ',
                l.kind !== 'youtube' ? h('button', { type: 'button', className: 'btn btn-secondary', style: { fontSize: '0.75rem', padding: '4px 9px' }, onClick: function(){ setVoiceOf(l); } }, '🎙 Giọng') : null, ' ',
                h('button', { type: 'button', className: 'btn btn-secondary', style: { fontSize: '0.75rem', padding: '4px 9px' }, onClick: function(){ setEdit(l); } }, 'Sửa'), ' ',
                h('button', { type: 'button', className: 'btn btn-secondary', style: { fontSize: '0.75rem', padding: '4px 9px' }, onClick: function(){ if(window.confirm('Xoá "' + l.title + '"?')) O.lessons.remove(l.id); } }, 'Xoá')));
          })))),
        missing.length ? h('p', { style: { fontSize: '0.8rem', color: 'var(--ink-2)', marginTop: '10px' } }, 'Bài SGK chưa có video: ' + missing.map(function(b){ return b.name.replace(/:.*/, ''); }).join(', ') + '.') : null),
      edit ? h(LessonEdit, { lesson: edit.id ? edit : edit, fireToast: fire, onClose: function(){ setEdit(null); } }) : null,
      voiceOf ? h(VoiceStudio, { lesson: lessons.filter(function(x){ return x.id === voiceOf.id; })[0] || voiceOf, fireToast: fire, onClose: function(){ setVoiceOf(null); } }) : null);
  }

  // =================================================================== 💬 KHẢO SÁT
  function SurveyPanel(props){
    var O = OPC(), fire = props.fireToast;
    var snap = useSnap(function(set){ return O.surveys.subscribe(set, function(e){ console.error(e); set({ docs: [], err: e }); }); });
    var cfgS = useSnap(function(set){ return O.settingsDoc('survey').subscribe(function(d){ set(d || {}); }, function(){ set({}); }); });
    var ds = React.useState(null); var draft = ds[0], setDraft = ds[1];
    var fs = React.useState('all'); var filt = fs[0], setFilt = fs[1];
    React.useEffect(function(){ if(cfgS && !draft) setDraft(Object.assign({ enabled: true, everyDays: 14, minAttempts: 3 }, cfgS)); }, [cfgS]);
    if(!snap || !draft) return h('div', { className: 'card' }, h('p', { style: { color: 'var(--ink-2)' } }, 'Đang tải…'));
    var rows = docs(snap);
    var n = rows.length;
    var avg = n ? rows.reduce(function(s, r){ return s + (Number(r.rating) || 0); }, 0) / n : null;
    function pct(pred){ return n ? Math.round(rows.filter(pred).length / n * 100) : 0; }
    var helpPos = pct(function(r){ return r.helpful === 'Rất nhiều' || r.helpful === 'Khá nhiều'; });
    var recYes = pct(function(r){ return r.recommend === 'Chắc chắn'; }), recNo = pct(function(r){ return r.recommend === 'Chưa'; });
    var likes = {}; rows.forEach(function(r){ (r.likes || []).forEach(function(k){ likes[k] = (likes[k] || 0) + 1; }); });
    var likeList = Object.keys(likes).sort(function(a, b){ return likes[b] - likes[a]; });
    var dist = [1, 2, 3, 4, 5].map(function(k){ return rows.filter(function(r){ return Number(r.rating) === k; }).length; });
    var recent30 = rows.filter(function(r){ return Date.now() - new Date(r.createdAt).getTime() < 30 * 86400000; });
    var avg30 = recent30.length ? recent30.reduce(function(s, r){ return s + Number(r.rating || 0); }, 0) / recent30.length : null;
    var shown = rows.filter(function(r){ return filt === 'all' || (filt === 'low' ? Number(r.rating) <= 3 : (filt === 'text' ? (r.improve || '').trim() : true)); });
    var FACE = ['', '😞', '😕', '😐', '🙂', '😍'];
    function setD(k, v){ setDraft(function(p){ var x = Object.assign({}, p); x[k] = v; return x; }); }
    function exportCsv(){
      var head = ['Thời gian', 'Học sinh', 'Lớp', 'Hài lòng (1-5)', 'Hữu ích', 'Thích', 'Cần cải thiện', 'Giới thiệu bạn', 'Nguồn', 'Số bài đã làm'];
      var lines = [head].concat(rows.map(function(r){ return [r.createdAt, r.name, r.lop, r.rating, r.helpful, (r.likes || []).join('; '), r.improve, r.recommend, r.trigger, r.attempts]; }))
        .map(function(a){ return a.map(function(v){ return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
      var url = URL.createObjectURL(new Blob(['﻿' + lines], { type: 'text/csv' })), a = document.createElement('a'); a.href = url; a.download = 'khao-sat-faradayai.csv'; a.click(); setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);
    }
    return h('div', null,
      h('div', { className: 'card' },
        h('h3', { style: { margin: 0 } }, '💬 Khảo sát mức độ hài lòng'),
        h('p', { className: 'sm-sub', style: { margin: '4px 0 10px' } }, 'Hỏi nhẹ: thẻ nhỏ góc màn hình sau khi em nộp bài, không chặn việc học, có nút "Để sau". Mỗi em tối đa 1 lần / ' + (draft.everyDays || 14) + ' ngày.'),
        snap.err ? h('div', { className: 'banner warn' }, h('span', null, '⚠️'), h('div', null, 'Chưa đọc được kết quả — kiểm tra đã Publish firestore.rules mới chưa.')) : null,
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '10px', alignItems: 'end' } },
          h('label', { style: { display: 'flex', gap: '6px', alignItems: 'center', fontWeight: 700, fontSize: '0.88rem' } }, h('input', { type: 'checkbox', checked: draft.enabled !== false, onChange: function(e){ setD('enabled', e.target.checked); } }), 'Bật khảo sát tự động'),
          Field('Hỏi lại sau (ngày)', h('input', { type: 'number', min: 3, max: 90, value: draft.everyDays, onChange: function(e){ setD('everyDays', Number(e.target.value) || 14); } })),
          Field('Chỉ hỏi em đã làm ≥ (bài)', h('input', { type: 'number', min: 1, max: 30, value: draft.minAttempts, onChange: function(e){ setD('minAttempts', Number(e.target.value) || 3); } })),
          Field('Câu hỏi mở đầu', h('input', { value: draft.question || '', placeholder: 'FaradayAI đang giúp em ôn luyện thế nào?', onChange: function(e){ setD('question', e.target.value); } }))),
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
          h('button', { type: 'button', className: 'btn btn-primary', onClick: function(){ O.settingsDoc('survey').save(draft).then(function(){ fire('Đã lưu cài đặt khảo sát.'); }); } }, '💾 Lưu cài đặt'),
          h('button', { type: 'button', className: 'btn btn-secondary', title: 'Mọi em chưa trả lời từ hôm nay sẽ được hỏi ở lần vào FaradayAI kế tiếp', onClick: function(){ var d2 = Object.assign({}, draft, { askAllAfter: Date.now() }); setDraft(d2); O.settingsDoc('survey').save(d2).then(function(){ fire('Đã bật: các em sẽ được hỏi ở lần vào kế tiếp.'); }); } }, '📣 Hỏi tất cả học sinh ngay'),
          h('button', { type: 'button', className: 'btn btn-secondary', disabled: !n, onClick: exportCsv }, '⬇ Xuất CSV'))),
      h('div', { className: 'card' },
        h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
          Stat('Số phiếu', n, recent30.length + ' phiếu trong 30 ngày'),
          Stat('Hài lòng trung bình', avg == null ? '—' : fmt2(avg) + ' / 5', avg30 != null ? '30 ngày gần đây: ' + fmt2(avg30) : ''),
          Stat('Thấy giúp ôn luyện hiệu quả', helpPos + '%', '"Rất nhiều" + "Khá nhiều"'),
          Stat('Sẽ giới thiệu bạn bè', recYes + '%', 'chưa muốn: ' + recNo + '%')),
        n ? h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '16px', marginTop: '14px' } },
          h('div', null, h('b', { style: { fontSize: '0.88rem' } }, 'Phân bố mức hài lòng'),
            [5, 4, 3, 2, 1].map(function(k){ var c = dist[k - 1]; return h('div', { key: k, style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', margin: '5px 0' } },
              h('span', { style: { width: '26px' } }, FACE[k]), h('div', { style: { flex: 1, height: '10px', background: 'var(--surface-2)', borderRadius: '99px', overflow: 'hidden' } }, h('div', { style: { width: (n ? c / n * 100 : 0) + '%', height: '100%', background: k >= 4 ? 'var(--good)' : (k === 3 ? 'var(--warning)' : 'var(--critical)') } })), h('span', { style: { width: '28px', textAlign: 'right' } }, c)); })),
          h('div', null, h('b', { style: { fontSize: '0.88rem' } }, 'Các em thích nhất'),
            likeList.length ? likeList.map(function(k){ return h('div', { key: k, style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', margin: '5px 0' } },
              h('span', { style: { width: '150px' } }, k), h('div', { style: { flex: 1, height: '10px', background: 'var(--surface-2)', borderRadius: '99px', overflow: 'hidden' } }, h('div', { style: { width: (likes[k] / n * 100) + '%', height: '100%', background: 'var(--accent)' } })), h('span', { style: { width: '28px', textAlign: 'right' } }, likes[k])); }) :
              h('p', { style: { fontSize: '0.84rem', color: 'var(--ink-2)' } }, 'Chưa có.'))) : null),
      h('div', { className: 'card' },
        h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' } },
          [['all', 'Tất cả'], ['text', 'Có góp ý'], ['low', '⚠️ Chưa hài lòng (≤ 3)']].map(function(x){ return h('button', { key: x[0], type: 'button', className: 'eb-nano-chip' + (filt === x[0] ? ' active' : ''), onClick: function(){ setFilt(x[0]); } }, x[1]); })),
        !shown.length ? h('p', { style: { color: 'var(--ink-2)' } }, n ? 'Không có phiếu ở mục này.' : 'Chưa có phiếu nào. Các em sẽ được hỏi sau khi làm đủ ' + (draft.minAttempts || 3) + ' bài.') :
        shown.slice(0, 200).map(function(r){
          return h('div', { key: r.id, style: { borderTop: '1px solid var(--line)', padding: '9px 0', display: 'flex', gap: '10px' } },
            h('span', { style: { fontSize: '1.5rem' } }, FACE[Number(r.rating) || 3]),
            h('div', { style: { flex: 1, minWidth: 0 } },
              h('div', { style: { fontSize: '0.84rem' } }, h('b', null, r.name || '—'), r.lop ? ' · ' + r.lop : '', ' · ', new Date(r.createdAt).toLocaleDateString('vi-VN'),
                r.helpful ? ' · hữu ích: ' + r.helpful : '', r.recommend ? ' · giới thiệu: ' + r.recommend : '', r.trigger === 'manual' ? ' · em tự gửi' : ''),
              (r.likes || []).length ? h('div', { style: { fontSize: '0.78rem', color: 'var(--ink-2)' } }, '👍 ' + r.likes.join(', ')) : null,
              r.improve ? h('div', { style: { fontSize: '0.9rem', marginTop: '3px', whiteSpace: 'pre-wrap' } }, '“' + r.improve + '”') : null),
            h('button', { type: 'button', className: 'sm-link-btn', style: { alignSelf: 'flex-start', color: 'var(--muted)' }, title: 'Xoá phiếu', onClick: function(){ if(window.confirm('Xoá phiếu này?')) O.surveys.remove(r.id); } }, '✕'));
        })));
  }

  if(window.OPC_FX) window.OPC_FX.setAudioLoader(function(id){ return OPC().lessons.loadAudio(id); });
  window.OPC_GROWTH = { MockPanel: MockPanel, LessonsPanel: LessonsPanel, SurveyPanel: SurveyPanel, _computeBoard: computeBoard };
})(window);
