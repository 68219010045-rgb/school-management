/**
 * สร้างบัญชีทดสอบ 2 บทบาท (ผู้ดูแล · ผู้บริหาร) และลบบัญชีบทบาทเก่า (กรรมการ · ผู้ชม) ถ้ายังมี
 * รัน: npm run seed
 * ข้อมูลโรงเรียนนำเข้าด้วย: npm run import:handoff
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../src/config');
const { getAdmin } = require('../src/supabase');

const missing = config.missingEnv();
if (missing.length) {
  console.error(`ยังไม่ได้ตั้งค่า ${missing.join(', ')} ใน server/.env`);
  process.exit(1);
}
const sb = getAdmin();
const randomPassword = () => crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, 'x') + '#7a';

(async () => {
  const { error: tErr } = await sb.from('profiles').select('id', { head: true, count: 'exact' });
  if (tErr) {
    console.error('ไม่พบตาราง profiles — กรุณารัน server/sql/schema.sql ใน Supabase SQL Editor ก่อน');
    console.error('รายละเอียด:', tErr.message);
    process.exit(1);
  }

  const accounts = [
    { email: 'admin@school.example.com', name: 'ผู้ดูแลระบบ (ทดสอบ)', role: 'admin', env: 'SEED_ADMIN_PASSWORD' },
    { email: 'executive@school.example.com', name: 'ผู้บริหาร (ทดสอบ)', role: 'executive', env: 'SEED_EXECUTIVE_PASSWORD' },
  ];
  const { data: list, error: lErr } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (lErr) throw lErr;

  // ลบบัญชีทดสอบของบทบาทที่ยกเลิกแล้ว (profiles ถูกลบตามด้วย on delete cascade)
  for (const email of ['committee@school.example.com', 'viewer@school.example.com']) {
    const old = list.users.find((u) => u.email === email);
    if (old) { const { error } = await sb.auth.admin.deleteUser(old.id); if (error) throw error; console.log('• ลบบัญชีบทบาทเก่า ' + email); }
  }

  const lines = ['บัญชีทดสอบ (ไฟล์นี้อยู่ใน .gitignore — อย่า commit)', ''];
  for (const a of accounts) {
    const password = process.env[a.env] || randomPassword();
    const existing = list.users.find((u) => u.email === a.email);
    let id;
    if (existing) {
      const { error } = await sb.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
      if (error) throw error;
      id = existing.id;
    } else {
      const { data, error } = await sb.auth.admin.createUser({ email: a.email, password, email_confirm: true });
      if (error) throw error;
      id = data.user.id;
    }
    const { error: pErr } = await sb.from('profiles').upsert({ id, email: a.email, display_name: a.name, role: a.role });
    if (pErr) throw pErr;
    lines.push(`${a.role.padEnd(10)} ${a.email}   รหัสผ่าน: ${password}`);
  }
  const file = path.join(__dirname, '..', '.seed-credentials.txt');
  fs.writeFileSync(file, lines.join('\n') + '\n');
  console.log(`✓ สร้างบัญชีทดสอบ 2 บทบาทแล้ว — ดูอีเมล/รหัสผ่านใน ${file}`);
})().catch((e) => { console.error('Seed ล้มเหลว:', e.message || e); process.exit(1); });
