import {
  Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, ReferenceDot, ReferenceLine,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts';
import { fmt } from './UI';

// สีตามกราฟต้นฉบับใน handoff/charts (ลำดับ D01–D06 = ช่างยนต์ → การตลาด)
export const DEPT_COLORS = ['var(--chart-main)', '#ec6a36', '#17a97c', '#eea10b', '#e879a8', '#0a8a0a'];
const BLUE = 'var(--chart-main)'; // สีฟ้าเดิมของกราฟ (#2979d8) · กำหนดไว้ใน styles.css
const ORANGE = '#ec6a36';
const deptColor = (deptId) => DEPT_COLORS[(Number(String(deptId).slice(1)) - 1) % DEPT_COLORS.length];

/** การ์ดกราฟ: หัวข้อ · ขอบเขตตัวกรอง · กราฟ · "สรุป" · ตารางข้อมูลสำรอง (alt text — Y6.1) */
function ChartCard({ title, subtitle, scope, summary, table, empty, wide, children }) {
  return (
    <figure className={`card chart-card${wide ? ' wide' : ''}`} aria-label={`${title}. ${summary || ''}`}>
      <figcaption>
        <h2>{title}</h2>
        {subtitle && <span className="muted small">{subtitle}</span>}
        {scope && <span className="scope">ใช้ตัวกรอง: {scope}</span>}
      </figcaption>
      {empty ? <p className="muted" role="status">ยังไม่มีข้อมูลสำหรับตัวกรองนี้</p> : <div className="chart-box">{children}</div>}
      {summary && !empty && <p className="takeaway"><strong>สรุป:</strong> {summary}</p>}
      {table && !empty && (
        <details className="data-table">
          <summary>ดูข้อมูลของกราฟนี้เป็นตาราง</summary>
          <div className="table-wrap">
            <table>
              <thead><tr>{table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}

const ceilTo = (v, step) => Math.ceil(v / step) * step;
const makeTicks = (lo, hi, step) => { const out = []; for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(2)); return out; };
// เพดานแกน Y ที่หาร 4 ได้ลงตัวด้วยเลขสวย ๆ (1, 1.5, 2, 2.5, 3, 4, 5, 6, 8 × 10^k)
function niceTop(v) {
  const raw = Math.max(v, 1) / 4, mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((x) => x * mag >= raw) * mag * 4;
}

/** ฮิสโทแกรม SVG (กราฟ 3 และ 8) */
function Histogram({ bins, step, xMin, xMax, colorOf, markers = [], xLabel, yLabel, height = 270, ariaLabel, xTickEvery = 1 }) {
  const W = 640, H = height, m = { l: 66, r: 16, t: 26, b: 46 };
  const top = niceTop(Math.max(1, ...bins.map((b) => b.count)) * 1.05);
  const x = (v) => m.l + ((v - xMin) / (xMax - xMin)) * (W - m.l - m.r);
  const y = (v) => H - m.b - (v / top) * (H - m.t - m.b);
  const yTicks = [0, 1, 2, 3, 4].map((i) => (top / 4) * i);
  const tickStep = step * xTickEvery;
  const xTicks = []; for (let v = Math.ceil(xMin / tickStep - 1e-9) * tickStep; v <= xMax + 1e-9; v += tickStep) xTicks.push(+v.toFixed(2));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={ariaLabel} className="box-svg">
      {yTicks.map((t) => (<g key={t}><line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" /><text x={m.l - 8} y={y(t) + 4} textAnchor="end">{fmt(t)}</text></g>))}
      {bins.map((b) => (
        <rect key={b.from} x={x(b.from) + 1} y={y(b.count)} width={Math.max(1, x(b.from + step) - x(b.from) - 2)} height={H - m.b - y(b.count)} fill={colorOf(b.from)}>
          <title>{`${b.from}–${+(b.from + step).toFixed(2)}: ${b.count}`}</title>
        </rect>
      ))}
      {markers.map((mk) => (
        <g key={mk.label}>
          <line x1={x(mk.at)} x2={x(mk.at)} y1={m.t - 6} y2={H - m.b} stroke="var(--text)" strokeWidth={mk.dashed ? 1.5 : 2} strokeDasharray={mk.dashed ? '5 4' : undefined} />
          <text x={x(mk.at) + (mk.left ? -6 : 6)} y={m.t + 4} textAnchor={mk.left ? 'end' : 'start'} className="val">{mk.label}</text>
        </g>
      ))}
      <line x1={m.l} x2={W - m.r} y1={H - m.b} y2={H - m.b} stroke="var(--border)" />
      {xTicks.map((t) => (<text key={t} x={x(t)} y={H - m.b + 18} textAnchor="middle">{t}</text>))}
      <text className="axis-title" x={(W + m.l) / 2} y={H - 6} textAnchor="middle">{xLabel}</text>
      <text className="axis-title" transform={`translate(14 ${(H - m.b + m.t) / 2}) rotate(-90)`} textAnchor="middle">{yLabel}</text>
    </svg>
  );
}

// ---------- กราฟ 1: จำนวนนักเรียนรายภาค ----------
export function StudentsPerTerm({ rows, departments, deptId }) {
  const terms = [...new Set(rows.map((r) => r.term_id))];
  const total = terms.map((t) => ({ term: t, n: rows.filter((r) => r.term_id === t && (!deptId || r.dept_id === deptId)).reduce((s, r) => s + r.n, 0) }));
  const byDept = terms.map((t) => ({ term: t, ...Object.fromEntries(rows.filter((r) => r.term_id === t).map((r) => [r.dept_id, r.n])) }));
  const shown = departments.filter((d) => !deptId || d.dept_id === deptId);
  const first = total[0], last = total[total.length - 1];
  const growth = shown.map((d) => ({ d, a: byDept[0]?.[d.dept_id] ?? 0, b: byDept[byDept.length - 1]?.[d.dept_id] ?? 0 }));
  const up = [...growth].sort((p, q) => (q.b - q.a) - (p.b - p.a))[0];
  const down = [...growth].sort((p, q) => (p.b - p.a) - (q.b - q.a))[0];
  const summary = total.length ? `${deptId ? shown[0]?.dept_name_th : 'ทั้งวิทยาลัย'} ${fmt(first.n)} → ${fmt(last.n)} คน (${first.term} → ${last.term})${!deptId && up ? ` · ${up.d.dept_name_th} เปลี่ยนมากสุด ${up.a} → ${up.b} คน` : ''}${!deptId && down && down.b < down.a ? ` · ${down.d.dept_name_th} ลดลง ${down.a} → ${down.b} คน` : ''}` : '';
  return (
    <ChartCard wide title="จำนวนนักเรียนที่ลงทะเบียนรายภาคเรียน" subtitle={`ภาคเรียน ${terms[0] || ''} – ${terms[terms.length - 1] || ''} (นับนักเรียนไม่ซ้ำที่มีรายการลงทะเบียน)`}
      scope="แผนก" empty={!rows.length} summary={summary}
      table={{ head: ['ภาคเรียน', 'รวม', ...shown.map((d) => d.dept_name_th)], rows: total.map((t, i) => [t.term, fmt(t.n), ...shown.map((d) => byDept[i][d.dept_id] ?? 0)]) }}>
      <div className="charts" style={{ gap: '.5rem' }}>
        <div role="img" aria-label={`จำนวนนักเรียนทั้งวิทยาลัยรายภาคเรียน ${total.map((t) => `${t.term} ${t.n} คน`).join(', ')}`}>
          <h3 style={{ marginTop: 0 }}>{deptId ? shown[0]?.dept_name_th : 'ทั้งวิทยาลัย'}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={total} margin={{ top: 22, right: 34, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="term" /><YAxis domain={[0, (max) => ceilTo(max * 1.15, 50)]} label={{ value: 'จำนวนนักเรียน (คน)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }} />
              <Tooltip />
              <Line type="monotone" dataKey="n" name="นักเรียน" stroke={BLUE} strokeWidth={3} dot={{ r: 5 }} isAnimationActive={false}><LabelList dataKey="n" position="top" /></Line>
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div role="img" aria-label="จำนวนนักเรียนรายแผนกรายภาคเรียน">
          <h3 style={{ marginTop: 0 }}>รายแผนก</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={byDept} margin={{ top: 22, right: 34, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="term" /><YAxis domain={[0, (max) => ceilTo(max * 1.1, 10)]} />
              <Tooltip /><Legend />
              {shown.map((d) => <Line key={d.dept_id} type="monotone" dataKey={d.dept_id} name={d.dept_name_th} stroke={deptColor(d.dept_id)} strokeWidth={2.5} dot={{ r: 4 }} isAnimationActive={false} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ChartCard>
  );
}

// ---------- กราฟ 2: อัตราลาออกรายแผนก ----------
export function DropoutByDept({ rows, deptId }) {
  const map = new Map();
  rows.forEach((r) => {
    if (deptId && r.dept_id !== deptId) return;
    if (!map.has(r.dept_id)) map.set(r.dept_id, { department: r.department });
    const o = map.get(r.dept_id);
    if (r.grp === 'done') { o.done = r.rate; o.doneN = r.n; } else { o.c24 = r.rate; o.c24N = r.n; }
  });
  const data = [...map.values()].sort((a, b) => (b.c24 ?? 0) - (a.c24 ?? 0));
  const higher = data.filter((d) => (d.c24 ?? 0) > (d.done ?? 0)).length;
  const top = data[0];
  const summary = data.length ? `รุ่น 2024 ลาออกสูงกว่ารุ่นที่จบแล้วใน ${higher} จาก ${data.length} แผนก${top ? ` · สูงสุด ${top.department} ${fmt(top.c24)}%` : ''} · แต่ละแท่งมีนักเรียนน้อย (${Math.min(...data.flatMap((d) => [d.doneN, d.c24N].filter(Boolean)))}–${Math.max(...data.flatMap((d) => [d.doneN, d.c24N].filter(Boolean)))} คน) ตีความด้วยความระวัง` : '';
  const label = (key, nKey) => ({ x, y, width, height, index }) => {
    const d = data[index]; if (!d) return null;
    return <text x={x + width + 6} y={y + height / 2 + 4} style={{ fill: 'var(--muted)', fontSize: 14 }}>{`${fmt(d[key])}%  (n=${d[nKey]})`}</text>;
  };
  return (
    <ChartCard wide title="อัตราลาออกรายแผนก" subtitle="รุ่นที่ผลครบแล้ว (2022–2023) เทียบ รุ่น 2024 · นิยามรายรุ่น ไม่นับพักการเรียน" scope="แผนก" empty={!data.length} summary={summary}
      table={{ head: ['แผนก', 'รุ่น 2022–2023 (%)', 'n', 'รุ่น 2024 (%)', 'n'], rows: data.map((d) => [d.department, d.done ?? '–', d.doneN ?? '–', d.c24 ?? '–', d.c24N ?? '–']) }}>
      <div role="img" aria-label={`อัตราลาออกรายแผนก ${data.map((d) => `${d.department} รุ่น 2022-2023 ${d.done}% รุ่น 2024 ${d.c24}%`).join(', ')}`}>
        <ResponsiveContainer width="100%" height={Math.max(260, data.length * 70)}>
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 90, left: 8, bottom: 8 }} barCategoryGap="22%">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={[0, (m) => Math.max(40, Math.ceil(m / 10) * 10)]} unit="%" />
            <YAxis type="category" dataKey="department" width={120} />
            <Tooltip formatter={(v) => `${v}%`} /><Legend />
            <Bar dataKey="done" name="รุ่น 2022–2023 (ผลครบแล้ว)" fill={BLUE} isAnimationActive={false}><LabelList content={label('done', 'doneN')} /></Bar>
            <Bar dataKey="c24" name="รุ่น 2024 (ยังเรียนอยู่)" fill={ORANGE} isAnimationActive={false}><LabelList content={label('c24', 'c24N')} /></Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

// ---------- กราฟ 3: การกระจายคะแนนรวม ----------
export function ScoreHist({ data, termLabel, deptName }) {
  const bins = data.bins.filter((b) => b.from >= 30 && b.from < 100);
  const pct = data.n ? ((data.below50 / data.n) * 100).toFixed(1) : '0';
  const summary = data.n ? `มัธยฐาน ${fmt(data.median, 0)} · ตก (< 50) ${pct}% ของรายการ (${fmt(data.below50)} รายการ) · ต่ำสุด ${fmt(data.min, 0)} คะแนน` : '';
  return (
    <ChartCard title={`การกระจายคะแนนรวม (n = ${fmt(data.n)} รายการ)`} subtitle={`${termLabel} · ${deptName} · เฉพาะรายการที่มีเกรดแล้ว`} scope="ภาคเรียน · แผนก" empty={!data.n} summary={summary}
      table={{ head: ['ช่วงคะแนน', 'จำนวนรายการ'], rows: bins.map((b) => [`${b.from}–${b.from + 5}`, fmt(b.count)]) }}>
      <Histogram bins={bins} step={5} xMin={30} xMax={100} xTickEvery={1} colorOf={(f) => (f < 50 ? ORANGE : BLUE)}
        markers={[{ at: 50, label: 'ต่ำกว่า 50 = เกรด 0', dashed: true, left: true }, { at: data.median, label: `มัธยฐาน ${fmt(data.median, 0)}` }]}
        xLabel="คะแนนรวมสิ้นภาค (คะแนน)" yLabel="จำนวนรายการลงทะเบียน" ariaLabel={`ฮิสโทแกรมคะแนนรวม มัธยฐาน ${fmt(data.median, 0)}`} />
    </ChartCard>
  );
}

// ---------- กราฟ 4: Box plot GPA รายแผนก ----------
export function GpaBox({ rows, termLabel }) {
  const W = 700, rowH = 62, m = { l: 190, r: 24, t: 14, b: 42 };
  const H = m.t + m.b + rows.length * rowH;
  const x = (v) => m.l + (v / 4) * (W - m.l - m.r);
  const medians = rows.map((r) => r.median);
  const lo = rows[rows.length - 1], hi = rows[0];
  const summary = rows.length ? `มัธยฐาน GPA ต่างกันระหว่างแผนก ${fmt(lo.median, 2)} (${lo.department}) ถึง ${fmt(hi.median, 2)} (${hi.department}) · กล่อง = ควอร์ไทล์ 1–3, เส้นหนา = มัธยฐาน, จุด = ค่านอกเกณฑ์ 1.5×IQR` : '';
  return (
    <ChartCard wide title="GPA รายภาคของนักเรียน แยกตามแผนก" subtitle={`${termLabel} · GPA ถ่วงหน่วยกิตของนักเรียนแต่ละคนต่อภาค (เฉพาะเกรดที่มีแล้ว)`} scope="ภาคเรียน · แผนก" empty={!rows.length} summary={summary}
      table={{ head: ['แผนก', 'n', 'Q1', 'มัธยฐาน', 'Q3', 'ต่ำสุด(ในเกณฑ์)', 'สูงสุด(ในเกณฑ์)', 'ค่านอกเกณฑ์'], rows: rows.map((r) => [r.department, r.n, r.q1, r.median, r.q3, r.low, r.high, r.outliers.length]) }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" className="box-svg"
        aria-label={`Box plot GPA รายแผนก ${rows.map((r, i) => `${r.department} มัธยฐาน ${medians[i]}`).join(', ')}`}>
        {[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].map((t) => (<g key={t}><line x1={x(t)} x2={x(t)} y1={m.t} y2={H - m.b} stroke="var(--grid)" /><text x={x(t)} y={H - m.b + 18} textAnchor="middle">{t.toFixed(1)}</text></g>))}
        {rows.map((r, i) => {
          const cy = m.t + i * rowH + rowH / 2;
          return (
            <g key={r.dept_id}>
              <text x={m.l - 10} y={cy + 4} textAnchor="end">{r.department}  (n={r.n})</text>
              <line x1={x(r.low)} x2={x(r.q1)} y1={cy} y2={cy} stroke={BLUE} strokeWidth="2" />
              <line x1={x(r.q3)} x2={x(r.high)} y1={cy} y2={cy} stroke={BLUE} strokeWidth="2" />
              <line x1={x(r.low)} x2={x(r.low)} y1={cy - 9} y2={cy + 9} stroke={BLUE} strokeWidth="2" />
              <line x1={x(r.high)} x2={x(r.high)} y1={cy - 9} y2={cy + 9} stroke={BLUE} strokeWidth="2" />
              <rect x={x(r.q1)} y={cy - 16} width={Math.max(1, x(r.q3) - x(r.q1))} height={32} fill={BLUE} fillOpacity=".25" stroke={BLUE} strokeWidth="2">
                <title>{`${r.department}: Q1 ${r.q1}, มัธยฐาน ${r.median}, Q3 ${r.q3}`}</title>
              </rect>
              <line x1={x(r.median)} x2={x(r.median)} y1={cy - 16} y2={cy + 16} stroke="var(--text)" strokeWidth="4" />
              <text x={x(r.median)} y={cy - 22} textAnchor="middle" className="val">{fmt(r.median, 2)}</text>
              {r.outliers.map((o, k) => <circle key={k} cx={x(o)} cy={cy} r="3.5" fill="#999" fillOpacity=".7" />)}
            </g>
          );
        })}
        <text x={(W + m.l) / 2} y={H - 4} textAnchor="middle">เกรดเฉลี่ยรายภาค (GPA, ถ่วงหน่วยกิต)</text>
      </svg>
    </ChartCard>
  );
}

// ---------- กราฟ 5: ฮีตแมปการใช้ห้อง ----------
const DAYS = [['จ', 'จันทร์'], ['อ', 'อังคาร'], ['พ', 'พุธ'], ['พฤ', 'พฤหัสบดี'], ['ศ', 'ศุกร์']];
function heatColor(p) {
  const a = [214, 230, 251], b = [11, 61, 122], t = Math.min(1, p / 100);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
}
export function RoomHeatmap({ data }) {
  const grid = DAYS.map(([d]) => Array.from({ length: 8 }, (_, p) => {
    const c = data.cells.find((x) => x.day === d && x.period === p + 1);
    return data.rooms ? Math.round(((c ? c.used : 0) / data.rooms) * 100) : 0;
  }));
  const colAvg = Array.from({ length: 8 }, (_, p) => grid.reduce((s, r) => s + r[p], 0) / 5);
  const rowAvg = grid.map((r) => r.reduce((s, v) => s + v, 0) / 8);
  const maxP = colAvg.indexOf(Math.max(...colAvg)), minP = colAvg.indexOf(Math.min(...colAvg)), minD = rowAvg.indexOf(Math.min(...rowAvg));
  const summary = data.cells.length ? `ห้องเต็มสุดช่วงกลางวัน คาบ ${maxP + 1} (เฉลี่ย ${Math.round(colAvg[maxP])}%) · คาบ ${minP + 1} ว่างสุด (${Math.round(colAvg[minP])}%) · วัน${DAYS[minD][1]}ใช้น้อยสุด (${Math.round(rowAvg[minD])}%) แม้ช่วงที่แน่นที่สุดก็ยังมีห้องว่างราว 1 ใน 3` : '';
  return (
    <ChartCard wide title={`สัดส่วนห้องที่ถูกใช้ รายวัน × คาบ (ภาค ${data.term_id}, ${data.rooms} ห้อง)`} subtitle="ห้องที่มีตารางสอน ÷ ห้องทั้งหมด ในแต่ละคาบ" scope="ภาคเรียน (ค่าเริ่มต้น 1/2569)" empty={!data.cells.length} summary={summary}
      table={{ head: ['วัน', ...Array.from({ length: 8 }, (_, i) => `คาบ ${i + 1}`)], rows: DAYS.map(([, name], i) => [name, ...grid[i].map((v) => `${v}%`)]) }}>
      <div className="heat" role="img" aria-label={`ฮีตแมปการใช้ห้อง ${summary}`}>
        <div />
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="h lab" style={{ placeItems: 'center' }}>คาบ {i + 1}</div>)}
        {DAYS.map(([, name], r) => (
          <div style={{ display: 'contents' }} key={name}>
            <div className="h lab">{name}</div>
            {grid[r].map((v, c) => <div key={c} className="h" style={{ background: heatColor(v), color: v > 50 ? '#fff' : '#0b1b33' }} title={`${name} คาบ ${c + 1}: ${v}%`}>{v}%</div>)}
          </div>
        ))}
      </div>
      <div className="heat-legend"><span>0%</span><i aria-hidden="true" /><span>100% ของห้องถูกใช้</span></div>
    </ChartCard>
  );
}

// ---------- กราฟ 6: การมาเรียน vs GPA ----------
export function AttendanceGpa({ data, termLabel, deptName }) {
  const { n, r, r2, slope, intercept, points } = data;
  const t = n > 2 && r ? Math.abs(r) * Math.sqrt((n - 2) / (1 - r * r)) : 0;
  const pTxt = t > 3.3 ? 'p < 0.001' : 'p ≥ 0.001';
  const strength = Math.abs(r) >= 0.7 ? 'ค่อนข้างแรง' : Math.abs(r) >= 0.3 ? 'ปานกลาง' : 'อ่อน';
  const summary = n ? `สัมพันธ์ทางบวกระดับ${strength} (r = ${fmt(r, 2)}) · มาเรียนเพิ่ม 10 จุด → GPA สูงขึ้นราว ${fmt(slope * 10, 2)} · การมาเรียนอธิบายความต่างของ GPA ได้ ${fmt(r2 * 100, 0)}% · เป็นความสัมพันธ์ ไม่ใช่เหตุและผล` : '';
  const minX = Math.min(...points.map((p) => p[0])), maxX = Math.max(...points.map((p) => p[0]));
  return (
    <ChartCard title="อัตราการมาเรียน กับ เกรดเฉลี่ยรายภาค" subtitle={`${termLabel} · ${deptName} · 1 จุด = นักเรียน 1 คนใน 1 ภาค`} scope="ภาคเรียน · แผนก" empty={!n} summary={summary}
      table={{ head: ['สถิติ', 'ค่า'], rows: [['จำนวนจุด (n)', fmt(n)], ['r (Pearson)', fmt(r, 3)], ['R²', fmt(r2, 3)], ['ความชัน (GPA ต่อ 1 จุด%)', fmt(slope, 4)], ['นัยสำคัญ', pTxt]] }}>
      <div role="img" aria-label={`แผนภาพกระจายการมาเรียนกับ GPA ${summary}`}>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 28, right: 16, left: 0, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" dataKey="x" domain={[Math.max(0, Math.floor(minX / 20) * 20), 100]} ticks={makeTicks(Math.max(0, Math.floor(minX / 20) * 20), 100, 20)} unit="%" name="การมาเรียน" label={{ value: 'อัตราการมาเรียนในภาค (%)', position: 'insideBottom', offset: -12 }} />
            <YAxis type="number" dataKey="y" domain={[0, 4]} ticks={[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4]} name="GPA" label={{ value: 'GPA ภาคนั้น', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={points.map((p) => ({ x: p[0], y: p[1] }))} fill={BLUE} fillOpacity={0.45} isAnimationActive={false} />
            {Number.isFinite(slope) && <ReferenceLine segment={[{ x: minX, y: intercept + slope * minX }, { x: maxX, y: Math.min(4, intercept + slope * maxX) }]} stroke={ORANGE} strokeWidth={3} ifOverflow="hidden" />}
          </ScatterChart>
        </ResponsiveContainer>
        <p className="muted small" style={{ margin: 0 }}>r = {fmt(r, 2)} · R² = {fmt(r2, 2)} · {pTxt} · n = {fmt(n)}</p>
      </div>
    </ChartCard>
  );
}

// ---------- กราฟ 7: การมาเรียนรายสัปดาห์ ----------
const LINE_COLORS = ['var(--chart-main)', '#ec6a36', '#17a97c', '#eea10b', '#e879a8', '#7c5cd6'];
export function WeeklyAttendance({ rows, anomalies }) {
  const terms = [...new Set(rows.map((r) => r.term_id))];
  const weeks = [...new Set(rows.map((r) => r.week_no))].sort((a, b) => a - b);
  const data = weeks.map((w) => ({ week: w, ...Object.fromEntries(rows.filter((r) => r.week_no === w).map((r) => [r.term_id, Number(r.rate)])) }));
  const rates = rows.map((r) => Number(r.rate));
  const lo = Math.floor(Math.min(...rates, 100) / 5) * 5, hi = Math.ceil(Math.max(...rates, 0) / 5) * 5;
  const wk = [...new Set(anomalies.map((a) => a.week_no))];
  const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
  const first = mean(rows.filter((r) => r.week_no <= 9).map((r) => Number(r.rate))), second = mean(rows.filter((r) => r.week_no > 9).map((r) => Number(r.rate)));
  const summary = rows.length ? `ครึ่งแรกของภาคมาเรียนเฉลี่ย ${fmt(first, 1)}% · ครึ่งหลัง ${fmt(second, 1)}%${wk.length ? ` · สัปดาห์ที่ ${wk.join(', ')} ต่ำผิดปกติ ${anomalies.length} ภาค (ลดเหลือ ${fmt(Math.min(...anomalies.map((a) => a.rate)), 0)}%–${fmt(Math.max(...anomalies.map((a) => a.rate)), 0)}%) → ตรวจกับปฏิทินวิทยาลัยว่าตรงกับกิจกรรม/สอบกลางภาคหรือไม่` : ' · ไม่พบสัปดาห์ที่ต่ำผิดปกติ'}` : '';
  return (
    <ChartCard wide title="อัตราการมาเรียนรายสัปดาห์ ภาคที่จบแล้ว (วงกลม = สัปดาห์ผิดปกติ)" subtitle="วันมา ÷ (มา + ขาด + ลา) · ไม่นับแถวที่ติดธง days_do_not_add_up · ผิดปกติ = z < −2 ภายในภาคนั้น" scope="ภาคเรียน · แผนก" empty={!rows.length} summary={summary}
      table={{ head: ['สัปดาห์', ...terms], rows: data.map((d) => [d.week, ...terms.map((t) => (d[t] != null ? `${d[t]}%` : '–'))]) }}>
      <div role="img" aria-label={`อัตราการมาเรียนรายสัปดาห์ ${summary}`}>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" ticks={weeks} label={{ value: 'สัปดาห์ที่ของภาคเรียน', position: 'insideBottom', offset: -12 }} />
            <YAxis domain={[lo, hi]} ticks={makeTicks(lo, hi, 5)} unit="%" />
            <Tooltip formatter={(v) => `${v}%`} labelFormatter={(w) => `สัปดาห์ที่ ${w}`} /><Legend verticalAlign="top" height={30} />
            {terms.map((t, i) => <Line key={t} type="linear" dataKey={t} name={t} stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />)}
            {anomalies.map((a) => <ReferenceDot key={`${a.term_id}-${a.week_no}`} x={a.week_no} y={a.rate} r={9} fill="none" stroke="var(--text)" strokeWidth={2.5} ifOverflow="extendDomain" />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

// ---------- กราฟ 8: ตรวจโมเดลถดถอย ----------
export function Residuals({ data }) {
  const bins = data.bins;
  const summary = data.r2 != null ? `ส่วนเหลือกระจายรอบ 0 ${Math.abs(data.skew) < 0.5 ? 'ไม่มีรูปแบบชัด' : 'เอียงเล็กน้อย'} (ความเบ้ ${fmt(data.skew, 2)}) · โมเดลอธิบาย GPA ได้ ${fmt(data.r2 * 100, 0)}% ที่เหลือมาจากปัจจัยที่ไม่มีในข้อมูล` : '';
  const xs = data.points.map((p) => p[0]), ys = data.points.map((p) => p[1]);
  const xLo = Math.floor(Math.min(...xs) * 2) / 2, xHi = Math.ceil(Math.max(...xs) * 2) / 2;
  const yLo = Math.floor(Math.min(...ys) * 2) / 2, yHi = Math.ceil(Math.max(...ys) * 2) / 2;
  return (
    <ChartCard wide title="ตรวจโมเดลถดถอย GPA ~ การมาเรียน + ระยะทาง + เพศ + แผนก" subtitle={`รายนักเรียน (n = ${fmt(data.n)}) · ส่วนเหลือ = GPA จริง − ค่าทำนาย`} scope="ไม่ขึ้นกับตัวกรอง (โมเดลภาพรวม)" empty={!data.points.length} summary={summary}
      table={{ head: ['ช่วงส่วนเหลือ', 'จำนวนนักเรียน'], rows: bins.filter((b) => b.count).map((b) => [`${b.from} ถึง ${+(b.from + 0.2).toFixed(1)}`, b.count]) }}>
      <div className="charts axis-light" style={{ gap: '.5rem' }}>
        <div role="img" aria-label="ส่วนเหลือเทียบกับค่าทำนาย กระจายรอบศูนย์">
          <h3 style={{ marginTop: 0 }}>ส่วนเหลือ vs ค่าทำนาย</h3>
          <ResponsiveContainer width="100%" height={270}>
            <ScatterChart margin={{ top: 10, right: 16, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="x" domain={[xLo, xHi]} ticks={makeTicks(xLo, xHi, 0.5)} label={{ value: 'GPA ที่โมเดลทำนาย', position: 'insideBottom', offset: -12 }} />
              <YAxis type="number" dataKey="y" domain={[yLo, yHi]} ticks={makeTicks(yLo, yHi, 0.5)} label={{ value: 'ส่วนเหลือ (GPA จริง − ทำนาย)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 13 } }} />
              <Tooltip /><ReferenceLine y={0} stroke="var(--text)" />
              <Scatter data={data.points.map((p) => ({ x: p[0], y: p[1] }))} fill={BLUE} fillOpacity={0.5} isAnimationActive={false} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h3 style={{ marginTop: 0 }}>การกระจายของส่วนเหลือ</h3>
          <Histogram bins={bins} step={0.2} xMin={-2.6} xMax={1.6} xTickEvery={5} colorOf={() => BLUE} height={270}
            xLabel="ส่วนเหลือ" yLabel="จำนวนนักเรียน" ariaLabel="ฮิสโทแกรมของส่วนเหลือ รูปทรงระฆังรอบศูนย์" />
        </div>
      </div>
    </ChartCard>
  );
}
