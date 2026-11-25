// สิทธิ์ครูและนักเรียน ทดสอบกับฐานข้อมูลจำลองในหน่วยความจำ
const test = require('node:test');
const assert = require('node:assert/strict');

const USERS = {
  teacher: { role: 'teacher', teacher_id: 'T001' },
  student: { role: 'student', student_id: 'S00001' },
  unlinked: { role: 'teacher' },
};
const DAY = 86400000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const now = Date.now() + 7 * 3600000;
// วันจันทร์ล่าสุดที่ผ่านมาแล้ว
const monday = iso(now - ((new Date(now).getUTCDay() + 6) % 7) * DAY);
const subjects = { subject_code: 'X1', subject_name: 'วิชาทดสอบ', credits: 2 };
let db;
const reset = () => {
  db = {
    profiles: Object.entries(USERS).map(([id, u]) => ({ id, email: `${id}@t.example`, display_name: id, ...u })),
    v_terms: [{ term_id: '2/2569', is_current: true, sort_key: 25692, start_date: iso(now - 30 * DAY), end_date: iso(now + 60 * DAY) },
      { term_id: '1/2569', is_current: false, sort_key: 25691, start_date: '2026-05-11', end_date: '2026-09-11' }],
    class_attendance: [], score_items: [], score_marks: [],
    schedules: [
      { schedule_id: 'MINE', teacher_id: 'T001', term_id: '2/2569', day_of_week: 'จ', start_period: 3, periods: 2, subjects },
      { schedule_id: 'OLD', teacher_id: 'T001', term_id: '1/2569', subjects },
      { schedule_id: 'OTHER', teacher_id: 'T002', term_id: '2/2569', subjects },
    ],
    enrollments: ['MINE', 'OLD', 'OTHER'].map((s) => ({
      enrollment_id: `E-${s}`, schedule_id: s, student_id: s === 'OTHER' ? 'S00002' : 'S00001',
      term_id: s === 'OLD' ? '1/2569' : '2/2569', total_score: null, grade: null, score_status: 'pending_current_term',
      students: { full_name: 'ทดสอบ' }, schedules: { subjects },
    })),
    students: [{ student_id: 'S00001', full_name: 'ฉัน' }, { student_id: 'S00002', full_name: 'เพื่อน' }],
    v_attendance_all: [], v_student_term_attendance: [], at_risk: [{ student_id: 'S00001', tier: 'เสี่ยงสูง', reason: 'GPA 1.40' }], change_log: [],
  };
};

function query(table) {
  const filters = [];
  let patch = null;
  let one = false;
  let remove = false;
  let page = null;
  const run = () => {
    const rows = db[table].filter((r) => filters.every((f) => f(r)));
    if (patch) rows.forEach((r) => Object.assign(r, patch));
    if (remove) db[table] = db[table].filter((r) => !rows.includes(r));
    return { data: one ? (rows[0] ? { ...rows[0] } : null) : rows.slice(...(page || [0])).map((r) => ({ ...r })), error: null };
  };
  const q = {
    select: () => q, order: () => q,
    range: (a, b) => { page = [a, b + 1]; return q; },
    gte: (k, v) => { filters.push((r) => r[k] >= v); return q; },
    lte: (k, v) => { filters.push((r) => r[k] <= v); return q; },
    upsert: (rows, { onConflict }) => {
      const keys = onConflict.split(',');
      for (const row of rows) {
        const hit = db[table].find((r) => keys.every((k) => r[k] === row[k]));
        if (hit) Object.assign(hit, row); else db[table].push({ ...row });
      }
      return Promise.resolve({ error: null });
    },
    eq: (k, v) => { filters.push((r) => r[k] === v); return q; },
    in: (k, v) => { filters.push((r) => v.includes(r[k])); return q; },
    update: (p) => { patch = p; return q; },
    insert: (row) => {
      const saved = { id: db[table].length + 1, ...row };
      db[table].push(saved);
      const result = Promise.resolve({ data: saved, error: null });
      result.select = () => ({ single: () => result });
      return result;
    },
    delete: () => { remove = true; return q; },
    maybeSingle: () => { one = true; return Promise.resolve(run()); },
    single: () => { one = true; return Promise.resolve(run()); },
    then: (ok, bad) => Promise.resolve(run()).then(ok, bad),
  };
  return q;
}

const fake = {
  from: query,
  auth: { getUser: async (token) => (USERS[token] ? { data: { user: { id: token } } } : { data: {}, error: new Error('bad') }) },
};
const supabasePath = require.resolve('../src/supabase');
require.cache[supabasePath] = { id: supabasePath, filename: supabasePath, loaded: true, exports: { getAdmin: () => fake, newAnonClient: () => fake } };

const { createApp } = require('../src/app');
const { gradeFromScore, weightedGpa } = require('../src/grading');

let server, base;
test.before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());
test.beforeEach(reset);

