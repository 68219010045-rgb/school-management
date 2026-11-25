const { getAdmin } = require('./supabase');
const { sessionDates, classPeriods, todayThai } = require('./sessions');
const { loadTerms } = require('./terms');

const DAY_CODES = { 1: 'จ', 2: 'อ', 3: 'พ', 4: 'พฤ', 5: 'ศ' };
const PAGE = 1000;

// ผลเช็คชื่อทั้งภาคอาจเกิน 1,000 แถว (เพดานของ PostgREST) จึงดึงทีละหน้า
async function allMarks(scheduleIds, from, to) {
  const out = [];
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await getAdmin().from('class_attendance')
      .select('schedule_id, class_date, period, student_id, status')
      .in('schedule_id', scheduleIds).gte('class_date', from).lte('class_date', to)
      .order('schedule_id').order('class_date').order('period').order('student_id')
      .range(start, start + PAGE - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}

/** สรุปภาคปัจจุบันของครูหนึ่งคน (เฉพาะรายวิชาที่สอน) */
async function teacherSummary(teacherId) {
  const today = todayThai();
  const term = (await loadTerms()).find((t) => t.is_current);
  const empty = { term_id: term ? term.term_id : null, today, classes: [], today_classes: [], pending: [], at_risk: [], absentees: [], totals: null };
  if (!term) return empty;

  const sb = getAdmin();
  const { data: classes, error } = await sb.from('schedules')
    .select('schedule_id, class_group, day_of_week, start_period, periods, room_id, subjects(subject_code, subject_name)')
    .eq('teacher_id', teacherId).eq('term_id', term.term_id).order('schedule_id');
  if (error) throw error;
  if (!classes.length) return empty;

  const ids = classes.map((c) => c.schedule_id);
  const [enrolled, marks] = await Promise.all([
    sb.from('enrollments').select('schedule_id, student_id, total_score, students(full_name)').in('schedule_id', ids),
    allMarks(ids, term.start_date, term.end_date),
  ]);
  if (enrolled.error) throw enrolled.error;

  const names = new Map(enrolled.data.map((e) => [e.student_id, e.students ? e.students.full_name : null]));
  const checked = new Set(marks.map((m) => `${m.schedule_id}|${m.class_date}|${m.period}`));
  const pending = [];

  const summary = classes.map((c) => {
    const students = enrolled.data.filter((e) => e.schedule_id === c.schedule_id);
    let sessions = 0;
    let done = 0;
    for (const date of sessionDates(c.day_of_week, term.start_date, term.end_date, today)) {
      const periods = classPeriods(c);
      const missing = periods.filter((p) => !checked.has(`${c.schedule_id}|${date}|${p}`));
      sessions += periods.length;
      done += periods.length - missing.length;
      // คาบที่ยังไม่มีรายการเช็คชื่อ (students ว่างไม่ต้องเช็ค)
      if (missing.length && students.length) pending.push({ schedule_id: c.schedule_id, date, periods: missing });
    }
    const mine = marks.filter((m) => m.schedule_id === c.schedule_id);
    return {
      ...c,
      students: students.length,
      graded: students.filter((e) => e.total_score !== null).length,
      periods_total: sessions,
      periods_checked: done,
      attend_rate: mine.length ? Math.round((1000 * mine.filter((m) => m.status === 'มา' || m.status === 'สาย').length) / mine.length) / 10 : null,
    };
  });

  const studentIds = [...names.keys()];
  const risk = studentIds.length
    ? await sb.from('at_risk').select('student_id, tier, reason, attendance_rate, gpa, zero_grades, days_absent, days_leave').in('student_id', studentIds)
    : { data: [] };
  if (risk.error) throw risk.error;

  const absent = new Map();
  for (const m of marks) if (m.status === 'ขาด') absent.set(m.student_id, (absent.get(m.student_id) || 0) + 1);

  const day = DAY_CODES[new Date(`${today}T00:00:00Z`).getUTCDay()];
  return {
    term_id: term.term_id,
    today,
    classes: summary,
    today_classes: summary.filter((c) => c.day_of_week === day && today >= term.start_date && today <= term.end_date)
      .sort((a, b) => a.start_period - b.start_period),
    pending: pending.sort((a, b) => b.date.localeCompare(a.date)),
    at_risk: risk.data.map((r) => ({ ...r, full_name: names.get(r.student_id) }))
      .sort((a, b) => (a.tier === b.tier ? a.student_id.localeCompare(b.student_id) : a.tier === 'เสี่ยงสูง' ? -1 : 1)),
    absentees: [...absent.entries()].map(([student_id, periods]) => ({ student_id, full_name: names.get(student_id), periods }))
      .sort((a, b) => b.periods - a.periods).slice(0, 10),
    totals: {
      classes: summary.length,
      students: studentIds.length,
      periods_per_week: classes.reduce((n, c) => n + classPeriods(c).length, 0),
      pending_periods: pending.reduce((n, p) => n + p.periods.length, 0),
      scores_missing: summary.reduce((n, c) => n + c.students - c.graded, 0),
    },
  };
}

module.exports = { teacherSummary };
