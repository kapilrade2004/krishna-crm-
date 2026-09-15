import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AppNotification {
  id: string;
  userId: string; // Target user email or ID
  title: string;
  message: string;
  type: 'access_granted' | 'access_revoked' | 'system' | 'task';
  read: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: AppNotification[];
  addNotification: (notif: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      notifications: [
        {
          id: 'n-welcome',
          userId: 'all',
          title: 'System Access Control Active',
          message: 'Super Admin access control and dynamic RBAC permission governance system is active.',
          type: 'system',
          read: false,
          createdAt: new Date().toISOString(),
        },
      ],

      addNotification: (n) =>
        set((state) => ({
          notifications: [
            {
              ...n,
              id: 'n-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
              read: false,
              createdAt: new Date().toISOString(),
            },
            ...state.notifications,
          ],
        })),

      markAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),

      clearAll: () => set({ notifications: [] }),
    }),
    {
      name: 'krishna-notifications',
    }
  )
);
