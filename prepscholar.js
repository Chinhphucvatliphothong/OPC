/**
 * FaradayAI Luyện Thi Vật Lí - PrepScholar Adaptive Learning Engine
 * Mô phỏng toàn diện cơ chế học thích ứng thông minh của PrepScholar:
 * 1. Đánh giá chẩn đoán & Đo lường năng lực (% Mastery theo chuyên đề)
 * 2. Luyện tập tập trung (Focused Drill) theo điểm yếu nhất
 * 3. Sổ tay câu sai & Lặp lại giãn cách (Adaptive Spaced Repetition)
 * 4. Thi thử bấm giờ chuẩn cấu trúc Bộ GD&ĐT (Phần I, II, III)
 * 5. Chấm điểm tức thì & Lời giải chi tiết từng bước (\loigiai)
 */

(function(window){
  'use strict';

  // defaultMastery: mốc trung lập dùng khi CHƯA có số liệu thật nào cho
  // chuyên đề đó (chỉ là lưới an toàn hiển thị, không phải nhận định trước
  // học sinh yếu/mạnh môn nào — giai đoạn thật hoàn toàn không còn số liệu
  // minh hoạ giả định sẵn "Vật lí hạt nhân luôn yếu nhất" như bản cũ).
  // warriorTitle: danh xưng gamification hiển thị ở thẻ Cấp độ/XP trên Trang
  // chủ (kiểu "Chiến Binh Nhiệt Học") khi chủ đề này đang là "chương hiện
  // tại" của học sinh — xem getCurrentChuDe bên dưới.
  // THÊM 25/9/2026: mở rộng từ 4 lên ĐÚNG 7 chủ đề khớp với nano-map.js
  // (CHU_DE) sau khi danh mục nano-point được cập nhật đủ sách Chuyên đề
  // Vật Lí 12 KNTT (Phase C, 24/9/2026) — trước đó CHU_DE_MAP ở đây là 1
  // bản sao RIÊNG, tách biệt với nano-map.js, quên cập nhật theo nên toàn
  // bộ mastery/"chương hiện tại"/gamification chỉ tính trên 4 chủ đề SGK
  // cũ, bỏ sót hoàn toàn 3 chuyên đề mới. Key PHẢI khớp đúng key trong
  // nano-map.js CHU_DE để 2 nơi luôn đồng bộ.
  var CHU_DE_MAP = {
    'nhiet': { name: 'Vật lí nhiệt', icon: '🔥', defaultMastery: 50, warriorTitle: 'Chiến Binh Nhiệt Học' },
    'khi': { name: 'Khí lí tưởng', icon: '💨', defaultMastery: 50, warriorTitle: 'Chiến Binh Khí Lí Tưởng' },
    'tu-truong': { name: 'Từ trường & Cảm ứng điện từ', icon: '🧲', defaultMastery: 50, warriorTitle: 'Chiến Binh Từ Trường' },
    'hat-nhan': { name: 'Vật lí hạt nhân', icon: '⚛️', defaultMastery: 50, warriorTitle: 'Chiến Binh Hạt Nhân' },
    'cd1-dxc': { name: 'Dòng điện xoay chiều (Chuyên đề)', icon: '🔌', defaultMastery: 50, warriorTitle: 'Chiến Binh Dòng Điện Xoay Chiều' },
    'cd2-yhoc': { name: 'Vật lí trong y học (Chuyên đề)', icon: '🫁', defaultMastery: 50, warriorTitle: 'Chiến Binh Y Học Vật Lí' },
    'cd3-luongtu': { name: 'Vật lí lượng tử (Chuyên đề)', icon: '✨', defaultMastery: 50, warriorTitle: 'Chiến Binh Lượng Tử' }
  };
  // Thứ tự chương trình học — dùng để xác định "chương hiện tại" (chủ đề
  // đầu tiên chưa đạt Xanh), giống 1 "mặt trận" học sinh đang chinh chiến.
  // 3 chuyên đề xếp SAU 4 chương SGK (thứ tự dạy thực tế phổ biến).
  var CHU_DE_ORDER = ['nhiet', 'khi', 'tu-truong', 'hat-nhan', 'cd1-dxc', 'cd2-yhoc', 'cd3-luongtu'];

  // Ngân hàng câu hỏi THẬT — nạp từ Firestore (collection "de_thi", qua
  // opc-live-data.js -> replaceQuestionBank()). Giai đoạn thật hoàn toàn
  // (từ 23/9/2026): không còn 16 câu hỏi minh hoạ cứng như trước — mảng
  // này CHỈ được điền bằng dữ liệu thật của giáo viên, bắt đầu trống.
  var QUESTION_BANK = [];

  // THÊM 28/9/2026 — KHOÁ/MỞ CHƯƠNG THEO HỌC SINH (xem curriculum.js).
  // ALL_QUESTIONS giữ TOÀN BỘ ngân hàng đề đã nạp; QUESTION_BANK (mảng mà
  // MỌI chức năng sinh đề bên dưới đọc: Drill, Diagnostic, Nano/Bài drill,
  // luyện thích ứng, Sổ tay câu sai, Thi thử...) chỉ còn đúng các câu thuộc
  // chương học sinh đã được mở. Câu chưa gắn chương (chuong == null) KHÔNG
  // BAO GIỜ lọt vào. Mặc định [] (chưa mở gì) cho tới khi trang học sinh
  // gọi setUnlockedChapters sau khi đọc xong cấu hình của em đó — tránh lộ
  // câu chương khoá trong khoảnh khắc chờ tải cấu hình.
  var ALL_QUESTIONS = [];
  var UNLOCKED_CHAPTERS = [];

  function applyChapterFilter(){
    QUESTION_BANK.length = 0;
    ALL_QUESTIONS.forEach(function(q){
      if(q && q.chuong && UNLOCKED_CHAPTERS.indexOf(q.chuong) > -1) QUESTION_BANK.push(q);
    });
  }

  function setUnlockedChapters(list){
    var C = window.OPC_CURRICULUM;
    UNLOCKED_CHAPTERS = C ? C.normalizeChapters(list) : (Array.isArray(list) ? list.slice() : []);
    applyChapterFilter();
    return UNLOCKED_CHAPTERS.slice();
  }

  // Chủ đề (key CHU_DE_MAP) có đang mở với học sinh hiện tại không. 3
  // chuyên đề ngoài 4 chương SGK không thuộc chương nào -> luôn khoá.
  function isTopicUnlocked(topicKey){
    var C = window.OPC_CURRICULUM;
    var n = C ? C.TOPIC_TO_CHUONG[topicKey] : null;
    return !!n && UNLOCKED_CHAPTERS.indexOf(n) > -1;
  }

  // Cấu trúc đề thi Vật lí THPT (GDPT 2018): Phần I 18 câu ABCD, Phần II 4
  // câu Đúng/Sai, Phần III 6 câu trả lời ngắn.
  var MOET_STRUCTURE = { I: 18, II: 4, III: 6 };
  var PART_LABELS = { I: 'Phần I (ABCD)', II: 'Phần II (Đúng/Sai)', III: 'Phần III (Trả lời ngắn)' };

  // Chọn "count" câu trong pool, ưu tiên PHỦ RỘNG nhiều Tag (nano-point)
  // khác nhau trước khi lặp lại Tag.
  function pickCoverage(pool, count){
    var seenNano = {};
    var picked = [];
    for(var i = 0; i < pool.length && picked.length < count; i++){
      var q = pool[i];
      var key = q.nanoId || ('_' + q.id);
      if(!seenNano[key]){ seenNano[key] = true; picked.push(q); }
    }
    if(picked.length < count){
      var pickedIds = {};
      picked.forEach(function(q){ pickedIds[q.id] = true; });
      for(var j = 0; j < pool.length && picked.length < count; j++){
        if(!pickedIds[pool[j].id]){ picked.push(pool[j]); pickedIds[pool[j].id] = true; }
      }
    }
    return picked;
  }

  function shuffled(arr){
    var a = arr.slice();
    for(var i = a.length - 1; i > 0; i--){
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Đếm số câu khả dụng theo từng Phần (chỉ trong chương đã mở) so với cấu
  // trúc 18/4/6 — trả về danh sách phần còn THIẾU và thiếu bao nhiêu câu.
  function getRollingExamShortages(){
    var out = [];
    Object.keys(MOET_STRUCTURE).forEach(function(part){
      var have = QUESTION_BANK.filter(function(q){ return q.part === part; }).length;
      var need = MOET_STRUCTURE[part];
      if(have < need) out.push({ part: part, label: PART_LABELS[part], need: need, have: have, missing: need - have });
    });
    return out;
  }

  // "Đề cuốn chiếu": giữ nguyên cấu trúc 18 ABCD + 4 Đúng/Sai + 6 trả lời
  // ngắn, CHỈ lấy câu thuộc chương đã mở. Nếu thiếu câu cho 1 phần bất kỳ
  // thì KHÔNG tạo đề (không mượn câu chương khác) — trả về ok:false kèm
  // shortages để giao diện báo rõ thiếu bao nhiêu câu.
  function createRollingExam(){
    var shortages = getRollingExamShortages();
    if(shortages.length) return { ok: false, questions: [], shortages: shortages, chapters: UNLOCKED_CHAPTERS.slice() };
    var questions = [];
    Object.keys(MOET_STRUCTURE).forEach(function(part){
      var pool = shuffled(QUESTION_BANK.filter(function(q){ return q.part === part; }));
      questions = questions.concat(pickCoverage(pool, MOET_STRUCTURE[part]));
    });
    return { ok: true, questions: questions, shortages: [], chapters: UNLOCKED_CHAPTERS.slice() };
  }

  // Thuật toán chấm điểm chuẩn Bộ Giáo Dục 2025:
  // - Phần I (Trắc nghiệm 4 chọn 1): 0.25đ / câu
  // - Phần II (Trắc nghiệm Đúng/Sai 4 ý): Đúng 1 ý: 0.1đ; Đúng 2 ý: 0.25đ; Đúng 3 ý: 0.5đ; Đúng 4 ý: 1.0đ
  // - Phần III (Trả lời ngắn): 0.25đ / câu
  function scoreExam(questions, answers){
    var totalMaxScore = 0;
    var totalEarnedScore = 0;
    var correctCount = 0;
    var perQuestionResults = [];
    var topicStats = {};

    Object.keys(CHU_DE_MAP).forEach(function(k){
      topicStats[k] = { total: 0, correct: 0, earnedScore: 0, maxScore: 0 };
    });

    questions.forEach(function(q, idx){
      var tStats = topicStats[q.topicKey] || { total: 0, correct: 0, earnedScore: 0, maxScore: 0 };
      tStats.total++;

      if(q.part === 'I'){
        var maxPt = 0.25;
        totalMaxScore += maxPt;
        tStats.maxScore += maxPt;
        var userChoice = answers[q.id];
        var isRight = (userChoice === q.correctKey);
        var earnedPt = isRight ? maxPt : 0;
        totalEarnedScore += earnedPt;
        tStats.earnedScore += earnedPt;
        if(isRight){ correctCount++; tStats.correct++; }

        perQuestionResults.push({
          qId: q.id,
          idx: idx + 1,
          part: 'I',
          isFullCorrect: isRight,
          earnedPt: earnedPt,
          maxPt: maxPt,
          userChoice: userChoice || 'Chưa chọn',
          correctKey: q.correctKey,
          question: q
        });
      } else if(q.part === 'II'){
        var maxPt = 1.0;
        totalMaxScore += maxPt;
        tStats.maxScore += maxPt;
        var userStmts = answers[q.id] || {};
        var correctStatements = 0;
        (q.statements || []).forEach(function(st){
          if(userStmts[st.key] !== undefined && userStmts[st.key] === st.isTrue){
            correctStatements++;
          }
        });
        var earnedPt = 0;
        if(correctStatements === 1) earnedPt = 0.1;
        else if(correctStatements === 2) earnedPt = 0.25;
        else if(correctStatements === 3) earnedPt = 0.5;
        else if(correctStatements === 4) earnedPt = 1.0;

        totalEarnedScore += earnedPt;
        tStats.earnedScore += earnedPt;
        var isFull = (correctStatements === (q.statements || []).length);
        if(isFull){ correctCount++; tStats.correct++; }

        perQuestionResults.push({
          qId: q.id,
          idx: idx + 1,
          part: 'II',
          isFullCorrect: isFull,
          earnedPt: earnedPt,
          maxPt: maxPt,
          correctSubCount: correctStatements,
          userStmts: userStmts,
          question: q
        });
      } else if(q.part === 'III'){
        var maxPt = 0.25;
        totalMaxScore += maxPt;
        tStats.maxScore += maxPt;
        var rawVal = answers[q.id];
        var isRight = false;
        // SỬA 28/9/2026: học sinh Việt Nam quen viết số thập phân bằng dấu
        // PHẨY (vd gõ "7,5") — trước đây chấm thẳng Number(rawVal) nên gặp
        // dấu phẩy là ra NaN, bị chấm SAI oan dù đáp số đúng. correctAnswer
        // phía admin đã tự quy đổi phẩy -> chấm khi nạp đề (xem
        // opc-live-data.js), nay chấm bài phía học sinh cũng quy đổi y hệt
        // để không phân biệt "," hay "." — coi cả 2 cách viết là một.
        var normalizedVal = (typeof rawVal === 'string') ? rawVal.trim().replace(',', '.') : rawVal;
        if(normalizedVal !== undefined && normalizedVal !== '' && !isNaN(Number(normalizedVal))){
          var num = Number(normalizedVal);
          var tol = q.tolerance || 0.05;
          isRight = Math.abs(num - q.correctAnswer) <= tol;
        }
        var earnedPt = isRight ? maxPt : 0;
        totalEarnedScore += earnedPt;
        tStats.earnedScore += earnedPt;
        if(isRight){ correctCount++; tStats.correct++; }

        perQuestionResults.push({
          qId: q.id,
          idx: idx + 1,
          part: 'III',
          isFullCorrect: isRight,
          earnedPt: earnedPt,
          maxPt: maxPt,
          userAnswer: rawVal,
          correctAnswer: q.correctAnswer,
          unit: q.unit || '',
          question: q
        });
      }
    });

    // Quy đổi ra thang điểm 10 chuẩn
    var scaledScore10 = totalMaxScore > 0 ? (totalEarnedScore / totalMaxScore) * 10 : 0;
    scaledScore10 = Math.round(scaledScore10 * 100) / 100;

    return {
      totalQuestions: questions.length,
      correctCount: correctCount,
      totalEarnedScore: Math.round(totalEarnedScore * 100) / 100,
      totalMaxScore: Math.round(totalMaxScore * 100) / 100,
      scaledScore10: scaledScore10,
      perQuestionResults: perQuestionResults,
      topicStats: topicStats
    };
  }

  // ============================================================
  // Bản đồ kiến thức "nano" (mô hình Squirrel AI) — dựa trên danh mục
  // chuẩn trong nano-map.js (window.OPC_NANO), nếu file đó đã được nạp.
  // Mỗi câu trong QUESTION_BANK được gắn 1 nano-point cụ thể (chọn theo
  // "Bài"/subtopic sẵn có + mức độ M1-M4 của câu, không cần sửa lại từng
  // câu thủ công).
  //
  // GIAI ĐOẠN THẬT HOÀN TOÀN (23/9/2026): đã bỏ hẳn getNanoMastery() —
  // hàm cũ suy ra mastery từng nano-point bằng hash(nanoId) trộn số ngẫu
  // nhiên quanh mức trung bình chuyên đề, khiến bản đồ kiến thức hiện %
  // cụ thể cho MỌI Tag dù học sinh chưa từng làm câu nào thuộc Tag đó —
  // nhìn như số liệu cá nhân hoá thật nhưng thực chất là bịa. Nay: Tag nào
  // CHƯA có lịch sử làm bài thật (không có trong realNanoMastery) trả về
  // mastery: null, isReal: false — phía UI (prepscholar-ui.js) hiển thị rõ
  // "Chưa kiểm tra" (màu xám) thay vì trộn lẫn vào thang đỏ/vàng/xanh.
  // ============================================================
  function buildKnowledgeMap(studentMasteryByTopic, realNanoMastery){
    if(!window.OPC_NANO) return [];
    realNanoMastery = realNanoMastery || {};
    return Object.keys(CHU_DE_MAP).map(function(topicKey){
      var topic = CHU_DE_MAP[topicKey];
      var base = (studentMasteryByTopic && studentMasteryByTopic[topicKey] != null) ? studentMasteryByTopic[topicKey] : topic.defaultMastery;
      var bais = window.OPC_NANO.getBaiByChuDe(topicKey).map(function(b){
        var nanos = window.OPC_NANO.getNanoByBai(b.key).map(function(n){
          var real = realNanoMastery[n.id];
          return { id: n.id, name: n.name, mastery: (real != null) ? real : null, isReal: real != null };
        });
        var tested = nanos.filter(function(n){ return n.isReal; });
        var avg = tested.length ? Math.round(tested.reduce(function(s, n){ return s + n.mastery; }, 0) / tested.length) : null;
        return { key: b.key, name: b.name, mastery: avg, nanos: nanos };
      });
      var testedBais = bais.filter(function(b){ return b.mastery != null; });
      var topicAvg = testedBais.length ? Math.round(testedBais.reduce(function(s, b){ return s + b.mastery; }, 0) / testedBais.length) : null;
      return { topicKey: topicKey, topicName: topic.name, icon: topic.icon, mastery: (topicAvg != null ? topicAvg : base), bais: bais };
    });
  }

  // ============================================================
  // CHỖ CẮM DỮ LIỆU THẬT (đã cắm): tổng hợp lịch sử làm bài thật (lưu qua
  // opc-live-data.js, mỗi lần Drill/Thi thử nộp bài) thành điểm dự đoán,
  // % thành thạo theo chuyên đề, % thành thạo theo nano-point, và Sổ tay
  // câu sai — thay cho toàn bộ số liệu minh hoạ trước đây.
  // ============================================================
  // ============================================================
  // RADAR NĂNG LỰC 5 CHIỀU + CẤP ĐỘ/XP (gamification) — 23/9/2026.
  // Cả 2 đều SUY RA TỰ ĐỘNG từ dữ liệu làm bài thật đã có sẵn (qId, level,
  // part, hasImage, nanoId... đã lưu trong wrongQuestions/rightQuestions
  // của mỗi attempt) — KHÔNG cần giáo viên gắn nhãn thủ công gì thêm khi
  // nạp đề, đúng theo lựa chọn của thầy khi được hỏi.
  //
  // 5 chiều Radar:
  //   Lý thuyết  = % đúng các câu mức M1 (Nhận biết)
  //   VDC        = % đúng các câu mức M4 (Vận dụng cao)
  //   Né bẫy TF  = % đúng các câu Phần II (mệnh đề Đúng/Sai — hay có bẫy)
  //   Đồ thị     = % đúng các câu có kèm hình ảnh minh hoạ (đồ thị/sơ đồ)
  //   Tính nhanh = so sánh THỜI GIAN LÀM BÀI THẬT với thời gian được cấp,
  //                trung bình trên các lượt có ghi thời gian
  // Chiều nào CHƯA có dữ liệu thật (0 câu thuộc diện đó, hoặc lượt làm bài
  // đều từ trước khi hệ thống bắt đầu ghi part/hasImage/thời gian) trả về
  // null — giao diện PHẢI hiển thị "Chưa đủ dữ liệu", không được bịa % mặc định.
  function computeRadar5(sorted){
    var acc = {
      lyThuyet: { right: 0, total: 0 },
      vdc: { right: 0, total: 0 },
      neBayTF: { right: 0, total: 0 },
      doThi: { right: 0, total: 0 }
    };
    function tally(q, correct){
      if(q.level === 'M1'){ acc.lyThuyet.total++; if(correct) acc.lyThuyet.right++; }
      if(q.level === 'M4'){ acc.vdc.total++; if(correct) acc.vdc.right++; }
      if(q.part === 'II'){ acc.neBayTF.total++; if(correct) acc.neBayTF.right++; }
      if(q.hasImage){ acc.doThi.total++; if(correct) acc.doThi.right++; }
    }
    var timeRatios = [];
    (sorted || []).forEach(function(a){
      (a.wrongQuestions || []).forEach(function(q){ tally(q, false); });
      (a.rightQuestions || []).forEach(function(q){ tally(q, true); });
      if(a.timeAllocatedSec > 0 && a.timeUsedSec > 0){
        timeRatios.push(a.timeAllocatedSec / a.timeUsedSec);
      }
    });
    function pct(a){ return a.total > 0 ? Math.round((a.right / a.total) * 100) : null; }
    var tinhNhanh = null;
    if(timeRatios.length){
      var avgRatio = timeRatios.reduce(function(s, r){ return s + r; }, 0) / timeRatios.length;
      // avgRatio ~1 = dùng đúng bằng thời gian được cấp ("đúng nhịp") -> ~70đ
      // mốc giữa; nhanh hơn (ratio>1) -> điểm cao hơn; chậm hơn -> thấp hơn.
      tinhNhanh = Math.max(0, Math.min(100, Math.round(avgRatio * 70)));
    }
    return { lyThuyet: pct(acc.lyThuyet), vdc: pct(acc.vdc), neBayTF: pct(acc.neBayTF), doThi: pct(acc.doThi), tinhNhanh: tinhNhanh };
  }

  // Cấp độ (Level) & Điểm kinh nghiệm (XP) — chỉ số phản ánh KHỐI LƯỢNG
  // luyện tập thật đã làm (không phải mastery/điểm số): +10 XP/câu làm
  // ĐÚNG, +2 XP/câu làm SAI (vẫn có công luyện), 2000 XP/cấp.
  var XP_PER_RIGHT = 10;
  var XP_PER_WRONG = 2;
  var XP_PER_LEVEL = 2000;
  function computeLevelXP(sorted){
    var totalXP = 0;
    (sorted || []).forEach(function(a){
      totalXP += (a.rightQuestions || []).length * XP_PER_RIGHT;
      totalXP += (a.wrongQuestions || []).length * XP_PER_WRONG;
    });
    return {
      totalXP: totalXP,
      level: Math.floor(totalXP / XP_PER_LEVEL) + 1,
      xpIntoLevel: totalXP % XP_PER_LEVEL,
      xpForNextLevel: XP_PER_LEVEL
    };
  }

  // "Chương hiện tại": chủ đề ĐẦU TIÊN theo thứ tự chương trình (CHU_DE_ORDER)
  // mà mastery chưa đạt Xanh (>=80%) — dùng làm danh xưng "Chiến Binh ..."
  // trên thẻ Cấp độ. Nếu cả 4 chủ đề đã Xanh, trả về chủ đề cuối cùng.
  function getCurrentChuDe(masteryByTopic){
    masteryByTopic = masteryByTopic || {};
    for(var i = 0; i < CHU_DE_ORDER.length; i++){
      var key = CHU_DE_ORDER[i];
      var m = masteryByTopic[key];
      if(m == null || m < MASTERY_GREEN_MIN) return key;
    }
    return CHU_DE_ORDER[CHU_DE_ORDER.length - 1];
  }

  function computeStudentStatsFromAttempts(attempts){
    var result = {
      mastery: {}, nanoMastery: {}, predicted: null, mistakeLog: [],
      radar5: { lyThuyet: null, vdc: null, neBayTF: null, doThi: null, tinhNhanh: null },
      levelXp: computeLevelXP([]),
      currentChuDe: getCurrentChuDe({}),
      // completedExamsCount/averageScore/highestScore: THÊM 23/9/2026 để
      // trang admin (Danh sách học sinh) hiển thị đúng số đề đã làm/điểm TB/
      // điểm cao nhất THẬT thay vì luôn = 0 — xem syncStudentStats trong
      // prepscholar-ui.js và calculateStudentKPIs trong admin.html.
      completedExamsCount: 0, averageScore: 0, highestScore: 0,
      // recentTrend: 'down'/'stable'/'up' — cảnh báo tự động cho giáo viên
      // (xem StudentsPanel trong admin.html) khi điểm học sinh tụt gần đây,
      // để giáo viên không phải tự rà bảng bằng mắt. THÊM 24/9/2026.
      recentTrend: null, recentAvgScore: null, priorAvgScore: null
    };
    attempts = attempts || [];
    if(!attempts.length) return result;

    var sorted = attempts.slice().sort(function(a, b){ return new Date(a.createdAt) - new Date(b.createdAt); });
    // THÊM 7/10/2026 — LƯỢT LÀM DỞ (partial:true): luyện thích ứng lưu tiến độ sau MỖI câu chấm, nên em thoát giữa chừng
    // vẫn còn dữ liệu. Lượt dở được tính cho mastery/nano-point, chuyên đề và Sổ tay câu sai (đó là câu em đã thật sự
    // làm), nhưng KHÔNG tính vào số đề đã làm, điểm TB/cao nhất, xu hướng, điểm dự đoán, Radar, XP (chưa nộp bài).
    // Khi em nộp bài, bản ghi cùng clientId ghi đè bản dở nên không bao giờ tính trùng.
    var finals = sorted.filter(function(a){ return !a.partial; });

    // Mastery theo chuyên đề: cộng dồn earnedScore/maxScore từ mọi lượt.
    var topicAgg = {};
    sorted.forEach(function(a){
      var ts = a.topicStats || {};
      Object.keys(ts).forEach(function(k){
        if(!topicAgg[k]) topicAgg[k] = { earned: 0, max: 0 };
        topicAgg[k].earned += Number(ts[k].earnedScore) || 0;
        topicAgg[k].max += Number(ts[k].maxScore) || 0;
      });
    });
    Object.keys(topicAgg).forEach(function(k){
      if(topicAgg[k].max > 0) result.mastery[k] = Math.round((topicAgg[k].earned / topicAgg[k].max) * 100);
    });

    // Mastery theo nano-point ("Tag") — thuật toán thích ứng kiểu Squirrel AI
    // do giáo viên yêu cầu: CỘNG/TRỪ điểm trực tiếp theo từng câu trả lời
    // (không phải tỉ lệ đúng/tổng như bản cũ):
    //   Đúng câu khó (M3/M4): Tag +25 · Đúng câu dễ (M1/M2): Tag +15 · Sai: Tag -20
    // Tag lần đầu được kiểm tra bắt đầu ở mức trung lập 50, luôn giới hạn
    // trong khoảng 0-100. Áp dụng cho MỌI lượt nộp bài (Kiểm tra đầu vào,
    // Drill, Thi thử, Ôn sổ tay câu sai) theo đúng thứ tự thời gian thật,
    // nên mastery luôn phản ánh phong độ GẦN NHẤT của học sinh.
    var nanoAgg = {};
    // SỬA 5/10/2026 — câu nhiều nano-point: tra THẺ HIỆN TẠI của câu trong ngân hàng (theo mã câu) trước, nên khi
    // thầy gắn lại/thêm nano-point thì mastery tính lại đúng cho cả lịch sử; không còn câu đó thì dùng nanoIds /
    // nanoId đã lưu cùng lượt làm.
    var bankById = {};
    QUESTION_BANK.forEach(function(bq){ bankById[bq.id] = bq; });
    function bump(rec, correct){
      var ids = nanoIdsOf(bankById[rec.qId]);
      if(!ids.length) ids = nanoIdsOf(rec);
      ids.forEach(function(nanoId){
        var cur = (nanoAgg[nanoId] != null) ? nanoAgg[nanoId] : MASTERY_NEUTRAL_START;
        nanoAgg[nanoId] = bumpNanoMastery(cur, correct, rec.level, ids.length);
      });
    }
    sorted.forEach(function(a){
      (a.wrongQuestions || []).forEach(function(q){ bump(q, false); });
      (a.rightQuestions || []).forEach(function(q){ bump(q, true); });
    });
    result.nanoMastery = nanoAgg;

    // SỬA 16/10/2026 — ĐIỂM DỰ ĐOÁN: trước đây = trung bình 5 lượt gần nhất (kể cả drill/luyện nhẹ) → thực chất là điểm TB.
    // Nay dùng mô hình predictExamScore (ước lượng xác suất đúng theo chuyên đề × mức độ, áp vào ma trận đề thi thật, có
    // khoảng điểm + độ tin cậy). Chưa đủ dữ liệu → predicted = null ("Chưa đủ dữ liệu"), không bịa số.
    var pr = predictExamScore(sorted, bankById);
    result.predicted = pr.predicted;
    result.prediction = pr;

    // Sổ tay câu sai + Lặp lại giãn cách (Spaced Repetition) — THÊM 25/9/2026:
    // nâng từ giãn cách đơn giản (luôn 1 ngày) lên đúng chu kỳ 4 mốc chuẩn
    // 1-3-7-14 ngày. Không có "log ôn tập" riêng (mỗi câu chỉ lưu 1 lần làm
    // sai/đúng gần nhất qua wrongQuestions/rightQuestions của mỗi lượt nộp
    // bài), nên mốc (tier) được suy ra từ SỐ LẦN LÀM SAI LIÊN TIẾP chưa được
    // sửa (wrongStreak): sai lần 1 -> hạn ôn sau 1 ngày; vẫn còn trong sổ mà
    // bị hỏi lại và lại sai (streak 2) -> hạn ôn giãn ra 3 ngày; streak 3 ->
    // 7 ngày; streak 4 trở lên -> 14 ngày (mốc xa nhất, giữ nguyên). Làm
    // đúng 1 lần là XOÁ khỏi sổ (reset streak về 0) — đúng tinh thần "đã
    // thuộc, không cần ôn nữa", không tăng dần độ khó thêm.
    var REVIEW_INTERVALS_DAYS = [1, 3, 7, 14];
    var lastWrong = {};
    var wrongStreak = {};
    sorted.forEach(function(a){
      (a.wrongQuestions || []).forEach(function(q){
        lastWrong[q.qId] = { q: q, at: a.createdAt };
        wrongStreak[q.qId] = (wrongStreak[q.qId] || 0) + 1;
      });
      (a.rightQuestions || []).forEach(function(q){ delete lastWrong[q.qId]; wrongStreak[q.qId] = 0; });
    });
    var now = Date.now();
    result.mistakeLog = Object.keys(lastWrong).map(function(qId){
      var info = lastWrong[qId];
      var daysSince = Math.floor((now - new Date(info.at).getTime()) / 86400000);
      var streak = wrongStreak[qId] || 1;
      var tier = Math.min(streak - 1, REVIEW_INTERVALS_DAYS.length - 1); // 0..3
      var intervalDays = REVIEW_INTERVALS_DAYS[tier];
      return {
        id: 'live_' + qId,
        qId: qId,
        topicKey: info.q.topicKey,
        topicName: info.q.topicName || '',
        title: info.q.subtopic || info.q.topicName || 'Câu hỏi',
        reason: tier > 0 ? ('Đã làm sai lặp lại lần ' + (tier + 1) + ' — giãn cách ' + intervalDays + ' ngày') : 'Đã làm sai trong lượt luyện gần đây',
        daysOverdue: Math.max(0, daysSince - intervalDays),
        dueNow: daysSince >= intervalDays, // true = đã đến/quá hạn ôn tập; false = còn "đang nghỉ" trong chu kỳ giãn cách, CHƯA nên nhắc/đưa vào đề
        daysSince: daysSince, // để UI tính được "còn bao nhiêu ngày nữa mới đến hạn" khi dueNow === false (intervalDays - daysSince)
        intervalDays: intervalDays,
        tier: tier, // 0-3, dùng bởi PersonalizedExamGeneratorPanel (admin.html) để ưu tiên câu trễ hạn nhất
        part: info.q.part || null, // THÊM để admin.html biết xếp câu ôn lại vào đúng Phần I/II/III khi trộn đề
        nanoId: info.q.nanoId
      };
    }).sort(function(a, b){ return b.daysOverdue - a.daysOverdue; });
    // THÊM 29/9/2026: tổng số câu sai CHƯA sửa (trước khi cắt còn 15 câu ưu
    // tiên cho Sổ tay) — để admin hiện đúng con số thật thay vì luôn "15".
    result.mistakeTotal = result.mistakeLog.length;
    result.mistakeLog = result.mistakeLog.slice(0, 15);

    result.radar5 = computeRadar5(finals);
    result.levelXp = computeLevelXP(finals);
    result.currentChuDe = getCurrentChuDe(result.mastery);

    // Đề đã làm / Điểm TB / Điểm cao nhất — tính trên MỌI lượt nộp bài thật
    // (Kiểm tra đầu vào, Drill, Thi thử, Luyện thích ứng, Đề được giao...),
    // không phân biệt loại, để khớp đúng nghĩa "Đề đã làm" trên trang admin.
    result.completedExamsCount = finals.length;
    var scoreVals = finals.map(function(a){ return Number(a.scaledScore10); }).filter(function(n){ return !isNaN(n); });
    if(scoreVals.length){
      result.averageScore = Math.round((scoreVals.reduce(function(s, n){ return s + n; }, 0) / scoreVals.length) * 10) / 10;
      result.highestScore = Math.max.apply(null, scoreVals);
    }

    // Xu hướng gần đây (recentTrend) — so sánh điểm TB của (tối đa) 3 lượt
    // gần nhất với 3 lượt trước đó (scoreVals đã theo đúng thứ tự thời gian
    // thật, cũ → mới, nhờ "sorted" ở trên). Cần ít nhất 4 lượt nộp bài có
    // điểm mới đủ dữ liệu để so sánh — tránh báo "tụt" chỉ vì 1-2 lượt đầu
    // chưa ổn định. Ngưỡng ±0.75 điểm/10 để tránh báo động giả vì dao động
    // nhỏ bình thường.
    if(scoreVals.length >= 4){
      var half = Math.min(3, Math.floor(scoreVals.length / 2));
      var recentHalf = scoreVals.slice(-half);
      var priorHalf = scoreVals.slice(-(half * 2), -half);
      if(priorHalf.length){
        var recentAvg = recentHalf.reduce(function(s, n){ return s + n; }, 0) / recentHalf.length;
        var priorAvg = priorHalf.reduce(function(s, n){ return s + n; }, 0) / priorHalf.length;
        result.recentAvgScore = Math.round(recentAvg * 10) / 10;
        result.priorAvgScore = Math.round(priorAvg * 10) / 10;
        var diff = recentAvg - priorAvg;
        result.recentTrend = diff <= -0.75 ? 'down' : (diff >= 0.75 ? 'up' : 'stable');
      }
    }

    return result;
  }

  // ============================================================
  // Phân loại Mastery theo Tag (nano-point) + khoá/mở "Bài" — dùng cho
  // Trang chủ Học sinh (Personal Dashboard): Xanh (>=80%) tự động khoá bài
  // đã vững, Vàng (50-79%) cần luyện thêm, Đỏ (<50%) mất gốc — đẩy remediation
  // (video ngắn + 5 bài tập) lên đầu.
  // ============================================================
  var MASTERY_NEUTRAL_START = 50;
  var MASTERY_GREEN_MIN = 80;
  var MASTERY_YELLOW_MIN = 50;
  function classifyMastery(val){
    if(val == null) return 'unknown';
    if(val >= MASTERY_GREEN_MIN) return 'green';
    if(val >= MASTERY_YELLOW_MIN) return 'yellow';
    return 'red';
  }

  // Công thức tăng/giảm Mastery 1 Tag (nano-point) theo 1 câu trả lời —
  // dùng CHUNG cho: tính lại từ lịch sử thật (computeStudentStatsFromAttempts),
  // cập nhật tức thì lúc nộp Drill/Thi thử (prepscholar-ui.js), và chọn câu
  // kế tiếp trong Luyện tập thích ứng thời gian thực (pickAdaptiveQuestion).
  // Gom về 1 chỗ để không bao giờ lệch công thức giữa 3 nơi dùng.
  // SỬA 5/10/2026 — tagCount (tuỳ chọn, mặc định 1): số nano-point gắn trên CÙNG câu hỏi. Câu đề thi thử của
  // trường/sở thường gộp 2-3 nano-point. Đúng -> mỗi nano-point được cộng đủ (câu đúng chứng tỏ đã vận dụng
  // cả hai). Sai -> chưa biết em hổng nano-point nào nên trừ CHIA SẺ: 1 nano -20, 2 nano -10 mỗi nano, 3 nano -8
  // mỗi nano (không dưới 8) — để không "phạt chồng" nhiều nano-point chỉ vì một câu sai.
  function bumpNanoMastery(current, correct, level, tagCount){
    var cur = (current != null) ? current : MASTERY_NEUTRAL_START;
    var n = (tagCount && tagCount > 1) ? tagCount : 1;
    var delta = correct ? ((level === 'M3' || level === 'M4') ? 25 : 15) : -Math.max(8, Math.round(20 / n));
    return Math.max(0, Math.min(100, cur + delta));
  }
  // THÊM 5/10/2026 — danh sách nano-point của 1 câu hỏi: ưu tiên mảng nanoIds (nhiều nano), rơi về nanoId cũ.
  function nanoIdsOf(q){
    if(!q) return [];
    if(q.nanoIds && q.nanoIds.length) return q.nanoIds;
    return q.nanoId ? [q.nanoId] : [];
  }
  // 2 câu "cùng kỹ năng" khi chung ít nhất 1 nano-point
  function shareNano(a, b){
    var x = nanoIdsOf(a), y = nanoIdsOf(b);
    for(var i = 0; i < x.length; i++){ if(y.indexOf(x[i]) > -1) return true; }
    return false;
  }

  // ============================================================
  // LUYỆN TẬP THÍCH ỨNG THỜI GIAN THỰC (CAT-lite, đúng kiểu Squirrel AI vận
  // hành thật): chọn NGAY 1 câu tiếp theo sau MỖI câu trả lời, dựa trên
  // mastery hiện tại của từng Tag — khác với Drill/Kiểm tra đầu vào (soạn
  // sẵn 1 danh sách câu cố định, chỉ cập nhật Mastery sau khi nộp cả bài).
  // Tag càng yếu càng được hỏi trước; độ khó câu hỏi (M1-M4) bám sát đúng
  // mức thành thạo hiện tại của Tag đó — yếu thì hỏi câu dễ để củng cố nền
  // tảng trước, khá hơn thì hỏi câu khó hơn để đẩy lên Xanh, giống hệt cách
  // Squirrel AI mô tả "next item chosen right after each answer".
  // nanoMastery: mastery hiện tại từng Tag (được truyền vào + cập nhật dần
  // ở phía UI qua bumpNanoMastery sau mỗi câu, không đợi vòng lưu Firestore).
  // askedIds: {qId: true} các câu ĐÃ hỏi trong lượt này — không lặp câu.
  // priorityOrder: (TUỲ CHỌN, thêm 24/9/2026) mảng nanoId theo thứ tự AI đã
  // suy luận nên ưu tiên (xem api/ai-adaptive-priority.js + startAdaptiveDrill
  // trong prepscholar-ui.js) — gọi 1 LẦN lúc bắt đầu lượt luyện, KHÔNG gọi
  // lại sau mỗi câu (để không làm chậm trải nghiệm làm bài thời gian thực).
  // Nếu không truyền, hoặc AI chưa kịp trả lời, hoặc không còn Tag nào
  // trong priorityOrder còn câu khả dụng, hàm TỰ ĐỘNG rơi về đúng thuật
  // toán cũ (sắp theo % thấp nhất) — không bao giờ chặn luồng làm bài.
  // ============================================================
  // ============================================================
  // THÊM 6/10/2026 — NHIỆM VỤ HÔM NAY (~10-15 phút) + CHUỖI NGÀY HỌC.
  // Mục tiêu: kéo em quay lại app giữa 2 buổi học bằng một "việc nhỏ, rõ, làm xong là xong". Không thêm dữ liệu
  // mới: dựng hoàn toàn từ Sổ tay câu sai (câu đến hạn ôn), Tag Đỏ (kèm gốc lỗi theo quan hệ tiên quyết) và lịch sử
  // lượt làm. "Đã xong hôm nay" suy ra từ loại lượt làm trong NGÀY (giờ máy của em): 'mistakes' = ôn sổ tay;
  // 'drill' = vá lỗi/luyện Tag; 'adaptive' = luyện thích ứng. (Chưa phân biệt được các kiểu 'drill' với nhau.)
  // Chuỗi ngày = số ngày liên tiếp có ít nhất 1 lượt làm, tính đến hôm nay (nếu hôm nay chưa làm thì tính đến hôm
  // qua — chuỗi vẫn "còn sống" cho tới hết hôm nay).
  // ============================================================
  var DAILY_ADAPTIVE_COUNT = 5;
  function toDateSafe(v){
    if(!v) return null;
    var d = (typeof v.toDate === 'function') ? v.toDate() : new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  function localDayKey(d){
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function computeStreakDays(attempts, now){
    now = now || new Date();
    var days = {};
    (attempts || []).forEach(function(a){ var d = toDateSafe(a && a.createdAt); if(d) days[localDayKey(d)] = true; });
    var cur = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    if(!days[localDayKey(cur)]) cur.setDate(cur.getDate() - 1);   // hôm nay chưa làm: chuỗi tính tới hôm qua
    var n = 0;
    while(days[localDayKey(cur)]){ n++; cur.setDate(cur.getDate() - 1); }
    return n;
  }
  // opts: { redTags:[…getRedTags, đã lọc chương đã mở], mistakeLog:[…], attempts:[…], now?:Date }
  function buildDailyPlan(opts){
    opts = opts || {};
    var now = opts.now || new Date();
    var attempts = opts.attempts || [];
    var todayKey = localDayKey(now);
    var typesToday = {};
    attempts.forEach(function(a){
      var d = toDateSafe(a && a.createdAt);
      if(d && localDayKey(d) === todayKey && a.type && !a.partial) typesToday[a.type] = true; // lượt làm dở không tính là xong nhiệm vụ
    });
    var plan = { streakDays: computeStreakDays(attempts, now), tasks: [], needsDiagnostic: false, totalMinutes: 0, doneCount: 0, allDone: false };
    if(!attempts.length){
      plan.needsDiagnostic = true;
      plan.tasks.push({ key: 'diagnostic', title: 'Làm bài kiểm tra đầu vào', sub: 'Để hệ thống biết em đang vững/yếu chỗ nào', minutes: 15, done: false });
      plan.totalMinutes = 15;
      return plan;
    }
    var due = (opts.mistakeLog || []).filter(function(m){ return m && m.dueNow; });
    if(due.length || typesToday.mistakes){
      var nDue = Math.min(due.length, 15);
      plan.tasks.push({ key: 'review', title: nDue ? ('Ôn ' + nDue + ' câu sai đã đến hạn') : 'Ôn Sổ tay câu sai', sub: 'Lặp lại giãn cách 1-3-7-14 ngày',
        minutes: Math.max(3, Math.ceil(nDue * 2.5)), n: nDue, done: !!typesToday.mistakes });
    }
    var red = (opts.redTags || [])[0];
    if(red || typesToday.drill){
      var targetNano = red, sub = '5 bài tập luyện Tag đang Đỏ';
      if(red && red.rootCause && red.rootCause.id){
        var rn = window.OPC_NANO && window.OPC_NANO.getNano(red.rootCause.id);
        if(rn){ targetNano = rn; sub = 'Nền tảng của "' + red.name + '" — gốc lỗi có thể nằm ở đây'; }
      }
      plan.tasks.push({ key: 'fix', title: targetNano ? ('Vá lỗi: ' + targetNano.name) : 'Vá lỗi kiến thức', sub: sub, minutes: 6,
        nanoId: targetNano ? targetNano.id : null, done: !!typesToday.drill });
    }
    plan.tasks.push({ key: 'adaptive', title: 'Luyện thích ứng ' + DAILY_ADAPTIVE_COUNT + ' câu', sub: 'Hệ thống tự chọn câu hợp với em', minutes: 7,
      count: DAILY_ADAPTIVE_COUNT, done: !!typesToday.adaptive });
    plan.doneCount = plan.tasks.filter(function(t){ return t.done; }).length;
    plan.totalMinutes = plan.tasks.filter(function(t){ return !t.done; }).reduce(function(a, t){ return a + t.minutes; }, 0);
    plan.allDone = plan.doneCount === plan.tasks.length;
    return plan;
  }

  var lastPickInfo = null;
  function pickAdaptiveQuestion(nanoMastery, askedIds, priorityOrder){
    lastPickInfo = null;
    if(!QUESTION_BANK.length) return null;
    nanoMastery = nanoMastery || {};
    askedIds = askedIds || {};

    var poolByNano = {};
    // SỬA 5/10/2026 — câu gắn nhiều nano-point nằm trong pool của TỪNG nano-point đó
    QUESTION_BANK.forEach(function(q){
      if(askedIds[q.id]) return;
      nanoIdsOf(q).forEach(function(nid){ (poolByNano[nid] || (poolByNano[nid] = [])).push(q); });
    });
    var availableNanoIds = Object.keys(poolByNano);
    if(!availableNanoIds.length) return null;

    // Tag chưa từng kiểm tra = mức trung lập 50 — không được ưu tiên hơn
    // Tag đã biết yếu thật (mastery thật < 50).
    availableNanoIds.sort(function(a, b){
      var va = nanoMastery[a] != null ? nanoMastery[a] : MASTERY_NEUTRAL_START;
      var vb = nanoMastery[b] != null ? nanoMastery[b] : MASTERY_NEUTRAL_START;
      return va - vb;
    });

    // Nếu có priorityOrder từ AI: ưu tiên Tag đầu tiên trong đó mà vẫn còn
    // câu khả dụng (chưa hỏi hết) — thay cho việc chỉ chọn theo số % thấp
    // nhất. Các Tag không nằm trong priorityOrder (ví dụ AI không được gửi
    // hết danh sách) vẫn dùng đúng thứ tự cũ làm phương án dự phòng.
    var targetNanoId = null;
    if(Array.isArray(priorityOrder) && priorityOrder.length){
      var availableSet = {};
      availableNanoIds.forEach(function(id){ availableSet[id] = true; });
      for(var i = 0; i < priorityOrder.length; i++){
        if(availableSet[priorityOrder[i]]){ targetNanoId = priorityOrder[i]; break; }
      }
    }
    if(!targetNanoId) targetNanoId = availableNanoIds[0];
    // THÊM 6/10/2026 — TÌM GỐC LỖI: nếu nano-point sắp luyện đã yếu rõ và có nano-point TIÊN QUYẾT cũng yếu (hoặc
    // chưa kiểm tra mà em đang yếu rõ), chuyển sang luyện nền tảng trước. Chỉ xét nano-point còn câu hỏi khả dụng.
    // Thông tin chuyển hướng lưu ở lastPickInfo để giao diện hiện "Đang kiểm tra nền tảng…".
    var rc = window.OPC_NANO && window.OPC_NANO.findRootCause
      ? window.OPC_NANO.findRootCause(targetNanoId, nanoMastery, function(id){ return !!(poolByNano[id] && poolByNano[id].length); },
          { weakBelow: MASTERY_YELLOW_MIN })
      : { rootId: targetNanoId, path: [targetNanoId], reason: 'self' };
    lastPickInfo = { requestedId: targetNanoId, targetId: rc.rootId, redirected: rc.rootId !== targetNanoId, path: rc.path, reason: rc.reason };
    targetNanoId = rc.rootId;
    var targetMastery = nanoMastery[targetNanoId] != null ? nanoMastery[targetNanoId] : MASTERY_NEUTRAL_START;

    var preferredLevels = targetMastery < MASTERY_YELLOW_MIN ? ['M1', 'M2'] :
      (targetMastery < MASTERY_GREEN_MIN ? ['M2', 'M3'] : ['M3', 'M4']);

    var candidates = poolByNano[targetNanoId];
    var byLevel = candidates.filter(function(q){ return preferredLevels.indexOf(q.level) > -1; });
    var finalPool = byLevel.length ? byLevel : candidates;
    return finalPool[Math.floor(Math.random() * finalPool.length)];
  }

  // Gộp mastery từng Tag (nano-point) lên cấp "Bài" (trung bình các Tag ĐÃ
  // từng được kiểm tra trong bài đó) để quyết định khoá bài học màu Xanh.
  function buildBaiMasteryStatus(nanoMastery){
    if(!window.OPC_NANO) return [];
    nanoMastery = nanoMastery || {};
    return window.OPC_NANO.BAI.map(function(b){
      var nanos = window.OPC_NANO.getNanoByBai(b.key);
      var tested = nanos.filter(function(n){ return nanoMastery[n.id] != null; });
      var avg = tested.length ? Math.round(tested.reduce(function(s, n){ return s + nanoMastery[n.id]; }, 0) / tested.length) : null;
      var chuDe = window.OPC_NANO.getChuDe(b.chuDeKey);
      return {
        key: b.key, name: b.name, chuDeKey: b.chuDeKey, chuDeName: chuDe ? chuDe.name : '', chuDeIcon: chuDe ? chuDe.icon : '',
        mastery: avg, status: tested.length ? classifyMastery(avg) : 'unknown',
        testedCount: tested.length, totalCount: nanos.length
      };
    });
  }

  // Các Tag (nano-point) màu Đỏ, điểm thấp nhất trước — nguồn dữ liệu cho
  // khối "Cần luyện ngay" (video Nano 3 phút + 5 bài tập) trên Trang chủ.
  function getRedTags(nanoMastery, n){
    if(!window.OPC_NANO) return [];
    nanoMastery = nanoMastery || {};
    var reds = window.OPC_NANO.NANO.filter(function(nn){
      var v = nanoMastery[nn.id];
      return v != null && v < MASTERY_YELLOW_MIN;
    }).map(function(nn){
      var bai = window.OPC_NANO.getBai(nn.baiKey);
      var chuDe = bai ? window.OPC_NANO.getChuDe(bai.chuDeKey) : null;
      // THÊM 6/10/2026 — gốc lỗi theo quan hệ tiên quyết (null nếu chính nano-point này là gốc)
      var rc = window.OPC_NANO.findRootCause ? window.OPC_NANO.findRootCause(nn.id, nanoMastery, null, { weakBelow: MASTERY_YELLOW_MIN }) : null;
      var rootNano = rc && rc.rootId !== nn.id ? window.OPC_NANO.getNano(rc.rootId) : null;
      return Object.assign({}, nn, {
        mastery: nanoMastery[nn.id],
        baiName: bai ? bai.name : '',
        chuDeKey: bai ? bai.chuDeKey : null,
        chuDeName: chuDe ? chuDe.name : '',
        rootCause: rootNano ? { id: rootNano.id, name: rootNano.name, reason: rc.reason, mastery: nanoMastery[rootNano.id] != null ? nanoMastery[rootNano.id] : null } : null
      });
    });
    reds.sort(function(a, b){ return a.mastery - b.mastery; });
    return reds.slice(0, n || 5);
  }

  // Chỉ xếp hạng các Tag ĐÃ CÓ số liệu thật (isReal) — Tag chưa từng kiểm
  // tra không được liệt vào "yếu nhất" chỉ vì thiếu dữ liệu.
  function getWeakestNanoPoints(map, n){
    var all = [];
    map.forEach(function(t){
      t.bais.forEach(function(b){
        b.nanos.forEach(function(nn){
          if(!nn.isReal) return;
          all.push(Object.assign({}, nn, { topicName: t.topicName, topicKey: t.topicKey, baiName: b.name }));
        });
      });
    });
    all.sort(function(a, b){ return a.mastery - b.mastery; });
    return all.slice(0, n || 5);
  }

  // CHỖ CẮM DỮ LIỆU THẬT: gọi hàm này (từ opc-live-data.js sau khi nạp xong
  // ngân hàng đề thật từ Firestore) để THAY TOÀN BỘ câu hỏi minh hoạ bằng
  // câu hỏi thật. Giữ nguyên tham chiếu mảng QUESTION_BANK (dùng
  // splice/push thay vì gán lại biến) để các hàm closure phía dưới
  // (getQuestionsByTopic, createFocusedDrill...) vẫn thấy được dữ liệu mới.
  // SỬA 28/9/2026: lưu toàn bộ vào ALL_QUESTIONS rồi lọc lại theo chương
  // đã mở (applyChapterFilter) — QUESTION_BANK chỉ chứa câu chương đã mở.
  function replaceQuestionBank(list){
    if(!list || !list.length) return false;
    ALL_QUESTIONS = list.slice();
    applyChapterFilter();
    return true;
  }

  // THÊM 14/10/2026 — CỤM CÂU HỎI "DỰA VÀO CÂU TRÊN": nhiều đề viết câu sau phụ thuộc dữ kiện của câu
  // trước ("Từ thí nghiệm ở câu trên…", "Theo kết quả của câu 25…") mà không có đoạn "Sử dụng thông tin sau…"
  // (groupPassage). Khi tạo đề cá nhân hoá / đề lớp, câu đó bị bốc lẻ nên mất dữ kiện. Hàm này nhận DANH SÁCH
  // CÂU CỦA 1 ĐỀ (dạng lưu trong de_thi) và gắn cho mỗi câu phụ thuộc 1 groupPassage = ngữ cảnh của câu trước
  // + đề bài câu trước (nối chuỗi nếu nhiều câu liên tiếp phụ thuộc nhau), kèm ảnh của câu trước. Đánh dấu
  // ctxFrom = index câu nguồn; ctxOwn/ctxOwnImages giữ ngữ cảnh gốc (nếu có) để chạy lại nhiều lần vẫn ra đúng
  // (idempotent) — sửa đề bài câu trước thì lần đọc sau tự cập nhật.
  var REF_PREV_RE = /(^|[^\p{L}])(các\s+)?câu(\s+hỏi)?\s+(ở\s+|phía\s+|bên\s+)?(trên|trước|liền\s+trước|vừa\s+rồi|vừa\s+làm)(?![\p{L}])/iu;
  var REF_NUM_RE = /(^|[^\p{L}])(ở|từ|của|theo|trong|tại|như|với)\s+câu\s+(số\s+)?\d+/iu;
  function refersPrevQuestion(stem){
    if(!stem) return false;
    var s = String(stem).normalize ? String(stem).normalize('NFC') : String(stem);
    return REF_PREV_RE.test(s) || REF_NUM_RE.test(s);
  }
  function linkPrevContext(list){
    if(!Array.isArray(list) || !list.length) return list;
    var order = list.map(function(q, i){ return i; });
    order.sort(function(a, b){
      var ia = list[a] ? Number(list[a].index) : NaN, ib = list[b] ? Number(list[b].index) : NaN;
      if(isNaN(ia) || isNaN(ib) || ia === ib) return a - b;
      return ia - ib;
    });
    function uniq(arr){
      var seen = {}, out = [];
      arr.forEach(function(x){ if(x == null) return; var k = typeof x === 'string' ? x : JSON.stringify(x); if(!seen[k]){ seen[k] = 1; out.push(x); } });
      return out;
    }
    var out = list.slice(), prev = null, changed = false;
    order.forEach(function(i){
      var q = list[i];
      if(!q){ prev = null; return; }
      var derived = q.ctxFrom != null;
      var own = derived ? (q.ctxOwn || null) : (q.groupPassage || null);
      var ownImgs = derived ? (q.ctxOwnImages || []) : (q.groupImages || []);
      var res = q;
      if(prev && prev.index != null && (prev.part || 'I') === (q.part || 'I') && refersPrevQuestion(q.stem)){
        var pieces = [];
        if(prev.groupPassage) pieces.push(String(prev.groupPassage).trim());
        if(prev.stem) pieces.push(String(prev.stem).trim());
        if(own && !(prev.groupPassage && String(prev.groupPassage).indexOf(own) > -1)) pieces.push(String(own).trim());
        res = Object.assign({}, q, {
          groupPassage: pieces.filter(Boolean).join('\n\n') || null,
          groupImages: uniq([].concat(prev.groupImages || [], prev.images || [], ownImgs)),
          ctxFrom: prev.index, ctxOwn: own, ctxOwnImages: ownImgs.slice()
        });
        changed = true;
      } else if(derived){
        // Trước đây được gắn nhưng nay không còn phụ thuộc (đã sửa đề bài) → trả lại ngữ cảnh gốc
        res = Object.assign({}, q, { groupPassage: own, groupImages: ownImgs.slice() });
        delete res.ctxFrom; delete res.ctxOwn; delete res.ctxOwnImages;
        changed = true;
      }
      out[i] = res; prev = res;
    });
    return changed ? out : list;
  }

  // ============================================================================
  // THÊM 16/10/2026 — DỰ ĐOÁN ĐIỂM THI TỐT NGHIỆP (predictExamScore)
  // 1) Gom từng câu em đã làm (mọi lượt: thi thử, drill, luyện thích ứng, đề giao, bài giấy, kiểm tra lớp) thành "lượt
  //    trả lời" có chuyên đề, mức độ (M1–M4), phần (I/II/III), đúng/sai; câu Đúng/Sai tính theo số ý đúng nếu có.
  //    Bài càng gần đây càng nặng ký (chu kỳ bán rã 45 ngày).
  // 2) Tỉ lệ đúng theo từng mức độ (có "điểm tựa" mặc định để vài câu không làm lệch), rồi hiệu chỉnh theo từng chuyên đề
  //    và từng phần (nhân trên thang odds, co về trung bình khi ít dữ liệu).
  // 3) Áp vào MA TRẬN ĐỀ (ước lượng theo đề tham khảo Bộ GD 2025: 18 câu Phần I · 4 câu Đúng/Sai · 6 câu trả lời ngắn,
  //    phân bổ theo 4 chủ đề Vật lí 12) với đúng cách chấm 0,25 / (0,1–0,25–0,5–1) / 0,25 → điểm kỳ vọng.
  // 4) Khoảng điểm ≈ ±1 độ lệch chuẩn = ngẫu nhiên của 1 đề + độ bất định của mô hình (ít dữ liệu, chuyên đề chưa làm).
  // 5) Có bài làm đủ cấu trúc (≥ 20 câu) thì trộn thêm điểm thật của các bài đó để hiệu chỉnh.
  // ============================================================================
  var PRED_TOPICS = ['nhiet', 'khi', 'tu-truong', 'hat-nhan'];
  var PRED_BLUEPRINT = {
    I: { pts: 0.25, counts: { 'nhiet': 4, 'khi': 4, 'tu-truong': 6, 'hat-nhan': 4 }, mix: { M1: 0.5, M2: 0.35, M3: 0.15, M4: 0 } },
    II: { pts: 1, counts: { 'nhiet': 1, 'khi': 1, 'tu-truong': 1, 'hat-nhan': 1 }, mix: { M1: 0.25, M2: 0.35, M3: 0.3, M4: 0.1 } },
    III: { pts: 0.25, counts: { 'nhiet': 1, 'khi': 2, 'tu-truong': 1, 'hat-nhan': 2 }, mix: { M1: 0, M2: 0.2, M3: 0.5, M4: 0.3 } }
  };
  var PRED_LEVEL_PRIOR = { M1: 0.8, M2: 0.65, M3: 0.45, M4: 0.25 };
  var TF_POINTS = [0, 0.1, 0.25, 0.5, 1];
  function predTopicOf(rec, bankById){
    var bq = bankById && bankById[rec.qId];
    var tk = rec.topicKey || (bq && bq.topicKey) || null;
    if(tk) return tk;
    var N = window.OPC_NANO;
    if(N){
      var bk = rec.baiKey || (bq && bq.baiKey);
      var bai = bk && N.getBai ? N.getBai(bk) : null;
      if(bai && bai.chuDeKey) return bai.chuDeKey;
      var ids = nanoIdsOf(rec);
      for(var i = 0; i < ids.length; i++){
        var nn = N.getNano ? N.getNano(ids[i]) : null;
        var b2 = nn && nn.baiKey && N.getBai ? N.getBai(nn.baiKey) : null;
        if(b2 && b2.chuDeKey) return b2.chuDeKey;
      }
    }
    var id0 = (rec.nanoId || (rec.nanoIds && rec.nanoIds[0]) || rec.baiKey || '');
    for(var t = 0; t < PRED_TOPICS.length; t++){ if(String(id0).indexOf(PRED_TOPICS[t] + '-') === 0) return PRED_TOPICS[t]; }
    return null;
  }
  function logit(p){ p = Math.min(0.98, Math.max(0.02, p)); return Math.log(p / (1 - p)); }
  function sigm(x){ return 1 / (1 + Math.exp(-x)); }
  function predictExamScore(attempts, bankById, nowMs){
    bankById = bankById || {};
    nowMs = nowMs || Date.now();
    var out = { predicted: null, low: null, high: null, sigma: null, confidence: null, nItems: 0, coverage: 0, anchors: 0,
      parts: null, topics: null, tips: [], reason: '' };
    // ---- 1) lượt trả lời ----
    var items = [], anchors = [];
    // bản làm dở (partial) và bản nộp cùng clientId → chỉ giữ bản nộp, không đếm trùng
    var finalKeys = {};
    (attempts || []).forEach(function(a){ if(a && !a.partial && a.clientId) finalKeys[a.clientId] = 1; });
    (attempts || []).forEach(function(a){
      if(!a) return;
      if(a.partial && a.clientId && finalKeys[a.clientId]) return;
      var t = new Date(a.createdAt).getTime();
      var age = isFinite(t) ? Math.max(0, (nowMs - t) / 86400000) : 30;
      var w = Math.pow(0.5, age / 45);
      function push(rec, ok){
        var part = rec.part === 'II' || rec.part === 'III' ? rec.part : 'I';
        var lv = PRED_LEVEL_PRIOR[rec.level] != null ? rec.level : 'M2';
        var y = ok ? 1 : 0, trials = 1;
        if(part === 'II'){
          var sub = rec.subOk != null ? Number(rec.subOk) : (ok ? 4 : 2); // chưa lưu số ý đúng (dữ liệu cũ) → ước lượng 2/4 cho câu sai
          y = Math.max(0, Math.min(4, sub)) / 4; trials = 2;              // 1 câu Đúng/Sai ≈ 2 "lượt" thông tin
        }
        items.push({ topic: predTopicOf(rec, bankById), level: lv, part: part, y: y, w: w * trials });
      }
      (a.wrongQuestions || []).forEach(function(r){ push(r, false); });
      (a.rightQuestions || []).forEach(function(r){ push(r, true); });
      // "bài đủ cấu trúc" (để hiệu chỉnh): ≥ 22 câu và có đủ cả Phần II lẫn Phần III — như đề thi thật 28 câu
      var all = (a.wrongQuestions || []).concat(a.rightQuestions || []);
      var hasP = {}; all.forEach(function(r){ hasP[r.part || 'I'] = 1; });
      var sc = Number(a.scaledScore10);
      if(!a.partial && all.length >= 22 && hasP.II && hasP.III && isFinite(sc)) anchors.push({ score: sc, w: w });
    });
    var nEff = items.reduce(function(s, it){ return s + it.w; }, 0);
    out.nItems = items.length;
    if(items.length < 10 || nEff < 6){
      out.reason = 'Chưa đủ dữ liệu — cần làm thêm ít nhất ' + Math.max(1, 10 - items.length) + ' câu';
      return out;
    }
    // ---- 2) tỉ lệ đúng theo mức độ (co về điểm tựa mặc định) ----
    var A = 3, rL = {};
    Object.keys(PRED_LEVEL_PRIOR).forEach(function(L){
      var S = 0, Nn = 0;
      items.forEach(function(it){ if(it.level === L){ S += it.y * it.w; Nn += it.w; } });
      rL[L] = (S + A * PRED_LEVEL_PRIOR[L]) / (Nn + A);
    });
    // giữ đúng thứ tự khó dần (M1 ≥ M2 ≥ M3 ≥ M4)
    rL.M2 = Math.min(rL.M2, rL.M1); rL.M3 = Math.min(rL.M3, rL.M2); rL.M4 = Math.min(rL.M4, rL.M3);
    // hiệu chỉnh chuyên đề & phần trên thang logit, co về 0 khi ít dữ liệu (K = số lượt "ảo" trung lập)
    function shrunkShift(filter, K){
      var res = 0, wsum = 0;
      items.forEach(function(it){ if(filter(it)){ res += (it.y - rL[it.level]) * it.w; wsum += it.w; } });
      if(!wsum) return { shift: 0, n: 0 };
      var meanRes = res / wsum; // chênh lệch trung bình so với kỳ vọng theo mức độ
      var shift = (meanRes / 0.22) * (wsum / (wsum + K)); // 0,22 ≈ độ dốc p(1-p) quanh 0,65 → đổi sang logit
      return { shift: Math.max(-2, Math.min(2, shift)), n: wsum };
    }
    var tShift = {}, tN = {};
    PRED_TOPICS.forEach(function(tk){ var r = shrunkShift(function(it){ return it.topic === tk; }, 6); tShift[tk] = r.shift; tN[tk] = r.n; });
    var pShift = {};
    ['I', 'II', 'III'].forEach(function(P){ pShift[P] = shrunkShift(function(it){ return it.part === P; }, 8).shift; });
    function pCorrect(tk, L, P){ return sigm(logit(rL[L]) + (tShift[tk] || 0) + (pShift[P] || 0)); }
    // ---- 3) áp vào ma trận đề ----
    var parts = {}, topics = {}, varExam = 0, total = 0;
    PRED_TOPICS.forEach(function(tk){ topics[tk] = { exp: 0, max: 0 }; });
    ['I', 'II', 'III'].forEach(function(P){
      var bp = PRED_BLUEPRINT[P], expP = 0, maxP = 0;
      PRED_TOPICS.forEach(function(tk){
        var cnt = bp.counts[tk] || 0; if(!cnt) return;
        var p = 0; Object.keys(bp.mix).forEach(function(L){ p += bp.mix[L] * pCorrect(tk, L, P); });
        var e, v, mx = cnt * bp.pts;
        if(P === 'II'){
          var ev = 0, ev2 = 0;
          for(var k = 0; k <= 4; k++){
            var c = [1, 4, 6, 4, 1][k] * Math.pow(p, k) * Math.pow(1 - p, 4 - k);
            ev += c * TF_POINTS[k]; ev2 += c * TF_POINTS[k] * TF_POINTS[k];
          }
          e = cnt * ev; v = cnt * (ev2 - ev * ev);
        } else {
          e = cnt * bp.pts * p; v = cnt * bp.pts * bp.pts * p * (1 - p);
        }
        expP += e; maxP += mx; varExam += v;
        topics[tk].exp += e; topics[tk].max += mx;
      });
      parts[P] = { exp: expP, max: maxP };
      total += expP;
    });
    // ---- 4) độ bất định ----
    var cov = 0;
    PRED_TOPICS.forEach(function(tk){ cov += (topics[tk].max / 10) * Math.min(1, (tN[tk] || 0) / 8); });
    var sigModel = 1.2 / Math.sqrt(1 + nEff / 15) + 1.2 * (1 - cov);
    // ---- 5) hiệu chỉnh bằng bài đủ cấu trúc ----
    var pred = total;
    if(anchors.length){
      var recent = anchors.slice(-3), aw = 0, as = 0;
      recent.forEach(function(x){ as += x.score * x.w; aw += x.w; });
      if(aw > 0){
        var wA = Math.min(0.5, 0.2 + 0.1 * recent.length);
        pred = (1 - wA) * total + wA * (as / aw);
        sigModel *= 0.85;
      }
    }
    var sigma = Math.sqrt(varExam + sigModel * sigModel);
    function r1(x){ return Math.round(x * 10) / 10; }
    out.predicted = r1(Math.max(0, Math.min(10, pred)));
    out.low = r1(Math.max(0, pred - sigma));
    out.high = r1(Math.min(10, pred + sigma));
    out.sigma = r1(sigma);
    out.confidence = sigma <= 0.7 ? 'cao' : (sigma <= 1.1 ? 'trung bình' : 'thấp');
    out.coverage = Math.round(cov * 100);
    out.anchors = anchors.length;
    out.parts = {};
    Object.keys(parts).forEach(function(P){ out.parts[P] = { exp: r1(parts[P].exp), max: r1(parts[P].max) }; });
    out.topics = PRED_TOPICS.map(function(tk){
      return { key: tk, name: (CHU_DE_MAP[tk] && CHU_DE_MAP[tk].name) || tk, exp: r1(topics[tk].exp), max: r1(topics[tk].max), n: Math.round(tN[tk] || 0) };
    });
    // gợi ý: phần / chuyên đề đang mất nhiều điểm nhất + chuyên đề còn thiếu dữ liệu
    var PART_NAME = { I: 'Phần I (trắc nghiệm 4 lựa chọn)', II: 'Phần II (Đúng/Sai)', III: 'Phần III (trả lời ngắn)' };
    var losses = [];
    Object.keys(parts).forEach(function(P){ losses.push({ label: PART_NAME[P], lost: parts[P].max - parts[P].exp }); });
    PRED_TOPICS.forEach(function(tk){ if((tN[tk] || 0) >= 4) losses.push({ label: 'chuyên đề ' + ((CHU_DE_MAP[tk] && CHU_DE_MAP[tk].name) || tk), lost: topics[tk].max - topics[tk].exp }); });
    losses.sort(function(a, b){ return b.lost - a.lost; });
    out.tips = losses.slice(0, 2).filter(function(x){ return x.lost >= 0.3; }).map(function(x){ return x.label + ' đang mất khoảng ' + String(r1(x.lost)).replace('.', ',') + ' điểm'; });
    var missing = PRED_TOPICS.filter(function(tk){ return (tN[tk] || 0) < 4; }).map(function(tk){ return (CHU_DE_MAP[tk] && CHU_DE_MAP[tk].name) || tk; });
    if(missing.length) out.tips.push('Chưa đủ dữ liệu: ' + missing.join(', ') + ' (đang tạm ước lượng theo mặt bằng chung của em)');
    out.missingTopics = missing;
    return out;
  }
  // Bản rút gọn để lưu vào student_stats (admin, báo cáo phụ huynh đọc lại)
  function compactPrediction(pr){
    if(!pr || pr.predicted == null) return null;
    return { low: pr.low, high: pr.high, conf: pr.confidence, cov: pr.coverage, n: pr.nItems, anchors: pr.anchors,
      parts: pr.parts, topics: (pr.topics || []).map(function(t){ return { k: t.key, exp: t.exp, max: t.max, n: t.n }; }), tips: pr.tips || [] };
  }
  function formatPrediction(pr){
    if(!pr || pr.predicted == null) return (pr && pr.reason) || 'Chưa đủ dữ liệu';
    function f(x){ return String(Number(x).toFixed(1)).replace('.', ','); }
    return f(pr.predicted) + ' (khoảng ' + f(pr.low) + ' – ' + f(pr.high) + ', độ tin cậy ' + (pr.confidence || pr.conf) + ')';
  }

  // Khởi tạo và xuất đối tượng sang window
  window.PrepScholarEngine = {
    CHU_DE_MAP: CHU_DE_MAP,
    CHU_DE_ORDER: CHU_DE_ORDER,
    computeRadar5: computeRadar5,
    computeLevelXP: computeLevelXP,
    getCurrentChuDe: getCurrentChuDe,
    QUESTION_BANK: QUESTION_BANK,
    // THÊM 16/10/2026 — tra 1 câu theo mã trong TOÀN BỘ ngân hàng đã nạp (kể cả chương đang khoá) — dùng cho
    // tab "🕓 Lịch sử" của học sinh để dựng lại màn hình xem lại bài làm cũ.
    getQuestionById: function(id){
      for(var i = 0; i < ALL_QUESTIONS.length; i++){ if(ALL_QUESTIONS[i] && ALL_QUESTIONS[i].id === id) return ALL_QUESTIONS[i]; }
      return null;
    },
    replaceQuestionBank: replaceQuestionBank,
    setUnlockedChapters: setUnlockedChapters,
    getUnlockedChapters: function(){ return UNLOCKED_CHAPTERS.slice(); },
    isTopicUnlocked: isTopicUnlocked,
    MOET_STRUCTURE: MOET_STRUCTURE,
    getRollingExamShortages: getRollingExamShortages,
    createRollingExam: createRollingExam,
    scoreExam: scoreExam,
    getQuestionsByTopic: function(topicKey){
      return QUESTION_BANK.filter(function(q){ return q.topicKey === topicKey; });
    },
    createFocusedDrill: function(topicKey, count){
      // SỬA 25/9/2026 — TRƯỚC ĐÂY: nếu chuyên đề chưa nạp câu hỏi nào (pool
      // rỗng) thì tự động lấy TOÀN BỘ QUESTION_BANK (mọi chuyên đề khác) làm
      // bài Drill — khiến học sinh chọn "Từ trường & Cảm ứng điện từ" nhưng
      // lại làm nhầm câu hỏi của "Khí lí tưởng" (chuyên đề duy nhất đã nạp),
      // mà tiêu đề bài Drill vẫn ghi đúng tên chuyên đề đã chọn — rất dễ gây
      // hiểu lầm. Giờ trả về đúng pool của chuyên đề đó (có thể rỗng) — nơi
      // gọi hàm này (startDrill trong prepscholar-ui.js) chịu trách nhiệm
      // báo cho học sinh biết khi chưa có câu hỏi, thay vì âm thầm đổi đề.
      var pool = QUESTION_BANK.filter(function(q){ return q.topicKey === topicKey; });
      count = Math.min(count || 5, pool.length);
      return pool.slice(0, count);
    },
    // Bài kiểm tra đầu vào (Diagnostic Test) — theo đúng cấu trúc đề thi
    // Vật lí THPT chương trình GDPT 2018: Phần I 18 câu, Phần II 4 câu,
    // Phần III 6 câu (28 câu). Trong mỗi phần, ưu tiên chọn PHỦ RỘNG càng
    // nhiều Tag (nano-point) khác nhau càng tốt trước khi lặp lại, để 1 lượt
    // kiểm tra đo được nhiều Tag nhất có thể trong tổng số 48 Tag hiện có.
    // Nếu ngân hàng đề thật chưa đủ câu cho 1 phần nào đó, tự động lấy ít
    // hơn (không báo lỗi) — phần "Cần kiểm tra thêm" sẽ hiện "Chưa kiểm tra".
    createDiagnosticExam: function(){
      var TARGET = MOET_STRUCTURE;
      var out = [];
      Object.keys(TARGET).forEach(function(part){
        var pool = QUESTION_BANK.filter(function(q){ return q.part === part; });
        out = out.concat(pickCoverage(pool, TARGET[part]));
      });
      return out;
    },
    // "5 bài tập" luyện lại đúng 1 Tag (nano-point) cụ thể — dùng cho khối
    // remediation màu Đỏ trên Trang chủ Học sinh.
    createNanoDrill: function(nanoId, count){
      var pool = QUESTION_BANK.filter(function(q){ return nanoIdsOf(q).indexOf(nanoId) > -1; });
      if(!pool.length && window.OPC_NANO){
        var nano = window.OPC_NANO.getNano(nanoId);
        if(nano) pool = QUESTION_BANK.filter(function(q){ return q.baiKey === nano.baiKey; });
      }
      count = Math.min(count || 5, pool.length);
      return pool.slice(0, count);
    },
    // THÊM 30/9/2026 — "Luyện thêm N câu tương tự" ngay dưới lời giải của 1
    // câu làm sai: ưu tiên câu CÙNG nano-point (cùng kỹ năng), thiếu thì bù
    // câu cùng Bài; bỏ chính câu vừa sai; xáo trộn để mỗi lần bấm ra câu khác
    // (createNanoDrill cũ luôn trả đúng mấy câu đầu tiên). QUESTION_BANK đã
    // lọc theo chương đang mở nên không ra câu chương chưa học.
    // SỬA 1/10/2026: câu tương tự phải CÙNG DẠNG ĐỀ (cùng Phần): sai câu
    // Phần II (Đúng/Sai) thì luyện 3 câu Phần II, sai Phần III (trả lời
    // ngắn) thì 3 câu Phần III. Thứ tự ưu tiên, luôn trong cùng Phần:
    // cùng nano-point -> cùng Bài -> cùng Chủ đề. Không bao giờ bù câu khác Phần.
    // excludeIds (THÊM 1/10/2026): id các câu đã dùng ở lượt luyện trước cho
    // cùng câu sai gốc — lượt sau ra câu MỚI, chỉ lặp lại khi hết câu mới.
    nanoIdsOf: nanoIdsOf,
    getLastPickInfo: function(){ return lastPickInfo; },
    buildDailyPlan: buildDailyPlan,
    computeStreakDays: computeStreakDays,
    createSimilarDrill: function(question, count, excludeIds){
      if(!question) return [];
      count = count || 3;
      var excl = {}; (excludeIds || []).forEach(function(id){ excl[id] = true; });
      function shuf(a){ a = a.slice(0); for(var i = a.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
      var part = question.part;
      var base = QUESTION_BANK.filter(function(q){ return q.id !== question.id && q.part === part; });
      var tiers = [
        nanoIdsOf(question).length ? function(q){ return shareNano(q, question); } : null,
        question.baiKey ? function(q){ return q.baiKey === question.baiKey; } : null,
        question.topicKey ? function(q){ return q.topicKey === question.topicKey; } : null
      ];
      var picked = [], ids = {};
      function fill(allowUsed){
        tiers.forEach(function(test){
          if(!test || picked.length >= count) return;
          shuf(base.filter(function(q){ return !ids[q.id] && (allowUsed || !excl[q.id]) && test(q); })).forEach(function(q){
            if(picked.length < count){ picked.push(q); ids[q.id] = true; }
          });
        });
      }
      fill(false);
      if(picked.length < count) fill(true); // hết câu mới thì mới cho gặp lại câu cũ
      return picked;
    },
    countSimilar: function(question){
      if(!question) return 0;
      return QUESTION_BANK.filter(function(q){
        return q.id !== question.id && q.part === question.part && (
          shareNano(q, question) ||
          (question.baiKey && q.baiKey === question.baiKey) ||
          (question.topicKey && q.topicKey === question.topicKey));
      }).length;
    },
    // Luyện lại cả 1 "Bài" (gộp các Tag con) — dùng cho nút "Luyện bài này"
    // trên lưới 16 Bài của Trang chủ Học sinh.
    createBaiDrill: function(baiKey, count){
      var pool = QUESTION_BANK.filter(function(q){ return q.baiKey === baiKey; });
      count = Math.min(count || 5, pool.length);
      return pool.slice(0, count);
    },
    classifyMastery: classifyMastery,
    buildBaiMasteryStatus: buildBaiMasteryStatus,
    getRedTags: getRedTags,
    bumpNanoMastery: bumpNanoMastery,
    pickAdaptiveQuestion: pickAdaptiveQuestion,
    MASTERY_GREEN_MIN: MASTERY_GREEN_MIN,
    MASTERY_YELLOW_MIN: MASTERY_YELLOW_MIN,
    MASTERY_NEUTRAL_START: MASTERY_NEUTRAL_START,
    // Bản đồ kiến thức mức nano — truyền vào mastery theo chuyên đề của 1 học
    // sinh cụ thể (vd. student.mastery) để làm mốc tính, và (tuỳ chọn)
    // realNanoMastery tính từ lịch sử làm bài thật (student.nanoMastery) để
    // dùng số liệu thật thay vì suy diễn khi đã có.
    getKnowledgeMap: function(studentMasteryByTopic, realNanoMastery){
      return buildKnowledgeMap(studentMasteryByTopic, realNanoMastery);
    },
    getWeakestNanoPoints: function(studentMasteryByTopic, n, realNanoMastery){
      return getWeakestNanoPoints(buildKnowledgeMap(studentMasteryByTopic, realNanoMastery), n);
    },
    computeStudentStatsFromAttempts: computeStudentStatsFromAttempts,
    // THÊM 14/10/2026 — gắn dữ kiện câu trước cho câu "dựa vào câu trên" (xem linkPrevContext)
    refersPrevQuestion: refersPrevQuestion,
    // THÊM 16/10/2026 — dự đoán điểm thi tốt nghiệp (xem predictExamScore)
    predictExamScore: function(attempts){ var b = {}; QUESTION_BANK.forEach(function(q){ b[q.id] = q; }); return predictExamScore(attempts, b); },
    compactPrediction: compactPrediction,
    formatPrediction: formatPrediction,
    linkPrevContext: linkPrevContext
  };

})(window);
