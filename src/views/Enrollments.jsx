import { useState } from 'react';
import { api } from '../api';
import { DataNote, Empty, ErrorBox, Loading, PageHeader, Pagination, fmt, useFetch } from '../components/UI';
import { toThaiDate } from '../utils/thaiDate';

const PAGE_SIZE = 15;
const STATUS = {
  graded: ['มีเกรดแล้ว', 'ok'], pending_current_term: ['รอผล (ภาคปัจจุบัน)', 'info'],
  missing: ['คะแนนว่างในภาคที่จบแล้ว', 'warn'], invalid_removed: ['คะแนนผิดช่วง (ลบแล้ว)', 'bad'],
};

// แสดงผลการเรียนทีละหน้า ไม่ดึงทั้งตาราง (B3.4) ใช้รหัสนักเรียน ไม่แสดงชื่อ
export default function Enrollments() {
  const [page, setPage] = useState(1);
  const [termId, setTermId] = useState('');
  const [status, setStatus] = useState('');
  const [sid, setSid] = useState('');
  const meta = useFetch(() => api('/meta'), []);
  const validSid = /^S[0-9]{5}$/.test(sid.trim().toUpperCase()) ? sid.trim().toUpperCase() : '';
  const { data, loading, error, reload } = useFetch(
    () => api('/enrollments', { params: { page, pageSize: PAGE_SIZE, term_id: termId, score_status: status, student_id: validSid } }), [page, termId, status, validSid]);
  const reset = () => { setTermId(''); setStatus(''); setSid(''); setPage(1); };

  return (
    <>
      <PageHeader title="ผลการเรียน" subtitle="รายการลงทะเบียนเรียนและคะแนน (แสดงด้วยรหัสนักเรียน)" />
      <section className="card" aria-labelledby="enr-h">
        <header><h2 id="enr-h">รายการลงทะเบียน <span className="count">({data ? fmt(data.total) : '…'})</span></h2></header>
        <div className="filters sticky-filters">
          <div className="field">
            <label htmlFor="term">ภาคเรียน</label>
            <select id="term" value={termId} onChange={(e) => { setTermId(e.target.value); setPage(1); }}>
              <option value="">ทุกภาคเรียน</option>
              {meta.data && [...meta.data.terms].reverse().map((t) => <option key={t.term_id} value={t.term_id}>{t.term_id}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="st">สถานะคะแนน</label>
            <select id="st" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">ทั้งหมด</option>
              {Object.entries(STATUS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sid">รหัสนักเรียน</label>
            <input id="sid" value={sid} onChange={(e) => { setSid(e.target.value); setPage(1); }} maxLength={6} placeholder="เช่น S65001" />
          </div>
          <button type="button" className="btn" onClick={reset} disabled={!termId && !status && !sid}>ล้างตัวกรอง</button>
        </div>
        {loading && <Loading rows={5} />}
        {error && <ErrorBox error={error} onRetry={reload} />}
        {data && !loading && (data.rows.length === 0 ? <Empty text="ไม่พบรายการลงทะเบียนตามเงื่อนไข" /> : (
          <div className="table-wrap" style={{ marginTop: '.75rem' }}>
            <table>
              <caption className="sr-only">ผลการเรียน</caption>
              <thead><tr><th>ภาคเรียน</th><th>รหัสนักเรียน</th><th>วิชา</th><th>กลุ่มเรียน</th><th className="num">หน่วยกิต</th><th className="num">คะแนน</th><th className="num">เกรด</th><th>สถานะ</th></tr></thead>
              <tbody>
                {data.rows.map((r) => {
                  const sub = r.schedules && r.schedules.subjects; const [label] = STATUS[r.score_status] || [r.score_status];
                  return (
                    <tr key={r.enrollment_id}>
                      <td>{r.term_id}</td><td><strong>{r.student_id}</strong></td>
                      <td>{sub ? `${sub.subject_code} ${sub.subject_name}` : '–'}</td><td>{r.schedules && r.schedules.class_group}</td>
                      <td className="num">{sub ? sub.credits : '–'}</td><td className="num">{r.total_score ?? '–'}</td><td className="num">{r.grade ?? '–'}</td>
                      <td>{label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
          </div>
        ))}
      </section>
      <DataNote asOf={meta.data ? toThaiDate(meta.data.data_dates.enrollments) : '–'}>ภาคเรียนปัจจุบันยังไม่มีคะแนน (สถานะ “รอผล”)</DataNote>
    </>
  );
}
