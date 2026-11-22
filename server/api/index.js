// จุดเข้าของ Vercel: ส่งทุกคำขอเข้าแอป Express เดิม (ฟังก์ชันแบบ serverless ไม่ต้อง listen พอร์ต)
const { createApp } = require('../src/app');
module.exports = createApp();
