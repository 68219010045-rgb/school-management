import { Link, useParams, useSearchParams } from 'react-router-dom';
import Gradebook from '../components/Gradebook';
import { PageHeader } from '../components/UI';

// หน้าให้คะแนนของรายวิชาเดียว เปิดจากปุ่ม "คะแนน" ในหน้าวิชาที่สอน
export default function ScorePage() {
  const { scheduleId } = useParams();
  const [query] = useSearchParams();
  const termId = query.get('term_id');
  return (
    <>
      <PageHeader title="คะแนน" subtitle="บันทึกก่อนออกจากหน้านี้ ช่องที่ยังไม่บันทึกจะหาย">
        <Link className="btn" to={termId ? `/my-classes?term_id=${encodeURIComponent(termId)}` : '/my-classes'}>← กลับไปวิชาที่สอน</Link>
      </PageHeader>
      <Gradebook key={scheduleId} scheduleId={scheduleId} />
    </>
  );
}
