const express = require('express');
const { getAdmin } = require('../supabase');
const { requireRole, wrap } = require('../middleware');
const { logChange } = require('../changelog');
const { attendanceSchema } = require('../validation');
const { sessionDates, classPeriods } = require('../sessions');
const { loadTerms } = require('../terms');
const { teacherSummary } = require('../teacherSummary');

const router = express.Router();

// ครูเห็นและแก้ได้เฉพาะรายวิชาที่ตัวเองสอน (schedules.teacher_id = profiles.teacher_id)
router.use(requireRole('teacher'));
router.use((req, res, next) => (req.user.teacher_id
  ? next()
  : res.status(403).json({ error: 'บัญชีนี้ยังไม่ได้ผูกกับรหัสครู กรุณาติดต่อผู้ดูแล' })));

const CLASS_COLS = 'schedule_id, term_id, class_group, day_of_week, start_period, periods, room_id, subjects(subject_code, subject_name, credits)';

async function ownClass(scheduleId, teacherId) {
  const { data, error } = await getAdmin().from('schedules').select(CLASS_COLS)
    .eq('schedule_id', scheduleId).eq('teacher_id', teacherId).maybeSingle();
  if (error) throw error;
  return data;
}

// GET /api/teacher/dashboard — สรุปภาคปัจจุบัน
router.get('/dashboard', wrap(async (req, res) => {
  res.json(await teacherSummary(req.user.teacher_id));
}));

// GET /api/teacher/classes?term_id=2/2569 — วิชาที่สอน (ค่าเริ่มต้น = ภาคปัจจุบัน)
router.get('/classes', wrap(async (req, res) => {
  const terms = await loadTerms();
  const current = terms.find((t) => t.is_current);
  const wanted = terms.find((t) => t.term_id === req.query.term_id) || current || terms[0];
  if (!wanted) return res.json({ rows: [], terms: [], term_id: null, editable: false });

  const { data, error } = await getAdmin().from('schedules').select(CLASS_COLS)
    .eq('teacher_id', req.user.teacher_id).eq('term_id', wanted.term_id).order('schedule_id');
  if (error) throw error;
  res.json({ rows: data, terms: terms.map((t) => t.term_id), term_id: wanted.term_id, editable: Boolean(wanted.is_current) });
}));

// GET /api/teacher/classes/:id — รายชื่อ คะแนน การมาเรียน และป้ายเสี่ยง (ไม่ส่งวันเกิด/เบอร์โทร)
router.get('/classes/:id', wrap(async (req, res) => {
  const cls = await ownClass(req.params.id, req.user.teacher_id);
  if (!cls) return res.status(404).json({ error: 'ไม่พบรายวิชานี้ในตารางสอนของคุณ' });

  const sb = getAdmin();
  const { data: enrolled, error } = await sb.from('enrollments')
    .select('enrollment_id, student_id, total_score, grade, score_status, students(full_name)')
    .eq('schedule_id', cls.schedule_id).order('student_id');
  if (error) throw error;

  const ids = enrolled.map((e) => e.student_id);
  const [att, risk, terms] = await Promise.all([
    sb.from('v_student_term_attendance').select('student_id, present, total').eq('term_id', cls.term_id).in('student_id', ids),
    sb.from('at_risk').select('student_id, tier').in('student_id', ids),
    loadTerms(),
  ]);
  for (const r of [att, risk]) if (r.error) throw r.error;

  const rate = new Map(att.data.map((a) => [a.student_id, Number(a.total) ? Math.round((1000 * a.present) / a.total) / 10 : null]));
  const tier = new Map(risk.data.map((r) => [r.student_id, r.tier]));
  res.json({
    class: cls,
    editable: terms.some((t) => t.term_id === cls.term_id && t.is_current),
    rows: enrolled.map(({ students, ...e }) => ({
      ...e,
      full_name: students ? students.full_name : null,
      attendance_rate: rate.get(e.student_id) ?? null,
      risk_tier: tier.get(e.student_id) || null,
    })),
  });
}));

