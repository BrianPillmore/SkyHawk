/**
 * Unit tests for commercial material estimation
 * Run with: npx vitest run tests/unit/commercialMaterials.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  estimateCommercialMaterials,
  getMembraneCostPerSqFt,
  getLaborCostPerSqFt,
  formatCurrency,
  EPDM_COST_PER_SQFT,
  METAL_COPING_COST_PER_LF,
  INSULATION_COST_PER_SQFT,
} from '../../src/utils/commercialMaterials';
import type {
  CommercialRoofSection,
  ParapetSegment,
} from '../../src/types/commercial';

// ─── Helpers ────────────────────────────────────────────────────────

function createSection(overrides: Partial<CommercialRoofSection> = {}): CommercialRoofSection {
  return {
    id: 'section-1',
    name: 'Section A',
    roofType: 'single-ply',
    areaSqFt: 10000,
    slopePctPerFt: 0.25,
    condition: 'good',
    vertices: [],
    ...overrides,
  };
}

function createParapet(overrides: Partial<ParapetSegment> = {}): ParapetSegment {
  return {
    id: 'parapet-1',
    lengthFt: 100,
    heightFt: 3,
    copingType: 'metal',
    copingWidthIn: 12,
    condition: 'good',
    ...overrides,
  };
}

// ─── getMembraneCostPerSqFt ─────────────────────────────────────────

describe('getMembraneCostPerSqFt', () => {
  it('should return $3.50 for single-ply (TPO)', () => {
    expect(getMembraneCostPerSqFt('single-ply')).toBe(3.5);
  });

  it('should return $3.50 for flat roofs', () => {
    expect(getMembraneCostPerSqFt('flat')).toBe(3.5);
  });

  it('should return $5.50 for modified bitumen', () => {
    expect(getMembraneCostPerSqFt('modified-bitumen')).toBe(5.5);
  });

  it('should return $6.00 for built-up (BUR)', () => {
    expect(getMembraneCostPerSqFt('built-up')).toBe(6.0);
  });

  it('should return $4.50 for spray foam', () => {
    expect(getMembraneCostPerSqFt('spray-foam')).toBe(4.5);
  });

  it('should return $8.00 for metal standing seam', () => {
    expect(getMembraneCostPerSqFt('metal-standing-seam')).toBe(8.0);
  });
});

describe('cost constants', () => {
  it('EPDM should be $4.00/sqft', () => {
    expect(EPDM_COST_PER_SQFT).toBe(4.0);
  });

  it('metal coping should be $15/lf', () => {
    expect(METAL_COPING_COST_PER_LF).toBe(15.0);
  });

  it('insulation should be $1.20/sqft', () => {
    expect(INSULATION_COST_PER_SQFT).toBe(1.2);
  });
});

// ─── estimateCommercialMaterials ────────────────────────────────────

describe('estimateCommercialMaterials', () => {
  it('should calculate membrane with 10% waste', () => {
    const section = createSection({ areaSqFt: 10000 });
    const est = estimateCommercialMaterials(section, []);
    // 10000 * 1.10 = 11000
    expect(est.membraneSqFt).toBe(11000);
  });

  it('should calculate insulation board count for 4x8 sheets', () => {
    const section = createSection({ areaSqFt: 10000 });
    const est = estimateCommercialMaterials(section, []);
    // 10000 / 32 = 312.5 → ceil = 313
    expect(est.insulationBoardCount).toBe(313);
    expect(est.insulationSqFt).toBe(10000);
  });

  it('should calculate adhesive at 1 gallon per 100 sqft', () => {
    const section = createSection({ areaSqFt: 10000 });
    const est = estimateCommercialMaterials(section, []);
    expect(est.adhesiveGallons).toBe(100); // 10000/100
  });

  it('should calculate fasteners at 1 per sqft', () => {
    const section = createSection({ areaSqFt: 10000 });
    const est = estimateCommercialMaterials(section, []);
    expect(est.fastenerCount).toBe(10000);
  });

  it('should calculate drain assemblies at 1 per 10000 sqft', () => {
    expect(estimateCommercialMaterials(createSection({ areaSqFt: 5000 }), []).drainAssemblies).toBe(1);
    expect(estimateCommercialMaterials(createSection({ areaSqFt: 10000 }), []).drainAssemblies).toBe(1);
    expect(estimateCommercialMaterials(createSection({ areaSqFt: 10001 }), []).drainAssemblies).toBe(2);
    expect(estimateCommercialMaterials(createSection({ areaSqFt: 30000 }), []).drainAssemblies).toBe(3);
  });

  it('should include coping length from parapets', () => {
    const section = createSection({ areaSqFt: 10000 });
    const parapets = [
      createParapet({ lengthFt: 100, copingType: 'metal' }),
      createParapet({ id: 'p2', lengthFt: 50, copingType: 'stone' }),
      createParapet({ id: 'p3', lengthFt: 30, copingType: 'none' }),
    ];
    const est = estimateCommercialMaterials(section, parapets);
    expect(est.copingLf).toBe(150); // 100 + 50 (none excluded)
  });

  it('should compute material cost correctly for single-ply', () => {
    const section = createSection({ areaSqFt: 10000, roofType: 'single-ply' });
    const parapets = [createParapet({ lengthFt: 200, copingType: 'metal' })];
    const est = estimateCommercialMaterials(section, parapets);

    // Membrane: 11000 * 3.50 = 38500
    // Insulation: 10000 * 1.20 = 12000
    // Coping: 200 * 15 = 3000
    // Total material = 53500
    const expectedMaterial = 11000 * 3.5 + 10000 * 1.2 + 200 * 15;
    expect(est.materialCost).toBeCloseTo(expectedMaterial, 0);
  });

  it('should compute labor cost correctly', () => {
    const section = createSection({ areaSqFt: 10000, roofType: 'single-ply' });
    const est = estimateCommercialMaterials(section, []);

    // Labor: 10000 * 1.50 = 15000
    expect(est.laborCost).toBe(15000);
  });

  it('should compute total cost as material + labor', () => {
    const section = createSection({ areaSqFt: 10000, roofType: 'single-ply' });
    const est = estimateCommercialMaterials(section, []);

    expect(est.totalCost).toBeCloseTo(est.materialCost + est.laborCost, 2);
  });

  it('should calculate labor hours', () => {
    const section = createSection({ areaSqFt: 10000, roofType: 'single-ply' });
    const est = estimateCommercialMaterials(section, []);
    // 10000/100 * 1.5 = 150 hours
    expect(est.laborHours).toBe(150);
  });

  it('should have higher costs for built-up vs single-ply', () => {
    const singlePly = estimateCommercialMaterials(
      createSection({ areaSqFt: 10000, roofType: 'single-ply' }), []
    );
    const builtUp = estimateCommercialMaterials(
      createSection({ areaSqFt: 10000, roofType: 'built-up' }), []
    );
    expect(builtUp.materialCost).toBeGreaterThan(singlePly.materialCost);
    expect(builtUp.laborCost).toBeGreaterThan(singlePly.laborCost);
    expect(builtUp.totalCost).toBeGreaterThan(singlePly.totalCost);
  });

  it('should set roofType and sectionId on estimate', () => {
    const section = createSection({ id: 'my-section', roofType: 'modified-bitumen' });
    const est = estimateCommercialMaterials(section, []);
    expect(est.roofType).toBe('modified-bitumen');
    expect(est.sectionId).toBe('my-section');
  });

  it('should handle zero area section', () => {
    const section = createSection({ areaSqFt: 0 });
    const est = estimateCommercialMaterials(section, []);
    expect(est.membraneSqFt).toBe(0);
    expect(est.insulationBoardCount).toBe(0);
    expect(est.adhesiveGallons).toBe(0);
    expect(est.fastenerCount).toBe(0);
    expect(est.drainAssemblies).toBe(1); // minimum 1
    expect(est.laborHours).toBe(0);
    expect(est.laborCost).toBe(0);
  });
});

// ─── formatCurrency ─────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('should format dollar amounts', () => {
    expect(formatCurrency(0)).toBe('$0');
    expect(formatCurrency(1500)).toBe('$1,500');
    expect(formatCurrency(53500)).toBe('$53,500');
  });

  it('should handle large amounts', () => {
    const result = formatCurrency(1250000);
    expect(result).toBe('$1,250,000');
  });
});

// ─── getLaborCostPerSqFt ────────────────────────────────────────────

describe('getLaborCostPerSqFt', () => {
  it('should return $1.50 for single-ply', () => {
    expect(getLaborCostPerSqFt('single-ply')).toBe(1.5);
  });

  it('should return $2.50 for built-up', () => {
    expect(getLaborCostPerSqFt('built-up')).toBe(2.5);
  });

  it('should return $3.50 for metal standing seam', () => {
    expect(getLaborCostPerSqFt('metal-standing-seam')).toBe(3.5);
  });

  it('should return $2.00 for modified bitumen', () => {
    expect(getLaborCostPerSqFt('modified-bitumen')).toBe(2.0);
  });

  it('should return $2.00 for spray foam', () => {
    expect(getLaborCostPerSqFt('spray-foam')).toBe(2.0);
  });
});
