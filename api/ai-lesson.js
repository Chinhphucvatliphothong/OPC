// ================= FaradayAI — Soạn nháp kịch bản BÀI GIẢNG LÝ THUYẾT =================
// THÊM 23/10/2026 — Vercel Serverless Function, dùng CHUNG GEMINI_API_KEY / GEMINI_MODEL với các api/ai-*.js khác
// (không cần cấu hình thêm). Thầy bấm "✨ AI soạn nháp" trong admin › 📺 Video bài giảng → trả về kịch bản đúng cú
// pháp của trình phát bài giảng FaradayAI (faraday-extras.js). Đây là BẢN NHÁP: thầy luôn đọc, sửa rồi mới Lưu.
// SỬA 29/10/2026 — kịch bản có HÌNH VẼ ĐỘNG (SVG, mỗi cảnh 1 hình) + chế độ mode:"visuals": chỉ CHÈN hình vào kịch bản
// đã có (không được đổi chữ — server kiểm tra từng dòng). Biến môi trường tuỳ chọn:
//   GEMINI_LESSON_THINKING = low | medium | high   (mặc định low; đặt medium nếu model hỗ trợ để hình chính xác hơn)

var SVG_RULES = [
  'HÌNH VẼ ĐỘNG (rất quan trọng — học sinh cần NHÌN thấy hiện tượng, không chỉ đọc chữ):',
  '  [svg: <svg viewBox="0 0 400 240">…</svg>]   ← MỘT dòng duy nhất, không xuống dòng bên trong, đặt SAU các ý chính của cảnh',
  '  và NGAY SAU nó là một dòng "> …" mô tả hình bằng lời (đọc thành tiếng, không chứa LaTeX).',
  'Quy tắc vẽ:',
  '  • viewBox="0 0 400 240". KHÔNG vẽ hình nền (khung chứa đã tối). Màu: chữ #f5f1e6, vàng #c9a25f, xanh dương #60a5fa,',
  '    xanh lá #34d399, đỏ #fb7185, cam #f59e0b, tím #a78bfa, đường phụ #64748b. Nét vẽ dày 2–3, chữ font-size 14–18.',
  '  • Nhãn bằng tiếng Việt NGẮN (tối đa 3 từ) và ký hiệu Unicode (Δ θ λ ω ρ ² ³ ₀ ₁ → ↑), KHÔNG dùng LaTeX trong hình.',
  '  • Cho hình CHUYỂN ĐỘNG khi hiện tượng có chuyển động (hạt, sóng, dao động, dòng điện, hạt nhân phân rã…) bằng',
  '    <animate>, <animateTransform>, <animateMotion> với repeatCount="indefinite" và dur 2–6s. Hình tĩnh thì thôi.',
  '  • CHỈ dùng các thẻ: svg g defs path circle ellipse rect line polyline polygon text tspan linearGradient radialGradient',
  '    stop marker animate animateTransform animateMotion set. CẤM script, style, image, foreignObject, sự kiện onclick/onload…,',
  '    liên kết ngoài. Mũi tên: định nghĩa <marker> trong <defs>.',
  '  • Hình phải ĐÚNG vật lí (chiều vectơ, chiều dòng điện, tỉ lệ, nhãn đúng). Đơn giản mà đúng tốt hơn cầu kỳ mà sai.',
  '  • Mỗi hình dưới 1800 ký tự. Chọn đúng hình đáng vẽ nhất của cảnh (sơ đồ thí nghiệm, đồ thị, mô hình hạt, vectơ lực…).'
].join('\n');

