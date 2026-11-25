# ระบบจัดการโรงเรียน

เว็บจัดการข้อมูลนักเรียน ผลการเรียน แดชบอร์ดผู้บริหาร (KPI 6 ตัว + กราฟ 8 รูป) นักเรียนเสี่ยง งานที่ควรทำ
ทำตามใบฝึก **07 (B1–B7)** และ **08 (Y1–Y7)** ใช้ข้อมูลจากแพ็ก **handoff** ของฝั่งข้อมูล และออกแบบ UX/UI อิงรูปใน **references/**

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | Next.js 16 (Pages Router) · React 18 · React Router 6 · Recharts + SVG |
| Backend | Node.js · Express 4 (`server/`) |
| Database + Auth | Supabase (PostgreSQL + Supabase Auth) |

> ข้อมูลทั้งหมดเป็นข้อมูล **สมมติ** — ห้ามนำข้อมูลจริงของนักเรียนมาใช้ · `students`/`teachers` มีชื่อ เบอร์โทร วันเกิด (สมมติ) ห้ามส่งให้ AI

## สิทธิ์ของ 4 บทบาท

| หน้า / การกระทำ | ผู้ดูแล | ผู้บริหาร | ครู | นักเรียน |
|---|:-:|:-:|:-:|:-:|
| แดชบอร์ด · รายชื่อนักเรียนทั้งหมด · ผลการเรียนทั้งหมด | ✅ | ✅ | ❌ | ❌ |
| นักเรียนเสี่ยง (รหัสเท่านั้น) · งานที่ควรทำ (ดู) | ✅ | ✅ | ❌ | ❌ |
| เพิ่ม/เปลี่ยนสถานะงาน · ประวัติแก้ไข | ✅ | ❌ | ❌ | ❌ |
| เพิ่ม/แก้ไขนักเรียน · นำเข้า CSV | ✅ | ❌ | ❌ | ❌ |
| ชื่อ-สกุล เบอร์โทร วันเกิด ของนักเรียน | ✅ | ❌ | ชื่อ เฉพาะที่สอน | ของตัวเอง |
| ตารางสอน · รายชื่อ การมาเรียน ป้ายเสี่ยง ของวิชาที่สอน | ❌ | ❌ | ✅ | ❌ |
| กรอก/แก้คะแนน (วิชาตัวเอง ภาคปัจจุบัน) | ❌ | ❌ | ✅ | ❌ |
| แดชบอร์ดครู (สรุปวิชาตัวเอง ภาคปัจจุบัน) | ❌ | ❌ | ✅ | ❌ |
| คะแนนเก็บรายรายการ (วิชาตัวเอง ภาคปัจจุบัน) | ❌ | ❌ | ✅ | ดูของตัวเอง |
| เช็คชื่อรายคาบ (วิชาตัวเอง ภาคปัจจุบัน) | ❌ | ❌ | ✅ | ดูยอดของตัวเอง |
| ตารางเรียน คะแนน เกรด การมาเรียน ของตัวเอง | ❌ | ❌ | ❌ | ✅ |

- สิทธิ์ถูกบังคับที่ **backend** (`requireRole`, `server/src/routes/teacher.js`, `student.js` และ `students.js` ตัดคอลัมน์ส่วนบุคคลตามบทบาท) พร้อม RLS ในฐานข้อมูลอีกชั้น (`server/sql/roles.sql`)
- บัญชีครูต้องมี `profiles.teacher_id` และบัญชีนักเรียนต้องมี `profiles.student_id` ยังไม่มีหน้าเว็บจัดการผู้ใช้
- คะแนนต้องเป็นจำนวนเต็ม 0–100 ระบบคิดเกรดให้ (80+ = 4 … ต่ำกว่า 50 = 0) และบันทึกลงประวัติการแก้ไข นักเรียนเห็นคะแนนทันทีที่บันทึก
- เช็คชื่อแยกทุกคาบ (มา · สาย · ลา · ขาด) เฉพาะวันสอนที่ไม่เกินวันนี้ เก็บในตาราง `class_attendance` และนับรวมในตัวเลขการมาเรียน (`server/sql/attendance_counting.sql`): วันที่มา/สายอย่างน้อยครึ่งของคาบที่เช็ค = มา · ไม่ถึงครึ่ง ถ้าคาบที่เหลือเป็นลาอย่างน้อยครึ่ง = ลา นอกนั้น = ขาด · สัปดาห์ที่มีข้อมูลนำเข้าแล้วยังใช้ข้อมูลนำเข้า
- คะแนนเก็บ (`server/sql/coursework.sql`) แยกจากคะแนนรวม ไม่กระทบเกรดและ GPA
- ไม่มีบทบาทครูที่ปรึกษา
- ⚠ `npm run import:handoff` ล้างตารางคะแนนและประวัติการแก้ไขแล้วนำเข้าใหม่ **คะแนนที่ครูกรอกจะหาย**

### เปิดใช้บทบาทครูและนักเรียนกับฐานข้อมูลที่ใช้งานอยู่

```bash
cd server
npm run db:migrate-teacher-student            # ไม่ลบข้อมูล (ห้ามใช้ db:apply เพราะจะล้างข้อมูล)
npm run seed -- --only=teacher,student        # ไม่รีเซ็ตรหัสผ่านบัญชีผู้ดูแล/ผู้บริหาร
```

คะแนนเก็บ: วาง `server/sql/coursework.sql` ใน SQL Editor แล้วกด Run

สร้างบัญชีครูจากฐานข้อมูล (เฉพาะสถานะปฏิบัติงาน): `npm run accounts:teachers` → `server/.teacher-credentials.txt` (ห้าม commit)

สร้างบัญชีนักเรียน (เฉพาะสถานะกำลังศึกษา): `npm run accounts:students` → `server/.student-credentials.txt` (ห้าม commit)

เช็คชื่อรายคาบ: วาง `server/sql/class_attendance.sql` ใน Supabase SQL Editor แล้วกด Run (ไม่ลบข้อมูล)

ให้ผลเช็คชื่อนับรวมในตัวเลขการมาเรียน: จากนั้นวาง `server/sql/attendance_counting.sql` แล้วกด Run

## วิธีติดตั้งและรัน

### 1) สร้างฐานข้อมูล
ในโปรเจกต์ Supabase ของคุณ (ใส่ `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ใน `server/.env` — ดู `.env.example`)

**ทางที่ 1 (แนะนำ):** ใส่ `DATABASE_URL` ใน `server/.env` แล้วรัน
```bash
cd server
npm install
npm run db:apply          # รัน sql/schema.sql และ sql/roles.sql
```
**ทางที่ 2:** Supabase → SQL Editor → วางทั้งไฟล์ `server/sql/schema.sql` → Run แล้ววาง `server/sql/roles.sql` `server/sql/class_attendance.sql` และ `server/sql/attendance_counting.sql` → Run ต่อ

> ⚠ `schema.sql` เวอร์ชัน 2 ลบตารางสาธิตรุ่นแรกแล้วสร้างตารางตาม handoff ใหม่ (บัญชีผู้ใช้ไม่ถูกลบ)

### 2) สร้างบัญชีทดสอบและนำเข้าข้อมูล
```bash
npm run seed              # บัญชีทดสอบ 4 บทบาท (admin@ · executive@ · teacher@ · student@) → server/.seed-credentials.txt
npm run import:handoff    # โหลด CSV จาก ../../handoff เข้า Supabase + ตรวจจำนวนแถว + ใส่งานที่ควรทำ 9 งาน
npm run dev               # API ที่ http://localhost:4000  (ตรวจ: /api/health)
```
ถ้าโฟลเดอร์ handoff อยู่ที่อื่น ตั้ง `HANDOFF_DIR=<พาธ>` สคริปต์ **ไม่พิมพ์เนื้อหารายแถว** ของไฟล์นักเรียน/ครู และไม่นำเข้า `rejected_rows.csv` / `change_log.csv` (มีชื่อและเบอร์โทร)

### 3) รันหน้าเว็บ
```bash
cd ..                     # โฟลเดอร์ my-app
npm install
npm run dev               # http://localhost:3000
```

### ทดสอบ
```bash
cd server && npm test     # สิทธิ์ การตรวจข้อมูล กัน injection และคณิตศาสตร์ของโมเดลถดถอย (ไม่ต้องใช้ฐานข้อมูล)
```

## กราฟ 8 รูปจาก handoff → หน้าแดชบอร์ด

| # | กราฟต้นฉบับ (`handoff/charts`) | ที่มาของข้อมูล (ฟังก์ชันใน `schema.sql`) | ตัวกรองที่มีผล |
|---|---|---|---|
| 1 | `01_line_students_per_term` | `chart_students_per_term` | แผนก |
| 2 | `02_bar_dropout_by_dept` | `chart_dropout_by_dept` (รายรุ่น) | แผนก |
| 3 | `03_hist_score_distribution` | `chart_score_hist` | ภาคเรียน · แผนก |
| 4 | `04_box_gpa_by_dept` | `chart_gpa_box` (Tukey 1.5×IQR) | ภาคเรียน · แผนก |
| 5 | `05_heatmap_room_use` | `chart_room_heatmap` | ภาคเรียน |
| 6 | `06_scatter_attendance_vs_gpa` | `chart_attendance_gpa` (`corr`, `regr_*`) | ภาคเรียน · แผนก |
| 7 | `07_line_weekly_attendance` | `chart_weekly_attendance` + z-score ใน `server/src/stats.js` | ภาคเรียน · แผนก |
| 8 | `08_regression_residuals` | `chart_regression_inputs` + OLS ใน `server/src/stats.js` | — (โมเดลภาพรวม) |

KPI 6 ตัวมาจาก `kpi_summary` ตามนิยามใน `handoff/docs/kpi_dictionary.md` ทุกกราฟมี "สรุป" ที่คำนวณจากข้อมูลจริง และปุ่ม "ดูข้อมูลเป็นตาราง" (ข้อความแทนภาพ)

**ตัวเลขอ้างอิงที่ต้องตรงกัน (3 ที่: สมุด · เว็บ · สไลด์):** มาเรียน 84.6% · GPA 2.80 · ลาออกรุ่น 2024 = 24.5% · ใช้ห้อง 47.7% (1/2569) · ภาระสอนไม่ตรง 6 คน (+2) · งานซ่อมค้าง > 90 วัน 23 งาน (ด่วนสูง 5)

## UX/UI (อิง references/)
แถบบนสีเข้ม + breadcrumb + เมนูซ้ายจัดกลุ่ม (Cloudscape/Ant) · การ์ดสรุปตัวเลขใหญ่ · การ์ดกราฟมีหัวข้อ/คำอธิบาย/สรุป · แท็บกลุ่มกราฟ · ตารางมีแถบเครื่องมือ หัวคอลัมน์เรียงได้ จุดสีสถานะ แบ่งหน้าแบบมีเลขหน้า (Cloudscape/Ant/PatternFly) · ธีมสว่าง/มืด (Grafana/Fluent/Polaris) · โฟกัสชัด ปุ่มสูง ≥ 40px · ฟอนต์ TH Sarabun New (ไฟล์อยู่ใน public/fonts) ขอบเหลี่ยมทั้งหมด

## โครงสร้าง
```
my-app/
├─ pages/                 Next.js: _app.js + [[...slug]].js (ส่งทุกเส้นทางให้ React Router)
├─ src/                   App.jsx (React Router 6) · views/ · components/ (Layout, UI, Charts) · api.js · auth.jsx
├─ server/                Express API
│  ├─ src/routes/         auth · students · tasks · core (meta, dashboard, enrollments, at-risk, changelog)
│  ├─ src/stats.js        OLS / z-score สำหรับกราฟ 7–8
│  ├─ sql/schema.sql      ตาราง + ข้อจำกัด + ดัชนี + view + RPC + RLS + สิทธิ์
│  ├─ scripts/            seed.js · import-handoff.js · apply-schema.js
│  └─ test/               node:test
└─ docs/                  สถาปัตยกรรม การตัดสินใจ รายการตรวจก่อนส่ง
```

## ความปลอดภัยโดยสรุป
- `service_role key` อยู่ใน `server/.env` เท่านั้น เบราว์เซอร์คุยกับ Express เท่านั้น
- ตรวจข้อมูลสองชั้น (หน้าเว็บ + zod) ปฏิเสธ `< >` อักขระควบคุม ค่านอกช่วง · ช่องค้นหาถูกตัดอักขระ filter
- ข้อมูลส่วนบุคคลเห็นเฉพาะ admin และ `change_log` ไม่บันทึกค่าของชื่อ/เบอร์/วันเกิด
- helmet · จำกัดล็อกอิน 10 ครั้ง/15 นาที · ข้อความล็อกอินผิดไม่บอกว่าอีเมลมีหรือไม่

รายละเอียดเพิ่มเติม: [docs/architecture.md](docs/architecture.md) · [docs/decisions.md](docs/decisions.md)

## นำขึ้น GitHub และ Vercel

ระบบนี้แยกเป็น **2 โปรเจกต์บน Vercel** จาก repo เดียวกัน (Vercel รันแบบ serverless จึงให้ Express ฟังพอร์ตตรงๆ ไม่ได้ — `server/api/index.js` ห่อแอปให้เป็นฟังก์ชันแล้ว):

| โปรเจกต์ | Root Directory | Framework | ตัวแปรสภาพแวดล้อม (Environment Variables) |
|---|---|---|---|
| **backend** (Express) | `server` | Other | `SUPABASE_URL` · `SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` 🔒 · `CORS_ORIGIN` (ลิงก์หน้าเว็บ) |
| **frontend** (Next.js) | `.` (ราก) | Next.js | `API_URL` = ลิงก์ของ backend (เช่น `https://school-api.vercel.app`) |

ขั้นตอน: (1) สร้าง backend ก่อนแล้วจดลิงก์ (2) ตั้ง `API_URL` ที่ frontend เป็นลิงก์นั้นแล้ว deploy (3) กลับไปใส่ `CORS_ORIGIN` ที่ backend เป็นลิงก์หน้าเว็บ แล้ว redeploy backend (4) เปิด `<backend>/api/health` ต้องได้ `ok: true`

- ห้าม commit `server/.env` และ `server/.seed-credentials.txt` (อยู่ใน `.gitignore` แล้ว) — ค่าลับใส่ผ่านหน้า Settings → Environment Variables ของ Vercel เท่านั้น
- ฐานข้อมูล (Supabase) ใช้ร่วมกับตอนพัฒนา ถ้าจะแยกชุดสำหรับใช้งานจริง ให้สร้างโครงการ Supabase ใหม่แล้วรัน `npm run db:apply`, `npm run seed`, `npm run import:handoff`
- Vercel รองรับ Node 18/20/22 จึงตั้ง `engines` เป็น `22.x` (เครื่องพัฒนาใช้ Node 26 ได้ตามปกติ)

### ลิงก์ที่ใช้งานอยู่

| ส่วน | ลิงก์ |
|---|---|
| หน้าเว็บ (frontend) | https://school-management-web-vert.vercel.app |
| API (backend) | https://school-management-api-ten-mauve.vercel.app · ตรวจสุขภาพ: `/api/health` |
| โค้ด | https://github.com/68219010045-rgb/school-management |

อัปเดตโค้ดด้วย `npx vercel deploy --prod` ในโฟลเดอร์ `server` (backend) และโฟลเดอร์ราก (frontend) · ถ้าต้องการให้ deploy อัตโนมัติทุกครั้งที่ push ให้เชื่อมบัญชี GitHub ที่ Vercel (Settings → Authentication) แล้วรัน `vercel git connect`
