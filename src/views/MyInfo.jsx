import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Empty, ErrorBox, Loading, PageHeader, fmt, useFetch } from '../components/UI';
import { toThaiDate } from '../utils/thaiDate';

// ข้อมูลของนักเรียนที่ล็อกอินอยู่เท่านั้น (ดูอย่างเดียว)
export default function MyInfo() {
  const { data, loading, error, reload } = useFetch(() => api('/student/me'), []);
  const [termId, setTermId] = useState('');

  if (loading) return <Loading rows={6} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const p = data.profile;
  const term = data.terms.find((t) => t.term_id === termId) || data.terms.find((t) => t.is_current) || data.terms[0];
  const att = term && term.attendance;

  return (
    <>
      <PageHeader title="ข้อมูลของฉัน" subtitle={`${p.student_id} · ${p.full_name}`}>
        <Link className="btn" to="/my-scores">คะแนนเก็บ</Link>
        <Link className="btn" to="/my-history">ประวัติการขาด ลา มาสาย</Link>
      </PageHeader>
      <section className="card" aria-labelledby="me-h">
        <header><h2 id="me-h">ข้อมูลส่วนตัว</h2></header>
        <div className="table-wrap">
          <table>
            <tbody>
              <tr><th scope="row">แผนก</th><td>{p.departments ? p.departments.dept_name_th : '–'}</td></tr>
              <tr><th scope="row">ระดับ</th><td>{p.level}</td></tr>
              <tr><th scope="row">สถานะ</th><td>{p.status}</td></tr>
              <tr><th scope="row">วันที่เข้าเรียน</th><td>{toThaiDate(p.admission_date)}</td></tr>
              <tr><th scope="row">วันเกิด</th><td>{toThaiDate(p.birth_date)}</td></tr>
              <tr><th scope="row">เบอร์โทร</th><td>{p.phone || '–'}</td></tr>
              <tr><th scope="row">เกรดเฉลี่ยสะสม</th><td><strong>{data.gpa === null ? '–' : fmt(data.gpa, 2)}</strong></td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {!term ? <Empty text="ยังไม่มีข้อมูลการลงทะเบียนเรียน" /> : (
        <section className="card" aria-labelledby="term-h">
          <header><h2 id="term-h">ตารางเรียน ผลการเรียน และการมาเรียน</h2></header>
          <div className="filters">
            <div className="field">
              <label htmlFor="term">ภาคเรียน</label>
              <select id="term" value={term.term_id} onChange={(e) => setTermId(e.target.value)}>
                {data.terms.map((t) => <option key={t.term_id} value={t.term_id}>{t.term_id}{t.is_current ? ' (ปัจจุบัน)' : ''}</option>)}
              </select>
            </div>
          </div>
          <p>เกรดเฉลี่ยภาคนี้: <strong>{term.gpa === null ? 'ยังไม่มีผล' : fmt(term.gpa, 2)}</strong></p>
          <p>การมาเรียน: {att
            ? <><strong>{fmt(att.rate, 1)}%</strong> · มา {att.present} วัน · ขาด {att.absent} วัน · ลา {att.leave} วัน · สาย {att.late} ครั้ง</>
            : 'ยังไม่มีข้อมูล'}</p>
          {term.courses.length === 0 ? <Empty text="ไม่มีวิชาที่ลงทะเบียนในภาคเรียนนี้" /> : (
            <div className="table-wrap">
              <table>
                <caption className="sr-only">วิชาที่ลงทะเบียน</caption>
                <thead><tr><th>วิชา</th><th>วันและคาบ</th><th>ห้อง</th><th className="num">หน่วยกิต</th><th className="num">คะแนน</th><th className="num">เกรด</th><th>เช็คชื่อรายคาบ</th></tr></thead>
                <tbody>
                  {term.courses.map((c) => (
                    <tr key={c.enrollment_id}>
                      <td>{c.subject_code} {c.subject_name}</td>
                      <td>{c.day_of_week ? `${c.day_of_week} คาบ ${c.start_period}–${c.start_period + c.periods - 1}` : '–'}</td>
                      <td>{c.room_id || '–'}</td><td className="num">{c.credits ?? '–'}</td>
                      <td className="num">{c.total_score ?? '–'}</td><td className="num">{c.grade ?? '–'}</td>
                      <td>{c.class_attendance ? Object.entries(c.class_attendance).map(([k, n]) => `${k} ${n}`).join(' · ') : '–'}</td>
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
