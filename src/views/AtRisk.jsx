import { useState } from 'react';
import { api } from '../api';
import { Alert, DataNote, Empty, ErrorBox, Loading, PageHeader, Pagination, fmt, useFetch } from '../components/UI';
import { toThaiDate } from '../utils/thaiDate';

const PAGE_SIZE = 15;
const pct = (v) => (v === null || v === undefined ? '–' : `${fmt(Number(v) * 100, 0)}%`);

// นักเรียนเสี่ยง (ภาค 1/2569) — ใช้รหัสเท่านั้น สำหรับครูที่ปรึกษา (handoff X6)
export default function AtRisk() {
  const [page, setPage] = useState(1);
  const [tier, setTier] = useState('');
  const meta = useFetch(() => api('/meta'), []);
  const { data, loading, error, reload } = useFetch(() => api('/at-risk', { params: { page, pageSize: PAGE_SIZE, tier } }), [page, tier]);

  return (
    <>
      <PageHeader title="นักเรียนเสี่ยง" subtitle="รายชื่อจากภาค 1/2569 แสดงด้วยรหัสนักเรียนเท่านั้น ส่งต่อให้ครูที่ปรึกษา" />
      <Alert type="warn" title="ข้อจำกัด:">เกณฑ์ (มาเรียน 70%/80% · GPA 1.50/2.00) ทีมข้อมูลกำหนดเอง ไม่มีกฎในการ์ดข้อมูล · ภาค 2/2569 ยังไม่จบ “แนวโน้มภาคปัจจุบัน” อาจดีขึ้นเพราะเป็นช่วงต้นภาค</Alert>
      <section className="card" aria-labelledby="risk-h">
        <header className="sticky-filters">
          <h2 id="risk-h">รายชื่อ <span className="count">({data ? fmt(data.total) : '…'})</span></h2>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="tier" className="sr-only">ระดับความเสี่ยง</label>
            <select id="tier" value={tier} onChange={(e) => { setTier(e.target.value); setPage(1); }}>
              <option value="">ทุกระดับความเสี่ยง</option><option>เสี่ยงสูง</option><option>เฝ้าระวัง</option>
            </select>
          </div>
        </header>
        {loading && <Loading rows={5} />}
        {error && <ErrorBox error={error} onRetry={reload} />}
        {data && !loading && (data.rows.length === 0 ? <Empty text="ไม่พบรายชื่อ" /> : (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">นักเรียนเสี่ยง</caption>
              <thead><tr><th>รหัส</th><th>แผนก</th><th>ระดับ</th><th>ความเสี่ยง</th><th>เหตุผล</th><th className="num">มาเรียน</th><th className="num">GPA</th><th className="num">เกรด 0</th><th className="num">ขาด/ลา (วัน)</th><th className="num">มาเรียนภาคนี้</th><th>แนวโน้ม</th></tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.student_id}>
                    <td><strong>{r.student_id}</strong></td><td>{r.department}</td><td>{r.level}</td>
                    <td><span className={`tag ${r.tier === 'เสี่ยงสูง' ? 'high' : 'mid'}`}>{r.tier}</span></td>
                    <td className="wrap">{r.reason}</td>
                    <td className="num">{pct(r.attendance_rate)}</td><td className="num">{fmt(r.gpa, 2)}</td><td className="num">{r.zero_grades}</td>
                    <td className="num">{r.days_absent}/{r.days_leave}</td><td className="num">{pct(r.attendance_now_2_2569)}</td>
                    <td>{r.trend_now}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
          </div>
        ))}
      </section>
      <DataNote asOf={meta.data ? toThaiDate(meta.data.data_dates.students) : '–'}>ใช้รหัสเท่านั้น ห้ามนำไปเผยแพร่บนหน้าสาธารณะ</DataNote>
    </>
  );
}
