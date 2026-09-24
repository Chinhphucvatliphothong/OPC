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
 * GHI CHÚ BẢO MẬT (đọc kỹ trước khi mở rộng):
 * Đây là cách đăng nhập ĐƠN GIẢN — so khớp username/mật khẩu (dạng chữ
 * thường, không mã hoá) ngay trên trình duyệt — KHÔNG phải Firebase
 * Authentication thật. Để làm được điều này, firestore.rules phải cho
 * phép đọc công khai (get — tức là biết đúng ID/username mới đọc được,
 * KHÔNG cho liệt kê "list" toàn bộ danh sách) 2 collection "usernames" và
 * "students", và đọc công khai toàn bộ "de_thi" (vì chưa có Auth thật để
 * giới hạn theo từng học sinh). Nghĩa là ai có đúng tên đăng nhập của một
 * em học sinh vẫn có thể dò mật khẩu (không giới hạn số lần thử). Đây là
 * đánh đổi CHỦ ĐỘNG chọn để triển khai nhanh — khi cần an toàn hơn, nên
 * chuyển "loginStudent" sang gọi Firebase Authentication thật (email/mật
 * khẩu, có giới hạn số lần thử phía server) — chỉ cần sửa trong file này,
 * không cần sửa giao diện prepscholar-ui.js.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

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

var SESSION_KEY = 'opc_student_session_v1';

// ================= Đăng nhập học sinh =================
async function loginStudent(usernameRaw, passwordRaw){
  var username = String(usernameRaw || '').trim().toLowerCase();
  var password = String(passwordRaw || '');
  if(!username || !password){
    return { ok: false, error: 'Vui lòng nhập đủ tên đăng nhập và mật khẩu.' };
  }
  try{
    var mapSnap = await getDoc(doc(db, 'usernames', username));
    if(!mapSnap.exists()){
      return { ok: false, error: 'Không tìm thấy tài khoản này. Kiểm tra lại tên đăng nhập hoặc liên hệ thầy cô.' };
    }
    var studentId = (mapSnap.data() || {}).studentId;
    var stuSnap = studentId ? await getDoc(doc(db, 'students', studentId)) : null;
    if(!stuSnap || !stuSnap.exists()){
      return { ok: false, error: 'Tài khoản không hợp lệ — liên hệ thầy cô để được hỗ trợ.' };
    }
    var student = Object.assign({ id: stuSnap.id }, stuSnap.data());
    if(String(student.password || '') !== password){
      return { ok: false, error: 'Sai mật khẩu. Kiểm tra lại hoặc liên hệ thầy cô để được cấp lại.' };
    }
    try{ sessionStorage.setItem(SESSION_KEY, JSON.stringify({ studentId: student.id, username: username })); }catch(e){}
    return { ok: true, student: student };
  }catch(e){
    console.error('Lỗi đăng nhập học sinh:', e);
    // "permission-denied" gần như luôn có nghĩa là firestore.rules mới CHƯA
    // được dán/Publish trong Firebase Console — báo rõ để dễ tự chẩn đoán,
    // thay vì chỉ nói chung chung "lỗi kết nối".
    if(e && e.code === 'permission-denied'){
      return { ok: false, error: 'Hệ thống chưa cho phép đăng nhập (firestore.rules chưa được cập nhật/Publish trong Firebase Console). Báo thầy cô kiểm tra lại bước này.' };
    }
    return { ok: false, error: 'Lỗi kết nối tới máy chủ (' + (e && (e.code || e.message) || 'không rõ') + ') — thử lại sau ít phút.' };
  }
}

function logoutStudent(){
  try{ sessionStorage.removeItem(SESSION_KEY); }catch(e){}
}

async function resumeSession(){
  var raw = null;
  try{ raw = sessionStorage.getItem(SESSION_KEY); }catch(e){}
  if(!raw) return null;
  var parsed;
  try{ parsed = JSON.parse(raw); }catch(e){ return null; }
  if(!parsed || !parsed.studentId) return null;
  try{
    var stuSnap = await getDoc(doc(db, 'students', parsed.studentId));
    if(!stuSnap.exists()){ logoutStudent(); return null; }
    return Object.assign({ id: stuSnap.id }, stuSnap.data());
  }catch(e){
    console.error('Lỗi tải lại phiên đăng nhập:', e);
    return null;
  }
}

