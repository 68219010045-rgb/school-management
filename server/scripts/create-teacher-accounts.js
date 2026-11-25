/**
 * สร้างบัญชีครูจากตาราง teachers เฉพาะสถานะ "ปฏิบัติงาน"
 *   npm run accounts:teachers
 * อีเมล = <รหัสครู>@school.example.com · รหัสผ่านสุ่ม เขียนลง server/.teacher-credentials.txt (ห้าม commit)
 * รันซ้ำได้: ครูที่มีบัญชีแล้วจะถูกข้าม ไม่รีเซ็ตรหัสผ่าน
 * 🔒 ชื่อครูใช้ตั้ง display_name เท่านั้น ไม่พิมพ์ออกหน้าจอ
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../src/config');
const { getAdmin } = require('../src/supabase');

const missing = config.missingEnv();
if (missing.length) { console.error(`ยังไม่ได้ตั้งค่า ${missing.join(', ')} ใน server/.env`); process.exit(1); }

const sb = getAdmin();
const FILE = path.join(__dirname, '..', '.teacher-credentials.txt');
const randomPassword = () => crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, 'x') + '#7a';
const must = ({ data, error }) => { if (error) throw error; return data; };

(async () => {
  const teachers = must(await sb.from('teachers').select('teacher_id, full_name').eq('status', 'ปฏิบัติงาน').order('teacher_id'));
  const profiles = must(await sb.from('profiles').select('teacher_id').eq('role', 'teacher'));
  const users = must(await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })).users;
  const linked = new Set(profiles.map((p) => p.teacher_id));

  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, 'บัญชีครู (ไฟล์นี้อยู่ใน .gitignore — อย่า commit)\n\n');
  let created = 0;
  let skipped = 0;
  for (const t of teachers) {
    if (linked.has(t.teacher_id)) { skipped += 1; continue; }
    const email = `${t.teacher_id.toLowerCase()}@school.example.com`;
    const password = randomPassword();
    const existing = users.find((u) => u.email === email);
    const { user } = must(existing
      ? await sb.auth.admin.updateUserById(existing.id, { password, email_confirm: true })
      : await sb.auth.admin.createUser({ email, password, email_confirm: true }));
    must(await sb.from('profiles').upsert({ id: user.id, email, display_name: t.full_name, role: 'teacher', teacher_id: t.teacher_id }));
    fs.appendFileSync(FILE, `${t.teacher_id}  ${email}   รหัสผ่าน: ${password}\n`); // เขียนทันที กันรหัสหายถ้าล้มกลางทาง
    created += 1;
  }
  console.log(`✓ สร้างบัญชีครู ${created} บัญชี · ข้ามที่มีแล้ว ${skipped} · รหัสผ่านอยู่ใน ${FILE}`);
})().catch((e) => { console.error('ล้มเหลว:', e.message || e); process.exit(1); });
