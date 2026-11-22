const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

// client สิทธิ์สูง (service_role) — ห้ามส่งไปเบราว์เซอร์เด็ดขาด
let admin;
function getAdmin() {
  if (!admin) admin = createClient(config.supabaseUrl, config.serviceKey, opts);
  return admin;
}

// client สำหรับล็อกอินด้วยรหัสผ่านเท่านั้น (anon key) สร้างใหม่ทุกครั้งเพื่อไม่ให้ session ปนกัน
function newAnonClient() {
  return createClient(config.supabaseUrl, config.anonKey, opts);
}

module.exports = { getAdmin, newAnonClient };
