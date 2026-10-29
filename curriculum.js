/**
 * FaradayAI Luyện Thi Vật Lí — Khoá/mở chương theo học sinh (dạy "cuốn chiếu")
 * ---------------------------------------------------------------------
 * THÊM 28/9/2026. File dùng CHUNG cho cả admin.html (trang "Quản lý
 * chương") lẫn trang học sinh (opc-live-data.js, prepscholar.js,
 * prepscholar-ui.js) để 2 phía luôn hiểu "chương" của 1 câu hỏi giống hệt
 * nhau — không viết trùng 2 bản dễ lệch nhau.
 *
 * Dữ liệu:
 *  - Mỗi câu hỏi (trong de_thi/{id}.questions) có thể có trường `chuong`
 *    (số 1–4). Nếu CHƯA có, suy ra từ TIỀN TỐ MÃ KIẾN THỨC nếu có (mã
 *    nano-point/Bài trong nano-map.js như "nhiet-2.3", "khi-4", "tt-2.1",
 *    "hn-3.2", hoặc mã kiểu "12.1.x"/"VL12.3..."); không suy ra được thì
 *    coi là CHƯA GẮN CHƯƠNG (null) — câu đó KHÔNG được xuất hiện với học
 *    sinh cho tới khi admin gắn bổ sung.
 *  - Firestore "settings/curriculum": { defaultUnlockedChapters: [1,2] }
 *    — chương mở mặc định cho cả lớp. Mỗi học sinh (students/{id}) có thể
 *    có `unlockedChapters` riêng, GHI ĐÈ hoàn toàn mặc định.
 *  - THÊM 28/10/2026: cùng doc đó còn có `defaultLockedLessons` (bài khoá mặc định
 *    cả lớp) và `lockedExams` (đề khoá trong ngân hàng); mỗi học sinh có thể có
 *    `lockedLessons` riêng ghi đè mặc định lớp — xem phần "KHOÁ/MỞ TỪNG BÀI" bên dưới.
 */
