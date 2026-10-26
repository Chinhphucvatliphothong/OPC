// ================= FaradayAI — CHUYỂN TRANG ĐỀ (PDF/ẢNH) → .tex ĐÚNG MẪU CỦA THẦY =================
// THÊM 26/10/2026 — Vercel Serverless Function, dùng CHUNG GEMINI_API_KEY / GEMINI_MODEL (không cấu hình thêm).
// Admin › Ngân hàng đề › "✨ Nhập từ PDF/ảnh bằng AI": trình duyệt gửi TỪNG TRANG (ảnh JPEG) + trang kế tiếp
// (để chép nốt câu tràn trang). AI trả về:
//   { tex: "...\\begin{ex}...\\end{ex}...", figures: [{ id, img: 0|1, box: [ymin,xmin,ymax,xmax] (0–1000) }], notes }
// Trình duyệt tự CẮT hình theo box, đặt tên đúng id rồi đưa vào form nạp đề như file .tex + ảnh bình thường.

var SYSTEM_INSTRUCTION = [
  'Bạn là trợ lý số hoá đề thi Vật lí THPT (Việt Nam) sang LaTeX cho FaradayAI. Chép CHÍNH XÁC nội dung đề trong ảnh',
  '(không sửa đề, không tự giải lại nếu đề không có lời giải), theo ĐÚNG mẫu LaTeX sau (gói ex_test):',
  '',
  '% PHẦN I — mỗi câu trắc nghiệm 4 phương án:',
  '\\begin{ex}%[M2][Khí lí tưởng][Định luật Boyle]',
  'Nội dung câu hỏi, công thức đặt trong $...$',
  '\\choice',
  '{Phương án A}',
  '{\\True Phương án B đúng}',
  '{Phương án C}',
  '{Phương án D}',
  '\\loigiai{Lời giải nếu đề có}',
  '\\end{ex}',
  '',
  '% PHẦN II — câu Đúng/Sai 4 ý:',
  '\\begin{ex}%[M3][Từ trường][Cảm ứng điện từ]',
  'Đoạn dẫn của câu.',
  '\\choiceTF',
  '{\\True Ý a đúng}',
  '{Ý b sai}',
  '{\\True Ý c đúng}',
  '{Ý d sai}',
  '\\loigiai{...}',
  '\\end{ex}',
  '',
  '% PHẦN III — trả lời ngắn:',
  '\\begin{ex}%[M3][Vật lí nhiệt][Nhiệt dung riêng]',
  'Nội dung câu hỏi.',
  '\\shortans{1{,}73}',
  '\\loigiai{...}',
  '\\end{ex}',
  '',
  'QUY TẮC:',
  '- Đầu mỗi phần ghi đúng 1 dòng tiêu đề: \\tieuephan{PHẦN I} / \\tieuephan{PHẦN II} / \\tieuephan{PHẦN III} khi trong ảnh có tiêu đề phần.',
  '- Tag %[M?][Chủ đề][Dạng bài] ngay sau \\begin{ex}: chọn mức M1 nhận biết, M2 thông hiểu, M3 vận dụng, M4 vận dụng cao; Chủ đề là 1 trong: Vật lí nhiệt, Khí lí tưởng, Từ trường, Vật lí hạt nhân (hoặc chủ đề khác nếu đề không thuộc 4 chủ đề này).',
  '- Đáp án đúng: nếu đề có bảng đáp án / đánh dấu / lời giải thì đặt \\True đúng phương án; nếu KHÔNG xác định được thì không đặt \\True và thêm dòng "% CHUA_CO_DAP_AN" ngay trước \\end{ex}. Không đoán bừa.',
  '- Số thập phân trong công thức dùng {,} (vd $1{,}5$). Đơn vị để ngoài $ hoặc dùng \\text{}. Không dùng \\( \\).',
  '- Câu chùm "Sử dụng các thông tin sau cho Câu 1 và Câu 2:" → chép đoạn dữ kiện thành 1 dòng \\textbf{Sử dụng các thông tin sau cho Câu X và Câu Y:} <nội dung> ĐẶT TRƯỚC các \\begin{ex} của chùm đó.',
  '- HÌNH VẼ / ĐỒ THỊ / BẢNG DẠNG ẢNH: KHÔNG vẽ lại. Đặt \\begin{center}\\includegraphics[width=0.5\\textwidth]{ID}\\end{center} đúng chỗ (trong \\begin{ex} trước \\choice, hoặc trong đoạn dữ kiện câu chùm), với ID dạng h1, h2… và khai báo khung cắt hình trong "figures". Bảng số liệu đơn giản thì chép thành tabular.',
  '- Ảnh có thể gồm 2 trang: ẢNH 1 là trang chính; ẢNH 2 (nếu có) chỉ để chép NỐT câu cuối của ảnh 1 bị tràn sang. Chỉ chép các câu BẮT ĐẦU trên ẢNH 1. Bỏ qua câu đầu ẢNH 1 nếu nó là phần tiếp của câu từ trang trước (đã được chép ở lượt trước).',
  '- Bỏ qua tiêu đề trường, số trang, mã đề, chữ ký, chân trang, phần phiếu trả lời.',
  '',
  'CHỈ trả về ĐÚNG MỘT đối tượng JSON, không markdown, theo dạng:',
  '{"tex":"<LaTeX>","figures":[{"id":"h1","img":0,"box":[ymin,xmin,ymax,xmax]}],"notes":"<ghi chú ngắn nếu có chỗ mờ/không chắc>"}',
  'box là toạ độ chuẩn hoá 0–1000 trên ảnh tương ứng (img 0 = ẢNH 1, img 1 = ẢNH 2), bao trọn hình kèm nhãn, sát mép, không lấn chữ đề.'
].join('\n');