var SYSTEM_INSTRUCTION = [
  'Bạn là "FaradayAI" — trợ lý soạn bài giảng lý thuyết NGẮN (3–5 phút) môn Vật lí (Vật lí 10, 11 hoặc 12 — theo bài thầy nêu), chương trình GDPT 2018, sách Kết nối tri thức.',
  'Người xem là học sinh vừa làm sai câu hỏi thuộc bài này và cần ôn lại lý thuyết.',
  '',
  'Viết KỊCH BẢN theo ĐÚNG cú pháp sau (mỗi dòng 1 bước, hiện lần lượt trên màn hình):',
  '  # Tiêu đề cảnh            (3–5 cảnh)',
  '  - Ý chính ngắn gọn, có thể chứa công thức $...$ (LaTeX)',
  '  $$ công thức quan trọng $$',
  '  ! Lưu ý / lỗi hay sai',
  '  ? Câu hỏi nhanh để em tự kiểm tra',
  '  [svg: <svg …>…</svg>]     hình vẽ minh hoạ (xem quy tắc bên dưới)',
  '  > Lời giảng đọc thành tiếng cho DÒNG NGAY TRÊN (tiếng Việt nói tự nhiên, KHÔNG chứa LaTeX, đọc công thức bằng lời)',
  '',
  'Yêu cầu: chính xác tuyệt đối theo SGK; ngắn gọn, mỗi ý tối đa 20 từ; dùng đơn vị SI; nêu rõ lỗi',
  'học sinh hay mắc; mỗi công thức $$...$$ PHẢI có một dòng "> ..." ngay sau để đọc bằng lời; giọng thầy giáo thân',
  'thiện, xưng "mình"/"em". MỖI CẢNH (trừ cảnh chỉ có câu hỏi) PHẢI có 1 hình [svg: …] minh hoạ đúng nội dung cảnh.',
  'Không viết gì ngoài kịch bản, không dùng markdown khác, không code fence.',
  '',
  SVG_RULES,
  '',
  'Dòng đầu tiên PHẢI là: TITLE: <tên bài giảng ngắn gọn>'
].join('\n');

var VISUALS_INSTRUCTION = [
  'Bạn là "FaradayAI" — chuyên vẽ hình minh hoạ cho bài giảng Vật lí. Thầy đưa một KỊCH BẢN BÀI GIẢNG đã viết xong.',
  'Nhiệm vụ DUY NHẤT: CHÈN thêm các hình vẽ [svg: …] vào kịch bản, mỗi cảnh (dòng bắt đầu bằng #) 1 hình (bỏ qua cảnh chỉ có câu hỏi).',
  'TUYỆT ĐỐI KHÔNG sửa, xoá, đổi thứ tự, thêm bớt bất kỳ dòng chữ nào của kịch bản gốc. Trả về TOÀN BỘ kịch bản gốc, nguyên vẹn từng dòng,',
  'chỉ khác là có thêm các cặp dòng:',
  '  [svg: <svg viewBox="0 0 400 240">…</svg>]',
  '  > Lời mô tả hình bằng tiếng Việt tự nhiên (không LaTeX)',
  'đặt SAU các dòng ý chính của cảnh đó (trước dòng "#" của cảnh kế tiếp). Nếu kịch bản đã có dòng [svg: …] thì bỏ chúng và vẽ lại cho đúng.',
  'Không viết gì ngoài kịch bản, không code fence.',
  '',
  SVG_RULES
].join('\n');

function clampStr(v, max){ return String(v == null ? '' : v).slice(0, max); }

