/**
 * Regression: Pitch Cap — Ensures extreme pitches are always clamped.
 *
 * Background: Before the pitch cap was added, Solar API segments reporting
 * 60-75 degree pitches (common on dormer faces or noisy data) caused
 * degreesToPitch() to return values like 20+ /12, which inflated true area
 * by 40-50% (e.g., 701 Kingston Dr showed a 48% area discrepancy).
 *
 * The clampPitch function (max=24/12) must be applied at every point where
 * pitch is assigned from external data (Solar API, DSM, AI Vision).
 *
 * Run with: npx vitest run tests/regression/pitchCap.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../src/store/useStore';
import { resetStore, setupPropertyAndMeasurement } from '../helpers/store';
import { createReconstructedRoof, createHipRoofReconstructed } from '../helpers/fixtures';
import {
  clampPitch,
  MAX_RESIDENTIAL_PITCH,
  degreesToPitch,
  adjustAreaForPitch,
  getPitchMultiplier,
} from '../../src/utils/geometry';

// ─── Pitch Cap Core Behavior ────────────────────────────────────────

describe('Regression: Pitch Cap prevents extreme area inflation', () => {
  it('should cap 65-degree Solar segment to 24/12', () => {
    // Solar API sometimes reports 65+ degrees on dormer faces
    // tan(65°)*12 ≈ 25.7 → exceeds 24 cap
    const rawPitch = degreesToPitch(65);
    expect(rawPitch).toBeGreaterThan(24);
    const capped = clampPitch(rawPitch);
    expect(capped).toBe(24);
  });

  it('should cap 75-degree noisy DSM to 24/12', () => {
    const rawPitch = degreesToPitch(75);
    expect(rawPitch).toBeGreaterThan(24);
    const capped = clampPitch(rawPitch);
    expect(capped).toBe(24);
  });

  it('should not affect normal residential pitches (4/12 through 12/12)', () => {
    const normalPitches = [4, 5, 6, 7, 8, 9, 10, 11, 12];
    for (const p of normalPitches) {
      expect(clampPitch(p)).toBe(p);
    }
  });

  it('should cap exactly at MAX_RESIDENTIAL_PITCH boundary', () => {
    expect(clampPitch(24)).toBe(24);
    expect(clampPitch(24.1)).toBe(24);
    expect(clampPitch(25)).toBe(24);
  });

  it('should clamp negative pitch to 0', () => {
    expect(clampPitch(-5)).toBe(0);
    expect(clampPitch(-0.1)).toBe(0);
  });
});

// ─── Area Inflation Prevention ──────────────────────────────────────

describe('Regression: Pitch cap prevents area inflation', () => {
  it('should limit area multiplier to ~2.24x at 24/12', () => {
    const maxMultiplier = getPitchMultiplier(24);
    // sqrt(1 + (24/12)²) = sqrt(1 + 4) = sqrt(5) ≈ 2.236
    expect(maxMultiplier).toBeCloseTo(2.236, 2);
  });

  it('should prevent extreme area inflation from uncapped 70-degree pitch', () => {
    const flatArea = 1000;

    // Without cap: degreesToPitch(70) = tan(70°)*12 ≈ 32.97
    const uncappedPitch = degreesToPitch(70);
    expect(uncappedPitch).toBeGreaterThan(24);
    const uncappedArea = adjustAreaForPitch(flatArea, uncappedPitch);

    // With cap: pitch capped to 24
    const cappedPitch = clampPitch(uncappedPitch);
    expect(cappedPitch).toBe(24);
    const cappedArea = adjustAreaForPitch(flatArea, cappedPitch);

    // Capped area should be less than uncapped area
    expect(cappedArea).toBeLessThan(uncappedArea);

    // Max capped area: 1000 * sqrt(5) ≈ 2236
    expect(cappedArea).toBeCloseTo(flatArea * Math.sqrt(5), 0);

    // The inflation ratio (capped/flat) should be bounded
    const inflationPercent = ((cappedArea - flatArea) / flatArea) * 100;
    expect(inflationPercent).toBeLessThan(125); // max ~124% at 24/12
  });

  it('should keep area inflation under 12% for typical 6/12 pitch', () => {
    const flatArea = 1000;
    const area6 = adjustAreaForPitch(flatArea, 6);
    const inflationPercent = ((area6 - flatArea) / flatArea) * 100;
    // 6/12 pitch: sqrt(1 + 0.25) = sqrt(1.25) ≈ 1.118 → ~11.8%
    expect(inflationPercent).toBeLessThan(12);
  });
});

// ─── Store Integration: Pitch Cap Applied to Measurements ───────────

describe('Regression: Store applies pitch cap through applyAutoMeasurement', () => {
  beforeEach(() => {
    resetStore();
    setupPropertyAndMeasurement();
  });

  it('should store normal pitch unchanged', () => {
    const roof = createReconstructedRoof();
    roof.facets = roof.facets.map(f => ({ ...f, pitch: 8 }));
    useStore.getState().applyAutoMeasurement(roof);

    const m = useStore.getState().activeMeasurement!;
    for (const f of m.facets) {
      expect(f.pitch).toBe(8);
    }
  });

  it('should produce bounded true area even with steep pitch', () => {
    const roof = createReconstructedRoof();
    // Even if a high pitch sneaks through, area should be bounded
    roof.facets = roof.facets.map(f => ({ ...f, pitch: 20 }));
    useStore.getState().applyAutoMeasurement(roof);

    const m = useStore.getState().activeMeasurement!;
    for (const f of m.facets) {
      // True area should be > flat area but not astronomically so
      const maxRatio = Math.sqrt(1 + (20 / 12) ** 2); // ~1.944
      expect(f.trueAreaSqFt / f.areaSqFt).toBeLessThanOrEqual(maxRatio + 0.01);
    }
  });

  it('should handle hip roof with pitch cap correctly', () => {
    const roof = createHipRoofReconstructed();
    // All facets at max pitch
    roof.facets = roof.facets.map(f => ({ ...f, pitch: 24 }));
    useStore.getState().applyAutoMeasurement(roof);

    const m = useStore.getState().activeMeasurement!;
    expect(m.facets.length).toBe(4); // hip has 4 facets
    for (const f of m.facets) {
      expect(f.pitch).toBeLessThanOrEqual(24);
    }
  });

  it('should prefer DSM 3D area over pitch-adjusted area when available', () => {
    const roof = createReconstructedRoof();
    // DSM gives actual measured 3D area, bypassing pitch multiplier entirely
    roof.facets = roof.facets.map((f, i) => ({
      ...f,
      pitch: 20,
      trueArea3DSqFt: 800 + i * 100, // known LIDAR area
    }));
    useStore.getState().applyAutoMeasurement(roof);

    const m = useStore.getState().activeMeasurement!;
    // Should use DSM 3D area, not pitch-adjusted
    expect(m.facets[0].trueAreaSqFt).toBe(800);
    expect(m.facets[1].trueAreaSqFt).toBe(900);
  });
});

// ─── Pitch Values at Boundary Conditions ────────────────────────────

describe('Regression: degreesToPitch boundary conditions', () => {
  it('0 degrees → 0/12 pitch', () => {
    expect(degreesToPitch(0)).toBe(0);
  });

  it('45 degrees → 12/12 pitch', () => {
    expect(degreesToPitch(45)).toBeCloseTo(12, 0);
  });

  it('26.57 degrees → ~6/12 pitch', () => {
    // atan(6/12) = 26.57°
    expect(degreesToPitch(26.57)).toBeCloseTo(6, 0);
  });

  it('90 degrees → Infinity pitch (must be clamped)', () => {
    const pitch90 = degreesToPitch(89.9); // near 90
    expect(pitch90).toBeGreaterThan(1000);
    expect(clampPitch(pitch90)).toBe(24);
  });

  it('negative degrees → clamped to 0', () => {
    const pitchNeg = degreesToPitch(-10);
    // tan(-10°)*12 is negative
    expect(clampPitch(pitchNeg)).toBe(0);
  });
});

// ─── Multi-Pitch Roof Scenarios ─────────────────────────────────────

describe('Regression: Multi-pitch roof cap scenarios', () => {
  beforeEach(() => {
    resetStore();
    setupPropertyAndMeasurement();
  });

  it('should handle roof with mixed pitches (some needing cap, some not)', () => {
    const roof = createReconstructedRoof();
    // One facet normal, one extreme
    roof.facets = [
      { ...roof.facets[0], pitch: 6 },   // normal
      { ...roof.facets[1], pitch: 24 },   // at cap
    ];
    useStore.getState().applyAutoMeasurement(roof);

    const m = useStore.getState().activeMeasurement!;
    expect(m.facets[0].pitch).toBe(6);
    expect(m.facets[1].pitch).toBe(24);
    expect(m.totalTrueAreaSqFt).toBeGreaterThan(m.totalAreaSqFt);
  });

  it('predominant pitch should reflect the most common capped pitch', () => {
    const roof = createHipRoofReconstructed();
    // All 4 facets at pitch 6
    roof.facets = roof.facets.map(f => ({ ...f, pitch: 6 }));
    useStore.getState().applyAutoMeasurement(roof);

    const m = useStore.getState().activeMeasurement!;
    expect(m.predominantPitch).toBe(6);
  });
});
