/**
 * Unit tests for DSM pitch verification module: verifyPitchFromDSM,
 * extractBuildingHeightFromDSM, calculateRSquared, determineConfidence,
 * determineRecommendation
 * Run with: npx vitest run tests/unit/dsmPitchVerification.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  verifyPitchFromDSM,
  extractBuildingHeightFromDSM,
  calculateRSquared,
  determineConfidence,
  determineRecommendation,
} from '../../src/utils/dsmPitchVerification';
import type { ParsedDSM, GeoTiffAffine, ReconstructedRoof } from '../../src/types/solar';
import type { LatLng } from '../../src/types';

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Create a DSM with geographic (lat/lng) coords.
 */
function createGeoDSM(opts: {
  width: number;
  height: number;
  elevationFn: (col: number, row: number) => number;
  originLat?: number;
  originLng?: number;
  pixelSizeDeg?: number;
}): ParsedDSM {
  const {
    width,
    height,
    elevationFn,
    originLat = 35.5,
    originLng = -97.5,
    pixelSizeDeg = 0.00001,
  } = opts;

  const data = new Float32Array(width * height);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      data[row * width + col] = elevationFn(col, row);
    }
  }

  const affine: GeoTiffAffine = {
    originX: originLng,
    originY: originLat,
    pixelWidth: pixelSizeDeg,
    pixelHeight: -pixelSizeDeg,
  };

  return { data, width, height, affine };
}

/**
 * Create a simple ReconstructedRoof for testing.
 */
function createTestRoof(opts: {
  facets: {
    vertexIndices: number[];
    pitch: number;
    name: string;
  }[];
  vertices: LatLng[];
}): ReconstructedRoof {
  return {
    vertices: opts.vertices,
    edges: [],
    facets: opts.facets.map((f, i) => ({
      ...f,
      trueArea3DSqFt: undefined,
    })),
    roofType: 'gable',
    confidence: 'high',
    dataSource: 'lidar-mask',
  };
}

// ─── calculateRSquared tests ─────────────────────────────────────

describe('calculateRSquared', () => {
  it('should return 1.0 for a perfect plane fit', () => {
    const points = [];
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        points.push({ x, y, z: 2 * x + 3 * y + 1 });
      }
    }
    const rSq = calculateRSquared(points, [2, 3, 1]);
    expect(rSq).toBeCloseTo(1.0, 5);
  });

  it('should return a value less than 1 for noisy data', () => {
    const points = [
      { x: 0, y: 0, z: 0.1 },
      { x: 1, y: 0, z: 0.9 },
      { x: 2, y: 0, z: 2.3 },
      { x: 0, y: 1, z: -0.2 },
      { x: 1, y: 1, z: 1.1 },
      { x: 2, y: 1, z: 1.8 },
    ];
    const rSq = calculateRSquared(points, [1, 0, 0]);
    expect(rSq).toBeLessThan(1.0);
    expect(rSq).toBeGreaterThan(0.5);
  });

  it('should return 0 for fewer than 3 points', () => {
    expect(calculateRSquared([], [0, 0, 0])).toBe(0);
    expect(calculateRSquared([{ x: 0, y: 0, z: 1 }], [0, 0, 1])).toBe(0);
  });

  it('should return 1 for all points at same elevation (flat)', () => {
    const points = [
      { x: 0, y: 0, z: 5 },
      { x: 1, y: 0, z: 5 },
      { x: 0, y: 1, z: 5 },
      { x: 1, y: 1, z: 5 },
    ];
    const rSq = calculateRSquared(points, [0, 0, 5]);
    expect(rSq).toBe(1);
  });
});

// ─── determineConfidence tests ───────────────────────────────────

