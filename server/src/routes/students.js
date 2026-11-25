const express = require('express');
const { getAdmin } = require('../supabase');
const { requireRole, wrap } = require('../middleware');
const { logChange } = require('../changelog');
const {
  studentSchema, studentUpdateSchema, pageSchema, sanitizeSearch, LEVELS, STATUSES, GENDERS,
} = require('../validation');

const router = express.Router();

// ครูและนักเรียนใช้เส้นทางของตัวเอง (/api/teacher, /api/student) — ห้ามเข้ารายชื่อรวม
router.use(requireRole('admin', 'executive'));

// ความเป็นส่วนตัว (handoff X6): ชื่อ / เบอร์โทร / วันเกิด เห็นได้เฉพาะ admin
// ผู้บริหารเห็นรหัสนักเรียนและข้อมูลที่ไม่ระบุตัวตน
const PUBLIC_COLS = 'student_id, gender, level, admission_date, status, status_date, distance_km, dept_id, departments(dept_name_th)';
const ADMIN_COLS = `${PUBLIC_COLS}, full_name, birth_date, phone`;
const cols = (role) => (role === 'admin' ? ADMIN_COLS : PUBLIC_COLS);
const SORTABLE = ['student_id', 'level', 'status', 'admission_date', 'status_date'];
const ID_RE = /^S[0-9]{5}$/;

// GET /api/students — ค้นหา กรอง แบ่งหน้า เรียงลำดับ (B4.1)
router.get('/', wrap(async (req, res) => {
  const { page, pageSize } = pageSchema.parse(req.query);
  const from = (page - 1) * pageSize;
  const isAdmin = req.user.role === 'admin';
  const sort = SORTABLE.includes(req.query.sort) || (isAdmin && req.query.sort === 'full_name') ? req.query.sort : 'student_id';
  const asc = req.query.dir !== 'desc';

  let q = getAdmin().from('students').select(cols(req.user.role), { count: 'exact' })
    .order(sort, { ascending: asc }).order('student_id').range(from, from + pageSize - 1);

  const search = sanitizeSearch(req.query.q);
  if (search) q = q.or(isAdmin ? `student_id.ilike.%${search}%,full_name.ilike.%${search}%` : `student_id.ilike.%${search}%`);
  if (/^D[0-9]{2}$/.test(req.query.dept_id || '')) q = q.eq('dept_id', req.query.dept_id);
  if (LEVELS.includes(req.query.level)) q = q.eq('level', req.query.level);
  if (STATUSES.includes(req.query.status)) q = q.eq('status', req.query.status);
  if (GENDERS.includes(req.query.gender)) q = q.eq('gender', req.query.gender);

  const { data, count, error } = await q;
  if (error) throw error;
  res.json({ rows: data, total: count, page, pageSize });
}));

