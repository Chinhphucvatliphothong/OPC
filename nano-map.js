/**
 * OPC Luyện Thi Vật Lí — Bản đồ kiến thức "nano" (mô hình Squirrel AI)
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
    { key:'nhiet-7', chuDeKey:'nhiet', name:'Bài 7: Bài tập về vật lí nhiệt' },

    // ---- Chương II: Khí lí tưởng (Bài 8-13) ----
    { key:'khi-1', chuDeKey:'khi', name:'Bài 8: Mô hình động học phân tử chất khí' },
    { key:'khi-2', chuDeKey:'khi', name:'Bài 9: Định luật Boyle' },
    { key:'khi-3', chuDeKey:'khi', name:'Bài 10: Định luật Charles' },
    { key:'khi-4', chuDeKey:'khi', name:'Bài 11: Phương trình trạng thái của khí lí tưởng' },
    { key:'khi-5', chuDeKey:'khi', name:'Bài 12: Áp suất khí theo mô hình động học phân tử' },
    { key:'khi-6', chuDeKey:'khi', name:'Bài 13: Bài tập về khí lí tưởng' },

    // ---- Chương III: Từ trường (Bài 14-20) ----
    { key:'tt-1', chuDeKey:'tu-truong', name:'Bài 14: Từ trường' },
    { key:'tt-2', chuDeKey:'tu-truong', name:'Bài 15: Lực từ tác dụng lên dây dẫn mang dòng điện. Cảm ứng từ' },
    { key:'tt-3', chuDeKey:'tu-truong', name:'Bài 16: Từ thông. Hiện tượng cảm ứng điện từ' },
    { key:'tt-4', chuDeKey:'tu-truong', name:'Bài 17: Máy phát điện xoay chiều' },
    { key:'tt-5', chuDeKey:'tu-truong', name:'Bài 18: Ứng dụng hiện tượng cảm ứng điện từ' },
    { key:'tt-6', chuDeKey:'tu-truong', name:'Bài 19: Điện từ trường. Mô hình sóng điện từ' },
    { key:'tt-7', chuDeKey:'tu-truong', name:'Bài 20: Bài tập về từ trường' },

    // ---- Chương IV: Vật lí hạt nhân (Bài 21-25) ----
    { key:'hn-1', chuDeKey:'hat-nhan', name:'Bài 21: Cấu trúc hạt nhân' },
    { key:'hn-2', chuDeKey:'hat-nhan', name:'Bài 22: Phản ứng hạt nhân và năng lượng liên kết' },
    { key:'hn-3', chuDeKey:'hat-nhan', name:'Bài 23: Hiện tượng phóng xạ' },
    { key:'hn-4', chuDeKey:'hat-nhan', name:'Bài 24: Công nghiệp hạt nhân' },
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
  // 3) NANO-POINT — đơn vị kiến thức nhỏ nhất, 3 điểm / Bài
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
    { id:'nhiet-1.1', baiKey:'nhiet-1', name:'Đặc điểm cấu trúc chất ở thể rắn, lỏng, khí (mô hình động học phân tử)' },
    { id:'nhiet-1.2', baiKey:'nhiet-1', name:'Nhận biết các quá trình chuyển thể: nóng chảy, đông đặc, hoá hơi, ngưng tụ' },
    { id:'nhiet-1.3', baiKey:'nhiet-1', name:'Giải thích hiện tượng chuyển thể qua lực tương tác phân tử' },

    { id:'nhiet-2.1', baiKey:'nhiet-2', name:'Khái niệm nội năng và các cách làm thay đổi nội năng' },
    { id:'nhiet-2.2', baiKey:'nhiet-2', name:'Quy ước dấu A, Q trong ΔU = A + Q' },
    { id:'nhiet-2.3', baiKey:'nhiet-2', name:'Vận dụng định luật I NĐLH tính ΔU, A hoặc Q' },

    { id:'nhiet-3.1', baiKey:'nhiet-3', name:'Thang nhiệt độ Celsius và Kelvin, công thức đổi T(K) = t(°C) + 273' },
    { id:'nhiet-3.2', baiKey:'nhiet-3', name:'Nguyên tắc hoạt động của các loại nhiệt kế thường gặp' },
    { id:'nhiet-3.3', baiKey:'nhiet-3', name:'Mối liên hệ giữa nhiệt độ và động năng phân tử' },

    { id:'nhiet-4.1', baiKey:'nhiet-4', name:'Công thức Q = mcΔt và ý nghĩa nhiệt dung riêng' },
    { id:'nhiet-4.2', baiKey:'nhiet-4', name:'Đọc bảng nhiệt dung riêng, so sánh khả năng hấp thụ nhiệt các chất' },
    { id:'nhiet-4.3', baiKey:'nhiet-4', name:'Bài toán cân bằng nhiệt cơ bản giữa 2 chất trao đổi nhiệt' },

    { id:'nhiet-5.1', baiKey:'nhiet-5', name:'Công thức nhiệt nóng chảy Q = λm' },
    { id:'nhiet-5.2', baiKey:'nhiet-5', name:'Phân biệt giai đoạn tăng nhiệt độ và giai đoạn nóng chảy trên đồ thị t–Q' },
    { id:'nhiet-5.3', baiKey:'nhiet-5', name:'Bài toán tổng hợp đun nóng tới nóng chảy hoàn toàn' },

    { id:'nhiet-6.1', baiKey:'nhiet-6', name:'Công thức nhiệt hoá hơi Q = Lm' },
    { id:'nhiet-6.2', baiKey:'nhiet-6', name:'Phân biệt bay hơi và sôi, các yếu tố ảnh hưởng tốc độ bay hơi' },
    { id:'nhiet-6.3', baiKey:'nhiet-6', name:'Bài toán tổng hợp đun nóng + hoá hơi có hiệu suất' },

    { id:'nhiet-7.1', baiKey:'nhiet-7', name:'Bài toán tổng hợp nhiều giai đoạn (tăng nhiệt độ – nóng chảy – hoá hơi)' },
    { id:'nhiet-7.2', baiKey:'nhiet-7', name:'Vẽ và đọc đồ thị nhiệt độ theo nhiệt lượng / thời gian' },
    { id:'nhiet-7.3', baiKey:'nhiet-7', name:'Bài toán cân bằng nhiệt có nhiều chất / nhiều thiết bị đun' },

    // ---- Chương II: Khí lí tưởng ----
    { id:'khi-1.1', baiKey:'khi-1', name:'Các giả thuyết của thuyết động học phân tử chất khí' },
    { id:'khi-1.2', baiKey:'khi-1', name:'Giải thích áp suất chất khí theo va chạm phân tử lên thành bình' },
    { id:'khi-1.3', baiKey:'khi-1', name:'Phân biệt khí lí tưởng và khí thực' },

    { id:'khi-2.1', baiKey:'khi-2', name:'Phát biểu và công thức p1V1 = p2V2 (đẳng nhiệt)' },
    { id:'khi-2.2', baiKey:'khi-2', name:'Đọc đồ thị p–V dạng hyperbol (đường đẳng nhiệt)' },
    { id:'khi-2.3', baiKey:'khi-2', name:'Bài toán 2 trạng thái áp dụng định luật Boyle' },

    { id:'khi-3.1', baiKey:'khi-3', name:'Phát biểu và công thức V1/T1 = V2/T2 (đẳng áp)' },
    { id:'khi-3.2', baiKey:'khi-3', name:'Đổi đơn vị nhiệt độ K ⇄ °C khi áp dụng định luật' },
    { id:'khi-3.3', baiKey:'khi-3', name:'Đọc đồ thị V–T (đường thẳng, quá trình đẳng áp)' },

    { id:'khi-4.1', baiKey:'khi-4', name:'Phương trình trạng thái tổng quát pV/T = hằng số' },
    { id:'khi-4.2', baiKey:'khi-4', name:'Phương trình Clapeyron–Mendeleev pV = nRT' },
    { id:'khi-4.3', baiKey:'khi-4', name:'Nhận diện & tính toán chu trình khép kín trên đồ thị p–V, p–T, V–T' },

    { id:'khi-5.1', baiKey:'khi-5', name:'Công thức áp suất chất khí theo mô hình động học phân tử' },
    { id:'khi-5.2', baiKey:'khi-5', name:'Động năng tịnh tiến trung bình phân tử tỉ lệ thuận nhiệt độ tuyệt đối' },
    { id:'khi-5.3', baiKey:'khi-5', name:'Liên hệ tốc độ căn quân phương phân tử với nhiệt độ và khối lượng mol' },

    { id:'khi-6.1', baiKey:'khi-6', name:'Bài toán bình kín rò rỉ hoặc bơm thêm khí' },
    { id:'khi-6.2', baiKey:'khi-6', name:'Bài toán tổng hợp nhiều quá trình biến đổi trạng thái liên tiếp' },
    { id:'khi-6.3', baiKey:'khi-6', name:'Tính số mol / khối lượng khí từ pV = nRT trong bài toán thực tế' },

    // ---- Chương III: Từ trường ----
    { id:'tt-1.1', baiKey:'tt-1', name:'Khái niệm từ trường, đường sức từ và các tính chất' },
    { id:'tt-1.2', baiKey:'tt-1', name:'Từ trường của nam châm thẳng/chữ U, dòng điện thẳng/tròn/ống dây' },
    { id:'tt-1.3', baiKey:'tt-1', name:'Quy tắc nắm tay phải xác định chiều đường sức từ' },

    { id:'tt-2.1', baiKey:'tt-2', name:'Công thức lực từ F = BIL·sin(α)' },
    { id:'tt-2.2', baiKey:'tt-2', name:'Quy tắc bàn tay trái xác định chiều lực từ' },
    { id:'tt-2.3', baiKey:'tt-2', name:'Bài toán cân bằng lực (dây treo trong từ trường)' },

    { id:'tt-3.1', baiKey:'tt-3', name:'Công thức từ thông Φ = BS·cos(α)' },
    { id:'tt-3.2', baiKey:'tt-3', name:'Định luật Faraday: e = −ΔΦ/Δt' },
    { id:'tt-3.3', baiKey:'tt-3', name:'Định luật Lenz xác định chiều dòng điện cảm ứng' },

    { id:'tt-4.1', baiKey:'tt-4', name:'Nguyên tắc tạo suất điện động xoay chiều (khung dây quay trong từ trường)' },
    { id:'tt-4.2', baiKey:'tt-4', name:'Suất điện động cực đại e0 = NBSω và phương trình e(t) = E0cos(ωt+φ)' },
    { id:'tt-4.3', baiKey:'tt-4', name:'Xác định vị trí khung dây khi e cực đại / cực tiểu / bằng 0' },

    { id:'tt-5.1', baiKey:'tt-5', name:'Nguyên lí hoạt động của bếp từ, phanh điện từ, loa điện động' },
    { id:'tt-5.2', baiKey:'tt-5', name:'Dòng điện Foucault (dòng điện xoáy) và ứng dụng / tác hại' },
    { id:'tt-5.3', baiKey:'tt-5', name:'Bài toán định tính về ứng dụng cảm ứng điện từ trong đời sống, kĩ thuật' },

    { id:'tt-6.1', baiKey:'tt-6', name:'Liên hệ điện trường biến thiên và từ trường biến thiên (điện từ trường)' },
    { id:'tt-6.2', baiKey:'tt-6', name:'Đặc điểm sóng điện từ: lan truyền trong chân không với tốc độ c, là sóng ngang' },
    { id:'tt-6.3', baiKey:'tt-6', name:'Thang sóng điện từ và ứng dụng theo từng vùng bước sóng' },

    { id:'tt-7.1', baiKey:'tt-7', name:'Bài toán tổng hợp lực từ + cảm ứng điện từ trên cùng hệ dây dẫn/khung dây' },
    { id:'tt-7.2', baiKey:'tt-7', name:'Bài toán thanh trượt trên ray dẫn có điện trở (suất điện động cảm ứng)' },
    { id:'tt-7.3', baiKey:'tt-7', name:'Đọc và phân tích đồ thị e(t), Φ(t) trong bài toán cảm ứng điện từ' },

    // ---- Chương IV: Vật lí hạt nhân ----
    { id:'hn-1.1', baiKey:'hn-1', name:'Kí hiệu hạt nhân, số proton (Z) và neutron (A−Z)' },
    { id:'hn-1.2', baiKey:'hn-1', name:'Lực hạt nhân và đặc điểm (tương tác mạnh, tầm tác dụng ngắn)' },
    { id:'hn-1.3', baiKey:'hn-1', name:'Đơn vị khối lượng nguyên tử u và quy đổi u ⇄ MeV/c²' },

    { id:'hn-2.1', baiKey:'hn-2', name:'Công thức độ hụt khối Δm = Zmp + (A−Z)mn − m(hạt nhân)' },
    { id:'hn-2.2', baiKey:'hn-2', name:'Công thức năng lượng liên kết Wlk = Δm·c² và năng lượng liên kết riêng Wlk/A' },
    { id:'hn-2.3', baiKey:'hn-2', name:'Định luật bảo toàn trong phản ứng hạt nhân (số khối, điện tích, năng lượng)' },

    { id:'hn-3.1', baiKey:'hn-3', name:'Công thức số hạt nhân/khối lượng còn lại N = N0·2^(−t/T), m = m0·2^(−t/T)' },
    { id:'hn-3.2', baiKey:'hn-3', name:'Các tia phóng xạ α, β, γ và đặc điểm mỗi loại' },
    { id:'hn-3.3', baiKey:'hn-3', name:'Tính chu kì bán rã T từ dữ kiện độ phóng xạ / số hạt / khối lượng' },

    { id:'hn-4.1', baiKey:'hn-4', name:'Phản ứng phân hạch, phản ứng nhiệt hạch và điều kiện phản ứng dây chuyền' },
    { id:'hn-4.2', baiKey:'hn-4', name:'Nguyên lí hoạt động của nhà máy điện hạt nhân (lò phản ứng)' },
    { id:'hn-4.3', baiKey:'hn-4', name:'Lợi ích và rủi ro của ứng dụng năng lượng hạt nhân, an toàn phóng xạ' },

    { id:'hn-5.1', baiKey:'hn-5', name:'Bài toán tổng hợp tính năng lượng toả ra / thu vào của phản ứng hạt nhân' },
    { id:'hn-5.2', baiKey:'hn-5', name:'So sánh độ bền vững hạt nhân qua năng lượng liên kết riêng' },
    { id:'hn-5.3', baiKey:'hn-5', name:'Bài toán kết hợp phóng xạ + năng lượng liên kết trong cùng 1 đề' },

    // ---- Chuyên đề 1: Dòng điện xoay chiều ----
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

    // ---- Chuyên đề 2: Một số ứng dụng vật lí trong chẩn đoán y học ----
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

    // ---- Chuyên đề 3: Vật lí lượng tử ----
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
  function findBaiByText(text, chuDeKey){
    if(!text) return null;
    var norm = stripDiacritics(text);
    var pool = chuDeKey ? getBaiByChuDe(chuDeKey) : BAI;
    var best = null, bestScore = 0;
    pool.forEach(function(b){
      var bn = stripDiacritics(b.name);
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
    suggestForParsedQuestion: suggestForParsedQuestion
  };

})(window);