describe('determineConfidence', () => {
  it('should return "high" for many samples with good R-squared', () => {
    expect(determineConfidence(100, 0.95)).toBe('high');
    expect(determineConfidence(50, 0.85)).toBe('high');
  });

  it('should return "medium" for moderate samples with decent R-squared', () => {
    expect(determineConfidence(20, 0.7)).toBe('medium');
    expect(determineConfidence(15, 0.6)).toBe('medium');
  });

  it('should return "low" for few samples or poor R-squared', () => {
    expect(determineConfidence(5, 0.9)).toBe('low');
    expect(determineConfidence(100, 0.3)).toBe('low');
    expect(determineConfidence(3, 0.2)).toBe('low');
  });
});

// ─── determineRecommendation tests ───────────────────────────────

describe('determineRecommendation', () => {
  it('should accept solar when pitch difference < 2/12', () => {
    expect(determineRecommendation(0, 'high', 0.95)).toBe('accept-solar');
    expect(determineRecommendation(1, 'high', 0.95)).toBe('accept-solar');
    expect(determineRecommendation(1.9, 'low', 0.3)).toBe('accept-solar');
  });

  it('should accept DSM when difference >= 2 and confidence is high', () => {
    expect(determineRecommendation(3, 'high', 0.9)).toBe('accept-dsm');
    expect(determineRecommendation(5, 'high', 0.85)).toBe('accept-dsm');
  });

  it('should accept DSM for medium confidence with good R-squared', () => {
    expect(determineRecommendation(3, 'medium', 0.8)).toBe('accept-dsm');
  });

  it('should recommend manual review when confidence is low', () => {
    expect(determineRecommendation(3, 'low', 0.4)).toBe('manual-review');
    expect(determineRecommendation(5, 'low', 0.2)).toBe('manual-review');
  });

  it('should recommend manual review for medium confidence with poor R-squared', () => {
    expect(determineRecommendation(3, 'medium', 0.5)).toBe('manual-review');
  });
});

// ─── verifyPitchFromDSM tests ────────────────────────────────────

