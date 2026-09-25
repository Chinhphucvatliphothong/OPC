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
