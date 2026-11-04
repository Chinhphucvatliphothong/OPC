// ================= FaradayAI — AI viết KỊCH BẢN LỜI GIẢI ĐỘNG cho 1 câu hỏi =================
// THÊM 4/11/2026 — Vercel Serverless Function, dùng CHUNG GEMINI_API_KEY / GEMINI_MODEL với các api/ai-*.js khác
// (không cần cấu hình thêm). Thầy bấm "✨ AI viết" trong admin › Ngân hàng đề › chi tiết đề › ✨ Lời giải động.
// Trả về kịch bản đúng cú pháp của loigiai-dong.js. Đây là BẢN NHÁP: thầy đọc, sửa rồi mới "Duyệt & phát".
//   mode: "draft"   (mặc định) — viết cả kịch bản từ đề + đáp án + lời giải gốc (.tex) + phân bố đáp án sai của lớp
//   mode: "visuals" — chỉ CHÈN hình [svg: …] vào kịch bản đã có (server kiểm tra không được sửa chữ)
// Biến môi trường tuỳ chọn: GEMINI_LESSON_THINKING = low | medium | high (mặc định low)

var SVG_RULES = [
  'HÌNH VẼ (học sinh cần NHÌN thấy hiện tượng/sơ đồ, không chỉ đọc chữ):',
  '  [svg: <svg viewBox="0 0 400 240">…</svg>]   ← MỘT dòng duy nhất, không xuống dòng bên trong',
  '  và NGAY SAU nó là một dòng "> …" mô tả hình bằng lời (đọc thành tiếng, không chứa LaTeX).',
  'Quy tắc vẽ:',
  '  • viewBox="0 0 400 240". KHÔNG vẽ hình nền (khung chứa màu TRẮNG NGÀ #FFFDF8). Màu: chữ/nét chính #15171C,',
  '    vàng đồng #9A6B1F, xanh dương #1F5FA8, xanh lá #1F7A4D, đỏ #C0392B, cam #D97706, tím #6D28D9, đường phụ #6B7280.',
  '    Tô nền vật thể bằng màu nhạt: xanh nhạt #EAF1FA, đỏ nhạt #FCEDEA, vàng nhạt #F3E3B8. Nét dày 2–3, chữ font-size 14–18.',
  '  • Nhãn tiếng Việt NGẮN (tối đa 3 từ), ký hiệu Unicode (Δ θ λ ω ρ ² ³ ₀ ₁ ₂ → ↑ °), KHÔNG dùng LaTeX trong hình.',
  '  • Có chuyển động (hạt khí, dòng điện, sóng, phân rã…) thì dùng <animate>/<animateTransform>/<animateMotion>',
  '    repeatCount="indefinite", dur 2–6s. Hình tĩnh thì thôi.',
  '  • CHỈ dùng các thẻ: svg g defs path circle ellipse rect line polyline polygon text tspan linearGradient radialGradient',
  '    stop marker animate animateTransform animateMotion set. CẤM script, style, image, foreignObject, sự kiện on…, liên kết ngoài.',
  '  • Hình phải ĐÚNG vật lí và ĐÚNG số liệu của đề. Đơn giản mà đúng tốt hơn cầu kỳ mà sai. Mỗi hình dưới 1800 ký tự.'
].join('\n');

