/**
 * admin-ops.js — THÊM 20/10/2026 · công cụ VẬN HÀNH cho thầy (nạp trong admin.html, sau React, trước script chính)
 *  1) LINK TIẾN ĐỘ PHỤ HUYNH: mỗi em 1 link riêng /phuhuynh?t=<mã 24 ký tự> — điểm dự đoán (khoảng + độ tin cậy), bản đồ
 *     lỗ hổng (nano-point đỏ/vàng/xanh), lỗ hổng đã vá 30 ngày, biểu đồ điểm & bài thi thử, nhận xét của thầy.
 *     Dữ liệu là "ảnh chụp" ghi vào parent_views/{mã} (phụ huynh chỉ đọc được đúng link của con; thầy "Đổi link" để thu hồi).
 *  2) HỌC PHÍ: bảng giá 3 gói (settings/billing), mỗi em: gói · cách đóng (tháng/quý/trọn lộ trình/học thử/miễn phí) ·
 *     đã đóng tới ngày · lịch sử đóng · nhắc Zalo (soạn sẵn tin nhắn).
 *  3) VIỆC HÔM NAY: gom mọi cảnh báo thành 1 danh sách "hôm nay cần làm gì với ai" (học phí, nhắc học, cần hỗ trợ,
 *     điểm tụt, đề giao chưa làm, gửi link phụ huynh, khách mới) — tích "Xong" để ẩn trong ngày.
 * Xuất: window.OPC_OPS = { TodayPanel, BillingPanel, ParentLinkBox, refreshParentView, buildParentSnapshot }
 */
