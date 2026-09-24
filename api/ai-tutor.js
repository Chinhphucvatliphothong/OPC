// ================= OPC Learning AI (Gia sư ảo cá nhân hoá) =================
// Vercel Serverless Function — đây là NƠI DUY NHẤT trong dự án giữ một API
// key bí mật ở phía SERVER (mọi thứ khác trong OPC đều chạy thuần
// frontend + Firestore, xem ghi chú bảo mật trong firestore.rules). Học
// sinh bấm "Hỏi OPC Learning AI" trong Sổ tay câu sai (xem askAiTutor trong
// prepscholar-ui.js) sẽ gọi POST /api/ai-tutor kèm nội dung câu vừa làm
// sai; hàm này gọi Gemini rồi trả về đoạn giải thích, trình duyệt KHÔNG
// bao giờ thấy API key thật.
//
// ⚙️ CẦN LÀM TRÊN VERCEL (không có trong code — không commit key thật vào
// GitHub):
//   Vercel Dashboard → chọn project → Settings → Environment Variables
//     GEMINI_API_KEY = <key lấy miễn phí tại aistudio.google.com/app/apikey>
//     GEMINI_MODEL   = gemini-3.6-flash   (tuỳ chọn — bỏ trống dùng mặc định)
//   Rồi bấm Redeploy (biến môi trường mới chỉ có hiệu lực từ lần deploy sau).
//
// ⚠️ Giới hạn hiện tại: endpoint này không có xác thực/giới hạn tần suất
// thật (khớp với đánh đổi bảo mật "chưa có Firebase Auth thật" đã ghi ở
// firestore.rules) — chỉ giới hạn độ dài input/output để tránh tốn phí bất
// thường. Phù hợp quy mô 1 lớp/1 trường; cần nâng cấp nếu mở rộng công khai.

var SYSTEM_INSTRUCTION = [
  'Bạn là "OPC Learning AI" — gia sư ảo cá nhân hoá của OPC Luyện Thi Vật Lí,',
  'chuyên Vật Lí lớp 12 (chương trình GDPT 2018, thi Tốt nghiệp THPT), thân thiện, kiên nhẫn,',
  'nói tiếng Việt tự nhiên, đúng thuật ngữ Vật Lí phổ thông Việt Nam.',
  '',
  'Khi được đưa một câu hỏi học sinh vừa làm SAI, hãy trả lời theo đúng',
  'cấu trúc sau, viết thành đoạn văn liền mạch — KHÔNG dùng markdown',
  '(không #, không **, không bảng, không gạch đầu dòng lồng nhau):',
  '',
  '1) Giải thích ngắn gọn (khoảng 120-200 từ) bản chất kiến thức/công thức',
  '   cần nắm để giải đúng câu này — giúp học sinh HIỂU vì sao làm vậy,',
  '   không chỉ chép lại lời giải.',
  '2) Nếu đề có sẵn lời giải của giáo viên, hãy bám sát đúng cách giải và',
  '   ký hiệu đó, diễn giải lại cho dễ hiểu hơn — KHÔNG tự bịa ra cách',
  '   giải khác nếu không chắc chắn đúng.',
  '3) Nêu 1 lỗi sai phổ biến học sinh hay mắc ở dạng câu này (nếu xác định',
  '   được) để tránh lặp lại.',
  '4) Kết 1 câu ngắn khích lệ, không giáo điều, không lặp lại đáp án nhiều lần.',
  '',
  'Nếu không đủ dữ kiện để giải thích chắc chắn, hãy nói rõ giới hạn thay vì',
  'đoán bừa. Công thức Vật Lí viết bằng ký hiệu thường (^, /, ×, °) — không',
  'dùng cú pháp LaTeX ($, \\frac, \\sqrt...).'
].join('\n');

function clampStr(val, max){
  return String(val == null ? '' : val).slice(0, max);
}

