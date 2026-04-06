import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { UserRole } from '@/types/inventory';
import { apiLogin, getToken, clearToken, setToken } from '@/lib/api';

interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
}

interface AuthContextType {
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, pin: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function tryRestoreUser(): AuthUser | null {
  if (!getToken()) return null;
  try {
    const cached = localStorage.getItem('dumont_user');
    if (cached) return JSON.parse(cached) as AuthUser;
  } catch {
    clearToken();
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const user = tryRestoreUser();
    setCurrentUser(user);
    setIsLoading(false);
  }, []);

  const login = useCallback(async (identifier: string, pin: string) => {
    const res = await apiLogin(identifier, pin);
    setToken(res.token);
    const user: AuthUser = { id: res.user_id, name: res.name, role: res.role as UserRole };
    localStorage.setItem('dumont_user', JSON.stringify(user));
    setCurrentUser(user);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem('dumont_user');
    setCurrentUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      currentUser,
      isAuthenticated: !!currentUser,
      isLoading,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
