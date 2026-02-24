/**
 * Acceptance: LIDAR Auto-Measure Workflow.
 * Tests the complete LIDAR-first pipeline end-to-end:
 *   LIDAR path → DSM analysis → store integration → verify outputs
 *   AI Vision fallback path → store integration → verify outputs
 *
 * Run with: npx vitest run tests/acceptance/lidarAutoMeasure.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../src/store/useStore';
import { resetStore, setupPropertyAndMeasurement } from '../helpers/store';
import {
  createReconstructedRoof,
  createHipRoofReconstructed,
} from '../helpers/fixtures';
import {
  fitPlane,
  triangleArea3D,
  analyzeFacetFromDSM,
  computeBuildingHeight,
} from '../../src/utils/dsmAnalysis';
import {
  clampPitch,
  degreesToPitch,
  adjustAreaForPitch,
} from '../../src/utils/geometry';
import type { ParsedDSM } from '../../src/types/solar';

// ─── DSM Test Helpers ───────────────────────────────────────────────

function createGeoDSM(
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

// ─── Acceptance: Complete LIDAR Path ────────────────────────────────

describe('Acceptance: LIDAR Auto-Measure Complete Workflow', () => {
  beforeEach(() => {
    resetStore();
    setupPropertyAndMeasurement();
  });

  it('should complete full LIDAR workflow: DSM → analysis → store', () => {
    // Step 1: Create DSM with known building (13m roof, 10m ground)
    const dsm = createGeoDSM(50, 50, (col, row) => {
      if (col >= 10 && col <= 40 && row >= 10 && row <= 40) return 13;
      return 10;
    });
    const outline = makeSquareFacet(10, 30);

    // Step 2: Compute building height from DSM
    const height = computeBuildingHeight(outline, dsm, -97.5);
    expect(height.heightFt).toBeGreaterThan(5);
    expect(height.stories).toBe(1);

    // Step 3: Create reconstructed roof with LIDAR metadata
    const roof = createReconstructedRoof();
    roof.dataSource = 'lidar-mask';
    roof.buildingHeight = height;
    roof.facets = roof.facets.map(f => ({
      ...f,
      trueArea3DSqFt: 600,
    }));

    // Step 4: Apply to store
    useStore.getState().applyAutoMeasurement(roof);

    // Step 5: Verify store state
    const m = useStore.getState().activeMeasurement!;
    expect(m.dataSource).toBe('lidar-mask');
    expect(m.buildingHeightFt).toBeGreaterThan(5);
    expect(m.stories).toBe(1);
    expect(m.facets[0].trueAreaSqFt).toBe(600);
    expect(m.facets[1].trueAreaSqFt).toBe(600);
    expect(m.totalAreaSqFt).toBeGreaterThan(0);
    expect(m.totalTrueAreaSqFt).toBeGreaterThan(0);
    expect(m.edges.length).toBeGreaterThan(0);
    expect(m.vertices.length).toBeGreaterThan(0);
  });

  it('should complete AI Vision fallback workflow without LIDAR data', () => {
    // Simulate AI Vision path (no LIDAR data available)
    const roof = createReconstructedRoof();
    roof.dataSource = 'ai-vision';
    // No buildingHeight, no trueArea3DSqFt

    useStore.getState().applyAutoMeasurement(roof);

    const m = useStore.getState().activeMeasurement!;
    expect(m.dataSource).toBe('ai-vision');
    expect(m.buildingHeightFt).toBeUndefined();
    expect(m.stories).toBeUndefined();

    // Should use pitch-adjusted area instead of DSM area
    for (const f of m.facets) {
      expect(f.trueAreaSqFt).toBeGreaterThan(f.areaSqFt);
    }
  });

  it('should track data source through full pipeline', () => {
    // LIDAR path
    const lidarRoof = createReconstructedRoof();
    lidarRoof.dataSource = 'lidar-mask';
    useStore.getState().applyAutoMeasurement(lidarRoof);
    expect(useStore.getState().activeMeasurement!.dataSource).toBe('lidar-mask');

    // Start fresh measurement
    resetStore();
    setupPropertyAndMeasurement();

    // AI Vision path
    const visionRoof = createReconstructedRoof();
    visionRoof.dataSource = 'ai-vision';
    useStore.getState().applyAutoMeasurement(visionRoof);
    expect(useStore.getState().activeMeasurement!.dataSource).toBe('ai-vision');
  });
});

// ─── Acceptance: DSM Area vs Pitch-Adjusted Area ────────────────────

describe('Acceptance: DSM 3D area preference over pitch-adjusted area', () => {
  beforeEach(() => {
    resetStore();
    setupPropertyAndMeasurement();
  });

  it('should use DSM 3D area when provided and > 0', () => {
    const roof = createReconstructedRoof();
    roof.facets = roof.facets.map((f, i) => ({
      ...f,
      pitch: 6,
      trueArea3DSqFt: 750 + i * 50,
    }));

    useStore.getState().applyAutoMeasurement(roof);
    const m = useStore.getState().activeMeasurement!;

    expect(m.facets[0].trueAreaSqFt).toBe(750);
    expect(m.facets[1].trueAreaSqFt).toBe(800);
  });

  it('should fall back to pitch-adjusted area when trueArea3DSqFt is 0', () => {
    const roof = createReconstructedRoof();
    roof.facets = roof.facets.map(f => ({
      ...f,
      pitch: 6,
      trueArea3DSqFt: 0,
    }));

    useStore.getState().applyAutoMeasurement(roof);
    const m = useStore.getState().activeMeasurement!;

    for (const f of m.facets) {
      // Pitch-adjusted area should be > flat area for pitch 6
      expect(f.trueAreaSqFt).toBeGreaterThan(f.areaSqFt);
    }
  });

  it('should fall back to pitch-adjusted area when trueArea3DSqFt is undefined', () => {
    const roof = createReconstructedRoof();
    // No trueArea3DSqFt set (default path)

    useStore.getState().applyAutoMeasurement(roof);
    const m = useStore.getState().activeMeasurement!;

    for (const f of m.facets) {
      expect(f.trueAreaSqFt).toBeGreaterThan(f.areaSqFt);
    }
  });
});

// ─── Acceptance: Building Height + Stories ──────────────────────────

describe('Acceptance: Building height and stories from LIDAR', () => {
  beforeEach(() => {
    resetStore();
    setupPropertyAndMeasurement();
  });

  it('should store 1-story building data', () => {
    const roof = createReconstructedRoof();
    roof.buildingHeight = {
      heightFt: 10.5,
      stories: 1,
      hasParapet: false,
      parapetHeightFt: 0,
    };

    useStore.getState().applyAutoMeasurement(roof);
    const m = useStore.getState().activeMeasurement!;

    expect(m.buildingHeightFt).toBe(10.5);
    expect(m.stories).toBe(1);
  });

  it('should store 2-story building data', () => {
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

  it('should store commercial building with parapet', () => {
    const roof = createReconstructedRoof();
    roof.buildingHeight = {
      heightFt: 35.2,
      stories: 3,
      hasParapet: true,
      parapetHeightFt: 3.5,
    };

    useStore.getState().applyAutoMeasurement(roof);
    const m = useStore.getState().activeMeasurement!;

    expect(m.buildingHeightFt).toBe(35.2);
    expect(m.stories).toBe(3);
  });

  it('should not set height/stories when buildingHeight is undefined', () => {
    const roof = createReconstructedRoof();
    // No buildingHeight set

    useStore.getState().applyAutoMeasurement(roof);
    const m = useStore.getState().activeMeasurement!;

    expect(m.buildingHeightFt).toBeUndefined();
    expect(m.stories).toBeUndefined();
  });
});

// ─── Acceptance: Pitch Capping in LIDAR Pipeline ────────────────────

describe('Acceptance: Pitch cap enforced in LIDAR pipeline', () => {
  beforeEach(() => {
    resetStore();
    setupPropertyAndMeasurement();
  });

  it('should produce valid measurements even with extreme DSM pitch', () => {
    // DSM reports extreme slope
    const extremePitch = degreesToPitch(75);
    const cappedPitch = clampPitch(extremePitch);
    expect(cappedPitch).toBe(24);

    const roof = createReconstructedRoof();
    roof.facets = roof.facets.map(f => ({
      ...f,
      pitch: cappedPitch,
    }));

    useStore.getState().applyAutoMeasurement(roof);
    const m = useStore.getState().activeMeasurement!;

    for (const f of m.facets) {
      expect(f.pitch).toBe(24);
      // Area multiplier at 24/12 = sqrt(5) ≈ 2.236
      const ratio = f.trueAreaSqFt / f.areaSqFt;
      expect(ratio).toBeCloseTo(Math.sqrt(5), 1);
    }
  });

  it('should merge Solar + DSM pitch correctly', () => {
    // Simulate the merge logic from useAutoMeasure.ts
    const solarPitchDeg = 22; // Solar says 22 degrees
    const dsmPitchDeg = 25;   // DSM says 25 degrees
    const avgDeg = (solarPitchDeg + dsmPitchDeg) / 2; // 23.5
    const mergedPitch = clampPitch(degreesToPitch(avgDeg));

    // tan(23.5°)*12 ≈ 5.22
    expect(mergedPitch).toBeGreaterThan(4);
    expect(mergedPitch).toBeLessThanOrEqual(24);

    const roof = createReconstructedRoof();
    roof.facets = roof.facets.map(f => ({
      ...f,
      pitch: mergedPitch,
    }));

    useStore.getState().applyAutoMeasurement(roof);
    const m = useStore.getState().activeMeasurement!;
    expect(m.facets[0].pitch).toBe(mergedPitch);
    expect(m.totalTrueAreaSqFt).toBeGreaterThan(m.totalAreaSqFt);
  });
});

// ─── Acceptance: Full Hip Roof LIDAR Workflow ───────────────────────

describe('Acceptance: Hip roof LIDAR workflow', () => {
  beforeEach(() => {
    resetStore();
    setupPropertyAndMeasurement();
  });

  it('should handle hip roof with 4 facets and LIDAR metadata', () => {
    const roof = createHipRoofReconstructed();
    roof.dataSource = 'lidar-mask';
    roof.buildingHeight = {
      heightFt: 15.0,
      stories: 1,
      hasParapet: false,
      parapetHeightFt: 0,
    };
    roof.facets = roof.facets.map((f, i) => ({
      ...f,
      pitch: 6,
      trueArea3DSqFt: 400 + i * 50,
    }));

    useStore.getState().applyAutoMeasurement(roof);
    const m = useStore.getState().activeMeasurement!;

    // Verify all 4 hip facets stored
    expect(m.facets.length).toBe(4);
    expect(m.dataSource).toBe('lidar-mask');
    expect(m.buildingHeightFt).toBe(15.0);
    expect(m.stories).toBe(1);

    // DSM 3D areas used
    expect(m.facets[0].trueAreaSqFt).toBe(400);
    expect(m.facets[1].trueAreaSqFt).toBe(450);
    expect(m.facets[2].trueAreaSqFt).toBe(500);
    expect(m.facets[3].trueAreaSqFt).toBe(550);

    // Edge type totals populated
    expect(m.totalEaveLf).toBeGreaterThan(0);
    expect(m.totalHipLf).toBeGreaterThan(0);
    expect(m.totalRidgeLf).toBeGreaterThan(0);

    // Total areas
    expect(m.totalAreaSqFt).toBeGreaterThan(0);
    expect(m.totalTrueAreaSqFt).toBe(400 + 450 + 500 + 550);
  });

  it('should allow editing after LIDAR auto-detect', () => {
    const roof = createHipRoofReconstructed();
    roof.dataSource = 'lidar-mask';
    useStore.getState().applyAutoMeasurement(roof);

    // Should be able to update edge types
    const edgeId = useStore.getState().activeMeasurement!.edges[0].id;
    useStore.getState().updateEdgeType(edgeId, 'valley');
    expect(useStore.getState().activeMeasurement!.totalValleyLf).toBeGreaterThan(0);

    // Should be able to update pitch
    const facetId = useStore.getState().activeMeasurement!.facets[0].id;
    useStore.getState().updateFacetPitch(facetId, 8);
    expect(useStore.getState().activeMeasurement!.facets[0].pitch).toBe(8);
  });

  it('should support undo after LIDAR auto-detect', () => {
    const roof = createReconstructedRoof();
    roof.dataSource = 'lidar-mask';
    useStore.getState().applyAutoMeasurement(roof);

    expect(useStore.getState().activeMeasurement!.edges.length).toBeGreaterThan(0);
    expect(useStore.getState().activeMeasurement!.dataSource).toBe('lidar-mask');

    useStore.getState().undo();
    expect(useStore.getState().activeMeasurement!.edges).toHaveLength(0);
    // After undo, dataSource should revert
    expect(useStore.getState().activeMeasurement!.dataSource).toBeUndefined();
  });
});

// ─── Acceptance: DSM Pipeline Consistency ───────────────────────────

describe('Acceptance: DSM analysis → store consistency', () => {
  beforeEach(() => {
    resetStore();
    setupPropertyAndMeasurement();
  });

  it('should maintain area consistency: totalTrueArea = sum of facet trueAreas', () => {
    const roof = createHipRoofReconstructed();
    roof.facets = roof.facets.map((f, i) => ({
      ...f,
      trueArea3DSqFt: 300 + i * 100,
    }));

    useStore.getState().applyAutoMeasurement(roof);
    const m = useStore.getState().activeMeasurement!;

    const sumTrue = m.facets.reduce((s, f) => s + f.trueAreaSqFt, 0);
    expect(m.totalTrueAreaSqFt).toBeCloseTo(sumTrue, 1);
  });

  it('should maintain area consistency: totalArea = sum of facet flat areas', () => {
    const roof = createHipRoofReconstructed();
    useStore.getState().applyAutoMeasurement(roof);
    const m = useStore.getState().activeMeasurement!;

    const sumFlat = m.facets.reduce((s, f) => s + f.areaSqFt, 0);
    expect(m.totalAreaSqFt).toBeCloseTo(sumFlat, 1);
  });

  it('should compute totalSquares from totalTrueAreaSqFt', () => {
    const roof = createReconstructedRoof();
    roof.facets = roof.facets.map(f => ({
      ...f,
      trueArea3DSqFt: 500, // 500 sqft per facet = 1000 total
    }));

    useStore.getState().applyAutoMeasurement(roof);
    const m = useStore.getState().activeMeasurement!;

    // 1000 sqft / 100 = 10 squares
    expect(m.totalSquares).toBeCloseTo(10, 0);
  });

  it('drawing state should be correct after LIDAR apply', () => {
    const roof = createReconstructedRoof();
    roof.dataSource = 'lidar-mask';
    useStore.getState().applyAutoMeasurement(roof);

    expect(useStore.getState().drawingMode).toBe('select');
    expect(useStore.getState().isDrawingOutline).toBe(false);
    expect(useStore.getState().edgeStartVertexId).toBeNull();
    expect(useStore.getState().selectedVertexId).toBeNull();
  });
});
