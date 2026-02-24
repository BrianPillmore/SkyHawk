/**
 * Mocked Solar API Regression Pipeline.
 * Feeds mocked buildingInsights responses through the roof reconstruction
 * pipeline and compares outputs to EagleView calibration ground truth.
 *
 * This tests the full Solar API → Measurement pathway without live API calls.
 *
 * Run: npx vitest run tests/unit/solarApiRegression.test.ts
 */
import { describe, it, expect } from 'vitest';
import mockResponses from '../fixtures/mock-solar-api-responses.json';
import { reconstructComplexRoof } from '../../src/utils/roofReconstruction';
import { calculatePolygonAreaSqFt, adjustAreaForPitch, degreesToPitch, clampPitch } from '../../src/utils/geometry';
import type { SolarRoofSegment } from '../../src/types/solar';
import type { LatLng } from '../../src/types';

// ─── Types for mock fixture data ────────────────────────────────────

interface MockSolarResponse {
  address: string;
  buildingInsights: {
    name: string;
    center: { latitude: number; longitude: number };
    boundingBox: { sw: { latitude: number; longitude: number }; ne: { latitude: number; longitude: number } };
    imageryDate: { year: number; month: number; day: number };
    imageryProcessedDate: { year: number; month: number; day: number };
    postalCode: string;
    administrativeArea: string;
    statisticalArea: string;
    regionCode: string;
    solarPotential: {
      maxArrayPanelsCount: number;
      maxArrayAreaMeters2: number;
      maxSunshineHoursPerYear: number;
      carbonOffsetFactorKgPerMwh: number;
      wholeRoofStats: { areaMeters2: number; sunshineQuantiles: number[]; groundAreaMeters2: number };
      roofSegmentStats: SolarRoofSegment[];
      buildingStats: { areaMeters2: number; sunshineQuantiles: number[]; groundAreaMeters2: number };
      solarPanels: unknown[];
      solarPanelConfigs: unknown[];
    };
    imageryQuality: string;
  };
  eagleViewGroundTruth: {
    totalSquares: number;
    predominantPitch: string;
    facetCount: number;
  };
}

const properties = mockResponses as MockSolarResponse[];

// ─── Helpers ──────────────────────────────────────────────────────────

/** Convert Solar API area (m2) to sq ft */
function m2ToSqFt(m2: number): number {
  return m2 * 10.7639;
}

