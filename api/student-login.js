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
  if((bodyPeek && bodyPeek.action === 'signup') || (req.query && req.query.action === 'signup')){
    return handleFreeSignup(req, res, bodyPeek || {});
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


// ================= THÊM 23/11/2026 — ĐĂNG KÝ HỌC THỬ MIỄN PHÍ (tự tạo tài khoản + gửi Gmail) =================
// Trang chủ (index.html › form "Đăng ký học thử miễn phí") gửi POST /api/student-login { action:'signup', name, gmail, phone,
// parentZalo, khoi, plan, planName, referralCode }. Server:
//   1) chặn spam: ô bẫy bot, tối đa SIGNUP_PER_IP_PER_DAY lần/IP/ngày, tối đa SIGNUP_TOTAL_PER_DAY lần/ngày (giới hạn Gmail 500 thư/ngày);
//   2) Gmail đã có tài khoản -> báo đăng nhập / nhắn thầy lấy lại mật khẩu (KHÔNG cấp lại mật khẩu, tránh người lạ đổi mật khẩu của em khác);
//   3) tạo students/{id} (giống nút "Duyệt" ở admin) + usernames/{username}, mật khẩu đã mã hoá bcrypt, gói = gói em chọn
//      (hoặc gói hiện đầu tiên), billing.cycle = 'trial', trialEnd = hôm nay + FREE_TRIAL_DAYS -> admin › "Việc hôm nay" tự nhắc
//      thầy gọi phụ huynh khi còn ≤ 2 ngày học thử (đã có sẵn);
//   4) ghi registrations/{id} status 'converted', source 'free_signup:…' để tra cứu;
//   5) gửi Gmail tên đăng nhập + mật khẩu (nếu đã cấu hình), đồng thời trả về để trang chủ hiện ngay trên màn hình.
// Biến môi trường (Vercel → Settings → Environment Variables), không có thì vẫn tạo tài khoản, chỉ không gửi được thư:
//   GMAIL_USER          — Gmail gửi thư, vd. chinhphucvatliphothong@gmail.com
//   GMAIL_APP_PASSWORD  — "Mật khẩu ứng dụng" 16 ký tự của Gmail đó (bật Xác minh 2 bước rồi tạo ở myaccount.google.com/apppasswords)
var FREE_TRIAL_DAYS = 14;
var SIGNUP_PER_IP_PER_DAY = 3;
var SIGNUP_TOTAL_PER_DAY = 80;
var SITE_URL = 'https://faradayai.vn';

function vnYmd(ms){ return new Date((ms == null ? Date.now() : ms) + 7 * 3600 * 1000).toISOString().slice(0, 10); }
function vnDateText(ymd){ var p = String(ymd || '').split('-'); return p.length === 3 ? (p[2] + '/' + p[1] + '/' + p[0]) : ymd; }
function normCode(v){
  return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}
function isVNPhone(p){ var d = String(p || '').replace(/[\s.\-()]/g, '').replace(/^\+84/, '0').replace(/^84(?=\d{9}$)/, '0'); return /^0\d{9}$/.test(d); }
function genPassword(){
  var chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // bỏ ký tự dễ nhầm (i,l,o,0,1) — giống admin.html
  var out = '';
  for(var i = 0; i < 7; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
function makeReferralCode(name){
  var last = String(name || 'HS').trim().split(/\s+/).pop();
  return (normCode(last) || 'HS') + Math.floor(100 + Math.random() * 900) + 'VLY';
}
function escHtml(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function clientIp(req){
  var xf = String((req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || '').split(',')[0].trim();
  return xf || 'unknown';
}

async function sendCredentialMail(to, info){
  var user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD;
  if(!user || !pass) return { sent: false, reason: 'not_configured' };
  try{
    var nm = await import('nodemailer');
    var nodemailer = nm.default || nm;
    var transporter = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: user, pass: String(pass).replace(/\s+/g, '') } });
    var text = [
      'Chào ' + info.name + ',',
      '',
      'Tài khoản học thử miễn phí ' + FREE_TRIAL_DAYS + ' ngày trên FaradayAI của em đã sẵn sàng:',
      '  Tên đăng nhập: ' + info.username,
      '  Mật khẩu: ' + info.password,
      '',
      'Cách vào học: mở ' + SITE_URL + ' → bấm "Đăng nhập" → nhập tên đăng nhập và mật khẩu ở trên.',
      'Học thử đến hết ngày ' + vnDateText(info.trialEnd) + '. Trước khi hết hạn, thầy sẽ gọi cho phụ huynh để trao đổi kết quả của em.',
      '',
      'Em nên làm ngay bài "Thử sức 5 phút" hoặc nhiệm vụ 10 phút mỗi ngày để hệ thống nắm được chỗ em cần củng cố.',
      '',
      'Thầy FaradayAI'
    ].join('\n');
    var html = '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1b2430">' +
      '<p>Chào <b>' + escHtml(info.name) + '</b>,</p>' +
      '<p>Tài khoản <b>học thử miễn phí ' + FREE_TRIAL_DAYS + ' ngày</b> trên FaradayAI của em đã sẵn sàng:</p>' +
      '<table style="border-collapse:collapse;margin:8px 0 14px"><tr><td style="padding:6px 12px;background:#f3f4ee">Tên đăng nhập</td><td style="padding:6px 12px;font-family:monospace;font-size:16px"><b>' + escHtml(info.username) + '</b></td></tr>' +
      '<tr><td style="padding:6px 12px;background:#f3f4ee">Mật khẩu</td><td style="padding:6px 12px;font-family:monospace;font-size:16px"><b>' + escHtml(info.password) + '</b></td></tr></table>' +
      '<p><a href="' + SITE_URL + '/#luyen-thi-prepscholar" style="display:inline-block;background:#b07a3c;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Vào học ngay</a></p>' +
      '<p>Học thử đến hết ngày <b>' + escHtml(vnDateText(info.trialEnd)) + '</b>. Trước khi hết hạn, thầy sẽ gọi cho phụ huynh để trao đổi kết quả của em.</p>' +
      '<p>Em nên làm ngay bài <b>Thử sức 5 phút</b> hoặc nhiệm vụ 10 phút mỗi ngày để hệ thống nắm được chỗ em cần củng cố.</p>' +
      '<p>Thầy FaradayAI</p></div>';
    await transporter.sendMail({ from: '"FaradayAI Luyện Thi Vật Lí" <' + user + '>', to: to, subject: 'Tài khoản học thử FaradayAI của ' + info.name, text: text, html: html });
    return { sent: true };
  }catch(e){
    console.error('Lỗi gửi Gmail tài khoản học thử:', e && e.message);
    return { sent: false, reason: 'send_failed' };
  }
}

async function handleFreeSignup(req, res, body){
  var app;
  try{ app = getAdminApp(); }
  catch(e){
    console.error('Lỗi khởi tạo Firebase Admin SDK (đăng ký học thử):', e && e.message);
    res.status(503).json({ error: 'not_configured' });   // trang chủ tự chuyển sang gửi đăng ký chờ thầy duyệt
    return;
  }
  var db = admin.firestore(app);

  // ô bẫy chống bot: người thật không thấy/không điền
  if(body.website){ res.status(200).json({ ok: true, bot: true }); return; }

  var name = String(body.name || '').trim().replace(/\s+/g, ' ').slice(0, 99);
  var gmail = String(body.gmail || '').trim().toLowerCase().slice(0, 119);
  var phone = String(body.phone || '').trim().slice(0, 19);
  var parentZalo = String(body.parentZalo || '').trim().slice(0, 19);
  var khoi = [10, 11, 12].indexOf(Number(body.khoi)) > -1 ? Number(body.khoi) : 12;
  var refTyped = normCode(body.referralCode).slice(0, 29);
  if(!name || !/^[a-z0-9.+_-]+@gmail\.com$/.test(gmail) || !isVNPhone(phone) || !isVNPhone(parentZalo)){
    res.status(400).json({ error: 'Thông tin chưa hợp lệ — kiểm tra lại họ tên, Gmail (@gmail.com) và số điện thoại.' });
    return;
  }

  try{
    // 1) Gmail đã có tài khoản? (kiểm tra TRƯỚC khi tính lượt, để gõ lại Gmail cũ không bị trừ lượt)
    var rawGmail = String(body.gmail || '').trim().slice(0, 119);
    var dupSnap = await db.collection('students').where('email', '==', gmail).limit(1).get();
    if(dupSnap.empty && rawGmail !== gmail) dupSnap = await db.collection('students').where('email', '==', rawGmail).limit(1).get();
    if(!dupSnap.empty){
      res.status(409).json({ error: 'Gmail này đã có tài khoản FaradayAI. Em bấm "Đăng nhập" để vào học; quên mật khẩu thì nhắn thầy qua Zalo để được cấp lại.', exists: true });
      return;
    }

    // 2) giới hạn số lần đăng ký (theo IP + tổng trong ngày), 1 doc/ngày
    var ymd = vnYmd();
    var ipKey = crypto.createHash('sha256').update(clientIp(req)).digest('hex').slice(0, 16);
    var limRef = db.collection('signup_limits').doc(ymd);
    var limitMsg = await db.runTransaction(async function(tx){
      var snap = await tx.get(limRef);
      var d = snap.exists ? (snap.data() || {}) : {};
      var total = Number(d.total) || 0, ips = d.ips || {}, mine = Number(ips[ipKey]) || 0;
      if(total >= SIGNUP_TOTAL_PER_DAY) return 'Hôm nay số lượt đăng ký học thử đã đủ — em quay lại vào ngày mai, hoặc nhắn thầy qua Zalo nhé.';
      if(mine >= SIGNUP_PER_IP_PER_DAY) return 'Máy này đã đăng ký nhiều lần hôm nay — nếu cần thêm tài khoản, em nhắn thầy qua Zalo nhé.';
      ips[ipKey] = mine + 1;
      tx.set(limRef, { total: total + 1, ips: ips, updatedAt: new Date().toISOString() }, { merge: true });
      return '';
    });
    if(limitMsg){ res.status(429).json({ error: limitMsg }); return; }

    // 3) tên đăng nhập = phần trước @ của Gmail; trùng với em khác thì thêm số
    var base = gmail.split('@')[0].replace(/[^a-z0-9._-]/g, '').slice(0, 40) || 'hocsinh';
    var username = base;
    for(var k = 0; k < 20; k++){
      var u = await db.collection('usernames').doc(username).get();
      if(!u.exists) break;
      username = base + (k < 8 ? (k + 2) : Math.floor(100 + Math.random() * 900));
    }

    // 4) gói: gói em chọn (nếu có và đang hiện trên trang chủ), không thì gói hiện đầu tiên — để admin › Học phí theo dõi học thử
    var planId = String(body.plan || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24), planName = String(body.planName || '').slice(0, 60);
    try{
      var pr = await db.collection('settings').doc('pricing').get();
      var tiers = pr.exists ? ((pr.data() || {}).tiers || []) : [];
      var vis = tiers.map(function(t, i){ return { id: String((t && t.id) || ('g' + (i + 1))).replace(/[^A-Za-z0-9_-]/g, ''), name: (t && t.name) || '', visible: !t || t.visible !== false }; }).filter(function(t){ return t.visible; });
      var hit = vis.filter(function(t){ return t.id === planId; })[0];
      if(!hit && vis.length){ hit = vis[0]; }
      if(hit){ planId = hit.id; planName = hit.name || planName; }
    }catch(e){ console.warn('Không đọc được settings/pricing:', e && e.message); }
    if(!planId) planId = 'g1';

    // 5) mã giới thiệu: ghi nhận người giới thiệu + mức giảm; hoa hồng cho người giới thiệu thầy cộng tay khi em đóng phí
    var referrer = null, discountVnd = 0, giftNew = '';
    if(refTyped){
      var rs = await db.collection('students').where('referralCode', '==', refTyped).limit(1).get();
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

    var password = genPassword();
    var nowIso = new Date().toISOString();
    var trialEnd = vnYmd(Date.now() + FREE_TRIAL_DAYS * 86400000);
    var stuRef = db.collection('students').doc();
    var newStu = {
      name: name, username: username, password: bcrypt.hashSync(password, 10),
      email: gmail, phone: phone, khoi: khoi,
      school: 'Chưa cập nhật', completedExamsCount: 0, averageScore: 0, highestScore: 0,
      targetScore: 9.0, status: 'active',
      parentName: 'Chưa cập nhật', parentPhone: parentZalo, parentEmail: '',
      referralCode: makeReferralCode(name), commissionBalance: 0,
      billing: { plan: planId, cycle: 'trial', startDate: vnYmd(), trialEnd: trialEnd, payments: [] },
      signupSource: 'free_signup', signupAt: nowIso
    };
    if(referrer){
      newStu.referredByCode = referrer.data.referralCode || refTyped;
      newStu.referredById = referrer.id;
      newStu.referralDiscountVnd = discountVnd;
      if(giftNew){ newStu.referralGift = giftNew; newStu.referralGiftDone = false; }
    }
    var batch = db.batch();
    batch.set(stuRef, newStu);
    batch.set(db.collection('usernames').doc(username), { studentId: stuRef.id });
    batch.set(db.collection('registrations').doc(), {
      name: name, gmail: gmail, phone: phone, parentZalo: parentZalo, referralCode: refTyped,
      status: 'converted', createdAt: nowIso, convertedStudentId: stuRef.id, convertedAt: nowIso,
      source: 'free_signup:' + planId + ':' + planName.replace(/[:\n\r]/g, ' ')
    });
    await batch.commit();

    var mail = await sendCredentialMail(gmail, { name: name, username: username, password: password, trialEnd: trialEnd });
    if(mail.sent) await stuRef.update({ signupMailSentAt: new Date().toISOString() }).catch(function(){});

    res.status(200).json({
      ok: true, studentId: stuRef.id, username: username, password: password, trialEnd: trialEnd, trialDays: FREE_TRIAL_DAYS,
      emailSent: !!mail.sent, discountVnd: discountVnd, referrerFound: !!referrer, codeNotFound: !!(refTyped && !referrer)
    });
  }catch(err){
    console.error('Lỗi đăng ký học thử:', err);
    res.status(500).json({ error: 'server_error' });
  }
}