(function(window){
  'use strict';
  var React = window.React; if(!React){ console.error('[admin-ops] Chưa nạp React'); return; }
  var h = React.createElement;

  // ------------------------------------------------------------------ tiện ích
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function ymd(d){ d = d ? new Date(d) : new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseYmd(s){ if(!s) return null; var p = String(s).slice(0, 10).split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]); return isNaN(d) ? null : d; }
  function vnDate(s){ var d = parseYmd(s) || (s ? new Date(s) : null); return d && !isNaN(d) ? pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() : '—'; }
  function daysFromToday(s){ var d = parseYmd(s); if(!d) return null; var t = parseYmd(ymd()); return Math.round((d - t) / 86400000); }
  function addMonths(s, n){ var d = parseYmd(s) || parseYmd(ymd()); var day = d.getDate(); d.setMonth(d.getMonth() + n); if(d.getDate() < day) d.setDate(0); return ymd(d); }
  function monthsUntil(examYmd){ var e = parseYmd(examYmd), t = parseYmd(ymd()); if(!e || e <= t) return 1; return Math.max(1, Math.ceil((e - t) / (30.44 * 86400000))); }
  function vnd(n){ n = Math.round(Number(n) || 0); return n.toLocaleString('vi-VN') + 'đ'; }
  function zalo(phone){ var n = String(phone || '').replace(/[\s.\-()]/g, ''); if(n.indexOf('+84') === 0) n = '84' + n.slice(3); else if(n.indexOf('0') === 0) n = '84' + n.slice(1); return n ? 'https://zalo.me/' + n : ''; }
  // SỬA 20/10/2026: hiển thị SĐT dễ đọc 0912 345 678 + link gọi
  function phoneDigits(p){ return String(p || '').replace(/[^\d+]/g, ''); }
  function fmtPhone(p){ var d = String(p || '').replace(/\D/g, ''); if(d.indexOf('84') === 0 && d.length >= 11) d = '0' + d.slice(2); return d.length === 10 ? d.slice(0, 4) + ' ' + d.slice(4, 7) + ' ' + d.slice(7) : (d || String(p || '')); }
  function copy(text){ try{ if(navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text); }catch(e){} var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); }catch(e){} ta.remove(); return Promise.resolve(); }
  function token(){ var a = new Uint8Array(24); (window.crypto || window.msCrypto).getRandomValues(a); return Array.prototype.map.call(a, function(x){ return 'abcdefghijkmnpqrstuvwxyz23456789'[x % 32]; }).join('').slice(0, 24); }
  function origin(){ var o = location.origin; return (o && o !== 'null') ? o : 'https://faradayai.vn'; }
  function parentUrl(t){ return origin() + '/phuhuynh?t=' + t; }
  function lastName(n){ var p = String(n || '').trim().split(/\s+/); return p[p.length - 1] || n || 'em'; }

  // ------------------------------------------------------------------ 1) ảnh chụp tiến độ cho phụ huynh
  var TOPIC_NAMES = { 'nhiet': 'Vật lí nhiệt', 'khi': 'Khí lí tưởng', 'tu-truong': 'Từ trường', 'hat-nhan': 'Vật lí hạt nhân' };
  function nanoInfo(id){
    var N = window.OPC_NANO, n = N && N.getNano ? N.getNano(id) : null;
    var bai = n && N.getBai ? N.getBai(n.baiKey) : null;
    return { id: id, name: n ? n.name : id, bai: bai ? bai.name : '', topic: bai ? bai.chuDeKey : String(id).split('-')[0] };
  }
  function buildParentSnapshot(stu, attempts){
    var E = window.PrepScholarEngine;
    attempts = (attempts || []).slice().sort(function(a, b){ return new Date(a.createdAt) - new Date(b.createdAt); });
    var st = E.computeStudentStatsFromAttempts(attempts);
    var pr = st.prediction || null;
    var now = Date.now();
    var old = E.computeStudentStatsFromAttempts(attempts.filter(function(a){ return new Date(a.createdAt).getTime() < now - 30 * 86400000; }));
    var nm = st.nanoMastery || {}, om = old.nanoMastery || {};
    var ids = Object.keys(nm);
    var red = [], yellow = [], green = 0;
    ids.forEach(function(id){
      var v = nm[id], c = E.classifyMastery(v), info = nanoInfo(id);
      info.v = Math.round(v);
      if(c === 'red') red.push(info); else if(c === 'yellow') yellow.push(info); else if(c === 'green') green++;
    });
    red.sort(function(a, b){ return a.v - b.v; }); yellow.sort(function(a, b){ return a.v - b.v; });
    // lỗ hổng đã vá trong 30 ngày: 30 ngày trước đang Đỏ (hoặc chưa kiểm tra mà nay vững), nay đã ≥ 50
    var fixed = ids.filter(function(id){ return om[id] != null && om[id] < 50 && nm[id] >= 50; }).map(function(id){ return nanoInfo(id).name; });
    var finals = attempts.filter(function(a){ return !a.partial && isFinite(Number(a.scaledScore10)); });
    var scores = finals.slice(-40).map(function(a){
      var nq = (a.wrongQuestions || []).length + (a.rightQuestions || []).length;
      var parts = {}; (a.wrongQuestions || []).concat(a.rightQuestions || []).forEach(function(r){ parts[r.part || 'I'] = 1; });
      return { d: ymd(a.createdAt), s: Math.round(Number(a.scaledScore10) * 100) / 100, n: nq, full: nq >= 22 && !!parts.II && !!parts.III,
        t: String(a.examTitle || a.title || ({ exam: 'Thi thử', diagnostic: 'Kiểm tra đầu vào', drill: 'Luyện chuyên đề', adaptive: 'Luyện thích ứng', assigned: 'Đề thầy giao', paper: 'Bài làm trên giấy', mistakes: 'Ôn câu sai' }[a.type] || 'Bài luyện')).slice(0, 60) };
    });
    var wk = attempts.filter(function(a){ return new Date(a.createdAt).getTime() >= now - 7 * 86400000; });
    var wkQ = wk.reduce(function(s, a){ return s + (a.wrongQuestions || []).length + (a.rightQuestions || []).length; }, 0);
    var wkF = wk.filter(function(a){ return !a.partial && isFinite(Number(a.scaledScore10)); });
    var topics = {};
    Object.keys(TOPIC_NAMES).forEach(function(k){ if(st.mastery && st.mastery[k] != null) topics[k] = { name: TOPIC_NAMES[k], pct: st.mastery[k] }; });
    var focus = red.slice(0, 3).map(function(x){ return x.name + (x.bai ? ' (' + x.bai.replace(/^Bài \d+:\s*/, '') + ')' : ''); });
    return {
      v: 1, studentId: stu.id, name: stu.name || '', school: stu.school && stu.school !== 'Chưa cập nhật' ? stu.school : '', lop: stu.lop || '',
      target: Number(stu.targetScore) || null, updatedAt: new Date().toISOString(),
      predicted: pr && pr.predicted != null ? { p: pr.predicted, low: pr.low, high: pr.high, conf: pr.confidence, parts: pr.parts, tips: pr.tips || [], cov: pr.coverage, n: pr.nItems } : null,
      reason: pr && pr.predicted == null ? (pr.reason || '') : '',
      avg: st.completedExamsCount ? st.averageScore : null, completed: st.completedExamsCount || 0,
      week: { attempts: wk.length, questions: wkQ, avg: wkF.length ? Math.round(wkF.reduce(function(s, a){ return s + Number(a.scaledScore10); }, 0) / wkF.length * 10) / 10 : null },
      scores: scores, topics: topics,
      gaps: { red: red.slice(0, 10), yellow: yellow.slice(0, 8), green: green, tested: ids.length, total: (window.OPC_NANO && window.OPC_NANO.NANO ? window.OPC_NANO.NANO.length : 0), fixed30: fixed.slice(0, 12), fixed30Count: fixed.length },
      focus: focus, note: String(stu.parentNote || '').slice(0, 1200),
      mistakes: st.mistakeTotal != null ? st.mistakeTotal : (st.mistakeLog || []).length
    };
  }
  async function refreshParentView(stu, opts){
    opts = opts || {};
    var OPC = window.OPC;
    var attempts = await OPC.attempts.loadForStudent(stu.id);
    var snap = buildParentSnapshot(stu, attempts);
    var t = (!opts.newToken && stu.parentViewToken) || token();
    if(opts.zaloLink) snap.zalo = opts.zaloLink;
    await OPC.parentViews.save(t, snap);
    var patch = { parentViewToken: t, parentViewUpdatedAt: snap.updatedAt };
    if(opts.newToken && stu.parentViewToken && stu.parentViewToken !== t){ try{ await OPC.parentViews.remove(stu.parentViewToken); }catch(e){} }
    await OPC.students.update(stu.id, patch);
    return { token: t, url: parentUrl(t), snap: snap };
  }
  function parentMsg(stu, url){
    return 'Kính gửi phụ huynh em ' + (stu.name || '') + ',\nThầy gửi trang theo dõi tiến độ học Vật lí của con trên FaradayAI (điểm dự đoán, những phần con còn hổng và đã vá được, kết quả các bài thi thử). Phụ huynh mở xem bất cứ lúc nào, thầy cập nhật hằng tuần:\n' + url;
  }

  function useZaloLink(){
    var st = React.useState(''); var z = st[0], setZ = st[1];
    React.useEffect(function(){
      var OPC = window.OPC; if(!OPC || !OPC.diag5 || !OPC.diag5.subscribeConfig) return;
      return OPC.diag5.subscribeConfig(function(d){ setZ((d && d.zaloLink) || ''); }, function(){});
    }, []);
    return z;
  }

  // Khối trong Hồ sơ học sinh
  function ParentLinkBox(props){
    var stu = props.student, fire = props.fireToast || function(){};
    var busyState = React.useState(false); var busy = busyState[0], setBusy = busyState[1];
    var noteState = React.useState(stu.parentNote || ''); var note = noteState[0], setNote = noteState[1];
    var zl = useZaloLink();
    React.useEffect(function(){ setNote(stu.parentNote || ''); }, [stu.id]);
    var t = stu.parentViewToken, url = t ? parentUrl(t) : '';
    async function run(newToken){
      if(busy) return; setBusy(true);
      try{
        if(note !== (stu.parentNote || '')) await window.OPC.students.update(stu.id, { parentNote: note });
        var r = await refreshParentView(Object.assign({}, stu, { parentNote: note }), { newToken: newToken, zaloLink: zl });
        fire(newToken ? 'Đã đổi link mới — link cũ không mở được nữa.' : 'Đã cập nhật trang tiến độ của ' + stu.name + '.');
        if(props.onUpdated) props.onUpdated(r);
      }catch(e){ console.error(e); fire('Không cập nhật được: ' + (e && e.message ? e.message : 'lỗi') + ' (đã Publish firestore.rules mới chưa?)', true); }
      setBusy(false);
    }
    var age = stu.parentViewUpdatedAt ? Math.floor((Date.now() - new Date(stu.parentViewUpdatedAt).getTime()) / 86400000) : null;
    return h('div', { className: 'sm-info-block' },
      h('div', { className: 'sm-info-title' }, '👪 Trang tiến độ cho phụ huynh'),
      h('p', { style: { fontSize: '0.82rem', color: 'var(--ink-2)', margin: '0 0 8px' } },
        t ? ('Cập nhật lần cuối: ' + vnDate(stu.parentViewUpdatedAt) + (age != null ? ' (' + (age === 0 ? 'hôm nay' : age + ' ngày trước') + ')' : '') + '. Phụ huynh chỉ thấy số liệu tới lần cập nhật này.')
          : 'Chưa có link. Bấm "Tạo link" — mỗi em 1 link riêng, phụ huynh mở xem không cần đăng nhập.'),
      h('label', { style: { display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink-2)', marginBottom: '4px' } }, 'Nhận xét của thầy (hiện trên trang phụ huynh)'),
      h('textarea', { value: note, rows: 3, maxLength: 1200, onChange: function(e){ setNote(e.target.value); }, placeholder: 'Vd: Tuần này con làm bài đều, đã vững phần Khí lí tưởng. Tuần sau thầy tập trung câu Đúng/Sai phần Từ trường.',
        style: { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', font: '0.86rem "Be Vietnam Pro",sans-serif' } }),
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' } },
        h('button', { type: 'button', className: 'btn btn-primary', disabled: busy, onClick: function(){ run(false); } }, busy ? 'Đang cập nhật…' : (t ? '🔄 Cập nhật số liệu' : '🔗 Tạo link')),
        t ? h('button', { type: 'button', className: 'btn btn-secondary', onClick: function(){ copy(url).then(function(){ fire('Đã chép link.'); }); } }, '📋 Chép link') : null,
        t ? h('a', { className: 'btn btn-secondary', href: url, target: '_blank', rel: 'noopener', style: { textDecoration: 'none' } }, '👀 Xem như phụ huynh') : null,
        (t && stu.parentPhone) ? h('button', { type: 'button', className: 'btn btn-secondary', onClick: function(){ copy(parentMsg(stu, url)).then(function(){ fire('Đã chép tin nhắn — dán vào Zalo phụ huynh.'); window.open(zalo(stu.parentPhone), '_blank'); }); } }, '💬 Gửi Zalo phụ huynh') : null,
        t ? h('button', { type: 'button', className: 'btn btn-secondary', disabled: busy, title: 'Tạo link mới, link cũ hết hiệu lực (vd. lỡ gửi nhầm người)', onClick: function(){ if(window.confirm('Đổi link mới? Link cũ sẽ không mở được nữa.')) run(true); } }, '♻ Đổi link') : null));
  }

  // ------------------------------------------------------------------ 2) học phí
  // SỬA 20/10/2026 — GỘP BẢNG GIÁ: gói & giá (tháng / trọn khóa), ngày thi, % giảm lấy từ settings/pricing (tab 💰 Gói dịch vụ
  // — cùng bảng giá trang chủ). settings/billing chỉ còn: thông tin chuyển khoản + số ngày nhắc trước hạn.
  var DEFAULT_BILLING = { plans: [], quarterOff: 10, fullOff: 20, examDate: '2027-06-11', bankInfo: '', remindDays: 5 };
  var CYCLES = { month: 'Theo tháng', full: 'Trọn khóa (đến kỳ thi)', quarter: 'Theo quý (3 tháng)', trial: 'Học thử', free: 'Miễn phí' };
  function tiersToPlans(tiers){
    var idf = window.OPC_pricingTierId || function(t, i){ return (t && t.id) || ('g' + (i + 1)); };
    return (tiers || []).map(function(t, i){ return { key: idf(t, i), name: t.name || ('Gói ' + (i + 1)), monthly: Number(t.price) || 0, full: Number(t.fullPrice) || 0, visible: t.visible !== false }; });
  }
  function mergeBilling(bill, pricing){
    var pr = pricing || {}, tiers = (Array.isArray(pr.tiers) && pr.tiers.length) ? pr.tiers : (window.OPC_defaultPricingTiers ? window.OPC_defaultPricingTiers() : []);
    return Object.assign({}, DEFAULT_BILLING, bill || {}, {
      plans: tiersToPlans(tiers),
      examDate: pr.examDate || (bill && bill.examDate) || DEFAULT_BILLING.examDate,
      fullOff: pr.fullOff != null ? Number(pr.fullOff) : ((bill && bill.fullOff != null) ? bill.fullOff : DEFAULT_BILLING.fullOff),
      quarterOff: pr.quarterOff != null ? Number(pr.quarterOff) : ((bill && bill.quarterOff != null) ? bill.quarterOff : DEFAULT_BILLING.quarterOff)
    });
  }
  function useBilling(){
    var st = React.useState(null); var cfg = st[0], setCfg = st[1];
    React.useEffect(function(){
      var OPC = window.OPC; if(!OPC || !OPC.billingSettings) { setCfg(mergeBilling(null, null)); return; }
      var bill = null, pricing = null, got = { b: 0, p: 0 };
      function emit(){ if(got.b && got.p) setCfg(mergeBilling(bill, pricing)); }
      var u1 = OPC.billingSettings.subscribe(function(d){ bill = d || null; got.b = 1; emit(); }, function(){ got.b = 1; emit(); });
      var u2 = OPC.pricing ? OPC.pricing.subscribe(function(d){ pricing = d || null; got.p = 1; emit(); }, function(){ got.p = 1; emit(); }) : (got.p = 1, function(){});
      emit();
      return function(){ try{ u1(); }catch(e){} try{ u2(); }catch(e){} };
    }, []);
    return cfg;
  }
  function planOf(cfg, key){ return (cfg.plans || []).filter(function(p){ return p.key === key; })[0] || null; }
  function cycleMonths(cfg, cycle){ return cycle === 'quarter' ? 3 : (cycle === 'full' ? monthsUntil(cfg.examDate) : 1); }
  function cycleFee(cfg, b){
    if(!b || !b.plan) return 0;
    if(b.customFee) return Number(b.customFee) || 0;
    var p = planOf(cfg, b.plan); var base = p ? Number(p.monthly) || 0 : 0;
    var m = cycleMonths(cfg, b.cycle);
    if(b.cycle === 'full' && p && Number(p.full) > 0) return Number(p.full);   // giá trọn khóa cố định của gói
    var off = b.cycle === 'quarter' ? cfg.quarterOff : (b.cycle === 'full' ? cfg.fullOff : 0);
    return Math.round(base * m * (1 - (Number(off) || 0) / 100) / 1000) * 1000;
  }
  function billingStatus(cfg, b){
    if(!b || !b.plan) return { k: 'none', t: 'Chưa thiết lập', c: 'var(--muted)' };
    if(b.cycle === 'free') return { k: 'free', t: 'Miễn phí', c: 'var(--muted)' };
    if(b.cycle === 'trial'){
      var dt = daysFromToday(b.trialEnd);
      if(dt == null) return { k: 'trial', t: 'Học thử', c: 'var(--accent)' };
      return dt < 0 ? { k: 'trialEnd', t: 'Hết học thử ' + (-dt) + ' ngày', c: 'var(--critical)', d: dt } : { k: 'trial', t: 'Học thử · còn ' + dt + ' ngày', c: 'var(--accent)', d: dt };
    }
    var d = daysFromToday(b.paidUntil);
    if(d == null) return { k: 'unpaid', t: 'Chưa đóng', c: 'var(--critical)' };
    if(d < 0) return { k: 'overdue', t: 'Quá hạn ' + (-d) + ' ngày', c: 'var(--critical)', d: d };
    if(d <= (Number(cfg.remindDays) || 5)) return { k: 'due', t: 'Đến hạn sau ' + d + ' ngày', c: 'var(--warning)', d: d };
    return { k: 'ok', t: 'Đã đóng tới ' + vnDate(b.paidUntil), c: 'var(--good)', d: d };
  }
  function billingMsg(cfg, stu){
    var b = stu.billing || {}, p = planOf(cfg, b.plan), fee = cycleFee(cfg, b);
    var st = billingStatus(cfg, b);
    var when = b.cycle === 'trial' ? ('kết thúc học thử ngày ' + vnDate(b.trialEnd)) : ('hạn đóng ngày ' + vnDate(b.paidUntil));
    return 'Kính gửi phụ huynh em ' + (stu.name || '') + ',\nThầy xin nhắc học phí FaradayAI kỳ tới của con' + (p ? ' (gói ' + p.name + ', ' + (CYCLES[b.cycle === 'trial' ? 'month' : b.cycle] || '').toLowerCase() + ')' : '') +
      ' là ' + vnd(fee || (p ? p.monthly : 0)) + ', ' + when + (st.k === 'overdue' ? ' (đã quá hạn ' + (-st.d) + ' ngày)' : '') + '.' +
      (cfg.bankInfo ? '\nThông tin chuyển khoản: ' + cfg.bankInfo + '\nNội dung CK: ' + (stu.name || '') + ' - FaradayAI' : '') +
      (stu.parentViewToken ? '\nTiến độ học của con: ' + parentUrl(stu.parentViewToken) : '') + '\nThầy cảm ơn phụ huynh!';
  }

  function Modal(props){
    return h('div', { className: 'sm-overlay', onClick: function(e){ if(e.target === e.currentTarget) props.onClose(); } },
      h('div', { className: 'sm-modal', role: 'dialog', 'aria-modal': 'true', style: { maxWidth: '520px' } },
        h('div', { className: 'sm-modal-head' }, h('h3', null, props.title), h('button', { type: 'button', className: 'sm-modal-close', onClick: props.onClose }, '✕')),
        props.children));
  }
  function Field(label, el){ return h('div', { className: 'sm-field', style: { marginBottom: '10px' } }, h('label', null, label), el); }

  function PlanModal(props){
    var cfg = props.cfg, stu = props.student, b0 = stu.billing || {};
    var st = React.useState(function(){ var d14 = new Date(); d14.setDate(d14.getDate() + 14);
      return { plan: b0.plan || ((cfg.plans || [])[0] || {}).key || '', cycle: b0.cycle || 'trial', startDate: b0.startDate || ymd(), trialEnd: b0.trialEnd || ymd(d14), customFee: b0.customFee || '', paidUntil: b0.paidUntil || '' }; });
    var f = st[0], setF = st[1];
    function set(k, v){ setF(function(p){ var n = Object.assign({}, p); n[k] = v; return n; }); }
    var fee = cycleFee(cfg, f);
    return h(Modal, { title: 'Gói học của ' + stu.name, onClose: props.onClose },
      Field('Gói', h('select', { value: f.plan, onChange: function(e){ set('plan', e.target.value); } }, (cfg.plans || []).map(function(p){ return h('option', { key: p.key, value: p.key }, p.name + (p.visible ? '' : ' (ẩn khỏi trang chủ)') + (p.monthly ? ' — ' + vnd(p.monthly) + '/tháng' : '') + (cycleFee(cfg, { plan: p.key, cycle: 'full' }) ? ' · trọn khóa ' + vnd(cycleFee(cfg, { plan: p.key, cycle: 'full' })) : '')); }))),
      Field('Cách đóng', h('select', { value: f.cycle, onChange: function(e){ set('cycle', e.target.value); } }, Object.keys(CYCLES).map(function(k){ return h('option', { key: k, value: k }, CYCLES[k]); }))),
      Field('Ngày bắt đầu học', h('input', { type: 'date', value: f.startDate, onChange: function(e){ set('startDate', e.target.value); } })),
      f.cycle === 'trial' ? Field('Học thử đến ngày', h('input', { type: 'date', value: f.trialEnd, onChange: function(e){ set('trialEnd', e.target.value); } })) : null,
      (f.cycle !== 'trial' && f.cycle !== 'free') ? Field('Học phí mỗi kỳ (để trống = tính theo bảng giá: ' + vnd(cycleFee(cfg, Object.assign({}, f, { customFee: '' }))) + ')',
        h('input', { type: 'number', min: 0, step: 10000, value: f.customFee, placeholder: 'tự tính', onChange: function(e){ set('customFee', e.target.value); } })) : null,
      (f.cycle !== 'trial' && f.cycle !== 'free') ? Field('Đã đóng tới ngày (sửa tay nếu cần)', h('input', { type: 'date', value: f.paidUntil, onChange: function(e){ set('paidUntil', e.target.value); } })) : null,
      (f.cycle !== 'trial' && f.cycle !== 'free') ? h('p', { style: { fontSize: '0.85rem', color: 'var(--ink-2)' } }, 'Mỗi kỳ ' + cycleMonths(cfg, f.cycle) + ' tháng · học phí ' + vnd(fee) + (f.cycle === 'full' ? ' (đến kỳ thi ' + vnDate(cfg.examDate) + ')' : '')) : null,
      h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' } },
        h('button', { type: 'button', className: 'btn btn-secondary', onClick: props.onClose }, 'Huỷ'),
        h('button', { type: 'button', className: 'btn btn-primary', onClick: function(){
          var nb = Object.assign({}, b0, { plan: f.plan, cycle: f.cycle, startDate: f.startDate, trialEnd: f.cycle === 'trial' ? f.trialEnd : (b0.trialEnd || null), customFee: f.customFee ? Number(f.customFee) : null, paidUntil: f.paidUntil || null, payments: b0.payments || [] });
          window.OPC.students.update(stu.id, { billing: nb }).then(function(){ props.fireToast('Đã lưu gói học của ' + stu.name + '.'); props.onClose(); })
            .catch(function(e){ props.fireToast('Không lưu được: ' + (e && e.message), true); });
        } }, 'Lưu')));
  }
  function PayModal(props){
    var cfg = props.cfg, stu = props.student, b = stu.billing || {};
    var cyc = (b.cycle === 'trial' || b.cycle === 'free' || !b.cycle) ? 'month' : b.cycle;
    var st = React.useState({ cycle: cyc, months: cycleMonths(cfg, cyc), amount: cycleFee(cfg, Object.assign({}, b, { cycle: cyc })) || '', date: ymd(), note: '' });
    var f = st[0], setF = st[1];
    function set(k, v){ setF(function(p){ var n = Object.assign({}, p); n[k] = v; return n; }); }
    var from = (b.paidUntil && daysFromToday(b.paidUntil) >= 0) ? b.paidUntil : f.date;
    var until = f.cycle === 'full' ? cfg.examDate : addMonths(from, Number(f.months) || 1);
    return h(Modal, { title: '💵 Ghi nhận đóng học phí — ' + stu.name, onClose: props.onClose },
      Field('Đóng theo', h('select', { value: f.cycle, onChange: function(e){ var c = e.target.value; setF(function(p){ return Object.assign({}, p, { cycle: c, months: cycleMonths(cfg, c), amount: cycleFee(cfg, Object.assign({}, b, { cycle: c })) || p.amount }); }); } },
        ['month', 'quarter', 'full'].map(function(k){ return h('option', { key: k, value: k }, CYCLES[k]); }))),
      f.cycle !== 'full' ? Field('Số tháng', h('input', { type: 'number', min: 1, max: 12, value: f.months, onChange: function(e){ set('months', e.target.value); } })) : null,
      Field('Số tiền đã nhận (đ)', h('input', { type: 'number', min: 0, step: 10000, value: f.amount, onChange: function(e){ set('amount', e.target.value); } })),
      Field('Ngày nhận', h('input', { type: 'date', value: f.date, onChange: function(e){ set('date', e.target.value); } })),
      Field('Ghi chú (vd. chuyển khoản VCB)', h('input', { value: f.note, onChange: function(e){ set('note', e.target.value); } })),
      h('p', { style: { fontSize: '0.86rem' } }, 'Sau khi ghi nhận: đã đóng tới ', h('b', null, vnDate(until))),
      h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } },
        h('button', { type: 'button', className: 'btn btn-secondary', onClick: props.onClose }, 'Huỷ'),
        h('button', { type: 'button', className: 'btn btn-success', onClick: function(){
          var amt = Number(f.amount) || 0;
          if(amt <= 0 && !window.confirm('Số tiền bằng 0 — vẫn ghi nhận?')) return;
          var pays = (b.payments || []).concat([{ date: f.date, amount: amt, months: f.cycle === 'full' ? monthsUntil(cfg.examDate) : Number(f.months) || 1, cycle: f.cycle, note: String(f.note || '').slice(0, 120) }]).slice(-60);
          var nb = Object.assign({}, b, { plan: b.plan || ((cfg.plans || [])[0] || {}).key || '', cycle: f.cycle, paidUntil: until, payments: pays, startDate: b.startDate || f.date });
          window.OPC.students.update(stu.id, { billing: nb }).then(function(){ props.fireToast('Đã ghi nhận ' + vnd(amt) + ' của ' + stu.name + ' — đóng tới ' + vnDate(until) + '.'); props.onClose(); })
            .catch(function(e){ props.fireToast('Không lưu được: ' + (e && e.message), true); });
        } }, 'Ghi nhận')));
  }

  function useStudents(){
    var st = React.useState(null); var list = st[0], setList = st[1];
    var ss = React.useState({}); var stats = ss[0], setStats = ss[1];
    React.useEffect(function(){
      var OPC = window.OPC; if(!OPC) return;
      var u1 = OPC.students.subscribe(function(snap){ setList(snap.docs.map(function(d){ return Object.assign({}, d.data() || {}, { id: d.id }); })); }, function(){ setList([]); });
      var u2 = OPC.studentStats.subscribe(function(snap){ var m = {}; snap.docs.forEach(function(d){ m[d.id] = d.data() || {}; }); setStats(m); }, function(){});
      return function(){ u1(); u2(); };
    }, []);
    return { list: list, stats: stats };
  }

  function BillingPanel(props){
    var cfg = useBilling(), S = useStudents(), fire = props.fireToast;
    var editState = React.useState(null); var edit = editState[0], setEdit = editState[1];
    var payState = React.useState(null); var pay = payState[0], setPay = payState[1];
    var draftState = React.useState(null); var draft = draftState[0], setDraft = draftState[1];
    var filterState = React.useState('all'); var filter = filterState[0], setFilter = filterState[1];
    var showSetState = React.useState(false); var showSet = showSetState[0], setShowSet = showSetState[1];
    React.useEffect(function(){ if(cfg && !draft) setDraft({ bankInfo: cfg.bankInfo || '', remindDays: cfg.remindDays || 5 }); }, [cfg]);
    if(!cfg || !S.list) return h('div', { className: 'card' }, h('p', { style: { color: 'var(--ink-2)' } }, 'Đang tải…'));
    var rows = S.list.filter(function(s){ return s.status !== 'inactive'; }).map(function(s){ return { s: s, st: billingStatus(cfg, s.billing) }; });
    var order = { overdue: 0, trialEnd: 1, unpaid: 2, due: 3, trial: 4, ok: 5, none: 6, free: 7 };
    rows.sort(function(a, b){ return (order[a.st.k] - order[b.st.k]) || String(a.s.name).localeCompare(String(b.s.name), 'vi'); });
    var shown = rows.filter(function(r){ return filter === 'all' || (filter === 'attention' ? ['overdue', 'trialEnd', 'unpaid', 'due'].indexOf(r.st.k) > -1 : r.st.k === filter); });
    var month = ymd().slice(0, 7);
    var collected = 0, payingCount = 0;
    S.list.forEach(function(s){ (s.billing && s.billing.payments || []).forEach(function(p){ if(String(p.date).slice(0, 7) === month) collected += Number(p.amount) || 0; }); });
    rows.forEach(function(r){ if(['ok', 'due', 'overdue'].indexOf(r.st.k) > -1) payingCount++; });
    var monthlyRevenue = rows.reduce(function(sum, r){ var b = r.s.billing; if(!b || ['ok', 'due', 'overdue'].indexOf(r.st.k) < 0) return sum; var f = cycleFee(cfg, b); return sum + f / cycleMonths(cfg, b.cycle); }, 0);
    var cnt = function(k){ return rows.filter(function(r){ return r.st.k === k; }).length; };
    function stat(label, val, sub){ return h('div', { style: { flex: '1 1 140px', background: 'var(--surface-2)', borderRadius: '10px', padding: '10px 12px' } },
      h('div', { style: { fontSize: '0.75rem', color: 'var(--ink-2)', fontWeight: 700 } }, label), h('div', { style: { fontSize: '1.35rem', fontWeight: 800 } }, val), sub ? h('div', { style: { fontSize: '0.74rem', color: 'var(--ink-2)' } }, sub) : null); }
    function setD(k, v){ setDraft(function(d){ var n = Object.assign({}, d); n[k] = v; return n; }); }
    var noPrices = !(cfg.plans || []).some(function(p){ return Number(p.monthly) > 0; });
    return h('div', null,
      h('div', { className: 'card' },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center' } },
          h('div', null, h('h3', { style: { margin: 0 } }, '💳 Học phí'), h('p', { className: 'sm-sub', style: { margin: '4px 0 0' } }, 'Gói học, cách đóng, đã đóng tới ngày nào — tự nhắc em sắp đến hạn. Ghi nhận bằng tay khi phụ huynh chuyển khoản.')),
          h('button', { type: 'button', className: 'btn btn-secondary', onClick: function(){ setShowSet(!showSet); } }, showSet ? 'Đóng bảng giá' : '⚙️ Bảng giá & cài đặt nhắc phí')),
        noPrices ? h('div', { className: 'banner warn', style: { marginTop: '10px' } }, h('span', null, '⚠️'), h('div', null, 'Chưa có giá gói nào — nhập ở tab 💰 Gói dịch vụ.')) : null,
        showSet && draft ? h('div', { style: { marginTop: '12px', borderTop: '1px solid var(--line)', paddingTop: '12px' } },
          // SỬA 20/10/2026 — gói & giá chỉ xem ở đây; sửa ở tab 💰 Gói dịch vụ (bảng giá chung với trang chủ)
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' } },
            h('b', null, 'Bảng giá (chung với trang chủ) · trọn khóa đến ' + vnDate(cfg.examDate) + ', còn ' + monthsUntil(cfg.examDate) + ' tháng'),
            props.onGoPricing ? h('button', { type: 'button', className: 'btn btn-secondary', onClick: props.onGoPricing }, '✏️ Sửa gói & giá ở 💰 Gói dịch vụ') : null),
          h('div', { className: 'sm-table-wrap', style: { marginTop: 0 } }, h('table', { className: 'sm-table' },
            h('thead', null, h('tr', null, ['Gói', 'Theo tháng', 'Theo quý', 'Trọn khóa', 'Tiết kiệm trọn khóa', 'Trang chủ'].map(function(t){ return h('th', { key: t }, t); }))),
            h('tbody', null, (cfg.plans || []).map(function(p){
              var m = monthsUntil(cfg.examDate), ff = cycleFee(cfg, { plan: p.key, cycle: 'full' }), save = p.monthly * m - ff;
              return h('tr', { key: p.key }, h('td', null, h('b', null, p.name)), h('td', null, vnd(p.monthly)), h('td', null, vnd(cycleFee(cfg, { plan: p.key, cycle: 'quarter' }))),
                h('td', null, vnd(ff), p.full ? null : h('span', { style: { fontSize: '0.72rem', color: 'var(--muted)' } }, ' (tự tính −' + cfg.fullOff + '%)')),
                h('td', null, save > 0 ? vnd(save) + ' (' + Math.round(save / (p.monthly * m) * 100) + '%)' : '—'),
                h('td', null, p.visible ? '✓ hiện' : h('span', { style: { color: 'var(--muted)' } }, 'ẩn')));
            })))),
          h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '10px', marginTop: '10px' } },
            Field('Nhắc trước hạn (ngày)', h('input', { type: 'number', min: 1, max: 15, value: draft.remindDays, onChange: function(e){ setD('remindDays', Number(e.target.value) || 5); } }))),
          Field('Thông tin chuyển khoản (đưa vào tin nhắn nhắc học phí)', h('input', { value: draft.bankInfo, placeholder: 'Vd: Vietcombank 0123456789 — NGUYEN VAN A', onChange: function(e){ setD('bankInfo', e.target.value); } })),
          h('p', { style: { fontSize: '0.8rem', color: 'var(--ink-2)' } }, 'Em vào học giữa năm hoặc được giá riêng: bấm nút "Gói" của em đó và sửa "Học phí mỗi kỳ".'),
          h('button', { type: 'button', className: 'btn btn-primary', onClick: function(){ window.OPC.billingSettings.save({ bankInfo: draft.bankInfo || '', remindDays: Number(draft.remindDays) || 5 }).then(function(){ fire('Đã lưu bảng giá.'); setShowSet(false); }).catch(function(e){ fire('Không lưu được: ' + (e && e.message), true); }); } }, '💾 Lưu bảng giá')) : null,
        h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' } },
          stat('Đang đóng phí', payingCount + ' em', cnt('trial') + ' em học thử'),
          stat('Đã thu tháng ' + month.slice(5) + '/' + month.slice(0, 4), vnd(collected)),
          stat('Doanh thu ước tính / tháng', vnd(monthlyRevenue), 'quy đổi gói quý/trọn khóa ra tháng'),
          stat('Cần xử lý', (cnt('overdue') + cnt('trialEnd') + cnt('unpaid') + cnt('due')) + ' em', cnt('overdue') + ' quá hạn · ' + cnt('due') + ' sắp đến hạn'))),
      h('div', { className: 'card' },
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' } },
          [['all', 'Tất cả'], ['attention', 'Cần xử lý'], ['trial', 'Học thử'], ['ok', 'Đã đóng'], ['none', 'Chưa thiết lập']].map(function(x){
            return h('button', { key: x[0], type: 'button', className: 'eb-nano-chip' + (filter === x[0] ? ' active' : ''), onClick: function(){ setFilter(x[0]); } }, x[1]); })),
        h('div', { className: 'sm-table-wrap', style: { marginTop: 0 } }, h('table', { className: 'sm-table' },
          h('thead', null, h('tr', null, ['Học sinh', 'Gói', 'Cách đóng', 'Học phí/kỳ', 'Trạng thái', 'Lần đóng gần nhất', ''].map(function(t){ return h('th', { key: t }, t); }))),
          h('tbody', null, shown.map(function(r){
            var s = r.s, b = s.billing || {}, p = planOf(cfg, b.plan), last = (b.payments || [])[(b.payments || []).length - 1];
            return h('tr', { key: s.id },
              h('td', null, h('b', null, s.name), h('div', { style: { fontSize: '0.75rem', color: 'var(--muted)' } }, (s.lop ? 'Lớp ' + s.lop + ' · ' : '') + (s.parentPhone ? 'PH ' + s.parentPhone : 'chưa có SĐT phụ huynh'))),
              h('td', null, p ? p.name : '—'),
              h('td', null, b.cycle ? CYCLES[b.cycle] : '—'),
              h('td', null, (b.cycle && b.cycle !== 'trial' && b.cycle !== 'free') ? vnd(cycleFee(cfg, b)) : '—'),
              h('td', null, h('span', { style: { fontWeight: 700, color: r.st.c } }, r.st.t)),
              h('td', null, last ? vnDate(last.date) + ' · ' + vnd(last.amount) : '—'),
              h('td', { style: { whiteSpace: 'nowrap' } },
                h('button', { type: 'button', className: 'btn btn-success', style: { fontSize: '0.75rem', padding: '4px 9px' }, onClick: function(){ setPay(s); } }, '💵 Đóng tiền'), ' ',
                h('button', { type: 'button', className: 'btn btn-secondary', style: { fontSize: '0.75rem', padding: '4px 9px' }, onClick: function(){ setEdit(s); } }, 'Gói'), ' ',
                (s.parentPhone && ['overdue', 'due', 'trialEnd', 'unpaid'].indexOf(r.st.k) > -1) ? h('button', { type: 'button', className: 'btn btn-secondary', style: { fontSize: '0.75rem', padding: '4px 9px' }, title: 'Chép tin nhắn nhắc học phí rồi mở Zalo phụ huynh',
                  onClick: function(){ copy(billingMsg(cfg, s)).then(function(){ fire('Đã chép tin nhắn — dán vào Zalo.'); window.open(zalo(s.parentPhone), '_blank'); }); } }, '💬 Nhắc') : null));
          }))))),
      edit ? h(PlanModal, { cfg: cfg, student: edit, fireToast: fire, onClose: function(){ setEdit(null); } }) : null,
      pay ? h(PayModal, { cfg: cfg, student: pay, fireToast: fire, onClose: function(){ setPay(null); } }) : null);
  }

  // ------------------------------------------------------------------ 3) việc hôm nay
  function doneKey(){ return 'opc-today-done-' + ymd(); }
  function loadDone(){ try{ return JSON.parse(localStorage.getItem(doneKey()) || '{}') || {}; }catch(e){ return {}; } }
  function saveDone(m){ try{ localStorage.setItem(doneKey(), JSON.stringify(m)); }catch(e){} }
  function TodayPanel(props){
    var cfg = useBilling(), S = useStudents(), fire = props.fireToast, zl = useZaloLink();
    var leadsState = React.useState([]); var leads = leadsState[0], setLeads = leadsState[1];
    var regsState = React.useState([]); var regs = regsState[0], setRegs = regsState[1];
    var doneState = React.useState(loadDone); var done = doneState[0], setDone = doneState[1];
    var showDoneState = React.useState(false); var showDone = showDoneState[0], setShowDone = showDoneState[1];
    var payState = React.useState(null); var pay = payState[0], setPay = payState[1];
    var busyState = React.useState({}); var busy = busyState[0], setBusy = busyState[1];
    React.useEffect(function(){
      var OPC = window.OPC, us = [];
      if(OPC.diag5 && OPC.diag5.subscribeLeads) us.push(OPC.diag5.subscribeLeads(function(snap){ setLeads(snap.docs.map(function(d){ return Object.assign({ id: d.id }, d.data()); })); }, function(){}));
      if(OPC.registrations) us.push(OPC.registrations.subscribe(function(snap){ setRegs(snap.docs.map(function(d){ return Object.assign({ id: d.id }, d.data()); })); }, function(){}));
      return function(){ us.forEach(function(u){ try{ u(); }catch(e){} }); };
    }, []);
    if(!cfg || !S.list) return h('div', { className: 'card' }, h('p', { style: { color: 'var(--ink-2)' } }, 'Đang tải…'));
    function mark(id){ var n = Object.assign({}, done); if(n[id]) delete n[id]; else n[id] = 1; setDone(n); saveDone(n); }
    var items = []; // { id, group, icon, who, why, actions:[h…], prio }
    var nowMs = Date.now();
    // Khi thầy đã bắt đầu gắn gói học: chỉ nhắc các em có gói (đóng phí / học thử) — tài khoản miễn phí cả lớp (vd. 12E3)
    // không làm danh sách dài vô ích. Chưa em nào có gói thì vẫn nhắc tất cả.
    var anyPlan = S.list.some(function(s){ return s.billing && s.billing.plan; });
    S.list.filter(function(s){ return s.status !== 'inactive'; }).forEach(function(s){
      var st = S.stats[s.id] || {}, b = s.billing || {}, bs = billingStatus(cfg, b);
      var paying = b.plan ? b.cycle !== 'free' : !anyPlan;
      // học phí
      if(['overdue', 'trialEnd', 'unpaid'].indexOf(bs.k) > -1 || (bs.k === 'due' && bs.d <= 3) || (bs.k === 'trial' && bs.d != null && bs.d <= 2)){
        items.push({ id: 'fee-' + s.id + '-' + (b.paidUntil || b.trialEnd || ''), group: 'fee', prio: bs.k === 'overdue' ? 0 : 1, icon: '💳', who: s,
          why: (bs.k === 'trial' || bs.k === 'trialEnd') ? (bs.t + ' — mời phụ huynh buổi chốt / đăng ký gói') : ('Học phí: ' + bs.t),
          actions: [
            s.parentPhone ? h('button', { key: 'z', type: 'button', className: 'btn btn-secondary', onClick: function(){ copy(billingMsg(cfg, s)).then(function(){ fire('Đã chép tin nhắn — dán vào Zalo.'); window.open(zalo(s.parentPhone), '_blank'); }); } }, '💬 Nhắc phụ huynh') : null,
            h('button', { key: 'p', type: 'button', className: 'btn btn-success', onClick: function(){ setPay(s); } }, '💵 Đã nhận tiền')] });
      }
      // nhắc học: không hoạt động ≥ 3 ngày
      var last = [st.lastActivityAt, st.updatedAt].filter(Boolean).map(function(x){ return new Date(x).getTime(); }).filter(isFinite);
      var lastMs = last.length ? Math.max.apply(null, last) : null;
      var idle = lastMs ? Math.floor((nowMs - lastMs) / 86400000) : null;
      if(paying && (idle == null || idle >= 3)){
        items.push({ id: 'idle-' + s.id + '-' + ymd(), group: 'learn', prio: 2, icon: '⏰', who: s,
          why: idle == null ? 'Chưa làm bài nào trên FaradayAI' : (idle + ' ngày chưa làm bài'),
          actions: [ s.phone ? h('a', { key: 'z', className: 'btn btn-secondary', href: zalo(s.phone), target: '_blank', rel: 'noopener', style: { textDecoration: 'none' } }, '💬 Nhắn em') : null,
            s.parentPhone ? h('a', { key: 'zp', className: 'btn btn-secondary', href: zalo(s.parentPhone), target: '_blank', rel: 'noopener', style: { textDecoration: 'none' } }, '💬 Báo phụ huynh') : null] });
      }
      // cần thầy hỗ trợ
      var hn = st.helpNeeded || {};
      Object.keys(hn).filter(function(k){ return hn[k]; }).forEach(function(k){
        items.push({ id: 'help-' + s.id + '-' + k, group: 'help', prio: 1, icon: '🆘', who: s, why: 'Luyện 3 lượt vẫn chưa đạt: ' + (hn[k].name || k) + (hn[k].part ? ' (Phần ' + hn[k].part + ')' : '') + ' — giảng riêng ở buổi tới',
          actions: [h('button', { key: 'c', type: 'button', className: 'btn btn-secondary', onClick: function(){ window.OPC.studentStats.clearHelp(s.id, k).then(function(){ fire('Đã gỡ.'); }); } }, '✓ Đã hỗ trợ')] });
      });
      // điểm tụt
      if(st.recentTrend === 'down'){
        items.push({ id: 'down-' + s.id + '-' + ymd().slice(0, 8), group: 'help', prio: 2, icon: '📉', who: s,
          why: 'Điểm tụt gần đây (TB ' + (st.priorAvgScore != null ? Number(st.priorAvgScore).toFixed(1) : '—') + ' → ' + (st.recentAvgScore != null ? Number(st.recentAvgScore).toFixed(1) : '—') + ') — hỏi han, xem lại bài', actions: [] });
      }
      // đề giao chưa làm
      var pend = (Number(st.assignedExamsCount) || 0) - (Number(st.assignedExamsCompletedCount) || 0);
      if(pend > 0 && (idle == null || idle >= 2)){
        items.push({ id: 'ae-' + s.id + '-' + pend, group: 'learn', prio: 3, icon: '📋', who: s, why: pend + ' đề thầy giao chưa làm', actions: [] });
      }
      // link phụ huynh chưa có / cũ quá 7 ngày (chỉ em có đóng phí / học thử)
      var pvAge = s.parentViewUpdatedAt ? Math.floor((nowMs - new Date(s.parentViewUpdatedAt).getTime()) / 86400000) : null;
      if(paying && b.plan && (pvAge == null || pvAge >= 7)){
        items.push({ id: 'pv-' + s.id + '-' + (s.parentViewUpdatedAt || 'none'), group: 'parent', prio: 3, icon: '👪', who: s,
          why: pvAge == null ? 'Chưa gửi trang tiến độ cho phụ huynh' : ('Trang tiến độ đã ' + pvAge + ' ngày chưa cập nhật'),
          actions: [h('button', { key: 'u', type: 'button', className: 'btn btn-primary', disabled: !!busy[s.id], onClick: function(){
            setBusy(function(p){ var n = Object.assign({}, p); n[s.id] = 1; return n; });
            refreshParentView(s, { zaloLink: zl }).then(function(r){
              if(s.parentPhone){ copy(parentMsg(s, r.url)).then(function(){ fire('Đã cập nhật + chép tin nhắn — dán vào Zalo phụ huynh.'); window.open(zalo(s.parentPhone), '_blank'); }); }
              else { copy(r.url); fire('Đã cập nhật — đã chép link (em chưa có SĐT phụ huynh).'); }
            }).catch(function(e){ fire('Không cập nhật được: ' + (e && e.message) + ' (đã Publish firestore.rules mới chưa?)', true); })
              .then(function(){ setBusy(function(p){ var n = Object.assign({}, p); delete n[s.id]; return n; }); });
          } }, busy[s.id] ? 'Đang cập nhật…' : '🔄 Cập nhật & gửi Zalo')] });
      }
    });
    leads.filter(function(l){ return (l.status || 'new') === 'new'; }).forEach(function(l){
      items.push({ id: 'lead-' + l.id, group: 'sales', prio: 0, icon: '🌱', who: { name: l.name, lop: l.grade }, phone: l.phone,
        why: 'Khách Chẩn đoán 5 phút: ' + l.correct + '/' + l.total + ' câu' + (l.weak ? ' · yếu: ' + l.weak : '') + ' — gọi tư vấn trong 24 giờ',
        actions: [h('a', { key: 't', className: 'btn btn-primary', href: 'tel:' + phoneDigits(l.phone), style: { textDecoration: 'none' } }, '📞 Gọi ' + fmtPhone(l.phone)),
          h('button', { key: 'cp', type: 'button', className: 'btn btn-secondary', onClick: function(){ copy(String(l.phone || '').replace(/\D/g, '')).then(function(){ fire('Đã chép số ' + fmtPhone(l.phone) + '.'); }); } }, '📋 Chép số'),
          h('a', { key: 'z', className: 'btn btn-secondary', href: zalo(l.phone), target: '_blank', rel: 'noopener', style: { textDecoration: 'none' } }, '💬 Zalo'),
          h('button', { key: 'c', type: 'button', className: 'btn btn-secondary', onClick: function(){ window.OPC.diag5.updateLead(l.id, { status: 'contacted' }).then(function(){ fire('Đã chuyển sang "Đã liên hệ".'); }); } }, '✓ Đã liên hệ')] });
    });
    regs.filter(function(r){ return r.status === 'pending'; }).forEach(function(r){
      var rp = r.phone || r.parentZalo;
      items.push({ id: 'reg-' + r.id, group: 'sales', prio: 0, icon: '📝', who: { name: r.name }, phone: r.phone, phone2: r.parentZalo && r.parentZalo !== r.phone ? r.parentZalo : null,
        why: 'Đăng ký học trên trang chủ — duyệt ở tab "Học sinh"',
        actions: [rp ? h('a', { key: 't', className: 'btn btn-primary', href: 'tel:' + phoneDigits(rp), style: { textDecoration: 'none' } }, '📞 Gọi ' + fmtPhone(rp)) : null,
          r.parentZalo ? h('a', { key: 'z', className: 'btn btn-secondary', href: zalo(r.parentZalo), target: '_blank', rel: 'noopener', style: { textDecoration: 'none' } }, '💬 Zalo phụ huynh') : null] });
    });
    var GROUPS = [['sales', '🌱 Khách mới & đăng ký'], ['fee', '💳 Học phí'], ['help', '🆘 Cần thầy hỗ trợ'], ['learn', '⏰ Nhắc học'], ['parent', '👪 Gửi tiến độ cho phụ huynh']];
    var total = items.length, doneN = items.filter(function(it){ return done[it.id]; }).length;
    var d = new Date(), wd = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'][d.getDay()];
    return h('div', null,
      h('div', { className: 'card' },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } },
          h('div', null, h('h3', { style: { margin: 0 } }, '📌 Việc hôm nay — ' + wd + ', ' + vnDate(ymd())),
            h('p', { className: 'sm-sub', style: { margin: '4px 0 0' } }, total ? ('Còn ' + (total - doneN) + '/' + total + ' việc. Tích ✓ khi xong — danh sách tự làm mới mỗi ngày.') : 'Hôm nay không có việc nào cần làm 🎉')),
          h('label', { style: { fontSize: '0.84rem', display: 'flex', gap: '6px', alignItems: 'center' } }, h('input', { type: 'checkbox', checked: showDone, onChange: function(e){ setShowDone(e.target.checked); } }), 'Hiện việc đã xong')),
        total ? h('div', { style: { height: '8px', background: 'var(--surface-2)', borderRadius: '99px', overflow: 'hidden', marginTop: '10px' } },
          h('div', { style: { width: Math.round(doneN / total * 100) + '%', height: '100%', background: 'var(--good)', transition: 'width .3s' } })) : null),
      GROUPS.map(function(g){
        var list = items.filter(function(it){ return it.group === g[0] && (showDone || !done[it.id]); }).sort(function(a, b){ return a.prio - b.prio; });
        var all = items.filter(function(it){ return it.group === g[0]; });
        if(!all.length) return null;
        return h('div', { key: g[0], className: 'card' },
          h('h4', { style: { margin: '0 0 8px' } }, g[1] + ' (' + all.filter(function(it){ return !done[it.id]; }).length + ')'),
          !list.length ? h('p', { style: { color: 'var(--ink-2)', fontSize: '0.86rem', margin: 0 } }, 'Đã xong hết ✓') :
          list.map(function(it){
            var isDone = !!done[it.id];
            return h('div', { key: it.id, style: { display: 'flex', gap: '10px', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--line)', opacity: isDone ? 0.5 : 1, flexWrap: 'wrap' } },
              h('input', { type: 'checkbox', checked: isDone, onChange: function(){ mark(it.id); }, title: 'Đánh dấu đã xong hôm nay', style: { width: '20px', height: '20px', flex: 'none' } }),
              h('span', { style: { fontSize: '1.1rem', flex: 'none' } }, it.icon),
              h('div', { style: { flex: '1 1 260px', minWidth: 0 } },
                h('b', null, it.who.name || '—'), it.who.lop ? h('span', { style: { color: 'var(--muted)', fontSize: '0.8rem' } }, ' · ' + it.who.lop) : null,
                it.phone ? h('a', { href: 'tel:' + phoneDigits(it.phone), style: { marginLeft: '8px', fontWeight: 800, fontSize: '1rem', color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' } }, '☎ ' + fmtPhone(it.phone)) : null,
                it.phone2 ? h('a', { href: 'tel:' + phoneDigits(it.phone2), style: { marginLeft: '8px', fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink-2)', textDecoration: 'none', whiteSpace: 'nowrap' } }, 'PH ' + fmtPhone(it.phone2)) : null,
                h('div', { style: { fontSize: '0.84rem', color: 'var(--ink-2)', textDecoration: isDone ? 'line-through' : 'none' } }, it.why)),
              h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, (it.actions || []).filter(Boolean)));
          }));
      }),
      pay ? h(PayModal, { cfg: cfg, student: pay, fireToast: fire, onClose: function(){ setPay(null); } }) : null);
  }

  window.OPC_OPS = { TodayPanel: TodayPanel, BillingPanel: BillingPanel, ParentLinkBox: ParentLinkBox,
    refreshParentView: refreshParentView, buildParentSnapshot: buildParentSnapshot, billingStatus: billingStatus, _u: { cycleFee: cycleFee, monthsUntil: monthsUntil, addMonths: addMonths } };
})(window);