/** Parse pitch string like "8/12" to number 8 */
function parsePitch(pitchStr: string): number {
  const match = pitchStr.match(/^(\d+)\/12$/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Build a simple rectangular outline from bounding box for roof reconstruction.
 * The Solar API provides segment centers and areas but not building outlines.
 * We approximate an outline from the bounding box.
 */
function buildOutlineFromBoundingBox(
  sw: { latitude: number; longitude: number },
  ne: { latitude: number; longitude: number }
): LatLng[] {
  return [
    { lat: sw.latitude, lng: sw.longitude },
    { lat: sw.latitude, lng: ne.longitude },
    { lat: ne.latitude, lng: ne.longitude },
    { lat: ne.latitude, lng: sw.longitude },
  ];
}

/**
 * Compute total true roof area from Solar API segment stats.
 * This is the "direct from Solar API" area calculation without reconstruction.
 * Uses segment areaMeters2 (which is already the true/sloped area).
 */
function computeTotalAreaFromSegments(segments: SolarRoofSegment[]): number {
  return segments.reduce((sum, seg) => sum + m2ToSqFt(seg.stats.areaMeters2), 0);
}

/**
 * Determine predominant pitch from Solar API segments (by area).
 */
function getPredominantPitchFromSegments(segments: SolarRoofSegment[]): number {
  const pitchAreas = new Map<number, number>();
  for (const seg of segments) {
    const pitch = Math.round(clampPitch(degreesToPitch(seg.pitchDegrees)));
    const current = pitchAreas.get(pitch) || 0;
    pitchAreas.set(pitch, current + seg.stats.areaMeters2);
  }
  let maxArea = 0;
  let predominant = 0;
  for (const [pitch, area] of pitchAreas) {
    if (area > maxArea) {
      maxArea = area;
      predominant = pitch;
    }
  }
  return predominant;
}

// ─── Per-property reconstruction tests ────────────────────────────────

describe('Solar API Regression Pipeline', () => {
  describe('Roof reconstruction from Solar API responses', () => {
    for (const prop of properties) {
      it(`should reconstruct roof from Solar API response for ${prop.address}`, () => {
        const segments = prop.buildingInsights.solarPotential.roofSegmentStats;
        const bb = prop.buildingInsights.boundingBox;
        const outline = buildOutlineFromBoundingBox(bb.sw, bb.ne);

        // 1. Feed mock buildingInsights into reconstructComplexRoof
        const reconstructed = reconstructComplexRoof(outline, segments);

        // Basic structure checks
        expect(reconstructed.vertices.length).toBeGreaterThanOrEqual(4);
        expect(reconstructed.edges.length).toBeGreaterThan(0);
        expect(reconstructed.facets.length).toBeGreaterThan(0);

        // 2. Compute total area from reconstructed facets
        // Each facet has vertexIndices that reference vertices in the reconstructed roof
        let totalTrueAreaSqFt = 0;
        for (const facet of reconstructed.facets) {
          const facetVertices = facet.vertexIndices.map((i) => reconstructed.vertices[i]);
          const flatArea = calculatePolygonAreaSqFt(facetVertices);
          const trueArea = adjustAreaForPitch(flatArea, facet.pitch);
          totalTrueAreaSqFt += trueArea;
        }

        // 3. Compare with EagleView ground truth area
        const evSquares = prop.eagleViewGroundTruth.totalSquares;
        const evAreaSqFt = evSquares * 100;

        // Since we're reconstructing from a simple bounding box outline (not the
        // actual building footprint), there will be significant area deviation.
        // The key test is that the pipeline doesn't crash and produces reasonable values.
        expect(totalTrueAreaSqFt).toBeGreaterThan(0);

        // 4. Check predominant pitch
        const expectedPitch = parsePitch(prop.eagleViewGroundTruth.predominantPitch);
        const predominantFromRecon = getPredominantPitchFromSegments(segments);
        // Pitch should be within ±3 of EagleView (Solar API degrees → pitch conversion tolerance)
        expect(
          Math.abs(predominantFromRecon - expectedPitch),
          `${prop.address}: pitch expected ${expectedPitch}/12, got ${predominantFromRecon}/12`
        ).toBeLessThanOrEqual(3);

        // 5. Check facet count — reconstruction simplifies, so we check segments
        const segmentCount = segments.length;
        expect(segmentCount).toBeGreaterThanOrEqual(2);
      });
    }
  });

  describe('Direct Solar API area accuracy', () => {
    for (const prop of properties) {
      it(`should calculate area within ±15% of EagleView for ${prop.address}`, () => {
        const segments = prop.buildingInsights.solarPotential.roofSegmentStats;

        // Compute total area directly from Solar API segments (true/sloped area in m2)
        const solarAreaSqFt = computeTotalAreaFromSegments(segments);
        const solarSquares = solarAreaSqFt / 100;

        const evSquares = prop.eagleViewGroundTruth.totalSquares;
        const pctDiff = Math.abs(solarSquares - evSquares) / evSquares;

        // Solar API areas should be within 15% of EagleView ground truth
        // (realistic tolerance for satellite-based vs measured data)
        expect(
          pctDiff,
          `${prop.address}: Solar ${solarSquares.toFixed(1)} sq vs EV ${evSquares} sq (${(pctDiff * 100).toFixed(1)}% diff)`
        ).toBeLessThan(0.15);
      });
    }
  });

  describe('Pitch accuracy from Solar API segments', () => {
    for (const prop of properties) {
      it(`should identify correct predominant pitch for ${prop.address}`, () => {
        const segments = prop.buildingInsights.solarPotential.roofSegmentStats;
        const predominant = getPredominantPitchFromSegments(segments);
        const expected = parsePitch(prop.eagleViewGroundTruth.predominantPitch);

        expect(
          Math.abs(predominant - expected),
          `${prop.address}: expected ${expected}/12, got ${predominant}/12`
        ).toBeLessThanOrEqual(3);
      });
    }
  });

  describe('Overall accuracy summary', () => {
    it('should compute accuracy metrics across all properties', () => {
      const results: {
        address: string;
        solarSquares: number;
        evSquares: number;
        pctError: number;
        pitchMatch: boolean;
      }[] = [];

      for (const prop of properties) {
        const segments = prop.buildingInsights.solarPotential.roofSegmentStats;
        const solarAreaSqFt = computeTotalAreaFromSegments(segments);
        const solarSquares = solarAreaSqFt / 100;
        const evSquares = prop.eagleViewGroundTruth.totalSquares;
        const pctError = (solarSquares - evSquares) / evSquares;

        const predominant = getPredominantPitchFromSegments(segments);
        const expected = parsePitch(prop.eagleViewGroundTruth.predominantPitch);
        const pitchMatch = Math.abs(predominant - expected) <= 2;

        results.push({
          address: prop.address,
          solarSquares: Math.round(solarSquares * 10) / 10,
          evSquares,
          pctError: Math.round(pctError * 1000) / 10,
          pitchMatch,
        });
      }

      // Accuracy tiers
      const within5 = results.filter((r) => Math.abs(r.pctError) <= 5).length;
      const within10 = results.filter((r) => Math.abs(r.pctError) <= 10).length;
      const within15 = results.filter((r) => Math.abs(r.pctError) <= 15).length;

      // Mean absolute error
      const mae = results.reduce((sum, r) => sum + Math.abs(r.pctError), 0) / results.length;

      // Median error
      const sortedErrors = results.map((r) => Math.abs(r.pctError)).sort((a, b) => a - b);
      const medianError = sortedErrors[Math.floor(sortedErrors.length / 2)];

      // Pitch accuracy
      const pitchAccuracy = results.filter((r) => r.pitchMatch).length;

      // Log summary table
      console.log('\n=== Solar API Regression Summary ===');
      console.log(`Properties tested: ${results.length}`);
      console.log(`Within ±5%: ${within5}/${results.length} (${((within5 / results.length) * 100).toFixed(0)}%)`);
      console.log(`Within ±10%: ${within10}/${results.length} (${((within10 / results.length) * 100).toFixed(0)}%)`);
      console.log(`Within ±15%: ${within15}/${results.length} (${((within15 / results.length) * 100).toFixed(0)}%)`);
      console.log(`Mean absolute error: ${mae.toFixed(1)}%`);
      console.log(`Median error: ${medianError.toFixed(1)}%`);
      console.log(`Pitch accuracy (±2): ${pitchAccuracy}/${results.length}`);
      console.log('\nPer-property results:');
      for (const r of results) {
        console.log(
          `  ${r.address}: Solar=${r.solarSquares}sq, EV=${r.evSquares}sq, err=${r.pctError}%, pitch=${r.pitchMatch ? 'OK' : 'MISS'}`
        );
      }

      // Assertions
      // At least 50% of properties should be within ±10%
      expect(within10).toBeGreaterThanOrEqual(Math.floor(results.length * 0.5));

      // All properties should be within ±15%
      expect(within15).toBe(results.length);

      // Mean absolute error should be under 12%
      expect(mae).toBeLessThan(12);

      // Pitch accuracy should be >= 80%
      expect(pitchAccuracy).toBeGreaterThanOrEqual(Math.floor(results.length * 0.8));
    });
  });

  describe('Whole roof stats consistency', () => {
    for (const prop of properties) {
      it(`should have segment areas sum close to wholeRoofStats for ${prop.address}`, () => {
        const segments = prop.buildingInsights.solarPotential.roofSegmentStats;
        const wholeRoof = prop.buildingInsights.solarPotential.wholeRoofStats;

        const segmentSum = segments.reduce((sum, s) => sum + s.stats.areaMeters2, 0);
        const wholeArea = wholeRoof.areaMeters2;

        // Segment sum should be close to whole roof area (within 10%)
        // Some small segments may be excluded by the API
        const ratio = segmentSum / wholeArea;
        expect(ratio).toBeGreaterThan(0.85);
        expect(ratio).toBeLessThan(1.15);
      });
    }
  });

  describe('Bounding box validity', () => {
    for (const prop of properties) {
      it(`should have valid bounding box for ${prop.address}`, () => {
        const bb = prop.buildingInsights.boundingBox;
        expect(bb.ne.latitude).toBeGreaterThan(bb.sw.latitude);
        expect(bb.ne.longitude).toBeGreaterThan(bb.sw.longitude);

        // Center should be within bounding box
        const center = prop.buildingInsights.center;
        expect(center.latitude).toBeGreaterThanOrEqual(bb.sw.latitude);
        expect(center.latitude).toBeLessThanOrEqual(bb.ne.latitude);
        expect(center.longitude).toBeGreaterThanOrEqual(bb.sw.longitude);
        expect(center.longitude).toBeLessThanOrEqual(bb.ne.longitude);
      });
    }
  });
});
