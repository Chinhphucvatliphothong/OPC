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
  //    CHU_DE_LIST trong admin.html
  // ============================================================
  var CHU_DE = [
    { key:'nhiet',      name:'Vật lí nhiệt', fullName:'Vật lí nhiệt', icon:'🔥',
      aliases:['nhiet','vat li nhiet','vat ly nhiet'] },
    { key:'khi',        name:'Khí lí tưởng', fullName:'Khí lí tưởng', icon:'💨',
      aliases:['khi', 'khi li tuong', 'khi ly tuong'] },
    { key:'tu-truong',  name:'Từ trường', fullName:'Từ trường & Cảm ứng điện từ', icon:'🧲',
      aliases:['tu truong','cam ung dien tu','cam ung tu'] },
    { key:'hat-nhan',   name:'Vật lí hạt nhân', fullName:'Vật lí hạt nhân', icon:'⚛️',
      aliases:['hat nhan','vat li hat nhan','vat ly hat nhan','phong xa'] }
  ];

  // ============================================================
  // 2) "BÀI" — mức trung gian (giống subtopic hiện có trong
  //    prepscholar.js và dangBai bóc tách được từ tag .tex)
  // ============================================================
  var BAI = [
    { key:'nhiet-dl1',            chuDeKey:'nhiet', name:'Nội năng & Định luật I Nhiệt động lực học' },
    { key:'nhiet-dungrieng',      chuDeKey:'nhiet', name:'Nhiệt dung riêng & Nhiệt nóng chảy riêng' },
    { key:'nhiet-hoahoi',         chuDeKey:'nhiet', name:'Nhiệt hóa hơi & Hiệu suất bếp đun' },
    { key:'nhiet-noinangkhikhi',  chuDeKey:'nhiet', name:'Độ biến thiên nội năng khối khí' },

    { key:'khi-boyle',      chuDeKey:'khi', name:'Định luật Boyle (Đẳng nhiệt)' },
    { key:'khi-charles',    chuDeKey:'khi', name:'Định luật Charles & Khí thực nghiệm' },
    { key:'khi-clapeyron',  chuDeKey:'khi', name:'Phương trình trạng thái Clapeyron & Đồ thị chu trình' },
    { key:'khi-somol',      chuDeKey:'khi', name:'Số mol khí trong bình kín' },

    { key:'tt-luctu',            chuDeKey:'tu-truong', name:'Lực từ tác dụng lên đoạn dây dẫn' },
    { key:'tt-tuthong',          chuDeKey:'tu-truong', name:'Từ thông & Định luật Faraday' },
    { key:'tt-khungdayquay',     chuDeKey:'tu-truong', name:'Khung dây quay trong từ trường' },
    { key:'tt-sddchuyendong',    chuDeKey:'tu-truong', name:'Suất điện động cảm ứng trong đoạn dây chuyển động' },

    { key:'hn-caotao',           chuDeKey:'hat-nhan', name:'Cấu tạo hạt nhân & Độ hụt khối' },
    { key:'hn-nangluongrieng',   chuDeKey:'hat-nhan', name:'Năng lượng liên kết riêng & Độ bền vững' },
    { key:'hn-phongxa',          chuDeKey:'hat-nhan', name:'Định luật phóng xạ & Chu kỳ bán rã' },
    { key:'hn-heli',             chuDeKey:'hat-nhan', name:'Tính năng lượng liên kết của hạt Heli' }
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
  //   { id:'tt-luctu.1', baiKey:'tt-luctu', name:'...',
  //     videoUrl:'https://...',
  //     conceptCard:{ formula:'$F = BIL\\sin\\alpha$', note:'...', example:'...' } }
  var NANO = [
    { id:'nhiet-dl1.1', baiKey:'nhiet-dl1', name:'Quy ước dấu A, Q trong ΔU = A + Q' },
    { id:'nhiet-dl1.2', baiKey:'nhiet-dl1', name:'Nhận biết hệ nhận/tỏa nhiệt, nhận/sinh công' },
    { id:'nhiet-dl1.3', baiKey:'nhiet-dl1', name:'Tính ΔU từ A và Q đã biết' },

    { id:'nhiet-dungrieng.1', baiKey:'nhiet-dungrieng', name:'Công thức Q = mcΔt (nhiệt dung riêng)' },
    { id:'nhiet-dungrieng.2', baiKey:'nhiet-dungrieng', name:'Công thức Q = mλ (nhiệt nóng chảy riêng)' },
    { id:'nhiet-dungrieng.3', baiKey:'nhiet-dungrieng', name:'Phân biệt giai đoạn tăng nhiệt độ và giai đoạn chuyển thể' },

    { id:'nhiet-hoahoi.1', baiKey:'nhiet-hoahoi', name:'Công thức Q = mL (nhiệt hóa hơi riêng)' },
    { id:'nhiet-hoahoi.2', baiKey:'nhiet-hoahoi', name:'Tính hiệu suất H = Q có ích / Q toàn phần' },
    { id:'nhiet-hoahoi.3', baiKey:'nhiet-hoahoi', name:'Bài toán tổng hợp đun nóng + hoá hơi có hiệu suất' },

    { id:'nhiet-noinangkhikhi.1', baiKey:'nhiet-noinangkhikhi', name:'Công thức công của khí đẳng áp A = pΔV' },
    { id:'nhiet-noinangkhikhi.2', baiKey:'nhiet-noinangkhikhi', name:'Nội năng khí lí tưởng chỉ phụ thuộc nhiệt độ' },
    { id:'nhiet-noinangkhikhi.3', baiKey:'nhiet-noinangkhikhi', name:'Áp dụng ΔU = A + Q cho một khối khí' },

    { id:'khi-boyle.1', baiKey:'khi-boyle', name:'Phát biểu & công thức p1V1 = p2V2' },
    { id:'khi-boyle.2', baiKey:'khi-boyle', name:'Đọc đồ thị p–V dạng hyperbol của quá trình đẳng nhiệt' },
    { id:'khi-boyle.3', baiKey:'khi-boyle', name:'Bài toán 2 trạng thái áp dụng định luật Boyle' },

    { id:'khi-charles.1', baiKey:'khi-charles', name:'Phát biểu & công thức V1/T1 = V2/T2' },
    { id:'khi-charles.2', baiKey:'khi-charles', name:'Đổi đơn vị nhiệt độ K ⇄ °C khi áp dụng định luật' },
    { id:'khi-charles.3', baiKey:'khi-charles', name:'Đọc đồ thị V–T (đường thẳng) của quá trình đẳng áp' },

    { id:'khi-clapeyron.1', baiKey:'khi-clapeyron', name:'Phương trình trạng thái tổng quát pV/T = hằng số' },
    { id:'khi-clapeyron.2', baiKey:'khi-clapeyron', name:'Nhận diện & tính toán chu trình khép kín trên đồ thị p–V' },
    { id:'khi-clapeyron.3', baiKey:'khi-clapeyron', name:'Chuyển đổi cùng 1 quá trình giữa hệ trục p–V, p–T, V–T' },

    { id:'khi-somol.1', baiKey:'khi-somol', name:'Công thức pV = nRT' },
    { id:'khi-somol.2', baiKey:'khi-somol', name:'Tính số mol / khối lượng khí từ pV = nRT' },
    { id:'khi-somol.3', baiKey:'khi-somol', name:'Bài toán bình kín rò rỉ hoặc bơm thêm khí' },

    { id:'tt-luctu.1', baiKey:'tt-luctu', name:'Công thức lực từ F = BIL·sin(α)' },
    { id:'tt-luctu.2', baiKey:'tt-luctu', name:'Quy tắc bàn tay trái xác định chiều lực từ' },
    { id:'tt-luctu.3', baiKey:'tt-luctu', name:'Bài toán cân bằng lực (dây treo trong từ trường)' },

    { id:'tt-tuthong.1', baiKey:'tt-tuthong', name:'Công thức từ thông Φ = BS·cos(α)' },
    { id:'tt-tuthong.2', baiKey:'tt-tuthong', name:'Định luật Faraday: e = −ΔΦ/Δt' },
    { id:'tt-tuthong.3', baiKey:'tt-tuthong', name:'Định luật Lenz xác định chiều dòng điện cảm ứng' },

    { id:'tt-khungdayquay.1', baiKey:'tt-khungdayquay', name:'Suất điện động cực đại e0 = NBSω' },
    { id:'tt-khungdayquay.2', baiKey:'tt-khungdayquay', name:'Phương trình e(t) = E0·cos(ωt + φ)' },
    { id:'tt-khungdayquay.3', baiKey:'tt-khungdayquay', name:'Xác định vị trí khung dây khi e cực đại / cực tiểu / bằng 0' },

    { id:'tt-sddchuyendong.1', baiKey:'tt-sddchuyendong', name:'Công thức e = Bvl·sin(α) của thanh dẫn chuyển động' },
    { id:'tt-sddchuyendong.2', baiKey:'tt-sddchuyendong', name:'Quy tắc bàn tay phải xác định chiều dòng điện cảm ứng' },
    { id:'tt-sddchuyendong.3', baiKey:'tt-sddchuyendong', name:'Bài toán thanh trượt trên ray dẫn có điện trở' },

    { id:'hn-caotao.1', baiKey:'hn-caotao', name:'Ký hiệu hạt nhân, số proton (Z) và neutron (A−Z)' },
    { id:'hn-caotao.2', baiKey:'hn-caotao', name:'Công thức độ hụt khối Δm = Zmp + (A−Z)mn − m(hạt nhân)' },
    { id:'hn-caotao.3', baiKey:'hn-caotao', name:'Đơn vị khối lượng nguyên tử u và quy đổi u ⇄ MeV/c²' },

    { id:'hn-nangluongrieng.1', baiKey:'hn-nangluongrieng', name:'Công thức năng lượng liên kết Wlk = Δm·c²' },
    { id:'hn-nangluongrieng.2', baiKey:'hn-nangluongrieng', name:'Công thức năng lượng liên kết riêng Wlk/A' },
    { id:'hn-nangluongrieng.3', baiKey:'hn-nangluongrieng', name:'So sánh độ bền vững hạt nhân qua năng lượng liên kết riêng' },

    { id:'hn-phongxa.1', baiKey:'hn-phongxa', name:'Công thức số hạt nhân còn lại N = N0·2^(−t/T)' },
    { id:'hn-phongxa.2', baiKey:'hn-phongxa', name:'Công thức khối lượng còn lại m = m0·2^(−t/T)' },
    { id:'hn-phongxa.3', baiKey:'hn-phongxa', name:'Tính chu kỳ bán rã T từ dữ kiện độ phóng xạ / số hạt' },

    { id:'hn-heli.1', baiKey:'hn-heli', name:'Tính độ hụt khối cho phản ứng / hạt nhân cụ thể' },
    { id:'hn-heli.2', baiKey:'hn-heli', name:'Tính năng lượng toả ra ΔE = Δm·c² của phản ứng hạt nhân' },
    { id:'hn-heli.3', baiKey:'hn-heli', name:'So sánh năng lượng liên kết riêng giữa các hạt nhân trong phản ứng' }
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
