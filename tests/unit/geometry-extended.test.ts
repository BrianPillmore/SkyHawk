/**
 * Extended unit tests for geometry utilities
 * Covers functions not tested in geometry.test.ts plus additional edge cases.
 * Run with: npx vitest run tests/unit/geometry-extended.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  toRadians,
  calculateEdgeLengthFt,
  calculateTotalEdgeLength,
  calculateFacetMeasurements,
  getPitchMultiplier,
  pitchToDegrees,
  degreesToPitch,
  getMidpoint,
  isPointInPolygon,
  formatNumber,
  formatArea,
  formatLength,
  formatPitch,
  getCentroid,
  adjustAreaForPitch,
  haversineDistanceFt,
} from '../../src/utils/geometry';
import type { RoofVertex, RoofEdge } from '../../src/types';

// ---------------------------------------------------------------------------
// toRadians
// ---------------------------------------------------------------------------
describe('toRadians', () => {
  it('should convert 0 degrees to 0 radians', () => {
    expect(toRadians(0)).toBe(0);
  });

  it('should convert 90 degrees to pi/2 radians', () => {
    expect(toRadians(90)).toBeCloseTo(Math.PI / 2, 10);
  });

  it('should convert 180 degrees to pi radians', () => {
    expect(toRadians(180)).toBeCloseTo(Math.PI, 10);
  });

  it('should convert 360 degrees to 2*pi radians', () => {
    expect(toRadians(360)).toBeCloseTo(2 * Math.PI, 10);
  });

  it('should handle negative values', () => {
    expect(toRadians(-90)).toBeCloseTo(-Math.PI / 2, 10);
  });

  it('should handle negative 180 degrees', () => {
    expect(toRadians(-180)).toBeCloseTo(-Math.PI, 10);
  });

  it('should convert 45 degrees correctly', () => {
    expect(toRadians(45)).toBeCloseTo(Math.PI / 4, 10);
  });

  it('should convert 270 degrees correctly', () => {
    expect(toRadians(270)).toBeCloseTo((3 * Math.PI) / 2, 10);
  });
});

// ---------------------------------------------------------------------------
// calculateEdgeLengthFt
// ---------------------------------------------------------------------------
describe('calculateEdgeLengthFt', () => {
  it('should delegate to haversineDistanceFt and return the same result', () => {
    const a = { lat: 40.0, lng: -90.0 };
    const b = { lat: 40.001, lng: -90.001 };
    const edgeLength = calculateEdgeLengthFt(a, b);
    const haversine = haversineDistanceFt(a, b);
    expect(edgeLength).toBe(haversine);
  });

  it('should return 0 for identical points', () => {
    const point = { lat: 35.0, lng: -80.0 };
    expect(calculateEdgeLengthFt(point, point)).toBe(0);
  });

  it('should calculate distance between two nearby points', () => {
    // Two points approximately 100 feet apart
    const a = { lat: 40.0, lng: -90.0 };
    const b = { lat: 40.000274, lng: -90.0 }; // ~100 ft north
    const dist = calculateEdgeLengthFt(a, b);
    expect(dist).toBeGreaterThan(80);
    expect(dist).toBeLessThan(120);
  });

  it('should produce a positive distance regardless of point order', () => {
    const a = { lat: 40.0, lng: -90.0 };
    const b = { lat: 40.001, lng: -90.001 };
    expect(calculateEdgeLengthFt(a, b)).toBe(calculateEdgeLengthFt(b, a));
  });
});

// ---------------------------------------------------------------------------
// calculateTotalEdgeLength
// ---------------------------------------------------------------------------
describe('calculateTotalEdgeLength', () => {
  const vertices: RoofVertex[] = [
    { id: 'v1', lat: 40.0, lng: -90.0 },
    { id: 'v2', lat: 40.001, lng: -90.0 },
    { id: 'v3', lat: 40.0, lng: -89.999 },
  ];

  const edges: RoofEdge[] = [
    { id: 'e1', startVertexId: 'v1', endVertexId: 'v2', type: 'ridge', lengthFt: 100 },
    { id: 'e2', startVertexId: 'v2', endVertexId: 'v3', type: 'hip', lengthFt: 150 },
    { id: 'e3', startVertexId: 'v3', endVertexId: 'v1', type: 'ridge', lengthFt: 200 },
    { id: 'e4', startVertexId: 'v1', endVertexId: 'v3', type: 'eave', lengthFt: 75 },
  ];

  it('should sum all edge lengths when no type filter is provided', () => {
    const total = calculateTotalEdgeLength(edges, vertices);
    expect(total).toBe(100 + 150 + 200 + 75);
  });

  it('should filter edges by type and sum only matching lengths', () => {
    const ridgeTotal = calculateTotalEdgeLength(edges, vertices, 'ridge');
    expect(ridgeTotal).toBe(100 + 200);
  });

  it('should filter by hip type', () => {
    const hipTotal = calculateTotalEdgeLength(edges, vertices, 'hip');
    expect(hipTotal).toBe(150);
  });

  it('should filter by eave type', () => {
    const eaveTotal = calculateTotalEdgeLength(edges, vertices, 'eave');
    expect(eaveTotal).toBe(75);
  });

  it('should return 0 for an empty edges array', () => {
    const total = calculateTotalEdgeLength([], vertices);
    expect(total).toBe(0);
  });

  it('should return 0 when filtering by a type not present', () => {
    const total = calculateTotalEdgeLength(edges, vertices, 'valley');
    expect(total).toBe(0);
  });

  it('should return 0 for empty edges with a type filter', () => {
    const total = calculateTotalEdgeLength([], vertices, 'ridge');
    expect(total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateFacetMeasurements
// ---------------------------------------------------------------------------
describe('calculateFacetMeasurements', () => {
  // Build a small triangle of vertices (~100ft sides)
  const allVertices: RoofVertex[] = [
    { id: 'v1', lat: 40.0, lng: -90.0 },
    { id: 'v2', lat: 40.0005, lng: -90.0 },
    { id: 'v3', lat: 40.00025, lng: -89.9995 },
  ];

  it('should compute areaSqFt and trueAreaSqFt with valid vertexIds', () => {
    const result = calculateFacetMeasurements(['v1', 'v2', 'v3'], allVertices, 6);
    expect(result.areaSqFt).toBeGreaterThan(0);
    expect(result.trueAreaSqFt).toBeGreaterThan(result.areaSqFt);
  });

  it('should return trueAreaSqFt equal to areaSqFt when pitch is 0', () => {
    const result = calculateFacetMeasurements(['v1', 'v2', 'v3'], allVertices, 0);
    expect(result.areaSqFt).toBeGreaterThan(0);
    expect(result.trueAreaSqFt).toBe(result.areaSqFt);
  });

  it('should return trueAreaSqFt approximately sqrt(2) times areaSqFt when pitch is 12', () => {
    const result = calculateFacetMeasurements(['v1', 'v2', 'v3'], allVertices, 12);
    expect(result.areaSqFt).toBeGreaterThan(0);
    const ratio = result.trueAreaSqFt / result.areaSqFt;
    expect(ratio).toBeCloseTo(Math.SQRT2, 2);
  });

  it('should gracefully handle missing vertexIds by filtering them out', () => {
    // 'missing' does not exist in allVertices, so only v1 and v2 match (2 points)
    // With fewer than 3 vertices, polygon area should be 0
    const result = calculateFacetMeasurements(['v1', 'v2', 'missing'], allVertices, 6);
    // Only 2 valid vertices found, polygon area = 0
    expect(result.areaSqFt).toBe(0);
    expect(result.trueAreaSqFt).toBe(0);
  });

  it('should return 0 area when all vertexIds are missing', () => {
    const result = calculateFacetMeasurements(['x1', 'x2', 'x3'], allVertices, 6);
    expect(result.areaSqFt).toBe(0);
    expect(result.trueAreaSqFt).toBe(0);
  });

  it('should return 0 area when vertexIds list is empty', () => {
    const result = calculateFacetMeasurements([], allVertices, 6);
    expect(result.areaSqFt).toBe(0);
    expect(result.trueAreaSqFt).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getPitchMultiplier (extended)
// ---------------------------------------------------------------------------
describe('getPitchMultiplier (extended)', () => {
  it('should return 1 for pitch 0', () => {
    expect(getPitchMultiplier(0)).toBe(1);
  });

  it('should return sqrt(2) for pitch 12', () => {
    expect(getPitchMultiplier(12)).toBeCloseTo(Math.SQRT2, 5);
  });

  it('should return correct value for pitch 6', () => {
    // sqrt(1 + (6/12)^2) = sqrt(1 + 0.25) = sqrt(1.25)
    expect(getPitchMultiplier(6)).toBeCloseTo(Math.sqrt(1.25), 5);
  });

  it('should return correct value for pitch 3', () => {
    // sqrt(1 + (3/12)^2) = sqrt(1 + 0.0625) = sqrt(1.0625)
    expect(getPitchMultiplier(3)).toBeCloseTo(Math.sqrt(1.0625), 5);
  });

  it('should increase monotonically with pitch', () => {
    let prev = getPitchMultiplier(0);
    for (let p = 1; p <= 24; p++) {
      const curr = getPitchMultiplier(p);
      expect(curr).toBeGreaterThan(prev);
      prev = curr;
    }
  });
});

// ---------------------------------------------------------------------------
// pitchToDegrees (extended)
// ---------------------------------------------------------------------------
describe('pitchToDegrees (extended)', () => {
  it('should return 0 degrees for pitch 0', () => {
    expect(pitchToDegrees(0)).toBe(0);
  });

  it('should return 45 degrees for pitch 12', () => {
    expect(pitchToDegrees(12)).toBeCloseTo(45, 5);
  });

  it('should return approximately 26.57 degrees for pitch 6', () => {
    expect(pitchToDegrees(6)).toBeCloseTo(26.565, 1);
  });

  it('should return approximately 18.43 degrees for pitch 4', () => {
    expect(pitchToDegrees(4)).toBeCloseTo(18.435, 1);
  });

  it('should return values between 0 and 90 for positive pitches', () => {
    for (let p = 0; p <= 24; p++) {
      const deg = pitchToDegrees(p);
      expect(deg).toBeGreaterThanOrEqual(0);
      expect(deg).toBeLessThan(90);
    }
  });
});

// ---------------------------------------------------------------------------
// degreesToPitch (extended)
// ---------------------------------------------------------------------------
describe('degreesToPitch (extended)', () => {
  it('should return 0 for 0 degrees', () => {
    expect(degreesToPitch(0)).toBeCloseTo(0, 5);
  });

  it('should return 12 for 45 degrees', () => {
    expect(degreesToPitch(45)).toBeCloseTo(12, 5);
  });

  it('should roundtrip correctly with pitchToDegrees for pitch 6', () => {
    const degrees = pitchToDegrees(6);
    const pitch = degreesToPitch(degrees);
    expect(pitch).toBeCloseTo(6, 5);
  });

  it('should roundtrip correctly with pitchToDegrees for pitch 4', () => {
    const degrees = pitchToDegrees(4);
    const pitch = degreesToPitch(degrees);
    expect(pitch).toBeCloseTo(4, 5);
  });

  it('should roundtrip correctly with pitchToDegrees for pitch 12', () => {
    const degrees = pitchToDegrees(12);
    const pitch = degreesToPitch(degrees);
    expect(pitch).toBeCloseTo(12, 5);
  });

  it('should roundtrip correctly for a range of pitches', () => {
    for (let p = 0; p <= 20; p++) {
      const deg = pitchToDegrees(p);
      const roundtrip = degreesToPitch(deg);
      expect(roundtrip).toBeCloseTo(p, 5);
    }
  });
});

// ---------------------------------------------------------------------------
// getMidpoint (extended)
// ---------------------------------------------------------------------------
describe('getMidpoint (extended)', () => {
  it('should return the average lat and lng of two points', () => {
    const a = { lat: 10, lng: 20 };
    const b = { lat: 30, lng: 40 };
    const mid = getMidpoint(a, b);
    expect(mid.lat).toBe(20);
    expect(mid.lng).toBe(30);
  });

  it('should return the same point when both inputs are identical', () => {
    const p = { lat: 40.5, lng: -90.5 };
    const mid = getMidpoint(p, p);
    expect(mid.lat).toBe(p.lat);
    expect(mid.lng).toBe(p.lng);
  });

  it('should handle negative coordinates', () => {
    const a = { lat: -10, lng: -20 };
    const b = { lat: -30, lng: -40 };
    const mid = getMidpoint(a, b);
    expect(mid.lat).toBe(-20);
    expect(mid.lng).toBe(-30);
  });

  it('should handle mixed positive and negative coordinates', () => {
    const a = { lat: -10, lng: 20 };
    const b = { lat: 10, lng: -20 };
    const mid = getMidpoint(a, b);
    expect(mid.lat).toBe(0);
    expect(mid.lng).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// isPointInPolygon (extended)
// ---------------------------------------------------------------------------
describe('isPointInPolygon (extended)', () => {
  // Triangle vertices
  const triangle = [
    { lat: 0, lng: 0 },
    { lat: 4, lng: 0 },
    { lat: 2, lng: 4 },
  ];

  it('should return true for a point clearly inside the triangle', () => {
    expect(isPointInPolygon({ lat: 2, lng: 1 }, triangle)).toBe(true);
  });

  it('should return false for a point clearly outside the triangle', () => {
    expect(isPointInPolygon({ lat: 5, lng: 5 }, triangle)).toBe(false);
  });

  it('should return false for a point far away', () => {
    expect(isPointInPolygon({ lat: 100, lng: 100 }, triangle)).toBe(false);
  });

  it('should return false for a point to the left of the triangle', () => {
    expect(isPointInPolygon({ lat: 2, lng: -1 }, triangle)).toBe(false);
  });

  it('should return true for a point near the centroid of the triangle', () => {
    const centroid = getCentroid(triangle);
    expect(isPointInPolygon(centroid, triangle)).toBe(true);
  });

  it('should work with a square polygon', () => {
    const square = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 10 },
      { lat: 10, lng: 10 },
      { lat: 10, lng: 0 },
    ];
    expect(isPointInPolygon({ lat: 5, lng: 5 }, square)).toBe(true);
    expect(isPointInPolygon({ lat: 11, lng: 5 }, square)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatNumber (extended)
// ---------------------------------------------------------------------------
describe('formatNumber (extended)', () => {
  it('should format 0 without decimals', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('should format 1234 with commas', () => {
    expect(formatNumber(1234)).toBe('1,234');
  });

  it('should format 1234.5678 with 2 decimal places', () => {
    expect(formatNumber(1234.5678, 2)).toBe('1,234.57');
  });

  it('should format large numbers with commas', () => {
    expect(formatNumber(1000000)).toBe('1,000,000');
  });

  it('should format with 0 decimals by default', () => {
    expect(formatNumber(99.9)).toBe('100');
  });

  it('should format with specified decimal places', () => {
    expect(formatNumber(3.14159, 3)).toBe('3.142');
  });

  it('should pad with trailing zeros when decimals specified', () => {
    expect(formatNumber(5, 2)).toBe('5.00');
  });
});

// ---------------------------------------------------------------------------
// formatArea (extended)
// ---------------------------------------------------------------------------
describe('formatArea (extended)', () => {
  it('should format area with sq ft suffix', () => {
    expect(formatArea(1500)).toBe('1,500 sq ft');
  });

  it('should format 0 area', () => {
    expect(formatArea(0)).toBe('0 sq ft');
  });

  it('should format large areas with commas', () => {
    expect(formatArea(25000)).toBe('25,000 sq ft');
  });

  it('should round fractional areas to whole numbers', () => {
    expect(formatArea(1234.7)).toBe('1,235 sq ft');
  });
});

// ---------------------------------------------------------------------------
// formatLength (extended)
// ---------------------------------------------------------------------------
describe('formatLength (extended)', () => {
  it('should format length with 1 decimal and ft suffix', () => {
    expect(formatLength(25.5)).toBe('25.5 ft');
  });

  it('should format 0 length', () => {
    expect(formatLength(0)).toBe('0.0 ft');
  });

  it('should format whole numbers with one decimal', () => {
    expect(formatLength(100)).toBe('100.0 ft');
  });

  it('should round to 1 decimal place', () => {
    expect(formatLength(12.456)).toBe('12.5 ft');
  });

  it('should handle large lengths with commas', () => {
    expect(formatLength(5280)).toBe('5,280.0 ft');
  });
});

// ---------------------------------------------------------------------------
// formatPitch (extended)
// ---------------------------------------------------------------------------
describe('formatPitch (extended)', () => {
  it('should return "Flat" for pitch 0', () => {
    expect(formatPitch(0)).toBe('Flat');
  });

  it('should return "6/12" for pitch 6', () => {
    expect(formatPitch(6)).toBe('6/12');
  });

  it('should return "12/12" for pitch 12', () => {
    expect(formatPitch(12)).toBe('12/12');
  });

  it('should return "1/12" for pitch 1', () => {
    expect(formatPitch(1)).toBe('1/12');
  });

  it('should return "4/12" for pitch 4', () => {
    expect(formatPitch(4)).toBe('4/12');
  });
});

// ---------------------------------------------------------------------------
// getCentroid (extended)
// ---------------------------------------------------------------------------
describe('getCentroid (extended)', () => {
  it('should return centroid of a 3-point triangle', () => {
    const points = [
      { lat: 0, lng: 0 },
      { lat: 6, lng: 0 },
      { lat: 3, lng: 6 },
    ];
    const c = getCentroid(points);
    expect(c.lat).toBe(3);
    expect(c.lng).toBe(2);
  });

  it('should return the point itself for a single point', () => {
    const points = [{ lat: 42.5, lng: -71.3 }];
    const c = getCentroid(points);
    expect(c.lat).toBe(42.5);
    expect(c.lng).toBe(-71.3);
  });

  it('should return midpoint for two points', () => {
    const points = [
      { lat: 10, lng: 20 },
      { lat: 30, lng: 40 },
    ];
    const c = getCentroid(points);
    expect(c.lat).toBe(20);
    expect(c.lng).toBe(30);
  });

  it('should return the correct centroid for a square', () => {
    const points = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 10 },
      { lat: 10, lng: 10 },
      { lat: 10, lng: 0 },
    ];
    const c = getCentroid(points);
    expect(c.lat).toBe(5);
    expect(c.lng).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// adjustAreaForPitch (extended)
// ---------------------------------------------------------------------------
describe('adjustAreaForPitch (extended)', () => {
  it('should return the same area when pitch is 0', () => {
    expect(adjustAreaForPitch(1000, 0)).toBe(1000);
  });

  it('should return the same area when pitch is negative', () => {
    // Implementation treats pitch <= 0 as flat
    expect(adjustAreaForPitch(1000, -5)).toBe(1000);
  });

  it('should return a larger area when pitch is greater than 0', () => {
    const adjusted = adjustAreaForPitch(1000, 6);
    expect(adjusted).toBeGreaterThan(1000);
  });

  it('should return area * sqrt(2) for pitch 12', () => {
    const flatArea = 1000;
    const adjusted = adjustAreaForPitch(flatArea, 12);
    expect(adjusted).toBeCloseTo(flatArea * Math.SQRT2, 2);
  });

  it('should return correct value for pitch 6', () => {
    const flatArea = 2000;
    const adjusted = adjustAreaForPitch(flatArea, 6);
    const expected = 2000 * Math.sqrt(1 + Math.pow(6 / 12, 2));
    expect(adjusted).toBeCloseTo(expected, 5);
  });

  it('should scale linearly with flat area', () => {
    const a1 = adjustAreaForPitch(500, 8);
    const a2 = adjustAreaForPitch(1000, 8);
    expect(a2).toBeCloseTo(a1 * 2, 5);
  });

  it('should return 0 when flat area is 0 regardless of pitch', () => {
    expect(adjustAreaForPitch(0, 12)).toBe(0);
  });
});
