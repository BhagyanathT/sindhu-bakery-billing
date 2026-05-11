// src/store/authStore.ts — Strict MongoDB mode. No demo fallback.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff' | 'accountant' | 'cashier';
  company: any;
  permissions: Record<string, boolean>;
  avatar?: string;
  lastLogin?: string;
  loginCount?: number;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  login: (email: string, password: string) => Promise<string>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      get isAdmin() { return get().user?.role === 'admin'; },
      get isStaff() { return get().user?.role !== 'admin'; },

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const res = await api.post('/auth/login', { email, password });
          const user = res.data.data.user;
          localStorage.setItem('accessToken', res.data.accessToken);
          set({ user, isAuthenticated: true, isLoading: false });
          // Return role so login page can redirect appropriately
          return user.role;
        } catch (err: any) {
          set({ isLoading: false });
          throw new Error(err.response?.data?.message || 'Login failed. Please check your credentials.');
        }
      },

      register: async (data) => {
        set({ isLoading: true });
        try {
          const res = await api.post('/auth/register', data);
          localStorage.setItem('accessToken', res.data.accessToken);
          set({ user: res.data.data.user, isAuthenticated: true, isLoading: false });
        } catch (err: any) {
          set({ isLoading: false });
          throw new Error(err.response?.data?.message || 'Registration failed. Please try again.');
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } finally {
          localStorage.removeItem('accessToken');
          set({ user: null, isAuthenticated: false });
        }
      },

      fetchMe: async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (!token) {
          set({ user: null, isAuthenticated: false });
          return;
        }
        try {
          const res = await api.get('/auth/me');
          set({ user: res.data.data.user, isAuthenticated: true });
        } catch (err: any) {
          // Only force-logout on explicit auth rejection from server.
          // Network errors, timeouts, or backend restarts should NOT log the user out.
          const status = err?.response?.status;
          if (status === 401 || status === 403) {
            localStorage.removeItem('accessToken');
            set({ user: null, isAuthenticated: false });
          }
          // For any other error (5xx, network down, etc.) keep existing session intact.
        }
      },

      setUser: (user) => set({ user }),
    }),
    {
      name: 'bizflow-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

/**
 * useAuthHydrated — returns true once the persisted auth state has been
 * loaded from localStorage on page refresh.
 *
 * Fix: eagerly checks hasHydrated() on every render path so that if
 * Zustand already finished hydrating before this hook mounted (common on
 * fast page refreshes) we don't wait for onFinishHydration which would
 * never fire.  A 500 ms safety timeout ensures the spinner can never
 * be permanently stuck even if the persist event is missed.
 */
export function useAuthHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // If already hydrated, resolve immediately
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }

    // Otherwise, wait for the finish event
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));

    // Safety fallback: force-resolve after 500 ms so spinner never hangs
    const timer = setTimeout(() => {
      setHydrated(true);
    }, 500);

    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);

  return hydrated;
}
