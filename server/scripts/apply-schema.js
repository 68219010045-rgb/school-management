/**
 * รัน server/sql/schema.sql ผ่านการเชื่อมต่อ Postgres ตรง (ต้องมี DATABASE_URL ใน server/.env)
 *   Supabase > Project Settings > Database > Connection string > URI  (แนะนำแบบ Session pooler)
 * ถ้าไม่มี DATABASE_URL ให้วางไฟล์ schema.sql ใน Supabase SQL Editor แล้วกด Run แทนก็ได้
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Client } = require('pg');

const url = process.env.DATABASE_URL;
if (!url || url.includes('[YOUR-PASSWORD]')) {
  console.error('ยังไม่ได้ตั้ง DATABASE_URL ใน server/.env (รหัสผ่านฐานข้อมูลที่ตั้งตอนสร้างโครงการ)');
  process.exit(1);
}
(async () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf8').replace(/^﻿/, '');
  // แยกส่วนประกอบเอง เพื่อให้รหัสผ่านมีอักขระพิเศษ (@ # / : ?) ได้โดยไม่ต้อง URL-encode
  const m = url.trim().match(/^postgres(?:ql)?:\/\/([^:@/]+):(.*)@([^@/:]+):(\d+)\/([^?]*)/);
  const conn = m
    ? { user: decodeURIComponent(m[1]), password: m[2].trim(), host: m[3], port: Number(m[4]), database: m[5] || 'postgres' }
    : { connectionString: url };
  const client = new Client({ ...conn, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    for (const file of ['roles.sql', 'class_attendance.sql', 'attendance_counting.sql', 'coursework.sql']) {
      await client.query(fs.readFileSync(path.join(__dirname, '..', 'sql', file), 'utf8').replace(/^\uFEFF/, ''));
    }
    console.log('✓ รัน schema.sql · roles.sql · class_attendance.sql · attendance_counting.sql · coursework.sql สำเร็จ');
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error('รัน schema.sql ล้มเหลว:', e.message, e.position ? `(ตำแหน่ง ${e.position})` : '');
  process.exit(1);
});
