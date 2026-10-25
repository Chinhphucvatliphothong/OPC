/**
 * sales-home.js — THÊM 24/10/2026 · trang chủ (index.html): các tính năng BÁN HÀNG học từ PrepScholar & Squirrel AI
 *  • "Kết quả thật" (PrepScholar: số liệu tiến bộ + câu chuyện trước→sau; Squirrel AI: hình ảnh lớp học AI thật):
 *    số liệu công khai do thầy cập nhật (settings/proof), ảnh lớp học (proof_photos), câu chuyện tiến bộ có sự đồng ý.
 *  • "Cam kết đầu ra" (PrepScholar Score Guarantee) — thầy bật/tắt, tự viết điều kiện.
 *  • Ưu đãi có hạn (số suất còn lại + hạn chót) — chỉ hiện khi thầy đặt.
 *  • "📅 Đặt lịch tư vấn 15 phút" (Squirrel AI: buổi tư vấn đọc báo cáo chẩn đoán cùng phụ huynh) → bookings.
 *  • Thanh CTA dính đáy màn hình trên điện thoại.
 * Mọi khối tự ẩn khi thầy chưa nhập dữ liệu — không bao giờ hiện số liệu giả.
 * Xuất: window.OPC_SALES = { openBooking(prefill) }
 */
