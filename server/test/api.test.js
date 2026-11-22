// ทดสอบที่ไม่ต้องใช้ฐานข้อมูลจริง: การตรวจสิทธิ์ การตรวจข้อมูล และการกัน XSS/injection
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL = 'http://127.0.0.1:1';           // ชี้ไปที่ที่ไม่มีอยู่จริง
process.env.SUPABASE_ANON_KEY = 'test-anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service';

const { createApp } = require('../src/app');
const { studentSchema, sanitizeSearch, taskSchema } = require('../src/validation');

let server, base;
test.before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const call = (path, opts) => fetch(base + path, opts);

test('หน้าที่ต้องล็อกอิน เปิดโดยไม่มี token ไม่ได้ (401)', async () => {
  for (const p of ['/api/students', '/api/dashboard', '/api/tasks', '/api/changelog', '/api/meta']) {
    assert.equal((await call(p)).status, 401, p);
  }
});

test('token มั่วถูกปฏิเสธ (401)', async () => {
  const res = await call('/api/students', { headers: { Authorization: 'Bearer not-a-real-token' } });
  assert.equal(res.status, 401);
});

test('POST/PUT โดยไม่ล็อกอินถูกปฏิเสธ (401)', async () => {
  const res = await call('/api/students', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(res.status, 401);
});

test('login ด้วยข้อมูลผิดรูปแบบ → 400 พร้อมรายละเอียด', async () => {
  const res = await call('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'x', password: '' }) });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.details.length >= 1);
});

test('ไม่เปิดเผยเทคโนโลยีเซิร์ฟเวอร์ (x-powered-by) และมี security headers', async () => {
  const res = await call('/api/health');
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.ok(res.headers.get('x-content-type-options'));
});

const good = { student_id: 'S69001', full_name: 'ทดสอบ ระบบ', gender: 'ชาย', dept_id: 'D01', level: 'ปวช.', admission_date: '2026-05-18' };

test('ค่าที่ถูกปฏิเสธ 5 แบบ (Y4.1)', () => {
  const bad = [
    { ...good, student_id: '123' },                           // รหัสผิดรูปแบบ
    { ...good, full_name: '<script>alert(1)</script>' },      // แท็ก HTML
    { ...good, level: 'ป.6' },                                // ระดับไม่อยู่ในรายการ
    { ...good, phone: '12345' },                              // เบอร์ผิดรูปแบบ
    { ...good, distance_km: 445 },                            // ระยะทางเกิน 100 กม.
  ];
  bad.forEach((b, i) => assert.equal(studentSchema.safeParse(b).success, false, `ค่าที่ ${i + 1} ต้องถูกปฏิเสธ`));
  assert.equal(studentSchema.safeParse(good).success, true);
});

test('งานที่ควรทำ: ปฏิเสธข้อความ HTML และค่านอกรายการ', () => {
  assert.equal(taskSchema.safeParse({ finding: 'abc', action: '<img src=x onerror=1>', owner: 'a' }).success, false);
  assert.equal(taskSchema.safeParse({ finding: 'abc', action: 'abc', owner: 'a', priority: 'ด่วนมาก' }).success, false);
});

test('ช่องค้นหา: ตัดอักขระที่ใช้โจมตี PostgREST filter', () => {
  const s = sanitizeSearch('a,last_name.eq.x),(id.gt.0');
  assert.ok(!/[,()."]/.test(s));
  assert.ok(sanitizeSearch('x'.repeat(500)).length <= 60);
});
