/**
 * นำเข้าแพ็ก handoff (จากฝั่งข้อมูล) เข้า Supabase
 *   npm run import:handoff               ← อ่านจาก ../../handoff (หรือตั้ง HANDOFF_DIR)
 *
 * - รัน server/sql/schema.sql ก่อน
 * - 🔒 students/teachers มีข้อมูลส่วนบุคคล (สมมติ): สคริปต์นี้ "ไม่พิมพ์เนื้อหารายแถว" ออกหน้าจอ แสดงแค่จำนวนแถว
 * - ไม่นำเข้าโฟลเดอร์ evidence/ (มีชื่อ/เบอร์โทรของแถวที่ถูกคัดออก และเว็บไม่มีหน้าหลักฐานแล้ว)
 * - ตรวจจำนวนแถวก่อน–หลังนำเข้า แล้วบันทึกลง import_log (กระทบยอด — B2.2 / Y3.5)
 */
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { getAdmin } = require('../src/supabase');
const { parseCsv } = require('../src/csv');

const missing = config.missingEnv();
if (missing.length) { console.error(`ยังไม่ได้ตั้งค่า ${missing.join(', ')} ใน server/.env`); process.exit(1); }

const DIR = process.env.HANDOFF_DIR || path.resolve(__dirname, '..', '..', '..', 'handoff');
const sb = getAdmin();
const nz = (v) => (v === '' || v === undefined ? null : v);

function load(rel, mapRow) {
  const file = path.join(DIR, rel);
  if (!fs.existsSync(file)) throw new Error(`ไม่พบไฟล์ ${rel} ใน ${DIR}`);
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  return rows.map((r) => {
    const o = {};
    for (const [k, v] of Object.entries(r)) o[k] = nz(v);
    return mapRow ? mapRow(o) : o;
  });
}

// ลำดับตามคีย์นอก (ล้างย้อนกลับ)
const PLAN = [
  { table: 'departments', file: 'data/departments.csv', pk: 'dept_id' },
  { table: 'academic_terms', file: 'data/academic_terms.csv', pk: 'term_id' },
  { table: 'teachers', file: 'data/teachers.csv', pk: 'teacher_id' },
  { table: 'subjects', file: 'data/subjects.csv', pk: 'subject_code' },
  { table: 'classrooms', file: 'data/classrooms.csv', pk: 'room_id' },
  { table: 'students', file: 'data/students.csv', pk: 'student_id' },
  { table: 'schedules', file: 'data/schedules.csv', pk: 'schedule_id' },
  { table: 'enrollments', file: 'data/enrollments.csv', pk: 'enrollment_id' },
  { table: 'attendance_weekly', file: 'data/attendance_weekly.csv', pk: 'record_id' },
  { table: 'maintenance_requests', file: 'data/maintenance_requests.csv', pk: 'request_id' },
  { table: 'data_meta', file: 'data/data_meta.csv', pk: 'table_name' },
  { table: 'at_risk', file: 'outputs/at_risk_1_2569.csv', pk: 'student_id' },
];

async function insertBatches(table, rows) {
  const SIZE = 1000;
  for (let i = 0; i < rows.length; i += SIZE) {
    const { error } = await sb.from(table).insert(rows.slice(i, i + SIZE));
    if (error) throw new Error(`${table} (แถว ${i + 1}–${Math.min(i + SIZE, rows.length)}): ${error.message}${error.details ? ' — ' + String(error.details).slice(0, 120) : ''}`);
  }
}

async function wipe() {
  for (const step of [...PLAN].reverse()) {
    const { error } = await sb.from(step.table).delete().not(step.pk, 'is', null);
    if (error) throw new Error(`ล้าง ${step.table}: ${error.message}`);
  }
  for (const t of ['import_log', 'tasks', 'change_log']) {
    const { error } = await sb.from(t).delete().gte('id', 0);
    if (error) throw new Error(`ล้าง ${t}: ${error.message}`);
  }
}

