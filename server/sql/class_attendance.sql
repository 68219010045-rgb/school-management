-- =====================================================================
-- เช็คชื่อรายคาบ (รันต่อจาก roles.sql · รันซ้ำได้ · ไม่ลบข้อมูล)
-- แยกจาก attendance_weekly: ตัวเลขการมาเรียนบนแดชบอร์ดยังใช้ข้อมูลที่นำเข้าเหมือนเดิม
-- ไม่ผูกคีย์นอก เพื่อให้ schema.sql / import:handoff ไม่ลบหรือติดขัดกับผลเช็คชื่อ
-- =====================================================================
begin;

create table if not exists public.class_attendance (
  schedule_id text not null,
  class_date  date not null,
  period      int  not null check (period between 1 and 8),
  student_id  text not null,
  status      text not null check (status in ('มา','สาย','ลา','ขาด')),
  updated_by  text not null,
  updated_at  timestamptz not null default now(),
  primary key (schedule_id, class_date, period, student_id)
);
create index if not exists idx_class_att_student on public.class_attendance(student_id, class_date);

-- เข้าถึงผ่าน Express (service_role) เท่านั้น
alter table public.class_attendance enable row level security;
revoke all on public.class_attendance from anon, authenticated;
grant all on public.class_attendance to service_role;

commit;
notify pgrst, 'reload schema';
