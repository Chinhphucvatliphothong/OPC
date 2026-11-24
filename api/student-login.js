// ================= OPC — Đăng nhập học sinh THẬT (Firebase Auth) ==========
// THÊM 25/9/2026 — thay thế cách đăng nhập cũ (so khớp username/mật khẩu
// ngay trên trình duyệt qua Firestore đọc công khai, xem ghi chú bảo mật
// từng có trong opc-live-data.js). Giờ việc kiểm tra mật khẩu chuyển hẳn
// vào server (dùng Firebase Admin SDK — có toàn quyền đọc/ghi, không bị
// giới hạn bởi firestore.rules) rồi mới cấp một "vé đăng nhập" thật
// (Firebase Custom Token) cho đúng học sinh đó. Từ đây Firestore mới biết
// chắc chắn ai đang đọc/ghi (request.auth.uid == đúng studentId) nên
// firestore.rules có thể khoá chặt: ngân hàng đề + hồ sơ học sinh không còn
// đọc công khai được nữa, mỗi em chỉ đọc/ghi đúng dữ liệu của chính mình.
//
// Đổi mật khẩu sang lưu dạng MÃ HOÁ (bcrypt) — KHÔNG cần học sinh đổi lại
// mật khẩu: tài khoản cũ (còn lưu dạng chữ thường) tự động được mã hoá lại
// ngay sau lần đăng nhập thành công đầu tiên kể từ bản cập nhật này ("lazy
// migration") — hoàn toàn trong suốt với học sinh.
//
// CHỐNG DÒ MẬT KHẨU: sau 8 lần sai liên tiếp, khoá đăng nhập tài khoản đó
// 15 phút (lưu trên chính document học sinh — loginFailCount/loginLockUntil)
// — trước đây không giới hạn số lần thử.
import admin from 'firebase-admin';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';  // THÊM 23/11/2026 — băm IP để giới hạn số lần đăng ký học thử

var MAX_FAIL_BEFORE_LOCK = 8;
var LOCK_MINUTES = 15;

