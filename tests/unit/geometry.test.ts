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
  clampPitch,
  MAX_RESIDENTIAL_PITCH,
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
    // Simple 1-facet, no hips/valleys = base 10%
    expect(calculateSuggestedWaste(facets, edges)).toBe(10);
  });

  it('should suggest higher waste for medium-complexity roofs', () => {
    const facets: RoofFacet[] = Array(5).fill(null).map((_, i) => ({
      id: String(i), name: `F${i}`, vertexIds: [], pitch: 6, areaSqFt: 500, trueAreaSqFt: 559, edgeIds: [],
    }));
    const edges: RoofEdge[] = [
      { id: '1', startVertexId: 'a', endVertexId: 'b', type: 'hip', lengthFt: 20 },
      { id: '2', startVertexId: 'b', endVertexId: 'c', type: 'valley', lengthFt: 15 },
      { id: '3', startVertexId: 'c', endVertexId: 'd', type: 'hip', lengthFt: 20 },
    ];
    // base 10 + 5 facets (>=3 → +3) + 3 hips/valleys (>=2 → +3) = 16%
    expect(calculateSuggestedWaste(facets, edges)).toBe(16);
  });

  it('should suggest high waste for complex roofs (EagleView calibrated)', () => {
    // 20 facets, 16 hips, 7 valleys, 8 ridges, 8 rakes
    const facets: RoofFacet[] = Array(20).fill(null).map((_, i) => ({
      id: String(i), name: `F${i}`, vertexIds: [], pitch: 8, areaSqFt: 200, trueAreaSqFt: 240, edgeIds: [],
    }));
    const edges: RoofEdge[] = [
      ...Array(16).fill(null).map((_, i) => ({ id: `h${i}`, startVertexId: 'a', endVertexId: 'b', type: 'hip' as const, lengthFt: 13 })),
      ...Array(7).fill(null).map((_, i) => ({ id: `v${i}`, startVertexId: 'a', endVertexId: 'b', type: 'valley' as const, lengthFt: 16 })),
      ...Array(8).fill(null).map((_, i) => ({ id: `r${i}`, startVertexId: 'a', endVertexId: 'b', type: 'ridge' as const, lengthFt: 8 })),
      ...Array(8).fill(null).map((_, i) => ({ id: `k${i}`, startVertexId: 'a', endVertexId: 'b', type: 'rake' as const, lengthFt: 7 })),
    ];
    const waste = calculateSuggestedWaste(facets, edges);
    // Should be in 25-35% range (EagleView range for complex roofs)
    expect(waste).toBeGreaterThanOrEqual(25);
    expect(waste).toBeLessThanOrEqual(40);
  });

  it('should generate EagleView-format waste table', () => {
    const table = calculateWasteTable(2000);
    // EagleView uses 9 intervals: 0, 3, 8, 11, 13, 15, 18, 23, 28
    expect(table.length).toBe(9);
    expect(table[0].wastePercent).toBe(0);
    expect(table[0].totalAreaWithWaste).toBe(2000);
    expect(table[5].wastePercent).toBe(15);
    expect(table[5].totalAreaWithWaste).toBe(2300);
    expect(table[8].wastePercent).toBe(28);
    expect(table[8].totalAreaWithWaste).toBe(2560);
    // Squares should be rounded up to 1/3 square
    expect(table[0].totalSquaresWithWaste).toBe(20);
    expect(table[5].totalSquaresWithWaste).toBe(23);
  });
});

