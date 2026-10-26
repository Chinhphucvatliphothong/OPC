/**
 * admin-aiimport.js — THÊM 26/10/2026 · "✨ Nhập từ PDF/ảnh bằng AI" trong form Nạp đề (Ngân hàng đề)
 * Trước: PDF/ảnh → Claude → tải .tex + ảnh về máy → mở FaradayAI → upload tay.
 * Nay:   chọn PDF/ảnh ngay trong admin → AI (Gemini, /api/ai-tex) chép từng trang theo đúng mẫu \begin{ex}…\choice…
 *        \loigiai của thầy → tự CẮT hình minh hoạ theo khung AI chỉ → thầy xem/sửa .tex + hình → "Dùng kết quả này"
 *        đưa thẳng vào form nạp đề (phân tích câu, gắn nano-point, lưu như cũ).
 * PDF đọc bằng pdf.js (cdnjs) ngay trên trình duyệt; mỗi trang gửi kèm trang kế để chép nốt câu tràn trang.
 * Xuất: window.OPC_AIIMPORT = { Modal }
 */
(function(window){
  'use strict';
  var React = window.React; if(!React) return;
  var h = React.createElement;
  var PDFJS_VER = '3.11.174';
  var pdfjsP = null;
  function loadPdfJs(){
    if(window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if(!pdfjsP) pdfjsP = new Promise(function(ok, no){
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/' + PDFJS_VER + '/pdf.min.js';
      s.onload = function(){
        if(!window.pdfjsLib){ no(new Error('Không nạp được trình đọc PDF')); return; }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/' + PDFJS_VER + '/pdf.worker.min.js';
        ok(window.pdfjsLib);
      };
      s.onerror = function(){ pdfjsP = null; no(new Error('Không tải được trình đọc PDF (kiểm tra mạng)')); };
      document.head.appendChild(s);
    });
    return pdfjsP;
  }
  // 1 trang → canvas (bề rộng ~1600px: đủ nét cho AI đọc chữ nhỏ và cắt hình đẹp)
  async function pdfPages(file, onProg){
    var lib = await loadPdfJs();
    var doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise, out = [];
    for(var i = 1; i <= doc.numPages; i++){
      if(onProg) onProg('Đang đọc trang ' + i + '/' + doc.numPages + ' của ' + file.name + '…');
      var page = await doc.getPage(i), v1 = page.getViewport({ scale: 1 }), sc = Math.min(3, 1600 / v1.width);
      var vp = page.getViewport({ scale: sc }), c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      out.push({ canvas: c, label: file.name + ' · trang ' + i });
    }
    return out;
  }
  function imagePage(file){
    return new Promise(function(ok, no){
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function(){
        var k = Math.min(1, 1800 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); ok({ canvas: c, label: file.name });
      };
      im.onerror = function(){ URL.revokeObjectURL(url); no(new Error('Không đọc được ảnh ' + file.name)); };
      im.src = url;
    });
  }
  function jpegB64(canvas, maxW){
    var c = canvas;
    if(canvas.width > (maxW || 1600)){ var k = (maxW || 1600) / canvas.width; c = document.createElement('canvas'); c.width = Math.round(canvas.width * k); c.height = Math.round(canvas.height * k); c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height); }
    return c.toDataURL('image/jpeg', 0.85).split(',')[1];
  }
  // cắt hình theo khung chuẩn hoá 0–1000 (nới 1,2% mỗi phía để không mất nhãn)
  function cropFigure(canvas, box){
    var W = canvas.width, H = canvas.height, pad = 12;
    var y0 = Math.max(0, (box[0] - pad) / 1000 * H), x0 = Math.max(0, (box[1] - pad) / 1000 * W);
    var y1 = Math.min(H, (box[2] + pad) / 1000 * H), x1 = Math.min(W, (box[3] + pad) / 1000 * W);
    var w = Math.max(8, x1 - x0), hh = Math.max(8, y1 - y0), c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(hh);
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(canvas, x0, y0, w, hh, 0, 0, c.width, c.height);
    return c;
  }
  function canvasToFile(c, name){ return new Promise(function(ok){ c.toBlob(function(b){ ok(new File([b], name, { type: 'image/png' })); }, 'image/png'); }); }
  function lastPart(tex){ var m = String(tex).match(/\\tieuephan\{[^}]*?(III|II|I)\b[^}]*\}/gi); if(!m) return ''; var last = m[m.length - 1]; return /III/.test(last) ? 'III' : (/II/.test(last) ? 'II' : 'I'); }

  function AiImportModal(props){
    var fs = React.useState([]); var files = fs[0], setFiles = fs[1];
    var ps = React.useState(null); var pages = ps[0], setPages = ps[1];          // [{canvas,label}]
    var rs = React.useState([]); var results = rs[0], setResults = rs[1];        // per page: { tex, figs:[{id,name,canvas,url}], notes, err }
    var bs = React.useState(''); var busy = bs[0], setBusy = bs[1];
    var ts = React.useState(''); var tex = ts[0], setTex = ts[1];
    var es = React.useState(''); var extra = es[0], setExtra = es[1];
    var stopRef = React.useRef(false);
    var figAll = [].concat.apply([], results.map(function(r){ return (r && r.figs) || []; }));
    async function onPick(e){
      var list = Array.prototype.slice.call(e.target.files || []); e.target.value = '';
      if(!list.length) return;
      list.sort(function(a, b){ return a.name.localeCompare(b.name, 'vi', { numeric: true }); });
      setFiles(list); setResults([]); setTex(''); setBusy('Đang đọc file…');
      try{
        var pg = [];
        for(var i = 0; i < list.length; i++){
          if(/pdf$/i.test(list[i].type) || /\.pdf$/i.test(list[i].name)) pg = pg.concat(await pdfPages(list[i], setBusy));
          else if(/^image\//.test(list[i].type) || /\.(png|jpe?g|webp|heic)$/i.test(list[i].name)) pg.push(await imagePage(list[i]));
        }
        if(!pg.length) throw new Error('Chưa có trang nào — chọn file PDF hoặc ảnh chụp đề.');
        setPages(pg); setBusy('');
      }catch(err){ setBusy(''); props.fireToast(err.message, true); }
    }
    async function run(fromIdx){
      stopRef.current = false;
      var out = results.slice(), part = '';
      for(var k = 0; k < (fromIdx || 0); k++) if(out[k] && out[k].tex) part = lastPart(out[k].tex) || part;
      for(var i = fromIdx || 0; i < pages.length; i++){
        if(stopRef.current) break;
        setBusy('AI đang chép trang ' + (i + 1) + '/' + pages.length + ' (' + pages[i].label + ')…');
        var imgs = [{ mime: 'image/jpeg', data: jpegB64(pages[i].canvas) }];
        if(pages[i + 1]) imgs.push({ mime: 'image/jpeg', data: jpegB64(pages[i + 1].canvas, 1100) });
        var r = null, tries = 0;
        while(!r && tries < 4){
          try{
            var resp = await fetch('/api/ai-tex', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ images: imgs, chuDe: props.chuDe || '', part: part, extra: extra, mode: props.mode || '' }) });
            var j = await resp.json().catch(function(){ return {}; });
            if(resp.status === 429){ tries++; setBusy('Google đang giới hạn lượt — chờ 40 giây rồi chép tiếp trang ' + (i + 1) + '…'); await new Promise(function(ok){ setTimeout(ok, 40000); }); continue; }
            if(!resp.ok) throw new Error(j.error || ('Lỗi ' + resp.status));
            r = j;
          }catch(err){ tries++; if(tries >= 2){ r = { err: err.message }; } else await new Promise(function(ok){ setTimeout(ok, 2000); }); }
        }
        var pageRes = { tex: '', figs: [], notes: '', err: r && r.err };
        if(r && !r.err){
          var t = String(r.tex || ''), figs = [];
          for(var f = 0; f < (r.figures || []).length; f++){
            var fg = r.figures[f], src = fg.img === 1 && pages[i + 1] ? pages[i + 1].canvas : pages[i].canvas;
            var name = 'p' + (i + 1) + '_' + fg.id;
            var cnv = cropFigure(src, fg.box);
            figs.push({ id: fg.id, name: name, canvas: cnv, url: cnv.toDataURL('image/png') });
            t = t.split('{' + fg.id + '}').join('{' + name + '}');
          }
          pageRes = { tex: t, figs: figs, notes: r.notes || '' };
          part = lastPart(t) || part;
        }
        out[i] = pageRes; setResults(out.slice());
        setTex(out.map(function(x, k){ return x && x.tex ? '% ===== Trang ' + (k + 1) + ' =====\n' + x.tex : ''; }).filter(Boolean).join('\n\n'));
      }
      setBusy('');
    }
    async function use(){
      if(!tex.trim()) return;
      setBusy('Đang chuẩn bị file…');
      var used = figAll.filter(function(f){ return tex.indexOf('{' + f.name + '}') > -1; });
      var imgFiles = [];
      for(var i = 0; i < used.length; i++) imgFiles.push(await canvasToFile(used[i].canvas, used[i].name + '.png'));
      var base = (files[0] ? files[0].name.replace(/\.[^.]+$/, '') : 'de-ai') + '_AI';
      var texFile = new File(['% Nhập bằng AI từ: ' + files.map(function(f){ return f.name; }).join(', ') + ' — ' + new Date().toLocaleString('vi-VN') + '\n' + tex], base + '.tex', { type: 'text/plain' });
      setBusy('');
      props.onDone({ texFile: texFile, imgFiles: imgFiles, title: files[0] ? files[0].name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') : '' });
    }
    function download(){
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([tex], { type: 'text/plain' })); a.download = (files[0] ? files[0].name.replace(/\.[^.]+$/, '') : 'de') + '_AI.tex'; a.click();
    }
    var nQ = (tex.match(/\\begin\{ex\}/g) || []).length, noKey = (tex.match(/CHUA_CO_DAP_AN/g) || []).length;
    var done = results.filter(function(r){ return r && !r.err; }).length, errs = results.filter(function(r){ return r && r.err; }).length;
    return h('div', { className: 'sm-overlay', style: { zIndex: 1300 }, onClick: function(e){ if(e.target === e.currentTarget && !busy) props.onClose(); } },
      h('div', { className: 'sm-modal', style: { maxWidth: '1100px', width: '100%' } },
        h('div', { className: 'sm-modal-head' }, h('h3', null, '✨ Nhập đề từ PDF / ảnh bằng AI'), h('button', { type: 'button', className: 'sm-modal-close', disabled: !!busy && !/AI đang/.test(busy), onClick: function(){ stopRef.current = true; props.onClose(); } }, '✕')),
        h('p', { className: 'sm-sub', style: { margin: '0 0 10px' } }, 'Chọn file PDF đề (hoặc nhiều ảnh chụp từng trang). AI chép từng trang sang .tex đúng mẫu \\begin{ex}…\\choice / \\choiceTF / \\shortans…\\loigiai, tự cắt hình vẽ. Thầy xem lại, sửa trực tiếp, rồi bấm "Dùng kết quả này" để đưa vào form nạp đề như thường.'),
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' } },
          h('label', { className: 'btn btn-primary', style: { cursor: 'pointer' } }, files.length ? '📄 Chọn file khác' : '📄 Chọn PDF / ảnh đề', h('input', { type: 'file', multiple: true, accept: 'application/pdf,image/*', style: { display: 'none' }, onChange: onPick, disabled: !!busy })),
          pages ? h('span', { style: { fontSize: '0.86rem' } }, pages.length + ' trang · ' + files.map(function(f){ return f.name; }).join(', ')) : null,
          pages ? h('input', { value: extra, onChange: function(e){ setExtra(e.target.value); }, placeholder: 'Ghi chú cho AI (vd: đáp án ở trang cuối; chủ đề Khí lí tưởng)', style: { flex: '1 1 260px' } }) : null,
          pages && !busy ? h('button', { type: 'button', className: 'btn btn-primary', onClick: function(){ run(0); } }, results.length ? '↻ Chép lại tất cả' : '🤖 AI chép ' + pages.length + ' trang') : null,
          (pages && !busy && errs) ? h('button', { type: 'button', className: 'btn btn-secondary', onClick: function(){ var k = results.findIndex(function(r){ return r && r.err; }); run(k < 0 ? 0 : k); } }, '↻ Chép lại từ trang lỗi') : null,
          busy && /AI đang|giới hạn/.test(busy) ? h('button', { type: 'button', className: 'btn btn-secondary', onClick: function(){ stopRef.current = true; } }, '⏹ Dừng') : null),
        busy ? h('div', { className: 'banner info', style: { margin: '10px 0' } }, h('span', null, '⏳'), h('div', null, busy)) : null,
        pages ? h('div', { style: { display: 'flex', gap: '6px', overflowX: 'auto', margin: '10px 0', paddingBottom: '4px' } },
          pages.map(function(p, i){ var r = results[i];
            return h('div', { key: i, style: { flex: 'none', width: '84px', textAlign: 'center', fontSize: '0.7rem' } },
              h('img', { src: p.canvas.toDataURL('image/jpeg', 0.5), alt: '', style: { width: '84px', border: '2px solid ' + (r ? (r.err ? 'var(--critical)' : 'var(--good)') : 'var(--line)'), borderRadius: '6px' } }),
              h('div', null, 'Trang ' + (i + 1) + (r ? (r.err ? ' ✗' : ' ✓') : '')));
          })) : null,
        results.some(function(r){ return r && (r.err || r.notes); }) ? h('div', { style: { fontSize: '0.8rem', margin: '0 0 8px' } }, results.map(function(r, i){ return r && (r.err || r.notes) ? h('div', { key: i, style: { color: r.err ? 'var(--critical)' : 'var(--ink-2)' } }, 'Trang ' + (i + 1) + ': ' + (r.err ? 'lỗi — ' + r.err : '📝 ' + r.notes)) : null; })) : null,
        tex ? h('div', { style: { display: 'grid', gridTemplateColumns: figAll.length ? 'minmax(0,2fr) minmax(0,1fr)' : '1fr', gap: '12px' } },
          h('div', null,
            h('div', { style: { fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px' } }, '📄 .tex (' + nQ + ' câu · ' + done + '/' + pages.length + ' trang' + (noKey ? ' · ⚠ ' + noKey + ' câu chưa có đáp án — tìm "CHUA_CO_DAP_AN" để thêm \\True' : '') + ')'),
            h('textarea', { value: tex, onChange: function(e){ setTex(e.target.value); }, spellCheck: false, style: { width: '100%', boxSizing: 'border-box', height: '380px', fontFamily: '"IBM Plex Mono",monospace', fontSize: '0.8rem', lineHeight: 1.5, padding: '8px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)' } })),
          figAll.length ? h('div', null,
            h('div', { style: { fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px' } }, '🖼 Hình đã cắt (' + figAll.length + ')'),
            h('div', { style: { maxHeight: '380px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' } },
              figAll.map(function(f){ var used = tex.indexOf('{' + f.name + '}') > -1;
                return h('div', { key: f.name, style: { border: '1px solid var(--line)', borderRadius: '8px', padding: '6px', opacity: used ? 1 : 0.5 } },
                  h('img', { src: f.url, alt: f.name, style: { maxWidth: '100%', maxHeight: '160px', display: 'block', margin: '0 auto', background: '#fff' } }),
                  h('div', { style: { fontSize: '0.72rem', textAlign: 'center', marginTop: '3px' } }, f.name + (used ? '' : ' (không dùng)')));
              }))) : null) : null,
        h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px', flexWrap: 'wrap' } },
          tex ? h('button', { type: 'button', className: 'btn btn-secondary', onClick: download }, '⬇ Tải .tex về máy (lưu bản gốc)') : null,
          h('button', { type: 'button', className: 'btn btn-secondary', disabled: !!busy, onClick: props.onClose }, 'Huỷ'),
          h('button', { type: 'button', className: 'btn btn-primary', disabled: !tex.trim() || !!busy, onClick: use }, '✓ Dùng kết quả này'))));
  }
  window.OPC_AIIMPORT = { Modal: AiImportModal, _cropFigure: cropFigure };
})(window);