function getAdminApp(){
  if(admin.apps.length) return admin.apps[0];
  var raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if(!raw){
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON_MISSING');
  }
  var serviceAccount;
  try{
    serviceAccount = JSON.parse(raw);
  }catch(e){
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON_INVALID');
  }
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

function looksHashed(pw){
  return typeof pw === 'string' && /^\$2[aby]\$\d{2}\$/.test(pw);
}

export default async function handler(req, res){
  if(req.method !== 'POST'){
    res.status(405).json({ error: 'Chỉ hỗ trợ POST.' });
    return;
  }
  // THÊM 23/11/2026 — ĐĂNG KÝ HỌC THỬ MIỄN PHÍ tự động (gộp vào file này vì Vercel Hobby chỉ cho tối đa 12 hàm trong api/)
  var bodyPeek = req.body;
  if(typeof bodyPeek === 'string'){ try{ bodyPeek = JSON.parse(bodyPeek); }catch(e){ bodyPeek = {}; } }
  // SỬA 23/11/2026 (lần 2) — 2 bước: signup_start (gửi mã 6 số vào Gmail) → signup_verify (đúng mã mới tạo tài khoản)
  var act = (bodyPeek && bodyPeek.action) || (req.query && req.query.action) || '';
  if(act === 'signup_start' || act === 'signup_resend' || act === 'signup_verify' || act === 'signup_paystatus'){   // SỬA 24/11/2026: + signup_paystatus
    return handleFreeSignup(req, res, bodyPeek || {}, act);
  }

  var app;
  try{
    app = getAdminApp();
  }catch(e){
    console.error('Lỗi khởi tạo Firebase Admin SDK:', e && e.message);
    res.status(500).json({
      error: 'Server chưa cấu hình FIREBASE_SERVICE_ACCOUNT_JSON — thầy cô cần thêm biến môi trường này trong Vercel Project Settings → Environment Variables rồi Redeploy.'
    });
    return;
  }
  var db = admin.firestore(app);

  var body = req.body;
  if(typeof body === 'string'){
    try{ body = JSON.parse(body); }catch(e){ body = {}; }
  }
  body = body || {};

  var username = String(body.username || '').trim().toLowerCase();
  var password = String(body.password || '');
  if(!username || !password){
    res.status(400).json({ error: 'Vui lòng nhập đủ tên đăng nhập và mật khẩu.' });
    return;
  }

  try{
    var mapSnap = await db.collection('usernames').doc(username).get();
    if(!mapSnap.exists){
      res.status(401).json({ error: 'Không tìm thấy tài khoản này. Kiểm tra lại tên đăng nhập hoặc liên hệ thầy cô.' });
      return;
    }
    var studentId = (mapSnap.data() || {}).studentId;
    var stuRef = studentId ? db.collection('students').doc(studentId) : null;
    var stuSnap = stuRef ? await stuRef.get() : null;
    if(!stuSnap || !stuSnap.exists){
      res.status(401).json({ error: 'Tài khoản không hợp lệ — liên hệ thầy cô để được hỗ trợ.' });
      return;
    }
    var student = stuSnap.data() || {};

    if(student.status === 'inactive'){
      res.status(403).json({ error: 'Tài khoản này đang tạm khoá — liên hệ thầy cô để được hỗ trợ.' });
      return;
    }

    // Khoá tạm sau nhiều lần sai liên tiếp.
    var lockUntil = student.loginLockUntil ? new Date(student.loginLockUntil).getTime() : 0;
    if(lockUntil && lockUntil > Date.now()){
      var minsLeft = Math.ceil((lockUntil - Date.now()) / 60000);
      res.status(429).json({ error: 'Tài khoản tạm khoá do nhập sai mật khẩu quá nhiều lần — thử lại sau ' + minsLeft + ' phút hoặc liên hệ thầy cô.' });
      return;
    }

    var storedPw = String(student.password || '');
    var passOk = looksHashed(storedPw) ? bcrypt.compareSync(password, storedPw) : (storedPw === password);

    if(!passOk){
      var nextFail = (Number(student.loginFailCount) || 0) + 1;
      var update = { loginFailCount: nextFail };
      if(nextFail >= MAX_FAIL_BEFORE_LOCK){
        update.loginFailCount = 0;
        update.loginLockUntil = new Date(Date.now() + LOCK_MINUTES * 60000).toISOString();
      }
      await stuRef.update(update).catch(function(){});
      res.status(401).json({ error: 'Sai mật khẩu. Kiểm tra lại hoặc liên hệ thầy cô để được cấp lại.' });
      return;
    }

    // Đăng nhập đúng: reset bộ đếm sai + tự mã hoá lại mật khẩu cũ (nếu còn
    // dạng chữ thường) — trong suốt với học sinh, không cần đổi gì cả.
    var resetFields = { loginFailCount: 0, loginLockUntil: admin.firestore.FieldValue.delete() };
    if(!looksHashed(storedPw)){
      resetFields.password = bcrypt.hashSync(password, 10);
    }
    await stuRef.update(resetFields).catch(function(err){
      console.error('Lỗi cập nhật trạng thái đăng nhập/mã hoá mật khẩu:', err);
    });

    var token = await admin.auth(app).createCustomToken(studentId);
    res.status(200).json({ ok: true, token: token, studentId: studentId });
  }catch(err){
    console.error('Lỗi đăng nhập học sinh:', err);
    res.status(500).json({ error: 'Lỗi kết nối tới máy chủ — thử lại sau ít phút.' });
  }
}


// ================= THÊM 23/11/2026 — ĐĂNG KÝ HỌC THỬ MIỄN PHÍ 14 NGÀY (xác minh Gmail bằng mã 6 số) =================
// SỬA 23/11/2026 (lần 2) — chặt hơn theo yêu cầu của thầy:
//   • Gmail phải THẬT và của chính em: tài khoản chỉ được tạo sau khi em nhập đúng mã 6 số hệ thống gửi vào Gmail đó.
//   • MỖI Gmail / MỖI số điện thoại (của em hoặc của phụ huynh) chỉ được học thử 1 LẦN DUY NHẤT — kể cả khi tài khoản cũ
//     đã bị xoá. Ghi nhận ở collection trial_claims/{khoá} (Gmail đã chuẩn hoá: bỏ dấu chấm và phần +… vì Gmail coi
//     a.b+x@gmail.com và ab@gmail.com là một). Tạo tài khoản + ghi nhận trong CÙNG 1 transaction nên không lách được.
//   • Số điện thoại: kiểm tra đúng định dạng VN (10 số, đầu số di động) + chưa từng học thử. Số của em ĐƯỢC trùng số phụ huynh. Muốn chắc số có thật phải
//     gửi SMS (tốn phí, cần đăng ký thương hiệu) — chưa làm; thầy gọi chào phụ huynh trong 3 ngày đầu, số sai thì bấm
//     "🔒 Khoá" trong admin › Việc hôm nay.
// Các bước (trang chủ index.html gọi POST /api/student-login):
//   1) { action:'signup_start', name, gmail, phone, parentZalo, khoi, plan, planName, referralCode, website }
//      -> kiểm tra hợp lệ + chưa từng học thử + giới hạn lượt -> lưu signup_pending/{id} (mã đã băm, hết hạn 15 phút) -> gửi mã.
//   2) { action:'signup_resend', pendingId } -> gửi lại mã mới (cách nhau ≥ 60 giây, tối đa 3 lần).
//   3) { action:'signup_verify', pendingId, code } -> sai tối đa 5 lần; đúng thì tạo tài khoản, trả tên đăng nhập + mật khẩu
//      (hiện ngay trên màn hình) và gửi thêm 1 thư lưu thông tin đăng nhập.
// Biến môi trường BẮT BUỘC cho tính năng này (thiếu thì trang chủ tự quay về "đăng ký chờ thầy duyệt" như cũ):
//   GMAIL_USER          — Gmail gửi thư, vd. chinhphucvatliphothong@gmail.com
//   GMAIL_APP_PASSWORD  — "Mật khẩu ứng dụng" 16 ký tự của Gmail đó (bật Xác minh 2 bước rồi tạo ở myaccount.google.com/apppasswords)
var FREE_TRIAL_DAYS = 14;
var CODE_TTL_MIN = 15;
var MAX_CODE_SENDS = 3;          // 1 lần đầu + 2 lần gửi lại
var RESEND_GAP_SEC = 60;
var MAX_VERIFY_TRIES = 5;
var START_PER_IP_PER_DAY = 5;    // số lần xin mã / máy / ngày
var START_TOTAL_PER_DAY = 150;   // tổng số thư mã / ngày (Gmail cho tối đa 500 thư/ngày)
var SITE_URL = 'https://faradayai.vn';

function vnYmd(ms){ return new Date((ms == null ? Date.now() : ms) + 7 * 3600 * 1000).toISOString().slice(0, 10); }
function vnDateText(ymd){ var p = String(ymd || '').split('-'); return p.length === 3 ? (p[2] + '/' + p[1] + '/' + p[0]) : ymd; }
function normCode(v){
  return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}
// SĐT di động VN -> dạng 0xxxxxxxxx (10 số, đầu 03/05/07/08/09); sai trả ''
function normPhone(p){
  var d = String(p || '').replace(/[\s.\-()]/g, '').replace(/^\+84/, '0').replace(/^84(?=\d{9}$)/, '0');
  return /^0[35789]\d{8}$/.test(d) ? d : '';
}
// Gmail chuẩn hoá để chống lách: bỏ dấu chấm + phần "+..." trước @ (Gmail giao thư cho cùng 1 hộp)
function gmailKey(g){ var p = String(g || '').toLowerCase().split('@'); return p[0].split('+')[0].replace(/\./g, '') + '@gmail.com'; }
function sha(s){ return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function genPassword(){
  var chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // bỏ ký tự dễ nhầm (i,l,o,0,1) — giống admin.html
  var out = '';
  for(var i = 0; i < 7; i++) out += chars[crypto.randomInt(chars.length)];
  return out;
}
function genOtp(){ return String(crypto.randomInt(0, 1000000)).padStart(6, '0'); }
function makeReferralCode(name){
  var last = String(name || 'HS').trim().split(/\s+/).pop();
  return (normCode(last) || 'HS') + Math.floor(100 + Math.random() * 900) + 'VLY';
}
function escHtml(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function clientIp(req){
  var xf = String((req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || '').split(',')[0].trim();
  return xf || 'unknown';
}
function mailConfigured(){ return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD); }
function maskGmail(g){ var p = String(g).split('@'); var u = p[0]; return (u.length <= 3 ? u[0] + '**' : u.slice(0, 3) + '***' + u.slice(-1)) + '@' + p[1]; }

async function sendMail(to, subject, text, html){
  if(!mailConfigured()) return { sent: false, reason: 'not_configured' };
  try{
    var nm = await import('nodemailer');
    var nodemailer = nm.default || nm;
    var transporter = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: process.env.GMAIL_USER, pass: String(process.env.GMAIL_APP_PASSWORD).replace(/\s+/g, '') } });
    await transporter.sendMail({ from: '"FaradayAI Luyện Thi Vật Lí" <' + process.env.GMAIL_USER + '>', to: to, subject: subject, text: text, html: html });
    return { sent: true };
  }catch(e){
    console.error('Lỗi gửi Gmail:', e && e.message);
    return { sent: false, reason: 'send_failed' };
  }
}
function sendOtpMail(to, name, otp){
  var text = 'Chào ' + name + ',\n\nMã xác nhận đăng ký học thử FaradayAI của em là: ' + otp + '\n\nMã có hiệu lực ' + CODE_TTL_MIN +
    ' phút. Nếu em không đăng ký, hãy bỏ qua thư này.\n\nThầy FaradayAI';
  var html = '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1b2430">' +
    '<p>Chào <b>' + escHtml(name) + '</b>,</p><p>Mã xác nhận đăng ký học thử FaradayAI của em là:</p>' +
    '<p style="font-size:30px;font-weight:bold;letter-spacing:6px;font-family:monospace;margin:8px 0 14px">' + otp + '</p>' +
    '<p>Mã có hiệu lực ' + CODE_TTL_MIN + ' phút. Nếu em không đăng ký, hãy bỏ qua thư này.</p><p>Thầy FaradayAI</p></div>';
  return sendMail(to, otp + ' là mã xác nhận học thử FaradayAI', text, html);
}
function sendCredentialMail(to, info){
  var text = [
    'Chào ' + info.name + ',', '',
    (info.payment ? 'Tài khoản FaradayAI của em đã sẵn sàng (đăng ký ' + info.payment.planName + '):' : 'Tài khoản học thử miễn phí ' + FREE_TRIAL_DAYS + ' ngày trên FaradayAI của em đã sẵn sàng:'),
    '  Tên đăng nhập: ' + info.username, '  Mật khẩu: ' + info.password, '',
    'Cách vào học: mở ' + SITE_URL + ' → bấm "Đăng nhập" → nhập tên đăng nhập và mật khẩu ở trên.',
    (info.payment ? payTextLines(info.payment) : 'Học thử đến hết ngày ' + vnDateText(info.trialEnd) + '. Trước khi hết hạn, thầy sẽ gọi cho phụ huynh để trao đổi kết quả của em.'), '',
    'Thầy FaradayAI'
  ].join('\n');
  var html = '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1b2430">' +
    '<p>Chào <b>' + escHtml(info.name) + '</b>,</p>' +
    (info.payment ? '<p>Tài khoản FaradayAI của em đã sẵn sàng — đăng ký <b>' + escHtml(info.payment.planName) + '</b>:</p>' : '<p>Tài khoản <b>học thử miễn phí ' + FREE_TRIAL_DAYS + ' ngày</b> trên FaradayAI của em đã sẵn sàng:</p>') +
    '<table style="border-collapse:collapse;margin:8px 0 14px"><tr><td style="padding:6px 12px;background:#f3f4ee">Tên đăng nhập</td><td style="padding:6px 12px;font-family:monospace;font-size:16px"><b>' + escHtml(info.username) + '</b></td></tr>' +
    '<tr><td style="padding:6px 12px;background:#f3f4ee">Mật khẩu</td><td style="padding:6px 12px;font-family:monospace;font-size:16px"><b>' + escHtml(info.password) + '</b></td></tr></table>' +
    '<p><a href="' + SITE_URL + '/#luyen-thi-prepscholar" style="display:inline-block;background:#b07a3c;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Vào học ngay</a></p>' +
    (info.payment ? payHtml(info.payment) : '<p>Học thử đến hết ngày <b>' + escHtml(vnDateText(info.trialEnd)) + '</b>. Trước khi hết hạn, thầy sẽ gọi cho phụ huynh để trao đổi kết quả của em.</p>') +
    '<p>Thầy FaradayAI</p></div>';
  return sendMail(to, (info.payment ? 'Tài khoản & học phí FaradayAI của ' : 'Tài khoản học thử FaradayAI của ') + info.name, text, html);
}

