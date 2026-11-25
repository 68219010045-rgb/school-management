// วันและคาบที่เช็คชื่อได้ของรายวิชา
const DAY_CODES = { 1: 'จ', 2: 'อ', 3: 'พ', 4: 'พฤ', 5: 'ศ' };
const STATUSES = ['มา', 'สาย', 'ลา', 'ขาด'];

/** วันที่ปัจจุบันตามเวลาไทย (เซิร์ฟเวอร์บน Vercel ใช้ UTC) */
const todayThai = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);

/** วันที่สอนจริง: ตรงวันในตาราง อยู่ในภาคเรียน และไม่เกินวันนี้ (เรียงใหม่ → เก่า) */
function sessionDates(dayOfWeek, startDate, endDate, today = todayThai()) {
  const out = [];
  const last = endDate < today ? endDate : today;
  for (let d = new Date(`${startDate}T00:00:00Z`); d.toISOString().slice(0, 10) <= last; d.setUTCDate(d.getUTCDate() + 1)) {
    if (DAY_CODES[d.getUTCDay()] === dayOfWeek) out.push(d.toISOString().slice(0, 10));
  }
  return out.reverse();
}

const classPeriods = (cls) => Array.from({ length: cls.periods }, (_, i) => cls.start_period + i).filter((p) => p <= 8);

module.exports = { STATUSES, todayThai, sessionDates, classPeriods };
