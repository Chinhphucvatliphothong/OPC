/**
 * OPC Luyện Thi Vật Lí — VIDEO CHỮA ĐỀ GẮN MỐC THỜI GIAN
 * ---------------------------------------------------------------------
 * THÊM 1/10/2026 · SỬA 16/10/2026 (khoá video trong đúng đoạn của câu, bỏ link YouTube).
 * File dùng CHUNG cho admin.html (dán link + mốc, xem thử)
 * và trang học sinh (index.html -> prepscholar-ui.js, opc-live-data.js).
 * Không phụ thuộc Firebase / React build: chỉ nhận React.createElement (h)
 * từ nơi gọi, nên nạp bằng <script src="/video-walkthrough.js"> thường.
 *
 * DỮ LIỆU — lưu NGAY TRONG doc đề (collection de_thi/{examId}):
 *   videoWalkthrough: {
 *     url:   'https://youtu.be/XXXXXXXXXXX',   // link thầy dán (không công khai)
 *     videoId: 'XXXXXXXXXXX',                  // tách sẵn để học sinh khỏi parse lại
 *     marks: { '1': 0, '2': 85, '3': 190 },    // số câu (q.index) -> giây bắt đầu
 *     updatedAt: '2026-10-01T...'
 *   }
 * Đoạn của câu N: từ marks[N] đến mốc LỚN HƠN gần nhất của câu khác (câu kế
 * tiếp trong video). Câu có mốc lớn nhất -> phát tới hết video (không có end).
 *
 * TRA CỨU LÚC HIỂN THỊ (không copy vào câu hỏi): mã câu hỏi luôn là
 * examId + '_q' + q.index ở MỌI chế độ (transformQuestion trong
 * opc-live-data.js, toStudentQuestionShape trong admin.html) — kể cả đề đã
 * giao từ trước khi có video. forQuestion(q) tách mã đó rồi tra bảng
 * OPC_WALKTHROUGH.register(...) do loadRealQuestionBank nạp từ de_thi.
 */
