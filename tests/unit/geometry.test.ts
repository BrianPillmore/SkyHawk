/**
 * Unit tests for geometry calculation utilities
 * Run with: npx vitest run tests/unit/geometry.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  haversineDistanceFt,
  calculatePolygonAreaSqFt,
  adjustAreaForPitch,
  getPitchMultiplier,
  pitchToDegrees,
  degreesToPitch,
  areaToSquares,
  calculateSuggestedWaste,
  calculateWasteTable,
  getPredominantPitch,
  formatNumber,
  formatArea,
  formatLength,
  formatPitch,
  getCentroid,
  isPointInPolygon,
  getMidpoint,
} from '../../src/utils/geometry';
import type { RoofFacet, RoofEdge } from '../../src/types';

describe('Haversine Distance', () => {
  it('should return 0 for identical points', () => {
    const point = { lat: 40.0, lng: -90.0 };
    expect(haversineDistanceFt(point, point)).toBe(0);
  });

  it('should calculate distance between two known points', () => {
    // Approximately 1 mile apart (north-south at ~40° lat)
    const a = { lat: 40.0, lng: -90.0 };
    const b = { lat: 40.01449, lng: -90.0 }; // ~1 mile north
    const dist = haversineDistanceFt(a, b);
    // Should be approximately 5280 ft (1 mile) ± 5%
    expect(dist).toBeGreaterThan(5000);
    expect(dist).toBeLessThan(5600);
  });

  it('should handle east-west distance', () => {
    const a = { lat: 40.0, lng: -90.0 };
    const b = { lat: 40.0, lng: -89.981 }; // ~1 mile east at 40° lat
    const dist = haversineDistanceFt(a, b);
    expect(dist).toBeGreaterThan(4500);
    expect(dist).toBeLessThan(6000);
  });
});

describe('Polygon Area', () => {
  it('should return 0 for fewer than 3 vertices', () => {
    expect(calculatePolygonAreaSqFt([])).toBe(0);
    expect(calculatePolygonAreaSqFt([{ lat: 0, lng: 0 }])).toBe(0);
    expect(calculatePolygonAreaSqFt([{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }])).toBe(0);
  });

  it('should calculate area of a known square', () => {
    // A small square approximately 100ft x 100ft at 40° lat
    // 100 ft ≈ 0.000274° latitude
    // 100 ft ≈ 0.000358° longitude at 40° lat
    const dLat = 0.000274;
    const dLng = 0.000358;
    const center = { lat: 40.0, lng: -90.0 };

    const square = [
      { lat: center.lat - dLat / 2, lng: center.lng - dLng / 2 },
      { lat: center.lat - dLat / 2, lng: center.lng + dLng / 2 },
      { lat: center.lat + dLat / 2, lng: center.lng + dLng / 2 },
      { lat: center.lat + dLat / 2, lng: center.lng - dLng / 2 },
    ];

    const area = calculatePolygonAreaSqFt(square);
    // Should be approximately 10,000 sq ft ± 15%
    expect(area).toBeGreaterThan(8500);
    expect(area).toBeLessThan(11500);
  });

  it('should handle triangular polygons', () => {
    const triangle = [
      { lat: 40.0, lng: -90.0 },
      { lat: 40.0005, lng: -90.0 },
      { lat: 40.00025, lng: -89.9995 },
    ];
    const area = calculatePolygonAreaSqFt(triangle);
    expect(area).toBeGreaterThan(0);
  });
});

describe('Pitch Calculations', () => {
  it('should return 1.0 for flat pitch', () => {
    expect(getPitchMultiplier(0)).toBe(1);
  });

  it('should return ~1.414 for 12/12 pitch', () => {
    const mult = getPitchMultiplier(12);
    expect(mult).toBeCloseTo(1.414, 2);
  });

  it('should return ~1.118 for 6/12 pitch', () => {
    const mult = getPitchMultiplier(6);
    expect(mult).toBeCloseTo(1.118, 2);
  });

  it('should adjust area correctly for pitch', () => {
    const flatArea = 1000;
    const adjusted = adjustAreaForPitch(flatArea, 6);
    expect(adjusted).toBeCloseTo(1118, 0);
  });

  it('should not adjust area for 0 pitch', () => {
    expect(adjustAreaForPitch(1000, 0)).toBe(1000);
  });

  it('should convert pitch to degrees correctly', () => {
    expect(pitchToDegrees(0)).toBe(0);
    expect(pitchToDegrees(12)).toBeCloseTo(45, 0);
    expect(pitchToDegrees(6)).toBeCloseTo(26.57, 0);
  });

  it('should convert degrees to pitch correctly', () => {
    expect(degreesToPitch(0)).toBeCloseTo(0, 1);
    expect(degreesToPitch(45)).toBeCloseTo(12, 0);
    expect(degreesToPitch(26.57)).toBeCloseTo(6, 0);
  });
});

describe('Roofing Squares', () => {
  it('should convert area to squares', () => {
    expect(areaToSquares(100)).toBe(1);
    expect(areaToSquares(2500)).toBe(25);
    expect(areaToSquares(1550)).toBe(15.5);
  });
});

describe('Waste Factor', () => {
  it('should suggest low waste for simple roofs', () => {
    const facets: RoofFacet[] = [
      { id: '1', name: 'F1', vertexIds: [], pitch: 6, areaSqFt: 1000, trueAreaSqFt: 1118, edgeIds: [] },
    ];
    const edges: RoofEdge[] = [
      { id: '1', startVertexId: 'a', endVertexId: 'b', type: 'eave', lengthFt: 50 },
    ];
    expect(calculateSuggestedWaste(facets, edges)).toBe(5);
  });

  it('should suggest medium waste for medium-complexity roofs', () => {
    const facets: RoofFacet[] = Array(5).fill(null).map((_, i) => ({
      id: String(i), name: `F${i}`, vertexIds: [], pitch: 6, areaSqFt: 500, trueAreaSqFt: 559, edgeIds: [],
    }));
    const edges: RoofEdge[] = [
      { id: '1', startVertexId: 'a', endVertexId: 'b', type: 'hip', lengthFt: 20 },
      { id: '2', startVertexId: 'b', endVertexId: 'c', type: 'valley', lengthFt: 15 },
      { id: '3', startVertexId: 'c', endVertexId: 'd', type: 'hip', lengthFt: 20 },
    ];
    expect(calculateSuggestedWaste(facets, edges)).toBe(15);
  });

  it('should generate correct waste table', () => {
    const table = calculateWasteTable(2000);
    expect(table.length).toBe(7);
    expect(table[0].wastePercent).toBe(5);
    expect(table[0].totalAreaWithWaste).toBe(2100);
    expect(table[6].wastePercent).toBe(25);
    expect(table[6].totalAreaWithWaste).toBe(2500);
  });
});

describe('Predominant Pitch', () => {
  it('should return 0 for no facets', () => {
    expect(getPredominantPitch([])).toBe(0);
  });

  it('should return the pitch covering the most area', () => {
    const facets: RoofFacet[] = [
      { id: '1', name: 'F1', vertexIds: [], pitch: 6, areaSqFt: 500, trueAreaSqFt: 1500, edgeIds: [] },
      { id: '2', name: 'F2', vertexIds: [], pitch: 8, areaSqFt: 300, trueAreaSqFt: 500, edgeIds: [] },
    ];
    expect(getPredominantPitch(facets)).toBe(6);
  });
});

describe('Formatting', () => {
  it('should format numbers with commas', () => {
    expect(formatNumber(1234)).toBe('1,234');
    expect(formatNumber(1234.56, 2)).toBe('1,234.56');
  });

  it('should format area', () => {
    expect(formatArea(1500)).toBe('1,500 sq ft');
  });

  it('should format length', () => {
    expect(formatLength(25.5)).toBe('25.5 ft');
  });

  it('should format pitch', () => {
    expect(formatPitch(6)).toBe('6/12');
    expect(formatPitch(0)).toBe('Flat');
  });
});

describe('getCentroid', () => {
  it('should return centroid of triangle', () => {
    const points = [
      { lat: 0, lng: 0 },
      { lat: 3, lng: 0 },
      { lat: 0, lng: 3 },
    ];
    const c = getCentroid(points);
    expect(c.lat).toBe(1);
    expect(c.lng).toBe(1);
  });
});

describe('isPointInPolygon', () => {
  const square = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 1 },
    { lat: 1, lng: 1 },
    { lat: 1, lng: 0 },
  ];

  it('should return true for point inside', () => {
    expect(isPointInPolygon({ lat: 0.5, lng: 0.5 }, square)).toBe(true);
  });

  it('should return false for point outside', () => {
    expect(isPointInPolygon({ lat: 2, lng: 2 }, square)).toBe(false);
  });
});

describe('getMidpoint', () => {
  it('should return midpoint', () => {
    const mid = getMidpoint({ lat: 0, lng: 0 }, { lat: 2, lng: 4 });
    expect(mid.lat).toBe(1);
    expect(mid.lng).toBe(2);
  });
});
