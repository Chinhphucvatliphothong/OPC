/**
 * OPC Luyện Thi Vật Lí - PrepScholar Adaptive Learning Engine
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
        if(rawVal !== undefined && rawVal !== '' && !isNaN(Number(rawVal))){
          var num = Number(rawVal);
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
    function bump(nanoId, correct, level){
      if(!nanoId) return;
      var cur = (nanoAgg[nanoId] != null) ? nanoAgg[nanoId] : MASTERY_NEUTRAL_START;
      nanoAgg[nanoId] = bumpNanoMastery(cur, correct, level);
    }
    sorted.forEach(function(a){
      (a.wrongQuestions || []).forEach(function(q){ bump(q.nanoId, false, q.level); });
      (a.rightQuestions || []).forEach(function(q){ bump(q.nanoId, true, q.level); });
    });
    result.nanoMastery = nanoAgg;

    // Điểm dự đoán: trung bình tối đa 5 lượt Thi thử/Chẩn đoán gần nhất;
    // nếu chưa từng thi, tạm lấy trung bình mọi lượt luyện gần nhất.
    var examLike = sorted.filter(function(a){ return a.type === 'exam' || a.type === 'diagnostic'; });
    var pool = (examLike.length ? examLike : sorted).slice(-5);
    var scores = pool.map(function(a){ return Number(a.scaledScore10); }).filter(function(n){ return !isNaN(n); });
    if(scores.length) result.predicted = Math.round((scores.reduce(function(s, n){ return s + n; }, 0) / scores.length) * 10) / 10;

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
    }).sort(function(a, b){ return b.daysOverdue - a.daysOverdue; }).slice(0, 15);

    result.radar5 = computeRadar5(sorted);
    result.levelXp = computeLevelXP(sorted);
    result.currentChuDe = getCurrentChuDe(result.mastery);

    // Đề đã làm / Điểm TB / Điểm cao nhất — tính trên MỌI lượt nộp bài thật
    // (Kiểm tra đầu vào, Drill, Thi thử, Luyện thích ứng, Đề được giao...),
    // không phân biệt loại, để khớp đúng nghĩa "Đề đã làm" trên trang admin.
    result.completedExamsCount = sorted.length;
    var scoreVals = sorted.map(function(a){ return Number(a.scaledScore10); }).filter(function(n){ return !isNaN(n); });
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
  function bumpNanoMastery(current, correct, level){
    var cur = (current != null) ? current : MASTERY_NEUTRAL_START;
    var delta = correct ? ((level === 'M3' || level === 'M4') ? 25 : 15) : -20;
    return Math.max(0, Math.min(100, cur + delta));
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
  function pickAdaptiveQuestion(nanoMastery, askedIds, priorityOrder){
    if(!QUESTION_BANK.length) return null;
    nanoMastery = nanoMastery || {};
    askedIds = askedIds || {};

    var poolByNano = {};
    QUESTION_BANK.forEach(function(q){
      if(!q.nanoId || askedIds[q.id]) return;
      (poolByNano[q.nanoId] || (poolByNano[q.nanoId] = [])).push(q);
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
      return Object.assign({}, nn, {
        mastery: nanoMastery[nn.id],
        baiName: bai ? bai.name : '',
        chuDeKey: bai ? bai.chuDeKey : null,
        chuDeName: chuDe ? chuDe.name : ''
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
  function replaceQuestionBank(list){
    if(!list || !list.length) return false;
    QUESTION_BANK.length = 0;
    Array.prototype.push.apply(QUESTION_BANK, list);
    return true;
  }

  // Khởi tạo và xuất đối tượng sang window
  window.PrepScholarEngine = {
    CHU_DE_MAP: CHU_DE_MAP,
    CHU_DE_ORDER: CHU_DE_ORDER,
    computeRadar5: computeRadar5,
    computeLevelXP: computeLevelXP,
    getCurrentChuDe: getCurrentChuDe,
    QUESTION_BANK: QUESTION_BANK,
    replaceQuestionBank: replaceQuestionBank,
    scoreExam: scoreExam,
    getQuestionsByTopic: function(topicKey){
      return QUESTION_BANK.filter(function(q){ return q.topicKey === topicKey; });
    },
    createFocusedDrill: function(topicKey, count){
      var pool = QUESTION_BANK.filter(function(q){ return q.topicKey === topicKey; });
      if(!pool.length) pool = QUESTION_BANK;
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
      var TARGET = { I: 18, II: 4, III: 6 };
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
      var pool = QUESTION_BANK.filter(function(q){ return q.nanoId === nanoId; });
      if(!pool.length && window.OPC_NANO){
        var nano = window.OPC_NANO.getNano(nanoId);
        if(nano) pool = QUESTION_BANK.filter(function(q){ return q.baiKey === nano.baiKey; });
      }
      count = Math.min(count || 5, pool.length);
      return pool.slice(0, count);
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
    computeStudentStatsFromAttempts: computeStudentStatsFromAttempts
  };

})(window);
