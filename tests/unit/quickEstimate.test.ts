/**
 * Unit tests for quick estimate calculator
 * Run with: npx vitest run tests/unit/quickEstimate.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  pitchMultiplier,
  estimatePerimeter,
  estimateRidgeLength,
  calculateQuickEstimate,
  formatCurrency,
  COMPLEXITY_LABELS,
  SHINGLE_LABELS,
  UNDERLAYMENT_LABELS,
  type QuickEstimateInput,
} from '../../src/utils/quickEstimate';

// ─── Helper: default input ──────────────────────────────────────

function defaultInput(overrides: Partial<QuickEstimateInput> = {}): QuickEstimateInput {
  return {
    areaSqFt: 2000,
    pitch: 6,
    isPitchAdjusted: false,
    complexity: 'moderate',
    stories: 1,
    shingleGrade: 'architectural',
    underlayment: 'synthetic',
    tearoff: true,
    tearoffLayers: 1,
    ...overrides,
  };
}

// ─── pitchMultiplier ────────────────────────────────────────────

describe('pitchMultiplier', () => {
  it('returns 1 for flat roof (0/12)', () => {
    expect(pitchMultiplier(0)).toBe(1);
  });

  it('returns correct value for 6/12', () => {
    // sqrt(1 + (6/12)^2) = sqrt(1.25) ≈ 1.118
    const result = pitchMultiplier(6);
    expect(result).toBeCloseTo(1.118, 2);
  });

  it('returns correct value for 12/12 (45°)', () => {
    // sqrt(1 + 1) = sqrt(2) ≈ 1.414
    const result = pitchMultiplier(12);
    expect(result).toBeCloseTo(1.414, 2);
  });

  it('increases monotonically with pitch', () => {
    const pitches = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18];
    for (let i = 1; i < pitches.length; i++) {
      expect(pitchMultiplier(pitches[i])).toBeGreaterThan(pitchMultiplier(pitches[i - 1]));
    }
  });

  it('returns correct value for steep pitch (18/12)', () => {
    // sqrt(1 + (18/12)^2) = sqrt(1 + 2.25) = sqrt(3.25) ≈ 1.803
    expect(pitchMultiplier(18)).toBeCloseTo(1.803, 2);
  });
});

// ─── estimatePerimeter ──────────────────────────────────────────

describe('estimatePerimeter', () => {
  it('returns positive value for valid input', () => {
    expect(estimatePerimeter(2000, 'moderate')).toBeGreaterThan(0);
  });

  it('simple roofs have smaller perimeter factor', () => {
    const simple = estimatePerimeter(2000, 'simple');
    const complex = estimatePerimeter(2000, 'complex');
    expect(simple).toBeLessThan(complex);
  });

  it('scales with sqrt of area', () => {
    const small = estimatePerimeter(1000, 'moderate');
    const large = estimatePerimeter(4000, 'moderate');
    // 4x area → 2x perimeter
    expect(large / small).toBeCloseTo(2, 1);
  });

  it('returns 0 for 0 area', () => {
    expect(estimatePerimeter(0, 'simple')).toBe(0);
  });
});

// ─── estimateRidgeLength ────────────────────────────────────────

describe('estimateRidgeLength', () => {
  it('returns positive value for valid input', () => {
    expect(estimateRidgeLength(2000, 'moderate')).toBeGreaterThan(0);
  });

  it('complex roofs have longer ridges', () => {
    const simple = estimateRidgeLength(2000, 'simple');
    const veryComplex = estimateRidgeLength(2000, 'very_complex');
    expect(veryComplex).toBeGreaterThan(simple);
  });

  it('scales with sqrt of area', () => {
    const small = estimateRidgeLength(900, 'moderate');
    const large = estimateRidgeLength(3600, 'moderate');
    expect(large / small).toBeCloseTo(2, 1);
  });

  it('returns 0 for 0 area', () => {
    expect(estimateRidgeLength(0, 'complex')).toBe(0);
  });
});

// ─── calculateQuickEstimate: area & squares ─────────────────────

describe('calculateQuickEstimate - area calculations', () => {
  it('applies pitch multiplier to flat area', () => {
    const result = calculateQuickEstimate(defaultInput({ areaSqFt: 2000, pitch: 6 }));
    const expectedTrueArea = Math.round(2000 * pitchMultiplier(6));
    expect(result.trueAreaSqFt).toBe(expectedTrueArea);
  });

  it('skips pitch adjustment when isPitchAdjusted is true', () => {
    const result = calculateQuickEstimate(defaultInput({
      areaSqFt: 2000,
      pitch: 12,
      isPitchAdjusted: true,
    }));
    expect(result.trueAreaSqFt).toBe(2000);
  });

  it('calculates squares correctly (area / 100)', () => {
    const result = calculateQuickEstimate(defaultInput({ areaSqFt: 1000, pitch: 0 }));
    // pitch 0 → multiplier 1, so trueArea = 1000
    expect(result.squares).toBe(10);
  });

  it('applies correct waste percentage per complexity', () => {
    const simple = calculateQuickEstimate(defaultInput({ complexity: 'simple' }));
    const complex = calculateQuickEstimate(defaultInput({ complexity: 'complex' }));
    expect(simple.wastePercent).toBe(8);
    expect(complex.wastePercent).toBe(17);
  });

  it('squaresWithWaste includes waste factor', () => {
    const result = calculateQuickEstimate(defaultInput({
      areaSqFt: 1000,
      pitch: 0,
      complexity: 'moderate',
    }));
    // 10 squares * 1.12 waste = 11.2
    expect(result.squaresWithWaste).toBe(11.2);
  });
});

// ─── calculateQuickEstimate: materials ──────────────────────────

describe('calculateQuickEstimate - materials', () => {
  it('calculates shingle bundles (3 per square with waste)', () => {
    const result = calculateQuickEstimate(defaultInput({
      areaSqFt: 1000,
      pitch: 0,
      complexity: 'simple',
    }));
    // 10 squares * 1.08 waste = 10.8 → 10.8 * 3 = 32.4 → ceil = 33
    expect(result.materials.shingleBundles).toBe(33);
  });

  it('calculates underlayment rolls (1 per 4 squares)', () => {
    const result = calculateQuickEstimate(defaultInput({
      areaSqFt: 1000,
      pitch: 0,
      complexity: 'simple',
    }));
    // 10.8 sq / 4 = 2.7 → ceil = 3
    expect(result.materials.underlaymentRolls).toBe(3);
  });

  it('calculates nails (1.75 lbs per square)', () => {
    const result = calculateQuickEstimate(defaultInput({
      areaSqFt: 1000,
      pitch: 0,
      complexity: 'simple',
    }));
    // 10.8 sq * 1.75 = 18.9 → ceil = 19
    expect(result.materials.nailsLbs).toBe(19);
  });

  it('material quantities are always integers (ceiled)', () => {
    const result = calculateQuickEstimate(defaultInput());
    expect(Number.isInteger(result.materials.shingleBundles)).toBe(true);
    expect(Number.isInteger(result.materials.underlaymentRolls)).toBe(true);
    expect(Number.isInteger(result.materials.iceWaterRolls)).toBe(true);
    expect(Number.isInteger(result.materials.starterStripLf)).toBe(true);
    expect(Number.isInteger(result.materials.ridgeCapLf)).toBe(true);
    expect(Number.isInteger(result.materials.dripEdgeLf)).toBe(true);
    expect(Number.isInteger(result.materials.nailsLbs)).toBe(true);
    expect(Number.isInteger(result.materials.ventLf)).toBe(true);
  });

  it('all material quantities are positive', () => {
    const result = calculateQuickEstimate(defaultInput());
    expect(result.materials.shingleBundles).toBeGreaterThan(0);
    expect(result.materials.underlaymentRolls).toBeGreaterThan(0);
    expect(result.materials.iceWaterRolls).toBeGreaterThan(0);
    expect(result.materials.starterStripLf).toBeGreaterThan(0);
    expect(result.materials.ridgeCapLf).toBeGreaterThan(0);
    expect(result.materials.dripEdgeLf).toBeGreaterThan(0);
    expect(result.materials.nailsLbs).toBeGreaterThan(0);
    expect(result.materials.ventLf).toBeGreaterThan(0);
  });
});

// ─── calculateQuickEstimate: costs ──────────────────────────────

describe('calculateQuickEstimate - costs', () => {
  it('shingle cost increases with grade', () => {
    const threeTab = calculateQuickEstimate(defaultInput({ shingleGrade: 'three_tab' }));
    const arch = calculateQuickEstimate(defaultInput({ shingleGrade: 'architectural' }));
    const premium = calculateQuickEstimate(defaultInput({ shingleGrade: 'premium' }));
    const designer = calculateQuickEstimate(defaultInput({ shingleGrade: 'designer' }));
    expect(threeTab.costs.shingles).toBeLessThan(arch.costs.shingles);
    expect(arch.costs.shingles).toBeLessThan(premium.costs.shingles);
    expect(premium.costs.shingles).toBeLessThan(designer.costs.shingles);
  });

  it('underlayment cost increases with type', () => {
    const felt15 = calculateQuickEstimate(defaultInput({ underlayment: 'felt_15' }));
    const felt30 = calculateQuickEstimate(defaultInput({ underlayment: 'felt_30' }));
    const synthetic = calculateQuickEstimate(defaultInput({ underlayment: 'synthetic' }));
    expect(felt15.costs.underlayment).toBeLessThan(felt30.costs.underlayment);
    expect(felt30.costs.underlayment).toBeLessThan(synthetic.costs.underlayment);
  });

  it('labor cost increases with complexity', () => {
    const simple = calculateQuickEstimate(defaultInput({ complexity: 'simple' }));
    const complex = calculateQuickEstimate(defaultInput({ complexity: 'very_complex' }));
    expect(simple.costs.labor).toBeLessThan(complex.costs.labor);
  });

  it('labor cost increases with stories', () => {
    const one = calculateQuickEstimate(defaultInput({ stories: 1 }));
    const two = calculateQuickEstimate(defaultInput({ stories: 2 }));
    const three = calculateQuickEstimate(defaultInput({ stories: 3 }));
    expect(one.costs.labor).toBeLessThan(two.costs.labor);
    expect(two.costs.labor).toBeLessThan(three.costs.labor);
  });

  it('tearoff costs are zero when tearoff is false', () => {
    const result = calculateQuickEstimate(defaultInput({ tearoff: false }));
    expect(result.costs.tearoff).toBe(0);
    expect(result.costs.disposal).toBe(0);
  });

  it('tearoff costs scale with layers', () => {
    const oneLayer = calculateQuickEstimate(defaultInput({ tearoff: true, tearoffLayers: 1 }));
    const twoLayers = calculateQuickEstimate(defaultInput({ tearoff: true, tearoffLayers: 2 }));
    expect(twoLayers.costs.tearoff).toBeGreaterThan(oneLayer.costs.tearoff);
    expect(twoLayers.costs.disposal).toBeGreaterThan(oneLayer.costs.disposal);
    // Should be roughly double
    expect(twoLayers.costs.tearoff / oneLayer.costs.tearoff).toBeCloseTo(2, 0);
  });

  it('totalMaterials = shingles + underlayment + iceWater + accessories', () => {
    const r = calculateQuickEstimate(defaultInput());
    expect(r.costs.totalMaterials).toBe(
      r.costs.shingles + r.costs.underlayment + r.costs.iceWater + r.costs.accessories,
    );
  });

  it('totalLabor = labor + tearoff + disposal', () => {
    const r = calculateQuickEstimate(defaultInput());
    expect(r.costs.totalLabor).toBe(r.costs.labor + r.costs.tearoff + r.costs.disposal);
  });

  it('grandTotal = totalMaterials + totalLabor', () => {
    const r = calculateQuickEstimate(defaultInput());
    expect(r.costs.grandTotal).toBe(r.costs.totalMaterials + r.costs.totalLabor);
  });

  it('costPerSquare = grandTotal / squaresWithWaste', () => {
    const r = calculateQuickEstimate(defaultInput());
    expect(r.costPerSquare).toBe(Math.round(r.costs.grandTotal / r.squaresWithWaste));
  });

  it('all cost values are integers (rounded)', () => {
    const r = calculateQuickEstimate(defaultInput());
    expect(Number.isInteger(r.costs.shingles)).toBe(true);
    expect(Number.isInteger(r.costs.underlayment)).toBe(true);
    expect(Number.isInteger(r.costs.iceWater)).toBe(true);
    expect(Number.isInteger(r.costs.accessories)).toBe(true);
    expect(Number.isInteger(r.costs.tearoff)).toBe(true);
    expect(Number.isInteger(r.costs.labor)).toBe(true);
    expect(Number.isInteger(r.costs.disposal)).toBe(true);
    expect(Number.isInteger(r.costs.totalMaterials)).toBe(true);
    expect(Number.isInteger(r.costs.totalLabor)).toBe(true);
    expect(Number.isInteger(r.costs.grandTotal)).toBe(true);
  });
});

// ─── calculateQuickEstimate: edge cases ─────────────────────────

describe('calculateQuickEstimate - edge cases', () => {
  it('handles very small roof (100 sq ft)', () => {
    const result = calculateQuickEstimate(defaultInput({ areaSqFt: 100, pitch: 0 }));
    expect(result.trueAreaSqFt).toBe(100);
    expect(result.squares).toBe(1);
    expect(result.costs.grandTotal).toBeGreaterThan(0);
  });

  it('handles very large roof (50000 sq ft)', () => {
    const result = calculateQuickEstimate(defaultInput({ areaSqFt: 50000 }));
    expect(result.trueAreaSqFt).toBeGreaterThan(50000);
    expect(result.costs.grandTotal).toBeGreaterThan(0);
    expect(result.materials.shingleBundles).toBeGreaterThan(100);
  });

  it('handles very steep pitch (18/12)', () => {
    const result = calculateQuickEstimate(defaultInput({ areaSqFt: 2000, pitch: 18 }));
    expect(result.trueAreaSqFt).toBeGreaterThan(3500); // 2000 * 1.803
  });

  it('handles flat roof (0/12)', () => {
    const result = calculateQuickEstimate(defaultInput({ areaSqFt: 2000, pitch: 0 }));
    expect(result.trueAreaSqFt).toBe(2000);
  });

  it('handles stories > 3 (capped at 1.35 multiplier)', () => {
    const three = calculateQuickEstimate(defaultInput({ stories: 3 }));
    const four = calculateQuickEstimate(defaultInput({ stories: 4 }));
    // Both should use 1.35 multiplier
    expect(three.costs.labor).toBe(four.costs.labor);
  });

  it('no tearoff with tearoffLayers still works', () => {
    const result = calculateQuickEstimate(defaultInput({
      tearoff: false,
      tearoffLayers: 2,
    }));
    expect(result.costs.tearoff).toBe(0);
    expect(result.costs.disposal).toBe(0);
  });
});

// ─── calculateQuickEstimate: realistic scenario ─────────────────

describe('calculateQuickEstimate - realistic scenarios', () => {
  it('typical 2000sf moderate roof gives reasonable total', () => {
    const result = calculateQuickEstimate(defaultInput({
      areaSqFt: 2000,
      pitch: 6,
      complexity: 'moderate',
      stories: 1,
      shingleGrade: 'architectural',
      underlayment: 'synthetic',
      tearoff: true,
      tearoffLayers: 1,
    }));
    // A typical 20-square residential reroof should cost ~$5k-$15k
    expect(result.costs.grandTotal).toBeGreaterThan(4000);
    expect(result.costs.grandTotal).toBeLessThan(20000);
    expect(result.squares).toBeGreaterThan(20);
    expect(result.squares).toBeLessThan(25);
  });

  it('premium materials cost more than basic', () => {
    const basic = calculateQuickEstimate(defaultInput({
      shingleGrade: 'three_tab',
      underlayment: 'felt_15',
    }));
    const premium = calculateQuickEstimate(defaultInput({
      shingleGrade: 'designer',
      underlayment: 'synthetic',
    }));
    expect(premium.costs.grandTotal).toBeGreaterThan(basic.costs.grandTotal);
  });

  it('tearoff adds significant cost', () => {
    const withTearoff = calculateQuickEstimate(defaultInput({ tearoff: true }));
    const withoutTearoff = calculateQuickEstimate(defaultInput({ tearoff: false }));
    const diff = withTearoff.costs.grandTotal - withoutTearoff.costs.grandTotal;
    expect(diff).toBeGreaterThan(500);
  });
});

// ─── formatCurrency ─────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats with dollar sign', () => {
    expect(formatCurrency(1000)).toBe('$1,000');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });

  it('formats large amounts', () => {
    const result = formatCurrency(12500);
    expect(result).toContain('$');
    expect(result).toContain('12');
    expect(result).toContain('500');
  });
});

// ─── Label constants ────────────────────────────────────────────

describe('label constants', () => {
  it('COMPLEXITY_LABELS has all types', () => {
    expect(COMPLEXITY_LABELS.simple).toBeTruthy();
    expect(COMPLEXITY_LABELS.moderate).toBeTruthy();
    expect(COMPLEXITY_LABELS.complex).toBeTruthy();
    expect(COMPLEXITY_LABELS.very_complex).toBeTruthy();
  });

  it('SHINGLE_LABELS has all grades', () => {
    expect(SHINGLE_LABELS.three_tab).toBeTruthy();
    expect(SHINGLE_LABELS.architectural).toBeTruthy();
    expect(SHINGLE_LABELS.premium).toBeTruthy();
    expect(SHINGLE_LABELS.designer).toBeTruthy();
  });

  it('UNDERLAYMENT_LABELS has all types', () => {
    expect(UNDERLAYMENT_LABELS.felt_15).toBeTruthy();
    expect(UNDERLAYMENT_LABELS.felt_30).toBeTruthy();
    expect(UNDERLAYMENT_LABELS.synthetic).toBeTruthy();
  });
});
