-- =====================================================================
-- คะแนนเก็บรายรายการ (รันซ้ำได้ · ไม่ลบข้อมูล)
-- แยกจากคะแนนรวมใน enrollments จึงไม่กระทบเกรดและ GPA
-- ไม่ผูกคีย์นอกกับตารางที่นำเข้า เพื่อให้ schema.sql / import:handoff ไม่ลบหรือติดขัด
-- =====================================================================
begin;

create table if not exists public.score_items (
  id          bigserial primary key,
  schedule_id text not null,
  name        text not null check (length(name) between 1 and 80),
  max_score   int  not null check (max_score between 1 and 100),
  created_by  text not null,
  created_at  timestamptz not null default now()
);
create table if not exists public.score_marks (
  item_id    bigint not null references public.score_items(id) on delete cascade,
  student_id text not null,
  score      int not null check (score between 0 and 100),
  updated_by text not null,
  updated_at timestamptz not null default now(),
  primary key (item_id, student_id)
);
create index if not exists idx_score_items_schedule on public.score_items(schedule_id);
create index if not exists idx_score_marks_student  on public.score_marks(student_id);

-- เข้าถึงผ่าน Express (service_role) เท่านั้น
alter table public.score_items enable row level security;
alter table public.score_marks enable row level security;
revoke all on public.score_items, public.score_marks from anon, authenticated;
grant all on public.score_items, public.score_marks to service_role;
grant usage on sequence public.score_items_id_seq to service_role;

commit;
notify pgrst, 'reload schema';
