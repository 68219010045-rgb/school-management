import { useState } from 'react';
import { api } from '../api';
import { toThaiDate } from '../utils/thaiDate';
import { Alert, Empty, ErrorBox, Loading, useFetch } from './UI';

const MARKS = ['มา', 'สาย', 'ลา', 'ขาด'];

const byPeriod = (records) => records.reduce((all, r) => {
  (all[r.period] = all[r.period] || {})[r.student_id] = r.status;
  return all;
}, {});

// เช็คชื่อของวันเดียว แยกแท็บตามคาบ
function Sheet({ scheduleId, data }) {
  const [saved, setSaved] = useState(() => byPeriod(data.records));
  const [drafts, setDrafts] = useState({});
  const [period, setPeriod] = useState(data.periods[0]);
  const [state, setState] = useState({ busy: false, error: '', done: '' });

  // คาบที่ยังไม่เคยบันทึก ใช้ผลของคาบก่อนหน้าเป็นค่าเริ่มต้น
  const marksOf = (p) => {
    if (drafts[p]) return drafts[p];
    if (saved[p]) return saved[p];
    const i = data.periods.indexOf(p);
    return i > 0 ? marksOf(data.periods[i - 1]) : {};
  };
  const marks = marksOf(period);
  const missing = data.students.filter((s) => !marks[s.student_id]).length;
  const isSaved = Boolean(saved[period]) && !drafts[period];
  const copied = !saved[period] && !drafts[period] && Object.keys(marks).length > 0;

  const change = (next) => {
    setDrafts((d) => ({ ...d, [period]: next }));
    setState({ busy: false, error: '', done: '' });
  };
  const toggle = (id, m) => {
    const next = { ...marks };
    if (next[id] === m) delete next[id]; else next[id] = m;
    change(next);
  };
  const allPresent = () => change(Object.fromEntries(data.students.map((s) => [s.student_id, 'มา'])));

  async function save() {
    setState({ busy: true, error: '', done: '' });
    try {
      const records = data.students.map((s) => ({ student_id: s.student_id, status: marks[s.student_id] }));
      const res = await api(`/teacher/classes/${scheduleId}/attendance`, { method: 'PUT', body: { date: data.date, period, records } });
      setSaved(byPeriod(res.records));
      setDrafts((d) => { const n = { ...d }; delete n[period]; return n; });
      setState({ busy: false, error: '', done: `บันทึกคาบ ${period} แล้ว` });
    } catch (err) {
      setState({ busy: false, done: '', error: (err.details[0] && err.details[0].message) || err.message });
    }
  }

  return (
    <>
      <div className="tabs" role="group" aria-label="เลือกคาบ">
        {data.periods.map((p) => (
          <button key={p} type="button" aria-pressed={p === period} className={`btn small${p === period ? ' primary' : ''}`}
            onClick={() => { setPeriod(p); setState({ busy: false, error: '', done: '' }); }}>
            คาบ {p}{saved[p] ? ' ✓' : ''}
          </button>
        ))}
      </div>
      {copied && <Alert type="info">คัดลอกผลจากคาบก่อนหน้ามาให้ แก้เฉพาะคนที่เปลี่ยนแล้วกดบันทึก (คาบนี้ยังไม่ถูกบันทึก)</Alert>}
      <div className="actions" style={{ margin: '.5rem 0' }}>
        <button type="button" className="btn small" onClick={allPresent}>มาทั้งหมด</button>
        <span className="muted small">กดปุ่มที่เลือกแล้วอีกครั้งเพื่อเปลี่ยน</span>
      </div>
      <div className="table-wrap">
        <table>
          <caption className="sr-only">เช็คชื่อคาบ {period}</caption>
          <thead><tr><th>รหัส</th><th>ชื่อ-สกุล</th><th>สถานะ</th></tr></thead>
          <tbody>
            {data.students.map((s) => (
              <tr key={s.student_id}>
                <td><strong>{s.student_id}</strong></td>
                <td>{s.full_name}</td>
                <td>
                  <div className="actions" role="group" aria-label={`สถานะของ ${s.student_id}`}>
                    {/* เลือกแล้วเหลือปุ่มเดียว กดปุ่มนั้นอีกครั้งเพื่อเลือกใหม่ */}
                    {MARKS.filter((m) => !marks[s.student_id] || marks[s.student_id] === m).map((m) => (
                      <button key={m} type="button" className={`btn small${marks[s.student_id] === m ? ' primary' : ''}`}
                        aria-pressed={marks[s.student_id] === m} title={marks[s.student_id] ? 'กดเพื่อเลือกใหม่' : undefined}
                        onClick={() => toggle(s.student_id, m)}>{m}</button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="actions" style={{ marginTop: '.75rem' }}>
        <button type="button" className="btn primary" onClick={save} disabled={state.busy || missing > 0 || isSaved}>
          {state.busy ? 'กำลังบันทึก…' : `บันทึกคาบ ${period}`}
        </button>
        {missing > 0 && <span className="muted small">ยังไม่ได้เช็ค {missing} คน</span>}
        {state.done && <span className="muted small" role="status">{state.done}</span>}
      </div>
      {state.error && <div className="alert error" role="alert">{state.error}</div>}
    </>
  );
}

export default function Attendance({ scheduleId, initialDate = '' }) {
  const [date, setDate] = useState(initialDate);
  const { data, loading, error, reload } = useFetch(
    () => api(`/teacher/classes/${scheduleId}/attendance`, { params: { date } }), [scheduleId, date]);
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading rows={5} />;
  const sub = data.class.subjects || {};
  return (
    <section className="card" aria-labelledby="att-h">
      <header><h2 id="att-h">เช็คชื่อ · {sub.subject_code} {sub.subject_name} · {data.class.class_group}</h2></header>
      {!data.date ? <Empty text="ยังไม่มีวันสอนที่เช็คชื่อได้ในภาคเรียนนี้" /> : (
        <>
          <div className="filters">
            <div className="field">
              <label htmlFor="att-date">วันที่สอน</label>
              <select id="att-date" value={data.date} onChange={(e) => setDate(e.target.value)}>
                {data.dates.map((d) => <option key={d} value={d}>{toThaiDate(d)}</option>)}
              </select>
            </div>
          </div>
          {loading || data.class.schedule_id !== scheduleId
            ? <Loading rows={5} />
            : data.students.length === 0 ? <Empty text="ยังไม่มีนักเรียนลงทะเบียน" />
              : <Sheet key={data.date} scheduleId={scheduleId} data={data} />}
        </>
      )}
    </section>
  );
}
