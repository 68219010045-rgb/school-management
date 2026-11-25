-- =====================================================================
-- ระบบจัดการโรงเรียน/วิทยาลัย — สคริปต์ฐานข้อมูล v2 (Supabase / PostgreSQL)
-- ตารางตรงกับแพ็กส่งต่อจากฝั่งข้อมูล (handoff) — ชื่อคอลัมน์เดิมไม่เปลี่ยน
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run   (หรือ: npm run db:apply เมื่อมี DATABASE_URL)
-- ⚠ ไฟล์นี้ลบตารางสาธิตรุ่นแรก (students/courses/enrollments/attendance ฯลฯ) แล้วสร้างใหม่
--   บัญชีผู้ใช้ (profiles) และ Supabase Auth ไม่ถูกลบ
-- ⚠ ถ้าวางใน SQL Editor เอง ต้องรัน roles.sql · class_attendance.sql · attendance_counting.sql · coursework.sql ต่อทุกครั้ง (npm run db:apply ทำให้อัตโนมัติ)
-- รันซ้ำได้ — แต่จะล้างข้อมูลในตารางข้อมูลทุกครั้ง ต้องรัน npm run import:handoff ใหม่
-- =====================================================================

-- ---------- ล้างของเก่า ----------
drop view     if exists public.v_dept_term_gpa cascade;
drop function if exists public.dashboard_summary(int, int) cascade;
drop function if exists public.quality_report() cascade;
drop table if exists public.maintenance_requests, public.attendance_weekly, public.attendance,
  public.enrollments, public.schedules, public.academic_terms, public.classrooms, public.subjects,
  public.students, public.teachers, public.departments, public.courses, public.terms,
  public.repair_requests, public.import_log, public.data_meta, public.at_risk, public.stat_results,
  public.ev_reconciliation, public.ev_fk_check, public.ev_cleaning_summary cascade;

-- ---------- ตารางข้อมูลหลัก (สัญญาข้อมูลจาก handoff) ----------
create table public.departments (
  dept_id      text primary key,
  dept_name_th text not null unique,
  dq_flags     text
);

create table public.teachers (
  teacher_id         text primary key,
  full_name          text not null,                         -- 🔒 ข้อมูลส่วนบุคคล (สมมติ)
  dept_id            text references public.departments(dept_id),   -- ว่าง = หมวดวิชาทั่วไป
  employment_type    text,
  hire_year          int,
  weekly_teach_hours numeric check (weekly_teach_hours is null or weekly_teach_hours between 0 and 40),
  status             text,
  dq_flags           text
);

create table public.students (
  student_id     text primary key check (student_id ~ '^S[0-9]{5}$'),
  full_name      text not null,                              -- 🔒
  gender         text check (gender in ('ชาย','หญิง')),
  birth_date     date,                                       -- 🔒
  department     text,
  level          text check (level in ('ปวช.','ปวส.')),
  admission_date date not null,
  phone          text check (phone is null or phone ~ '^[0-9]{9,10}$'),   -- 🔒 text เสมอ (เลข 0 หน้า)
  distance_km    numeric check (distance_km is null or distance_km between 0 and 100),
  status         text not null check (status in ('กำลังศึกษา','พักการเรียน','ลาออก','สำเร็จการศึกษา')),
  status_date    date,
  dq_flags       text,
  dept_id        text not null references public.departments(dept_id)
);

create table public.subjects (
  subject_code   text primary key,
  subject_name   text not null,
  dept_id        text references public.departments(dept_id),
  theory_hours   int  check (theory_hours  >= 0),
  practice_hours int  check (practice_hours >= 0),
  credits        numeric not null check (credits > 0),
  dq_flags       text
);

create table public.classrooms (
  room_id   text primary key,
  building  text,
  floor     int,
  room_type text,
  capacity  int check (capacity is null or capacity between 1 and 100),
  dq_flags  text
);

create table public.academic_terms (
  term_id     text primary key check (term_id ~ '^[12]/[0-9]{4}$'),   -- ภาค/ปี พ.ศ.
  start_date  date not null,
  end_date    date not null,
  school_days int,
  weeks       int,
  dq_flags    text
);

