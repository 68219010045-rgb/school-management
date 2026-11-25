-- =====================================================================
-- บทบาทและสิทธิ์อ่านตรงจากฐานข้อมูล (รันต่อจาก schema.sql · รันซ้ำได้ · ไม่ลบข้อมูล)
-- ครูและนักเรียนเข้าถึงข้อมูลผ่าน Express เท่านั้น จึงไม่ให้สิทธิ์อ่านตารางตรง
-- =====================================================================
begin;

alter table public.profiles add column if not exists teacher_id text;
alter table public.profiles add column if not exists student_id text;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin','executive','teacher','student'));
alter table public.profiles drop constraint if exists profiles_link_check;
alter table public.profiles add constraint profiles_link_check check (
  (role <> 'teacher' or teacher_id is not null) and (role <> 'student' or student_id is not null));

do $$
declare t text;
begin
  foreach t in array array['departments','teachers','students','subjects','classrooms','academic_terms',
      'schedules','enrollments','attendance_weekly','maintenance_requests','data_meta',
      'at_risk','import_log','tasks','profiles','change_log']
  loop
    execute format('drop policy if exists p_read on public.%I', t);
    if t in ('students','teachers','change_log','at_risk') then
      execute format('create policy p_read on public.%I for select to authenticated using (public.current_app_role() = ''admin'')', t);
    else
      execute format('create policy p_read on public.%I for select to authenticated using (public.current_app_role() in (''admin'',''executive''))', t);
    end if;
  end loop;
end $$;

-- view ปกติรันด้วยสิทธิ์เจ้าของและข้าม RLS — ให้ใช้สิทธิ์ของผู้เรียกแทน
alter view public.v_terms                   set (security_invoker = true);
alter view public.v_student_term_gpa        set (security_invoker = true);
alter view public.v_student_term_attendance set (security_invoker = true);

commit;
notify pgrst, 'reload schema';
