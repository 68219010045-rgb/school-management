import { useState } from 'react';
import { api } from '../api';
import { Alert, Empty, ErrorBox, Loading, fmt, useFetch } from './UI';

const errorText = (err) => (err.details && err.details[0] && err.details[0].message) || err.message;

// สมุดคะแนน: รายการคะแนนตายตัว 7 ช่องในตารางเดียว คะแนนรวมและเกรดคิดให้จากเซิร์ฟเวอร์
export default function Gradebook({ scheduleId }) {
  const base = `/teacher/classes/${scheduleId}`;
  const { data, loading, error, reload } = useFetch(
    () => Promise.all([api(base), api(`${base}/coursework`)]).then(([roster, work]) => ({ roster, work })), [scheduleId]);
  const [drafts, setDrafts] = useState({}); // เฉพาะช่องที่แก้และยังไม่บันทึก
  const [state, setState] = useState({ busy: false, error: '', done: '' });

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading rows={5} />;

  const { roster, work } = data;
  const { items, marks, editable } = work;
  const sub = roster.class.subjects || {};
  const saved = new Map(marks.map((m) => [`${m.item}|${m.student_id}`, m.score]));
  const valueOf = (key) => (key in drafts ? drafts[key] : saved.get(key) ?? '');
  const changed = Object.keys(drafts).filter((key) => String(drafts[key]) !== String(saved.get(key) ?? ''));

  const run = async (action, done) => {
    setState({ busy: true, error: '', done: '' });
    try {
      await action();
      reload();
      setState({ busy: false, error: '', done });
    } catch (err) {
      setState({ busy: false, error: errorText(err), done: '' });
    }
  };

  function save(e) {
    e.preventDefault();
    const records = changed.map((key) => {
      const [item, studentId] = key.split('|');
      return { item: Number(item), student_id: studentId, score: drafts[key] === '' ? null : Number(drafts[key]) };
    });
    const bad = records.find((r) => {
      const item = items[r.item - 1];
      return r.score !== null && !(Number.isInteger(r.score) && r.score >= 0 && r.score <= item.max_score);
    });
    if (bad) {
      const item = items[bad.item - 1];
      setState({ busy: false, done: '', error: `${bad.student_id} · ${item.name}: กรอกจำนวนเต็ม 0–${item.max_score}` });
      return;
    }
    run(async () => { await api(`${base}/coursework`, { method: 'PUT', body: { records } }); setDrafts({}); }, 'บันทึกคะแนนแล้ว');
  }

  return (
    <section className="card" aria-labelledby="gb-h">
      <header>
        <h2 id="gb-h">คะแนน · {sub.subject_code} {sub.subject_name} · {roster.class.class_group} <span className="count">({roster.rows.length} คน)</span></h2>
      </header>
      {!editable && <Alert type="info">ภาคเรียนนี้ไม่ใช่ภาคปัจจุบัน ดูคะแนนได้อย่างเดียว</Alert>}
      {editable && (
        <Alert type="info">รวม 100 คะแนน · คะแนนรวมและเกรดคิดให้เมื่อนักเรียนมีคะแนนครบทุกช่อง · นักเรียนเห็นทันทีที่บันทึก</Alert>
      )}
      {!roster.rows.length ? <Empty text="ยังไม่มีนักเรียนลงทะเบียน" /> : (
        <form onSubmit={save} noValidate>
          <div className="table-wrap">
            <table className="gradebook">
              <caption className="sr-only">สมุดคะแนน</caption>
              <colgroup>
                <col className="g-who" /><col className="g-watch" />
                {items.map((i) => <col key={i.item} />)}
                <col className="g-num" /><col className="g-num" /><col className="g-num" />
              </colgroup>
              <thead>
                <tr>
                  <th>นักเรียน</th><th>มาเรียน / เสี่ยง</th>
                  {items.map((i) => <th key={i.item} className="num">{i.name}<small>เต็ม {i.max_score}</small></th>)}
                  <th className="num">รวมที่ได้</th><th className="num">คะแนนรวม</th><th className="num">เกรด</th>
                </tr>
              </thead>
              <tbody>
                {roster.rows.map((r) => (
                  <tr key={r.student_id}>
                    <td><strong>{r.student_id}</strong><small>{r.full_name}</small></td>
                    <td>
                      {r.attendance_rate === null ? '–' : `${fmt(r.attendance_rate, 1)}%`}
                      {r.risk_tier && <small><span className={`tag ${r.risk_tier === 'เสี่ยงสูง' ? 'high' : 'mid'}`}>{r.risk_tier}</span></small>}
                    </td>
                    {items.map((i) => {
                      const key = `${i.item}|${r.student_id}`;
                      return (
                        <td key={i.item} className="num">
                          {editable ? (
                            <select aria-label={`${i.name} ของ ${r.student_id}`} value={valueOf(key)}
                              onChange={(e) => { setDrafts((d) => ({ ...d, [key]: e.target.value })); setState({ busy: false, error: '', done: '' }); }}>
                              <option value="">–</option>
                              {Array.from({ length: i.max_score + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                          ) : (saved.get(key) ?? '–')}
                        </td>
                      );
                    })}
                    <td className="num">{items.reduce((n, i) => n + (saved.get(`${i.item}|${r.student_id}`) ?? 0), 0)}</td>
                    <td className="num"><strong>{r.total_score ?? (editable ? 'รอผล' : '–')}</strong></td>
                    <td className="num">{r.grade ?? '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {state.error && <div className="alert error" role="alert">{state.error}</div>}
          {editable && (
            <div className="actions" style={{ marginTop: '.75rem' }}>
              <button type="submit" className="btn primary" disabled={state.busy || loading || !changed.length}>{state.busy ? 'กำลังบันทึก…' : 'บันทึกคะแนน'}</button>
              {changed.length > 0 && <span className="muted small">ยังไม่บันทึก {changed.length} ช่อง</span>}
              {state.done && <span className="muted small" role="status">{state.done}</span>}
            </div>
          )}
        </form>
      )}
    </section>
  );
}
