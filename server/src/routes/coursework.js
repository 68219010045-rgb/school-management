// คะแนนเก็บของรายวิชา และคะแนนรวมที่คิดจากคะแนนเก็บ — ต่อท้าย /api/teacher (ตรวจบทบาทครูใน teacher.js)
const express = require('express');
const { getAdmin } = require('../supabase');
const { wrap } = require('../middleware');
const { logChange } = require('../changelog');
const { scoreMarksSchema } = require('../validation');
const { gradeFromScore } = require('../grading');
const { loadTerms } = require('../terms');

// รายการคะแนนตายตัว ใช้เหมือนกันทุกวิชา รวม 100 คะแนน (ลำดับ = เลข item ที่หน้าเว็บส่งมา เริ่มที่ 1)
const ITEMS = [
  ['ใบงานที่ 1', 10], ['ใบงานที่ 2', 10], ['ใบงานที่ 3', 10], ['เก็บคะแนน 1', 10],
  ['กลางภาค', 20], ['ปลายภาค', 20], ['จิตพิสัย', 20],
].map(([name, max_score], i) => ({ item: i + 1, name, max_score }));
const must = ({ data, error }) => { if (error) throw error; return data; };

// รายวิชาของครูคนนี้ พร้อมรายชื่อ และบอกว่าแก้ได้ไหม
async function context(req, res) {
  const sb = getAdmin();
  const cls = must(await sb.from('schedules').select('schedule_id, term_id, class_group, subjects(subject_code, subject_name)')
    .eq('schedule_id', req.params.id).eq('teacher_id', req.user.teacher_id).maybeSingle());
  if (!cls) { res.status(404).json({ error: 'ไม่พบรายวิชานี้ในตารางสอนของคุณ' }); return null; }
  const enrolled = must(await sb.from('enrollments').select('student_id, students(full_name)').eq('schedule_id', cls.schedule_id).order('student_id'));
  return {
    cls,
    editable: (await loadTerms()).some((t) => t.term_id === cls.term_id && t.is_current),
    students: enrolled.map((e) => ({ student_id: e.student_id, full_name: e.students ? e.students.full_name : null })),
  };
}

async function editableContext(req, res) {
  const ctx = await context(req, res);
  if (ctx && !ctx.editable) { res.status(403).json({ error: 'แก้คะแนนได้เฉพาะภาคเรียนปัจจุบัน' }); return null; }
  return ctx;
}

// แถวในตาราง score_items ของรายการมาตรฐาน จับคู่ด้วยชื่อ (สร้างเมื่อบันทึกคะแนนครั้งแรกของวิชา)
async function storedItems(scheduleId) {
  const rows = must(await getAdmin().from('score_items').select('id, name').eq('schedule_id', scheduleId).order('id'));
  const idOf = new Map();
  for (const r of rows) if (!idOf.has(r.name)) idOf.set(r.name, r.id);
  return ITEMS.map((i) => ({ ...i, id: idOf.get(i.name) ?? null }));
}

async function createMissing(scheduleId, items, actor) {
  for (const i of items.filter((x) => x.id === null)) {
    const row = must(await getAdmin().from('score_items')
      .insert({ schedule_id: scheduleId, name: i.name, max_score: i.max_score, created_by: actor.email }).select('id').single());
    i.id = row.id;
  }
}

async function marksOf(items) {
  const ids = items.map((i) => i.id).filter((id) => id !== null);
  return ids.length ? must(await getAdmin().from('score_marks').select('item_id, student_id, score').in('item_id', ids)) : [];
}

/**
 * คิดคะแนนรวมและเกรดของนักเรียนที่เพิ่งถูกแก้: มีคะแนนครบทุกรายการ = ผลบวก ไม่ครบ = รอผล
 * บันทึกประวัติเฉพาะคนที่ค่าเปลี่ยน
 */
