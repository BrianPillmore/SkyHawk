/**
 * Smoke Tests — LIDAR Systems.
 * Quick sanity checks that all LIDAR modules load, export correctly,
 * and return valid types. No mocks required. (<5 seconds)
 *
 * Run with: npx vitest run tests/smoke/lidarSystems.test.ts
 */
import { describe, it, expect } from 'vitest';

// ─── Module Imports (verify no circular deps or missing exports) ────

import {
  fitPlane,
  triangleArea3D,
  median,
  analyzeFacetFromDSM,
  computeBuildingHeight,
} from '../../src/utils/dsmAnalysis';

import {
  clampPitch,
  MAX_RESIDENTIAL_PITCH,
  degreesToPitch,
  adjustAreaForPitch,
} from '../../src/utils/geometry';

import { latLngToPixel } from '../../src/utils/contour';

import type {
  ParsedDSM,
  DsmFacetAnalysis,
  BuildingHeightAnalysis,
  GeoTiffAffine,
} from '../../src/types/solar';

// ─── DSM Analysis Module Exports ────────────────────────────────────

describe('LIDAR Smoke: dsmAnalysis module exports', () => {
  it('fitPlane is a function', () => {
    expect(typeof fitPlane).toBe('function');
  });

  it('triangleArea3D is a function', () => {
    expect(typeof triangleArea3D).toBe('function');
  });

  it('median is a function', () => {
    expect(typeof median).toBe('function');
  });

  it('analyzeFacetFromDSM is a function', () => {
    expect(typeof analyzeFacetFromDSM).toBe('function');
  });

  it('computeBuildingHeight is a function', () => {
    expect(typeof computeBuildingHeight).toBe('function');
  });
});

// ─── Geometry Module LIDAR Exports ──────────────────────────────────

describe('LIDAR Smoke: geometry module exports', () => {
  it('clampPitch is a function', () => {
    expect(typeof clampPitch).toBe('function');
  });

  it('MAX_RESIDENTIAL_PITCH is 24', () => {
    expect(MAX_RESIDENTIAL_PITCH).toBe(24);
  });

  it('degreesToPitch is a function', () => {
    expect(typeof degreesToPitch).toBe('function');
  });

  it('adjustAreaForPitch is a function', () => {
    expect(typeof adjustAreaForPitch).toBe('function');
  });

  it('latLngToPixel is a function', () => {
    expect(typeof latLngToPixel).toBe('function');
  });
});

// ─── Basic Return Types ─────────────────────────────────────────────