create table public.schedules (
  schedule_id  text primary key,
  term_id      text not null references public.academic_terms(term_id),
  subject_code text not null references public.subjects(subject_code),
  teacher_id   text references public.teachers(teacher_id),
  room_id      text references public.classrooms(room_id),
  class_group  text,
  day_of_week  text check (day_of_week in ('จ','อ','พ','พฤ','ศ')),
  start_period int check (start_period between 1 and 8),
  periods      int check (periods between 1 and 4),
  dq_flags     text
);

create table public.enrollments (
  enrollment_id text primary key,
  student_id    text not null references public.students(student_id) on delete cascade,
  schedule_id   text not null references public.schedules(schedule_id),
  term_id       text not null references public.academic_terms(term_id),
  total_score   numeric check (total_score is null or total_score between 0 and 100),
  grade         numeric check (grade is null or grade between 0 and 4),
  dq_flags      text,
  score_status  text not null check (score_status in ('graded','pending_current_term','missing','invalid_removed'))
);

create table public.attendance_weekly (
  record_id       text primary key,
  student_id      text not null references public.students(student_id) on delete cascade,
  term_id         text not null references public.academic_terms(term_id),
  week_no         int  not null check (week_no between 1 and 18),
  week_start_date date,
  school_days     int  check (school_days between 0 and 5),
  days_present    int  not null check (days_present >= 0),
  days_absent     int  not null check (days_absent  >= 0),
  days_leave      int  not null check (days_leave   >= 0),
  days_late       numeric,
  dq_flags        text
);

create table public.maintenance_requests (
  request_id    text primary key,
  room_id       text not null references public.classrooms(room_id),
  category      text,
  priority      text check (priority in ('สูง','กลาง','ต่ำ')),
  reported_date date not null,
  closed_date   date,
  status        text not null check (status in ('เปิด','กำลังดำเนินการ','ปิดแล้ว')),
  reported_by   text references public.teachers(teacher_id),
  dq_flags      text
);

-- วันส่งออกของแต่ละไฟล์ → "ข้อมูล ณ วันที่ …" (data_meta.csv)
create table public.data_meta (
  table_name   text primary key,
  extract_date date not null
);

-- รายชื่อนักเรียนเสี่ยง ใช้รหัสเท่านั้น (ไม่มีชื่อ)
create table public.at_risk (
  student_id text primary key references public.students(student_id) on delete cascade,
  department text, level text, tier text, reason text, attendance_rate numeric, gpa numeric,
  zero_grades int, days_absent int, days_leave int, attendance_now_2_2569 numeric, trend_now text
);

-- บันทึกการนำเข้า (กระทบยอดแถว — B2.2 / Y3.5)
create table public.import_log (
  id serial primary key, table_name text not null, rows_source int not null, rows_loaded int not null,
  imported_at timestamptz not null default now()
);

