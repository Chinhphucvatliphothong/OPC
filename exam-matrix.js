/* ================= FaradayAI — MA TRẬN ĐỀ (kiểu Bộ GD&ĐT) cho tạo đề cá nhân hóa & đề Tổ =================
 * THÊM 27/10/2026. Thuần tính toán (không đụng giao diện/Firestore), dùng chung cho:
 *   - PersonalizedExamGeneratorPanel (admin.html): cấu trúc đề "Theo ma trận" — đề cá nhân hóa vẫn đúng ma trận
 *   - (sắp tới) soạn đề ôn luyện theo kế hoạch Tổ
 * Ma trận = hàng: chủ đề lớn (có trọng số %) × cột: Phần I/II/III (số câu) × mức độ M1–M4 (tỉ lệ %).
 * Chuẩn Bộ GD (cấu trúc đề tốt nghiệp THPT môn Vật lí): Phần I 18 câu · Phần II 4 câu · Phần III 6 câu = 28 câu;
 * tỉ lệ mức độ mặc định Biết 40% (M1) · Hiểu 30% (M2) · Vận dụng 30% (M3 20% + M4 10%). Trọng số chủ đề mặc định là
 * ƯỚC LƯỢNG — giáo viên chỉnh theo đề minh hoạ / kế hoạch của Tổ ngay trên giao diện.
 * Xuất: window.OPC_MATRIX = { presetBGD, allocate, pick, describe, LEVELS, PARTS }
 */
