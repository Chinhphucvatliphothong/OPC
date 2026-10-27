// ================= FaradayAI — AI TỰ GIẢI LẠI ĐỘC LẬP ĐỂ KIỂM TRA ĐÁP ÁN (đề nhập bằng AI) =================
// THÊM 27/10/2026 — Vercel Serverless Function, dùng CHUNG GEMINI_API_KEY / GEMINI_MODEL (không cấu hình thêm).
// Lý do: khi đề thiếu đáp án, lượt "AI chép đề" (api/ai-tex) tự giải và đặt \True; thầy chưa đủ chuyên môn để soát từng câu.
// Endpoint này nhận .tex vừa chép (+ ảnh trang), GỠ \True / \loigiai / \shortans (để AI không bị "mớm" đáp án), bắt AI giải lại
// từng câu một cách độc lập (mức suy luận cao), rồi SO SÁNH với đáp án đã có. Câu lệch đáp án hoặc AI không chắc được chèn dòng
// "% AI_CAN_KIEM_TRA: ..." trước \end{ex} để thầy chỉ phải xem đúng những câu đó.
// Vào : { tex, images:[{mime,data}] (tuỳ chọn, trang chính) }
// Ra  : { tex: "<tex đã chèn cờ>", checked: N, flagged: [số câu...], agreed: N }

export const config = { maxDuration: 60 };

function clampStr(v, max){ return String(v == null ? '' : v).slice(0, max); }

// đọc 1 khối {...} cân ngoặc bắt đầu từ vị trí i (bỏ khoảng trắng đầu); trả { text, end } hoặc null
function readBlock(str, i){
  while(i < str.length && /\s/.test(str[i])) i++;
  if(str[i] !== '{') return null;
  var depth = 0, start = i;
  for(; i < str.length; i++){
    var c = str[i];
    if(c === '\\'){ i++; continue; }
    if(c === '{') depth++;
    else if(c === '}'){ depth--; if(depth === 0) return { text: str.slice(start + 1, i), end: i + 1 }; }
  }
  return null;
}

// tách các câu \begin{ex}...\end{ex} (giữ vị trí để chèn cờ)
function splitQuestions(tex){
  var out = [], re = /\\begin\{ex\}([\s\S]*?)\\end\{ex\}/g, m;
  while((m = re.exec(tex)) !== null){
    var body = m[1], endIdx = m.index + m[0].length - '\\end{ex}'.length;
    var key = null, type = 'other';
    var ci = body.search(/\\choice\b(?!TF)/);
    if(/\\choiceTF/.test(body)) type = 'tf';
    else if(/\\shortans/.test(body)) type = 'short';
    else if(ci > -1) type = 'choice';
    if(type === 'choice'){
      var pos = ci + 7, k = 0, opts = [];
      while(k < 4){ var b = readBlock(body, pos); if(!b) break; opts.push(b.text); pos = b.end; k++; }
      var ti = -1; opts.forEach(function(o, idx){ if(/\\True\b/.test(o)) ti = idx; });
      key = ti > -1 ? String.fromCharCode(65 + ti) : null;
    } else if(type === 'short'){
      var si = body.indexOf('\\shortans'), sb = si > -1 ? readBlock(body, si + 9) : null;
      key = sb ? sb.text.trim() : null;
    }
    out.push({ n: out.length + 1, type: type, key: key, endIdx: endIdx, body: body });
  }
  return out;
}

// bản KHÔNG lộ đáp án: bỏ \True, \loigiai{...}, \shortans{...}, các dòng comment
function blind(body){
  var t = body, i;
  while((i = t.indexOf('\\loigiai')) > -1){ var b = readBlock(t, i + 8); t = t.slice(0, i) + (b ? t.slice(b.end) : t.slice(i + 8)); }
  while((i = t.indexOf('\\shortans')) > -1){ var b2 = readBlock(t, i + 9); t = t.slice(0, i) + (b2 ? t.slice(b2.end) : t.slice(i + 9)); }
  return t.replace(/\\True\b/g, '').replace(/(^|[^\\])%[^\n]*/g, '$1');
}

function normAns(s){ return String(s == null ? '' : s).toLowerCase().replace(/\{,\}/g, '.').replace(/,/g, '.').replace(/[\s$]/g, ''); }

