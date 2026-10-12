/**
 * paper-omr.js — PHIẾU TRẢ LỜI GIẤY + ĐỌC PHIẾU BẰNG ẢNH CHỤP (OMR)
 * ---------------------------------------------------------------------
 * THÊM 12/10/2026. Học sinh làm đề trên giấy (trên lớp không dùng máy tính bảng / nhiều em không có máy).
 * File này dùng CHUNG cho:
 *   • bản in PDF (admin.html → buildPrintExamHtml): vẽ phiếu trả lời kiểu đề TN THPT (tô A/B/C/D, Đúng/Sai, ô số Phần III);
 *   • màn "📝 Nhập bài giấy" (admin.html → PaperEntryModal): đọc ảnh chụp phiếu, tự nhận các ô đã tô.
 * Hai phía dùng CÙNG một hàm tính toạ độ (layoutSheet) nên vị trí ô tô khi in và khi đọc luôn khớp nhau.
 *
 * Không cần thư viện, không gửi ảnh đi đâu: toàn bộ xử lý ảnh chạy ngay trên trình duyệt của thầy.
 *
 * NGUYÊN LÝ ĐỌC PHIẾU
 *   1. Phiếu có 4 ô vuông đen ở 4 góc (mốc định vị). Tìm 4 mốc trong ảnh (lọc vùng tối hình vuông, đặc).
 *   2. Từ 4 mốc tính phép biến đổi phối cảnh (homography) mm-trên-phiếu → điểm ảnh, nên ảnh chụp nghiêng/xa gần vẫn đọc được.
 *   3. Với từng ô tô: đo độ tối phần lõi ô so với nền giấy ngay quanh ô (bù ánh sáng không đều).
 *   4. Mỗi câu chọn ô tối nhất nếu đủ tối và vượt hẳn ô thứ hai; tô 2 ô / tô mờ → đánh dấu "cần xem lại" để thầy sửa tay.
 *
 * API: window.OPC_OMR = { layoutSheet, renderSheetSvg, orderForSheet, readSheet, sheetCode }
 */
