/**
 * FaradayAI Luyện Thi Vật Lí — Bản đồ kiến thức "nano" (mô hình Squirrel AI)
 * ------------------------------------------------------------------
 * Squirrel AI phân rã mỗi môn học thành hàng nghìn "nano-point": đơn vị
 * kiến thức nhỏ nhất mà hệ thống có thể đo lường mức độ nắm vững riêng
 * biệt của từng học sinh, thay vì chỉ chấm theo cả "chương" hay "bài".
 * Nhờ đó việc chẩn đoán điểm yếu và ra đề luyện tập không còn phụ thuộc
 * vào kinh nghiệm cá nhân của một giáo viên giỏi — AI/hệ thống tự làm
 * việc đó dựa trên dữ liệu.
 *
 * File này là DANH MỤC CHUẨN, dùng chung cho cả hai phía:
 *  - Khâu nạp đề (admin.html): sau khi bóc tách .tex, mỗi câu hỏi được
 *    gắn 1+ nano-point trong danh mục này (hiện tại gắn thủ công / gợi ý
 *    theo khớp chuỗi — CHƯA gọi AI thật).
 *  - Khâu luyện tập của học sinh (prepscholar.js / prepscholar-ui.js):
 *    mức độ thành thạo (mastery) được tính riêng cho từng nano-point rồi
 *    mới gộp lên thành "Bài" và "Chủ đề" để vẽ bản đồ kiến thức.
 *
 * CẬP NHẬT 24/9/2026: viết lại toàn bộ CHU_DE/BAI theo ĐÚNG mục lục thật
 * của 2 sách — Sách giáo khoa Vật lí 12 (Kết nối tri thức, 25 bài / 4
 * chương) VÀ Chuyên đề học tập Vật lí 12 (Kết nối tri thức, 12 bài / 3
 * chuyên đề) — đã đối chiếu 2 nguồn độc lập (vietjack.com, thi247.com).
 * Trước đó danh mục chỉ có 4 chương SGK và rút gọn còn 4 "bài" gộp/thiếu
 * rất nhiều so với sách thật (ví dụ thiếu hẳn Bài 1, 3, 7 chương Nhiệt;
 * thiếu Bài 17-19 chương Từ trường; thiếu Bài 24 chương Hạt nhân; và
 * chưa có sách Chuyên đề). Nếu trước đây đã gắn nano-point thủ công cho
 * câu hỏi nào theo danh mục cũ, các key cũ (vd "nhiet-dl1", "khi-boyle",
 * "hn-heli"...) không còn tồn tại — cần gắn lại theo danh mục mới này.
 *
 * CHỖ CẮM AI SAU NÀY: hàm suggestForParsedQuestion() ở cuối file hiện chỉ
 * khớp chuỗi (không gọi mạng). Khi có API key AI (Gemini/OpenAI...), chỉ
 * cần thay phần thân hàm này bằng một lệnh gọi API đọc "stem" của câu hỏi
 * và trả về nano-point phù hợp nhất — toàn bộ UI ở admin.html đã sẵn chỗ
 * hiển thị kết quả, không cần sửa giao diện.
 */
