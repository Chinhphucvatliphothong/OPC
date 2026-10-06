// ========= FaradayAI — Gợi ý nano-point cho câu hỏi vừa nạp =========
// Vercel Serverless Function, dùng CHUNG GEMINI_API_KEY/GEMINI_MODEL với
// api/ai-tutor.js, api/ai-suggest.js, api/ai-adaptive-priority.js — không
// cần cấu hình thêm gì trên Vercel.
//
// VAI TRÒ: đây là "chỗ cắm AI" mà nano-map.js đã để sẵn từ trước
// (suggestForParsedQuestion() chỉ khớp chuỗi cục bộ, không đọc được nội
// dung câu hỏi thật). Hàm này thay AI đọc NỘI DUNG THẬT của 1 câu hỏi vừa
// bóc tách từ .tex (đề bài, phương án, mức độ, tag chủ đề/dạng bài giáo
// viên ghi tay — có thể không chính xác) và chọn ra đúng 1 "Bài" + 1-2
// "nano-point" (đơn vị kiến thức nhỏ nhất) phù hợp nhất trong TOÀN BỘ
// danh mục — chính xác hơn nhiều so với chỉ so khớp chuỗi theo tag, vì
// tag giáo viên ghi tay không phải lúc nào cũng khớp đúng tên "Bài" chuẩn
// trong sách. Được gọi từ nút "🪄 AI gợi ý" cạnh mỗi câu trong màn "Gắn
// nano-point cho từng câu" (xem ExamBankPanel trong admin.html).
//
// ⚙️ Không cần cấu hình thêm trên Vercel — dùng chung GEMINI_API_KEY /
// GEMINI_MODEL đã khai báo cho api/ai-tutor.js.

// SỬA 5/10/2026 — viết lại cách gợi ý (phản hồi của thầy: gợi ý chưa hiệu quả). Các lỗi cũ:
//  (1) máy chủ cắt danh mục còn 8 nano-point/bài, 10 bài/chủ đề -> nano-point thầy vừa thêm bị AI "không thấy";
//  (2) bắt chọn ĐÚNG 1 Bài rồi 1-2 nano-point TRONG bài đó -> câu đề thi thử gộp nhiều bài không gắn được;
//  (3) bắt buộc trả lời dù không chắc, không có độ tin cậy -> thầy không biết câu nào cần xem kỹ.
// Nay: chọn 1-3 nano-point ở BẤT KỲ Bài nào, kèm confidence (cao/vừa/thấp); được trả mảng rỗng khi không có
// nano-point nào thật sự khớp (thay vì ép đoán bừa).
var SYSTEM_INSTRUCTION = [
  'Bạn là hệ thống gắn nhãn kiến thức cho câu hỏi Vật Lí lớp 12 (chương trình GDPT 2018, thi Tốt nghiệp THPT —',
  'gồm sách giáo khoa và sách Chuyên đề học tập) theo danh mục \"nano-point\" chuẩn của FaradayAI Luyện Thi Vật Lí.',
  '',
  'Bạn được đưa: (1) TOÀN BỘ danh mục chuẩn: Chủ đề > Bài > nano-point, mỗi nano-point có mã id riêng; (2) nội dung',
  'THẬT của 1 câu hỏi (đề, phương án, ngữ cảnh chung, lời giải nếu có); (3) gợi ý giáo viên ghi tay (chủ đề lớn, dạng',
  'bài — CÓ THỂ sai, chỉ tham khảo); (4) có thể có danh sách \"ứng viên\" do bộ khớp từ khoá chọn sẵn (chỉ tham khảo,',
  'không bắt buộc chọn trong đó).',
  '',
  'Nhiệm vụ: đọc kỹ KIẾN THỨC/CÔNG THỨC/KỸ NĂNG cần dùng để GIẢI câu hỏi, rồi chọn các nano-point mô tả sát nhất:',
  '- Chọn 1 nano-point nếu câu chỉ kiểm tra 1 kỹ năng. Chọn 2 hoặc 3 nano-point CHỈ KHI lời giải thật sự cần dùng',
  '  cả hai kiến thức (thường gặp ở đề thi thử của trường/sở: câu gộp nhiều bài). Các nano-point được phép thuộc',
  '  các Bài/Chủ đề KHÁC NHAU. Nano-point quan trọng nhất đặt ĐẦU TIÊN trong mảng.',
  '- PHẢI dùng đúng id có trong danh mục, không tự bịa id.',
  '- Nếu không có nano-point nào thật sự khớp, trả \"nanoIds\": [] và confidence \"thấp\" — KHÔNG đoán bừa.',
  '- confidence: \"cao\" = chắc chắn; \"vừa\" = khá chắc nhưng có nano-point gần giống khác; \"thấp\" = đoán/không chắc.',
  '',
  'CHỈ trả lời bằng ĐÚNG MỘT đối tượng JSON hợp lệ, không chữ nào khác, không markdown/code fence, hình dạng:',
  '{\"nanoIds\":[\"...\"], \"confidence\":\"cao|vừa|thấp\", \"reason\":\"...\"} — \"reason\" là MỘT câu ngắn (dưới 30 từ)',
  'nêu kiến thức then chốt dùng để giải, viết cho giáo viên đọc lướt để xác nhận.'
].join('\n');