// ข้อมูลที่ใช้เช็คชื่อของรายวิชา: รายชื่อ คาบ และวันที่เช็คได้ (เฉพาะภาคปัจจุบัน)
async function attendanceContext(scheduleId, teacherId) {
  const cls = await ownClass(scheduleId, teacherId);
  if (!cls) return null;
  const term = (await loadTerms()).find((t) => t.term_id === cls.term_id);
  const editable = Boolean(term && term.is_current);
  const { data, error } = await getAdmin().from('enrollments')
    .select('student_id, students(full_name)').eq('schedule_id', cls.schedule_id).order('student_id');
  if (error) throw error;
  return {
    cls,
    editable,
    periods: classPeriods(cls),
    dates: editable ? sessionDates(cls.day_of_week, term.start_date, term.end_date) : [],
    students: data.map((e) => ({ student_id: e.student_id, full_name: e.students ? e.students.full_name : null })),
  };
}

async function savedMarks(scheduleId, date) {
  const { data, error } = await getAdmin().from('class_attendance')
    .select('period, student_id, status').eq('schedule_id', scheduleId).eq('class_date', date);
  if (error) throw error;
  return data;
}

// GET /api/teacher/classes/:id/attendance?date=YYYY-MM-DD (ค่าเริ่มต้น = วันสอนล่าสุด)
router.get('/classes/:id/attendance', wrap(async (req, res) => {
  const ctx = await attendanceContext(req.params.id, req.user.teacher_id);
  if (!ctx) return res.status(404).json({ error: 'ไม่พบรายวิชานี้ในตารางสอนของคุณ' });
  const date = ctx.dates.includes(req.query.date) ? req.query.date : ctx.dates[0] || null;
  res.json({
    class: ctx.cls, editable: ctx.editable, periods: ctx.periods, dates: ctx.dates, date,
    students: ctx.students,
    records: date ? await savedMarks(ctx.cls.schedule_id, date) : [],
  });
}));

// PUT /api/teacher/classes/:id/attendance { date, period, records } — บันทึกทีละคาบ
router.put('/classes/:id/attendance', wrap(async (req, res) => {
  const { date, period, records } = attendanceSchema.parse(req.body);
  const ctx = await attendanceContext(req.params.id, req.user.teacher_id);
  if (!ctx) return res.status(404).json({ error: 'ไม่พบรายวิชานี้ในตารางสอนของคุณ' });
  if (!ctx.editable) return res.status(403).json({ error: 'เช็คชื่อได้เฉพาะภาคเรียนปัจจุบัน' });
  if (!ctx.dates.includes(date)) return res.status(400).json({ error: 'วันที่นี้ไม่ใช่วันสอนของรายวิชา หรือยังไม่ถึง' });
  if (!ctx.periods.includes(period)) return res.status(400).json({ error: 'คาบนี้ไม่อยู่ในตารางสอนของรายวิชา' });
  const enrolled = new Set(ctx.students.map((s) => s.student_id));
  const ids = new Set(records.map((r) => r.student_id));
  if (ids.size !== records.length || records.some((r) => !enrolled.has(r.student_id))) {
    return res.status(400).json({ error: 'มีรหัสนักเรียนซ้ำ หรือไม่ได้ลงทะเบียนวิชานี้' });
  }

  const before = new Map((await savedMarks(ctx.cls.schedule_id, date))
    .filter((r) => r.period === period).map((r) => [r.student_id, r.status]));
  const changed = records.filter((r) => before.get(r.student_id) !== r.status);
  if (changed.length) {
    const now = new Date().toISOString();
    const { error } = await getAdmin().from('class_attendance').upsert(
      changed.map((r) => ({ schedule_id: ctx.cls.schedule_id, class_date: date, period, ...r, updated_by: req.user.email, updated_at: now })),
      { onConflict: 'schedule_id,class_date,period,student_id' });
    if (error) throw error;
    await logChange({
      table: 'class_attendance', recordId: `${ctx.cls.schedule_id} ${date} คาบ ${period}`,
      action: before.size ? 'UPDATE' : 'INSERT', actor: req.user,
      before: before.size ? Object.fromEntries(changed.map((r) => [r.student_id, before.get(r.student_id) ?? null])) : null,
      after: Object.fromEntries(changed.map((r) => [r.student_id, r.status])),
    });
  }
  res.json({ saved: changed.length, records: await savedMarks(ctx.cls.schedule_id, date) });
}));

router.use(require('./coursework'));

module.exports = router;
