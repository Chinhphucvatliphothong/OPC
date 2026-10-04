/**
 * OPC Luyện Thi Vật Lí — Kết nối dữ liệu THẬT (Firestore) cho trang học sinh
 * ---------------------------------------------------------------------
 * Trang học sinh (index.html) trước đây chỉ dùng dữ liệu minh hoạ cứng
 * (QUESTION_BANK trong prepscholar.js, danh sách học sinh mẫu trong
 * prepscholar-ui.js). File này nạp DỮ LIỆU THẬT từ cùng project Firebase
 * mà admin.html dùng, để:
 *   1) Học sinh đăng nhập bằng tên đăng nhập/mật khẩu thầy đã cấp sẵn khi
 *      thêm học sinh trong admin (nút "🔄 Đồng bộ đăng nhập").
 *   2) Nạp ngân hàng đề thật (collection "de_thi") thay cho câu hỏi minh hoạ.
 *
 * SỬA 25/9/2026 — chuyển sang Firebase Authentication THẬT (trước khi mở
 * công khai ra thị trường): "loginStudent" giờ gọi api/student-login.js
 * (server, dùng Firebase Admin SDK kiểm tra username/mật khẩu — không lộ
 * qua firestore.rules nữa) để lấy 1 Custom Token, rồi ký vào phiên Firebase
 * Auth thật bằng signInWithCustomToken. Từ đây firestore.rules mới biết
 * chắc chắn request.auth.uid == đúng studentId, nên khoá được: ngân hàng đề
 * + hồ sơ học sinh không còn đọc công khai (không cần đăng nhập) được nữa,
 * mỗi em chỉ đọc/ghi đúng dữ liệu của chính mình (xem firestore.rules).
 * Phiên đăng nhập giờ do chính Firebase Auth SDK lưu lại (bền hơn hẳn
 * sessionStorage cũ — sống sót qua cả việc đóng hẳn trình duyệt, không chỉ
 * trong 1 tab), nên "resumeSession" chỉ cần chờ onAuthStateChanged báo lại.
 * KHÔNG cần sửa gì ở prepscholar-ui.js cho phần đăng nhập/đăng xuất — vẫn
 * gọi đúng loginStudent/resumeSession/logoutStudent như cũ (đúng như ghi
 * chú cũ đã tính trước: "chỉ cần sửa trong file này").
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, signInWithCustomToken, signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

var firebaseConfig = {
  apiKey: "AIzaSyDurMtOnC6ghLYFIRBteHL348i-D983oRk",
  authDomain: "opcluyenthivatli.firebaseapp.com",
  projectId: "opcluyenthivatli",
  storageBucket: "opcluyenthivatli.firebasestorage.app",
  messagingSenderId: "90488773349",
  appId: "1:90488773349:web:4bd83994c72afe12dc920c",
  measurementId: "G-T3W59KBK01"
};

var app = initializeApp(firebaseConfig);
var db = getFirestore(app);
var auth = getAuth(app);

// ================= Đăng nhập học sinh =================
async function loginStudent(usernameRaw, passwordRaw){
  var username = String(usernameRaw || '').trim().toLowerCase();
  var password = String(passwordRaw || '');
  if(!username || !password){
    return { ok: false, error: 'Vui lòng nhập đủ tên đăng nhập và mật khẩu.' };
  }
  try{
    var res = await fetch('/api/student-login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    });
    var data = await res.json().catch(function(){ return {}; });
    if(!res.ok || !data || !data.ok || !data.token){
      return { ok: false, error: (data && data.error) || 'Đăng nhập thất bại — thử lại sau ít phút.' };
    }
    await signInWithCustomToken(auth, data.token);
    var stuSnap = await getDoc(doc(db, 'students', data.studentId));
    if(!stuSnap.exists()){
      return { ok: false, error: 'Tài khoản không hợp lệ — liên hệ thầy cô để được hỗ trợ.' };
    }
    // SỬA 1/10/2026: id của DOC luôn thắng — nếu hồ sơ lỡ có trường "id" riêng, trước đây nó ĐÈ lên mã doc
    // khiến đường dẫn ghi students/{id}/attempts sai và bị rules từ chối (uid != id).
    return { ok: true, student: Object.assign({}, stuSnap.data(), { id: stuSnap.id }) };
  }catch(e){
    console.error('Lỗi đăng nhập học sinh:', e);
    return { ok: false, error: 'Lỗi kết nối tới máy chủ (' + (e && (e.code || e.message) || 'không rõ') + ') — thử lại sau ít phút.' };
  }
}

function logoutStudent(){
  signOut(auth).catch(function(e){ console.error('Lỗi đăng xuất:', e); });
}

// Chờ Firebase Auth SDK tự báo lại phiên đăng nhập cũ (đã lưu bền trên máy
// học sinh từ lần đăng nhập trước — KHÔNG cần sessionStorage tự quản nữa).
// onAuthStateChanged luôn gọi lại ít nhất 1 lần lúc khởi động (null nếu
// chưa từng đăng nhập/đã đăng xuất), nên Promise này luôn resolve.
function waitForAuthUser(){
  return new Promise(function(resolve){
    var unsub = onAuthStateChanged(auth, function(user){
      unsub();
      resolve(user);
    });
  });
}

async function resumeSession(){
  try{
    var user = await waitForAuthUser();
    if(!user) return null;
    var stuSnap = await getDoc(doc(db, 'students', user.uid));
    if(!stuSnap.exists()){ logoutStudent(); return null; }
    return Object.assign({}, stuSnap.data(), { id: stuSnap.id });
  }catch(e){
    console.error('Lỗi tải lại phiên đăng nhập:', e);
    return null;
  }
}

// ================= Lịch sử luyện tập thật =================
// Lưu dưới subcollection students/{studentId}/attempts — KHÔNG lưu lại toàn
// bộ nội dung câu hỏi (đã có sẵn trong ngân hàng đề), chỉ lưu điểm số + kết
// quả đúng/sai từng câu (kèm nanoId/baiKey/topicKey) để tính lại mastery
// thật. SỬA 25/9/2026: nhờ Firebase Auth thật (xem loginStudent ở trên),
// firestore.rules giờ chỉ cho phép đúng học sinh đang đăng nhập (hoặc
// admin) ghi vào đúng attempts của chính mình — không còn ai ghi được cho
// người khác nữa.
// THÊM 1/10/2026 — Firestore TỪ CHỐI cả bản ghi nếu có bất kỳ trường undefined
// (lỗi "Unsupported field value: undefined"), khiến kết quả bài làm mất âm
// thầm. Loại bỏ trường undefined (và đổi undefined trong mảng thành null) trước
// khi ghi để một trường thiếu không làm mất cả lượt làm bài.
function stripUndefined(v){
  if(Array.isArray(v)) return v.map(function(x){ return x === undefined ? null : stripUndefined(x); });
  if(v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype){
    var o = {};
    Object.keys(v).forEach(function(k){ if(v[k] !== undefined) o[k] = stripUndefined(v[k]); });
    return o;
  }
  return v;
}

// ---- THÊM 1/10/2026 — HÀNG ĐỢI LƯU BÀI + LƯU IDEMPOTENT ----
// Trước đây lưu thất bại là MẤT bài làm (admin không thấy em nào đã làm). Nay:
//  - mỗi lượt nộp có clientId -> dùng làm ID doc, nên lưu lại nhiều lần vẫn chỉ
//    ra ĐÚNG 1 doc (không trùng lượt);
//  - lưu thất bại -> bản ghi được giữ trong localStorage của máy và tự lưu lại
//    ở lần đăng nhập kế tiếp (flushPendingAttempts) hoặc khi em bấm "Lưu lại";
//  - lỗi trả về kèm mã lỗi + uid đang đăng nhập để chẩn đoán đúng nguyên nhân.
var PENDING_KEY = 'faradayai_pending_attempts_v1';
function readPending(){
  try{
    var raw = window.localStorage.getItem(PENDING_KEY);
    var arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  }catch(e){ return []; }
}
function writePending(arr){
  try{ window.localStorage.setItem(PENDING_KEY, JSON.stringify(arr.slice(-20))); }catch(e){}
}
function queueAttempt(studentId, record){
  if(!record || !record.clientId) return;
  var arr = readPending().filter(function(x){ return !(x && x.record && x.record.clientId === record.clientId); });
  arr.push({ studentId: studentId, record: record });
  writePending(arr);
}
function dequeueAttempt(clientId){
  writePending(readPending().filter(function(x){ return !(x && x.record && x.record.clientId === clientId); }));
}
function saveErrorInfo(e){
  return {
    ok: false,
    error: (e && e.code) || 'unknown',
    message: (e && e.message) || '',
    authUid: (auth.currentUser && auth.currentUser.uid) || null,
    online: (typeof navigator !== 'undefined') ? navigator.onLine !== false : true
  };
}
async function saveAttempt(studentId, attempt){
  if(!studentId) return { ok: false, error: 'Thiếu studentId.' };
  var rec = Object.assign({}, attempt, { createdAt: (attempt && attempt.createdAt) || new Date().toISOString() });
  try{
    var ref = rec.clientId
      ? doc(db, 'students', studentId, 'attempts', String(rec.clientId))
      : doc(collection(db, 'students', studentId, 'attempts'));
    await setDoc(ref, stripUndefined(rec));
    if(rec.clientId) dequeueAttempt(rec.clientId);
    return { ok: true, id: ref.id };
  }catch(e){
    console.error('Lỗi lưu kết quả luyện tập:', e);
    queueAttempt(studentId, rec);
    return saveErrorInfo(e);
  }
}
// Lưu nốt các bài còn tồn trên máy này của em (gọi ngay sau khi đăng nhập).
async function flushPendingAttempts(studentId){
  var list = readPending().filter(function(x){ return x && x.studentId === studentId && x.record; });
  var saved = 0;
  for(var i = 0; i < list.length; i++){
    var r = await saveAttempt(studentId, list[i].record);
    if(r && r.ok) saved++; else break;
  }
  return saved;
}
// Tự chẩn đoán: em đang đăng nhập bằng tài khoản nào, đọc/ghi được lịch sử không.
async function diagnoseSave(studentId){
  var out = {
    studentId: studentId || null,
    authUid: (auth.currentUser && auth.currentUser.uid) || null,
    online: (typeof navigator !== 'undefined') ? navigator.onLine !== false : true,
    pending: readPending().filter(function(x){ return x && x.studentId === studentId; }).length,
    read: null, write: null
  };
  try{
    await getDocs(query(collection(db, 'students', studentId, 'attempts'), limit(1)));
    out.read = 'ok';
  }catch(e){ out.read = (e && e.code) || 'unknown'; }
  try{
    var pref = doc(db, 'students', studentId, 'attempts', '_ping');
    await setDoc(pref, { type: 'ping', createdAt: new Date().toISOString() });
    await deleteDoc(pref);
    out.write = 'ok';
  }catch(e){ out.write = (e && e.code) || 'unknown'; }
  return out;
}

async function loadAttempts(studentId, max){
  if(!studentId) return [];
  try{
    var snap = await getDocs(query(
      collection(db, 'students', studentId, 'attempts'),
      orderBy('createdAt', 'desc'),
      limit(max || 100)
    ));
    var out = [];
    snap.forEach(function(d){ out.push(Object.assign({ id: d.id }, d.data())); });
    return out;
  }catch(e){
    console.error('Lỗi tải lịch sử luyện tập:', e);
    return [];
  }
}

// ================= Đề cá nhân hóa được giao =================
// Lưu dưới subcollection students/{studentId}/assignedExams — GHI chỉ do
// admin.html (Firebase Auth thật) khi giáo viên bấm "Giao đề cho học sinh"
// trong panel "Tạo đề theo lộ trình cá nhân hóa". Mỗi đề đã chứa SẴN câu hỏi
// ở đúng định dạng QUESTION_BANK (xem toStudentQuestionShape trong
// admin.html, lặp lại transformQuestion/resolveQuestionImages ở trên) nên
// trang luyện tập chỉ cần đọc và cho làm bài ngay, không cần transform gì
// thêm.
async function loadAssignedExams(studentId, max){
  if(!studentId) return [];
  try{
    var snap = await getDocs(query(
      collection(db, 'students', studentId, 'assignedExams'),
      orderBy('createdAt', 'desc'),
      limit(max || 20)
    ));
    var out = [];
    snap.forEach(function(d){ out.push(Object.assign({ id: d.id }, d.data())); });
    return out;
  }catch(e){
    console.error('Lỗi tải đề được giao:', e);
    return [];
  }
}

// ================= Đăng ký lớp thử nghiệm (trang giới thiệu) =================
// THÊM 24/9/2026 — thay cho luồng mailto cũ trong index.html (gửi thẳng mật
// khẩu tự đặt qua email, không lưu gì lại nên lỡ sót email là mất luôn
// lead). Ghi thẳng vào collection "registrations" — công khai (create) vì
// học sinh đăng ký chưa có tài khoản gì, nhưng bị firestore.rules giới hạn
// chặt (chỉ đúng các trường liệt kê, đúng kiểu, status luôn 'pending') để
// tránh bị spam ghi rác. Thầy cô duyệt trong admin.html (panel "Danh sách
// học sinh" — banner "Đăng ký chờ duyệt") rồi mới tạo tài khoản thật, tự
// sinh username/mật khẩu — KHÔNG còn thu mật khẩu tự đặt của học sinh nữa.
// THÊM 2/10/2026 — chuẩn hoá mã giới thiệu: bỏ dấu tiếng Việt, bỏ khoảng trắng, IN HOA,
// chỉ giữ A-Z 0-9 _ -. Mã cũ sinh từ tên có dấu (vd. "TÚ123VLY") — học sinh gõ
// "TU123VLY" vẫn khớp khi admin so khớp bằng cùng hàm này (xem admin.html).
function normalizeReferralCode(v){
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

// THÊM 2/10/2026 — mức ưu đãi giới thiệu do admin đặt (settings/referral, đọc công khai).
// discountVnd: giảm cho học sinh mới nhập mã hợp lệ; commissionVnd: cộng cho người giới thiệu.
// Chưa cấu hình/lỗi mạng -> mặc định 100.000đ (đúng mức cũ).
async function loadReferralSettings(){
  var out = { discountVnd: 100000, commissionVnd: 100000 };
  try{
    var snap = await getDoc(doc(db, 'settings', 'referral'));
    if(snap.exists()){
      var d = snap.data() || {};
      if(isFinite(Number(d.discountVnd)) && Number(d.discountVnd) >= 0) out.discountVnd = Number(d.discountVnd);
      if(isFinite(Number(d.commissionVnd)) && Number(d.commissionVnd) >= 0) out.commissionVnd = Number(d.commissionVnd);
    }
  }catch(e){ console.warn('Lỗi tải ưu đãi giới thiệu:', e); }
  return out;
}

async function submitRegistration(data){
  try{
    var ref = doc(collection(db, 'registrations'));
    await setDoc(ref, {
      name: String((data && data.name) || '').slice(0, 99),
      gmail: String((data && data.gmail) || '').slice(0, 119),
      phone: String((data && data.phone) || '').slice(0, 19),
      parentZalo: String((data && data.parentZalo) || '').slice(0, 19),
      referralCode: normalizeReferralCode((data && data.referralCode) || '').slice(0, 29),
      status: 'pending',
      createdAt: new Date().toISOString(),
      source: 'landing_page'
    });
    return { ok: true, id: ref.id };
  }catch(e){
    console.error('Lỗi gửi đăng ký lớp thử nghiệm:', e);
    return { ok: false, error: (e && e.code) || 'unknown' };
  }
}

// ================= Số liệu học tập thật (cho trang Giám sát của thầy cô) ====
// Ghi vào collection RIÊNG ở cấp cao nhất "student_stats/{studentId}" (KHÔNG
// phải subcollection của students/{studentId}) vì phiên học của học sinh
// không có quyền ghi vào chính document students/{studentId} (document đó
// admin-only, xem firestore.rules). student_stats là bản "snapshot" mastery/
// điểm dự đoán/sổ câu sai mới nhất do CHÍNH trang luyện tập tự tính (qua
// computeStudentStatsFromAttempts trong prepscholar.js) rồi ghi đè lại sau
// mỗi lần nộp bài — nhờ vậy trang admin (PrepScholarMonitoringPanel) chỉ cần
// đọc 1 lần toàn bộ collection này thay vì đọc attempts của từng học sinh.
// SỬA 25/9/2026: firestore.rules giờ chỉ cho phép đúng học sinh đang đăng
// nhập ghi vào đúng student_stats của chính mình (request.auth.uid ==
// studentId) — xem match /student_stats/{studentId} trong firestore.rules.
async function saveStudentStats(studentId, stats){
  if(!studentId) return { ok: false, error: 'Thiếu studentId.' };
  try{
    var ref = doc(db, 'student_stats', studentId);
    await setDoc(ref, stripUndefined(Object.assign({}, stats, { updatedAt: new Date().toISOString() })), { merge: true });
    return { ok: true };
  }catch(e){
    console.error('Lỗi lưu số liệu học tập:', e);
    return { ok: false, error: (e && e.code) || 'unknown' };
  }
}

// ================= Mặt bằng chung (peer benchmark) cho Radar 5 chiều ========
// Đọc TOÀN BỘ collection student_stats (SỬA 25/9/2026: giờ chỉ đọc được khi
// đã đăng nhập thật — request.auth != null — không còn công khai cho người
// lạ nữa, xem firestore.rules) để tính trung bình cộng radar5 của MỌI học
// sinh THẬT đã có số liệu, dùng
// vẽ đường "Mặt bằng chung" trên biểu đồ Radar của từng em. Đây là số liệu
// THẬT (trung bình của các bạn học cùng hệ thống OPC) — KHÔNG PHẢI mặt bằng
// chuẩn quốc gia "THPT 2026" (không có nguồn dữ liệu đó) nên giao diện phải
// ghi rõ "Mặt bằng chung OPC", không được gắn nhãn quốc gia dễ gây hiểu nhầm.
// Trả về null nếu chưa có học sinh nào có đủ số liệu cho ít nhất 1 chiều.
async function loadPeerRadar5(){
  try{
    var snap = await getDocs(collection(db, 'student_stats'));
    var sums = { lyThuyet: 0, vdc: 0, neBayTF: 0, doThi: 0, tinhNhanh: 0 };
    var counts = { lyThuyet: 0, vdc: 0, neBayTF: 0, doThi: 0, tinhNhanh: 0 };
    var studentsCounted = 0;
    snap.forEach(function(d){
      var r = (d.data() || {}).radar5;
      if(!r) return;
      var any = false;
      Object.keys(sums).forEach(function(k){
        if(r[k] != null){ sums[k] += Number(r[k]); counts[k]++; any = true; }
      });
      if(any) studentsCounted++;
    });
    if(!studentsCounted) return null;
    var avg = {};
    Object.keys(sums).forEach(function(k){ avg[k] = counts[k] ? Math.round(sums[k] / counts[k]) : null; });
    avg.sampleSize = studentsCounted;
    return avg;
  }catch(e){
    console.error('Lỗi tải mặt bằng chung Radar 5 chiều:', e);
    return null;
  }
}

// ================= Hình ảnh minh họa =================
// Ảnh được nạp ở CẤP ĐỀ THI (giáo viên chọn nhiều file cùng lúc khi upload
// .tex), không gắn trực tiếp theo từng câu trong Firestore. parseTexBank
// (admin.html) chỉ ghi lại TÊN FILE mà mỗi câu tham chiếu qua lệnh
// \includegraphics{...} (q.images: mảng tên file). Ở đây ta khớp tên file đó
// với danh sách ảnh thật của đề (exam.images: {name, url/dataUrl, ...}) để
// lấy đúng dữ liệu ảnh (dataURL đã nén) hiển thị cho học sinh.
// Nếu đề có nhiều ảnh/dung lượng lớn, saveExamDoc (admin.html) đã tách ảnh
// sang subcollection "images" — cần tải riêng trước khi khớp tên.
// col (THÊM 30/9/2026): collection chứa đề — mặc định 'de_thi'; ngân hàng
// HSG/Olympic dùng 'de_thi_hsg' / 'de_thi_olympic'.
async function loadExamImages(examId, imagesMeta, col){
  if(!imagesMeta || !imagesMeta.length) return [];
  if(imagesMeta[0] && (imagesMeta[0].url || imagesMeta[0].dataUrl)) return imagesMeta;
  try{
    var snap = await getDocs(collection(db, col || 'de_thi', examId, 'images'));
    var map = {};
    snap.forEach(function(d){ map[d.id] = d.data(); });
    return imagesMeta.map(function(im, idx){
      var full = map['img_' + idx] || map[im.subdocId];
      return full ? Object.assign({}, im, full) : im;
    });
  }catch(e){
    console.warn('Lỗi tải subcollection images:', e);
    return imagesMeta;
  }
}

function normalizeImgName(name){
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/^.*[\\/]/, '') // bỏ đường dẫn thư mục nếu có
    .replace(/\.[a-z0-9]+$/i, ''); // bỏ phần đuôi file để so khớp linh hoạt hơn
}

// Trả về mảng {name, url} các ảnh mà 1 câu hỏi tham chiếu, dựa trên danh sách
// tên file trong q.images và danh sách ảnh thật đã tải của đề thi.
function resolveQuestionImages(q, examImages){
  var refs = q.images || [];
  if(!refs.length || !examImages || !examImages.length) return [];
  var out = [];
  refs.forEach(function(ref){
    var key = normalizeImgName(ref);
    var found = examImages.filter(function(im){ return normalizeImgName(im.name) === key; })[0];
    var url = found ? (found.url || found.dataUrl) : '';
    if(url) out.push({ name: ref, url: url });
  });
  return out;
}

// THÊM 4/10/2026 — ĐỌC ĐÁP ÁN TRẢ LỜI NGẮN từ chuỗi LaTeX trong \shortans{...}.
// Lỗi cũ: "1{,}73" (dấu phẩy thập phân viết trong ngoặc để KaTeX hiện đúng) bị cắt ở "{" nên đọc ra 1.
// Nay chuẩn hoá {,} -> , rồi đọc đủ số; hiểu cả dạng 2{,}5\cdot10^{3}. Trả { value, decimals, exp } hoặc null.
// decimals = số chữ số sau dấu thập phân của đáp án gốc (dùng suy ra dung sai chấm bài).
function parseShortAnswer(raw){
  var s = String(raw == null ? '' : raw)
    .replace(/\{\s*,\s*\}/g, ',').replace(/\{\s*\.\s*\}/g, '.')
    .replace(/\$/g, '').replace(/\\[,;:!]/g, '').replace(/\\ /g, '').replace(/~/g, '');
  var sci = /(-?\d+(?:[.,]\d+)?)\s*(?:\\cdot|\\times|·|×|\*)\s*10\s*\^\s*\{?\s*(-?\d+)\s*\}?/.exec(s);
  var m = sci || /-?\d+(?:[.,]\d+)?/.exec(s);
  if(!m) return null;
  var mant = String(sci ? sci[1] : m[0]).replace(',', '.');
  var exp = sci ? parseInt(sci[2], 10) : 0;
  var dot = mant.indexOf('.');
  var decimals = dot < 0 ? 0 : mant.length - dot - 1;
  var value = Number((Number(mant) * Math.pow(10, exp)).toPrecision(12));
  if(!isFinite(value)) return null;
  return { value: value, decimals: decimals, exp: exp };
}

// ================= Ngân hàng đề thật =================
// Chuyển 1 câu hỏi ở định dạng admin.html (parseTexBank) sang định dạng mà
// prepscholar.js / prepscholar-ui.js đang render (xem QUESTION_BANK mẫu).
function transformQuestion(q, examMeta){
  var NANO = window.OPC_NANO;
  var chuDe = NANO ? NANO.findChuDeByText(q.chuDeLon) : null;
  var bai = null;
  if(NANO){
    bai = (q.nanoBaiKey && NANO.getBai(q.nanoBaiKey)) || NANO.findBaiByText(q.dangBai, chuDe ? chuDe.key : null);
  }
  var topicKey = chuDe ? chuDe.key : (bai ? bai.chuDeKey : null);
  var out = {
    id: examMeta.examId + '_q' + q.index,
    topicKey: topicKey,
    topicName: chuDe ? chuDe.name : (q.chuDeLon || 'Khác'),
    subtopic: bai ? bai.name : (q.dangBai || ''),
    part: q.part || 'I',
    level: q.level || 'M2',
    stem: q.stem || '',
    loiGiai: q.loigiai || '',
    images: resolveQuestionImages(q, examMeta.images),
    groupPassage: q.groupPassage || null,
    groupImages: resolveQuestionImages({ images: q.groupImages || [] }, examMeta.images),
    examTitle: examMeta.title,
    examId: examMeta.examId,
    baiKey: (q.nanoBaiKey || (bai ? bai.key : '')) || '',
    nanoId: (q.nanoPointIds && q.nanoPointIds[0]) || null,
    // THÊM 28/9/2026 — chương 1–4 (khoá/mở chương theo học sinh, xem
    // curriculum.js). null = chưa gắn chương -> không bao giờ hiện cho học
    // sinh (PrepScholarEngine chỉ giữ câu thuộc chương đã mở).
    chuong: window.OPC_CURRICULUM ? window.OPC_CURRICULUM.inferChuong(q) : null
  };
  if(q.type === 'choiceTF'){
    out.statements = (q.options || []).map(function(o){ return { key: o.key, text: o.text, isTrue: !!o.isTrue }; });
  } else if(q.type === 'shortans'){
    // SỬA 4/10/2026 — dùng parseShortAnswer (hiểu "1{,}73"); dung sai = nửa đơn vị chữ số cuối của đáp án
    // gốc (1,73 -> ±0,005; 7,5 -> ±0,05; 12 -> ±0,5). Trước đây cố định ±0,5 cho mọi câu nên đáp án 1,73
    // mà em điền 2 vẫn được tính đúng.
    var pa = parseShortAnswer(q.shortans);
    out.correctAnswer = pa ? pa.value : null;
    out.tolerance = pa ? (0.5 * Math.pow(10, -pa.decimals) * Math.pow(10, pa.exp) + 1e-9) : 0.5;
    out.unit = '';
  } else {
    out.options = (q.options || []).map(function(o){ return { key: o.key, text: o.text }; });
    var correct = (q.options || []).filter(function(o){ return o.isTrue; })[0];
    out.correctKey = correct ? correct.key : null;
  }
  return out;
}

// SỬA 2/10/2026 — tải ảnh của các đề SONG SONG (trước đây tải lần lượt từng đề
// nên ngân hàng lớn chờ rất lâu sau đăng nhập) và ghi lại mã lỗi cuối cùng vào
// lastBankError để giao diện biết "tải lỗi" khác "ngân hàng thật sự trống".
var lastBankError = null;
async function loadRealQuestionBank(){
  try{
    lastBankError = null;
    var snap = await getDocs(query(collection(db, 'de_thi'), orderBy('createdAt', 'desc')));
    var docs = [];
    snap.forEach(function(d){ docs.push(d); });
    var imagesList = await Promise.all(docs.map(function(d){
      var ex = d.data() || {};
      return loadExamImages(d.id, ex.images);
    }));
    var all = [];
    for(var i = 0; i < docs.length; i++){
      var d = docs[i];
      var exam = d.data() || {};
      var resolvedImages = imagesList[i];
      var meta = { examId: d.id, title: exam.title || '', images: resolvedImages };
      (exam.questions || []).forEach(function(q){
        all.push(transformQuestion(q, meta));
      });
      // THÊM 1/10/2026 — VIDEO CHỮA ĐỀ: ghi lại mốc video của đề này vào bảng
      // tra OPC_WALKTHROUGH (theo examId). Giao diện tra theo mã câu hỏi
      // (examId + '_q' + index) LÚC HIỂN THỊ — nên đề đã giao trước khi thêm
      // video, hay câu bị bốc/xáo ở chế độ nào, đều tìm đúng đoạn.
      if(window.OPC_WALKTHROUGH) window.OPC_WALKTHROUGH.register(d.id, exam.title || '', exam.videoWalkthrough || null);
    }
    return all;
  }catch(e){
    console.error('Lỗi tải ngân hàng đề thật:', e);
    lastBankError = (e && (e.code || e.message)) || 'unknown';
    return [];
  }
}

// ================= Đề HSG tỉnh/TP & đội tuyển Olympic =================
// THÊM 30/9/2026 — 2 ngân hàng RIÊNG, KHÔNG đi qua loadRealQuestionBank
// (nên không bao giờ lẫn vào luyện tập/thi thử Vật lí 12). firestore.rules
// chỉ cho đọc khi hồ sơ học sinh có specialAccess chứa track tương ứng —
// chưa được mở thì trả { ok:false, locked:true }.
var SPECIAL_COLLECTIONS = { hsg: 'de_thi_hsg', olympic: 'de_thi_olympic' };

// Chỉ tải DANH SÁCH đề (tiêu đề, số câu) — chưa tải ảnh cho nhẹ.
async function loadSpecialExamList(track){
  var col = SPECIAL_COLLECTIONS[track];
  if(!col) return { ok: false, error: 'Mục không tồn tại.' };
  try{
    var snap = await getDocs(query(collection(db, col), orderBy('createdAt', 'desc')));
    var list = [];
    snap.forEach(function(d){
      var ex = d.data() || {};
      var qs = ex.questions || [];
      list.push({ id: d.id, title: ex.title || 'Đề không tên', bai: ex.bai || '', chuDe: ex.chuDe || '',
        total: qs.length, essayCount: qs.filter(function(q){ return q.type === 'essay'; }).length,
        images: ex.images || [], questions: qs });
    });
    return { ok: true, list: list };
  }catch(e){
    if(e && e.code === 'permission-denied') return { ok: false, locked: true };
    console.error('Lỗi tải đề ' + track + ':', e);
    return { ok: false, error: (e && e.code) || 'unknown' };
  }
}

// Chuẩn bị 1 đề để làm: tải ảnh + đổi từng câu sang dạng hiển thị.
async function loadSpecialExam(track, exam){
  var imgs = await loadExamImages(exam.id, exam.images, SPECIAL_COLLECTIONS[track]);
  return (exam.questions || []).map(function(q){
    return {
      index: q.index, part: q.part || 'I', type: q.type || 'choice', level: q.level || '',
      stem: q.stem || '', loiGiai: q.loigiai || '',
      options: q.type === 'essay' ? [] : (q.options || []).map(function(o){ return { key: o.key, text: o.text, isTrue: !!o.isTrue }; }),
      shortans: q.shortans || null,
      images: resolveQuestionImages(q, imgs),
      groupPassage: q.groupPassage || null,
      groupImages: resolveQuestionImages({ images: q.groupImages || [] }, imgs)
    };
  });
}

// Lưu kết quả tự chấm — subcollection RIÊNG specialAttempts (không đụng
// attempts/student_stats của luyện thi Vật lí 12).
async function saveSpecialAttempt(studentId, data){
  if(!studentId) return { ok: false };
  try{
    var ref = doc(collection(db, 'students', studentId, 'specialAttempts'));
    await setDoc(ref, stripUndefined(Object.assign({}, data, { createdAt: new Date().toISOString() })));
    return { ok: true };
  }catch(e){
    console.error('Lỗi lưu kết quả HSG/Olympic:', e);
    return { ok: false, error: (e && e.code) || 'unknown' };
  }
}

// ================= Cấu hình Gói dịch vụ (giá/tính năng/ẩn-hiện) =============
// Đọc doc đơn "settings/pricing" do admin quản lý (panel "💰 Gói dịch vụ"
// trong admin.html) để trang chủ hiển thị đúng giá/tính năng hiện hành, và
// admin có thể ẩn/hiện từng gói hoặc cả mục mà không cần sửa code / deploy
// lại. Nếu doc chưa từng được lưu (admin chưa mở panel lần nào) hoặc lỗi
// mạng -> trả { ok:false } để trang chủ GIỮ NGUYÊN giá mặc định đã in sẵn
// trong HTML — không bao giờ vỡ giao diện chỉ vì chưa cấu hình.
async function loadPricingPlans(){
  try{
    var snap = await getDoc(doc(db, 'settings', 'pricing'));
    if(!snap.exists()) return { ok: false };
    return { ok: true, data: snap.data() };
  }catch(e){
    console.error('Lỗi tải cấu hình Gói dịch vụ:', e);
    return { ok: false, error: (e && e.code) || 'unknown' };
  }
}

// ================= Khoá/mở chương (settings/curriculum) =====================
// THÊM 28/9/2026 — doc đơn "settings/curriculum" { defaultUnlockedChapters }
// do admin quản lý (panel "📚 Quản lý chương" trong admin.html). "settings"
// đọc công khai (xem firestore.rules). Doc chưa tồn tại / lỗi mạng -> trả
// null để nơi gọi dùng mặc định [1,2] (OPC_CURRICULUM.getUnlockedChapters).
async function loadCurriculum(){
  try{
    var snap = await getDoc(doc(db, 'settings', 'curriculum'));
    return snap.exists() ? snap.data() : null;
  }catch(e){
    console.error('Lỗi tải cấu hình chương (settings/curriculum):', e);
    return null;
  }
}

window.OPC_LIVE = {
  loadCurriculum: loadCurriculum,
  loginStudent: loginStudent,
  logoutStudent: logoutStudent,
  resumeSession: resumeSession,
  loadRealQuestionBank: loadRealQuestionBank,
  getLastBankError: function(){ return lastBankError; },
  saveAttempt: saveAttempt,
  flushPendingAttempts: flushPendingAttempts,
  diagnoseSave: diagnoseSave,
  loadAttempts: loadAttempts,
  loadAssignedExams: loadAssignedExams,
  submitRegistration: submitRegistration,
  saveStudentStats: saveStudentStats,
  loadPeerRadar5: loadPeerRadar5,
  loadPricingPlans: loadPricingPlans,
  loadReferralSettings: loadReferralSettings,
  parseShortAnswer: parseShortAnswer,
  loadSpecialExamList: loadSpecialExamList,
  loadSpecialExam: loadSpecialExam,
  saveSpecialAttempt: saveSpecialAttempt
};
try{ window.dispatchEvent(new CustomEvent('opc-live-ready')); }catch(e){}
