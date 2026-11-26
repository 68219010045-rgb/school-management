import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import Timetable from '../components/Timetable';
import { Empty, ErrorBox, Loading, PageHeader, useFetch } from '../components/UI';

const periodText = (c) => `${c.day_of_week || '–'} คาบ ${c.start_period}–${c.start_period + c.periods - 1}`;

export default function MyClasses() {
  const [query] = useSearchParams();
  const navigate = useNavigate();
  const [termId, setTermId] = useState(query.get('term_id') || '');
  const { data, loading, error, reload } = useFetch(() => api('/teacher/classes', { params: { term_id: termId } }), [termId]);
  const attendancePage = (id) => `/my-classes/${id}/attendance`;
  const scorePage = (id) => `/my-classes/${id}/scores?term_id=${encodeURIComponent(data.term_id)}`;

  return (
    <>
      <PageHeader title="วิชาที่สอน" subtitle="ตารางสอนของคุณ เลือกรายวิชาเพื่อเช็คชื่อหรือให้คะแนน" />
      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && <Loading rows={4} />}
      {data && !loading && (
        <section className="card" aria-labelledby="cls-h">
          <header><h2 id="cls-h">ตารางสอน <span className="count">({data.rows.length})</span></h2></header>
          <div className="filters">
            <div className="field">
              <label htmlFor="term">ภาคเรียน</label>
              <select id="term" value={data.term_id || ''} onChange={(e) => { setTermId(e.target.value); }}>
                {data.terms.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          {data.rows.length > 0 && <Timetable classes={data.rows} onSelect={(id) => navigate(data.editable ? attendancePage(id) : scorePage(id))} />}
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
                        {data.editable && <Link className="btn small" to={attendancePage(c.schedule_id)}>เช็คชื่อ</Link>}
                        <Link className="btn small" to={scorePage(c.schedule_id)}>{data.editable ? 'คะแนน' : 'ดูคะแนน'}</Link>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
