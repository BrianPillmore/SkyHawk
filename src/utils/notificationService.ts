import { v4 as uuidv4 } from 'uuid';
import type {
  Notification,
  NotificationType,
  NotificationPriority,
  NotificationPreferences,
  NOTIFICATION_PRIORITY_ORDER as _,
} from '../types/notification';

/**
 * Create a notification object.
 */
export function createNotification(
  type: NotificationType,
  title: string,
  message: string,
  options?: {
    priority?: NotificationPriority;
    actionUrl?: string;
    metadata?: Record<string, string | number>;
  },
): Notification {
  return {
    id: uuidv4(),
    type,
    title,
    message,
    priority: options?.priority || 'normal',
    read: false,
    createdAt: new Date().toISOString(),
    actionUrl: options?.actionUrl,
    metadata: options?.metadata,
  };
}

/**
 * Create a notification when a property is added.
 */
export function notifyPropertyCreated(address: string, propertyId: string): Notification {
  return createNotification(
    'property.created',
    'Property Added',
    `${address} has been added to your properties.`,
    { actionUrl: '/dashboard', metadata: { propertyId } },
  );
}

/**
 * Create a notification when a measurement completes.
 */
export function notifyMeasurementCompleted(
  address: string,
  areaSqFt: number,
  propertyId: string,
): Notification {
  return createNotification(
    'measurement.completed',
    'Measurement Complete',
    `${address} — ${areaSqFt.toLocaleString()} sq ft measured.`,
    { actionUrl: '/workspace', metadata: { propertyId, areaSqFt } },
  );
}

/**
 * Create a notification when a report is generated.
 */
export function notifyReportGenerated(address: string, propertyId: string): Notification {
  return createNotification(
    'report.generated',
    'Report Generated',
    `PDF report for ${address} is ready.`,
    { actionUrl: '/workspace', metadata: { propertyId } },
  );
}

/**
 * Create a notification when a batch job completes.
 */
export function notifyBatchCompleted(
  total: number,
  succeeded: number,
  failed: number,
): Notification {
  const priority: NotificationPriority = failed > 0 ? 'high' : 'normal';
  return createNotification(
    'batch.completed',
    'Batch Complete',
    `Processed ${total} properties: ${succeeded} succeeded, ${failed} failed.`,
    { priority, actionUrl: '/batch', metadata: { total, succeeded, failed } },
  );
}

/**
 * Create a notification when a claim is created.
 */
export function notifyClaimCreated(claimNumber: string, address: string): Notification {
  return createNotification(
    'claim.created',
    'Claim Created',
    `Claim ${claimNumber} filed for ${address}.`,
    { metadata: { claimNumber } },
  );
}

/**
 * Create a notification when a claim status changes.
 */
export function notifyClaimUpdated(claimNumber: string, newStatus: string): Notification {
  return createNotification(
    'claim.updated',
    'Claim Updated',
    `Claim ${claimNumber} status changed to ${newStatus}.`,
    { priority: 'high', metadata: { claimNumber, newStatus } },
  );
}

/**
 * Create a notification when an inspection is scheduled.
 */
export function notifyInspectionScheduled(
  address: string,
  date: string,
  time: string,
): Notification {
  return createNotification(
    'inspection.scheduled',
    'Inspection Scheduled',
    `Inspection for ${address} on ${date} at ${time}.`,
    { priority: 'high', metadata: { date, time } },
  );
}

/**
 * Create a notification when a report is shared.
 */
export function notifyReportShared(address: string, sharedWith: string): Notification {
  return createNotification(
    'report.shared',
    'Report Shared',
    `Report for ${address} shared with ${sharedWith}.`,
    { metadata: { sharedWith } },
  );
}

/**
 * Create a notification when credits are earned.
 */
export function notifyCreditEarned(amount: number, reason: string): Notification {
  return createNotification(
    'credit.earned',
    'Credits Earned',
    `You earned ${amount} credit${amount !== 1 ? 's' : ''}: ${reason}.`,
    { metadata: { amount } },
  );
}

/**
 * Create a notification when credits are used.
 */
export function notifyCreditUsed(remaining: number): Notification {
  return createNotification(
    'credit.used',
    'Credit Used',
    `1 credit used. ${remaining} remaining.`,
    { priority: 'low', metadata: { remaining } },
  );
}

/**
 * Filter notifications based on user preferences.
 */
export function filterNotifications(
  notifications: Notification[],
  preferences: NotificationPreferences,
): Notification[] {
  if (!preferences.inApp) return [];
  return notifications.filter((n) => preferences.enabledTypes.includes(n.type));
}

/**
 * Get unread count.
 */
export function getUnreadCount(notifications: Notification[]): number {
  return notifications.filter((n) => !n.read).length;
}

/**
 * Sort notifications: unread first, then by priority, then by date (newest first).
 */
export function sortNotifications(notifications: Notification[]): Notification[] {
  const priorityOrder: Record<NotificationPriority, number> = {
    urgent: 0,
    high: 1,
    normal: 2,
    low: 3,
  };

  return [...notifications].sort((a, b) => {
    // Unread first
    if (a.read !== b.read) return a.read ? 1 : -1;
    // Then by priority
    const pa = priorityOrder[a.priority];
    const pb = priorityOrder[b.priority];
    if (pa !== pb) return pa - pb;
    // Then by date (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/**
 * Group notifications by date for display.
 */
export function groupNotificationsByDate(
  notifications: Notification[],
): { label: string; notifications: Notification[] }[] {
  const groups = new Map<string, Notification[]>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const n of notifications) {
    const date = new Date(n.createdAt);
    date.setHours(0, 0, 0, 0);

    let label: string;
    if (date.getTime() === today.getTime()) {
      label = 'Today';
    } else if (date.getTime() === yesterday.getTime()) {
      label = 'Yesterday';
    } else {
      label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    const existing = groups.get(label) || [];
    existing.push(n);
    groups.set(label, existing);
  }

  return Array.from(groups.entries()).map(([label, notifs]) => ({
    label,
    notifications: notifs,
  }));
}

/**
 * Default notification preferences (all enabled).
 */
export function getDefaultPreferences(): NotificationPreferences {
  return {
    inApp: true,
    enabledTypes: [
      'property.created',
      'measurement.completed',
      'report.generated',
      'batch.completed',
      'claim.updated',
      'claim.created',
      'inspection.scheduled',
      'report.shared',
      'credit.earned',
      'credit.used',
      'system.info',
      'system.warning',
    ],
  };
}

/**
 * Format relative time for notification display.
 */
export function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
