/**
 * Extended unit tests for material estimation and formatting
 * Covers edge cases not addressed in materials.test.ts
 * Run with: npx vitest run tests/unit/materials-extended.test.ts
 */

import { describe, it, expect } from 'vitest';
import { estimateMaterials, formatMaterialLine } from '../../src/utils/materials';
import type { RoofMeasurement } from '../../src/types';

function createMeasurement(overrides: Partial<RoofMeasurement> = {}): RoofMeasurement {
  return {
    id: 'test',
    propertyId: 'p1',
    createdAt: '',
    updatedAt: '',
    vertices: [],
    edges: [],
    facets: [],
    totalAreaSqFt: 2000,
    totalTrueAreaSqFt: 2200,
    totalSquares: 22,
    predominantPitch: 6,
    totalRidgeLf: 40,
    totalHipLf: 20,
    totalValleyLf: 10,
    totalRakeLf: 30,
    totalEaveLf: 60,
    totalFlashingLf: 50,
    totalDripEdgeLf: 90,
    suggestedWastePercent: 10,
    ...overrides,
  };
}

// ─── formatMaterialLine ────────────────────────────────────────────

describe('formatMaterialLine', () => {
  it('should format a basic material line correctly', () => {
    const result = formatMaterialLine(10, 'bundles', 'Roofing Shingles');
    expect(result).toBe('10 bundles — Roofing Shingles');
  });

  it('should format with singular unit', () => {
    const result = formatMaterialLine(1, 'roll', 'Underlayment');
    expect(result).toBe('1 roll — Underlayment');
  });

  it('should format with large quantity', () => {
    const result = formatMaterialLine(500, 'lbs', 'Roofing Nails');
    expect(result).toBe('500 lbs — Roofing Nails');
  });

  it('should handle 0 quantity', () => {
    const result = formatMaterialLine(0, 'tubes', 'Caulk');
    expect(result).toBe('0 tubes — Caulk');
  });

  it('should format with linear feet unit', () => {
    const result = formatMaterialLine(143, 'lf', 'Starter Strip');
    expect(result).toBe('143 lf — Starter Strip');
  });

  it('should format with pieces unit', () => {
    const result = formatMaterialLine(22, 'pcs', 'Step Flashing');
    expect(result).toBe('22 pcs — Step Flashing');
  });

  it('should preserve the em-dash separator', () => {
    const result = formatMaterialLine(5, 'rolls', 'Ice & Water Shield');
    expect(result).toContain('—');
    expect(result).not.toContain('--');
    expect(result).not.toContain('-');
    // Only the em-dash, not a regular dash (the name contains &, not -)
  });
});

// ─── estimateMaterials edge cases ──────────────────────────────────

