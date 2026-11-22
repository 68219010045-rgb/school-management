const test = require('node:test');
const assert = require('node:assert/strict');
const { solve, ols, regressionDiagnostics, weeklyAnomalies } = require('../src/stats');

test('solve: แก้ระบบสมการ 2 ตัวแปร', () => {
  const x = solve([[2, 1], [1, 3]], [5, 10]); // 2x+y=5, x+3y=10 → x=1, y=3
  assert.ok(Math.abs(x[0] - 1) < 1e-9 && Math.abs(x[1] - 3) < 1e-9);
});

test('ols: ข้อมูลเส้นตรง y = 2 + 3x ได้ R² = 1 และส่วนเหลือเป็น 0', () => {
  const xs = [0, 1, 2, 3, 4, 5];
  const r = ols(xs.map((x) => [1, x]), xs.map((x) => 2 + 3 * x));
  assert.ok(Math.abs(r.beta[0] - 2) < 1e-9 && Math.abs(r.beta[1] - 3) < 1e-9);
  assert.ok(Math.abs(r.r2 - 1) < 1e-9);
  assert.ok(r.resid.every((e) => Math.abs(e) < 1e-9));
});

test('regressionDiagnostics: ข้อมูลน้อยเกินไปไม่คำนวณ', () => {
  assert.equal(regressionDiagnostics([{ gpa: 3, att: 0.9, distance: 3, gender: 'ชาย', dept_id: 'D01' }]).r2, null);
});

test('regressionDiagnostics: คืนจุดและฮิสโทแกรมส่วนเหลือ', () => {
  const rows = Array.from({ length: 120 }, (_, i) => ({
    gpa: 1 + (i % 10) * 0.25 + ((i * 7) % 5) * 0.05, att: 0.5 + (i % 10) * 0.05,
    distance: 1 + (i % 13), gender: i % 2 ? 'ชาย' : 'หญิง', dept_id: `D0${(i % 3) + 1}`,
  }));
  const d = regressionDiagnostics(rows);
  assert.equal(d.n, 120);
  assert.equal(d.points.length, 120);
  assert.ok(d.r2 > 0.5 && d.r2 <= 1);
  assert.equal(d.bins.reduce((s, b) => s + b.count, 0), 120);
});

test('weeklyAnomalies: จับสัปดาห์ที่ต่ำผิดปกติ (z < -2)', () => {
  const rows = Array.from({ length: 18 }, (_, i) => ({ term_id: '1/2567', week_no: i + 1, rate: i === 8 ? 70 : 85 + (i % 3) * 0.3 }));
  const out = weeklyAnomalies(rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].week_no, 9);
});