(function(window){
  'use strict';
  var doc = window.document;
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtN(n){ return (Number(n) || 0).toLocaleString('vi-VN'); }
  function fmt2(n){ return (Math.round(Number(n) * 100) / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 }); }
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function ymd(d){ return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  var WD = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

  var CSS = [
    '#ket-qua .kq-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin-top:22px;}',
    '#ket-qua .kq-stat{background:var(--surface,#fff);border:1px solid var(--line,#e5e0d4);border-radius:14px;padding:16px 18px;}',
    '#ket-qua .kq-stat .v{font-family:Literata,serif;font-size:2rem;font-weight:700;color:var(--accent-strong,#8f5714);line-height:1.1;}',
    '#ket-qua .kq-stat .l{font-size:.85rem;color:var(--ink-2,#555);margin-top:4px;line-height:1.45;}',
    '#ket-qua .kq-gal{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:22px;}',
    '#ket-qua figure{margin:0;border-radius:14px;overflow:hidden;background:#000;position:relative;aspect-ratio:4/3;cursor:zoom-in;}',
    '#ket-qua figure img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s;} #ket-qua figure:hover img{transform:scale(1.03);}',
    '#ket-qua figcaption{position:absolute;left:0;right:0;bottom:0;padding:24px 12px 10px;background:linear-gradient(transparent,rgba(0,0,0,.72));color:#fff;font-size:.84rem;line-height:1.4;}',
    '#ket-qua .kq-stories{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;margin-top:22px;}',
    '#ket-qua .kq-story{background:var(--surface,#fff);border:1px solid var(--line,#e5e0d4);border-radius:14px;padding:16px;}',
    '#ket-qua .kq-jump{display:flex;align-items:baseline;gap:8px;font-family:Literata,serif;} #ket-qua .kq-jump .a{font-size:1.3rem;color:var(--ink-2,#666);} #ket-qua .kq-jump .b{font-size:2rem;font-weight:700;color:var(--ink,#111);}',
    '#ket-qua .kq-jump .d{margin-left:auto;font-family:"Be Vietnam Pro",sans-serif;font-weight:800;color:#15803d;background:rgba(22,163,74,.12);padding:3px 10px;border-radius:99px;font-size:.88rem;}',
    '#ket-qua .kq-story .who{font-weight:700;font-size:.92rem;margin-top:6px;} #ket-qua .kq-story .wh{font-size:.78rem;color:var(--ink-2,#666);} #ket-qua .kq-story q{display:block;font-size:.9rem;line-height:1.55;margin-top:8px;color:var(--ink-2,#444);font-style:italic;}',
    '#ket-qua .kq-guar{margin-top:22px;border:2px solid var(--accent,#b88a3e);border-radius:16px;padding:18px 20px;background:linear-gradient(135deg,rgba(201,162,95,.12),transparent 70%);display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;}',
    '#ket-qua .kq-guar .ic{font-size:2.2rem;} #ket-qua .kq-guar h3{margin:0 0 6px;font-size:1.15rem;} #ket-qua .kq-guar p{margin:0;font-size:.92rem;line-height:1.6;} #ket-qua .kq-guar small{display:block;margin-top:8px;color:var(--ink-2,#666);font-size:.8rem;line-height:1.5;}',
    '#ket-qua .kq-ctas{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px;align-items:center;}',
    '#ket-qua .kq-bk{background:transparent;border:1.5px solid var(--accent-strong,#8f5714);color:var(--accent-strong,#8f5714);font-weight:700;cursor:pointer;font-family:inherit;}',
    '#ket-qua .kq-bk:hover{background:var(--accent-strong,#8f5714);color:#fff;}',
    '.kq-offer{display:inline-flex;gap:8px;align-items:center;background:#fff7ed;color:#9a3412;border:1px solid #fdba74;border-radius:99px;padding:6px 14px;font-weight:700;font-size:.86rem;}',
    '[data-theme="dark"] .kq-offer{background:#3b2410;color:#fdba74;border-color:#9a3412;}',
    '.kq-lb{position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;padding:20px;cursor:zoom-out;} .kq-lb img{max-width:100%;max-height:100%;border-radius:8px;}',
    '.bk-ov{position:fixed;inset:0;z-index:5000;background:rgba(10,12,16,.55);display:flex;align-items:center;justify-content:center;padding:14px;}',
    '.bk-box{background:var(--surface,#fff);color:var(--ink,#111);border-radius:16px;width:min(560px,100%);max-height:92vh;overflow:auto;padding:20px 22px;box-shadow:0 30px 80px rgba(0,0,0,.35);position:relative;}',
    '.bk-box h3{margin:0 0 4px;font-size:1.2rem;} .bk-box p.s{margin:0 0 14px;font-size:.88rem;color:var(--ink-2,#555);line-height:1.5;}',
    '.bk-x{position:absolute;top:10px;right:12px;border:0;background:none;font-size:1.3rem;cursor:pointer;color:var(--ink-2,#666);}',
    '.bk-f{margin-bottom:10px;} .bk-f label{display:block;font-size:.82rem;font-weight:700;margin-bottom:4px;} .bk-f input,.bk-f textarea,.bk-f select{width:100%;box-sizing:border-box;border:1px solid var(--line,#ddd);border-radius:10px;padding:9px 11px;font:inherit;font-size:.92rem;background:var(--surface-2,#faf8f3);color:inherit;}',
    '.bk-days{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;} .bk-day{flex:none;border:1px solid var(--line,#ddd);background:transparent;color:inherit;border-radius:10px;padding:6px 10px;cursor:pointer;font-size:.8rem;text-align:center;line-height:1.3;} .bk-day b{display:block;font-size:.95rem;}',
    '.bk-day.on,.bk-slot.on{background:#b88a3e;border-color:#b88a3e;color:#fff;} .bk-slots{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;} .bk-slot{border:1px solid var(--line,#ddd);background:transparent;color:inherit;border-radius:99px;padding:6px 12px;cursor:pointer;font-size:.84rem;font-weight:700;}',
    '.bk-slot[disabled]{opacity:.35;cursor:not-allowed;text-decoration:line-through;}',
    '.bk-roles{display:flex;gap:6px;} .bk-roles button{flex:1;border:1px solid var(--line,#ddd);background:transparent;color:inherit;border-radius:10px;padding:8px;cursor:pointer;font-weight:700;font-size:.86rem;} .bk-roles button.on{background:#b88a3e;border-color:#b88a3e;color:#fff;}',
    '.bk-go{width:100%;border:0;background:#b88a3e;color:#fff;border-radius:12px;padding:12px;font-weight:800;font-size:1rem;cursor:pointer;margin-top:6px;} .bk-go[disabled]{opacity:.6;}',
    '.bk-err{color:#b91c1c;font-size:.84rem;min-height:1.1em;}',
    '.kq-sticky{position:fixed;left:0;right:0;bottom:0;z-index:900;display:none;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:var(--surface,#fff);border-top:1px solid var(--line,#ddd);box-shadow:0 -6px 20px rgba(0,0,0,.08);}',
    '.kq-sticky a,.kq-sticky button{flex:1;text-align:center;border-radius:12px;padding:11px 8px;font-weight:800;font-size:.9rem;text-decoration:none;border:1px solid #b88a3e;cursor:pointer;font-family:inherit;}',
    '.kq-sticky .p{background:#b88a3e;color:#fff;} .kq-sticky .g{background:transparent;color:var(--accent-strong,#8f5714);}',
    '@media (max-width:760px){ .kq-sticky.on{display:flex;} body.kq-has-sticky{padding-bottom:70px;} body.kq-has-sticky .dg-fab{display:none !important;} }',
    'body.student-logged-in .kq-sticky{display:none !important;}'
  ].join('\n');

  var cfg = null;
  function live(){ return window.OPC_LIVE || null; }
  function waitLive(){
    if(live()) return Promise.resolve(live());
    return new Promise(function(ok){
      var done = false;
      function fin(){ if(done) return; done = true; ok(live()); }
      window.addEventListener('opc-live-ready', fin);
      setTimeout(fin, 6000);
    });
  }

  // ------------------------------------------------------------ đặt lịch tư vấn
  function slotsFor(c, nDays){
    var out = [], now = new Date(), base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var days = (c && c.days) || {}, minLead = ((c && c.minLeadHours) || 3) * 3600000, taken = (c && c.taken) || {};
    for(var k = 0; k < (nDays || 10); k++){
      var d = new Date(base); d.setDate(base.getDate() + k);
      var times = days[d.getDay()] || [];
      var list = times.map(function(t){
        var p = String(t).split(':'), dt = new Date(d); dt.setHours(Number(p[0]) || 0, Number(p[1]) || 0, 0, 0);
        var key = ymd(d) + ' ' + t;
        return { key: key, t: t, ok: dt.getTime() - now.getTime() >= minLead && !taken[key] };
      });
      if(list.some(function(x){ return x.ok; })) out.push({ date: ymd(d), d: d, slots: list });
    }
    return out;
  }
  function openBooking(prefill){
    prefill = prefill || {};
    ensureCss();
    var c = (cfg && cfg.booking) || null;
    var days = c && c.enabled !== false ? slotsFor(c, 10) : [];
    var st = { role: prefill.role || 'ph', day: days[0] ? days[0].date : '', slot: '' };
    var ov = doc.createElement('div'); ov.className = 'bk-ov';
    function close(){ ov.remove(); }
    ov.addEventListener('click', function(e){ if(e.target === ov) close(); });
    function render(){
      var day = days.filter(function(x){ return x.date === st.day; })[0];
      ov.innerHTML = '<div class="bk-box" role="dialog" aria-label="Đặt lịch tư vấn"><button class="bk-x" data-a="x" aria-label="Đóng">×</button>' +
        '<h3>📅 Đặt lịch tư vấn 15 phút với thầy</h3>' +
        '<p class="s">' + esc((c && c.intro) || 'Thầy gọi điện cho phụ huynh/học sinh, cùng xem kết quả chẩn đoán và gợi ý lộ trình ôn thi phù hợp. Hoàn toàn miễn phí, không bắt buộc đăng ký học.') + '</p>' +
        '<div class="bk-f"><label>Người đặt lịch</label><div class="bk-roles"><button data-a="role" data-v="ph" class="' + (st.role === 'ph' ? 'on' : '') + '">👪 Phụ huynh</button><button data-a="role" data-v="hs" class="' + (st.role === 'hs' ? 'on' : '') + '">🎒 Học sinh</button></div></div>' +
        '<div class="bk-f"><label for="bk-name">Họ tên ' + (st.role === 'ph' ? 'phụ huynh' : 'học sinh') + ' *</label><input id="bk-name" value="' + esc(st.name != null ? st.name : (prefill.name && st.role === 'hs' ? prefill.name : '')) + '" maxlength="80" autocomplete="name"></div>' +
        (st.role === 'ph' ? '<div class="bk-f"><label for="bk-stu">Họ tên học sinh</label><input id="bk-stu" value="' + esc(st.stu != null ? st.stu : (prefill.name || '')) + '" maxlength="80"></div>' : '') +
        '<div class="bk-f"><label for="bk-phone">Số điện thoại / Zalo *</label><input id="bk-phone" type="tel" inputmode="tel" value="' + esc(st.phone != null ? st.phone : (prefill.phone || '')) + '" placeholder="09xxxxxxxx" maxlength="20" autocomplete="tel"></div>' +
        (days.length ? '<div class="bk-f"><label>Chọn giờ thầy gọi</label><div class="bk-days">' + days.map(function(x){
            return '<button class="bk-day' + (x.date === st.day ? ' on' : '') + '" data-a="day" data-v="' + x.date + '">' + WD[x.d.getDay()] + '<b>' + pad(x.d.getDate()) + '/' + pad(x.d.getMonth() + 1) + '</b></button>'; }).join('') + '</div>' +
            '<div class="bk-slots">' + (day ? day.slots.map(function(s2){ return '<button class="bk-slot' + (st.slot === s2.key ? ' on' : '') + '" data-a="slot" data-v="' + s2.key + '"' + (s2.ok ? '' : ' disabled') + '>' + s2.t + '</button>'; }).join('') : '') + '</div></div>'
          : '<div class="bk-f"><label for="bk-when">Thời gian thuận tiện để thầy gọi</label><input id="bk-when" value="' + esc(st.when || '') + '" placeholder="Vd: tối thứ 5 sau 19h" maxlength="80"></div>') +
        '<div class="bk-f"><label for="bk-note">Em/con đang cần hỗ trợ gì? (không bắt buộc)</label><textarea id="bk-note" rows="2" maxlength="400" placeholder="Vd: mục tiêu 8 điểm, yếu phần Từ trường…">' + esc(st.note != null ? st.note : (prefill.note || '')) + '</textarea></div>' +
        '<div class="bk-err" id="bk-err"></div>' +
        '<button class="bk-go" data-a="go">Xác nhận đặt lịch</button>' +
        '<p class="s" style="margin:10px 0 0;font-size:.78rem">Thông tin chỉ dùng để thầy liên hệ tư vấn, không chia sẻ cho bên thứ ba.</p></div>';
      ov.querySelectorAll('[data-a]').forEach(function(el){ el.addEventListener('click', act); });
    }
    function keep(){ ['name', 'stu', 'phone', 'note', 'when'].forEach(function(k){ var el = ov.querySelector('#bk-' + k); if(el) st[k] = el.value; }); }
    function act(e){
      var a = e.currentTarget.getAttribute('data-a'), v = e.currentTarget.getAttribute('data-v');
      if(a === 'x') return close();
      keep();
      if(a === 'role'){ st.role = v; return render(); }
      if(a === 'day'){ st.day = v; st.slot = ''; return render(); }
      if(a === 'slot'){ st.slot = v; return render(); }
      if(a === 'go') return submit(e.currentTarget);
    }
    function submit(btn){
      var err = ov.querySelector('#bk-err'), phone = String(st.phone || '').replace(/[\s.\-]/g, '');
      if(String(st.name || '').trim().length < 2){ err.textContent = 'Vui lòng nhập họ tên.'; return; }
      if(!/^(\+?84|0)\d{8,10}$/.test(phone)){ err.textContent = 'Số điện thoại chưa đúng (ví dụ 0912345678).'; return; }
      if(days.length && !st.slot){ err.textContent = 'Chọn một khung giờ để thầy gọi.'; return; }
      btn.disabled = true; btn.textContent = 'Đang gửi…';
      var L = live();
      var data = { role: st.role, name: String(st.name).trim(), student: String(st.stu || (st.role === 'hs' ? st.name : '') || '').trim(), phone: phone,
        slot: st.slot || '', when: String(st.when || '').trim(), note: String(st.note || '').trim(), source: prefill.source || 'home' };
      (L && L.submitBooking ? L.submitBooking(data) : Promise.resolve({ ok: false })).then(function(r){
        if(!r || !r.ok){ btn.disabled = false; btn.textContent = 'Xác nhận đặt lịch'; err.textContent = 'Chưa gửi được — thử lại, hoặc nhắn Zalo cho thầy.'; return; }
        var sl = st.slot ? st.slot.split(' ') : null, dd = sl ? sl[0].split('-') : null;
        ov.querySelector('.bk-box').innerHTML = '<button class="bk-x" data-a="x">×</button><h3>✅ Đã đặt lịch!</h3><p class="s" style="font-size:.95rem">' +
          (sl ? 'Thầy sẽ gọi số <b>' + esc(phone) + '</b> lúc <b>' + sl[1] + ', ' + dd[2] + '/' + dd[1] + '</b>.' : 'Thầy sẽ gọi số <b>' + esc(phone) + '</b> trong thời gian sớm nhất.') +
          ' Nếu cần đổi giờ, phụ huynh nhắn Zalo cho thầy nhé.</p>' +
          ((cfg && cfg.zaloLink) ? '<a class="bk-go" style="display:block;text-align:center;text-decoration:none" href="' + esc(cfg.zaloLink) + '" target="_blank" rel="noopener">💬 Nhắn Zalo thầy</a>' : '') +
          '<p class="s" style="margin-top:10px">Trong lúc chờ, em có thể làm <a href="#chan-doan" data-diag-open>bài chẩn đoán 5 phút</a> để buổi tư vấn đi thẳng vào điểm yếu.</p>';
        ov.querySelector('[data-a="x"]').addEventListener('click', close);
        try{ if(L.logDiagEvent) L.logDiagEvent('book'); }catch(e2){}
      });
    }
    render();
    doc.body.appendChild(ov);
    setTimeout(function(){ var el = ov.querySelector('#bk-name'); if(el) el.focus(); }, 50);
  }

  // ------------------------------------------------------------ khối "Kết quả thật"
  function ensureCss(){ if(doc.getElementById('kq-css')) return; var s = doc.createElement('style'); s.id = 'kq-css'; s.textContent = CSS; doc.head.appendChild(s); }
  function render(proof, photos){
    var sec = doc.getElementById('ket-qua'); if(!sec) return;
    var S = proof.stats || {}, stats = [];
    var M = proof.manual || {};
    function add(v, l){ if(v != null && v !== '' && v !== 0) stats.push([v, l]); }
    add(M.students || (S.students ? fmtN(S.students) : ''), 'học sinh đang luyện thi trên FaradayAI');
    add(S.attempts ? fmtN(S.attempts) : '', 'lượt làm bài đã chấm tự động');
    add(S.questions ? fmtN(S.questions) : '', 'câu hỏi đã luyện');
    add(S.improvedPct != null && S.compared >= 5 ? Math.round(S.improvedPct) + '%' : '', 'học sinh tăng điểm giữa 2 kỳ thi thử liên tiếp' + (S.compared ? ' (' + S.compared + ' em được so sánh)' : ''));
    add(S.avgDelta != null && S.compared >= 5 && S.avgDelta > 0 ? '+' + fmt2(S.avgDelta) : '', 'điểm tăng trung bình giữa 2 kỳ thi thử');
    add(M.extraV ? M.extraV : '', M.extraL || '');
    var stories = (proof.stories || []).filter(function(x){ return x && x.visible !== false && x.consent; });
    var g = proof.guarantee || {};
    var offer = proof.offer || {};
    var offerOn = offer.enabled && (!offer.until || offer.until >= ymd(new Date()));
    var pics = (photos || []).filter(function(p){ return p.visible !== false && p.consent && p.img; }).sort(function(a, b){ return (a.order || 0) - (b.order || 0); });
    if(!stats.length && !pics.length && !stories.length && !g.enabled){ sec.hidden = true; return; }
    var html = '<div class="wrap"><div class="kicker">' + esc(proof.kicker || 'Kết quả thật') + '</div>' +
      '<h2 class="section-title">' + esc(proof.title || 'Lớp học thật, tiến bộ đo được bằng số liệu') + '</h2>' +
      '<p class="section-sub">' + esc(proof.sub || 'Không phải lời quảng cáo — đây là số liệu FaradayAI ghi nhận từ chính các buổi học của học sinh.') + '</p>';
    if(stats.length) html += '<div class="kq-stats">' + stats.map(function(x){ return '<div class="kq-stat"><div class="v">' + esc(x[0]) + '</div><div class="l">' + esc(x[1]) + '</div></div>'; }).join('') + '</div>' +
      (S.updatedAt ? '<p style="font-size:.76rem;color:var(--muted,#888);margin-top:8px">Cập nhật ' + esc(new Date(S.updatedAt).toLocaleDateString('vi-VN')) + '</p>' : '');
    if(pics.length) html += '<div class="kq-gal">' + pics.slice(0, 6).map(function(p, i){ return '<figure data-i="' + i + '"><img loading="lazy" src="' + esc(p.img) + '" alt="' + esc(p.caption || 'Lớp học FaradayAI') + '">' + (p.caption ? '<figcaption>' + esc(p.caption) + '</figcaption>' : '') + '</figure>'; }).join('') + '</div>';
    if(stories.length) html += '<div class="kq-stories">' + stories.slice(0, 6).map(function(x){
      var d = Number(x.after) - Number(x.before);
      return '<div class="kq-story"><div class="kq-jump"><span class="a">' + fmt2(x.before) + '</span><span>→</span><span class="b">' + fmt2(x.after) + '</span>' + (d > 0 ? '<span class="d">+' + fmt2(d) + '</span>' : '') + '</div>' +
        '<div class="who">' + esc(x.name) + '</div><div class="wh">' + esc([x.lop, x.period].filter(Boolean).join(' · ')) + '</div>' + (x.quote ? '<q>' + esc(x.quote) + '</q>' : '') + '</div>'; }).join('') + '</div>';
    if(g.enabled) html += '<div class="kq-guar"><div class="ic">🛡️</div><div style="flex:1;min-width:240px"><h3>' + esc(g.title || 'Cam kết tiến bộ') + '</h3><p>' + esc(g.text || '') + '</p>' + (g.terms ? '<small>' + esc(g.terms) + '</small>' : '') + '</div></div>';
    html += '<div class="kq-ctas"><a class="btn btn-primary" href="#chan-doan" data-diag-open>⚡ Chẩn đoán miễn phí 5 phút</a>' +
      '<button type="button" class="btn kq-bk" data-book="home">📅 Đặt lịch tư vấn 15 phút</button>' +
      (offerOn ? '<span class="kq-offer">🔥 ' + esc(offer.text || 'Ưu đãi đăng ký sớm') + (offer.seats ? ' · còn ' + esc(offer.seats) + ' suất' : '') + (offer.until ? ' · đến ' + esc(offer.until.split('-').reverse().slice(0, 2).join('/')) : '') + '</span>' : '') + '</div></div>';
    sec.innerHTML = html; sec.hidden = false;
    sec.querySelectorAll('figure').forEach(function(f){ f.addEventListener('click', function(){ var p = pics[Number(f.getAttribute('data-i'))]; var lb = doc.createElement('div'); lb.className = 'kq-lb'; lb.innerHTML = '<img src="' + esc(p.img) + '" alt="">'; lb.addEventListener('click', function(){ lb.remove(); }); doc.body.appendChild(lb); }); });
  }
  function sticky(){
    if(doc.querySelector('.kq-sticky')) return;
    var b = doc.createElement('div'); b.className = 'kq-sticky on';
    b.innerHTML = '<a class="p" href="#chan-doan" data-diag-open>⚡ Chẩn đoán miễn phí</a><button type="button" class="g" data-book="sticky">📅 Tư vấn 15 phút</button>';
    doc.body.appendChild(b); doc.body.classList.add('kq-has-sticky');
  }
  doc.addEventListener('click', function(e){
    var t = e.target && e.target.closest ? e.target.closest('[data-book]') : null;
    if(t){ e.preventDefault(); openBooking({ source: t.getAttribute('data-book') || 'home' }); }
  });
  if(/#tu-van\b/.test(location.hash)) setTimeout(function(){ openBooking({ source: 'link' }); }, 900);

  function init(){
    ensureCss();
    waitLive().then(function(L){
      if(!L || !L.loadProof) return;
      L.loadProof().then(function(r){
        cfg = r.proof || {};
        render(cfg, r.photos || []);
        if(cfg.booking && cfg.booking.enabled !== false && cfg.stickyCta !== false) sticky();
      });
    });
  }
  window.OPC_SALES = { openBooking: openBooking, _slotsFor: slotsFor };
  if(doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(window);