-- ---------- ตารางของแอป (คงของเดิมถ้ามีแล้ว) ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text not null,
  role         text not null default 'executive' check (role in ('admin','executive'))
);
create table if not exists public.change_log (
  id          bigserial primary key,
  table_name  text not null,
  record_id   text not null,
  action      text not null check (action in ('INSERT','UPDATE','DELETE','IMPORT')),
  actor_email text not null,
  before_data jsonb,
  after_data  jsonb,
  changed_at  timestamptz not null default now()
);
create table if not exists public.tasks (
  id         serial primary key,
  finding    text not null check (length(finding) between 3 and 400),
  action     text not null check (length(action)  between 3 and 600),
  owner      text not null check (length(owner)   between 1 and 150),
  priority   text not null default 'กลาง' check (priority in ('สูง','กลาง','ต่ำ')),
  status     text not null default 'ยังไม่เริ่ม' check (status in ('ยังไม่เริ่ม','กำลังทำ','เสร็จแล้ว')),
  due_date   date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- ขยายให้ใส่หลักฐานและผลกระทบจาก findings.md
alter table public.tasks add column if not exists evidence text;
alter table public.tasks add column if not exists impact   text;
alter table public.tasks drop constraint if exists tasks_finding_check;
alter table public.tasks drop constraint if exists tasks_action_check;
alter table public.tasks add constraint tasks_finding_check check (length(finding) between 3 and 400);
alter table public.tasks add constraint tasks_action_check  check (length(action)  between 3 and 600);

-- ---------- ดัชนี (B2.4 / Y3.2) ----------
create index idx_students_dept        on public.students(dept_id);
create index idx_students_status      on public.students(status);
create index idx_students_admission   on public.students(admission_date);
create index idx_enroll_student       on public.enrollments(student_id);
create index idx_enroll_term_status   on public.enrollments(term_id, score_status);
create index idx_enroll_schedule      on public.enrollments(schedule_id);
create index idx_att_student_term     on public.attendance_weekly(student_id, term_id);
create index idx_att_term_week        on public.attendance_weekly(term_id, week_no);
create index idx_sched_term           on public.schedules(term_id);
create index idx_sched_room           on public.schedules(room_id);
create index idx_sched_teacher        on public.schedules(teacher_id);
create index if not exists idx_change_log_changed on public.change_log(changed_at desc);

-- =====================================================================
-- View / ฟังก์ชันตามนิยามใน kpi_dictionary.md (ให้ฐานข้อมูลสรุป ไม่คำนวณหนักบนเว็บ — B5.4)
-- =====================================================================

-- วันอ้างอิงข้อมูล (วันส่งออกไฟล์นักเรียน)
create or replace function public.data_asof() returns date language sql stable as $$
  select extract_date from public.data_meta where table_name = 'students'
$$;

create or replace view public.v_terms as
select t.*,
       (t.end_date < public.data_asof()) as is_finished,
       (t.start_date <= public.data_asof() and t.end_date >= public.data_asof()) as is_current,
       split_part(t.term_id, '/', 2)::int * 10 + split_part(t.term_id, '/', 1)::int as sort_key
from public.academic_terms t;

-- GPA รายนักเรียน×ภาค ถ่วงหน่วยกิต เฉพาะ score_status = 'graded' (KPI 2)
create or replace view public.v_student_term_gpa as
select e.student_id, e.term_id, s.dept_id,
       sum(e.grade * sub.credits) / nullif(sum(sub.credits), 0) as gpa,
       sum(sub.credits) as credits
from public.enrollments e
join public.schedules sc on sc.schedule_id = e.schedule_id
join public.subjects  sub on sub.subject_code = sc.subject_code
join public.students  s  on s.student_id = e.student_id
where e.score_status = 'graded'
group by e.student_id, e.term_id, s.dept_id;

-- การมาเรียนรายนักเรียน×ภาค: รวมวันก่อนหาร และไม่นับแถวที่ติดธง days_do_not_add_up (KPI 1)
create or replace view public.v_student_term_attendance as
select a.student_id, a.term_id,
       sum(a.days_present)::numeric as present,
       sum(a.days_present + a.days_absent + a.days_leave)::numeric as total
from public.attendance_weekly a
where coalesce(a.dq_flags, '') not like '%days_do_not_add_up%'
group by a.student_id, a.term_id;

-- ---------- KPI 6 ตัว ----------
create or replace function public.kpi_summary(p_term text default null, p_dept text default null)
returns jsonb language sql stable as $$
  with
  fs as (select * from public.students s where p_dept is null or s.dept_id = p_dept),
  att as (
    select coalesce(sum(a.days_present), 0)::numeric as present,
           coalesce(sum(a.days_present + a.days_absent + a.days_leave), 0)::numeric as total
    from public.attendance_weekly a join fs on fs.student_id = a.student_id
    where coalesce(a.dq_flags, '') not like '%days_do_not_add_up%' and (p_term is null or a.term_id = p_term)),
  gp as (
    select sum(e.grade * sub.credits) as pts, sum(sub.credits) as cr
    from public.enrollments e join fs on fs.student_id = e.student_id
    join public.schedules sc on sc.schedule_id = e.schedule_id
    join public.subjects sub on sub.subject_code = sc.subject_code
    where e.score_status = 'graded' and (p_term is null or e.term_id = p_term)),
  dr as (
    select count(*) as n, count(*) filter (where status = 'ลาออก') as dropped
    from fs where extract(year from admission_date) = 2024),
  ru as (
    select coalesce(sum(sc.periods), 0)::numeric as used, (select count(*) from public.classrooms) as rooms
    from public.schedules sc where sc.term_id = coalesce(p_term, '1/2569') and sc.room_id is not null),
  tl as (
    select t.weekly_teach_hours as h, coalesce(sum(sc.periods), 0) as actual
    from public.teachers t
    left join public.schedules sc on sc.teacher_id = t.teacher_id and sc.term_id = coalesce(p_term, '1/2569')
    group by t.teacher_id, t.weekly_teach_hours),
  tls as (
    select count(*) filter (where h is not null and h <> actual) as mismatch,
           count(*) filter (where h is null) as incomparable from tl),
  rp as (
    select count(*) filter (where status in ('เปิด','กำลังดำเนินการ')) as open_n,
           count(*) filter (where status in ('เปิด','กำลังดำเนินการ')
                              and (select extract_date from public.data_meta where table_name = 'maintenance_requests') - reported_date > 90) as overdue,
           count(*) filter (where status in ('เปิด','กำลังดำเนินการ') and priority = 'สูง'
                              and (select extract_date from public.data_meta where table_name = 'maintenance_requests') - reported_date > 90) as overdue_high
    from public.maintenance_requests)
  select jsonb_build_object(
    'attendance_rate', round(100 * att.present / nullif(att.total, 0), 1),
    'gpa',             round(gp.pts / nullif(gp.cr, 0), 2),
    'dropout_rate',    round(100.0 * dr.dropped / nullif(dr.n, 0), 1),
    'dropout_n',       dr.n,
    'room_util',       round(100 * ru.used / nullif(ru.rooms * 40, 0), 1),
    'teach_mismatch',  tls.mismatch,
    'teach_incomparable', tls.incomparable,
    'repairs_open',    rp.open_n,
    'repairs_overdue', rp.overdue,
    'repairs_overdue_high', rp.overdue_high,
    'data_dates', (select jsonb_object_agg(table_name, extract_date) from public.data_meta))
  from att, gp, dr, ru, tls, rp;
$$;

-- ---------- ข้อมูลกราฟ 8 รูป (ตามกราฟใน handoff/charts) ----------
-- กราฟ 1: นักเรียนที่ลงทะเบียน (นับไม่ซ้ำ) ต่อภาค × แผนก
create or replace function public.chart_students_per_term()
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_key, x.dept_id), '[]'::jsonb)
  from (select e.term_id, t.sort_key, s.dept_id, count(distinct e.student_id) as n
        from public.enrollments e
        join public.students s on s.student_id = e.student_id
        join public.v_terms t on t.term_id = e.term_id
        group by e.term_id, t.sort_key, s.dept_id) x;
