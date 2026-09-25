// ========= OPC Learning AI — Gợi ý nano-point cho câu hỏi vừa nạp =========
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

var SYSTEM_INSTRUCTION = [
  'Bạn là hệ thống phân loại câu hỏi Vật Lí lớp 12 (chương trình GDPT 2018,',
  'thi Tốt nghiệp THPT — gồm cả sách giáo khoa và sách Chuyên đề học tập)',
  'theo danh mục "nano-point" chuẩn của OPC Luyện Thi Vật Lí.',
  '',
  'Bạn sẽ được đưa: (1) TOÀN BỘ danh mục chuẩn, có cấu trúc Chủ đề > Bài >',
  'nano-point, mỗi bài/nano-point kèm mã (key/id) riêng; (2) nội dung THẬT',
  'của 1 câu hỏi cần phân loại (đề bài, có thể kèm các phương án), cùng vài',
  'gợi ý giáo viên ghi tay khi soạn đề (chủ đề lớn, dạng bài) — LƯU Ý các',
  'gợi ý ghi tay này CÓ THỂ không khớp đúng tên "Bài" chuẩn trong sách,',
  'không được tin tuyệt đối, chỉ dùng làm tham khảo thêm.',
  '',
  'Nhiệm vụ: đọc kỹ NỘI DUNG THẬT của câu hỏi (kiến thức/công thức/kỹ năng',
  'cần dùng để giải), rồi:',
  '1) Chọn ĐÚNG 1 "Bài" phù hợp nhất trong danh mục được cung cấp — PHẢI',
  '   dùng đúng baiKey đã cho, không tự bịa key mới.',
  '2) Trong đúng Bài đã chọn, chọn 1 đến 2 nano-point mô tả sát nhất kiến',
  '   thức/kỹ năng cần dùng để giải câu hỏi này — PHẢI dùng đúng id đã cho',
  '   trong Bài đó, không tự bịa id mới, không chọn nano-point thuộc Bài',
  '   khác.',
  '3) Nếu câu hỏi mơ hồ hoặc không khớp rõ với bài/nano-point nào, vẫn',
  '   PHẢI chọn phương án gần đúng nhất trong danh mục (không được bỏ',
  '   trống) — đây chỉ là gợi ý ban đầu, giáo viên sẽ xem lại và có thể',
  '   sửa tay.',
  '',
  'CHỈ trả lời bằng ĐÚNG MỘT đối tượng JSON hợp lệ, không kèm bất kỳ chữ',
  'nào khác, không dùng markdown/code fence (không có ```), theo ĐÚNG hình',
  'dạng: {"baiKey":"...", "nanoIds":["...","..."], "reason":"..."} — trong',
  'đó "reason" là MỘT câu ngắn (dưới 30 từ) giải thích ngắn gọn vì sao chọn',
  'bài/nano-point đó, viết cho giáo viên đọc lướt để xác nhận nhanh.'
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
  lines.push('Đề bài: ' + d.stem);
  if(d.options && d.options.length){
    lines.push('Các phương án: ' + d.options.join(' | '));
  }
  if(d.level) lines.push('Mức độ nhận thức: ' + d.level);
  if(d.chuDeLon) lines.push('Gợi ý chủ đề lớn (giáo viên ghi tay, có thể không chính xác): ' + d.chuDeLon);
  if(d.dangBai) lines.push('Gợi ý dạng bài (giáo viên ghi tay, có thể không chính xác): ' + d.dangBai);
  lines.push('');
  lines.push('Hãy chọn Bài và nano-point phù hợp nhất theo đúng hướng dẫn ở system instruction.');
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
  var catalog = rawCatalog.slice(0, 12).map(function(cd){
    var bai = Array.isArray(cd && cd.bai) ? cd.bai.slice(0, 10).map(function(b){
      var baiKey = clampStr(b && b.baiKey, 60);
      if(!baiKey) return null;
      validBai[baiKey] = true;
      nanoByBai[baiKey] = nanoByBai[baiKey] || {};
      var nano = Array.isArray(b && b.nano) ? b.nano.slice(0, 8).map(function(n){
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

  var d = {
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
    var baiKey = parsed && clampStr(parsed.baiKey, 60);

    // Bảo vệ: chỉ chấp nhận baiKey/nanoIds thật sự có trong danh mục gửi
    // lên — id lạ do AI bịa ra sẽ bị loại bỏ để không làm hỏng dữ liệu.
    if(!baiKey || !validBai[baiKey]){
      res.status(502).json({ error: 'OPC Learning AI chưa chọn được Bài phù hợp trong danh mục — thử lại hoặc chọn tay.' });
      return;
    }
    var allowedNano = nanoByBai[baiKey] || {};
    var nanoIds = Array.isArray(parsed.nanoIds) ? parsed.nanoIds.filter(function(id){ return allowedNano[id]; }).slice(0, 3) : [];

    res.status(200).json({
      baiKey: baiKey,
      nanoIds: nanoIds,
      reason: clampStr(parsed.reason, 200) || ''
    });
  }catch(err){
    console.error('Lỗi kết nối Gemini (ai-suggest-nano):', err);
    res.status(502).json({ error: 'Không kết nối được tới OPC Learning AI — kiểm tra mạng hoặc thử lại sau.' });
  }
}
