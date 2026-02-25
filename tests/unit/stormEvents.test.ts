/**
 * Unit tests for storm events utility
 * Run with: npx vitest run tests/unit/stormEvents.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  classifyHailSize,
  haversineDistanceMiles,
  filterByRadius,
  filterByType,
  filterByDateRange,
  sortEventsByDate,
  sortEventsByDistance,
  buildHailSummary,
  buildWindSummary,
  searchStormEvents,
  generateSampleEvents,
  formatEventSummary,
  assessStormRisk,
  STORM_TYPE_LABELS,
  STORM_TYPE_ICONS,
  HAIL_SIZE_LABELS,
  type StormEvent,
  type StormSearchResult,
} from '../../src/utils/stormEvents';

// ─── Helper: sample events ──────────────────────────────────────

function sampleEvents(): StormEvent[] {
  return [
    {
      id: '1', type: 'hail', date: '2026-01-15', county: 'Oklahoma', state: 'OK',
      description: 'Quarter-sized hail', hailSizeInches: 1.0, distanceMiles: 5, propertyDamage: 5000, source: 'sample',
    },
    {
      id: '2', type: 'hail', date: '2025-08-20', county: 'Canadian', state: 'OK',
      description: 'Golf ball hail', hailSizeInches: 1.75, distanceMiles: 12, propertyDamage: 15000, source: 'sample',
    },
    {
      id: '3', type: 'thunderstorm_wind', date: '2026-02-10', county: 'Oklahoma', state: 'OK',
      description: 'Severe thunderstorm winds', windSpeedMph: 65, distanceMiles: 8, propertyDamage: 8000, source: 'sample',
    },
    {
      id: '4', type: 'tornado', date: '2025-05-01', county: 'Cleveland', state: 'OK',
      description: 'EF1 tornado', windSpeedMph: 100, distanceMiles: 20, propertyDamage: 50000, source: 'sample',
    },
    {
      id: '5', type: 'flash_flood', date: '2025-06-15', county: 'Logan', state: 'OK',
      description: 'Flash flooding', distanceMiles: 30, propertyDamage: 3000, source: 'sample',
    },
    {
      id: '6', type: 'heavy_rain', date: '2024-12-01', county: 'Grady', state: 'OK',
      description: 'Heavy rain', distanceMiles: 3, source: 'sample',
    },
  ];
}

// ─── classifyHailSize ───────────────────────────────────────────

describe('classifyHailSize', () => {
  it('classifies small hail (< 0.75")', () => {
    expect(classifyHailSize(0.5)).toBe('small');
    expect(classifyHailSize(0.25)).toBe('small');
    expect(classifyHailSize(0)).toBe('small');
  });

  it('classifies medium hail (0.75" - 1.0")', () => {
    expect(classifyHailSize(0.75)).toBe('medium');
    expect(classifyHailSize(0.88)).toBe('medium');
  });

  it('classifies large hail (1.0" - 1.75")', () => {
    expect(classifyHailSize(1.0)).toBe('large');
    expect(classifyHailSize(1.5)).toBe('large');
  });

  it('classifies very large hail (1.75" - 2.75")', () => {
    expect(classifyHailSize(1.75)).toBe('very_large');
    expect(classifyHailSize(2.5)).toBe('very_large');
  });

  it('classifies giant hail (>= 2.75")', () => {
    expect(classifyHailSize(2.75)).toBe('giant');
    expect(classifyHailSize(4.0)).toBe('giant');
  });
});

// ─── haversineDistanceMiles ─────────────────────────────────────

describe('haversineDistanceMiles', () => {
  it('returns 0 for same point', () => {
    expect(haversineDistanceMiles(35.5, -97.7, 35.5, -97.7)).toBe(0);
  });

  it('calculates reasonable distance between cities', () => {
    // OKC to Tulsa: ~99 miles
    const dist = haversineDistanceMiles(35.4676, -97.5164, 36.1540, -95.9928);
    expect(dist).toBeGreaterThan(90);
    expect(dist).toBeLessThan(110);
  });

  it('is symmetric', () => {
    const d1 = haversineDistanceMiles(35.0, -97.0, 36.0, -96.0);
    const d2 = haversineDistanceMiles(36.0, -96.0, 35.0, -97.0);
    expect(d1).toBeCloseTo(d2, 6);
  });

  it('small distances are reasonable', () => {
    // ~1 degree lat ≈ 69 miles
    const dist = haversineDistanceMiles(35.0, -97.0, 36.0, -97.0);
    expect(dist).toBeGreaterThan(65);
    expect(dist).toBeLessThan(75);
  });
});

// ─── filterByRadius ─────────────────────────────────────────────

describe('filterByRadius', () => {
  it('filters events within radius', () => {
    const events = sampleEvents();
    const result = filterByRadius(events, 35.5, -97.7, 10);
    expect(result.every((e) => e.distanceMiles <= 10)).toBe(true);
    expect(result.length).toBeLessThan(events.length);
  });

  it('returns all events with large radius', () => {
    const events = sampleEvents();
    const result = filterByRadius(events, 35.5, -97.7, 100);
    expect(result.length).toBe(events.length);
  });

  it('returns no events with zero radius', () => {
    const events = sampleEvents();
    const result = filterByRadius(events, 35.5, -97.7, 0);
    expect(result.length).toBe(0);
  });
});

// ─── filterByType ───────────────────────────────────────────────

describe('filterByType', () => {
  it('filters by single type', () => {
    const events = sampleEvents();
    const result = filterByType(events, ['hail']);
    expect(result.every((e) => e.type === 'hail')).toBe(true);
    expect(result.length).toBe(2);
  });

  it('filters by multiple types', () => {
    const events = sampleEvents();
    const result = filterByType(events, ['hail', 'tornado']);
    expect(result.length).toBe(3);
  });

  it('returns all events when types array is empty', () => {
    const events = sampleEvents();
    const result = filterByType(events, []);
    expect(result.length).toBe(events.length);
  });
});

// ─── filterByDateRange ──────────────────────────────────────────

describe('filterByDateRange', () => {
  it('filters events within date range', () => {
    const events = sampleEvents();
    const result = filterByDateRange(events, '2025-01-01', '2025-12-31');
    expect(result.length).toBe(3); // Aug 2025, May 2025, Jun 2025
  });

  it('includes boundary dates', () => {
    const events = sampleEvents();
    const result = filterByDateRange(events, '2026-01-15', '2026-01-15');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('1');
  });

  it('returns empty for range with no events', () => {
    const events = sampleEvents();
    const result = filterByDateRange(events, '2020-01-01', '2020-12-31');
    expect(result.length).toBe(0);
  });
});

// ─── sortEventsByDate ───────────────────────────────────────────

describe('sortEventsByDate', () => {
  it('sorts most recent first', () => {
    const events = sampleEvents();
    const sorted = sortEventsByDate(events);
    expect(sorted[0].date).toBe('2026-02-10');
    expect(sorted[sorted.length - 1].date).toBe('2024-12-01');
  });

  it('does not mutate original array', () => {
    const events = sampleEvents();
    const original = [...events];
    sortEventsByDate(events);
    expect(events).toEqual(original);
  });
});

// ─── sortEventsByDistance ────────────────────────────────────────

describe('sortEventsByDistance', () => {
  it('sorts closest first', () => {
    const events = sampleEvents();
    const sorted = sortEventsByDistance(events);
    expect(sorted[0].distanceMiles).toBe(3);
    expect(sorted[sorted.length - 1].distanceMiles).toBe(30);
  });

  it('does not mutate original array', () => {
    const events = sampleEvents();
    const original = [...events];
    sortEventsByDistance(events);
    expect(events).toEqual(original);
  });
});

// ─── buildHailSummary ───────────────────────────────────────────

describe('buildHailSummary', () => {
  it('builds summary from hail events', () => {
    const events = sampleEvents();
    const summary = buildHailSummary(events);
    expect(summary).not.toBeNull();
    expect(summary!.eventCount).toBe(2);
    expect(summary!.maxSizeInches).toBe(1.75);
    expect(summary!.maxSizeCategory).toBe('very_large');
    expect(summary!.avgSizeInches).toBeCloseTo(1.38, 1);
  });

  it('returns null when no hail events', () => {
    const events = sampleEvents().filter((e) => e.type !== 'hail');
    expect(buildHailSummary(events)).toBeNull();
  });

  it('sets most recent date', () => {
    const events = sampleEvents();
    const summary = buildHailSummary(events);
    expect(summary!.mostRecentDate).toBe('2026-01-15');
  });
});

// ─── buildWindSummary ───────────────────────────────────────────

describe('buildWindSummary', () => {
  it('builds summary from wind events', () => {
    const events = sampleEvents();
    const summary = buildWindSummary(events);
    expect(summary).not.toBeNull();
    expect(summary!.eventCount).toBe(2);
    expect(summary!.maxSpeedMph).toBe(100);
  });

  it('returns null when no wind events', () => {
    const events = sampleEvents().filter(
      (e) => e.type !== 'thunderstorm_wind' && e.type !== 'high_wind' && e.type !== 'tornado',
    );
    expect(buildWindSummary(events)).toBeNull();
  });

  it('includes tornado events in wind summary', () => {
    const events = sampleEvents().filter((e) => e.type === 'tornado');
    const summary = buildWindSummary(events);
    expect(summary).not.toBeNull();
    expect(summary!.eventCount).toBe(1);
    expect(summary!.maxSpeedMph).toBe(100);
  });
});

// ─── searchStormEvents ──────────────────────────────────────────

describe('searchStormEvents', () => {
  it('returns filtered and sorted results', () => {
    const events = sampleEvents();
    const result = searchStormEvents(events, {
      lat: 35.5,
      lng: -97.7,
      radiusMiles: 15,
      startDate: '2025-01-01',
      endDate: '2026-12-31',
    });
    expect(result.totalCount).toBeGreaterThan(0);
    expect(result.events[0].date).toBeTruthy();
    expect(result.searchRadiusMiles).toBe(15);
  });

  it('includes hail and wind summaries', () => {
    const events = sampleEvents();
    const result = searchStormEvents(events, {
      lat: 35.5,
      lng: -97.7,
      radiusMiles: 50,
      startDate: '2024-01-01',
      endDate: '2026-12-31',
    });
    expect(result.hailSummary).not.toBeNull();
    expect(result.windSummary).not.toBeNull();
  });

  it('applies event type filter', () => {
    const events = sampleEvents();
    const result = searchStormEvents(events, {
      lat: 35.5,
      lng: -97.7,
      radiusMiles: 50,
      startDate: '2024-01-01',
      endDate: '2026-12-31',
      eventTypes: ['hail'],
    });
    expect(result.events.every((e) => e.type === 'hail')).toBe(true);
  });

  it('returns date range in result', () => {
    const result = searchStormEvents(sampleEvents(), {
      lat: 35.5, lng: -97.7, radiusMiles: 50,
      startDate: '2025-01-01', endDate: '2025-12-31',
    });
    expect(result.dateRange.start).toBe('2025-01-01');
    expect(result.dateRange.end).toBe('2025-12-31');
  });
});

// ─── generateSampleEvents ───────────────────────────────────────

describe('generateSampleEvents', () => {
  it('generates requested count of events', () => {
    const events = generateSampleEvents(35.5, -97.7, 25, 10);
    expect(events.length).toBe(10);
  });

  it('defaults to 12 events', () => {
    const events = generateSampleEvents(35.5, -97.7, 25);
    expect(events.length).toBe(12);
  });

  it('events have required fields', () => {
    const events = generateSampleEvents(35.5, -97.7, 25, 5);
    for (const e of events) {
      expect(e.id).toBeTruthy();
      expect(e.type).toBeTruthy();
      expect(e.date).toBeTruthy();
      expect(e.county).toBeTruthy();
      expect(e.state).toBeTruthy();
      expect(e.description).toBeTruthy();
      expect(e.distanceMiles).toBeGreaterThanOrEqual(0);
      expect(e.source).toBe('sample');
    }
  });

  it('events are within radius', () => {
    const radius = 10;
    const events = generateSampleEvents(35.5, -97.7, radius, 20);
    for (const e of events) {
      expect(e.distanceMiles).toBeLessThanOrEqual(radius);
    }
  });

  it('events are sorted by date (most recent first)', () => {
    const events = generateSampleEvents(35.5, -97.7, 25, 10);
    for (let i = 1; i < events.length; i++) {
      expect(new Date(events[i - 1].date).getTime()).toBeGreaterThanOrEqual(
        new Date(events[i].date).getTime(),
      );
    }
  });
});

// ─── formatEventSummary ─────────────────────────────────────────

describe('formatEventSummary', () => {
  it('includes event type label', () => {
    const event = sampleEvents()[0];
    const summary = formatEventSummary(event);
    expect(summary).toContain('Hail');
  });

  it('includes hail size for hail events', () => {
    const event = sampleEvents()[0];
    const summary = formatEventSummary(event);
    expect(summary).toContain('1"');
  });

  it('includes wind speed for wind events', () => {
    const event = sampleEvents()[2];
    const summary = formatEventSummary(event);
    expect(summary).toContain('65 mph');
  });

  it('includes distance', () => {
    const event = sampleEvents()[0];
    const summary = formatEventSummary(event);
    expect(summary).toContain('5 mi away');
  });
});

// ─── assessStormRisk ────────────────────────────────────────────

describe('assessStormRisk', () => {
  it('returns severe for large hail + many events', () => {
    const result: StormSearchResult = {
      events: sampleEvents(),
      totalCount: 6,
      searchRadiusMiles: 50,
      dateRange: { start: '2024-01-01', end: '2026-12-31' },
      hailSummary: {
        eventCount: 2,
        maxSizeInches: 1.75,
        maxSizeCategory: 'very_large',
        avgSizeInches: 1.38,
        mostRecentDate: '2026-01-15',
      },
      windSummary: {
        eventCount: 2,
        maxSpeedMph: 100,
        avgSpeedMph: 83,
        mostRecentDate: '2026-02-10',
      },
    };
    const risk = assessStormRisk(result);
    expect(risk.level).toBe('severe');
    expect(risk.label).toContain('Severe');
  });

  it('returns high for significant hail (>= 1.0")', () => {
    const result: StormSearchResult = {
      events: [],
      totalCount: 2,
      searchRadiusMiles: 25,
      dateRange: { start: '2025-01-01', end: '2026-12-31' },
      hailSummary: {
        eventCount: 1,
        maxSizeInches: 1.25,
        maxSizeCategory: 'large',
        avgSizeInches: 1.25,
        mostRecentDate: '2026-01-15',
      },
      windSummary: null,
    };
    const risk = assessStormRisk(result);
    expect(risk.level).toBe('high');
  });

  it('returns moderate for 3+ events', () => {
    const result: StormSearchResult = {
      events: [],
      totalCount: 4,
      searchRadiusMiles: 25,
      dateRange: { start: '2025-01-01', end: '2026-12-31' },
      hailSummary: {
        eventCount: 2,
        maxSizeInches: 0.5,
        maxSizeCategory: 'small',
        avgSizeInches: 0.5,
        mostRecentDate: '2026-01-15',
      },
      windSummary: null,
    };
    const risk = assessStormRisk(result);
    expect(risk.level).toBe('moderate');
  });

  it('returns low for few minor events', () => {
    const result: StormSearchResult = {
      events: [],
      totalCount: 1,
      searchRadiusMiles: 25,
      dateRange: { start: '2025-01-01', end: '2026-12-31' },
      hailSummary: {
        eventCount: 1,
        maxSizeInches: 0.5,
        maxSizeCategory: 'small',
        avgSizeInches: 0.5,
        mostRecentDate: '2026-01-15',
      },
      windSummary: null,
    };
    const risk = assessStormRisk(result);
    expect(risk.level).toBe('low');
  });

  it('returns low with no events', () => {
    const result: StormSearchResult = {
      events: [],
      totalCount: 0,
      searchRadiusMiles: 25,
      dateRange: { start: '2025-01-01', end: '2026-12-31' },
      hailSummary: null,
      windSummary: null,
    };
    const risk = assessStormRisk(result);
    expect(risk.level).toBe('low');
    expect(risk.description).toContain('No significant');
  });

  it('returns high for high wind (>= 70 mph)', () => {
    const result: StormSearchResult = {
      events: [],
      totalCount: 1,
      searchRadiusMiles: 25,
      dateRange: { start: '2025-01-01', end: '2026-12-31' },
      hailSummary: null,
      windSummary: {
        eventCount: 1,
        maxSpeedMph: 75,
        avgSpeedMph: 75,
        mostRecentDate: '2026-01-15',
      },
    };
    const risk = assessStormRisk(result);
    expect(risk.level).toBe('high');
  });
});

// ─── Label constants ────────────────────────────────────────────

describe('label constants', () => {
  it('STORM_TYPE_LABELS has all types', () => {
    const types: string[] = ['hail', 'thunderstorm_wind', 'tornado', 'flash_flood', 'winter_storm', 'ice_storm', 'heavy_rain', 'high_wind', 'other'];
    for (const t of types) {
      expect(STORM_TYPE_LABELS[t as keyof typeof STORM_TYPE_LABELS]).toBeTruthy();
    }
  });

  it('STORM_TYPE_ICONS has all types', () => {
    for (const key of Object.keys(STORM_TYPE_LABELS)) {
      expect(STORM_TYPE_ICONS[key as keyof typeof STORM_TYPE_ICONS]).toBeTruthy();
    }
  });

  it('HAIL_SIZE_LABELS has all sizes', () => {
    const sizes = ['small', 'medium', 'large', 'very_large', 'giant'];
    for (const s of sizes) {
      expect(HAIL_SIZE_LABELS[s as keyof typeof HAIL_SIZE_LABELS]).toBeTruthy();
    }
  });
});
