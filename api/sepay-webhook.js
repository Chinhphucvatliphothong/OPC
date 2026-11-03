// ================= FaradayAI — NHẬN TIỀN TỰ ĐỘNG qua SePay (webhook) =================
// THÊM 29/10/2026. Khi phụ huynh quét VietQR và chuyển khoản, SePay đọc biến động số dư của tài khoản ngân hàng rồi
// gọi POST vào đây. Hàm này: (1) kiểm tra khoá API, (2) tìm học sinh theo MÃ trong nội dung chuyển khoản (vd. FDY7K3QX),
// (3) cộng kỳ học phí vào students/{id}.billing (đã đóng tới ngày…), (4) ghi sổ payments/sepay_<id> (chống ghi trùng),
// (5) cập nhật trang phụ huynh. TOÀN BỘ logic nằm trong MỘT file này (không cần thư mục lib/). Giao dịch không khớp / thiếu tiền / chưa thiết lập gói được GHI SỔ để thầy xử lý trong admin.
// Biến môi trường (Vercel → Settings → Environment Variables):
//   SEPAY_API_KEY             — khoá API đặt khi tạo webhook ở SePay (SePay gửi kèm header  Authorization: Apikey <khoá>)
//   FIREBASE_SERVICE_ACCOUNT_JSON — đã có sẵn (dùng chung với api/student-login.js), không cần thêm
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ===== Khởi tạo Firebase Admin — dùng CHUNG biến FIREBASE_SERVICE_ACCOUNT_JSON đã có (api/student-login.js cũng dùng) =====
function loadCredentials(){
  var raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
  if(!raw) throw new Error('Thiếu biến môi trường FIREBASE_SERVICE_ACCOUNT_JSON.');
  var json;
  try{ json = JSON.parse(raw); }
  catch(e){ json = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')); }
  if(json.private_key) json.private_key = String(json.private_key).replace(/\\n/g, '\n');
  return json;
}
function getDb(){
  if(!getApps().length) initializeApp({ credential: cert(loadCredentials()) });
  return getFirestore();
}

// ===== Logic thuần của cổng thanh toán (quy ước dữ liệu: xem admin-ops.js › BillingPanel) =====
// students/{id}.payCode = "FDY"+5 ký tự; billing.pay = { amount, months, cycle, fixedUntil? } = số tiền & kỳ KỲ TỚI; billing.credit = tiền dư/thiếu cộng dồn.
var CODE_PREFIX = 'FDY';

function vnToday(nowMs){ return new Date((nowMs == null ? Date.now() : nowMs) + 7 * 3600 * 1000).toISOString().slice(0, 10); }
function parseYmd(s){ var p = String(s).slice(0, 10).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
function addMonths(s, n){
  var d = parseYmd(s), day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + n);
  if(d.getUTCDate() < day) d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

// Tìm mã học sinh trong giao dịch: ưu tiên trường "code" SePay đã tách, sau đó quét nội dung chuyển khoản.
function extractCode(body){
  var re = new RegExp(CODE_PREFIX + '[A-Z0-9]{5}', 'i');
  var cands = [body && body.code, body && body.content, body && body.description];
  for(var i = 0; i < cands.length; i++){
    var t = String(cands[i] == null ? '' : cands[i]).toUpperCase();
    var m = t.match(re) || t.replace(/[^A-Z0-9]/g, '').match(re);   // ngân hàng đôi khi chèn dấu cách / ký tự lạ
    if(m) return m[0].toUpperCase();
  }
  return '';
}

// Tính kết quả khi nhận `amount` đồng cho học sinh có `billing`. Không ghi gì cả.
function planPayment(billing, amount, today){
  var b = billing || {}, pay = b.pay;
  amount = Math.round(Number(amount) || 0);
  if(!pay || !(Number(pay.amount) > 0)) return { status: 'needs_setup' };
  var per = Number(pay.amount), credit = Math.max(0, Number(b.credit) || 0), total = amount + credit, TOL = 1000;
  var n = Math.floor((total + TOL) / per);
  if(n < 1) return { status: 'partial', credit: total };
  if(pay.cycle === 'full') n = 1;
  n = Math.min(n, 12);
  var months = pay.cycle === 'full' ? null : (Number(pay.months) || 1) * n;
  var from = (b.paidUntil && String(b.paidUntil).slice(0, 10) >= today) ? String(b.paidUntil).slice(0, 10) : today;
  var until = pay.cycle === 'full' ? (pay.fixedUntil || addMonths(from, 12)) : addMonths(from, months);
  return { status: 'applied', periods: n, months: months, cycle: pay.cycle || 'month', until: until, leftover: Math.max(0, total - n * per) };
}

// Số tiền khớp "ưu đãi" gói nào (trong sai số tol) → trả ưu đãi sát nhất
function matchOffer(offers, total, tol){
  var best = null, bd = 1e18;
  (Array.isArray(offers) ? offers : []).forEach(function(o){
    var d = Math.abs(Number(o && o.amount) - total);
    if(o && Number(o.amount) > 0 && d <= tol && d < bd){ best = o; bd = d; }
  });
  return best;
}

function safeEqual(a, b){
  a = String(a || ''); b = String(b || '');
  if(a.length !== b.length) return false;
  var r = 0; for(var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}


async function handle(req, res, db, FV, nowMs){
  if(req.method !== 'POST'){ res.status(405).json({ success: false, error: 'Chỉ hỗ trợ POST.' }); return; }
  var key = process.env.SEPAY_API_KEY;
  if(!key){ res.status(500).json({ success: false, error: 'Server chưa cấu hình SEPAY_API_KEY.' }); return; }
  var auth = String((req.headers && (req.headers.authorization || req.headers.Authorization)) || '');
  if(!safeEqual(auth, 'Apikey ' + key)){ res.status(401).json({ success: false, error: 'Sai khoá API.' }); return; }

  var body = req.body; if(typeof body === 'string'){ try{ body = JSON.parse(body); }catch(e){ body = {}; } } body = body || {};
  if(body.transferType && body.transferType !== 'in'){ res.status(200).json({ success: true, ignored: 'tiền ra' }); return; }   // chỉ xử lý tiền VÀO
  var sid = body.id != null ? String(body.id) : '';
  var amount = Math.round(Number(body.transferAmount) || 0);
  if(!sid || amount <= 0){ res.status(200).json({ success: true, ignored: 'thiếu id/số tiền' }); return; }

  var today = vnToday(nowMs);
  var code = extractCode(body);
  var ledgerRef = db.collection('payments').doc('sepay_' + sid.replace(/[^A-Za-z0-9_-]/g, '_'));
  var base = {
    sepayId: sid, gateway: String(body.gateway || '').slice(0, 40), accountNumber: String(body.accountNumber || '').slice(0, 30),
    transactionDate: String(body.transactionDate || '').slice(0, 30), amount: amount, content: String(body.content || '').slice(0, 300),
    referenceCode: String(body.referenceCode || '').slice(0, 60), code: code, receivedAt: new Date(nowMs == null ? Date.now() : nowMs).toISOString()
  };

  try{
    var stuDocs = [];
    if(code){ var q = await db.collection('students').where('payCode', '==', code).limit(2).get(); q.forEach(function(d){ stuDocs.push(d); }); }
    var out = await db.runTransaction(async function(tx){
      var led = await tx.get(ledgerRef);
      if(led.exists) return { dup: true };
      if(!code || stuDocs.length !== 1){
        tx.set(ledgerRef, Object.assign({}, base, { status: stuDocs.length > 1 ? 'ambiguous' : 'unmatched', message: !code ? 'Không thấy mã học sinh trong nội dung chuyển khoản.' : (stuDocs.length > 1 ? 'Mã trùng nhiều học sinh.' : 'Mã ' + code + ' chưa gán cho học sinh nào.') }));
        return { status: 'unmatched' };
      }
      var sref = stuDocs[0].ref, ssnap = await tx.get(sref), s = ssnap.data() || {}, b = s.billing || {};
      var common = Object.assign({}, base, { studentId: ssnap.id, studentName: String(s.name || '').slice(0, 80) });
      // THÊM 2/11/2026 — phụ huynh chọn GÓI trên trang phụ huynh: số tiền khớp ưu đãi nào thì kích hoạt gói đó (trọn khóa / nâng cấp)
      var credit0 = Math.max(0, Number(b.credit) || 0), offer = matchOffer(b.offers, amount + credit0, 1000);
      if(offer){
        var until = String(offer.fixedUntil || '').slice(0, 10);
        if(!until || until < today) until = addMonths(today, 12);
        if(b.paidUntil && String(b.paidUntil).slice(0, 10) > until) until = String(b.paidUntil).slice(0, 10);
        var pays0 = (Array.isArray(b.payments) ? b.payments : []).concat([{ date: today, amount: amount, months: 0, cycle: 'full', note: ('Tự động · ' + (offer.upgrade ? 'Nâng cấp lên ' : 'Chọn ') + String(offer.name || offer.plan).slice(0, 60) + ' · SePay #' + sid).slice(0, 120), auto: true }]).slice(-60);
        var upd0 = { 'billing.plan': offer.plan, 'billing.cycle': 'full', 'billing.paidUntil': until, 'billing.payments': pays0, 'billing.credit': Math.max(0, amount + credit0 - Number(offer.amount)), 'billing.offers': [], 'billing.lastAutoAt': base.receivedAt };
        if(!b.startDate) upd0['billing.startDate'] = today;
        tx.update(sref, upd0);
        tx.set(ledgerRef, Object.assign({}, common, { status: 'applied', plan: offer.plan, paidUntil: until, message: (offer.upgrade ? 'Nâng cấp lên ' : 'Kích hoạt ') + (offer.name || offer.plan) + ' tới ' + until }));
        return { status: 'applied', token: s.parentViewToken || '', until: until, offerApplied: true };
      }
      var plan = planPayment(b, amount, today);
      if(plan.status === 'applied'){
        var pays = (Array.isArray(b.payments) ? b.payments : []).concat([{ date: today, amount: amount, months: plan.months || (b.pay && b.pay.months) || 1, cycle: plan.cycle, note: ('Tự động · SePay #' + sid + (base.gateway ? ' · ' + base.gateway : '')).slice(0, 120), auto: true }]).slice(-60);
        var upd = { 'billing.paidUntil': plan.until, 'billing.cycle': plan.cycle, 'billing.payments': pays, 'billing.credit': plan.leftover, 'billing.lastAutoAt': base.receivedAt };
        if(!b.startDate) upd['billing.startDate'] = today;
        tx.update(sref, upd);
        tx.set(ledgerRef, Object.assign({}, common, { status: 'applied', periods: plan.periods, paidUntil: plan.until, message: 'Đã gia hạn tới ' + plan.until }));
        return { status: 'applied', token: s.parentViewToken || '', until: plan.until };
      }
      if(plan.status === 'partial'){
        tx.update(sref, { 'billing.credit': plan.credit });
        tx.set(ledgerRef, Object.assign({}, common, { status: 'partial', message: 'Mới đóng ' + plan.credit + 'đ, chưa đủ 1 kỳ (' + ((b.pay && b.pay.amount) || '?') + 'đ) — đã cộng dồn, chờ chuyển thêm.' }));
        return { status: 'partial' };
      }
      tx.set(ledgerRef, Object.assign({}, common, { status: 'needs_setup', message: 'Học sinh chưa có gói/số tiền kỳ tới — thầy gán gói rồi ghi nhận tay.' }));
      return { status: 'needs_setup' };
    });
    if(out && out.status === 'applied' && out.token){
      try{ await db.collection('parent_views').doc(out.token).update({ 'pay.status': 'ok', 'pay.paidUntil': out.until, 'pay.paidAt': today, 'pay.offers': [] }); }catch(e){ console.error('parent_views:', e); }
    }
    res.status(200).json({ success: true, result: (out && (out.dup ? 'duplicate' : out.status)) || 'ok' });
  }catch(err){
    console.error('Lỗi sepay-webhook:', err);
    res.status(500).json({ success: false, error: 'Lỗi xử lý — SePay sẽ thử gọi lại.' });   // 5xx → SePay tự retry; sổ chống ghi trùng nên an toàn
  }
}

export default async function handler(req, res){
  var db;
  try{ db = getDb(); }catch(e){ console.error(e); res.status(500).json({ success: false, error: 'Server chưa cấu hình FIREBASE_SERVICE_ACCOUNT_JSON.' }); return; }
  return handle(req, res, db, null, Date.now());
}
