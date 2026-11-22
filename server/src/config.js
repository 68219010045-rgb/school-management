require('dotenv').config();

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];

function missingEnv() {
  return required.filter((k) => !process.env[k] || process.env[k].startsWith('your-'));
}

module.exports = {
  port: Number(process.env.PORT) || 4000,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  // ตัด path ส่วนเกินที่มักติดมาตอนคัดลอก (เช่น /rest/v1/) ให้เหลือแค่ https://xxxx.supabase.co
  supabaseUrl: (process.env.SUPABASE_URL || '').trim().replace(/^(https?:\/\/[^/]+).*$/i, '$1'),
  anonKey: process.env.SUPABASE_ANON_KEY,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY, // ความลับ: ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น
  missingEnv,
};