// งานที่ควรทำ — จาก docs/findings.md (A7-2) ร่างโดย AI รอฝั่งข้อมูลตรวจตัวเลข
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const TASKS = [
  { finding: 'นักเรียนเสี่ยงสูง 37 คนยังกำลังศึกษาอยู่ (เฝ้าระวังอีก 38 คน) และ 11 คนมาเรียนแย่ลงในภาคปัจจุบัน',
    action: 'ส่งรายชื่อ (รหัส) ให้ครูที่ปรึกษาภายใน 1 สัปดาห์ เริ่มที่ 11 คนที่แย่ลง และติดตามการมาเรียนรายสัปดาห์',
    owner: 'ครูที่ปรึกษา · งานแนะแนว', priority: 'สูง', due_date: day(7),
    evidence: 'at_risk_1_2569.csv · มาเรียน < 70% 29 คน · GPA < 1.50 15 คน · เกรด 0 ≥ 2 วิชา 7 คน',
    impact: 'ถ้าไม่ช่วย มีแนวโน้มลาออกหรือตก (การมาเรียนสัมพันธ์กับ GPA r = 0.51)' },
  { finding: 'งานซ่อมค้างเกิน 90 วัน 23 งาน ความเร่งด่วนสูง 5 งาน (เก่าสุด 296 วัน) และห้อง R124 ค้าง 3 งาน',
    action: 'ปิด 5 งานด่วนสูงก่อน ตรวจ R124 ทั้งห้อง และตั้งเป้าปิดงานด่วนสูงภายใน 30 วัน',
    owner: 'งานอาคารสถานที่', priority: 'สูง', due_date: day(30),
    evidence: 'KPI 6 · maintenance_requests · นับถึง 2026-08-04', impact: 'ห้องเรียน/อุปกรณ์ใช้ไม่ได้ และความปลอดภัย (ไฟฟ้า)' },
  { finding: 'รุ่น 2024 ลาออก 24.5% (1 ใน 4) ทั้งที่ยังเรียนไม่จบ สูงกว่ารุ่นที่จบแล้วใน 5 จาก 6 แผนก (ช่างยนต์ 35%)',
    action: 'สัมภาษณ์/สำรวจเหตุผลการลาออกของรุ่น 2024 และติดตามรุ่น 2025 ที่กำลังจะถึงปีเดียวกัน',
    owner: 'รองฝ่ายวิชาการ · หัวหน้าแผนก', priority: 'สูง', due_date: null,
    evidence: 'KPI 3 · กราฟ 2 · เทียบภายในรุ่น', impact: 'เสียนักเรียน งบประมาณรายหัว และชื่อเสียงวิทยาลัย' },
  { finding: 'ครู 3 คนสถานะย้าย/เกษียณ (T009, T019, T013) ยังมีตารางสอนเต็มรวมถึงภาคปัจจุบัน 2/2569 (95 คาบ/สัปดาห์) และภาระสอนไม่ตรงทะเบียนอีก 6 คน',
    action: 'ตรวจทันทีว่าใครสอนคาบเหล่านี้จริงในภาค 2/2569 แก้ระบบที่ผิด (สถานะครูหรือตารางสอน) และปรับ weekly_teach_hours ให้ตรงตารางสอน',
    owner: 'ฝ่ายบริหารงานบุคคล · งานตารางสอน', priority: 'สูง', due_date: day(3),
    evidence: 'KPI 5 · teachers (2026-06-15) × schedules (2026-11-10)', impact: 'ข้อมูล 2 ระบบขัดกัน ห้องเรียน 95 คาบ/สัปดาห์อาจไม่มีครูสอนจริง' },
  { finding: 'ห้องไม่สมดุล: ห้องเรียนทั่วไปใช้เฉลี่ย 32% (R113, R114 ไม่ใช้เลย) แต่ R102 และ R108 (จุ 26) มีกลุ่ม 28–29 คน 6 กลุ่ม',
    action: 'ย้าย SC5021, SC5020, SC5023, SC5001, SC5005 → R113 และ SC5007 → R103 (ตรวจพร้อมกันแล้วไม่ชน) แต่ต้องตรวจซ้ำกับตาราง 2/2569 ก่อนใช้จริง',
    owner: 'งานตารางสอน · งานอาคารสถานที่', priority: 'กลาง', due_date: null,
    evidence: 'KPI 4 · กราฟ 5', impact: 'นักเรียนแออัด ทรัพยากรไม่คุ้มค่า' },
  { finding: 'GPA ต่างกันตามแผนก: ช่างไฟฟ้ากำลัง 2.51 · ช่างยนต์ 2.59 · อิเล็กทรอนิกส์ 2.65 ต่ำกว่าการตลาด 3.00',
    action: 'หัวหน้าแผนกช่าง 3 แผนกทบทวนวิชาที่ตกบ่อยและวิธีวัดผล และดูว่าเกณฑ์ให้คะแนนต่างกันหรือไม่',
    owner: 'หัวหน้าแผนกช่าง', priority: 'กลาง', due_date: null,
    evidence: 'A5-2 Kruskal-Wallis p < 0.001 · ε² = 0.06', impact: 'แผนกช่างอุตสาหกรรมผลการเรียนต่ำกว่า' },
  { finding: 'การมาเรียนตกทุกสัปดาห์ที่ 9 ในทุกภาค (5/5) เหลือ 71–78% จากปกติ ~84%',
    action: 'ตรวจปฏิทินว่าตรงกับกิจกรรม/สอบกลางภาคหรือไม่ ถ้าไม่ใช่ให้ครูที่ปรึกษาเตือนล่วงหน้า',
    owner: 'งานทะเบียน · ฝ่ายวิชาการ', priority: 'กลาง', due_date: null,
    evidence: 'A6-2 · กราฟ 7 · z < −2 ทุกภาค', impact: 'การมาเรียนลดลง 6–13 จุด% ในสัปดาห์นั้น' },
  { finding: 'Simpson\'s paradox ของระยะทาง: ภาพรวมเหมือนอยู่ไกล GPA สูงกว่าเล็กน้อย แต่ในทุกแผนกอยู่ไกลกว่า GPA ต่ำกว่า',
    action: 'ใช้ระยะทางเป็นข้อมูลประกอบเมื่อครูที่ปรึกษาคุยกับนักเรียน ไม่ใช่เกณฑ์คัดกรอง (ผลเล็ก)',
    owner: 'ครูที่ปรึกษา', priority: 'ต่ำ', due_date: null,
    evidence: 'A5-3 · ถดถอยคุมแผนก −0.022 GPA/กม.', impact: 'ข้อสรุปจากภาพรวมจะผิดทาง' },
  { finding: 'คุณภาพข้อมูลต้นทาง: คะแนนว่างไม่สุ่ม สถานะงานซ่อมขัดกับวันปิด 16 แถว ความจุห้องว่าง 5 ห้อง ชื่อแผนก 19 แบบ ปี พ.ศ. ปน 31 แถว',
    action: 'บังคับรูปแบบในระบบกรอก (เลือกแผนก/เพศจากรายการ วันที่ ค.ศ.) กรอกวันปิดงานทุกครั้ง และกรอกความจุห้องให้ครบ',
    owner: 'งานทะเบียน · งานอาคาร · ผู้ดูแลระบบ', priority: 'กลาง', due_date: null,
    evidence: 'data_cleaning_report.md · A5-5 χ² p < 0.001', impact: 'ตัวเลขผิดถ้าไม่ทำความสะอาด และตรวจความจุไม่ได้ 23 กลุ่ม' },
];