function buildUserPrompt(q){
  var lines = [];
  lines.push('Chuyên đề: ' + (q.topicName || 'Không rõ') + (q.subtopic ? (' — ' + q.subtopic) : ''));
  if(q.level) lines.push('Mức độ: ' + q.level);
  lines.push('');
  lines.push('Đề bài:');
  lines.push(q.stem || '(không có nội dung đề)');

  if(q.options && q.options.length){
    lines.push('');
    lines.push('Các lựa chọn:');
    q.options.forEach(function(o){ lines.push((o.key || '?') + '. ' + (o.text || '')); });
    if(q.correctKey) lines.push('Đáp án đúng: ' + q.correctKey);
  } else if(q.statements && q.statements.length){
    lines.push('');
    lines.push('Các mệnh đề Đúng/Sai:');
    q.statements.forEach(function(st){ lines.push((st.key || '?') + ') ' + (st.text || '') + ' — ' + (st.isTrue ? 'ĐÚNG' : 'SAI')); });
  } else if(q.correctAnswer != null){
    lines.push('');
    lines.push('Đáp án đúng (điền số): ' + q.correctAnswer + (q.unit ? (' ' + q.unit) : ''));
  }

  if(q.loiGiai){
    lines.push('');
    lines.push('Lời giải của giáo viên (bám sát cách giải này):');
    lines.push(q.loiGiai);
  }

  lines.push('');
  lines.push('Học sinh vừa làm SAI câu này. Hãy giải thích lại theo đúng hướng dẫn ở system instruction.');
  return lines.join('\n');
}

export default async function handler(req, res){
  if(req.method !== 'POST'){
    res.status(405).json({ error: 'Chỉ hỗ trợ POST.' });
    return;
  }

  var apiKey = process.env.GEMINI_API_KEY;
  if(!apiKey){
    res.status(500).json({
      error: 'Server chưa cấu hình GEMINI_API_KEY — thầy cô cần thêm biến môi trường này trong Vercel Project Settings → Environment Variables rồi Redeploy.'
    });
    return;
  }

  var body = req.body;
  if(typeof body === 'string'){
    try{ body = JSON.parse(body); }catch(e){ body = {}; }
  }
  body = body || {};

  var stem = clampStr(body.stem, 2000);
  if(!stem.trim()){
    res.status(400).json({ error: 'Thiếu nội dung câu hỏi (stem).' });
    return;
  }

  var q = {
    stem: stem,
    topicName: clampStr(body.topicName, 200),
    subtopic: clampStr(body.subtopic, 200),
    level: clampStr(body.level, 10),
    options: Array.isArray(body.options) ? body.options.slice(0, 6).map(function(o){
      return { key: clampStr(o && o.key, 5), text: clampStr(o && o.text, 500) };
    }) : null,
    correctKey: body.correctKey ? clampStr(body.correctKey, 5) : null,
    statements: Array.isArray(body.statements) ? body.statements.slice(0, 8).map(function(st){
      return { key: clampStr(st && st.key, 5), text: clampStr(st && st.text, 500), isTrue: !!(st && st.isTrue) };
    }) : null,
    correctAnswer: (body.correctAnswer != null) ? body.correctAnswer : null,
    unit: body.unit ? clampStr(body.unit, 20) : '',
    loiGiai: body.loiGiai ? clampStr(body.loiGiai, 3000) : ''
  };

  var model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;

  var payload = {
    systemInstruction: { role: 'system', parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts: [{ text: buildUserPrompt(q) }] }],
    // maxOutputTokens: các model Gemini 3.x (như gemini-3.6-flash) mặc định
    // bật "suy nghĩ ngầm" (thinking) và phần suy nghĩ đó CŨNG tính vào
    // maxOutputTokens — nếu để budget thấp (như 600 cũ) sẽ bị ngốn hết vào
    // suy nghĩ, khiến câu trả lời thật bị cắt cụt giữa chừng. Hạ
    // thinkingLevel xuống 'low' (đủ dùng cho việc giải thích, không cần suy
    // luận phức tạp) + nâng maxOutputTokens lên để chừa đủ chỗ cho câu trả
    // lời đầy đủ.
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1536,
      thinkingConfig: { thinkingLevel: 'low' }
    }
  };

  try{
    var upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var data = await upstream.json();

    if(!upstream.ok){
      console.error('Lỗi gọi Gemini:', data);
      res.status(502).json({ error: (data && data.error && data.error.message) || 'OPC Learning AI đang bận, thử lại sau.' });
      return;
    }

    var text = '';
    try{
      var candidate = data.candidates && data.candidates[0];
      var parts = candidate && candidate.content && candidate.content.parts;
      text = (parts || []).map(function(p){ return p.text || ''; }).join('\n').trim();
    }catch(e){ text = ''; }

    if(!text){
      res.status(502).json({ error: 'OPC Learning AI không trả lời được câu này — thử lại sau.' });
      return;
    }

    res.status(200).json({ explanation: text });
  }catch(err){
    console.error('Lỗi kết nối Gemini:', err);
    res.status(502).json({ error: 'Không kết nối được tới OPC Learning AI — kiểm tra mạng hoặc thử lại sau.' });
  }
}