var MSG_USED_GMAIL = 'Gmail này đã được dùng để học thử hoặc đã có tài khoản FaradayAI — mỗi Gmail chỉ học thử 1 lần. Em bấm "Đăng nhập" nếu đã có tài khoản (muốn đóng học phí, phụ huynh nhắn thầy để nhận mã QR của em); quên mật khẩu thì nhắn thầy qua Zalo.';
var MSG_USED_PHONE = 'Số điện thoại của em đã được dùng để học thử — mỗi số điện thoại chỉ học thử 1 lần. Cần hỗ trợ, em nhắn thầy qua Zalo nhé.';
var MSG_USED_PARENT = 'Số Zalo phụ huynh này đã được dùng để học thử — mỗi số chỉ học thử 1 lần. Anh em trong nhà muốn học thử, phụ huynh nhắn thầy qua Zalo nhé.';

// Kiểm tra Gmail / SĐT đã từng học thử hoặc đã có tài khoản chưa. Trả '' nếu được phép.
async function usedReason(db, d){
  var claims = await Promise.all([
    db.collection('trial_claims').doc('g_' + sha(d.gkey)).get(),
    db.collection('trial_claims').doc('p_' + d.phone).get(),
    d.parentZalo === d.phone ? Promise.resolve({ exists: false }) : db.collection('trial_claims').doc('p_' + d.parentZalo).get()
  ]);
  if(claims[0].exists) return MSG_USED_GMAIL;
  var pay = d.mode === 'pay';   // THÊM 24/11/2026 — đăng ký trả phí: chỉ cần Gmail mới (anh em dùng chung số bố mẹ vẫn đăng ký được)
  if(!pay && claims[1].exists) return MSG_USED_PHONE;
  if(!pay && claims[2].exists) return MSG_USED_PARENT;
  var q1 = await db.collection('students').where('email', '==', d.gmail).limit(1).get();
  if(!q1.empty) return MSG_USED_GMAIL;
  if(d.rawGmail && d.rawGmail !== d.gmail){
    var q1b = await db.collection('students').where('email', '==', d.rawGmail).limit(1).get();
    if(!q1b.empty) return MSG_USED_GMAIL;
  }
  var q2 = pay ? { empty: true } : await db.collection('students').where('phone', '==', d.phone).limit(1).get();
  if(!q2.empty) return 'Số điện thoại này đã có tài khoản FaradayAI — em bấm "Đăng nhập"; quên mật khẩu thì nhắn thầy qua Zalo.';
  return '';
}