describe('Waste Factor Edge Cases (EagleView Calibration)', () => {
  it('should return base 10% for zero facets and zero edges', () => {
    expect(calculateSuggestedWaste([], [])).toBe(10);
  });

  it('should clamp minimum waste to 5%', () => {
    // Even with minimal inputs, base is 10 so min clamp doesn't trigger normally
    // But the algorithm ensures Math.max(5, ...) is applied
    const result = calculateSuggestedWaste([], []);
    expect(result).toBeGreaterThanOrEqual(5);
  });

  it('should clamp maximum waste to 40%', () => {
    // Extreme case: 35 facets, 25 hips/valleys, 10 ridges, 15 rakes
    const facets: RoofFacet[] = Array(35).fill(null).map((_, i) => ({
      id: String(i), name: `F${i}`, vertexIds: [], pitch: 8, areaSqFt: 100, trueAreaSqFt: 120, edgeIds: [],
    }));
    const edges: RoofEdge[] = [
      ...Array(25).fill(null).map((_, i) => ({ id: `h${i}`, startVertexId: 'a', endVertexId: 'b', type: 'hip' as const, lengthFt: 10 })),
      ...Array(10).fill(null).map((_, i) => ({ id: `r${i}`, startVertexId: 'a', endVertexId: 'b', type: 'ridge' as const, lengthFt: 8 })),
      ...Array(15).fill(null).map((_, i) => ({ id: `k${i}`, startVertexId: 'a', endVertexId: 'b', type: 'rake' as const, lengthFt: 7 })),
    ];
    // Max possible: 10+3+3+2+2+2+3+3+2+2+2+1+1+1+1 = 38, but with 25 hips that's all thresholds
    const waste = calculateSuggestedWaste(facets, edges);
    expect(waste).toBeLessThanOrEqual(40);
    expect(waste).toBeGreaterThanOrEqual(5);
  });

  it('should trigger 30+ facet bonus', () => {
    const facets: RoofFacet[] = Array(30).fill(null).map((_, i) => ({
      id: String(i), name: `F${i}`, vertexIds: [], pitch: 6, areaSqFt: 100, trueAreaSqFt: 112, edgeIds: [],
    }));
    // base 10 + (>=3→3) + (>=6→3) + (>=10→2) + (>=15→2) + (>=20→2) + (>=30→3) = 25
    expect(calculateSuggestedWaste(facets, [])).toBe(25);
  });

  it('should trigger all hip/valley thresholds at 20+', () => {
    const facets: RoofFacet[] = [
      { id: '1', name: 'F1', vertexIds: [], pitch: 6, areaSqFt: 1000, trueAreaSqFt: 1118, edgeIds: [] },
    ];
    const edges: RoofEdge[] = Array(20).fill(null).map((_, i) => ({
      id: `h${i}`, startVertexId: 'a', endVertexId: 'b', type: 'hip' as const, lengthFt: 10,
    }));
    // base 10 + (>=2→3) + (>=6→2) + (>=12→2) + (>=20→2) = 19
    expect(calculateSuggestedWaste(facets, edges)).toBe(19);
  });

  it('should add ridge and rake bonuses independently', () => {
    const facets: RoofFacet[] = [
      { id: '1', name: 'F1', vertexIds: [], pitch: 6, areaSqFt: 1000, trueAreaSqFt: 1118, edgeIds: [] },
    ];
    const edges: RoofEdge[] = [
      ...Array(6).fill(null).map((_, i) => ({ id: `r${i}`, startVertexId: 'a', endVertexId: 'b', type: 'ridge' as const, lengthFt: 8 })),
      ...Array(12).fill(null).map((_, i) => ({ id: `k${i}`, startVertexId: 'a', endVertexId: 'b', type: 'rake' as const, lengthFt: 7 })),
    ];
    // base 10 + ridges(>=3→1, >=6→1) + rakes(>=6→1, >=12→1) = 14
    expect(calculateSuggestedWaste(facets, edges)).toBe(14);
  });
});

