import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'super_admin' | 'manager' | 'employee' | 'hr' | 'sales' | 'support' | 'ceo' | 'telecaller' | string;
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  permissions?: string[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  syncUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: typeof window !== 'undefined' ? localStorage.getItem('access_token') : null,
      isAuthenticated: typeof window !== 'undefined' ? Boolean(localStorage.getItem('access_token')) : false,
      hasHydrated: false,
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        localStorage.setItem('access_token', data.accessToken);
        if (data.refreshToken) {
          localStorage.setItem('refresh_token', data.refreshToken);
        }
        set({ user: data.user, token: data.accessToken, isAuthenticated: true });
      },

      logout: async () => {
        try { await api.post('/auth/logout'); } catch {}
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({ user: null, token: null, isAuthenticated: false });
        window.location.href = '/auth/login';
      },

      setUser: (user) => set({ user }),

      syncUser: async () => {
        try {
          const { data } = await api.get('/auth/me');
          if (data?.data?.user) {
            const currentUser = get().user;
            set({
              user: { ...currentUser, ...data.data.user },
              isAuthenticated: true,
              token: typeof window !== 'undefined' ? (localStorage.getItem('access_token') || get().token) : get().token,
            });
          }
        } catch (_) {}
      },
    }),
    {
      name: 'krishna-auth',
      partialize: (s) => ({ user: s.user, token: s.token, isAuthenticated: s.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Role & Permission helpers
export const canAccess = (roleOrUser: User['role'] | User | null | undefined, ...allowed: string[]) => {
  if (!roleOrUser) return false;
  if (typeof roleOrUser === 'string') {
    const r = roleOrUser.toLowerCase().trim();
    if (r === 'admin' || r === 'super_admin' || r === 'super admin') return true;
    return allowed.map(a => a.toLowerCase().trim()).includes(r);
  }
  const u = roleOrUser;
  const role = (u.role || '').toLowerCase().trim();
  if (role === 'admin' || role === 'super_admin' || role === 'super admin' || u.permissions?.includes('*')) {
    return true;
  }
  if (Array.isArray(u.permissions) && u.permissions.length > 0) {
    if (allowed.some(a => u.permissions?.includes(a))) return true;
  }
  return allowed.map(a => a.toLowerCase().trim()).includes(role);
};

export const hasPermission = (user: User | null | undefined, permissionName: string): boolean => {
  if (!user) return false;
  const role = (user.role || '').toLowerCase().trim();
  if (role === 'admin' || role === 'super_admin' || role === 'super admin' || user.permissions?.includes('*')) {
    return true;
  }
  return Array.isArray(user.permissions) && user.permissions.includes(permissionName);
};