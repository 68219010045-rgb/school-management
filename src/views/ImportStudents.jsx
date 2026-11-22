import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Alert, PageHeader } from '../components/UI';
import { parseCsv, SAMPLE_CSV } from '../utils/csv';

// นำเข้า CSV ผ่านหน้าเว็บ พร้อมรายงานข้อผิดพลาดรายบรรทัด (Y7.1)
export default function ImportStudents() {
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onFile(e) {
    setReport(null); setError(''); setRows(null);
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) { setError('รองรับเฉพาะไฟล์ .csv'); return; }
    if (file.size > 1024 * 1024) { setError('ไฟล์ใหญ่เกิน 1 MB'); return; }
    setFileName(file.name);
    const parsed = parseCsv(await file.text());
    if (!parsed.length) { setError('ไม่พบข้อมูลในไฟล์ (ต้องมีหัวตารางและอย่างน้อย 1 แถว)'); return; }
    const need = ['student_id', 'full_name', 'gender', 'department', 'level', 'admission_date'];
    const missing = need.filter((h) => !(h in parsed[0]));
    if (missing.length) { setError(`หัวตารางไม่ครบ ขาด: ${missing.join(', ')}`); return; }
    setRows(parsed);
  }

  async function submit() {
    setBusy(true); setError('');
    try { setReport(await api('/students/import/rows', { method: 'POST', body: { rows } })); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  function downloadSample() {
    const url = URL.createObjectURL(new Blob(['﻿' + SAMPLE_CSV], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'students-sample.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader title="นำเข้านักเรียนจากไฟล์ CSV" subtitle="ระบบตรวจรูปแบบทีละแถวก่อนบันทึก แถวที่ผิดจะไม่ถูกนำเข้าและแสดงในรายงาน">
        <Link to="/students" className="btn">ย้อนกลับ</Link>
      </PageHeader>
      <section className="card">
        <p>คอลัมน์ที่ต้องมี: <code>student_id, full_name, gender, department, level, admission_date</code> · ไม่บังคับ: <code>status, birth_date, phone, distance_km, status_date</code></p>
        <p><button type="button" className="btn small" onClick={downloadSample}>ดาวน์โหลดไฟล์ตัวอย่าง (มีแถวผิด 1 แถว)</button></p>
        <div className="field">
          <label htmlFor="csv">เลือกไฟล์ CSV</label>
          <input id="csv" type="file" accept=".csv,text/csv" onChange={onFile} />
        </div>
        {error && <div className="alert error" role="alert">{error}</div>}
        {rows && !report && (
          <p>อ่านไฟล์ <strong>{fileName}</strong> ได้ {rows.length} แถว{' '}
            <button type="button" className="btn primary" onClick={submit} disabled={busy}>{busy ? 'กำลังนำเข้า…' : 'ตรวจสอบและนำเข้า'}</button></p>
        )}
      </section>
      {report && (
        <section className="card" aria-live="polite">
          <h2>ผลการนำเข้า</h2>
          <p>ทั้งหมด {report.total} แถว · <strong>นำเข้าสำเร็จ {report.inserted}</strong> · ไม่ผ่าน/ข้าม {report.rejected}</p>
          {report.errors.length > 0 && (
            <div className="table-wrap"><table>
              <thead><tr><th>บรรทัด</th><th>ปัญหา</th></tr></thead>
              <tbody>{report.errors.map((e, i) => <tr key={i}><td>{e.line || '-'}</td><td>{e.message}</td></tr>)}</tbody>
            </table></div>
          )}
        </section>
      )}
    </>
  );
}
