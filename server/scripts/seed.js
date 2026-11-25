/**
 * สร้างบัญชีทดสอบ 4 บทบาท (ผู้ดูแล · ผู้บริหาร · ครู · นักเรียน) และลบบัญชีบทบาทเก่า (กรรมการ · ผู้ชม) ถ้ายังมี
 * รัน: npm run seed
 * สร้างเฉพาะบางบทบาทโดยไม่รีเซ็ตรหัสผ่านบัญชีอื่น: npm run seed -- --only=teacher,student
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

  const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
  const all = [
    { email: 'admin@school.example.com', name: 'ผู้ดูแลระบบ (ทดสอบ)', role: 'admin', env: 'SEED_ADMIN_PASSWORD' },
    { email: 'executive@school.example.com', name: 'ผู้บริหาร (ทดสอบ)', role: 'executive', env: 'SEED_EXECUTIVE_PASSWORD' },
    { email: 'teacher@school.example.com', name: 'ครู (ทดสอบ)', role: 'teacher', env: 'SEED_TEACHER_PASSWORD', link: { teacher_id: 'T009' } },
    { email: 'student@school.example.com', name: 'นักเรียน (ทดสอบ)', role: 'student', env: 'SEED_STUDENT_PASSWORD', link: { student_id: 'S68003' } },
  ];
  const accounts = only.length ? all.filter((a) => only.includes(a.role)) : all;
  if (!accounts.length) throw new Error('ไม่รู้จักบทบาทใน --only (ใช้ได้: admin, executive, teacher, student)');
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
    const { error: pErr } = await sb.from('profiles').upsert({ id, email: a.email, display_name: a.name, role: a.role, ...a.link });
    if (pErr) throw pErr;
    lines.push(`${a.role.padEnd(10)} ${a.email}   รหัสผ่าน: ${password}`);
  }
  const file = path.join(__dirname, '..', '.seed-credentials.txt');
  // เก็บบรรทัดของบัญชีที่ไม่ได้สร้างรอบนี้ไว้ (กรณีใช้ --only)
  if (only.length && fs.existsSync(file)) {
    const done = new Set(accounts.map((a) => a.email));
    const kept = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.includes('@') && !done.has(l.trim().split(/\s+/)[1]));
    lines.splice(2, 0, ...kept);
  }
  fs.writeFileSync(file, lines.join('\n') + '\n');
  console.log(`✓ สร้างบัญชีทดสอบ ${accounts.length} บัญชีแล้ว — ดูอีเมล/รหัสผ่านใน ${file}`);
})().catch((e) => { console.error('Seed ล้มเหลว:', e.message || e); process.exit(1); });
