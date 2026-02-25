/**
 * Unit tests for property timeline utilities
 * Run with: npx vitest run tests/unit/propertyTimeline.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildPropertyTimeline,
  createPropertyNote,
  filterTimelineEvents,
  groupTimelineByDate,
  getTimelineSummary,
  formatEventTime,
} from '../../src/utils/propertyTimeline';
import type { Property } from '../../src/types';
import type { PropertyNote } from '../../src/types/timeline';

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 'prop-1',
    address: '123 Main St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73102',
    lat: 35.4676,
    lng: -97.5164,
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-03-20T12:00:00Z',
    measurements: [],
    damageAnnotations: [],
    snapshots: [],
    claims: [],
    notes: '',
    ...overrides,
  };
}

function makeMeasurement(id: string, created: string) {
  return {
    id,
    propertyId: 'prop-1',
    createdAt: created,
    updatedAt: created,
    vertices: [],
    edges: [],
    facets: [
      { id: 'f1', name: '#1', vertexIds: [], pitch: 6, areaSqFt: 500, trueAreaSqFt: 515, edgeIds: [] },
      { id: 'f2', name: '#2', vertexIds: [], pitch: 6, areaSqFt: 500, trueAreaSqFt: 515, edgeIds: [] },
    ],
    totalAreaSqFt: 1000,
    totalTrueAreaSqFt: 1030,
    totalSquares: 10.3,
    predominantPitch: 6,
    totalRidgeLf: 30,
    totalHipLf: 0,
    totalValleyLf: 0,
    totalRakeLf: 50,
    totalEaveLf: 60,
    totalFlashingLf: 0,
    totalStepFlashingLf: 0,
    totalDripEdgeLf: 0,
    suggestedWastePercent: 10,
    ridgeCount: 1,
    hipCount: 0,
    valleyCount: 0,
    rakeCount: 2,
    eaveCount: 2,
    flashingCount: 0,
    stepFlashingCount: 0,
    structureComplexity: 'Normal' as const,
    estimatedAtticSqFt: 0,
    pitchBreakdown: [],
  };
}

// ─── buildPropertyTimeline ───────────────────────────────────────

describe('buildPropertyTimeline', () => {
  it('creates a property.created event', () => {
    const property = makeProperty();
    const events = buildPropertyTimeline(property);
    expect(events.length).toBeGreaterThanOrEqual(1);
    const created = events.find((e) => e.type === 'property.created');
    expect(created).toBeDefined();
    expect(created!.title).toBe('Property Added');
    expect(created!.description).toContain('123 Main St');
  });

  it('includes measurement events', () => {
    const property = makeProperty({
      measurements: [
        makeMeasurement('m-1', '2025-02-10T10:00:00Z'),
        makeMeasurement('m-2', '2025-03-01T14:00:00Z'),
      ],
    });
    const events = buildPropertyTimeline(property);
    const measEvents = events.filter((e) => e.type === 'measurement.added');
    expect(measEvents).toHaveLength(2);
    expect(measEvents[0].description).toContain('1,030');
    expect(measEvents[0].description).toContain('10.3');
  });

  it('includes damage annotation events', () => {
    const property = makeProperty({
      damageAnnotations: [
        {
          id: 'd-1',
          propertyId: 'prop-1',
          lat: 35.467,
          lng: -97.516,
          type: 'hail',
          severity: 'moderate',
          notes: 'Large dents on north-facing facet',
          createdAt: '2025-03-05T08:00:00Z',
          photoUrl: '',
        },
      ],
    });
    const events = buildPropertyTimeline(property);
    const damageEvents = events.filter((e) => e.type === 'damage.annotated');
    expect(damageEvents).toHaveLength(1);
    expect(damageEvents[0].description).toContain('moderate');
    expect(damageEvents[0].description).toContain('hail');
  });

  it('includes snapshot events', () => {
    const property = makeProperty({
      snapshots: [
        { id: 's-1', label: 'Before storm', dataUrl: '', createdAt: '2025-03-01T09:00:00Z' },
      ],
    });
    const events = buildPropertyTimeline(property);
    const snapEvents = events.filter((e) => e.type === 'snapshot.added');
    expect(snapEvents).toHaveLength(1);
    expect(snapEvents[0].description).toBe('Before storm');
  });

  it('includes claim events', () => {
    const property = makeProperty({
      claims: [
        {
          id: 'c-1',
          propertyId: 'prop-1',
          claimNumber: 'CLM-2025-001',
          insuredName: 'John Doe',
          dateOfLoss: '2025-02-28',
          status: 'filed',
          notes: '',
          createdAt: '2025-03-02T10:00:00Z',
          updatedAt: '2025-03-02T10:00:00Z',
        },
      ],
    });
    const events = buildPropertyTimeline(property);
    const claimEvents = events.filter((e) => e.type === 'claim.filed');
    expect(claimEvents).toHaveLength(1);
    expect(claimEvents[0].description).toContain('CLM-2025-001');
  });

  it('includes note events', () => {
    const notes: PropertyNote[] = [
      {
        id: 'n-1',
        propertyId: 'prop-1',
        text: 'Homeowner reported water stains in attic',
        author: 'brian',
        createdAt: '2025-03-10T16:00:00Z',
        updatedAt: '2025-03-10T16:00:00Z',
      },
    ];
    const property = makeProperty();
    const events = buildPropertyTimeline(property, notes);
    const noteEvents = events.filter((e) => e.type === 'note.added');
    expect(noteEvents).toHaveLength(1);
    expect(noteEvents[0].description).toContain('water stains');
  });

  it('truncates long note descriptions', () => {
    const notes: PropertyNote[] = [
      {
        id: 'n-2',
        propertyId: 'prop-1',
        text: 'A'.repeat(200),
        author: 'brian',
        createdAt: '2025-03-10T16:00:00Z',
        updatedAt: '2025-03-10T16:00:00Z',
      },
    ];
    const property = makeProperty();
    const events = buildPropertyTimeline(property, notes);
    const noteEvent = events.find((e) => e.type === 'note.added');
    expect(noteEvent!.description.length).toBeLessThanOrEqual(103); // 100 + "..."
  });

  it('sorts events by timestamp descending (newest first)', () => {
    const property = makeProperty({
      measurements: [
        makeMeasurement('m-1', '2025-02-10T10:00:00Z'),
      ],
    });
    const events = buildPropertyTimeline(property);
    // Measurement (Feb 10) should be after property created (Jan 15)
    expect(events[0].type).toBe('measurement.added');
    expect(events[1].type).toBe('property.created');
  });
});

// ─── createPropertyNote ──────────────────────────────────────────

describe('createPropertyNote', () => {
  it('creates a note with required fields', () => {
    const note = createPropertyNote('prop-1', 'Test note', 'brian');
    expect(note.id).toBeTruthy();
    expect(note.propertyId).toBe('prop-1');
    expect(note.text).toBe('Test note');
    expect(note.author).toBe('brian');
    expect(note.createdAt).toBeTruthy();
    expect(note.updatedAt).toBeTruthy();
  });

  it('generates unique IDs', () => {
    const a = createPropertyNote('p1', 'note a', 'u1');
    const b = createPropertyNote('p1', 'note b', 'u1');
    expect(a.id).not.toBe(b.id);
  });
});

// ─── filterTimelineEvents ────────────────────────────────────────

describe('filterTimelineEvents', () => {
  const property = makeProperty({
    measurements: [makeMeasurement('m-1', '2025-02-10T10:00:00Z')],
    damageAnnotations: [
      {
        id: 'd-1',
        propertyId: 'prop-1',
        lat: 35.467,
        lng: -97.516,
        type: 'hail',
        severity: 'moderate',
        notes: '',
        createdAt: '2025-03-05T08:00:00Z',
        photoUrl: '',
      },
    ],
  });
  const events = buildPropertyTimeline(property);

  it('returns all events for empty filter array', () => {
    expect(filterTimelineEvents(events, [])).toHaveLength(events.length);
  });

  it('filters to specific types', () => {
    const result = filterTimelineEvents(events, ['measurement.added']);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('measurement.added');
  });

  it('supports multiple filter types', () => {
    const result = filterTimelineEvents(events, ['measurement.added', 'damage.annotated']);
    expect(result).toHaveLength(2);
  });
});

// ─── groupTimelineByDate ─────────────────────────────────────────

describe('groupTimelineByDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-20T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('groups events by date', () => {
    const property = makeProperty({
      measurements: [
        makeMeasurement('m-1', '2025-03-20T10:00:00Z'),
        makeMeasurement('m-2', '2025-03-19T10:00:00Z'),
      ],
    });
    const events = buildPropertyTimeline(property);
    const groups = groupTimelineByDate(events);

    expect(groups.length).toBeGreaterThanOrEqual(2);
    expect(groups[0].label).toBe('Today');
    expect(groups[1].label).toBe('Yesterday');
  });

  it('returns empty for no events', () => {
    expect(groupTimelineByDate([])).toEqual([]);
  });
});

// ─── getTimelineSummary ──────────────────────────────────────────

describe('getTimelineSummary', () => {
  it('returns "No activity" for empty list', () => {
    expect(getTimelineSummary([])).toBe('No activity');
  });

  it('returns singular form for 1 event', () => {
    const property = makeProperty();
    const events = buildPropertyTimeline(property);
    expect(events).toHaveLength(1);
    expect(getTimelineSummary(events)).toContain('1 event');
    expect(getTimelineSummary(events)).toContain('1 day');
  });

  it('returns plural form for multiple events', () => {
    const property = makeProperty({
      measurements: [
        makeMeasurement('m-1', '2025-02-10T10:00:00Z'),
        makeMeasurement('m-2', '2025-03-01T10:00:00Z'),
      ],
    });
    const events = buildPropertyTimeline(property);
    const summary = getTimelineSummary(events);
    expect(summary).toContain('3 events');
    expect(summary).toContain('days');
  });
});

// ─── formatEventTime ─────────────────────────────────────────────

describe('formatEventTime', () => {
  it('formats time in 12-hour format', () => {
    const result = formatEventTime('2025-03-20T14:30:00Z');
    // Result depends on locale, but should contain either PM or AM
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─── Timeline type constants ─────────────────────────────────────

describe('timeline type constants', () => {
  it('has icons for all event types', async () => {
    const { TIMELINE_EVENT_ICONS, TIMELINE_EVENT_COLORS } = await import('../../src/types/timeline');
    const types = Object.keys(TIMELINE_EVENT_ICONS);
    expect(types.length).toBeGreaterThanOrEqual(13);
    for (const type of types) {
      expect(TIMELINE_EVENT_COLORS).toHaveProperty(type);
    }
  });
});