const call = async (who, path, body, method) => {
  const res = await fetch(base + path, {
    method: method || (body ? 'PUT' : 'GET'),
    headers: { Authorization: `Bearer ${who}`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

test('ครูและนักเรียนเข้าเส้นทางของผู้ดูแล/ผู้บริหารไม่ได้ (403)', async () => {
  for (const who of ['teacher', 'student']) {
    for (const p of ['/api/dashboard', '/api/students', '/api/students/S00002', '/api/enrollments', '/api/at-risk', '/api/tasks', '/api/changelog']) {
      assert.equal((await call(who, p)).status, 403, `${who} ${p}`);
    }
  }
  assert.equal((await call('student', '/api/teacher/classes')).status, 403);
  assert.equal((await call('student', '/api/teacher/enrollments/E-MINE', { total_score: 100 })).status, 403);
  assert.equal((await call('teacher', '/api/student/me')).status, 403);
  assert.equal((await call('unlinked', '/api/teacher/classes')).status, 403);
});

test('ครูกรอกคะแนนวิชาตัวเองได้ คิดเกรดให้ และบันทึกประวัติ', async () => {
  const res = await call('teacher', '/api/teacher/enrollments/E-MINE', { total_score: 76 });
  assert.equal(res.status, 200);
  assert.equal(res.body.grade, 3.5);
  assert.equal(res.body.score_status, 'graded');
  assert.equal(db.change_log.length, 1);
  assert.equal(db.change_log[0].actor_email, 'teacher@t.example');
  assert.equal(db.change_log[0].after_data.total_score, 76);

  const cleared = await call('teacher', '/api/teacher/enrollments/E-MINE', { total_score: null });
  assert.equal(cleared.body.score_status, 'pending_current_term');
  assert.equal(cleared.body.grade, null);
});

test('ครูแก้คะแนนวิชาคนอื่นหรือภาคที่จบแล้วไม่ได้', async () => {
  assert.equal((await call('teacher', '/api/teacher/enrollments/E-OTHER', { total_score: 80 })).status, 404);
  assert.equal((await call('teacher', '/api/teacher/enrollments/E-OLD', { total_score: 80 })).status, 403);
  assert.equal((await call('teacher', '/api/teacher/classes/OTHER')).status, 404);
  assert.ok(db.enrollments.every((e) => e.total_score === null));
  assert.equal(db.change_log.length, 0);
});

test('คะแนนผิดรูปแบบถูกปฏิเสธ (400)', async () => {
  for (const bad of [{ total_score: -1 }, { total_score: 101 }, { total_score: 79.5 }, { total_score: '80' }, { nothing: 1 }]) {
    assert.equal((await call('teacher', '/api/teacher/enrollments/E-MINE', bad)).status, 400, JSON.stringify(bad));
  }
});

test('นักเรียนเห็นเฉพาะของตัวเอง และไม่เห็นป้ายเสี่ยง', async () => {
  const res = await call('student', '/api/student/me?student_id=S00002');
  assert.equal(res.status, 200);
  assert.equal(res.body.profile.student_id, 'S00001');
  const ids = res.body.terms.flatMap((t) => t.courses.map((c) => c.enrollment_id));
  assert.deepEqual(ids.sort(), ['E-MINE', 'E-OLD']);
  assert.ok(!JSON.stringify(res.body).includes('เสี่ยง'));
});

test('เกณฑ์ตัดเกรดและ GPA ถ่วงหน่วยกิต', () => {
  const cases = [[100, 4], [80, 4], [79, 3.5], [75, 3.5], [70, 3], [65, 2.5], [60, 2], [55, 1.5], [50, 1], [49, 0], [0, 0], [null, null]];
  for (const [score, grade] of cases) assert.equal(gradeFromScore(score), grade, String(score));
  assert.equal(weightedGpa([{ score_status: 'graded', grade: 4, credits: 1 }, { score_status: 'graded', grade: 1, credits: 2 }, { score_status: 'missing', grade: null, credits: 3 }]), 2);
});

test('เช็คชื่อแยกทุกคาบ บันทึกประวัติ และนักเรียนเห็นยอดของตัวเอง', async () => {
  const path = '/api/teacher/classes/MINE/attendance';
  const first = await call('teacher', path);
  assert.deepEqual(first.body.periods, [3, 4]);
  assert.equal(first.body.date, monday);

  const mark = (period, status) => call('teacher', path, { date: monday, period, records: [{ student_id: 'S00001', status }] });
  assert.equal((await mark(3, 'มา')).status, 200);
  assert.equal((await mark(4, 'ขาด')).status, 200);
  assert.equal((await mark(4, 'ขาด')).body.saved, 0);   // ค่าเดิม ไม่บันทึกซ้ำ
  assert.equal((await mark(4, 'ลา')).body.saved, 1);
  assert.equal(db.class_attendance.length, 2);
  assert.deepEqual(db.change_log.map((l) => l.action), ['INSERT', 'INSERT', 'UPDATE']);

  const me = await call('student', '/api/student/me');
  const course = me.body.terms[0].courses.find((c) => c.schedule_id === 'MINE');
  assert.deepEqual(course.class_attendance, { 'มา': 1, 'สาย': 0, 'ลา': 1, 'ขาด': 0 });
  assert.deepEqual(me.body.terms[0].history.map((h) => [h.date, h.period, h.status]), [[monday, 4, 'ลา']]);
});

test('เช็คชื่อผิดเงื่อนไขถูกปฏิเสธ', async () => {
  const records = [{ student_id: 'S00001', status: 'มา' }];
  const put = (who, id, body) => call(who, `/api/teacher/classes/${id}/attendance`, body);
  const ok = { date: monday, period: 3, records };
  assert.equal((await put('student', 'MINE', ok)).status, 403);
  assert.equal((await put('teacher', 'OTHER', ok)).status, 404);
  assert.equal((await put('teacher', 'OLD', ok)).status, 403);
  for (const bad of [
    { ...ok, period: 5 },
    { ...ok, date: iso(Date.parse(monday) + DAY) },        // ไม่ใช่วันสอน
    { ...ok, date: iso(Date.parse(monday) + 7 * DAY) },    // อนาคต
    { ...ok, records: [{ student_id: 'S00002', status: 'มา' }] },
    { ...ok, records: [{ student_id: 'S00001', status: 'โดด' }] },
    { ...ok, records: [...records, ...records] },
    { ...ok, records: [] },
  ]) assert.equal((await put('teacher', 'MINE', bad)).status, 400, JSON.stringify(bad));
  assert.equal(db.class_attendance.length, 0);
});

test('แดชบอร์ดครูสรุปเฉพาะวิชาตัวเองในภาคปัจจุบัน', async () => {
  assert.equal((await call('student', '/api/teacher/dashboard')).status, 403);
  const before = (await call('teacher', '/api/teacher/dashboard')).body;
  assert.deepEqual(before.classes.map((c) => c.schedule_id), ['MINE']);
  assert.equal(before.totals.students, 1);
  assert.equal(before.totals.scores_missing, 1);
  assert.deepEqual(before.at_risk.map((r) => [r.student_id, r.reason]), [['S00001', 'GPA 1.40']]);
  assert.ok(before.totals.pending_periods >= 2);

  await call('teacher', '/api/teacher/classes/MINE/attendance', { date: monday, period: 3, records: [{ student_id: 'S00001', status: 'ขาด' }] });
  const after = (await call('teacher', '/api/teacher/dashboard')).body;
  assert.equal(after.totals.pending_periods, before.totals.pending_periods - 1);
  assert.equal(after.classes[0].periods_checked, 1);
  assert.equal(after.classes[0].attend_rate, 0);
  assert.deepEqual(after.absentees.map((a) => [a.student_id, a.periods]), [['S00001', 1]]);
});

test('คะแนนเก็บ: ครูจัดการเฉพาะวิชาตัวเอง นักเรียนเห็นของตัวเอง และไม่กระทบคะแนนรวม', async () => {
  const path = '/api/teacher/classes/MINE/coursework';
  const item = await call('teacher', path, { name: 'ใบงาน 1', max_score: 10 }, 'POST');
  assert.equal(item.status, 201);
  const put = (score, student_id = 'S00001') => call('teacher', `${path}/${item.body.id}`, { records: [{ student_id, score }] });
  assert.equal((await put(8)).status, 200);
  for (const bad of [await put(11), await put(-1), await put(2.5), await put(5, 'S00002')]) assert.equal(bad.status, 400);

  const me = await call('student', '/api/student/me');
  const course = me.body.terms[0].courses.find((c) => c.schedule_id === 'MINE');
  assert.deepEqual(course.coursework.map((i) => [i.name, i.score, i.max_score]), [['ใบงาน 1', 8, 10]]);
  assert.equal(course.total_score, null);

  assert.equal((await call('student', path, { name: 'x', max_score: 1 }, 'POST')).status, 403);
  assert.equal((await call('teacher', '/api/teacher/classes/OTHER/coursework', { name: 'x', max_score: 1 }, 'POST')).status, 404);
  assert.equal((await call('teacher', '/api/teacher/classes/OLD/coursework', { name: 'x', max_score: 1 }, 'POST')).status, 403);

  assert.equal((await put(null)).status, 200);
  assert.equal(db.score_marks.length, 0);
  assert.equal((await call('teacher', `${path}/${item.body.id}`, undefined, 'DELETE')).status, 200);
  assert.equal(db.score_items.length, 0);
  assert.deepEqual(db.change_log.map((l) => l.action), ['INSERT', 'UPDATE', 'UPDATE', 'DELETE']);
});