describe('verifyPitchFromDSM', () => {
  it('should verify matching pitches (flat roof)', () => {
    const dsm = createGeoDSM({
      width: 100,
      height: 100,
      elevationFn: () => 10, // Flat
    });

    const vertices: LatLng[] = [
      { lat: 35.5 - 20 * 0.00001, lng: -97.5 + 20 * 0.00001 },
      { lat: 35.5 - 20 * 0.00001, lng: -97.5 + 80 * 0.00001 },
      { lat: 35.5 - 80 * 0.00001, lng: -97.5 + 80 * 0.00001 },
      { lat: 35.5 - 80 * 0.00001, lng: -97.5 + 20 * 0.00001 },
    ];

    const roof = createTestRoof({
      facets: [{ vertexIndices: [0, 1, 2, 3], pitch: 0, name: 'Flat' }],
      vertices,
    });

    const results = verifyPitchFromDSM(dsm, roof, -97.5);

    expect(results).toHaveLength(1);
    expect(results[0].solarApiPitch).toBe(0);
    expect(results[0].dsmPitch).toBeCloseTo(0, 0);
    expect(results[0].pitchDifference).toBeLessThan(1);
    expect(results[0].recommendation).toBe('accept-solar');
  });

  it('should detect deviating pitches and flag for review', () => {
    // DSM shows a steep slope, but Solar API says flat
    const dsm = createGeoDSM({
      width: 100,
      height: 100,
      elevationFn: (col) => 10 + col * 0.01, // Slope
    });

    const vertices: LatLng[] = [
      { lat: 35.5 - 20 * 0.00001, lng: -97.5 + 20 * 0.00001 },
      { lat: 35.5 - 20 * 0.00001, lng: -97.5 + 80 * 0.00001 },
      { lat: 35.5 - 80 * 0.00001, lng: -97.5 + 80 * 0.00001 },
      { lat: 35.5 - 80 * 0.00001, lng: -97.5 + 20 * 0.00001 },
    ];

    const roof = createTestRoof({
      facets: [{ vertexIndices: [0, 1, 2, 3], pitch: 0, name: 'Claimed Flat' }],
      vertices,
    });

    const results = verifyPitchFromDSM(dsm, roof, -97.5);

    expect(results).toHaveLength(1);
    expect(results[0].solarApiPitch).toBe(0);
    expect(results[0].dsmPitch).toBeGreaterThan(0);
    expect(results[0].sampleCount).toBeGreaterThan(0);
  });

  it('should verify multiple facets independently', () => {
    const dsm = createGeoDSM({
      width: 100,
      height: 100,
      elevationFn: () => 10, // Flat for all
    });

    const vertices: LatLng[] = [
      // Facet 1
      { lat: 35.5 - 10 * 0.00001, lng: -97.5 + 10 * 0.00001 },
      { lat: 35.5 - 10 * 0.00001, lng: -97.5 + 45 * 0.00001 },
      { lat: 35.5 - 45 * 0.00001, lng: -97.5 + 45 * 0.00001 },
      { lat: 35.5 - 45 * 0.00001, lng: -97.5 + 10 * 0.00001 },
      // Facet 2
      { lat: 35.5 - 55 * 0.00001, lng: -97.5 + 55 * 0.00001 },
      { lat: 35.5 - 55 * 0.00001, lng: -97.5 + 90 * 0.00001 },
      { lat: 35.5 - 90 * 0.00001, lng: -97.5 + 90 * 0.00001 },
      { lat: 35.5 - 90 * 0.00001, lng: -97.5 + 55 * 0.00001 },
    ];

    const roof = createTestRoof({
      facets: [
        { vertexIndices: [0, 1, 2, 3], pitch: 4, name: '#1' },
        { vertexIndices: [4, 5, 6, 7], pitch: 6, name: '#2' },
      ],
      vertices,
    });

    const results = verifyPitchFromDSM(dsm, roof, -97.5);

    expect(results).toHaveLength(2);
    expect(results[0].facetIndex).toBe(0);
    expect(results[1].facetIndex).toBe(1);
  });

  it('should handle facets with insufficient vertices', () => {
    const dsm = createGeoDSM({
      width: 50,
      height: 50,
      elevationFn: () => 10,
    });

    const vertices: LatLng[] = [
      { lat: 35.4999, lng: -97.4999 },
      { lat: 35.4998, lng: -97.4998 },
    ];

    const roof = createTestRoof({
      facets: [{ vertexIndices: [0, 1], pitch: 6, name: 'Bad' }],
      vertices,
    });

    const results = verifyPitchFromDSM(dsm, roof, -97.5);

    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBe('low');
    expect(results[0].sampleCount).toBe(0);
    expect(results[0].recommendation).toBe('accept-solar');
  });

  it('should return R-squared value for plane fit quality', () => {
    const dsm = createGeoDSM({
      width: 100,
      height: 100,
      elevationFn: () => 10,
    });

    const vertices: LatLng[] = [
      { lat: 35.5 - 20 * 0.00001, lng: -97.5 + 20 * 0.00001 },
      { lat: 35.5 - 20 * 0.00001, lng: -97.5 + 80 * 0.00001 },
      { lat: 35.5 - 80 * 0.00001, lng: -97.5 + 80 * 0.00001 },
      { lat: 35.5 - 80 * 0.00001, lng: -97.5 + 20 * 0.00001 },
    ];

    const roof = createTestRoof({
      facets: [{ vertexIndices: [0, 1, 2, 3], pitch: 0, name: 'Test' }],
      vertices,
    });

    const results = verifyPitchFromDSM(dsm, roof, -97.5);

    expect(results[0].rSquared).toBeGreaterThanOrEqual(0);
    expect(results[0].rSquared).toBeLessThanOrEqual(1);
  });

  it('should handle no-data DSM values', () => {
    const dsm = createGeoDSM({
      width: 100,
      height: 100,
      elevationFn: () => 0, // Treated as no-data
    });

    const vertices: LatLng[] = [
      { lat: 35.5 - 20 * 0.00001, lng: -97.5 + 20 * 0.00001 },
      { lat: 35.5 - 20 * 0.00001, lng: -97.5 + 80 * 0.00001 },
      { lat: 35.5 - 80 * 0.00001, lng: -97.5 + 80 * 0.00001 },
      { lat: 35.5 - 80 * 0.00001, lng: -97.5 + 20 * 0.00001 },
    ];

    const roof = createTestRoof({
      facets: [{ vertexIndices: [0, 1, 2, 3], pitch: 4, name: 'NoData' }],
      vertices,
    });

    const results = verifyPitchFromDSM(dsm, roof, -97.5);

    expect(results[0].sampleCount).toBeLessThanOrEqual(3);
    expect(results[0].confidence).toBe('low');
  });
});