function clampStr(val, max){
  return String(val == null ? '' : val).slice(0, max);
}

// Dựng lại phần mô tả danh mục (chủ đề > bài > nano-point) từ dữ liệu
// client gửi lên (client luôn lấy đúng từ window.OPC_NANO hiện hành, nên
// server không cần giữ 1 bản sao danh mục riêng dễ bị lệch theo thời gian).
function buildCatalogText(catalog){
  var lines = ['DANH MỤC CHUẨN (chủ đề > bài > nano-point):'];
  catalog.forEach(function(cd){
    lines.push('[Chủ đề] ' + cd.chuDeName);
    (cd.bai || []).forEach(function(b){
      lines.push('  - baiKey="' + b.baiKey + '": ' + b.baiName);
      (b.nano || []).forEach(function(n){
        lines.push('      id="' + n.id + '": ' + n.name);
      });
    });
  });
  return lines.join('\n');
}

function buildUserPrompt(d){
  var lines = [buildCatalogText(d.catalog), ''];
  lines.push('CÂU HỎI CẦN PHÂN LOẠI:');
  if(d.groupPassage) lines.push('Ngữ cảnh chung (câu hỏi chùm): ' + d.groupPassage);
  lines.push('Đề bài: ' + d.stem);
  if(d.options && d.options.length){
    lines.push('Các phương án: ' + d.options.join(' | '));
  }
  if(d.level) lines.push('Mức độ nhận thức: ' + d.level);
  if(d.chuDeLon) lines.push('Gợi ý chủ đề lớn (giáo viên ghi tay, có thể không chính xác): ' + d.chuDeLon);
  if(d.dangBai) lines.push('Gợi ý dạng bài (giáo viên ghi tay, có thể không chính xác): ' + d.dangBai);
  if(d.loigiai) lines.push('Lời giải (tham khảo kiến thức đã dùng): ' + d.loigiai);
  if(d.candidates && d.candidates.length){
    lines.push('Ứng viên do bộ khớp từ khoá chọn sẵn (tham khảo): ' + d.candidates.join(', '));
  }
  lines.push('');
  lines.push('Hãy chọn nano-point phù hợp nhất theo đúng hướng dẫn ở system instruction.');
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

  var stem = clampStr(body.stem, 2000);
  if(!stem.trim()){
    res.status(400).json({ error: 'Thiếu nội dung câu hỏi (stem).' });
    return;
  }

  var rawCatalog = Array.isArray(body.catalog) ? body.catalog : [];
  // Chỉ giữ lại các trường cần thiết + giới hạn kích thước để tránh payload
  // quá lớn / dữ liệu lạ — đồng thời dùng chính danh sách này để lọc lại
  // kết quả AI trả về (không cho AI bịa key/id lạ, giống ai-adaptive-priority.js).
  var validBai = {}; // baiKey -> true
  var nanoByBai = {}; // baiKey -> {id: true}
  var catalog = rawCatalog.slice(0, 20).map(function(cd){
    var bai = Array.isArray(cd && cd.bai) ? cd.bai.slice(0, 40).map(function(b){
      var baiKey = clampStr(b && b.baiKey, 60);
      if(!baiKey) return null;
      validBai[baiKey] = true;
      nanoByBai[baiKey] = nanoByBai[baiKey] || {};
      var nano = Array.isArray(b && b.nano) ? b.nano.slice(0, 60).map(function(n){
        var id = clampStr(n && n.id, 80);
        if(!id) return null;
        nanoByBai[baiKey][id] = true;
        return { id: id, name: clampStr(n && n.name, 160) };
      }).filter(Boolean) : [];
      return { baiKey: baiKey, baiName: clampStr(b && b.baiName, 160), nano: nano };
    }).filter(Boolean) : [];
    return { chuDeName: clampStr(cd && cd.chuDeName, 100), bai: bai };
  });

  if(!Object.keys(validBai).length){
    res.status(400).json({ error: 'Thiếu danh mục (catalog) để đối chiếu.' });
    return;
  }

  var validNano = {}; // id -> baiKey (cho phép nano-point ở MỌI bài)
  Object.keys(nanoByBai).forEach(function(bk){ Object.keys(nanoByBai[bk]).forEach(function(id){ validNano[id] = bk; }); });

  var d = {
    groupPassage: clampStr(body.groupPassage, 1500),
    loigiai: clampStr(body.loigiai, 1200),
    candidates: Array.isArray(body.candidates) ? body.candidates.slice(0, 8).map(function(c){ return clampStr(c, 80); }).filter(function(c){ return validNano[c]; }) : [],
    stem: stem,
    options: Array.isArray(body.options) ? body.options.slice(0, 6).map(function(o){ return clampStr(o, 300); }) : [],
    level: clampStr(body.level, 10),
    chuDeLon: clampStr(body.chuDeLon, 120),
    dangBai: clampStr(body.dangBai, 120),
    catalog: catalog
  };

  var model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;

  var payload = {
    systemInstruction: { role: 'system', parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts: [{ text: buildUserPrompt(d) }] }],
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
      console.error('Lỗi gọi Gemini (ai-suggest-nano):', data);
      res.status(502).json({ error: (data && data.error && data.error.message) || 'FaradayAI đang bận, thử lại sau.' });
      return;
    }

    var raw = '';
    try{
      var candidate = data.candidates && data.candidates[0];
      var parts = candidate && candidate.content && candidate.content.parts;
      raw = (parts || []).map(function(p){ return p.text || ''; }).join('').trim();
    }catch(e){ raw = ''; }

    var parsed = extractJson(raw);
    if(!parsed){
      res.status(502).json({ error: 'FaradayAI trả lời không đúng định dạng — thử lại hoặc chọn tay.' });
      return;
    }
    // Chỉ giữ id có thật trong danh mục gửi lên (không cho AI bịa), bỏ trùng, tối đa 3 — thứ tự = mức quan trọng
    var seen = {};
    var nanoIds = (Array.isArray(parsed.nanoIds) ? parsed.nanoIds : []).map(function(id){ return clampStr(id, 80); })
      .filter(function(id){ if(!validNano[id] || seen[id]) return false; seen[id] = true; return true; }).slice(0, 3);
    var conf = ['cao', 'vừa', 'thấp'].indexOf(parsed.confidence) > -1 ? parsed.confidence : 'thấp';
    if(!nanoIds.length) conf = 'thấp';

    res.status(200).json({
      baiKey: nanoIds.length ? validNano[nanoIds[0]] : '',
      nanoIds: nanoIds,
      confidence: conf,
      reason: clampStr(parsed.reason, 200) || ''
    });
  }catch(err){
    console.error('Lỗi kết nối Gemini (ai-suggest-nano):', err);
    res.status(502).json({ error: 'Không kết nối được tới FaradayAI — kiểm tra mạng hoặc thử lại sau.' });
  }
}
