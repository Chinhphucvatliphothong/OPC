/**
 * OPC Luyện Thi Vật Lí — VIDEO CHỮA ĐỀ GẮN MỐC THỜI GIAN
 * ---------------------------------------------------------------------
 * THÊM 1/10/2026. File dùng CHUNG cho admin.html (dán link + mốc, xem thử)
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

  // ---------- Modal phát đoạn video (dùng cho cả admin xem thử và học sinh) ----------
  // info: kết quả forQuestion() hoặc { videoId, index, examTitle, start, end }.
  // onClose: đóng modal. Trả phần tử React (h = React.createElement).
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
        h('div', { style: { position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000', borderRadius: '10px', overflow: 'hidden' } },
          h('iframe', {
            key: info.videoId + ':' + info.start + ':' + info.end,
            src: embedUrl(info.videoId, info.start, info.end),
            title: 'Video chữa đề — Câu ' + info.index,
            allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
            allowFullScreen: true, referrerPolicy: 'strict-origin-when-cross-origin',
            style: { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }
          })
        ),
        h('div', { style: { marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', fontSize: '0.8rem', color: 'var(--muted, #64748b)' } },
          h('a', { href: watchUrl(info.videoId, info.start), target: '_blank', rel: 'noopener noreferrer', style: { color: 'var(--accent-strong, #2563eb)', fontWeight: 600 } }, 'Mở trên YouTube ↗'),
          h('span', null, 'Không xem được video? Em báo thầy nhé.')
        )
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
