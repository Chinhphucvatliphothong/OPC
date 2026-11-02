// Khởi tạo Firebase Admin cho các Vercel Function cần GHI Firestore phía máy chủ (hiện dùng cho api/sepay-webhook.js).
// Dùng CHUNG biến môi trường FIREBASE_SERVICE_ACCOUNT_JSON đã có sẵn trên Vercel (api/student-login.js cũng dùng nó) — không cần cấu hình thêm.
// (Vẫn nhận tên cũ FIREBASE_SERVICE_ACCOUNT; giá trị là JSON dán nguyên, hoặc mã base64 của JSON.)
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function loadCredentials(){
  var raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
  if(!raw) throw new Error('Thiếu biến môi trường FIREBASE_SERVICE_ACCOUNT_JSON.');
  var json;
  try{ json = JSON.parse(raw); }
  catch(e){ json = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')); }
  if(json.private_key) json.private_key = String(json.private_key).replace(/\\n/g, '\n');
  return json;
}

export function getDb(){
  if(!getApps().length) initializeApp({ credential: cert(loadCredentials()) });
  return getFirestore();
}
export { FieldValue };
