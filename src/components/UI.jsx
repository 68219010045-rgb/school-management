import { useEffect, useRef, useState } from 'react';

// ---------- สถานะ กำลังโหลด / ไม่มีข้อมูล / ผิดพลาด (B4.4) ----------
export function Loading({ text = 'กำลังโหลดข้อมูล…', rows = 0 }) {
  return (
    <div role="status" aria-live="polite">
      <div className="state"><span className="spinner" aria-hidden="true" />{text}</div>
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton" style={{ height: 18, margin: '8px 0' }} />)}
    </div>
  );
}
export function Empty({ text = 'ไม่พบข้อมูล', children }) {
  return <div className="state" role="status"><div>{text}{children}</div></div>;
}
export function ErrorBox({ error, onRetry }) {
  return (
    <div className="alert error" role="alert">
      <div className="grow"><strong>เกิดข้อผิดพลาด:</strong> {error && error.message ? error.message : String(error)}</div>
      {onRetry && <button type="button" className="btn small" onClick={onRetry}>ลองใหม่</button>}
    </div>
  );
}

/** แถบแจ้งเตือน (info / success / warn / error) ปิดได้ */
export function Alert({ type = 'info', children, onClose, title }) {
  return (
    <div className={`alert ${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <div className="grow">{title && <strong>{title} </strong>}{children}</div>
      {onClose && <button type="button" className="x" aria-label="ปิดการแจ้งเตือน" onClick={onClose}>×</button>}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}

export function Field({ label, id, error, hint, children }) {
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <small className="muted">{hint}</small>}
      {error && <small className="err" id={`${id}-err`} role="alert">{error}</small>}
    </div>
  );
}

// ---------- แบ่งหน้าแบบมีเลขหน้า (Cloudscape / Ant) ----------
function pageList(page, pages) {
  const set = new Set([1, pages, page, page - 1, page + 1]);
  const list = [...set].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const out = [];
  list.forEach((p, i) => { if (i && p - list[i - 1] > 1) out.push('…'); out.push(p); });
  return out;
}
export function Pagination({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil((total || 0) / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total || 0, page * pageSize);
  return (
    <nav className="pagination" aria-label="แบ่งหน้า">
      <span>แสดง {from.toLocaleString('th-TH')}–{to.toLocaleString('th-TH')} จาก {(total ?? 0).toLocaleString('th-TH')} รายการ</span>
      <span className="pager">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="หน้าก่อนหน้า">‹</button>
        {pageList(page, pages).map((p, i) => (p === '…'
          ? <span key={`e${i}`} aria-hidden="true">…</span>
          : <button type="button" key={p} aria-current={p === page ? 'page' : undefined} onClick={() => onPage(p)}>{p}</button>))}
        <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="หน้าถัดไป">›</button>
      </span>
    </nav>
  );
}

/** แท็บ (ARIA tablist) */
export function Tabs({ tabs, value, onChange, label }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.id} role="tab" type="button" id={`tab-${t.id}`} aria-selected={value === t.id} aria-controls={`panel-${t.id}`}
          onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
    </div>
  );
}

/** จุดสีบอกสถานะ */
export function StatusDot({ tone = 'info', children }) {
  return <span className={`dot ${tone}`}>{children}</span>;
}
export const STATUS_TONE = { 'กำลังศึกษา': 'ok', 'พักการเรียน': 'warn', 'ลาออก': 'bad', 'สำเร็จการศึกษา': 'info' };

/** โหลดข้อมูลแบบมีสถานะ ใช้ซ้ำได้ทุกหน้า */
export function useFetch(fn, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef.current()
      .then((data) => alive && setState({ loading: false, data, error: null }))
      .catch((error) => alive && setState({ loading: false, data: null, error }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** "ข้อมูล ณ วันที่ … และข้อจำกัด" บนทุกหน้าที่มีตัวเลข (Y6.4) */
export function DataNote({ asOf, children }) {
  return (
    <p className="muted small" style={{ marginTop: '.5rem' }}>
      <strong>ข้อมูล ณ วันที่ {asOf}</strong>{children ? <> · {children}</> : null}
    </p>
  );
}

/** แปลงตัวเลขเป็นรูปแบบไทย */
export const fmt = (n, d = 0) => (n === null || n === undefined || Number.isNaN(Number(n)) ? '–' : Number(n).toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }));
