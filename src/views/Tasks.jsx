import { useState } from 'react';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { Alert, DataNote, Empty, ErrorBox, Field, Loading, PageHeader, useFetch } from '../components/UI';
import { toThaiDate } from '../utils/thaiDate';

const PRIORITIES = ['สูง', 'กลาง', 'ต่ำ'];
const STATUSES = ['ยังไม่เริ่ม', 'กำลังทำ', 'เสร็จแล้ว'];
const EMPTY = { finding: '', action: '', owner: '', priority: 'กลาง', due_date: '', evidence: '', impact: '' };
const today = () => new Date().toISOString().slice(0, 10);
const TONE = { สูง: 'high', กลาง: 'mid', ต่ำ: 'low' };

// หน้าข้อค้นพบ → งานที่ควรทำ (B6.1): หลักฐาน · ผู้รับผิดชอบ · ลำดับความสำคัญ · สถานะ
export default function Tasks() {
  const { role } = useAuth();
  const canEdit = role === 'admin';
  const { data, loading, error, reload } = useFetch(() => api('/tasks'), []);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState('');

  async function patch(id, body) {
    setMsg('');
    try { await api(`/tasks/${id}`, { method: 'PATCH', body }); reload(); }
    catch (e) { setMsg(e.message); }
  }

  async function add(e) {
    e.preventDefault();
    setMsg('');
    const found = {};
    if (form.finding.trim().length < 3) found.finding = 'กรุณากรอกข้อค้นพบ (อย่างน้อย 3 ตัวอักษร)';
    if (form.action.trim().length < 3) found.action = 'กรุณากรอกงานที่ควรทำ';
    if (!form.owner.trim()) found.owner = 'กรุณาระบุผู้รับผิดชอบ';
    setErrors(found);
    if (Object.keys(found).length) return;
    try {
      await api('/tasks', { method: 'POST', body: form });
      setForm(EMPTY); reload();
    } catch (err) {
      if (err instanceof ApiError && err.details.length) setErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      setMsg(err.message);
    }
  }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const open = data ? data.rows.filter((t) => t.status !== 'เสร็จแล้ว') : [];
  const overdue = open.filter((t) => t.due_date && t.due_date < today());

  return (
    <>
      <PageHeader title="ข้อค้นพบ → งานที่ควรทำ" subtitle={canEdit ? 'ผู้ดูแลอัปเดตสถานะและเพิ่มงานได้' : 'ดูได้อย่างเดียว'} />
      <Alert type="info">ร่างโดย AI จากผลวิเคราะห์ของฝั่งข้อมูล ต้องตรวจตัวเลขกับสมุดก่อนใช้ตัดสินใจ (ดู findings.md)</Alert>
      {overdue.length > 0 && <Alert type="warn" title={`งานค้างเกินกำหนด ${overdue.length} งาน:`}>{overdue.map((t) => `#${t.id}`).join(', ')}</Alert>}
      {msg && <div className="alert error" role="alert">{msg}</div>}
      {loading && <Loading rows={4} />}
      {error && <ErrorBox error={error} onRetry={reload} />}
      {data && !loading && (data.rows.length === 0 ? <Empty text="ยังไม่มีงานที่ควรทำ" /> : (
        <section className="card" aria-labelledby="tk-h">
          <header><h2 id="tk-h">รายการ <span className="count">({data.rows.length})</span></h2></header>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">รายการงานที่ควรทำ</caption>
              <thead><tr><th>#</th><th>ข้อค้นพบและหลักฐาน</th><th>งานที่ควรทำ</th><th>ผู้รับผิดชอบ</th><th>ความสำคัญ</th><th>ครบกำหนด</th><th>สถานะ</th></tr></thead>
              <tbody>
                {data.rows.map((t) => {
                  const late = t.status !== 'เสร็จแล้ว' && t.due_date && t.due_date < today();
                  return (
                    <tr key={t.id}>
                      <td>{t.id}</td>
                      <td style={{ minWidth: 260 }}><strong>{t.finding}</strong>
                        {t.evidence && <div className="muted small">หลักฐาน: {t.evidence}</div>}
                        {t.impact && <div className="muted small">ผลกระทบ: {t.impact}</div>}</td>
                      <td style={{ minWidth: 240 }}>{t.action}</td><td>{t.owner}</td>
                      <td>{canEdit ? (
                        <select aria-label={`ความสำคัญของงาน ${t.id}`} value={t.priority} onChange={(e) => patch(t.id, { priority: e.target.value })}>
                          {PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select>
                      ) : <span className={`tag ${TONE[t.priority]}`}>{t.priority}</span>}</td>
                      <td>{toThaiDate(t.due_date)}{late && <> <span className="tag high">เกินกำหนด</span></>}</td>
                      <td>{canEdit ? (
                        <select aria-label={`สถานะของงาน ${t.id}`} value={t.status} onChange={(e) => patch(t.id, { status: e.target.value })}>
                          {STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
                      ) : t.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {canEdit && (
        <form className="card form-grid" onSubmit={add} noValidate aria-labelledby="add-task">
          <h2 id="add-task" className="span-2" style={{ marginBottom: '.75rem' }}>เพิ่มงานใหม่</h2>
          <Field label="ข้อค้นพบ *" id="finding" error={errors.finding}><input id="finding" value={form.finding} onChange={set('finding')} maxLength={400} /></Field>
          <Field label="งานที่ควรทำ *" id="action" error={errors.action}><input id="action" value={form.action} onChange={set('action')} maxLength={600} /></Field>
          <Field label="ผู้รับผิดชอบ *" id="owner" error={errors.owner}><input id="owner" value={form.owner} onChange={set('owner')} maxLength={150} /></Field>
          <Field label="ความสำคัญ" id="priority"><select id="priority" value={form.priority} onChange={set('priority')}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
          <Field label="หลักฐาน" id="evidence" error={errors.evidence}><input id="evidence" value={form.evidence} onChange={set('evidence')} maxLength={400} /></Field>
          <Field label="ครบกำหนด" id="due_date" error={errors.due_date}><input id="due_date" type="date" value={form.due_date} onChange={set('due_date')} /></Field>
          <div className="actions span-2"><button type="submit" className="btn primary">เพิ่มงาน</button></div>
        </form>
      )}
      <DataNote asOf={toThaiDate(new Date().toISOString())}>งานที่เกินกำหนดแจ้งเตือนในหน้านี้</DataNote>
    </>
  );
}
