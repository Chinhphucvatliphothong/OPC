// ================= FaradayAI — GIỌNG ĐỌC AI cho bài giảng (Gemini TTS) =================
// THÊM 24/10/2026 — Vercel Serverless Function, dùng CHUNG GEMINI_API_KEY (không cần cấu hình thêm).
// Thầy bấm "🎙 Tạo giọng AI" trong admin › 📺 Video bài giảng: trình duyệt gửi TỪNG câu lời giảng tới đây,
// nhận âm thanh PCM 24 kHz (giọng tự nhiên của Gemini, đọc tiếng Việt), nén MP3 rồi lưu kèm bài giảng —
// học sinh nghe lại bản đã lưu, KHÔNG gọi API mỗi lần xem (chi phí chỉ phát sinh 1 lần khi thầy tạo).
// Có thể đổi model bằng biến môi trường GEMINI_TTS_MODEL (mặc định thử gemini-3.1-flash-tts-preview rồi 2.5).

var VOICES = ['Zephyr','Puck','Charon','Kore','Fenrir','Leda','Orus','Aoede','Callirrhoe','Autonoe','Enceladus','Iapetus','Umbriel','Algieba',
  'Despina','Erinome','Algenib','Rasalgethi','Laomedeia','Achernar','Alnilam','Schedar','Gacrux','Pulcherrima','Achird','Zubenelgenubi',
  'Vindemiatrix','Sadachbia','Sadaltager','Sulafat'];

function styleLine(accent, style){
  var acc = accent === 'bac' ? 'giọng miền Bắc (Hà Nội)' : (accent === 'trung' ? 'giọng miền Trung' : 'giọng miền Nam (Sài Gòn)');
  var st = String(style || '').trim() || 'ấm áp, rõ ràng, truyền cảm như thầy giáo đang giảng bài cho học sinh lớp 12, tốc độ vừa phải, ngắt nghỉ tự nhiên';
  return 'Đọc bằng tiếng Việt, ' + acc + ', ' + st.slice(0, 200) + '. Chỉ đọc đúng phần lời sau dấu hai chấm, không thêm bớt:';
}

async function callTts(apiKey, model, prompt, voice){
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent';
  var body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } }
  };
  var r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify(body) });
  var j = await r.json().catch(function(){ return {}; });
  return { ok: r.ok, status: r.status, data: j };
}

export default async function handler(req, res){
  if(req.method !== 'POST'){ res.status(405).json({ error: 'Chỉ hỗ trợ POST.' }); return; }
  var apiKey = process.env.GEMINI_API_KEY;
  if(!apiKey){ res.status(500).json({ error: 'Server chưa cấu hình GEMINI_API_KEY (Vercel → Settings → Environment Variables).' }); return; }
  var body = req.body; if(typeof body === 'string'){ try{ body = JSON.parse(body); }catch(e){ body = {}; } } body = body || {};
  var text = String(body.text || '').replace(/\s+/g, ' ').trim().slice(0, 1200);
  if(!text){ res.status(400).json({ error: 'Thiếu lời đọc.' }); return; }
  var voice = VOICES.indexOf(body.voice) > -1 ? body.voice : 'Charon';
  var prompt = styleLine(body.accent, body.style) + ' ' + text;
  var models = process.env.GEMINI_TTS_MODEL ? [process.env.GEMINI_TTS_MODEL] : ['gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'];
  var lastErr = 'Không tạo được giọng đọc.';
  for(var m = 0; m < models.length; m++){
    for(var attempt = 0; attempt < 2; attempt++){
      try{
        var out = await callTts(apiKey, models[m], prompt, voice);
        if(out.ok){
          var parts = (((out.data.candidates || [])[0] || {}).content || {}).parts || [];
          var audio = parts.filter(function(p){ return p.inlineData && p.inlineData.data; })[0];
          if(audio){
            var mime = audio.inlineData.mimeType || 'audio/L16;rate=24000';
            var rm = /rate=(\d+)/.exec(mime);
            res.status(200).json({ audio: audio.inlineData.data, mime: mime, rate: rm ? Number(rm[1]) : 24000, model: models[m], voice: voice });
            return;
          }
          lastErr = 'Model không trả về âm thanh.';
          break;
        }
        lastErr = (out.data && out.data.error && out.data.error.message) || ('Lỗi ' + out.status);
        if(out.status === 404 || out.status === 400) break;      // model không có / không hỗ trợ → thử model kế
        if(out.status === 429){ res.status(429).json({ error: 'Đang vượt giới hạn tạo giọng của Google (miễn phí có giới hạn/phút) — chờ 1 phút rồi bấm tiếp tục.' }); return; }
      }catch(e){ lastErr = 'Không kết nối được tới Google.'; }
      await new Promise(function(ok){ setTimeout(ok, 1200); });
    }
  }
  console.error('Lỗi tạo giọng (ai-voice):', lastErr);
  res.status(502).json({ error: lastErr });
}
