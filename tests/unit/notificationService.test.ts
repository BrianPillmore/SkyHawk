/**
 * Unit tests for notification service utilities
 * Run with: npx vitest run tests/unit/notificationService.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createNotification,
  notifyPropertyCreated,
  notifyMeasurementCompleted,
  notifyReportGenerated,
  notifyBatchCompleted,
  notifyClaimCreated,
  notifyClaimUpdated,
  notifyInspectionScheduled,
  notifyReportShared,
  notifyCreditEarned,
  notifyCreditUsed,
  filterNotifications,
  getUnreadCount,
  sortNotifications,
  groupNotificationsByDate,
  getDefaultPreferences,
  formatRelativeTime,
} from '../../src/utils/notificationService';
import type { Notification, NotificationPreferences } from '../../src/types/notification';

// ─── createNotification ──────────────────────────────────────────

describe('createNotification', () => {
  it('creates a notification with defaults', () => {
    const n = createNotification('system.info', 'Test', 'Hello world');
    expect(n.id).toBeTruthy();
    expect(n.type).toBe('system.info');
    expect(n.title).toBe('Test');
    expect(n.message).toBe('Hello world');
    expect(n.priority).toBe('normal');
    expect(n.read).toBe(false);
    expect(n.createdAt).toBeTruthy();
    expect(n.actionUrl).toBeUndefined();
    expect(n.metadata).toBeUndefined();
  });

  it('accepts optional fields', () => {
    const n = createNotification('batch.completed', 'Done', 'All done', {
      priority: 'high',
      actionUrl: '/batch',
      metadata: { total: 10 },
    });
    expect(n.priority).toBe('high');
    expect(n.actionUrl).toBe('/batch');
    expect(n.metadata).toEqual({ total: 10 });
  });

  it('generates unique IDs', () => {
    const a = createNotification('system.info', 'A', 'msg');
    const b = createNotification('system.info', 'B', 'msg');
    expect(a.id).not.toBe(b.id);
  });
});

// ─── Factory functions ───────────────────────────────────────────

describe('notification factory functions', () => {
  it('notifyPropertyCreated', () => {
    const n = notifyPropertyCreated('123 Main St', 'prop-1');
    expect(n.type).toBe('property.created');
    expect(n.title).toBe('Property Added');
    expect(n.message).toContain('123 Main St');
    expect(n.actionUrl).toBe('/dashboard');
    expect(n.metadata?.propertyId).toBe('prop-1');
  });

  it('notifyMeasurementCompleted', () => {
    const n = notifyMeasurementCompleted('456 Oak', 2500, 'prop-2');
    expect(n.type).toBe('measurement.completed');
    expect(n.message).toContain('456 Oak');
    expect(n.message).toContain('2,500');
    expect(n.metadata?.areaSqFt).toBe(2500);
  });

  it('notifyReportGenerated', () => {
    const n = notifyReportGenerated('789 Elm', 'prop-3');
    expect(n.type).toBe('report.generated');
    expect(n.message).toContain('789 Elm');
    expect(n.actionUrl).toBe('/workspace');
  });

  it('notifyBatchCompleted with no failures', () => {
    const n = notifyBatchCompleted(10, 10, 0);
    expect(n.type).toBe('batch.completed');
    expect(n.priority).toBe('normal');
    expect(n.message).toContain('10');
    expect(n.message).toContain('0 failed');
  });

  it('notifyBatchCompleted with failures sets high priority', () => {
    const n = notifyBatchCompleted(10, 7, 3);
    expect(n.priority).toBe('high');
    expect(n.message).toContain('3 failed');
  });

  it('notifyClaimCreated', () => {
    const n = notifyClaimCreated('CLM-001', '100 Pine');
    expect(n.type).toBe('claim.created');
    expect(n.message).toContain('CLM-001');
    expect(n.message).toContain('100 Pine');
  });

  it('notifyClaimUpdated', () => {
    const n = notifyClaimUpdated('CLM-001', 'approved');
    expect(n.type).toBe('claim.updated');
    expect(n.priority).toBe('high');
    expect(n.message).toContain('approved');
  });

  it('notifyInspectionScheduled', () => {
    const n = notifyInspectionScheduled('200 Cedar', '2026-03-15', '10:00 AM');
    expect(n.type).toBe('inspection.scheduled');
    expect(n.priority).toBe('high');
    expect(n.message).toContain('200 Cedar');
    expect(n.message).toContain('2026-03-15');
  });

  it('notifyReportShared', () => {
    const n = notifyReportShared('300 Maple', 'bob@example.com');
    expect(n.type).toBe('report.shared');
    expect(n.message).toContain('bob@example.com');
  });

  it('notifyCreditEarned singular', () => {
    const n = notifyCreditEarned(1, 'EagleView upload');
    expect(n.type).toBe('credit.earned');
    expect(n.message).toContain('1 credit:');
    expect(n.message).toContain('EagleView upload');
  });

  it('notifyCreditEarned plural', () => {
    const n = notifyCreditEarned(5, 'bonus');
    expect(n.message).toContain('5 credits:');
  });

  it('notifyCreditUsed', () => {
    const n = notifyCreditUsed(4);
    expect(n.type).toBe('credit.used');
    expect(n.priority).toBe('low');
    expect(n.message).toContain('4 remaining');
  });
});

// ─── filterNotifications ─────────────────────────────────────────

describe('filterNotifications', () => {
  const notifications: Notification[] = [
    createNotification('property.created', 'P', 'm'),
    createNotification('batch.completed', 'B', 'm'),
    createNotification('system.info', 'S', 'm'),
  ];

  it('returns empty when inApp is false', () => {
    const prefs: NotificationPreferences = { inApp: false, enabledTypes: [] };
    expect(filterNotifications(notifications, prefs)).toEqual([]);
  });

  it('filters by enabled types', () => {
    const prefs: NotificationPreferences = {
      inApp: true,
      enabledTypes: ['property.created', 'system.info'],
    };
    const result = filterNotifications(notifications, prefs);
    expect(result).toHaveLength(2);
    expect(result.map((n) => n.type)).toEqual(['property.created', 'system.info']);
  });

  it('returns all when all types enabled', () => {
    const prefs: NotificationPreferences = {
      inApp: true,
      enabledTypes: ['property.created', 'batch.completed', 'system.info'],
    };
    expect(filterNotifications(notifications, prefs)).toHaveLength(3);
  });
});

// ─── getUnreadCount ──────────────────────────────────────────────

describe('getUnreadCount', () => {
  it('counts unread notifications', () => {
    const notifications: Notification[] = [
      { ...createNotification('system.info', 'A', 'm'), read: false },
      { ...createNotification('system.info', 'B', 'm'), read: true },
      { ...createNotification('system.info', 'C', 'm'), read: false },
    ];
    expect(getUnreadCount(notifications)).toBe(2);
  });

  it('returns 0 for empty list', () => {
    expect(getUnreadCount([])).toBe(0);
  });

  it('returns 0 when all read', () => {
    const notifications: Notification[] = [
      { ...createNotification('system.info', 'A', 'm'), read: true },
    ];
    expect(getUnreadCount(notifications)).toBe(0);
  });
});

// ─── sortNotifications ───────────────────────────────────────────

describe('sortNotifications', () => {
  it('puts unread before read', () => {
    const a = { ...createNotification('system.info', 'Read', 'm'), read: true, createdAt: '2025-03-20T00:00:00Z' };
    const b = { ...createNotification('system.info', 'Unread', 'm'), read: false, createdAt: '2025-03-10T00:00:00Z' };
    const result = sortNotifications([a, b]);
    expect(result[0].title).toBe('Unread');
    expect(result[1].title).toBe('Read');
  });

  it('sorts by priority within unread group', () => {
    const urgent = { ...createNotification('system.warning', 'Urgent', 'm', { priority: 'urgent' }), read: false };
    const normal = { ...createNotification('system.info', 'Normal', 'm'), read: false };
    const low = { ...createNotification('system.info', 'Low', 'm', { priority: 'low' }), read: false };
    const result = sortNotifications([low, normal, urgent]);
    expect(result[0].title).toBe('Urgent');
    expect(result[1].title).toBe('Normal');
    expect(result[2].title).toBe('Low');
  });

  it('sorts by date (newest first) within same priority', () => {
    const old = { ...createNotification('system.info', 'Old', 'm'), read: false, createdAt: '2025-01-01T00:00:00Z' };
    const recent = { ...createNotification('system.info', 'Recent', 'm'), read: false, createdAt: '2025-03-01T00:00:00Z' };
    const result = sortNotifications([old, recent]);
    expect(result[0].title).toBe('Recent');
    expect(result[1].title).toBe('Old');
  });

  it('does not mutate original array', () => {
    const notifications = [
      { ...createNotification('system.info', 'A', 'm'), read: true },
      { ...createNotification('system.info', 'B', 'm'), read: false },
    ];
    const original = [...notifications];
    sortNotifications(notifications);
    expect(notifications.map((n) => n.title)).toEqual(original.map((n) => n.title));
  });
});

// ─── groupNotificationsByDate ────────────────────────────────────

describe('groupNotificationsByDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-20T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('groups into Today, Yesterday, and dated groups', () => {
    const today = { ...createNotification('system.info', 'Today', 'm'), createdAt: '2025-03-20T10:00:00Z' };
    const yesterday = { ...createNotification('system.info', 'Yesterday', 'm'), createdAt: '2025-03-19T15:00:00Z' };
    const older = { ...createNotification('system.info', 'Older', 'm'), createdAt: '2025-03-15T10:00:00Z' };

    const groups = groupNotificationsByDate([today, yesterday, older]);
    expect(groups).toHaveLength(3);
    expect(groups[0].label).toBe('Today');
    expect(groups[0].notifications).toHaveLength(1);
    expect(groups[1].label).toBe('Yesterday');
    expect(groups[1].notifications).toHaveLength(1);
    expect(groups[2].label).toContain('Mar');
    expect(groups[2].notifications).toHaveLength(1);
  });

  it('returns empty for no notifications', () => {
    expect(groupNotificationsByDate([])).toEqual([]);
  });

  it('groups multiple items in same date together', () => {
    const a = { ...createNotification('system.info', 'A', 'm'), createdAt: '2025-03-20T08:00:00Z' };
    const b = { ...createNotification('system.info', 'B', 'm'), createdAt: '2025-03-20T14:00:00Z' };
    const groups = groupNotificationsByDate([a, b]);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Today');
    expect(groups[0].notifications).toHaveLength(2);
  });
});

// ─── getDefaultPreferences ───────────────────────────────────────

describe('getDefaultPreferences', () => {
  it('returns all types enabled with inApp true', () => {
    const prefs = getDefaultPreferences();
    expect(prefs.inApp).toBe(true);
    expect(prefs.enabledTypes.length).toBeGreaterThan(0);
    expect(prefs.enabledTypes).toContain('property.created');
    expect(prefs.enabledTypes).toContain('batch.completed');
    expect(prefs.enabledTypes).toContain('system.warning');
  });
});

// ─── formatRelativeTime ──────────────────────────────────────────

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-20T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for very recent', () => {
    expect(formatRelativeTime('2025-03-20T11:59:45Z')).toBe('just now');
  });

  it('returns minutes ago', () => {
    expect(formatRelativeTime('2025-03-20T11:45:00Z')).toBe('15m ago');
  });

  it('returns hours ago', () => {
    expect(formatRelativeTime('2025-03-20T09:00:00Z')).toBe('3h ago');
  });

  it('returns days ago', () => {
    expect(formatRelativeTime('2025-03-18T12:00:00Z')).toBe('2d ago');
  });

  it('returns formatted date for over a week', () => {
    const result = formatRelativeTime('2025-03-01T12:00:00Z');
    expect(result).toContain('Mar');
  });
});

// ─── NOTIFICATION_TYPE_ICONS & LABELS ────────────────────────────

describe('notification type constants', () => {
  it('has icons for all types', async () => {
    const { NOTIFICATION_TYPE_ICONS, NOTIFICATION_TYPE_LABELS } = await import('../../src/types/notification');
    const types = Object.keys(NOTIFICATION_TYPE_LABELS);
    for (const type of types) {
      expect(NOTIFICATION_TYPE_ICONS[type as keyof typeof NOTIFICATION_TYPE_ICONS]).toBeTruthy();
    }
  });

  it('has labels for all types', async () => {
    const { NOTIFICATION_TYPE_LABELS } = await import('../../src/types/notification');
    expect(Object.keys(NOTIFICATION_TYPE_LABELS).length).toBeGreaterThanOrEqual(12);
  });
});
