/**
 * theme-toggle.js — THÊM 17/10/2026: nút đổi giao diện SÁNG / TỐI (trang chủ + trang học sinh + admin).
 *  • Mặc định theo hệ điều hành (điện thoại/máy tính đang để sáng hay tối). Bấm nút 🌙/☀️ để chọn tay; lựa chọn được nhớ
 *    trên máy đó (localStorage "opc-theme"). Giữ phím / nhấn giữ nút ~0,6 giây để quay lại "theo hệ thống".
 *  • Bảng màu đã có sẵn trong CSS (:root[data-theme="dark"] / [data-theme="light"]); file này chỉ đặt thuộc tính data-theme.
 *  • Đoạn script nhỏ trong <head> của mỗi trang đặt data-theme TRƯỚC khi vẽ trang (không bị nháy màu).
 *  Mọi nút có thuộc tính data-theme-toggle đều dùng được.
 */
(function(window, document){
  'use strict';
  var KEY = 'opc-theme', root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function stored(){ try{ var t = localStorage.getItem(KEY); return (t === 'light' || t === 'dark') ? t : null; }catch(e){ return null; } }
  function effective(){ var a = root.getAttribute('data-theme'); if(a === 'light' || a === 'dark') return a; return mq && mq.matches ? 'dark' : 'light'; }
  function paint(){
    var cur = effective(), manual = !!stored();
    document.querySelectorAll('[data-theme-toggle]').forEach(function(b){
      b.textContent = cur === 'dark' ? '☀️' : '🌙';
      b.title = (cur === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối') + (manual ? ' · nhấn giữ để quay lại theo hệ thống' : ' · đang theo hệ thống');
      b.setAttribute('aria-label', b.title);
      b.setAttribute('aria-pressed', cur === 'dark' ? 'true' : 'false');
    });
    // màu thanh trạng thái trình duyệt điện thoại
    var bg = getComputedStyle(document.body || root).backgroundColor;
    document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){ if(bg) m.setAttribute('content', bg); });
    try{ window.dispatchEvent(new CustomEvent('opc-theme-change', { detail: { theme: cur } })); }catch(e){}
  }
  function set(t){
    if(t === 'light' || t === 'dark'){ root.setAttribute('data-theme', t); try{ localStorage.setItem(KEY, t); }catch(e){} }
    else { root.removeAttribute('data-theme'); try{ localStorage.removeItem(KEY); }catch(e){} }
    paint();
  }
  function toggle(){ set(effective() === 'dark' ? 'light' : 'dark'); }

  var STYLE = '.theme-btn{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;' +
    'border:1px solid var(--line,#dde1d5);background:var(--surface,#fff);color:var(--ink,#12161c);font-size:1.05rem;line-height:1;cursor:pointer;' +
    'flex:none;padding:0;touch-action:manipulation;transition:transform .15s;}' +
    '.theme-btn:hover{transform:rotate(-12deg);}' +
    '.theme-btn.on-navy{border-color:var(--navy-line,#2c3542);background:var(--navy-2,#1a212c);color:var(--on-navy,#f3f4ee);}';
  function init(){
    if(!document.getElementById('theme-btn-style')){ var s = document.createElement('style'); s.id = 'theme-btn-style'; s.textContent = STYLE; document.head.appendChild(s); }
    var timer = null, longPressed = false;
    document.addEventListener('pointerdown', function(e){
      var b = e.target.closest && e.target.closest('[data-theme-toggle]'); if(!b) return;
      longPressed = false;
      timer = setTimeout(function(){ longPressed = true; set(null); }, 600);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function(ev){ document.addEventListener(ev, function(){ if(timer){ clearTimeout(timer); timer = null; } }, true); });
    document.addEventListener('click', function(e){
      var b = e.target.closest && e.target.closest('[data-theme-toggle]'); if(!b) return;
      e.preventDefault();
      if(longPressed){ longPressed = false; return; }
      toggle();
    });
    if(mq){ var onSys = function(){ if(!stored()) paint(); }; if(mq.addEventListener) mq.addEventListener('change', onSys); else if(mq.addListener) mq.addListener(onSys); }
    paint();
  }
  window.OPC_THEME = { set: set, toggle: toggle, get: effective };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window, document);