(function(){
  'use strict';

  // ---------- Thời gian ----------
  // "1:25" -> 85 ; "01:02:30" -> 3750 ; sai định dạng -> null
  function parseTime(str){
    var m = String(str == null ? '' : str).trim().match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/);
    if(!m) return null;
    var hh = m[1] ? Number(m[1]) : 0, mm = Number(m[2]), ss = Number(m[3]);
    if(ss > 59 || (m[1] && mm > 59)) return null;
    return hh * 3600 + mm * 60 + ss;
  }
  // 85 -> "1:25" ; 3750 -> "1:02:30"
  function fmtClock(sec){
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    var hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
    var p2 = function(n){ return (n < 10 ? '0' : '') + n; };
    return hh ? (hh + ':' + p2(mm) + ':' + p2(ss)) : (mm + ':' + p2(ss));
  }
  // 85 -> "1 phút 25 giây" (dùng trong nút cho học sinh)
  function fmtVi(sec){
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    var mm = Math.floor(sec / 60), ss = sec % 60;
    if(!mm) return ss + ' giây';
    return mm + ' phút' + (ss ? ' ' + ss + ' giây' : '');
  }

  // ---------- Link YouTube ----------
  // Nhận watch?v=, youtu.be/, /embed/, /shorts/, /live/ ; trả id 11 ký tự hoặc ''.
  function parseYouTubeId(url){
    var s = String(url || '').trim();
    if(!s) return '';
    if(/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    var m = s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([A-Za-z0-9_-]{11})/);
    return m ? m[1] : '';
  }
  // Link nhúng đúng đoạn. end có thể null (phát tới hết video).
  function embedUrl(videoId, start, end){
    var q = ['rel=0', 'modestbranding=1', 'playsinline=1', 'autoplay=1'];
    q.push('start=' + Math.max(0, Math.floor(start || 0)));
    if(end != null && end > start) q.push('end=' + Math.floor(end));
    return 'https://www.youtube-nocookie.com/embed/' + videoId + '?' + q.join('&');
  }
  function watchUrl(videoId, start){
    return 'https://www.youtube.com/watch?v=' + videoId + '&t=' + Math.max(0, Math.floor(start || 0)) + 's';
  }

  // ---------- Đọc danh sách mốc dạng mô tả YouTube ----------
  // Mỗi dòng: "0:00 Câu 1", "1:25 Câu 2", "01:02:30 - Câu 12", "Câu 3 2:10"...
  // Trả { marks:{ '1':0, ... }, problems:[ 'Dòng 4: ...' ], ignored:[ 'Mở đầu' ] }
  function parseMarks(text){
    var marks = {}, problems = [], ignored = [];
    var lines = String(text || '').split(/\r?\n/);
    var timeRe = /(?:\d{1,2}:)?\d{1,2}:\d{2}/;
    lines.forEach(function(raw, i){
      var line = raw.trim();
      if(!line) return;
      var tm = line.match(timeRe);
      if(!tm){
        // Dòng có "Câu N" mà thiếu mốc là lỗi thật; dòng tiêu đề/ghi chú khác thì bỏ qua.
        if(/(?:câu|cau)\s*\.?\s*\d/i.test(line)) problems.push('Dòng ' + (i + 1) + ': thiếu mốc thời gian — "' + line.slice(0, 40) + '"');
        else ignored.push('Dòng ' + (i + 1) + ': "' + line.slice(0, 40) + '" (không có mốc — bỏ qua)');
        return;
      }
      var sec = parseTime(tm[0]);
      if(sec == null){ problems.push('Dòng ' + (i + 1) + ': mốc "' + tm[0] + '" không hợp lệ.'); return; }
      var rest = (line.slice(0, tm.index) + ' ' + line.slice(tm.index + tm[0].length)).trim();
      var nm = rest.match(/(?:câu|cau|question|q)\s*\.?\s*[:\-]?\s*(\d{1,3})\b/i);
      if(!nm){
        // "1:25 2" hoặc "2 - 1:25" — chỉ có đúng 1 số trần, không chữ khác
        var bare = rest.replace(/[\s\-–—:.)(\[\]]+/g, ' ').trim().match(/^(\d{1,3})$/);
        if(bare) nm = bare;
      }
      if(!nm){ ignored.push('Dòng ' + (i + 1) + ': "' + rest.slice(0, 40) + '" (không phải mốc câu — bỏ qua)'); return; }
      var idx = String(Number(nm[1]));
      if(marks[idx] != null && marks[idx] !== sec){
        problems.push('Câu ' + idx + ' có 2 mốc khác nhau (' + fmtClock(marks[idx]) + ' và ' + fmtClock(sec) + ') — đã lấy mốc đầu.');
        return;
      }
      marks[idx] = sec;
    });
    return { marks: marks, problems: problems, ignored: ignored };
  }

  // Đối chiếu mốc với số câu thật của đề. examIndexes: mảng q.index.
  // Trả { missing:[...], extra:[...], order:[ 'Câu 5 (..) sớm hơn Câu 4 (..)' ] }
  function checkMarks(marks, examIndexes){
    var have = {}; (examIndexes || []).forEach(function(n){ have[String(n)] = true; });
    var missing = [], extra = [], order = [];
    (examIndexes || []).forEach(function(n){ if(marks[String(n)] == null) missing.push(Number(n)); });
    Object.keys(marks).forEach(function(k){ if(!have[k]) extra.push(Number(k)); });
    var idxs = (examIndexes || []).map(Number).filter(function(n){ return marks[String(n)] != null; }).sort(function(a, b){ return a - b; });
    for(var i = 1; i < idxs.length; i++){
      if(marks[String(idxs[i])] < marks[String(idxs[i - 1])]){
        order.push('Câu ' + idxs[i] + ' (' + fmtClock(marks[String(idxs[i])]) + ') nằm TRƯỚC Câu ' + idxs[i - 1] + ' (' + fmtClock(marks[String(idxs[i - 1])]) + ').');
      }
    }
    return { missing: missing, extra: extra, order: order };
  }

  // ---------- Đoạn của 1 câu ----------
  // vw = videoWalkthrough ; trả { start, end|null } hoặc null nếu câu thiếu mốc.
  function getSegment(vw, index){
    if(!vw || !vw.marks) return null;
    var start = vw.marks[String(index)];
    if(start == null || isNaN(Number(start))) return null;
    start = Number(start);
    var end = null;
    Object.keys(vw.marks).forEach(function(k){
      var t = Number(vw.marks[k]);
      if(k !== String(index) && t > start && (end == null || t < end)) end = t;
    });
    return { start: start, end: end };
  }

  // ---------- Bảng tra phía học sinh ----------
  var registry = {}; // examId -> { title, vw }
  function register(examId, title, vw){
    if(!examId) return;
    if(vw && vw.videoId && vw.marks) registry[examId] = { title: title || '', vw: vw };
    else delete registry[examId];
  }
  function clearRegistry(){ registry = {}; }
  // Tách examId + số câu từ câu hỏi (mã luôn là examId + '_q' + index).
  function splitQuestionId(q){
    if(!q) return null;
    var m = String(q.id || '').match(/^(.+)_q(\d+)$/);
    if(m) return { examId: m[1], index: Number(m[2]) };
    if(q.examId && q.index != null) return { examId: q.examId, index: Number(q.index) };
    return null;
  }
  // Trả null nếu câu không có video; ngược lại đủ thông tin để hiện nút + phát.
  function forQuestion(q){
    var ref = splitQuestionId(q);
    if(!ref) return null;
    var rec = registry[ref.examId];
    if(!rec) return null;
    var seg = getSegment(rec.vw, ref.index);
    if(!seg) return null;
    var examTitle = rec.title || (q && q.examTitle) || '';
    return {
      videoId: rec.vw.videoId, index: ref.index, examId: ref.examId, examTitle: examTitle,
      start: seg.start, end: seg.end,
      buttonText: '🎥 Thầy chữa câu này — trong video là Câu ' + ref.index + ', đề ' + examTitle + ' (' + (seg.start > 0 ? fmtVi(seg.start) : 'từ đầu video') + ')'
    };
  }

  // ---------- Trình phát CHỈ ĐÚNG ĐOẠN của 1 câu ----------
  // SỬA 16/10/2026: thay iframe YouTube thường bằng YouTube IFrame Player API:
  //  - Ẩn toàn bộ thanh điều khiển của YouTube (controls=0): không còn thanh tua
  //    cả video, nút sao chép link, nút chia sẻ, logo "Xem trên YouTube".
  //  - Một lớp phủ trong suốt che kín khung video để học sinh không bấm được vào
  //    tiêu đề / kênh / logo YouTube (các chỗ đó mở ra trang YouTube xem cả đề).
  //  - Thanh tua RIÊNG chỉ chạy trong đoạn [start, end] của câu đang xem.
  //  - Tới cuối đoạn: tự dừng, tua về đầu đoạn, hiện "Xem lại" / "Đóng".
  //  - Lùi về trước đầu đoạn (vd. lỗi seek) thì tự kéo lại đầu đoạn.
  var ytApiPromise = null;
  function loadYouTubeApi(){
    if(window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if(ytApiPromise) return ytApiPromise;
    ytApiPromise = new Promise(function(resolve, reject){
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function(){
        if(typeof prev === 'function'){ try { prev(); } catch(_){ } }
        resolve(window.YT);
      };
      var s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      s.onerror = function(){ ytApiPromise = null; reject(new Error('Không tải được YouTube API')); };
      document.head.appendChild(s);
      // Mạng chậm/chặn: báo lỗi sau 15 giây thay vì quay mãi
      setTimeout(function(){ if(!(window.YT && window.YT.Player)) reject(new Error('YouTube API quá thời gian')); }, 15000);
    });
    return ytApiPromise;
  }

  var RATES = [1, 1.25, 1.5, 2];

  function SegmentPlayer(props){
    var R = window.React, h = R.createElement;
    var info = props.info;
    var start = Math.max(0, Math.floor(info.start || 0));
    var end = (info.end != null && info.end > start) ? Math.floor(info.end) : null;

    var boxRef = R.useRef(null), mountRef = R.useRef(null), playerRef = R.useRef(null);
    var sStatus = R.useState('loading'), status = sStatus[0], setStatus = sStatus[1]; // loading | ready | error
    var sPlaying = R.useState(false), playing = sPlaying[0], setPlaying = sPlaying[1];
    var sCur = R.useState(start), cur = sCur[0], setCur = sCur[1];
    var sDone = R.useState(false), done = sDone[0], setDone = sDone[1];
    var sPass = R.useState(false), passThrough = sPass[0], setPassThrough = sPass[1];
    var sRate = R.useState(1), rate = sRate[0], setRate = sRate[1];
    var sSegEnd = R.useState(end), segEnd = sSegEnd[0], setSegEnd = sSegEnd[1];
    // THÊM 16/10/2026 — THEO DÕI EM ĐÃ XEM BAO NHIÊU (chỉ khi nơi gọi truyền info.onProgress — trang học sinh;
    // admin xem thử không truyền nên không ghi gì). Đếm số GIÂY KHÁC NHAU trong đoạn đã thực sự phát (tua vượt
    // qua không tính), báo lên khi: bắt đầu phát, tạm dừng, mỗi 20 giây đang phát, hết đoạn, đóng video.
    var watchedRef = R.useRef({}), playedRef = R.useRef(0), openedRef = R.useRef(false), segEndRef = R.useRef(end);

    R.useEffect(function(){
      var alive = true, timer = null, player = null;
      // YT.Player THAY THẾ phần tử được giao bằng iframe -> tự tạo 1 div con,
      // không để React quản lý nó (tránh lỗi removeChild khi đóng modal).
      var mount = document.createElement('div');
      if(mountRef.current){ mountRef.current.innerHTML = ''; mountRef.current.appendChild(mount); }

      var lastT = null, lastReportAt = 0;
      function report(kind){
        var cb = info.onProgress;
        if(typeof cb !== 'function') return;
        if(kind !== 'open' && !openedRef.current) return; // chưa phát giây nào -> không ghi
        var segSec = segEndRef.current != null ? Math.max(1, segEndRef.current - start) : 0;
        var watchedSec = Object.keys(watchedRef.current).length;
        var pct = segSec ? Math.min(100, Math.round(watchedSec / segSec * 100)) : 0;
        var delta = Math.round(playedRef.current);
        playedRef.current = 0; lastReportAt = Date.now();
        try {
          cb({ kind: kind, examId: info.examId || null, index: info.index, qId: info.examId ? (info.examId + '_q' + info.index) : null,
               segSec: segSec, watchedSec: watchedSec, pct: pct, deltaSec: delta, completed: kind === 'done' || pct >= 90 });
        } catch(_){ }
      }
      function finish(p){
        try { p.pauseVideo(); p.seekTo(start, true); } catch(_){ }
        setPlaying(false); setDone(true); setCur(start);
        report('done');
      }
      function learnDuration(p){
        if(end != null) return;
        try { var d = p.getDuration(); if(d > 0){ segEndRef.current = Math.floor(d); setSegEnd(Math.floor(d)); } } catch(_){ }
      }

      loadYouTubeApi().then(function(YT){
        if(!alive) return;
        var vars = { start: start, autoplay: 1, controls: 0, disablekb: 1, fs: 0, rel: 0,
                     iv_load_policy: 3, modestbranding: 1, playsinline: 1, origin: window.location.origin };
        if(end != null) vars.end = end; // chốt chặn thứ 2 phía YouTube
        player = new YT.Player(mount, {
          host: 'https://www.youtube-nocookie.com',
          videoId: info.videoId, width: '100%', height: '100%', playerVars: vars,
          events: {
            onReady: function(e){
              if(!alive) return;
              playerRef.current = e.target;
              setStatus('ready'); learnDuration(e.target);
              try { e.target.playVideo(); } catch(_){ }
            },
            onStateChange: function(e){
              if(!alive) return;
              var s = e.data;
              setPlaying(s === 1 || s === 3);
              if(s === 1){
                setPassThrough(false); setDone(false); learnDuration(e.target);
                if(!openedRef.current){ openedRef.current = true; report('open'); }
              }
              if(s === 2) report('pause');
              if(s === 0) finish(e.target);
            },
            onError: function(){ if(alive) setStatus('error'); }
          }
        });
        timer = setInterval(function(){
          var p = playerRef.current;
          if(!p || !p.getCurrentTime) return;
          var t = p.getCurrentTime() || 0;
          var isPlaying = p.getPlayerState && p.getPlayerState() === 1;
          if(end != null && t >= end - 0.2){ if(isPlaying) finish(p); return; }
          if(t < start - 1){ try { p.seekTo(start, true); } catch(_){ } t = start; }
          if(isPlaying){
            // chỉ cộng khi phát liền mạch (bước nhảy < 1,5 s) — tua thì không tính là đã xem
            if(lastT != null && t > lastT && t - lastT < 1.5) playedRef.current += (t - lastT);
            if(t >= start && (end == null || t < end)) watchedRef.current[Math.floor(t - start)] = 1;
            if(Date.now() - lastReportAt > 20000) report('progress');
          }
          lastT = t;
          setCur(t);
        }, 250);
      }).catch(function(){ if(alive) setStatus('error'); });

      return function(){
        report('close');
        alive = false;
        if(timer) clearInterval(timer);
        try { if(player && player.destroy) player.destroy(); } catch(_){ }
        playerRef.current = null;
        if(mountRef.current) mountRef.current.innerHTML = '';
      };
    }, [info.videoId, start, end]);

    function toggle(){
      var p = playerRef.current;
      if(!p) return;
      if(done){ setDone(false); p.seekTo(start, true); p.playVideo(); return; }
      if(playing){ p.pauseVideo(); return; }
      p.playVideo();
      // iPhone/iPad đôi khi chặn lệnh phát từ ngoài khung -> cho chạm thẳng vào video 1 lần
      setTimeout(function(){
        var s = p.getPlayerState ? p.getPlayerState() : -1;
        if(s !== 1 && s !== 3) setPassThrough(true);
      }, 900);
    }
    function seekTo(t){
      var p = playerRef.current;
      if(!p) return;
      var maxT = segEnd != null ? segEnd - 0.5 : t;
      t = Math.min(Math.max(start, t), maxT);
      setDone(false); setCur(t);
      p.seekTo(t, true);
    }
    function cycleRate(){
      var p = playerRef.current;
      var next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
      setRate(next);
      if(p && p.setPlaybackRate) p.setPlaybackRate(next);
    }
    var canFull = !!(typeof document !== 'undefined' && (document.fullscreenEnabled || document.webkitFullscreenEnabled));
    function fullscreen(){
      var el = boxRef.current;
      if(!el) return;
      var isFull = document.fullscreenElement || document.webkitFullscreenElement;
      if(isFull){ (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      var req = el.requestFullscreen || el.webkitRequestFullscreen;
      if(req) req.call(el);
    }

    var total = segEnd != null ? Math.max(1, segEnd - start) : 0;
    var pos = Math.min(Math.max(0, cur - start), total || 0);
    var btn = { border: '1px solid var(--line, #cbd5e1)', background: 'var(--surface, #fff)', color: 'inherit', borderRadius: '8px', padding: '6px 10px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', minWidth: '44px' };

    return h('div', null,
      h('div', { ref: boxRef, style: { position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000', borderRadius: '10px', overflow: 'hidden' } },
        h('div', { ref: mountRef, style: { position: 'absolute', inset: 0 } }),
        // Lớp phủ: chặn bấm vào tiêu đề / kênh / logo YouTube; chạm = phát/dừng
        h('div', {
          onClick: toggle,
          onContextMenu: function(e){ e.preventDefault(); },
          style: { position: 'absolute', inset: 0, zIndex: 2, cursor: 'pointer',
                   pointerEvents: passThrough ? 'none' : 'auto',
                   display: 'flex', alignItems: 'center', justifyContent: 'center',
                   background: done ? 'rgba(15,23,42,0.88)' : 'transparent' }
        },
          status === 'loading' ? h('div', { style: { color: '#fff', fontSize: '0.9rem' } }, 'Đang tải video…') :
          status === 'error' ? h('div', { style: { color: '#fff', fontSize: '0.9rem', textAlign: 'center', padding: '0 16px' } }, 'Không tải được video. Em thử lại sau hoặc báo thầy nhé.') :
          done ? h('div', { style: { color: '#fff', textAlign: 'center' }, onClick: function(e){ e.stopPropagation(); } },
            h('div', { style: { fontWeight: 700, fontSize: '1.05rem', marginBottom: '12px' } }, 'Hết phần thầy chữa Câu ' + info.index),
            h('div', { style: { display: 'flex', gap: '10px', justifyContent: 'center' } },
              h('button', { type: 'button', onClick: function(e){ e.stopPropagation(); toggle(); }, style: btn }, '↺ Xem lại'),
              props.onClose ? h('button', { type: 'button', onClick: function(e){ e.stopPropagation(); props.onClose(); }, style: btn }, 'Đóng') : null
            )
          ) :
          !playing ? h('div', { style: { width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(0,0,0,0.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' } }, '▶') :
          null
        ),
        passThrough ? h('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 3, pointerEvents: 'none', textAlign: 'center', padding: '6px', fontSize: '0.8rem', color: '#fff', background: 'rgba(0,0,0,0.6)' } }, 'Chạm vào video để bắt đầu phát') : null
      ),
      // Thanh điều khiển riêng — chỉ trong đoạn của câu này
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' } },
        h('button', { type: 'button', onClick: toggle, disabled: status !== 'ready', style: btn, 'aria-label': playing ? 'Tạm dừng' : 'Phát' }, playing ? '❚❚' : '▶'),
        h('button', { type: 'button', onClick: function(){ seekTo(cur - 10); }, disabled: status !== 'ready', style: btn, 'aria-label': 'Lùi 10 giây' }, '↺10'),
        h('input', {
          type: 'range', min: 0, max: total || 1, step: 1, value: pos, disabled: status !== 'ready' || !total,
          onChange: function(e){ seekTo(start + Number(e.target.value)); },
          'aria-label': 'Tua trong đoạn chữa câu ' + info.index,
          style: { flex: 1, minWidth: 0, accentColor: 'var(--accent-strong, #2563eb)' }
        }),
        h('span', { style: { fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: 'var(--muted, #64748b)' } },
          fmtClock(pos) + ' / ' + (total ? fmtClock(total) : '--:--')),
        h('button', { type: 'button', onClick: cycleRate, disabled: status !== 'ready', style: btn, 'aria-label': 'Tốc độ phát' }, rate + '×'),
        canFull ? h('button', { type: 'button', onClick: fullscreen, style: btn, 'aria-label': 'Toàn màn hình' }, '⛶') : null
      )
    );
  }

  // ---------- Modal phát đoạn video (dùng cho cả admin xem thử và học sinh) ----------
  // info: kết quả forQuestion() hoặc { videoId, index, examTitle, start, end }.
  // onClose: đóng modal. Trả phần tử React (h = React.createElement).
  // SỬA 16/10/2026: bỏ link "Mở trên YouTube" (học sinh mở ra sẽ xem được câu
  // khác / cả đề và sao chép link gửi người khác); dùng SegmentPlayer ở trên.
  function renderModal(h, info, onClose){
    if(!info) return null;
    var span = info.end != null ? ('Đoạn ' + fmtClock(info.start) + ' → ' + fmtClock(info.end)) : ('Từ ' + fmtClock(info.start) + ' đến hết video');
    return h('div', {
      role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Video thầy chữa câu ' + info.index,
      onClick: function(e){ if(e.target === e.currentTarget) onClose(); },
      style: { position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(15,23,42,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px' }
    },
      h('div', { style: { width: '100%', maxWidth: '760px', background: 'var(--surface, #fff)', color: 'var(--ink, #0f172a)', borderRadius: '14px', padding: '14px 16px 16px', boxShadow: '0 20px 60px rgba(0,0,0,0.35)', maxHeight: '96vh', overflowY: 'auto' } },
        h('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' } },
          h('div', null,
            h('div', { style: { fontWeight: 700, fontSize: '1rem' } }, '🎥 Thầy chữa Câu ' + info.index + (info.examTitle ? ' — ' + info.examTitle : '')),
            h('div', { style: { fontSize: '0.8rem', color: 'var(--muted, #64748b)', marginTop: '2px' } }, span)
          ),
          h('button', { type: 'button', onClick: onClose, 'aria-label': 'Đóng', style: { border: 'none', background: 'transparent', fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer', color: 'inherit', padding: '2px 6px' } }, '✕')
        ),
        h(SegmentPlayer, { key: info.videoId + ':' + info.start + ':' + info.end, info: info, onClose: onClose }),
        h('div', { style: { marginTop: '8px', fontSize: '0.8rem', color: 'var(--muted, #64748b)' } }, 'Không xem được video? Em báo thầy nhé.')
      )
    );
  }

  window.OPC_WALKTHROUGH = {
    parseTime: parseTime, fmtClock: fmtClock, fmtVi: fmtVi,
    parseYouTubeId: parseYouTubeId, embedUrl: embedUrl, watchUrl: watchUrl,
    parseMarks: parseMarks, checkMarks: checkMarks, getSegment: getSegment,
    register: register, clearRegistry: clearRegistry, splitQuestionId: splitQuestionId,
    forQuestion: forQuestion, renderModal: renderModal
  };
})();
