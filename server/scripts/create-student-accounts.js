/**
 * สร้างบัญชีนักเรียนจากตาราง students เฉพาะสถานะ "กำลังศึกษา"
 *   npm run accounts:students
 * อีเมล = <รหัสนักเรียน>@school.example.com · รหัสผ่านสุ่ม เขียนลง server/.student-credentials.txt (ห้าม commit)
 * รันซ้ำได้: นักเรียนที่มีบัญชีแล้วจะถูกข้าม ไม่รีเซ็ตรหัสผ่าน
 * 🔒 ชื่อนักเรียนใช้ตั้ง display_name เท่านั้น ไม่พิมพ์ออกหน้าจอ
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../src/config');
const { getAdmin } = require('../src/supabase');

const missing = config.missingEnv();
if (missing.length) { console.error(`ยังไม่ได้ตั้งค่า ${missing.join(', ')} ใน server/.env`); process.exit(1); }

const sb = getAdmin();
const FILE = path.join(__dirname, '..', '.student-credentials.txt');
const randomPassword = () => crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, 'x') + '#7a';
const must = ({ data, error }) => { if (error) throw error; return data; };

async function allUsers() {
  const out = [];
  for (let page = 1; ; page += 1) {
    const { users } = must(await sb.auth.admin.listUsers({ page, perPage: 1000 }));
    out.push(...users);
    if (users.length < 1000) return out;
  }
}

(async () => {
  const students = must(await sb.from('students').select('student_id, full_name').eq('status', 'กำลังศึกษา').order('student_id'));
  const linked = new Set(must(await sb.from('profiles').select('student_id').eq('role', 'student')).map((p) => p.student_id));
  const byEmail = new Map((await allUsers()).map((u) => [u.email, u]));

  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, 'บัญชีนักเรียน (ไฟล์นี้อยู่ใน .gitignore — อย่า commit)\n\n');
  let created = 0;
  let skipped = 0;
  for (const s of students) {
    if (linked.has(s.student_id)) { skipped += 1; continue; }
    const email = `${s.student_id.toLowerCase()}@school.example.com`;
    const password = randomPassword();
    const existing = byEmail.get(email);
    const { user } = must(existing
      ? await sb.auth.admin.updateUserById(existing.id, { password, email_confirm: true })
      : await sb.auth.admin.createUser({ email, password, email_confirm: true }));
    must(await sb.from('profiles').upsert({ id: user.id, email, display_name: s.full_name, role: 'student', student_id: s.student_id }));
    fs.appendFileSync(FILE, `${s.student_id}  ${email}   รหัสผ่าน: ${password}\n`); // เขียนทันที กันรหัสหายถ้าล้มกลางทาง
    created += 1;
    if (created % 50 === 0) console.log(`… ${created}`);
  }
  console.log(`✓ สร้างบัญชีนักเรียน ${created} บัญชี · ข้ามที่มีแล้ว ${skipped} · รหัสผ่านอยู่ใน ${FILE}`);
})().catch((e) => { console.error('ล้มเหลว (รันซ้ำได้ จะทำต่อจากที่ค้าง):', e.message || e); process.exit(1); });
