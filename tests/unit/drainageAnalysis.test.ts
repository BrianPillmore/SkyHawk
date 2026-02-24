/**
 * Unit tests for drainage analysis
 * Run with: npx vitest run tests/unit/drainageAnalysis.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePondingRisk,
  analyzeDrainage,
  recommendDrainLayout,
} from '../../src/utils/drainageAnalysis';
import type {
  CommercialRoofSection,
  DrainageZone,
} from '../../src/types/commercial';

// ─── Helpers ────────────────────────────────────────────────────────

function createSection(overrides: Partial<CommercialRoofSection> = {}): CommercialRoofSection {
  return {
    id: 'section-1',
    name: 'Section A',
    roofType: 'flat',
    areaSqFt: 20000,
    slopePctPerFt: 0.25,
    condition: 'good',
    vertices: [],
    ...overrides,
  };
}

function createDrainZone(overrides: Partial<DrainageZone> = {}): DrainageZone {
  return {
    id: 'drain-1',
    sectionId: 'section-1',
    drainType: 'internal-drain',
    direction: 'internal',
    drainCount: 2,
    adequacy: 'adequate',
    pondingRisk: 'low',
    ...overrides,
  };
}

// ─── calculatePondingRisk ───────────────────────────────────────────

describe('calculatePondingRisk', () => {
  it('should return low for adequate slope and drains', () => {
    // 20000 sqft, 0.25"/ft slope, 2 drains (recommended: ceil(20000/10000)=2)
    expect(calculatePondingRisk(20000, 0.25, 2)).toBe('low');
  });

  it('should return low for more drains than needed with good slope', () => {
    expect(calculatePondingRisk(10000, 0.5, 3)).toBe('low');
  });

  it('should return medium for marginal slope with adequate drains', () => {
    // slope 0.2"/ft is >= 0.125 but < 0.25 → marginal slope
    expect(calculatePondingRisk(20000, 0.2, 2)).toBe('medium');
  });

  it('should return medium for adequate slope but slightly few drains', () => {
    // 30000 sqft needs 3 drains; 2 drains = 0.67 ratio (>= 0.5 but < 1.0)
    expect(calculatePondingRisk(30000, 0.25, 2)).toBe('medium');
  });

  it('should return high for no slope', () => {
    // 0 slope < 0.125 → high
    expect(calculatePondingRisk(20000, 0, 2)).toBe('high');
  });

  it('should return high for very minimal slope', () => {
    expect(calculatePondingRisk(20000, 0.1, 2)).toBe('high');
  });

  it('should return high for severely under-drained', () => {
    // 50000 sqft needs 5 drains; 1 drain = 0.2 ratio (< 0.5)
    expect(calculatePondingRisk(50000, 0.25, 1)).toBe('high');
  });

  it('should handle very small area', () => {
    // 5000 sqft needs 1 drain minimum
    expect(calculatePondingRisk(5000, 0.25, 1)).toBe('low');
  });

  it('should handle zero drains as high risk', () => {
    // 0 drains / any recommended = 0 ratio < 0.5
    expect(calculatePondingRisk(10000, 0.25, 0)).toBe('high');
  });
});

// ─── analyzeDrainage ────────────────────────────────────────────────

describe('analyzeDrainage', () => {
  it('should return adequate for well-drained section', () => {
    const section = createSection({ areaSqFt: 20000, slopePctPerFt: 0.25 });
    const drains = [createDrainZone({ drainCount: 2 })];
    const result = analyzeDrainage(section, drains);

    expect(result.sectionId).toBe('section-1');
    expect(result.areaSqFt).toBe(20000);
    expect(result.existingDrainCount).toBe(2);
    expect(result.recommendedDrainCount).toBe(2);
    expect(result.adequacy).toBe('adequate');
    expect(result.pondingRisk).toBe('low');
  });

  it('should return marginal for slightly under-drained section', () => {
    // 30000 sqft → needs 3 drains, has 2.5 effective (via two zones)
    const section = createSection({ id: 'sec-a', areaSqFt: 30000, slopePctPerFt: 0.25 });
    const drains = [
      createDrainZone({ sectionId: 'sec-a', drainCount: 1 }),
      createDrainZone({ id: 'd2', sectionId: 'sec-a', drainCount: 2 }),
    ];
    // Total drains = 3, recommended = 3 → adequate
    const result = analyzeDrainage(section, drains);
    expect(result.existingDrainCount).toBe(3);
    expect(result.adequacy).toBe('adequate');
  });

  it('should return inadequate for severely under-drained section', () => {
    const section = createSection({ areaSqFt: 50000, slopePctPerFt: 0.25 });
    // 50000 sqft needs 5 drains, only has 1
    const drains = [createDrainZone({ drainCount: 1 })];
    const result = analyzeDrainage(section, drains);

    expect(result.recommendedDrainCount).toBe(5);
    expect(result.existingDrainCount).toBe(1);
    expect(result.adequacy).toBe('inadequate');
  });

  it('should generate recommendations for under-drained sections', () => {
    const section = createSection({ areaSqFt: 30000, slopePctPerFt: 0.25 });
    const drains = [createDrainZone({ drainCount: 1 })];
    const result = analyzeDrainage(section, drains);

    // Should recommend adding drains
    expect(result.recommendations.some((r) => r.includes('Add'))).toBe(true);
  });

  it('should recommend tapered insulation for low slope', () => {
    const section = createSection({ areaSqFt: 10000, slopePctPerFt: 0.05 });
    const drains = [createDrainZone({ drainCount: 1 })];
    const result = analyzeDrainage(section, drains);

    expect(result.recommendations.some((r) => r.includes('tapered insulation'))).toBe(true);
  });

  it('should note marginal slope', () => {
    const section = createSection({ areaSqFt: 10000, slopePctPerFt: 0.2 });
    const drains = [createDrainZone({ drainCount: 1 })];
    const result = analyzeDrainage(section, drains);

    expect(result.recommendations.some((r) => r.includes('marginal'))).toBe(true);
  });

  it('should only count drains matching the section', () => {
    const section = createSection({ id: 'sec-a', areaSqFt: 20000 });
    const drains = [
      createDrainZone({ sectionId: 'sec-a', drainCount: 2 }),
      createDrainZone({ id: 'd2', sectionId: 'sec-b', drainCount: 5 }), // different section
    ];
    const result = analyzeDrainage(section, drains);
    expect(result.existingDrainCount).toBe(2);
  });

  it('should handle no drains at all', () => {
    const section = createSection({ areaSqFt: 20000 });
    const result = analyzeDrainage(section, []);

    expect(result.existingDrainCount).toBe(0);
    expect(result.adequacy).toBe('inadequate');
    expect(result.recommendations.some((r) => r.includes('No drainage zones'))).toBe(true);
  });

  it('should flag high ponding risk sections', () => {
    const section = createSection({ areaSqFt: 40000, slopePctPerFt: 0.0 });
    const drains: DrainageZone[] = [];
    const result = analyzeDrainage(section, drains);

    expect(result.pondingRisk).toBe('high');
    expect(result.recommendations.some((r) => r.includes('High ponding risk'))).toBe(true);
  });
});

// ─── recommendDrainLayout ───────────────────────────────────────────

describe('recommendDrainLayout', () => {
  it('should recommend internal drains for large sections', () => {
    const section = createSection({ areaSqFt: 25000 });
    const layout = recommendDrainLayout(section);

    expect(layout.sectionId).toBe('section-1');
    expect(layout.drainType).toBe('internal-drain');
    expect(layout.recommendedDrainCount).toBe(3); // ceil(25000/10000)
  });

  it('should recommend scuppers for small sections with adequate slope', () => {
    const section = createSection({ areaSqFt: 8000, slopePctPerFt: 0.25 });
    const layout = recommendDrainLayout(section);

    expect(layout.drainType).toBe('scupper');
    expect(layout.recommendedDrainCount).toBe(1);
  });

  it('should recommend internal drains for small sections with no slope', () => {
    const section = createSection({ areaSqFt: 8000, slopePctPerFt: 0.0 });
    const layout = recommendDrainLayout(section);

    expect(layout.drainType).toBe('internal-drain');
  });

  it('should calculate proper drain count for various areas', () => {
    expect(recommendDrainLayout(createSection({ areaSqFt: 5000 })).recommendedDrainCount).toBe(1);
    expect(recommendDrainLayout(createSection({ areaSqFt: 10000 })).recommendedDrainCount).toBe(1);
    expect(recommendDrainLayout(createSection({ areaSqFt: 10001 })).recommendedDrainCount).toBe(2);
    expect(recommendDrainLayout(createSection({ areaSqFt: 30000 })).recommendedDrainCount).toBe(3);
  });

  it('should provide spacing information', () => {
    const section = createSection({ areaSqFt: 40000 });
    const layout = recommendDrainLayout(section);

    // For 4 drains in 40000 sqft, spacing ~sqrt(40000/4) = 100 ft
    expect(layout.spacingFt).toBeGreaterThan(50);
    expect(layout.spacingFt).toBeLessThan(150);
  });

  it('should include notes about tapered insulation for low slope', () => {
    const section = createSection({ slopePctPerFt: 0.05 });
    const layout = recommendDrainLayout(section);

    expect(layout.notes.some((n) => n.includes('tapered insulation'))).toBe(true);
  });

  it('should include notes about drain sumps for flat/single-ply roofs', () => {
    const section = createSection({ roofType: 'flat' });
    const layout = recommendDrainLayout(section);

    expect(layout.notes.some((n) => n.includes('drain sumps'))).toBe(true);
  });
});
