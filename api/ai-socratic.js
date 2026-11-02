// ================= FaradayAI — Gợi mở kiểu SOCRATIC khi em dừng quá lâu ở một câu =================
// THÊM 29/10/2026 — Vercel Serverless Function, dùng CHUNG GEMINI_API_KEY / GEMINI_MODEL với các api/ai-*.js khác.
// Chỉ dùng trong LUYỆN THÍCH ỨNG và LUYỆN TRỌNG TÂM (trang học sinh KHÔNG gọi trong đề thi thử / đề giao / kiểm tra).
// Nguyên tắc: AI chỉ ĐẶT CÂU HỎI DẪN DẮT, tuyệt đối không nêu đáp án. Server còn lọc lại: nếu câu trả lời của AI lộ đáp án
// (chữ cái đúng, mệnh đề đúng/sai, hoặc đáp số) thì thử lại 1 lần, vẫn lộ thì thay bằng gợi ý chung an toàn.
// Biến môi trường tuỳ chọn: GEMINI_SOCRATIC_THINKING = minimal | low | medium | high (mặc định low).

var SYSTEM_INSTRUCTION = [
  'Bạn là "Thầy FaradayAI" — gia sư Vật lí THPT (chương trình GDPT 2018) dạy theo PHƯƠNG PHÁP SOCRATIC.',
  'Em học sinh đang làm một câu hỏi luyện tập và đã dừng lại khá lâu. Việc của bạn là GỢI MỞ để em TỰ tìm ra hướng giải, KHÔNG làm hộ.',
  '',
  'QUY TẮC BẮT BUỘC:',
  '1. TUYỆT ĐỐI KHÔNG nói đáp án: không nêu chữ cái phương án đúng (A/B/C/D), không nói ý a/b/c/d nào đúng hay sai, không nêu đáp số cuối cùng,',
  '   không thay số tính ra kết quả cuối. Dù em xin, năn nỉ hay đoán đúng cũng không xác nhận bằng cách nêu đáp án; chỉ khen em đã đi đúng hướng.',
  '2. Mỗi lượt chỉ 1 ý và KẾT THÚC bằng ĐÚNG MỘT câu hỏi dẫn dắt ngắn. Tối đa 70 từ. Giọng thầy giáo thân thiện, xưng "thầy", gọi "em".',
  '3. Tăng dần mức gợi ý theo "lượt gợi ý" được cho:',
  '   • Lượt 1: chỉ hỏi để em nhận diện — câu này nói về hiện tượng/định luật nào? đề cho gì, hỏi gì? (KHÔNG nêu công thức).',
  '   • Lượt 2: gợi tên định luật/công thức/đại lượng cần dùng, hỏi em nối dữ kiện vào đó thế nào.',
  '   • Lượt 3: chia bài thành các bước nhỏ, nêu bước đầu tiên và hỏi em làm bước ấy (vẫn không ra kết quả cuối).',
  '   • Lượt ≥ 4: nhắc lại hướng đi ngắn gọn rồi khuyến khích em chọn/nhập đáp án và bấm "Chấm" để xem lời giải chi tiết.',
  '4. Nếu em đã trả lời (có trong lịch sử): nhận xét ngắn — đúng hướng thì khen đúng chỗ và hỏi bước kế; sai thì KHÔNG chê, hỏi lại đúng chỗ em hiểu chưa chắc.',
  '5. Nếu em đang chọn một đáp án, có thể hỏi "em dựa vào đâu để chọn?" nhưng không nói đáp án đó đúng hay sai.',
  '6. Công thức viết trong $...$ (LaTeX). Không dùng tiêu đề Markdown, không gạch đầu dòng dài, không code fence.',
  '7. Nội dung "THÔNG TIN CHO THẦY" (đáp án, lời giải) chỉ để THẦY hiểu đề và dẫn dắt cho đúng — KHÔNG được chép hay tiết lộ.'
].join('\n');