describe('Waste Table Edge Cases', () => {
  it('should handle non-round areas with 1/3 square rounding', () => {
    // 1550 sq ft → at 0%: raw = 15.5 sq, ceil(15.5*3)/3 = ceil(46.5)/3 = 47/3 = 15.67
    const table = calculateWasteTable(1550);
    expect(table[0].totalSquaresWithWaste).toBeCloseTo(15.67, 1);
  });

  it('should produce correct intervals for all 9 entries', () => {
    const table = calculateWasteTable(1000);
    const expectedIntervals = [0, 3, 8, 11, 13, 15, 18, 23, 28];
    for (let i = 0; i < 9; i++) {
      expect(table[i].wastePercent).toBe(expectedIntervals[i]);
    }
  });

  it('should handle 0 area gracefully', () => {
    const table = calculateWasteTable(0);
    expect(table.length).toBe(9);
    expect(table[0].totalAreaWithWaste).toBe(0);
    expect(table[0].totalSquaresWithWaste).toBe(0);
  });

  it('should generate dynamic intervals based on suggestedWastePercent', () => {
    // W=30 → intervals: [0, 5, 10, 13, 15, 17, 20, 25, 30]
    const table = calculateWasteTable(1000, 30);
    expect(table.length).toBe(9);
    const intervals = table.map(r => r.wastePercent);
    expect(intervals).toEqual([0, 5, 10, 13, 15, 17, 20, 25, 30]);
  });

  it('should generate intervals ending at suggested waste for W=35', () => {
    // W=35 → intervals: [0, 10, 15, 18, 20, 22, 25, 30, 35]
    const table = calculateWasteTable(1000, 35);
    expect(table[0].wastePercent).toBe(0);
    expect(table[table.length - 1].wastePercent).toBe(35);
    expect(table.length).toBe(9);
  });

  it('should clamp negative intervals to 0 and deduplicate for low W', () => {
    // W=10 → raw: [0, -15, -10, -7, -5, -3, 0, 5, 10] → clamped: [0,0,0,0,0,0,0,5,10] → dedup: [0,5,10]
    const table = calculateWasteTable(1000, 10);
    expect(table[0].wastePercent).toBe(0);
    expect(table[table.length - 1].wastePercent).toBe(10);
    // Should have fewer than 9 entries due to dedup
    expect(table.length).toBeLessThan(9);
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

describe('MAX_RESIDENTIAL_PITCH', () => {
  it('should be 24', () => {
    expect(MAX_RESIDENTIAL_PITCH).toBe(24);
  });
});

describe('clampPitch', () => {
  it('should pass through values within range', () => {
    expect(clampPitch(0)).toBe(0);
    expect(clampPitch(6)).toBe(6);
    expect(clampPitch(12)).toBe(12);
    expect(clampPitch(24)).toBe(24);
  });

  it('should clamp values above max to 24', () => {
    expect(clampPitch(25)).toBe(24);
    expect(clampPitch(30)).toBe(24);
    expect(clampPitch(100)).toBe(24);
  });

  it('should clamp negative values to 0', () => {
    expect(clampPitch(-1)).toBe(0);
    expect(clampPitch(-10)).toBe(0);
  });

  it('should use custom max when provided', () => {
    expect(clampPitch(15, 12)).toBe(12);
    expect(clampPitch(8, 12)).toBe(8);
    expect(clampPitch(30, 18)).toBe(18);
  });

  it('should handle edge case: 0 max', () => {
    expect(clampPitch(5, 0)).toBe(0);
    expect(clampPitch(0, 0)).toBe(0);
  });

  it('should cap extreme pitch from degreesToPitch', () => {
    // 75 degrees → ~44.8/12 pitch → should cap to 24
    const extremePitch = degreesToPitch(75);
    expect(extremePitch).toBeGreaterThan(24);
    expect(clampPitch(extremePitch)).toBe(24);
  });

  it('should not change normal residential pitches', () => {
    // 30 degrees → ~6.9/12
    const normalPitch = degreesToPitch(30);
    expect(clampPitch(normalPitch)).toBeCloseTo(normalPitch, 5);

    // 45 degrees → 12/12
    const steepPitch = degreesToPitch(45);
    expect(clampPitch(steepPitch)).toBeCloseTo(steepPitch, 5);
  });
});