var DRAFT_INSTRUCTION = [
  'Bạn là "FaradayAI" — trợ lý của thầy giáo Vật lí 12 (chương trình GDPT 2018, đề thi tốt nghiệp THPT).',
  'Thầy đưa MỘT câu hỏi (đề, phương án, đáp án đúng, lời giải gốc). Hãy viết KỊCH BẢN LỜI GIẢI ĐỘNG 60–120 giây cho học sinh',
  'vừa làm sai câu này. Giọng thầy giáo thân thiện, xưng "mình"/"em", nói tự nhiên như đang giảng trực tiếp.',
  '',
  'CÚ PHÁP (mỗi dòng 1 bước, hiện lần lượt trên màn hình):',
  '  # Tiêu đề cảnh                 (đúng 5 cảnh, tiêu đề NGẮN 1–3 từ, theo thứ tự: Đọc đề · Chọn định luật · Giải · Bẫy · Mẹo nhớ)',
  '  - Ý chính ngắn (tối đa 18 từ), có thể có công thức $...$',
  '  $$ công thức / phép tính quan trọng $$',
  '  ! Lưu ý / lỗi hay sai',
  '  [hl: cụm 1 | cụm 2 | cụm 3]    tô sáng dữ kiện trong đề — mỗi cụm phải CHÉP Y NGUYÊN từng chữ trong ĐỀ BÀI, không nằm trong $...$',
  '  ? Câu hỏi để em tự làm thử | Gợi ý: gợi ý ngắn     (video dừng chờ em)',
  '  [bẫy X]                        mở đầu đoạn giải thích riêng cho phương án sai X',
  '  [svg: <svg …>…</svg>]           hình minh hoạ',
  '  [3d: tên | xoay | tham số]      MÔ HÌNH 3D xoay được — CHỈ dùng tên có sẵn, tối đa 1 lần, đặt cạnh [svg] cùng cảnh khi đề đúng chủ đề:',
  '                                  binh-khi (chất khí, T=… K, vd T=400) · hat-nhan (Z=… A=…) · nam-cham · day-dan (dòng điện thẳng, I=- nếu ngược)',
  '                                  · khung-day (khung dây quay trong từ trường, từ thông, máy phát). Không đúng chủ đề thì KHÔNG dùng.',
  '  > Lời giảng đọc thành tiếng cho DÒNG NGAY TRÊN (tiếng Việt nói, KHÔNG có LaTeX, đọc số và công thức bằng lời)',
  '',
  'KHUNG BẮT BUỘC:',
  '  1) Cảnh "Đọc đề": dòng "> ..." đầu tiên ngay sau tiêu đề là câu MỞ ĐẦU gây chú ý, nêu cái bẫy của câu (vd: "Câu này có một cái bẫy rất',
  '     quen: đơn vị nhiệt độ."). Sau đó [hl: …] các dữ kiện quan trọng, 1–3 ý "- " tóm tắt dữ kiện/đại lượng cần tìm, kèm [svg: …] nếu đề có',
  '     hiện tượng / sơ đồ / thí nghiệm vẽ được.',
  '  2) Cảnh "Chọn định luật": nêu định luật/công thức dùng và VÌ SAO chọn. Kết thúc bằng đúng 1 dòng "? …" để em tự tính thử, kèm "| Gợi ý: …".',
  '  3) Cảnh "Giải": từng bước bằng $$…$$, mỗi $$ PHẢI có một dòng "> …" ngay sau. Ra đúng đáp án của đề.',
  '  4) Cảnh "Bẫy": với câu trắc nghiệm 4 phương án, viết 1 đoạn [bẫy X] cho MỖI phương án sai (ưu tiên phương án lớp hay chọn), mỗi đoạn',
  '     1–2 dòng nêu em đã làm sai ở đâu để ra X (đúng phép tính dẫn tới X nếu suy ra được). Câu Đúng/Sai: [bẫy a] … cho từng ý a, b, c, d',
  '     (giải thích vì sao ý đó Đúng hoặc Sai). Câu trả lời ngắn: một đoạn [bẫy] (không chữ cái) nêu lỗi hay gặp.',
  '  5) Cảnh "Mẹo nhớ": 1 dòng "! …" mẹo ngắn dễ nhớ + 1 dòng "> …".',
  '',
  'Yêu cầu: chính xác tuyệt đối, đúng số liệu của đề, đơn vị SI, khớp đáp án thầy đưa (nếu lời giải gốc khác thì theo đáp án đúng đã đánh dấu).',
  'Không viết gì ngoài kịch bản, không markdown khác, không code fence.',
  '',
  SVG_RULES
].join('\n');

