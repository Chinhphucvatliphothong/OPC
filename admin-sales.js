/**
 * admin-sales.js — THÊM 24/10/2026 · tab "📣 Bán hàng" trong admin.html
 * Học từ PrepScholar (bằng chứng tiến bộ bằng số + câu chuyện trước→sau + cam kết đầu ra + tư vấn) và Squirrel AI
 * (chẩn đoán miễn phí → báo cáo lỗ hổng → buổi tư vấn với phụ huynh → hình ảnh lớp học AI thật):
 *  1) Phễu chuyển đổi 30 ngày: khách làm chẩn đoán → để lại SĐT → đặt lịch tư vấn → đăng ký → đóng học phí.
 *  2) Số liệu công khai tính TỪ DỮ LIỆU THẬT (học sinh, lượt bài, kết quả thi thử) → hiện ở trang chủ.
 *  3) Ảnh lớp học thật (tự thu nhỏ ảnh; bắt buộc tick "đã được đồng ý" mới hiện).
 *  4) Câu chuyện tiến bộ lấy từ bảng thi thử (tên viết tắt, cần đồng ý của phụ huynh).
 *  5) Cam kết đầu ra · Ưu đãi có hạn · Lịch tư vấn 15 phút + danh sách khách đặt lịch.
 * Lưu: settings/proof · proof_photos/{id} · bookings/{id} (khách tạo). Xuất: window.OPC_SALES_ADMIN = { SalesPanel }
 */