function clampStr(v, max){ return String(v == null ? '' : v).slice(0, max); }

export default async function handler(req, res){
  if(req.method !== 'POST'){ res.status(405).json({ error: 'Chỉ hỗ trợ POST.' }); return; }
  var apiKey = process.env.GEMINI_API_KEY;
  if(!apiKey){ res.status(500).json({ error: 'Server chưa cấu hình GEMINI_API_KEY (Vercel → Settings → Environment Variables).' }); return; }
  var body = req.body; if(typeof body === 'string'){ try{ body = JSON.parse(body); }catch(e){ body = {}; } } body = body || {};
  var imgs = Array.isArray(body.images) ? body.images.slice(0, 2) : [];
  if(!imgs.length || !imgs[0].data){ res.status(400).json({ error: 'Thiếu ảnh trang đề.' }); return; }
  var parts = [];
  imgs.forEach(function(im, i){
    parts.push({ text: i === 0 ? 'ẢNH 1 (trang chính):' : 'ẢNH 2 (trang kế tiếp — chỉ dùng để chép nốt câu tràn trang):' });
    parts.push({ inlineData: { mimeType: im.mime || 'image/jpeg', data: String(im.data) } });
  });
  var hint = [];
  if(body.mode === 'dgnl') hint.push('ĐÂY LÀ ĐỀ ĐÁNH GIÁ NĂNG LỰC ĐHQG-HCM (V-ACT): mọi câu là trắc nghiệm 4 lựa chọn (\\choice), KHÔNG chia Phần I/II/III (không ghi \\tieuephan). Ô thứ 2 của tag là PHẦN THI: Toán học / Logic / Phân tích số liệu / Suy luận khoa học / Tiếng Việt / Tiếng Anh; ô thứ 3 là dạng bài (vd Hàm số, Xác suất, Đồ thị, Vật lí, Hoá học, Sinh học). Đoạn dữ kiện dùng chung cho nhiều câu ghi như câu chùm.');
  else if(body.mode === 'hsg' || body.mode === 'olympic') hint.push('ĐÂY LÀ ĐỀ HỌC SINH GIỎI/OLYMPIC: câu tự luận chép nguyên văn trong \\begin{ex}...\\end{ex} kèm \\loigiai nếu có, không cần \\choice.');
  if(body.chuDe && body.mode !== 'dgnl') hint.push('Chủ đề chính của đề (gợi ý): ' + clampStr(body.chuDe, 80));
  if(body.part) hint.push('Phần đang chép ở cuối trang trước: ' + clampStr(body.part, 10));
  if(body.extra) hint.push('Ghi chú của thầy: ' + clampStr(body.extra, 300));
  hint.push('Hãy chép đề trong ẢNH 1 theo đúng mẫu và trả về JSON.');
  parts.push({ text: hint.join('\n') });

  var model = process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent';
  var payload = {
    systemInstruction: { role: 'system', parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts: parts }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 16000, responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'low' } }
  };
  var lastErr = '';
  for(var attempt = 0; attempt < 2; attempt++){
    try{
      var up = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify(payload) });
      var data = await up.json().catch(function(){ return {}; });
      if(!up.ok){
        lastErr = (data && data.error && data.error.message) || ('Lỗi ' + up.status);
        if(up.status === 429){ res.status(429).json({ error: 'Đang vượt giới hạn của Google — chờ 1 phút rồi tiếp tục.' }); return; }
        if(up.status >= 500){ await new Promise(function(ok){ setTimeout(ok, 1500); }); continue; }
        res.status(502).json({ error: lastErr }); return;
      }
      var text = '';
      try{ text = (data.candidates[0].content.parts || []).map(function(p){ return p.text || ''; }).join('').trim(); }catch(e){ text = ''; }
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
      var j = null;
      try{ j = JSON.parse(text); }catch(e){
        var a = text.indexOf('{'), b = text.lastIndexOf('}');
        if(a > -1 && b > a){ try{ j = JSON.parse(text.slice(a, b + 1)); }catch(e2){} }
      }
      if(!j || typeof j.tex !== 'string'){ lastErr = 'AI trả về sai định dạng.'; continue; }
      var figs = (Array.isArray(j.figures) ? j.figures : []).filter(function(f){ return f && f.id && Array.isArray(f.box) && f.box.length === 4; })
        .map(function(f){ return { id: String(f.id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20), img: f.img === 1 ? 1 : 0, box: f.box.map(function(v){ return Math.max(0, Math.min(1000, Number(v) || 0)); }) }; });
      res.status(200).json({ tex: j.tex, figures: figs, notes: clampStr(j.notes || '', 500), model: model });
      return;
    }catch(err){ lastErr = 'Không kết nối được tới Google.'; }
  }
  res.status(502).json({ error: lastErr || 'Chưa chuyển được trang này.' });
}
