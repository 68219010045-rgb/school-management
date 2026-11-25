/**
 * เพิ่มบทบาทครูและนักเรียนในฐานข้อมูลที่ใช้งานอยู่ (ต้องมี DATABASE_URL) — รันซ้ำได้
 *   npm run db:migrate-teacher-student
 * ไม่ลบข้อมูล: เพิ่มคอลัมน์ใน profiles และจำกัดสิทธิ์อ่านตรงจากฐานข้อมูลให้เหลือ admin/executive
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('ยังไม่ได้ตั้ง DATABASE_URL ใน server/.env');
  const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'roles.sql'), 'utf8').replace(/^﻿/, '');
  const m = url.trim().match(/^postgres(?:ql)?:\/\/([^:@/]+):(.*)@([^@/:]+):(\d+)\/([^?]*)/);
  const conn = m
    ? { user: decodeURIComponent(m[1]), password: m[2].trim(), host: m[3], port: Number(m[4]), database: m[5] || 'postgres' }
    : { connectionString: url };
  const client = new Client({ ...conn, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try { await client.query(sql); } finally { await client.end(); }
  console.log('✓ เพิ่มบทบาท teacher · student แล้ว');
})().catch((e) => { console.error('ล้มเหลว:', e.message); process.exit(1); });
