import { Head, Html, Main, NextScript } from 'next/document';

// ตั้งธีมมืดตั้งแต่ก่อนวาดหน้า (กันหน้าสว่างวาบ) และใช้กับหน้าล็อกอินด้วย
// ถ้าผู้ใช้เคยสลับธีมเอง จะใช้ค่าที่บันทึกไว้
const setTheme = `try{var t=localStorage.getItem('school_theme_v2');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function Document() {
  return (
    <Html lang="th" data-theme="dark">
      <Head />
      <body>
        <script dangerouslySetInnerHTML={{ __html: setTheme }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