(function (global) {
  'use strict';

  // ---------------- Hình học phiếu (đơn vị: mm) ----------------
  var W = 180;            // bề rộng vùng phiếu (vừa khổ A4 lề 15 mm)
  var MK = 7;             // cạnh ô vuông mốc ở 4 góc
  var R1 = 2.3;           // bán kính ô tô Phần I, II
  var R3 = 1.9;           // bán kính ô tô Phần III
  var P1 = 6.2;           // khoảng cách dòng Phần I, II
  var P3 = 4.8;           // khoảng cách dòng Phần III
  var DIGITS = ['-', ',', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

  // Sắp câu theo đúng thứ tự trên đề in: Phần I, rồi II, rồi III (giữ thứ tự trong từng phần)
  function orderForSheet(questions) {
    var p = { I: [], II: [], III: [] };
    (questions || []).forEach(function (q) { p[(q.part === 'II' || q.part === 'III') ? q.part : 'I'].push(q); });
    return { I: p.I, II: p.II, III: p.III, all: p.I.concat(p.II, p.III) };
  }

  // Tính vị trí mọi ô tô cho phiếu có n1/n2/n3 câu.
  // opts.withId (THÊM 12/10/2026 — chấm cả lớp): thêm 2 khối tô SỐ BÁO DANH + MÃ ĐỀ (mỗi khối 3 cột chữ số) ở đầu phiếu,
  // để camera tự biết phiếu của em nào, làm mã đề nào — không cần chọn tên.
  function layoutSheet(n1, n2, n3, opts) {
    opts = opts || {};
    var bubbles = [], labels = [], boxes = [];
    var y = 24;           // dưới phần tiêu đề + thông tin học sinh
    if (opts.withId) {
      var PD = 4.6, RD = 1.85;
      // SỬA 12/10/2026 — Số báo danh 6 chữ số (theo SBD của trường), mã đề 3 chữ số
      [{ kind: 'sbd', x: 105, t: 'SỐ BÁO DANH', n: 6 }, { kind: 'code', x: 149, t: 'MÃ ĐỀ', n: 3 }].forEach(function (blk) {
        var top = 21, bw = blk.n * 5.5 + 6;
        boxes.push({ x: blk.x, y: top, w: bw, h: 5 + 7 + 10 * PD + 2.5 });
        labels.push({ x: blk.x + bw / 2, y: top + 3.8, text: blk.t, cls: 'qh', anchor: 'middle' });
        for (var c = 0; c < blk.n; c++) {
          var cx = blk.x + 3 + c * 5.5 + 2.75;
          boxes.push({ x: cx - 2.35, y: top + 5, w: 4.7, h: 6, cls: 'write' });
          for (var dgt = 0; dgt < 10; dgt++) {
            bubbles.push({ part: blk.kind, col: c, ch: String(dgt), x: cx, y: top + 12.5 + dgt * PD + PD / 2, r: RD, glyph: String(dgt) });
          }
        }
      });
      // Phần I nằm bên TRÁI khối SBD/mã đề (2 cột), các phần sau bắt đầu dưới khối này
    }
    var idBottom = opts.withId ? 21 + 5 + 7 + 10 * 4.6 + 2.5 : 0;
    var x0 = 9, usable = W - 18;

    // PHẦN I
    if (n1 > 0) {
      labels.push({ x: x0, y: y, text: 'PHẦN I. Mỗi câu chọn MỘT phương án (tô kín ô tròn)', cls: 'sec' });
      y += 4;
      var rows1 = opts.withId ? Math.ceil(n1 / 2) : Math.max(Math.min(5, n1), Math.ceil(n1 / 4));   // dàn đều 4 cột (18 câu → 5 dòng × 4 cột)
      var cols1 = Math.ceil(n1 / rows1);
      var colW1 = opts.withId ? (104 - 3 - x0) / 2 : usable / Math.max(4, cols1);
      for (var c = 0; c < cols1; c++) {
        var cx0 = x0 + c * colW1;
        ['A', 'B', 'C', 'D'].forEach(function (k, j) { labels.push({ x: cx0 + 13 + j * 7, y: y + 3, text: k, cls: 'hd', anchor: 'middle' }); });
        boxes.push({ x: cx0 + 1, y: y - 0.5, w: colW1 - 3, h: 5 + rows1 * P1 });
      }
      for (var i = 0; i < n1; i++) {
        var col = Math.floor(i / rows1), row = i % rows1;
        var bx = x0 + col * colW1, by = y + 5 + row * P1 + P1 / 2;
        labels.push({ x: bx + 7.5, y: by + 1.1, text: String(i + 1), cls: 'num', anchor: 'end' });
        for (var j = 0; j < 4; j++) {
          bubbles.push({ part: 'I', qi: i, opt: 'ABCD'[j], x: bx + 13 + j * 7, y: by, r: R1, glyph: 'ABCD'[j] });
        }
      }
      y += 5 + rows1 * P1 + 6;
    }
    if (opts.withId) y = Math.max(y, idBottom + 6);

    // PHẦN II
    if (n2 > 0) {
      labels.push({ x: x0, y: y, text: 'PHẦN II. Mỗi ý a), b), c), d) tô Đ (đúng) hoặc S (sai)', cls: 'sec' });
      y += 4;
      var perRow2 = 4, bw2 = usable / perRow2, bh2 = 6 + 4 * P1 + 3;
      for (var q = 0; q < n2; q++) {
        var rr = Math.floor(q / perRow2), cc = q % perRow2;
        var qx = x0 + cc * bw2, qy = y + rr * (bh2 + 3);
        boxes.push({ x: qx + 1, y: qy - 0.5, w: bw2 - 3, h: bh2 });
        labels.push({ x: qx + 4, y: qy + 4, text: 'Câu ' + (q + 1), cls: 'qh' });
        labels.push({ x: qx + 21, y: qy + 4, text: 'Đúng', cls: 'hd', anchor: 'middle' });
        labels.push({ x: qx + 31, y: qy + 4, text: 'Sai', cls: 'hd', anchor: 'middle' });
        for (var s = 0; s < 4; s++) {
          var sy = qy + 6 + s * P1 + P1 / 2;
          labels.push({ x: qx + 9, y: sy + 1.1, text: 'abcd'[s] + ')', cls: 'num', anchor: 'end' });
          bubbles.push({ part: 'II', qi: q, si: s, val: true, x: qx + 21, y: sy, r: R1, glyph: 'Đ' });
          bubbles.push({ part: 'II', qi: q, si: s, val: false, x: qx + 31, y: sy, r: R1, glyph: 'S' });
        }
      }
      y += Math.ceil(n2 / perRow2) * (bh2 + 3) + 4;
    }

    // PHẦN III
    if (n3 > 0) {
      labels.push({ x: x0, y: y, text: 'PHẦN III. Viết đáp số vào ô chữ rồi tô ô tương ứng ở mỗi cột (dấu “-”, dấu phẩy “,”, chữ số)', cls: 'sec' });
      y += 4;
      var perRow3 = 6, bw3 = usable / perRow3, bh3 = 5 + 7 + 12 * P3 + 2;
      for (var t = 0; t < n3; t++) {
        var r3 = Math.floor(t / perRow3), c3 = t % perRow3;
        var tx = x0 + c3 * bw3, ty = y + r3 * (bh3 + 3);
        var gx = tx + (bw3 - 4 * 5.5) / 2;  // căn giữa 4 cột trong khung
        boxes.push({ x: tx + 1, y: ty - 0.5, w: bw3 - 3, h: bh3 });
        labels.push({ x: tx + bw3 / 2, y: ty + 3.8, text: 'Câu ' + (t + 1), cls: 'qh', anchor: 'middle' });
        for (var k = 0; k < 4; k++) {
          boxes.push({ x: gx + k * 5.5 + 0.4, y: ty + 5, w: 4.7, h: 6, cls: 'write' });
          for (var d = 0; d < 12; d++) {
            bubbles.push({ part: 'III', qi: t, col: k, ch: DIGITS[d], x: gx + k * 5.5 + 2.75, y: ty + 12.5 + d * P3 + P3 / 2, r: R3, glyph: DIGITS[d] === '-' ? '−' : DIGITS[d] });
          }
        }
      }
      y += Math.ceil(n3 / perRow3) * (bh3 + 3) + 2;
    }

    var H = Math.max(60, y + MK + 2);
    var markers = [
      { x: 0, y: 0 }, { x: W - MK, y: 0 }, { x: 0, y: H - MK }, { x: W - MK, y: H - MK }
    ].map(function (m) { return { x: m.x, y: m.y, w: MK, h: MK, cx: m.x + MK / 2, cy: m.y + MK / 2 }; });
    return { W: W, H: H, n1: n1, n2: n2, n3: n3, withId: !!opts.withId, bubbles: bubbles, labels: labels, boxes: boxes, markers: markers };
  }

  // Mã phiếu ngắn (giúp thầy khớp phiếu với đề khi nhập): 4 ký tự từ id đề
  function sheetCode(id) {
    var s = String(id || ''), h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', out = '';
    for (var j = 0; j < 4; j++) { out += A[h % A.length]; h = Math.floor(h / A.length); }
    return out;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  // Vẽ phiếu thành SVG (kích thước thật theo mm — in ra đúng tỉ lệ)
  // meta: { title, studentName, examCode, code, brand }
  function renderSheetSvg(L, meta) {
    meta = meta || {};
    var o = [];
    o.push('<svg xmlns="http://www.w3.org/2000/svg" class="omr-sheet" viewBox="0 0 ' + L.W + ' ' + L.H.toFixed(2) + '" width="' + L.W + 'mm" height="' + L.H.toFixed(2) + 'mm" font-family="Arial, Helvetica, sans-serif">');
    o.push('<style>.sec{font-size:3px;font-weight:700;fill:#111}.hd{font-size:2.6px;font-weight:700;fill:#333}.num{font-size:2.9px;font-weight:700;fill:#111}' +
      '.qh{font-size:2.8px;font-weight:700;fill:#111}.gl{font-size:2.1px;fill:#9a9a9a}.gl3{font-size:1.9px;fill:#9a9a9a}.ttl{font-size:4.6px;font-weight:700;fill:#111}' +
      '.inf{font-size:3px;fill:#222}.note{font-size:2.3px;fill:#666}</style>');
    o.push('<rect x="0" y="0" width="' + L.W + '" height="' + L.H.toFixed(2) + '" fill="#fff"/>');
    L.markers.forEach(function (m) { o.push('<rect x="' + m.x + '" y="' + m.y.toFixed(2) + '" width="' + m.w + '" height="' + m.h + '" fill="#000"/>'); });
    // Tiêu đề + thông tin
    o.push('<text class="ttl" x="' + (L.W / 2) + '" y="5.6" text-anchor="middle">PHIẾU TRẢ LỜI TRẮC NGHIỆM</text>');
    o.push('<text class="note" x="' + (L.W / 2) + '" y="9" text-anchor="middle">' + esc(meta.title || '') + (meta.brand ? ' · ' + esc(meta.brand) : '') + '</text>');
    if (L.withId) {
      // Phiếu chấm cả lớp: họ tên/lớp/ngày viết tay; SBD + mã đề TÔ ở khung bên phải
      o.push('<text class="inf" x="11" y="15">Họ và tên: </text><line x1="27" y1="15.4" x2="104" y2="15.4" stroke="#777" stroke-width=".2" stroke-dasharray=".6 .6"/>');
      o.push('<text class="inf" x="108" y="15">Lớp: <tspan font-weight="700">' + esc(meta.lop || '') + '</tspan></text>' + (meta.lop ? '' : '<line x1="116" y1="15.4" x2="138" y2="15.4" stroke="#777" stroke-width=".2" stroke-dasharray=".6 .6"/>'));
      o.push('<text class="inf" x="142" y="15">Ngày: </text><line x1="151" y1="15.4" x2="171" y2="15.4" stroke="#777" stroke-width=".2" stroke-dasharray=".6 .6"/>');
      o.push('<text class="note" x="11" y="19.4">Ghi và TÔ đủ 6 chữ số Số báo danh và 3 chữ số Mã đề ở khung bên phải. Tô KÍN ô bằng bút chì/bút đen; không viết lên 4 ô vuông đen.</text>');
    } else
    o.push('<text class="inf" x="11" y="15">Họ và tên: ' + (meta.studentName ? '<tspan font-weight="700">' + esc(meta.studentName) + '</tspan>' : '') + '</text>');
    if (!meta.studentName && !L.withId) o.push('<line x1="27" y1="15.4" x2="112" y2="15.4" stroke="#777" stroke-width=".2" stroke-dasharray=".6 .6"/>');
    if (!L.withId) o.push('<text class="inf" x="116" y="15">Mã đề: <tspan font-weight="700">' + esc(meta.examCode || '') + '</tspan></text>');
    if (!L.withId) o.push('<text class="inf" x="146" y="15">Mã phiếu: <tspan font-weight="700">' + esc(meta.code || '') + '</tspan></text>');
    if (!L.withId) o.push('<text class="note" x="11" y="19.4">Dùng bút chì đen hoặc bút mực đen tô KÍN ô tròn. Không gạch chéo, không tô ra ngoài. Không viết, vẽ lên 4 ô vuông đen ở góc phiếu.</text>');
    L.boxes.forEach(function (b) {
      o.push('<rect x="' + b.x.toFixed(2) + '" y="' + b.y.toFixed(2) + '" width="' + b.w.toFixed(2) + '" height="' + b.h.toFixed(2) + '" fill="none" stroke="' + (b.cls === 'write' ? '#555' : '#c8c8c8') + '" stroke-width="' + (b.cls === 'write' ? '.22' : '.25') + '" rx="' + (b.cls === 'write' ? '0.3' : '1') + '"/>');
    });
    L.labels.forEach(function (l) {
      o.push('<text class="' + l.cls + '" x="' + l.x.toFixed(2) + '" y="' + l.y.toFixed(2) + '"' + (l.anchor ? ' text-anchor="' + l.anchor + '"' : '') + '>' + esc(l.text) + '</text>');
    });
    L.bubbles.forEach(function (b) {
      o.push('<circle cx="' + b.x.toFixed(2) + '" cy="' + b.y.toFixed(2) + '" r="' + b.r + '" fill="none" stroke="#3a3a3a" stroke-width=".22"/>');
      o.push('<text class="' + (b.part === 'III' ? 'gl3' : 'gl') + '" x="' + b.x.toFixed(2) + '" y="' + (b.y + (b.part === 'III' ? 0.68 : 0.75)).toFixed(2) + '" text-anchor="middle">' + esc(b.glyph) + '</text>');
    });
    o.push('</svg>');
    return o.join('');
  }

  // ---------------- Xử lý ảnh ----------------
  // img: { width, height, data (RGBA) } — thường lấy từ canvas.getImageData
  function toGray(img) {
    var n = img.width * img.height, g = new Float32Array(n), d = img.data;
    for (var i = 0, j = 0; i < n; i++, j += 4) g[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
    return g;
  }

  // Ngưỡng thích nghi (Bradley): điểm tối hơn trung bình vùng lân cận 18% → tối
  function adaptiveDark(gray, w, h) {
    var S = Math.max(15, Math.round(Math.max(w, h) / 14)), half = S >> 1;
    var I = new Float64Array((w + 1) * (h + 1));
    for (var y = 0; y < h; y++) {
      var rowSum = 0;
      for (var x = 0; x < w; x++) {
        rowSum += gray[y * w + x];
        I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + rowSum;
      }
    }
    var out = new Uint8Array(w * h);
    for (var yy = 0; yy < h; yy++) {
      var y1 = Math.max(0, yy - half), y2 = Math.min(h - 1, yy + half);
      for (var xx = 0; xx < w; xx++) {
        var x1 = Math.max(0, xx - half), x2 = Math.min(w - 1, xx + half);
        var cnt = (x2 - x1 + 1) * (y2 - y1 + 1);
        var sum = I[(y2 + 1) * (w + 1) + x2 + 1] - I[y1 * (w + 1) + x2 + 1] - I[(y2 + 1) * (w + 1) + x1] + I[y1 * (w + 1) + x1];
        out[yy * w + xx] = gray[yy * w + xx] * cnt < sum * 0.82 ? 1 : 0;
      }
    }
    return out;
  }

  // Gom vùng tối liền nhau (4-liên thông) → thống kê từng vùng
  function components(mask, w, h, maxArea) {
    var lab = new Int32Array(w * h), comps = [], stack = new Int32Array(w * h), id = 0;
    for (var p = 0; p < w * h; p++) {
      if (!mask[p] || lab[p]) continue;
      id++;
      var sp = 0, area = 0, sx = 0, sy = 0, minx = w, miny = h, maxx = 0, maxy = 0, big = false;
      // điểm xa nhất theo 8 hướng → bán kính ngoại tiếp gần đúng (phân biệt vuông / tròn, không phụ thuộc góc xoay)
      var ev = [-1e9, -1e9, -1e9, -1e9, -1e9, -1e9, -1e9, -1e9], ep = [0, 0, 0, 0, 0, 0, 0, 0];
      stack[sp++] = p; lab[p] = id;
      while (sp) {
        var q = stack[--sp], qx = q % w, qy = (q - qx) / w;
        area++; sx += qx; sy += qy;
        if (qx < minx) minx = qx; if (qx > maxx) maxx = qx; if (qy < miny) miny = qy; if (qy > maxy) maxy = qy;
        var pr = [qx, -qx, qy, -qy, qx + qy, qx - qy, -qx + qy, -qx - qy];
        for (var di = 0; di < 8; di++) if (pr[di] > ev[di]) { ev[di] = pr[di]; ep[di] = q; }
        if (area > maxArea) big = true;
        if (qx > 0 && mask[q - 1] && !lab[q - 1]) { lab[q - 1] = id; stack[sp++] = q - 1; }
        if (qx < w - 1 && mask[q + 1] && !lab[q + 1]) { lab[q + 1] = id; stack[sp++] = q + 1; }
        if (qy > 0 && mask[q - w] && !lab[q - w]) { lab[q - w] = id; stack[sp++] = q - w; }
        if (qy < h - 1 && mask[q + w] && !lab[q + w]) { lab[q + w] = id; stack[sp++] = q + w; }
      }
      if (!big) {
        var ccx = sx / area, ccy = sy / area, R2 = 0;
        for (var e = 0; e < 8; e++) { var ex = ep[e] % w, ey = (ep[e] - ex) / w; var dd = (ex - ccx) * (ex - ccx) + (ey - ccy) * (ey - ccy); if (dd > R2) R2 = dd; }
        // roundness = diện tích / R²: hình vuông ≈ 2, hình tròn ≈ 3,1
        comps.push({ area: area, cx: ccx, cy: ccy, minx: minx, miny: miny, bw: maxx - minx + 1, bh: maxy - miny + 1, roundness: area / Math.max(1, R2 + 0.5 * Math.sqrt(R2) + 0.25) });
      }
    }
    return comps;
  }

  // Giải hệ tuyến tính (khử Gauss) — dùng cho homography 8 ẩn
  function solve(A, b) {
    var n = b.length;
    for (var i = 0; i < n; i++) {
      var piv = i;
      for (var r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
      var t = A[i]; A[i] = A[piv]; A[piv] = t; var tb = b[i]; b[i] = b[piv]; b[piv] = tb;
      if (Math.abs(A[i][i]) < 1e-12) return null;
      for (var r2 = i + 1; r2 < n; r2++) {
        var f = A[r2][i] / A[i][i];
        for (var c = i; c < n; c++) A[r2][c] -= f * A[i][c];
        b[r2] -= f * b[i];
      }
    }
    var x = new Array(n);
    for (var k = n - 1; k >= 0; k--) {
      var s = b[k];
      for (var c2 = k + 1; c2 < n; c2++) s -= A[k][c2] * x[c2];
      x[k] = s / A[k][k];
    }
    return x;
  }
  // Homography từ 4 cặp điểm (src: mm trên phiếu → dst: điểm ảnh)
  function homography(src, dst) {
    var A = [], b = [];
    for (var i = 0; i < 4; i++) {
      var X = src[i][0], Y = src[i][1], u = dst[i][0], v = dst[i][1];
      A.push([X, Y, 1, 0, 0, 0, -u * X, -u * Y]); b.push(u);
      A.push([0, 0, 0, X, Y, 1, -v * X, -v * Y]); b.push(v);
    }
    var hh = solve(A, b);
    if (!hh) return null;
    return function (X, Y) {
      var d = hh[6] * X + hh[7] * Y + 1;
      return [(hh[0] * X + hh[1] * Y + hh[2]) / d, (hh[3] * X + hh[4] * Y + hh[5]) / d];
    };
  }

  function sampler(gray, w, h) {
    return function (x, y) {
      if (x < 0 || y < 0 || x > w - 1.001 || y > h - 1.001) return 255;
      var x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, i = y0 * w + x0;
      return gray[i] * (1 - fx) * (1 - fy) + gray[i + 1] * fx * (1 - fy) + gray[i + w] * (1 - fx) * fy + gray[i + w + 1] * fx * fy;
    };
  }

  // Tìm 4 mốc vuông đen ở góc
  function findMarkers(gray, w, h) {
    var mask = adaptiveDark(gray, w, h);
    var maxArea = w * h * 0.02;
    var comps = components(mask, w, h, maxArea);
    var minSide = Math.max(6, Math.round(Math.min(w, h) / 120));
    var cand = comps.filter(function (c) {
      var ar = c.bw / c.bh, fill = c.area / (c.bw * c.bh);
      return c.bw >= minSide && c.bh >= minSide && ar > 0.5 && ar < 2 && fill > 0.45 && c.roundness < 2.45;
    });
    if (cand.length < 4) return null;
    var maxA = cand.reduce(function (m, c) { return Math.max(m, c.area); }, 0);
    // mốc là các ô vuông đặc LỚN nhất trên phiếu (ô tô tròn nhỏ hơn và kém "vuông" hơn)
    var big = cand.filter(function (c) { return c.area >= maxA * 0.3; });
    if (big.length < 4) big = cand;
    function pick(score) { return big.reduce(function (m, c) { return score(c) > score(m) ? c : m; }); }
    var tl = pick(function (c) { return -(c.cx + c.cy); });
    var tr = pick(function (c) { return c.cx - c.cy; });
    var bl = pick(function (c) { return c.cy - c.cx; });
    var br = pick(function (c) { return c.cx + c.cy; });
    var set = [tl, tr, bl, br];
    for (var i = 0; i < 4; i++) for (var j = i + 1; j < 4; j++) if (set[i] === set[j]) return null;
    // cỡ 4 mốc phải na ná nhau
    var areas = set.map(function (c) { return c.area; }).sort(function (a, b) { return a - b; });
    if (areas[0] < areas[3] * 0.25) return null;
    return set;
  }

  // Đọc phiếu. L = layoutSheet(...) của đề; img = ImageData
  function readSheet(img, L) {
    var w = img.width, h = img.height;
    var gray = toGray(img);
    var mk = findMarkers(gray, w, h);
    if (!mk) return { ok: false, error: 'Không tìm thấy đủ 4 ô vuông đen ở 4 góc phiếu. Chụp lại: thấy trọn cả 4 góc, phiếu phẳng, đủ sáng, không bị bóng che.' };
    var src = L.markers.map(function (m) { return [m.cx, m.cy]; });
    var dst = mk.map(function (c) { return [c.cx, c.cy]; });
    var H = homography(src, dst);
    if (!H) return { ok: false, error: 'Không định vị được phiếu (4 góc thẳng hàng?). Chụp lại thẳng hơn.' };
    // kiểm tra tỉ lệ: khoảng cách mốc trong ảnh phải khớp tỉ lệ phiếu (sai nhiều = nhận nhầm mốc / nhầm loại phiếu)
    var topLen = Math.hypot(dst[1][0] - dst[0][0], dst[1][1] - dst[0][1]);
    var leftLen = Math.hypot(dst[2][0] - dst[0][0], dst[2][1] - dst[0][1]);
    var ratio = (leftLen / topLen) / ((L.H - MK) / (L.W - MK));
    if (ratio < 0.7 || ratio > 1.4) return { ok: false, error: 'Tỉ lệ phiếu trong ảnh không khớp với đề đã chọn (có thể chọn nhầm đề, hoặc ảnh bị cắt mất phần dưới phiếu).' };
    var S = sampler(gray, w, h);

    // độ tối từng ô: lõi ô so với vòng nền xung quanh
    var vals = L.bubbles.map(function (b) {
      var core = [], ring = [];
      var rc = b.r * 0.55, steps = 4;
      for (var iy = -steps; iy <= steps; iy++) for (var ix = -steps; ix <= steps; ix++) {
        var dx = ix / steps * rc, dy = iy / steps * rc;
        if (dx * dx + dy * dy > rc * rc) continue;
        var p = H(b.x + dx, b.y + dy); core.push(S(p[0], p[1]));
      }
      var rr = b.r * 1.42;
      for (var a = 0; a < 16; a++) {
        var ang = a / 16 * Math.PI * 2, pp = H(b.x + Math.cos(ang) * rr, b.y + Math.sin(ang) * rr);
        ring.push(S(pp[0], pp[1]));
      }
      ring.sort(function (x, y) { return x - y; });
      var ref = ring[Math.floor(ring.length * 0.7)] || 255;
      var mean = core.reduce(function (s, v) { return s + v; }, 0) / core.length;
      return Math.max(0, Math.min(1, 1 - mean / Math.max(30, ref)));
    });
    // ngưỡng: đa số ô để trống → trung vị ≈ độ tối ô trống (vạch viền + chữ in mờ)
    var sorted = vals.slice().sort(function (a, b) { return a - b; });
    var base = sorted[Math.floor(sorted.length * 0.5)] || 0;
    var T = Math.max(0.28, base + 0.2), GAP = 0.12;

    function decide(idxs) {
      var arr = idxs.map(function (i) { return { i: i, v: vals[i] }; }).sort(function (a, b) { return b.v - a.v; });
      var top = arr[0], second = arr[1] || { v: 0 };
      if (top.v < T) return { pick: null, sure: top.v < T * 0.75 };          // trống (gần ngưỡng → chưa chắc)
      if (second.v >= T && top.v - second.v < GAP) return { pick: top.i, sure: false, multi: true }; // tô 2 ô
      return { pick: top.i, sure: top.v - second.v >= GAP };
    }
    var groups = {};
    L.bubbles.forEach(function (b, i) {
      if (b.part === 'sbd' || b.part === 'code') return;
      var key = b.part === 'I' ? 'I:' + b.qi : (b.part === 'II' ? 'II:' + b.qi + ':' + b.si : 'III:' + b.qi + ':' + b.col);
      (groups[key] = groups[key] || []).push(i);
    });
    var res = { I: [], II: [], III: [] }, unsure = { I: {}, II: {}, III: {} };
    // Số báo danh / mã đề (phiếu chấm cả lớp): mỗi cột 1 chữ số; cột để trống thì bỏ qua (vd chỉ tô 2 cột "0","7" → 7)
    function readDigits(kind) {
      var str = '', ok = true, ncol = 0;
      for (var c = 0; c < 6; c++) {
        var g = []; L.bubbles.forEach(function (b, i) { if (b.part === kind && b.col === c) g.push(i); });
        if (!g.length) break;
        ncol++;
        var dd = decide(g);
        if (dd.pick != null) str += L.bubbles[dd.pick].ch;
        if (!dd.sure) ok = false;
      }
      // tô thiếu cột (vd SBD chỉ tô 4/6 số) → vẫn đọc nhưng đánh dấu cần xem lại
      return { text: str, value: str ? parseInt(str, 10) : null, sure: ok && str.length === ncol };
    }
    var idInfo = L.withId ? { sbd: readDigits('sbd'), code: readDigits('code') } : null;
    for (var q1 = 0; q1 < L.n1; q1++) {
      var d1 = decide(groups['I:' + q1]);
      res.I[q1] = d1.pick != null ? L.bubbles[d1.pick].opt : null;
      if (!d1.sure) unsure.I[q1] = d1.multi ? 'Tô nhiều ô' : 'Tô mờ / chưa rõ';
    }
    for (var q2 = 0; q2 < L.n2; q2++) {
      res.II[q2] = [];
      for (var s = 0; s < 4; s++) {
        var d2 = decide(groups['II:' + q2 + ':' + s]);
        res.II[q2][s] = d2.pick != null ? L.bubbles[d2.pick].val : null;
        if (!d2.sure) unsure.II[q2] = (unsure.II[q2] || '') + 'abcd'[s];
      }
    }
    for (var q3 = 0; q3 < L.n3; q3++) {
      var str = '', bad = false;
      for (var col = 0; col < 4; col++) {
        var d3 = decide(groups['III:' + q3 + ':' + col]);
        if (d3.pick != null) str += L.bubbles[d3.pick].ch;
        if (!d3.sure) bad = true;
      }
      if (str && !/^-?\d*(,\d*)?$/.test(str)) bad = true;
      res.III[q3] = str;
      if (bad) unsure.III[q3] = 'Cần xem lại';
    }
    return {
      ok: true, answers: res, unsure: unsure, threshold: T, baseline: base, id: idInfo,
      markers: dst, values: vals,
      project: H
    };
  }

  global.OPC_OMR = {
    layoutSheet: layoutSheet,
    renderSheetSvg: renderSheetSvg,
    orderForSheet: orderForSheet,
    readSheet: readSheet,
    sheetCode: sheetCode,
    DIGITS: DIGITS
  };
})(typeof window !== 'undefined' ? window : globalThis);
