const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { authenticate, errorHandler } = require('./middleware');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // อยู่หลัง proxy ของ Vercel: ใช้ X-Forwarded-For (จำเป็นต่อ rate limit)
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));

  // สุขภาพระบบ (ไม่ต้องล็อกอิน) — ใช้ตรวจก่อนส่งงาน (B7.3)
  app.get('/api/health', async (_req, res) => {
    const missing = config.missingEnv();
    if (missing.length) return res.status(503).json({ ok: false, error: `ยังไม่ได้ตั้งค่า: ${missing.join(', ')}` });
    try {
      const { error } = await require('./supabase').getAdmin().from('departments').select('dept_id', { head: true, count: 'exact' });
      if (error) throw error;
      res.json({ ok: true, database: 'connected' });
    } catch (e) {
      res.status(503).json({ ok: false, database: 'unreachable' });
    }
  });

  // กันเดารหัสผ่าน: ล็อกอินได้ 10 ครั้ง / 15 นาที / IP
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
    message: { error: 'พยายามล็อกอินมากเกินไป กรุณารอ 15 นาที' },
  });
  app.use('/api/auth/login', loginLimiter);
  app.use('/api/auth', require('./routes/auth'));

  // ทุกเส้นทางต่อจากนี้ต้องล็อกอิน (Y2.4)
  app.use('/api', authenticate);
  app.use('/api/students', require('./routes/students'));
  app.use('/api/tasks', require('./routes/tasks'));
  app.use('/api/teacher', require('./routes/teacher'));
  app.use('/api/student', require('./routes/student'));
  app.use('/api', require('./routes/core'));

  app.use('/api', (_req, res) => res.status(404).json({ error: 'ไม่พบเส้นทางนี้' }));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
