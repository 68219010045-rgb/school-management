// อ่าน CSV แบบง่าย รองรับเครื่องหมายคำพูดและ BOM
export function parseCsv(text) {
  const src = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], cell = '', inQ = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

export const SAMPLE_CSV =
  'student_id,full_name,gender,department,level,admission_date,status,birth_date,phone,distance_km\n' +
  'S69901,สมศักดิ์ ตัวอย่างดี,ชาย,การบัญชี,ปวช.,2026-05-18,กำลังศึกษา,2009-05-14,0812345678,3.5\n' +
  'S69902,สมใจ ทดสอบรัก,หญิง,เทคโนโลยีสารสนเทศ,ปวส.,2026-05-18,กำลังศึกษา,2007-11-02,,12\n' +
  '123,ผิดรูปแบบ รหัสสั้น,ชาย,การบัญชี,ปวช.,2026-05-18,กำลังศึกษา,,,\n';