var VISUALS_INSTRUCTION = [
  'Bạn là "FaradayAI" — chuyên vẽ hình minh hoạ cho lời giải Vật lí. Thầy đưa ĐỀ BÀI và một KỊCH BẢN LỜI GIẢI đã viết xong.',
  'Nhiệm vụ DUY NHẤT: CHÈN 1–2 hình [svg: …] vào kịch bản (ưu tiên cảnh đầu tiên — sơ đồ/hiện tượng của đề — và cảnh giải nếu có đồ thị/vectơ).',
  'TUYỆT ĐỐI KHÔNG sửa, xoá, đổi thứ tự, thêm bớt bất kỳ dòng chữ nào của kịch bản gốc. Trả về TOÀN BỘ kịch bản gốc nguyên vẹn,',
  'chỉ thêm các cặp dòng:',
  '  [svg: <svg viewBox="0 0 400 240">…</svg>]',
  '  > Lời mô tả hình bằng tiếng Việt tự nhiên (không LaTeX)',
  'đặt sau các dòng ý chính của cảnh đó (trước dòng "#" của cảnh kế tiếp). Nếu kịch bản đã có dòng [svg: …] thì bỏ chúng và vẽ lại.',
  'Không viết gì ngoài kịch bản, không code fence.',
  '',
  SVG_RULES
].join('\n');

function clampStr(v, max){ return String(v == null ? '' : v).slice(0, max); }

