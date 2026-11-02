// Logic THUẦN (không phụ thuộc Firebase) của cổng thanh toán tự động — để kiểm thử được.
// Quy ước dữ liệu (do admin-ops.js ghi, xem BillingPanel):
//   students/{id}.payCode = "FDY" + 5 ký tự chữ/số in hoa   → mã đặt trong NỘI DUNG chuyển khoản
//   students/{id}.billing.pay = { amount, months, cycle, fixedUntil? } → số tiền & kỳ đóng KỲ TỚI (admin tự cập nhật theo bảng giá)
//   students/{id}.billing.credit = số tiền dư/đóng thiếu chưa đủ 1 kỳ (cộng dồn vào lần chuyển sau)

export var CODE_PREFIX = 'FDY';

export function vnToday(nowMs){ return new Date((nowMs == null ? Date.now() : nowMs) + 7 * 3600 * 1000).toISOString().slice(0, 10); }
function parseYmd(s){ var p = String(s).slice(0, 10).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
export function addMonths(s, n){
  var d = parseYmd(s), day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + n);
  if(d.getUTCDate() < day) d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

// Tìm mã học sinh trong giao dịch: ưu tiên trường "code" SePay đã tách, sau đó quét nội dung chuyển khoản.
export function extractCode(body){
  var re = new RegExp(CODE_PREFIX + '[A-Z0-9]{5}', 'i');
  var cands = [body && body.code, body && body.content, body && body.description];
  for(var i = 0; i < cands.length; i++){
    var t = String(cands[i] == null ? '' : cands[i]).toUpperCase();
    var m = t.match(re) || t.replace(/[^A-Z0-9]/g, '').match(re);   // ngân hàng đôi khi chèn dấu cách / ký tự lạ
    if(m) return m[0].toUpperCase();
  }
  return '';
}

// Tính kết quả khi nhận `amount` đồng cho học sinh có `billing`. Không ghi gì cả.
export function planPayment(billing, amount, today){
  var b = billing || {}, pay = b.pay;
  amount = Math.round(Number(amount) || 0);
  if(!pay || !(Number(pay.amount) > 0)) return { status: 'needs_setup' };
  var per = Number(pay.amount), credit = Math.max(0, Number(b.credit) || 0), total = amount + credit, TOL = 1000;
  var n = Math.floor((total + TOL) / per);
  if(n < 1) return { status: 'partial', credit: total };
  if(pay.cycle === 'full') n = 1;
  n = Math.min(n, 12);
  var months = pay.cycle === 'full' ? null : (Number(pay.months) || 1) * n;
  var from = (b.paidUntil && String(b.paidUntil).slice(0, 10) >= today) ? String(b.paidUntil).slice(0, 10) : today;
  var until = pay.cycle === 'full' ? (pay.fixedUntil || addMonths(from, 12)) : addMonths(from, months);
  return { status: 'applied', periods: n, months: months, cycle: pay.cycle || 'month', until: until, leftover: Math.max(0, total - n * per) };
}

export function safeEqual(a, b){
  a = String(a || ''); b = String(b || '');
  if(a.length !== b.length) return false;
  var r = 0; for(var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
