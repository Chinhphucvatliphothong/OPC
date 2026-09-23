/**
 * OPC Luyện Thi Vật Lí - PrepScholar UI Component
 * Giao diện tương tác trực tiếp theo chuẩn PrepScholar
 */

(function(window){
  'use strict';

  var React = window.React;
  var ReactDOM = window.ReactDOM;
  var h = React.createElement;

  // GIAI ĐOẠN THẬT HOÀN TOÀN (từ 23/9/2026): đã bỏ hẳn danh sách học sinh
  // minh hoạ và chế độ "Học thử với dữ liệu minh hoạ" — trang chỉ còn 1
  // đường vào duy nhất là đăng nhập bằng tài khoản thật do giáo viên cấp
  // trong admin. Không còn STUDENTS[] giả lập, không còn student.id === 'guest'.

  // Chuyển hồ sơ học sinh THẬT (từ Firestore, do admin.html tạo) sang đúng
  // hình dạng mà giao diện luyện tập cần. predicted/mastery/nanoMastery ở
  // đây chỉ là giá trị khởi điểm mặc định cho tới khi hydrateAndEnter() tải
  // xong lịch sử làm bài thật (nếu có) và ghi đè lại bằng số liệu thật —
  // xem computeStudentStatsFromAttempts trong prepscholar.js.
  function toAppStudent(real){
    // Mốc trung lập khi chưa có số liệu thật (giai đoạn thật hoàn toàn —
    // không giả định trước em nào yếu/mạnh chuyên đề nào).
    var defMastery = { 'nhiet': 50, 'khi': 50, 'tu-truong': 50, 'hat-nhan': 50 };
    return {
      id: real.id,
      name: real.name || 'Học sinh',
      email: real.email || '',
      target: Number(real.targetScore) || 9.0,
      // Không còn fallback 7.0 giả — điểm dự đoán chỉ có khi ĐàTHẬT có ít
      // nhất 1 lượt làm bài (real.predictedScore/averageScore do admin hoặc
      // hydrateAndEnter/computeStudentStatsFromAttempts ghi vào); chưa từng
      // luyện thì để null, UI hiển thị "Chưa có dữ liệu" thay vì số bịa.
      predicted: (real.predictedScore != null) ? Number(real.predictedScore) : (real.averageScore ? Number(real.averageScore) : null),
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

  // ===== Render công thức LaTeX + lệnh định dạng văn bản LaTeX =====
  // Lời giải/đề bài gốc không chỉ chứa công thức toán trong $...$ mà còn có
  // các lệnh định dạng CHỮ THƯỜNG của LaTeX nằm NGOÀI dấu $ (vd:
  // "...sau đây \textbf{không} làm thay đổi...") — bản renderLatexText cũ
  // chỉ nhận diện $...$ nên các lệnh này lọt qua nguyên văn, hiển thị dạng
  // thô "\textbf{không}" thay vì chữ in đậm. Bộ tách token dưới đây quét
  // toàn bộ chuỗi (nhận diện đúng độ sâu ngoặc nhọn lồng nhau, giống
  // extractBraceBlocks bên admin.html) để xử lý cả công thức ($...$ -> KaTeX)
  // lẫn lệnh định dạng chữ (\textbf, \textit, \underline...) trong cùng một
  // lượt, thay vì chỉ xử lý mỗi phần toán học.
  var LATEX_TAG_MAP = {
    textbf: 'b', bf: 'b', bold: 'b',
    textit: 'i', it: 'i', emph: 'i',
    underline: 'u', uline: 'u',
    text: 'span', mathrm: 'span', mbox: 'span', textrm: 'span', textnormal: 'span'
  };
  // Lệnh không có nội dung hiển thị hữu ích (canh lề, khoảng cách, nhãn...) —
  // bỏ hẳn cả lệnh lẫn tham số của nó thay vì hiện ra chữ thô.
  var LATEX_DROP_CMDS = {
    vspace: 1, hspace: 1, label: 1, ref: 1, noindent: 1, hfill: 1, vfill: 1,
    centering: 1, allowbreak: 1, newpage: 1, clearpage: 1, quad: 1, qquad: 1,
    par: 1, item: 1, small: 1, large: 1, normalsize: 1, sffamily: 1, rmfamily: 1
  };
  function tokenizeLatexRuns(str){
    var i = 0, len = str.length;
    function parseNodes(stopAtBrace){
      var nodes = [];
      var buf = '';
      function flush(){ if(buf){ nodes.push({ type: 'text', value: buf }); buf = ''; } }
      while(i < len){
        var c = str[i];
        if(stopAtBrace && c === '}'){ i++; break; }
        if(c === '\\'){
          var next = str[i + 1];
          if(next === '\\'){ flush(); nodes.push({ type: 'br' }); i += 2; continue; }
          if(next && '%&_$#{}~'.indexOf(next) !== -1){ buf += (next === '~' ? ' ' : next); i += 2; continue; }
          var m = /^\\([a-zA-Z]+)\*?/.exec(str.slice(i));
          if(m){
            var cmdName = m[1];
            var j = i + m[0].length;
            while(str[j] === ' ') j++;
            if(str[j] === '['){ // bỏ qua tham số tùy chọn [..]
              var depth = 1; j++;
              while(j < len && depth > 0){ if(str[j] === '[') depth++; else if(str[j] === ']') depth--; j++; }
              while(str[j] === ' ') j++;
            }
            if(cmdName === 'begin' || cmdName === 'end'){
              // \begin{...}/\end{...}: bỏ cả lệnh lẫn tên môi trường, không cố hiểu ngữ nghĩa
              if(str[j] === '{'){
                var d = 1; j++;
                while(j < len && d > 0){ if(str[j] === '{') d++; else if(str[j] === '}') d--; j++; }
              }
              flush();
              i = j;
              continue;
            }
            if(str[j] === '{'){
              flush();
              i = j + 1;
              var children = parseNodes(true);
              if(!LATEX_DROP_CMDS[cmdName]) nodes.push({ type: 'cmd', name: cmdName, children: children });
              continue;
            }
            // Lệnh không kèm { } (vd \quad, \item đứng riêng) — bỏ qua lệnh, giữ nguyên phần sau
            flush();
            i = j;
            continue;
          }
          buf += '\\'; i++; continue;
        }
        if(c === '$'){
          flush();
          var end = str.indexOf('$', i + 1);
          if(end === -1){ buf += c; i++; continue; }
          nodes.push({ type: 'math', value: str.slice(i + 1, end) });
          i = end + 1;
          continue;
        }
        buf += c; i++;
      }
      flush();
      return nodes;
    }
    return parseNodes(false);
  }
  function renderLatexNodes(nodes, keyPrefix){
    var out = [];
    nodes.forEach(function(node, idx){
      var key = keyPrefix + '_' + idx;
      if(node.type === 'text'){ out.push(node.value); return; }
      if(node.type === 'br'){ out.push(h('br', { key: key })); return; }
      if(node.type === 'math'){
        if(window.katex){
          try{
            var html = window.katex.renderToString(node.value, { throwOnError: false });
            out.push(h('span', { key: key, dangerouslySetInnerHTML: { __html: html } }));
          }catch(e){
            out.push(h('span', { key: key }, '$' + node.value + '$'));
          }
        } else {
          out.push(h('span', { key: key }, '$' + node.value + '$'));
        }
        return;
      }
      if(node.type === 'cmd'){
        var tag = LATEX_TAG_MAP[node.name] || 'span';
        out.push(h(tag, { key: key }, renderLatexNodes(node.children, key)));
        return;
      }
    });
    return out;
  }
  function renderLatexText(text){
    if(!text) return '';
    return h('span', null, renderLatexNodes(tokenizeLatexRuns(String(text)), 'lx'));
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
    // Giai đoạn thật hoàn toàn: không còn lối thoát sang dữ liệu minh hoạ nếu
    // kết nối Firestore không nạp được — báo lỗi rõ ràng thay vì im lặng.
    var liveFailedState = React.useState(false);
    var liveFailed = liveFailedState[0];
    var setLiveFailed = liveFailedState[1];
    React.useEffect(function(){
      if(liveReady) return;
      function onReady(){ setLiveReady(true); }
      window.addEventListener('opc-live-ready', onReady);
      var tries = 0;
      var timer = setInterval(function(){
        tries++;
        if(window.OPC_LIVE){ setLiveReady(true); clearInterval(timer); }
        else if(tries > 100){ clearInterval(timer); setLiveFailed(true); } // ~20s, báo lỗi kết nối
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

    var studentState = React.useState(null);
    var student = studentState[0];
    var setStudent = studentState[1];

    // Sau khi có hồ sơ học sinh thật (đăng nhập hoặc khôi phục phiên cũ): vào
    // ngay với số liệu mặc định, rồi tải lịch sử luyện tập thật (nếu có) để
    // tính lại mastery/điểm dự đoán/Sổ tay câu sai từ dữ liệu thật — CHỖ CẮM
    // DỮ LIỆU THẬT đã hoạt động (xem computeStudentStatsFromAttempts trong
    // prepscholar.js).
    // Đẩy số liệu học tập thật (mastery/điểm dự đoán/sổ câu sai) vừa tính lại
    // lên collection "student_stats" để trang admin (Giám sát thích ứng) đọc
    // được ngay — xem OPC_LIVE.saveStudentStats trong opc-live-data.js và
    // OPC.studentStats trong admin.html. Không chặn UI: lỗi mạng chỉ log ra
    // console, học sinh vẫn thấy số liệu của mình bình thường.
    function syncStudentStats(studentId, stats){
      if(!studentId || !window.OPC_LIVE || !window.OPC_LIVE.saveStudentStats) return;
      var payload = {};
      if(stats.mastery) payload.mastery = stats.mastery;
      if(stats.predicted != null) payload.predicted = stats.predicted;
      if(stats.nanoMastery) payload.nanoMastery = stats.nanoMastery;
      if(stats.mistakeLog) payload.mistakeCount = stats.mistakeLog.length;
      window.OPC_LIVE.saveStudentStats(studentId, payload).catch(function(err){
        console.error('Lỗi lưu số liệu học tập (student_stats):', err);
      });
    }

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
        syncStudentStats(real.id, stats);
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
    // chú bảo mật trong opc-live-data.js). Giai đoạn thật hoàn toàn: không
    // còn ngân hàng minh hoạ để rơi vào — QUESTION_BANK bắt đầu trống, ai vào
    // trước khi nạp xong sẽ thấy banner "Đang tải ngân hàng đề thật…".
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

    function handleLogout(){
      if(window.OPC_LIVE) window.OPC_LIVE.logoutStudent();
      setStudent(null);
      setAuthState('form');
    }

    var tabState = React.useState('home'); // home | map | drill | exam | mistakes
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

    // ===== Luyện tập thích ứng thời gian thực (CAT-lite, kiểu Squirrel AI) =====
    // Khác với Drill/Kiểm tra đầu vào (examSession.questions cố định ngay từ
    // đầu): ở chế độ này examSession.questions BẮT ĐẦU với 1 câu và được nối
    // thêm dần — mỗi câu mới được chọn NGAY sau khi chấm câu trước, dựa trên
    // adaptiveNanoMastery (bản mastery-theo-Tag chạy cục bộ, cập nhật tức thì
    // qua bumpNanoMastery, không đợi vòng lưu Firestore). Xem pickAdaptiveQuestion
    // trong prepscholar.js.
    var ADAPTIVE_TARGET_COUNT = 12;
    var adaptiveNanoMasteryState = React.useState({});
    var adaptiveNanoMastery = adaptiveNanoMasteryState[0];
    var setAdaptiveNanoMastery = adaptiveNanoMasteryState[1];

    var adaptiveCheckedState = React.useState(false); // câu hiện tại đã chấm chưa
    var adaptiveChecked = adaptiveCheckedState[0];
    var setAdaptiveChecked = adaptiveCheckedState[1];

    var adaptiveLastResultState = React.useState(null); // kết quả câu vừa chấm, để hiện phản hồi tức thì
    var adaptiveLastResult = adaptiveLastResultState[0];
    var setAdaptiveLastResult = adaptiveLastResultState[1];

    // ===== Màn hình Học & Vá lỗi (Learning & Remediation Flow) =====
    // Khi bấm vào 1 Tag màu Đỏ ở Trang chủ: khoá các phần khác (ẩn thanh
    // điều hướng + hồ sơ + chỉ số) và dẫn qua quy trình 3 bước khép kín:
    // 1. Video Nano (nếu Tag có videoUrl) → 2. Thẻ ghi nhớ Concept Card (nếu
    // Tag có conceptCard) → 3. Luyện tập tức thì (5 câu, dùng lại đúng pipeline
    // startNanoDrill/examSession có sẵn). Bước nào chưa có NỘI DUNG THẬT thì
    // tự động bỏ qua (không hiện màn hình trống) — không bịa video/thẻ ghi
    // nhớ giả, đúng nguyên tắc trung thực dữ liệu của toàn bộ ứng dụng.
    // remediation = null (không ở trong quy trình) | { nano, phase } với
    // phase ∈ 'video' | 'concept'. Khi bước 3 (luyện tập) bắt đầu,
    // remediation được đặt về null nhưng examSession.fromRemediation giữ
    // khoá điều hướng cho tới khi nộp bài xong.
    var remediationState = React.useState(null);
    var remediation = remediationState[0];
    var setRemediation = remediationState[1];

    // Sổ tay câu sai (Mistake Log) — giai đoạn thật: bắt đầu trống, chỉ nạp
    // từ lịch sử làm bài thật của học sinh sau khi đăng nhập (hydrateAndEnter).
    var mistakeLogState = React.useState([]);
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

    // Luyện "5 bài tập" đúng 1 Tag (nano-point) — dùng cho khối remediation
    // màu Đỏ trên Trang chủ Học sinh.
    function startNanoDrill(nanoId, nanoName){
      var questions = window.PrepScholarEngine.createNanoDrill(nanoId, 5);
      if(!questions.length){
        alert('Ngân hàng đề chưa có câu hỏi nào gắn Tag này — thầy cô cần nạp thêm đề.');
        return;
      }
      var session = { type: 'drill', title: 'Luyện Tag: ' + nanoName, questions: questions, isSubmitted: false };
      setExamSession(session);
      setUserAnswers({});
      setFlagged({});
      setCurQIdx(0);
      setTimeLeft(questions.length * 120);
      setScoreResult(null);
      setMasteryImpact(null);
    }

    // Bước 3 (Luyện tập tức thì) của quy trình Vá lỗi — giống startNanoDrill
    // nhưng gắn thêm fromRemediation:true để giữ khoá thanh điều hướng cho
    // tới khi nộp bài, và đặt tiêu đề đúng ngữ cảnh "vá lỗi" thay vì "luyện Tag".
    function startRemediationPractice(nano){
      var questions = window.PrepScholarEngine.createNanoDrill(nano.id, 5);
      if(!questions.length){
        alert('Ngân hàng đề chưa có câu hỏi nào gắn Tag này — thầy cô cần nạp thêm đề.');
        setRemediation(null);
        return;
      }
      var session = { type: 'drill', title: 'Vá lỗi kiến thức: ' + nano.name, questions: questions, isSubmitted: false, fromRemediation: true };
      setExamSession(session);
      setUserAnswers({});
      setFlagged({});
      setCurQIdx(0);
      setTimeLeft(questions.length * 120);
      setScoreResult(null);
      setMasteryImpact(null);
      setRemediation(null);
    }

    // Điểm vào quy trình Vá lỗi từ 1 Tag màu Đỏ — tự bỏ qua bước 1/2 nếu
    // Tag đó chưa có videoUrl/conceptCard thật (xem ghi chú ở nano-map.js).
    function startRemediation(nano){
      if(nano.videoUrl){ setRemediation({ nano: nano, phase: 'video' }); }
      else if(nano.conceptCard){ setRemediation({ nano: nano, phase: 'concept' }); }
      else { startRemediationPractice(nano); }
    }

    function remediationNext(){
      if(!remediation) return;
      var nano = remediation.nano;
      if(remediation.phase === 'video' && nano.conceptCard){ setRemediation({ nano: nano, phase: 'concept' }); }
      else { startRemediationPractice(nano); }
    }

    function remediationExit(){
      setRemediation(null);
    }

    // Màn hình khoá riêng cho bước 1 (Video) / bước 2 (Concept Card) của quy
    // trình Vá lỗi — bước 3 (luyện tập) tái dùng nguyên màn hình làm bài có
    // sẵn (examSession.type === 'drill'), không vẽ lại.
    function renderRemediationStep(rem){
      var nano = rem.nano;
      var bai = (window.OPC_NANO && window.OPC_NANO.getBai) ? window.OPC_NANO.getBai(nano.baiKey) : null;
      var chuDe = (bai && window.OPC_NANO.getChuDe) ? window.OPC_NANO.getChuDe(bai.chuDeKey) : null;
      var totalSteps = 1 + (nano.videoUrl ? 1 : 0) + (nano.conceptCard ? 1 : 0);
      var stepNo = rem.phase === 'video' ? 1 : (nano.videoUrl ? 2 : 1);

      return h('div', { className: 'ps-remediation-screen' },
        h('div', { className: 'ps-remediation-step-badge' },
          '🔒 Bước ' + stepNo + '/' + totalSteps + ' · ' + (rem.phase === 'video' ? 'Xem Video Nano' : 'Thẻ ghi nhớ (Concept Card)')),
        h('h3', { style: { fontFamily: 'Literata, serif', margin: '10px 0 2px' } }, nano.name),
        h('p', { style: { fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '18px' } },
          (chuDe ? chuDe.name + ' · ' : '') + (bai ? bai.name : '')),

        rem.phase === 'video'
          ? h('div', { className: 'ps-remediation-card-block' },
              h('p', { style: { fontSize: '0.86rem', marginBottom: '14px' } }, 'Xem hết video ngắn (3-5 phút) rồi quay lại bấm nút bên dưới để tiếp tục.'),
              h('a', { href: nano.videoUrl, target: '_blank', rel: 'noopener noreferrer', className: 'btn btn-primary' }, '▶️ Mở Video Nano 3 phút')
            )
          : (function(){
              var card = nano.conceptCard || {};
              var rows = [];
              if(card.formula) rows.push(h('div', { key: 'f', className: 'ps-remediation-card-block' }, h('b', null, 'Công thức: '), renderLatexText(card.formula)));
              if(card.note) rows.push(h('div', { key: 'n', className: 'ps-remediation-card-block' }, h('b', null, 'Ghi nhớ: '), renderLatexText(card.note)));
              if(card.example) rows.push(h('div', { key: 'e', className: 'ps-remediation-card-block' }, h('b', null, 'Ví dụ mẫu: '), renderLatexText(card.example)));
              return rows.length ? rows : h('div', { className: 'ps-remediation-card-block' }, 'Thầy cô đang chuẩn bị nội dung thẻ ghi nhớ cho Tag này.');
            })(),

        h('div', { style: { marginTop: '22px', display: 'flex', gap: '10px', flexWrap: 'wrap' } },
          h('button', { type: 'button', className: 'btn btn-primary', onClick: remediationNext },
            (stepNo < totalSteps ? 'Tiếp tục ➔' : 'Bắt đầu luyện tập (5 câu) ➔')),
          h('button', { type: 'button', className: 'btn btn-secondary', onClick: remediationExit }, 'Thoát')
        )
      );
    }

    // Luyện lại cả 1 "Bài" — nút trên lưới 16 Bài của Trang chủ Học sinh.
    function startBaiDrill(baiKey, baiName){
      var questions = window.PrepScholarEngine.createBaiDrill(baiKey, 6);
      if(!questions.length){
        alert('Ngân hàng đề chưa có câu hỏi nào cho Bài này — thầy cô cần nạp thêm đề.');
        return;
      }
      var session = { type: 'drill', title: 'Luyện Bài: ' + baiName, questions: questions, isSubmitted: false };
      setExamSession(session);
      setUserAnswers({});
      setFlagged({});
      setCurQIdx(0);
      setTimeLeft(questions.length * 120);
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
        title = 'Bài kiểm tra đầu vào (Diagnostic Test) — 28 câu chuẩn cấu trúc 2025-2026';
        timeSec = 40 * 60;
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

    // Bắt đầu Luyện tập thích ứng thời gian thực (CAT-lite): chọn câu ĐẦU
    // TIÊN dựa trên mastery-theo-Tag hiện tại của học sinh (nanoMastery thật
    // nếu đã từng luyện, mức trung lập 50 cho Tag chưa từng kiểm tra).
    function startAdaptiveDrill(){
      var seedMastery = Object.assign({}, student.nanoMastery || {});
      var firstQ = window.PrepScholarEngine.pickAdaptiveQuestion(seedMastery, {});
      if(!firstQ){
        alert('Ngân hàng đề chưa có đủ câu hỏi gắn Tag để luyện thích ứng — thầy cô cần nạp thêm đề (.tex) có gắn nano-point.');
        return;
      }
      var session = {
        type: 'adaptive',
        title: 'Luyện tập thích ứng thời gian thực',
        questions: [firstQ],
        isSubmitted: false
      };
      setExamSession(session);
      setUserAnswers({});
      setFlagged({});
      setCurQIdx(0);
      setTimeLeft(ADAPTIVE_TARGET_COUNT * 90);
      setScoreResult(null);
      setMasteryImpact(null);
      setAdaptiveNanoMastery(seedMastery);
      setAdaptiveChecked(false);
      setAdaptiveLastResult(null);
    }

    // Chấm NGAY câu hỏi thích ứng hiện tại (câu cuối cùng trong
    // examSession.questions) và cập nhật adaptiveNanoMastery tức thì — đây
    // chính là bước "thích ứng trong lúc làm bài" mà Diagnostic/Drill/Thi thử
    // không có (các chế độ đó chỉ cập nhật Mastery SAU KHI nộp cả bài).
    function handleCheckAdaptiveAnswer(){
      if(!examSession || examSession.type !== 'adaptive') return;
      var curQ = examSession.questions[examSession.questions.length - 1];
      if(!curQ || adaptiveChecked) return;
      var scored = window.PrepScholarEngine.scoreExam([curQ], userAnswers);
      var res = scored.perQuestionResults[0];
      if(!res) return;
      setAdaptiveNanoMastery(function(prev){
        if(!curQ.nanoId) return prev;
        var next = Object.assign({}, prev);
        var cur = (next[curQ.nanoId] != null) ? next[curQ.nanoId] : window.PrepScholarEngine.MASTERY_NEUTRAL_START;
        next[curQ.nanoId] = window.PrepScholarEngine.bumpNanoMastery(cur, res.isFullCorrect, curQ.level);
        return next;
      });
      setAdaptiveLastResult(res);
      setAdaptiveChecked(true);
    }

    // Chọn và nối thêm câu hỏi TIẾP THEO dựa trên adaptiveNanoMastery vừa cập
    // nhật — hoặc kết thúc lượt (đủ số câu mục tiêu, hoặc ngân hàng đề đã hết
    // câu khả dụng) bằng đúng luồng chấm/lưu/đồng bộ sẵn có (handleSubmitExam).
    function handleNextAdaptiveQuestion(){
      if(!examSession || examSession.type !== 'adaptive') return;
      if(examSession.questions.length >= ADAPTIVE_TARGET_COUNT){
        handleSubmitExam();
        return;
      }
      var askedIds = {};
      examSession.questions.forEach(function(q){ askedIds[q.id] = true; });
      var nextQ = window.PrepScholarEngine.pickAdaptiveQuestion(adaptiveNanoMastery, askedIds);
      if(!nextQ){
        handleSubmitExam(); // Hết câu hỏi khả dụng — vẫn chấm/lưu bình thường với số câu đã làm
        return;
      }
      setExamSession(function(prev){
        return Object.assign({}, prev, { questions: prev.questions.concat([nextQ]) });
      });
      setCurQIdx(function(i){ return i + 1; });
      setAdaptiveChecked(false);
      setAdaptiveLastResult(null);
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

      // Cập nhật Tag (nano-point) NGAY TẠI CHỖ theo đúng công thức Squirrel AI
      // (không cần đợi vòng lưu/tải lại Firestore): Đúng câu khó (M3/M4) +25 ·
      // Đúng câu dễ (M1/M2) +15 · Sai -20, khởi điểm trung lập 50, giới hạn
      // 0-100. Với học sinh thật, giá trị này sẽ được ghi đè ngay sau đó bằng
      // số liệu tính lại từ TOÀN BỘ lịch sử thật (cùng công thức) khi
      // OPC_LIVE.saveAttempt/loadAttempts hoàn tất — chỗ này chỉ để Trang chủ
      // cập nhật tức thì, không phải đợi mạng.
      var newNanoMastery = Object.assign({}, student.nanoMastery || {});
      scored.perQuestionResults.forEach(function(res){
        var q = res.question;
        var nanoId = q && q.nanoId;
        if(!nanoId) return;
        var cur = (newNanoMastery[nanoId] != null) ? newNanoMastery[nanoId] : 50;
        newNanoMastery[nanoId] = window.PrepScholarEngine.bumpNanoMastery(cur, res.isFullCorrect, q.level);
      });

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
          predicted: newPredicted,
          nanoMastery: newNanoMastery
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
          return { qId: r.question.id, topicKey: r.question.topicKey, topicName: r.question.topicName, subtopic: r.question.subtopic, nanoId: r.question.nanoId || null, baiKey: r.question.baiKey || null, level: r.question.level || null };
        });
        var rightQuestions = scored.perQuestionResults.filter(function(r){ return r.isFullCorrect; }).map(function(r){
          return { qId: r.question.id, nanoId: r.question.nanoId || null, baiKey: r.question.baiKey || null, level: r.question.level || null };
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
          syncStudentStats(studentId, stats);
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

    // ================= Màn hình đăng nhập =================
    // Chỉ vào thẳng giao diện luyện tập khi đã xác định xong trạng thái đăng
    // nhập ('in'). Khi đang dò phiên cũ ('checking') hoặc chưa đăng nhập
    // ('form'), hiện màn hình riêng — không hiện dữ liệu của học sinh khác.
    if(authState !== 'in'){
      if(authState === 'checking'){
        if(liveFailed){
          return h('div', { className: 'ps-wrapper', style: { maxWidth: '420px', margin: '0 auto', textAlign: 'center', padding: '40px 20px' } },
            h('div', { style: { fontSize: '2.2rem', marginBottom: '10px' } }, '⚠️'),
            h('p', { style: { color: 'var(--ink-2)', fontSize: '0.9rem', lineHeight: 1.6 } }, 'Không kết nối được tới máy chủ dữ liệu. Kiểm tra lại kết nối mạng rồi tải lại trang; nếu vẫn lỗi, báo thầy cô kiểm tra cấu hình Firebase.'),
            h('button', { type: 'button', className: 'btn btn-primary', style: { marginTop: '14px' }, onClick: function(){ window.location.reload(); } }, 'Tải lại trang'));
        }
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
          h('p', { style: { fontSize: '0.74rem', color: 'var(--muted)', marginTop: '14px', lineHeight: 1.5 } },
            'Chưa có tài khoản? Liên hệ thầy cô để được cấp tên đăng nhập và mật khẩu.')
        )
      );
    }

    // student chỉ null khi chưa đăng nhập xong — authState !== 'in' đã chặn ở
    // trên nên tới đây luôn có hồ sơ thật; giữ 1 lưới an toàn tối thiểu.
    if(!student){
      return h('div', { className: 'ps-wrapper', style: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '320px' } },
        h('p', { style: { color: 'var(--ink-2)', fontSize: '0.9rem' } }, 'Đang tải hồ sơ học sinh…'));
    }

    // Tính overall mastery
    var avgMastery = Math.round((student.mastery['nhiet'] + student.mastery['khi'] + student.mastery['tu-truong'] + student.mastery['hat-nhan']) / 4);

    // Đang ở trong quy trình Vá lỗi khép kín (bước 1/2 chưa có examSession,
    // hoặc bước 3 đang làm bài chưa nộp) → khoá Hồ sơ + Chỉ số + Điều hướng,
    // chỉ để lại 1 thanh mỏng "Thoát" — đúng "tự động khóa các phần khác".
    var lockedMode = !!remediation || (examSession && examSession.fromRemediation && !examSession.isSubmitted);

    return h('div', { className: 'ps-wrapper', key: 'bank-' + bankVersion },
      bankIsLive ? null : h('div', { className: 'banner warn', style: { marginBottom: '14px' } },
        h('span', null, 'ℹ️'), h('div', null, 'Đang tải ngân hàng đề thật từ Firestore… nếu chờ lâu mà vẫn thấy thông báo này, báo thầy cô kiểm tra lại đề đã nạp trong trang admin.')),

      // 1-3. Hồ sơ + Chỉ số + Điều hướng — ẨN khi đang khoá trong quy trình
      // Vá lỗi, thay bằng 1 thanh "Thoát" mỏng để học sinh không lạc sang
      // phần khác giữa chừng quy trình 3 bước.
      lockedMode
        ? h('div', { className: 'ps-lock-topbar', key: 'lockbar' },
            h('span', null, '🔒 Đang vá lỗi kiến thức' + (remediation ? ': ' + remediation.nano.name : (examSession ? ': ' + examSession.title : ''))),
            h('button', {
              type: 'button', className: 'btn btn-secondary', style: { fontSize: '0.78rem', padding: '6px 12px' },
              onClick: function(){ setRemediation(null); setExamSession(null); setTab('home'); }
            }, 'Thoát ➔ Trang chủ')
          )
        : h('div', { key: 'chrome' },
      // 1. Profile Bar
      h('div', { className: 'ps-profile-bar' },
        h('div', { className: 'ps-student-picker' },
          h('div', { className: 'ps-avatar-badge' }, student.name.charAt(0)),
          h('div', { className: 'ps-student-meta' },
            h('h4', null, student.name),
            h('p', null, 'Tài khoản luyện thi cá nhân hóa · ' + student.email)
          )
        ),
        h('button', { type: 'button', className: 'btn btn-secondary', onClick: handleLogout }, '🚪 Đăng xuất')
      ),

      // 2. PrepScholar Core Metrics Grid
      h('div', { className: 'ps-metrics-grid' },
        h('div', { className: 'ps-metric-card accent' },
          h('div', { className: 'ps-metric-label' }, 'Dự đoán điểm thi'),
          h('div', { className: 'ps-metric-val' },
            student.predicted != null ? student.predicted.toFixed(1) : '—',
            h('span', { style: { fontSize: '0.9rem', color: 'var(--muted)' } }, '/ 10.0')
          ),
          h('div', { className: 'ps-metric-sub' }, student.predicted != null ? 'Dựa trên lịch sử làm bài thật gần nhất' : 'Chưa có dữ liệu — hãy làm Bài kiểm tra đầu vào')
        ),
        h('div', { className: 'ps-metric-card good' },
          h('div', { className: 'ps-metric-label' }, 'Mục tiêu điểm số'),
          h('div', { className: 'ps-metric-val' },
            student.target.toFixed(1),
            h('span', { style: { fontSize: '0.9rem', color: 'var(--muted)' } }, '+')
          ),
          h('div', { className: 'ps-metric-sub' },
            student.predicted != null
              ? 'Còn thiếu ' + Math.max(0, (student.target - student.predicted)).toFixed(1) + ' điểm để đạt mục tiêu'
              : 'Do thầy cô đặt khi tạo tài khoản'
          )
        ),
        h('div', { className: 'ps-metric-card ' + (avgMastery < 50 ? 'critical' : (avgMastery < 75 ? 'warning' : 'good')) },
          h('div', { className: 'ps-metric-label' }, 'Độ thành thạo toàn diện'),
          h('div', { className: 'ps-metric-val' }, avgMastery + '%'),
          h('div', { className: 'ps-metric-sub' },
            (function(){
              if(avgMastery >= 75) return 'Đã đạt mức độ an toàn cao';
              var weakCount = Object.keys(student.mastery).filter(function(k){ return (student.mastery[k] || 0) < 75; }).length;
              return weakCount > 0 ? 'Cần củng cố thêm ' + weakCount + ' chuyên đề' : 'Đang trong ngưỡng cần cải thiện';
            })()
          )
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
          className: 'ps-tab-btn ' + (tab === 'home' ? 'active' : ''),
          onClick: function(){ setTab('home'); setExamSession(null); }
        }, '🏠 Trang chủ'),
        h('button', {
          type: 'button',
          className: 'ps-tab-btn ' + (examSession && examSession.type === 'adaptive' && !examSession.isSubmitted ? 'active' : ''),
          title: 'Luyện tập thích ứng thời gian thực: hệ thống tự chọn câu tiếp theo ngay sau mỗi câu trả lời, dựa trên Mastery mới nhất — giống cách Squirrel AI vận hành thật (CAT-lite), khác với Drill/Thi thử (soạn sẵn 1 danh sách câu cố định).',
          onClick: function(){ setTab('home'); startAdaptiveDrill(); }
        }, '⚡ Luyện tập thích ứng'),
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
        )
      )
      ), // đóng div "chrome" (Hồ sơ + Chỉ số + Điều hướng, ẩn khi lockedMode)

      // 4. Main Body Content — nếu đang ở bước 1/2 Vá lỗi (video/concept)
      // thì hiện màn hình khoá riêng; ngược lại giữ nguyên nội dung theo
      // Tab & Exam State như trước (bước 3 Vá lỗi dùng lại đúng nhánh
      // examSession bên dưới, không có gì khác biệt với 1 bài Drill thường).
      remediation ? renderRemediationStep(remediation) : (
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
                (examSession && (examSession.type === 'diagnostic' || examSession.type === 'adaptive' || examSession.fromRemediation)) ? h('button', {
                  type: 'button',
                  className: 'btn btn-primary',
                  onClick: function(){ setExamSession(null); setTab('home'); }
                }, '🏠 Xem Trang chủ (kết quả phân loại Tag) ➔') : h('button', {
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
          examSession.type === 'adaptive' ? (
            // LUYỆN TẬP THÍCH ỨNG THỜI GIAN THỰC (CAT-lite, kiểu Squirrel AI
            // thật): 1 câu 1 lúc — không có ô điều hướng nhảy câu (câu tiếp
            // theo CHƯA tồn tại cho tới khi chấm xong câu này) và không có nút
            // "câu trước". Chấm NGAY rồi mới chọn câu kế tiếp dựa trên Mastery
            // vừa cập nhật, thay vì gộp cả bài rồi mới cập nhật 1 lần lúc nộp.
            (function(){
              var curQ = examSession.questions[examSession.questions.length - 1];
              if(!curQ) return null;
              var qNo = examSession.questions.length;
              var curTagMastery = adaptiveNanoMastery[curQ.nanoId];
              return h('div', { className: 'ps-exam-screen' },
                h('div', { className: 'ps-exam-header' },
                  h('div', { className: 'ps-exam-title-group' },
                    h('h3', null, '⚡ ' + examSession.title),
                    h('p', null, 'Câu ' + qNo + ' / ' + ADAPTIVE_TARGET_COUNT + ' · Hệ thống tự chọn câu tiếp theo ngay sau khi bạn trả lời')
                  ),
                  h('button', {
                    type: 'button',
                    className: 'btn btn-secondary',
                    onClick: function(){
                      if(confirm('Dừng luyện tập thích ứng và chấm điểm với ' + (adaptiveChecked ? qNo : qNo - 1) + ' câu đã làm?')){
                        handleSubmitExam();
                      }
                    }
                  }, 'Dừng & chấm điểm')
                ),

                h('div', { className: 'ps-q-meta-row' },
                  h('div', { className: 'ps-q-badges' },
                    h('span', { className: 'ps-q-badge' }, 'Phần ' + curQ.part),
                    h('span', { className: 'ps-q-badge level-' + curQ.level.toLowerCase() }, curQ.level),
                    h('span', { style: { fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 } }, curQ.topicName + ' · ' + curQ.subtopic),
                    curTagMastery != null ? h('span', { style: { fontSize: '0.78rem', color: 'var(--muted)' } }, '· Tag đang ở ' + curTagMastery + '%') : null
                  )
                ),

                h('div', { className: 'ps-q-stem' }, renderLatexText(curQ.stem)),
                renderQuestionImages(curQ),

                curQ.part === 'I' ? (
                  h('div', { className: 'ps-choice-list' },
                    (curQ.options || []).map(function(opt){
                      var isSel = (userAnswers[curQ.id] === opt.key);
                      var extraCls = adaptiveChecked ? (opt.key === curQ.correctKey ? ' correct-answer' : (isSel ? ' wrong-answer' : '')) : '';
                      return h('div', {
                        key: opt.key,
                        className: 'ps-choice-item ' + (isSel ? 'selected' : '') + extraCls,
                        onClick: function(){ if(!adaptiveChecked) handleAnswerPart1(curQ.id, opt.key); }
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
                              h('button', { type: 'button', disabled: adaptiveChecked, className: 'ps-stmt-btn ' + (ansVal === true ? 'active-true' : ''), onClick: function(){ handleAnswerPart2(curQ.id, st.key, true); } }, 'ĐÚNG'),
                              h('button', { type: 'button', disabled: adaptiveChecked, className: 'ps-stmt-btn ' + (ansVal === false ? 'active-false' : ''), onClick: function(){ handleAnswerPart2(curQ.id, st.key, false); } }, 'SAI')
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
                        type: 'text', className: 'ps-short-input', disabled: adaptiveChecked,
                        placeholder: 'Ví dụ: 2.5', value: userAnswers[curQ.id] || '',
                        onChange: function(e){ handleAnswerPart3(curQ.id, e.target.value); }
                      }),
                      curQ.unit ? h('span', { className: 'ps-short-unit' }, curQ.unit) : null
                    )
                  )
                )),

                (adaptiveChecked && adaptiveLastResult) ? h('div', { className: 'ps-solution-card ' + (adaptiveLastResult.isFullCorrect ? 'correct' : 'wrong'), style: { marginTop: '16px' } },
                  h('div', { style: { fontWeight: 700, color: adaptiveLastResult.isFullCorrect ? 'var(--good)' : 'var(--critical)' } },
                    adaptiveLastResult.isFullCorrect ? '✓ Chính xác!' : '✗ Chưa chính xác'
                  ),
                  h('div', { className: 'ps-solution-body' },
                    h('div', { style: { fontWeight: 700, color: 'var(--accent-strong)', marginBottom: '6px' } }, '💡 Lời giải chi tiết:'),
                    h('div', { style: { whiteSpace: 'pre-wrap' } }, renderLatexText(curQ.loiGiai))
                  )
                ) : null,

                h('div', { className: 'ps-exam-controls' },
                  !adaptiveChecked ? h('button', {
                    type: 'button', className: 'btn btn-primary', onClick: handleCheckAdaptiveAnswer
                  }, 'Kiểm tra đáp án') : h('button', {
                    type: 'button', className: 'btn btn-primary', onClick: handleNextAdaptiveQuestion
                  }, qNo >= ADAPTIVE_TARGET_COUNT ? 'Xem kết quả ➔' : 'Câu tiếp theo →')
                )
              );
            })()
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
                h('p', { style: { fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '10px' } }, 'Hệ thống tự xếp hạng dựa trên lịch sử làm bài thật — không cần giáo viên rà tay từng học sinh.'),
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
              ) : h('div', { style: { marginBottom: '18px', fontSize: '0.84rem', color: 'var(--muted)' } },
                  'Chưa có Tag nào được kiểm tra — làm Bài kiểm tra đầu vào hoặc Luyện tập thích ứng để bắt đầu đo mức thành thạo từng Tag.'
                ),

              h('div', { className: 'ps-nano-map' },
                knowledgeMap.map(function(t){
                  return h('div', { key: t.topicKey, className: 'ps-nano-topic' },
                    h('div', { className: 'ps-nano-topic-head' },
                      h('span', null, t.icon + ' ' + t.topicName),
                      h('span', { className: 'ps-nano-topic-mastery' }, t.mastery != null ? t.mastery + '%' : 'Chưa kiểm tra')
                    ),
                    h('div', { className: 'ps-nano-bai-grid' },
                      t.bais.map(function(b){
                        return h('div', { key: b.key, className: 'ps-nano-bai' },
                          h('div', { className: 'ps-nano-bai-name' }, b.name + ' · ' + (b.mastery != null ? b.mastery + '%' : 'Chưa kiểm tra')),
                          h('div', { className: 'ps-nano-tile-row' },
                            b.nanos.map(function(n){
                              var cls = !n.isReal ? 'untested' : (n.mastery < 50 ? 'crit' : (n.mastery < 75 ? 'warn' : 'good'));
                              return h('div', { key: n.id, className: 'ps-nano-tile ' + cls, title: n.name + ' — ' + (n.isReal ? (n.mastery + '%') : 'Chưa kiểm tra') });
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
                (function(){
                  // Chuyên đề yếu nhất tính TỪ DỮ LIỆU THẬT của chính em này —
                  // không còn giả định cứng "Vật lí hạt nhân luôn yếu nhất".
                  var weakestKey = Object.keys(window.PrepScholarEngine.CHU_DE_MAP).reduce(function(worst, k){
                    var v = student.mastery[k] != null ? student.mastery[k] : 50;
                    var wv = student.mastery[worst] != null ? student.mastery[worst] : 50;
                    return v < wv ? k : worst;
                  }, Object.keys(window.PrepScholarEngine.CHU_DE_MAP)[0]);
                  var weakestName = window.PrepScholarEngine.CHU_DE_MAP[weakestKey].name;
                  var weakestVal = student.mastery[weakestKey] != null ? student.mastery[weakestKey] : 50;
                  return h(React.Fragment, null,
                    h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
                      h('span', { style: { fontSize: '1.4rem' } }, '🎯'),
                      h('div', null,
                        h('h4', { style: { margin: 0, fontSize: '1.05rem', fontWeight: 700 } }, 'Khuyến nghị luyện tập'),
                        h('p', { style: { margin: '3px 0 0', fontSize: '0.84rem', color: 'var(--ink-2)' } },
                          'Điểm yếu lớn nhất của bạn hiện tại là ',
                          h('b', { style: { color: 'var(--critical)' } }, weakestName + ' (' + weakestVal + '%)'),
                          '. Hệ thống đề xuất làm ngay 1 bài Drill 5 câu để nâng độ thành thạo.'
                        )
                      )
                    ),
                    h('div', { style: { marginTop: '12px' } },
                      h('button', {
                        type: 'button',
                        className: 'btn btn-primary',
                        onClick: function(){ startDrill(weakestKey, 5); }
                      }, 'Bắt đầu bài Drill: ' + weakestName + ' (5 câu) ➔')
                    )
                  );
                })()
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
                        h('span', null, 'Mục tiêu: ' + window.PrepScholarEngine.MASTERY_GREEN_MIN + '%+ (Xanh)')
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
                    h('div', { className: 'ps-topic-title' }, '🎯 Bài kiểm tra đầu vào (Diagnostic Test)'),
                    h('p', { style: { fontSize: '0.86rem', color: 'var(--ink-2)', lineHeight: 1.6, marginTop: '8px' } },
                      'Đúng cấu trúc đề thi THPT 2025-2026: Phần I 18 câu, Phần II 4 câu, Phần III 6 câu (28 câu) — phủ rộng nhất có thể trong 48 Tag kiến thức. Sau khi nộp bài, Trang chủ sẽ tự phân loại Xanh/Vàng/Đỏ và khoá phần đã vững.'
                    ),
                    h('div', { style: { marginTop: '12px', fontSize: '0.8rem', color: 'var(--muted)' } },
                      '⏱️ Thời gian: 40 phút · 28 câu hỏi (Phần I, II, III)'
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
            // TAB "TRANG CHỦ" (Personal Dashboard) — đúng luồng giáo viên yêu
            // cầu: [Diagnostic Test] -> [Chấm điểm & cập nhật Tag] -> [Phân
            // loại Xanh/Vàng/Đỏ] -> [Trang chủ: khoá bài Xanh, đẩy remediation
            // Đỏ lên đầu]. Dữ liệu lấy từ student.nanoMastery thật (tính từ
            // lịch sử làm bài qua computeStudentStatsFromAttempts).
            var nanoMastery = student.nanoMastery || {};
            var hasAnyTag = Object.keys(nanoMastery).length > 0;

            if(!hasAnyTag){
              return h('div', { style: { textAlign: 'center', padding: '48px 24px', background: 'var(--surface)', borderRadius: '14px', border: '1px solid var(--line)' } },
                h('div', { style: { fontSize: '2.6rem', marginBottom: '10px' } }, '🧭'),
                h('h3', { style: { marginBottom: '8px' } }, 'Bắt đầu với Bài kiểm tra đầu vào'),
                h('p', { style: { color: 'var(--ink-2)', fontSize: '0.88rem', maxWidth: '480px', margin: '0 auto 18px', lineHeight: 1.6 } },
                  'Làm 28 câu (đúng cấu trúc đề thi THPT 2025-2026) để hệ thống chấm và phân loại từng Tag kiến thức (Xanh/Vàng/Đỏ) — Trang chủ sẽ tự khoá phần đã vững và đẩy phần cần luyện ngay lên đầu.'
                ),
                h('button', {
                  type: 'button',
                  className: 'btn btn-primary',
                  onClick: function(){ startExam('diagnostic'); }
                }, 'Làm bài kiểm tra đầu vào (28 câu) ➔')
              );
            }

            var baiStatus = window.PrepScholarEngine.buildBaiMasteryStatus(nanoMastery);
            var redTags = window.PrepScholarEngine.getRedTags(nanoMastery, 5);
            var STATUS_META = {
              green: { label: '🔒 Đã vững — tạm khoá', color: 'var(--good)', bg: 'color-mix(in srgb, var(--good) 10%, transparent)' },
              yellow: { label: 'Cần luyện thêm', color: 'var(--warning)', bg: 'color-mix(in srgb, var(--warning) 10%, transparent)' },
              red: { label: '‼ Mất gốc — ưu tiên', color: 'var(--critical)', bg: 'color-mix(in srgb, var(--critical) 10%, transparent)' },
              unknown: { label: 'Chưa kiểm tra', color: 'var(--muted)', bg: 'var(--surface-2)' }
            };
            var greenCount = baiStatus.filter(function(b){ return b.status === 'green'; }).length;

            return h('div', null,
              h('div', { style: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '14px', padding: '18px 20px', marginBottom: '18px' } },
                h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'space-between' } },
                  h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
                    h('span', { style: { fontSize: '1.4rem' } }, '🏠'),
                    h('div', null,
                      h('h4', { style: { margin: 0, fontSize: '1.05rem', fontWeight: 700 } }, 'Trang chủ học tập cá nhân hoá'),
                      h('p', { style: { margin: '3px 0 0', fontSize: '0.84rem', color: 'var(--ink-2)' } },
                        'Đã khoá ' + greenCount + ' / 16 Bài (đạt Xanh ≥80%) · ' + redTags.length + ' Tag đang ở mức Đỏ cần luyện ngay'
                      )
                    )
                  ),
                  h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
                    h('button', { type: 'button', className: 'btn btn-primary', style: { fontSize: '0.8rem' }, onClick: startAdaptiveDrill }, '⚡ Luyện tập thích ứng ngay'),
                    h('button', { type: 'button', className: 'btn btn-secondary', style: { fontSize: '0.8rem' }, onClick: function(){ startExam('diagnostic'); } }, '🔁 Làm lại kiểm tra đầu vào')
                  )
                )
              ),

              redTags.length ? h('div', { style: { marginBottom: '20px' } },
                h('h3', { style: { fontFamily: 'Literata, serif', fontSize: '1.05rem', marginBottom: '4px' } }, '🚨 Cần luyện ngay (Tag màu Đỏ)'),
                h('p', { style: { fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '10px' } }, 'Hệ thống tự đẩy lên đầu — không cần chờ giáo viên rà tay.'),
                h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
                  redTags.map(function(n){
                    return h('div', { key: n.id, style: { background: 'var(--surface)', border: '1px solid var(--critical)', borderRadius: '12px', padding: '14px 16px' } },
                      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' } },
                        h('div', { style: { flex: 1, minWidth: '200px' } },
                          h('div', { style: { fontWeight: 700, fontSize: '0.92rem' } }, n.name),
                          h('div', { style: { fontSize: '0.78rem', color: 'var(--muted)', marginTop: '2px' } }, n.chuDeName + ' · ' + n.baiName)
                        ),
                        h('span', { style: { fontSize: '0.78rem', fontWeight: 700, color: 'var(--critical)', background: 'color-mix(in srgb, var(--critical) 12%, transparent)', padding: '3px 8px', borderRadius: '5px', whiteSpace: 'nowrap' } }, n.mastery + '%')
                      ),
                      h('div', { style: { fontSize: '0.76rem', color: 'var(--muted)', marginTop: '10px' } },
                        (n.videoUrl ? '▶️ Có Video Nano 3 phút' : '▶️ Video Nano 3 phút — thầy cô đang chuẩn bị nội dung') +
                        ' · ' + (n.conceptCard ? '📋 Có Thẻ ghi nhớ' : '📋 Thẻ ghi nhớ — thầy cô đang chuẩn bị nội dung')
                      ),
                      h('div', { style: { marginTop: '10px' } },
                        h('button', {
                          type: 'button',
                          className: 'btn btn-primary',
                          style: { fontSize: '0.8rem', padding: '6px 12px' },
                          onClick: function(){ startRemediation(n); }
                        }, (n.videoUrl || n.conceptCard) ? '🔒 Bắt đầu Vá lỗi (Video → Thẻ ghi nhớ → 5 bài tập) ➔' : '5 bài tập luyện Tag này ➔')
                      )
                    );
                  })
                )
              ) : h('div', { style: { marginBottom: '20px', padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--good)', borderRadius: '12px', fontSize: '0.86rem', color: 'var(--ink-2)' } },
                '✅ Hiện không có Tag nào ở mức Đỏ — tiếp tục duy trì phong độ!'
              ),

              h('h3', { style: { fontFamily: 'Literata, serif', fontSize: '1.05rem', marginBottom: '10px' } }, '16 Bài học · tự động khoá khi đạt Xanh'),
              h('div', { className: 'ps-topic-grid' },
                baiStatus.map(function(b){
                  var meta = STATUS_META[b.status];
                  return h('div', { key: b.key, className: 'ps-topic-card', style: { opacity: b.status === 'green' ? 0.82 : 1 } },
                    h('div', null,
                      h('div', { className: 'ps-topic-card-top' },
                        h('div', { className: 'ps-topic-title', style: { fontSize: '0.92rem' } }, b.chuDeIcon + ' ' + b.name),
                        h('span', { style: { fontSize: '0.72rem', fontWeight: 700, color: meta.color, background: meta.bg, padding: '3px 8px', borderRadius: '999px', whiteSpace: 'nowrap' } }, meta.label)
                      ),
                      h('div', { style: { fontSize: '0.78rem', color: 'var(--muted)', marginTop: '4px' } },
                        b.mastery != null ? ('Trung bình các Tag: ' + b.mastery + '% (' + b.testedCount + '/' + b.totalCount + ' Tag đã kiểm tra)') : ('Chưa có Tag nào trong bài này được kiểm tra')
                      )
                    ),
                    h('div', { className: 'ps-topic-card-actions' },
                      h('span', { style: { fontSize: '0.78rem', color: 'var(--ink-2)' } }, b.chuDeName),
                      b.status === 'green'
                        ? h('span', { style: { fontSize: '0.78rem', color: 'var(--muted)' } }, 'Có thể ôn lại tuỳ chọn')
                        : h('button', {
                            type: 'button',
                            className: 'btn btn-secondary ps-drill-btn',
                            onClick: function(){ startBaiDrill(b.key, b.name); }
                          }, 'Luyện bài này ➔')
                    )
                  );
                })
              )
            );
          }
        })()
      )
      ) // đóng ternary "remediation ? renderRemediationStep(...) : ( examSession ? ... )"
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
