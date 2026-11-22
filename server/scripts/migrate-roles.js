/**
 * ย้ายบทบาทในฐานข้อมูลที่ใช้งานอยู่: viewer → executive และยกเลิก committee (ต้องมี DATABASE_URL)
 *   npm run db:migrate-roles
 * ไม่ลบข้อมูลโรงเรียน — แก้เฉพาะตาราง profiles และนโยบาย RLS ที่อ้างบทบาท
 */
require('dotenv').config();
const { Client } = require('pg');
const { getAdmin } = require('../src/supabase');

const SQL = `
  update public.profiles set role = 'executive' where role = 'viewer';
  alter table public.profiles drop constraint if exists profiles_role_check;
  alter table public.profiles add constraint profiles_role_check check (role in ('admin','executive'));
  alter table public.profiles alter column role set default 'executive';
  drop policy if exists p_read on public.change_log;
  create policy p_read on public.change_log for select to authenticated using (public.current_app_role() = 'admin');
  drop policy if exists p_read on public.at_risk;
  create policy p_read on public.at_risk for select to authenticated using (public.current_app_role() = 'admin');
  notify pgrst, 'reload schema';
`;

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('ยังไม่ได้ตั้ง DATABASE_URL ใน server/.env');
  const sb = getAdmin();
  // 1) ลบบัญชีทดสอบบทบาทเก่า (profiles ถูกลบตาม)
  const { data: list, error: lErr } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (lErr) throw lErr;
  for (const email of ['committee@school.example.com', 'viewer@school.example.com']) {
    const u = list.users.find((x) => x.email === email);
    if (u) { const { error } = await sb.auth.admin.deleteUser(u.id); if (error) throw error; console.log('• ลบบัญชี', email); }
  }
  const { data: left } = await sb.from('profiles').select('email, role').eq('role', 'committee');
  if (left && left.length) throw new Error('ยังมีผู้ใช้บทบาท committee เหลืออยู่ ' + left.length + ' คน — ย้ายเป็น admin หรือ executive ก่อน');
  // 2) แก้ constraint และนโยบาย
  const m = url.trim().match(/^postgres(?:ql)?:\/\/([^:@/]+):(.*)@([^@/:]+):(\d+)\/([^?]*)/);
  const client = new Client({ user: decodeURIComponent(m[1]), password: m[2].trim(), host: m[3], port: Number(m[4]), database: m[5] || 'postgres', ssl: { rejectUnauthorized: false } });
  await client.connect();
  try { await client.query(SQL); } finally { await client.end(); }
  console.log('✓ ย้ายบทบาทแล้ว: เหลือ admin และ executive');
})().catch((e) => { console.error('ล้มเหลว:', e.message); process.exit(1); });