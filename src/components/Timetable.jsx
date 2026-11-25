const DAYS = [['จ', 'จันทร์'], ['อ', 'อังคาร'], ['พ', 'พุธ'], ['พฤ', 'พฤหัสบดี'], ['ศ', 'ศุกร์']];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

// ตารางสอนรายสัปดาห์: วัน × คาบ กดช่องเพื่อเปิดรายวิชา
export default function Timetable({ classes, selected, onSelect }) {
  const at = (day, p) => classes.filter((c) => c.day_of_week === day && p >= c.start_period && p < c.start_period + c.periods);
  return (
    <div className="table-wrap" style={{ marginBottom: '1rem' }}>
      <table>
        <caption className="sr-only">ตารางสอนรายสัปดาห์</caption>
        <thead><tr><th>วัน / คาบ</th>{PERIODS.map((p) => <th key={p}>{p}</th>)}</tr></thead>
        <tbody>
          {DAYS.map(([code, name]) => (
            <tr key={code}>
              <th scope="row">{name}</th>
              {PERIODS.map((p) => (
                <td key={p} style={{ minWidth: 110, verticalAlign: 'top' }}>
                  {at(code, p).map((c) => (
                    <button type="button" key={c.schedule_id} className={`btn small block${selected === c.schedule_id ? ' primary' : ''}`}
                      style={{ flexDirection: 'column', gap: 0, borderRadius: 6 }} onClick={() => onSelect(c.schedule_id)}
                      aria-label={`${name} คาบ ${p} ${c.subjects ? c.subjects.subject_name : ''} ${c.class_group || ''}`}
                      title={`${c.subjects ? c.subjects.subject_name : ''} · ${c.class_group || ''}`}>
                      <span>{c.subjects && c.subjects.subject_code}</span>
                      <small>ห้อง {c.room_id || '–'}</small>
                    </button>
                  ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
