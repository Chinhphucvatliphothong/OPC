// ========= OPC Learning AI — Ưu tiên thích ứng (Adaptive Priority) =========
// Vercel Serverless Function, dùng CHUNG GEMINI_API_KEY/GEMINI_MODEL với
// api/ai-tutor.js và api/ai-suggest.js — không cần cấu hình thêm gì trên
// Vercel.
//
// VAI TRÒ: đây là bước "nâng cấp CAT-lite bằng AI" mà thầy yêu cầu, mô
// phỏng (ở quy mô nhỏ) đúng vai trò "ước lượng độ thành thạo + quyết định
// thứ tự nên học" của LAM (Large Adaptive Model) bên Squirrel AI — KHÔNG
// PHẢI để chọn từng câu hỏi (việc đó vẫn do pickAdaptiveQuestion trong
// prepscholar.js làm, tức thời, không cần gọi AI, để không làm chậm trải
// nghiệm làm bài). Thay vào đó, hàm này chỉ được gọi 1 LẦN khi bắt đầu 1
// lượt Luyện tập thích ứng (xem startAdaptiveDrill trong prepscholar-ui.js)
// để quyết định CHIẾN LƯỢC: nên ưu tiên Tag (nano-point) nào trước — dựa
// trên suy luận ngữ nghĩa (Tag nào là kiến thức nền cần chắc trước, Tag nào
// có vẻ cùng một lỗ hổng gốc) — thứ mà thuật toán cũ (chỉ sắp theo số %
// thấp nhất) không làm được. pickAdaptiveQuestion vẫn chạy tức thời cho
// từng câu bên trong Tag ưu tiên đó, dùng đúng thuật toán CAT-lite cũ.
//
// Đây là mẫu hình "AI hoạch định chiến lược (chậm, 1 lần) + thuật toán
// thực thi nhanh (tức thời, mỗi câu)" — cách tiếp cận thực tế cho quy mô
// nhỏ, thay vì phải tự huấn luyện một mô hình như LAM (cần dữ liệu hàng
// chục triệu học sinh).

var SYSTEM_INSTRUCTION = [
  'Bạn là "OPC Learning AI" — bộ não hoạch định lộ trình luyện tập thích',
  'ứng của OPC Luyện Thi Vật Lí, môn Vật Lí lớp 12 (chương trình GDPT 2018).',
  '',
  'Bạn sẽ được đưa một danh sách các nano-point (đơn vị kiến thức nhỏ nhất)',
  'mà một học sinh đang còn yếu, kèm % mức thành thạo hiện tại, tên chuyên',
  'đề và tên bài chứa nano-point đó. Nhiệm vụ: SẮP XẾP LẠI danh sách này',
  'theo thứ tự nên luyện TRƯỚC — SAU, dựa trên suy luận về mối quan hệ kiến',
  'thức (không chỉ dựa vào số % thấp nhất — đó là việc thuật toán thường đã',
  'làm được), cụ thể ưu tiên:',
  '',
  '1) Nano-point nào là kiến thức NỀN TẢNG mà các nano-point khác trong',
  '   danh sách phụ thuộc vào (ví dụ: phải hiểu công thức cơ bản của một',
  '   đại lượng trước khi làm được bài toán ứng dụng phức tạp hơn liên quan',
  '   đại lượng đó) — nano-point nền tảng nên xếp lên trước.',
  '2) Nếu nhiều nano-point có vẻ cùng xuất phát từ MỘT lỗ hổng gốc (ví dụ',
  '   đều liên quan tới việc nhầm lẫn cùng một loại công thức/đơn vị), hãy',
  '   nhóm và ưu tiên nano-point đại diện rõ nhất cho lỗ hổng đó lên trước.',
  '3) Nếu không đủ căn cứ để sắp khác thứ tự đã cho, GIỮ NGUYÊN thứ tự đã',
  '   cho (đã sắp theo % yếu nhất trước) — không đảo lộn tuỳ tiện.',
  '',
  'CHỈ trả lời bằng ĐÚNG MỘT đối tượng JSON hợp lệ, không kèm bất kỳ chữ nào',
  'khác, không dùng markdown/code fence (không có ```), theo ĐÚNG hình dạng:',
  '{"priority": ["id1", "id2", ...], "reason": "..."}',
  'Trong đó "priority" là danh sách id nano-point theo đúng thứ tự nên luyện',
  '(PHẢI dùng đúng id đã cho trong danh sách, không tự bịa id mới, không bỏ',
  'sót id nào), và "reason" là MỘT câu ngắn (dưới 40 từ) giải thích ngắn gọn',
  'vì sao Tag đầu tiên được ưu tiên nhất — viết cho học sinh đọc, dễ hiểu,',
  'không thuật ngữ sư phạm khô khan.'
].join('\n');

