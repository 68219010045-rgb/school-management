// เกณฑ์ตัดเกรดตามการ์ดข้อมูล (handoff/docs/cleaning_log.md ข้อ 5.5): 80+ = 4 … ต่ำกว่า 50 = 0
const BANDS = [[80, 4], [75, 3.5], [70, 3], [65, 2.5], [60, 2], [55, 1.5], [50, 1]];

function gradeFromScore(score) {
  if (score === null || score === undefined) return null;
  const band = BANDS.find(([min]) => score >= min);
  return band ? band[1] : 0;
}

/** GPA ถ่วงหน่วยกิต เฉพาะแถวที่มีเกรด (นิยามเดียวกับ KPI 2) */
function weightedGpa(rows) {
  let points = 0;
  let credits = 0;
  for (const r of rows) {
    if (r.score_status !== 'graded' || r.grade === null || !r.credits) continue;
    points += Number(r.grade) * Number(r.credits);
    credits += Number(r.credits);
  }
  return credits ? Math.round((points / credits) * 100) / 100 : null;
}

module.exports = { gradeFromScore, weightedGpa };
