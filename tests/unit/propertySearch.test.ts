/**
 * Unit tests for property search, filter, and sort utilities
 * Run with: npx vitest run tests/unit/propertySearch.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  searchProperties,
  filterProperties,
  sortProperties,
  applyPropertySearch,
} from '../../src/utils/propertySearch';
import type { Property } from '../../src/types';

function makeProperty(overrides: Partial<Property> & { address: string }): Property {
  return {
    id: overrides.id || Math.random().toString(36).slice(2),
    address: overrides.address,
    city: overrides.city || 'Oklahoma City',
    state: overrides.state || 'OK',
    zip: overrides.zip || '73102',
    lat: overrides.lat || 35.4676,
    lng: overrides.lng || -97.5164,
    createdAt: overrides.createdAt || '2025-01-01T00:00:00Z',
    updatedAt: overrides.updatedAt || '2025-01-01T00:00:00Z',
    measurements: overrides.measurements || [],
    damageAnnotations: overrides.damageAnnotations || [],
    snapshots: overrides.snapshots || [],
    claims: overrides.claims || [],
    notes: overrides.notes || '',
  };
}

function makeMeasurement(area: number, squares: number, facets: number, pitch: number) {
  return {
    id: Math.random().toString(36).slice(2),
    propertyId: '',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    vertices: [],
    edges: [],
    facets: Array.from({ length: facets }, (_, i) => ({
      id: `f${i}`,
      name: `#${i + 1}`,
      vertexIds: [],
      pitch,
      areaSqFt: area / facets,
      trueAreaSqFt: area / facets,
      edgeIds: [],
    })),
    totalAreaSqFt: area,
    totalTrueAreaSqFt: area,
    totalSquares: squares,
    predominantPitch: pitch,
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
    address: '123 Main St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73102',
    updatedAt: '2025-03-15T00:00:00Z',
    measurements: [makeMeasurement(2500, 25, 6, 8)],
  }),
  makeProperty({
    id: 'b',
    address: '456 Elm Ave',
    city: 'Edmond',
    state: 'OK',
    zip: '73013',
    updatedAt: '2025-03-10T00:00:00Z',
    measurements: [makeMeasurement(1800, 18, 4, 6)],
  }),
  makeProperty({
    id: 'c',
    address: '789 Oak Dr',
    city: 'Norman',
    state: 'OK',
    zip: '73071',
    updatedAt: '2025-03-20T00:00:00Z',
    measurements: [],
  }),
  makeProperty({
    id: 'd',
    address: '100 Pine Rd',
    city: 'Moore',
    state: 'OK',
    zip: '73160',
    updatedAt: '2025-03-01T00:00:00Z',
    measurements: [makeMeasurement(3200, 32, 10, 12)],
  }),
  makeProperty({
    id: 'e',
    address: '200 Cedar Ln',
    city: 'Mustang',
    state: 'OK',
    zip: '73064',
    updatedAt: '2025-02-15T00:00:00Z',
    measurements: [],
  }),
];

// ─── searchProperties ────────────────────────────────────────────

describe('searchProperties', () => {
  it('returns all properties for empty query', () => {
    expect(searchProperties(properties, '')).toHaveLength(5);
    expect(searchProperties(properties, '   ')).toHaveLength(5);
  });

  it('searches by street address', () => {
    const result = searchProperties(properties, 'Main');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('searches by city', () => {
    const result = searchProperties(properties, 'Edmond');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });

  it('searches by ZIP code', () => {
    const result = searchProperties(properties, '73071');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c');
  });

  it('searches by state', () => {
    const result = searchProperties(properties, 'OK');
    expect(result).toHaveLength(5); // All are in OK
  });

  it('is case-insensitive', () => {
    const result = searchProperties(properties, 'main st');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('matches multiple terms (AND logic)', () => {
    const result = searchProperties(properties, 'Oak Norman');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c');
  });

  it('returns empty for non-matching query', () => {
    expect(searchProperties(properties, 'Denver CO')).toHaveLength(0);
  });

  it('searches partial address matches', () => {
    const result = searchProperties(properties, '123');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });
});

// ─── filterProperties ────────────────────────────────────────────

describe('filterProperties', () => {
  it('returns all for "all" filter', () => {
    expect(filterProperties(properties, 'all')).toHaveLength(5);
  });

  it('filters to measured properties only', () => {
    const result = filterProperties(properties, 'measured');
    expect(result).toHaveLength(3);
    expect(result.every((p) => p.measurements.length > 0)).toBe(true);
  });

  it('filters to unmeasured properties only', () => {
    const result = filterProperties(properties, 'unmeasured');
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.measurements.length === 0)).toBe(true);
  });
});

// ─── sortProperties ──────────────────────────────────────────────

describe('sortProperties', () => {
  it('sorts by date descending (newest first)', () => {
    const result = sortProperties(properties, 'date', 'desc');
    expect(result[0].id).toBe('c'); // March 20
    expect(result[1].id).toBe('a'); // March 15
    expect(result[2].id).toBe('b'); // March 10
  });

  it('sorts by date ascending (oldest first)', () => {
    const result = sortProperties(properties, 'date', 'asc');
    expect(result[0].id).toBe('e'); // Feb 15
    expect(result[1].id).toBe('d'); // March 1
  });

  it('sorts by address A-Z', () => {
    const result = sortProperties(properties, 'address', 'asc');
    expect(result[0].address).toBe('100 Pine Rd');
    expect(result[1].address).toBe('123 Main St');
    expect(result[2].address).toBe('200 Cedar Ln');
  });

  it('sorts by address Z-A', () => {
    const result = sortProperties(properties, 'address', 'desc');
    expect(result[0].address).toBe('789 Oak Dr');
  });

  it('sorts by area descending (largest first)', () => {
    const result = sortProperties(properties, 'area', 'desc');
    expect(result[0].id).toBe('d'); // 3200 sq ft
    expect(result[1].id).toBe('a'); // 2500 sq ft
    expect(result[2].id).toBe('b'); // 1800 sq ft
  });

  it('sorts by area ascending (unmeasured at bottom)', () => {
    const result = sortProperties(properties, 'area', 'asc');
    // Unmeasured properties have area 0
    expect(result[0].measurements.length).toBe(0);
  });

  it('sorts by squares descending', () => {
    const result = sortProperties(properties, 'squares', 'desc');
    expect(result[0].id).toBe('d'); // 32 sq
    expect(result[1].id).toBe('a'); // 25 sq
  });

  it('sorts by facets descending', () => {
    const result = sortProperties(properties, 'facets', 'desc');
    expect(result[0].id).toBe('d'); // 10 facets
    expect(result[1].id).toBe('a'); // 6 facets
  });

  it('does not mutate original array', () => {
    const original = [...properties];
    sortProperties(properties, 'address', 'asc');
    expect(properties.map((p) => p.id)).toEqual(original.map((p) => p.id));
  });
});

// ─── applyPropertySearch (combined) ──────────────────────────────

describe('applyPropertySearch', () => {
  it('applies search + filter + sort together', () => {
    const result = applyPropertySearch(properties, {
      query: 'OK',
      sortField: 'area',
      sortDirection: 'desc',
      filter: 'measured',
    });
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('d'); // 3200
    expect(result[1].id).toBe('a'); // 2500
    expect(result[2].id).toBe('b'); // 1800
  });

  it('returns empty when search and filter have no overlap', () => {
    const result = applyPropertySearch(properties, {
      query: 'Norman',
      sortField: 'date',
      sortDirection: 'desc',
      filter: 'measured',
    });
    // Norman (id=c) has no measurements
    expect(result).toHaveLength(0);
  });

  it('handles defaults gracefully', () => {
    const result = applyPropertySearch(properties, {
      query: '',
      sortField: 'date',
      sortDirection: 'desc',
      filter: 'all',
    });
    expect(result).toHaveLength(5);
    expect(result[0].id).toBe('c'); // Most recent
  });
});
