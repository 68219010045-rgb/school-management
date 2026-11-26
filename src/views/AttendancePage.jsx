import { Link, useParams, useSearchParams } from 'react-router-dom';
import Attendance from '../components/Attendance';
import { PageHeader } from '../components/UI';

// หน้าเช็คชื่อของรายวิชาเดียว เปิดจากปุ่ม "เช็คชื่อ" (?date= เลือกวันสอนให้เลย)
export default function AttendancePage() {
  const { scheduleId } = useParams();
  const [query] = useSearchParams();
  return (
    <>
      <PageHeader title="เช็คชื่อ" subtitle="บันทึกทีละคาบ และบันทึกก่อนเปลี่ยนวันหรือออกจากหน้านี้">
        <Link className="btn" to="/my-classes">← กลับไปวิชาที่สอน</Link>
      </PageHeader>
      <Attendance key={scheduleId} scheduleId={scheduleId} initialDate={query.get('date') || ''} />
    </>
  );
}
