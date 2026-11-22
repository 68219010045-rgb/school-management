const express = require('express');
const { getAdmin } = require('../supabase');
const { requireRole, wrap } = require('../middleware');
const { pageSchema, dashFilterSchema } = require('../validation');
const { regressionDiagnostics, weeklyAnomalies } = require('../stats');

const router = express.Router();

async function rpc(name, args) {
  const { data, error } = await getAdmin().rpc(name, args);
  if (error) throw Object.assign(new Error(`rpc ${name}: ${error.message}`), { code: error.code });
  return data;
}

// GET /api/meta — แผนก ภาคเรียน และวันส่งออกข้อมูล สำหรับตัวกรอง/ฟอร์ม
router.get('/meta', wrap(async (_req, res) => {
  const sb = getAdmin();
  const [d, t, m] = await Promise.all([
    sb.from('departments').select('dept_id, dept_name_th').order('dept_id'),
    sb.from('v_terms').select('term_id, start_date, end_date, is_finished, is_current, sort_key').order('sort_key'),
    sb.from('data_meta').select('table_name, extract_date'),
  ]);
  for (const r of [d, t, m]) if (r.error) throw r.error;
  res.json({
    departments: d.data, terms: t.data,
    data_dates: Object.fromEntries(m.data.map((x) => [x.table_name, x.extract_date])),
  });
}));

// GET /api/dashboard?term_id=1/2569&dept_id=D01 — KPI 6 ตัว + กราฟ 8 รูป (ฐานข้อมูลสรุปให้ด้วย RPC)
router.get('/dashboard', wrap(async (req, res) => {
  const f = dashFilterSchema.parse(req.query);
  const flt = { p_term: f.term_id, p_dept: f.dept_id };
  const [kpi, perTerm, dropout, hist, box, room, scatter, weekly, regIn] = await Promise.all([
    rpc('kpi_summary', flt),
    rpc('chart_students_per_term'),
    rpc('chart_dropout_by_dept'),
    rpc('chart_score_hist', flt),
    rpc('chart_gpa_box', flt),
    rpc('chart_room_heatmap', { p_term: f.term_id || '1/2569' }),
    rpc('chart_attendance_gpa', flt),
    rpc('chart_weekly_attendance', flt),
    rpc('chart_regression_inputs'),
  ]);
  res.json({
    filters: f, kpi,
    charts: {
      students_per_term: perTerm,
      dropout_by_dept: dropout,
      score_hist: hist,
      gpa_box: box,
      room_heatmap: room,
      attendance_gpa: scatter,
      weekly_attendance: { rows: weekly, anomalies: weeklyAnomalies(weekly) },
      residuals: regressionDiagnostics(regIn), // โมเดลภาพรวม ไม่ขึ้นกับตัวกรอง
    },
  });
}));

// GET /api/enrollments — อ่านทีละหน้า ไม่ดึงทั้งตาราง (B3.4) ไม่มีชื่อนักเรียน (ใช้รหัส)
router.get('/enrollments', wrap(async (req, res) => {
  const { page, pageSize } = pageSchema.parse(req.query);
  const from = (page - 1) * pageSize;
  let q = getAdmin().from('enrollments')
    .select('enrollment_id, student_id, term_id, total_score, grade, score_status, schedules(class_group, subjects(subject_code, subject_name, credits))', { count: 'exact' })
    .order('enrollment_id').range(from, from + pageSize - 1);
  if (/^[12]\/[0-9]{4}$/.test(req.query.term_id || '')) q = q.eq('term_id', req.query.term_id);
  if (['graded', 'pending_current_term', 'missing', 'invalid_removed'].includes(req.query.score_status)) q = q.eq('score_status', req.query.score_status);
  if (/^S[0-9]{5}$/.test(req.query.student_id || '')) q = q.eq('student_id', req.query.student_id);
  const { data, count, error } = await q;
  if (error) throw error;
  res.json({ rows: data, total: count, page, pageSize });
}));

// GET /api/at-risk — นักเรียนเสี่ยง (รหัสเท่านั้น) สำหรับครูที่ปรึกษา: เฉพาะ admin
router.get('/at-risk', requireRole('admin'), wrap(async (req, res) => {
  const { page, pageSize } = pageSchema.parse(req.query);
  const from = (page - 1) * pageSize;
  let q = getAdmin().from('at_risk').select('*', { count: 'exact' })
    .order('tier', { ascending: false }).order('attendance_rate', { ascending: true }).range(from, from + pageSize - 1);
  if (['เสี่ยงสูง', 'เฝ้าระวัง'].includes(req.query.tier)) q = q.eq('tier', req.query.tier);
  const { data, count, error } = await q;
  if (error) throw error;
  res.json({ rows: data, total: count, page, pageSize });
}));

// GET /api/changelog — ประวัติการแก้ไข (เฉพาะ admin)
router.get('/changelog', requireRole('admin'), wrap(async (req, res) => {
  const { page, pageSize } = pageSchema.parse(req.query);
  const from = (page - 1) * pageSize;
  const { data, count, error } = await getAdmin().from('change_log')
    .select('id, table_name, record_id, action, actor_email, before_data, after_data, changed_at', { count: 'exact' })
    .order('changed_at', { ascending: false }).range(from, from + pageSize - 1);
  if (error) throw error;
  res.json({ rows: data, total: count, page, pageSize });
}));

module.exports = router;
