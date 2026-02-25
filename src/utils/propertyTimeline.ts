import { v4 as uuidv4 } from 'uuid';
import type { Property } from '../types';
import type { TimelineEvent, PropertyNote, TimelineEventType } from '../types/timeline';
import { formatArea, formatNumber } from './geometry';

/**
 * Build a complete timeline from a property's data.
 * Aggregates events from measurements, damage annotations, claims, snapshots, and notes.
 */
export function buildPropertyTimeline(
  property: Property,
  notes: PropertyNote[] = [],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Property created event
  events.push({
    id: `evt-created-${property.id}`,
    type: 'property.created',
    title: 'Property Added',
    description: `${property.address}, ${property.city}, ${property.state} ${property.zip}`,
    timestamp: property.createdAt,
  });

  // Measurement events
  for (const m of property.measurements) {
    events.push({
      id: `evt-meas-${m.id}`,
      type: 'measurement.added',
      title: 'Measurement Taken',
      description: `${formatArea(m.totalTrueAreaSqFt)} total area, ${formatNumber(m.totalSquares, 1)} squares, ${m.facets.length} facets, ${m.predominantPitch}/12 pitch`,
      timestamp: m.createdAt,
      metadata: {
        measurementId: m.id,
        areaSqFt: m.totalTrueAreaSqFt,
        squares: m.totalSquares,
        facets: m.facets.length,
      },
    });
  }

  // Damage annotation events
  for (const d of property.damageAnnotations) {
    events.push({
      id: `evt-dmg-${d.id}`,
      type: 'damage.annotated',
      title: 'Damage Noted',
      description: `${d.severity} ${d.type}${d.notes ? `: ${d.notes}` : ''}`,
      timestamp: d.createdAt,
      metadata: { damageId: d.id, type: d.type, severity: d.severity },
    });
  }

  // Snapshot events
  for (const s of property.snapshots) {
    events.push({
      id: `evt-snap-${s.id}`,
      type: 'snapshot.added',
      title: 'Photo Captured',
      description: s.label || 'Image snapshot',
      timestamp: s.createdAt,
      metadata: { snapshotId: s.id },
    });
  }

  // Claim events
  for (const c of property.claims) {
    events.push({
      id: `evt-claim-${c.id}`,
      type: 'claim.filed',
      title: 'Claim Filed',
      description: `Claim #${c.claimNumber} — Insured: ${c.insuredName}`,
      timestamp: c.createdAt,
      metadata: { claimId: c.id, claimNumber: c.claimNumber },
    });
  }

  // Note events
  for (const n of notes) {
    events.push({
      id: `evt-note-${n.id}`,
      type: 'note.added',
      title: 'Note Added',
      description: n.text.length > 100 ? n.text.slice(0, 100) + '...' : n.text,
      timestamp: n.createdAt,
      metadata: { noteId: n.id, author: n.author },
    });
  }

  // Sort by timestamp descending (newest first)
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return events;
}

/**
 * Create a property note.
 */
export function createPropertyNote(
  propertyId: string,
  text: string,
  author: string,
): PropertyNote {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    propertyId,
    text,
    author,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Filter timeline events by type.
 */
export function filterTimelineEvents(
  events: TimelineEvent[],
  types: TimelineEventType[],
): TimelineEvent[] {
  if (types.length === 0) return events;
  return events.filter((e) => types.includes(e.type));
}

/**
 * Group timeline events by date for display.
 */
export function groupTimelineByDate(
  events: TimelineEvent[],
): { label: string; events: TimelineEvent[] }[] {
  const groups = new Map<string, TimelineEvent[]>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const event of events) {
    const date = new Date(event.timestamp);
    date.setHours(0, 0, 0, 0);

    let label: string;
    if (date.getTime() === today.getTime()) {
      label = 'Today';
    } else if (date.getTime() === yesterday.getTime()) {
      label = 'Yesterday';
    } else {
      label = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }

    const existing = groups.get(label) || [];
    existing.push(event);
    groups.set(label, existing);
  }

  return Array.from(groups.entries()).map(([label, evts]) => ({
    label,
    events: evts,
  }));
}

/**
 * Get a summary string for the timeline (e.g., "5 events over 3 days").
 */
export function getTimelineSummary(events: TimelineEvent[]): string {
  if (events.length === 0) return 'No activity';
  const count = events.length;

  const dates = new Set(
    events.map((e) => {
      const d = new Date(e.timestamp);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }),
  );

  const dayCount = dates.size;
  return `${count} event${count !== 1 ? 's' : ''} over ${dayCount} day${dayCount !== 1 ? 's' : ''}`;
}

/**
 * Format timeline event timestamp for display.
 */
export function formatEventTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