describe('estimateMaterials edge cases', () => {
  describe('zero waste percent', () => {
    it('should apply no waste multiplier when wastePercent is 0', () => {
      const m = createMeasurement({
        totalSquares: 10,
        totalEaveLf: 60,
        totalRakeLf: 30,
        totalRidgeLf: 40,
        totalHipLf: 20,
        totalFlashingLf: 50,
        suggestedWastePercent: 0,
      });
      const est = estimateMaterials(m, 0);

      // 10 * 1.0 * 3 = 30
      expect(est.shingleBundles).toBe(30);
      // 10 * 1.0 / 4 = 2.5 -> ceil = 3
      expect(est.underlaymentRolls).toBe(3);
      // 60 * 1.0 / 66.7 = 0.899... -> ceil = 1
      expect(est.iceWaterRolls).toBe(1);
      // (60 + 30) * 1.0 = 90
      expect(est.starterStripLf).toBe(90);
      // (40 + 20) * 1.0 = 60
      expect(est.ridgeCapLf).toBe(60);
      // (60 + 30) * 1.0 = 90
      expect(est.dripEdgeLf).toBe(90);
      // 50 * 1.0 = 50
      expect(est.stepFlashingPcs).toBe(50);
      // 10 * 1.0 * 1.75 = 17.5 -> ceil = 18
      expect(est.nailsLbs).toBe(18);
      // 40 * 1.0 = 40
      expect(est.ridgeVentLf).toBe(40);
    });
  });

  describe('high waste percent (50%)', () => {
    it('should apply a 1.5x multiplier for 50% waste', () => {
      const m = createMeasurement({
        totalSquares: 10,
        totalEaveLf: 100,
        totalRakeLf: 50,
        totalRidgeLf: 40,
        totalHipLf: 20,
        totalFlashingLf: 30,
        suggestedWastePercent: 50,
      });
      const est = estimateMaterials(m, 50);

      // 10 * 1.5 * 3 = 45
      expect(est.shingleBundles).toBe(45);
      // 10 * 1.5 / 4 = 3.75 -> ceil = 4
      expect(est.underlaymentRolls).toBe(4);
      // 100 * 1.5 / 66.7 = 2.248... -> ceil = 3
      expect(est.iceWaterRolls).toBe(3);
      // (100 + 50) * 1.5 = 225
      expect(est.starterStripLf).toBe(225);
      // (40 + 20) * 1.5 = 90
      expect(est.ridgeCapLf).toBe(90);
      // (100 + 50) * 1.5 = 225
      expect(est.dripEdgeLf).toBe(225);
      // 30 * 1.5 = 45
      expect(est.stepFlashingPcs).toBe(45);
      // 10 * 1.5 * 1.75 = 26.25 -> ceil = 27
      expect(est.nailsLbs).toBe(27);
      // 40 * 1.5 = 60
      expect(est.ridgeVentLf).toBe(60);
    });
  });

  describe('zero flashing (caulkTubes should be 0)', () => {
    it('should return 0 caulk tubes when flashing is 0', () => {
      const m = createMeasurement({ totalFlashingLf: 0 });
      const est = estimateMaterials(m);

      // Math.max(0 > 0 ? 1 : 0, Math.ceil(0 / 25)) = Math.max(0, 0) = 0
      expect(est.caulkTubes).toBe(0);
    });

    it('should return 0 step flashing pieces when flashing is 0', () => {
      const m = createMeasurement({ totalFlashingLf: 0 });
      const est = estimateMaterials(m);

      expect(est.stepFlashingPcs).toBe(0);
    });
  });

  describe('caulk tubes minimum of 1 when flashing > 0', () => {
    it('should return at least 1 caulk tube for very small flashing length', () => {
      const m = createMeasurement({ totalFlashingLf: 1 });
      const est = estimateMaterials(m);

      // Math.max(1 > 0 ? 1 : 0, Math.ceil(1/25)) = Math.max(1, 1) = 1
      expect(est.caulkTubes).toBe(1);
    });

    it('should return at least 1 caulk tube for flashing under 25 lf', () => {
      const m = createMeasurement({ totalFlashingLf: 10 });
      const est = estimateMaterials(m);

      // Math.max(10 > 0 ? 1 : 0, Math.ceil(10/25)) = Math.max(1, 1) = 1
      expect(est.caulkTubes).toBe(1);
    });
  });

  describe('very small area (< 1000 sqft for pipeBoots)', () => {
    it('should return minimum 1 pipe boot for small areas', () => {
      const m = createMeasurement({ totalTrueAreaSqFt: 500 });
      const est = estimateMaterials(m);

      // Math.max(1, Math.ceil(500 / 1000)) = Math.max(1, 1) = 1
      expect(est.pipeBoots).toBe(1);
    });

    it('should return minimum 1 pipe boot for very small areas', () => {
      const m = createMeasurement({ totalTrueAreaSqFt: 100 });
      const est = estimateMaterials(m);

      // Math.max(1, Math.ceil(100 / 1000)) = Math.max(1, 1) = 1
      expect(est.pipeBoots).toBe(1);
    });

    it('should return minimum 1 pipe boot for zero area', () => {
      const m = createMeasurement({ totalTrueAreaSqFt: 0 });
      const est = estimateMaterials(m);

      // Math.max(1, Math.ceil(0 / 1000)) = Math.max(1, 0) = 1
      expect(est.pipeBoots).toBe(1);
    });

    it('should return 2 pipe boots for area just over 1000 sqft', () => {
      const m = createMeasurement({ totalTrueAreaSqFt: 1001 });
      const est = estimateMaterials(m);

      // Math.max(1, Math.ceil(1001 / 1000)) = Math.max(1, 2) = 2
      expect(est.pipeBoots).toBe(2);
    });

    it('should return exactly 1 pipe boot for exactly 1000 sqft', () => {
      const m = createMeasurement({ totalTrueAreaSqFt: 1000 });
      const est = estimateMaterials(m);

      // Math.max(1, Math.ceil(1000 / 1000)) = Math.max(1, 1) = 1
      expect(est.pipeBoots).toBe(1);
    });
  });

  describe('no eaves (iceWaterRolls = 0)', () => {
    it('should return 0 ice & water rolls when eave length is 0', () => {
      const m = createMeasurement({ totalEaveLf: 0 });
      const est = estimateMaterials(m);

      // Math.ceil(0 * 1.1 / 66.7) = Math.ceil(0) = 0
      expect(est.iceWaterRolls).toBe(0);
    });

    it('should still calculate starter strip from rake only when eaves are 0', () => {
      const m = createMeasurement({ totalEaveLf: 0, totalRakeLf: 50, suggestedWastePercent: 10 });
      const est = estimateMaterials(m);

      // (0 + 50) * 1.1 = 55.0000...01 (floating point) -> ceil = 56
      expect(est.starterStripLf).toBe(56);
    });

    it('should still calculate drip edge from rake only when eaves are 0', () => {
      const m = createMeasurement({ totalEaveLf: 0, totalRakeLf: 50, suggestedWastePercent: 10 });
      const est = estimateMaterials(m);

      // (0 + 50) * 1.1 = 55.0000...01 (floating point) -> ceil = 56
      expect(est.dripEdgeLf).toBe(56);
    });
  });

  describe('no ridges (ridgeVentLf = 0, ridgeCapLf based on hip only)', () => {
    it('should return 0 ridge vent when ridge length is 0', () => {
      const m = createMeasurement({ totalRidgeLf: 0 });
      const est = estimateMaterials(m);

      // Math.ceil(0 * 1.1) = 0
      expect(est.ridgeVentLf).toBe(0);
    });

    it('should calculate ridge cap from hip only when ridge is 0', () => {
      const m = createMeasurement({ totalRidgeLf: 0, totalHipLf: 20, suggestedWastePercent: 10 });
      const est = estimateMaterials(m);

      // (0 + 20) * 1.1 = 22
      expect(est.ridgeCapLf).toBe(22);
    });

    it('should return 0 for both ridge cap and ridge vent when both ridge and hip are 0', () => {
      const m = createMeasurement({ totalRidgeLf: 0, totalHipLf: 0 });
      const est = estimateMaterials(m);

      expect(est.ridgeVentLf).toBe(0);
      expect(est.ridgeCapLf).toBe(0);
    });
  });

  describe('all fields are positive integers (Math.ceil)', () => {
    it('should return all integer values for the default measurement', () => {
      const m = createMeasurement();
      const est = estimateMaterials(m);

      expect(Number.isInteger(est.shingleBundles)).toBe(true);
      expect(Number.isInteger(est.underlaymentRolls)).toBe(true);
      expect(Number.isInteger(est.iceWaterRolls)).toBe(true);
      expect(Number.isInteger(est.starterStripLf)).toBe(true);
      expect(Number.isInteger(est.ridgeCapLf)).toBe(true);
      expect(Number.isInteger(est.dripEdgeLf)).toBe(true);
      expect(Number.isInteger(est.stepFlashingPcs)).toBe(true);
      expect(Number.isInteger(est.pipeBoots)).toBe(true);
      expect(Number.isInteger(est.nailsLbs)).toBe(true);
      expect(Number.isInteger(est.caulkTubes)).toBe(true);
      expect(Number.isInteger(est.ridgeVentLf)).toBe(true);
    });

    it('should return all non-negative values for the default measurement', () => {
      const m = createMeasurement();
      const est = estimateMaterials(m);

      expect(est.shingleBundles).toBeGreaterThanOrEqual(0);
      expect(est.underlaymentRolls).toBeGreaterThanOrEqual(0);
      expect(est.iceWaterRolls).toBeGreaterThanOrEqual(0);
      expect(est.starterStripLf).toBeGreaterThanOrEqual(0);
      expect(est.ridgeCapLf).toBeGreaterThanOrEqual(0);
      expect(est.dripEdgeLf).toBeGreaterThanOrEqual(0);
      expect(est.stepFlashingPcs).toBeGreaterThanOrEqual(0);
      expect(est.pipeBoots).toBeGreaterThanOrEqual(0);
      expect(est.nailsLbs).toBeGreaterThanOrEqual(0);
      expect(est.caulkTubes).toBeGreaterThanOrEqual(0);
      expect(est.ridgeVentLf).toBeGreaterThanOrEqual(0);
    });

    it('should ceil fractional results from waste multiplier', () => {
      // Choose values that produce fractional intermediate results
      const m = createMeasurement({
        totalSquares: 7,
        totalEaveLf: 33,
        totalRakeLf: 17,
        totalRidgeLf: 11,
        totalHipLf: 9,
        totalFlashingLf: 13,
        suggestedWastePercent: 15,
      });
      const est = estimateMaterials(m, 15);

      // 7 * 1.15 * 3 = 24.15 -> ceil = 25
      expect(est.shingleBundles).toBe(25);
      // 7 * 1.15 / 4 = 2.0125 -> ceil = 3
      expect(est.underlaymentRolls).toBe(3);
      // 33 * 1.15 / 66.7 = 0.5692... -> ceil = 1
      expect(est.iceWaterRolls).toBe(1);
      // (33 + 17) * 1.15 = 57.5 -> ceil = 58
      expect(est.starterStripLf).toBe(58);
      // (11 + 9) * 1.15 = 23 -> ceil = 23
      expect(est.ridgeCapLf).toBe(23);
      // (33 + 17) * 1.15 = 57.5 -> ceil = 58
      expect(est.dripEdgeLf).toBe(58);
      // 13 * 1.15 = 14.95 -> ceil = 15
      expect(est.stepFlashingPcs).toBe(15);
      // 7 * 1.15 * 1.75 = 14.0875 -> ceil = 15
      expect(est.nailsLbs).toBe(15);
      // 11 * 1.15 = 12.65 -> ceil = 13
      expect(est.ridgeVentLf).toBe(13);
    });

    it('should produce integer results even with odd waste percentages', () => {
      const m = createMeasurement({ suggestedWastePercent: 13 });
      const est = estimateMaterials(m, 13);

      for (const [, val] of Object.entries(est)) {
        expect(Number.isInteger(val)).toBe(true);
      }
    });
  });

  describe('uses default waste from measurement when not specified', () => {
    it('should use suggestedWastePercent when wastePercent parameter is omitted', () => {
      const m = createMeasurement({ totalSquares: 10, suggestedWastePercent: 15 });
      const est = estimateMaterials(m);

      // 10 * 1.15 * 3 = 34.5 -> ceil = 35
      expect(est.shingleBundles).toBe(35);
    });

    it('should override default waste when wastePercent parameter is provided', () => {
      const m = createMeasurement({ totalSquares: 10, suggestedWastePercent: 15 });
      const est = estimateMaterials(m, 20);

      // 10 * 1.20 * 3 = 36
      expect(est.shingleBundles).toBe(36);
    });
  });
});