(function(window){
  'use strict';

  // THÊM 28/10/2026 — KHỐI 10/11/12. Mã chương: khối 12 giữ nguyên 1–4 (dữ liệu cũ không đổi);
  // khối 10 = 101–107 (7 chương); khối 11 = 111–114 (4 chương). Mã chương luôn cho biết khối của câu.
  var CHAPTERS = [
    { num: 1, topicKey: 'nhiet', name: 'Vật lí nhiệt', icon: '🔥', khoi: 12 },
    { num: 2, topicKey: 'khi', name: 'Khí lí tưởng', icon: '💨', khoi: 12 },
    { num: 3, topicKey: 'tu-truong', name: 'Từ trường', icon: '🧲', khoi: 12 },
    { num: 4, topicKey: 'hat-nhan', name: 'Vật lí hạt nhân', icon: '⚛️', khoi: 12 },
    { num: 101, topicKey: 'k10-mo-dau', name: 'Mở đầu', icon: '🔭', khoi: 10 },
    { num: 102, topicKey: 'k10-dong-hoc', name: 'Động học', icon: '🚀', khoi: 10 },
    { num: 103, topicKey: 'k10-dong-luc-hoc', name: 'Động lực học', icon: '🏋️', khoi: 10 },
    { num: 104, topicKey: 'k10-nang-luong', name: 'Năng lượng, công, công suất', icon: '🔆', khoi: 10 },
    { num: 105, topicKey: 'k10-dong-luong', name: 'Động lượng', icon: '💥', khoi: 10 },
    { num: 106, topicKey: 'k10-tron-deu', name: 'Chuyển động tròn đều', icon: '🔄', khoi: 10 },
    { num: 107, topicKey: 'k10-bien-dang', name: 'Biến dạng vật rắn – Áp suất chất lỏng', icon: '💧', khoi: 10 },
    { num: 111, topicKey: 'k11-dao-dong', name: 'Dao động', icon: '〰️', khoi: 11 },
    { num: 112, topicKey: 'k11-song', name: 'Sóng', icon: '🌊', khoi: 11 },
    { num: 113, topicKey: 'k11-dien-truong', name: 'Điện trường', icon: '⚡', khoi: 11 },
    { num: 114, topicKey: 'k11-dong-dien', name: 'Dòng điện, mạch điện', icon: '🔋', khoi: 11 }
  ];
  var ALL_CHAPTERS = CHAPTERS.map(function(c){ return c.num; });
  var KHOI_LIST = [10, 11, 12];
  var DEFAULT_UNLOCKED = [1, 2];

  // Khối của 1 học sinh: students/{id}.khoi (10/11/12); thiếu/không hợp lệ -> 12 (dữ liệu cũ toàn lớp 12).
  function khoiOf(v){
    var n = Number(v && typeof v === 'object' ? v.khoi : v);
    return (n === 10 || n === 11) ? n : 12;
  }
  function chaptersOfKhoi(k){
    k = khoiOf(k);
    return CHAPTERS.filter(function(c){ return c.khoi === k; });
  }
  function khoiOfChuong(num){
    var c = CHAPTERS.filter(function(x){ return x.num === Number(num); })[0];
    return c ? c.khoi : null;
  }
  // Số thứ tự chương HIỂN THỊ trong sách: khối 12 = 1–4; khối 10 = 101–107 -> 1–7; khối 11 = 111–114 -> 1–4.
  function chapterNo(num){
    var n = Number(num);
    if(n >= 101 && n <= 107) return n - 100;
    if(n >= 111 && n <= 114) return n - 110;
    return n;
  }
  // Mặc định mở cho 1 khối khi admin chưa cấu hình: 2 chương đầu (giống khối 12 mặc định [1,2]).
  function defaultUnlockedForKhoi(k){
    return chaptersOfKhoi(k).slice(0, 2).map(function(c){ return c.num; });
  }

  // Key chủ đề (CHU_DE_MAP/nano-map.js) -> số chương. 3 chuyên đề (cd1-*,
  // cd2-*, cd3-*) KHÔNG thuộc 4 chương SGK nên không có trong bảng này.
  var TOPIC_TO_CHUONG = { 'nhiet': 1, 'khi': 2, 'tu-truong': 3, 'hat-nhan': 4, 'k10-mo-dau': 101, 'k10-dong-hoc': 102, 'k10-dong-luc-hoc': 103, 'k10-nang-luong': 104, 'k10-dong-luong': 105, 'k10-tron-deu': 106, 'k10-bien-dang': 107, 'k11-dao-dong': 111, 'k11-song': 112, 'k11-dien-truong': 113, 'k11-dong-dien': 114 };

  function toChuong(v){
    var n = Number(v);
    return (isFinite(n) && ALL_CHAPTERS.indexOf(n) > -1) ? n : null;
  }

  // Chuẩn hoá 1 danh sách chương: chỉ giữ số 1–4, bỏ trùng, sắp tăng dần.
  function normalizeChapters(arr){
    if(!Array.isArray(arr)) return [];
    var seen = {};
    var out = [];
    arr.forEach(function(v){
      var n = toChuong(v);
      if(n && !seen[n]){ seen[n] = true; out.push(n); }
    });
    return out.sort(function(a, b){ return a - b; });
  }

  // Suy số chương từ 1 mã kiến thức. Trả null nếu không nhận ra.
  function chuongFromCode(code){
    var s = String(code == null ? '' : code).trim().toLowerCase();
    if(!s) return null;
    // Mã nano-point / Bài trong nano-map.js: "nhiet-2.3", "khi-4", "tt-2.1",
    // "hn-3", "tu-truong", "hat-nhan"...
    if(/^nhiet(?![a-z])/.test(s)) return 1;
    if(/^khi(?![a-z])/.test(s)) return 2;
    if(/^(tt|tu-truong)(?![a-z])/.test(s)) return 3;
    if(/^(hn|hat-nhan)(?![a-z])/.test(s)) return 4;
    // Mã dạng số theo chương trình lớp 12: "12.1.3", "VL12-2...", "12_4".
    var m = s.match(/^(?:vl)?\s*12[.\-_]([1-4])(?![0-9])/);
    if(m) return Number(m[1]);
    // "C1.2", "ch3-...", "chuong4..."
    m = s.match(/^(?:c|ch|chuong)\s*([1-4])(?![0-9])/);
    if(m) return Number(m[1]);
    // THÊM 28/10/2026 — mã bài/nano-point khối 10, 11: "k10-5", "k11-3.2" -> tra bài trong nano-map.js
    var N0 = window.OPC_NANO;
    if(N0 && /^k1[01]-\d/.test(s)){
      var bk = s.split('.')[0];
      var bb = N0.getBai ? N0.getBai(bk) : null;
      if(bb && TOPIC_TO_CHUONG[bb.chuDeKey]) return TOPIC_TO_CHUONG[bb.chuDeKey];
    }
    return null;
  }

  // Chương của 1 câu hỏi (định dạng thô parseTexBank trong admin.html):
  // ưu tiên trường `chuong` đã gắn; nếu chưa có thì suy từ tiền tố mã kiến
  // thức; không suy ra được -> null (chưa gắn chương).
  function inferChuong(q){
    if(!q) return null;
    var explicit = toChuong(q.chuong);
    if(explicit) return explicit;
    // SỬA 28/9/2026 (tối): đọc TAG CHỦ ĐỀ CỦA TỪNG CÂU trong file .tex
    // (% [M2][Khí lí tưởng][Dạng bài] -> q.chuDeLon) TRƯỚC mã nano-point.
    // Đề tổng hợp cuốn chiếu có câu của nhiều chương khác nhau; mỗi câu phải
    // được xếp theo tag riêng của nó, KHÔNG theo nhãn "Chuyên đề" của cả đề.
    // Bản trước bỏ qua tag này nên câu chỉ có tag chủ đề (chưa gắn nano)
    // bị coi là "chưa gắn chương" và ẩn khỏi học sinh. Tag của thầy cũng
    // đáng tin hơn mã nano do AI gợi ý, nên được ưu tiên hơn.
    var N = window.OPC_NANO;
    if(N && q.chuDeLon){
      var cd = N.findChuDeByText(q.chuDeLon);
      if(cd && TOPIC_TO_CHUONG[cd.key]) return TOPIC_TO_CHUONG[cd.key];
    }
    var codes = [q.maKienThuc, q.maKT, q.knowledgeCode]
      .concat(Array.isArray(q.nanoPointIds) ? q.nanoPointIds : [])
      .concat([q.nanoBaiKey]);
    for(var i = 0; i < codes.length; i++){
      var c = chuongFromCode(codes[i]);
      if(c) return c;
    }
    return null;
  }

  // Chương đã mở của 1 học sinh: danh sách riêng (nếu admin đã đặt) ghi đè
  // mặc định của lớp; chưa có cấu hình lớp thì dùng [1,2].
  // SỬA 28/10/2026 — theo khối: khối 12 đúng như cũ (defaultUnlockedChapters); khối 10/11 đọc
  // curriculum.defaultUnlockedByKhoi[khối], chưa cấu hình thì mở 2 chương đầu của khối đó.
  function getUnlockedChapters(student, curriculum){
    if(student && Array.isArray(student.unlockedChapters)) return normalizeChapters(student.unlockedChapters);
    var k = khoiOf(student);
    if(k !== 12){
      var byK = curriculum && curriculum.defaultUnlockedByKhoi && curriculum.defaultUnlockedByKhoi[String(k)];
      if(Array.isArray(byK)) return normalizeChapters(byK).filter(function(n){ return khoiOfChuong(n) === k; });
      return defaultUnlockedForKhoi(k);
    }
    if(curriculum && Array.isArray(curriculum.defaultUnlockedChapters)) return normalizeChapters(curriculum.defaultUnlockedChapters);
    return DEFAULT_UNLOCKED.slice();
  }

  function hasAllChapters(unlocked, khoi){
    return chaptersOfKhoi(khoi).every(function(c){ return (unlocked || []).indexOf(c.num) > -1; });
  }

  function getChapter(num){
    return CHAPTERS.filter(function(c){ return c.num === num; })[0] || null;
  }

  // ===== THÊM 28/10/2026 — KHOÁ/MỞ TỪNG BÀI + KHOÁ/MỞ ĐỀ TRONG NGÂN HÀNG ĐỀ =====
  // Chương đã mở nhưng lớp chưa học hết các bài -> khoá riêng từng bài (key bài
  // trong nano-map.js: 'nhiet-1' … 'hn-5'). Câu thuộc bài khoá không xuất hiện
  // với học sinh. Câu CHƯA gắn bài (không suy ra được bài) vẫn theo chương như cũ.
  //  - settings/curriculum.defaultLockedLessons: ['nhiet-3', ...] — bài khoá mặc định cả lớp.
  //  - students/{id}.lockedLessons: danh sách bài khoá RIÊNG của em, GHI ĐÈ mặc định lớp
  //    (giống cách unlockedChapters ghi đè defaultUnlockedChapters).
  //  - settings/curriculum.lockedExams: [examId, ...] — đề trong ngân hàng bị khoá với
  //    học sinh (áp dụng mọi em): hệ thống không lấy câu của đề đó để luyện tập thích ứng,
  //    Drill, thi thử, đề cá nhân hoá… Đề đã giao sẵn cho em và lịch sử làm bài không đổi.
  function normalizeKeys(arr){
    if(!Array.isArray(arr)) return [];
    var seen = {}, out = [];
    arr.forEach(function(v){
      var s = String(v == null ? '' : v).trim();
      if(s && !seen[s]){ seen[s] = true; out.push(s); }
    });
    return out;
  }

  // Bài khoá của 1 học sinh: danh sách riêng (nếu có) ghi đè mặc định lớp; không có gì -> không khoá bài nào.
  function getLockedLessons(student, curriculum){
    if(student && Array.isArray(student.lockedLessons)) return normalizeKeys(student.lockedLessons);
    if(curriculum && Array.isArray(curriculum.defaultLockedLessons)) return normalizeKeys(curriculum.defaultLockedLessons);
    return [];
  }

  function getLockedExams(curriculum){
    return (curriculum && Array.isArray(curriculum.lockedExams)) ? normalizeKeys(curriculum.lockedExams) : [];
  }

  // Các bài (nano-map.js BAI) thuộc 1 chương 1–4, theo thứ tự mục lục.
  function listBai(chuong){
    var N = window.OPC_NANO;
    if(!N || !N.BAI) return [];
    return N.BAI.filter(function(b){ return TOPIC_TO_CHUONG[b.chuDeKey] === chuong; });
  }

  // Chương của 1 bài (theo key bài) — null nếu không nhận ra.
  function chuongOfBai(baiKey){
    var N = window.OPC_NANO;
    var b = (N && N.getBai) ? N.getBai(baiKey) : null;
    if(b && TOPIC_TO_CHUONG[b.chuDeKey]) return TOPIC_TO_CHUONG[b.chuDeKey];
    return chuongFromCode(baiKey);
  }

  // Mọi bài mà 1 câu hỏi thuộc về. Nhận cả 2 dạng câu: dạng THÔ trong de_thi (nanoBaiKey,
  // nanoPointIds, dangBai) và dạng đã chuyển cho học sinh (baiKey, nanoIds). Câu gắn nhiều
  // nano-point thuộc nhiều bài thì liệt kê đủ — chỉ cần 1 bài đang khoá là câu bị ẩn.
  function questionLessonKeys(q){
    var out = [];
    if(!q) return out;
    function add(k){ k = String(k == null ? '' : k).trim(); if(k && out.indexOf(k) < 0) out.push(k); }
    var N = window.OPC_NANO;
    add(q.baiKey); add(q.nanoBaiKey);
    var ids = (Array.isArray(q.nanoIds) && q.nanoIds.length) ? q.nanoIds
      : (Array.isArray(q.nanoPointIds) && q.nanoPointIds.length) ? q.nanoPointIds
      : (q.nanoId ? [q.nanoId] : []);
    if(N && N.getNano){
      ids.forEach(function(id){ var nn = N.getNano(id); if(nn) add(nn.baiKey); });
    }
    // Câu thô chưa có mã bài/nano: đoán bài từ tên "Dạng bài" giống transformQuestion.
    if(!out.length && N && q.dangBai && N.findBaiByText){
      var cd = N.findChuDeByText ? N.findChuDeByText(q.chuDeLon) : null;
      var b = N.findBaiByText(q.dangBai, cd ? cd.key : null);
      if(b) add(b.key);
    }
    return out;
  }

  // Mã đề chứa câu: examId (câu đã gắn) hoặc tách từ mã câu "<examId>_q<index>".
  function examIdOfQuestion(q){
    if(!q) return null;
    if(q.examId) return String(q.examId);
    var id = q.id == null ? '' : String(q.id);
    var i = id.lastIndexOf('_q');
    return i > 0 ? id.slice(0, i) : null;
  }

  // Câu có đang bị khoá không? rules = { lockedLessons:[...], lockedExams:[...] }.
  function isQuestionLocked(q, rules){
    rules = rules || {};
    var le = rules.lockedExams || [];
    if(le.length){
      var eid = examIdOfQuestion(q);
      if(eid && le.indexOf(eid) > -1) return true;
    }
    var ll = rules.lockedLessons || [];
    if(ll.length){
      var ks = questionLessonKeys(q);
      for(var i = 0; i < ks.length; i++){ if(ll.indexOf(ks[i]) > -1) return true; }
    }
    return false;
  }

  window.OPC_CURRICULUM = {
    CHAPTERS: CHAPTERS,
    ALL_CHAPTERS: ALL_CHAPTERS,
    DEFAULT_UNLOCKED: DEFAULT_UNLOCKED,
    TOPIC_TO_CHUONG: TOPIC_TO_CHUONG,
    normalizeChapters: normalizeChapters,
    chuongFromCode: chuongFromCode,
    inferChuong: inferChuong,
    getUnlockedChapters: getUnlockedChapters,
    hasAllChapters: hasAllChapters,
    getChapter: getChapter,
    // THÊM 28/10/2026 — khối 10/11/12
    KHOI_LIST: KHOI_LIST,
    khoiOf: khoiOf,
    chaptersOfKhoi: chaptersOfKhoi,
    khoiOfChuong: khoiOfChuong,
    chapterNo: chapterNo,
    defaultUnlockedForKhoi: defaultUnlockedForKhoi,
    // THÊM 28/10/2026 — khoá/mở từng bài + khoá/mở đề trong ngân hàng
    normalizeKeys: normalizeKeys,
    getLockedLessons: getLockedLessons,
    getLockedExams: getLockedExams,
    listBai: listBai,
    chuongOfBai: chuongOfBai,
    questionLessonKeys: questionLessonKeys,
    examIdOfQuestion: examIdOfQuestion,
    isQuestionLocked: isQuestionLocked
  };
})(window);
