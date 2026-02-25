import type { Notification } from '../types/notification';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getHeaders(): HeadersInit {
  const token = localStorage.getItem('skyhawk_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface NotificationListResponse {
  notifications: Notification[];
  unreadCount: number;
}

export async function fetchNotifications(
  options?: { limit?: number; offset?: number; unreadOnly?: boolean },
): Promise<NotificationListResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  if (options?.unreadOnly) params.set('unread_only', 'true');

  const res = await fetch(`${API_BASE}/api/notifications?${params}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch notifications: ${res.status}`);
  return res.json();
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await fetch(`${API_BASE}/api/notifications/unread-count`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch unread count: ${res.status}`);
  const data = await res.json();
  return data.unreadCount;
}

export async function markNotificationRead(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/notifications/${id}/read`, {
    method: 'PATCH',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to mark notification read: ${res.status}`);
}

export async function markAllRead(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/notifications/mark-all-read`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to mark all read: ${res.status}`);
}

export async function deleteNotification(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/notifications/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete notification: ${res.status}`);
}

export async function clearAllNotifications(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/notifications`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to clear notifications: ${res.status}`);
}

export async function createNotification(notification: {
  type: string;
  title: string;
  message: string;
  priority?: string;
  actionUrl?: string;
  metadata?: Record<string, string | number>;
}): Promise<Notification> {
  const res = await fetch(`${API_BASE}/api/notifications`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(notification),
  });
  if (!res.ok) throw new Error(`Failed to create notification: ${res.status}`);
  return res.json();
}
