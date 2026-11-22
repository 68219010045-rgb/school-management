const express = require('express');
const { newAnonClient, getAdmin } = require('../supabase');
const { authenticate, wrap } = require('../middleware');
const { loginSchema } = require('../validation');

const router = express.Router();

// POST /api/auth/login — ตรวจรหัสผ่านกับ Supabase Auth แล้วคืน token + บทบาท
router.post('/login', wrap(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const { data, error } = await newAnonClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    // ข้อความเดียวกันทุกกรณี ไม่บอกว่าอีเมลมีอยู่หรือไม่
    return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  }

  const { data: profile, error: pErr } = await getAdmin()
    .from('profiles').select('email, display_name, role').eq('id', data.user.id).maybeSingle();
  if (pErr) throw pErr;
  if (!profile) return res.status(403).json({ error: 'บัญชีนี้ยังไม่ได้กำหนดบทบาท กรุณาติดต่อผู้ดูแล' });

  res.json({
    token: data.session.access_token,
    expires_at: data.session.expires_at,
    user: profile,
  });
}));

router.get('/me', authenticate, (req, res) => {
  const { email, display_name, role } = req.user;
  res.json({ user: { email, display_name, role } });
});

module.exports = router;