async function takeQuota(db, req){
  var ymd = vnYmd(), ipKey = sha(clientIp(req)).slice(0, 16), ref = db.collection('signup_limits').doc(ymd);
  return db.runTransaction(async function(tx){
    var snap = await tx.get(ref);
    var d = snap.exists ? (snap.data() || {}) : {};
    var total = Number(d.total) || 0, ips = d.ips || {}, mine = Number(ips[ipKey]) || 0;
    if(total >= START_TOTAL_PER_DAY) return 'Hôm nay số lượt đăng ký học thử đã đủ — em quay lại vào ngày mai, hoặc nhắn thầy qua Zalo nhé.';
    if(mine >= START_PER_IP_PER_DAY) return 'Máy này đã xin mã nhiều lần hôm nay — em thử lại vào ngày mai hoặc nhắn thầy qua Zalo nhé.';
    ips[ipKey] = mine + 1;
    tx.set(ref, { total: total + 1, ips: ips, updatedAt: new Date().toISOString() }, { merge: true });
    return '';
  });
}

async function handleFreeSignup(req, res, body, act){
  if(!mailConfigured()){ res.status(503).json({ error: 'not_configured' }); return; }   // trang chủ tự quay về đăng ký chờ duyệt
  var app;
  try{ app = getAdminApp(); }
  catch(e){
    console.error('Lỗi khởi tạo Firebase Admin SDK (đăng ký học thử):', e && e.message);
    res.status(503).json({ error: 'not_configured' });
    return;
  }
  var db = admin.firestore(app);
  try{
    if(act === 'signup_start') return await signupStart(db, req, res, body);
    if(act === 'signup_resend') return await signupResend(db, res, body);
    if(act === 'signup_paystatus') return await signupPayStatus(db, res, body);
    return await signupVerify(db, res, body);
  }catch(err){
    console.error('Lỗi đăng ký học thử (' + act + '):', err);
    res.status(500).json({ error: 'server_error' });
  }
}

async function signupStart(db, req, res, body){
  if(body.website){ res.status(200).json({ ok: true, bot: true }); return; }   // ô bẫy chống bot
  var rawGmail = String(body.gmail || '').trim().slice(0, 119);
  var d = {
    name: String(body.name || '').trim().replace(/\s+/g, ' ').slice(0, 99),
    rawGmail: rawGmail, gmail: rawGmail.toLowerCase(),
    phone: normPhone(body.phone), parentZalo: normPhone(body.parentZalo),
    khoi: [10, 11, 12].indexOf(Number(body.khoi)) > -1 ? Number(body.khoi) : 12,
    plan: String(body.plan || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24),
    planName: String(body.planName || '').slice(0, 60),
    referralCode: normCode(body.referralCode).slice(0, 29),
    mode: body.mode === 'pay' ? 'pay' : 'trial'   // THÊM 24/11/2026 — 'trial' học thử 14 ngày | 'pay' đăng ký khoá học + thanh toán QR
  };
  if(d.name.length < 4 || d.name.indexOf(' ') < 0){ res.status(400).json({ error: 'Em nhập đầy đủ họ và tên (ví dụ: Nguyễn Văn An).', field: 'name' }); return; }
  // Gmail thật luôn có ít nhất 6 ký tự trước @ (không tính dấu chấm) — chặn bớt địa chỉ gõ bừa
  if(!/^[a-z0-9.+_-]+@gmail\.com$/.test(d.gmail) || gmailKey(d.gmail).split('@')[0].length < 6){ res.status(400).json({ error: 'Gmail chưa đúng — chỉ nhận địa chỉ @gmail.com (ít nhất 6 ký tự trước @).', field: 'gmail' }); return; }
  if(!d.phone){ res.status(400).json({ error: 'Số điện thoại của em chưa đúng (10 số, đầu 03/05/07/08/09).', field: 'phone' }); return; }
  if(!d.parentZalo){ res.status(400).json({ error: 'Số Zalo phụ huynh chưa đúng (10 số, đầu 03/05/07/08/09).', field: 'parentZalo' }); return; }
  // SỬA 23/11/2026 (lần 3) — CHO PHÉP số của em trùng số phụ huynh (nhiều em chưa có điện thoại riêng, dùng luôn số bố mẹ)
  d.gkey = gmailKey(d.gmail);
  if(d.mode === 'pay'){
    var bc0 = await loadBillingCfg(db);
    var pl0 = bc0.plans.filter(function(x){ return x.key === d.plan; })[0];
    if(!pl0 || !(fullFee(bc0, pl0) > 0)){ res.status(400).json({ error: 'Em chọn gói khoá học muốn đăng ký nhé.', field: 'plan' }); return; }
  }

  var used = await usedReason(db, d);
  if(used){ res.status(409).json({ error: used }); return; }
  var limitMsg = await takeQuota(db, req);
  if(limitMsg){ res.status(429).json({ error: limitMsg }); return; }

  var otp = genOtp(), ref = db.collection('signup_pending').doc(), nowMs = Date.now();
  await ref.set({ data: d, codeHash: sha(ref.id + ':' + otp), expiresAt: nowMs + CODE_TTL_MIN * 60000, sends: 1, lastSentAt: nowMs,
    tries: 0, status: 'pending', createdAt: new Date(nowMs).toISOString() });
  var m = await sendOtpMail(d.gmail, d.name, otp);
  if(!m.sent){
    await ref.update({ status: 'mail_failed' }).catch(function(){});
    res.status(502).json({ error: 'Chưa gửi được mã vào Gmail ' + d.gmail + '. Em kiểm tra lại địa chỉ Gmail hoặc thử lại sau ít phút.' });
    return;
  }
  res.status(200).json({ ok: true, pendingId: ref.id, sentTo: maskGmail(d.gmail), ttlMin: CODE_TTL_MIN, resendAfterSec: RESEND_GAP_SEC });
}

