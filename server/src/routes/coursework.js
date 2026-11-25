// คะแนนเก็บของรายวิชา — ต่อท้ายเส้นทาง /api/teacher (ตรวจบทบาทครูแล้วใน teacher.js)
const express = require('express');
const { getAdmin } = require('../supabase');
const { wrap } = require('../middleware');
const { logChange } = require('../changelog');
const { scoreItemSchema, scoreMarksSchema } = require('../validation');
const { loadTerms } = require('../terms');

const MAX_ITEMS = 30; // 30 รายการ × ห้องใหญ่สุด 33 คน ไม่เกินเพดาน 1,000 แถวของการอ่านครั้งเดียว
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

const itemsOf = async (scheduleId) => must(await getAdmin().from('score_items')
  .select('id, name, max_score').eq('schedule_id', scheduleId).order('id'));

async function editableContext(req, res) {
  const ctx = await context(req, res);
  if (ctx && !ctx.editable) { res.status(403).json({ error: 'แก้คะแนนเก็บได้เฉพาะภาคเรียนปัจจุบัน' }); return null; }
  return ctx;
}

async function ownItem(ctx, req, res) {
  const item = (await itemsOf(ctx.cls.schedule_id)).find((i) => String(i.id) === req.params.itemId);
  if (!item) res.status(404).json({ error: 'ไม่พบรายการคะแนนในรายวิชานี้' });
  return item;
}

const router = express.Router();

router.get('/classes/:id/coursework', wrap(async (req, res) => {
  const ctx = await context(req, res);
  if (!ctx) return;
  const items = await itemsOf(ctx.cls.schedule_id);
  const marks = items.length
    ? must(await getAdmin().from('score_marks').select('item_id, student_id, score').in('item_id', items.map((i) => i.id)))
    : [];
  res.json({ class: ctx.cls, editable: ctx.editable, students: ctx.students, items, marks });
}));

router.post('/classes/:id/coursework', wrap(async (req, res) => {
  const input = scoreItemSchema.parse(req.body);
  const ctx = await editableContext(req, res);
  if (!ctx) return;
  if ((await itemsOf(ctx.cls.schedule_id)).length >= MAX_ITEMS) return res.status(400).json({ error: `เพิ่มได้ไม่เกิน ${MAX_ITEMS} รายการต่อวิชา` });
  const item = must(await getAdmin().from('score_items')
    .insert({ schedule_id: ctx.cls.schedule_id, ...input, created_by: req.user.email }).select('id, name, max_score').single());
  await logChange({ table: 'score_items', recordId: item.id, action: 'INSERT', actor: req.user, after: { schedule_id: ctx.cls.schedule_id, ...input } });
  res.status(201).json(item);
}));

router.delete('/classes/:id/coursework/:itemId', wrap(async (req, res) => {
  const ctx = await editableContext(req, res);
  if (!ctx) return;
  const item = await ownItem(ctx, req, res);
  if (!item) return;
  const sb = getAdmin();
  const marks = must(await sb.from('score_marks').select('student_id, score').eq('item_id', item.id));
  const { error } = await sb.from('score_items').delete().eq('id', item.id); // คะแนนในรายการถูกลบตาม (cascade)
  if (error) throw error;
  await logChange({
    table: 'score_items', recordId: item.id, action: 'DELETE', actor: req.user,
    before: { schedule_id: ctx.cls.schedule_id, name: item.name, max_score: item.max_score, scores: Object.fromEntries(marks.map((m) => [m.student_id, m.score])) },
  });
  res.json({ deleted: item.id });
}));

// PUT { records: [{ student_id, score|null }] } — null = ล้างคะแนน
router.put('/classes/:id/coursework/:itemId', wrap(async (req, res) => {
  const { records } = scoreMarksSchema.parse(req.body);
  const ctx = await editableContext(req, res);
  if (!ctx) return;
  const item = await ownItem(ctx, req, res);
  if (!item) return;
  const enrolled = new Set(ctx.students.map((s) => s.student_id));
  if (new Set(records.map((r) => r.student_id)).size !== records.length || records.some((r) => !enrolled.has(r.student_id))) {
    return res.status(400).json({ error: 'มีรหัสนักเรียนซ้ำ หรือไม่ได้ลงทะเบียนวิชานี้' });
  }
  if (records.some((r) => r.score !== null && r.score > item.max_score)) {
    return res.status(400).json({ error: `คะแนนต้องไม่เกินคะแนนเต็ม ${item.max_score}` });
  }

  const sb = getAdmin();
  const before = new Map(must(await sb.from('score_marks').select('student_id, score').eq('item_id', item.id)).map((m) => [m.student_id, m.score]));
  const changed = records.filter((r) => (before.get(r.student_id) ?? null) !== r.score);
  const set = changed.filter((r) => r.score !== null);
  const clear = changed.filter((r) => r.score === null).map((r) => r.student_id);
  if (set.length) {
    const now = new Date().toISOString();
    const { error } = await sb.from('score_marks').upsert(
      set.map((r) => ({ item_id: item.id, ...r, updated_by: req.user.email, updated_at: now })), { onConflict: 'item_id,student_id' });
    if (error) throw error;
  }
  if (clear.length) {
    const { error } = await sb.from('score_marks').delete().eq('item_id', item.id).in('student_id', clear);
    if (error) throw error;
  }
  if (changed.length) {
    await logChange({
      table: 'score_marks', recordId: item.id, action: 'UPDATE', actor: req.user,
      before: Object.fromEntries(changed.map((r) => [r.student_id, before.get(r.student_id) ?? null])),
      after: Object.fromEntries(changed.map((r) => [r.student_id, r.score])),
    });
  }
  res.json({ saved: changed.length });
}));

module.exports = router;