// ─── extractBuildingHeightFromDSM tests ──────────────────────────

describe('extractBuildingHeightFromDSM', () => {
  it('should extract height for a single-story building', () => {
    const dsm = createGeoDSM({
      width: 40,
      height: 40,
      elevationFn: (col, row) => {
        if (col >= 10 && col <= 30 && row >= 10 && row <= 30) return 13;
        return 10;
      },
    });

    const bounds = {
      sw: { lat: 35.5 - 30 * 0.00001, lng: -97.5 + 10 * 0.00001 },
      ne: { lat: 35.5 - 10 * 0.00001, lng: -97.5 + 30 * 0.00001 },
    };

    const outline: LatLng[] = [
      { lat: 35.5 - 10 * 0.00001, lng: -97.5 + 10 * 0.00001 },
      { lat: 35.5 - 10 * 0.00001, lng: -97.5 + 30 * 0.00001 },
      { lat: 35.5 - 30 * 0.00001, lng: -97.5 + 30 * 0.00001 },
      { lat: 35.5 - 30 * 0.00001, lng: -97.5 + 10 * 0.00001 },
    ];

    const result = extractBuildingHeightFromDSM(dsm, bounds, outline, -97.5);

    expect(result.heightFt).toBeGreaterThan(5);
    expect(result.heightFt).toBeLessThan(15);
    expect(result.estimatedStories).toBe(1);
    expect(result.roofElevationFt).toBeGreaterThan(result.groundElevationFt);
  });

  it('should extract height for a two-story building', () => {
    const dsm = createGeoDSM({
      width: 40,
      height: 40,
      elevationFn: (col, row) => {
        if (col >= 10 && col <= 30 && row >= 10 && row <= 30) return 16;
        return 10;
      },
    });

    const bounds = {
      sw: { lat: 35.5 - 30 * 0.00001, lng: -97.5 + 10 * 0.00001 },
      ne: { lat: 35.5 - 10 * 0.00001, lng: -97.5 + 30 * 0.00001 },
    };

    const outline: LatLng[] = [
      { lat: 35.5 - 10 * 0.00001, lng: -97.5 + 10 * 0.00001 },
      { lat: 35.5 - 10 * 0.00001, lng: -97.5 + 30 * 0.00001 },
      { lat: 35.5 - 30 * 0.00001, lng: -97.5 + 30 * 0.00001 },
      { lat: 35.5 - 30 * 0.00001, lng: -97.5 + 10 * 0.00001 },
    ];

    const result = extractBuildingHeightFromDSM(dsm, bounds, outline, -97.5);

    expect(result.heightFt).toBeGreaterThan(15);
    expect(result.heightFt).toBeLessThan(25);
    expect(result.estimatedStories).toBe(2);
  });

  it('should calculate ridge height', () => {
    const dsm = createGeoDSM({
      width: 40,
      height: 40,
      elevationFn: (col, row) => {
        if (col >= 10 && col <= 30 && row >= 10 && row <= 30) {
          // Ridge at col=20 is higher
          if (col === 20) return 16;
          return 13;
        }
        return 10;
      },
    });

    const bounds = {
      sw: { lat: 35.5 - 30 * 0.00001, lng: -97.5 + 10 * 0.00001 },
      ne: { lat: 35.5 - 10 * 0.00001, lng: -97.5 + 30 * 0.00001 },
    };

    const outline: LatLng[] = [
      { lat: 35.5 - 10 * 0.00001, lng: -97.5 + 10 * 0.00001 },
      { lat: 35.5 - 10 * 0.00001, lng: -97.5 + 30 * 0.00001 },
      { lat: 35.5 - 30 * 0.00001, lng: -97.5 + 30 * 0.00001 },
      { lat: 35.5 - 30 * 0.00001, lng: -97.5 + 10 * 0.00001 },
    ];

    const result = extractBuildingHeightFromDSM(dsm, bounds, outline, -97.5);

    // Ridge height should be >= building height (max roof - ground)
    expect(result.ridgeHeightFt).toBeGreaterThanOrEqual(result.heightFt);
  });

  it('should return defaults when no valid elevation data', () => {
    const dsm = createGeoDSM({
      width: 20,
      height: 20,
      elevationFn: () => 0, // All no-data
    });

    const bounds = {
      sw: { lat: 35.5 - 15 * 0.00001, lng: -97.5 + 5 * 0.00001 },
      ne: { lat: 35.5 - 5 * 0.00001, lng: -97.5 + 15 * 0.00001 },
    };

    const result = extractBuildingHeightFromDSM(dsm, bounds, undefined, -97.5);

    expect(result.heightFt).toBe(0);
    expect(result.ridgeHeightFt).toBe(0);
    expect(result.estimatedStories).toBe(1);
    expect(result.confidence).toBe('low');
  });

  it('should work with bounds only (no outline)', () => {
    const dsm = createGeoDSM({
      width: 40,
      height: 40,
      elevationFn: (col, row) => {
        if (col >= 10 && col <= 30 && row >= 10 && row <= 30) return 13;
        return 10;
      },
    });

    const bounds = {
      sw: { lat: 35.5 - 30 * 0.00001, lng: -97.5 + 10 * 0.00001 },
      ne: { lat: 35.5 - 10 * 0.00001, lng: -97.5 + 30 * 0.00001 },
    };

    const result = extractBuildingHeightFromDSM(dsm, bounds);

    expect(result.heightFt).toBeGreaterThan(0);
    expect(result.estimatedStories).toBeGreaterThanOrEqual(1);
  });

  it('should assign confidence based on sample count', () => {
    // Large building = many samples = high confidence
    const dsm = createGeoDSM({
      width: 100,
      height: 100,
      elevationFn: (col, row) => {
        if (col >= 10 && col <= 90 && row >= 10 && row <= 90) return 15;
        return 10;
      },
    });

    const bounds = {
      sw: { lat: 35.5 - 90 * 0.00001, lng: -97.5 + 10 * 0.00001 },
      ne: { lat: 35.5 - 10 * 0.00001, lng: -97.5 + 90 * 0.00001 },
    };

    const outline: LatLng[] = [
      { lat: 35.5 - 10 * 0.00001, lng: -97.5 + 10 * 0.00001 },
      { lat: 35.5 - 10 * 0.00001, lng: -97.5 + 90 * 0.00001 },
      { lat: 35.5 - 90 * 0.00001, lng: -97.5 + 90 * 0.00001 },
      { lat: 35.5 - 90 * 0.00001, lng: -97.5 + 10 * 0.00001 },
    ];

    const result = extractBuildingHeightFromDSM(dsm, bounds, outline, -97.5);

    expect(result.confidence).toBe('high');
  });

  it('should ensure estimatedStories >= 1', () => {
    // Very low building
    const dsm = createGeoDSM({
      width: 40,
      height: 40,
      elevationFn: (col, row) => {
        if (col >= 10 && col <= 30 && row >= 10 && row <= 30) return 10.5;
        return 10;
      },
    });

    const bounds = {
      sw: { lat: 35.5 - 30 * 0.00001, lng: -97.5 + 10 * 0.00001 },
      ne: { lat: 35.5 - 10 * 0.00001, lng: -97.5 + 30 * 0.00001 },
    };

    const result = extractBuildingHeightFromDSM(dsm, bounds, undefined, -97.5);

    expect(result.estimatedStories).toBeGreaterThanOrEqual(1);
  });
});
