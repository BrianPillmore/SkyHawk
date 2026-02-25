import { useEffect, useRef, useCallback } from 'react';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useStore } from '../../store/useStore';
import {
  NOTIFICATION_TYPE_ICONS,
  type Notification,
} from '../../types/notification';
import { formatRelativeTime } from '../../utils/notificationService';
import * as api from '../../services/notificationApi';

const POLL_INTERVAL = 30_000; // 30 seconds

export default function NotificationCenter() {
  const { isAuthenticated } = useStore();
  const {
    notifications,
    unreadCount,
    isOpen,
    isLoading,
    setNotifications,
    markRead,
    markAllRead,
    removeNotification,
    clearAll,
    toggleOpen,
    setOpen,
    setLoading,
  } = useNotificationStore();

  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Fetch notifications from server
  const fetchAll = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const data = await api.fetchNotifications({ limit: 50 });
      setNotifications(data.notifications);
    } catch {
      // Silently fail — notifications are non-critical
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, setNotifications, setLoading]);

  // Poll for new notifications
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchAll();
    const interval = setInterval(fetchAll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchAll]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [isOpen, setOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }
  }, [isOpen, setOpen]);

  const handleMarkRead = async (id: string) => {
    markRead(id);
    try { await api.markNotificationRead(id); } catch { /* non-critical */ }
  };

  const handleMarkAllRead = async () => {
    markAllRead();
    try { await api.markAllRead(); } catch { /* non-critical */ }
  };

  const handleDelete = async (id: string) => {
    removeNotification(id);
    try { await api.deleteNotification(id); } catch { /* non-critical */ }
  };

  const handleClearAll = async () => {
    clearAll();
    setOpen(false);
    try { await api.clearAllNotifications(); } catch { /* non-critical */ }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={toggleOpen}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <BellIcon className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[10px] text-gotruf-400 hover:text-gotruf-300 transition-colors"
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-[10px] text-gray-500 hover:text-red-400 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading && notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <BellIcon className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={handleMarkRead}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const icon = NOTIFICATION_TYPE_ICONS[notification.type] || 'ℹ️';
  const priorityColors: Record<string, string> = {
    urgent: 'border-l-red-500',
    high: 'border-l-orange-500',
    normal: 'border-l-transparent',
    low: 'border-l-transparent',
  };

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 border-b border-gray-800/50 border-l-2 ${
        priorityColors[notification.priority]
      } ${
        notification.read ? 'opacity-60' : 'bg-gray-800/30'
      } hover:bg-gray-800/50 transition-colors group`}
      onClick={() => !notification.read && onMarkRead(notification.id)}
    >
      {/* Icon */}
      <span className="text-base mt-0.5 shrink-0">{icon}</span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium text-white truncate">
            {notification.title}
          </span>
          {!notification.read && (
            <span className="w-1.5 h-1.5 rounded-full bg-gotruf-500 shrink-0" />
          )}
        </div>
        <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">
          {notification.message}
        </p>
        <span className="text-[10px] text-gray-600 mt-1 block">
          {formatRelativeTime(notification.createdAt)}
        </span>
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(notification.id); }}
        className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-0.5 shrink-0"
        aria-label="Delete notification"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}
