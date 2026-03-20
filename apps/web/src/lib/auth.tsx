'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from './api';

interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatar_url: string | null;
  role: string;
  email_verified: boolean;
  date_of_birth: string | null;
  gender: string | null;
  locale: string;
  timezone: string | null;
  notification_preferences: { email: boolean; sms: boolean; push: boolean };
  created_at: string;
}

interface Practice {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  practices: Practice[];
  currentPractice: Practice | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setCurrentPractice: (practice: Practice | null) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [currentPractice, setCurrentPractice] = useState<Practice | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      const { data } = await api.get('/me');
      setUser(data);

      // Fetch practices
      try {
        const { data: practiceData } = await api.get('/practices');
        const practiceList = (practiceData.data || practiceData || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          role: p.membership?.role || p.role || 'PROVIDER',
        }));
        setPractices(practiceList);

        // Restore or set current practice
        const savedPracticeId = localStorage.getItem('current_practice_id');
        const saved = practiceList.find((p: Practice) => p.id === savedPracticeId);
        if (saved) {
          setCurrentPractice(saved);
        } else if (practiceList.length > 0) {
          setCurrentPractice(practiceList[0]);
          localStorage.setItem('current_practice_id', practiceList[0].id);
        }
      } catch {
        // User might not have any practices (patient)
      }
    } catch {
      setUser(null);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('access_token', data.accessToken);
    localStorage.setItem('refresh_token', data.refreshToken);
    await refreshUser();
  };

  const register = async (name: string, email: string, password: string) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    localStorage.setItem('access_token', data.accessToken);
    localStorage.setItem('refresh_token', data.refreshToken);
    await refreshUser();
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch {
      // Ignore logout errors
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('current_practice_id');
    setUser(null);
    setPractices([]);
    setCurrentPractice(null);
  };

  const handleSetCurrentPractice = (practice: Practice | null) => {
    setCurrentPractice(practice);
    if (practice) {
      localStorage.setItem('current_practice_id', practice.id);
    } else {
      localStorage.removeItem('current_practice_id');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        practices,
        currentPractice,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        setCurrentPractice: handleSetCurrentPractice,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
