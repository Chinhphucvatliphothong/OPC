/**
 * mohinh3d.js — THÊM 4/11/2026 · MÔ HÌNH 3D cho ✨ Lời giải động (thẻ [3d: …] trong kịch bản)
 * Tự vẽ bằng canvas 2D (không cần thư viện ngoài, nhẹ cho điện thoại). Kéo để xoay, nút Xoay / Đặt lại.
 * Nạp SAU React, TRƯỚC loigiai-dong.js.
 *
 * CÚ PHÁP:  [3d: tên-mô-hình | xoay | tham số=giá trị | ghi chú hiện dưới hình]
 *   binh-khi   bình khí: hạt chuyển động nhanh dần khi T tăng      T=300 (K; "T=27C" = 27 °C)  — có thanh kéo T
 *   hat-nhan   hạt nhân + electron                                 Z=3 A=7
 *   nam-cham   nam châm thẳng + đường sức từ 3D
 *   day-dan    từ trường dòng điện thẳng (quy tắc nắm tay phải)    I=- (đảo chiều)
 *   khung-day  khung dây quay trong từ trường đều (từ thông, máy phát điện)
 *   "xoay" = tự xoay góc nhìn. Ví dụ: [3d: binh-khi | xoay | T=400 | hạt nhanh dần khi T tăng]
 *
 * Xuất: window.OPC_3D = { View, parseSpec, MODELS, names }
 */
