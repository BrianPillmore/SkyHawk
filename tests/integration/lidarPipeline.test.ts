/**
 * Integration tests for the LIDAR Data Layers pipeline.
 * Tests the full flow: DSM parsing → plane fit → pitch → area → building height → store.
 * No network mocks — tests real geometry/math pipeline with synthetic GeoTIFF data.
 *
 * Run with: npx vitest run tests/integration/lidarPipeline.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../src/store/useStore';
import { resetStore, setupPropertyAndMeasurement } from '../helpers/store';
import { createReconstructedRoof } from '../helpers/fixtures';
import {
  fitPlane,
  triangleArea3D,
  analyzeFacetFromDSM,
  computeBuildingHeight,
} from '../../src/utils/dsmAnalysis';
import { clampPitch, degreesToPitch, adjustAreaForPitch } from '../../src/utils/geometry';
import type { ParsedDSM, GeoTiffAffine, DsmFacetAnalysis, BuildingHeightAnalysis } from '../../src/types/solar';

// ─── DSM Helper ───

function makeDSM(
  width: number,
  height: number,
  fn: (col: number, row: number) => number,
  pixelSize = 0.00001,
): ParsedDSM {
  const data = new Float32Array(width * height);
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      data[r * width + c] = fn(c, r);
    }
  }
  return {
    data,
    width,
    height,
    affine: { originX: -97.5, originY: 35.5, pixelWidth: pixelSize, pixelHeight: -pixelSize },
  };
}

function makeSquareFacet(margin: number, size: number, pixelSize = 0.00001) {
  return [
    { lat: 35.5 - margin * pixelSize, lng: -97.5 + margin * pixelSize },
    { lat: 35.5 - margin * pixelSize, lng: -97.5 + (margin + size) * pixelSize },
    { lat: 35.5 - (margin + size) * pixelSize, lng: -97.5 + (margin + size) * pixelSize },
    { lat: 35.5 - (margin + size) * pixelSize, lng: -97.5 + margin * pixelSize },
  ];
}

// ─── Integration: DSM → Plane Fit → Pitch ───

describe('LIDAR Pipeline: DSM → Pitch Integration', () => {
  it('should compute consistent pitch through the full pipeline', () => {
    // Create a tilted surface: z = 10 + col * 0.01
    const dsm = makeDSM(100, 100, (col) => 10 + col * 0.01);
    const facet = makeSquareFacet(20, 60);

    const analysis = analyzeFacetFromDSM(facet, dsm, -97.5);

    // Verify pipeline produces valid results
    expect(analysis.sampleCount).toBeGreaterThan(100);
    expect(analysis.pitchDegrees).toBeGreaterThan(0);
    expect(analysis.pitchDegrees).toBeLessThan(90);
    expect(analysis.avgElevationMeters).toBeGreaterThan(10);
    expect(analysis.trueAreaSqFt3D).toBeGreaterThan(0);
  });

  it('should produce DSM pitch consistent with clampPitch', () => {
    // 75-degree slope via high gradient
    const dsm = makeDSM(100, 100, (col) => 10 + col * 100);
    const facet = makeSquareFacet(20, 60);

    const analysis = analyzeFacetFromDSM(facet, dsm, -97.5);
    const dsmPitch = degreesToPitch(analysis.pitchDegrees);
    const clamped = clampPitch(Math.round(dsmPitch * 10) / 10);

    // Clamped pitch should be <= 24
    expect(clamped).toBeLessThanOrEqual(24);
    expect(clamped).toBeGreaterThanOrEqual(0);
  });
});

// ─── Integration: DSM → Building Height ───

describe('LIDAR Pipeline: DSM → Building Height Integration', () => {
  it('should compute height from elevation difference', () => {
    // Building: 13m, ground: 10m → ~3m ≈ 10ft
    const dsm = makeDSM(50, 50, (col, row) => {
      if (col >= 10 && col <= 40 && row >= 10 && row <= 40) return 13;
      return 10;
    });
    const outline = makeSquareFacet(10, 30);

    const height = computeBuildingHeight(outline, dsm, -97.5);
    expect(height.heightFt).toBeGreaterThan(5);
    expect(height.heightFt).toBeLessThan(15);
    expect(height.stories).toBe(1);
  });
});

// ─── Integration: LIDAR Metadata → Store ───

describe('LIDAR Pipeline: Metadata → Store Integration', () => {
  beforeEach(() => {
    resetStore();
    setupPropertyAndMeasurement();
  });

  it('should store dataSource from reconstructed roof', () => {
    const roof = createReconstructedRoof();
    roof.dataSource = 'lidar-mask';
    useStore.getState().applyAutoMeasurement(roof);

    const m = useStore.getState().activeMeasurement!;
    expect(m.dataSource).toBe('lidar-mask');
  });

  it('should store ai-vision dataSource when LIDAR unavailable', () => {
    const roof = createReconstructedRoof();
    roof.dataSource = 'ai-vision';
    useStore.getState().applyAutoMeasurement(roof);

    const m = useStore.getState().activeMeasurement!;
    expect(m.dataSource).toBe('ai-vision');
  });

  it('should store building height from LIDAR analysis', () => {
    const roof = createReconstructedRoof();
    roof.buildingHeight = {
      heightFt: 12.5,
      stories: 1,
      hasParapet: false,
      parapetHeightFt: 0,
    };
    useStore.getState().applyAutoMeasurement(roof);

    const m = useStore.getState().activeMeasurement!;
    expect(m.buildingHeightFt).toBe(12.5);
    expect(m.stories).toBe(1);
  });

  it('should store multi-story building height', () => {
    const roof = createReconstructedRoof();
    roof.buildingHeight = {
      heightFt: 22.3,
      stories: 2,
      hasParapet: false,
      parapetHeightFt: 0,
    };
    useStore.getState().applyAutoMeasurement(roof);

    const m = useStore.getState().activeMeasurement!;
    expect(m.buildingHeightFt).toBe(22.3);
    expect(m.stories).toBe(2);
  });

  it('should prefer DSM 3D area over pitch-adjusted area when available', () => {
    const roof = createReconstructedRoof();
    // Set trueArea3DSqFt on facets (LIDAR 3D mesh area)
    roof.facets = roof.facets.map((f, i) => ({
      ...f,
      trueArea3DSqFt: 600 + i * 50, // 600 and 650 sqft
    }));

    useStore.getState().applyAutoMeasurement(roof);

    const m = useStore.getState().activeMeasurement!;
    // The store should use DSM 3D area, not pitch-adjusted area
    expect(m.facets[0].trueAreaSqFt).toBe(600);
    expect(m.facets[1].trueAreaSqFt).toBe(650);
  });

  it('should fall back to pitch-adjusted area when trueArea3DSqFt is 0', () => {
    const roof = createReconstructedRoof();
    roof.facets = roof.facets.map(f => ({
      ...f,
      trueArea3DSqFt: 0, // No DSM data
    }));

    useStore.getState().applyAutoMeasurement(roof);

    const m = useStore.getState().activeMeasurement!;
    // Should use pitch-adjusted area (trueArea > flatArea for pitch 6)
    for (const f of m.facets) {
      expect(f.trueAreaSqFt).toBeGreaterThan(f.areaSqFt);
    }
  });

  it('should not store height/stories when buildingHeight is undefined', () => {
    const roof = createReconstructedRoof();
    // No buildingHeight set (AI Vision path)
    useStore.getState().applyAutoMeasurement(roof);

    const m = useStore.getState().activeMeasurement!;
    expect(m.buildingHeightFt).toBeUndefined();
    expect(m.stories).toBeUndefined();
  });
});

// ─── Integration: Plane Fit → Triangle Area Cross-Validation ───

describe('LIDAR Pipeline: Plane Fit + Triangle Area Consistency', () => {
  it('should compute consistent 3D area from plane slope and triangles', () => {
    // Create a plane with known slope: z = 0.5x + 2
    const points = [];
    for (let x = 0; x <= 10; x += 0.5) {
      for (let y = 0; y <= 10; y += 0.5) {
        points.push({ x, y, z: 0.5 * x + 2 });
      }
    }

    const [a, b] = fitPlane(points);
    const slope = Math.sqrt(a * a + b * b);
    const pitchDeg = Math.atan(slope) * (180 / Math.PI);

    // For a 10x10 flat area with slope 0.5:
    // 3D area = flat_area * sqrt(1 + slope²) = 100 * sqrt(1.25) ≈ 111.8
    const flatArea = 10 * 10;
    const expected3DFactor = Math.sqrt(1 + slope * slope);

    // Triangle area should reflect the same factor
    const triFlat = triangleArea3D(
      { x: 0, y: 0, z: 2 },
      { x: 1, y: 0, z: 2.5 },
      { x: 0, y: 1, z: 2 }
    );
    const triExpected = 0.5 * expected3DFactor;

    expect(triFlat).toBeCloseTo(triExpected, 3);
    expect(pitchDeg).toBeCloseTo(26.57, 0); // atan(0.5) ≈ 26.57°
  });
});