var BAD_SVG = /<\s*(script|style|image|foreignObject|iframe|object|embed)\b|\son\w+\s*=|javascript:|data:|xlink:href\s*=\s*["']?\s*https?:|href\s*=\s*["']?\s*https?:/i;
function cleanSvgLines(text){
  var out = [], skipSay = false, n = 0;
  text.split(/\r?\n/).forEach(function(raw){
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
// chữ thường của đề (bỏ công thức $…$, lệnh LaTeX trình bày) — để kiểm tra các cụm [hl: …] có thật trong đề
function plainStem(s){
  return String(s || '').replace(/\$[^$]*\$/g, ' ')
    .replace(/\\(?:textbf|textit|emph|underline|text|mathrm)\{([^{}]*)\}/g, '$1')
    .replace(/\\\\/g, '\n').replace(/~/g, ' ').replace(/\\%/g, '%');
}
// giữ các cụm tô sáng có thật trong đề; bỏ dòng [hl] rỗng
function fixHighlights(text, stem){
  var plain = plainStem(stem), nOk = 0, nBad = 0;
  var out = text.split(/\r?\n/).map(function(raw){
    var m = raw.trim().match(/^\[(?:hl|tô sáng)\s*:\s*([^\]]+)\]$/i);
    if(!m) return raw;
    var keep = m[1].split('|').map(function(p){ return p.trim(); }).filter(function(p){
      var ok = p.length >= 2 && p.length <= 80 && plain.indexOf(p) > -1;
      if(ok) nOk++; else nBad++;
      return ok;
    });
    return keep.length ? '[hl: ' + keep.join(' | ') + ']' : null;
  }).filter(function(x){ return x !== null; });
  return { text: out.join('\n'), ok: nOk, dropped: nBad };
}

function describeQuestion(b){
  var L = [];
  if(b.examTitle) L.push('Đề: ' + clampStr(b.examTitle, 160) + (b.index != null ? ' — Câu ' + clampStr(b.index, 6) : ''));
  if(b.groupPassage) L.push('Dữ kiện chung (câu chùm): ' + clampStr(b.groupPassage, 3000));
  L.push('ĐỀ BÀI: ' + clampStr(b.stem, 4000));
  var opts = Array.isArray(b.options) ? b.options.slice(0, 6) : [];
  if(b.type === 'choiceTF'){
    L.push('Dạng: ĐÚNG/SAI (4 ý). Các ý (đáp án đúng ghi trong ngoặc):');
    opts.forEach(function(o){ L.push('  ' + clampStr(o.key, 2) + ') ' + clampStr(o.text, 800) + '  (' + (o.isTrue ? 'ĐÚNG' : 'SAI') + ')'); });
  } else if(b.type === 'shortans'){
    L.push('Dạng: TRẢ LỜI NGẮN. Đáp số đúng: ' + clampStr(b.shortans, 40));
  } else {
    L.push('Dạng: TRẮC NGHIỆM 4 phương án:');
    opts.forEach(function(o){ L.push('  ' + clampStr(o.key, 2) + '. ' + clampStr(o.text, 600) + (o.isTrue ? '   ← ĐÁP ÁN ĐÚNG' : '')); });
  }
  if(b.loigiai) L.push('LỜI GIẢI GỐC (LaTeX của thầy): ' + clampStr(b.loigiai, 5000));
  if(b.wrongDist && typeof b.wrongDist === 'object'){
    var parts = Object.keys(b.wrongDist).slice(0, 8).map(function(k){ return clampStr(k, 2) + ': ' + (Number(b.wrongDist[k]) || 0) + ' em'; });
    if(parts.length) L.push('Phương án SAI học sinh lớp hay chọn: ' + parts.join(', ') + ' (ưu tiên giải thích các phương án này).');
  }
  if(b.note) L.push('Ghi chú của thầy: ' + clampStr(b.note, 400));
  return L.join('\n');
}

export default async function handler(req, res){
  if(req.method !== 'POST'){ res.status(405).json({ error: 'Chỉ hỗ trợ POST.' }); return; }
  var apiKey = process.env.GEMINI_API_KEY;
  if(!apiKey){ res.status(500).json({ error: 'Server chưa cấu hình GEMINI_API_KEY (Vercel → Settings → Environment Variables).' }); return; }
  var body = req.body; if(typeof body === 'string'){ try{ body = JSON.parse(body); }catch(e){ body = {}; } } body = body || {};
  if(!String(body.stem || '').trim()){ res.status(400).json({ error: 'Câu hỏi chưa có nội dung đề.' }); return; }
  var visuals = body.mode === 'visuals';
  var userText = describeQuestion(body), original = [];
  if(visuals){
    var script = clampStr(body.script, 12000);
    original = stripSvgLines(script);
    if(!original.length){ res.status(400).json({ error: 'Chưa có kịch bản để vẽ hình.' }); return; }
    userText += '\n\nKỊCH BẢN GỐC (giữ nguyên từng dòng, chỉ chèn hình):\n' + script;
  } else {
    userText += '\n\nHãy viết kịch bản lời giải động theo đúng cú pháp và khung.';
  }

  var model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  var thinking = /^(minimal|low|medium|high)$/.test(process.env.GEMINI_LESSON_THINKING || '') ? process.env.GEMINI_LESSON_THINKING : 'low';
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;
  var payload = {
    systemInstruction: { role: 'system', parts: [{ text: visuals ? VISUALS_INSTRUCTION : DRAFT_INSTRUCTION }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: { temperature: visuals ? 0.3 : 0.35, maxOutputTokens: 14000, thinkingConfig: { thinkingLevel: thinking } }
  };
  try{
    var up = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    var data = await up.json();
    if(!up.ok){
      console.error('Lỗi Gemini (ai-loigiai):', data);
      var msg = (data && data.error && data.error.message) || 'FaradayAI đang bận, thử lại sau.';
      res.status(up.status === 429 ? 429 : 502).json({ error: up.status === 429 ? 'Đang chạm giới hạn của Google, chờ một lát rồi thử lại.' : msg });
      return;
    }
    var text = '';
    try{ text = (data.candidates[0].content.parts || []).map(function(p){ return p.text || ''; }).join('\n').trim(); }catch(e){ text = ''; }
    text = text.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
    if(!text){ res.status(502).json({ error: 'Chưa viết được — thử lại sau.' }); return; }
    var cl = cleanSvgLines(text);
    text = cl.text;
    if(visuals){
      var after = stripSvgLines(text), same = after.length === original.length;
      for(var i = 0; same && i < original.length; i++){ if(after[i] !== original[i]) same = false; }
      if(!same){ res.status(502).json({ error: 'AI lỡ sửa chữ trong kịch bản nên mình không áp dụng (kịch bản của thầy vẫn nguyên). Bấm vẽ lại thử nhé.' }); return; }
      if(!cl.n){ res.status(502).json({ error: 'AI chưa vẽ được hình hợp lệ — bấm vẽ lại thử nhé.' }); return; }
      res.status(200).json({ script: text, nSvg: cl.n });
      return;
    }
    var fx = fixHighlights(text, (body.groupPassage ? body.groupPassage + '\n' : '') + body.stem);
    text = fx.text;
    if(!/^#/m.test(text)){ res.status(502).json({ error: 'AI trả về sai cú pháp — bấm viết lại thử nhé.' }); return; }
    res.status(200).json({ script: text, nSvg: cl.n, hlOk: fx.ok, hlDropped: fx.dropped });
  }catch(err){ console.error('Lỗi kết nối Gemini (ai-loigiai):', err); res.status(502).json({ error: 'Không kết nối được tới FaradayAI.' }); }
}
