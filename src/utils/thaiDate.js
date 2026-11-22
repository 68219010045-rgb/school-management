// แสดงวันที่เป็น พ.ศ. ให้ผู้ใช้ แต่ฐานข้อมูลเก็บเป็น ค.ศ. (Y6.3)
const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** '2026-11-22' หรือ ISO timestamp -> '22 พ.ย. 2569' */
export function toThaiDate(value, { time = false } = {}) {
  if (!value) return '-';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = dateOnly ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  let out = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
  if (time && !dateOnly) out += ` ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} น.`;
  return out;
}

/** ปี ค.ศ./ภาค -> 'ภาค 1/2569' */
export const termLabel = (t) => (t ? `ภาค ${t.semester}/${t.year + 543}` : '-');

/** '2026/2' (จากฐานข้อมูล) -> '2/2569' */
export function termShort(s) {
  const [y, sem] = String(s).split('/');
  return `${sem}/${Number(y) + 543}`;
}