describe('LIDAR Smoke: basic return types', () => {
  it('fitPlane returns [a, b, c] tuple', () => {
    const result = fitPlane([
      { x: 0, y: 0, z: 1 },
      { x: 1, y: 0, z: 1 },
      { x: 0, y: 1, z: 1 },
    ]);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(3);
    expect(typeof result[0]).toBe('number');
    expect(typeof result[1]).toBe('number');
    expect(typeof result[2]).toBe('number');
  });

  it('triangleArea3D returns a non-negative number', () => {
    const result = triangleArea3D(
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    );
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('median returns a number', () => {
    const result = median([5, 3, 1, 4, 2]);
    expect(typeof result).toBe('number');
    expect(result).toBe(3);
  });

  it('clampPitch returns a number within range', () => {
    const result = clampPitch(30);
    expect(typeof result).toBe('number');
    expect(result).toBeLessThanOrEqual(MAX_RESIDENTIAL_PITCH);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('degreesToPitch returns a number', () => {
    const result = degreesToPitch(22);
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThan(0);
  });
});

// ─── ParsedDSM Type Structure ───────────────────────────────────────

describe('LIDAR Smoke: ParsedDSM structure', () => {
  function makeMinimalDSM(): ParsedDSM {
    return {
      data: new Float32Array([10, 10, 10, 10]),
      width: 2,
      height: 2,
      affine: { originX: -97.5, originY: 35.5, pixelWidth: 0.00001, pixelHeight: -0.00001 },
    };
  }

  it('ParsedDSM can be constructed with correct shape', () => {
    const dsm = makeMinimalDSM();
    expect(dsm.data).toBeInstanceOf(Float32Array);
    expect(dsm.width).toBe(2);
    expect(dsm.height).toBe(2);
    expect(dsm.affine).toHaveProperty('originX');
    expect(dsm.affine).toHaveProperty('originY');
    expect(dsm.affine).toHaveProperty('pixelWidth');
    expect(dsm.affine).toHaveProperty('pixelHeight');
  });

  it('analyzeFacetFromDSM returns DsmFacetAnalysis shape on insufficient data', () => {
    const dsm = makeMinimalDSM();
    // Facet outside DSM bounds → no samples
    const result = analyzeFacetFromDSM(
      [{ lat: 50, lng: -50 }, { lat: 50.001, lng: -50 }, { lat: 50, lng: -49.999 }],
      dsm,
      -50,
    );
    expect(result).toHaveProperty('pitchDegrees');
    expect(result).toHaveProperty('azimuthDegrees');
    expect(result).toHaveProperty('trueAreaSqFt3D');
    expect(result).toHaveProperty('avgElevationMeters');
    expect(result).toHaveProperty('sampleCount');
    expect(result.sampleCount).toBe(0);
  });

  it('computeBuildingHeight returns BuildingHeightAnalysis shape', () => {
    const dsm = makeMinimalDSM();
    const result = computeBuildingHeight(
      [{ lat: 35.5, lng: -97.5 }, { lat: 35.4999, lng: -97.4999 }],
      dsm,
      -97.5,
    );
    expect(result).toHaveProperty('heightFt');
    expect(result).toHaveProperty('stories');
    expect(result).toHaveProperty('hasParapet');
    expect(result).toHaveProperty('parapetHeightFt');
    expect(typeof result.heightFt).toBe('number');
    expect(typeof result.stories).toBe('number');
    expect(typeof result.hasParapet).toBe('boolean');
  });
});

// ─── Store LIDAR Actions Exist ──────────────────────────────────────

describe('LIDAR Smoke: store has applyAutoMeasurement', () => {
  it('applyAutoMeasurement exists on store', async () => {
    const { useStore } = await import('../../src/store/useStore');
    expect(typeof useStore.getState().applyAutoMeasurement).toBe('function');
  });
});

// ─── Cross-Module Wiring ────────────────────────────────────────────

describe('LIDAR Smoke: cross-module wiring', () => {
  it('degreesToPitch → clampPitch pipeline returns valid pitch', () => {
    const degrees = 45; // steep
    const rawPitch = degreesToPitch(degrees);
    const clamped = clampPitch(rawPitch);
    expect(clamped).toBeLessThanOrEqual(24);
    expect(clamped).toBeGreaterThanOrEqual(0);
  });

  it('clampPitch → adjustAreaForPitch pipeline returns valid area', () => {
    const pitch = clampPitch(30); // clamped to 24
    const area = adjustAreaForPitch(1000, pitch);
    expect(area).toBeGreaterThanOrEqual(1000);
  });

  it('fitPlane + triangleArea3D produce consistent results', () => {
    // Flat plane: z = 5
    const points = [];
    for (let x = 0; x <= 5; x++) {
      for (let y = 0; y <= 5; y++) {
        points.push({ x, y, z: 5 });
      }
    }
    const [a, b, c] = fitPlane(points);
    expect(Math.abs(a)).toBeLessThan(0.001);
    expect(Math.abs(b)).toBeLessThan(0.001);
    expect(c).toBeCloseTo(5, 1);

    // Triangle on flat plane
    const triArea = triangleArea3D(
      { x: 0, y: 0, z: 5 },
      { x: 1, y: 0, z: 5 },
      { x: 0, y: 1, z: 5 },
    );
    expect(triArea).toBeCloseTo(0.5, 3);
  });
});
