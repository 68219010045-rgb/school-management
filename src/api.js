// ตัวเรียก backend — หน้าเว็บคุยกับ Express เท่านั้น ไม่มีรหัสลับของ Supabase ในโค้ดฝั่งเบราว์เซอร์ (B3.1/B3.3)
const BASE = '/api';

export const tokenStore = {
  get() { try { return sessionStorage.getItem('school_token'); } catch { return null; } },
  set(t) { try { sessionStorage.setItem('school_token', t); } catch { /* ignore */ } },
  clear() { try { sessionStorage.removeItem('school_token'); } catch { /* ignore */ } },
};

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details || [];
  }
}

export async function api(path, { method = 'GET', body, params } = {}) {
  const url = new URL(BASE + path, window.location.origin);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== '' && v != null) url.searchParams.set(k, v);
  });

  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจว่า backend ทำงานอยู่', 0);
  }

  let data = null;
  try { data = await res.json(); } catch { /* ไม่มีเนื้อหา */ }

  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login') {
      tokenStore.clear();
      window.dispatchEvent(new Event('auth:expired'));
    }
    throw new ApiError((data && data.error) || `เกิดข้อผิดพลาด (${res.status})`, res.status, data && data.details);
  }
  return data;
}