(function(window){
  'use strict';

  // ============================================================
  // 1) CHỦ ĐỀ LỚN — khớp với CHU_DE_MAP trong prepscholar.js và
  //    CHU_DE_LIST trong admin.html. Gồm ĐỦ 4 chương của Sách giáo khoa
  //    Vật lí 12 (Kết nối tri thức) + 3 chuyên đề của Chuyên đề học tập
  //    Vật lí 12 (Kết nối tri thức).
  // ============================================================
  var CHU_DE = [
    { key:'nhiet', name:'Vật lí nhiệt', fullName:'Chương I: Vật lí nhiệt (SGK)', icon:'🔥',
      aliases:['nhiet','vat li nhiet','vat ly nhiet'] },
    { key:'khi', name:'Khí lí tưởng', fullName:'Chương II: Khí lí tưởng (SGK)', icon:'💨',
      aliases:['khi', 'khi li tuong', 'khi ly tuong'] },
    { key:'tu-truong', name:'Từ trường', fullName:'Chương III: Từ trường (SGK)', icon:'🧲',
      aliases:['tu truong','cam ung dien tu','cam ung tu'] },
    { key:'hat-nhan', name:'Vật lí hạt nhân', fullName:'Chương IV: Vật lí hạt nhân (SGK)', icon:'⚛️',
      aliases:['hat nhan','vat li hat nhan','vat ly hat nhan','phong xa'] },
    { key:'cd1-dxc', name:'Dòng điện xoay chiều (Chuyên đề)', fullName:'Chuyên đề 1: Dòng điện xoay chiều', icon:'🔌',
      aliases:['dong dien xoay chieu','mach rlc','may bien ap','chinh luu'] },
    { key:'cd2-yhoc', name:'Vật lí trong y học (Chuyên đề)', fullName:'Chuyên đề 2: Một số ứng dụng vật lí trong chẩn đoán y học', icon:'🫁',
      aliases:['tia x','x-quang','xquang','sieu am','cong huong tu','chan doan y hoc'] },
    { key:'cd3-luongtu', name:'Vật lí lượng tử (Chuyên đề)', fullName:'Chuyên đề 3: Vật lí lượng tử', icon:'✨',
      aliases:['luong tu','quang dien','luong tinh song hat','quang pho vach','vung nang luong'] },

    // ---- THÊM 28/10/2026 — VẬT LÍ 10 & 11 (SGK Kết nối tri thức, chép đúng theo mục lục thầy gửi) ----
    // Chủ đề có trường khoi (10/11); chủ đề không có khoi = khối 12. Tên có đuôi (VL10)/(VL11) để tag
    // "%[M1][Động học (VL10)][...]" trong .tex khớp đúng chủ đề của khối, không lẫn sang khối khác.
    { key:'k10-mo-dau', name:'Mở đầu (VL10)', fullName:'Chương I: Mở đầu (Vật lí 10)', icon:'🔭', khoi:10,
      aliases:['vl10 mo dau','vat li 10 mo dau'] },
    { key:'k10-dong-hoc', name:'Động học (VL10)', fullName:'Chương II: Động học (Vật lí 10)', icon:'🚀', khoi:10,
      aliases:['vl10 dong hoc','vat li 10 dong hoc'] },
    { key:'k10-dong-luc-hoc', name:'Động lực học (VL10)', fullName:'Chương III: Động lực học (Vật lí 10)', icon:'🏋️', khoi:10,
      aliases:['vl10 dong luc hoc','vat li 10 dong luc hoc'] },
    { key:'k10-nang-luong', name:'Năng lượng, công, công suất (VL10)', fullName:'Chương IV: Năng lượng, công, công suất (Vật lí 10)', icon:'🔆', khoi:10,
      aliases:['vl10 nang luong','vat li 10 nang luong'] },
    { key:'k10-dong-luong', name:'Động lượng (VL10)', fullName:'Chương V: Động lượng (Vật lí 10)', icon:'💥', khoi:10,
      aliases:['vl10 dong luong','vat li 10 dong luong'] },
    { key:'k10-tron-deu', name:'Chuyển động tròn đều (VL10)', fullName:'Chương VI: Chuyển động tròn đều (Vật lí 10)', icon:'🔄', khoi:10,
      aliases:['vl10 chuyen dong tron','vat li 10 chuyen dong tron'] },
    { key:'k10-bien-dang', name:'Biến dạng vật rắn – Áp suất chất lỏng (VL10)', fullName:'Chương VII: Biến dạng của vật rắn. Áp suất chất lỏng (Vật lí 10)', icon:'💧', khoi:10,
      aliases:['vl10 bien dang','vat li 10 bien dang','vl10 ap suat chat long'] },
    { key:'k11-dao-dong', name:'Dao động (VL11)', fullName:'Chương I: Dao động (Vật lí 11)', icon:'〰️', khoi:11,
      aliases:['vl11 dao dong','vat li 11 dao dong'] },
    { key:'k11-song', name:'Sóng (VL11)', fullName:'Chương II: Sóng (Vật lí 11)', icon:'🌊', khoi:11,
      aliases:['vl11 song','vat li 11 song'] },
    { key:'k11-dien-truong', name:'Điện trường (VL11)', fullName:'Chương III: Điện trường (Vật lí 11)', icon:'⚡', khoi:11,
      aliases:['vl11 dien truong','vat li 11 dien truong'] },
    { key:'k11-dong-dien', name:'Dòng điện, mạch điện (VL11)', fullName:'Chương IV: Dòng điện. Mạch điện (Vật lí 11)', icon:'🔋', khoi:11,
      aliases:['vl11 dong dien','vat li 11 dong dien'] }
  ];

  // ============================================================
  // 2) "BÀI" — ĐÚNG theo mục lục thật của 2 sách (mức trung gian, giống
  //    subtopic hiện có trong prepscholar.js và dangBai bóc tách được từ
  //    tag .tex). 25 bài SGK + 12 bài Chuyên đề = 37 bài.
  // ============================================================
  var BAI = [
    // ---- Chương I: Vật lí nhiệt (Bài 1-7) ----
    { key:'nhiet-1', chuDeKey:'nhiet', name:'Bài 1: Cấu trúc của chất. Sự chuyển thể' },
    { key:'nhiet-2', chuDeKey:'nhiet', name:'Bài 2: Nội năng. Định luật I của nhiệt động lực học' },
    { key:'nhiet-3', chuDeKey:'nhiet', name:'Bài 3: Nhiệt độ. Thang nhiệt độ – nhiệt kế' },
    { key:'nhiet-4', chuDeKey:'nhiet', name:'Bài 4: Nhiệt dung riêng' },
    { key:'nhiet-5', chuDeKey:'nhiet', name:'Bài 5: Nhiệt nóng chảy riêng' },
    { key:'nhiet-6', chuDeKey:'nhiet', name:'Bài 6: Nhiệt hoá hơi riêng' },
    { key:'nhiet-7', chuDeKey:'nhiet', name:'Bài 7: Động cơ nhiệt - Năng suất tỏa nhiệt của nhiên liệu' },

    // ---- Chương II: Khí lí tưởng (Bài 8-13) ----
    { key:'khi-1', chuDeKey:'khi', name:'Bài 8: Mô hình động học phân tử chất khí' },
    { key:'khi-2', chuDeKey:'khi', name:'Bài 9: Định luật Boyle' },
    { key:'khi-3', chuDeKey:'khi', name:'Bài 10: Định luật Charles' },
    { key:'khi-4', chuDeKey:'khi', name:'Bài 11: Phương trình trạng thái của khí lí tưởng' },
    { key:'khi-5', chuDeKey:'khi', name:'Bài 12: Áp suất khí theo mô hình động học phân tử' },
    { key:'khi-6', chuDeKey:'khi', name:'Bài 13: Nội năng của khối khí' },

    // ---- Chương III: Từ trường (Bài 14-20) ----
    { key:'tt-1', chuDeKey:'tu-truong', name:'Bài 14: Từ trường' },
    { key:'tt-2', chuDeKey:'tu-truong', name:'Bài 15: Lực từ tác dụng lên dây dẫn mang dòng điện. Cảm ứng từ' },
    { key:'tt-3', chuDeKey:'tu-truong', name:'Bài 16: Từ thông. Hiện tượng cảm ứng điện từ' },
    { key:'tt-4', chuDeKey:'tu-truong', name:'Bài 17: Máy phát điện xoay chiều' },
    { key:'tt-5', chuDeKey:'tu-truong', name:'Bài 18: Ứng dụng hiện tượng cảm ứng điện từ' },
    { key:'tt-6', chuDeKey:'tu-truong', name:'Bài 19: Điện từ trường. Mô hình sóng điện từ' },
    { key:'tt-7', chuDeKey:'tu-truong', name:'Bài 20: Truyền tải điện năng – Máy biến áp' },

    // ---- Chương IV: Vật lí hạt nhân (Bài 21-25) ----
    { key:'hn-1', chuDeKey:'hat-nhan', name:'Bài 21: Cấu trúc hạt nhân' },
    { key:'hn-2', chuDeKey:'hat-nhan', name:'Bài 22: Phản ứng hạt nhân và năng lượng liên kết' },
    { key:'hn-3', chuDeKey:'hat-nhan', name:'Bài 23: Hiện tượng phóng xạ' },
    { key:'hn-4', chuDeKey:'hat-nhan', name:'Bài 24: Công nghiệp hạt nhân. An toàn phóng xạ' },
    { key:'hn-5', chuDeKey:'hat-nhan', name:'Bài 25: Bài tập về vật lí hạt nhân' },

    // ---- Chuyên đề 1: Dòng điện xoay chiều (Bài 1-4) ----
    { key:'cd1-1', chuDeKey:'cd1-dxc', name:'Bài 1: Đặc trưng của dòng điện xoay chiều' },
    { key:'cd1-2', chuDeKey:'cd1-dxc', name:'Bài 2: Đoạn mạch điện xoay chiều RLC mắc nối tiếp' },
    { key:'cd1-3', chuDeKey:'cd1-dxc', name:'Bài 3: Máy biến áp' },
    { key:'cd1-4', chuDeKey:'cd1-dxc', name:'Bài 4: Chỉnh lưu dòng điện xoay chiều' },

    // ---- Chuyên đề 2: Một số ứng dụng vật lí trong chẩn đoán y học (Bài 5-8) ----
    { key:'cd2-1', chuDeKey:'cd2-yhoc', name:'Bài 5: Tia X' },
    { key:'cd2-2', chuDeKey:'cd2-yhoc', name:'Bài 6: Chụp X-quang. Chụp cắt lớp' },
    { key:'cd2-3', chuDeKey:'cd2-yhoc', name:'Bài 7: Siêu âm' },
    { key:'cd2-4', chuDeKey:'cd2-yhoc', name:'Bài 8: Chụp cộng hưởng từ' },

    // ---- Chuyên đề 3: Vật lí lượng tử (Bài 9-12) ----
    { key:'cd3-1', chuDeKey:'cd3-luongtu', name:'Bài 9: Hiệu ứng quang điện và năng lượng của photon' },
    { key:'cd3-2', chuDeKey:'cd3-luongtu', name:'Bài 10: Lưỡng tính sóng hạt' },
    { key:'cd3-3', chuDeKey:'cd3-luongtu', name:'Bài 11: Quang phổ vạch của nguyên tử' },
    { key:'cd3-4', chuDeKey:'cd3-luongtu', name:'Bài 12: Vùng năng lượng của tinh thể chất rắn' },

    // ---- SỬA 7/11/2026 — Vật lí 10 & 11 theo DANH MỤC NANO-POINT CỦA THẦY. Key Bài = tiền tố mã nano (md-1, cd-2, bd-3, dlh-4,
    //      k11-5, s11-1, dt11-2, dd11-3…) như Vật lí 12 (tt-1, hn-2…). Key cũ k10-1…k10-19, k11-8…k11-25 vẫn tra được qua BAI_ALIAS.
    //      VL10: Chủ đề 1 (Mô tả chuyển động, cd-) và Chủ đề 2 (Chuyển động biến đổi, bd-) cùng thuộc chương Động học (VL10).
    // Vật lí 10 — Mở đầu (md-), Mô tả chuyển động (cd-), Chuyển động biến đổi (bd-), Động lực học (dlh-)
    { key:'md-1', chuDeKey:'k10-mo-dau', name:'Bài 1: Khái quát về môn Vật lí' },
    { key:'md-2', chuDeKey:'k10-mo-dau', name:'Bài 2: Vấn đề an toàn trong Vật lí' },
    { key:'md-3', chuDeKey:'k10-mo-dau', name:'Bài 3: Đơn vị và sai số trong Vật lí' },
    { key:'cd-1', chuDeKey:'k10-dong-hoc', name:'Bài 1: Chuyển động thẳng' },
    { key:'cd-2', chuDeKey:'k10-dong-hoc', name:'Bài 2: Độ dịch chuyển và quãng đường đi được' },
    { key:'cd-3', chuDeKey:'k10-dong-hoc', name:'Bài 3: Tốc độ và vận tốc' },
    { key:'cd-4', chuDeKey:'k10-dong-hoc', name:'Bài 4: Đồ thị độ dịch chuyển – thời gian' },
    { key:'cd-5', chuDeKey:'k10-dong-hoc', name:'Bài 5: Chuyển động tổng hợp' },
    { key:'cd-6', chuDeKey:'k10-dong-hoc', name:'Bài 6: Thực hành đo tốc độ của vật chuyển động thẳng' },
    { key:'bd-1', chuDeKey:'k10-dong-hoc', name:'Bài 1: Chuyển động biến đổi – Gia tốc' },
    { key:'bd-2', chuDeKey:'k10-dong-hoc', name:'Bài 2: Chuyển động thẳng biến đổi đều' },
    { key:'bd-3', chuDeKey:'k10-dong-hoc', name:'Bài 3: Sự rơi tự do' },
    { key:'bd-4', chuDeKey:'k10-dong-hoc', name:'Bài 4: Thực hành đo gia tốc rơi tự do và vật ném thẳng đứng' },
    { key:'bd-5', chuDeKey:'k10-dong-hoc', name:'Bài 5: Chuyển động ném' },
    { key:'dlh-1', chuDeKey:'k10-dong-luc-hoc', name:'Bài 1: Tổng hợp lực và cân bằng lực' },
    { key:'dlh-2', chuDeKey:'k10-dong-luc-hoc', name:'Bài 2: Định luật I Newton' },
    { key:'dlh-3', chuDeKey:'k10-dong-luc-hoc', name:'Bài 3: Định luật II Newton' },
    { key:'dlh-4', chuDeKey:'k10-dong-luc-hoc', name:'Bài 4: Định luật III Newton' },
    { key:'dlh-5', chuDeKey:'k10-dong-luc-hoc', name:'Bài 5: Trọng lực và lực căng' },
    { key:'dlh-6', chuDeKey:'k10-dong-luc-hoc', name:'Bài 6: Lực ma sát' },
    { key:'dlh-7', chuDeKey:'k10-dong-luc-hoc', name:'Bài 7: Lực cản và lực nâng' },
    // Vật lí 10 — các bài chưa có danh mục nano-point (giữ key SGK cũ)
    { key:'k10-20', chuDeKey:'k10-dong-luc-hoc', name:'Bài 20: Một số ví dụ về cách giải các bài toán thuộc phần động lực học' },
    { key:'k10-21', chuDeKey:'k10-dong-luc-hoc', name:'Bài 21: Moment lực. Cân bằng của vật rắn' },
    { key:'k10-22', chuDeKey:'k10-dong-luc-hoc', name:'Bài 22: Thực hành: Tổng hợp lực' },
    { key:'k10-23', chuDeKey:'k10-nang-luong', name:'Bài 23: Năng lượng. Công cơ học' },
    { key:'k10-24', chuDeKey:'k10-nang-luong', name:'Bài 24: Công suất' },
    { key:'k10-25', chuDeKey:'k10-nang-luong', name:'Bài 25: Động năng, thế năng' },
    { key:'k10-26', chuDeKey:'k10-nang-luong', name:'Bài 26: Cơ năng và định luật bảo toàn cơ năng' },
    { key:'k10-27', chuDeKey:'k10-nang-luong', name:'Bài 27: Hiệu suất' },
    { key:'k10-28', chuDeKey:'k10-dong-luong', name:'Bài 28: Động lượng' },
    { key:'k10-29', chuDeKey:'k10-dong-luong', name:'Bài 29: Định luật bảo toàn động lượng' },
    { key:'k10-30', chuDeKey:'k10-dong-luong', name:'Bài 30: Thực hành: Xác định động lượng của vật trước và sau va chạm' },
    { key:'k10-31', chuDeKey:'k10-tron-deu', name:'Bài 31: Động học của chuyển động tròn đều' },
    { key:'k10-32', chuDeKey:'k10-tron-deu', name:'Bài 32: Lực hướng tâm và gia tốc hướng tâm' },
    { key:'k10-33', chuDeKey:'k10-bien-dang', name:'Bài 33: Biến dạng của vật rắn' },
    { key:'k10-34', chuDeKey:'k10-bien-dang', name:'Bài 34: Khối lượng riêng. Áp suất chất lỏng' },
    // Vật lí 11 — Dao động (k11-), Sóng (s11-), Điện trường (dt11-), Dòng điện (dd11-)
    { key:'k11-1', chuDeKey:'k11-dao-dong', name:'Bài 1: Dao động điều hoà' },
    { key:'k11-2', chuDeKey:'k11-dao-dong', name:'Bài 2: Mô tả dao động điều hoà' },
    { key:'k11-3', chuDeKey:'k11-dao-dong', name:'Bài 3: Vận tốc, gia tốc trong dao động điều hoà' },
    { key:'k11-4', chuDeKey:'k11-dao-dong', name:'Bài 4: Bài tập về dao động điều hoà' },
    { key:'k11-5', chuDeKey:'k11-dao-dong', name:'Bài 5: Động năng. Thế năng. Sự chuyển hoá năng lượng trong dao động điều hoà' },
    { key:'k11-6', chuDeKey:'k11-dao-dong', name:'Bài 6: Dao động tắt dần. Dao động cưỡng bức. Hiện tượng cộng hưởng' },
    { key:'k11-7', chuDeKey:'k11-dao-dong', name:'Bài 7: Bài tập về sự chuyển hoá năng lượng trong dao động điều hoà' },
    { key:'s11-1', chuDeKey:'k11-song', name:'Bài 8: Mô tả sóng' },
    { key:'s11-2', chuDeKey:'k11-song', name:'Bài 9: Sóng ngang. Sóng dọc. Sự truyền năng lượng của sóng cơ' },
    { key:'s11-3', chuDeKey:'k11-song', name:'Bài 10: Thực hành: Đo tần số của sóng âm' },
    { key:'s11-4', chuDeKey:'k11-song', name:'Bài 11: Sóng điện từ' },
    { key:'s11-5', chuDeKey:'k11-song', name:'Bài 12: Giao thoa sóng' },
    { key:'s11-6', chuDeKey:'k11-song', name:'Bài 13: Sóng dừng' },
    { key:'k11-14', chuDeKey:'k11-song', name:'Bài 14: Bài tập về sóng' },
    { key:'s11-7', chuDeKey:'k11-song', name:'Bài 15: Thực hành: Đo tốc độ truyền âm' },
    { key:'dt11-1', chuDeKey:'k11-dien-truong', name:'Bài 16: Lực tương tác giữa các điện tích' },
    { key:'dt11-2', chuDeKey:'k11-dien-truong', name:'Bài 17: Khái niệm điện trường' },
    { key:'dt11-3', chuDeKey:'k11-dien-truong', name:'Bài 18: Điện trường đều' },
    { key:'dt11-4', chuDeKey:'k11-dien-truong', name:'Bài 19: Thế năng điện' },
    { key:'dt11-5', chuDeKey:'k11-dien-truong', name:'Bài 20: Điện thế' },
    { key:'dt11-6', chuDeKey:'k11-dien-truong', name:'Bài 21: Tụ điện' },
    { key:'dt11-7', chuDeKey:'k11-dien-truong', name:'Bài 21 (tiếp): Năng lượng của tụ điện. Ứng dụng của tụ điện' },
    { key:'dd11-1', chuDeKey:'k11-dong-dien', name:'Bài 22: Cường độ dòng điện' },
    { key:'dd11-2', chuDeKey:'k11-dong-dien', name:'Bài 23: Điện trở. Định luật Ohm' },
    { key:'dd11-3', chuDeKey:'k11-dong-dien', name:'Bài 24: Nguồn điện' },
    { key:'dd11-4', chuDeKey:'k11-dong-dien', name:'Bài 25: Năng lượng và công suất điện' },
    { key:'k11-26', chuDeKey:'k11-dong-dien', name:'Bài 26: Thực hành: Đo suất điện động và điện trở trong của pin điện hoá' }
  ];

  // ============================================================
  // 3) NANO-POINT — đơn vị kiến thức nhỏ nhất. CẬP NHẬT 5/10/2026: Chương I-IV theo ĐÚNG danh sách nano-point thầy
  //    đang dùng trong ngân hàng .tex (mỗi Bài 1-7 nano-point; cập nhật lần 2 ngày 6/10/2026 — Nhiệt, Khí đổi nhiều; tên đã sửa lỗi chính tả). Bài 25 + 3 Chuyên đề còn danh mục cũ (3 nano/Bài).
  // ============================================================
  // Mỗi nano-point có thể có thêm 2 trường TÙY CHỌN (chưa nhập cho entry
  // nào ở dưới — chỉ khai báo chỗ cắm, KHÔNG tự bịa nội dung; giao diện
  // học sinh (xem renderRemediationStep trong prepscholar-ui.js) tự kiểm
  // tra sự tồn tại và bỏ qua bước tương ứng một cách trung thực nếu chưa
  // có, giống hệt cách videoUrl đã hoạt động trước đây):
  //   videoUrl:    string — link Micro-video 3-5 phút (Youtube/Drive...).
  //   conceptCard: { formula, note, example } — Thẻ ghi nhớ (Concept Card):
  //                formula: công thức cốt lõi (có thể chứa $...$ LaTeX);
  //                note: ghi chú/sơ đồ tư duy ngắn gọn;
  //                example: 1 ví dụ mẫu đã giải sẵn.
  //                Chỉ cần điền trường nào có, bỏ trống trường chưa có —
  //                UI chỉ hiển thị dòng nào thực sự có nội dung.
  // Nhập trực tiếp vào entry tương ứng bên dưới, ví dụ:
  //   { id:'tt-2.1', baiKey:'tt-2', name:'...',
  //     videoUrl:'https://...',
  //     conceptCard:{ formula:'$F = BIL\\sin\\alpha$', note:'...', example:'...' } }
  var NANO = [
    // ---- Chương I: Vật lí nhiệt ----
    { id:'nhiet-1.1', baiKey:'nhiet-1', name:'Cấu trúc của chất' },
    { id:'nhiet-1.2', baiKey:'nhiet-1', name:'Sự chuyển thể' },
    { id:'nhiet-1.3', baiKey:'nhiet-1', name:'Đồ thị cấu trúc của chất - Sự chuyển thể' },
    { id:'nhiet-1.4', baiKey:'nhiet-1', name:'Bài tập cấu trúc và sự chuyển thể' },

    { id:'nhiet-2.1', baiKey:'nhiet-2', name:'Khái niệm nội năng, cách làm thay đổi nội năng' },
    { id:'nhiet-2.2', baiKey:'nhiet-2', name:'Định luật I Nhiệt động lực học' },
    { id:'nhiet-2.3', baiKey:'nhiet-2', name:'Thí nghiệm sự truyền nhiệt' },
    { id:'nhiet-2.4', baiKey:'nhiet-2', name:'Bài tập Nội năng - Định luật I nhiệt động lực học' },
    { id:'nhiet-2.5', baiKey:'nhiet-2', name:'Lực tương tác - thế năng phân tử' },

    { id:'nhiet-3.1', baiKey:'nhiet-3', name:'Thang nhiệt độ' },
    { id:'nhiet-3.2', baiKey:'nhiet-3', name:'Nhiệt kế' },
    { id:'nhiet-3.3', baiKey:'nhiet-3', name:'Bài tập nhiệt kế - Thang nhiệt độ' },

    { id:'nhiet-4.1', baiKey:'nhiet-4', name:'Lý thuyết nhiệt dung riêng' },
    { id:'nhiet-4.2', baiKey:'nhiet-4', name:'Thực hành đo nhiệt dung riêng' },
    { id:'nhiet-4.3', baiKey:'nhiet-4', name:'Bài tập tính nhiệt dung riêng' },
    { id:'nhiet-4.4', baiKey:'nhiet-4', name:'Bài toán đun nước - Bình nước nóng năng lượng mặt trời' },
    { id:'nhiet-4.5', baiKey:'nhiet-4', name:'Bài tập phương trình cân bằng nhiệt' },
    { id:'nhiet-4.6', baiKey:'nhiet-4', name:'Đồ thị nhiệt dung riêng' },

    { id:'nhiet-5.1', baiKey:'nhiet-5', name:'Lý thuyết nhiệt nóng chảy riêng' },
    { id:'nhiet-5.2', baiKey:'nhiet-5', name:'Bài tập nhiệt nóng chảy' },
    { id:'nhiet-5.3', baiKey:'nhiet-5', name:'Đồ thị nhiệt nóng chảy riêng' },
    { id:'nhiet-5.4', baiKey:'nhiet-5', name:'Thực hành nhiệt nóng chảy riêng' },

    { id:'nhiet-6.1', baiKey:'nhiet-6', name:'Lý thuyết nhiệt hóa hơi' },
    { id:'nhiet-6.2', baiKey:'nhiet-6', name:'Bài tập nhiệt hóa hơi' },
    { id:'nhiet-6.3', baiKey:'nhiet-6', name:'Đồ thị nhiệt hoá hơi riêng' },
    { id:'nhiet-6.4', baiKey:'nhiet-6', name:'Thực hành nhiệt hóa hơi riêng' },

    { id:'nhiet-7.1', baiKey:'nhiet-7', name:'Bài tập Động cơ nhiệt - Năng suất tỏa nhiệt của nhiên liệu' },

    // ---- Chương II: Khí lí tưởng ----
    { id:'khi-1.1', baiKey:'khi-1', name:'Chuyển động Brown' },
    { id:'khi-1.2', baiKey:'khi-1', name:'Mô hình động học phân tử – Thuyết động học phân tử' },
    { id:'khi-1.3', baiKey:'khi-1', name:'Bài tập lượng chất - chuyển động phân tử' },
    { id:'khi-1.4', baiKey:'khi-1', name:'Bài tập áp suất chất khí' },

    { id:'khi-2.1', baiKey:'khi-2', name:'Lý thuyết định luật Boyle' },
    { id:'khi-2.2', baiKey:'khi-2', name:'Đồ thị đường đẳng nhiệt' },
    { id:'khi-2.3', baiKey:'khi-2', name:'Bài tập quá trình đẳng nhiệt' },
    { id:'khi-2.4', baiKey:'khi-2', name:'Xác định số lần bơm' },
    { id:'khi-2.5', baiKey:'khi-2', name:'Cân bằng pit-tông' },
    { id:'khi-2.6', baiKey:'khi-2', name:'Nguyên lý Pascal' },
    { id:'khi-2.7', baiKey:'khi-2', name:'Thí nghiệm định luật Boyle' },

    { id:'khi-3.1', baiKey:'khi-3', name:'Lý thuyết quá trình đẳng áp đẳng tích' },
    { id:'khi-3.2', baiKey:'khi-3', name:'Bài tập quá trình đẳng áp' },
    { id:'khi-3.3', baiKey:'khi-3', name:'Bài tập quá trình đẳng tích' },
    { id:'khi-3.4', baiKey:'khi-3', name:'Định luật Dalton – khí đa quá trình' },

    { id:'khi-4.1', baiKey:'khi-4', name:'Lý thuyết phương trình trạng thái khí lí tưởng' },
    { id:'khi-4.2', baiKey:'khi-4', name:'Bài tập phương trình trạng thái khí lí tưởng' },
    { id:'khi-4.3', baiKey:'khi-4', name:'Bài tập phương trình Clapeyron và Van der Waals' },
    { id:'khi-4.4', baiKey:'khi-4', name:'Bài tập Phương trình Mendeleev với khối lượng riêng' },
    { id:'khi-4.5', baiKey:'khi-4', name:'Bài tập hỗn hợp khí' },
    { id:'khi-4.6', baiKey:'khi-4', name:'Đồ thị trạng thái khí lí tưởng' },

    { id:'khi-5.1', baiKey:'khi-5', name:'Lý thuyết Áp suất khí theo mô hình động học phân tử' },
    { id:'khi-5.2', baiKey:'khi-5', name:'Lý thuyết Quan hệ giữa động năng phân tử và nhiệt độ' },
    { id:'khi-5.3', baiKey:'khi-5', name:'Bài tập Áp suất động năng phân tử' },

    { id:'khi-6.1', baiKey:'khi-6', name:'Lý thuyết nội năng của khí lí tưởng' },
    { id:'khi-6.2', baiKey:'khi-6', name:'Áp dụng định luật I nhiệt động lực học' },
    { id:'khi-6.3', baiKey:'khi-6', name:'Bài tập Áp dụng định luật I nhiệt động lực học' },
    { id:'khi-6.4', baiKey:'khi-6', name:'Đồ thị nhiệt động lực học của khối khí lí tưởng' },

    // ---- Chương III: Từ trường ----
    { id:'tt-1.1', baiKey:'tt-1', name:'Tương tác từ' },
    { id:'tt-1.2', baiKey:'tt-1', name:'Khái niệm từ trường' },
    { id:'tt-1.3', baiKey:'tt-1', name:'Đường sức từ' },
    { id:'tt-1.4', baiKey:'tt-1', name:'Quy tắc xác định chiều cảm ứng từ, lực từ' },
    { id:'tt-1.5', baiKey:'tt-1', name:'Bài tập từ trường dòng điện thẳng, dòng điện tròn, dòng điện trong ống dây' },

    { id:'tt-2.1', baiKey:'tt-2', name:'Lực từ tác dụng lên đoạn dây dẫn mang dòng điện, quy tắc bàn tay trái' },
    { id:'tt-2.2', baiKey:'tt-2', name:'Cảm ứng từ' },
    { id:'tt-2.3', baiKey:'tt-2', name:'Tương tác giữa hai dòng điện thẳng song song' },
    { id:'tt-2.4', baiKey:'tt-2', name:'Momen ngẫu lực từ tác dụng lên khung dây' },
    { id:'tt-2.5', baiKey:'tt-2', name:'Chuyển động của hạt mang điện trong từ trường. Lực Lorentz' },
    { id:'tt-2.6', baiKey:'tt-2', name:'Máy quang phổ kế và máy gia tốc' },
    { id:'tt-2.7', baiKey:'tt-2', name:'Thực hành đo độ lớn cảm ứng từ' },

    { id:'tt-3.1', baiKey:'tt-3', name:'Lý thuyết Từ Thông. Hiện tượng cảm ứng điện từ' },
    { id:'tt-3.2', baiKey:'tt-3', name:'Bài tập Từ Thông. Hiện tượng cảm ứng điện từ' },
    { id:'tt-3.3', baiKey:'tt-3', name:'Bài tập Suất điện động cảm ứng' },
    { id:'tt-3.4', baiKey:'tt-3', name:'Đồ thị suất điện động cảm ứng' },
    { id:'tt-3.5', baiKey:'tt-3', name:'Đoạn dây dẫn chuyển động từ trường' },
    { id:'tt-3.6', baiKey:'tt-3', name:'Máy phát điện đĩa Faraday' },

    { id:'tt-4.1', baiKey:'tt-4', name:'Lý thuyết Máy phát điện xoay chiều' },
    { id:'tt-4.2', baiKey:'tt-4', name:'Lý thuyết đại cương về dòng điện xoay chiều' },
    { id:'tt-4.3', baiKey:'tt-4', name:'Bài tập máy phát điện xoay chiều' },
    { id:'tt-4.4', baiKey:'tt-4', name:'Bài tập đại cương dòng điện xoay chiều' },

    { id:'tt-5.1', baiKey:'tt-5', name:'Lý thuyết ứng dụng hiện tượng cảm ứng (bếp từ, phanh điện từ, loa điện động, dòng điện Foucault)' },
    { id:'tt-5.2', baiKey:'tt-5', name:'Bài tập Ứng dụng Hiện tượng cảm ứng điện từ' },
    { id:'tt-5.3', baiKey:'tt-5', name:'Ứng dụng Lưu lượng kế điện tử và máy phát điện từ thủy động' },

    { id:'tt-6.1', baiKey:'tt-6', name:'Lý thuyết định tính điện từ trường, mô hình sóng điện từ' },
    { id:'tt-6.2', baiKey:'tt-6', name:'Bài tập điện từ trường, mô hình sóng điện từ' },

    { id:'tt-7.1', baiKey:'tt-7', name:'Lý thuyết truyền tải điện năng - máy biến áp' },
    { id:'tt-7.2', baiKey:'tt-7', name:'Bài tập Truyền tải điện năng - máy biến áp' },

    // ---- Chương IV: Vật lí hạt nhân (Bài 21-24) ----
    { id:'hn-1.1', baiKey:'hn-1', name:'Mô hình nguyên tử' },
    { id:'hn-1.2', baiKey:'hn-1', name:'Cấu trúc hạt nhân' },
    { id:'hn-1.3', baiKey:'hn-1', name:'Bài tập Cấu trúc hạt nhân. Mô hình nguyên tử' },
    { id:'hn-1.4', baiKey:'hn-1', name:'Thí nghiệm tán xạ alpha' },

    { id:'hn-2.1', baiKey:'hn-2', name:'Năng lượng liên kết hạt nhân' },
    { id:'hn-2.2', baiKey:'hn-2', name:'Bài tập hệ thức Einstein. Năng lượng liên kết hạt nhân' },
    { id:'hn-2.3', baiKey:'hn-2', name:'Phản ứng phân hạch, nhiệt hạch' },
    { id:'hn-2.4', baiKey:'hn-2', name:'Bài tập phản ứng hạt nhân, phân hạch, nhiệt hạch' },

    { id:'hn-3.1', baiKey:'hn-3', name:'Lý thuyết hiện tượng phóng xạ' },
    { id:'hn-3.2', baiKey:'hn-3', name:'Bài tập hiện tượng phóng xạ' },
    { id:'hn-3.3', baiKey:'hn-3', name:'Quy luật phóng xạ' },
    { id:'hn-3.4', baiKey:'hn-3', name:'Bài tập độ phóng xạ' },

    { id:'hn-4.1', baiKey:'hn-4', name:'Công nghệ hạt nhân' },
    { id:'hn-4.2', baiKey:'hn-4', name:'An toàn phóng xạ' },
    { id:'hn-4.3', baiKey:'hn-4', name:'Ứng dụng của vật lí hạt nhân' },
    { id:'hn-4.4', baiKey:'hn-4', name:'Bài tập Ứng dụng của vật lí hạt nhân' },
    { id:'hn-4.5', baiKey:'hn-4', name:'Đồ thị hạt nhân nguyên tử' },

    // ---- Bài 25 (hn-5) và 3 Chuyên đề: giữ nguyên danh mục có sẵn (danh sách của thầy chưa có phần này) ----
    { id:'hn-5.1', baiKey:'hn-5', name:'Bài toán tổng hợp tính năng lượng toả ra / thu vào của phản ứng hạt nhân' },
    { id:'hn-5.2', baiKey:'hn-5', name:'So sánh độ bền vững hạt nhân qua năng lượng liên kết riêng' },
    { id:'hn-5.3', baiKey:'hn-5', name:'Bài toán kết hợp phóng xạ + năng lượng liên kết trong cùng 1 đề' },
    { id:'cd1-1.1', baiKey:'cd1-1', name:'Biểu thức i = I0cos(ωt+φ), u = U0cos(ωt+φ) và các đại lượng đặc trưng' },
    { id:'cd1-1.2', baiKey:'cd1-1', name:'Giá trị hiệu dụng của dòng điện, điện áp xoay chiều' },
    { id:'cd1-1.3', baiKey:'cd1-1', name:'Độ lệch pha giữa u và i trong mạch điện xoay chiều' },
    { id:'cd1-2.1', baiKey:'cd1-2', name:'Cảm kháng ZL = ωL, dung kháng ZC = 1/(ωC), tổng trở Z = √(R²+(ZL−ZC)²)' },
    { id:'cd1-2.2', baiKey:'cd1-2', name:'Định luật Ôm cho đoạn mạch RLC nối tiếp I0 = U0/Z' },
    { id:'cd1-2.3', baiKey:'cd1-2', name:'Hiện tượng cộng hưởng điện (ZL = ZC) và công suất tiêu thụ mạch RLC' },
    { id:'cd1-3.1', baiKey:'cd1-3', name:'Cấu tạo và nguyên tắc hoạt động của máy biến áp' },
    { id:'cd1-3.2', baiKey:'cd1-3', name:'Công thức máy biến áp lí tưởng U1/U2 = N1/N2 = I2/I1' },
    { id:'cd1-3.3', baiKey:'cd1-3', name:'Vai trò máy biến áp trong truyền tải điện năng đi xa, giảm hao phí' },
    { id:'cd1-4.1', baiKey:'cd1-4', name:'Nguyên lí hoạt động của diode bán dẫn trong mạch chỉnh lưu' },
    { id:'cd1-4.2', baiKey:'cd1-4', name:'Sơ đồ mạch chỉnh lưu nửa chu kì và chỉnh lưu cả chu kì (chỉnh lưu cầu)' },
    { id:'cd1-4.3', baiKey:'cd1-4', name:'Vai trò bộ lọc trong biến dòng điện xoay chiều thành dòng một chiều' },
    { id:'cd2-1.1', baiKey:'cd2-1', name:'Bản chất tia X (sóng điện từ bước sóng ngắn) và cách tạo ra tia X' },
    { id:'cd2-1.2', baiKey:'cd2-1', name:'Tính chất của tia X: khả năng đâm xuyên, tác dụng lên phim ảnh, ion hoá' },
    { id:'cd2-1.3', baiKey:'cd2-1', name:'Nguyên tắc an toàn khi sử dụng tia X trong y học' },
    { id:'cd2-2.1', baiKey:'cd2-2', name:'Nguyên lí tạo ảnh X-quang dựa trên độ hấp thụ tia X khác nhau của mô' },
    { id:'cd2-2.2', baiKey:'cd2-2', name:'Nguyên lí chụp cắt lớp vi tính CT (tổng hợp nhiều lát cắt)' },
    { id:'cd2-2.3', baiKey:'cd2-2', name:'So sánh ưu, nhược điểm giữa X-quang thường và chụp CT' },
    { id:'cd2-3.1', baiKey:'cd2-3', name:'Bản chất sóng siêu âm (sóng cơ tần số > 20000 Hz), nguyên lí tạo/thu sóng' },
    { id:'cd2-3.2', baiKey:'cd2-3', name:'Nguyên lí tạo ảnh siêu âm dựa trên phản xạ sóng tại mặt phân cách mô' },
    { id:'cd2-3.3', baiKey:'cd2-3', name:'Ứng dụng siêu âm trong chẩn đoán y học và các lưu ý an toàn' },
    { id:'cd2-4.1', baiKey:'cd2-4', name:'Nguyên lí cộng hưởng từ hạt nhân (MRI) dựa trên spin hạt nhân trong từ trường mạnh' },
    { id:'cd2-4.2', baiKey:'cd2-4', name:'Vai trò từ trường ngoài và sóng radio trong tạo ảnh MRI' },
    { id:'cd2-4.3', baiKey:'cd2-4', name:'So sánh MRI với X-quang/CT về nguyên lí, ưu nhược điểm, chỉ định sử dụng' },
    { id:'cd3-1.1', baiKey:'cd3-1', name:'Công thức năng lượng photon ε = hf = hc/λ' },
    { id:'cd3-1.2', baiKey:'cd3-1', name:'Định luật quang điện, công thoát A và giới hạn quang điện λ0' },
    { id:'cd3-1.3', baiKey:'cd3-1', name:'Phương trình Einstein về hiệu ứng quang điện: hf = A + Wđ(max)' },
    { id:'cd3-2.1', baiKey:'cd3-2', name:'Khái niệm lưỡng tính sóng-hạt của ánh sáng và của hạt vi mô' },
    { id:'cd3-2.2', baiKey:'cd3-2', name:'Công thức bước sóng de Broglie λ = h/p' },
    { id:'cd3-2.3', baiKey:'cd3-2', name:'Hiện tượng thể hiện tính sóng (giao thoa, nhiễu xạ) và tính hạt (quang điện)' },
    { id:'cd3-3.1', baiKey:'cd3-3', name:'Mẫu nguyên tử Bohr và các tiên đề Bohr (trạng thái dừng, bức xạ/hấp thụ)' },
    { id:'cd3-3.2', baiKey:'cd3-3', name:'Công thức năng lượng photon phát ra/hấp thụ khi electron chuyển mức εmn = Em − En' },
    { id:'cd3-3.3', baiKey:'cd3-3', name:'Giải thích sự hình thành quang phổ vạch phát xạ/hấp thụ của nguyên tử Hydrogen' },
    { id:'cd3-4.1', baiKey:'cd3-4', name:'Khái niệm vùng năng lượng (vùng hoá trị, vùng dẫn, vùng cấm) trong tinh thể' },
    { id:'cd3-4.2', baiKey:'cd3-4', name:'Phân biệt chất dẫn điện, cách điện, bán dẫn theo cấu trúc vùng năng lượng' },
    { id:'cd3-4.3', baiKey:'cd3-4', name:'Ảnh hưởng của nhiệt độ, pha tạp đến tính dẫn điện của chất bán dẫn' },
    // ---- THÊM 7/11/2026 — Vật lí 10 (danh mục nano-point của thầy: md-, cd-, bd-, dlh-) ----
    { id:'md-1.1', baiKey:'md-1', name:'Đối tượng nghiên cứu và mục tiêu của Vật lí' },
    { id:'md-1.2', baiKey:'md-1', name:'Quá trình phát triển của Vật lí' },
    { id:'md-1.3', baiKey:'md-1', name:'Vật lí với cuộc sống, khoa học, kĩ thuật và công nghệ' },
    { id:'md-1.4', baiKey:'md-1', name:'Phương pháp nghiên cứu Vật lí (phương pháp thực nghiệm, phương pháp lí thuyết)' },

    { id:'md-2.1', baiKey:'md-2', name:'Vấn đề an toàn trong nghiên cứu và học tập Vật lí' },
    { id:'md-2.2', baiKey:'md-2', name:'Các quy tắc an toàn trong phòng thực hành Vật lí' },
    { id:'md-2.3', baiKey:'md-2', name:'Biển báo (cấm, cảnh báo, chỉ dẫn) và cách xử lí sự cố' },

    { id:'md-3.1', baiKey:'md-3', name:'Đơn vị, thứ nguyên, đổi đơn vị, hệ SI và tiền tố' },
    { id:'md-3.2', baiKey:'md-3', name:'Sai số phép đo (tuyệt đối, tương đối, sai số dụng cụ, sai số ngẫu nhiên)' },
    { id:'md-3.3', baiKey:'md-3', name:'Thực hành: tính sai số trong phép đo, ghi kết quả đo' },

    { id:'cd-1.1', baiKey:'cd-1', name:'Chất điểm, hệ quy chiếu, mốc thời gian' },
    { id:'cd-1.2', baiKey:'cd-1', name:'Phương trình toạ độ – thời gian của chuyển động thẳng' },
    { id:'cd-1.3', baiKey:'cd-1', name:'Phân biệt dạng chuyển động thẳng và chuyển động cong' },

    { id:'cd-2.1', baiKey:'cd-2', name:'Phân biệt quãng đường và độ dịch chuyển' },
    { id:'cd-2.2', baiKey:'cd-2', name:'Tính độ dịch chuyển, quãng đường trên một trục' },
    { id:'cd-2.3', baiKey:'cd-2', name:'Độ dịch chuyển tổng hợp (cùng phương)' },

    { id:'cd-3.1', baiKey:'cd-3', name:'Tốc độ, tốc độ trung bình, tốc độ tức thời' },
    { id:'cd-3.2', baiKey:'cd-3', name:'Vận tốc, vận tốc trung bình' },
    { id:'cd-3.3', baiKey:'cd-3', name:'Định thời điểm và vị trí gặp nhau của các chuyển động' },

    { id:'cd-4.1', baiKey:'cd-4', name:'Đọc đồ thị d – t (vận tốc, vị trí, chiều chuyển động)' },
    { id:'cd-4.2', baiKey:'cd-4', name:'Vẽ đồ thị d – t và lập phương trình từ đồ thị' },
    { id:'cd-4.3', baiKey:'cd-4', name:'Đồ thị d – t của hai vật, điểm gặp nhau' },

    { id:'cd-5.1', baiKey:'cd-5', name:'Công thức cộng vận tốc, hệ quy chiếu đứng yên và chuyển động' },
    { id:'cd-5.2', baiKey:'cd-5', name:'Chuyển động tổng hợp của thuyền, ca nô trên sông' },
    { id:'cd-5.3', baiKey:'cd-5', name:'Chuyển động tổng hợp hai phương vuông góc, hợp góc bất kì' },

    { id:'cd-6.1', baiKey:'cd-6', name:'Phương án, dụng cụ, cách bố trí thí nghiệm' },
    { id:'cd-6.2', baiKey:'cd-6', name:'Xử lí số liệu, tính tốc độ và sai số' },
    { id:'cd-6.3', baiKey:'cd-6', name:'Nhận xét nguyên nhân sai số và cách khắc phục' },

    { id:'bd-1.1', baiKey:'bd-1', name:'Khái niệm gia tốc, đơn vị, chiều của gia tốc' },
    { id:'bd-1.2', baiKey:'bd-1', name:'Tính gia tốc trung bình từ bảng số liệu' },
    { id:'bd-1.3', baiKey:'bd-1', name:'Nhận biết chuyển động nhanh dần, chậm dần (dấu của v và a)' },

    { id:'bd-2.1', baiKey:'bd-2', name:'Công thức vận tốc, quãng đường, phương trình toạ độ (v0, a, t)' },
    { id:'bd-2.2', baiKey:'bd-2', name:'Công thức độc lập thời gian v² – v0² = 2as' },
    { id:'bd-2.3', baiKey:'bd-2', name:'Quãng đường đi được trong giây thứ n, trong n giây cuối' },
    { id:'bd-2.4', baiKey:'bd-2', name:'Bài toán phanh, dừng lại, đổi chiều chuyển động' },
    { id:'bd-2.5', baiKey:'bd-2', name:'Đồ thị vận tốc – thời gian (đọc đồ thị, tính gia tốc, quãng đường từ diện tích)' },
    { id:'bd-2.6', baiKey:'bd-2', name:'Bài toán gặp nhau của hai vật (chuyển động thẳng biến đổi đều)' },

    { id:'bd-3.1', baiKey:'bd-3', name:'Khái niệm rơi tự do, đặc điểm (phương, chiều, g)' },
    { id:'bd-3.2', baiKey:'bd-3', name:'Công thức rơi tự do: v, h, thời gian rơi' },
    { id:'bd-3.3', baiKey:'bd-3', name:'Quãng đường rơi trong giây cuối, trong n giây cuối' },
    { id:'bd-3.4', baiKey:'bd-3', name:'Rơi tự do nhiều vật, thả vật tại các thời điểm khác nhau' },

    { id:'bd-4.1', baiKey:'bd-4', name:'Thực hành đo g: dụng cụ, phương án, xử lí số liệu' },
    { id:'bd-4.2', baiKey:'bd-4', name:'Vật ném lên thẳng đứng (độ cao cực đại, thời gian lên, vận tốc chạm đất)' },
    { id:'bd-4.3', baiKey:'bd-4', name:'Ném thẳng đứng hai vật, hai vật gặp nhau' },

    { id:'bd-5.1', baiKey:'bd-5', name:'Chuyển động ném ngang (tầm xa, thời gian, vận tốc chạm đất)' },
    { id:'bd-5.2', baiKey:'bd-5', name:'Chuyển động ném xiên (độ cao cực đại, tầm xa, góc ném)' },
    { id:'bd-5.3', baiKey:'bd-5', name:'Phân tích chuyển động ném thành hai chuyển động thành phần, lí thuyết quỹ đạo' },

    { id:'dlh-1.1', baiKey:'dlh-1', name:'Tổng hợp hai lực đồng quy (quy tắc hình bình hành, giá trị F theo góc α)' },
    { id:'dlh-1.2', baiKey:'dlh-1', name:'Phân tích lực thành hai thành phần vuông góc' },
    { id:'dlh-1.3', baiKey:'dlh-1', name:'Điều kiện cân bằng của chất điểm chịu tác dụng của 2 và 3 lực' },
    { id:'dlh-1.4', baiKey:'dlh-1', name:'Bài toán cân bằng lực với dây, vật treo' },

    { id:'dlh-2.1', baiKey:'dlh-2', name:'Phát biểu định luật I, quán tính' },
    { id:'dlh-2.2', baiKey:'dlh-2', name:'Giải thích hiện tượng quán tính trong đời sống' },
    { id:'dlh-2.3', baiKey:'dlh-2', name:'Vật chuyển động thẳng đều, cân bằng lực' },

    { id:'dlh-3.1', baiKey:'dlh-3', name:'Liên hệ lực, khối lượng, gia tốc (lí thuyết)' },
    { id:'dlh-3.2', baiKey:'dlh-3', name:'Bài toán a = F/m: tìm a, F, m' },
    { id:'dlh-3.3', baiKey:'dlh-3', name:'Kết hợp định luật II với động học (v, s, t)' },
    { id:'dlh-3.4', baiKey:'dlh-3', name:'Lực kéo, lực cản tổng hợp trên mặt ngang' },

    { id:'dlh-4.1', baiKey:'dlh-4', name:'Phát biểu, đặc điểm cặp lực – phản lực' },
    { id:'dlh-4.2', baiKey:'dlh-4', name:'Phân biệt cặp lực – phản lực với hai lực cân bằng' },
    { id:'dlh-4.3', baiKey:'dlh-4', name:'Bài toán va chạm, tương tác hai vật (áp dụng định luật III)' },

    { id:'dlh-5.1', baiKey:'dlh-5', name:'Trọng lực, trọng lượng, gia tốc rơi tự do ở các thiên thể' },
    { id:'dlh-5.2', baiKey:'dlh-5', name:'Lực căng dây (dây nhẹ, ròng rọc cố định)' },
    { id:'dlh-5.3', baiKey:'dlh-5', name:'Vật treo trên hai dây, góc treo, dây chịu lực tối đa' },
    { id:'dlh-5.4', baiKey:'dlh-5', name:'Hệ ròng rọc, hai vật nối qua ròng rọc' },

    { id:'dlh-6.1', baiKey:'dlh-6', name:'Lí thuyết ma sát nghỉ, ma sát trượt, ma sát lăn' },
    { id:'dlh-6.2', baiKey:'dlh-6', name:'Vật chuyển động trên mặt phẳng ngang có ma sát' },
    { id:'dlh-6.3', baiKey:'dlh-6', name:'Kéo vật bằng lực theo phương xiên' },
    { id:'dlh-6.4', baiKey:'dlh-6', name:'Vật trên mặt phẳng nghiêng có ma sát' },
    { id:'dlh-6.5', baiKey:'dlh-6', name:'Cơ hệ nhiều vật (hai vật nối dây, ma sát)' },

    { id:'dlh-7.1', baiKey:'dlh-7', name:'Lực cản của môi trường (không khí, chất lỏng), gia tốc khi có lực cản' },
    { id:'dlh-7.2', baiKey:'dlh-7', name:'Lực nâng của chất lỏng, lực đẩy Archimedes (công thức, điều kiện nổi, chìm)' },
    { id:'dlh-7.3', baiKey:'dlh-7', name:'Vật treo lực kế nhúng chìm trong chất lỏng' },
    { id:'dlh-7.4', baiKey:'dlh-7', name:'Vật nổi cân bằng trong chất lỏng, độ cao phần nổi, phần chìm' },

    // ---- THÊM 7/11/2026 — Vật lí 11 (danh mục nano-point của thầy: k11-, s11-, dt11-, dd11-) ----
    { id:'k11-1.1', baiKey:'k11-1', name:'Khái niệm dao động cơ, dao động tuần hoàn' },
    { id:'k11-1.2', baiKey:'k11-1', name:'Dao động tự do (dao động riêng)' },
    { id:'k11-1.3', baiKey:'k11-1', name:'Khái niệm và đồ thị li độ – thời gian của dao động điều hoà' },
    { id:'k11-1.4', baiKey:'k11-1', name:'Phương trình li độ x = Acos(ωt + φ): ý nghĩa A, ω, φ, pha' },
    { id:'k11-1.5', baiKey:'k11-1', name:'Độ dịch chuyển và li độ của vật dao động' },
    { id:'k11-1.6', baiKey:'k11-1', name:'Liên hệ dao động điều hoà – chuyển động tròn đều' },

    { id:'k11-2.1', baiKey:'k11-2', name:'Biên độ dao động, chiều dài quỹ đạo' },
    { id:'k11-2.2', baiKey:'k11-2', name:'Chu kì dao động' },
    { id:'k11-2.3', baiKey:'k11-2', name:'Tần số dao động' },
    { id:'k11-2.4', baiKey:'k11-2', name:'Tần số góc, liên hệ ω – T – f' },
    { id:'k11-2.5', baiKey:'k11-2', name:'Pha dao động, pha ban đầu' },
    { id:'k11-2.6', baiKey:'k11-2', name:'Độ lệch pha hai dao động cùng chu kì (cùng, ngược, vuông pha)' },
    { id:'k11-2.7', baiKey:'k11-2', name:'Bài tập đại lượng đặc trưng, viết phương trình dao động' },
    { id:'k11-2.8', baiKey:'k11-2', name:'Bài tập thời gian (vòng tròn lượng giác, số lần qua vị trí)' },
    { id:'k11-2.9', baiKey:'k11-2', name:'Bài tập quãng đường, tốc độ trung bình' },
    { id:'k11-2.10', baiKey:'k11-2', name:'Bài tập hai dao động: độ lệch pha, khoảng cách, gặp nhau' },

    { id:'k11-3.1', baiKey:'k11-3', name:'Vận tốc: phương trình, sớm pha π/2, hướng, giá trị cực đại' },
    { id:'k11-3.2', baiKey:'k11-3', name:'Đồ thị vận tốc, liên hệ v – x (đường elip)' },
    { id:'k11-3.3', baiKey:'k11-3', name:'Gia tốc: phương trình, ngược pha li độ, luôn hướng về VTCB' },
    { id:'k11-3.4', baiKey:'k11-3', name:'Đồ thị gia tốc, liên hệ a – x (đoạn thẳng)' },
    { id:'k11-3.5', baiKey:'k11-3', name:'Lực kéo về (hợp lực tác dụng lên vật DĐĐH)' },
    { id:'k11-3.6', baiKey:'k11-3', name:'Bài tập li độ, vận tốc, gia tốc, hệ thức độc lập thời gian' },
    { id:'k11-3.7', baiKey:'k11-3', name:'Bài tập đồ thị x, v, a theo thời gian' },

    { id:'k11-4.1', baiKey:'k11-4', name:'Tần số riêng của hệ dao động tự do (chỉ phụ thuộc đặc tính hệ)' },
    { id:'k11-4.2', baiKey:'k11-4', name:'Con lắc lò xo: cấu tạo, lực đàn hồi, gia tốc a = −(k/m)x' },
    { id:'k11-4.3', baiKey:'k11-4', name:'Chu kì, tần số, tần số góc con lắc lò xo (lí thuyết)' },
    { id:'k11-4.4', baiKey:'k11-4', name:'Con lắc đơn: cấu tạo, điều kiện DĐĐH, li độ dài – li độ góc, lực kéo về' },
    { id:'k11-4.5', baiKey:'k11-4', name:'Chu kì, tần số con lắc đơn; ứng dụng đo gia tốc rơi tự do (lí thuyết)' },
    { id:'k11-4.6', baiKey:'k11-4', name:'Bài tập con lắc lò xo: T, f, ω, thay đổi khối lượng' },
    { id:'k11-4.7', baiKey:'k11-4', name:'Bài tập con lắc lò xo: chiều dài lò xo, thời gian nén – dãn' },
    { id:'k11-4.8', baiKey:'k11-4', name:'Bài tập con lắc lò xo: lực kéo về, lực đàn hồi (kể cả đồ thị lực)' },
    { id:'k11-4.9', baiKey:'k11-4', name:'Bài tập con lắc đơn biên độ lớn: vận tốc, lực căng, gia tốc' },
    { id:'k11-4.10', baiKey:'k11-4', name:'Bài tập con lắc đơn biên độ nhỏ: T, f, li độ, đo g' },

    { id:'k11-5.1', baiKey:'k11-5', name:'Động năng: biểu thức, biến thiên theo thời gian (chu kì T/2)' },
    { id:'k11-5.2', baiKey:'k11-5', name:'Thế năng: biểu thức, biến thiên theo thời gian (chu kì T/2)' },
    { id:'k11-5.3', baiKey:'k11-5', name:'Đồ thị động năng, thế năng theo li độ và thời gian' },
    { id:'k11-5.4', baiKey:'k11-5', name:'Chuyển hoá và bảo toàn cơ năng trong DĐĐH' },
    { id:'k11-5.5', baiKey:'k11-5', name:'Cơ năng con lắc lò xo W = ½kA²' },
    { id:'k11-5.6', baiKey:'k11-5', name:'Cơ năng con lắc đơn W = mgℓ(1 − cosα0)' },

    { id:'k11-6.1', baiKey:'k11-6', name:'Dao động tắt dần: hiện tượng, nguyên nhân, đặc điểm' },
    { id:'k11-6.2', baiKey:'k11-6', name:'Ứng dụng dao động tắt dần (giảm xóc, cửa tự động)' },
    { id:'k11-6.3', baiKey:'k11-6', name:'Dao động duy trì' },
    { id:'k11-6.4', baiKey:'k11-6', name:'Dao động cưỡng bức: khái niệm, tần số, biên độ' },
    { id:'k11-6.5', baiKey:'k11-6', name:'Hiện tượng cộng hưởng: định nghĩa, điều kiện, giải thích' },
    { id:'k11-6.6', baiKey:'k11-6', name:'Lợi ích và tác hại của cộng hưởng' },
    { id:'k11-6.7', baiKey:'k11-6', name:'Bài tập dao động tắt dần (phần trăm năng lượng, biên độ giảm)' },
    { id:'k11-6.8', baiKey:'k11-6', name:'Bài tập dao động cưỡng bức, cộng hưởng (tần số, đồ thị cộng hưởng)' },

    { id:'k11-7.1', baiKey:'k11-7', name:'Bài tập động năng, thế năng, cơ năng (tỉ số Wđ/Wt, vị trí Wđ = nWt)' },
    { id:'k11-7.2', baiKey:'k11-7', name:'Bài tập biến đổi Wđ, Wt theo thời gian (thời gian Wđ = Wt…)' },
    { id:'k11-7.3', baiKey:'k11-7', name:'Bài tập đồ thị năng lượng' },

    { id:'s11-1.1', baiKey:'s11-1', name:'Khái niệm sóng cơ, môi trường truyền sóng, phần tử môi trường dao động tại chỗ' },
    { id:'s11-1.2', baiKey:'s11-1', name:'Các đại lượng đặc trưng: biên độ, chu kì, tần số, bước sóng, tốc độ truyền sóng' },
    { id:'s11-1.3', baiKey:'s11-1', name:'Liên hệ v = λf = λ/T' },
    { id:'s11-1.4', baiKey:'s11-1', name:'Đồ thị li độ – khoảng cách (hình dạng sóng) và li độ – thời gian' },
    { id:'s11-1.5', baiKey:'s11-1', name:'Năng lượng sóng, cường độ sóng I = P/S' },
    { id:'s11-1.6', baiKey:'s11-1', name:'Độ lệch pha giữa hai điểm trên phương truyền sóng Δφ = 2πd/λ' },
    { id:'s11-1.7', baiKey:'s11-1', name:'Bài tập đại lượng đặc trưng (λ, v, f, T, khoảng cách đỉnh sóng)' },
    { id:'s11-1.8', baiKey:'s11-1', name:'Bài tập đồ thị sóng (đọc λ, A; chiều truyền sóng, chiều chuyển động phần tử)' },
    { id:'s11-1.9', baiKey:'s11-1', name:'Bài tập độ lệch pha, phương trình sóng, điểm cùng pha – ngược pha – vuông pha' },
    { id:'s11-1.10', baiKey:'s11-1', name:'Bài tập cường độ sóng, năng lượng sóng' },

    { id:'s11-2.1', baiKey:'s11-2', name:'Sóng ngang: định nghĩa, môi trường truyền' },
    { id:'s11-2.2', baiKey:'s11-2', name:'Sóng dọc: định nghĩa, môi trường truyền' },
    { id:'s11-2.3', baiKey:'s11-2', name:'Sự truyền năng lượng của sóng cơ' },
    { id:'s11-2.4', baiKey:'s11-2', name:'Sóng âm: bản chất, môi trường truyền, tốc độ âm trong các môi trường' },
    { id:'s11-2.5', baiKey:'s11-2', name:'Âm nghe được, hạ âm, siêu âm và ứng dụng' },
    { id:'s11-2.6', baiKey:'s11-2', name:'Bài tập sóng âm (tốc độ âm, tiếng vang, đo độ sâu bằng siêu âm)' },

    { id:'s11-3.1', baiKey:'s11-3', name:'Dao động kí điện tử: cấu tạo, cách đọc đồ thị trên màn hình' },
    { id:'s11-3.2', baiKey:'s11-3', name:'Thực hành đo tần số sóng âm bằng dao động kí' },

    { id:'s11-4.1', baiKey:'s11-4', name:'Khái niệm sóng điện từ, tính chất (sóng ngang, truyền được trong chân không, c = 3.10^8 m/s)' },
    { id:'s11-4.2', baiKey:'s11-4', name:'Thang sóng điện từ: vô tuyến, vi sóng, hồng ngoại, ánh sáng nhìn thấy, tử ngoại, tia X, tia gamma' },
    { id:'s11-4.3', baiKey:'s11-4', name:'Ứng dụng các vùng sóng điện từ trong đời sống, kĩ thuật' },
    { id:'s11-4.4', baiKey:'s11-4', name:'Bài tập λ = c/f, xác định vùng sóng điện từ' },

    { id:'s11-5.1', baiKey:'s11-5', name:'Hiện tượng giao thoa, nguồn kết hợp, điều kiện giao thoa' },
    { id:'s11-5.2', baiKey:'s11-5', name:'Giao thoa sóng mặt nước: cực đại, cực tiểu, điều kiện hiệu đường đi' },
    { id:'s11-5.3', baiKey:'s11-5', name:'Giao thoa ánh sáng (thí nghiệm Young): vân sáng, vân tối' },
    { id:'s11-5.4', baiKey:'s11-5', name:'Khoảng vân i = λD/a, vị trí vân sáng, vân tối' },
    { id:'s11-5.5', baiKey:'s11-5', name:'Bài tập giao thoa sóng mặt nước: tính chất điểm, số cực đại – cực tiểu trên đoạn' },
    { id:'s11-5.6', baiKey:'s11-5', name:'Bài tập giao thoa sóng mặt nước nâng cao (cực trị trên đường tròn, hình vuông; điểm cùng pha – ngược pha nguồn)' },
    { id:'s11-5.7', baiKey:'s11-5', name:'Bài tập giao thoa ánh sáng: khoảng vân, vị trí vân, tính λ' },
    { id:'s11-5.8', baiKey:'s11-5', name:'Bài tập giao thoa ánh sáng: số vân trên vùng giao thoa, thay đổi a, D, λ' },
    { id:'s11-5.9', baiKey:'s11-5', name:'Bài tập giao thoa ánh sáng nhiều bức xạ, ánh sáng trắng' },

    { id:'s11-6.1', baiKey:'s11-6', name:'Sóng phản xạ (đầu cố định, đầu tự do), sự tạo thành sóng dừng' },
    { id:'s11-6.2', baiKey:'s11-6', name:'Nút sóng, bụng sóng; khoảng cách giữa các nút, bụng' },
    { id:'s11-6.3', baiKey:'s11-6', name:'Điều kiện sóng dừng dây hai đầu cố định ℓ = kλ/2' },
    { id:'s11-6.4', baiKey:'s11-6', name:'Điều kiện sóng dừng một đầu cố định, một đầu tự do ℓ = (2k + 1)λ/4' },
    { id:'s11-6.5', baiKey:'s11-6', name:'Sóng dừng trong cột không khí, ứng dụng trong nhạc cụ' },
    { id:'s11-6.6', baiKey:'s11-6', name:'Bài tập sóng dừng: số nút, số bụng, tần số, tốc độ truyền sóng' },
    { id:'s11-6.7', baiKey:'s11-6', name:'Bài tập sóng dừng nâng cao: biên độ điểm, tần số liên tiếp, thời gian dây duỗi thẳng' },

    { id:'s11-7.1', baiKey:'s11-7', name:'Thực hành đo tốc độ truyền âm: dụng cụ, phương án (cộng hưởng cột khí)' },
    { id:'s11-7.2', baiKey:'s11-7', name:'Xử lí số liệu, sai số trong thực hành đo tốc độ truyền âm' },

    { id:'dt11-1.1', baiKey:'dt11-1', name:'Hai loại điện tích, điện tích điểm, vật nhiễm điện – vật trung hoà' },
    { id:'dt11-1.2', baiKey:'dt11-1', name:'Sự nhiễm điện do cọ xát, tiếp xúc, hưởng ứng' },
    { id:'dt11-1.3', baiKey:'dt11-1', name:'Tương tác giữa các điện tích (cùng dấu đẩy, trái dấu hút)' },
    { id:'dt11-1.4', baiKey:'dt11-1', name:'Thuyết electron, định luật bảo toàn điện tích' },
    { id:'dt11-1.5', baiKey:'dt11-1', name:'Đơn vị điện tích, điện tích nguyên tố, điện tích electron – proton' },
    { id:'dt11-1.6', baiKey:'dt11-1', name:'Định luật Coulomb trong chân không, nguyên lí chồng chất lực' },
    { id:'dt11-1.7', baiKey:'dt11-1', name:'Lực tương tác trong điện môi, hằng số điện môi' },
    { id:'dt11-1.8', baiKey:'dt11-1', name:'Bài tập số electron thừa – thiếu, chia điện tích khi tiếp xúc' },
    { id:'dt11-1.9', baiKey:'dt11-1', name:'Bài tập lực Coulomb giữa hai điện tích (chân không, điện môi)' },
    { id:'dt11-1.10', baiKey:'dt11-1', name:'Bài tập lực tổng hợp tác dụng lên một điện tích' },
    { id:'dt11-1.11', baiKey:'dt11-1', name:'Bài tập cân bằng của một điện tích, hệ ba điện tích' },
    { id:'dt11-1.12', baiKey:'dt11-1', name:'Bài tập con lắc tích điện, quả cầu treo bằng dây' },

    { id:'dt11-2.1', baiKey:'dt11-2', name:'Khái niệm điện trường, tính chất cơ bản của điện trường' },
    { id:'dt11-2.2', baiKey:'dt11-2', name:'Cường độ điện trường: định nghĩa, F = qE, chiều của E và F' },
    { id:'dt11-2.3', baiKey:'dt11-2', name:'Điện trường của điện tích điểm E = k|Q|/(εr²)' },
    { id:'dt11-2.4', baiKey:'dt11-2', name:'Đơn vị cường độ điện trường (V/m, N/C)' },
    { id:'dt11-2.5', baiKey:'dt11-2', name:'Nguyên lí chồng chất điện trường' },
    { id:'dt11-2.6', baiKey:'dt11-2', name:'Điện phổ, đường sức điện và tính chất' },
    { id:'dt11-2.7', baiKey:'dt11-2', name:'Bài tập cường độ điện trường của điện tích điểm, lực điện tác dụng lên điện tích' },
    { id:'dt11-2.8', baiKey:'dt11-2', name:'Bài tập điện trường tổng hợp của hệ điện tích' },
    { id:'dt11-2.9', baiKey:'dt11-2', name:'Bài tập điểm có điện trường tổng hợp bằng không' },
    { id:'dt11-2.10', baiKey:'dt11-2', name:'Bài tập điện tích cân bằng trong điện trường (dây treo, giọt dầu)' },

    { id:'dt11-3.1', baiKey:'dt11-3', name:'Khái niệm điện trường đều, đường sức điện trường đều' },
    { id:'dt11-3.2', baiKey:'dt11-3', name:'Điện trường đều giữa hai bản phẳng E = U/d' },
    { id:'dt11-3.3', baiKey:'dt11-3', name:'Chuyển động của điện tích có vận tốc đầu song song đường sức' },
    { id:'dt11-3.4', baiKey:'dt11-3', name:'Chuyển động của điện tích có vận tốc đầu vuông góc đường sức (quỹ đạo parabol)' },
    { id:'dt11-3.5', baiKey:'dt11-3', name:'Ứng dụng: ống phóng điện tử, máy gia tốc, máy in phun' },
    { id:'dt11-3.6', baiKey:'dt11-3', name:'Bài tập E = U/d, lực điện trong điện trường đều' },
    { id:'dt11-3.7', baiKey:'dt11-3', name:'Bài tập chuyển động thẳng của điện tích dọc đường sức (tăng tốc, hãm)' },
    { id:'dt11-3.8', baiKey:'dt11-3', name:'Bài tập chuyển động ném ngang của điện tích (thời gian, độ lệch, vận tốc ra)' },

    { id:'dt11-4.1', baiKey:'dt11-4', name:'Công của lực điện A = qEd, không phụ thuộc hình dạng đường đi' },
    { id:'dt11-4.2', baiKey:'dt11-4', name:'Thế năng điện, A_MN = W_M − W_N' },
    { id:'dt11-4.3', baiKey:'dt11-4', name:'Bài tập công của lực điện trong điện trường đều (đường gấp khúc, tam giác)' },
    { id:'dt11-4.4', baiKey:'dt11-4', name:'Bài tập thế năng điện, định lí động năng cho điện tích' },

    { id:'dt11-5.1', baiKey:'dt11-5', name:'Điện thế tại một điểm V = A_M∞/q = W_M/q' },
    { id:'dt11-5.2', baiKey:'dt11-5', name:'Hiệu điện thế U_MN = V_M − V_N = A_MN/q, đơn vị vôn' },
    { id:'dt11-5.3', baiKey:'dt11-5', name:'Liên hệ giữa cường độ điện trường và hiệu điện thế trong điện trường đều U = Ed' },
    { id:'dt11-5.4', baiKey:'dt11-5', name:'Bài tập điện thế, hiệu điện thế, công của lực điện' },
    { id:'dt11-5.5', baiKey:'dt11-5', name:'Bài tập liên hệ E – U, điện thế các bản, hình học trong điện trường đều' },
    { id:'dt11-5.6', baiKey:'dt11-5', name:'Bài tập chuyển động hạt mang điện qua hiệu điện thế (gia tốc electron, giọt dầu lơ lửng)' },

    { id:'dt11-6.1', baiKey:'dt11-6', name:'Điện môi trong điện trường, sự phân cực điện môi' },
    { id:'dt11-6.2', baiKey:'dt11-6', name:'Tụ điện: cấu tạo, kí hiệu, cách tích điện, điện tích của tụ' },
    { id:'dt11-6.3', baiKey:'dt11-6', name:'Điện dung, đơn vị, hiệu điện thế giới hạn, tụ phẳng C = εS/(4πkd)' },
    { id:'dt11-6.4', baiKey:'dt11-6', name:'Ghép tụ điện nối tiếp, song song' },
    { id:'dt11-6.5', baiKey:'dt11-6', name:'Bài tập điện dung, điện tích, hiệu điện thế giới hạn của tụ' },
    { id:'dt11-6.6', baiKey:'dt11-6', name:'Bài tập tụ ngắt khỏi nguồn / vẫn nối nguồn khi thay đổi d, S, ε' },
    { id:'dt11-6.7', baiKey:'dt11-6', name:'Bài tập ghép tụ điện' },
    { id:'dt11-6.8', baiKey:'dt11-6', name:'Bài tập mạch tụ nâng cao (nối các tấm kim loại, mạch có nhiều nguồn)' },

    { id:'dt11-7.1', baiKey:'dt11-7', name:'Năng lượng của tụ điện W = QU/2 = CU²/2 = Q²/(2C)' },
    { id:'dt11-7.2', baiKey:'dt11-7', name:'Ứng dụng của tụ điện trong đời sống, kĩ thuật' },
    { id:'dt11-7.3', baiKey:'dt11-7', name:'Bài tập năng lượng tụ điện, công làm thay đổi năng lượng tụ' },
    { id:'dt11-7.4', baiKey:'dt11-7', name:'Bài tập ứng dụng tụ điện (flash, máy hàn, công suất phóng điện)' },

    { id:'dd11-1.1', baiKey:'dd11-1', name:'Khái niệm dòng điện, chiều quy ước, dòng điện không đổi' },
    { id:'dd11-1.2', baiKey:'dd11-1', name:'Hạt mang điện trong kim loại, chất điện phân' },
    { id:'dd11-1.3', baiKey:'dd11-1', name:'Cường độ dòng điện I = Δq/Δt, đơn vị, ampe kế, các tác dụng của dòng điện' },
    { id:'dd11-1.4', baiKey:'dd11-1', name:'Tốc độ trôi của hạt mang điện, I = Snve' },
    { id:'dd11-1.5', baiKey:'dd11-1', name:'Bài tập cường độ dòng điện, điện lượng, số electron' },
    { id:'dd11-1.6', baiKey:'dd11-1', name:'Bài tập tốc độ trôi, mật độ hạt tải điện' },

    { id:'dd11-2.1', baiKey:'dd11-2', name:'Khái niệm điện trở, đơn vị ôm' },
    { id:'dd11-2.2', baiKey:'dd11-2', name:'Điện trở dây dẫn R = ρℓ/S, điện trở suất, cách đọc vòng màu' },
    { id:'dd11-2.3', baiKey:'dd11-2', name:'Định luật Ohm cho đoạn mạch chỉ có điện trở, biến trở' },
    { id:'dd11-2.4', baiKey:'dd11-2', name:'Đường đặc trưng vôn – ampe' },
    { id:'dd11-2.5', baiKey:'dd11-2', name:'Nguyên nhân gây ra điện trở của kim loại' },
    { id:'dd11-2.6', baiKey:'dd11-2', name:'Ảnh hưởng của nhiệt độ: đèn sợi đốt, điện trở nhiệt NTC – PTC, siêu dẫn' },
    { id:'dd11-2.7', baiKey:'dd11-2', name:'Sự dẫn điện trong hệ thần kinh' },
    { id:'dd11-2.8', baiKey:'dd11-2', name:'Bài tập R = ρℓ/S, thay đổi kích thước dây dẫn' },
    { id:'dd11-2.9', baiKey:'dd11-2', name:'Bài tập định luật Ohm, đồ thị I – U' },
    { id:'dd11-2.10', baiKey:'dd11-2', name:'Bài tập đoạn mạch điện trở nối tiếp, song song' },
    { id:'dd11-2.11', baiKey:'dd11-2', name:'Bài tập mạch hỗn hợp, mạch cầu, mạch có vôn kế – ampe kế' },

    { id:'dd11-3.1', baiKey:'dd11-3', name:'Điều kiện có dòng điện, nguồn điện, lực lạ' },
    { id:'dd11-3.2', baiKey:'dd11-3', name:'Suất điện động của nguồn điện E = A/q' },
    { id:'dd11-3.3', baiKey:'dd11-3', name:'Điện trở trong, định luật Ohm cho toàn mạch, hiện tượng đoản mạch' },
    { id:'dd11-3.4', baiKey:'dd11-3', name:'Ghép nguồn điện nối tiếp, song song, hỗn hợp đối xứng' },
    { id:'dd11-3.5', baiKey:'dd11-3', name:'Bài tập suất điện động, công của nguồn, dung lượng (Ah)' },
    { id:'dd11-3.6', baiKey:'dd11-3', name:'Bài tập định luật Ohm cho toàn mạch' },
    { id:'dd11-3.7', baiKey:'dd11-3', name:'Bài tập đồ thị U – I, I – R, 1/I – R: xác định E, r' },
    { id:'dd11-3.8', baiKey:'dd11-3', name:'Bài tập ghép nguồn điện' },
    { id:'dd11-3.9', baiKey:'dd11-3', name:'Bài tập mạch có tụ điện, mạch có nhiều nguồn' },

    { id:'dd11-4.1', baiKey:'dd11-4', name:'Năng lượng điện tiêu thụ A = UIt, công tơ điện, kWh' },
    { id:'dd11-4.2', baiKey:'dd11-4', name:'Công suất điện P = UI, công suất định mức' },
    { id:'dd11-4.3', baiKey:'dd11-4', name:'Nhiệt lượng và công suất toả nhiệt trên điện trở (Q = RI²t)' },
    { id:'dd11-4.4', baiKey:'dd11-4', name:'Công, công suất và hiệu suất của nguồn điện' },
    { id:'dd11-4.5', baiKey:'dd11-4', name:'Thực hành đo suất điện động và điện trở trong của pin điện hoá' },
    { id:'dd11-4.6', baiKey:'dd11-4', name:'Bài tập điện năng tiêu thụ, tiền điện' },
    { id:'dd11-4.7', baiKey:'dd11-4', name:'Bài tập công suất, nhiệt lượng trên điện trở, dụng cụ định mức' },
    { id:'dd11-4.8', baiKey:'dd11-4', name:'Bài tập công suất, hiệu suất nguồn điện' },
    { id:'dd11-4.9', baiKey:'dd11-4', name:'Bài tập cực trị công suất (R = r, R1R2 = r²)' },
    { id:'dd11-4.10', baiKey:'dd11-4', name:'Bài tập đồ thị công suất, hiệu suất theo R hoặc I' }
  ];

  // ============================================================
  // 4) Hàm tiện ích
  // ============================================================
  function stripDiacritics(s){
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .toLowerCase();
  }

  function getChuDe(chuDeKey){
    for(var i=0;i<CHU_DE.length;i++){ if(CHU_DE[i].key===chuDeKey) return CHU_DE[i]; }
    return null;
  }
  // THÊM 7/11/2026 — key Bài cũ của VL10/VL11 (theo số bài SGK, dùng từ 28/10/2026) -> key mới theo tiền tố mã nano.
  // Dữ liệu đã lưu với key cũ (nanoBaiKey của câu hỏi, bài bị khoá, nano-point thầy tự thêm…) vẫn tra ra đúng Bài.
  var BAI_ALIAS = {
    'k10-1':'md-1', 'k10-2':'md-2', 'k10-3':'md-3',
    'k10-4':'cd-2', 'k10-5':'cd-3', 'k10-6':'cd-6', 'k10-7':'cd-4',
    'k10-8':'bd-1', 'k10-9':'bd-2', 'k10-10':'bd-3', 'k10-11':'bd-4', 'k10-12':'bd-5',
    'k10-13':'dlh-1', 'k10-14':'dlh-2', 'k10-15':'dlh-3', 'k10-16':'dlh-4', 'k10-17':'dlh-5', 'k10-18':'dlh-6', 'k10-19':'dlh-7',
    'k11-8':'s11-1', 'k11-9':'s11-2', 'k11-10':'s11-3', 'k11-11':'s11-4', 'k11-12':'s11-5', 'k11-13':'s11-6', 'k11-15':'s11-7',
    'k11-16':'dt11-1', 'k11-17':'dt11-2', 'k11-18':'dt11-3', 'k11-19':'dt11-4', 'k11-20':'dt11-5', 'k11-21':'dt11-6',
    'k11-22':'dd11-1', 'k11-23':'dd11-2', 'k11-24':'dd11-3', 'k11-25':'dd11-4'
  };
  function resolveBaiKey(baiKey){
    return Object.prototype.hasOwnProperty.call(BAI_ALIAS, baiKey) ? BAI_ALIAS[baiKey] : baiKey;
  }
  function getBai(baiKey){
    var k = resolveBaiKey(baiKey);
    for(var i=0;i<BAI.length;i++){ if(BAI[i].key===k) return BAI[i]; }
    return null;
  }
  function getNano(nanoId){
    for(var i=0;i<NANO.length;i++){ if(NANO[i].id===nanoId) return NANO[i]; }
    return null;
  }
  function getNanoByBai(baiKey){
    baiKey = resolveBaiKey(baiKey);
    return NANO.filter(function(n){ return n.baiKey === baiKey; });
  }
  function getBaiByChuDe(chuDeKey){
    return BAI.filter(function(b){ return b.chuDeKey === chuDeKey; });
  }

  function findChuDeByText(text){
    if(!text) return null;
    var norm = stripDiacritics(text);
    for(var i=0;i<CHU_DE.length;i++){
      var c = CHU_DE[i];
      if(norm.indexOf(stripDiacritics(c.name)) > -1) return c;
      for(var j=0;j<(c.aliases||[]).length;j++){
        if(norm.indexOf(c.aliases[j]) > -1) return c;
      }
    }
    return null;
  }

  // Khớp chuỗi mờ (fuzzy) giữa text tự do (vd. tag "dangBai" bóc từ .tex)
  // và danh mục "Bài" chuẩn — CHƯA dùng AI, chỉ so khớp từ khoá.
  // THÊM 5/10/2026 — so khớp tên Bài không phân biệt kiểu dấu gạch (-, –, —) và khoảng trắng thừa
  function normBaiText(t){
    return stripDiacritics(t).replace(/[\u2010-\u2015-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function findBaiByText(text, chuDeKey){
    if(!text) return null;
    var norm = normBaiText(text);
    var pool = chuDeKey ? getBaiByChuDe(chuDeKey) : BAI;
    var best = null, bestScore = 0;
    pool.forEach(function(b){
      var bn = normBaiText(b.name);
      var score = 0;
      if(bn === norm) score = 100;
      else if(bn.indexOf(norm) > -1 || norm.indexOf(bn) > -1) score = 60;
      else {
        var words = norm.split(/\s+/).filter(function(w){ return w.length > 2; });
        var hit = words.filter(function(w){ return bn.indexOf(w) > -1; }).length;
        if(hit >= 2) score = 30 + hit;
      }
      if(score > bestScore){ bestScore = score; best = b; }
    });
    return bestScore >= 30 ? best : null;
  }

  // Gợi ý nano-point cho 1 câu hỏi vừa bóc tách từ .tex (dựa trên tag
  // [Chủ đề lớn][Dạng bài] giáo viên ghi sẵn). Đây là chỗ cắm AI thật sau
  // này — hiện chỉ khớp chuỗi cục bộ, không gọi mạng.
  // ============================================================
  // THÊM 5/10/2026 — NANO-POINT MỞ RỘNG DO THẦY TỰ THÊM (không cần sửa code):
  // danh mục có sẵn ở trên chỉ có 3 nano-point mỗi bài, trong khi ngân hàng .tex của thầy chi tiết hơn
  // (vd. khi-1.4 … khi-1.7). Các nano-point thêm tay được lưu ở Firestore settings/nanoExtra
  // ({items:[{id, baiKey, name}]}); admin.html và trang học sinh đọc rồi gọi setExtra(items) để GỘP vào NANO
  // ngay lúc chạy. Mục trùng id với nano có sẵn = ĐỔI TÊN (id giữ nguyên). setExtra luôn bắt đầu từ danh mục gốc
  // nên gọi lại nhiều lần (cập nhật trực tiếp) vẫn đúng. Mảng NANO được sửa TẠI CHỖ để mọi nơi đang giữ
  // tham chiếu OPC_NANO.NANO đều thấy thay đổi.
  // ============================================================
  var ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.\d+$/;
  var extraItems = [];
  function baiOrder(){ var o = {}; BAI.forEach(function(b, i){ o[b.key] = i; }); return o; }
  function idNum(id){ var m = /\.(\d+)$/.exec(id); return m ? parseInt(m[1], 10) : 0; }
  function setExtra(items){
    // 1) trả về danh mục gốc: bỏ mục thêm, khôi phục tên cũ
    for(var i = NANO.length - 1; i >= 0; i--){
      if(NANO[i]._extra) NANO.splice(i, 1);
      else if(NANO[i]._origName != null){ NANO[i].name = NANO[i]._origName; delete NANO[i]._origName; }
    }
    extraItems = [];
    // 2) áp danh sách mới
    (items || []).forEach(function(it){
      if(!it || !ID_RE.test(String(it.id || '').toLowerCase())) return;
      var id = String(it.id).toLowerCase();
      var name = String(it.name || '').trim();
      if(!name) return;
      var bai0 = getBai(it.baiKey || id.split('.')[0]);
      if(!bai0) return;
      var baiKey = bai0.key;
      var existing = getNano(id);
      if(existing){
        if(existing._origName == null) existing._origName = existing.name;
        existing.name = name;
      } else {
        NANO.push({ id:id, baiKey:baiKey, name:name, _extra:true });
      }
      extraItems.push({ id:id, baiKey:baiKey, name:name });
    });
    // 3) sắp xếp lại: theo thứ tự Bài rồi số thứ tự nano
    var order = baiOrder();
    var decorated = NANO.map(function(n, i){ return { n:n, i:i }; });
    decorated.sort(function(a, b){
      var oa = order[a.n.baiKey], ob = order[b.n.baiKey];
      if(oa !== ob) return (oa == null ? 1e6 : oa) - (ob == null ? 1e6 : ob);
      var d = idNum(a.n.id) - idNum(b.n.id);
      return d !== 0 ? d : a.i - b.i;
    });
    decorated.forEach(function(d, k){ NANO[k] = d.n; });
    // THÊM 6/10/2026 — danh sách nano-point vừa đổi: dựng lại đồ thị tiên quyết (cạnh trỏ tới nano-point mới thêm/xoá)
    if(typeof rebuildPrereq === 'function') rebuildPrereq();
  }
  function getExtraItems(){ return extraItems.map(function(x){ return { id:x.id, baiKey:x.baiKey, name:x.name }; }); }
  function isValidNanoId(id){ return ID_RE.test(String(id || '').toLowerCase()); }
  // Mã nano kế tiếp còn trống của 1 Bài (vd. baiKey 'khi-1' -> 'khi-1.8')
  function nextNanoId(baiKey){
    var max = 0;
    NANO.forEach(function(n){ if(n.baiKey === baiKey && idNum(n.id) > max) max = idNum(n.id); });
    return baiKey + '.' + (max + 1);
  }
  // Đọc dòng thẻ "@nano: khi-1.3, khi-2.1" (cách nhau bằng phẩy/khoảng trắng/;). Chịu được gõ nhầm "khi -2.1".
  function parseIdList(text){
    var t = String(text || '').toLowerCase().replace(/([a-z])\s+-\s*(\d)/g, '$1-$2');
    var out = [], m, re = /[a-z0-9]+(?:-[a-z0-9]+)*\.\d+/g;
    while((m = re.exec(t)) !== null){ if(out.indexOf(m[0]) < 0) out.push(m[0]); }
    return out;
  }

  // ============================================================
  // THÊM 5/10/2026 — GỢI Ý NANO-POINT TỪ NỘI DUNG CÂU HỎI (không cần AI, chạy tức thì trong trình duyệt).
  // Trước đây suggestForParsedQuestion chỉ khớp chữ trong thẻ "dạng bài" thầy ghi tay để chọn BÀI, không đọc đề
  // và không chọn nano-point nào. Hàm này đọc đề bài (+ ngữ cảnh chùm + lời giải), so từ khoá và cụm 2 từ với tên
  // từng nano-point/tên Bài (từ hiếm có trọng số cao hơn — kiểu TF-IDF), có thưởng nhẹ nếu trùng thẻ dạng bài.
  // Trả về tối đa 3 nano-point (kể cả ở Bài khác) kèm điểm và độ tin cậy: 'cao' | 'vừa' | 'thấp'.
  // Đây là GỢI Ý để thầy xác nhận — độ chính xác phụ thuộc tên nano-point mô tả rõ đến đâu.
  // ============================================================
  var STOP = {};
  ('là của và có khi trong một các những được với cho này đó thì nào bao nhiêu tính hãy nếu ra từ đến theo bằng ở trên dưới ' +
   'câu hỏi đúng sai phát biểu nhận định đáp án sau đây dưới đây như thế nào gì sẽ bị do vì nên rằng mà cũng lúc tại khoảng ' +
   'xác định tìm giá trị biết tại sao hỏi lượng bài toán công thức em học sinh').split(' ').forEach(function(w){ STOP[w] = 1; });
  function tokenizeVi(text){
    var t = String(text || '').toLowerCase()
      .replace(/\\[a-zA-Z]+/g, ' ')            // bỏ lệnh LaTeX (\frac, \text...)
      .replace(/[$_^{}\\]/g, ' ')
      .replace(/[^a-z0-9àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+/g, ' ')
      .trim();
    return t ? t.split(/\s+/).filter(function(w){ return w.length > 1 && !STOP[w] && !/^\d+$/.test(w); }) : [];
  }
  function bigramsOf(tokens){
    var out = [];
    for(var i = 0; i < tokens.length - 1; i++) out.push(tokens[i] + ' ' + tokens[i + 1]);
    return out;
  }
  var matcherIndex = null, matcherVersion = -1;
  function buildMatcherIndex(){
    var docs = NANO.map(function(n){
      var bai = getBai(n.baiKey);
      var nt = tokenizeVi(n.name), bt = tokenizeVi(bai ? bai.name : '');
      return { nano: n, nameTokens: nt, nameBigrams: bigramsOf(nt), baiTokens: bt };
    });
    var df = {};
    docs.forEach(function(d){
      var seen = {};
      d.nameTokens.concat(d.baiTokens).forEach(function(w){ if(!seen[w]){ seen[w] = 1; df[w] = (df[w] || 0) + 1; } });
    });
    var N = docs.length || 1;
    var idf = {};
    Object.keys(df).forEach(function(w){ idf[w] = Math.log(1 + N / df[w]); });
    matcherIndex = { docs: docs, idf: idf };
  }
  function suggestNanos(text, opts){
    opts = opts || {};
    if(!matcherIndex || matcherVersion !== NANO.length) { buildMatcherIndex(); matcherVersion = NANO.length; }
    var qt = tokenizeVi(text);
    if(!qt.length) return [];
    var qset = {}; qt.forEach(function(w){ qset[w] = (qset[w] || 0) + 1; });
    var qbi = {}; bigramsOf(qt).forEach(function(b){ qbi[b] = 1; });
    var hint = opts.dangBai ? tokenizeVi(opts.dangBai) : [];
    var hintSet = {}; hint.forEach(function(w){ hintSet[w] = 1; });
    var scored = matcherIndex.docs.map(function(d){
      var score = 0, hits = 0;
      d.nameTokens.forEach(function(w){
        if(qset[w]){ score += matcherIndex.idf[w] * (1 + Math.min(2, qset[w] - 1) * 0.15); hits++; }
      });
      // cụm 2 từ trùng khớp: thưởng theo độ HIẾM của 2 từ (cụm chung chung như "khí lí tưởng" có mặt ở rất nhiều
      // nano-point nên chỉ thưởng ít, cụm đặc thù như "định luật Boyle" thưởng nhiều)
      d.nameBigrams.forEach(function(b){
        if(qbi[b]){ var w2 = b.split(' '); score += 0.6 * ((matcherIndex.idf[w2[0]] || 0) + (matcherIndex.idf[w2[1]] || 0)); }
      });
      var baiHit = 0;
      d.baiTokens.forEach(function(w){ if(qset[w]) baiHit += matcherIndex.idf[w] * 0.25; });
      var hintHit = 0;
      d.baiTokens.forEach(function(w){ if(hintSet[w]) hintHit += matcherIndex.idf[w] * 0.3; });
      // chuẩn hoá nhẹ theo độ dài tên để tên dài không luôn thắng
      var norm = Math.sqrt(Math.max(3, d.nameTokens.length));
      var total = (score / norm) + baiHit + hintHit;
      return { id: d.nano.id, baiKey: d.nano.baiKey, score: total, hits: hits };
    }).filter(function(r){ return r.hits > 0 || r.score > 0; });
    scored.sort(function(a, b){ return b.score - a.score; });
    if(!scored.length) return [];
    var top = scored[0].score;
    var maxN = opts.max || 3;
    var picked = [];
    for(var i = 0; i < scored.length && picked.length < maxN; i++){
      var r = scored[i];
      if(i === 0 || (r.score >= top * 0.9 && r.hits > 0)) picked.push(r);
    }
    var second = scored[1] ? scored[1].score : 0;
    var conf = (top >= 8 && top >= second * 1.35) ? 'cao' : (top >= 4 ? 'vừa' : 'thấp');
    return picked.map(function(r){ return { id: r.id, baiKey: r.baiKey, score: Math.round(r.score * 100) / 100, confidence: conf }; });
  }

  // ============================================================
  // THÊM 6/10/2026 — QUAN HỆ TIÊN QUYẾT GIỮA CÁC NANO-POINT ("muốn làm được A thì phải vững B trước").
  // Dùng để TÌM GỐC LỖI: khi em yếu rõ ở nano-point A, hệ thống xem các nano-point tiên quyết của A — nếu có cái
  // đã yếu thì luyện cái đó trước (đi ngược tối đa vài bước), nếu chưa có dữ liệu thì kiểm tra thử nền tảng.
  //  - PREREQ_SEED: gợi ý ban đầu của hệ thống (Chương I-IV; Nhiệt + Khí viết lại 6/10/2026 sau khi danh mục đổi) — thầy rà lại và sửa trong admin.
  //  - Thầy sửa trong admin > "🗺️ Nano-point" -> lưu Firestore settings/nanoPrereq ({edits:[{id, prereqs:[…]}]});
  //    trang học sinh đọc cùng nguồn rồi gọi setPrereqEdits. Mục có trong edits GHI ĐÈ hoàn toàn mục seed của
  //    nano-point đó (mảng rỗng = "không cần nano-point nào trước").
  //  - Luôn là đồ thị KHÔNG VÒNG: quan hệ nào tạo vòng lặp sẽ bị bỏ khi áp dụng (xem setPrereqEdits).
  // ============================================================
  var PREREQ_SEED = {
    // ---- Vật lí nhiệt (viết lại 6/10/2026 theo danh mục nano-point mới) ----
    'nhiet-1.2': ['nhiet-1.1'],
    'nhiet-1.3': ['nhiet-1.1', 'nhiet-1.2'],
    'nhiet-1.4': ['nhiet-1.1', 'nhiet-1.2'],
    'nhiet-2.2': ['nhiet-2.1'],
    'nhiet-2.3': ['nhiet-2.1'],
    'nhiet-2.4': ['nhiet-2.2'],
    'nhiet-2.5': ['nhiet-1.1', 'nhiet-2.1'],
    'nhiet-3.2': ['nhiet-3.1'],
    'nhiet-3.3': ['nhiet-3.1', 'nhiet-3.2'],
    'nhiet-4.1': ['nhiet-3.1', 'nhiet-2.1'],
    'nhiet-4.2': ['nhiet-4.1'],
    'nhiet-4.3': ['nhiet-4.1'],
    'nhiet-4.4': ['nhiet-4.3'],
    'nhiet-4.5': ['nhiet-4.3'],
    'nhiet-4.6': ['nhiet-4.1'],
    'nhiet-5.1': ['nhiet-1.2'],
    'nhiet-5.2': ['nhiet-5.1'],
    'nhiet-5.3': ['nhiet-5.1', 'nhiet-1.3'],
    'nhiet-5.4': ['nhiet-5.1'],
    'nhiet-6.1': ['nhiet-1.2'],
    'nhiet-6.2': ['nhiet-6.1'],
    'nhiet-6.3': ['nhiet-6.1', 'nhiet-1.3'],
    'nhiet-6.4': ['nhiet-6.1'],
    'nhiet-7.1': ['nhiet-2.2', 'nhiet-4.3'],
    // ---- Khí lí tưởng (viết lại 6/10/2026 theo danh mục nano-point mới) ----
    'khi-1.2': ['khi-1.1'],
    'khi-1.3': ['khi-1.2'],
    'khi-1.4': ['khi-1.2'],
    'khi-2.1': ['khi-1.2'],
    'khi-2.2': ['khi-2.1'],
    'khi-2.3': ['khi-2.1'],
    'khi-2.4': ['khi-2.3'],
    'khi-2.5': ['khi-2.3', 'khi-1.4'],
    'khi-2.6': ['khi-1.4'],
    'khi-2.7': ['khi-2.1'],
    'khi-3.1': ['khi-2.1', 'nhiet-3.1'],
    'khi-3.2': ['khi-3.1'],
    'khi-3.3': ['khi-3.1'],
    'khi-3.4': ['khi-2.3', 'khi-3.2', 'khi-3.3'],
    'khi-4.1': ['khi-2.1', 'khi-3.1'],
    'khi-4.2': ['khi-4.1'],
    'khi-4.3': ['khi-4.1', 'khi-1.3'],
    'khi-4.4': ['khi-4.3'],
    'khi-4.5': ['khi-4.3', 'khi-3.4'],
    'khi-4.6': ['khi-4.1', 'khi-2.2'],
    'khi-5.1': ['khi-1.2'],
    'khi-5.2': ['khi-5.1', 'nhiet-3.1'],
    'khi-5.3': ['khi-5.1', 'khi-5.2'],
    'khi-6.1': ['khi-5.2', 'nhiet-2.1'],
    'khi-6.2': ['khi-6.1', 'nhiet-2.2'],
    'khi-6.3': ['khi-6.2'],
    'khi-6.4': ['khi-6.2', 'khi-4.6'],
    // ---- Từ trường ----
    'tt-1.2': ['tt-1.1'],
    'tt-1.3': ['tt-1.2'],
    'tt-1.4': ['tt-1.3'],
    'tt-1.5': ['tt-1.3', 'tt-1.4'],
    'tt-2.1': ['tt-1.2', 'tt-1.4'],
    'tt-2.2': ['tt-2.1'],
    'tt-2.3': ['tt-2.1', 'tt-1.4'],
    'tt-2.4': ['tt-2.1'],
    'tt-2.5': ['tt-2.1', 'tt-2.2'],
    'tt-2.6': ['tt-2.5'],
    'tt-2.7': ['tt-2.2'],
    'tt-3.1': ['tt-2.2', 'tt-1.3'],
    'tt-3.2': ['tt-3.1'],
    'tt-3.3': ['tt-3.1'],
    'tt-3.4': ['tt-3.3'],
    'tt-3.5': ['tt-3.3', 'tt-2.2'],
    'tt-3.6': ['tt-3.5'],
    'tt-4.1': ['tt-3.1'],
    'tt-4.2': ['tt-4.1'],
    'tt-4.3': ['tt-4.1', 'tt-3.3'],
    'tt-4.4': ['tt-4.2'],
    'tt-5.1': ['tt-3.1'],
    'tt-5.2': ['tt-5.1', 'tt-3.3'],
    'tt-5.3': ['tt-5.1', 'tt-3.5'],
    'tt-6.1': ['tt-3.1'],
    'tt-6.2': ['tt-6.1'],
    'tt-7.1': ['tt-4.2', 'tt-3.1'],
    'tt-7.2': ['tt-7.1', 'tt-4.4'],
    // ---- Vật lí hạt nhân ----
    'hn-1.2': ['hn-1.1'],
    'hn-1.3': ['hn-1.1', 'hn-1.2'],
    'hn-1.4': ['hn-1.1'],
    'hn-2.1': ['hn-1.2'],
    'hn-2.2': ['hn-2.1', 'hn-1.3'],
    'hn-2.3': ['hn-2.1'],
    'hn-2.4': ['hn-2.3', 'hn-2.2'],
    'hn-3.1': ['hn-1.2'],
    'hn-3.2': ['hn-3.1'],
    'hn-3.3': ['hn-3.1'],
    'hn-3.4': ['hn-3.3'],
    'hn-4.1': ['hn-2.3', 'hn-3.1'],
    'hn-4.2': ['hn-3.1'],
    'hn-4.3': ['hn-3.1', 'hn-4.1'],
    'hn-4.4': ['hn-4.3', 'hn-3.4'],
    'hn-4.5': ['hn-2.1'],
    'hn-5.1': ['hn-2.2'],
    'hn-5.2': ['hn-2.1'],
    'hn-5.3': ['hn-3.3', 'hn-2.2'],
    // THÊM 7/11/2026 — Vật lí 10 & 11 (gợi ý ban đầu theo danh mục nano-point của thầy; thầy rà lại và sửa trong admin)
    // ---- VL10 Mở đầu ----
    'md-1.2': ['md-1.1'],
    'md-1.3': ['md-1.1'],
    'md-1.4': ['md-1.1'],
    'md-2.2': ['md-2.1'],
    'md-2.3': ['md-2.2'],
    'md-3.2': ['md-3.1'],
    'md-3.3': ['md-3.2'],
    // ---- VL10 Mô tả chuyển động ----
    'cd-1.2': ['cd-1.1'],
    'cd-1.3': ['cd-1.1'],
    'cd-2.1': ['cd-1.1'],
    'cd-2.2': ['cd-2.1', 'cd-1.2'],
    'cd-2.3': ['cd-2.2'],
    'cd-3.1': ['cd-2.1'],
    'cd-3.2': ['cd-3.1', 'cd-2.2'],
    'cd-3.3': ['cd-3.2', 'cd-1.2'],
    'cd-4.1': ['cd-3.2'],
    'cd-4.2': ['cd-4.1', 'cd-1.2'],
    'cd-4.3': ['cd-4.1', 'cd-3.3'],
    'cd-5.1': ['cd-3.2', 'cd-1.1'],
    'cd-5.2': ['cd-5.1'],
    'cd-5.3': ['cd-5.1'],
    'cd-6.1': ['cd-3.1', 'md-2.2'],
    'cd-6.2': ['cd-6.1', 'md-3.2'],
    'cd-6.3': ['cd-6.2'],
    // ---- VL10 Chuyển động biến đổi ----
    'bd-1.1': ['cd-3.2'],
    'bd-1.2': ['bd-1.1'],
    'bd-1.3': ['bd-1.1'],
    'bd-2.1': ['bd-1.1', 'cd-1.2'],
    'bd-2.2': ['bd-2.1'],
    'bd-2.3': ['bd-2.1'],
    'bd-2.4': ['bd-2.2', 'bd-1.3'],
    'bd-2.5': ['bd-2.1', 'cd-4.1'],
    'bd-2.6': ['bd-2.1', 'cd-3.3'],
    'bd-3.1': ['bd-1.1'],
    'bd-3.2': ['bd-3.1', 'bd-2.1'],
    'bd-3.3': ['bd-3.2', 'bd-2.3'],
    'bd-3.4': ['bd-3.2'],
    'bd-4.1': ['bd-3.2', 'md-3.2'],
    'bd-4.2': ['bd-3.2', 'bd-2.4'],
    'bd-4.3': ['bd-4.2', 'bd-2.6'],
    'bd-5.3': ['bd-3.1', 'cd-3.2'],
    'bd-5.1': ['bd-5.3', 'bd-3.2'],
    'bd-5.2': ['bd-5.3', 'bd-4.2'],
    // ---- VL10 Động lực học ----
    'dlh-1.2': ['dlh-1.1'],
    'dlh-1.3': ['dlh-1.1'],
    'dlh-1.4': ['dlh-1.3', 'dlh-1.2'],
    'dlh-2.1': ['dlh-1.3'],
    'dlh-2.2': ['dlh-2.1'],
    'dlh-2.3': ['dlh-2.1', 'cd-3.2'],
    'dlh-3.1': ['dlh-2.1', 'bd-1.1'],
    'dlh-3.2': ['dlh-3.1'],
    'dlh-3.3': ['dlh-3.2', 'bd-2.1'],
    'dlh-3.4': ['dlh-3.2', 'dlh-1.1'],
    'dlh-4.1': ['dlh-2.1'],
    'dlh-4.2': ['dlh-4.1', 'dlh-1.3'],
    'dlh-4.3': ['dlh-4.1', 'dlh-3.2'],
    'dlh-5.1': ['dlh-3.1', 'bd-3.1'],
    'dlh-5.2': ['dlh-5.1'],
    'dlh-5.3': ['dlh-5.2', 'dlh-1.4'],
    'dlh-5.4': ['dlh-5.2', 'dlh-3.3'],
    'dlh-6.1': ['dlh-3.1'],
    'dlh-6.2': ['dlh-6.1', 'dlh-3.4'],
    'dlh-6.3': ['dlh-6.2', 'dlh-1.2'],
    'dlh-6.4': ['dlh-6.2', 'dlh-1.2'],
    'dlh-6.5': ['dlh-6.2', 'dlh-5.4'],
    'dlh-7.1': ['dlh-3.4'],
    'dlh-7.2': ['dlh-5.1'],
    'dlh-7.3': ['dlh-7.2', 'dlh-1.3'],
    'dlh-7.4': ['dlh-7.2'],
    // ---- VL11 Dao động ----
    'k11-1.2': ['k11-1.1'],
    'k11-1.3': ['k11-1.1'],
    'k11-1.4': ['k11-1.3'],
    'k11-1.5': ['k11-1.4', 'cd-2.1'],
    'k11-1.6': ['k11-1.4'],
    'k11-2.1': ['k11-1.4'],
    'k11-2.2': ['k11-1.1'],
    'k11-2.3': ['k11-2.2'],
    'k11-2.4': ['k11-2.3'],
    'k11-2.5': ['k11-1.4'],
    'k11-2.6': ['k11-2.5'],
    'k11-2.7': ['k11-2.1', 'k11-2.4', 'k11-2.5'],
    'k11-2.8': ['k11-2.7', 'k11-1.6'],
    'k11-2.9': ['k11-2.8', 'cd-3.1'],
    'k11-2.10': ['k11-2.6', 'k11-2.8'],
    'k11-3.1': ['k11-1.4'],
    'k11-3.2': ['k11-3.1'],
    'k11-3.3': ['k11-3.1'],
    'k11-3.4': ['k11-3.3'],
    'k11-3.5': ['k11-3.3', 'dlh-3.1'],
    'k11-3.6': ['k11-3.1', 'k11-3.3'],
    'k11-3.7': ['k11-3.2', 'k11-3.4', 'k11-2.7'],
    'k11-4.1': ['k11-1.2'],
    'k11-4.2': ['k11-3.5'],
    'k11-4.3': ['k11-4.2', 'k11-2.4'],
    'k11-4.4': ['k11-3.5', 'dlh-5.2'],
    'k11-4.5': ['k11-4.4', 'k11-2.4'],
    'k11-4.6': ['k11-4.3'],
    'k11-4.7': ['k11-4.6', 'k11-2.8'],
    'k11-4.8': ['k11-4.2', 'k11-4.6'],
    'k11-4.9': ['k11-4.4', 'dlh-5.2'],
    'k11-4.10': ['k11-4.5'],
    'k11-5.1': ['k11-3.1'],
    'k11-5.2': ['k11-1.4'],
    'k11-5.3': ['k11-5.1', 'k11-5.2'],
    'k11-5.4': ['k11-5.1', 'k11-5.2'],
    'k11-5.5': ['k11-5.4', 'k11-4.3'],
    'k11-5.6': ['k11-5.4', 'k11-4.5'],
    'k11-6.1': ['k11-1.2', 'k11-5.4'],
    'k11-6.2': ['k11-6.1'],
    'k11-6.3': ['k11-6.1'],
    'k11-6.4': ['k11-6.1', 'k11-4.1'],
    'k11-6.5': ['k11-6.4'],
    'k11-6.6': ['k11-6.5'],
    'k11-6.7': ['k11-6.1', 'k11-5.5'],
    'k11-6.8': ['k11-6.5'],
    'k11-7.1': ['k11-5.5', 'k11-5.6'],
    'k11-7.2': ['k11-7.1', 'k11-2.8'],
    'k11-7.3': ['k11-7.1', 'k11-5.3'],
    // ---- VL11 Sóng ----
    's11-1.1': ['k11-1.1'],
    's11-1.2': ['s11-1.1', 'k11-2.4'],
    's11-1.3': ['s11-1.2'],
    's11-1.4': ['s11-1.2', 'k11-1.3'],
    's11-1.5': ['s11-1.1'],
    's11-1.6': ['s11-1.3', 'k11-2.6'],
    's11-1.7': ['s11-1.3'],
    's11-1.8': ['s11-1.4'],
    's11-1.9': ['s11-1.6'],
    's11-1.10': ['s11-1.5'],
    's11-2.1': ['s11-1.1'],
    's11-2.2': ['s11-1.1'],
    's11-2.3': ['s11-2.1', 's11-2.2', 's11-1.5'],
    's11-2.4': ['s11-2.2'],
    's11-2.5': ['s11-2.4'],
    's11-2.6': ['s11-2.4', 's11-1.3'],
    's11-3.1': ['s11-1.4'],
    's11-3.2': ['s11-3.1', 's11-2.4'],
    's11-4.1': ['s11-2.1'],
    's11-4.2': ['s11-4.1'],
    's11-4.3': ['s11-4.2'],
    's11-4.4': ['s11-4.1', 's11-1.3'],
    's11-5.1': ['s11-1.6'],
    's11-5.2': ['s11-5.1'],
    's11-5.3': ['s11-5.1', 's11-4.2'],
    's11-5.4': ['s11-5.3'],
    's11-5.5': ['s11-5.2'],
    's11-5.6': ['s11-5.5', 's11-1.9'],
    's11-5.7': ['s11-5.4'],
    's11-5.8': ['s11-5.7'],
    's11-5.9': ['s11-5.8'],
    's11-6.1': ['s11-1.1'],
    's11-6.2': ['s11-6.1'],
    's11-6.3': ['s11-6.2'],
    's11-6.4': ['s11-6.2'],
    's11-6.5': ['s11-6.4', 's11-2.4'],
    's11-6.6': ['s11-6.3', 's11-6.4', 's11-1.3'],
    's11-6.7': ['s11-6.6', 's11-1.6'],
    's11-7.1': ['s11-6.5', 's11-1.3'],
    's11-7.2': ['s11-7.1', 'md-3.2'],
    // ---- VL11 Điện trường ----
    'dt11-1.2': ['dt11-1.1'],
    'dt11-1.3': ['dt11-1.1'],
    'dt11-1.4': ['dt11-1.2'],
    'dt11-1.5': ['dt11-1.1'],
    'dt11-1.6': ['dt11-1.3'],
    'dt11-1.7': ['dt11-1.6'],
    'dt11-1.8': ['dt11-1.4', 'dt11-1.5'],
    'dt11-1.9': ['dt11-1.6', 'dt11-1.7'],
    'dt11-1.10': ['dt11-1.9', 'dlh-1.1'],
    'dt11-1.11': ['dt11-1.10', 'dlh-1.3'],
    'dt11-1.12': ['dt11-1.10', 'dlh-5.3'],
    'dt11-2.1': ['dt11-1.6'],
    'dt11-2.2': ['dt11-2.1'],
    'dt11-2.3': ['dt11-2.2', 'dt11-1.6'],
    'dt11-2.4': ['dt11-2.2'],
    'dt11-2.5': ['dt11-2.3'],
    'dt11-2.6': ['dt11-2.1'],
    'dt11-2.7': ['dt11-2.3'],
    'dt11-2.8': ['dt11-2.5', 'dt11-2.7'],
    'dt11-2.9': ['dt11-2.8'],
    'dt11-2.10': ['dt11-2.7', 'dlh-1.4'],
    'dt11-3.1': ['dt11-2.6'],
    'dt11-3.2': ['dt11-3.1'],
    'dt11-3.3': ['dt11-3.1', 'dt11-2.2'],
    'dt11-3.4': ['dt11-3.3', 'bd-5.1'],
    'dt11-3.5': ['dt11-3.3'],
    'dt11-3.6': ['dt11-3.2'],
    'dt11-3.7': ['dt11-3.3', 'dlh-3.3'],
    'dt11-3.8': ['dt11-3.4', 'dt11-3.6'],
    'dt11-4.1': ['dt11-3.1', 'dt11-2.2'],
    'dt11-4.2': ['dt11-4.1'],
    'dt11-4.3': ['dt11-4.1'],
    'dt11-4.4': ['dt11-4.2'],
    'dt11-5.1': ['dt11-4.2'],
    'dt11-5.2': ['dt11-5.1'],
    'dt11-5.3': ['dt11-5.2', 'dt11-3.2'],
    'dt11-5.4': ['dt11-5.2'],
    'dt11-5.5': ['dt11-5.3'],
    'dt11-5.6': ['dt11-5.4', 'dt11-4.4'],
    'dt11-6.1': ['dt11-2.1'],
    'dt11-6.2': ['dt11-1.1'],
    'dt11-6.3': ['dt11-6.2', 'dt11-6.1'],
    'dt11-6.4': ['dt11-6.3'],
    'dt11-6.5': ['dt11-6.3', 'dt11-5.2'],
    'dt11-6.6': ['dt11-6.5'],
    'dt11-6.7': ['dt11-6.4', 'dt11-6.5'],
    'dt11-6.8': ['dt11-6.7'],
    'dt11-7.1': ['dt11-6.3'],
    'dt11-7.2': ['dt11-7.1'],
    'dt11-7.3': ['dt11-7.1', 'dt11-6.6'],
    'dt11-7.4': ['dt11-7.3'],
    // ---- VL11 Dòng điện ----
    'dd11-1.1': ['dt11-1.1'],
    'dd11-1.2': ['dd11-1.1'],
    'dd11-1.3': ['dd11-1.1'],
    'dd11-1.4': ['dd11-1.3', 'dd11-1.2'],
    'dd11-1.5': ['dd11-1.3', 'dt11-1.5'],
    'dd11-1.6': ['dd11-1.4'],
    'dd11-2.1': ['dd11-1.3'],
    'dd11-2.2': ['dd11-2.1'],
    'dd11-2.3': ['dd11-2.1', 'dt11-5.2'],
    'dd11-2.4': ['dd11-2.3'],
    'dd11-2.5': ['dd11-2.1', 'dd11-1.2'],
    'dd11-2.6': ['dd11-2.5'],
    'dd11-2.7': ['dd11-2.1'],
    'dd11-2.8': ['dd11-2.2'],
    'dd11-2.9': ['dd11-2.3', 'dd11-2.4'],
    'dd11-2.10': ['dd11-2.3'],
    'dd11-2.11': ['dd11-2.10'],
    'dd11-3.1': ['dd11-1.1'],
    'dd11-3.2': ['dd11-3.1', 'dt11-4.1'],
    'dd11-3.3': ['dd11-3.2', 'dd11-2.3'],
    'dd11-3.4': ['dd11-3.3'],
    'dd11-3.5': ['dd11-3.2'],
    'dd11-3.6': ['dd11-3.3', 'dd11-2.10'],
    'dd11-3.7': ['dd11-3.6'],
    'dd11-3.8': ['dd11-3.4', 'dd11-3.6'],
    'dd11-3.9': ['dd11-3.6', 'dt11-6.5'],
    'dd11-4.1': ['dd11-1.3', 'dt11-5.2'],
    'dd11-4.2': ['dd11-4.1'],
    'dd11-4.3': ['dd11-4.2', 'dd11-2.3'],
    'dd11-4.4': ['dd11-3.3', 'dd11-4.2'],
    'dd11-4.5': ['dd11-3.3', 'md-3.2'],
    'dd11-4.6': ['dd11-4.1'],
    'dd11-4.7': ['dd11-4.3'],
    'dd11-4.8': ['dd11-4.4'],
    'dd11-4.9': ['dd11-4.8'],
    'dd11-4.10': ['dd11-4.9']
  };
  var prereqEdits = {};   // id -> mảng id (thầy chỉnh)
  var PREREQ = {};        // đồ thị hiệu lực = seed, rồi ghi đè bằng prereqEdits
  function validPrereqList(id, list){
    var seen = {}, out = [];
    (list || []).forEach(function(p){
      p = String(p || '').toLowerCase();
      if(p && p !== id && getNano(p) && !seen[p]){ seen[p] = 1; out.push(p); }
    });
    return out;
  }
  // p có là tổ tiên (trực tiếp/gián tiếp) tiên quyết của id không, theo đồ thị graph?
  function reachesIn(graph, from, target, guard){
    var stack = [from], seen = {};
    while(stack.length){
      var u = stack.pop();
      if(u === target) return true;
      if(seen[u]) continue; seen[u] = 1;
      (graph[u] || []).forEach(function(v){ stack.push(v); });
    }
    return false;
  }
  function rebuildPrereq(){
    // Thứ tự ưu tiên: (1) quan hệ seed của các nano-point CHƯA bị thầy sửa (đã kiểm tra không vòng) được giữ nguyên;
    // (2) cạnh do thầy sửa được thêm lần lượt — cạnh nào tạo vòng lặp thì BỎ CHÍNH CẠNH ĐÓ (không bao giờ bỏ nhầm
    // quan hệ có sẵn của nano-point khác). Admin đã chặn tạo vòng ngay lúc sửa; đây là lớp bảo vệ cuối.
    var out = {}, dropped = [];
    Object.keys(PREREQ_SEED).forEach(function(id){
      if(!Object.prototype.hasOwnProperty.call(prereqEdits, id)) out[id] = validPrereqList(id, PREREQ_SEED[id]);
    });
    Object.keys(prereqEdits).sort().forEach(function(id){
      out[id] = [];
      validPrereqList(id, prereqEdits[id]).forEach(function(p){
        if(reachesIn(out, p, id)) dropped.push(id + ' <- ' + p);   // p đã (gián tiếp) cần id -> thêm cạnh này sẽ thành vòng
        else out[id].push(p);
      });
    });
    PREREQ = out;
    return dropped;
  }
  function setPrereqEdits(entries){
    prereqEdits = {};
    (entries || []).forEach(function(e){
      if(e && e.id && Array.isArray(e.prereqs)) prereqEdits[String(e.id).toLowerCase()] = e.prereqs.slice();
    });
    return rebuildPrereq();
  }
  function getPrereqEdits(){
    return Object.keys(prereqEdits).map(function(id){ return { id: id, prereqs: prereqEdits[id].slice() }; });
  }
  function getPrereqs(id){ return (PREREQ[id] || []).filter(function(p){ return !!getNano(p); }); }
  function getPrereqSeed(id){ return validPrereqList(id, PREREQ_SEED[id] || []); }
  function isPrereqEdited(id){ return Object.prototype.hasOwnProperty.call(prereqEdits, id); }
  // nano-point nào cần id làm nền (ngược lại của getPrereqs)
  function getDependents(id){
    var out = [];
    Object.keys(PREREQ).forEach(function(k){ if(PREREQ[k].indexOf(id) > -1) out.push(k); });
    return out;
  }
  // Thêm cạnh id <- p có tạo vòng không?
  function wouldCreateCycle(id, p){
    if(id === p) return true;
    return reachesIn(PREREQ, p, id);
  }
  // Toàn bộ tổ tiên (thứ tự gần -> xa), tối đa maxDepth bước
  function getPrereqChain(id, maxDepth){
    var out = [], seen = {}, frontier = [id], d = 0;
    seen[id] = 1;
    while(frontier.length && d < (maxDepth || 3)){
      var next = [];
      frontier.forEach(function(u){
        getPrereqs(u).forEach(function(p){ if(!seen[p]){ seen[p] = 1; out.push(p); next.push(p); } });
      });
      frontier = next; d++;
    }
    return out;
  }
  // TÌM GỐC LỖI: từ nano-point nanoId mà em đang yếu, đi NGƯỢC theo quan hệ tiên quyết tới nano-point nền tảng đáng
  // luyện trước. Trả { rootId, path:[nanoId,…,rootId], reason:'self'|'weak'|'probe' }.
  //  - Chỉ truy gốc khi nanoId ĐÃ có số liệu và < weakBelow (mặc định 50 = vùng Đỏ). Chưa có số liệu -> 'self'.
  //  - Mỗi bước: nếu có tiên quyết ĐÃ có số liệu và < weakBelow -> đi tới cái thấp nhất ('weak').
  //  - Nếu không có cái nào yếu nhưng nano-point hiện tại yếu rõ (≤ probeAtMost, mặc định 40) mà còn tiên quyết CHƯA CÓ
  //    số liệu -> dừng ở nền tảng "ít tiên quyết nhất" trong số đó để KIỂM TRA THỬ ('probe').
  //  - Tối đa maxDepth bước (mặc định 3), có chống vòng lặp; bỏ qua nano-point mà hasQuestions(id) trả false
  //    (ví dụ chưa có câu hỏi trong ngân hàng để luyện).
  function findRootCause(nanoId, nanoMastery, hasQuestions, opts){
    opts = opts || {};
    var weakBelow = opts.weakBelow != null ? opts.weakBelow : 50;
    var probeAtMost = opts.probeAtMost != null ? opts.probeAtMost : 40;
    var maxDepth = opts.maxDepth != null ? opts.maxDepth : 3;
    var ok = hasQuestions || function(){ return true; };
    nanoMastery = nanoMastery || {};
    var res = { rootId: nanoId, path: [nanoId], reason: 'self' };
    var m0 = nanoMastery[nanoId];
    if(typeof m0 !== 'number' || m0 >= weakBelow) return res;
    var cur = nanoId, seen = {};
    seen[nanoId] = 1;
    for(var depth = 0; depth < maxDepth; depth++){
      var pres = getPrereqs(cur).filter(function(p){ return !seen[p]; });
      var weak = pres.filter(function(p){ return typeof nanoMastery[p] === 'number' && nanoMastery[p] < weakBelow && ok(p); });
      if(weak.length){
        weak.sort(function(a, b){ return nanoMastery[a] - nanoMastery[b]; });
        cur = weak[0]; seen[cur] = 1; res.path.push(cur); res.reason = 'weak';
        continue;
      }
      var curM = nanoMastery[cur];
      if(typeof curM === 'number' && curM <= probeAtMost){
        var unk = pres.filter(function(p){ return typeof nanoMastery[p] !== 'number' && ok(p); });
        if(unk.length){
          unk.sort(function(a, b){ return getPrereqs(a).length - getPrereqs(b).length; });
          cur = unk[0]; res.path.push(cur); res.reason = 'probe';
        }
      }
      break;
    }
    res.rootId = cur;
    return res;
  }

  function graphStats(){
    var ids = Object.keys(PREREQ).filter(function(k){ return PREREQ[k].length; });
    return { nodesWithPrereq: ids.length, edges: ids.reduce(function(a, k){ return a + PREREQ[k].length; }, 0) };
  }
  rebuildPrereq();

  function suggestForParsedQuestion(q){
    var chuDe = findChuDeByText(q && q.chuDeLon);
    var bai = findBaiByText(q && q.dangBai, chuDe ? chuDe.key : null) || findBaiByText(q && q.dangBai, null);
    if(!bai) return { chuDe: chuDe, bai: null, nanoOptions: [], confident: false };
    return { chuDe: getChuDe(bai.chuDeKey), bai: bai, nanoOptions: getNanoByBai(bai.key), confident: true };
  }

  window.OPC_NANO = {
    CHU_DE: CHU_DE,
    BAI: BAI,
    NANO: NANO,
    getChuDe: getChuDe,
    getBai: getBai,
    resolveBaiKey: resolveBaiKey,
    getNano: getNano,
    getNanoByBai: getNanoByBai,
    getBaiByChuDe: getBaiByChuDe,
    findChuDeByText: findChuDeByText,
    findBaiByText: findBaiByText,
    suggestForParsedQuestion: suggestForParsedQuestion,
    setExtra: setExtra,
    getExtraItems: getExtraItems,
    isValidNanoId: isValidNanoId,
    nextNanoId: nextNanoId,
    parseIdList: parseIdList,
    suggestNanos: suggestNanos,
    // quan hệ tiên quyết (6/10/2026)
    getPrereqs: getPrereqs,
    getPrereqSeed: getPrereqSeed,
    getPrereqChain: getPrereqChain,
    getDependents: getDependents,
    getPrereqEdits: getPrereqEdits,
    setPrereqEdits: setPrereqEdits,
    isPrereqEdited: isPrereqEdited,
    wouldCreateCycle: wouldCreateCycle,
    findRootCause: findRootCause,
    graphStats: graphStats
  };

})(window);
