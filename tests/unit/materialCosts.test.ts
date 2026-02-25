/**
 * Unit tests for material cost pricing
 */
import { describe, it, expect } from 'vitest';
import {
  estimateMaterialCosts,
  estimateMaterials,
  DEFAULT_MATERIAL_PRICES,
  formatCurrency,
} from '../../src/utils/materials';
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

describe('estimateMaterialCosts', () => {
  it('should compute total material cost from all line items', () => {
    const m = createMeasurement();
    const materials = estimateMaterials(m);
    const costs = estimateMaterialCosts(materials, m.totalSquares);

    expect(costs.totalMaterialCost).toBeGreaterThan(0);
    expect(costs.items.length).toBeGreaterThan(0);

    // Verify total is sum of all items
    const itemsTotal = costs.items.reduce((sum, item) => sum + item.totalPrice, 0);
    expect(costs.totalMaterialCost).toBeCloseTo(itemsTotal, 2);
  });

  it('should compute labor at 1.5x materials', () => {
    const m = createMeasurement();
    const materials = estimateMaterials(m);
    const costs = estimateMaterialCosts(materials, m.totalSquares);

    expect(costs.estimatedLaborCost).toBeCloseTo(costs.totalMaterialCost * 1.5, 2);
  });

  it('should compute total project cost as materials + labor', () => {
    const m = createMeasurement();
    const materials = estimateMaterials(m);
    const costs = estimateMaterialCosts(materials, m.totalSquares);

    expect(costs.totalProjectCost).toBeCloseTo(
      costs.totalMaterialCost + costs.estimatedLaborCost,
      2,
    );
  });

  it('should compute cost per square', () => {
    const m = createMeasurement({ totalSquares: 20 });
    const materials = estimateMaterials(m);
    const costs = estimateMaterialCosts(materials, 20);

    expect(costs.costPerSquare).toBeCloseTo(costs.totalProjectCost / 20, 2);
  });

  it('should use default prices when none provided', () => {
    const m = createMeasurement();
    const materials = estimateMaterials(m);
    const costs = estimateMaterialCosts(materials, m.totalSquares);

    // First item is shingle bundles
    const shingleItem = costs.items.find((i) => i.name === 'Shingle Bundles');
    expect(shingleItem).toBeDefined();
    expect(shingleItem!.unitPrice).toBe(DEFAULT_MATERIAL_PRICES.shingleBundlePrice);
    expect(shingleItem!.totalPrice).toBe(
      shingleItem!.quantity * DEFAULT_MATERIAL_PRICES.shingleBundlePrice,
    );
  });

  it('should allow regional price overrides', () => {
    const m = createMeasurement();
    const materials = estimateMaterials(m);
    const defaultCosts = estimateMaterialCosts(materials, m.totalSquares);
    const customCosts = estimateMaterialCosts(materials, m.totalSquares, {
      shingleBundlePrice: 50.0, // higher than default $35
    });

    expect(customCosts.totalMaterialCost).toBeGreaterThan(defaultCosts.totalMaterialCost);
  });

  it('should filter out zero-quantity items', () => {
    const m = createMeasurement({
      totalFlashingLf: 0,
      totalStepFlashingLf: 0,
      totalValleyLf: 0,
    });
    const materials = estimateMaterials(m);
    const costs = estimateMaterialCosts(materials, m.totalSquares);

    for (const item of costs.items) {
      expect(item.quantity).toBeGreaterThan(0);
    }
  });

  it('should handle zero squares gracefully', () => {
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
    const materials = estimateMaterials(m);
    const costs = estimateMaterialCosts(materials, 0);

    expect(costs.costPerSquare).toBe(0);
    expect(costs.totalProjectCost).toBeGreaterThanOrEqual(0);
  });

  it('should return reasonable cost per square for typical roof', () => {
    const m = createMeasurement({ totalSquares: 25 });
    const materials = estimateMaterials(m);
    const costs = estimateMaterialCosts(materials, 25);

    // Typical residential roofing costs $300-$700 per square (materials + labor)
    expect(costs.costPerSquare).toBeGreaterThan(100);
    expect(costs.costPerSquare).toBeLessThan(1500);
  });

  it('should have correct item structure', () => {
    const m = createMeasurement();
    const materials = estimateMaterials(m);
    const costs = estimateMaterialCosts(materials, m.totalSquares);

    for (const item of costs.items) {
      expect(item.name).toBeTruthy();
      expect(item.quantity).toBeGreaterThan(0);
      expect(item.unit).toBeTruthy();
      expect(item.unitPrice).toBeGreaterThan(0);
      expect(item.totalPrice).toBeCloseTo(item.quantity * item.unitPrice, 2);
    }
  });
});

describe('formatCurrency', () => {
  it('should format dollars with two decimal places', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
  });

  it('should format zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('should format large amounts with commas', () => {
    const result = formatCurrency(12345.67);
    expect(result).toContain('12,345.67');
  });
});
