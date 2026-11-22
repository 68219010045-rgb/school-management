import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import Layout from './components/Layout';
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import Students from './views/Students';
import StudentForm from './views/StudentForm';
import ImportStudents from './views/ImportStudents';
import Enrollments from './views/Enrollments';
import AtRisk from './views/AtRisk';
import Tasks from './views/Tasks';
import ChangeLog from './views/ChangeLog';

// ต้องล็อกอินก่อน (Y2.4) และตรวจบทบาทที่ได้รับอนุญาต
function Protected({ roles, children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <p style={{ padding: 24 }}>กำลังตรวจสอบการเข้าสู่ระบบ…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="card" role="alert">
        <h1>ไม่มีสิทธิ์เข้าหน้านี้</h1>
        <p>บทบาทของคุณไม่ได้รับอนุญาตให้เปิดหน้านี้</p>
      </div>
    );
  }
  return children;
}

function NotFound() {
  return <div className="card"><h1>ไม่พบหน้านี้</h1><p>ตรวจสอบลิงก์อีกครั้ง หรือกลับไปที่แดชบอร์ด</p></div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protected><Layout /></Protected>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/students" element={<Students />} />
            <Route path="/students/new" element={<Protected roles={['admin']}><StudentForm /></Protected>} />
            <Route path="/students/import" element={<Protected roles={['admin']}><ImportStudents /></Protected>} />
            <Route path="/students/:id/edit" element={<Protected roles={['admin']}><StudentForm /></Protected>} />
            <Route path="/enrollments" element={<Enrollments />} />
            <Route path="/at-risk" element={<Protected roles={['admin']}><AtRisk /></Protected>} />
            <Route path="/tasks" element={<Protected roles={['admin']}><Tasks /></Protected>} />
            <Route path="/changelog" element={<Protected roles={['admin']}><ChangeLog /></Protected>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
