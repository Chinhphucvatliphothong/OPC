/**
 * admin-to.js — THÊM 27/10/2026 · tab "📝 Đề Tổ" trong admin.html (nạp sau exam-matrix.js, to-docx.js, to-template.js)
 * Soạn ĐỀ ÔN LUYỆN VẬT LÍ 12 THEO KẾ HOẠCH TỔ Vật lí – Công nghệ (2026–2027) NGAY TRONG FaradayAI, thay cho quy trình Claude Project:
 *   1) Chọn câu từ NGÂN HÀNG ĐỀ của app theo đúng cấu trúc Tổ: Phần I 18 câu lí thuyết · Phần II 4 câu đúng/sai lí thuyết ·
 *      Phần III 3 chùm × 2 câu (2 cơ bản + 3 vận dụng + 1 vận dụng cao); phủ các chủ đề; đủ 7 loại câu; đáp án Phần I cân đều;
 *      không dùng lại câu đã ra cho Tổ trước đó.
 *   2) BẢNG DUYỆT 28 dòng + checklist; thầy bấm "Đổi câu" từng dòng / xem câu / chỉnh trọng số chủ đề.
 *   3) Xuất 3 file Word (đề · đề có đáp án · bảng đáp án) theo mẫu mau_to.docx + de.json (nạp lại ngân hàng/Claude khi cần).
 * Xuất: window.OPC_TO = { Panel }
 */
