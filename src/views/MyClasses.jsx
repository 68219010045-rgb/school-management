import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import Attendance from '../components/Attendance';
import Coursework from '../components/Coursework';
import Timetable from '../components/Timetable';
import { Alert, Empty, ErrorBox, Loading, PageHeader, fmt, useFetch } from '../components/UI';

const periodText = (c) => `${c.day_of_week || '–'} คาบ ${c.start_period}–${c.start_period + c.periods - 1}`;

// ช่องกรอกคะแนนหนึ่งแถว: บันทึกด้วยปุ่มหรือกด Enter เซิร์ฟเวอร์เป็นคนคิดเกรด
function ScoreRow({ row, editable }) {
  const [saved, setSaved] = useState(row);
  const [value, setValue] = useState(row.total_score ?? '');
  const [state, setState] = useState({ busy: false, error: '', done: false });
  const dirty = String(value) !== String(saved.total_score ?? '');

  async function save(e) {
    e.preventDefault();
    if (!dirty) return;
    const score = value === '' ? null : Number(value);
    if (score !== null && !(Number.isInteger(score) && score >= 0 && score <= 100)) {
      setState({ busy: false, done: false, error: 'กรอกจำนวนเต็ม 0–100' });
      return;
    }
    setState({ busy: true, error: '', done: false });
    try {
      const data = await api(`/teacher/enrollments/${row.enrollment_id}`, { method: 'PUT', body: { total_score: score } });
      setSaved(data);
      setValue(data.total_score ?? '');
      setState({ busy: false, error: '', done: true });
    } catch (err) {
      setState({ busy: false, done: false, error: (err.details[0] && err.details[0].message) || err.message });
    }
  }

  return (
    <tr>
      <td><strong>{row.student_id}</strong></td>
      <td>{row.full_name}</td>
      <td className="num">{row.attendance_rate === null ? '–' : `${fmt(row.attendance_rate, 1)}%`}</td>
      <td>{row.risk_tier ? <span className={`tag ${row.risk_tier === 'เสี่ยงสูง' ? 'high' : 'mid'}`}>{row.risk_tier}</span> : '–'}</td>
      <td style={{ minWidth: 190 }}>
        {editable ? (
          <form onSubmit={save} noValidate style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
            <input type="number" min="0" max="100" step="1" inputMode="numeric" style={{ width: '6rem' }}
              aria-label={`คะแนนของ ${row.student_id}`} value={value}
              onChange={(e) => { setValue(e.target.value); setState({ busy: false, error: '', done: false }); }} />
            <button type="submit" className="btn small" disabled={!dirty || state.busy}>{state.busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
          </form>
        ) : (saved.total_score ?? '–')}
        {state.error && <small className="err" role="alert">{state.error}</small>}
        {state.done && <small className="muted" role="status">บันทึกแล้ว</small>}
      </td>
      <td className="num">{saved.grade ?? '–'}</td>
    </tr>
  );
}

function Roster({ scheduleId }) {
  const { data, loading, error, reload } = useFetch(() => api(`/teacher/classes/${scheduleId}`), [scheduleId]);
  if (loading) return <Loading rows={5} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const sub = data.class.subjects || {};
  return (
    <section className="card" aria-labelledby="roster-h">
      <header>
        <h2 id="roster-h">{sub.subject_code} {sub.subject_name} · {data.class.class_group} <span className="count">({data.rows.length} คน)</span></h2>
      </header>
      {!data.editable && <Alert type="info">ภาคเรียนนี้ไม่ใช่ภาคปัจจุบัน ดูคะแนนได้อย่างเดียว</Alert>}
      {data.editable && <p className="muted small">คะแนนรวมเป็นจำนวนเต็ม 0–100 · บันทึกทีละคน · เว้นว่างแล้วบันทึกเพื่อล้างคะแนน · ทุกการแก้ไขถูกบันทึกในประวัติ</p>}
      {data.rows.length === 0 ? <Empty text="ยังไม่มีนักเรียนลงทะเบียน" /> : (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">รายชื่อนักเรียนและคะแนน</caption>
            <thead><tr><th>รหัส</th><th>ชื่อ-สกุล</th><th className="num">มาเรียน</th><th>ความเสี่ยง</th><th>คะแนนรวม</th><th className="num">เกรด</th></tr></thead>
            <tbody>{data.rows.map((r) => <ScoreRow key={r.enrollment_id} row={r} editable={data.editable} />)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function MyClasses() {
  const [termId, setTermId] = useState('');
  const [query] = useSearchParams();
  const [selected, setSelected] = useState(query.get('class') || '');
  const [mode, setMode] = useState(query.get('mode') === 'attendance' ? 'attendance' : 'scores');
  const open = (id, next) => { setSelected(id); setMode(next); };
  const { data, loading, error, reload } = useFetch(() => api('/teacher/classes', { params: { term_id: termId } }), [termId]);

  return (
    <>
      <PageHeader title="วิชาที่สอน" subtitle="ตารางสอนของคุณ เลือกรายวิชาเพื่อเช็คชื่อหรือกรอกคะแนน" />
      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && <Loading rows={4} />}
      {data && !loading && (
        <section className="card" aria-labelledby="cls-h">
          <header><h2 id="cls-h">ตารางสอน <span className="count">({data.rows.length})</span></h2></header>
          <div className="filters">
            <div className="field">
              <label htmlFor="term">ภาคเรียน</label>
              <select id="term" value={data.term_id || ''} onChange={(e) => { setTermId(e.target.value); setSelected(''); }}>
                {data.terms.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          {data.rows.length > 0 && <Timetable classes={data.rows} selected={selected} onSelect={(id) => open(id, data.editable ? 'attendance' : 'scores')} />}
          {data.rows.length === 0 ? <Empty text="ไม่มีวิชาที่สอนในภาคเรียนนี้" /> : (
            <div className="table-wrap">
              <table>
                <caption className="sr-only">ตารางสอน</caption>
                <thead><tr><th>วิชา</th><th>กลุ่มเรียน</th><th>วันและคาบ</th><th>ห้อง</th><th /></tr></thead>
                <tbody>
                  {data.rows.map((c) => (
                    <tr key={c.schedule_id}>
                      <td>{c.subjects && `${c.subjects.subject_code} ${c.subjects.subject_name}`}</td>
                      <td>{c.class_group}</td><td>{periodText(c)}</td><td>{c.room_id || '–'}</td>
                      <td><div className="actions">
                        {data.editable && <button type="button" className={`btn small${selected === c.schedule_id && mode === 'attendance' ? ' primary' : ''}`}
                          aria-pressed={selected === c.schedule_id && mode === 'attendance'} onClick={() => open(c.schedule_id, 'attendance')}>เช็คชื่อ</button>}
                        <button type="button" className={`btn small${selected === c.schedule_id && mode === 'coursework' ? ' primary' : ''}`}
                          aria-pressed={selected === c.schedule_id && mode === 'coursework'} onClick={() => open(c.schedule_id, 'coursework')}>คะแนนเก็บ</button>
                        <button type="button" className={`btn small${selected === c.schedule_id && mode === 'scores' ? ' primary' : ''}`}
                          aria-pressed={selected === c.schedule_id && mode === 'scores'} onClick={() => open(c.schedule_id, 'scores')}>
                          {data.editable ? 'กรอกคะแนน' : 'ดูคะแนน'}</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {selected && mode === 'coursework' && <Coursework key={`c-${selected}`} scheduleId={selected} />}
      {selected && mode !== 'coursework' && (mode === 'attendance'
        ? <Attendance key={`a-${selected}`} scheduleId={selected} initialDate={selected === query.get('class') ? query.get('date') || '' : ''} />
        : <Roster key={`s-${selected}`} scheduleId={selected} />)}
    </>
  );
}
