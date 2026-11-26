import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import {
  AttendanceGpa, DropoutByDept, GpaBox, Residuals, RoomHeatmap, ScoreHist, StudentsPerTerm, WeeklyAttendance,
} from '../components/Charts';
import { Alert, DataNote, ErrorBox, Loading, PageHeader, Tabs, fmt, useFetch } from '../components/UI';
import { toThaiDate } from '../utils/thaiDate';

function Kpi({ label, value, unit, def, sub }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value ?? '–'}{value != null && unit && <small>{unit}</small>}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
      <div className="kpi-def">{def}</div>
    </div>
  );
}

const TABS = [
  { id: 'trend', label: 'แนวโน้ม' },
  { id: 'grades', label: 'ผลการเรียน' },
  { id: 'rooms', label: 'ห้องเรียน' },
  { id: 'model', label: 'ตรวจโมเดล' },
];

export default function Dashboard() {
  const { role } = useAuth();
  const [termId, setTermId] = useState('');
  const [deptId, setDeptId] = useState('');
  const [tab, setTab] = useState('trend');
  const [showInfo, setShowInfo] = useState(true);

  const meta = useFetch(() => api('/meta'), []);
  const dash = useFetch(() => api('/dashboard', { params: { term_id: termId, dept_id: deptId } }), [termId, deptId]);
  useEffect(() => { document.title = 'แดชบอร์ดผู้บริหาร · ระบบจัดการโรงเรียน'; }, []);

  const d = dash.data;
  const dept = meta.data && meta.data.departments.find((x) => x.dept_id === deptId);
  const termLabel = termId ? `ภาค ${termId}` : 'ทุกภาคเรียนที่มีเกรด';
  const deptName = dept ? dept.dept_name_th : 'ทุกแผนก';
  const currentTerm = useMemo(() => meta.data && meta.data.terms.find((t) => t.is_current), [meta.data]);
  const asOf = meta.data ? toThaiDate(meta.data.data_dates.students) : '–';
  const reset = () => { setTermId(''); setDeptId(''); };

  return (
    <>
      <PageHeader title="แดชบอร์ดผู้บริหาร" subtitle="ตัวชี้วัด 6 ตัวและกราฟ 8 รูป สรุปจากฐานข้อมูลตามนิยามใน KPI dictionary" />

      {showInfo && meta.data && (
        <Alert type="info" onClose={() => setShowInfo(false)} title={`ข้อมูล ณ วันที่ ${asOf}`}>
          {currentTerm ? `ภาค ${currentTerm.term_id} ยังไม่จบและยังไม่มีคะแนน จึงไม่ถูกนับในเกรดเฉลี่ยและกราฟผลการเรียน · ` : ''}
          ครูและห้องส่งออกเมื่อ {toThaiDate(meta.data.data_dates.teachers)} · งานซ่อมส่งออกเมื่อ {toThaiDate(meta.data.data_dates.maintenance_requests)}
        </Alert>
      )}

      <section className="card filters sticky-filters" aria-label="ตัวกรอง">
        <div className="field">
          <label htmlFor="f-term">ภาคเรียน</label>
          <select id="f-term" value={termId} onChange={(e) => setTermId(e.target.value)}>
            <option value="">ทุกภาคเรียน</option>
            {meta.data && [...meta.data.terms].reverse().map((t) => <option key={t.term_id} value={t.term_id}>{t.term_id}{t.is_current ? ' (ภาคปัจจุบัน — ยังไม่จบ)' : ''}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-dept">แผนก</label>
          <select id="f-dept" value={deptId} onChange={(e) => setDeptId(e.target.value)}>
            <option value="">ทุกแผนก</option>
            {meta.data && meta.data.departments.map((x) => <option key={x.dept_id} value={x.dept_id}>{x.dept_name_th}</option>)}
          </select>
        </div>
        <button type="button" className="btn" onClick={reset} disabled={!termId && !deptId}>ล้างตัวกรอง</button>
      </section>

      {meta.error && <ErrorBox error={meta.error} onRetry={meta.reload} />}
      {dash.error && <ErrorBox error={dash.error} onRetry={dash.reload} />}
      {dash.loading && !d && <Loading rows={4} />}

      {d && (
        <div aria-busy={dash.loading}>
          <section className="card" aria-labelledby="kpi-h">
            <header><div><h2 id="kpi-h">ตัวชี้วัดหลัก</h2><p>{termLabel} · {deptName}</p></div></header>
            <div className="kpis">
              <Kpi label="อัตราการมาเรียน" value={fmt(d.kpi.attendance_rate, 1)} unit="%" def="วันมา ÷ (มา + ขาด + ลา) · ไม่นับแถวที่วันไม่รวมกัน (KPI 1)" />
              <Kpi label="เกรดเฉลี่ย (ถ่วงหน่วยกิต)" value={fmt(d.kpi.gpa, 2)} def="Σ(เกรด × หน่วยกิต) ÷ Σหน่วยกิต เฉพาะภาคที่มีเกรดแล้ว นับเกรด 0 (KPI 2)" />
              <Kpi label="อัตราลาออก รุ่น 2024" value={fmt(d.kpi.dropout_rate, 1)} unit="%" sub={`จากนักเรียนรุ่น 2024 ${fmt(d.kpi.dropout_n)} คน`} def="คิดรายรุ่น ไม่นับพักการเรียน · ไม่ขึ้นกับภาคเรียนที่เลือก (KPI 3)" />
              <Kpi label={`อัตราการใช้ห้อง (${termId || '1/2569'})`} value={fmt(d.kpi.room_util, 1)} unit="%" def="คาบที่ใช้ ÷ 40 คาบต่อสัปดาห์ เฉลี่ยทุกห้อง ห้องว่างนับ 0% (KPI 4)" />
              <Kpi label="ภาระสอนไม่ตรงทะเบียน" value={fmt(d.kpi.teach_mismatch)} unit=" คน" sub={`เทียบไม่ได้อีก ${fmt(d.kpi.teach_incomparable)} คน`} def="คาบจริงในตารางสอน ≠ weekly_teach_hours (KPI 5)" />
              <Kpi label="งานซ่อมค้างเกิน 90 วัน" value={fmt(d.kpi.repairs_overdue)} unit=" งาน" sub={`ด่วนสูง ${fmt(d.kpi.repairs_overdue_high)} งาน · เปิดอยู่ทั้งหมด ${fmt(d.kpi.repairs_open)}`} def={`สถานะเปิด/กำลังดำเนินการ นับถึง ${toThaiDate(d.kpi.data_dates.maintenance_requests)} (KPI 6)`} />
            </div>
          </section>

          <Tabs tabs={TABS} value={tab} onChange={setTab} label="กลุ่มกราฟ" />
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="charts">
            {tab === 'trend' && (<>
              <StudentsPerTerm rows={d.charts.students_per_term} departments={meta.data ? meta.data.departments : []} deptId={deptId} />
              <WeeklyAttendance rows={d.charts.weekly_attendance.rows} anomalies={d.charts.weekly_attendance.anomalies} />
              <DropoutByDept rows={d.charts.dropout_by_dept} deptId={deptId} />
            </>)}
            {tab === 'grades' && (<>
              <ScoreHist data={d.charts.score_hist} termLabel={termLabel} deptName={deptName} />
              <AttendanceGpa data={d.charts.attendance_gpa} termLabel={termLabel} deptName={deptName} />
              <GpaBox rows={d.charts.gpa_box} termLabel={termLabel} />
            </>)}
            {tab === 'rooms' && <RoomHeatmap data={d.charts.room_heatmap} />}
            {tab === 'model' && <Residuals data={d.charts.residuals} />}
          </div>

          {d.kpi.repairs_overdue > 0 && role === 'admin' && (
            <Alert type="warn" title="แจ้งเตือน:">มีงานซ่อมค้างเกิน 90 วัน {d.kpi.repairs_overdue} งาน และภาระสอนไม่ตรงทะเบียน {d.kpi.teach_mismatch} คน — ดู <Link to="/tasks">งานที่ควรทำ</Link></Alert>
          )}
          <DataNote asOf={asOf}>
            กราฟใช้ข้อมูลสรุปจากฐานข้อมูลตามนิยามใน KPI dictionary · แนวโน้มไม่ขึ้นกับตัวกรองภาคเรียน, อัตราลาออกคิดรายรุ่น, กราฟผลการเรียนครอบคลุมเฉพาะภาคที่จบแล้ว ·
            ความสัมพันธ์ไม่ใช่เหตุและผล
          </DataNote>
        </div>
      )}
    </>
  );
}