function clampStr(val, max){
  return String(val == null ? '' : val).slice(0, max);
}

function buildUserPrompt(candidates){
  var lines = ['Danh sách nano-point đang yếu (id | tên | chuyên đề · bài | % thành thạo hiện tại):'];
  candidates.forEach(function(c){
    lines.push(c.id + ' | ' + c.name + ' | ' + c.topicName + ' · ' + c.baiName + ' | ' + c.mastery + '%');
  });
  lines.push('');
  lines.push('Hãy sắp xếp lại thứ tự ưu tiên luyện tập theo đúng hướng dẫn ở system instruction.');
  return lines.join('\n');
}

// Trích JSON từ text trả lời — phòng khi model vẫn lỡ bọc trong ```json
// (dù đã dặn không dùng) hoặc thêm khoảng trắng/xuống dòng thừa quanh JSON.
function extractJson(raw){
  var s = String(raw || '').trim();
  var fence = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if(fence) s = fence[1].trim();
  var start = s.indexOf('{');
  var end = s.lastIndexOf('}');
  if(start > -1 && end > start) s = s.slice(start, end + 1);
  try{ return JSON.parse(s); }catch(e){ return null; }
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

  var candidates = Array.isArray(body.candidates) ? body.candidates.slice(0, 15).map(function(c){
    return {
      id: clampStr(c && c.id, 80),
      name: clampStr(c && c.name, 120),
      topicName: clampStr(c && c.topicName, 80),
      baiName: clampStr(c && c.baiName, 80),
      mastery: (c && c.mastery != null) ? Number(c.mastery) : 0
    };
  }).filter(function(c){ return !!c.id; }) : [];

  if(!candidates.length){
    res.status(400).json({ error: 'Thiếu danh sách nano-point (candidates).' });
    return;
  }

  var model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;

  var payload = {
    systemInstruction: { role: 'system', parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts: [{ text: buildUserPrompt(candidates) }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
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
      console.error('Lỗi gọi Gemini (ai-adaptive-priority):', data);
      res.status(502).json({ error: (data && data.error && data.error.message) || 'OPC Learning AI đang bận, thử lại sau.' });
      return;
    }

    var raw = '';
    try{
      var candidate = data.candidates && data.candidates[0];
      var parts = candidate && candidate.content && candidate.content.parts;
      raw = (parts || []).map(function(p){ return p.text || ''; }).join('').trim();
    }catch(e){ raw = ''; }

    var parsed = extractJson(raw);

    // Bảo vệ: chỉ chấp nhận id AI trả về đúng nằm trong danh sách candidates
    // gửi lên (không cho AI "bịa" id lạ làm hỏng luồng chọn câu tiếp theo ở
    // phía client) — id lạ bị lọc bỏ; id bị thiếu (AI quên) được bổ sung lại
    // ở cuối theo đúng thứ tự gốc (đã sắp theo % yếu nhất).
    var validIds = {};
    candidates.forEach(function(c){ validIds[c.id] = true; });
    var priority = Array.isArray(parsed && parsed.priority) ? parsed.priority.filter(function(id){ return validIds[id]; }) : [];
    var seen = {};
    priority.forEach(function(id){ seen[id] = true; });
    candidates.forEach(function(c){ if(!seen[c.id]) priority.push(c.id); });

    if(!priority.length){
      res.status(502).json({ error: 'OPC Learning AI chưa đưa ra được thứ tự ưu tiên — thử lại sau.' });
      return;
    }

    res.status(200).json({
      priority: priority,
      reason: clampStr(parsed && parsed.reason, 300) || 'Ưu tiên theo mức thành thạo thấp nhất hiện tại.'
    });
  }catch(err){
    console.error('Lỗi kết nối Gemini (ai-adaptive-priority):', err);
    res.status(502).json({ error: 'Không kết nối được tới OPC Learning AI — kiểm tra mạng hoặc thử lại sau.' });
  }
}

