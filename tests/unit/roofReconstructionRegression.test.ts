/**
 * Regression tests for reconstructComplexRoof against 18 EagleView calibration properties.
 * Verifies that each Solar API segment produces a facet with accurate area.
 *
 * Run with: npx vitest run tests/unit/roofReconstructionRegression.test.ts
 */

import { describe, it, expect } from 'vitest';
import { reconstructComplexRoof } from '../../src/utils/roofReconstruction';
import type { SolarRoofSegment } from '../../src/types/solar';
import type { LatLng } from '../../src/types';
import comparisonData from '../fixtures/solar-api-comparison.json';

interface ComparisonEntry {
  address: string;
  status: string;
  ev_area: number;
  solar_area: number;
  area_diff_pct: number;
  ev_facets: number;
  solar_facets: number;
  ev_pitch: number;
  solar_pitch: number;
  quality: string;
  complexity: string;
}

/**
 * Generate mock Solar API segments from comparison data.
 * Each segment gets a unique center offset so they're spatially distributed,
 * evenly dividing the total area among segments.
 */
function generateMockSegments(entry: ComparisonEntry): SolarRoofSegment[] {
  const numSegments = entry.solar_facets;
  const totalAreaSqFt = entry.solar_area;
  const totalAreaM2 = totalAreaSqFt / 10.7639;
  const areaPerSegmentM2 = totalAreaM2 / numSegments;
  const pitchDeg = entry.solar_pitch * (180 / Math.PI / 12) > 0
    ? Math.atan(entry.solar_pitch / 12) * (180 / Math.PI)
    : 0;

  const segments: SolarRoofSegment[] = [];
  const baseLat = 40.0;
  const baseLng = -90.0;

  for (let i = 0; i < numSegments; i++) {
    // Distribute centers in a grid pattern within ~50ft of each other
    const row = Math.floor(i / 4);
    const col = i % 4;
    const latOffset = row * 0.00010; // ~36ft per 0.0001 deg lat
    const lngOffset = col * 0.00013; // ~36ft per 0.00013 deg lng at lat 40

    segments.push({
      pitchDegrees: pitchDeg,
      azimuthDegrees: (i * (360 / numSegments)) % 360,
      stats: {
        areaMeters2: areaPerSegmentM2,
        sunshineQuantiles: [],
        groundAreaMeters2: areaPerSegmentM2,
      },
      center: {
        latitude: baseLat + latOffset,
        longitude: baseLng + lngOffset,
      },
      boundingBox: {
        sw: { latitude: baseLat - 0.001, longitude: baseLng - 0.001 },
        ne: { latitude: baseLat + 0.003, longitude: baseLng + 0.001 },
      },
      planeHeightAtCenterMeters: 5,
    });
  }

  return segments;
}

/** Simple rectangular outline for all tests */
const OUTLINE: LatLng[] = [
  { lat: 39.9998, lng: -90.0006 },
  { lat: 39.9998, lng: -89.9994 },
  { lat: 40.0008, lng: -89.9994 },
  { lat: 40.0008, lng: -90.0006 },
];

describe('reconstructComplexRoof regression — 18 EagleView properties', () => {
  const entries = comparisonData as ComparisonEntry[];

  for (const entry of entries) {
    describe(entry.address, () => {
      const segments = generateMockSegments(entry);

      it(`should produce ${entry.solar_facets} facets`, () => {
        // Properties with <= 1 segment delegate to simple roof
        if (entry.solar_facets <= 1) return;

        const result = reconstructComplexRoof(OUTLINE, segments);
        expect(result.facets.length).toBe(entry.solar_facets);
      });

      it('should have total trueArea3DSqFt within 5% of solar_area', () => {
        if (entry.solar_facets <= 1) return;

        const result = reconstructComplexRoof(OUTLINE, segments);
        const totalArea = result.facets.reduce(
          (sum, f) => sum + (f.trueArea3DSqFt ?? 0),
          0
        );
        const diffPct = Math.abs(totalArea - entry.solar_area) / entry.solar_area * 100;
        expect(diffPct).toBeLessThan(5);
      });

      it('should have valid trueArea3DSqFt on every facet', () => {
        if (entry.solar_facets <= 1) return;

        const result = reconstructComplexRoof(OUTLINE, segments);
        for (const facet of result.facets) {
          expect(facet.trueArea3DSqFt).toBeGreaterThan(0);
        }
      });
    });
  }
});