// Lọc hình: bỏ dòng [svg: …] hỏng / không an toàn (kèm dòng "> lời mô tả" ngay sau nó) — lớp bảo vệ thứ 2, trình phát còn lọc lại.
var BAD_SVG = /<\s*(script|style|image|foreignObject|iframe|object|embed)\b|\son\w+\s*=|javascript:|data:|xlink:href\s*=\s*["']?\s*https?:|href\s*=\s*["']?\s*https?:/i;
function cleanSvgLines(text){
  var lines = text.split(/\r?\n/), out = [], skipSay = false, n = 0;
  lines.forEach(function(raw){
    var line = raw.trim();
    if(/^\[svg\s*:/i.test(line)){
      var ok = /^\[svg\s*:\s*<svg[\s\S]*<\/svg>\s*\]$/i.test(line) && !BAD_SVG.test(line) && line.length <= 6000;
      if(ok){ out.push(line); n++; skipSay = false; } else skipSay = true;
      return;
    }
    if(skipSay && /^>/.test(line)){ skipSay = false; return; }
    skipSay = false;
    out.push(raw);
  });
  return { text: out.join('\n'), n: n };
}
function stripSvgLines(text){
  var keep = [], skip = false;
  text.split(/\r?\n/).forEach(function(raw){
    var line = raw.trim();
    if(/^\[svg\s*:/i.test(line)){ skip = true; return; }
    if(skip && /^>/.test(line)){ skip = false; return; }
    skip = false;
    if(line) keep.push(line);
  });
  return keep;
}

export default async function handler(req, res){
  if(req.method !== 'POST'){ res.status(405).json({ error: 'Chỉ hỗ trợ POST.' }); return; }
  var apiKey = process.env.GEMINI_API_KEY;
  if(!apiKey){ res.status(500).json({ error: 'Server chưa cấu hình GEMINI_API_KEY (Vercel → Settings → Environment Variables).' }); return; }
  var body = req.body; if(typeof body === 'string'){ try{ body = JSON.parse(body); }catch(e){ body = {}; } } body = body || {};
  var visuals = body.mode === 'visuals';
  var lines = [];
  if(body.title) lines.push('Tên bài giảng thầy đặt: ' + clampStr(body.title, 160));
  if(body.baiName) lines.push('Bài SGK: ' + clampStr(body.baiName, 160));
  var original = [];
  if(visuals){
    var script = clampStr(body.script, 9000);
    original = stripSvgLines(script);
    if(!original.length){ res.status(400).json({ error: 'Chưa có kịch bản để vẽ hình.' }); return; }
    lines.push('', 'KỊCH BẢN GỐC (giữ nguyên từng dòng, chỉ chèn hình):', script);
  } else {
    if(Array.isArray(body.nanoNames) && body.nanoNames.length) lines.push('Tập trung vào các đơn vị kiến thức: ' + body.nanoNames.slice(0, 8).map(function(n){ return clampStr(n, 120); }).join('; '));
    lines.push('Mức độ: ' + (body.level === 'nang-cao' ? 'nâng cao (vận dụng, mẹo giải nhanh)' : 'cơ bản (hiểu bản chất, công thức, lỗi hay sai)'));
    if(body.note) lines.push('Ghi chú của thầy: ' + clampStr(body.note, 300));
    lines.push('', 'Hãy viết kịch bản theo đúng cú pháp.');
  }

  var model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  var thinking = /^(minimal|low|medium|high)$/.test(process.env.GEMINI_LESSON_THINKING || '') ? process.env.GEMINI_LESSON_THINKING : 'low';
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;
  var payload = {
    systemInstruction: { role: 'system', parts: [{ text: visuals ? VISUALS_INSTRUCTION : SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts: [{ text: lines.join('\n') }] }],
    generationConfig: { temperature: visuals ? 0.3 : 0.4, maxOutputTokens: 14000, thinkingConfig: { thinkingLevel: thinking } }
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
    var cl = cleanSvgLines(text);
    text = cl.text;
    if(visuals){
      // AI chỉ được CHÈN hình: bỏ các dòng hình đi thì phải đúng y nguyên kịch bản gốc, từng dòng
      var after = stripSvgLines(text), same = after.length === original.length;
      for(var i = 0; same && i < original.length; i++){ if(after[i] !== original[i]) same = false; }
      if(!same){ res.status(502).json({ error: 'AI lỡ sửa chữ trong kịch bản nên mình không áp dụng (kịch bản của thầy vẫn nguyên). Bấm vẽ lại thử nhé.' }); return; }
      if(!cl.n){ res.status(502).json({ error: 'AI chưa vẽ được hình hợp lệ — bấm vẽ lại thử nhé.' }); return; }
    }
    res.status(200).json({ title: title, script: text, nSvg: cl.n });
  }catch(err){ console.error('Lỗi kết nối Gemini (ai-lesson):', err); res.status(502).json({ error: 'Không kết nối được tới FaradayAI.' }); }
}