(function(window){
  'use strict';
  var React = window.React; if(!React) return;
  var h = React.createElement;
  function OPC(){ return window.OPC; }

  // ------------------------------------------------------------------ tiện ích văn bản
  function norm(s){ return String(s || '').toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function stripMeta(t){
    t = String(t || '');
    t = t.replace(/%\s*\[M[1-4]\]\s*\[[^\]\n]*\]\s*\[[^\]\n]*\]/gi, '').replace(/(^|\n)[ \t]*%[^\n]*/g, '$1');
    return t.replace(/%\s*(?:@nano[\w-]*\s*:|AI_TU_GIAI|AI_CAN_KIEM_TRA|CHUA_CO_DAP_AN)[^\n]*/gi, '').trim();
  }
  // LaTeX của ngân hàng → quy ước de.json của Tổ ($...$ cho công thức, **đậm**, *nghiêng*)
  function texToRich(s, warns){
    var imgs = [];
    var t = stripMeta(s);
    t = t.replace(/\\begin\{center\}\s*\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}\s*\\end\{center\}/g, function(_, n){ imgs.push(n); return ''; });
    t = t.replace(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g, function(_, n){ imgs.push(n); return ''; });
    if(/\\begin\{tabular\}|\\begin\{tikzpicture\}/.test(t)){ if(warns) warns.push('có bảng/hình vẽ TikZ — cần chỉnh tay trong Word'); t = t.replace(/\\begin\{tabular\}[\s\S]*?\\end\{tabular\}/g, '[BẢNG — chỉnh tay]').replace(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g, '[HÌNH VẼ — chỉnh tay]'); }
    t = t.replace(/\\textbf\{([^{}]*)\}/g, '**$1**').replace(/\\(?:textit|emph)\{([^{}]*)\}/g, '*$1*');
    t = t.replace(/\\SI\{([^{}]*)\}\{([^{}]*)\}/g, function(_, a, b){ return a.replace('.', ',') + ' ' + b.replace(/\\mathrm|[\\{}]/g, ''); });
    t = t.replace(/\\ang\{([^{}]*)\}/g, '$1°').replace(/\\%/g, '%').replace(/\\&/g, '&').replace(/\\\\(\[[^\]]*\])?/g, ' ').replace(/\\newline/g, ' ');
    t = t.replace(/~/g, ' ').replace(/\\[,;: ]/g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, ' ').trim();
    var left = t.replace(/\$[^$]*\$/g, '').match(/\\[a-zA-Z]+/g);
    if(left && warns) warns.push('còn lệnh LaTeX ngoài công thức: ' + left.slice(0, 3).join(' '));
    return { text: t, imgs: imgs };
  }
  function plain(s){ return stripMeta(s).replace(/\$[^$]*\$/g, ' … ').replace(/\\[a-zA-Z]+\*?(\[[^\]]*\])?/g, '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim(); }
  function summary(s){ var w = plain(s).split(' '); return w.slice(0, 15).join(' ') + (w.length > 15 ? '…' : ''); }
  function katexHtml(s){
    var t = stripMeta(s).replace(/\\begin\{center\}[\s\S]*?\\end\{center\}/g, '[hình]').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return t.split(/(\$[^$]+\$)/).map(function(seg){
      if(seg.length > 1 && seg[0] === '$' && seg[seg.length - 1] === '$'){ try{ return window.katex.renderToString(seg.slice(1, -1).replace(/&amp;/g, '&').replace(/&lt;/g, '<'), { throwOnError: false }); }catch(e){ return seg; } }
      return seg.replace(/\\textbf\{([^{}]*)\}/g, '<b>$1</b>').replace(/\\[a-zA-Z]+/g, '').replace(/\n/g, '<br>');
    }).join('');
  }
  function shortansClean(v){ return String(v == null ? '' : v).replace(/\$/g, '').replace(/\{,\}/g, ',').replace(/\s+/g, '').replace(/−/g, '-'); }
  function rnd(){ return Math.random(); }
  function shuffle(a){ a = a.slice(); for(var i = a.length - 1; i > 0; i--){ var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var LV = { M1: 'Biết', M2: 'Hiểu', M3: 'Vận dụng', M4: 'VD cao' };
  var MUC = { M1: 'cơ bản', M2: 'cơ bản', M3: 'vận dụng', M4: 'vận dụng cao' };

  // ------------------------------------------------------------------ phân loại câu (ước đoán từ nội dung — thầy sửa bằng nút "Đổi câu")
  function classify(q, ex){
    var stem = plain(q.stem), opts = (q.options || []).map(function(o){ return plain(o.text); }).join(' | ');
    var all = stem + ' ' + opts, loai = [];
    var hasImg = (q.images && q.images.length) || /\\includegraphics|tabular|tikzpicture/.test(q.stem || '') || (q.groupImages && q.groupImages.length);
    if(/đơn vị/i.test(stem)) loai.push('đơn vị');
    if(/là (kí|ký) hiệu|(kí|ký) hiệu của|tên gọi của|đại lượng .{0,25} là$/i.test(stem)) loai.push('tên đại lượng');
    if(/công thức|biểu thức|hệ thức/i.test(stem) || ((q.options || []).filter(function(o){ return /^\s*\$/.test(o.text); }).length >= 3)) loai.push('công thức');
    if(/thí nghiệm|dụng cụ|phương án|thực hành|nhóm học sinh|đo được|cách đo|bố trí/i.test(all)) loai.push('thực nghiệm');
    if(/ứng dụng|thiết bị|bếp|nhà máy|y học|công nghiệp|lò phản ứng|máy phát|máy biến|loa|phanh|đồng hồ|tàu|pin/i.test(all)) loai.push('thực tế');
    if(hasImg) loai.push('hình');
    if(!loai.length) loai.push('bình thường');
    // lí thuyết hay tính toán?
    var numOpts = (q.options || []).filter(function(o){ return /\d/.test(plain(o.text)) && !/^\s*\$?\\?[a-zA-Z]/.test(o.text); }).length;
    var calc = /tính|bao nhiêu|giá trị|xác định độ lớn|có độ lớn|là bao/i.test(stem) && (/\d/.test(stem.replace(/[A-Za-z]+\s*\d/g, '')) || numOpts >= 3);
    var db = String(q.dangBai || ''), theory = !calc;
    if(/lý thuyết|lí thuyết|\bLT\b/i.test(db)) theory = true;
    if(/bài tập|tính toán|\bBT\b|vận dụng cao/i.test(db)) theory = false;
    return { loai: loai, theory: theory, hasImg: !!hasImg };
  }

  // ------------------------------------------------------------------ dựng kho + chọn câu
  function buildItems(exams, rows){
    var items = [];
    exams.filter(function(e){ return e.examKind !== 'soTruong'; }).forEach(function(ex){
      (ex.questions || []).forEach(function(q){
        var rname = null, a = norm(q.chuDeLon || ex.chuDe);
        rows.forEach(function(r){ if(norm(r) === a) rname = r; });
        if(!rname) return;
        var c = classify(q, ex);
        items.push({ q: q, ex: ex, uid: ex.id + '_q' + q.index, row: rname, cls: c, level: q.level });
      });
    });
    return items;
  }
  function p1Ok(it){ var q = it.q; return q.part === 'I' && q.type === 'choice' && (q.options || []).length === 4 && (q.options || []).filter(function(o){ return o.isTrue; }).length === 1 && it.cls.theory && !/\\tabular/.test(q.stem || ''); }
  function p2Ok(it){ var q = it.q; return q.part === 'II' && q.type === 'choiceTF' && (q.options || []).length === 4; }
  // SỬA 28/10/2026 — NHẬN DIỆN CHÙM ĐÚNG NHƯ NGÂN HÀNG LƯU. Trước đây chỉ nhận chùm có ĐÚNG 2 câu và mọi câu đều phải có
  // groupPassage → bỏ sót chùm 3–4 câu và chùm kiểu "dựa vào câu trên" (câu đầu không có groupPassage, câu sau mang ctxFrom).
  // Nay: gom các câu Phần III (trả lời ngắn, có đáp án) LIỀN NHAU của cùng 1 đề thành "cụm" theo cùng quy tắc với bộ tạo đề
  // cá nhân hoá (cùng groupPassage · ctxFrom = index câu trước · ctxOwn). Cụm ≥ 2 câu là chùm; mỗi chùm cho ra các CẶP 2 câu
  // liền nhau (đủ dữ kiện vì câu sau luôn mang ngữ cảnh của câu trước). Câu không thuộc chùm nào và không có dữ kiện chung là CÂU RỜI.
  function p3Eligible(it){ var q = it.q; return q.part === 'III' && q.type === 'shortans' && q.shortans != null && String(q.shortans).trim() !== ''; }
  function p3Runs(items){
    var byEx = {};
    items.filter(p3Eligible).forEach(function(it){ (byEx[it.ex.id] = byEx[it.ex.id] || []).push(it); });
    var runs = [];
    Object.keys(byEx).forEach(function(eid){
      var list = byEx[eid].slice().sort(function(a, b){ return (Number(a.q.index) || 0) - (Number(b.q.index) || 0); });
      var cur = null, prev = null;
      list.forEach(function(it){
        var q = it.q, pq = prev ? prev.q : null;
        var joins = pq && (
          (q.groupPassage && pq.groupPassage === q.groupPassage) ||
          (q.ctxFrom != null && Number(q.ctxFrom) === Number(pq.index)) ||
          (q.ctxOwn && pq.groupPassage === q.ctxOwn) ||
          (q.ctxFrom != null && pq.ctxFrom != null && q.ctxOwn && q.ctxOwn === pq.ctxOwn));
        if(!joins){ cur = []; runs.push(cur); }
        cur.push(it); prev = it;
      });
    });
    return runs;
  }
  function mkGroup(arr, loose){ var g = arr.slice().sort(function(a, b){ return (a.ex.id === b.ex.id ? 0 : 0) || (Number(a.q.index) - Number(b.q.index)); }); g.loose = !!loose; return g; }
  // Mọi CẶP 2 câu liền nhau trong các chùm (cụm ≥ 2 câu)
  function clusterPairs(runs){
    var out = [];
    runs.forEach(function(run){
      for(var i = 0; i + 1 < run.length; i++){ var g = mkGroup([run[i], run[i + 1]], false); g.runKey = run[0].uid; out.push(g); }
    });
    return out;
  }
  function clustersOf(items){ return clusterPairs(p3Runs(items)); }
  // Câu rời: câu Phần III không thuộc chùm nào và không cần dữ kiện chung
  function looseOf(items){
    return p3Runs(items).filter(function(r){ return r.length === 1 && !r[0].q.groupPassage && r[0].q.ctxFrom == null; }).map(function(r){ return r[0]; });
  }
  function lvBucket(it){ var l = it.q.level; return l === 'M4' ? 'd' : (l === 'M3' ? 'v' : 'b'); }
  function stripLead(t){ var E = window.PrepScholarEngine; return (E && E.cleanGroupLead) ? E.cleanGroupLead(t) : t; }
  function slotOf(it){ return { it: it, pa: (it.q.options || []).map(function(o){ return o.text; }), da: (function(){ var i = (it.q.options || []).map(function(o){ return o.isTrue; }).indexOf(true); return i < 0 ? '' : 'ABCD'[i]; })() }; }

  // cân đáp án Phần I (mỗi chữ 3–6 lần) bằng cách hoán vị phương án — bỏ qua câu có phương án tham chiếu nhau
  function shuffleable(slot){ return !(slot.pa || []).some(function(t){ return /\b(cả|tất cả|đều|hai ý|A và B|B và C|C và D|A, B|không có)\b/i.test(plain(t)) || /(^|\s)(A|B|C|D)\s*(và|,|\))/.test(plain(t)); }); }
  function balanceP1(slots){
    var target = [5, 5, 4, 4]; shuffle([0, 1, 2, 3]); var cnt = [0, 0, 0, 0];
    var order = shuffle(slots.map(function(_, i){ return i; }));
    var fixed = order.filter(function(i){ return !shuffleable(slots[i]); });
    fixed.forEach(function(i){ var k = 'ABCD'.indexOf(slots[i].da); if(k > -1) cnt[k]++; });
    var tgt = shuffle(target);
    order.filter(function(i){ return fixed.indexOf(i) < 0; }).forEach(function(i){
      var s = slots[i], k0 = 'ABCD'.indexOf(s.da), correct = s.pa[k0];
      var best = 0, bestScore = -99;
      for(var k = 0; k < 4; k++){ var sc = (tgt[k] - cnt[k]) + rnd() * 0.5; if(sc > bestScore){ bestScore = sc; best = k; } }
      var others = s.pa.filter(function(_, j){ return j !== k0; }), np = [];
      for(var j = 0; j < 4; j++){ np.push(j === best ? correct : others.shift()); }
      s.pa = np; s.da = 'ABCD'[best]; cnt[best]++;
    });
  }

  function pickPlan(exams, cfg, usedSet){
    var rows = cfg.rows, w = cfg.w, used = usedSet || {};
    var items = buildItems(exams, rows).filter(function(it){ return !used[it.uid]; });
    var rep = { notes: [] };
    var quota = window.OPC_MATRIX.apportion(18, rows.map(function(r){ return Number(w[r]) || 0; }));
    var left = {}; rows.forEach(function(r, i){ left[r] = quota[i]; });
    var p1pool = shuffle(items.filter(p1Ok)), chosen = [], seenDang = {};
    function take(it){ chosen.push(it); left[it.row] = Math.max(0, (left[it.row] || 0) - 1); seenDang[it.row + '|' + norm(it.q.dangBai)] = 1; p1pool = p1pool.filter(function(x){ return x !== it; }); }
    // bắt buộc có đủ loại: đơn vị ×2, tên đại lượng ×1, công thức ×2, có hình ×1
    [['đơn vị', 2], ['tên đại lượng', 1], ['công thức', 2], ['hình', 1]].forEach(function(r){
      for(var n = 0; n < r[1]; n++){
        var c = p1pool.filter(function(it){ return it.cls.loai.indexOf(r[0]) > -1 && (left[it.row] || 0) > 0 && !seenDang[it.row + '|' + norm(it.q.dangBai)]; })[0]
          || p1pool.filter(function(it){ return it.cls.loai.indexOf(r[0]) > -1 && chosen.length < 18; })[0];
        if(c) take(c);
      }
    });
    rows.forEach(function(r){
      var cand = p1pool.filter(function(it){ return it.row === r; });
      cand.sort(function(a, b){ return (seenDang[a.row + '|' + norm(a.q.dangBai)] ? 1 : 0) - (seenDang[b.row + '|' + norm(b.q.dangBai)] ? 1 : 0); });
      while((left[r] || 0) > 0 && cand.length && chosen.length < 18){ var it = cand.shift(); if(p1pool.indexOf(it) < 0) continue; take(it); cand.sort(function(a, b){ return (seenDang[a.row + '|' + norm(a.q.dangBai)] ? 1 : 0) - (seenDang[b.row + '|' + norm(b.q.dangBai)] ? 1 : 0); }); }
    });
    while(chosen.length < 18 && p1pool.length){ take(p1pool[0]); rep.notes.push('Phần I thiếu câu lí thuyết ở một số chủ đề → bù từ chủ đề khác'); }
    if(chosen.length < 18) rep.notes.push('Ngân hàng chỉ có ' + chosen.length + '/18 câu Phần I phù hợp — nạp thêm đề.');
    var p1 = chosen.map(slotOf); balanceP1(p1);

    // Phần II: 4 câu, mỗi chủ đề 1 câu nếu được; ưu tiên có câu thực nghiệm, thực tế
    var p2pool = shuffle(items.filter(p2Ok)), p2 = [], rowsShuf = shuffle(rows);
    ['thực nghiệm', 'thực tế'].forEach(function(k){ var c = p2pool.filter(function(it){ return it.cls.loai.indexOf(k) > -1; })[0]; if(c){ p2.push(c); p2pool = p2pool.filter(function(x){ return x !== c; }); } });
    rowsShuf.forEach(function(r){ if(p2.length >= 4) return; var c = p2pool.filter(function(it){ return it.row === r && !p2.some(function(x){ return x.row === r; }); })[0]; if(c){ p2.push(c); p2pool = p2pool.filter(function(x){ return x !== c; }); } });
    while(p2.length < 4 && p2pool.length){ p2.push(p2pool.shift()); }
    if(p2.length < 4) rep.notes.push('Ngân hàng chỉ có ' + p2.length + '/4 câu Phần II (đúng/sai).');

    // Phần III: 3 chùm × 2 câu, mức độ: 2 cơ bản + 3 vận dụng + 1 vận dụng cao
    // SỬA 28/10/2026 — chùm nhận theo cụm thật (xem p3Runs); thiếu chùm thì (nếu cho phép) thay bằng CÂU RỜI.
    var allowLoose = cfg.allowLoose !== false;
    var runs = p3Runs(items), pairs = shuffle(clusterPairs(runs)).slice(0, 70);
    function cnt(g){ var c = { b: 0, v: 0, d: 0 }; g.forEach(function(it){ c[lvBucket(it)]++; }); return c; }
    function overlap(a, b){ return a.some(function(x){ return b.some(function(y){ return x.uid === y.uid; }); }); }
    function costOfSet(set){
      var t = { b: 0, v: 0, d: 0 }, cost = 0;
      set.forEach(function(g){ var c = cnt(g); t.b += c.b; t.v += c.v; t.d += c.d; });
      if(set.length === 3) cost += Math.abs(t.b - 2) + Math.abs(t.v - 3) + Math.abs(t.d - 1) * 1.5;
      else cost += Math.max(0, t.b - 2) + Math.max(0, t.v - 3) + Math.max(0, t.d - 1) * 1.5; // thiếu chùm: chỉ phạt phần vượt, phần còn lại câu rời bù
      for(var i = 0; i < set.length; i++) for(var j = i + 1; j < set.length; j++){
        if(set[i][0].row === set[j][0].row) cost += 0.7;
        if(set[i].runKey === set[j].runKey) cost += 1;
      }
      return cost;
    }
    function search(k){
      var bestK = null, bc = 1e9;
      (function rec(start, chosen){
        if(chosen.length === k){ var c = costOfSet(chosen); if(c < bc){ bc = c; bestK = chosen.slice(); } return; }
        for(var i = start; i < pairs.length; i++){
          var skip = false; for(var s = 0; s < chosen.length; s++){ if(overlap(chosen[s], pairs[i])){ skip = true; break; } }
          if(skip) continue; chosen.push(pairs[i]); rec(i + 1, chosen); chosen.pop();
        }
      })(0, []);
      return { set: bestK, cost: bc };
    }
    var best = null, bestC = 1e9;
    for(var kk = 3; kk >= 1 && !best; kk--){ var rs = search(kk); if(rs.set){ best = rs.set; bestC = rs.cost; } }
    var p3 = best ? best.slice() : [];
    var needG = 3 - p3.length;
    if(needG > 0){
      if(!allowLoose){
        rep.notes.push('Ngân hàng chỉ có ' + p3.length + '/3 chùm dùng được (chùm = từ 2 câu trả lời ngắn liền nhau có dữ kiện chung). Bật "Cho phép thay chùm bằng câu rời" để bù bằng câu rời.');
      } else {
        var loose = shuffle(looseOf(items)), tot = { b: 0, v: 0, d: 0 };
        p3.forEach(function(g){ var c = cnt(g); tot.b += c.b; tot.v += c.v; tot.d += c.d; });
        var usedRows = {}; p3.forEach(function(g){ usedRows[g[0].row] = 1; });
        var made = 0;
        for(var gi = 0; gi < needG; gi++){
          var pick = [];
          for(var sl = 0; sl < 2; sl++){
            var rem = { b: Math.max(0, 2 - tot.b), v: Math.max(0, 3 - tot.v), d: Math.max(0, 1 - tot.d) };
            var order = ['v', 'b', 'd'].sort(function(a, b){ return rem[b] - rem[a]; });
            var c1 = null;
            for(var oi = 0; oi < order.length && !c1; oi++){
              var bk = order[oi]; if(!rem[bk] && oi < order.length - 1) continue;
              var cands = loose.filter(function(it){ return lvBucket(it) === bk && pick.indexOf(it) < 0; });
              c1 = cands.filter(function(it){ return !usedRows[it.row]; })[0] || cands[0] || null;
            }
            if(!c1) c1 = loose.filter(function(it){ return pick.indexOf(it) < 0; })[0] || null;
            if(c1){ pick.push(c1); loose = loose.filter(function(x){ return x !== c1; }); tot[lvBucket(c1)]++; usedRows[c1.row] = 1; }
          }
          if(pick.length === 2){ p3.push(mkGroup(pick, true)); made++; }
          else { pick.forEach(function(x){ loose.push(x); }); }
        }
        if(made) rep.notes.push('Phần III: ngân hàng chỉ có ' + (3 - needG) + '/3 chùm dùng được → thay ' + made + ' chùm còn thiếu bằng ' + (made * 2) + ' câu rời (không có dữ kiện chung) — thầy xem lại bảng duyệt, bấm "Đổi" để thay câu khác.');
        if(made < needG) rep.notes.push('Phần III: không đủ câu rời để bù hết (' + (needG - made) + ' chùm còn thiếu) — nạp thêm câu trả lời ngắn Phần III vào ngân hàng.');
      }
    } else if(bestC > 0.01){
      rep.notes.push('Mức độ Phần III chưa đúng 2 cơ bản + 3 vận dụng + 1 VDC do ngân hàng chưa đủ chùm phù hợp — thầy xem lại.');
    }
    if(!p3.length && !(allowLoose)) rep.notes.push('Chưa có chùm nào trong ngân hàng.');
    return { p1: p1, p2: p2.map(slotOf), p3: p3, rep: rep, items: items };
  }

  // ------------------------------------------------------------------ plan → de.json
  function planToDe(plan, cfg, ctx){
    var W = [], imgFiles = {}; // imgFiles: tên mới → { exId, name }
    function rich(txt, imgNames, ex, tag){
      var w = []; var r = texToRich(txt, w); w.forEach(function(x){ W.push(tag + ': ' + x); });
      var names = (imgNames || []).concat(r.imgs).filter(function(n, i, a){ return a.indexOf(n) === i; });
      return { text: r.text, imgs: names };
    }
    function hinhOf(names, ex, tag){
      if(!names.length) return null;
      var nm = names[0], newName = 'hinh_' + (Object.keys(imgFiles).length + 1) + '.png';
      imgFiles[newName] = { exId: ex.id, name: nm };
      return { file: newName, width_cm: 5 };
    }
    var de = { meta: {}, phan1: [], phan2: [], phan3: [] };
    plan.p1.forEach(function(s, i){
      var q = s.it.q, r = rich(q.stem, q.images, s.it.ex, 'P1 câu ' + (i + 1));
      var o = { de: r.text, pa: s.pa.map(function(t){ return rich(t, [], s.it.ex, 'P1 câu ' + (i + 1)).text; }), da: s.da, chu_de: s.it.row, loai: s.it.cls.loai.join(', '), nguon: s.it.ex.title + ' · câu ' + q.index };
      var hh = hinhOf(r.imgs, s.it.ex); if(hh) o.hinh = hh; de.phan1.push(o);
    });
    plan.p2.forEach(function(s, i){
      var q = s.it.q, r = rich(q.stem, q.images, s.it.ex, 'P2 câu ' + (i + 1));
      var o = { de: r.text, y: q.options.map(function(op){ return rich(op.text, [], s.it.ex, 'P2 câu ' + (i + 1)).text; }), da: q.options.map(function(op){ return op.isTrue ? 'Đ' : 'S'; }), chu_de: s.it.row, loai: s.it.cls.loai.join(', '), nguon: s.it.ex.title + ' · câu ' + q.index };
      var hh = hinhOf(r.imgs, s.it.ex); if(hh) o.hinh = hh; de.phan2.push(o);
    });
    plan.p3.forEach(function(g, i){
      var first = g[0], pass = (!g.loose && first.q.groupPassage) ? rich(stripLead(first.q.groupPassage), first.q.groupImages, first.ex, 'Chùm ' + (i + 1)) : { text: '', imgs: [] }; // SỬA 28/10/2026 — bỏ nhãn số câu gốc; cặp câu rời không có đoạn chung
      var grp = { chung: pass.text, loai: g.map(function(it){ return it.cls.loai.join(', '); }).join('; '), cau: g.map(function(it, k){
        var r = rich(it.q.stem, it.q.images, it.ex, 'Chùm ' + (i + 1) + ' câu ' + (k + 1)), da = shortansClean(it.q.shortans);
        if(!/^-?[0-9,]{1,4}$/.test(da) || da.replace('-', '').length > 4) W.push('Chùm ' + (i + 1) + ' câu ' + (k + 1) + ': đáp án "' + da + '" không vừa 4 ô (≤ 4 ký tự) — sửa trong bảng duyệt/nguồn');
        if(/(^|[^\p{L}])câu\s+(số\s+)?\d+/iu.test(plain(it.q.stem))) W.push('Chùm ' + (i + 1) + ' câu ' + (k + 1) + ': đề có nhắc "câu <số>" của đề gốc — kiểm tra/sửa lại số câu cho khớp đề Tổ');
        var o = { de: r.text, da: da, muc: MUC[it.q.level] || 'vận dụng', nguon: it.ex.title + ' · câu ' + it.q.index };
        var hh = hinhOf(r.imgs, it.ex); if(hh) o.hinh = hh; return o; }) };
      var gh = hinhOf(pass.imgs, first.ex); if(gh) grp.hinh = gh;
      de.phan3.push(grp);
    });
    var n = (String(cfg.ten_de).match(/\d+/) || ['1'])[0], last = String(cfg.gv_ra_de || '').trim().split(/\s+/).pop() || 'GV';
    de.meta = { ten_file: last + '_Đề ' + n, ten_folder: (cfg.gv_ra_de || 'GV') + '_Đề ' + n, ma_de: cfg.ma_de, ten_de: cfg.ten_de, gv_ra_de: cfg.gv_ra_de, gv_phan_bien: cfg.gv_phan_bien };
    if(cfg.truong) de.meta.truong = cfg.truong;
    return { de: de, imgFiles: imgFiles, warns: W };
  }

  // ------------------------------------------------------------------ ảnh
  function dataUrlToU8(u){ var b = atob(u.split(',')[1]), a = new Uint8Array(b.length); for(var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  async function loadImageBytes(ex, name){
    var imgs = await OPC().examBank.loadExamImages(ex.id, ex.images || []);
    var base = String(name).replace(/\.[a-z0-9]+$/i, '').toLowerCase();
    var im = (imgs || []).filter(function(x){ var n = String(x.name || x.id || '').toLowerCase(); return n === String(name).toLowerCase() || n.replace(/\.[a-z0-9]+$/i, '') === base; })[0];
    if(!im) return null;
    var url = im.dataUrl || im.url; if(!url) return null;
    if(url.indexOf('data:') === 0) return dataUrlToU8(url);
    var r = await fetch(url); if(!r.ok) return null; return new Uint8Array(await r.arrayBuffer());
  }

  // ------------------------------------------------------------------ lưu cấu hình nhẹ trên máy
  function lsGet(k, d){ try{ var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }catch(e){ return d; } }
  function lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  var CORE_ROWS = ['Vật lí nhiệt', 'Khí lí tưởng', 'Từ trường', 'Vật lí hạt nhân'];
  var DEFAULT_W = { 'Vật lí nhiệt': 20, 'Khí lí tưởng': 20, 'Từ trường': 35, 'Vật lí hạt nhân': 25 };

  // ------------------------------------------------------------------ giao diện
  function Panel(props){
    var st = React.useState([]); var exams = st[0], setExams = st[1];
    var cs = React.useState(lsGet('faraday-to-cfg', { ten_de: 'ĐỀ ÔN LUYỆN SỐ 1', ma_de: '0201', gv_ra_de: '', gv_phan_bien: '', truong: '', pages: '' })); var cfgBase = cs[0], setCfgBase = cs[1];
    var ws = React.useState(lsGet('faraday-to-w', DEFAULT_W)); var w = ws[0], setW = ws[1];
    var rs = React.useState(lsGet('faraday-to-rows', CORE_ROWS)); var rowsSel = rs[0], setRowsSel = rs[1];
    var us = React.useState(lsGet('faraday-to-used', {})); var used = us[0], setUsed = us[1];
    var eu = React.useState(true); var excludeUsed = eu[0], setExcludeUsed = eu[1];
    var al = React.useState(lsGet('faraday-to-loose', true)); var allowLoose = al[0], setAllowLoose = al[1]; // THÊM 28/10/2026 — thiếu chùm thì bù câu rời
    var ps = React.useState(null); var plan = ps[0], setPlan = ps[1];
    var bs = React.useState(''); var busy = bs[0], setBusy = bs[1];
    var vs = React.useState(null); var view = vs[0], setView = vs[1];
    var ms = React.useState([]); var msgs = ms[0], setMsgs = ms[1];

    React.useEffect(function(){
      var unsub = OPC().examBank.subscribe(function(snap){ setExams(snap.docs.map(function(d){ return Object.assign({}, d.data() || {}, { id: d.id }); })); }, function(){ setExams([]); });
      return function(){ try{ unsub && unsub(); }catch(e){} };
    }, []);
    function setCfg(k, v){ var n = Object.assign({}, cfgBase); n[k] = v; setCfgBase(n); lsSet('faraday-to-cfg', n); }
    var allRows = React.useMemo(function(){
      var s = {}; CORE_ROWS.forEach(function(r){ s[r] = 1; });
      exams.forEach(function(e){ if(e.examKind === 'soTruong') return; (e.questions || []).forEach(function(q){ var n = q.chuDeLon || e.chuDe; if(n) s[n] = 1; }); });
      return Object.keys(s);
    }, [exams]);
    var stats = React.useMemo(function(){
      var items = buildItems(exams, rowsSel), c = { p1: 0, p2: 0, p3: 0 };
      items.forEach(function(it){ if(used[it.uid] && excludeUsed) return; if(p1Ok(it)) c.p1++; else if(p2Ok(it)) c.p2++; });
      var free = items.filter(function(it){ return !(used[it.uid] && excludeUsed); });
      c.p3 = p3Runs(free).filter(function(r){ return r.length >= 2; }).length; // số chùm (cụm ≥ 2 câu)
      c.p3l = looseOf(free).length;                                              // số câu rời
      return c;
    }, [exams, rowsSel, used, excludeUsed]);

    function cfgFull(){ return Object.assign({}, cfgBase, { rows: rowsSel, w: w, allowLoose: allowLoose }); }
    function generate(){
      if(!window.OPC_MATRIX){ props.fireToast && props.fireToast('Thiếu exam-matrix.js'); return; }
      if(!rowsSel.length){ props.fireToast && props.fireToast('Chọn ít nhất 1 chủ đề.'); return; }
      var p = pickPlan(exams, cfgFull(), excludeUsed ? used : {});
      setPlan(p); setMsgs(p.rep.notes);
    }
    function swap(sec, idx){
      if(!plan) return;
      var items = plan.items.filter(function(it){ return !(excludeUsed && used[it.uid]); });
      var cur = plan[sec][idx], inPlan = {};
      plan.p1.concat(plan.p2).forEach(function(s){ inPlan[s.it.uid] = 1; }); plan.p3.forEach(function(g){ g.forEach(function(it){ inPlan[it.uid] = 1; }); });
      var np = Object.assign({}, plan);
      if(sec === 'p3'){
        // SỬA 28/10/2026 — ưu tiên chùm thật khác; hết chùm mà được phép thì thay bằng cặp câu rời
        var candC = shuffle(clusterPairs(p3Runs(items)).filter(function(g){ return !g.some(function(it){ return inPlan[it.uid]; }); }));
        var pickG = null;
        if(candC.length) pickG = candC.filter(function(g){ return g[0].row === cur[0].row; })[0] || candC[0];
        if(!pickG && allowLoose){
          var lo = shuffle(looseOf(items).filter(function(it){ return !inPlan[it.uid]; }));
          if(lo.length >= 2){
            var want = cur.map(lvBucket), picked = [];
            want.forEach(function(bk){ var c2 = lo.filter(function(it){ return lvBucket(it) === bk && picked.indexOf(it) < 0; })[0] || lo.filter(function(it){ return picked.indexOf(it) < 0; })[0]; if(c2) picked.push(c2); });
            if(picked.length === 2) pickG = mkGroup(picked, true);
          }
        }
        if(!pickG){ props.fireToast && props.fireToast(allowLoose ? 'Không còn chùm hoặc câu rời nào khác để đổi.' : 'Không còn chùm nào khác để đổi (bật "Cho phép thay chùm bằng câu rời" để dùng câu rời).'); return; }
        np.p3 = plan.p3.slice(); np.p3[idx] = pickG;
      } else {
        var ok = sec === 'p1' ? p1Ok : p2Ok, curIt = cur.it;
        var cand2 = shuffle(items.filter(function(it){ return ok(it) && !inPlan[it.uid]; }));
        var pick = cand2.filter(function(it){ return it.row === curIt.row && it.cls.loai[0] === curIt.cls.loai[0]; })[0] || cand2.filter(function(it){ return it.row === curIt.row; })[0] || cand2[0];
        if(!pick){ props.fireToast && props.fireToast('Không còn câu phù hợp để đổi.'); return; }
        np[sec] = plan[sec].slice();
        var ns = slotOf(pick);
        if(sec === 'p1' && shuffleable(ns)){ // giữ đúng chữ đáp án của vị trí cũ để không làm lệch phân bố
          var ci = 'ABCD'.indexOf(ns.da), correct = ns.pa[ci], others = ns.pa.filter(function(_, i){ return i !== ci; }), tgt = 'ABCD'.indexOf(cur.da), npa = [];
          for(var j = 0; j < 4; j++) npa.push(j === tgt ? correct : others.shift());
          ns.pa = npa; ns.da = cur.da;
        }
        np[sec][idx] = ns;
      }
      setPlan(np);
    }
    // THÊM 28/10/2026 — đổi RIÊNG 1 câu trong cặp câu rời (cùng mức độ, ưu tiên cùng chủ đề)
    function swapLoose(gi, j){
      if(!plan) return;
      var g = plan.p3[gi]; if(!g || !g.loose) return;
      var inPlan = {};
      plan.p1.concat(plan.p2).forEach(function(s){ inPlan[s.it.uid] = 1; }); plan.p3.forEach(function(gg){ gg.forEach(function(it){ inPlan[it.uid] = 1; }); });
      var items = plan.items.filter(function(it){ return !(excludeUsed && used[it.uid]); });
      var curIt = g[j];
      var cand = shuffle(looseOf(items).filter(function(it){ return !inPlan[it.uid]; }));
      var pick = cand.filter(function(it){ return lvBucket(it) === lvBucket(curIt) && it.row === curIt.row; })[0] || cand.filter(function(it){ return lvBucket(it) === lvBucket(curIt); })[0] || cand[0];
      if(!pick){ props.fireToast && props.fireToast('Không còn câu rời nào khác để đổi.'); return; }
      var ng = g.slice(); ng[j] = pick; ng = mkGroup(ng, true);
      var np = Object.assign({}, plan); np.p3 = plan.p3.slice(); np.p3[gi] = ng; setPlan(np);
    }
    function rebalance(){ if(!plan) return; var np = Object.assign({}, plan); np.p1 = plan.p1.map(function(s){ return Object.assign({}, s, { pa: s.pa.slice() }); }); balanceP1(np.p1); setPlan(np); }

    // ---------- checklist & thống kê
    var info = React.useMemo(function(){
      if(!plan) return null;
      var all = plan.p1.concat(plan.p2).map(function(s){ return s.it; }); plan.p3.forEach(function(g){ g.forEach(function(it){ all.push(it); }); });
      var has = function(k){ return all.some(function(it){ return it.cls.loai.indexOf(k) > -1; }); };
      var dist = { A: 0, B: 0, C: 0, D: 0 }; plan.p1.forEach(function(s){ if(dist[s.da] != null) dist[s.da]++; });
      var rowsHit = {}; all.forEach(function(it){ rowsHit[it.row] = (rowsHit[it.row] || 0) + 1; });
      var lv = { b: 0, v: 0, d: 0 }; plan.p3.forEach(function(g){ g.forEach(function(it){ if(it.q.level === 'M4') lv.d++; else if(it.q.level === 'M3') lv.v++; else lv.b++; }); });
      var distOk = Object.keys(dist).every(function(k){ return dist[k] >= 3 && dist[k] <= 6; });
      return { checks: [
        ['Đủ 18 + 4 + 6 câu (3 chùm × 2)', plan.p1.length === 18 && plan.p2.length === 4 && plan.p3.length === 3],
        ['(1) Có câu hỏi về đơn vị', has('đơn vị')], ['(2) Có câu hỏi tên đại lượng trong công thức', has('tên đại lượng')], ['(3) Có câu hỏi về công thức', has('công thức')],
        ['(4) Có bài đọc thiết bị/ứng dụng thực tế', has('thực tế')], ['(5) Có câu thực nghiệm (cách xác định đại lượng, thao tác, dụng cụ)', has('thực nghiệm')],
        ['(6) Câu hỏi chùm (Phần III)' + (plan.p3.some(function(g){ return g.loose; }) ? ' — có ' + plan.p3.filter(function(g){ return g.loose; }).length + ' cặp câu rời thay chùm' : ''), plan.p3.length === 3 && plan.p3.every(function(g){ return !g.loose; })], ['(7) Có hình vẽ/đồ thị/bảng số liệu', has('hình')],
        ['Phủ đủ các chủ đề đã chọn', rowsSel.every(function(r){ return rowsHit[r]; })],
        ['Đáp án Phần I phân bố đều (mỗi chữ 3–6 lần)', distOk],
        ['Phần III: 2 cơ bản + 3 vận dụng + 1 VDC', lv.b === 2 && lv.v === 3 && lv.d === 1]], dist: dist, rowsHit: rowsHit, lv: lv };
    }, [plan, rowsSel]);

    // ---------- xuất
    async function exportWord(){
      if(!plan) return;
      if(!window.OPC_TODOCX || !window.JSZip){ props.fireToast && props.fireToast('Thiếu thư viện xuất Word (to-docx.js / JSZip).'); return; }
      if(!cfgBase.gv_ra_de.trim()){ alert('Điền tên giáo viên ra đề (để đặt tên file và khung tiêu đề).'); return; }
      setBusy('Đang dựng 3 file Word…');
      try{
        var conv = planToDe(plan, cfgFull());
        var images = {};
        for(var nn of Object.keys(conv.imgFiles)){
          var ref = conv.imgFiles[nn], ex = exams.filter(function(e){ return e.id === ref.exId; })[0];
          var bytes = ex ? await loadImageBytes(ex, ref.name).catch(function(){ return null; }) : null;
          if(bytes) images[nn] = { bytes: bytes }; else conv.warns.push('Không lấy được ảnh "' + ref.name + '" — câu đó sẽ thiếu hình, chèn tay trong Word.');
        }
        var res = await window.OPC_TODOCX.buildAll(conv.de, { images: images, pages: Number(cfgBase.pages) || 0 || undefined });
        var zip = new window.JSZip(), folder = zip.folder(conv.de.meta.ten_folder), nm = conv.de.meta.ten_file;
        folder.file(nm + '.docx', res.de); folder.file(nm + '_ĐÁP ÁN.docx', res.dapan); folder.file(nm + '_BẢNG ĐÁP ÁN.docx', res.bang);
        folder.file('de.json', JSON.stringify(conv.de, null, 1));
        var blob = await zip.generateAsync({ type: 'blob' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = conv.de.meta.ten_folder + '.zip'; a.style.display = 'none'; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 4000);
        var nu = Object.assign({}, used), cnt = 0; plan.p1.concat(plan.p2).forEach(function(s){ nu[s.it.uid] = Date.now(); cnt++; }); plan.p3.forEach(function(g){ g.forEach(function(it){ nu[it.uid] = Date.now(); cnt++; }); });
        setUsed(nu); lsSet('faraday-to-used', nu);
        setMsgs(['Đã xuất ' + conv.de.meta.ten_folder + '.zip (' + res.pages + ' trang — ước lượng, nếu Word báo khác thì nhập số trang thật vào ô "Số trang" rồi xuất lại).'].concat(res.warnings, conv.warns));
        props.fireToast && props.fireToast('Đã tải bộ 3 file Word. Mở file trong Word → MathType → Convert Equations.');
      }catch(e){ console.error(e); setMsgs(['Lỗi xuất Word: ' + (e && e.message ? e.message : e)]); }
      setBusy('');
    }
    function downloadJson(){
      if(!plan) return; var conv = planToDe(plan, cfgFull());
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(conv.de, null, 1)], { type: 'application/json' })); a.download = 'de.json'; a.style.display = 'none'; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 3000);
    }

    // ---------- render
    var inp = function(k, label, ph, wd){ return h('label', { style: { display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.78rem', fontWeight: 700, flex: '1 1 ' + (wd || 200) + 'px' } }, label, h('input', { type: 'text', value: cfgBase[k] || '', placeholder: ph || '', style: { padding: '7px 9px', fontWeight: 400 }, onChange: function(e){ setCfg(k, e.target.value); } })); };
    var usedCount = Object.keys(used).length;
    var rowsTable = [];
    function row(part, no, s, kind, idx, sub){
      var it = s.it || s[0], q = it.q;
      rowsTable.push(h('tr', { key: part + no },
        h('td', null, part), h('td', null, no),
        h('td', { style: { maxWidth: '320px' } }, summary(kind === 'p3' ? q.stem : q.stem)),
        h('td', null, it.row, h('div', { style: { fontSize: '0.7rem', color: 'var(--ink-2)' } }, q.dangBai || '')),
        h('td', { style: { fontSize: '0.74rem' } }, it.cls.loai.join(', ')),
        h('td', null, LV[q.level] || q.level || '—'),
        h('td', null, h('b', null, kind === 'p1' ? s.da : kind === 'p2' ? q.options.map(function(o){ return o.isTrue ? 'Đ' : 'S'; }).join('') : shortansClean(q.shortans))),
        h('td', { style: { fontSize: '0.72rem', color: 'var(--ink-2)' } }, it.ex.title + ' · câu ' + q.index, q.aiCheck ? h('div', { style: { color: '#b91c1c', fontWeight: 700 } }, '⚠ AI cần kiểm tra') : null),
        h('td', { style: { whiteSpace: 'nowrap' } }, h('button', { type: 'button', className: 'btn btn-secondary', style: { fontSize: '0.74rem', padding: '3px 8px' }, onClick: function(){ setView({ s: s, kind: kind }); } }, '👁'), ' ', h('button', { type: 'button', className: 'btn btn-secondary', style: { fontSize: '0.74rem', padding: '3px 8px' }, onClick: function(){ swap(kind, idx); } }, kind === 'p3' && plan.p3[idx] && plan.p3[idx].loose ? '⇄ Đổi cặp' : '⇄ Đổi'),
          (kind === 'p3' && plan.p3[idx] && plan.p3[idx].loose) ? [' ', h('button', { key: 'q', type: 'button', className: 'btn btn-secondary', style: { fontSize: '0.74rem', padding: '3px 8px' }, onClick: function(){ swapLoose(idx, sub); } }, '⇄ Đổi câu này')] : null)));
    }
    if(plan){
      plan.p1.forEach(function(s, i){ row('I', i + 1, s, 'p1', i); });
      plan.p2.forEach(function(s, i){ row('II', i + 1, s, 'p2', i); });
      var k = 0; plan.p3.forEach(function(g, gi){ g.forEach(function(it, j){ k++; row(g.loose ? 'III · câu rời ' + (gi + 1) : 'III · chùm ' + (gi + 1), k, { it: it }, 'p3', gi, j); }); });
    }
    return h('div', { style: { padding: '4px 2px' } },
      h('h2', { style: { margin: '6px 0' } }, '📝 Soạn đề ôn luyện theo kế hoạch Tổ Vật lí – Công nghệ'),
      h('div', { style: { fontSize: '0.84rem', color: 'var(--ink-2)', marginBottom: '12px', lineHeight: 1.55 } }, 'Cấu trúc Tổ: Phần I 18 câu lí thuyết · Phần II 4 câu đúng/sai lí thuyết · Phần III 3 chùm × 2 câu (2 cơ bản + 3 vận dụng + 1 vận dụng cao) · phủ hết chương trình · đủ 7 loại câu. Hệ thống chọn câu từ ngân hàng đề; thầy xem bảng duyệt, đổi câu nào chưa ưng rồi xuất 3 file Word.'),
      h('div', { className: 'sm-card', style: { padding: '12px', marginBottom: '12px', background: 'var(--surface-2)', borderRadius: '10px' } },
        h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' } }, inp('ten_de', 'Tên đề', 'ĐỀ ÔN LUYỆN SỐ 1', 180), inp('ma_de', 'Mã đề', '0201', 90), inp('gv_ra_de', 'Giáo viên ra đề', 'Trần Văn Lượng', 190), inp('gv_phan_bien', 'Giáo viên phản biện', 'Phùng Thị Tuyết', 190), inp('pages', 'Số trang (bỏ trống = tự ước lượng)', '', 90)),
        h('div', { style: { fontSize: '0.82rem', marginBottom: '6px' } }, h('b', null, 'Chủ đề đưa vào đề & tỉ trọng:')),
        h('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' } }, allRows.map(function(r){ var on = rowsSel.indexOf(r) > -1;
          return h('label', { key: r, style: { display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.82rem' } },
            h('input', { type: 'checkbox', checked: on, onChange: function(e){ var n = e.target.checked ? rowsSel.concat([r]) : rowsSel.filter(function(x){ return x !== r; }); setRowsSel(n); lsSet('faraday-to-rows', n); } }), r,
            on ? h('input', { type: 'number', min: 0, max: 100, value: w[r] != null ? w[r] : 15, style: { width: '56px', padding: '3px 5px' }, onChange: function(e){ var nw = Object.assign({}, w); nw[r] = Math.max(0, Number(e.target.value) || 0); setW(nw); lsSet('faraday-to-w', nw); } }) : null, on ? '%' : null); })),
        h('div', { style: { display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8rem' } },
          h('label', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, h('input', { type: 'checkbox', checked: excludeUsed, onChange: function(e){ setExcludeUsed(e.target.checked); } }), 'Không dùng lại câu đã ra cho Tổ (' + usedCount + ' câu đã ghi nhận trên máy này)'),
          usedCount ? h('button', { type: 'button', className: 'btn btn-secondary', style: { fontSize: '0.74rem', padding: '3px 8px' }, onClick: function(){ if(window.confirm('Xoá lịch sử ' + usedCount + ' câu đã dùng?')){ setUsed({}); lsSet('faraday-to-used', {}); } } }, 'Xoá lịch sử') : null,
          h('label', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, h('input', { type: 'checkbox', checked: allowLoose, onChange: function(e){ setAllowLoose(e.target.checked); lsSet('faraday-to-loose', e.target.checked); } }), 'Thiếu chùm thì cho phép thay bằng câu rời (Phần III)'),
          h('span', { style: { color: 'var(--ink-2)' } }, 'Kho còn dùng được: Phần I ' + stats.p1 + ' câu lí thuyết · Phần II ' + stats.p2 + ' · Phần III ' + stats.p3 + ' chùm' + (stats.p3l ? ' + ' + stats.p3l + ' câu rời' : ''))),
        h('div', { style: { marginTop: '10px' } }, h('button', { type: 'button', className: 'btn btn-primary', disabled: !!busy || !exams.length, onClick: generate }, plan ? '🔄 Lập lại bảng duyệt' : '✨ Lập bảng duyệt'))),
      busy ? h('div', { className: 'banner info', style: { margin: '8px 0' } }, '⏳ ' + busy) : null,
      msgs.length ? h('div', { style: { margin: '8px 0', padding: '10px 12px', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.4)', borderRadius: '8px', fontSize: '0.8rem', lineHeight: 1.6 } }, msgs.map(function(m, i){ return h('div', { key: i }, '• ' + m); })) : null,
      plan ? h('div', null,
        h('div', { style: { overflowX: 'auto', marginBottom: '12px' } }, h('table', { className: 'sm-table', style: { width: '100%', fontSize: '0.8rem' } },
          h('thead', null, h('tr', null, ['Phần', 'Câu', 'Tóm tắt nội dung', 'Chủ đề / dạng', 'Loại', 'Mức độ', 'Đáp án', 'Nguồn', ''].map(function(t, i){ return h('th', { key: i }, t); }))),
          h('tbody', null, rowsTable))),
        info ? h('div', { style: { display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' } },
          h('div', { style: { flex: '1 1 340px', background: 'var(--surface-2)', borderRadius: '10px', padding: '12px' } }, h('b', null, 'Checklist yêu cầu của Tổ'),
            info.checks.map(function(c, i){ return h('div', { key: i, style: { fontSize: '0.82rem', color: c[1] ? '#15803d' : '#b91c1c', marginTop: '3px' } }, (c[1] ? '✓ ' : '✗ ') + c[0]); })),
          h('div', { style: { flex: '1 1 240px', background: 'var(--surface-2)', borderRadius: '10px', padding: '12px', fontSize: '0.84rem' } },
            h('b', null, 'Phân bố đáp án Phần I'), h('div', { style: { margin: '6px 0' } }, ['A', 'B', 'C', 'D'].map(function(L){ return L + ' = ' + info.dist[L]; }).join('  ·  ')),
            h('button', { type: 'button', className: 'btn btn-secondary', style: { fontSize: '0.76rem' }, onClick: rebalance }, '⇄ Cân lại đáp án Phần I'),
            h('div', { style: { marginTop: '10px' } }, h('b', null, 'Số câu theo chủ đề'), Object.keys(info.rowsHit).map(function(r){ return h('div', { key: r, style: { fontSize: '0.8rem' } }, r + ': ' + info.rowsHit[r]); })))) : null,
        h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' } },
          h('button', { type: 'button', className: 'btn btn-primary', disabled: !!busy, onClick: exportWord }, '⬇ Duyệt & xuất 3 file Word (.zip)'),
          h('button', { type: 'button', className: 'btn btn-secondary', disabled: !!busy, onClick: downloadJson }, 'Tải de.json'),
          h('span', { style: { fontSize: '0.76rem', color: 'var(--ink-2)' } }, 'Sau khi tải: mở từng file trong Word → tab MathType → Convert Equations (theo yêu cầu của Tổ).'))
      ) : (!exams.length ? h('div', { style: { color: 'var(--ink-2)' } }, 'Đang tải ngân hàng đề…') : null),
      view ? h('div', { className: 'sm-overlay', onClick: function(e){ if(e.target === e.currentTarget) setView(null); } },
        h('div', { className: 'sm-modal', style: { maxWidth: '720px' } },
          h('div', { className: 'sm-modal-head' }, h('h3', null, 'Xem câu'), h('button', { type: 'button', className: 'sm-modal-close', onClick: function(){ setView(null); } }, '✕')),
          (function(){ var s = view.s, it = s.it || s[0], q = it.q;
            return h('div', { style: { padding: '12px 16px', lineHeight: 1.6 } },
              q.groupPassage ? h('div', { style: { marginBottom: '8px', padding: '8px', background: 'var(--surface-2)', borderRadius: '8px' }, dangerouslySetInnerHTML: { __html: katexHtml(q.groupPassage) } }) : null,
              h('div', { dangerouslySetInnerHTML: { __html: katexHtml(q.stem) } }),
              (q.options || []).map(function(o, i){ var txt = view.kind === 'p1' ? s.pa[i] : o.text, mark = view.kind === 'p1' ? ('ABCD'[i] === s.da) : o.isTrue;
                return h('div', { key: i, style: { margin: '4px 0', fontWeight: mark ? 700 : 400, color: mark ? '#15803d' : 'inherit' } }, h('span', { dangerouslySetInnerHTML: { __html: (view.kind === 'p2' ? 'abcd'[i] + ') ' : 'ABCD'[i] + '. ') + katexHtml(txt) + (view.kind === 'p2' ? (o.isTrue ? ' (Đúng)' : ' (Sai)') : '') } })); }),
              q.shortans ? h('div', { style: { fontWeight: 700, color: '#15803d' } }, 'Đáp án: ' + shortansClean(q.shortans)) : null,
              q.loigiai ? h('details', { style: { marginTop: '8px' } }, h('summary', null, 'Lời giải'), h('div', { dangerouslySetInnerHTML: { __html: katexHtml(q.loigiai) } })) : null); })())) : null
    );
  }

  window.OPC_TO = { Panel: Panel, _t: { texToRich: texToRich, classify: classify, pickPlan: pickPlan, planToDe: planToDe, balanceP1: balanceP1, shortansClean: shortansClean } };
})(window);
