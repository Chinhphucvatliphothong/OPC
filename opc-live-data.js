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
  getFirestore, collection, doc, getDoc, getDocs, query, orderBy
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
    return { ok: false, error: 'Lỗi kết nối tới máy chủ — thử lại sau ít phút.' };
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
    var all = [];
    snap.forEach(function(d){
      var exam = d.data() || {};
      var meta = { examId: d.id, title: exam.title || '' };
      (exam.questions || []).forEach(function(q){
        all.push(transformQuestion(q, meta));
      });
    });
    return all;
  }catch(e){
    console.error('Lỗi tải ngân hàng đề thật:', e);
    return [];
  }
}

window.OPC_LIVE = {
  loginStudent: loginStudent,
  logoutStudent: logoutStudent,
  resumeSession: resumeSession,
  loadRealQuestionBank: loadRealQuestionBank
};
try{ window.dispatchEvent(new CustomEvent('opc-live-ready')); }catch(e){}
