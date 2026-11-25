const { getAdmin } = require('./supabase');

// ตรวจ token ของ Supabase Auth แล้วดึงบทบาทจากตาราง profiles
async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });

  try {
    const sb = getAdmin();
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });

    const { data: profile, error: pErr } = await sb
      .from('profiles').select('*').eq('id', data.user.id).maybeSingle();
    if (pErr) throw pErr;
    if (!profile) return res.status(403).json({ error: 'บัญชีนี้ยังไม่ได้กำหนดบทบาท' });

    req.user = { id: data.user.id, ...profile };
    next();
  } catch (err) {
    next(err);
  }
}

// จำกัดสิทธิ์ตามบทบาท: requireRole('admin')
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'คุณไม่มีสิทธิ์ทำรายการนี้' });

// เรียกใช้ async handler โดยส่ง error ไป error middleware
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ไม่บันทึกข้อมูลส่วนบุคคลลง log และไม่เปิดเผยรายละเอียดภายในแก่ผู้ใช้ (Y4.4)
function errorHandler(err, req, res, _next) {
  if (err && err.name === 'ZodError') {
    return res.status(400).json({
      error: 'ข้อมูลไม่ถูกต้อง',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  console.error(`[error] ${req.method} ${req.path} — ${err && err.code ? err.code + ' ' : ''}${err && err.message}`);
  if (err && err.code === '23505') return res.status(409).json({ error: 'ข้อมูลซ้ำกับที่มีอยู่แล้ว (เช่น รหัสนักเรียน)' });
  if (err && err.code === '23503') return res.status(400).json({ error: 'อ้างอิงข้อมูลที่ไม่มีอยู่' });
  if (err && err.code === '23514') return res.status(400).json({ error: 'ค่าที่กรอกไม่ผ่านเงื่อนไขของฐานข้อมูล' });
  res.status(500).json({ error: 'เกิดข้อผิดพลาดบนเซิร์ฟเวอร์' });
}

module.exports = { authenticate, requireRole, wrap, errorHandler };
