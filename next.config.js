/** @type {import('next').NextConfig} */
// หน้าเว็บเรียก /api/* แล้ว Next ส่งต่อไปยัง Express (ไม่ต้องตั้ง CORS และเบราว์เซอร์ไม่เห็นที่อยู่ backend)
const API_URL = process.env.API_URL || 'http://localhost:4000';

module.exports = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};
