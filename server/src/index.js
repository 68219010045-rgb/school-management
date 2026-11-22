const config = require('./config');
const { createApp } = require('./app');

const missing = config.missingEnv();
if (missing.length) {
  console.warn(`⚠ ยังไม่ได้ตั้งค่า ${missing.join(', ')} ใน server/.env — ดูขั้นตอนใน README.md`);
}

createApp().listen(config.port, () => {
  console.log(`API พร้อมที่ http://localhost:${config.port}  (ตรวจสุขภาพ: /api/health)`);
});
