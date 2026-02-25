export type TimelineEventType =
  | 'property.created'
  | 'measurement.added'
  | 'measurement.updated'
  | 'report.generated'
  | 'damage.annotated'
  | 'claim.filed'
  | 'claim.status_changed'
  | 'inspection.scheduled'
  | 'inspection.completed'
  | 'note.added'
  | 'snapshot.added'
  | 'condition.assessed'
  | 'export.completed';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, string | number>;
}

export interface PropertyNote {
  id: string;
  propertyId: string;
  text: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export const TIMELINE_EVENT_ICONS: Record<TimelineEventType, string> = {
  'property.created': '🏠',
  'measurement.added': '📐',
  'measurement.updated': '📐',
  'report.generated': '📄',
  'damage.annotated': '⚠️',
  'claim.filed': '🛡️',
  'claim.status_changed': '🛡️',
  'inspection.scheduled': '📅',
  'inspection.completed': '✅',
  'note.added': '📝',
  'snapshot.added': '📸',
  'condition.assessed': '🔍',
  'export.completed': '📤',
};

export const TIMELINE_EVENT_COLORS: Record<TimelineEventType, string> = {
  'property.created': 'bg-blue-500',
  'measurement.added': 'bg-gotruf-500',
  'measurement.updated': 'bg-gotruf-400',
  'report.generated': 'bg-purple-500',
  'damage.annotated': 'bg-red-500',
  'claim.filed': 'bg-amber-500',
  'claim.status_changed': 'bg-amber-400',
  'inspection.scheduled': 'bg-cyan-500',
  'inspection.completed': 'bg-green-500',
  'note.added': 'bg-gray-500',
  'snapshot.added': 'bg-indigo-500',
  'condition.assessed': 'bg-teal-500',
  'export.completed': 'bg-violet-500',
};