async function signupResend(db, res, body){
  var ref = db.collection('signup_pending').doc(String(body.pendingId || '').slice(0, 40) || 'x');
  var snap = await ref.get();
  var p = snap.exists ? (snap.data() || {}) : null, nowMs = Date.now();
  if(!p || p.status !== 'pending'){ res.status(410).json({ error: 'Phiên đăng ký đã hết hạn — em điền lại form nhé.', restart: true }); return; }
  if((p.sends || 0) >= MAX_CODE_SENDS){ res.status(429).json({ error: 'Đã gửi mã ' + MAX_CODE_SENDS + ' lần. Em kiểm tra cả mục Quảng cáo/Spam trong Gmail, hoặc điền lại form với Gmail khác.' }); return; }
  var wait = Math.ceil(((p.lastSentAt || 0) + RESEND_GAP_SEC * 1000 - nowMs) / 1000);
  if(wait > 0){ res.status(429).json({ error: 'Em chờ ' + wait + ' giây nữa rồi bấm gửi lại nhé.', waitSec: wait }); return; }
  var otp = genOtp();
  await ref.update({ codeHash: sha(ref.id + ':' + otp), expiresAt: nowMs + CODE_TTL_MIN * 60000, sends: (p.sends || 0) + 1, lastSentAt: nowMs, tries: 0 });
  var m = await sendOtpMail(p.data.gmail, p.data.name, otp);
  if(!m.sent){ res.status(502).json({ error: 'Chưa gửi lại được mã — em thử lại sau ít phút.' }); return; }
  res.status(200).json({ ok: true, sentTo: maskGmail(p.data.gmail), resendAfterSec: RESEND_GAP_SEC, sendsLeft: MAX_CODE_SENDS - (p.sends || 0) - 1 });
}

