import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { ErrorBox, Field, Loading, PageHeader, useFetch } from '../components/UI';

const STATUSES = ['กำลังศึกษา', 'พักการเรียน', 'ลาออก', 'สำเร็จการศึกษา'];
const todayIso = () => new Date().toISOString().slice(0, 10);
const EMPTY = { student_id: '', full_name: '', gender: 'ชาย', dept_id: '', level: 'ปวช.', admission_date: todayIso(), status: 'กำลังศึกษา', birth_date: '', phone: '', distance_km: '', status_date: '' };

// ตรวจฝั่งหน้าเว็บ (ฝั่งเซิร์ฟเวอร์ตรวจซ้ำอีกชั้น — Y4.1)
function validate(v, editing) {
  const e = {};
  if (!editing && !/^S[0-9]{5}$/.test(v.student_id)) e.student_id = 'รหัสต้องเป็น S ตามด้วยเลข 5 หลัก (เช่น S69001)';
  if (!v.full_name.trim()) e.full_name = 'กรุณากรอกชื่อ-สกุล';
  if (/[<>]/.test(v.full_name)) e.full_name = 'ห้ามใช้เครื่องหมาย < >';
  if (!v.dept_id) e.dept_id = 'กรุณาเลือกแผนก';
  if (!v.admission_date) e.admission_date = 'กรุณาระบุวันที่เข้าเรียน';
  if (v.phone && !/^[0-9]{9,10}$/.test(v.phone)) e.phone = 'เบอร์โทรต้องเป็นตัวเลข 9–10 หลัก';
  if (v.birth_date && new Date(v.birth_date) >= new Date()) e.birth_date = 'วันเกิดต้องเป็นวันที่ในอดีต';
  if (v.distance_km !== '' && (Number.isNaN(Number(v.distance_km)) || Number(v.distance_km) < 0 || Number(v.distance_km) > 100)) e.distance_km = 'ระยะทางต้องอยู่ระหว่าง 0–100 กม.';
  return e;
}

export default function StudentForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const meta = useFetch(() => api('/meta'), []);
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const existing = useFetch(() => (editing ? api(`/students/${id}`) : Promise.resolve(null)), [id]);

  useEffect(() => {
    const s = existing.data;
    if (s) setValues({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, s[k] ?? ''])) });
  }, [existing.data]);

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const inv = (k) => ({ 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `${k}-err` : undefined });

  async function onSubmit(e) {
    e.preventDefault();
    setFormError('');
    const found = validate(values, editing);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const { student_id: sid, ...rest } = values;
      await api(editing ? `/students/${id}` : '/students', { method: editing ? 'PUT' : 'POST', body: editing ? rest : values });
      navigate('/students', { state: { flash: editing ? `บันทึกการแก้ไข ${id} แล้ว` : `เพิ่มนักเรียน ${sid} แล้ว` } });
    } catch (err) {
      if (err instanceof ApiError && err.details.length) setErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (editing && existing.loading) return <Loading />;
  if (existing.error) return <ErrorBox error={existing.error} />;

  return (
    <>
      <PageHeader title={editing ? `แก้ไขข้อมูลนักเรียน ${id}` : 'เพิ่มนักเรียน'} subtitle="ช่องที่มี * จำเป็นต้องกรอก · ข้อมูลส่วนบุคคลเห็นได้เฉพาะผู้ดูแล" />
      <form className="card form-grid" onSubmit={onSubmit} noValidate>
        <Field label="รหัสนักเรียน *" id="student_id" error={errors.student_id} hint="S + ปีที่เข้า (พ.ศ. 2 หลัก) + ลำดับ 3 หลัก">
          <input id="student_id" value={values.student_id} onChange={set('student_id')} maxLength={6} disabled={editing} {...inv('student_id')} />
        </Field>
        <Field label="ชื่อ-สกุล *" id="full_name" error={errors.full_name}>
          <input id="full_name" value={values.full_name} onChange={set('full_name')} maxLength={120} {...inv('full_name')} />
        </Field>
        <Field label="เพศ *" id="gender" error={errors.gender}>
          <select id="gender" value={values.gender} onChange={set('gender')}><option>ชาย</option><option>หญิง</option></select>
        </Field>
        <Field label="แผนก *" id="dept_id" error={errors.dept_id}>
          <select id="dept_id" value={values.dept_id} onChange={set('dept_id')} {...inv('dept_id')}>
            <option value="">— เลือกแผนก —</option>
            {meta.data && meta.data.departments.map((d) => <option key={d.dept_id} value={d.dept_id}>{d.dept_name_th}</option>)}
          </select>
        </Field>
        <Field label="ระดับ *" id="level" error={errors.level}>
          <select id="level" value={values.level} onChange={set('level')}><option>ปวช.</option><option>ปวส.</option></select>
        </Field>
        <Field label="วันที่เข้าเรียน *" id="admission_date" error={errors.admission_date} hint="เก็บเป็น ค.ศ. ในฐานข้อมูล แสดงเป็น พ.ศ. ในหน้ารายการ">
          <input id="admission_date" type="date" value={values.admission_date} onChange={set('admission_date')} {...inv('admission_date')} />
        </Field>
        <Field label="สถานะ *" id="status" error={errors.status}>
          <select id="status" value={values.status} onChange={set('status')}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        </Field>
        <Field label="วันที่สถานะเปลี่ยนล่าสุด" id="status_date" error={errors.status_date}>
          <input id="status_date" type="date" value={values.status_date} onChange={set('status_date')} {...inv('status_date')} />
        </Field>
        <Field label="วันเกิด" id="birth_date" error={errors.birth_date}>
          <input id="birth_date" type="date" value={values.birth_date} onChange={set('birth_date')} {...inv('birth_date')} />
        </Field>
        <Field label="เบอร์โทร" id="phone" error={errors.phone}>
          <input id="phone" value={values.phone} onChange={set('phone')} inputMode="tel" maxLength={10} {...inv('phone')} />
        </Field>
        <Field label="ระยะทางบ้าน–วิทยาลัย (กม.)" id="distance_km" error={errors.distance_km}>
          <input id="distance_km" value={values.distance_km} onChange={set('distance_km')} inputMode="decimal" {...inv('distance_km')} />
        </Field>
        {formError && <div className="alert error span-2" role="alert">{formError}</div>}
        <div className="span-2 actions">
          <button type="submit" className="btn primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
          <Link to="/students" className="btn">ยกเลิก</Link>
        </div>
      </form>
    </>
  );
}
