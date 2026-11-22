import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Login() {
  const { user, ready, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (ready && user) return <Navigate to={(location.state && location.state.from) || '/dashboard'} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) { setError('กรุณากรอกอีเมลและรหัสผ่าน'); return; }
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate((location.state && location.state.from) || '/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={onSubmit} noValidate aria-labelledby="login-title">
        <div className="login-brand">
          <strong>ระบบจัดการโรงเรียน</strong>
        </div>
        <h1 id="login-title" style={{ fontSize: '1.4rem' }}>เข้าสู่ระบบ</h1>
        <p className="muted login-sub" style={{ marginBottom: '1.1rem' }}>สำหรับผู้ดูแลและผู้บริหาร</p>

        <div className="field">
          <label htmlFor="email">อีเมล</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
            aria-describedby={error ? 'login-error' : undefined} required />
        </div>
        <div className="field">
          <label htmlFor="password">รหัสผ่าน</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>

        {error && <div id="login-error" className="alert error" role="alert">{error}</div>}
        <button type="submit" className="btn primary block" disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</button>
        <p className="muted small" style={{ marginTop: '1rem' }}>บัญชีทดสอบอยู่ในไฟล์ <code>server/.seed-credentials.txt</code> หลังรัน <code>npm run seed</code></p>
      </form>
    </div>
  );
}
