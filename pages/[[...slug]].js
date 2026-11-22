import dynamic from 'next/dynamic';

// Next.js เป็นโครงและตัวสร้างหน้า ส่วนการเปลี่ยนหน้าภายในแอปใช้ React Router 6
// ปิด SSR เพราะ BrowserRouter ต้องใช้ window และหน้าทั้งหมดอยู่หลังการล็อกอินอยู่แล้ว
const App = dynamic(() => import('../src/App'), {
  ssr: false,
  loading: () => <p style={{ padding: 24 }}>กำลังโหลด…</p>,
});

export default function CatchAll() {
  return <App />;
}