export default async function handler(req, res){
  if(req.method !== 'POST'){ res.status(405).json({ error: 'Chỉ hỗ trợ POST.' }); return; }
  var apiKey = process.env.GEMINI_API_KEY;
  if(!apiKey){ res.status(500).json({ error: 'Server chưa cấu hình GEMINI_API_KEY (Vercel → Settings → Environment Variables).' }); return; }
  var body = req.body; if(typeof body === 'string'){ try{ body = JSON.parse(body); }catch(e){ body = {}; } } body = body || {};
  var tex = clampStr(body.tex, 60000);
  var qs = splitQuestions(tex).filter(function(q){ return q.type === 'choice' || q.type === 'short'; });
  if(!qs.length){ res.status(200).json({ tex: tex, checked: 0, flagged: [], agreed: 0 }); return; }

  var listing = qs.map(function(q){ return '=== CÂU ' + q.n + ' ===\n' + blind(q.body).trim(); }).join('\n\n');
  var parts = [];
  var img = Array.isArray(body.images) && body.images[0] && body.images[0].data ? body.images[0] : null;
  if(img){ parts.push({ text: 'ẢNH TRANG ĐỀ (để xem hình vẽ/đồ thị/bảng mà văn bản chỉ ghi chỗ đặt hình):' }); parts.push({ inlineData: { mimeType: img.mime || 'image/jpeg', data: String(img.data) } }); }
  parts.push({ text: listing });
  parts.push({ text: 'Hãy GIẢI ĐỘC LẬP từng câu ở trên (đã bỏ đáp án). Trắc nghiệm: chọn A/B/C/D. Trả lời ngắn: ghi số/biểu thức đáp án. Tính cẩn thận, kiểm tra lại đơn vị và điều kiện. "confident" = false nếu đề mờ/thiếu dữ kiện/không chắc. CHỈ trả JSON: {"answers":[{"n":1,"answer":"B","confident":true,"note":"1 câu ngắn nếu không chắc"}]}' });

  var model = process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent';
  var payload = {
    systemInstruction: { role: 'system', parts: [{ text: 'Bạn là giáo viên giỏi Toán, Vật lí, Logic & phân tích số liệu (thi Đánh giá năng lực ĐHQG-HCM). Giải từng câu thật cẩn thận và độc lập, không đoán.' }] },
    contents: [{ role: 'user', parts: parts }],
    generationConfig: { temperature: 0, maxOutputTokens: 8000, responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'high' } }
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
      try{ j = JSON.parse(text); }catch(e){ var a = text.indexOf('{'), b = text.lastIndexOf('}'); if(a > -1 && b > a){ try{ j = JSON.parse(text.slice(a, b + 1)); }catch(e2){} } }
      if(!j || !Array.isArray(j.answers)){ lastErr = 'AI trả về sai định dạng.'; continue; }
      var byN = {}; j.answers.forEach(function(x){ if(x && x.n != null) byN[Number(x.n)] = x; });
      var flagged = [], agreed = 0, inserts = [];
      qs.forEach(function(q){
        var r = byN[q.n];
        if(!r){ flagged.push(q.n); inserts.push({ at: q.endIdx, line: '% AI_CAN_KIEM_TRA: lượt kiểm tra lại không trả lời câu này' }); return; }
        var ai = q.type === 'choice' ? String(r.answer || '').trim().toUpperCase().slice(0, 1) : String(r.answer || '').trim();
        var same = q.key != null && (q.type === 'choice' ? ai === q.key : normAns(ai) === normAns(q.key));
        var notSure = r.confident === false;
        if(q.key == null){ flagged.push(q.n); inserts.push({ at: q.endIdx, line: '% AI_CAN_KIEM_TRA: chưa có đáp án; lượt giải lại cho ' + ai + (r.note ? ' (' + clampStr(r.note, 120) + ')' : '') }); }
        else if(!same){ flagged.push(q.n); inserts.push({ at: q.endIdx, line: '% AI_CAN_KIEM_TRA: đáp án đang đặt là ' + q.key + ' nhưng lượt giải lại độc lập ra ' + ai + (r.note ? ' (' + clampStr(r.note, 120) + ')' : '') }); }
        else if(notSure){ flagged.push(q.n); inserts.push({ at: q.endIdx, line: '% AI_CAN_KIEM_TRA: hai lượt cùng ra ' + ai + ' nhưng AI không chắc' + (r.note ? ' (' + clampStr(r.note, 120) + ')' : '') }); }
        else agreed++;
      });
      inserts.sort(function(a, b){ return b.at - a.at; }).forEach(function(x){ tex = tex.slice(0, x.at) + x.line + '\n' + tex.slice(x.at); });
      res.status(200).json({ tex: tex, checked: qs.length, flagged: flagged, agreed: agreed, model: model });
      return;
    }catch(err){ lastErr = 'Không kết nối được tới Google.'; }
  }
  res.status(502).json({ error: lastErr || 'Chưa kiểm tra lại được trang này.' });
}
