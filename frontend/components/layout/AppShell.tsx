'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import { useAuthStore } from '@/lib/auth';
import { useSidebarStore } from '@/lib/sidebar';
import { PageLoader } from '@/components/ui';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

interface Props { children: React.ReactNode; }

// Routes HR role is NOT allowed to access
const HR_BLOCKED_PATHS = [
  '/dashboard', '/orders', '/customers', '/shipping',
  '/follow-ups', '/tasks', '/csv-import', '/reports',
  '/ceo-view', '/settings',
];

export default function AppShell({ children }: Props) {
  const { isAuthenticated, user, syncUser, hasHydrated } = useAuthStore();
  const { isCollapsed } = useSidebarStore();
  const router   = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // CRM Application Presence Heartbeat (every 30s + on focus)
  useEffect(() => {
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!isAuthenticated && !storedToken) return;

    const sendHeartbeat = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      api.post('/presence/heartbeat', {}).catch(() => {});
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);

    const onVisibilityChange = () => {
      if (!document.hidden) sendHeartbeat();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!mounted) return;

    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

    // If still hydrating and there is a stored token, wait before redirecting
    if (!hasHydrated && storedToken) {
      return;
    }

    // Only redirect to login if there is definitely no active token and not authenticated
    if (!isAuthenticated && !storedToken) {
      router.replace('/auth/login');
      return;
    }

    // Keep user permissions synced if empty or missing
    if (storedToken && (!user?.permissions || user.permissions.length === 0)) {
      syncUser?.();
    }

    // Standard HR role default redirect (only if user does not possess module overrides)
    if (user?.role === 'hr' && (!user.permissions || user.permissions.length === 0)) {
      const blocked = HR_BLOCKED_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
      if (blocked) {
        router.replace('/employees');
      }
    }
  }, [isAuthenticated, user, pathname, router, syncUser, hasHydrated, mounted]);

  // If not yet mounted or hydrating with a stored token, show smooth loader instead of blank / redirect
  if (!mounted) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-surface">
        <PageLoader />
      </div>
    );
  }

  const storedToken = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  if (!isAuthenticated && !storedToken) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar />
      <div
        className={cn(
          'flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-300 ease-in-out',
          isCollapsed ? 'ml-16' : 'ml-60'
        )}
      >
        {children}
      </div>
    </div>
  );
}