router.get('/:id', wrap(async (req, res) => {
  if (!ID_RE.test(req.params.id)) return res.status(404).json({ error: 'ไม่พบนักเรียน' });
  const { data, error } = await getAdmin().from('students').select(cols(req.user.role)).eq('student_id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'ไม่พบนักเรียน' });
  res.json(data);
}));

async function deptName(sb, deptId) {
  const { data } = await sb.from('departments').select('dept_name_th').eq('dept_id', deptId).maybeSingle();
  return data && data.dept_name_th;
}

// POST /api/students — เฉพาะ admin
router.post('/', requireRole('admin'), wrap(async (req, res) => {
  const input = studentSchema.parse(req.body);
  const sb = getAdmin();
  const name = await deptName(sb, input.dept_id);
  if (!name) return res.status(400).json({ error: 'ไม่พบแผนกที่เลือก', details: [{ field: 'dept_id', message: 'กรุณาเลือกแผนก' }] });
  const { data, error } = await sb.from('students').insert({ ...input, department: name }).select(ADMIN_COLS).single();
  if (error) throw error;
  // ไม่บันทึกข้อมูลส่วนบุคคลลง change_log (Y4.4) — เก็บเฉพาะฟิลด์ที่ไม่ระบุตัวตน
  await logChange({ table: 'students', recordId: data.student_id, action: 'INSERT', actor: req.user,
    after: { dept_id: input.dept_id, level: input.level, status: input.status } });
  res.status(201).json(data);
}));

const SENSITIVE = new Set(['full_name', 'phone', 'birth_date']);

// PUT /api/students/:id — เฉพาะ admin พร้อมบันทึกค่าก่อน/หลัง (ฟิลด์ส่วนบุคคลบันทึกแค่ว่า "ถูกแก้")
router.put('/:id', requireRole('admin'), wrap(async (req, res) => {
  if (!ID_RE.test(req.params.id)) return res.status(404).json({ error: 'ไม่พบนักเรียน' });
  const input = studentUpdateSchema.parse(req.body);
  const sb = getAdmin();
  const { data: before, error: bErr } = await sb.from('students').select('*').eq('student_id', req.params.id).maybeSingle();
  if (bErr) throw bErr;
  if (!before) return res.status(404).json({ error: 'ไม่พบนักเรียน' });

  const patch = { ...input };
  if (input.dept_id) {
    const name = await deptName(sb, input.dept_id);
    if (!name) return res.status(400).json({ error: 'ไม่พบแผนกที่เลือก', details: [{ field: 'dept_id', message: 'กรุณาเลือกแผนก' }] });
    patch.department = name;
  }
  const { data, error } = await sb.from('students').update(patch).eq('student_id', req.params.id).select(ADMIN_COLS).single();
  if (error) throw error;

  const changed = Object.keys(input).filter((k) => String(before[k] ?? '') !== String(input[k] ?? ''));
  if (changed.length) {
    const show = (o) => Object.fromEntries(changed.map((k) => [k, SENSITIVE.has(k) ? '(ข้อมูลส่วนบุคคล — ไม่บันทึกค่า)' : (o[k] ?? null)]));
    await logChange({ table: 'students', recordId: req.params.id, action: 'UPDATE', actor: req.user, before: show(before), after: show(input) });
  }
  res.json(data);
}));

// POST /api/students/import/rows — นำเข้า CSV ที่หน้าเว็บอ่านแล้ว ตรวจทีละแถว คืนรายงานข้อผิดพลาด (Y7.1)
router.post('/import/rows', requireRole('admin'), wrap(async (req, res) => {
  const rows = Array.isArray(req.body && req.body.rows) ? req.body.rows : null;
  if (!rows || rows.length === 0) return res.status(400).json({ error: 'ไม่มีข้อมูลสำหรับนำเข้า' });
  if (rows.length > 1000) return res.status(400).json({ error: 'นำเข้าได้ครั้งละไม่เกิน 1,000 แถว' });

  const sb = getAdmin();
  const { data: deps, error: dErr } = await sb.from('departments').select('dept_id, dept_name_th');
  if (dErr) throw dErr;
  const byKey = new Map(deps.flatMap((d) => [[d.dept_id, d], [d.dept_name_th, d]]));

  const valid = [];
  const errors = [];
  const seen = new Set();
  rows.forEach((raw, i) => {
    const line = i + 2; // บรรทัดที่ 1 คือหัวตาราง
    const dep = byKey.get(String(raw.department || raw.dept_id || '').trim());
    const parsed = studentSchema.safeParse({ ...raw, dept_id: dep ? dep.dept_id : '' });
    if (!parsed.success) {
      errors.push({ line, message: parsed.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ') });
    } else if (seen.has(parsed.data.student_id)) {
      errors.push({ line, message: 'student_id: ซ้ำกับแถวก่อนหน้าในไฟล์' });
    } else {
      seen.add(parsed.data.student_id);
      valid.push({ ...parsed.data, department: dep.dept_name_th });
    }
  });

  let inserted = 0;
  if (valid.length) {
    const { data, error } = await sb.from('students').upsert(valid, { onConflict: 'student_id', ignoreDuplicates: true }).select('student_id');
    if (error) throw error;
    inserted = data.length;
    if (inserted < valid.length) errors.push({ line: 0, message: `ข้าม ${valid.length - inserted} แถวที่รหัสนักเรียนมีอยู่ในระบบแล้ว` });
  }
  await sb.from('import_log').insert({ table_name: 'students (นำเข้าผ่านเว็บ)', rows_source: rows.length, rows_loaded: inserted });
  await logChange({ table: 'students', recordId: 'bulk', action: 'IMPORT', actor: req.user, after: { rows: rows.length, inserted, rejected: errors.length } });

  res.json({ total: rows.length, inserted, rejected: errors.length, errors: errors.slice(0, 100) });
}));

module.exports = router;
