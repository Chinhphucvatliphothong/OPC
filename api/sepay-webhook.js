// ================= FaradayAI — NHẬN TIỀN TỰ ĐỘNG qua SePay (webhook) =================
// THÊM 29/10/2026. Khi phụ huynh quét VietQR và chuyển khoản, SePay đọc biến động số dư của tài khoản ngân hàng rồi
// gọi POST vào đây. Hàm này: (1) kiểm tra khoá API, (2) tìm học sinh theo MÃ trong nội dung chuyển khoản (vd. FDY7K3QX),
// (3) cộng kỳ học phí vào students/{id}.billing (đã đóng tới ngày…), (4) ghi sổ payments/sepay_<id> (chống ghi trùng),
// (5) cập nhật trang phụ huynh. Giao dịch không khớp / thiếu tiền / chưa thiết lập gói được GHI SỔ để thầy xử lý trong admin.
// Biến môi trường (Vercel → Settings → Environment Variables):
//   SEPAY_API_KEY             — khoá API đặt khi tạo webhook ở SePay (SePay gửi kèm header  Authorization: Apikey <khoá>)
//   FIREBASE_SERVICE_ACCOUNT_JSON — đã có sẵn (dùng chung với api/student-login.js), không cần thêm
import { getDb, FieldValue } from '../lib/firebase-admin.js';
import { extractCode, planPayment, vnToday, safeEqual } from '../lib/payment.js';

export async function handle(req, res, db, FV, nowMs){
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
      var plan = planPayment(b, amount, today);
      var common = Object.assign({}, base, { studentId: ssnap.id, studentName: String(s.name || '').slice(0, 80) });
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
      try{ await db.collection('parent_views').doc(out.token).update({ 'pay.status': 'ok', 'pay.paidUntil': out.until, 'pay.paidAt': today }); }catch(e){ console.error('parent_views:', e); }
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
  return handle(req, res, db, FieldValue, Date.now());
}
