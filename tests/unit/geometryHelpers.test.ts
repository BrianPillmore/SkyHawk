/**
 * Unit tests for geometry helper functions
 * Run with: npx vitest run tests/unit/geometryHelpers.test.ts
 */

import { describe, it, expect } from 'vitest';
import { localFtToLatLng, bearing, findLinePolygonIntersections } from '../../src/utils/geometryHelpers';
import { latLngToLocalFt } from '../../src/utils/geometry';

// --- localFtToLatLng ---

describe('localFtToLatLng', () => {
  const ref = { lat: 40.0, lng: -90.0 };

  it('should return reference point for (0, 0)', () => {
    const result = localFtToLatLng(0, 0, ref);
    expect(result.lat).toBeCloseTo(ref.lat, 8);
    expect(result.lng).toBeCloseTo(ref.lng, 8);
  });

  it('should move north for positive y', () => {
    const result = localFtToLatLng(0, 1000, ref);
    expect(result.lat).toBeGreaterThan(ref.lat);
    expect(result.lng).toBeCloseTo(ref.lng, 5);
  });

  it('should move east for positive x', () => {
    const result = localFtToLatLng(1000, 0, ref);
    expect(result.lat).toBeCloseTo(ref.lat, 5);
    expect(result.lng).toBeGreaterThan(ref.lng);
  });

  it('should roundtrip with latLngToLocalFt', () => {
    // Convert to local, then back
    const offset = { x: 150, y: -200 };
    const ll = localFtToLatLng(offset.x, offset.y, ref);
    const back = latLngToLocalFt(ll, ref);
    expect(back.x).toBeCloseTo(offset.x, 0);
    expect(back.y).toBeCloseTo(offset.y, 0);
  });

  it('should roundtrip latLng -> local -> latLng', () => {
    const point = { lat: 40.001, lng: -89.999 };
    const local = latLngToLocalFt(point, ref);
    const back = localFtToLatLng(local.x, local.y, ref);
    expect(back.lat).toBeCloseTo(point.lat, 5);
    expect(back.lng).toBeCloseTo(point.lng, 5);
  });

  it('should handle negative offsets (south/west)', () => {
    const result = localFtToLatLng(-500, -500, ref);
    expect(result.lat).toBeLessThan(ref.lat);
    expect(result.lng).toBeLessThan(ref.lng);
  });

  it('should produce approximately correct distances', () => {
    // 5280 feet = 1 mile ≈ 0.01449° latitude
    const result = localFtToLatLng(0, 5280, ref);
    const dLat = result.lat - ref.lat;
    expect(dLat).toBeGreaterThan(0.013);
    expect(dLat).toBeLessThan(0.016);
  });
});

// --- bearing ---

describe('bearing', () => {
  it('should return ~0 (north) for point directly north', () => {
    const a = { lat: 40.0, lng: -90.0 };
    const b = { lat: 41.0, lng: -90.0 };
    const b_rad = bearing(a, b);
    const b_deg = (b_rad * 180) / Math.PI;
    expect(b_deg).toBeCloseTo(0, 0);
  });

  it('should return ~90° (east) for point directly east', () => {
    const a = { lat: 40.0, lng: -90.0 };
    const b = { lat: 40.0, lng: -89.0 };
    const b_rad = bearing(a, b);
    const b_deg = (b_rad * 180) / Math.PI;
    expect(b_deg).toBeCloseTo(90, 0);
  });

  it('should return ~180° (south) for point directly south', () => {
    const a = { lat: 40.0, lng: -90.0 };
    const b = { lat: 39.0, lng: -90.0 };
    const b_rad = bearing(a, b);
    const b_deg = (b_rad * 180) / Math.PI;
    expect(b_deg).toBeCloseTo(180, 0);
  });

  it('should return ~270° (west) for point directly west', () => {
    const a = { lat: 40.0, lng: -90.0 };
    const b = { lat: 40.0, lng: -91.0 };
    const b_rad = bearing(a, b);
    const b_deg = (b_rad * 180) / Math.PI;
    expect(b_deg).toBeCloseTo(270, 0);
  });

  it('should return value in [0, 2*PI)', () => {
    const cases = [
      [{ lat: 40, lng: -90 }, { lat: 41, lng: -89 }],
      [{ lat: 40, lng: -90 }, { lat: 39, lng: -91 }],
      [{ lat: 40, lng: -90 }, { lat: 39, lng: -89 }],
    ];
    for (const [a, b] of cases) {
      const b_rad = bearing(a, b);
      expect(b_rad).toBeGreaterThanOrEqual(0);
      expect(b_rad).toBeLessThan(2 * Math.PI);
    }
  });

  it('should handle same point gracefully', () => {
    const a = { lat: 40.0, lng: -90.0 };
    const result = bearing(a, a);
    // atan2(0, 0) is 0
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(2 * Math.PI);
  });
});

// --- findLinePolygonIntersections ---

describe('findLinePolygonIntersections', () => {
  // A square polygon centered near origin
  const square = [
    { lat: 40.0000, lng: -90.0004 },  // SW
    { lat: 40.0000, lng: -89.9996 },  // SE
    { lat: 40.0003, lng: -89.9996 },  // NE
    { lat: 40.0003, lng: -90.0004 },  // NW
  ];

  const center = {
    lat: (40.0 + 40.0003) / 2,
    lng: (-90.0004 + -89.9996) / 2,
  };

  it('should find 2 intersections for a line through a rectangle', () => {
    // Line going east (bearing ~90°, π/2 rad) through center
    const intersections = findLinePolygonIntersections(center, Math.PI / 2, square);
    expect(intersections.length).toBe(2);
  });

  it('should find 2 intersections for a north-south line', () => {
    // Bearing 0 = north
    const intersections = findLinePolygonIntersections(center, 0, square);
    expect(intersections.length).toBe(2);
  });

  it('should return sorted by distance from origin', () => {
    const intersections = findLinePolygonIntersections(center, Math.PI / 2, square);
    if (intersections.length >= 2) {
      // Since origin is center, both intersections should be roughly equidistant
      const local0 = latLngToLocalFt(intersections[0], center);
      const local1 = latLngToLocalFt(intersections[1], center);
      const dist0 = Math.hypot(local0.x, local0.y);
      const dist1 = Math.hypot(local1.x, local1.y);
      expect(dist0).toBeLessThanOrEqual(dist1 + 0.01);
    }
  });

  it('should handle diagonal lines through a square', () => {
    // 45 degree bearing (NE)
    const bearingRad = Math.PI / 4;
    const intersections = findLinePolygonIntersections(center, bearingRad, square);
    expect(intersections.length).toBe(2);
  });

  it('should handle a triangle polygon', () => {
    const triangle = [
      { lat: 40.0000, lng: -90.0000 },
      { lat: 40.0005, lng: -89.9995 },
      { lat: 40.0000, lng: -89.999 },
    ];
    const triCenter = {
      lat: (40.0 + 40.0005 + 40.0) / 3,
      lng: (-90 + -89.9995 + -89.999) / 3,
    };
    const intersections = findLinePolygonIntersections(triCenter, Math.PI / 2, triangle);
    expect(intersections.length).toBeGreaterThanOrEqual(2);
  });
});