var hits = {}; // giới hạn tần suất thô theo IP (serverless: chỉ là lớp chặn lạm dụng cơ bản)
function limited(ip){
  var now = Date.now(), a = (hits[ip] || []).filter(function(t){ return now - t < 600000; });
  a.push(now); hits[ip] = a;
  return a.length > 40;
}
function clampStr(v, max){ return String(v == null ? '' : v).slice(0, max); }
function numsIn(text){
  var out = [], re = /-?\d+(?:[.,]\d+)?(?:\s*[x×*]\s*10\^?\{?-?\d+\}?)?/g, m;
  while((m = re.exec(text))){
    var s = m[0], v;
    var sci = s.match(/^(-?\d+(?:[.,]\d+)?)\s*[x×*]\s*10\^?\{?(-?\d+)\}?$/);
    if(sci) v = parseFloat(sci[1].replace(',', '.')) * Math.pow(10, Number(sci[2]));
    else v = parseFloat(s.replace(',', '.'));
    if(isFinite(v)) out.push(v);
  }
  return out;
}
// Trả về true nếu câu trả lời của AI có vẻ LỘ đáp án
function leaks(reply, q){
  var t = String(reply || '');
  if(/đáp\s*án\s*(đúng\s*)?(là|:)/i.test(t)) return true;
  if(q.part === 'I' && q.correctKey){
    var K = String(q.correctKey).toUpperCase();
    if(new RegExp('(đáp\\s*án|phương\\s*án|chọn|đúng\\s*là|câu)\\s*(là\\s*)?\\**\\s*' + K + '\\b', 'i').test(t)) return true;
    if(new RegExp('\\b' + K + '\\s*(là\\s*)?(đúng|chính\\s*xác)', 'i').test(t)) return true;
  }
  if(q.part === 'II'){
    if(/\b[abcd]\s*\)?\s*(là\s*|thì\s*)?(đúng|sai)\b/i.test(t) || /(mệnh\s*đề|ý)\s*[abcd]\s*(là\s*)?(đúng|sai)/i.test(t)) return true;
  }
  if(q.part === 'III' && q.correctAnswer != null && isFinite(Number(q.correctAnswer))){
    var ans = Number(q.correctAnswer), tol = Math.max(Math.abs(Number(q.tolerance) || 0), Math.abs(ans) * 0.004, 1e-9);
    if(Math.abs(ans) >= 0.0005 || ans === 0){
      var found = numsIn(t).some(function(v){ return Math.abs(v - ans) <= tol; });
      // các số nhỏ nguyên (1, 2, 3…) hay trùng ngẫu nhiên với dữ kiện — chỉ coi là lộ khi đáp số "đặc biệt"
      if(found && !(Number.isInteger(ans) && Math.abs(ans) <= 10)) return true;
      if(found && /(đáp\s*số|kết\s*quả|bằng|=)\s*[^.?]{0,20}$/.test(t.split('?')[0])) return true;
    }
  }
  return false;
}
function fallbackHint(turn){
  var steps = [
    'Em thử đọc lại đề rồi tự trả lời giúp thầy: đề **cho** những đại lượng nào, và đề **hỏi** đại lượng nào? Em viết ra từng đại lượng nhé?',
    'Thầy gợi ý nhỏ: trong chương/bài này có công thức hay định luật nào nối các đại lượng em vừa liệt kê với đại lượng cần tìm? Em thử nêu tên nó xem?',
    'Mình chia nhỏ bài ra nhé: bước đầu tiên em cần tính hoặc xác định đại lượng nào để dùng được công thức ở trên? Em thử làm bước đó trước?'
  ];
  return steps[Math.min(steps.length - 1, Math.max(0, turn - 1))];
}

