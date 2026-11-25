const express = require('express');
const { getAdmin } = require('../supabase');
const { requireRole, wrap } = require('../middleware');
const { logChange } = require('../changelog');
const { taskSchema, taskUpdateSchema } = require('../validation');

const router = express.Router();

// admin อ่านและแก้ไขได้ ผู้บริหารอ่านได้อย่างเดียว
router.get('/', requireRole('admin', 'executive'), wrap(async (_req, res) => {
  const { data, error } = await getAdmin().from('tasks').select('*').order('id');
  if (error) throw error;
  res.json({ rows: data });
}));

router.post('/', requireRole('admin'), wrap(async (req, res) => {
  const input = taskSchema.parse(req.body);
  const { data, error } = await getAdmin().from('tasks').insert(input).select().single();
  if (error) throw error;
  await logChange({ table: 'tasks', recordId: data.id, action: 'INSERT', actor: req.user, after: input });
  res.status(201).json(data);
}));

router.patch('/:id', requireRole('admin'), wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: 'ไม่พบงาน' });
  const input = taskUpdateSchema.parse(req.body);
  const sb = getAdmin();
  const { data: before, error: bErr } = await sb.from('tasks').select('*').eq('id', id).maybeSingle();
  if (bErr) throw bErr;
  if (!before) return res.status(404).json({ error: 'ไม่พบงาน' });

  const { data, error } = await sb.from('tasks').update({ ...input, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw error;

  const changed = Object.keys(input).filter((k) => String(before[k] ?? '') !== String(input[k] ?? ''));
  if (changed.length) {
    await logChange({
      table: 'tasks', recordId: id, action: 'UPDATE', actor: req.user,
      before: Object.fromEntries(changed.map((k) => [k, before[k] ?? null])),
      after: Object.fromEntries(changed.map((k) => [k, input[k] ?? null])),
    });
  }
  res.json(data);
}));

module.exports = router;
