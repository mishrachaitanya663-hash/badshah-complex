import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api, clearToken, getToken, setToken, TOKEN_CHANGED_EVENT } from './client';
import type { AdminUser } from '../types';

type AuthState = {
  admin: AdminUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api.me()
      .then((result) => setAdmin(result.admin))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const sync = () => setAdmin((current) => (getToken() ? current : null));
    window.addEventListener('storage', sync);
    window.addEventListener(TOKEN_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(TOKEN_CHANGED_EVENT, sync);
    };
  }, []);

  async function login(username: string, password: string) {
    const result = await api.login(username, password);
    setToken(result.token);
    setAdmin(result.admin);
  }

  async function logout() {
    try {
      await api.logout();
    } finally {
      clearToken();
      setAdmin(null);
    }
  }

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