$$;

-- กราฟ 2: อัตราลาออกรายแผนก รุ่น 2022–2023 (ผลครบแล้ว) เทียบ รุ่น 2024 (KPI 3 รายรุ่น)
create or replace function public.chart_dropout_by_dept()
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'dept_id', d.dept_id, 'department', d.dept_name_th, 'grp', q.grp, 'n', q.n, 'dropped', q.dropped,
      'rate', round(100.0 * q.dropped / nullif(q.n, 0), 1)) order by d.dept_id, q.grp), '[]'::jsonb)
  from (select s.dept_id,
               case when extract(year from s.admission_date) in (2022, 2023) then 'done' else 'c2024' end as grp,
               count(*) as n, count(*) filter (where s.status = 'ลาออก') as dropped
        from public.students s
        where extract(year from s.admission_date) in (2022, 2023, 2024)
        group by 1, 2) q
  join public.departments d on d.dept_id = q.dept_id;
$$;

-- กราฟ 3: การกระจายคะแนนรวม (ช่วงละ 5) เฉพาะ graded
create or replace function public.chart_score_hist(p_term text default null, p_dept text default null)
returns jsonb language sql stable as $$
  with base as (
    select e.total_score from public.enrollments e join public.students s on s.student_id = e.student_id
    where e.score_status = 'graded' and (p_term is null or e.term_id = p_term) and (p_dept is null or s.dept_id = p_dept))
  select jsonb_build_object(
    'n', (select count(*) from base),
    'median', (select percentile_cont(0.5) within group (order by total_score) from base),
    'below50', (select count(*) from base where total_score < 50),
    'min', (select min(total_score) from base),
    'bins', coalesce((select jsonb_agg(jsonb_build_object('from', b, 'count', c) order by b)
                      from (select (floor(total_score / 5) * 5)::int as b, count(*) as c from base group by 1) q), '[]'::jsonb));