// ================= Lịch sử luyện tập thật =================
// Lưu dưới subcollection students/{studentId}/attempts — KHÔNG lưu lại toàn
// bộ nội dung câu hỏi (đã có sẵn trong ngân hàng đề), chỉ lưu điểm số + kết
// quả đúng/sai từng câu (kèm nanoId/baiKey/topicKey) để tính lại mastery
// thật. Ghi chú bảo mật: vì chưa có Auth thật, bất kỳ ai biết đúng studentId
// (có được sau khi đăng nhập) đều ghi được — chấp nhận cùng đánh đổi với
// phần đăng nhập ở trên.
async function saveAttempt(studentId, attempt){
  if(!studentId) return { ok: false, error: 'Thiếu studentId.' };
  try{
    var ref = doc(collection(db, 'students', studentId, 'attempts'));
    await setDoc(ref, Object.assign({}, attempt, { createdAt: new Date().toISOString() }));
    return { ok: true, id: ref.id };
  }catch(e){
    console.error('Lỗi lưu kết quả luyện tập:', e);
    return { ok: false, error: (e && e.code) || 'unknown' };
  }
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
async function submitRegistration(data){
  try{
    var ref = doc(collection(db, 'registrations'));
    await setDoc(ref, {
      name: String((data && data.name) || '').slice(0, 99),
      gmail: String((data && data.gmail) || '').slice(0, 119),
      phone: String((data && data.phone) || '').slice(0, 19),
      parentZalo: String((data && data.parentZalo) || '').slice(0, 19),
      referralCode: String((data && data.referralCode) || '').slice(0, 29),
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
// Ghi chú bảo mật: cùng đánh đổi như saveAttempt ở trên — chưa có Auth thật
// nên tạm mở ghi theo đúng studentId (xem match /student_stats/{studentId}
// trong firestore.rules).
async function saveStudentStats(studentId, stats){
  if(!studentId) return { ok: false, error: 'Thiếu studentId.' };
  try{
    var ref = doc(db, 'student_stats', studentId);
    await setDoc(ref, Object.assign({}, stats, { updatedAt: new Date().toISOString() }), { merge: true });
    return { ok: true };
  }catch(e){
    console.error('Lỗi lưu số liệu học tập:', e);
    return { ok: false, error: (e && e.code) || 'unknown' };
  }
}

// ================= Mặt bằng chung (peer benchmark) cho Radar 5 chiều ========
// Đọc TOÀN BỘ collection student_stats (đã cho phép "read" công khai — xem
// firestore.rules, cùng đánh đổi bảo mật với attempts/student_stats ở trên)
// để tính trung bình cộng radar5 của MỌI học sinh THẬT đã có số liệu, dùng
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
async function loadExamImages(examId, imagesMeta){
  if(!imagesMeta || !imagesMeta.length) return [];
  if(imagesMeta[0] && (imagesMeta[0].url || imagesMeta[0].dataUrl)) return imagesMeta;
  try{
    var snap = await getDocs(collection(db, 'de_thi', examId, 'images'));
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
    examTitle: examMeta.title,
    examId: examMeta.examId,
    baiKey: (q.nanoBaiKey || (bai ? bai.key : '')) || '',
    nanoId: (q.nanoPointIds && q.nanoPointIds[0]) || null
  };
  if(q.type === 'choiceTF'){
    out.statements = (q.options || []).map(function(o){ return { key: o.key, text: o.text, isTrue: !!o.isTrue }; });
  } else if(q.type === 'shortans'){
    var m = String(q.shortans || '').match(/-?\d+([.,]\d+)?/);
    out.correctAnswer = m ? Number(m[0].replace(',', '.')) : null;
    out.tolerance = 0.5; // chưa có dữ liệu dung sai gốc — mặc định tạm
    out.unit = '';
  } else {
    out.options = (q.options || []).map(function(o){ return { key: o.key, text: o.text }; });
    var correct = (q.options || []).filter(function(o){ return o.isTrue; })[0];
    out.correctKey = correct ? correct.key : null;
  }
  return out;
}

async function loadRealQuestionBank(){
  try{
    var snap = await getDocs(query(collection(db, 'de_thi'), orderBy('createdAt', 'desc')));
    var docs = [];
    snap.forEach(function(d){ docs.push(d); });
    var all = [];
    for(var i = 0; i < docs.length; i++){
      var d = docs[i];
      var exam = d.data() || {};
      var resolvedImages = await loadExamImages(d.id, exam.images);
      var meta = { examId: d.id, title: exam.title || '', images: resolvedImages };
      (exam.questions || []).forEach(function(q){
        all.push(transformQuestion(q, meta));
      });
    }
    return all;
  }catch(e){
    console.error('Lỗi tải ngân hàng đề thật:', e);
    return [];
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

window.OPC_LIVE = {
  loginStudent: loginStudent,
  logoutStudent: logoutStudent,
  resumeSession: resumeSession,
  loadRealQuestionBank: loadRealQuestionBank,
  saveAttempt: saveAttempt,
  loadAttempts: loadAttempts,
  loadAssignedExams: loadAssignedExams,
  submitRegistration: submitRegistration,
  saveStudentStats: saveStudentStats,
  loadPeerRadar5: loadPeerRadar5,
  loadPricingPlans: loadPricingPlans
};
try{ window.dispatchEvent(new CustomEvent('opc-live-ready')); }catch(e){}