(async () => {
  const { count } = await sb.from('departments').select('*', { count: 'exact', head: true });
  if (count === null) { console.error('ไม่พบตาราง — รัน server/sql/schema.sql ใน Supabase ก่อน'); process.exit(1); }
  if (count > 0) console.log('• พบข้อมูลเดิม — ล้างก่อนนำเข้าใหม่');
  await wipe(); // ล้างเสมอ (รวม tasks/change_log เก่าที่ไม่ถูกลบตอนรัน schema ใหม่) เพื่อให้นำเข้าซ้ำได้ผลเหมือนเดิม

  console.log(`อ่านจาก ${DIR}`);
  const report = [];
  for (const step of PLAN) {
    const rows = load(step.file, step.map);
    await insertBatches(step.table, rows);
    const { count: after, error } = await sb.from(step.table).select('*', { count: 'exact', head: true });
    if (error) throw new Error(`นับ ${step.table}: ${error.message}`);
    report.push({ table: step.table, source: rows.length, loaded: after });
    console.log(`  ${step.table.padEnd(22)} ต้นทาง ${String(rows.length).padStart(6)}  →  ในฐานข้อมูล ${String(after).padStart(6)} ${rows.length === after ? '✓' : '✗ ไม่ตรง'}`);
  }

  await insertBatches('import_log', report.map((r) => ({ table_name: r.table, rows_source: r.source, rows_loaded: r.loaded })));
  await insertBatches('tasks', TASKS.map((t) => ({ status: 'ยังไม่เริ่ม', ...t })));
  console.log(`✓ งานที่ควรทำ ${TASKS.length} งาน (จาก findings.md)`);

  const bad = report.filter((r) => r.source !== r.loaded);
  if (bad.length) { console.error('จำนวนแถวไม่ตรง:', bad.map((b) => b.table).join(', ')); process.exit(1); }
  console.log('นำเข้าเสร็จ ✔ จำนวนแถวตรงทุกตาราง');
})().catch((e) => { console.error('นำเข้าล้มเหลว:', e.message); process.exit(1); });