$$;

-- กราฟ 4: Box plot ของ GPA รายภาค (นักเรียน×ภาค) แยกแผนก — Tukey 1.5×IQR
create or replace function public.chart_gpa_box(p_term text default null, p_dept text default null)
returns jsonb language sql stable as $$
  with g as (
    select g.dept_id, g.gpa from public.v_student_term_gpa g
    where (p_term is null or g.term_id = p_term) and (p_dept is null or g.dept_id = p_dept)),
  st as (
    select dept_id, count(*) as n,
           percentile_cont(0.25) within group (order by gpa) as q1,
           percentile_cont(0.5)  within group (order by gpa) as med,
           percentile_cont(0.75) within group (order by gpa) as q3
    from g group by dept_id)
  select coalesce(jsonb_agg(jsonb_build_object(
      'dept_id', st.dept_id, 'department', d.dept_name_th, 'n', st.n,
      'q1', round(st.q1::numeric, 3), 'median', round(st.med::numeric, 3), 'q3', round(st.q3::numeric, 3),
      'low',  (select round(min(g.gpa)::numeric, 3) from g where g.dept_id = st.dept_id and g.gpa >= st.q1 - 1.5 * (st.q3 - st.q1)),
      'high', (select round(max(g.gpa)::numeric, 3) from g where g.dept_id = st.dept_id and g.gpa <= st.q3 + 1.5 * (st.q3 - st.q1)),
      'outliers', coalesce((select jsonb_agg(round(g.gpa::numeric, 2)) from g
                            where g.dept_id = st.dept_id and (g.gpa < st.q1 - 1.5 * (st.q3 - st.q1) or g.gpa > st.q3 + 1.5 * (st.q3 - st.q1))), '[]'::jsonb)
    ) order by st.med desc), '[]'::jsonb)
  from st join public.departments d on d.dept_id = st.dept_id;
$$;

-- กราฟ 5: สัดส่วนห้องที่ถูกใช้ วัน × คาบ (ห้องที่มีตาราง ÷ ห้องทั้งหมด)
create or replace function public.chart_room_heatmap(p_term text default '1/2569')
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'term_id', coalesce(p_term, '1/2569'),
    'rooms', (select count(*) from public.classrooms),
    'cells', coalesce(jsonb_agg(jsonb_build_object('day', c.day_of_week, 'period', c.p, 'used', c.used)), '[]'::jsonb))
  from (select sc.day_of_week, p, count(distinct sc.room_id) as used
        from public.schedules sc,
             lateral generate_series(sc.start_period, least(8, sc.start_period + sc.periods - 1)) as p
        where sc.term_id = coalesce(p_term, '1/2569') and sc.room_id is not null
        group by sc.day_of_week, p) c;
$$;

-- กราฟ 6: การมาเรียน (%) vs GPA รายนักเรียน×ภาค พร้อมเส้นถดถอย (corr / regr_*)
create or replace function public.chart_attendance_gpa(p_term text default null, p_dept text default null)
returns jsonb language sql stable as $$
  with p as (
    select 100.0 * a.present / nullif(a.total, 0) as att, g.gpa
    from public.v_student_term_attendance a
    join public.v_student_term_gpa g on g.student_id = a.student_id and g.term_id = a.term_id
    where (p_term is null or a.term_id = p_term) and (p_dept is null or g.dept_id = p_dept) and a.total > 0)
  select jsonb_build_object(
    'n', count(*), 'r', corr(att, gpa), 'r2', regr_r2(gpa, att),
    'slope', regr_slope(gpa, att), 'intercept', regr_intercept(gpa, att),
    'points', coalesce(jsonb_agg(jsonb_build_array(round(att::numeric, 1), round(gpa::numeric, 2))), '[]'::jsonb))
  from p;
$$;