(function(window){
  'use strict';
  var React = window.React; if(!React) return;
  var h = React.createElement;
  function OPC(){ return window.OPC; }
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function ymd(d){ d = d ? new Date(d) : new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fmt2(n){ return n == null || isNaN(n) ? '—' : (Math.round(Number(n) * 100) / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 }); }
  function fmtN(n){ return (Number(n) || 0).toLocaleString('vi-VN'); }
  function docs(snap){ return snap ? snap.docs.map(function(d){ return Object.assign({}, d.data() || {}, { id: d.id }); }) : []; }
  function useSnap(fn){ var st = React.useState(null); React.useEffect(function(){ var u = fn(st[1]); return function(){ try{ u && u(); }catch(e){} }; }, []); return st[0]; }
  function copy(t){ try{ return navigator.clipboard.writeText(t); }catch(e){ window.prompt('Chép:', t); return Promise.resolve(); } }
  function zalo(p){ var n = String(p || '').replace(/[\s.\-()]/g, ''); if(n.indexOf('+84') === 0) n = '84' + n.slice(3); else if(n.indexOf('0') === 0) n = '84' + n.slice(1); return 'https://zalo.me/' + n; }
  function fmtPhone(p){ var d = String(p || '').replace(/\D/g, ''); return d.length === 10 ? d.slice(0, 4) + ' ' + d.slice(4, 7) + ' ' + d.slice(7) : p; }
  function initials(name){ var w = String(name || '').trim().split(/\s+/); if(!w[0]) return 'Bạn H.S.'; var last = w[w.length - 1]; return 'Bạn ' + w.slice(0, -1).map(function(x){ return x[0].toUpperCase() + '.'; }).join('') + ' ' + last; }
  var WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  function Card(title, sub, children, right){
    return h('div', { className: 'card' },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-start' } },
        h('div', null, h('h3', { style: { margin: 0 } }, title), sub ? h('p', { className: 'sm-sub', style: { margin: '4px 0 0' } }, sub) : null), right || null),
      h('div', { style: { marginTop: '12px' } }, children));
  }
  function Field(label, el, hint){ return h('div', { className: 'sm-field', style: { marginBottom: '10px' } }, h('label', null, label), el, hint ? h('div', { style: { fontSize: '0.76rem', color: 'var(--ink-2)', marginTop: '3px' } }, hint) : null); }
  function Stat(label, val, sub, color){ return h('div', { style: { flex: '1 1 130px', background: 'var(--surface-2)', borderRadius: '10px', padding: '10px 12px' } },
    h('div', { style: { fontSize: '0.74rem', color: 'var(--ink-2)', fontWeight: 700 } }, label), h('div', { style: { fontSize: '1.4rem', fontWeight: 800, color: color || 'inherit' } }, val), sub ? h('div', { style: { fontSize: '0.72rem', color: 'var(--ink-2)' } }, sub) : null); }

  // ảnh → JPEG ≤ 1280px (~150–250 KB) để lưu trong Firestore (mỗi ảnh 1 doc, giới hạn 1 MB)
  function shrink(file, maxW){
    return new Promise(function(ok, no){
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function(){
        var k = Math.min(1, (maxW || 1280) / Math.max(im.naturalWidth, im.naturalHeight));
        var c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var q = 0.78, out = c.toDataURL('image/jpeg', q);
        while(out.length > 700000 && q > 0.4){ q -= 0.08; out = c.toDataURL('image/jpeg', q); }
        ok(out);
      };
      im.onerror = function(){ URL.revokeObjectURL(url); no(new Error('Không đọc được ảnh')); };
      im.src = url;
    });
  }

  // làm mờ vùng mặt bằng tay: kéo chuột/ngón tay vẽ ô chữ nhật → làm mờ ô đó
  function BlurEditor(props){
    var cvRef = React.useRef(null), imgRef = React.useRef(null), drag = React.useRef(null);
    var ns = React.useState(0); var n = ns[0], setN = ns[1];
    React.useEffect(function(){
      var im = new Image(); im.onload = function(){ imgRef.current = im; var c = cvRef.current; c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); }; im.src = props.src;
    }, []);
    function pos(e){ var c = cvRef.current, r = c.getBoundingClientRect(), p = e.touches ? e.touches[0] : e; return [(p.clientX - r.left) * c.width / r.width, (p.clientY - r.top) * c.height / r.height]; }
    function down(e){ e.preventDefault(); drag.current = { a: pos(e), snap: cvRef.current.getContext('2d').getImageData(0, 0, cvRef.current.width, cvRef.current.height) }; }
    function move(e){
      if(!drag.current) return; e.preventDefault();
      var c = cvRef.current, x = c.getContext('2d'), b = pos(e), a = drag.current.a;
      x.putImageData(drag.current.snap, 0, 0); x.strokeStyle = '#f59e0b'; x.lineWidth = Math.max(3, c.width / 300); x.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
      drag.current.b = b;
    }
    function up(){
      var d = drag.current; drag.current = null; if(!d || !d.b) return;
      var c = cvRef.current, x = c.getContext('2d'); x.putImageData(d.snap, 0, 0);
      var x0 = Math.min(d.a[0], d.b[0]), y0 = Math.min(d.a[1], d.b[1]), w = Math.abs(d.b[0] - d.a[0]), hh = Math.abs(d.b[1] - d.a[1]);
      if(w < 6 || hh < 6) return;
      // pixel hoá rồi làm mờ (chắc chắn không nhận ra được mặt)
      var px = Math.max(8, Math.round(Math.max(w, hh) / 10)), tmp = document.createElement('canvas');
      tmp.width = Math.max(1, Math.round(w / px)); tmp.height = Math.max(1, Math.round(hh / px));
      tmp.getContext('2d').drawImage(c, x0, y0, w, hh, 0, 0, tmp.width, tmp.height);
      x.save(); x.imageSmoothingEnabled = true; x.filter = 'blur(' + Math.round(px / 2) + 'px)'; x.drawImage(tmp, 0, 0, tmp.width, tmp.height, x0, y0, w, hh); x.restore();
      x.imageSmoothingEnabled = false; x.globalAlpha = 0.85; x.drawImage(tmp, 0, 0, tmp.width, tmp.height, x0, y0, w, hh); x.globalAlpha = 1; x.imageSmoothingEnabled = true;
      setN(n + 1);
    }
    return h('div', { className: 'sm-overlay', onClick: function(e){ if(e.target === e.currentTarget) props.onClose(); } },
      h('div', { className: 'sm-modal', style: { maxWidth: '980px' } },
        h('div', { className: 'sm-modal-head' }, h('h3', null, '🫥 Làm mờ khuôn mặt'), h('button', { type: 'button', className: 'sm-modal-close', onClick: props.onClose }, '✕')),
        h('p', { className: 'sm-sub', style: { margin: '0 0 8px' } }, 'Kéo chuột (hoặc ngón tay) khoanh vùng khuôn mặt/tên/bảng tên cần che — vùng đó bị làm mờ ngay. Đã làm mờ ' + n + ' vùng.'),
        h('canvas', { ref: cvRef, style: { width: '100%', height: 'auto', borderRadius: '10px', touchAction: 'none', cursor: 'crosshair', background: '#000' },
          onMouseDown: down, onMouseMove: move, onMouseUp: up, onMouseLeave: up, onTouchStart: down, onTouchMove: move, onTouchEnd: up }),
        h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' } },
          h('button', { type: 'button', className: 'btn btn-secondary', onClick: function(){ var c = cvRef.current, im = imgRef.current; if(im){ c.getContext('2d').drawImage(im, 0, 0); setN(0); } } }, '↺ Làm lại'),
          h('button', { type: 'button', className: 'btn btn-secondary', onClick: props.onClose }, 'Huỷ'),
          h('button', { type: 'button', className: 'btn btn-primary', onClick: function(){ props.onSave(cvRef.current.toDataURL('image/jpeg', 0.8)); } }, 'Lưu ảnh đã làm mờ'))));
  }

  var DEFAULT_PROOF = {
    title: 'Lớp học thật, tiến bộ đo được bằng số liệu', kicker: 'Kết quả thật', sub: 'Không phải lời quảng cáo — đây là số liệu FaradayAI ghi nhận từ chính các buổi học của học sinh.',
    stats: {}, manual: {}, stories: [],
    guarantee: { enabled: false, title: 'Cam kết tiến bộ', text: 'Học đủ lộ trình 8 tuần cùng FaradayAI mà điểm thi thử không tăng ít nhất 1 điểm so với bài chẩn đoán đầu vào, em được học tiếp 1 tháng miễn phí.',
      terms: 'Điều kiện: làm bài chẩn đoán đầu vào, luyện tập tối thiểu 4 buổi/tuần trên FaradayAI, hoàn thành đủ đề thầy giao và tham gia đủ các kỳ thi thử tháng.' },
    offer: { enabled: false, text: 'Ưu đãi đăng ký sớm: giảm 10% trọn khóa', seats: '', until: '' },
    booking: { enabled: true, intro: '', minLeadHours: 3, days: { 1: ['19:30', '20:00', '20:30'], 3: ['19:30', '20:00', '20:30'], 5: ['19:30', '20:00', '20:30'], 6: ['09:00', '09:30', '10:00'], 0: ['09:00', '09:30', '10:00'] }, taken: {} },
    stickyCta: true
  };
  var BK_STATUS = { 'new': ['🆕 Mới', 'var(--critical)'], called: ['📞 Đã gọi', 'var(--warning)'], won: ['✅ Đăng ký học', 'var(--good)'], lost: ['✖ Không tiếp tục', 'var(--muted)'], noans: ['📵 Chưa nghe máy', 'var(--warning)'] };

  function SalesPanel(props){
    var O = OPC(), fire = props.fireToast;
    var proofDoc = useSnap(function(set){ return O.settingsDoc('proof').subscribe(function(d){ set(d || {}); }, function(){ set({}); }); });
    var photosS = useSnap(function(set){ return O.proofPhotos.subscribe(set, function(){ set({ docs: [] }); }); });
    var bookS = useSnap(function(set){ return O.bookings.subscribe(set, function(e){ console.error(e); set({ docs: [], err: e }); }); });
    var leadsS = useSnap(function(set){ return O.diag5 ? O.diag5.subscribeLeads(set, function(){ set({ docs: [] }); }) : null; });
    var regsS = useSnap(function(set){ return O.registrations.subscribe(set, function(){ set({ docs: [] }); }); });
    var stuS = useSnap(function(set){ return O.students.subscribe(set, function(){ set({ docs: [] }); }); });
    var statS = useSnap(function(set){ return O.studentStats.subscribe(set, function(){ set({ docs: [] }); }); });
    var mockS = useSnap(function(set){ return O.mockExams ? O.mockExams.subscribe(set, function(){ set({ docs: [] }); }) : null; });
    var evS = React.useState(null); var events = evS[0], setEvents = evS[1];
    var dS = React.useState(null); var draft = dS[0], setDraft = dS[1];
    var blS = React.useState(null); var blurOf = blS[0], setBlurOf = blS[1];
    var upS = React.useState(''); var upBusy = upS[0], setUpBusy = upS[1];
    var bfS = React.useState('open'); var bkFilter = bfS[0], setBkFilter = bfS[1];
    var dayText = React.useRef({});
    React.useEffect(function(){ if(O.diag5 && O.diag5.loadEvents) O.diag5.loadEvents().then(setEvents).catch(function(){ setEvents([]); }); else setEvents([]); }, []);
    React.useEffect(function(){ if(proofDoc && !draft) setDraft(Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_PROOF)), proofDoc, {
      guarantee: Object.assign({}, DEFAULT_PROOF.guarantee, proofDoc.guarantee || {}), offer: Object.assign({}, DEFAULT_PROOF.offer, proofDoc.offer || {}),
      booking: Object.assign({}, DEFAULT_PROOF.booking, proofDoc.booking || {}), manual: Object.assign({}, proofDoc.manual || {}), stories: (proofDoc.stories || []).slice() })); }, [proofDoc]);
    // giờ khách đã đặt → đánh dấu "đã có người" để trang chủ không cho đặt trùng
    var bookings = docs(bookS).sort(function(a, b){ return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); });
    React.useEffect(function(){
      if(!proofDoc || !bookS) return;
      var want = {}, today = ymd();
      bookings.forEach(function(b){ if(b.slot && b.slot.slice(0, 10) >= today && b.status !== 'lost') want[b.slot] = 1; });
      var cur = (proofDoc.booking && proofDoc.booking.taken) || {};
      if(JSON.stringify(Object.keys(want).sort()) !== JSON.stringify(Object.keys(cur).sort())){
        O.settingsDoc('proof').save(Object.assign({}, proofDoc, { booking: Object.assign({}, DEFAULT_PROOF.booking, proofDoc.booking || {}, { taken: want }) })).catch(function(){});
      }
    }, [bookS, proofDoc]);
    if(!draft || !photosS || !bookS || !stuS || !statS) return h('div', { className: 'card' }, h('p', { style: { color: 'var(--ink-2)' } }, 'Đang tải…'));
    function setD(path, v){ setDraft(function(p){ var n = JSON.parse(JSON.stringify(p)); var ks = path.split('.'), o = n; for(var i = 0; i < ks.length - 1; i++){ o[ks[i]] = o[ks[i]] || {}; o = o[ks[i]]; } o[ks[ks.length - 1]] = v; return n; }); }
    function save(msg){ var d = Object.assign({}, draft); d.booking = Object.assign({}, draft.booking, { taken: (proofDoc.booking && proofDoc.booking.taken) || {} }); return O.settingsDoc('proof').save(d).then(function(){ fire(msg || 'Đã lưu — trang chủ cập nhật ngay.'); }).catch(function(e){ fire('Không lưu được: ' + (e && e.message), true); }); }

    // ---------- phễu 30 ngày
    var since = Date.now() - 30 * 86400000;
    function recent(list){ return list.filter(function(x){ var t = new Date(x.createdAt && x.createdAt.toDate ? x.createdAt.toDate() : x.createdAt).getTime(); return t >= since; }); }
    var ev = (events || []).filter(function(e){ return new Date(e.createdAt).getTime() >= since; });
    var nStart = ev.filter(function(e){ return e.type === 'start'; }).length, nFin = ev.filter(function(e){ return e.type === 'finish'; }).length;
    var leads = recent(docs(leadsS)), regs = recent(docs(regsS)), bk30 = recent(bookings);
    var students = docs(stuS), paying = students.filter(function(s){ var b = s.billing; return b && b.plan && b.cycle && b.cycle !== 'free' && b.cycle !== 'trial' && (b.payments || []).length; });
    var won30 = paying.filter(function(s){ var p = (s.billing.payments || [])[0]; return p && new Date(p.date).getTime() >= since; }).length;
    function pct(a, b){ return b ? Math.round(a / b * 100) + '%' : '—'; }
    var funnel = [['Bắt đầu chẩn đoán', nStart], ['Làm xong', nFin], ['Để lại SĐT', leads.length], ['Đặt lịch tư vấn', bk30.length], ['Đăng ký học', regs.length], ['Đóng học phí lần đầu', won30]];
    var fmax = Math.max.apply(null, funnel.map(function(f){ return f[1]; }).concat([1]));
    var srcCount = {}; leads.concat(bk30).forEach(function(x){ var k = x.src || x.source || 'trực tiếp'; srcCount[k] = (srcCount[k] || 0) + 1; });

    // ---------- số liệu công khai
    function recompute(){
      var st = docs(statS), active = students.filter(function(s){ return s.status !== 'inactive'; });
      var attempts = st.reduce(function(s2, x){ return s2 + (Number(x.completedExamsCount) || 0); }, 0);
      var questions = st.reduce(function(s2, x){ return s2 + (Number(x.answeredCount) || Number(x.totalAnswered) || 0); }, 0);
      var mocks = docs(mockS), rows = [];
      mocks.forEach(function(m){ (m.board || []).forEach(function(r){ if(r.delta != null) rows.push(r.delta); }); });
      var improved = rows.filter(function(d){ return d > 0; }).length;
      var stats = { students: active.length, attempts: attempts, questions: questions || null, compared: rows.length,
        improvedPct: rows.length ? improved / rows.length * 100 : null, avgDelta: rows.length ? rows.reduce(function(a, b){ return a + b; }, 0) / rows.length : null, updatedAt: new Date().toISOString() };
      setD('stats', stats);
      fire('Đã tính lại từ dữ liệu thật — bấm "💾 Lưu & đăng" để cập nhật trang chủ.');
    }
    var S = draft.stats || {};
    // ---------- câu chuyện: gợi ý từ bảng thi thử
    var byId = {}; students.forEach(function(s){ byId[s.id] = s; });
    var used = {}; (draft.stories || []).forEach(function(x){ used[x.sid + '|' + x.mockId] = 1; });
    var sugg = [];
    docs(mockS).forEach(function(m){ (m.board || []).forEach(function(r){ if(r.delta != null && r.delta >= 1 && !used[r.sid + '|' + m.id]) sugg.push({ m: m, r: r }); }); });
    sugg.sort(function(a, b){ return b.r.delta - a.r.delta; });
    function addStory(x){
      var s = byId[x.r.sid] || {};
      var st = { sid: x.r.sid, mockId: x.m.id, name: initials(s.name || x.r.name), lop: s.lop ? 'Lớp ' + s.lop : '', before: x.r.prev, after: x.r.score, period: (x.r.prevTitle ? x.r.prevTitle + ' → ' : '') + x.m.title, quote: '', consent: false, visible: true };
      setD('stories', (draft.stories || []).concat([st]));
    }
    function setStory(i, k, v){ var a = (draft.stories || []).slice(); a[i] = Object.assign({}, a[i]); a[i][k] = v; setD('stories', a); }
    // ---------- ảnh
    var photos = docs(photosS).sort(function(a, b){ return (a.order || 0) - (b.order || 0); });
    async function onFiles(e){
      var files = Array.prototype.slice.call(e.target.files || []); e.target.value = '';
      for(var i = 0; i < files.length; i++){
        setUpBusy('Đang thu nhỏ & tải ảnh ' + (i + 1) + '/' + files.length + '…');
        try{ var img = await shrink(files[i], 1280); await O.proofPhotos.save(null, { img: img, caption: '', consent: false, visible: true, order: Date.now() + i, createdAt: new Date().toISOString() }); }
        catch(err){ fire('Ảnh ' + files[i].name + ': ' + err.message, true); }
      }
      setUpBusy(''); fire('Đã tải ảnh — nhớ làm mờ mặt nếu cần, viết chú thích và tick "Đã được đồng ý" để ảnh hiện ở trang chủ.');
    }
    // ---------- lịch
    var B = draft.booking || {};
    function setDayTimes(dw, text){ var days = Object.assign({}, B.days || {}); var arr = String(text).split(/[,;\s]+/).map(function(t){ var m = /^(\d{1,2})[:h.]?(\d{2})?$/.exec(t.trim()); return m ? pad(Number(m[1])) + ':' + (m[2] || '00') : null; }).filter(Boolean); days[dw] = arr; setD('booking.days', days); }
    var shownBk = bookings.filter(function(b){ return bkFilter === 'all' || (bkFilter === 'open' ? (b.status === 'new' || b.status === 'noans' || b.status === 'called') : b.status === bkFilter); });
    var origin = (location.origin && location.origin !== 'null') ? location.origin.replace(/\/admin.*$/, '') : 'https://faradayai.vn';

    return h('div', null,
      // ===== phễu
      Card('📣 Bán hàng — phễu 30 ngày qua', 'Mô hình PrepScholar + Squirrel AI: CHẨN ĐOÁN MIỄN PHÍ → báo cáo lỗ hổng → TƯ VẤN 15 phút với phụ huynh → học thử → đăng ký. Mỗi bậc mất khách ở đâu, thầy cải thiện đúng bậc đó.',
        h('div', null,
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, funnel.map(function(f, i){
            return h('div', { key: f[0], style: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem' } },
              h('span', { style: { width: '170px', fontWeight: 700 } }, f[0]),
              h('div', { style: { flex: 1, height: '22px', background: 'var(--surface-2)', borderRadius: '6px', overflow: 'hidden' } },
                h('div', { style: { width: Math.max(2, f[1] / fmax * 100) + '%', height: '100%', background: 'var(--accent)', opacity: 1 - i * 0.1, display: 'flex', alignItems: 'center', paddingLeft: '8px', color: '#fff', fontWeight: 800, fontSize: '0.8rem' } }, f[1])),
              h('span', { style: { width: '70px', textAlign: 'right', color: 'var(--ink-2)', fontSize: '0.78rem' } }, i ? pct(f[1], funnel[i - 1][1]) : ''));
          })),
          h('p', { style: { fontSize: '0.8rem', color: 'var(--ink-2)', margin: '10px 0 0' } }, 'Nguồn khách: ' + (Object.keys(srcCount).length ? Object.keys(srcCount).map(function(k){ return k + ' (' + srcCount[k] + ')'; }).join(' · ') : 'chưa có') + '. Thêm ?utm_source=facebook (hoặc zalo, tiktok…) vào link chia sẻ để biết kênh nào hiệu quả.'),
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' } },
            [['⚡ Link chẩn đoán', origin + '/?utm_source=zalo#chan-doan'], ['📅 Link đặt lịch tư vấn', origin + '/?utm_source=zalo#tu-van'], ['🏆 Link trang kết quả', origin + '/#ket-qua']].map(function(x){
              return h('button', { key: x[0], type: 'button', className: 'btn btn-secondary', style: { fontSize: '0.8rem' }, onClick: function(){ copy(x[1]).then(function(){ fire('Đã chép: ' + x[1]); }); } }, x[0] + ' 📋'); })))),
      // ===== lịch tư vấn + khách đặt lịch
      Card('📅 Khách đặt lịch tư vấn (' + bookings.filter(function(b){ return b.status === 'new'; }).length + ' mới)', 'Squirrel AI chốt khách bằng buổi tư vấn đọc báo cáo chẩn đoán cùng phụ huynh. Gọi đúng giờ khách chọn — mở hồ sơ chẩn đoán (nếu có) trước khi gọi.',
        h('div', null,
          bookS.err ? h('div', { className: 'banner warn' }, h('span', null, '⚠️'), h('div', null, 'Chưa đọc được — kiểm tra đã Publish firestore.rules mới chưa.')) : null,
          h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' } },
            [['open', 'Cần xử lý'], ['won', 'Đã đăng ký'], ['lost', 'Không tiếp tục'], ['all', 'Tất cả']].map(function(x){ return h('button', { key: x[0], type: 'button', className: 'eb-nano-chip' + (bkFilter === x[0] ? ' active' : ''), onClick: function(){ setBkFilter(x[0]); } }, x[1]); })),
          !shownBk.length ? h('p', { style: { color: 'var(--ink-2)', fontSize: '0.88rem' } }, 'Chưa có khách đặt lịch ở mục này.') :
          h('div', { className: 'sm-table-wrap', style: { marginTop: 0 } }, h('table', { className: 'sm-table' },
            h('thead', null, h('tr', null, ['Giờ hẹn', 'Khách', 'Liên hệ', 'Ghi chú', 'Trạng thái'].map(function(t){ return h('th', { key: t }, t); }))),
            h('tbody', null, shownBk.map(function(b){
              var sl = b.slot ? b.slot.split(' ') : null, dd = sl ? new Date(sl[0] + 'T' + sl[1]) : null;
              var soon = dd && dd.getTime() - Date.now() < 3 * 3600000 && dd.getTime() > Date.now() - 3600000;
              return h('tr', { key: b.id, style: soon ? { background: 'rgba(245,158,11,.12)' } : null },
                h('td', { style: { whiteSpace: 'nowrap', fontWeight: 700 } }, dd ? WD[dd.getDay()] + ' ' + pad(dd.getDate()) + '/' + pad(dd.getMonth() + 1) + ' · ' + sl[1] : (b.when || 'Bất kỳ'), soon ? h('div', { style: { fontSize: '0.72rem', color: 'var(--warning)' } }, '⏰ sắp tới giờ') : null),
                h('td', null, h('b', null, b.name), h('div', { style: { fontSize: '0.74rem', color: 'var(--muted)' } }, (b.role === 'ph' ? 'Phụ huynh' + (b.student ? ' của ' + b.student : '') : 'Học sinh') + ' · ' + (b.source || '') + (b.src && b.src !== 'direct' ? ' · ' + b.src : ''))),
                h('td', { style: { whiteSpace: 'nowrap' } }, h('a', { href: 'tel:' + b.phone, style: { fontWeight: 800, textDecoration: 'none' } }, '☎ ' + fmtPhone(b.phone)),
                  h('div', { style: { display: 'flex', gap: '4px', marginTop: '4px' } },
                    h('a', { className: 'btn btn-primary', href: 'tel:' + b.phone, style: { fontSize: '0.72rem', padding: '3px 8px', textDecoration: 'none' } }, '📞 Gọi'),
                    h('a', { className: 'btn btn-secondary', href: zalo(b.phone), target: '_blank', rel: 'noopener', style: { fontSize: '0.72rem', padding: '3px 8px', textDecoration: 'none' } }, 'Zalo'))),
                h('td', { style: { fontSize: '0.8rem', maxWidth: '260px' } }, b.note || '—'),
                h('td', null, h('select', { value: b.status || 'new', onChange: function(e){ O.bookings.update(b.id, { status: e.target.value }); } }, Object.keys(BK_STATUS).map(function(k){ return h('option', { key: k, value: k }, BK_STATUS[k][0]); }))));
            })))),
          h('details', { style: { marginTop: '12px' } }, h('summary', { style: { cursor: 'pointer', fontWeight: 700 } }, '⚙️ Khung giờ nhận tư vấn'),
            h('div', { style: { marginTop: '10px' } },
              h('label', { style: { display: 'flex', gap: '6px', alignItems: 'center', fontWeight: 700, fontSize: '0.88rem', marginBottom: '8px' } }, h('input', { type: 'checkbox', checked: B.enabled !== false, onChange: function(e){ setD('booking.enabled', e.target.checked); } }), 'Bật đặt lịch tư vấn trên trang chủ (+ thanh nút dính đáy màn hình điện thoại)'),
              h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: '8px' } },
                [1, 2, 3, 4, 5, 6, 0].map(function(dw){
                  var cur = dayText.current[dw] != null ? dayText.current[dw] : ((B.days || {})[dw] || []).join(', ');
                  return Field(['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][dw], h('input', { defaultValue: cur, placeholder: 'trống = nghỉ · vd 19:30, 20:00', onChange: function(e){ dayText.current[dw] = e.target.value; setDayTimes(dw, e.target.value); } }));
                })),
              h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: '8px' } },
                Field('Đặt trước tối thiểu (giờ)', h('input', { type: 'number', min: 0, max: 72, value: B.minLeadHours || 3, onChange: function(e){ setD('booking.minLeadHours', Number(e.target.value) || 0); } })),
                Field('Lời mời (không bắt buộc)', h('input', { value: B.intro || '', placeholder: 'Thầy gọi điện, cùng xem kết quả chẩn đoán…', onChange: function(e){ setD('booking.intro', e.target.value); } }))),
              h('button', { type: 'button', className: 'btn btn-primary', onClick: function(){ save('Đã lưu khung giờ tư vấn.'); } }, '💾 Lưu khung giờ'))))),
      // ===== số liệu công khai
      Card('📊 Số liệu công khai trên trang chủ', 'PrepScholar thuyết phục bằng con số tiến bộ thật. Chỉ hiện số tính từ dữ liệu FaradayAI; tỉ lệ tăng điểm chỉ hiện khi đã so được ≥ 5 em.',
        h('div', null,
          h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
            Stat('Học sinh', fmtN(S.students)), Stat('Lượt bài đã chấm', fmtN(S.attempts)), Stat('Em tăng điểm (thi thử)', S.improvedPct != null ? Math.round(S.improvedPct) + '%' : '—', S.compared ? S.compared + ' lượt so sánh' : 'chưa có 2 kỳ thi thử', 'var(--good)'),
            Stat('Tăng TB', S.avgDelta != null ? (S.avgDelta >= 0 ? '+' : '') + fmt2(S.avgDelta) : '—', 'điểm / kỳ')),
          h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '8px', marginTop: '10px' } },
            Field('Ghi đè số học sinh (vd "45+ học sinh lớp 12")', h('input', { value: (draft.manual || {}).students || '', onChange: function(e){ setD('manual.students', e.target.value); } })),
            Field('Số liệu thêm — con số', h('input', { value: (draft.manual || {}).extraV || '', placeholder: 'vd 45 máy', onChange: function(e){ setD('manual.extraV', e.target.value); } })),
            Field('Số liệu thêm — mô tả', h('input', { value: (draft.manual || {}).extraL || '', placeholder: 'vd học online cùng lúc tại phòng máy, thầy giám sát trực tiếp', onChange: function(e){ setD('manual.extraL', e.target.value); } }))),
          h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '8px' } },
            Field('Tiêu đề khối', h('input', { value: draft.title || '', onChange: function(e){ setD('title', e.target.value); } })),
            Field('Mô tả ngắn', h('input', { value: draft.sub || '', onChange: function(e){ setD('sub', e.target.value); } }))),
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            h('button', { type: 'button', className: 'btn btn-secondary', onClick: recompute }, '🔄 Tính lại từ dữ liệu thật'),
            h('button', { type: 'button', className: 'btn btn-primary', onClick: function(){ save(); } }, '💾 Lưu & đăng')))),
      // ===== ảnh
      Card('📸 Ảnh lớp học thật (' + photos.filter(function(p){ return p.consent && p.visible !== false; }).length + ' đang hiện)', 'Squirrel AI luôn cho phụ huynh thấy học sinh thật đang học với AI. Ảnh chụp từ phía sau / nhìn màn hình là an toàn nhất; ảnh thấy rõ mặt các em cần được nhà trường và phụ huynh đồng ý — dùng "🫥 Làm mờ mặt" nếu chưa xin phép.',
        h('div', null,
          h('label', { className: 'btn btn-primary', style: { cursor: 'pointer', display: 'inline-block' } }, upBusy || '＋ Tải ảnh lên (chọn nhiều ảnh)', h('input', { type: 'file', accept: 'image/*', multiple: true, style: { display: 'none' }, onChange: onFiles })),
          h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: '10px', marginTop: '12px' } },
            photos.map(function(p, i){
              return h('div', { key: p.id, style: { border: '1px solid var(--line)', borderRadius: '10px', overflow: 'hidden', opacity: p.consent && p.visible !== false ? 1 : 0.7 } },
                h('img', { src: p.img, alt: '', style: { width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' } }),
                h('div', { style: { padding: '8px' } },
                  h('input', { defaultValue: p.caption || '', placeholder: 'Chú thích: vd 45 em 12E3 luyện đề online, thầy giám sát', onBlur: function(e){ if(e.target.value !== (p.caption || '')) O.proofPhotos.save(p.id, Object.assign({}, p, { caption: e.target.value.slice(0, 140) })); }, style: { width: '100%', boxSizing: 'border-box', fontSize: '0.8rem' } }),
                  h('label', { style: { display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.78rem', margin: '6px 0' } }, h('input', { type: 'checkbox', checked: !!p.consent, onChange: function(e){ O.proofPhotos.save(p.id, Object.assign({}, p, { consent: e.target.checked })); } }), 'Đã được đồng ý / đã làm mờ mặt → hiện trang chủ'),
                  h('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap' } },
                    h('button', { type: 'button', className: 'btn btn-secondary', style: { fontSize: '0.72rem', padding: '3px 8px' }, onClick: function(){ setBlurOf(p); } }, '🫥 Làm mờ mặt'),
                    i > 0 ? h('button', { type: 'button', className: 'btn btn-secondary', style: { fontSize: '0.72rem', padding: '3px 8px' }, onClick: function(){ var q = photos[i - 1]; O.proofPhotos.save(p.id, Object.assign({}, p, { order: q.order - 1 })); } }, '◀') : null,
                    h('button', { type: 'button', className: 'btn btn-secondary', style: { fontSize: '0.72rem', padding: '3px 8px' }, onClick: function(){ if(window.confirm('Xoá ảnh này?')) O.proofPhotos.remove(p.id); } }, 'Xoá'))));
            })))),
      // ===== câu chuyện
      Card('🚀 Câu chuyện tiến bộ (trước → sau)', 'Lấy từ bảng thi thử tháng (em tăng ≥ 1 điểm). Tên tự viết tắt; chỉ hiện khi tick "Phụ huynh đồng ý". Thêm 1 câu nhận xét của em hoặc phụ huynh (lấy từ khảo sát/Zalo, đúng lời thật).',
        h('div', null,
          sugg.length ? h('div', { style: { marginBottom: '10px' } }, h('b', { style: { fontSize: '0.84rem' } }, 'Gợi ý: '),
            sugg.slice(0, 8).map(function(x, k){ var s = byId[x.r.sid] || {}; return h('button', { key: k, type: 'button', className: 'eb-nano-chip', style: { margin: '3px' }, onClick: function(){ addStory(x); } }, '＋ ' + (s.name || x.r.name) + ' ' + fmt2(x.r.prev) + '→' + fmt2(x.r.score) + ' (+' + fmt2(x.r.delta) + ')'); })) :
            h('p', { style: { fontSize: '0.84rem', color: 'var(--ink-2)' } }, 'Chưa có gợi ý — cần ít nhất 2 kỳ thi thử tháng để so sánh. Có thể thêm tay bên dưới.'),
          (draft.stories || []).map(function(x, i){
            return h('div', { key: i, style: { display: 'grid', gridTemplateColumns: 'minmax(140px,1.2fr) 80px 80px minmax(160px,1.6fr) minmax(200px,2fr) auto', gap: '6px', alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--line)' } },
              h('input', { value: x.name, onChange: function(e){ setStory(i, 'name', e.target.value); } }),
              h('input', { type: 'number', step: 0.25, value: x.before, title: 'Trước', onChange: function(e){ setStory(i, 'before', Number(e.target.value)); } }),
              h('input', { type: 'number', step: 0.25, value: x.after, title: 'Sau', onChange: function(e){ setStory(i, 'after', Number(e.target.value)); } }),
              h('input', { value: x.period || '', placeholder: 'Giai đoạn', onChange: function(e){ setStory(i, 'period', e.target.value); } }),
              h('input', { value: x.quote || '', placeholder: 'Lời em/phụ huynh (đúng lời thật)', onChange: function(e){ setStory(i, 'quote', e.target.value); } }),
              h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', whiteSpace: 'nowrap', fontSize: '0.76rem' } },
                h('label', null, h('input', { type: 'checkbox', checked: !!x.consent, onChange: function(e){ setStory(i, 'consent', e.target.checked); } }), ' PH đồng ý'),
                h('button', { type: 'button', className: 'sm-link-btn', onClick: function(){ setD('stories', draft.stories.filter(function(_, k){ return k !== i; })); } }, '✕')));
          }),
          h('div', { style: { display: 'flex', gap: '8px', marginTop: '10px' } },
            h('button', { type: 'button', className: 'btn btn-secondary', onClick: function(){ setD('stories', (draft.stories || []).concat([{ name: 'Bạn ', lop: '', before: 5, after: 7, period: '', quote: '', consent: false, visible: true }])); } }, '＋ Thêm tay'),
            h('button', { type: 'button', className: 'btn btn-primary', onClick: function(){ save(); } }, '💾 Lưu & đăng')))),
      // ===== cam kết + ưu đãi
      Card('🛡️ Cam kết đầu ra & ưu đãi', 'PrepScholar bán bằng "Score Guarantee": giảm rủi ro cho phụ huynh khi quyết định. Viết điều kiện rõ ràng mà thầy chắc chắn làm được.',
        h('div', null,
          h('label', { style: { display: 'flex', gap: '6px', alignItems: 'center', fontWeight: 700, fontSize: '0.88rem', marginBottom: '8px' } }, h('input', { type: 'checkbox', checked: !!draft.guarantee.enabled, onChange: function(e){ setD('guarantee.enabled', e.target.checked); } }), 'Hiện cam kết trên trang chủ'),
          Field('Tiêu đề', h('input', { value: draft.guarantee.title, onChange: function(e){ setD('guarantee.title', e.target.value); } })),
          Field('Cam kết', h('textarea', { rows: 2, value: draft.guarantee.text, onChange: function(e){ setD('guarantee.text', e.target.value); }, style: { width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '0.9rem', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)' } })),
          Field('Điều kiện áp dụng', h('textarea', { rows: 2, value: draft.guarantee.terms, onChange: function(e){ setD('guarantee.terms', e.target.value); }, style: { width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '0.9rem', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)' } })),
          h('hr', { style: { border: 0, borderTop: '1px solid var(--line)', margin: '12px 0' } }),
          h('label', { style: { display: 'flex', gap: '6px', alignItems: 'center', fontWeight: 700, fontSize: '0.88rem', marginBottom: '8px' } }, h('input', { type: 'checkbox', checked: !!draft.offer.enabled, onChange: function(e){ setD('offer.enabled', e.target.checked); } }), 'Hiện ưu đãi có hạn (chỉ dùng khi đúng là có hạn thật)'),
          h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '8px' } },
            Field('Nội dung', h('input', { value: draft.offer.text, onChange: function(e){ setD('offer.text', e.target.value); } })),
            Field('Số suất còn lại', h('input', { value: draft.offer.seats, placeholder: 'vd 8', onChange: function(e){ setD('offer.seats', e.target.value); } })),
            Field('Đến hết ngày', h('input', { type: 'date', value: draft.offer.until, onChange: function(e){ setD('offer.until', e.target.value); } }))),
          h('button', { type: 'button', className: 'btn btn-primary', onClick: function(){ save(); } }, '💾 Lưu & đăng'),
          h('a', { className: 'btn btn-secondary', href: '/#ket-qua', target: '_blank', rel: 'noopener', style: { marginLeft: '8px', textDecoration: 'none' } }, '👀 Xem trang chủ'))),
      blurOf ? h(BlurEditor, { src: blurOf.img, onClose: function(){ setBlurOf(null); }, onSave: function(img){ O.proofPhotos.save(blurOf.id, Object.assign({}, blurOf, { img: img, blurred: true })).then(function(){ fire('Đã lưu ảnh đã làm mờ.'); setBlurOf(null); }); } }) : null);
  }

  window.OPC_SALES_ADMIN = { SalesPanel: SalesPanel };
})(window);