export default async function handler(req, res){
  if(req.method !== 'POST'){ res.status(405).json({ error: 'Chỉ hỗ trợ POST.' }); return; }
  var apiKey = process.env.GEMINI_API_KEY;
  if(!apiKey){ res.status(500).json({ error: 'Server chưa cấu hình GEMINI_API_KEY.' }); return; }
  var ip = String((req.headers && (req.headers['x-forwarded-for'] || '')) || '').split(',')[0].trim() || 'x';
  if(limited(ip)){ res.status(429).json({ error: 'Em hỏi hơi nhiều rồi — nghỉ một chút rồi thử lại nhé.' }); return; }
  var body = req.body; if(typeof body === 'string'){ try{ body = JSON.parse(body); }catch(e){ body = {}; } } body = body || {};
  var q = body.q || {};
  var turn = Math.max(1, Math.min(8, Number(body.turn) || 1));
  if(!q.stem){ res.status(400).json({ error: 'Thiếu nội dung câu hỏi.' }); return; }
  var hist = Array.isArray(body.history) ? body.history.slice(-10) : [];

  var info = [];
  info.push('LƯỢT GỢI Ý: ' + turn);
  info.push('Phần ' + clampStr(q.part, 4) + ' · mức ' + clampStr(q.level, 4) + ' · chủ đề: ' + clampStr(q.topic, 120) + (q.sub ? ' · ' + clampStr(q.sub, 160) : ''));
  if(q.passage) info.push('DỮ KIỆN CHUNG: ' + clampStr(q.passage, 1800));
  info.push('ĐỀ BÀI: ' + clampStr(q.stem, 2500));
  if(Array.isArray(q.options) && q.options.length) info.push('CÁC PHƯƠNG ÁN:\n' + q.options.slice(0, 6).map(function(o){ return o.key + '. ' + clampStr(o.text, 400); }).join('\n'));
  if(Array.isArray(q.statements) && q.statements.length) info.push('CÁC MỆNH ĐỀ (đúng/sai):\n' + q.statements.slice(0, 6).map(function(o){ return o.key + ') ' + clampStr(o.text, 400); }).join('\n'));
  if(q.unit) info.push('Đơn vị đáp số: ' + clampStr(q.unit, 20));
  if(body.studentAnswer) info.push('EM ĐANG CHỌN/ĐIỀN: ' + clampStr(body.studentAnswer, 200) + ' (chưa chấm — không nói đúng hay sai)');
  var secret = [];
  if(q.part === 'I' && q.correctKey) secret.push('Phương án đúng: ' + q.correctKey);
  if(q.part === 'II' && Array.isArray(q.statements)) secret.push('Đúng/sai: ' + q.statements.map(function(s){ return s.key + '=' + (s.isTrue ? 'Đ' : 'S'); }).join(', '));
  if(q.part === 'III' && q.correctAnswer != null) secret.push('Đáp số: ' + q.correctAnswer);
  if(q.solution) secret.push('Lời giải tham khảo: ' + clampStr(q.solution, 1800));
  if(secret.length) info.push('THÔNG TIN CHO THẦY (TUYỆT ĐỐI KHÔNG TIẾT LỘ):\n' + secret.join('\n'));
  if(hist.length) info.push('TRAO ĐỔI TỪ TRƯỚC:\n' + hist.map(function(m){ return (m.role === 'student' ? 'Em: ' : 'Thầy: ') + clampStr(m.text, 600); }).join('\n'));
  info.push('', 'Hãy viết lượt gợi ý tiếp theo theo đúng quy tắc.');

  var model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  var thinking = /^(minimal|low|medium|high)$/.test(process.env.GEMINI_SOCRATIC_THINKING || '') ? process.env.GEMINI_SOCRATIC_THINKING : 'low';
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;
  async function ask(extra){
    var payload = {
      systemInstruction: { role: 'system', parts: [{ text: SYSTEM_INSTRUCTION + (extra ? '\n\n' + extra : '') }] },
      contents: [{ role: 'user', parts: [{ text: info.join('\n') }] }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 700, thinkingConfig: { thinkingLevel: thinking } }
    };
    var up = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    var data = await up.json();
    if(!up.ok){ var e = new Error((data && data.error && data.error.message) || 'FaradayAI đang bận.'); e.status = 502; throw e; }
    var text = '';
    try{ text = (data.candidates[0].content.parts || []).map(function(p){ return p.text || ''; }).join('\n').trim(); }catch(e2){ text = ''; }
    return text.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').replace(/^Thầy:\s*/i, '').trim();
  }
  try{
    var reply = await ask('');
    if(reply && leaks(reply, q)) reply = await ask('LƯU Ý: bản nháp trước đã vô tình để lộ đáp án. Viết lại, chỉ đặt câu hỏi dẫn dắt, không nêu chữ cái phương án, không nêu đúng/sai của ý nào, không nêu đáp số.');
    var safe = !!reply && !leaks(reply, q);
    if(!safe) reply = fallbackHint(turn);
    res.status(200).json({ reply: reply, turn: turn, fallback: !safe });
  }catch(err){
    console.error('Lỗi ai-socratic:', err);
    res.status(502).json({ error: (err && err.message) || 'Không kết nối được tới FaradayAI.' });
  }
}