-- กราฟ 7: การมาเรียนรายสัปดาห์ ภาคที่จบแล้ว
create or replace function public.chart_weekly_attendance(p_term text default null, p_dept text default null)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('term_id', x.term_id, 'week_no', x.week_no, 'rate', x.rate)
                            order by x.sort_key, x.week_no), '[]'::jsonb)
  from (select a.term_id, t.sort_key, a.week_no,
               round(100.0 * sum(a.days_present) / nullif(sum(a.days_present + a.days_absent + a.days_leave), 0), 2) as rate
        from public.attendance_weekly a
        join public.students s on s.student_id = a.student_id
        join public.v_terms t on t.term_id = a.term_id
        where t.is_finished and coalesce(a.dq_flags, '') not like '%days_do_not_add_up%'
          and (p_term is null or a.term_id = p_term) and (p_dept is null or s.dept_id = p_dept)
        group by a.term_id, t.sort_key, a.week_no) x;
$$;

-- กราฟ 8: ข้อมูลรายนักเรียนสำหรับโมเดลถดถอย GPA ~ การมาเรียน + ระยะทาง + เพศ + แผนก (Express คำนวณ OLS)
create or replace function public.chart_regression_inputs()
returns jsonb language sql stable as $$
  with gp as (
    select e.student_id, sum(e.grade * sub.credits) / nullif(sum(sub.credits), 0) as gpa
    from public.enrollments e
    join public.schedules sc on sc.schedule_id = e.schedule_id
    join public.subjects sub on sub.subject_code = sc.subject_code
    where e.score_status = 'graded' group by e.student_id),
  ar as (
    select student_id, sum(present) / nullif(sum(total), 0) as att from public.v_student_term_attendance
    group by student_id)
  select coalesce(jsonb_agg(jsonb_build_object(
      'gpa', round(gp.gpa::numeric, 4), 'att', round(ar.att::numeric, 4),
      'distance', s.distance_km, 'gender', s.gender, 'dept_id', s.dept_id)), '[]'::jsonb)
  from gp join ar on ar.student_id = gp.student_id join public.students s on s.student_id = gp.student_id
  where s.distance_km is not null;
$$;

-- ---------- ---------- ---------- ---------- ----------
-- สิทธิ์ของ role + RLS
-- ---------- ---------- ---------- ---------- ----------
create or replace function public.current_app_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

do $$
declare t text;
begin
  foreach t in array array['departments','teachers','students','subjects','classrooms','academic_terms',
      'schedules','enrollments','attendance_weekly','maintenance_requests','data_meta',
      'at_risk','import_log','tasks','profiles','change_log']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists p_read on public.%I', t);
    execute format('drop policy if exists p_write on public.%I', t);
    execute format('create policy p_read on public.%I for select to authenticated using (public.current_app_role() is not null)', t);
    execute format('create policy p_write on public.%I for all to authenticated using (public.current_app_role() = ''admin'') with check (public.current_app_role() = ''admin'')', t);
  end loop;
end $$;

-- ข้อมูลรายคนและข้อมูลภายใน: ผู้บริหารอ่านตารางตรงไม่ได้ (Express ก็ซ่อนชื่อ/เบอร์/วันเกิดจากผู้ที่ไม่ใช่ admin)
drop policy if exists p_read on public.students;
create policy p_read on public.students for select to authenticated using (public.current_app_role() = 'admin');
drop policy if exists p_read on public.teachers;
create policy p_read on public.teachers for select to authenticated using (public.current_app_role() = 'admin');
drop policy if exists p_read on public.change_log;
create policy p_read on public.change_log for select to authenticated using (public.current_app_role() = 'admin');
drop policy if exists p_read on public.at_risk;
create policy p_read on public.at_risk for select to authenticated using (public.current_app_role() = 'admin');

-- โปรเจกต์ Supabase ใหม่ไม่ให้สิทธิ์อัตโนมัติกับตารางที่สร้างด้วย SQL
grant usage on schema public to service_role, authenticated;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;
revoke all on all tables in schema public from anon;

-- ฟังก์ชันสรุปเรียกผ่าน Express เท่านั้น
do $$
declare f text;
begin
  foreach f in array array[
    'kpi_summary(text,text)','chart_students_per_term()','chart_dropout_by_dept()','chart_score_hist(text,text)',
    'chart_gpa_box(text,text)','chart_room_heatmap(text)','chart_attendance_gpa(text,text)',
    'chart_weekly_attendance(text,text)','chart_regression_inputs()']
  loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- ให้ PostgREST โหลดโครงสร้างใหม่ทันที
notify pgrst, 'reload schema';

