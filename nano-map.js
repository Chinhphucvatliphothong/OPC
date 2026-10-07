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
      aliases:['luong tu','quang dien','luong tinh song hat','quang pho vach','vung nang luong'] }
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
    { key:'cd3-4', chuDeKey:'cd3-luongtu', name:'Bài 12: Vùng năng lượng của tinh thể chất rắn' }
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
    { id:'cd3-4.3', baiKey:'cd3-4', name:'Ảnh hưởng của nhiệt độ, pha tạp đến tính dẫn điện của chất bán dẫn' }
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
  function getBai(baiKey){
    for(var i=0;i<BAI.length;i++){ if(BAI[i].key===baiKey) return BAI[i]; }
    return null;
  }
  function getNano(nanoId){
    for(var i=0;i<NANO.length;i++){ if(NANO[i].id===nanoId) return NANO[i]; }
    return null;
  }
  function getNanoByBai(baiKey){
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
      var baiKey = it.baiKey || id.split('.')[0];
      if(!getBai(baiKey)) return;
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
    'hn-5.3': ['hn-3.3', 'hn-2.2']
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
