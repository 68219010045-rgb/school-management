import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from './api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export const ROLE_LABEL = { admin: 'ผู้ดูแล', executive: 'ผู้บริหาร', teacher: 'ครู', student: 'นักเรียน' };
export const HOME = { admin: '/dashboard', executive: '/dashboard', teacher: '/teacher-dashboard', student: '/my-info' };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (tokenStore.get()) {
        try {
          const { user: u } = await api('/auth/me');
          if (alive) setUser(u);
        } catch { tokenStore.clear(); }
      }
      if (alive) setReady(true);
    })();
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => { alive = false; window.removeEventListener('auth:expired', onExpired); };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    tokenStore.set(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => { tokenStore.clear(); setUser(null); }, []);

  const value = useMemo(() => ({ user, ready, login, logout, role: user && user.role }), [user, ready, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
