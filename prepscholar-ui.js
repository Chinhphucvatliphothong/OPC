/**
 * OPC Luyện Thi Vật Lí - PrepScholar UI Component
 * Giao diện tương tác trực tiếp theo chuẩn PrepScholar
 */

(function(window){
  'use strict';

  var React = window.React;
  var ReactDOM = window.ReactDOM;
  var h = React.createElement;

  var STUDENTS = [
    { id: 's1', name: 'Học Sinh A (Trần Văn An)', email: 'hocsinha@opc.edu.vn', target: 9.0, predicted: 7.8, hours: 3.5, mastery: { 'nhiet': 85, 'khi': 68, 'tu-truong': 60, 'hat-nhan': 42 } },
    { id: 's2', name: 'Nguyễn Bảo Châu', email: 'chaund@gmail.com', target: 8.5, predicted: 6.9, hours: 2.0, mastery: { 'nhiet': 78, 'khi': 45, 'tu-truong': 72, 'hat-nhan': 55 } },
    { id: 's3', name: 'Trần Minh Khôi', email: 'khoitm@gmail.com', target: 9.5, predicted: 8.6, hours: 4.5, mastery: { 'nhiet': 92, 'khi': 85, 'tu-truong': 88, 'hat-nhan': 78 } },
    { id: 'guest', name: 'Khách thử nghiệm tự do', email: 'khach@opc.edu.vn', target: 8.0, predicted: 7.0, hours: 0.5, mastery: { 'nhiet': 70, 'khi': 60, 'tu-truong': 55, 'hat-nhan': 50 } }
  ];

  // Chuyển hồ sơ học sinh THẬT (từ Firestore, do admin.html tạo) sang đúng
  // hình dạng mà giao diện luyện tập cần. predicted/mastery/nanoMastery ở
  // đây chỉ là giá trị khởi điểm mặc định cho tới khi hydrateAndEnter() tải
  // xong lịch sử làm bài thật (nếu có) và ghi đè lại bằng số liệu thật —
  // xem computeStudentStatsFromAttempts trong prepscholar.js.
  function toAppStudent(real){
    var defMastery = { 'nhiet': 70, 'khi': 65, 'tu-truong': 60, 'hat-nhan': 55 };
    return {
      id: real.id,
      name: real.name || 'Học sinh',
      email: real.email || '',
      target: Number(real.targetScore) || 9.0,
      predicted: Number(real.predictedScore) || Number(real.averageScore) || 7.0,
      hours: Number(real.weeklyHours) || 0,
      mastery: real.mastery || defMastery,
      nanoMastery: {},
      isLive: true
    };
  }

  function formatTime(seconds){
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  // Render công thức LaTeX hoặc toán học
  function renderLatexText(text){
    if(!text) return '';
    // Thử dùng KaTeX nếu đã load
    if(window.katex && text.indexOf('$') !== -1){
      var parts = text.split(/(\$[^$]+\$)/g);
      return h('span', null, parts.map(function(part, idx){
        if(part.startsWith('$') && part.endsWith('$')){
          var expr = part.slice(1, -1);
          try {
            var html = window.katex.renderToString(expr, { throwOnError: false });
            return h('span', { key: idx, dangerouslySetInnerHTML: { __html: html } });
          } catch(e){
            return h('span', { key: idx }, part);
          }
        }
        return h('span', { key: idx }, part);
      }));
    }
    return text;
  }

  // Hiển thị hình ảnh minh họa (sơ đồ, đồ thị...) đính kèm câu hỏi — dữ liệu
  // do opc-live-data.js khớp từ tên file \includegraphics với ảnh thật của đề
  // thi (xem resolveQuestionImages). q.images: mảng {name, url (dataURL)}.
  function renderQuestionImages(q){
    var imgs = (q && q.images) || [];
    if(!imgs.length) return null;
    return h('div', { className: 'ps-q-images', style: { display: 'flex', flexWrap: 'wrap', gap: '10px', margin: '10px 0' } },
      imgs.map(function(im, idx){
        return h('img', {
          key: idx,
          src: im.url,
          alt: im.name || ('Hình minh họa ' + (idx + 1)),
          style: { maxWidth: '100%', maxHeight: '320px', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)' }
        });
      })
    );
  }

  function PrepScholarApp(){
    // Lưới an toàn: nếu vì lý do gì đó (mạng chậm, script bị chặn...) KaTeX
    // chưa sẵn sàng ngay lần render đầu, tự động re-render lại khi nó đã load
    // xong để công thức LaTeX luôn hiển thị đẹp thay vì mắc kẹt ở dạng thô.
    var katexReadyState = React.useState(function(){ return !!window.katex; });
    var katexReady = katexReadyState[0];
    var setKatexReady = katexReadyState[1];
    React.useEffect(function(){
      if(katexReady) return;
      var tries = 0;
      var timer = setInterval(function(){
        tries++;
        if(window.katex){ setKatexReady(true); clearInterval(timer); }
        else if(tries > 100){ clearInterval(timer); } // ~20s, bỏ cuộc nếu KaTeX không load được
      }, 200);
      return function(){ clearInterval(timer); };
    }, [katexReady]);

    // ================= Đăng nhập học sinh + ngân hàng đề thật =================
    // window.OPC_LIVE được nạp bởi opc-live-data.js — một <script type="module">
    // nên LUÔN chạy sau các script thường (kể cả file này); do đó dò/poll
    // thay vì giả định nó có sẵn ngay, giống cách xử lý katexReady ở trên.
    var liveReadyState = React.useState(function(){ return !!window.OPC_LIVE; });
    var liveReady = liveReadyState[0];
    var setLiveReady = liveReadyState[1];
    React.useEffect(function(){
      if(liveReady) return;
      function onReady(){ setLiveReady(true); }
      window.addEventListener('opc-live-ready', onReady);
      var tries = 0;
      var timer = setInterval(function(){
        tries++;
        if(window.OPC_LIVE){ setLiveReady(true); clearInterval(timer); }
        else if(tries > 100){ clearInterval(timer); } // ~20s, bỏ cuộc — vào chế độ minh hoạ
      }, 200);
      return function(){ window.removeEventListener('opc-live-ready', onReady); clearInterval(timer); };
    }, [liveReady]);

    // authState: 'checking' (đang dò phiên đăng nhập cũ) | 'form' (chưa đăng
    // nhập, hiện form) | 'in' (đã vào — có thể là tài khoản thật hoặc học thử)
    var authStateState = React.useState('checking');
    var authState = authStateState[0];
    var setAuthState = authStateState[1];
    var loginUserState = React.useState(''); var loginUser = loginUserState[0], setLoginUser = loginUserState[1];
    var loginPassState = React.useState(''); var loginPass = loginPassState[0], setLoginPass = loginPassState[1];
    var loginErrState = React.useState(''); var loginErr = loginErrState[0], setLoginErr = loginErrState[1];
    var loginBusyState = React.useState(false); var loginBusy = loginBusyState[0], setLoginBusy = loginBusyState[1];

    var studentState = React.useState(STUDENTS[0]);
    var student = studentState[0];
    var setStudent = studentState[1];

    // Sau khi có hồ sơ học sinh thật (đăng nhập hoặc khôi phục phiên cũ): vào
    // ngay với số liệu mặc định, rồi tải lịch sử luyện tập thật (nếu có) để
    // tính lại mastery/điểm dự đoán/Sổ tay câu sai từ dữ liệu thật — CHỖ CẮM
    // DỮ LIỆU THẬT đã hoạt động (xem computeStudentStatsFromAttempts trong
    // prepscholar.js).
    function hydrateAndEnter(real){
      var appStu = toAppStudent(real);
      setStudent(appStu);
      setAuthState('in');
      setMistakeLog([]); // học sinh thật bắt đầu từ sổ tay trống, không dùng seed minh hoạ
      if(!window.OPC_LIVE || !window.OPC_LIVE.loadAttempts) return;
      window.OPC_LIVE.loadAttempts(real.id).then(function(attempts){
        if(!attempts || !attempts.length) return;
        var stats = window.PrepScholarEngine.computeStudentStatsFromAttempts(attempts);
        setStudent(function(prev){
          if(!prev || prev.id !== appStu.id) return prev; // đã đăng xuất/đổi tài khoản trong lúc đang tải
          return Object.assign({}, prev, {
            mastery: Object.assign({}, prev.mastery, stats.mastery),
            predicted: (stats.predicted != null) ? stats.predicted : prev.predicted,
            nanoMastery: stats.nanoMastery
          });
        });
        var withQ = stats.mistakeLog.map(function(m){
          return Object.assign({}, m, { question: window.PrepScholarEngine.QUESTION_BANK.filter(function(q){ return q.id === m.qId; })[0] });
        });
        setMistakeLog(withQ);
      });
    }

    // Khi OPC_LIVE sẵn sàng: thử khôi phục phiên đăng nhập cũ (sessionStorage);
    // nếu không có, hiện form đăng nhập thay vì tự vào bằng dữ liệu mẫu.
    React.useEffect(function(){
      if(!liveReady) return;
      var cancelled = false;
      window.OPC_LIVE.resumeSession().then(function(real){
        if(cancelled) return;
        if(real){ hydrateAndEnter(real); }
        else { setAuthState('form'); }
      }).catch(function(){ if(!cancelled) setAuthState('form'); });
      return function(){ cancelled = true; };
    }, [liveReady]);

    // Nạp ngân hàng đề thật (không phụ thuộc trạng thái đăng nhập — xem ghi
    // chú bảo mật trong opc-live-data.js) và thay cho dữ liệu minh hoạ nếu có.
    var bankVersionState = React.useState(0); var bankVersion = bankVersionState[0], setBankVersion = bankVersionState[1];
    var bankLiveState = React.useState(false); var bankIsLive = bankLiveState[0], setBankIsLive = bankLiveState[1];
    React.useEffect(function(){
      if(!liveReady) return;
      var cancelled = false;
      window.OPC_LIVE.loadRealQuestionBank().then(function(list){
        if(cancelled || !list || !list.length) return;
        window.PrepScholarEngine.replaceQuestionBank(list);
        setBankIsLive(true);
        setBankVersion(function(v){ return v + 1; });
      });
      return function(){ cancelled = true; };
    }, [liveReady]);

    function handleLoginSubmit(e){
      if(e && e.preventDefault) e.preventDefault();
      if(!window.OPC_LIVE) return;
      setLoginBusy(true); setLoginErr('');
      window.OPC_LIVE.loginStudent(loginUser, loginPass).then(function(res){
        setLoginBusy(false);
        if(res && res.ok){
          hydrateAndEnter(res.student);
        } else {
          setLoginErr((res && res.error) || 'Đăng nhập thất bại.');
        }
      }).catch(function(){ setLoginBusy(false); setLoginErr('Lỗi kết nối — thử lại.'); });
    }

    function handleGuestEnter(){
      setStudent(STUDENTS[0]);
      setAuthState('in');
    }

    function handleLogout(){
      if(window.OPC_LIVE) window.OPC_LIVE.logoutStudent();
      setStudent(STUDENTS[0]);
      setAuthState('form');
    }

    var tabState = React.useState('drill'); // drill | exam | mistakes | plan
    var tab = tabState[0];
    var setTab = tabState[1];

    // Trạng thái bài thi hiện tại
    var examSessionState = React.useState(null);
    var examSession = examSessionState[0];
    var setExamSession = examSessionState[1];

    var curQIdxState = React.useState(0);
    var curQIdx = curQIdxState[0];
    var setCurQIdx = curQIdxState[1];

    var userAnswersState = React.useState({});
    var userAnswers = userAnswersState[0];
    var setUserAnswers = userAnswersState[1];

    var flaggedState = React.useState({});
    var flagged = flaggedState[0];
    var setFlagged = flaggedState[1];

    var timeLeftState = React.useState(600);
    var timeLeft = timeLeftState[0];
    var setTimeLeft = timeLeftState[1];

    var scoreResultState = React.useState(null);
    var scoreResult = scoreResultState[0];
    var setScoreResult = scoreResultState[1];

    var masteryImpactState = React.useState(null);
    var masteryImpact = masteryImpactState[0];
    var setMasteryImpact = masteryImpactState[1];

    // Sổ tay câu sai (Mistake Log)
    var mistakeLogState = React.useState([
      { id: 'm1', qId: 'q_hn_03', topicKey: 'hat-nhan', topicName: 'Vật lí hạt nhân', title: 'Định luật phóng xạ & Chu kỳ bán rã', reason: 'Nhầm lẫn điều kiện phụ thuộc của chu kỳ bán rã', daysOverdue: 2, intervalDays: 1, question: window.PrepScholarEngine.QUESTION_BANK.filter(function(q){ return q.id === 'q_hn_03'; })[0] },
      { id: 'm2', qId: 'q_khi_02', topicKey: 'khi', topicName: 'Khí lí tưởng', title: 'Định luật Charles & Khí thực nghiệm', reason: 'Quên đổi độ C sang độ Kelvin', daysOverdue: 1, intervalDays: 3, question: window.PrepScholarEngine.QUESTION_BANK.filter(function(q){ return q.id === 'q_khi_02'; })[0] },
      { id: 'm3', qId: 'q_tu_03', topicKey: 'tu-truong', topicName: 'Từ trường & Cảm ứng điện từ', title: 'Khung dây quay trong từ trường', reason: 'Nhầm pha giữa suất điện động và từ thông', daysOverdue: 0, intervalDays: 7, question: window.PrepScholarEngine.QUESTION_BANK.filter(function(q){ return q.id === 'q_tu_03'; })[0] }
    ]);
    var mistakeLog = mistakeLogState[0];
    var setMistakeLog = mistakeLogState[1];

    // Đếm ngược thời gian khi đang làm bài
    React.useEffect(function(){
      if(!examSession || examSession.isSubmitted) return;
      var timer = setInterval(function(){
        setTimeLeft(function(prev){
          if(prev <= 1){
            clearInterval(timer);
            handleSubmitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return function(){ clearInterval(timer); };
    }, [examSession]);

    // Bắt đầu một bài Focused Drill
    function startDrill(topicKey, count){
      var questions = window.PrepScholarEngine.createFocusedDrill(topicKey, count || 5);
      var session = {
        type: 'drill',
        topicKey: topicKey,
        title: 'Luyện tập trọng tâm: ' + window.PrepScholarEngine.CHU_DE_MAP[topicKey].name,
        questions: questions,
        isSubmitted: false
      };
      setExamSession(session);
      setUserAnswers({});
      setFlagged({});
      setCurQIdx(0);
      setTimeLeft(questions.length * 120); // 2 phút mỗi câu
      setScoreResult(null);
      setMasteryImpact(null);
    }

    // Bắt đầu một bài Kiểm tra Chẩn đoán hoặc Thi thử
    function startExam(type){
      var questions = [];
      var title = '';
      var timeSec = 1500;

      if(type === 'diagnostic'){
        questions = window.PrepScholarEngine.createDiagnosticExam();
        title = 'Bài kiểm tra chẩn đoán năng lực toàn diện (Diagnostic Test)';
        timeSec = 25 * 60;
      } else {
        questions = window.PrepScholarEngine.QUESTION_BANK.slice(0);
        title = 'Đề thi thử chuẩn cấu trúc Bộ GD&ĐT 2025 - 2026';
        timeSec = 40 * 60;
      }

      var session = {
        type: type,
        title: title,
        questions: questions,
        isSubmitted: false
      };
      setExamSession(session);
      setUserAnswers({});
      setFlagged({});
      setCurQIdx(0);
      setTimeLeft(timeSec);
      setScoreResult(null);
      setMasteryImpact(null);
    }

    // Bắt đầu làm lại các câu sai trong Mistake Log
    function startMistakeDrill(){
      var questions = mistakeLog.map(function(m){ return m.question; }).filter(Boolean);
      if(!questions.length){
        alert('Sổ tay câu sai hiện đang trống! Tuyệt vời, bạn đã giải quyết hết câu sai.');
        return;
      }
      var session = {
        type: 'mistakes',
        title: 'Luyện lại Sổ tay câu sai (Spaced Repetition)',
        questions: questions,
        isSubmitted: false
      };
      setExamSession(session);
      setUserAnswers({});
      setFlagged({});
      setCurQIdx(0);
      setTimeLeft(questions.length * 150);
      setScoreResult(null);
      setMasteryImpact(null);
    }

    // Nộp bài và chấm điểm
    function handleSubmitExam(){
      if(!examSession) return;
      var scored = window.PrepScholarEngine.scoreExam(examSession.questions, userAnswers);
      setScoreResult(scored);
      setExamSession(function(prev){
        return Object.assign({}, prev, { isSubmitted: true });
      });

      // Tính toán cập nhật Mastery % theo PrepScholar
      var newMastery = Object.assign({}, student.mastery);
      var impactMsg = [];

      Object.keys(scored.topicStats).forEach(function(k){
        var stat = scored.topicStats[k];
        if(stat.total > 0){
          var curVal = newMastery[k] || 60;
          var pctRight = (stat.correct / stat.total) * 100;
          var change = Math.round((pctRight - curVal) * 0.25);
          var finalVal = Math.max(20, Math.min(98, curVal + change));
          newMastery[k] = finalVal;
          var delta = finalVal - curVal;
          if(delta !== 0){
            impactMsg.push(window.PrepScholarEngine.CHU_DE_MAP[k].name + ': ' + curVal + '% ➔ ' + finalVal + '% (' + (delta > 0 ? '+' : '') + delta + '%)');
          }
        }
      });

      // Tự động thêm các câu sai vào Sổ tay câu sai
      var newMistakes = mistakeLog.slice(0);
      scored.perQuestionResults.forEach(function(res){
        if(!res.isFullCorrect){
          var exists = newMistakes.some(function(m){ return m.qId === res.qId; });
          if(!exists){
            newMistakes.unshift({
              id: 'm_' + Date.now() + '_' + res.qId,
              qId: res.qId,
              topicKey: res.question.topicKey,
              topicName: res.question.topicName,
              title: res.question.subtopic || 'Câu sai cần luyện lại',
              reason: 'Cần củng cố phương pháp giải và ghi nhớ công thức',
              daysOverdue: 0,
              intervalDays: 1,
              question: res.question
            });
          }
        } else {
          // Nếu làm đúng trong chế độ sửa câu sai, tăng tier hoặc xoá khỏi log
          if(examSession.type === 'mistakes'){
            newMistakes = newMistakes.filter(function(m){ return m.qId !== res.qId; });
          }
        }
      });

      setMistakeLog(newMistakes);

      // Cập nhật lại học sinh
      var avgMastery = Math.round((newMastery['nhiet'] + newMastery['khi'] + newMastery['tu-truong'] + newMastery['hat-nhan']) / 4);
      var newPredicted = Math.round((5.0 + (avgMastery / 100) * 4.8) * 10) / 10;

      setStudent(function(prev){
        return Object.assign({}, prev, {
          mastery: newMastery,
          predicted: newPredicted
        });
      });

      if(impactMsg.length){
        setMasteryImpact(impactMsg.join(' · '));
      }

      // Học sinh đăng nhập thật: lưu kết quả lượt luyện này vào Firestore rồi
      // tính lại mastery/điểm dự đoán/Sổ tay câu sai từ TOÀN BỘ lịch sử thật
      // (ghi đè lên số liệu ước lượng tức thời ở trên ngay khi tải xong).
      if(student.isLive && window.OPC_LIVE && window.OPC_LIVE.saveAttempt){
        var studentId = student.id;
        var wrongQuestions = scored.perQuestionResults.filter(function(r){ return !r.isFullCorrect; }).map(function(r){
          return { qId: r.question.id, topicKey: r.question.topicKey, topicName: r.question.topicName, subtopic: r.question.subtopic, nanoId: r.question.nanoId || null, baiKey: r.question.baiKey || null };
        });
        var rightQuestions = scored.perQuestionResults.filter(function(r){ return r.isFullCorrect; }).map(function(r){
          return { qId: r.question.id, nanoId: r.question.nanoId || null, baiKey: r.question.baiKey || null };
        });
        var attemptRecord = {
          type: examSession.type,
          topicKey: examSession.topicKey || null,
          scaledScore10: scored.scaledScore10,
          correctCount: scored.correctCount,
          totalQuestions: scored.totalQuestions,
          topicStats: scored.topicStats,
          wrongQuestions: wrongQuestions,
          rightQuestions: rightQuestions
        };
        window.OPC_LIVE.saveAttempt(studentId, attemptRecord).then(function(res){
          if(!res || !res.ok) return null;
          return window.OPC_LIVE.loadAttempts(studentId);
        }).then(function(attempts){
          if(!attempts) return;
          var stats = window.PrepScholarEngine.computeStudentStatsFromAttempts(attempts);
          setStudent(function(prev){
            if(!prev || prev.id !== studentId) return prev;
            return Object.assign({}, prev, {
              mastery: Object.assign({}, prev.mastery, stats.mastery),
              predicted: (stats.predicted != null) ? stats.predicted : prev.predicted,
              nanoMastery: stats.nanoMastery
            });
          });
          var withQ = stats.mistakeLog.map(function(m){
            return Object.assign({}, m, { question: window.PrepScholarEngine.QUESTION_BANK.filter(function(q){ return q.id === m.qId; })[0] });
          });
          setMistakeLog(withQ);
        }).catch(function(err){ console.error('Lỗi lưu/tải lại lịch sử luyện tập:', err); });
      }
    }

    // Học sinh trả lời Phần I
    function handleAnswerPart1(qId, key){
      setUserAnswers(function(prev){
        var next = Object.assign({}, prev);
        next[qId] = key;
        return next;
      });
    }

    // Học sinh trả lời Phần II (Đúng/Sai)
    function handleAnswerPart2(qId, stmtKey, val){
      setUserAnswers(function(prev){
        var next = Object.assign({}, prev);
        var qMap = Object.assign({}, next[qId] || {});
        qMap[stmtKey] = val;
        next[qId] = qMap;
        return next;
      });
    }

    // Học sinh trả lời Phần III (Điền đáp số)
    function handleAnswerPart3(qId, val){
      setUserAnswers(function(prev){
        var next = Object.assign({}, prev);
        next[qId] = val;
        return next;
      });
    }

    // Đổi cờ câu hỏi
    function toggleFlag(qId){
      setFlagged(function(prev){
        var next = Object.assign({}, prev);
        next[qId] = !next[qId];
        return next;
      });
    }

    // Tính overall mastery
    var avgMastery = Math.round((student.mastery['nhiet'] + student.mastery['khi'] + student.mastery['tu-truong'] + student.mastery['hat-nhan']) / 4);

    // ================= Màn hình đăng nhập =================
    // Chỉ vào thẳng giao diện luyện tập khi đã xác định xong trạng thái đăng
    // nhập ('in'). Khi đang dò phiên cũ ('checking') hoặc chưa đăng nhập
    // ('form'), hiện màn hình riêng — không hiện dữ liệu của học sinh khác.
    if(authState !== 'in'){
      if(authState === 'checking'){
        return h('div', { className: 'ps-wrapper', style: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '320px' } },
          h('p', { style: { color: 'var(--ink-2)', fontSize: '0.9rem' } }, 'Đang kiểm tra phiên đăng nhập…'));
      }
      return h('div', { className: 'ps-wrapper', style: { maxWidth: '420px', margin: '0 auto' } },
        h('div', { className: 'ps-login-card', style: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '14px', padding: '28px 26px', boxShadow: 'var(--shadow)' } },
          h('h3', { style: { marginBottom: '6px' } }, '⚡ Đăng nhập luyện thi PrepScholar'),
          h('p', { style: { fontSize: '0.84rem', color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: '18px' } },
            'Dùng đúng tên đăng nhập và mật khẩu thầy cô đã cấp khi thêm em vào hệ thống.'),
          h('form', { onSubmit: handleLoginSubmit },
            h('div', { className: 'sm-field', style: { marginBottom: '12px' } },
              h('label', null, 'Tên đăng nhập'),
              h('input', { type: 'text', autoCapitalize: 'off', autoCorrect: 'off', value: loginUser, onChange: function(e){ setLoginUser(e.target.value); }, placeholder: 'vd. vanan12' })),
            h('div', { className: 'sm-field', style: { marginBottom: '14px' } },
              h('label', null, 'Mật khẩu'),
              h('input', { type: 'password', value: loginPass, onChange: function(e){ setLoginPass(e.target.value); }, placeholder: '••••••' })),
            loginErr ? h('div', { className: 'banner warn', style: { marginBottom: '12px' } }, h('span', null, '⚠️'), h('div', null, loginErr)) : null,
            h('button', { type: 'submit', className: 'btn btn-primary', style: { width: '100%' }, disabled: loginBusy || !liveReady }, loginBusy ? 'Đang đăng nhập…' : (liveReady ? 'Đăng nhập' : 'Đang kết nối…'))
          ),
          h('div', { style: { textAlign: 'center', margin: '16px 0', color: 'var(--muted)', fontSize: '0.78rem' } }, '— hoặc —'),
          h('button', { type: 'button', className: 'btn btn-secondary', style: { width: '100%' }, onClick: handleGuestEnter }, '👀 Học thử với dữ liệu minh hoạ'),
          h('p', { style: { fontSize: '0.74rem', color: 'var(--muted)', marginTop: '14px', lineHeight: 1.5 } },
            'Chưa có tài khoản? Liên hệ thầy cô để được cấp tên đăng nhập và mật khẩu.')
        )
      );
    }

    return h('div', { className: 'ps-wrapper', key: 'bank-' + bankVersion },
      bankIsLive ? null : h('div', { className: 'banner warn', style: { marginBottom: '14px' } },
        h('span', null, 'ℹ️'), h('div', null, 'Ngân hàng đề thật chưa có câu hỏi phù hợp — đang hiển thị câu hỏi minh hoạ để bạn xem trước giao diện.')),
      // 1. Profile Bar
      h('div', { className: 'ps-profile-bar' },
        h('div', { className: 'ps-student-picker' },
          h('div', { className: 'ps-avatar-badge' }, student.name.charAt(0)),
          h('div', { className: 'ps-student-meta' },
            h('h4', null, student.name),
            h('p', null, 'Tài khoản luyện thi cá nhân hóa · ' + student.email)
          )
        ),
        student.isLive
          ? h('button', { type: 'button', className: 'btn btn-secondary', onClick: handleLogout }, '🚪 Đăng xuất')
          : h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
              h('label', { style: { fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 } }, 'Đổi học sinh (minh hoạ):'),
              h('select', {
                className: 'ps-student-select',
                value: student.id,
                onChange: function(e){
                  var found = STUDENTS.filter(function(s){ return s.id === e.target.value; })[0];
                  if(found){
                    setStudent(found);
                    setExamSession(null);
                    setScoreResult(null);
                  }
                }
              },
                STUDENTS.map(function(s){
                  return h('option', { key: s.id, value: s.id }, s.name + ' (Dự đoán: ' + s.predicted + ')');
                })
              )
            )
      ),

      // 2. PrepScholar Core Metrics Grid
      h('div', { className: 'ps-metrics-grid' },
        h('div', { className: 'ps-metric-card accent' },
          h('div', { className: 'ps-metric-label' }, 'Dự đoán điểm thi'),
          h('div', { className: 'ps-metric-val' },
            student.predicted.toFixed(1),
            h('span', { style: { fontSize: '0.9rem', color: 'var(--muted)' } }, '/ 10.0')
          ),
          h('div', { className: 'ps-metric-sub' }, 'Dựa trên mô hình chuẩn hoá của PrepScholar')
        ),
        h('div', { className: 'ps-metric-card good' },
          h('div', { className: 'ps-metric-label' }, 'Mục tiêu điểm số'),
          h('div', { className: 'ps-metric-val' },
            student.target.toFixed(1),
            h('span', { style: { fontSize: '0.9rem', color: 'var(--muted)' } }, '+')
          ),
          h('div', { className: 'ps-metric-sub' }, 'Còn thiếu ' + Math.max(0, (student.target - student.predicted)).toFixed(1) + ' điểm để đạt mục tiêu')
        ),
        h('div', { className: 'ps-metric-card ' + (avgMastery < 50 ? 'critical' : (avgMastery < 75 ? 'warning' : 'good')) },
          h('div', { className: 'ps-metric-label' }, 'Độ thành thạo toàn diện'),
          h('div', { className: 'ps-metric-val' }, avgMastery + '%'),
          h('div', { className: 'ps-metric-sub' }, avgMastery < 75 ? 'Cần củng cố thêm 2 chuyên đề' : 'Đã đạt mức độ an toàn cao')
        ),
        h('div', { className: 'ps-metric-card warning' },
          h('div', { className: 'ps-metric-label' }, 'Sổ tay câu sai đến hạn'),
          h('div', { className: 'ps-metric-val' },
            mistakeLog.length,
            h('span', { style: { fontSize: '0.9rem', color: 'var(--muted)' } }, 'câu')
          ),
          h('div', { className: 'ps-metric-sub' }, 'Chu kỳ lặp lại giãn cách 1-3-7 ngày')
        )
      ),

      // 3. Navigation Tabs
      h('div', { className: 'ps-nav-tabs' },
        h('button', {
          type: 'button',
          className: 'ps-tab-btn ' + (tab === 'map' ? 'active' : ''),
          onClick: function(){ setTab('map'); setExamSession(null); }
        }, '🧬 Bản đồ kiến thức'),
        h('button', {
          type: 'button',
          className: 'ps-tab-btn ' + (tab === 'drill' ? 'active' : ''),
          onClick: function(){ setTab('drill'); setExamSession(null); }
        }, '🎯 Luyện tập trọng tâm (Focused Drill)'),
        h('button', {
          type: 'button',
          className: 'ps-tab-btn ' + (tab === 'exam' ? 'active' : ''),
          onClick: function(){ setTab('exam'); setExamSession(null); }
        }, '⏱️ Thi thử & Chẩn đoán'),
        h('button', {
          type: 'button',
          className: 'ps-tab-btn ' + (tab === 'mistakes' ? 'active' : ''),
          onClick: function(){ setTab('mistakes'); setExamSession(null); }
        },
          '🔄 Sổ tay câu sai (Mistake Review)',
          h('span', { className: 'ps-tab-badge' }, mistakeLog.length)
        ),
        h('button', {
          type: 'button',
          className: 'ps-tab-btn ' + (tab === 'plan' ? 'active' : ''),
          onClick: function(){ setTab('plan'); setExamSession(null); }
        }, '📋 Lộ trình học tuần này')
      ),

      // 4. Main Body Content based on Tab & Exam State
      examSession ? (
        // MÀN HÌNH ĐANG LÀM BÀI HOẶC XEM KẾT QUẢ
        examSession.isSubmitted && scoreResult ? (
          // KẾT QUẢ VÀ LỜI GIẢI CHI TIẾT
          h('div', { className: 'ps-exam-screen' },
            h('div', { className: 'ps-result-banner' },
              h('div', { style: { fontSize: '1rem', color: 'var(--muted)', fontWeight: 700, marginBottom: '6px' } }, 'BÁO CÁO KẾT QUẢ THÍCH ỨNG PREPSCHOLAR'),
              h('div', { className: 'ps-result-score-val' }, scoreResult.scaledScore10.toFixed(2) + ' / 10'),
              h('div', { className: 'ps-result-sub' },
                'Đúng ' + scoreResult.correctCount + ' / ' + scoreResult.totalQuestions + ' câu · ' +
                'Điểm đạt được: ' + scoreResult.totalEarnedScore.toFixed(2) + ' / ' + scoreResult.totalMaxScore.toFixed(2)
              ),
              masteryImpact ? h('div', { className: 'ps-impact-pill' }, '⚡ Cập nhật năng lực: ' + masteryImpact) : null,
              h('div', { style: { marginTop: '16px', display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' } },
                h('button', {
                  type: 'button',
                  className: 'btn btn-primary',
                  onClick: function(){ setExamSession(null); setTab('drill'); }
                }, 'Tiếp tục bài Drill tiếp theo ➔'),
                h('button', {
                  type: 'button',
                  className: 'btn btn-secondary',
                  onClick: function(){ setExamSession(null); setTab('mistakes'); }
                }, 'Xem Sổ tay câu sai (' + mistakeLog.length + ')')
              )
            ),

            h('h4', { style: { fontFamily: 'Literata, serif', fontSize: '1.2rem', marginBottom: '16px' } }, 'Phân tích chi tiết từng câu & Lời giải PrepScholar:'),

            // Danh sách lời giải chi tiết
            scoreResult.perQuestionResults.map(function(item, idx){
              var q = item.question;
              return h('div', { key: idx, className: 'ps-solution-card ' + (item.isFullCorrect ? 'correct' : 'wrong') },
                h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' } },
                  h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                    h('b', { style: { fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.95rem' } }, 'Câu ' + item.idx + ':'),
                    h('span', { className: 'ps-q-badge' }, 'Phần ' + q.part),
                    h('span', { className: 'ps-q-badge level-' + q.level.toLowerCase() }, q.level),
                    h('span', { style: { fontSize: '0.8rem', color: 'var(--muted)' } }, q.topicName + ' · ' + q.subtopic)
                  ),
                  h('span', { style: { fontWeight: 700, fontSize: '0.85rem', color: item.isFullCorrect ? 'var(--good)' : 'var(--critical)' } },
                    item.isFullCorrect ? '✓ Đúng hoàn toàn (+' + item.maxPt + 'đ)' : '✗ Chưa chính xác (+' + item.earnedPt.toFixed(2) + '/' + item.maxPt + 'đ)'
                  )
                ),

                h('div', { style: { marginTop: '10px', fontSize: '0.92rem', lineHeight: 1.6 } },
                  renderLatexText(q.stem)
                ),
                renderQuestionImages(q),

                h('div', { className: 'ps-solution-body' },
                  h('div', { style: { fontWeight: 700, color: 'var(--accent-strong)', marginBottom: '6px' } }, '💡 Lời giải chi tiết:'),
                  h('div', { style: { whiteSpace: 'pre-wrap' } }, renderLatexText(q.loiGiai)),
                  q.trapTip ? h('div', { className: 'ps-trap-tip' },
                    h('b', null, '⚠️ Bẫy thường gặp (PrepScholar Note): '),
                    q.trapTip
                  ) : null
                )
              );
            })
          )
        ) : (
          // ĐANG LÀM BÀI (ACTIVE TAKING EXAM)
          h('div', { className: 'ps-exam-screen' },
            h('div', { className: 'ps-exam-header' },
              h('div', { className: 'ps-exam-title-group' },
                h('h3', null, examSession.title),
                h('p', null, 'Câu ' + (curQIdx + 1) + ' / ' + examSession.questions.length + ' · Chọn câu trả lời và chuyển tiếp')
              ),
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
                h('div', { className: 'ps-exam-timer ' + (timeLeft < 180 ? 'urgent' : '') },
                  '⏱️ ' + formatTime(timeLeft)
                ),
                h('button', {
                  type: 'button',
                  className: 'btn btn-primary',
                  onClick: function(){
                    if(confirm('Bạn có chắc chắn muốn nộp bài để chấm điểm ngay?')){
                      handleSubmitExam();
                    }
                  }
                }, 'Nộp bài ➔')
              )
            ),

            // Question Navigator
            h('div', { className: 'ps-q-nav-grid' },
              examSession.questions.map(function(q, idx){
                var isAnswered = false;
                if(q.part === 'I') isAnswered = (userAnswers[q.id] !== undefined);
                else if(q.part === 'II') isAnswered = (userAnswers[q.id] && Object.keys(userAnswers[q.id]).length > 0);
                else if(q.part === 'III') isAnswered = (userAnswers[q.id] !== undefined && userAnswers[q.id] !== '');

                return h('button', {
                  key: idx,
                  type: 'button',
                  className: 'ps-q-nav-btn ' +
                    (idx === curQIdx ? 'current ' : '') +
                    (isAnswered ? 'answered ' : '') +
                    (flagged[q.id] ? 'flagged' : ''),
                  onClick: function(){ setCurQIdx(idx); }
                }, idx + 1);
              })
            ),

            // Question Body
            (function(){
              var curQ = examSession.questions[curQIdx];
              if(!curQ) return null;

              return h('div', { className: 'ps-question-box' },
                h('div', { className: 'ps-q-meta-row' },
                  h('div', { className: 'ps-q-badges' },
                    h('span', { className: 'ps-q-badge' }, 'Phần ' + curQ.part),
                    h('span', { className: 'ps-q-badge level-' + curQ.level.toLowerCase() }, curQ.level),
                    h('span', { style: { fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 } }, curQ.topicName + ' · ' + curQ.subtopic)
                  ),
                  h('button', {
                    type: 'button',
                    className: 'btn btn-secondary',
                    style: { padding: '4px 10px', fontSize: '0.78rem' },
                    onClick: function(){ toggleFlag(curQ.id); }
                  }, flagged[curQ.id] ? '🚩 Đã cắm cờ' : '🏳️ Đánh dấu xem lại')
                ),

                h('div', { className: 'ps-q-stem' },
                  renderLatexText(curQ.stem)
                ),
                renderQuestionImages(curQ),

                // Choice logic based on Part
                curQ.part === 'I' ? (
                  h('div', { className: 'ps-choice-list' },
                    (curQ.options || []).map(function(opt){
                      var isSel = (userAnswers[curQ.id] === opt.key);
                      return h('div', {
                        key: opt.key,
                        className: 'ps-choice-item ' + (isSel ? 'selected' : ''),
                        onClick: function(){ handleAnswerPart1(curQ.id, opt.key); }
                      },
                        h('div', { className: 'ps-choice-key' }, opt.key),
                        h('div', null, renderLatexText(opt.text))
                      );
                    })
                  )
                ) : (curQ.part === 'II' ? (
                  h('table', { className: 'ps-stmt-table' },
                    h('tbody', null,
                      (curQ.statements || []).map(function(st){
                        var ansVal = (userAnswers[curQ.id] || {})[st.key];
                        return h('tr', { key: st.key, className: 'ps-stmt-row' },
                          h('td', { className: 'ps-stmt-text' },
                            h('span', { className: 'ps-stmt-key' }, st.key + ')'),
                            renderLatexText(st.text)
                          ),
                          h('td', { className: 'ps-stmt-actions' },
                            h('div', { className: 'ps-stmt-toggle' },
                              h('button', {
                                type: 'button',
                                className: 'ps-stmt-btn ' + (ansVal === true ? 'active-true' : ''),
                                onClick: function(){ handleAnswerPart2(curQ.id, st.key, true); }
                              }, 'ĐÚNG'),
                              h('button', {
                                type: 'button',
                                className: 'ps-stmt-btn ' + (ansVal === false ? 'active-false' : ''),
                                onClick: function(){ handleAnswerPart2(curQ.id, st.key, false); }
                              }, 'SAI')
                            )
                          )
                        );
                      })
                    )
                  )
                ) : (
                  h('div', { className: 'ps-short-box' },
                    h('div', { style: { fontSize: '0.85rem', color: 'var(--ink-2)' } }, 'Nhập đáp số (dạng số nguyên hoặc số thập phân):'),
                    h('div', { className: 'ps-short-input-row' },
                      h('input', {
                        type: 'text',
                        className: 'ps-short-input',
                        placeholder: 'Ví dụ: 2.5',
                        value: userAnswers[curQ.id] || '',
                        onChange: function(e){ handleAnswerPart3(curQ.id, e.target.value); }
                      }),
                      curQ.unit ? h('span', { className: 'ps-short-unit' }, curQ.unit) : null
                    )
                  )
                ))
              );
            })(),

            // Action Buttons
            h('div', { className: 'ps-exam-controls' },
              h('button', {
                type: 'button',
                className: 'btn btn-secondary',
                disabled: curQIdx === 0,
                onClick: function(){ setCurQIdx(function(i){ return Math.max(0, i - 1); }); }
              }, '← Câu trước'),
              h('button', {
                type: 'button',
                className: 'btn btn-primary',
                onClick: function(){
                  if(curQIdx < examSession.questions.length - 1){
                    setCurQIdx(function(i){ return i + 1; });
                  } else {
                    if(confirm('Bạn đang ở câu cuối cùng. Nộp bài ngay để chấm điểm?')){
                      handleSubmitExam();
                    }
                  }
                }
              }, curQIdx === examSession.questions.length - 1 ? 'Nộp bài & Chấm điểm ➔' : 'Câu tiếp theo →')
            )
          )
        )
      ) : (
        // MÀN HÌNH TỔNG QUAN CÁC TAB
        (function(){
          if(tab === 'map'){
            // TAB "BẢN ĐỒ KIẾN THỨC" — phân rã mức nano, mô phỏng cơ chế Squirrel AI:
            // đo & hiển thị mức thành thạo tới từng đơn vị kiến thức nhỏ nhất,
            // để việc chẩn đoán điểm yếu không còn phụ thuộc vào kinh nghiệm
            // chấm bài của một giáo viên giỏi.
            var hasNanoMap = window.PrepScholarEngine.getKnowledgeMap;
            if(!hasNanoMap){
              return h('div', { style: { fontSize: '0.86rem', color: 'var(--muted)' } }, 'Chưa nạp được dữ liệu bản đồ kiến thức.');
            }
            var knowledgeMap = window.PrepScholarEngine.getKnowledgeMap(student.mastery, student.nanoMastery);
            var weakest = window.PrepScholarEngine.getWeakestNanoPoints(student.mastery, 5, student.nanoMastery);

            return h('div', null,
              h('div', { style: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '14px', padding: '18px 20px', marginBottom: '18px' } },
                h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
                  h('span', { style: { fontSize: '1.4rem' } }, '🧬'),
                  h('div', null,
                    h('h4', { style: { margin: 0, fontSize: '1.05rem', fontWeight: 700 } }, 'Kiến thức được phân rã đến mức nhỏ nhất (nano-point)'),
                    h('p', { style: { margin: '3px 0 0', fontSize: '0.84rem', color: 'var(--ink-2)', lineHeight: 1.55 } },
                      'Mỗi ô vuông bên dưới là một đơn vị kiến thức nhỏ nhất mà hệ thống đo riêng — không còn chấm chung theo cả chương. Ô đỏ = còn yếu, ô vàng = đang cải thiện, ô xanh = đã vững.'
                    )
                  )
                )
              ),

              weakest.length ? h('div', { style: { marginBottom: '18px' } },
                h('h3', { style: { fontFamily: 'Literata, serif', fontSize: '1.05rem', marginBottom: '4px' } }, '5 nano-point yếu nhất hiện tại'),
                h('p', { style: { fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '10px' } }, 'Hệ thống tự xếp hạng — không cần giáo viên rà tay từng học sinh.'),
                h('div', { className: 'ps-nano-weak-list' },
                  weakest.map(function(n){
                    var cls = n.mastery < 50 ? 'critical' : (n.mastery < 75 ? 'warning' : 'good');
                    return h('div', { key: n.id, className: 'ps-nano-weak-row' },
                      h('div', { style: { flex: 1, minWidth: 0 } },
                        h('div', { className: 'ps-nano-weak-name' }, n.name),
                        h('div', { className: 'ps-nano-weak-sub' }, n.topicName + ' · ' + n.baiName)
                      ),
                      h('span', { className: 'ps-nano-weak-pct ' + cls }, n.mastery + '%'),
                      h('button', {
                        type: 'button',
                        className: 'btn btn-secondary ps-drill-btn',
                        onClick: function(){ setTab('drill'); startDrill(n.topicKey, 5); }
                      }, 'Luyện ngay')
                    );
                  })
                )
              ) : null,

              h('div', { className: 'ps-nano-map' },
                knowledgeMap.map(function(t){
                  return h('div', { key: t.topicKey, className: 'ps-nano-topic' },
                    h('div', { className: 'ps-nano-topic-head' },
                      h('span', null, t.icon + ' ' + t.topicName),
                      h('span', { className: 'ps-nano-topic-mastery' }, t.mastery + '%')
                    ),
                    h('div', { className: 'ps-nano-bai-grid' },
                      t.bais.map(function(b){
                        return h('div', { key: b.key, className: 'ps-nano-bai' },
                          h('div', { className: 'ps-nano-bai-name' }, b.name + ' · ' + b.mastery + '%'),
                          h('div', { className: 'ps-nano-tile-row' },
                            b.nanos.map(function(n){
                              var cls = n.mastery < 50 ? 'crit' : (n.mastery < 75 ? 'warn' : 'good');
                              return h('div', { key: n.id, className: 'ps-nano-tile ' + cls, title: n.name + ' — ' + n.mastery + '%' });
                            })
                          )
                        );
                      })
                    )
                  );
                })
              )
            );
          } else if(tab === 'drill'){
            // TAB 1: LUYỆN TẬP TRỌNG TÂM
            return h('div', null,
              h('div', { style: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '14px', padding: '18px 20px', marginBottom: '18px' } },
                h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
                  h('span', { style: { fontSize: '1.4rem' } }, '🎯'),
                  h('div', null,
                    h('h4', { style: { margin: 0, fontSize: '1.05rem', fontWeight: 700 } }, 'Khuyến nghị PrepScholar tuần này'),
                    h('p', { style: { margin: '3px 0 0', fontSize: '0.84rem', color: 'var(--ink-2)' } },
                      'Điểm yếu lớn nhất của bạn hiện tại là ',
                      h('b', { style: { color: 'var(--critical)' } }, 'Vật lí hạt nhân (' + student.mastery['hat-nhan'] + '%)'),
                      '. Hệ thống đề xuất làm ngay 1 bài Drill 5 câu để nâng độ thành thạo lên trên 55%.'
                    )
                  )
                ),
                h('div', { style: { marginTop: '12px' } },
                  h('button', {
                    type: 'button',
                    className: 'btn btn-primary',
                    onClick: function(){ startDrill('hat-nhan', 5); }
                  }, 'Bắt đầu bài Drill: Vật lí hạt nhân (5 câu) ➔')
                )
              ),

              h('h3', { style: { fontFamily: 'Literata, serif', fontSize: '1.2rem', marginBottom: '8px' } }, 'Chọn chuyên đề để luyện tập tập trung:'),
              h('p', { style: { fontSize: '0.84rem', color: 'var(--muted)', marginBottom: '16px' } }, 'Hệ thống tự động điều phối độ khó (M1 - M4) theo năng lực hiện tại của bạn:'),

              h('div', { className: 'ps-topic-grid' },
                Object.keys(window.PrepScholarEngine.CHU_DE_MAP).map(function(key){
                  var t = window.PrepScholarEngine.CHU_DE_MAP[key];
                  var val = student.mastery[key] || 50;
                  var statusClass = val < 50 ? 'critical' : (val < 75 ? 'warning' : 'good');
                  var statusLabel = val < 50 ? '‼ Cần củng cố gấp' : (val < 75 ? '! Đang cải thiện' : '✓ Đã thuần thục');

                  return h('div', { key: key, className: 'ps-topic-card' },
                    h('div', null,
                      h('div', { className: 'ps-topic-card-top' },
                        h('div', { className: 'ps-topic-title' }, t.icon + ' ' + t.name),
                        h('span', { className: 'ps-topic-status-badge ' + statusClass }, statusLabel)
                      ),
                      h('div', { className: 'ps-meter-bar' },
                        h('div', { className: 'ps-meter-fill ' + statusClass, style: { width: val + '%' } })
                      ),
                      h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'IBM Plex Mono, monospace' } },
                        h('span', null, 'Độ vững: ' + val + '%'),
                        h('span', null, 'Mục tiêu: 85%+')
                      )
                    ),

                    h('div', { className: 'ps-topic-card-actions' },
                      h('span', { style: { fontSize: '0.8rem', color: 'var(--ink-2)' } }, 'Bộ câu hỏi chuẩn 2025'),
                      h('div', { style: { display: 'flex', gap: '8px' } },
                        h('button', {
                          type: 'button',
                          className: 'btn btn-secondary ps-drill-btn',
                          onClick: function(){ startDrill(key, 5); }
                        }, 'Drill 5 câu'),
                        h('button', {
                          type: 'button',
                          className: 'btn btn-primary ps-drill-btn',
                          onClick: function(){ startDrill(key, 10); }
                        }, 'Drill 10 câu ➔')
                      )
                    )
                  );
                })
              )
            );
          } else if(tab === 'exam'){
            // TAB 2: KIỂM TRA & THI THỬ
            return h('div', null,
              h('div', { className: 'ps-topic-grid' },
                h('div', { className: 'ps-topic-card' },
                  h('div', null,
                    h('div', { className: 'ps-topic-title' }, '🎯 Bài kiểm tra chẩn đoán (Diagnostic Test)'),
                    h('p', { style: { fontSize: '0.86rem', color: 'var(--ink-2)', lineHeight: 1.6, marginTop: '8px' } },
                      'Bài kiểm tra 12 câu bao phủ đủ cả 4 chuyên đề cốt lõi. Giúp xác định chính xác điểm bắt đầu và phân loại điểm mạnh/yếu theo phương pháp PrepScholar.'
                    ),
                    h('div', { style: { marginTop: '12px', fontSize: '0.8rem', color: 'var(--muted)' } },
                      '⏱️ Thời gian: 25 phút · 12 câu hỏi (Phần I, II, III)'
                    )
                  ),
                  h('div', { className: 'ps-topic-card-actions' },
                    h('span', { style: { fontSize: '0.8rem', color: 'var(--good)', fontWeight: 700 } }, '✓ Khuyến nghị đầu vào'),
                    h('button', {
                      type: 'button',
                      className: 'btn btn-primary',
                      onClick: function(){ startExam('diagnostic'); }
                    }, 'Vào làm bài chẩn đoán ➔')
                  )
                ),

                h('div', { className: 'ps-topic-card' },
                  h('div', null,
                    h('div', { className: 'ps-topic-title' }, '⏱️ Đề thi thử chuẩn Bộ GD&ĐT'),
                    h('p', { style: { fontSize: '0.86rem', color: 'var(--ink-2)', lineHeight: 1.6, marginTop: '8px' } },
                      'Mô phỏng 100% không khí phòng thi thật với đồng hồ đếm ngược, cấu trúc 3 phần chính thức: Trắc nghiệm 4 lựa chọn, Đúng/Sai 4 lệnh, và Trả lời ngắn số học.'
                    ),
                    h('div', { style: { marginTop: '12px', fontSize: '0.8rem', color: 'var(--muted)' } },
                      '⏱️ Thời gian: 40 phút · Đầy đủ lời giải chi tiết'
                    )
                  ),
                  h('div', { className: 'ps-topic-card-actions' },
                    h('span', { style: { fontSize: '0.8rem', color: 'var(--accent-strong)', fontWeight: 700 } }, '⭐ Thực chiến điểm cao'),
                    h('button', {
                      type: 'button',
                      className: 'btn btn-primary',
                      onClick: function(){ startExam('mock'); }
                    }, 'Vào thi thử chuẩn Bộ ➔')
                  )
                )
              )
            );
          } else if(tab === 'mistakes'){
            // TAB 3: SỔ TAY CÂU SAI & LẶP LẠI GIÃN CÁCH
            return h('div', null,
              h('div', { style: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '14px', padding: '18px 20px', marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' } },
                h('div', null,
                  h('h4', { style: { margin: 0, fontSize: '1.05rem', fontWeight: 700 } }, 'Hệ thống lặp lại giãn cách (Adaptive Spaced Repetition)'),
                  h('p', { style: { margin: '4px 0 0', fontSize: '0.84rem', color: 'var(--ink-2)' } },
                    'Mọi câu bạn trả lời sai sẽ được xếp vào chu kỳ ôn tập: 1 ngày ➔ 3 ngày ➔ 7 ngày ➔ 14 ngày cho đến khi bạn thuần thục hoàn toàn!'
                  )
                ),
                h('button', {
                  type: 'button',
                  className: 'btn btn-primary',
                  onClick: startMistakeDrill
                }, '⚡ Luyện lại các câu sai ngay ➔')
              ),

              !mistakeLog.length ? (
                h('div', { style: { textAlign: 'center', padding: '40px', background: 'var(--surface)', borderRadius: '14px', border: '1px solid var(--line)' } },
                  h('div', { style: { fontSize: '2.5rem', marginBottom: '10px' } }, '🎉'),
                  h('h4', null, 'Bạn không còn câu sai nào cần ôn tập!'),
                  h('p', { style: { color: 'var(--muted)', fontSize: '0.85rem', marginTop: '4px' } }, 'Hãy làm thêm một bài Drill hoặc Thi thử để tiếp tục bứt phá điểm số.')
                )
              ) : (
                mistakeLog.map(function(item, idx){
                  return h('div', { key: idx, className: 'ps-solution-card wrong' },
                    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' } },
                      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                        h('span', { className: 'ps-q-badge' }, item.topicName),
                        h('b', { style: { fontSize: '0.95rem' } }, item.title)
                      ),
                      h('span', { style: { fontSize: '0.78rem', color: 'var(--critical)', fontWeight: 700, background: 'color-mix(in srgb, var(--critical) 12%, transparent)', padding: '3px 8px', borderRadius: '5px' } },
                        item.daysOverdue > 0 ? '‼ Quá hạn ' + item.daysOverdue + ' ngày' : '! Đến hạn ôn tập hôm nay'
                      )
                    ),
                    h('p', { style: { fontSize: '0.86rem', color: 'var(--ink-2)', margin: '8px 0 4px' } },
                      h('b', null, 'Nguyên nhân sai lầm: '), item.reason
                    ),
                    h('div', { style: { fontSize: '0.76rem', color: 'var(--muted)', fontFamily: 'IBM Plex Mono, monospace' } },
                      'Chu kỳ giãn cách: ' + item.intervalDays + ' ngày'
                    )
                  );
                })
              )
            );
          } else {
            // TAB 4: LỘ TRÌNH HỌC TUẦN NÀY (WEEKLY STUDY PLAN)
            return h('div', null,
              h('div', { style: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '14px', padding: '20px' } },
                h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px', borderBottom: '1px solid var(--line)', paddingBottom: '12px' } },
                  h('div', null,
                    h('h4', { style: { margin: 0, fontSize: '1.05rem', fontWeight: 700 } }, 'Kế hoạch học tập tuần 14 · Mục tiêu: ' + student.target + '+'),
                    h('p', { style: { margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--muted)' } }, 'Đã học: ' + student.hours + ' / 5.0 giờ tuần này')
                  ),
                  h('span', { style: { fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-strong)' } }, 'Hoàn thành: 2 / 4 nhiệm vụ')
                ),

                h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
                  h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px', background: 'var(--surface-2)', borderRadius: '10px' } },
                    h('span', { style: { color: 'var(--good)', fontWeight: 700 } }, '✓'),
                    h('div', { style: { flex: 1 } },
                      h('div', { style: { fontWeight: 600, fontSize: '0.9rem', textDecoration: 'line-through', color: 'var(--muted)' } }, '1. Bài kiểm tra chẩn đoán đầu tuần'),
                      h('div', { style: { fontSize: '0.76rem', color: 'var(--muted)' } }, 'Đạt 7.8/10 · Đã phân tích 4 chuyên đề')
                    )
                  ),
                  h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px', background: 'var(--surface-2)', borderRadius: '10px' } },
                    h('span', { style: { color: 'var(--good)', fontWeight: 700 } }, '✓'),
                    h('div', { style: { flex: 1 } },
                      h('div', { style: { fontWeight: 600, fontSize: '0.9rem', textDecoration: 'line-through', color: 'var(--muted)' } }, '2. Drill trọng tâm: Vật lí nhiệt (M3-M4)'),
                      h('div', { style: { fontSize: '0.76rem', color: 'var(--muted)' } }, 'Đạt 85% độ vững · Nâng mức lên Thành thạo')
                    )
                  ),
                  h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px', background: 'var(--surface-2)', borderRadius: '10px', border: '1px solid var(--accent)' } },
                    h('span', { style: { color: 'var(--critical)', fontWeight: 700 } }, '‼'),
                    h('div', { style: { flex: 1 } },
                      h('div', { style: { fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink)' } }, '3. Drill trọng tâm: Vật lí hạt nhân (Ưu tiên số 1)'),
                      h('div', { style: { fontSize: '0.78rem', color: 'var(--ink-2)', marginTop: '2px' } }, 'Cần làm 1 bài Drill 5 câu để vượt ngưỡng 50%')
                    ),
                    h('button', {
                      type: 'button',
                      className: 'btn btn-primary',
                      style: { padding: '4px 10px', fontSize: '0.78rem' },
                      onClick: function(){ startDrill('hat-nhan', 5); }
                    }, 'Làm ngay ➔')
                  ),
                  h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px', background: 'var(--surface-2)', borderRadius: '10px' } },
                    h('span', { style: { color: 'var(--warning)', fontWeight: 700 } }, '!'),
                    h('div', { style: { flex: 1 } },
                      h('div', { style: { fontWeight: 600, fontSize: '0.9rem', color: 'var(--ink)' } }, '4. Ôn lại 3 câu sai đến hạn trong Sổ tay câu sai'),
                      h('div', { style: { fontSize: '0.78rem', color: 'var(--muted)', marginTop: '2px' } }, 'Lặp lại giãn cách để tránh mất điểm đáng tiếc trong kỳ thi thật')
                    ),
                    h('button', {
                      type: 'button',
                      className: 'btn btn-secondary',
                      style: { padding: '4px 10px', fontSize: '0.78rem' },
                      onClick: startMistakeDrill
                    }, 'Ôn tập ➔')
                  )
                )
              )
            );
          }
        })()
      )
    );
  }

  // Khởi động gắn vào DOM khi trang load
  function init(){
    var rootEl = document.getElementById('prepscholar-app-root');
    if(rootEl && ReactDOM){
      ReactDOM.render(h(PrepScholarApp), rootEl);
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
