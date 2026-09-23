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
  var CHU_DE_MAP = {
    'nhiet': { name: 'Vật lí nhiệt', icon: '🔥', defaultMastery: 50 },
    'khi': { name: 'Khí lí tưởng', icon: '💨', defaultMastery: 50 },
    'tu-truong': { name: 'Từ trường & Cảm ứng điện từ', icon: '🧲', defaultMastery: 50 },
    'hat-nhan': { name: 'Vật lí hạt nhân', icon: '⚛️', defaultMastery: 50 }
  };

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
  // câu thủ công). Mastery của từng nano-point hiện là số liệu minh hoạ
  // (suy ra từ defaultMastery của cả chuyên đề + dao động theo id) —
  // CHỖ CẮM DỮ LIỆU THẬT sau này: thay hàm getNanoMastery() bằng số liệu
  // tổng hợp từ lịch sử làm bài thật của từng học sinh trên Firestore.
  // ============================================================
  function hashStr(s){
    var h = 0;
    s = String(s || '');
    for(var i = 0; i < s.length; i++){ h = (h * 31 + s.charCodeAt(i)) >>> 0; }
    return h;
  }

  function getNanoMastery(nanoId, baseMastery){
    var base = (baseMastery != null) ? baseMastery : 60;
    var variance = (hashStr(nanoId) % 30) - 15; // dao động -15..+14 quanh mức trung bình chuyên đề
    return Math.max(5, Math.min(99, base + variance));
  }

  // (Đã bỏ assignNanoToSeedQuestions() — chỉ dùng để gắn nanoId cho 16 câu
  // hỏi MINH HOẠ trước đây. Câu hỏi thật đã được gắn nanoId ngay khi nạp,
  // xem transformQuestion() trong opc-live-data.js.)

  // realNanoMastery (tuỳ chọn): {nanoId: %} tính từ lịch sử làm bài THẬT của
  // học sinh (xem computeStudentStatsFromAttempts bên dưới) — nano nào có số
  // liệu thật thì dùng số thật, nano nào chưa từng gặp câu nào (học sinh mới
  // đăng nhập, chưa luyện) thì vẫn tạm dùng số liệu minh hoạ suy ra từ mức độ
  // chuyên đề để bản đồ không bị trống trơn.
  function buildKnowledgeMap(studentMasteryByTopic, realNanoMastery){
    if(!window.OPC_NANO) return [];
    realNanoMastery = realNanoMastery || {};
    return Object.keys(CHU_DE_MAP).map(function(topicKey){
      var topic = CHU_DE_MAP[topicKey];
      var base = (studentMasteryByTopic && studentMasteryByTopic[topicKey] != null) ? studentMasteryByTopic[topicKey] : topic.defaultMastery;
      var bais = window.OPC_NANO.getBaiByChuDe(topicKey).map(function(b){
        var nanos = window.OPC_NANO.getNanoByBai(b.key).map(function(n){
          var real = realNanoMastery[n.id];
          var mastery = (real != null) ? real : getNanoMastery(n.id, base);
          return { id: n.id, name: n.name, mastery: mastery, isReal: real != null };
        });
        var avg = nanos.length ? Math.round(nanos.reduce(function(s, n){ return s + n.mastery; }, 0) / nanos.length) : base;
        return { key: b.key, name: b.name, mastery: avg, nanos: nanos };
      });
      return { topicKey: topicKey, topicName: topic.name, icon: topic.icon, mastery: base, bais: bais };
    });
  }

  // ============================================================
  // CHỖ CẮM DỮ LIỆU THẬT (đã cắm): tổng hợp lịch sử làm bài thật (lưu qua
  // opc-live-data.js, mỗi lần Drill/Thi thử nộp bài) thành điểm dự đoán,
  // % thành thạo theo chuyên đề, % thành thạo theo nano-point, và Sổ tay
  // câu sai — thay cho toàn bộ số liệu minh hoạ trước đây.
  // ============================================================
  function computeStudentStatsFromAttempts(attempts){
    var result = { mastery: {}, nanoMastery: {}, predicted: null, mistakeLog: [] };
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
      var delta = correct ? ((level === 'M3' || level === 'M4') ? 25 : 15) : -20;
      nanoAgg[nanoId] = Math.max(0, Math.min(100, cur + delta));
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

    // Sổ tay câu sai: câu sai gần nhất mà SAU ĐÓ chưa từng làm đúng lại.
    var lastWrong = {};
    sorted.forEach(function(a){
      (a.wrongQuestions || []).forEach(function(q){ lastWrong[q.qId] = { q: q, at: a.createdAt }; });
      (a.rightQuestions || []).forEach(function(q){ delete lastWrong[q.qId]; });
    });
    var now = Date.now();
    result.mistakeLog = Object.keys(lastWrong).map(function(qId){
      var info = lastWrong[qId];
      var daysSince = Math.floor((now - new Date(info.at).getTime()) / 86400000);
      var intervalDays = 1; // giãn cách đơn giản — có thể nâng cấp thuật toán sau
      return {
        id: 'live_' + qId,
        qId: qId,
        topicKey: info.q.topicKey,
        topicName: info.q.topicName || '',
        title: info.q.subtopic || info.q.topicName || 'Câu hỏi',
        reason: 'Đã làm sai trong lượt luyện gần đây',
        daysOverdue: Math.max(0, daysSince - intervalDays),
        intervalDays: intervalDays,
        nanoId: info.q.nanoId
      };
    }).sort(function(a, b){ return b.daysOverdue - a.daysOverdue; }).slice(0, 15);

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

  function getWeakestNanoPoints(map, n){
    var all = [];
    map.forEach(function(t){
      t.bais.forEach(function(b){
        b.nanos.forEach(function(nn){
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
    MASTERY_GREEN_MIN: MASTERY_GREEN_MIN,
    MASTERY_YELLOW_MIN: MASTERY_YELLOW_MIN,
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
