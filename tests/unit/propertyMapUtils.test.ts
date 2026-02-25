/**
 * Unit tests for property map utilities
 * Run with: npx vitest run tests/unit/propertyMapUtils.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  propertiesToPins,
  calculateBounds,
  calculateCenter,
  calculateZoomForBounds,
  clusterPins,
  getPinColor,
  formatPinTooltip,
  type PropertyPin,
} from '../../src/utils/propertyMapUtils';
import type { Property } from '../../src/types';

function makeProperty(overrides: Partial<Property> & { lat: number; lng: number }): Property {
  return {
    id: overrides.id || Math.random().toString(36).slice(2),
    address: overrides.address || '123 Main St',
    city: overrides.city || 'Oklahoma City',
    state: overrides.state || 'OK',
    zip: overrides.zip || '73102',
    lat: overrides.lat,
    lng: overrides.lng,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    measurements: overrides.measurements || [],
    damageAnnotations: [],
    snapshots: [],
    claims: [],
    notes: '',
  };
}

function makeMeasurement(area: number, squares: number) {
  return {
    id: Math.random().toString(36).slice(2),
    propertyId: '',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    vertices: [],
    edges: [],
    facets: [],
    totalAreaSqFt: area,
    totalTrueAreaSqFt: area,
    totalSquares: squares,
    predominantPitch: 6,
    totalRidgeLf: 0,
    totalHipLf: 0,
    totalValleyLf: 0,
    totalRakeLf: 0,
    totalEaveLf: 0,
    totalFlashingLf: 0,
    totalStepFlashingLf: 0,
    totalDripEdgeLf: 0,
    suggestedWastePercent: 10,
    ridgeCount: 0,
    hipCount: 0,
    valleyCount: 0,
    rakeCount: 0,
    eaveCount: 0,
    flashingCount: 0,
    stepFlashingCount: 0,
    structureComplexity: 'Normal' as const,
    estimatedAtticSqFt: 0,
    pitchBreakdown: [],
  };
}

const properties: Property[] = [
  makeProperty({
    id: 'a',
    address: '100 Pine Rd',
    lat: 35.4676,
    lng: -97.5164,
    measurements: [makeMeasurement(3500, 35)],
  }),
  makeProperty({
    id: 'b',
    address: '200 Oak Dr',
    city: 'Edmond',
    lat: 35.6528,
    lng: -97.4781,
    measurements: [makeMeasurement(2000, 20)],
  }),
  makeProperty({
    id: 'c',
    address: '300 Elm Ave',
    city: 'Norman',
    lat: 35.2226,
    lng: -97.4395,
    measurements: [],
  }),
];

// ─── propertiesToPins ────────────────────────────────────────────

describe('propertiesToPins', () => {
  it('converts properties to pin data', () => {
    const pins = propertiesToPins(properties);
    expect(pins).toHaveLength(3);
    expect(pins[0].id).toBe('a');
    expect(pins[0].lat).toBe(35.4676);
    expect(pins[0].hasMeasurements).toBe(true);
    expect(pins[0].totalAreaSqFt).toBe(3500);
    expect(pins[0].totalSquares).toBe(35);
  });

  it('marks unmeasured properties', () => {
    const pins = propertiesToPins(properties);
    const unmeasured = pins.find((p) => p.id === 'c');
    expect(unmeasured!.hasMeasurements).toBe(false);
    expect(unmeasured!.totalAreaSqFt).toBe(0);
    expect(unmeasured!.measurementCount).toBe(0);
  });

  it('returns empty for no properties', () => {
    expect(propertiesToPins([])).toEqual([]);
  });
});

// ─── calculateBounds ─────────────────────────────────────────────

describe('calculateBounds', () => {
  it('calculates bounds containing all pins', () => {
    const pins = propertiesToPins(properties);
    const bounds = calculateBounds(pins);
    expect(bounds).not.toBeNull();
    expect(bounds!.north).toBeGreaterThan(35.6528);
    expect(bounds!.south).toBeLessThan(35.2226);
    expect(bounds!.east).toBeGreaterThan(-97.4395);
    expect(bounds!.west).toBeLessThan(-97.5164);
  });

  it('returns null for empty pins', () => {
    expect(calculateBounds([])).toBeNull();
  });

  it('adds padding for single pin', () => {
    const pins = propertiesToPins([properties[0]]);
    const bounds = calculateBounds(pins);
    expect(bounds).not.toBeNull();
    // Should have minimum padding even for single point
    expect(bounds!.north).toBeGreaterThan(pins[0].lat);
    expect(bounds!.south).toBeLessThan(pins[0].lat);
  });
});

// ─── calculateCenter ─────────────────────────────────────────────

describe('calculateCenter', () => {
  it('calculates center of all pins', () => {
    const pins = propertiesToPins(properties);
    const center = calculateCenter(pins);
    // Should be roughly between northernmost and southernmost
    expect(center.lat).toBeGreaterThan(35.2);
    expect(center.lat).toBeLessThan(35.7);
    expect(center.lng).toBeGreaterThan(-97.6);
    expect(center.lng).toBeLessThan(-97.4);
  });

  it('returns default center for empty pins', () => {
    const center = calculateCenter([]);
    expect(center.lat).toBe(35.4676); // OKC default
    expect(center.lng).toBe(-97.5164);
  });

  it('returns exact position for single pin', () => {
    const pins = propertiesToPins([properties[0]]);
    const center = calculateCenter(pins);
    expect(center.lat).toBe(35.4676);
    expect(center.lng).toBe(-97.5164);
  });
});

// ─── calculateZoomForBounds ──────────────────────────────────────

describe('calculateZoomForBounds', () => {
  it('returns a valid zoom level', () => {
    const bounds = { north: 35.7, south: 35.2, east: -97.3, west: -97.6 };
    const zoom = calculateZoomForBounds(bounds, 800, 400);
    expect(zoom).toBeGreaterThanOrEqual(1);
    expect(zoom).toBeLessThanOrEqual(18);
  });

  it('returns higher zoom for smaller bounds', () => {
    const smallBounds = { north: 35.47, south: 35.46, east: -97.51, west: -97.52 };
    const largeBounds = { north: 36.0, south: 35.0, east: -97.0, west: -98.0 };
    const smallZoom = calculateZoomForBounds(smallBounds, 800, 400);
    const largeZoom = calculateZoomForBounds(largeBounds, 800, 400);
    expect(smallZoom).toBeGreaterThan(largeZoom);
  });
});

// ─── clusterPins ─────────────────────────────────────────────────

describe('clusterPins', () => {
  it('groups nearby pins into clusters', () => {
    const pins = propertiesToPins(properties);
    // With a large grid size, they should cluster
    const clusters = clusterPins(pins, 0.5);
    expect(clusters.length).toBeLessThanOrEqual(pins.length);
    // Total pins across clusters equals input
    const total = clusters.reduce((sum, c) => sum + c.count, 0);
    expect(total).toBe(pins.length);
  });

  it('returns empty for empty pins', () => {
    expect(clusterPins([])).toEqual([]);
  });

  it('each cluster has correct count and center', () => {
    const pins = propertiesToPins(properties);
    const clusters = clusterPins(pins, 0.001); // Tiny grid = each pin is its own cluster
    expect(clusters.length).toBe(3);
    for (const c of clusters) {
      expect(c.count).toBe(1);
      expect(c.center.lat).toBeTruthy();
      expect(c.center.lng).toBeTruthy();
    }
  });
});

// ─── getPinColor ─────────────────────────────────────────────────

describe('getPinColor', () => {
  it('returns gray for unmeasured pins', () => {
    const pin: PropertyPin = {
      id: 'x', lat: 0, lng: 0, address: '', city: '', state: '', zip: '',
      hasMeasurements: false, measurementCount: 0, totalAreaSqFt: 0, totalSquares: 0,
    };
    expect(getPinColor(pin)).toBe('#6b7280');
  });

  it('returns green for large roofs (>3000 sq ft)', () => {
    const pin: PropertyPin = {
      id: 'x', lat: 0, lng: 0, address: '', city: '', state: '', zip: '',
      hasMeasurements: true, measurementCount: 1, totalAreaSqFt: 3500, totalSquares: 35,
    };
    expect(getPinColor(pin)).toBe('#22c55e');
  });

  it('returns amber for medium roofs (1500-3000 sq ft)', () => {
    const pin: PropertyPin = {
      id: 'x', lat: 0, lng: 0, address: '', city: '', state: '', zip: '',
      hasMeasurements: true, measurementCount: 1, totalAreaSqFt: 2000, totalSquares: 20,
    };
    expect(getPinColor(pin)).toBe('#f59e0b');
  });

  it('returns blue for small roofs (<1500 sq ft)', () => {
    const pin: PropertyPin = {
      id: 'x', lat: 0, lng: 0, address: '', city: '', state: '', zip: '',
      hasMeasurements: true, measurementCount: 1, totalAreaSqFt: 1000, totalSquares: 10,
    };
    expect(getPinColor(pin)).toBe('#3b82f6');
  });
});

// ─── formatPinTooltip ────────────────────────────────────────────

describe('formatPinTooltip', () => {
  it('formats measured property tooltip', () => {
    const pin: PropertyPin = {
      id: 'x', lat: 0, lng: 0,
      address: '123 Main St', city: 'OKC', state: 'OK', zip: '73102',
      hasMeasurements: true, measurementCount: 2, totalAreaSqFt: 2500, totalSquares: 25,
    };
    const tooltip = formatPinTooltip(pin);
    expect(tooltip).toContain('123 Main St');
    expect(tooltip).toContain('OKC, OK 73102');
    expect(tooltip).toContain('2,500 sq ft');
    expect(tooltip).toContain('25.0 squares');
    expect(tooltip).toContain('2 measurements');
  });

  it('formats unmeasured property tooltip', () => {
    const pin: PropertyPin = {
      id: 'x', lat: 0, lng: 0,
      address: '456 Oak', city: 'Edmond', state: 'OK', zip: '73013',
      hasMeasurements: false, measurementCount: 0, totalAreaSqFt: 0, totalSquares: 0,
    };
    const tooltip = formatPinTooltip(pin);
    expect(tooltip).toContain('No measurements');
  });

  it('uses singular "measurement" for count of 1', () => {
    const pin: PropertyPin = {
      id: 'x', lat: 0, lng: 0,
      address: '789 Elm', city: 'Norman', state: 'OK', zip: '73071',
      hasMeasurements: true, measurementCount: 1, totalAreaSqFt: 1800, totalSquares: 18,
    };
    const tooltip = formatPinTooltip(pin);
    expect(tooltip).toContain('1 measurement');
    expect(tooltip).not.toContain('1 measurements');
  });
});
