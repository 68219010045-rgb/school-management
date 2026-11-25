-- =====================================================================
-- ผลเช็คชื่อรายคาบนับรวมในตัวเลขการมาเรียน โดยไม่เขียนทับข้อมูลที่นำเข้า
-- รันต่อจาก class_attendance.sql · รันซ้ำได้ · ไม่ลบข้อมูล
-- =====================================================================
begin;

-- กติกานับวัน: มา/สาย อย่างน้อยครึ่งของคาบที่เช็คในวันนั้น = มา 1 วัน
-- ไม่ถึงครึ่ง: คาบที่เหลือเป็น "ลา" อย่างน้อยครึ่ง = ลา นอกนั้น = ขาด
-- สัปดาห์ที่มีข้อมูลนำเข้าแล้วใช้ข้อมูลนำเข้า สัปดาห์อื่นคำนวณจากเช็คชื่อ (มา + ขาด + ลา = วันเรียนเสมอ)
create or replace view public.v_attendance_all with (security_invoker = true) as
with d as (
  select c.student_id, c.class_date, count(*) as n,
         count(*) filter (where c.status in ('มา','สาย')) as p,
         count(*) filter (where c.status = 'ลา') as l,
         bool_or(c.status = 'สาย') as late
  from public.class_attendance c group by c.student_id, c.class_date),
w as (
  select d.student_id, t.term_id, t.start_date,
         least(18, (d.class_date - t.start_date) / 7 + 1) as week_no,
         (d.p * 2 >= d.n) as present,
         (d.p * 2 < d.n and d.l * 2 >= d.n - d.p) as on_leave,
         (d.p * 2 >= d.n and d.late) as was_late
  from d join public.academic_terms t on d.class_date between t.start_date and t.end_date),
g as (
  select student_id, term_id, week_no, start_date + (week_no - 1) * 7 as week_start_date,
         count(*)::int as school_days,
         count(*) filter (where present)::int as days_present,
         count(*) filter (where not present and not on_leave)::int as days_absent,
         count(*) filter (where on_leave)::int as days_leave,
         count(*) filter (where was_late)::numeric as days_late
  from w group by student_id, term_id, week_no, start_date)
select record_id, student_id, term_id, week_no, week_start_date, school_days,
       days_present, days_absent, days_leave, days_late, dq_flags
from public.attendance_weekly
union all
select 'CHK-' || g.student_id || '-' || g.term_id || '-' || g.week_no, g.student_id, g.term_id, g.week_no,
       g.week_start_date, g.school_days, g.days_present, g.days_absent, g.days_leave, g.days_late, null::text
from g
where not exists (select 1 from public.attendance_weekly a
                  where a.student_id = g.student_id and a.term_id = g.term_id and a.week_no = g.week_no);

create or replace view public.v_student_term_attendance with (security_invoker = true) as
select a.student_id, a.term_id,
       sum(a.days_present)::numeric as present,
       sum(a.days_present + a.days_absent + a.days_leave)::numeric as total
from public.v_attendance_all a
where coalesce(a.dq_flags, '') not like '%days_do_not_add_up%'
group by a.student_id, a.term_id;

revoke all on public.v_attendance_all from anon;
grant select on public.class_attendance, public.v_attendance_all to authenticated;
drop policy if exists p_read on public.class_attendance;
create policy p_read on public.class_attendance for select to authenticated using (public.current_app_role() = 'admin');

-- ---------- แดชบอร์ดผู้บริหารใช้ข้อมูลการมาเรียนชุดเดียวกัน ----------
create or replace function public.kpi_summary(p_term text default null, p_dept text default null)
returns jsonb language sql stable as $$
  with
  fs as (select * from public.students s where p_dept is null or s.dept_id = p_dept),
  att as (
    select coalesce(sum(a.days_present), 0)::numeric as present,
           coalesce(sum(a.days_present + a.days_absent + a.days_leave), 0)::numeric as total
    from public.v_attendance_all a join fs on fs.student_id = a.student_id
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

create or replace function public.chart_weekly_attendance(p_term text default null, p_dept text default null)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('term_id', x.term_id, 'week_no', x.week_no, 'rate', x.rate)
                            order by x.sort_key, x.week_no), '[]'::jsonb)
  from (select a.term_id, t.sort_key, a.week_no,
               round(100.0 * sum(a.days_present) / nullif(sum(a.days_present + a.days_absent + a.days_leave), 0), 2) as rate
        from public.v_attendance_all a
        join public.students s on s.student_id = a.student_id
        join public.v_terms t on t.term_id = a.term_id
        where t.is_finished and coalesce(a.dq_flags, '') not like '%days_do_not_add_up%'
          and (p_term is null or a.term_id = p_term) and (p_dept is null or s.dept_id = p_dept)
        group by a.term_id, t.sort_key, a.week_no) x;
$$;

commit;
notify pgrst, 'reload schema';
