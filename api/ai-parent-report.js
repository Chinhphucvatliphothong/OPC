// ================= OPC Learning AI — Báo cáo phụ huynh (co-pilot) =========
// Vercel Serverless Function song song với api/ai-tutor.js / ai-suggest.js /
// ai-adaptive-priority.js, dùng CHUNG GEMINI_API_KEY / GEMINI_MODEL (không
// cần cấu hình thêm gì trên Vercel).
//
// VAI TRÒ: đây là "vũ khí" tự động hoá báo cáo phụ huynh cho một giáo viên
// vận hành MỘT MÌNH (Solo Operator) — thay vì phải tự ngồi viết 20-30 báo
// cáo mỗi tuần, AI soạn sẵn 1 bản NHÁP từ đúng dữ liệu luyện tập thật của
// từng học sinh (xem computeStudentStatsFromAttempts trong prepscholar.js +
// panel "Báo cáo Phụ huynh" trong admin.html). Thầy cô LUÔN xem/sửa bản
// nháp trước khi gửi — đây là co-pilot (hỗ trợ), không phải autopilot (tự
// gửi thẳng) — phù hợp vì phụ huynh chưa có tài khoản, thầy vẫn là người
// chủ động gửi tay qua Zalo cá nhân.
//
// Khác với api/ai-suggest.js (viết CHO học sinh, giọng gia sư), file này
// viết CHO phụ huynh — giọng giáo viên báo cáo, không dùng thuật ngữ kỹ
// thuật "nano-point"/"Tag"/"mastery" mà học sinh/hệ thống hay dùng nội bộ.

var SYSTEM_INSTRUCTION = [
  'Bạn là "OPC Learning AI" — trợ lý soạn báo cáo tiến độ học tập gửi PHỤ',
  'HUYNH, giúp một giáo viên Vật Lí lớp 12 (chương trình GDPT 2018, luyện',
  'thi Tốt nghiệp THPT) đang dạy và quản lý học sinh MỘT MÌNH (không có trợ',
  'giảng) tiết kiệm thời gian viết báo cáo hàng tuần.',
  '',
  'Bạn sẽ được đưa dữ liệu luyện tập THẬT của một học sinh trong một khoảng',
  'thời gian gần đây. Hãy viết một bản BÁO CÁO NGẮN (100-160 từ) gửi PHỤ',
  'HUYNH của em, bằng tiếng Việt, giọng giáo viên: ấm áp, tôn trọng, thẳng',
  'thắn nhưng không gây lo lắng quá mức, và LUÔN dựa đúng vào dữ liệu được',
  'đưa — không bịa thêm số liệu hay chi tiết không có.',
  '',
  'YÊU CẦU BẮT BUỘC VỀ VĂN PHONG:',
  '- KHÔNG dùng thuật ngữ kỹ thuật nội bộ như "nano-point", "Tag", "mastery",',
  '  "% thành thạo" — thay bằng cách nói tự nhiên như "phần kiến thức về...",',
  '  "dạng bài về...", "em đã nắm khá vững...", "em còn cần luyện thêm...".',
  '- KHÔNG dùng markdown (không #, không **, không bảng, không gạch đầu dòng).',
  '- Viết thành 2-3 đoạn văn liền mạch, không phải danh sách.',
  '',
  'NỘI DUNG cần có, theo đúng thứ tự:',
  '1) Mở đầu ngắn nêu tình hình chung tuần/giai đoạn này (số đề đã làm, xu',
  '   hướng điểm số nếu có dữ liệu so sánh — tăng/giảm/ổn định).',
  '2) Phần kiến thức em đang làm tốt VÀ phần em còn cần luyện thêm (nêu cụ',
  '   thể tên chuyên đề/dạng bài, không dùng mã số/thuật ngữ kỹ thuật).',
  '3) Một gợi ý ngắn, thực tế, phụ huynh có thể hỗ trợ tại nhà (vd. nhắc em',
  '   dành thêm thời gian cho phần yếu, động viên tinh thần...).',
  '',
  'Nếu dữ liệu còn quá ít (học sinh mới học, chưa đủ lượt làm bài để so',
  'sánh xu hướng), hãy nói rõ điều đó một cách tích cực (đang trong giai',
  'đoạn làm quen/đánh giá ban đầu) thay vì suy đoán. KHÔNG tự thêm lời chào',
  'đầu thư hay chữ ký cuối thư (thầy cô sẽ tự thêm khi gửi qua Zalo).'
].join('\n');

function clampStr(val, max){
  return String(val == null ? '' : val).slice(0, max);
}

