// ================= FaradayAI — Soạn nháp kịch bản BÀI GIẢNG LÝ THUYẾT =================
// THÊM 23/10/2026 — Vercel Serverless Function, dùng CHUNG GEMINI_API_KEY / GEMINI_MODEL với các api/ai-*.js khác
// (không cần cấu hình thêm). Thầy bấm "✨ AI soạn nháp" trong admin › 📺 Video bài giảng → trả về kịch bản đúng cú
// pháp của trình phát bài giảng FaradayAI (faraday-extras.js). Đây là BẢN NHÁP: thầy luôn đọc, sửa rồi mới Lưu.

var SYSTEM_INSTRUCTION = [
  'Bạn là "FaradayAI" — trợ lý soạn bài giảng lý thuyết NGẮN (3–5 phút) môn Vật lí 12, chương trình GDPT 2018,',
  'luyện thi Tốt nghiệp THPT. Người xem là học sinh lớp 12 vừa làm sai câu hỏi thuộc bài này và cần ôn lại lý thuyết.',
  '',
  'Viết KỊCH BẢN theo ĐÚNG cú pháp sau (mỗi dòng 1 bước, hiện lần lượt trên màn hình):',
  '  # Tiêu đề cảnh            (3–5 cảnh)',
  '  - Ý chính ngắn gọn, có thể chứa công thức $...$ (LaTeX)',
  '  $$ công thức quan trọng $$',
  '  ! Lưu ý / lỗi hay sai',
  '  ? Câu hỏi nhanh để em tự kiểm tra',
  '  > Lời giảng đọc thành tiếng cho DÒNG NGAY TRÊN (tiếng Việt nói tự nhiên, KHÔNG chứa LaTeX, đọc công thức bằng lời)',
  '',
  'Yêu cầu: chính xác tuyệt đối theo SGK Vật lí 12 (2018); ngắn gọn, mỗi ý tối đa 20 từ; dùng đơn vị SI; nêu rõ lỗi',
  'học sinh hay mắc; mỗi công thức $$...$$ PHẢI có một dòng "> ..." ngay sau để đọc bằng lời; giọng thầy giáo thân',
  'thiện, xưng "mình"/"em". Không viết gì ngoài kịch bản, không dùng markdown khác, không code fence.',
  'Dòng đầu tiên PHẢI là: TITLE: <tên bài giảng ngắn gọn>'
].join('\n');

function clampStr(v, max){ return String(v == null ? '' : v).slice(0, max); }

export default async function handler(req, res){
  if(req.method !== 'POST'){ res.status(405).json({ error: 'Chỉ hỗ trợ POST.' }); return; }
  var apiKey = process.env.GEMINI_API_KEY;
  if(!apiKey){ res.status(500).json({ error: 'Server chưa cấu hình GEMINI_API_KEY (Vercel → Settings → Environment Variables).' }); return; }
  var body = req.body; if(typeof body === 'string'){ try{ body = JSON.parse(body); }catch(e){ body = {}; } } body = body || {};
  var lines = [];
  if(body.title) lines.push('Tên bài giảng thầy đặt: ' + clampStr(body.title, 160));
  if(body.baiName) lines.push('Bài SGK: ' + clampStr(body.baiName, 160));
  if(Array.isArray(body.nanoNames) && body.nanoNames.length) lines.push('Tập trung vào các đơn vị kiến thức: ' + body.nanoNames.slice(0, 8).map(function(n){ return clampStr(n, 120); }).join('; '));
  lines.push('Mức độ: ' + (body.level === 'nang-cao' ? 'nâng cao (vận dụng, mẹo giải nhanh)' : 'cơ bản (hiểu bản chất, công thức, lỗi hay sai)'));
  if(body.note) lines.push('Ghi chú của thầy: ' + clampStr(body.note, 300));
  lines.push('', 'Hãy viết kịch bản theo đúng cú pháp.');

  var model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;
  var payload = {
    systemInstruction: { role: 'system', parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts: [{ text: lines.join('\n') }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 2400, thinkingConfig: { thinkingLevel: 'low' } }
  };
  try{
    var up = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    var data = await up.json();
    if(!up.ok){ console.error('Lỗi Gemini (ai-lesson):', data); res.status(502).json({ error: (data && data.error && data.error.message) || 'FaradayAI đang bận, thử lại sau.' }); return; }
    var text = '';
    try{ text = (data.candidates[0].content.parts || []).map(function(p){ return p.text || ''; }).join('\n').trim(); }catch(e){ text = ''; }
    text = text.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
    if(!text){ res.status(502).json({ error: 'Chưa soạn được — thử lại sau.' }); return; }
    var title = '', m = text.match(/^TITLE:\s*(.+)$/m);
    if(m){ title = m[1].trim(); text = text.replace(m[0], '').trim(); }
    res.status(200).json({ title: title, script: text });
  }catch(err){ console.error('Lỗi kết nối Gemini (ai-lesson):', err); res.status(502).json({ error: 'Không kết nối được tới FaradayAI.' }); }
}
