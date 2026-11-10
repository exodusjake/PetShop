import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../lib/api';

export interface User {
  id: number; email: string; fullName: string; phone: string | null; avatarUrl: string | null;
  role: 'CUSTOMER' | 'ADMIN'; notifyOrders: boolean; notifyPromos: boolean;
}

interface AuthCtx {
  user: User | null; loading: boolean; isAdmin: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<User>;
  register: (data: { fullName: string; email: string; password: string; acceptTerms: boolean }) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
}
const Ctx = createContext<AuthCtx>(null as never);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: User | null }>('/auth/me').then((r) => setUser(r.user)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const login: AuthCtx['login'] = useCallback(async (email, password, remember) => {
    const r = await api<{ user: User }>('/auth/login', { method: 'POST', json: { email, password, remember } });
    setUser(r.user);
    return r.user;
  }, []);
  const register: AuthCtx['register'] = useCallback(async (data) => {
    const r = await api<{ user: User }>('/auth/register', { method: 'POST', json: data });
    setUser(r.user);
    return r.user;
  }, []);
  const logout = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST', json: {} }); } finally { setUser(null); }
  }, []);

  const value = useMemo(() => ({ user, loading, isAdmin: user?.role === 'ADMIN', login, register, logout, setUser }), [user, loading, login, register, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
