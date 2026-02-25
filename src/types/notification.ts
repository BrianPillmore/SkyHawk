export type NotificationType =
  | 'property.created'
  | 'measurement.completed'
  | 'report.generated'
  | 'batch.completed'
  | 'claim.updated'
  | 'claim.created'
  | 'inspection.scheduled'
  | 'report.shared'
  | 'credit.earned'
  | 'credit.used'
  | 'system.info'
  | 'system.warning';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  read: boolean;
  createdAt: string;
  /** Optional link to navigate to on click */
  actionUrl?: string;
  /** Metadata attached to the notification (e.g. propertyId, batchJobId) */
  metadata?: Record<string, string | number>;
}

export interface NotificationPreferences {
  /** In-app notifications enabled */
  inApp: boolean;
  /** Which notification types to show */
  enabledTypes: NotificationType[];
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  'property.created': 'Property Added',
  'measurement.completed': 'Measurement Complete',
  'report.generated': 'Report Generated',
  'batch.completed': 'Batch Complete',
  'claim.updated': 'Claim Updated',
  'claim.created': 'Claim Created',
  'inspection.scheduled': 'Inspection Scheduled',
  'report.shared': 'Report Shared',
  'credit.earned': 'Credit Earned',
  'credit.used': 'Credit Used',
  'system.info': 'System Info',
  'system.warning': 'System Warning',
};

export const NOTIFICATION_TYPE_ICONS: Record<NotificationType, string> = {
  'property.created': '🏠',
  'measurement.completed': '📐',
  'report.generated': '📄',
  'batch.completed': '📋',
  'claim.updated': '🛡️',
  'claim.created': '🛡️',
  'inspection.scheduled': '📅',
  'report.shared': '🔗',
  'credit.earned': '🎟️',
  'credit.used': '🎟️',
  'system.info': 'ℹ️',
  'system.warning': '⚠️',
};

export const NOTIFICATION_PRIORITY_ORDER: Record<NotificationPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};
