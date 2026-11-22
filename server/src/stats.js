// สถิติที่ใช้ทำกราฟ (ไม่พึ่งไลบรารีภายนอก)

/** แก้ระบบสมการเชิงเส้น A x = b ด้วย Gaussian elimination + partial pivoting */
function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) throw new Error('matrix is singular');
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let k = i + 1; k < n; k++) s -= M[i][k] * x[k];
    x[i] = s / M[i][i];
  }
  return x;
}

/** OLS: y ~ X (X มีคอลัมน์ intercept แล้ว) คืนสัมประสิทธิ์ ค่าทำนาย ส่วนเหลือ และ R² */
function ols(X, y) {
  const p = X[0].length;
  const XtX = Array.from({ length: p }, () => new Array(p).fill(0));
  const Xty = new Array(p).fill(0);
  X.forEach((row, i) => {
    for (let a = 0; a < p; a++) {
      Xty[a] += row[a] * y[i];
      for (let b = 0; b < p; b++) XtX[a][b] += row[a] * row[b];
    }
  });
  const beta = solve(XtX, Xty);
  const fitted = X.map((row) => row.reduce((s, v, k) => s + v * beta[k], 0));
  const resid = y.map((v, i) => v - fitted[i]);
  const mean = y.reduce((s, v) => s + v, 0) / y.length;
  const ssTot = y.reduce((s, v) => s + (v - mean) ** 2, 0);
  const ssRes = resid.reduce((s, v) => s + v * v, 0);
  return { beta, fitted, resid, r2: 1 - ssRes / ssTot };
}

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const std = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const skewness = (a) => { const m = mean(a), s = Math.sqrt(a.reduce((t, v) => t + (v - m) ** 2, 0) / a.length); return a.reduce((t, v) => t + ((v - m) / s) ** 3, 0) / a.length; };

/** โมเดล GPA ~ การมาเรียน + ระยะทาง + เพศ + แผนก (กราฟ 8) */
function regressionDiagnostics(rows) {
  if (rows.length < 30) return { n: rows.length, points: [], bins: [], r2: null, skew: null };
  const depts = [...new Set(rows.map((r) => r.dept_id))].sort();
  const dummies = depts.slice(1); // แผนกแรกเป็นฐานอ้างอิง
  const X = rows.map((r) => [1, r.att, r.distance, r.gender === 'ชาย' ? 1 : 0, ...dummies.map((d) => (r.dept_id === d ? 1 : 0))]);
  const y = rows.map((r) => r.gpa);
  const fit = ols(X, y);
  const lo = -2.6, hi = 1.6, w = 0.2;
  const bins = Array.from({ length: Math.round((hi - lo) / w) }, (_, i) => ({ from: +(lo + i * w).toFixed(2), count: 0 }));
  fit.resid.forEach((e) => {
    const i = Math.min(bins.length - 1, Math.max(0, Math.floor((e - lo) / w)));
    bins[i].count++;
  });
  return {
    n: rows.length, r2: fit.r2, skew: skewness(fit.resid),
    points: fit.fitted.map((f, i) => [+f.toFixed(3), +fit.resid[i].toFixed(3)]),
    bins,
  };
}

/** จุดที่ผิดปกติ (z < -2) ของการมาเรียนรายสัปดาห์ แยกตามภาคเรียน (กราฟ 7) */
function weeklyAnomalies(rows) {
  const byTerm = new Map();
  rows.forEach((r) => { if (!byTerm.has(r.term_id)) byTerm.set(r.term_id, []); byTerm.get(r.term_id).push(r); });
  const out = [];
  for (const [term, list] of byTerm) {
    if (list.length < 5) continue;
    const m = mean(list.map((r) => Number(r.rate))), s = std(list.map((r) => Number(r.rate)));
    list.forEach((r) => { if (s > 0 && (Number(r.rate) - m) / s < -2) out.push({ term_id: term, week_no: r.week_no, rate: Number(r.rate) }); });
  }
  return out;
}

module.exports = { solve, ols, regressionDiagnostics, weeklyAnomalies, mean, std };
