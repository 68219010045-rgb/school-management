import Head from 'next/head';
import '../src/styles.css';

// ฟอนต์ TH Sarabun New โหลดผ่าน @font-face ใน src/styles.css (ไฟล์อยู่ใน public/fonts)

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>ระบบจัดการโรงเรียน</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="ระบบจัดการข้อมูลนักเรียน ผลการเรียน และแดชบอร์ดผู้บริหาร" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
