import { create } from 'zustand';
import type { Notification } from '../types/notification';
import {
  sortNotifications,
  getUnreadCount,
} from '../utils/notificationService';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isOpen: boolean;
  isLoading: boolean;

  // Actions
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  setLoading: (loading: boolean) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isOpen: false,
  isLoading: false,

  setNotifications: (notifications) => {
    const sorted = sortNotifications(notifications);
    set({ notifications: sorted, unreadCount: getUnreadCount(sorted) });
  },

  addNotification: (notification) => {
    const current = get().notifications;
    const updated = sortNotifications([notification, ...current]);
    set({ notifications: updated, unreadCount: getUnreadCount(updated) });
  },

  markRead: (id) => {
    const updated = get().notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n,
    );
    set({ notifications: updated, unreadCount: getUnreadCount(updated) });
  },

  markAllRead: () => {
    const updated = get().notifications.map((n) => ({ ...n, read: true }));
    set({ notifications: updated, unreadCount: 0 });
  },

  removeNotification: (id) => {
    const updated = get().notifications.filter((n) => n.id !== id);
    set({ notifications: updated, unreadCount: getUnreadCount(updated) });
  },

  clearAll: () => {
    set({ notifications: [], unreadCount: 0 });
  },

  setOpen: (open) => set({ isOpen: open }),
  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
  setLoading: (loading) => set({ isLoading: loading }),
}));
