// ================= OPC Learning AI — Gợi ý học tập hôm nay =================
// Vercel Serverless Function song song với api/ai-tutor.js, dùng CHUNG biến
// môi trường GEMINI_API_KEY / GEMINI_MODEL (không cần cấu hình thêm gì trên
// Vercel). Khác với ai-tutor.js (giải thích 1 CÂU sai cụ thể), hàm này nhận
// TOÀN CẢNH mức thành thạo hiện tại của học sinh (5 nano-point yếu nhất,
// mastery theo chuyên đề, vài câu sai gần nhất, điểm dự báo/mục tiêu) và
// nhờ AI "suy luận" ra nên ưu tiên ôn phần nào hôm nay — một cách thay thế
// gọn nhẹ cho việc phải tự xây + huấn luyện một mô hình học máy chuyên
// dụng (kiểu Large Adaptive Model của Squirrel AI, cần dữ liệu hàng chục
// triệu học sinh mới huấn luyện được). Học sinh bấm "🔄 Gợi ý mới" ở thẻ
// "OPC Learning AI gợi ý hôm nay" trên Trang chủ (xem askAiSuggest trong
// prepscholar-ui.js) sẽ gọi POST /api/ai-suggest.
//
// ⚙️ Không cần cấu hình thêm trên Vercel — dùng chung GEMINI_API_KEY /
// GEMINI_MODEL đã khai báo cho api/ai-tutor.js.

var SYSTEM_INSTRUCTION = [
  'Bạn là "OPC Learning AI" — gia sư ảo lập kế hoạch học tập cá nhân hoá của',
  'OPC Luyện Thi Vật Lí, chuyên Vật Lí lớp 12 (chương trình GDPT 2018, thi',
  'Tốt nghiệp THPT), thân thiện, nói tiếng Việt tự nhiên, đúng thuật ngữ Vật',
  'Lí phổ thông Việt Nam.',
  '',
  'Bạn sẽ được đưa dữ liệu THẬT về tình hình học tập của một học sinh: các',
  'nano-point (đơn vị kiến thức nhỏ nhất) đang yếu nhất, mức thành thạo theo',
  'từng chuyên đề, vài câu học sinh vừa làm sai gần đây, điểm dự báo và điểm',
  'mục tiêu. Hãy viết MỘT đoạn ngắn (80-130 từ), liền mạch — KHÔNG dùng',
  'markdown (không #, không **, không bảng, không gạch đầu dòng lồng nhau) —',
  'nêu rõ:',
  '',
  '1) Hôm nay nên ưu tiên ôn phần/nano-point nào nhất, vì sao (dựa đúng vào',
  '   dữ liệu được đưa, không bịa thêm phần không có trong dữ liệu).',
  '2) Nếu có nhiều điểm yếu, chọn ra ĐÚNG 1-2 ưu tiên hàng đầu thay vì liệt',
  '   kê hết — học sinh cần một hướng đi rõ ràng, không phải một danh sách dài.',
  '3) Kết 1 câu ngắn động viên, tích cực, không giáo điều.',
  '',
  'Nếu dữ liệu đưa vào còn quá ít (chưa có nano-point yếu nào, hoặc học sinh',
  'chưa làm bài nào), hãy nói rõ điều đó và khuyên học sinh nên làm Bài kiểm',
  'tra đầu vào hoặc luyện tập thêm để hệ thống có đủ dữ liệu gợi ý chính xác',
  'hơn — không suy đoán bừa. Công thức Vật Lí viết bằng ký hiệu thường (^, /,',
  '×, °) — không dùng cú pháp LaTeX ($, \\frac, \\sqrt...).'
].join('\n');

function clampStr(val, max){
  return String(val == null ? '' : val).slice(0, max);
}

function buildUserPrompt(d){
  var lines = [];

  if(d.weakestNano && d.weakestNano.length){
    lines.push('5 nano-point yếu nhất hiện tại (thấp nhất trước):');
    d.weakestNano.forEach(function(n){
      lines.push('- ' + n.name + ' (' + n.topicName + ' · ' + n.baiName + '): ' + n.mastery + '% thành thạo');
    });
  } else {
    lines.push('Chưa có nano-point nào được đo (học sinh có thể chưa làm Bài kiểm tra đầu vào).');
  }

  var chuDeKeys = Object.keys(d.chuDeMastery || {});
  if(chuDeKeys.length){
    lines.push('');
    lines.push('Mức thành thạo theo chuyên đề:');
    chuDeKeys.forEach(function(k){
      lines.push('- ' + k + ': ' + d.chuDeMastery[k] + '%');
    });
  }

  if(d.recentMistakes && d.recentMistakes.length){
    lines.push('');
    lines.push('Vài câu làm sai gần đây:');
    d.recentMistakes.forEach(function(m){
      lines.push('- ' + (m.title || m.topicName || 'Câu hỏi') + ' (chuyên đề: ' + (m.topicName || 'không rõ') + ')');
    });
  }

  lines.push('');
  if(d.predicted != null) lines.push('Điểm dự báo hiện tại: ' + d.predicted + '/10');
  if(d.target != null) lines.push('Điểm mục tiêu: ' + d.target + '/10');
  if(d.mistakeCount != null) lines.push('Tổng số câu đang chờ ôn lại trong Sổ tay câu sai: ' + d.mistakeCount);

  lines.push('');
  lines.push('Hãy viết gợi ý học tập cho HÔM NAY theo đúng hướng dẫn ở system instruction.');
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

  var d = {
    weakestNano: Array.isArray(body.weakestNano) ? body.weakestNano.slice(0, 5).map(function(n){
      return {
        name: clampStr(n && n.name, 120),
        topicName: clampStr(n && n.topicName, 80),
        baiName: clampStr(n && n.baiName, 80),
        mastery: (n && n.mastery != null) ? Number(n.mastery) : null
      };
    }) : [],
    chuDeMastery: (function(){
      var out = {};
      var src = body.chuDeMastery || {};
      Object.keys(src).slice(0, 12).forEach(function(k){ out[clampStr(k, 60)] = Number(src[k]); });
      return out;
    })(),
    recentMistakes: Array.isArray(body.recentMistakes) ? body.recentMistakes.slice(0, 5).map(function(m){
      return { topicName: clampStr(m && m.topicName, 80), title: clampStr(m && m.title, 150) };
    }) : [],
    predicted: (body.predicted != null) ? Number(body.predicted) : null,
    target: (body.target != null) ? Number(body.target) : null,
    mistakeCount: (body.mistakeCount != null) ? Number(body.mistakeCount) : null
  };

  var model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;

  var payload = {
    systemInstruction: { role: 'system', parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts: [{ text: buildUserPrompt(d) }] }],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 1280,
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
      console.error('Lỗi gọi Gemini (ai-suggest):', data);
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
      res.status(502).json({ error: 'OPC Learning AI chưa đưa ra được gợi ý — thử lại sau.' });
      return;
    }

    res.status(200).json({ suggestion: text });
  }catch(err){
    console.error('Lỗi kết nối Gemini (ai-suggest):', err);
    res.status(502).json({ error: 'Không kết nối được tới OPC Learning AI — kiểm tra mạng hoặc thử lại sau.' });
  }
}