function buildUserPrompt(d){
  var lines = [];
  lines.push('Học sinh: ' + d.studentName);
  lines.push('Khoảng thời gian báo cáo: ' + d.periodLabel);
  lines.push('');

  if(d.completedInPeriod != null) lines.push('Số đề/lượt luyện tập đã làm trong khoảng thời gian này: ' + d.completedInPeriod);
  if(d.recentAvgScore != null && d.priorAvgScore != null){
    lines.push('Điểm trung bình gần đây: ' + d.recentAvgScore + '/10 (giai đoạn trước đó: ' + d.priorAvgScore + '/10) — xu hướng: ' +
      (d.recentTrend === 'up' ? 'tăng' : d.recentTrend === 'down' ? 'giảm' : 'ổn định'));
  } else if(d.averageScore != null){
    lines.push('Điểm trung bình hiện tại: ' + d.averageScore + '/10 (chưa đủ dữ liệu để so sánh xu hướng).');
  }
  if(d.predicted != null) lines.push('Điểm dự báo tốt nghiệp hiện tại: ' + d.predicted + '/10' + (d.target != null ? ' (mục tiêu: ' + d.target + '/10)' : ''));

  if(d.strongTopics && d.strongTopics.length){
    lines.push('');
    lines.push('Chuyên đề đang làm tốt (mức thành thạo cao):');
    d.strongTopics.forEach(function(t){ lines.push('- ' + t.name + ' (' + t.pct + '%)'); });
  }
  if(d.weakTopics && d.weakTopics.length){
    lines.push('');
    lines.push('Chuyên đề/dạng bài còn cần luyện thêm:');
    d.weakTopics.forEach(function(t){ lines.push('- ' + t.name + ' (' + t.pct + '%)'); });
  }

  if(d.assignedTotal != null && d.assignedTotal > 0){
    lines.push('');
    lines.push('Đề cá nhân hóa được giao: đã hoàn thành ' + d.assignedCompleted + '/' + d.assignedTotal + ' đề.');
  }

  if(d.mistakeCount != null) lines.push('');
  if(d.mistakeCount != null) lines.push('Số câu đang chờ ôn lại (làm sai gần đây): ' + d.mistakeCount);

  lines.push('');
  lines.push('Hãy viết báo cáo phụ huynh theo đúng hướng dẫn ở system instruction.');
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
    studentName: clampStr(body.studentName, 80) || 'học sinh',
    periodLabel: clampStr(body.periodLabel, 60) || '7 ngày qua',
    completedInPeriod: (body.completedInPeriod != null) ? Number(body.completedInPeriod) : null,
    averageScore: (body.averageScore != null) ? Number(body.averageScore) : null,
    recentAvgScore: (body.recentAvgScore != null) ? Number(body.recentAvgScore) : null,
    priorAvgScore: (body.priorAvgScore != null) ? Number(body.priorAvgScore) : null,
    recentTrend: clampStr(body.recentTrend, 10) || null,
    predicted: (body.predicted != null) ? Number(body.predicted) : null,
    target: (body.target != null) ? Number(body.target) : null,
    strongTopics: Array.isArray(body.strongTopics) ? body.strongTopics.slice(0, 4).map(function(t){
      return { name: clampStr(t && t.name, 80), pct: (t && t.pct != null) ? Number(t.pct) : 0 };
    }) : [],
    weakTopics: Array.isArray(body.weakTopics) ? body.weakTopics.slice(0, 4).map(function(t){
      return { name: clampStr(t && t.name, 80), pct: (t && t.pct != null) ? Number(t.pct) : 0 };
    }) : [],
    assignedTotal: (body.assignedTotal != null) ? Number(body.assignedTotal) : null,
    assignedCompleted: (body.assignedCompleted != null) ? Number(body.assignedCompleted) : null,
    mistakeCount: (body.mistakeCount != null) ? Number(body.mistakeCount) : null
  };

  var model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;

  var payload = {
    systemInstruction: { role: 'system', parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts: [{ text: buildUserPrompt(d) }] }],
    generationConfig: {
      temperature: 0.5,
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
      console.error('Lỗi gọi Gemini (ai-parent-report):', data);
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
      res.status(502).json({ error: 'OPC Learning AI chưa soạn được báo cáo — thử lại sau.' });
      return;
    }

    res.status(200).json({ report: text });
  }catch(err){
    console.error('Lỗi kết nối Gemini (ai-parent-report):', err);
    res.status(502).json({ error: 'Không kết nối được tới OPC Learning AI — kiểm tra mạng hoặc thử lại sau.' });
  }
}