(function(window){
  'use strict';
  var React = window.React;
  if(!React) return;
  var h = React.createElement;

  // ------------------------------------------------------------ toán
  function rotY(p, a){ var c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; }
  function rotX(p, a){ var c = Math.cos(a), s = Math.sin(a); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; }
  function rotZ(p, a){ var c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; }
  function add(a, b){ return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function mix(c1, c2, k){
    k = Math.max(0, Math.min(1, k));
    var a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
    var r = Math.round((a >> 16) * (1 - k) + (b >> 16) * k), g = Math.round(((a >> 8) & 255) * (1 - k) + ((b >> 8) & 255) * k), bl = Math.round((a & 255) * (1 - k) + (b & 255) * k);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }
  function rng(seed){ var s = seed || 1; return function(){ s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  var INK = '#15171C', GOLD = '#B07A1E', BLUE = '#1F5FA8', RED = '#D14332', MUTED = '#5E5A51';
  function box(c, sx, sy, sz){ // 8 đỉnh + 12 cạnh + 6 mặt của hộp tâm c
    var v = []; [-1, 1].forEach(function(x){ [-1, 1].forEach(function(y){ [-1, 1].forEach(function(z){ v.push([c[0] + x * sx, c[1] + y * sy, c[2] + z * sz]); }); }); });
    var e = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    var f = [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]];
    return { v: v, e: e, f: f };
  }
  function circle(c, r, axis, n){ // vòng tròn quanh trục 'x' | 'y' | 'z'
    var pts = []; n = n || 48;
    for(var i = 0; i <= n; i++){ var a = i / n * Math.PI * 2, u = Math.cos(a) * r, w = Math.sin(a) * r;
      pts.push(axis === 'y' ? [c[0] + u, c[1], c[2] + w] : axis === 'x' ? [c[0], c[1] + u, c[2] + w] : [c[0] + u, c[1] + w, c[2]]); }
    return pts;
  }
  function polyline(out, pts, c, w, al){ for(var i = 0; i < pts.length - 1; i++) out.push({ k: 'l', a: pts[i], b: pts[i + 1], c: c, w: w, al: al }); }

  // ------------------------------------------------------------ các mô hình
  var MODELS = {};
  MODELS['binh-khi'] = {
    title: 'Bình khí', caption: 'Nhiệt độ càng cao, các phân tử khí chuyển động càng nhanh',
    controls: [{ key: 'T', label: 'T', min: 200, max: 700, step: 10, unit: 'K' }],
    defaults: { T: 300 },
    init: function(){
      var r = rng(7), ps = [];
      for(var i = 0; i < 38; i++){
        var th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1), sp = 0.6 + r() * 0.8;
        ps.push({ p: [(r() - 0.5) * 2, (r() - 0.5) * 1.3, (r() - 0.5) * 1.3], v: [Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp] });
      }
      return { ps: ps };
    },
    frame: function(st, t, dt, P){
      var out = [], B = [1.1, 0.72, 0.72], T = Number(P.T) || 300, f = Math.sqrt(T / 300) * 0.9, col = mix(BLUE, RED, (T - 220) / 420);
      st.ps.forEach(function(q){
        for(var k = 0; k < 3; k++){
          q.p[k] += q.v[k] * f * dt;
          var lim = B[k] - 0.07;
          if(q.p[k] > lim){ q.p[k] = lim; q.v[k] = -Math.abs(q.v[k]); }
          if(q.p[k] < -lim){ q.p[k] = -lim; q.v[k] = Math.abs(q.v[k]); }
        }
        out.push({ k: 'b', p: q.p.slice(), r: 0.055, c: col });
      });
      var bx = box([0, 0, 0], B[0], B[1], B[2]);
      bx.f.forEach(function(fc){ out.push({ k: 'f', pts: fc.map(function(i){ return bx.v[i]; }), c: 'rgba(234,241,250,0.28)' }); });
      bx.e.forEach(function(e){ out.push({ k: 'l', a: bx.v[e[0]], b: bx.v[e[1]], c: INK, w: 2 }); });
      // áp kế trên nắp
      out.push({ k: 'l', a: [0, B[1], 0], b: [0, B[1] + 0.25, 0], c: INK, w: 2 });
      polyline(out, circle([0, B[1] + 0.42, 0], 0.17, 'z', 28), INK, 2);
      var ang = Math.PI * (0.85 - Math.min(0.75, (T - 200) / 600));
      out.push({ k: 'l', a: [0, B[1] + 0.42, 0], b: [Math.cos(ang) * 0.13, B[1] + 0.42 + Math.sin(ang) * 0.13, 0], c: col, w: 2.5 });
      out.push({ k: 't', p: [0, -B[1] - 0.28, 0], s: 'T = ' + Math.round(T) + ' K (' + Math.round(T - 273) + ' °C)', c: MUTED });
      return out;
    }
  };
  MODELS['hat-nhan'] = {
    title: 'Hạt nhân nguyên tử', caption: 'Mô hình minh hoạ, không đúng tỉ lệ',
    defaults: { Z: 3, A: 7 },
    init: function(P){
      var A = Math.max(1, Math.min(40, Math.round(Number(P.A) || 7))), Z = Math.max(1, Math.min(A, Math.round(Number(P.Z) || 3)));
      var r = rng(11), ns = [], R = 0.11 * Math.cbrt(A);
      for(var i = 0; i < A; i++){
        var u = r(), th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1), rr = R * Math.cbrt(u);
        ns.push({ p: [rr * Math.sin(ph) * Math.cos(th), rr * Math.cos(ph), rr * Math.sin(ph) * Math.sin(th)], pr: false });
      }
      var ix = ns.map(function(_, i){ return i; }).sort(function(){ return r() - 0.5; });
      for(var k = 0; k < Z; k++) ns[ix[k]].pr = true;
      return { ns: ns, Z: Z, A: A };
    },
    frame: function(st, t){
      var out = [];
      st.ns.forEach(function(n, i){ var j = 0.006 * Math.sin(t * 6 + i); out.push({ k: 'b', p: [n.p[0] + j, n.p[1] - j, n.p[2]], r: 0.1, c: n.pr ? RED : '#8C97A3' }); });
      var ne = Math.min(st.Z, 6);
      for(var e = 0; e < ne; e++){
        var tilt = [0.2, 1.1, -0.9, 0.6, -0.3, 1.4][e], spin = [0, 1.0, 2.1, 0.5, 1.6, 2.6][e], R = e < 2 ? 0.75 : 1.15;
        var ring = circle([0, 0, 0], R, 'y', 64).map(function(p){ return rotY(rotX(p, tilt), spin); });
        polyline(out, ring, BLUE, 1.2, 0.45);
        var a = t * (e < 2 ? 1.6 : 1.1) + e * 2.1;
        out.push({ k: 'b', p: rotY(rotX([Math.cos(a) * R, 0, Math.sin(a) * R], tilt), spin), r: 0.05, c: BLUE });
      }
      out.push({ k: 't', p: [0, -1.4, 0], s: 'Z = ' + st.Z + ' proton · ' + (st.A - st.Z) + ' nơtron', c: MUTED });
      return out;
    }
  };
  MODELS['nam-cham'] = {
    title: 'Nam châm thẳng', caption: 'Đường sức từ đi ra từ cực Bắc (N), đi vào cực Nam (S)',
    init: function(){ return {}; },
    frame: function(st, t){
      var out = [], L = 0.85, W = 0.17;
      [[RED, 1], [BLUE, -1]].forEach(function(z){
        var b = box([z[1] * L / 2, 0, 0], L / 2, W, W);
        b.f.forEach(function(fc, i){ out.push({ k: 'f', pts: fc.map(function(k){ return b.v[k]; }), c: mix(z[0], '#FFFFFF', i % 2 ? 0.08 : 0.22), s: mix(z[0], INK, 0.4) }); });
      });
      out.push({ k: 't', p: [L / 2, W + 0.16, 0], s: 'N', c: RED, b: true });
      out.push({ k: 't', p: [-L / 2, W + 0.16, 0], s: 'S', c: BLUE, b: true });
      [0, Math.PI / 3, 2 * Math.PI / 3, Math.PI, 4 * Math.PI / 3, 5 * Math.PI / 3].forEach(function(phi, pi){
        [1.25, 1.9].forEach(function(K, ki){
          var th0 = Math.asin(Math.sqrt(Math.min(1, 0.95 / K))), pts = [];
          for(var i = 0; i <= 40; i++){ var th = th0 + (Math.PI - 2 * th0) * i / 40, r = K * Math.sin(th) * Math.sin(th), rho = r * Math.sin(th);
            pts.push([r * Math.cos(th), rho * Math.cos(phi), rho * Math.sin(phi)]); }
          polyline(out, pts, GOLD, 1.4, 0.6);
          var m = Math.min(39, Math.max(0, Math.floor((((t * 0.35 + pi * 0.13 + ki * 0.5) % 1) + 1) % 1 * 40)));
          out.push({ k: 'a', a: pts[m], b: pts[Math.min(40, m + 1)], c: GOLD });
        });
      });
      return out;
    }
  };
  MODELS['day-dan'] = {
    title: 'Từ trường của dòng điện thẳng', caption: 'Quy tắc nắm tay phải: ngón cái theo chiều I, các ngón còn lại theo chiều đường sức',
    init: function(){ return {}; },
    frame: function(st, t, dt, P){
      var out = [], dir = (P.I === '-' || P.I === '-1' || P.nguoc) ? -1 : 1;
      out.push({ k: 'l', a: [0, -1.25, 0], b: [0, 1.25, 0], c: GOLD, w: 7 });
      out.push({ k: 'a', a: [0, dir * 0.95, 0], b: [0, dir * 1.3, 0], c: RED, w: 3 });
      out.push({ k: 't', p: [0.18, dir * 1.2, 0], s: 'I', c: RED, b: true });
      [-0.75, 0, 0.75].forEach(function(y, yi){
        [0.38, 0.72, 1.05].forEach(function(r, ri){
          var pts = circle([0, y, 0], r, 'y', 48);
          polyline(out, pts, BLUE, 1.4, 0.55);
          for(var m = 0; m < 2; m++){
            var a = -dir * (t * (1.2 - ri * 0.25) + m * Math.PI + yi), a2 = a - dir * 0.12;
            out.push({ k: 'a', a: [Math.cos(a) * r, y, Math.sin(a) * r], b: [Math.cos(a2) * r, y, Math.sin(a2) * r], c: BLUE });
          }
        });
      });
      out.push({ k: 't', p: [1.15, 0.12, 0], s: 'B', c: BLUE, b: true });
      return out;
    }
  };
  MODELS['khung-day'] = {
    title: 'Khung dây quay trong từ trường', caption: 'Từ thông Φ = B·S·cos α biến thiên → xuất hiện suất điện động cảm ứng',
    init: function(){ return {}; },
    frame: function(st, t){
      var out = [], al = t * 0.8;
      [-0.65, 0, 0.65].forEach(function(y){ [-0.65, 0.65].forEach(function(z){
        out.push({ k: 'l', a: [-1.45, y, z], b: [1.35, y, z], c: BLUE, w: 1.2, al: 0.45 });
        out.push({ k: 'a', a: [1.2, y, z], b: [1.45, y, z], c: BLUE });
      }); });
      out.push({ k: 't', p: [1.5, 0.85, 0.65], s: 'B', c: BLUE, b: true });
      var w = 0.55, hh = 0.6, cs = [[-w, -hh, 0], [w, -hh, 0], [w, hh, 0], [-w, hh, 0]].map(function(p){ return rotY(p, al); });
      out.push({ k: 'f', pts: cs, c: 'rgba(243,227,184,0.35)' });
      for(var i = 0; i < 4; i++) out.push({ k: 'l', a: cs[i], b: cs[(i + 1) % 4], c: GOLD, w: 5 });
      out.push({ k: 'l', a: [0, -hh - 0.35, 0], b: [0, hh + 0.35, 0], c: MUTED, w: 1.5, al: 0.6 });
      var n = rotY([0, 0, 0.75], al);
      out.push({ k: 'l', a: [0, 0, 0], b: n, c: RED, w: 2.5 }); out.push({ k: 'a', a: rotY([0, 0, 0.6], al), b: n, c: RED, w: 2.5 });
      out.push({ k: 't', p: add(n, [0, 0.12, 0]), s: 'n', c: RED, b: true });
      var deg = ((Math.round((al - Math.PI / 2) * 180 / Math.PI) % 360) + 360) % 360, cos = Math.cos((deg) * Math.PI / 180);
      out.push({ k: 't', p: [0, -1.25, 0], s: 'α = ' + deg + '° · Φ = ' + cos.toFixed(2).replace('.', ',') + ' BS', c: MUTED });
      return out;
    }
  };
  var ALIAS = { 'khi': 'binh-khi', 'chat-khi': 'binh-khi', 'binh': 'binh-khi', 'binh-khi-kin': 'binh-khi', 'nguyen-tu': 'hat-nhan', 'hatnhan': 'hat-nhan',
    'tu-truong-nam-cham': 'nam-cham', 'namcham': 'nam-cham', 'dong-dien-thang': 'day-dan', 'day-dan-thang': 'day-dan', 'may-phat': 'khung-day', 'may-phat-dien': 'khung-day', 'cam-ung': 'khung-day' };
  function slug(s){ return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  // "binh-khi | xoay | T=400 | ghi chú" → { model, name, spin, params, note }
  function parseSpec(spec){
    if(spec && typeof spec === 'object') return spec;
    var parts = String(spec || '').split('|').map(function(x){ return x.trim(); }).filter(Boolean);
    var name = slug(parts.shift() || ''), out = { name: name, model: MODELS[name] ? name : (ALIAS[name] || null), spin: false, params: {}, note: '' };
    parts.forEach(function(p){
      var m = p.match(/^([A-Za-z]\w*)\s*=\s*(-?[\d.,]*)\s*(°?C|K)?$/);
      if(/^(xoay|tu xoay|tự xoay|quay)$/i.test(p)) out.spin = true;
      else if(m){ var v = m[2] === '-' || m[2] === '' ? m[2] : Number(m[2].replace(',', '.')); if(m[3] && /C/.test(m[3]) && typeof v === 'number') v += 273; out.params[m[1]] = v === '' ? '-' : v; }
      else if(/^(nguoc|ngược)$/i.test(p)) out.params.nguoc = true;
      else out.note = out.note ? out.note + ' · ' + p : p;
    });
    return out;
  }

  // ------------------------------------------------------------ vẽ
  function render(ctx, W, H, prims, cam, zoom){
    var S = Math.min(W, H) * (zoom || 0.25), cx = W / 2, cy = H * 0.53, D = 5;
    function pj(p){ var q = rotX(rotY(p, cam.yaw), cam.pitch), k = D / (D - q[2]); return { x: cx + q[0] * S * k, y: cy - q[1] * S * k, z: q[2], k: k }; }
    var items = [], texts = [];
    prims.forEach(function(o){
      if(o.k === 't'){ texts.push({ o: o, a: pj(o.p) }); return; }
      if(o.k === 'b'){ var a = pj(o.p); items.push({ o: o, a: a, z: a.z }); return; }
      if(o.k === 'f'){ var ps = o.pts.map(pj); items.push({ o: o, ps: ps, z: ps.reduce(function(s, x){ return s + x.z; }, 0) / ps.length - 0.02 }); return; }
      var A = pj(o.a), B = pj(o.b); items.push({ o: o, a: A, b: B, z: (A.z + B.z) / 2 });
    });
    items.sort(function(x, y){ return x.z - y.z; });
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    items.forEach(function(it){
      var o = it.o; ctx.globalAlpha = o.al == null ? 1 : o.al;
      if(o.k === 'b'){
        var r = Math.max(1.5, o.r * S * it.a.k), g = ctx.createRadialGradient(it.a.x - r * 0.35, it.a.y - r * 0.35, r * 0.1, it.a.x, it.a.y, r);
        g.addColorStop(0, mix(o.c, '#FFFFFF', 0.55)); g.addColorStop(1, mix(o.c, INK, 0.25));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(it.a.x, it.a.y, r, 0, Math.PI * 2); ctx.fill();
      } else if(o.k === 'f'){
        ctx.fillStyle = o.c; ctx.beginPath(); it.ps.forEach(function(p, i){ if(i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.closePath(); ctx.fill();
        if(o.s){ ctx.strokeStyle = o.s; ctx.lineWidth = 1; ctx.stroke(); }
      } else if(o.k === 'a'){
        var dx = it.b.x - it.a.x, dy = it.b.y - it.a.y, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, s = (o.w ? 9 : 7) * Math.min(1.4, it.b.k);
        if(o.w){ ctx.strokeStyle = o.c; ctx.lineWidth = o.w; ctx.beginPath(); ctx.moveTo(it.a.x, it.a.y); ctx.lineTo(it.b.x, it.b.y); ctx.stroke(); }
        ctx.fillStyle = o.c; ctx.beginPath(); ctx.moveTo(it.b.x + ux * s * 0.4, it.b.y + uy * s * 0.4);
        ctx.lineTo(it.b.x - ux * s - uy * s * 0.55, it.b.y - uy * s + ux * s * 0.55); ctx.lineTo(it.b.x - ux * s + uy * s * 0.55, it.b.y - uy * s - ux * s * 0.55); ctx.closePath(); ctx.fill();
      } else {
        ctx.strokeStyle = o.c; ctx.lineWidth = (o.w || 1.5) * Math.max(0.6, Math.min(1.4, (it.a.k + it.b.k) / 2)) * Math.max(1, W / 500);
        ctx.beginPath(); ctx.moveTo(it.a.x, it.a.y); ctx.lineTo(it.b.x, it.b.y); ctx.stroke();
      }
    });
    ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    texts.forEach(function(t){ var fs = Math.max(11, Math.min(W, H) * (t.o.b ? 0.06 : 0.045)); ctx.font = (t.o.b ? '700 ' : '600 ') + fs + 'px "Be Vietnam Pro",system-ui,sans-serif'; ctx.fillStyle = t.o.c; ctx.fillText(t.o.s, t.a.x, t.a.y); });
  }

  var CSS = [
    '.o3d{position:relative;width:100%;user-select:none;-webkit-user-select:none;font-family:"Be Vietnam Pro",system-ui,sans-serif;}',
    '.o3d canvas{display:block;width:100%;height:100%;touch-action:none;cursor:grab;} .o3d canvas:active{cursor:grabbing;} .o3d.static canvas{cursor:default;touch-action:auto;}',
    '.o3d-ui{position:absolute;left:6px;right:6px;bottom:6px;display:flex;gap:6px;align-items:center;font-size:12px;color:#3D3A33;}',
    '.o3d-ui button{height:36px;min-width:36px;padding:0 10px;border-radius:10px;border:1px solid #E4DFD3;background:#fff;color:#15171C;font:inherit;font-weight:600;cursor:pointer;}',
    '.o3d-ui button:hover{background:#F3EBDA;} .o3d-ui button[aria-pressed="true"]{background:#15171C;border-color:#15171C;color:#fff;}',
    '.o3d-ui button:focus-visible,.o3d-ui input:focus-visible{outline:2px solid #7A4E16;outline-offset:2px;}',
    '.o3d-ui label{display:flex;align-items:center;gap:6px;flex:1 1 120px;min-width:0;white-space:nowrap;background:rgba(255,255,255,.9);border-radius:10px;padding:0 8px;height:36px;}',
    '.o3d-ui input[type=range]{flex:1;min-width:40px;accent-color:#7A4E16;}',
    '.o3d.compact{display:flex;flex-direction:column;} .o3d.compact canvas{height:auto;}',
    '.o3d.compact .o3d-ui{position:static;margin-top:4px;gap:4px;font-size:11px;} .o3d.compact .o3d-ui button{height:32px;min-width:32px;padding:0 8px;border-radius:8px;} .o3d.compact .o3d-ui label{height:32px;flex-basis:90px;}',
    '.o3d.compact .o3d-cap{font-size:11px;top:4px;}',
    '.o3d-cap{position:absolute;left:8px;right:8px;top:6px;font-size:12px;line-height:1.35;color:#5E5A51;text-align:center;pointer-events:none;}',
    '.o3d-miss{display:flex;align-items:center;justify-content:center;text-align:center;padding:12px;font-size:13px;color:#5E5A51;height:100%;box-sizing:border-box;}'
  ].join('\n');
  function ensureCss(){ if(document.getElementById('o3d-css')) return; var s = document.createElement('style'); s.id = 'o3d-css'; s.textContent = CSS; document.head.appendChild(s); }

  // props: spec (chuỗi hoặc đã parse), spin (true/false: điều khiển từ ngoài), static (true: không kéo, ẩn nút), ui (false: ẩn nút), aspect (rộng/cao, mặc định 4/3), caption (false: ẩn ghi chú)
  function View(props){
    ensureCss();
    var sp = React.useMemo(function(){ return parseSpec(props.spec); }, [typeof props.spec === 'string' ? props.spec : JSON.stringify(props.spec)]);
    var M = sp.model ? MODELS[sp.model] : null;
    var s1 = React.useState(sp.spin); var spinS = s1[0], setSpin = s1[1];
    var s2 = React.useState(function(){ return Object.assign({}, (M && M.defaults) || {}, sp.params); }); var P = s2[0], setP = s2[1];
    var spin = props.spin != null ? !!props.spin : spinS;
    var cv = React.useRef(null), wrap = React.useRef(null), cam = React.useRef({ yaw: -0.55, pitch: 0.32 }), st = React.useRef(null), drag = React.useRef(null);
    var live = React.useRef({}); live.current = { spin: spin, P: P, zoom: props.compact ? 0.3 : 0.25 };
    React.useEffect(function(){ st.current = M ? M.init(Object.assign({}, M.defaults || {}, sp.params)) : null; setP(Object.assign({}, (M && M.defaults) || {}, sp.params)); }, [sp.model, JSON.stringify(sp.params)]);
    React.useEffect(function(){
      if(!M) return;
      var raf = 0, last = performance.now(), t0 = last, visible = true, io = null;
      if(window.IntersectionObserver && wrap.current){ io = new IntersectionObserver(function(es){ visible = es[0].isIntersecting; }); io.observe(wrap.current); }
      function loop(now){
        raf = requestAnimationFrame(loop);
        var dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
        if(!visible || document.hidden) return;
        var c = cv.current; if(!c || !st.current) return;
        var dpr = window.devicePixelRatio || 1, W = Math.round(c.clientWidth * dpr), H = Math.round(c.clientHeight * dpr);
        if(!W || !H) return;
        if(c.width !== W || c.height !== H){ c.width = W; c.height = H; }
        if(live.current.spin && !drag.current) cam.current.yaw += dt * 0.45;
        render(c.getContext('2d'), W, H, M.frame(st.current, Math.max(0, now - t0) / 1000, dt, live.current.P), cam.current, live.current.zoom);
      }
      raf = requestAnimationFrame(loop);
      return function(){ cancelAnimationFrame(raf); if(io) io.disconnect(); };
    }, [sp.model]);
    function stop(e){ e.stopPropagation(); }
    var interactive = !props['static'];
    var canvasProps = interactive ? {
      onPointerDown: function(e){ e.stopPropagation(); drag.current = { x: e.clientX, y: e.clientY }; try{ e.currentTarget.setPointerCapture(e.pointerId); }catch(x){} },
      onPointerMove: function(e){ var d = drag.current; if(!d) return; cam.current.yaw += (e.clientX - d.x) * 0.01; cam.current.pitch = Math.max(-1.3, Math.min(1.3, cam.current.pitch + (e.clientY - d.y) * 0.01)); d.x = e.clientX; d.y = e.clientY; },
      onPointerUp: function(){ drag.current = null; }, onPointerCancel: function(){ drag.current = null; }, onClick: stop
    } : {};
    var style = Object.assign(props.compact ? {} : { aspectRatio: String(props.aspect || 4 / 3) }, props.style || {});
    var cvStyle = props.compact ? { aspectRatio: String(props.aspect || 4 / 3), maxHeight: props.maxH || '9em' } : null;
    if(!M) return h('div', { className: 'o3d', style: style }, h('div', { className: 'o3d-miss' }, 'Chưa có mô hình 3D "' + (sp.name || '') + '". Có sẵn: ' + Object.keys(MODELS).join(', ') + '.'));
    var label = (M.title || '') + (sp.note ? ': ' + sp.note : '');
    return h('div', { className: 'o3d' + (interactive ? '' : ' static') + (props.compact ? ' compact' : ''), ref: wrap, style: style, onClick: stop },
      h('canvas', Object.assign({ ref: cv, style: cvStyle, role: 'img', 'aria-label': 'Mô hình 3D: ' + label + (interactive ? '. Kéo để xoay.' : '') }, canvasProps)),
      props.caption === false ? null : h('div', { className: 'o3d-cap' }, sp.note || M.caption || ''),
      (interactive && props.ui !== false) ? h('div', { className: 'o3d-ui', onPointerDown: stop },
        props.spin == null ? h('button', { type: 'button', 'aria-pressed': spin ? 'true' : 'false', onClick: function(e){ e.stopPropagation(); setSpin(!spin); } }, 'Xoay') : null,
        props.compact ? null : h('button', { type: 'button', onClick: function(e){ e.stopPropagation(); cam.current = { yaw: -0.55, pitch: 0.32 }; } }, 'Đặt lại'),
        (M.controls || []).map(function(c){
          return h('label', { key: c.key }, (props.compact ? '' : c.label + ' = ') + Math.round(P[c.key]) + ' ' + c.unit,
            h('input', { type: 'range', min: c.min, max: c.max, step: c.step, value: P[c.key], 'aria-label': c.label,
              onChange: function(e){ var n = Object.assign({}, P); n[c.key] = Number(e.target.value); setP(n); } }));
        })) : null);
  }

  window.OPC_3D = { View: View, parseSpec: parseSpec, MODELS: MODELS, names: function(){ return Object.keys(MODELS); } };
})(window);
