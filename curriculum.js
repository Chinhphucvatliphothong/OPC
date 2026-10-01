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
 */
(function(window){
  'use strict';

  var CHAPTERS = [
    { num: 1, topicKey: 'nhiet', name: 'Vật lí nhiệt', icon: '🔥' },
    { num: 2, topicKey: 'khi', name: 'Khí lí tưởng', icon: '💨' },
    { num: 3, topicKey: 'tu-truong', name: 'Từ trường', icon: '🧲' },
    { num: 4, topicKey: 'hat-nhan', name: 'Vật lí hạt nhân', icon: '⚛️' }
  ];
  var ALL_CHAPTERS = [1, 2, 3, 4];
  var DEFAULT_UNLOCKED = [1, 2];

  // Key chủ đề (CHU_DE_MAP/nano-map.js) -> số chương. 3 chuyên đề (cd1-*,
  // cd2-*, cd3-*) KHÔNG thuộc 4 chương SGK nên không có trong bảng này.
  var TOPIC_TO_CHUONG = { 'nhiet': 1, 'khi': 2, 'tu-truong': 3, 'hat-nhan': 4 };

  function toChuong(v){
    var n = Number(v);
    return (n === 1 || n === 2 || n === 3 || n === 4) ? n : null;
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
    return out.sort();
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
  function getUnlockedChapters(student, curriculum){
    if(student && Array.isArray(student.unlockedChapters)) return normalizeChapters(student.unlockedChapters);
    if(curriculum && Array.isArray(curriculum.defaultUnlockedChapters)) return normalizeChapters(curriculum.defaultUnlockedChapters);
    return DEFAULT_UNLOCKED.slice();
  }

  function hasAllChapters(unlocked){
    return ALL_CHAPTERS.every(function(n){ return (unlocked || []).indexOf(n) > -1; });
  }

  function getChapter(num){
    return CHAPTERS.filter(function(c){ return c.num === num; })[0] || null;
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
    getChapter: getChapter
  };
})(window);
