/**
 * Unit tests for material estimation
 * Run with: npx vitest run tests/unit/materials.test.ts
 */

import { describe, it, expect } from 'vitest';
import { estimateMaterials } from '../../src/utils/materials';
import type { RoofMeasurement } from '../../src/types';

function createMeasurement(overrides: Partial<RoofMeasurement> = {}): RoofMeasurement {
  return {
    id: 'test',
    propertyId: 'prop1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    vertices: [],
    edges: [],
    facets: [],
    totalAreaSqFt: 2000,
    totalTrueAreaSqFt: 2200,
    totalSquares: 22,
    predominantPitch: 6,
    totalRidgeLf: 40,
    totalHipLf: 30,
    totalValleyLf: 20,
    totalRakeLf: 50,
    totalEaveLf: 80,
    totalFlashingLf: 15,
    totalDripEdgeLf: 130,
    suggestedWastePercent: 10,
    ...overrides,
  };
}

describe('estimateMaterials', () => {
  it('should calculate shingle bundles (3 per square + waste)', () => {
    const m = createMeasurement({ totalSquares: 20, suggestedWastePercent: 10 });
    const est = estimateMaterials(m);
    // 20 squares * 1.10 waste * 3 bundles = 66
    expect(est.shingleBundles).toBe(66);
  });

  it('should calculate underlayment rolls (~4 squares per roll)', () => {
    const m = createMeasurement({ totalSquares: 20, suggestedWastePercent: 10 });
    const est = estimateMaterials(m);
    // 20 * 1.10 / 4 = 5.5 → ceil = 6
    expect(est.underlaymentRolls).toBe(6);
  });

  it('should calculate ice & water shield from eave length', () => {
    const m = createMeasurement({ totalEaveLf: 100, suggestedWastePercent: 10 });
    const est = estimateMaterials(m);
    // 100 * 1.10 / 66.7 = 1.65 → ceil = 2
    expect(est.iceWaterRolls).toBe(2);
  });

  it('should calculate starter strip from eave + rake', () => {
    const m = createMeasurement({ totalEaveLf: 80, totalRakeLf: 50, suggestedWastePercent: 10 });
    const est = estimateMaterials(m);
    // (80 + 50) * 1.10 = 143 → ceil = 143
    expect(est.starterStripLf).toBe(143);
  });

  it('should calculate ridge cap from ridge + hip', () => {
    const m = createMeasurement({ totalRidgeLf: 40, totalHipLf: 30, suggestedWastePercent: 10 });
    const est = estimateMaterials(m);
    // (40 + 30) * 1.10 = 77 → ceil = 77
    expect(est.ridgeCapLf).toBe(77);
  });

  it('should calculate step flashing from flashing length', () => {
    const m = createMeasurement({ totalFlashingLf: 20, suggestedWastePercent: 10 });
    const est = estimateMaterials(m);
    // 20 * 1.10 = 22 → ceil = 22
    expect(est.stepFlashingPcs).toBe(22);
  });

  it('should estimate pipe boots from total area', () => {
    const m = createMeasurement({ totalTrueAreaSqFt: 3000 });
    const est = estimateMaterials(m);
    // 3000 / 1000 = 3
    expect(est.pipeBoots).toBe(3);
  });

  it('should ensure minimum 1 pipe boot', () => {
    const m = createMeasurement({ totalTrueAreaSqFt: 500 });
    const est = estimateMaterials(m);
    expect(est.pipeBoots).toBe(1);
  });

  it('should calculate nails from squares', () => {
    const m = createMeasurement({ totalSquares: 20, suggestedWastePercent: 10 });
    const est = estimateMaterials(m);
    // 20 * 1.10 * 1.75 = 38.5 → ceil = 39
    expect(est.nailsLbs).toBe(39);
  });

  it('should calculate ridge vent from ridge length', () => {
    const m = createMeasurement({ totalRidgeLf: 40, suggestedWastePercent: 10 });
    const est = estimateMaterials(m);
    // 40 * 1.10 = 44
    expect(est.ridgeVentLf).toBe(44);
  });

  it('should handle zero waste factor', () => {
    const m = createMeasurement({ totalSquares: 10, suggestedWastePercent: 0 });
    const est = estimateMaterials(m, 0);
    expect(est.shingleBundles).toBe(30); // 10 * 3 = 30
  });

  it('should handle higher waste factor', () => {
    const m = createMeasurement({ totalSquares: 10, suggestedWastePercent: 20 });
    const est = estimateMaterials(m, 20);
    expect(est.shingleBundles).toBe(36); // 10 * 1.20 * 3 = 36
  });

  it('should return zeros for empty measurement', () => {
    const m = createMeasurement({
      totalSquares: 0,
      totalAreaSqFt: 0,
      totalTrueAreaSqFt: 0,
      totalRidgeLf: 0,
      totalHipLf: 0,
      totalValleyLf: 0,
      totalRakeLf: 0,
      totalEaveLf: 0,
      totalFlashingLf: 0,
    });
    const est = estimateMaterials(m);
    expect(est.shingleBundles).toBe(0);
    expect(est.underlaymentRolls).toBe(0);
    expect(est.starterStripLf).toBe(0);
    expect(est.ridgeCapLf).toBe(0);
    expect(est.stepFlashingPcs).toBe(0);
    expect(est.ridgeVentLf).toBe(0);
  });

  it('should not return negative values for any material', () => {
    const m = createMeasurement();
    const est = estimateMaterials(m);
    for (const [, val] of Object.entries(est)) {
      expect(val).toBeGreaterThanOrEqual(0);
    }
  });
});