async function signupVerify(db, res, body){
  var ref = db.collection('signup_pending').doc(String(body.pendingId || '').slice(0, 40) || 'x');
  var code = String(body.code || '').replace(/\D/g, '');
  var snap = await ref.get();
  var p = snap.exists ? (snap.data() || {}) : null, nowMs = Date.now();
  if(!p || p.status !== 'pending'){ res.status(410).json({ error: 'Phiên đăng ký đã hết hạn — em điền lại form nhé.', restart: true }); return; }
  if(nowMs > (p.expiresAt || 0)){ res.status(400).json({ error: 'Mã đã hết hạn — em bấm "Gửi lại mã".', expired: true }); return; }
  if((p.tries || 0) >= MAX_VERIFY_TRIES){
    await ref.update({ status: 'locked' }).catch(function(){});
    res.status(410).json({ error: 'Nhập sai mã quá ' + MAX_VERIFY_TRIES + ' lần — em điền lại form nhé.', restart: true });
    return;
  }
  if(code.length !== 6 || sha(ref.id + ':' + code) !== p.codeHash){
    var left = MAX_VERIFY_TRIES - (p.tries || 0) - 1;
    await ref.update({ tries: (p.tries || 0) + 1 });
    res.status(400).json({ error: left > 0 ? ('Mã chưa đúng — em còn ' + left + ' lần thử.') : 'Mã chưa đúng — em điền lại form nhé.', restart: left <= 0 });
    return;
  }

  var d = p.data;
  // kiểm tra lại (phòng khi Gmail/SĐT vừa được dùng ở phiên khác trong lúc chờ mã)
  var used = await usedReason(db, d);
  if(used){ await ref.update({ status: 'rejected_used' }).catch(function(){}); res.status(409).json({ error: used, restart: true }); return; }

  // tên đăng nhập = phần trước @ của Gmail; trùng thì thêm số
  var base = d.gmail.split('@')[0].split('+')[0].replace(/[^a-z0-9._-]/g, '').slice(0, 40) || 'hocsinh';
  var username = base;
  for(var k = 0; k < 20; k++){
    var u = await db.collection('usernames').doc(username).get();
    if(!u.exists) break;
    username = base + (k < 8 ? (k + 2) : Math.floor(100 + Math.random() * 900));
  }

  // gói: gói em chọn (nếu đang hiện trên trang chủ), không thì gói hiện đầu tiên — để admin › Học phí theo dõi học thử
  var planId = d.plan, planName = d.planName;
  try{
    var pr = await db.collection('settings').doc('pricing').get();
    var tiers = pr.exists ? ((pr.data() || {}).tiers || []) : [];
    var vis = tiers.map(function(t, i){ return { id: String((t && t.id) || ('g' + (i + 1))).replace(/[^A-Za-z0-9_-]/g, ''), name: (t && t.name) || '', visible: !t || t.visible !== false }; }).filter(function(t){ return t.visible; });
    var hit = vis.filter(function(t){ return t.id === planId; })[0] || vis[0];
    if(hit){ planId = hit.id; planName = hit.name || planName; }
  }catch(e){ console.warn('Không đọc được settings/pricing:', e && e.message); }
  if(!planId) planId = 'g1';

  // mã giới thiệu: ghi nhận người giới thiệu + mức giảm; hoa hồng cho người giới thiệu thầy cộng tay khi em đóng phí
  var referrer = null, discountVnd = 0, giftNew = '';
  if(d.referralCode){
    var rs = await db.collection('students').where('referralCode', '==', d.referralCode).limit(1).get();
    if(!rs.empty) referrer = { id: rs.docs[0].id, data: rs.docs[0].data() || {} };
    if(referrer){
      discountVnd = 100000;
      try{
        var rc = await db.collection('settings').doc('referral').get();
        if(rc.exists){
          var rd = rc.data() || {};
          if(isFinite(Number(rd.discountVnd)) && Number(rd.discountVnd) >= 0) discountVnd = Number(rd.discountVnd);
          giftNew = String(rd.giftNew || '').slice(0, 160);
        }
      }catch(e){}
    }
  }

  // THÊM 24/11/2026 — học phí + mã thanh toán (giống admin-ops.js › BillingPanel tự đồng bộ, để webhook SePay tự kích hoạt khi tiền về)
  var isPay = d.mode === 'pay';
  var bc = await loadBillingCfg(db);
  var payPlan = isPay ? bc.plans.filter(function(x){ return x.key === d.plan; })[0] : null;
  if(isPay && payPlan){ planId = payPlan.key; planName = payPlan.name; }
  var payCode = bc.gatewayOn ? await genUniquePayCode(db) : '';
  var trialDays = isPay ? PAY_GRACE_DAYS : FREE_TRIAL_DAYS;
  var password = genPassword(), nowIso = new Date().toISOString(), trialEnd = vnYmd(Date.now() + trialDays * 86400000);
  var stuRef = db.collection('students').doc();
  var newStu = {
    name: d.name, username: username, password: bcrypt.hashSync(password, 10),
    email: d.gmail, emailVerified: true, phone: d.phone, khoi: d.khoi,
    school: 'Chưa cập nhật', completedExamsCount: 0, averageScore: 0, highestScore: 0,
    targetScore: 9.0, status: 'active',
    parentName: 'Chưa cập nhật', parentPhone: d.parentZalo, parentEmail: '',
    referralCode: makeReferralCode(d.name), commissionBalance: 0,
    billing: { plan: planId, cycle: 'trial', startDate: vnYmd(), trialEnd: trialEnd, payments: [] },
    signupSource: isPay ? 'pay_signup' : 'free_signup', signupAt: nowIso
  };
  var payInfo = null, offers = [];
  if(payCode){
    newStu.payCode = payCode;
    payInfo = payInfoFor(bc, planId);
    offers = offersFor(bc);
    if(payInfo) newStu.billing.pay = payInfo;
    newStu.billing.offers = offers;
  }
  if(referrer){
    newStu.referredByCode = referrer.data.referralCode || d.referralCode;
    newStu.referredById = referrer.id;
    newStu.referralDiscountVnd = discountVnd;
    if(giftNew){ newStu.referralGift = giftNew; newStu.referralGiftDone = false; }
  }
  var sameNum = d.phone === d.parentZalo;   // em dùng luôn số phụ huynh -> chỉ giữ 1 số
  var claimRefs = [
    db.collection('trial_claims').doc('g_' + sha(d.gkey)),
    db.collection('trial_claims').doc('p_' + d.phone)
  ];
  if(!sameNum) claimRefs.push(db.collection('trial_claims').doc('p_' + d.parentZalo));
  var claimInfo = { studentId: stuRef.id, name: d.name, at: nowIso };
  // CÙNG 1 transaction: chưa ai giữ Gmail/SĐT này -> giữ + tạo tài khoản; 2 phiên chạy song song thì chỉ 1 phiên thành công
  var clash = await db.runTransaction(async function(tx){
    var pSnap = await tx.get(ref);
    if(!pSnap.exists || (pSnap.data() || {}).status !== 'pending') return 'Phiên đăng ký đã được dùng — em điền lại form nhé.';
    var cs = await Promise.all(claimRefs.map(function(r){ return tx.get(r); }));
    if(cs[0].exists) return MSG_USED_GMAIL;
    if(!isPay && cs[1].exists) return MSG_USED_PHONE;
    if(!isPay && cs[2] && cs[2].exists) return MSG_USED_PARENT;
    // đăng ký trả phí: số đã từng học thử vẫn cho đăng ký (anh em trong nhà), chỉ đánh dấu để thầy biết
    var reused = isPay && (cs[1].exists || (cs[2] && cs[2].exists));
    if(reused) newStu.phoneReused = true;
    tx.set(claimRefs[0], Object.assign({ kind: 'gmail', gmail: d.gmail }, claimInfo));
    if(!cs[1].exists) tx.set(claimRefs[1], Object.assign({ kind: sameNum ? 'phone+parentZalo' : 'phone' }, claimInfo));
    if(!sameNum && !cs[2].exists) tx.set(claimRefs[2], Object.assign({ kind: 'parentZalo' }, claimInfo));
    tx.set(stuRef, newStu);
    tx.set(db.collection('usernames').doc(username), { studentId: stuRef.id });
    tx.set(db.collection('registrations').doc(), {
      name: d.name, gmail: d.gmail, phone: d.phone, parentZalo: d.parentZalo, referralCode: d.referralCode,
      status: 'converted', createdAt: nowIso, convertedStudentId: stuRef.id, convertedAt: nowIso,
      source: (isPay ? 'pay_signup:' : 'free_signup:') + planId + ':' + String(planName || '').replace(/[:\n\r]/g, ' ')
    });
    tx.update(ref, { status: 'done', studentId: stuRef.id, doneAt: nowIso });
    return '';
  });
  if(clash){ res.status(409).json({ error: clash, restart: true }); return; }

  // THÊM 24/11/2026 — khối thanh toán trả về trang chủ (mã QR đã điền sẵn số tiền + nội dung = mã học sinh)
  var payment = null;
  if(isPay && payPlan){
    var amt = fullFee(bc, payPlan);
    payment = payCode
      ? { auto: true, plan: payPlan.key, planName: payPlan.name, amount: amt, until: bc.examDate, content: payCode,
          bank: bc.gateway.bank, acc: bc.gateway.acc, accName: bc.gateway.name || '', qrUrl: qrUrl(bc, payCode, amt) }
      : { auto: false, plan: payPlan.key, planName: payPlan.name, amount: amt, until: bc.examDate, bankInfo: bc.bankInfo || '' };
  }
  var mail = await sendCredentialMail(d.gmail, { name: d.name, username: username, password: password, trialEnd: trialEnd, payment: payment });
  res.status(200).json({
    ok: true, studentId: stuRef.id, username: username, password: password, trialEnd: trialEnd, trialDays: trialDays, mode: d.mode, payment: payment,
    emailSent: !!mail.sent, discountVnd: discountVnd, referrerFound: !!referrer, codeNotFound: !!(d.referralCode && !referrer)
  });
}


