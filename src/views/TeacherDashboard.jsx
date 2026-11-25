import { Link } from 'react-router-dom';
import { api } from '../api';
import { Alert, Empty, ErrorBox, Loading, PageHeader, fmt, useFetch } from '../components/UI';
import { toThaiDate } from '../utils/thaiDate';

const PENDING_SHOWN = 8;
const periodRange = (c) => `คาบ ${c.start_period}–${c.start_period + c.periods - 1}`;
const link = (id, mode, date) => `/my-classes?class=${id}&mode=${mode}${date ? `&date=${date}` : ''}`;

function Stat({ label, value, unit, note }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{fmt(value)}<small>{unit}</small></div>
      {note && <div className="kpi-def">{note}</div>}
    </div>
  );
}

// สรุปภาคปัจจุบันของครู: วันนี้สอนอะไร ค้างอะไร และนักเรียนคนไหนควรดูแล
export default function TeacherDashboard() {
  const { data, loading, error, reload } = useFetch(() => api('/teacher/dashboard'), []);
  if (loading) return <Loading rows={6} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data.totals) return <><PageHeader title="แดชบอร์ดครู" /><Empty text="ไม่มีวิชาที่สอนในภาคเรียนปัจจุบัน" /></>;

  const t = data.totals;
  const name = (c) => (c.subjects ? `${c.subjects.subject_code} ${c.subjects.subject_name}` : c.schedule_id);
  const byId = new Map(data.classes.map((c) => [c.schedule_id, c]));

  return (
    <>
      <PageHeader title="แดชบอร์ดครู" subtitle={`ภาคเรียน ${data.term_id} · วันนี้ ${toThaiDate(data.today)}`} />

      <section className="card" aria-label="ตัวเลขสรุป">
        <div className="kpis">
          <Stat label="วิชาที่สอน" value={t.classes} unit="กลุ่ม" />
          <Stat label="นักเรียนที่สอน" value={t.students} unit="คน" note="นับไม่ซ้ำคน" />
          <Stat label="คาบสอนต่อสัปดาห์" value={t.periods_per_week} unit="คาบ" />
          <Stat label="คาบที่ยังไม่เช็คชื่อ" value={t.pending_periods} unit="คาบ" note="นับตั้งแต่เปิดภาคถึงวันนี้ ยังไม่หักวันหยุด" />
          <Stat label="คะแนนที่ยังไม่กรอก" value={t.scores_missing} unit="รายการ" />
          <Stat label="นักเรียนที่ควรดูแล" value={data.at_risk.length} unit="คน" note="จากรายชื่อเสี่ยงที่ประเมินเมื่อภาค 1/2569" />
        </div>
      </section>

      <section className="card" aria-labelledby="today-h">
        <header><h2 id="today-h">สอนวันนี้ <span className="count">({data.today_classes.length})</span></h2></header>
        {data.today_classes.length === 0 ? <Empty text="วันนี้ไม่มีคาบสอน" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>คาบ</th><th>วิชา</th><th>กลุ่มเรียน</th><th>ห้อง</th><th /></tr></thead>
              <tbody>
                {data.today_classes.map((c) => (
                  <tr key={c.schedule_id}>
                    <td>{periodRange(c)}</td><td>{name(c)}</td><td>{c.class_group}</td><td>{c.room_id || '–'}</td>
                    <td><Link className="btn small" to={link(c.schedule_id, 'attendance', data.today)}>เช็คชื่อ</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="pending-h">
        <header><h2 id="pending-h">ยังไม่ได้เช็คชื่อ <span className="count">({data.pending.length} ครั้งสอน)</span></h2></header>
        {data.pending.length === 0 ? <Empty text="เช็คชื่อครบทุกคาบแล้ว" /> : (
          <>
            <div className="table-wrap">
              <table>
                <thead><tr><th>วันที่</th><th>วิชา</th><th>คาบที่ค้าง</th><th /></tr></thead>
                <tbody>
                  {data.pending.slice(0, PENDING_SHOWN).map((p) => (
                    <tr key={`${p.schedule_id}-${p.date}`}>
                      <td>{toThaiDate(p.date)}</td><td>{name(byId.get(p.schedule_id))} · {byId.get(p.schedule_id).class_group}</td>
                      <td>{p.periods.join(', ')}</td>
                      <td><Link className="btn small" to={link(p.schedule_id, 'attendance', p.date)}>เช็คชื่อ</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.pending.length > PENDING_SHOWN && <p className="muted small">แสดง {PENDING_SHOWN} ครั้งล่าสุด จาก {data.pending.length}</p>}
          </>
        )}
      </section>

      <section className="card" aria-labelledby="progress-h">
        <header><h2 id="progress-h">ความคืบหน้ารายวิชา</h2></header>
        <div className="table-wrap">
          <table>
            <thead><tr><th>วิชา</th><th>กลุ่มเรียน</th><th className="num">นักเรียน</th><th className="num">เช็คชื่อแล้ว (คาบ)</th><th className="num">เข้าเรียน</th><th className="num">กรอกคะแนนแล้ว</th><th /></tr></thead>
            <tbody>
              {data.classes.map((c) => (
                <tr key={c.schedule_id}>
                  <td>{name(c)}</td><td>{c.class_group}</td><td className="num">{c.students}</td>
                  <td className="num">{c.periods_checked}/{c.periods_total}</td>
                  <td className="num">{c.attend_rate === null ? '–' : `${fmt(c.attend_rate, 1)}%`}</td>
                  <td className="num">{c.graded}/{c.students}</td>
                  <td><Link className="btn small" to={link(c.schedule_id, 'scores')}>กรอกคะแนน</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">“เข้าเรียน” = คาบที่มาหรือสาย ÷ คาบที่เช็คแล้ว จากการเช็คชื่อในระบบนี้</p>
      </section>

      <div className="charts">
        <section className="card" aria-labelledby="risk-h" style={{ gridColumn: '1 / -1' }}>
          <header><h2 id="risk-h">นักเรียนที่ควรดูแล <span className="count">({data.at_risk.length})</span></h2></header>
          <Alert type="info">เหตุผลและตัวเลขเป็นของภาค 1/2569 ทั้งภาครวมทุกวิชา ไม่อัปเดตตามการเช็คชื่อหรือคะแนนภาคนี้</Alert>
          {data.at_risk.length === 0 ? <Empty text="ไม่มี" /> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>รหัส</th><th>ชื่อ-สกุล</th><th>ระดับ</th><th>เหตุผล</th><th className="num">มาเรียน</th><th className="num">GPA</th><th className="num">เกรด 0 (วิชา)</th><th className="num">ขาด / ลา (วัน)</th></tr></thead>
                <tbody>
                  {data.at_risk.map((r) => (
                    <tr key={r.student_id}>
                      <td><strong>{r.student_id}</strong></td><td>{r.full_name}</td>
                      <td><span className={`tag ${r.tier === 'เสี่ยงสูง' ? 'high' : 'mid'}`}>{r.tier}</span></td>
                      <td><strong>{r.reason || '–'}</strong></td>
                      <td className="num">{r.attendance_rate === null ? '–' : `${fmt(r.attendance_rate * 100, 0)}%`}</td>
                      <td className="num">{fmt(r.gpa, 2)}</td>
                      <td className="num">{r.zero_grades ?? '–'}</td>
                      <td className="num">{r.days_absent ?? '–'} / {r.days_leave ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="absent-h">
          <header><h2 id="absent-h">ขาดเรียนมากที่สุดภาคนี้</h2></header>
          {data.absentees.length === 0 ? <Empty text="ยังไม่มีการบันทึกว่าขาดเรียน" /> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>รหัส</th><th>ชื่อ-สกุล</th><th className="num">ขาด (คาบ)</th></tr></thead>
                <tbody>
                  {data.absentees.map((r) => (
                    <tr key={r.student_id}><td><strong>{r.student_id}</strong></td><td>{r.full_name}</td><td className="num">{r.periods}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
