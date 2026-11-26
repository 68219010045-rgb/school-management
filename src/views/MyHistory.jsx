import { useState } from 'react';
import { api } from '../api';
import { Empty, ErrorBox, Loading, PageHeader, useFetch } from '../components/UI';
import { toThaiDate } from '../utils/thaiDate';

// ประวัติการขาด ลา มาสาย ของนักเรียนที่ล็อกอินอยู่ (ดูอย่างเดียว)
export default function MyHistory() {
  const { data, loading, error, reload } = useFetch(() => api('/student/me'), []);
  const [termId, setTermId] = useState('');

  if (loading) return <Loading rows={6} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const p = data.profile;
  const term = data.terms.find((t) => t.term_id === termId) || data.terms.find((t) => t.is_current) || data.terms[0];
  const att = term && term.attendance;

  return (
    <>
      <PageHeader title="ประวัติการขาด ลา มาสาย" subtitle={`${p.student_id} · ${p.full_name}`} />
      {!term ? <Empty text="ยังไม่มีข้อมูลการมาเรียน" /> : (
        <section className="card" aria-labelledby="hist-h">
          <header><h2 id="hist-h">ภาค {term.term_id}</h2></header>
          <div className="filters">
            <div className="field">
              <label htmlFor="term">ภาคเรียน</label>
              <select id="term" value={term.term_id} onChange={(e) => setTermId(e.target.value)}>
                {data.terms.map((t) => <option key={t.term_id} value={t.term_id}>{t.term_id}{t.is_current ? ' (ปัจจุบัน)' : ''}</option>)}
              </select>
            </div>
          </div>
          <p>รวมทั้งภาค: {att ? <><strong>ขาด {att.absent}</strong> วัน · <strong>ลา {att.leave}</strong> วัน · <strong>สาย {att.late}</strong> ครั้ง</> : 'ยังไม่มีข้อมูล'}</p>

          {term.is_current && (
            <>
              <h3>รายคาบ (จากการเช็คชื่อ)</h3>
              {term.history.length === 0 ? <Empty text="ไม่มีคาบที่ขาด ลา หรือสาย ในการเช็คชื่อ" /> : (
                <div className="table-wrap"><table>
                  <thead><tr><th>วันที่</th><th className="num">คาบ</th><th>วิชา</th><th>สถานะ</th></tr></thead>
                  <tbody>{term.history.map((h) => (
                    <tr key={`${h.date}-${h.period}-${h.subject}`}>
                      <td>{toThaiDate(h.date)}</td><td className="num">{h.period}</td><td>{h.subject}</td>
                      <td><span className={`tag ${h.status === 'ขาด' ? 'high' : 'mid'}`}>{h.status}</span></td>
                    </tr>
                  ))}</tbody>
                </table></div>
              )}
            </>
          )}

          <h3>รายสัปดาห์</h3>
          {term.weeks.length === 0 ? <Empty text="ไม่มีสัปดาห์ที่ขาด ลา หรือสาย" /> : (
            <div className="table-wrap"><table>
              <thead><tr><th className="num">สัปดาห์ที่</th><th>เริ่มวันที่</th><th className="num">ขาด (วัน)</th><th className="num">ลา (วัน)</th><th className="num">สาย (ครั้ง)</th></tr></thead>
              <tbody>{term.weeks.map((w) => (
                <tr key={w.week_no}>
                  <td className="num">{w.week_no}</td><td>{toThaiDate(w.week_start_date)}</td>
                  <td className="num">{w.absent}</td><td className="num">{w.leave}</td><td className="num">{w.late}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </section>
      )}
    </>
  );
}
