import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ROLE_LABEL, useAuth } from '../auth';

const NAV = [
  { group: 'ภาพรวม', items: [{ to: '/dashboard', label: 'แดชบอร์ดผู้บริหาร', roles: ['admin', 'executive'] }] },
  { group: 'ข้อมูลสถานศึกษา', items: [
    { to: '/students', label: 'นักเรียน', end: true, roles: ['admin', 'executive'] },
    { to: '/enrollments', label: 'ผลการเรียน', roles: ['admin', 'executive'] },
  ] },
  { group: 'การตัดสินใจ', items: [
    { to: '/at-risk', label: 'นักเรียนเสี่ยง', roles: ['admin'] },
    { to: '/tasks', label: 'ข้อค้นพบ → งานที่ควรทำ', roles: ['admin'] },
  ] },
  { group: 'การตรวจสอบ', items: [
    { to: '/changelog', label: 'ประวัติการแก้ไข', roles: ['admin'] },
  ] },
  { group: 'จัดการข้อมูล', items: [
    { to: '/students/new', label: 'เพิ่มนักเรียน', roles: ['admin'] },
    { to: '/students/import', label: 'นำเข้าจากไฟล์ CSV', roles: ['admin'] },
  ] },
];

const TITLES = {
  '/dashboard': 'แดชบอร์ดผู้บริหาร', '/students': 'นักเรียน', '/students/new': 'เพิ่มนักเรียน', '/students/import': 'นำเข้าจากไฟล์ CSV',
  '/enrollments': 'ผลการเรียน', '/at-risk': 'นักเรียนเสี่ยง', '/tasks': 'ข้อค้นพบ → งานที่ควรทำ',
  '/changelog': 'ประวัติการแก้ไข',
};

const safe = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };

function useTheme() {
  // ค่าเริ่มต้นเป็นธีมมืด (ไม่ตามค่าของระบบปฏิบัติการ) ผู้ใช้สลับเป็นธีมสว่างได้ด้วยปุ่มบนแถบบน
  const [theme, setTheme] = useState('dark');
  useEffect(() => {
    const saved = safe.get('school_theme_v2');
    if (saved === 'light' || saved === 'dark') setTheme(saved);
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return [theme, () => setTheme((t) => { const n = t === 'dark' ? 'light' : 'dark'; safe.set('school_theme_v2', n); return n; })];
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [theme, toggleTheme] = useTheme();
  const [collapsed, setCollapsed] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 1000) || safe.get('school_nav') === '0');
  useEffect(() => { if (window.innerWidth < 1000) setCollapsed(true); }, [pathname]); // ปิดเมนูบนมือถือหลังเปลี่ยนหน้า
  const toggleNav = () => setCollapsed((c) => { safe.set('school_nav', c ? '1' : '0'); return !c; });

  const title = TITLES[pathname] || (pathname.endsWith('/edit') ? 'แก้ไขข้อมูลนักเรียน' : 'หน้านี้');
  const crumbs = [{ to: '/dashboard', label: 'หน้าหลัก' }];
  if (pathname.startsWith('/students/') && pathname !== '/students') crumbs.push({ to: '/students', label: 'นักเรียน' });
  if (pathname !== '/dashboard') crumbs.push({ label: title });

  return (
    <div className={`app${collapsed ? ' collapsed' : ''}`}>
      <a href="#main" className="skip">ข้ามไปที่เนื้อหา</a>
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={toggleNav} aria-label={collapsed ? 'เปิดเมนู' : 'ปิดเมนู'} aria-expanded={!collapsed}>☰</button>
        <Link to="/dashboard" className="brand"><span>ระบบจัดการโรงเรียน</span></Link>
        <span className="spacer" />
        <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={theme === 'dark' ? 'สลับเป็นธีมสว่าง' : 'สลับเป็นธีมมืด'} title="สลับธีม">{theme === 'dark' ? '☀' : '☾'}</button>
        <div className="user">
          <span className="name">{user.display_name}</span>
          <span className="pill">{ROLE_LABEL[user.role]}</span>
          <button type="button" className="icon-btn" style={{ padding: '0 .7rem' }} onClick={() => { logout(); navigate('/login'); }}>ออกจากระบบ</button>
        </div>
      </header>

      <nav className="crumbs" aria-label="เส้นทางหน้า">
        <ol>{crumbs.map((c, i) => (
          <li key={i}>{c.to && i < crumbs.length - 1 ? <Link to={c.to}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}</li>
        ))}</ol>
      </nav>

      <div className="body">
        <aside className="sidebar" aria-label="เมนูหลัก">
          {NAV.map((g) => {
            const items = g.items.filter((i) => i.roles.includes(user.role));
            if (!items.length) return null;
            return (
              <div className="nav-group" key={g.group}>
                <h2>{g.group}</h2>
                {items.map((n) => <NavLink key={n.to} to={n.to} end={n.end || n.to === '/students/new' || n.to === '/students/import'} className={({ isActive }) => (isActive ? 'active' : '')}>{n.label}</NavLink>)}
              </div>
            );
          })}
        </aside>
        <main id="main" className="content" tabIndex={-1}><Outlet /></main>
      </div>
    </div>
  );
}