(function(root){
  'use strict';
  var LEVELS = ['M1', 'M2', 'M3', 'M4'];
  var PARTS = ['I', 'II', 'III'];
  var DEFAULT_W = { 'vat li nhiet': 20, 'khi li tuong': 20, 'tu truong': 35, 'vat li hat nhan': 25 };

  function norm(s){
    return String(s || '').toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function cellKey(row, part, level){ return row + '|' + part + '|' + level; }

  // Ma trận chuẩn Bộ GD cho danh sách chủ đề (tên hàng) đang có câu hỏi
  function presetBGD(rowNames){
    return {
      rows: (rowNames || []).map(function(n){ return { name: n, w: DEFAULT_W[norm(n)] || 15 }; }),
      lv: { M1: 40, M2: 30, M3: 20, M4: 10 },
      parts: { I: 18, II: 4, III: 6 }
    };
  }

  // Chia nguyên theo "phần dư lớn nhất": tổng đúng bằng total, tỉ lệ sát trọng số
  function apportion(total, weights){
    var sum = weights.reduce(function(a, b){ return a + b; }, 0), out = weights.map(function(){ return 0; });
    if(!(total > 0) || !(sum > 0)) return out;
    var fr = weights.map(function(w, i){ var x = total * w / sum; out[i] = Math.floor(x); return { i: i, r: x - Math.floor(x), w: w }; });
    var left = total - out.reduce(function(a, b){ return a + b; }, 0);
    fr.sort(function(a, b){ return (b.r - a.r) || (b.w - a.w); });
    for(var k = 0; k < left; k++) out[fr[k % fr.length].i]++;
    return out;
  }

  // spec → { 'Chủ đề|I|M2': n } — chia 2 bước để CẢ tổng theo chủ đề lẫn tổng theo mức độ đều sát tỉ lệ đã đặt:
  // (1) tổng theo mức độ (toàn đề) và theo chủ đề (toàn đề) được làm tròn 1 lần; (2) rải từng Phần theo hạn ngạch còn lại.
  function allocate(spec){
    var cells = {}, rows = spec.rows || [];
    var total = PARTS.reduce(function(a, p){ return a + (Number((spec.parts || {})[p]) || 0); }, 0);
    if(!rows.length || !(total > 0)) return cells;
    var lvW = LEVELS.map(function(l){ return Number((spec.lv || {})[l]) || 0; });
    var Lrem = apportion(total, lvW), Rrem = apportion(total, rows.map(function(r){ return Number(r.w) || 0; }));
    var plc = [];
    PARTS.forEach(function(p){
      var n = Number((spec.parts || {})[p]) || 0; if(!(n > 0)) return;
      var w = Lrem.some(function(x){ return x > 0; }) ? Lrem.map(function(x){ return Math.max(0, x); }) : lvW;
      var c = apportion(n, w);
      c.forEach(function(k, li){ if(k > 0){ plc.push({ p: p, l: LEVELS[li], n: k }); Lrem[li] = Math.max(0, Lrem[li] - k); } });
    });
    plc.sort(function(a, b){ return b.n - a.n; }).forEach(function(c){
      var w = Rrem.some(function(x){ return x > 0; }) ? Rrem.map(function(x){ return Math.max(0, x); }) : rows.map(function(r){ return Number(r.w) || 1; });
      apportion(c.n, w).forEach(function(k, ri){ if(k > 0){ cells[cellKey(rows[ri].name, c.p, c.l)] = (cells[cellKey(rows[ri].name, c.p, c.l)] || 0) + k; Rrem[ri] = Math.max(0, Rrem[ri] - k); } });
    });
    return cells;
  }

  // Tóm tắt để hiển thị: tổng theo chủ đề / mức độ / phần
  function describe(cells){
    var byRow = {}, byLv = {}, byPart = {}, total = 0;
    Object.keys(cells).forEach(function(k){ var a = k.split('|'), n = cells[k]; byRow[a[0]] = (byRow[a[0]] || 0) + n; byPart[a[1]] = (byPart[a[1]] || 0) + n; byLv[a[2]] = (byLv[a[2]] || 0) + n; total += n; });
    return { byRow: byRow, byLv: byLv, byPart: byPart, total: total };
  }

  function shuffle(arr, rnd){ var a = arr.slice(); for(var i = a.length - 1; i > 0; i--){ var j = Math.floor((rnd || Math.random)() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // Bốc câu cho từng ô. pool: các câu (q.part, q.level, q.chuDeLon / q.chuDe). cells: số câu CÒN CẦN theo từng ô.
  // opts.rnd: hàm ngẫu nhiên; opts.rows: tên hàng của ma trận. Trả { I:[..], II:[..], III:[..], shortage:[..], substituted:n }
  function pick(pool, cells, opts){
    opts = opts || {};
    var rnd = opts.rnd, rowNames = opts.rows || [], rowOf = {};
    rowNames.forEach(function(n){ rowOf[norm(n)] = n; });
    function rowName(q){ return rowOf[norm(q.chuDeLon)] || rowOf[norm(q.chuDe)] || null; }
    var used = {}, out = { I: [], II: [], III: [] }, shortage = [], substituted = 0;
    function qid(q){ return (q.examId || '') + '_q' + q.index; }
    function take(q, part){ used[qid(q)] = 1; out[part].push(q); }
    var keys = Object.keys(cells).filter(function(k){ return cells[k] > 0; });
    // ô nhiều câu trước để ô nhỏ không bị chiếm mất câu
    keys.sort(function(a, b){ return cells[b] - cells[a]; });
    var short = [];
    keys.forEach(function(k){
      var a = k.split('|'), row = a[0], part = a[1], lv = a[2], need = cells[k], got = 0;
      shuffle(pool.filter(function(q){ return q.part === part && q.level === lv && rowName(q) === row && !used[qid(q)]; }), rnd).forEach(function(q){ if(got < need){ take(q, part); got++; } });
      if(got < need) short.push({ row: row, part: part, level: lv, need: need, got: got });
    });
    // thiếu → thay thế: (1) cùng chủ đề + Phần, mức độ gần nhất; (2) cùng Phần + mức độ, chủ đề khác; (3) cùng Phần
    short.forEach(function(s){
      var got = s.got, li = LEVELS.indexOf(s.level);
      var steps = [
        function(q){ return rowName(q) === s.row; },
        function(q){ return q.level === s.level && rowName(q) != null; },
        function(q){ return true; }
      ];
      steps.forEach(function(ok, si){
        if(got >= s.need) return;
        var cand = shuffle(pool.filter(function(q){ return q.part === s.part && !used[qid(q)] && ok(q); }), rnd);
        if(si === 0) cand.sort(function(x, y){ return Math.abs(LEVELS.indexOf(x.level) - li) - Math.abs(LEVELS.indexOf(y.level) - li); });
        cand.forEach(function(q){ if(got < s.need){ take(q, s.part); got++; substituted++; } });
      });
      if(got < s.need) shortage.push({ row: s.row, part: s.part, level: s.level, need: s.need, got: got });
    });
    out.shortage = shortage; out.substituted = substituted;
    return out;
  }

  var api = { presetBGD: presetBGD, allocate: allocate, pick: pick, describe: describe, apportion: apportion, LEVELS: LEVELS, PARTS: PARTS, _norm: norm };
  root.OPC_MATRIX = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {}));
