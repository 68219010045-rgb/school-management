import { useState } from 'react';
import { api } from '../api';
import { Empty, ErrorBox, Loading, PageHeader, useFetch } from '../components/UI';

// คะแนนเก็บรายรายการของนักเรียนที่ล็อกอินอยู่ (ดูอย่างเดียว)
export default function MyScores() {
  const { data, loading, error, reload } = useFetch(() => api('/student/me'), []);
  const [termId, setTermId] = useState('');

  if (loading) return <Loading rows={6} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const p = data.profile;
  const term = data.terms.find((t) => t.term_id === termId) || data.terms.find((t) => t.is_current) || data.terms[0];
  const courses = term ? term.courses.filter((c) => c.coursework.length) : [];

  return (
    <>
      <PageHeader title="คะแนนเก็บ" subtitle={`${p.student_id} · ${p.full_name}`} />
      {!term ? <Empty text="ยังไม่มีข้อมูลการลงทะเบียนเรียน" /> : (
        <section className="card" aria-labelledby="cw-h">
          <header><h2 id="cw-h">ภาค {term.term_id}</h2></header>
          <div className="filters">
            <div className="field">
              <label htmlFor="term">ภาคเรียน</label>
              <select id="term" value={term.term_id} onChange={(e) => setTermId(e.target.value)}>
                {data.terms.map((t) => <option key={t.term_id} value={t.term_id}>{t.term_id}{t.is_current ? ' (ปัจจุบัน)' : ''}</option>)}
              </select>
            </div>
          </div>
          <p className="muted small">คะแนนรวมและเกรดคิดให้เมื่อมีคะแนนครบทุกรายการ (รวม 100) · ยอดสะสมคิดเฉพาะรายการที่ครูกรอกแล้ว</p>
          {!courses.length ? <Empty text="ยังไม่มีคะแนนเก็บ" /> : courses.map((c) => {
            const done = c.coursework.filter((i) => i.score !== null);
            return (
              <div key={c.enrollment_id} style={{ marginBottom: '1rem' }}>
                <h3>{c.subject_code} {c.subject_name} · สะสม {done.reduce((n, i) => n + i.score, 0)} / {done.reduce((n, i) => n + i.max_score, 0)}</h3>
                <div className="table-wrap"><table>
                  <thead><tr><th>รายการ</th><th className="num">คะแนนที่ได้</th><th className="num">คะแนนเต็ม</th></tr></thead>
                  <tbody>{c.coursework.map((i) => (
                    <tr key={i.id}><td>{i.name}</td><td className="num">{i.score ?? 'ยังไม่มีคะแนน'}</td><td className="num">{i.max_score}</td></tr>
                  ))}</tbody>
                </table></div>
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}
