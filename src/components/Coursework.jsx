import { useState } from 'react';
import { api } from '../api';
import { Alert, Empty, ErrorBox, Field, Loading, useFetch } from './UI';

const errorText = (err) => (err.details && err.details[0] && err.details[0].message) || err.message;

// กรอกคะแนนของหนึ่งรายการให้ทั้งห้อง
function Marks({ base, item, students, marks, editable, onSaved }) {
  const saved = new Map(marks.filter((m) => m.item_id === item.id).map((m) => [m.student_id, m.score]));
  const [values, setValues] = useState(() => Object.fromEntries(students.map((s) => [s.student_id, saved.get(s.student_id) ?? ''])));
  const [state, setState] = useState({ busy: false, error: '' });
  const dirty = students.some((s) => String(values[s.student_id]) !== String(saved.get(s.student_id) ?? ''));

  async function save(e) {
    e.preventDefault();
    const records = students.map((s) => ({ student_id: s.student_id, score: values[s.student_id] === '' ? null : Number(values[s.student_id]) }));
    const bad = records.find((r) => r.score !== null && !(Number.isInteger(r.score) && r.score >= 0 && r.score <= item.max_score));
    if (bad) { setState({ busy: false, error: `${bad.student_id}: กรอกจำนวนเต็ม 0–${item.max_score}` }); return; }
    setState({ busy: true, error: '' });
    try {
      await api(`${base}/${item.id}`, { method: 'PUT', body: { records } });
      onSaved(`บันทึกคะแนน “${item.name}” แล้ว`);
    } catch (err) {
      setState({ busy: false, error: errorText(err) });
    }
  }

  return (
    <form onSubmit={save} noValidate>
      <div className="table-wrap"><table>
        <caption className="sr-only">คะแนน {item.name}</caption>
        <thead><tr><th>รหัส</th><th>ชื่อ-สกุล</th><th>{item.name} (เต็ม {item.max_score})</th></tr></thead>
        <tbody>{students.map((s) => (
          <tr key={s.student_id}>
            <td><strong>{s.student_id}</strong></td><td>{s.full_name}</td>
            <td>{editable ? (
              <input type="number" min="0" max={item.max_score} step="1" inputMode="numeric" style={{ width: '7rem' }}
                aria-label={`คะแนนของ ${s.student_id}`} value={values[s.student_id]}
                onChange={(e) => setValues((v) => ({ ...v, [s.student_id]: e.target.value }))} />
            ) : (saved.get(s.student_id) ?? '–')}</td>
          </tr>
        ))}</tbody>
      </table></div>
      {state.error && <div className="alert error" role="alert">{state.error}</div>}
      {editable && <button type="submit" className="btn primary" disabled={!dirty || state.busy}>{state.busy ? 'กำลังบันทึก…' : 'บันทึกคะแนน'}</button>}
    </form>
  );
}

export default function Coursework({ scheduleId }) {
  const base = `/teacher/classes/${scheduleId}/coursework`;
  const { data, loading, error, reload } = useFetch(() => api(base), [scheduleId]);
  const [itemId, setItemId] = useState(null);
  const [form, setForm] = useState({ name: '', max_score: '' });
  const [msg, setMsg] = useState({ error: '', done: '' });

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (loading || !data) return <Loading rows={5} />;
  const item = data.items.find((i) => i.id === itemId) || data.items[data.items.length - 1];
  const sub = data.class.subjects || {};
  const totalMax = data.items.reduce((n, i) => n + i.max_score, 0);
  const totalOf = (id) => data.marks.filter((m) => m.student_id === id).reduce((n, m) => n + m.score, 0);

  async function add(e) {
    e.preventDefault();
    setMsg({ error: '', done: '' });
    try {
      const created = await api(base, { method: 'POST', body: { name: form.name, max_score: Number(form.max_score) } });
      setForm({ name: '', max_score: '' });
      setItemId(created.id);
      reload();
    } catch (err) {
      setMsg({ error: errorText(err), done: '' });
    }
  }
  async function remove() {
    if (!window.confirm(`ลบรายการ “${item.name}” และคะแนนของทุกคนในรายการนี้?`)) return;
    setMsg({ error: '', done: '' });
    try {
      await api(`${base}/${item.id}`, { method: 'DELETE' });
      setItemId(null);
      reload();
    } catch (err) {
      setMsg({ error: errorText(err), done: '' });
    }
  }

  return (
    <section className="card" aria-labelledby="cw-h">
      <header><h2 id="cw-h">คะแนนเก็บ · {sub.subject_code} {sub.subject_name} · {data.class.class_group}</h2></header>
      <Alert type="info">คะแนนเก็บแยกจากคะแนนรวม ไม่กระทบเกรดและ GPA · นักเรียนเห็นทันทีที่บันทึก</Alert>
      {data.editable && (
        <form className="filters" onSubmit={add} noValidate>
          <Field label="ชื่อรายการ" id="cw-name"><input id="cw-name" value={form.name} maxLength={80} placeholder="เช่น ใบงาน 1" onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="คะแนนเต็ม" id="cw-max"><input id="cw-max" type="number" min="1" max="100" value={form.max_score} onChange={(e) => setForm((f) => ({ ...f, max_score: e.target.value }))} /></Field>
          <button type="submit" className="btn" disabled={!form.name.trim() || !form.max_score}>เพิ่มรายการ</button>
        </form>
      )}
      {msg.error && <div className="alert error" role="alert">{msg.error}</div>}
      {msg.done && <p className="muted small" role="status">{msg.done}</p>}
      {!item ? <Empty text="ยังไม่มีรายการคะแนนเก็บ" /> : (
        <>
          <div className="filters">
            <div className="field">
              <label htmlFor="cw-item">รายการ</label>
              <select id="cw-item" value={item.id} onChange={(e) => { setItemId(Number(e.target.value)); setMsg({ error: '', done: '' }); }}>
                {data.items.map((i) => <option key={i.id} value={i.id}>{i.name} (เต็ม {i.max_score})</option>)}
              </select>
            </div>
            {data.editable && <button type="button" className="btn small" onClick={remove}>ลบรายการนี้</button>}
          </div>
          <Marks key={item.id} base={base} item={item} students={data.students} marks={data.marks} editable={data.editable}
            onSaved={(done) => { setMsg({ error: '', done }); setItemId(item.id); reload(); }} />
          <details style={{ marginTop: '.75rem' }}>
            <summary>ยอดคะแนนเก็บสะสมของทุกคน (เต็ม {totalMax})</summary>
            <div className="table-wrap"><table>
              <thead><tr><th>รหัส</th><th>ชื่อ-สกุล</th><th className="num">รวม</th></tr></thead>
              <tbody>{data.students.map((s) => (
                <tr key={s.student_id}><td>{s.student_id}</td><td>{s.full_name}</td><td className="num">{totalOf(s.student_id)}</td></tr>
              ))}</tbody>
            </table></div>
          </details>
        </>
      )}
    </section>
  );
}