// ================= THÊM 24/11/2026 — ĐĂNG KÝ KHOÁ HỌC NGAY + THANH TOÁN QR TỰ ĐỘNG =================
// Form trang chủ có 2 lựa chọn: "Học thử miễn phí 14 ngày" (mode 'trial') hoặc "Đăng ký khoá học ngay" (mode 'pay').
// mode 'pay' (sau khi xác minh Gmail như học thử):
//   • tạo tài khoản, học được ngay trong PAY_GRACE_DAYS ngày chờ chuyển khoản (billing.cycle 'trial', trialEnd = +3 ngày);
//   • cấp payCode "FDY…" + ghi billing.pay / billing.offers ĐÚNG CÔNG THỨC admin-ops.js (payInfoFor / offersFor / cycleFee)
//     -> phụ huynh quét QR (số tiền trọn khoá + nội dung = payCode) -> api/sepay-webhook.js khớp ưu đãi -> tự chuyển gói
//        sang 'full', đã đóng tới ngày thi. Không cần thầy làm gì;
//   • trang chủ hỏi signup_paystatus mỗi 10 giây để báo "Đã nhận học phí" ngay trên màn hình.
// Cổng thanh toán chưa bật (admin › 💳 Học phí › VietQR + SePay) -> vẫn tạo tài khoản, hiện thông tin chuyển khoản thầy ghi
// ở admin (bankInfo) và nhắc thầy liên hệ.
// Mode 'trial' cũng được cấp payCode (khi cổng bật) để sau này phụ huynh chuyển khoản là tự kích hoạt.
var PAY_GRACE_DAYS = 3;
var BILL_DEFAULTS = { examDate: '2027-06-11', fullOff: 20, quarterOff: 10 };

