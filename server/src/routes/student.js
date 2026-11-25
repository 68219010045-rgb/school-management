const express = require('express');
const { getAdmin } = require('../supabase');
const { requireRole, wrap } = require('../middleware');
const { weightedGpa } = require('../grading');
const { loadTerms } = require('../terms');
const { STATUSES } = require('../sessions');

const router = express.Router();

// นักเรียนเห็นเฉพาะข้อมูลของตัวเอง: รหัสมาจากบัญชีที่ล็อกอินเท่านั้น ไม่รับจาก URL
router.use(requireRole('student'));

// GET /api/student/me — ข้อมูลส่วนตัว ตารางเรียน ผลการเรียน และการมาเรียน (ไม่ส่งป้ายนักเรียนเสี่ยง)
router.get('/me', wrap(async (req, res) => {
  const id = req.user.student_id;
  if (!id) return res.status(403).json({ error: 'บัญชีนี้ยังไม่ได้ผูกกับรหัสนักเรียน กรุณาติดต่อผู้ดูแล' });

  const sb = getAdmin();
  const [profile, enrolled, attendance, terms] = await Promise.all([
    sb.from('students')
      .select('student_id, full_name, gender, birth_date, phone, level, status, admission_date, departments(dept_name_th)')
      .eq('student_id', id).maybeSingle(),
    sb.from('enrollments')
      .select('enrollment_id, schedule_id, term_id, total_score, grade, score_status, schedules(day_of_week, start_period, periods, room_id, class_group, subjects(subject_code, subject_name, credits))')
      .eq('student_id', id).order('enrollment_id'),
    sb.from('v_attendance_all').select('term_id, week_no, week_start_date, days_present, days_absent, days_leave, days_late, dq_flags').eq('student_id', id),
    loadTerms(),
  ]);
  for (const r of [profile, enrolled, attendance]) if (r.error) throw r.error;
  if (!profile.data) return res.status(404).json({ error: 'ไม่พบข้อมูลนักเรียน' });

  const rows = enrolled.data.map(({ schedules, ...e }) => {
    const sub = (schedules && schedules.subjects) || {};
    return {
      ...e,
      subject_code: sub.subject_code, subject_name: sub.subject_name, credits: sub.credits,
      day_of_week: schedules && schedules.day_of_week, start_period: schedules && schedules.start_period,
      periods: schedules && schedules.periods, room_id: schedules && schedules.room_id,
    };
  });

  // ผลเช็คชื่อรายคาบของภาคปัจจุบัน (นับเป็นคาบ)
  const current = terms.find((t) => t.is_current);
  let marks = [];
  if (current) {
    const r = await sb.from('class_attendance').select('schedule_id, class_date, period, status')
      .eq('student_id', id).gte('class_date', current.start_date).lte('class_date', current.end_date);
    if (r.error) throw r.error;
    marks = r.data;
  }
  const tally = (scheduleId) => {
    const mine = marks.filter((m) => m.schedule_id === scheduleId);
    return mine.length ? Object.fromEntries(STATUSES.map((s) => [s, mine.filter((m) => m.status === s).length])) : null;
  };
  for (const c of rows) c.class_attendance = tally(c.schedule_id);

  // คะแนนเก็บของตัวเอง (ถ้ายังไม่ได้รัน coursework.sql ให้แสดงเป็นว่าง แทนที่จะพังทั้งหน้า)
  const optional = ({ data, error }) => { if (error && error.code !== 'PGRST205') throw error; return data || []; };
  const scheduleIds = rows.map((r) => r.schedule_id);
  const items = scheduleIds.length
    ? optional(await sb.from('score_items').select('id, schedule_id, name, max_score').in('schedule_id', scheduleIds).order('id'))
    : [];
  const own = new Map((items.length ? optional(await sb.from('score_marks').select('item_id, score').eq('student_id', id)) : [])
    .map((m) => [m.item_id, m.score]));
  for (const c of rows) {
    c.coursework = items.filter((i) => i.schedule_id === c.schedule_id)
      .map((i) => ({ id: i.id, name: i.name, max_score: i.max_score, score: own.get(i.id) ?? null }));
  }

  // ประวัติรายคาบที่ไม่ได้ "มา" ใหม่ → เก่า (มีเฉพาะคาบที่ครูเช็คชื่อในระบบ)
  const subjectOf = new Map(rows.map((r) => [r.schedule_id, `${r.subject_code || ''} ${r.subject_name || ''}`.trim()]));
  const history = marks.filter((m) => m.status !== 'มา')
    .map((m) => ({ date: m.class_date, period: m.period, status: m.status, subject: subjectOf.get(m.schedule_id) || m.schedule_id }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.period - b.period);

  const byTerm = terms.map(({ term_id, is_current }) => {
    const mine = rows.filter((r) => r.term_id === term_id);
    // ไม่นับแถวที่ติดธง days_do_not_add_up (นิยามเดียวกับ KPI 1)
    const att = attendance.data.filter((a) => a.term_id === term_id && !String(a.dq_flags || '').includes('days_do_not_add_up'));
    const sum = (k) => att.reduce((n, a) => n + Number(a[k] || 0), 0);
    const present = sum('days_present');
    const absent = sum('days_absent');
    const leave = sum('days_leave');
    const total = present + absent + leave;
    // สัปดาห์ที่มีขาด ลา หรือสาย
    const weeks = att.filter((a) => Number(a.days_absent) || Number(a.days_leave) || Number(a.days_late))
      .map((a) => ({ week_no: a.week_no, week_start_date: a.week_start_date, absent: Number(a.days_absent), leave: Number(a.days_leave), late: Number(a.days_late || 0) }))
      .sort((a, b) => b.week_no - a.week_no);
    return {
      weeks, history: is_current ? history : [],
      term_id, is_current: Boolean(is_current), courses: mine, gpa: weightedGpa(mine),
      attendance: total ? { present, absent, leave, late: sum('days_late'), rate: Math.round((1000 * present) / total) / 10 } : null,
    };
  }).filter((t) => t.courses.length || t.attendance);

  res.json({ profile: profile.data, gpa: weightedGpa(rows), terms: byTerm });
}));

module.exports = router;
