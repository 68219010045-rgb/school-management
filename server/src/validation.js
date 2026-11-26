const { z } = require('zod');
const { STATUSES: STUDENT_MARKS } = require('./sessions');

const LEVELS = ['ปวช.', 'ปวส.'];
const STATUSES = ['กำลังศึกษา', 'พักการเรียน', 'ลาออก', 'สำเร็จการศึกษา'];
const GENDERS = ['ชาย', 'หญิง'];
const TERM_RE = /^[12]\/[0-9]{4}$/;

// ตัดช่องว่างหัวท้าย และปฏิเสธอักขระควบคุม / แท็ก HTML (Y4.1)
const cleanText = (max) =>
  z.string().trim().min(1, 'กรุณากรอกข้อมูล').max(max, `ยาวเกิน ${max} ตัวอักษร`)
    .refine((v) => !/[<>]/.test(v), 'ห้ามใช้เครื่องหมาย < >')
    .refine((v) => !/[\u0000-\u001f]/.test(v), 'มีอักขระที่ไม่อนุญาต');

const blankToNull = (v) => (v === '' || v == null ? null : v);
const dateStr = (msg) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, msg).refine((v) => !Number.isNaN(Date.parse(v)), msg);

const studentSchema = z.object({
  student_id: z.string().trim().regex(/^S[0-9]{5}$/, 'รหัสนักเรียนต้องเป็น S ตามด้วยเลข 5 หลัก (เช่น S69001)'),
  full_name: cleanText(120),
  gender: z.enum(GENDERS, { errorMap: () => ({ message: 'เพศต้องเป็น ชาย หรือ หญิง' }) }),
  birth_date: z.preprocess(blankToNull, dateStr('วันเกิดต้องเป็นรูปแบบ YYYY-MM-DD')
    .refine((v) => new Date(v) < new Date(), 'วันเกิดต้องเป็นวันที่ในอดีต').nullable()),
  dept_id: z.string().trim().regex(/^D[0-9]{2}$/, 'กรุณาเลือกแผนก'),
  level: z.enum(LEVELS, { errorMap: () => ({ message: 'ระดับต้องเป็น ปวช. หรือ ปวส.' }) }),
  admission_date: dateStr('วันที่เข้าเรียนต้องเป็นรูปแบบ YYYY-MM-DD'),
  phone: z.preprocess(blankToNull, z.string().trim().regex(/^[0-9]{9,10}$/, 'เบอร์โทรต้องเป็นตัวเลข 9–10 หลัก').nullable()),
  distance_km: z.preprocess((v) => (v === '' || v == null ? null : Number(v)),
    z.number({ invalid_type_error: 'ระยะทางต้องเป็นตัวเลข' }).min(0, 'ระยะทางต้องไม่ติดลบ').max(100, 'ระยะทางต้องไม่เกิน 100 กม.').nullable()),
  status: z.enum(STATUSES, { errorMap: () => ({ message: 'สถานะไม่ถูกต้อง' }) }).default('กำลังศึกษา'),
  status_date: z.preprocess(blankToNull, dateStr('วันที่สถานะต้องเป็นรูปแบบ YYYY-MM-DD').nullable()),
});
const studentUpdateSchema = studentSchema.omit({ student_id: true }).partial();

const taskSchema = z.object({
  finding: cleanText(400),
  action: cleanText(600),
  owner: cleanText(150),
  priority: z.enum(['สูง', 'กลาง', 'ต่ำ']).default('กลาง'),
  status: z.enum(['ยังไม่เริ่ม', 'กำลังทำ', 'เสร็จแล้ว']).default('ยังไม่เริ่ม'),
  due_date: z.preprocess(blankToNull, dateStr('วันที่ต้องเป็นรูปแบบ YYYY-MM-DD').nullable()),
  evidence: z.preprocess(blankToNull, cleanText(400).nullable()).optional(),
  impact: z.preprocess(blankToNull, cleanText(400).nullable()).optional(),
});
const taskUpdateSchema = taskSchema.partial();

// เช็คชื่อหนึ่งคาบ
const attendanceSchema = z.object({
  date: dateStr('วันที่ต้องเป็นรูปแบบ YYYY-MM-DD'),
  period: z.number().int().min(1).max(8),
  records: z.array(z.object({
    student_id: z.string().regex(/^S[0-9]{5}$/, 'รหัสนักเรียนไม่ถูกต้อง'),
    status: z.enum(STUDENT_MARKS, { errorMap: () => ({ message: 'สถานะต้องเป็น มา สาย ลา หรือ ขาด' }) }),
  })).min(1, 'ไม่มีรายการเช็คชื่อ').max(100),
});

// คะแนนเก็บ
const scoreMarksSchema = z.object({
  records: z.array(z.object({
    item: z.number().int().min(1).max(7),
    student_id: z.string().regex(/^S[0-9]{5}$/, 'รหัสนักเรียนไม่ถูกต้อง'),
    score: z.number({ invalid_type_error: 'คะแนนต้องเป็นตัวเลข' }).int('คะแนนต้องเป็นจำนวนเต็ม').min(0, 'คะแนนต้องไม่ติดลบ').max(100).nullable(),
  })).min(1, 'ไม่มีรายการคะแนน').max(1000),
});

const loginSchema = z.object({
  email: z.string().trim().email('อีเมลไม่ถูกต้อง').max(200),
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน').max(200),
});

// เลขหน้า/ขนาดหน้า — จำกัดสูงสุดเพื่อไม่ให้ดึงทั้งตาราง (B3.4)
const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

// ตัวกรองแดชบอร์ด: ภาคเรียน (เช่น 1/2569) และรหัสแผนก (เช่น D01) — ว่าง = ทั้งหมด
const dashFilterSchema = z.object({
  term_id: z.preprocess(blankToNull, z.string().regex(TERM_RE, 'รหัสภาคเรียนไม่ถูกต้อง').nullable()).default(null),
  dept_id: z.preprocess(blankToNull, z.string().regex(/^D[0-9]{2}$/, 'รหัสแผนกไม่ถูกต้อง').nullable()).default(null),
});

// ตัดอักขระที่มีความหมายใน PostgREST filter / LIKE เพื่อกัน filter injection ในช่องค้นหา
const sanitizeSearch = (q) => String(q || '').replace(/[,()*%_\\:."']/g, ' ').trim().slice(0, 60);

module.exports = {
  LEVELS, STATUSES, GENDERS, TERM_RE, studentSchema, studentUpdateSchema, taskSchema, taskUpdateSchema,
  loginSchema, pageSchema, dashFilterSchema, sanitizeSearch, attendanceSchema, scoreMarksSchema,
};