function parseYmdLocal(s){ var p = String(s || '').slice(0, 10).split('-'); if(p.length !== 3) return null; return new Date(+p[0], +p[1] - 1, +p[2]); }
function monthsUntil(examYmd){   // = admin-ops.js › monthsUntil
  var e = parseYmdLocal(examYmd), t = parseYmdLocal(vnYmd());
  if(!e || e <= t) return 1;
  return Math.max(1, Math.ceil((e - t) / (30.44 * 86400000)));
}
async function loadBillingCfg(db){
  var bill = {}, pr = {};
  try{ var a = await db.collection('settings').doc('billing').get(); if(a.exists) bill = a.data() || {}; }catch(e){}
  try{ var b = await db.collection('settings').doc('pricing').get(); if(b.exists) pr = b.data() || {}; }catch(e){}
  var tiers = Array.isArray(pr.tiers) ? pr.tiers : [];
  var plans = tiers.map(function(t, i){   // = admin-ops.js › tiersToPlans
    t = t || {};
    return { key: String(t.id || ('g' + (i + 1))).replace(/[^A-Za-z0-9_-]/g, ''), name: t.name || ('Gói ' + (i + 1)), monthly: Number(t.price) || 0, full: Number(t.fullPrice) || 0,
      visible: t.visible !== false, courseOnly: !/th[aá]ng/i.test(String(t.unit || '/tháng')) };
  });
  var g = bill.gateway || {};
  return {
    plans: plans.filter(function(p){ return p.visible; }), allPlans: plans,
    examDate: pr.examDate || bill.examDate || BILL_DEFAULTS.examDate,
    fullOff: pr.fullOff != null ? Number(pr.fullOff) : (bill.fullOff != null ? Number(bill.fullOff) : BILL_DEFAULTS.fullOff),
    gateway: g, gatewayOn: !!(g.enabled && g.bank && g.acc), bankInfo: String(bill.bankInfo || '')
  };
}
function feeFor(bc, p, cycle){   // = admin-ops.js › cycleFee (không customFee)
  if(!p) return 0;
  var base = Number(p.monthly) || 0;
  if(p.courseOnly) return Number(p.full) > 0 ? Number(p.full) : base;
  if(cycle === 'full' && Number(p.full) > 0) return Number(p.full);
  var m = cycle === 'full' ? monthsUntil(bc.examDate) : 1;
  var off = cycle === 'full' ? bc.fullOff : 0;
  return Math.round(base * m * (1 - (Number(off) || 0) / 100) / 1000) * 1000;
}
function fullFee(bc, p){ return feeFor(bc, p, 'full'); }
function payInfoFor(bc, planKey){   // = admin-ops.js › payInfoFor khi billing.cycle = 'trial' (giữ ĐÚNG thứ tự khoá để admin không ghi lại)
  var p = bc.allPlans.filter(function(x){ return x.key === planKey; })[0];
  if(!p) return null;
  var cyc = p.courseOnly ? 'full' : 'month';
  var fee = feeFor(bc, p, cyc);
  if(!(fee > 0)) return null;
  var o = { amount: fee, cycle: cyc };
  if(cyc === 'full') o.fixedUntil = bc.examDate; else o.months = 1;
  return o;
}
function offersFor(bc){   // = admin-ops.js › offersFor khi chưa đóng (mỗi gói hiện, tối đa 3, giá trọn khoá)
  var out = [];
  bc.plans.slice(0, 3).forEach(function(p){
    var fee = fullFee(bc, p);
    if(fee > 0) out.push({ plan: p.key, name: p.name, amount: fee, cycle: 'full', fixedUntil: bc.examDate, upgrade: false });
  });
  return out;
}
function qrUrl(bc, code, amount){   // = admin-ops.js › qrUrl
  var g = bc.gateway || {};
  return 'https://img.vietqr.io/image/' + encodeURIComponent(g.bank) + '-' + encodeURIComponent(g.acc) + '-compact2.png?amount=' + Math.round(Number(amount) || 0) +
    '&addInfo=' + encodeURIComponent(code) + (g.name ? '&accountName=' + encodeURIComponent(g.name) : '');
}
async function genUniquePayCode(db){
  var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for(var guard = 0; guard < 20; guard++){
    var c = 'FDY'; for(var i = 0; i < 5; i++) c += A[crypto.randomInt(A.length)];
    var q = await db.collection('students').where('payCode', '==', c).limit(1).get();
    if(q.empty) return c;
  }
  return 'FDY' + Date.now().toString(36).toUpperCase().slice(-5);
}
function vnd(n){ return Math.round(Number(n) || 0).toLocaleString('vi-VN') + 'đ'; }
function payTextLines(p){
  if(p.auto) return 'HỌC PHÍ ' + p.planName + ' (trọn khoá đến kỳ thi ' + vnDateText(p.until) + '): ' + vnd(p.amount) +
    '\nChuyển khoản: ' + p.bank + ' ' + p.acc + (p.accName ? ' — ' + p.accName : '') + ', số tiền ' + vnd(p.amount) + ', NỘI DUNG: ' + p.content +
    '\nMã QR (đã điền sẵn): ' + p.qrUrl +
    '\nGiữ nguyên nội dung ' + p.content + ' để hệ thống tự kích hoạt khoá học trong vài phút, không cần báo thầy. Trong lúc chờ, em vẫn vào học được.';
  return 'HỌC PHÍ ' + p.planName + ': ' + vnd(p.amount) + '. Thầy sẽ liên hệ phụ huynh để hướng dẫn thanh toán.' + (p.bankInfo ? '\nThông tin chuyển khoản: ' + p.bankInfo : '');
}
function payHtml(p){
  if(p.auto) return '<div style="border:1px solid #e3d6c3;border-radius:10px;padding:12px 14px;margin:6px 0 14px">' +
    '<p style="margin:0 0 6px"><b>Học phí ' + escHtml(p.planName) + '</b> (trọn khoá đến kỳ thi ' + escHtml(vnDateText(p.until)) + '): <b>' + vnd(p.amount) + '</b></p>' +
    '<p style="margin:0 0 6px"><img src="' + escHtml(p.qrUrl) + '" alt="Mã QR chuyển khoản" width="240" style="max-width:100%"></p>' +
    '<p style="margin:0 0 6px">' + escHtml(p.bank) + ' ' + escHtml(p.acc) + (p.accName ? ' — ' + escHtml(p.accName) : '') + ' · Nội dung: <b style="font-family:monospace">' + escHtml(p.content) + '</b></p>' +
    '<p style="margin:0">Giữ nguyên nội dung <b>' + escHtml(p.content) + '</b> để hệ thống <b>tự kích hoạt khoá học</b> trong vài phút, không cần báo thầy. Trong lúc chờ, em vẫn vào học được.</p></div>';
  return '<p><b>Học phí ' + escHtml(p.planName) + ': ' + vnd(p.amount) + '.</b> Thầy sẽ liên hệ phụ huynh để hướng dẫn thanh toán.' + (p.bankInfo ? '<br>Thông tin chuyển khoản: ' + escHtml(p.bankInfo) : '') + '</p>';
}
// trang chủ hỏi: em đã được ghi nhận học phí chưa? (cần đúng cả studentId + payCode — không lộ thông tin gì khác)
async function signupPayStatus(db, res, body){
  var id = String(body.studentId || '').slice(0, 40), code = String(body.payCode || '').toUpperCase().slice(0, 12);
  if(!id || !/^FDY[A-Z0-9]{5}$/.test(code)){ res.status(400).json({ error: 'bad_request' }); return; }
  var snap = await db.collection('students').doc(id).get();
  var st = snap.exists ? (snap.data() || {}) : null;
  if(!st || st.payCode !== code){ res.status(404).json({ error: 'not_found' }); return; }
  var b = st.billing || {}, paid = b.cycle === 'full' && b.paidUntil && String(b.paidUntil).slice(0, 10) >= vnYmd();
  res.status(200).json({ ok: true, paid: !!paid, paidUntil: paid ? String(b.paidUntil).slice(0, 10) : '' });
}
