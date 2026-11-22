require('dotenv').config();

// ตัดช่องว่าง/บรรทัดใหม่ที่อาจติดมากับค่าตัวแปร (เช่น ตอนตั้งค่าผ่านแดชบอร์ดหรือ CLI ของ Vercel)
const env = (k) => (process.env[k] || '').trim();

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];

function missingEnv() {
  return required.filter((k) => !env(k) || env(k).startsWith('your-'));
}

module.exports = {
  port: Number(process.env.PORT) || 4000,
  corsOrigin: env('CORS_ORIGIN') || 'http://localhost:3000',
  // ตัด path ส่วนเกินที่มักติดมาตอนคัดลอก (เช่น /rest/v1/) ให้เหลือแค่ https://xxxx.supabase.co
  supabaseUrl: env('SUPABASE_URL').replace(/^(https?:\/\/[^/]+).*$/i, '$1'),
  anonKey: env('SUPABASE_ANON_KEY'),
  serviceKey: env('SUPABASE_SERVICE_ROLE_KEY'), // ความลับ: ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น
  missingEnv,
};