async function syncTotals(scheduleId, studentIds, items, actor) {
  const sb = getAdmin();
  const marks = await marksOf(items);
  const rows = must(await sb.from('enrollments').select('enrollment_id, student_id, total_score, grade')
    .eq('schedule_id', scheduleId).in('student_id', studentIds));
  for (const row of rows) {
    const mine = marks.filter((m) => m.student_id === row.student_id);
    const total = mine.length === items.length ? mine.reduce((n, m) => n + m.score, 0) : null;
    const old = row.total_score === null ? null : Number(row.total_score);
    if (old === total) continue;
    const grade = gradeFromScore(total);
    const { error } = await sb.from('enrollments')
      .update({ total_score: total, grade, score_status: total === null ? 'pending_current_term' : 'graded' })
      .eq('enrollment_id', row.enrollment_id);
    if (error) throw error;
    await logChange({
      table: 'enrollments', recordId: row.enrollment_id, action: 'UPDATE', actor,
      before: { total_score: old, grade: row.grade }, after: { total_score: total, grade },
    });
  }
}

const router = express.Router();

router.get('/classes/:id/coursework', wrap(async (req, res) => {
  const ctx = await context(req, res);
  if (!ctx) return;
  const items = await storedItems(ctx.cls.schedule_id);
  const itemOf = new Map(items.map((i) => [i.id, i.item]));
  res.json({
    class: ctx.cls, editable: ctx.editable, students: ctx.students,
    items: items.map(({ item, name, max_score }) => ({ item, name, max_score })),
    marks: (await marksOf(items)).map((m) => ({ item: itemOf.get(m.item_id), student_id: m.student_id, score: m.score })),
  });
}));

// PUT { records: [{ item, student_id, score|null }] } — บันทึกหลายช่องพร้อมกัน · null = ล้างคะแนน
router.put('/classes/:id/coursework', wrap(async (req, res) => {
  const { records } = scoreMarksSchema.parse(req.body);
  const ctx = await editableContext(req, res);
  if (!ctx) return;
  const enrolled = new Set(ctx.students.map((s) => s.student_id));
  // ตรวจทุกช่องก่อนเขียน
  const keys = new Set(records.map((r) => `${r.item}|${r.student_id}`));
  if (keys.size !== records.length || records.some((r) => !enrolled.has(r.student_id))) {
    return res.status(400).json({ error: 'มีช่องคะแนนซ้ำ หรือนักเรียนไม่ได้ลงทะเบียนวิชานี้' });
  }
  const over = records.find((r) => r.score !== null && r.score > ITEMS[r.item - 1].max_score);
  if (over) return res.status(400).json({ error: `${over.student_id}: ${ITEMS[over.item - 1].name} ต้องไม่เกิน ${ITEMS[over.item - 1].max_score} คะแนน` });

  const sb = getAdmin();
  const items = await storedItems(ctx.cls.schedule_id);
  const before = new Map((await marksOf(items)).map((m) => [`${m.item_id}|${m.student_id}`, m.score]));
  const old = (r) => before.get(`${items[r.item - 1].id}|${r.student_id}`) ?? null;
  const changed = records.filter((r) => old(r) !== r.score);
  if (!changed.length) return res.json({ saved: 0 });
  await createMissing(ctx.cls.schedule_id, items, req.user);

  const now = new Date().toISOString();
  const set = changed.filter((r) => r.score !== null).map((r) => ({
    item_id: items[r.item - 1].id, student_id: r.student_id, score: r.score, updated_by: req.user.email, updated_at: now,
  }));
  if (set.length) {
    const { error } = await sb.from('score_marks').upsert(set, { onConflict: 'item_id,student_id' });
    if (error) throw error;
  }
  for (const item of new Set(changed.map((r) => r.item))) {
    const itemId = items[item - 1].id;
    const mine = changed.filter((r) => r.item === item);
    const clear = mine.filter((r) => r.score === null).map((r) => r.student_id);
    if (clear.length) {
      const { error } = await sb.from('score_marks').delete().eq('item_id', itemId).in('student_id', clear);
      if (error) throw error;
    }
    await logChange({
      table: 'score_marks', recordId: itemId, action: 'UPDATE', actor: req.user,
      before: Object.fromEntries(mine.map((r) => [r.student_id, old(r)])),
      after: Object.fromEntries(mine.map((r) => [r.student_id, r.score])),
    });
  }
  await syncTotals(ctx.cls.schedule_id, [...new Set(changed.map((r) => r.student_id))], items, req.user);
  res.json({ saved: changed.length });
}));

module.exports = router;
