import { useState } from 'react';
import { api } from '../api';
import { DataNote, Empty, ErrorBox, Loading, PageHeader, Pagination, fmt, useFetch } from '../components/UI';
import { toThaiDate } from '../utils/thaiDate';

const PAGE_SIZE = 10;
const show = (o) => (o ? Object.entries(o).map(([k, v]) => `${k}: ${v ?? '(ว่าง)'}`).join(' · ') : '–');

export default function ChangeLog() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch(() => api('/changelog', { params: { page, pageSize: PAGE_SIZE } }), [page]);
  return (
    <>
      <PageHeader title="ประวัติการแก้ไข" subtitle="ทุกการเพิ่ม/แก้ไข/นำเข้า บันทึกว่าใคร เมื่อไร ค่าก่อน และค่าหลัง (ฟิลด์ส่วนบุคคลไม่บันทึกค่า)" />
      <section className="card" aria-labelledby="cl-h">
        <header><h2 id="cl-h">รายการ <span className="count">({data ? fmt(data.total) : '…'})</span></h2></header>
        {loading && <Loading rows={4} />}
        {error && <ErrorBox error={error} onRetry={reload} />}
        {data && !loading && (data.rows.length === 0 ? <Empty text="ยังไม่มีประวัติการแก้ไข — เมื่อผู้ดูแลเพิ่ม/แก้ไขข้อมูลจะปรากฏที่นี่" /> : (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">ประวัติการแก้ไข</caption>
              <thead><tr><th>เมื่อไร</th><th>ใคร</th><th>การกระทำ</th><th>ตาราง</th><th>รายการ</th><th>ค่าก่อน</th><th>ค่าหลัง</th></tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id}>
                    <td>{toThaiDate(r.changed_at, { time: true })}</td><td>{r.actor_email}</td><td>{r.action}</td><td>{r.table_name}</td><td>{r.record_id}</td>
                    {/* แสดงเป็นข้อความธรรมดา React escape ให้อัตโนมัติ (Y4.2) */}
                    <td className="wrap">{show(r.before_data)}</td><td className="wrap">{show(r.after_data)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
          </div>
        ))}
      </section>
      <DataNote asOf={toThaiDate(new Date().toISOString(), { time: true })}>เรียงจากรายการล่าสุด</DataNote>
    </>
  );
}
