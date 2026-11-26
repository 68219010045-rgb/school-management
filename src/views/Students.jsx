import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Alert, DataNote, Empty, ErrorBox, Loading, PageHeader, Pagination, fmt, useDebounced, useFetch } from '../components/UI';
import { toThaiDate } from '../utils/thaiDate';

const LEVELS = ['ปวช.', 'ปวส.'];
const STATUSES = ['กำลังศึกษา', 'พักการเรียน', 'ลาออก', 'สำเร็จการศึกษา'];
const PAGE_SIZE = 15;

export default function Students() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const location = useLocation();
  const [flash, setFlash] = useState(location.state && location.state.flash);
  const [params, setParams] = useSearchParams();
  const get = (k, d = '') => params.get(k) || d;
  const page = Number(get('page', '1')) || 1;
  const sort = get('sort', 'student_id');
  const dir = get('dir', 'asc');

  const [q, setQ] = useState(get('q'));
  const debouncedQ = useDebounced(q);
  const meta = useFetch(() => api('/meta'), []);

  function update(patch) {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  }
  useEffect(() => { if (debouncedQ !== get('q')) update({ q: debouncedQ, page: '' }); /* eslint-disable-next-line */ }, [debouncedQ]);

  const { data, loading, error, reload } = useFetch(
    () => api('/students', { params: { q: get('q'), dept_id: get('dept_id'), level: get('level'), status: get('status'), gender: get('gender'), page, pageSize: PAGE_SIZE, sort, dir } }),
    [params.toString()],
  );

  const sortBy = (col) => update({ sort: col, dir: sort === col && dir === 'asc' ? 'desc' : 'asc', page: '' });
  const th = (col, label) => (
    <th aria-sort={sort === col ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="th-btn" onClick={() => sortBy(col)}>{label}{sort === col ? (dir === 'asc' ? ' ▲' : ' ▼') : ' ↕'}</button>
    </th>
  );
  const hasFilter = ['q', 'dept_id', 'level', 'status', 'gender'].some((k) => get(k));

  return (
    <>
      <PageHeader title="นักเรียน" subtitle="ค้นหา กรอง และเรียงลำดับรายชื่อนักเรียน" />
      {flash && <Alert type="success" onClose={() => setFlash(null)}>{flash}</Alert>}
      {!isAdmin && <Alert type="info">ชื่อ เบอร์โทร และวันเกิดของนักเรียนแสดงเฉพาะผู้ดูแล — บทบาทของคุณเห็นรหัสนักเรียนและข้อมูลที่ไม่ระบุตัวตน</Alert>}

      <section className="card" aria-labelledby="stu-h">
        <header>
          <h2 id="stu-h">รายชื่อนักเรียน <span className="count">({data ? fmt(data.total) : '…'})</span></h2>
          <div className="actions">
            {isAdmin && <Link to="/students/import" className="btn">นำเข้า CSV</Link>}
            {isAdmin && <Link to="/students/new" className="btn primary">เพิ่มนักเรียน</Link>}
          </div>
        </header>

        <div className="filters sticky-filters" role="search" aria-label="ค้นหาและกรอง">
          <div className="field grow">
            <label htmlFor="q">ค้นหา ({isAdmin ? 'รหัสหรือชื่อ' : 'รหัสนักเรียน'})</label>
            <input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} maxLength={60} placeholder={isAdmin ? 'เช่น S65001 หรือ ชื่อ' : 'เช่น S65001'} />
          </div>
          <div className="field">
            <label htmlFor="dept">แผนก</label>
            <select id="dept" value={get('dept_id')} onChange={(e) => update({ dept_id: e.target.value, page: '' })}>
              <option value="">ทุกแผนก</option>
              {meta.data && meta.data.departments.map((d) => <option key={d.dept_id} value={d.dept_id}>{d.dept_name_th}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="level">ระดับ</label>
            <select id="level" value={get('level')} onChange={(e) => update({ level: e.target.value, page: '' })}>
              <option value="">ทุกระดับ</option>{LEVELS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="status">สถานะ</label>
            <select id="status" value={get('status')} onChange={(e) => update({ status: e.target.value, page: '' })}>
              <option value="">ทุกสถานะ</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="gender">เพศ</label>
            <select id="gender" value={get('gender')} onChange={(e) => update({ gender: e.target.value, page: '' })}>
              <option value="">ทุกเพศ</option><option>ชาย</option><option>หญิง</option>
            </select>
          </div>
          <button type="button" className="btn" disabled={!hasFilter} onClick={() => { setQ(''); setParams({}, { replace: true }); }}>ล้างตัวกรอง</button>
        </div>

        {loading && <Loading rows={5} />}
        {error && <ErrorBox error={error} onRetry={reload} />}
        {data && !loading && (data.rows.length === 0 ? (
          <Empty text="ไม่พบนักเรียนที่ตรงกับเงื่อนไข">{hasFilter && <> · <button type="button" className="link-btn" onClick={() => { setQ(''); setParams({}, { replace: true }); }}>ล้างตัวกรอง</button></>}</Empty>
        ) : (
          <div className="table-wrap" style={{ marginTop: '.75rem' }}>
            <table>
              <caption className="sr-only">รายชื่อนักเรียน</caption>
              <thead>
                <tr>
                  {th('student_id', 'รหัส')}{isAdmin && <th>ชื่อ-สกุล</th>}<th>เพศ</th><th>แผนก</th>{th('level', 'ระดับ')}
                  {th('admission_date', 'วันที่เข้าเรียน')}{th('status', 'สถานะ')}<th className="num">ระยะทาง (กม.)</th>
                  {isAdmin && <th><span className="sr-only">จัดการ</span></th>}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((s) => (
                  <tr key={s.student_id}>
                    <td><strong>{s.student_id}</strong></td>
                    {isAdmin && <td>{s.full_name}</td>}
                    <td>{s.gender}</td><td>{s.departments && s.departments.dept_name_th}</td><td>{s.level}</td>
                    <td>{toThaiDate(s.admission_date)}</td>
                    <td>{s.status}</td>
                    <td className="num">{s.distance_km ?? '–'}</td>
                    {isAdmin && <td><Link to={`/students/${s.student_id}/edit`}>แก้ไข</Link></td>}
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={(p) => update({ page: String(p) })} />
          </div>
        ))}
      </section>
      <DataNote asOf={meta.data ? toThaiDate(meta.data.data_dates.students) : '–'}>นักเรียนทุกคนที่เคยมีชื่อในช่วง 6 ภาคเรียน · แสดงทีละ {PAGE_SIZE} รายการ</DataNote>
    </>
  );
}
