/**
 * Comprehensive unit tests for colors utility
 * Run with: npx vitest run tests/unit/colors.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  EDGE_COLORS,
  EDGE_LABELS,
  FACET_COLORS,
  FACET_STROKE_COLORS,
  getEdgeColor,
  getFacetColor,
  getFacetStrokeColor,
} from '../../src/utils/colors';

describe('getEdgeColor', () => {
  it('should return correct color for ridge', () => {
    expect(getEdgeColor('ridge')).toBe('#ef4444');
  });

  it('should return correct color for hip', () => {
    expect(getEdgeColor('hip')).toBe('#8b5cf6');
  });

  it('should return correct color for valley', () => {
    expect(getEdgeColor('valley')).toBe('#3b82f6');
  });

  it('should return correct color for rake', () => {
    expect(getEdgeColor('rake')).toBe('#10b981');
  });

  it('should return correct color for eave', () => {
    expect(getEdgeColor('eave')).toBe('#06b6d4');
  });

  it('should return correct color for flashing', () => {
    expect(getEdgeColor('flashing')).toBe('#f97316');
  });

  it('should return correct color for step-flashing', () => {
    expect(getEdgeColor('step-flashing')).toBe('#ec4899');
  });

  it('should return #ffffff for an unknown edge type', () => {
    expect(getEdgeColor('unknown' as any)).toBe('#ffffff');
  });

  it('should return #ffffff for an empty string edge type', () => {
    expect(getEdgeColor('' as any)).toBe('#ffffff');
  });

  it('should return #ffffff for a completely fabricated type', () => {
    expect(getEdgeColor('nonexistent-type' as any)).toBe('#ffffff');
  });
});

describe('getFacetColor', () => {
  const expectedColors = [
    'rgba(245, 158, 11, 0.25)',
    'rgba(59, 130, 246, 0.25)',
    'rgba(16, 185, 129, 0.25)',
    'rgba(139, 92, 246, 0.25)',
    'rgba(236, 72, 153, 0.25)',
    'rgba(249, 115, 22, 0.25)',
    'rgba(6, 182, 212, 0.25)',
    'rgba(132, 204, 22, 0.25)',
  ];

  it('should return correct color for index 0', () => {
    expect(getFacetColor(0)).toBe(expectedColors[0]);
  });

  it('should return correct color for index 1', () => {
    expect(getFacetColor(1)).toBe(expectedColors[1]);
  });

  it('should return correct color for index 2', () => {
    expect(getFacetColor(2)).toBe(expectedColors[2]);
  });

  it('should return correct color for index 3', () => {
    expect(getFacetColor(3)).toBe(expectedColors[3]);
  });

  it('should return correct color for index 4', () => {
    expect(getFacetColor(4)).toBe(expectedColors[4]);
  });

  it('should return correct color for index 5', () => {
    expect(getFacetColor(5)).toBe(expectedColors[5]);
  });

  it('should return correct color for index 6', () => {
    expect(getFacetColor(6)).toBe(expectedColors[6]);
  });

  it('should return correct color for index 7', () => {
    expect(getFacetColor(7)).toBe(expectedColors[7]);
  });

  it('should wrap around for index 8 (modulo)', () => {
    expect(getFacetColor(8)).toBe(expectedColors[0]);
  });

  it('should wrap around for index 9', () => {
    expect(getFacetColor(9)).toBe(expectedColors[1]);
  });

  it('should wrap around for index 15', () => {
    expect(getFacetColor(15)).toBe(expectedColors[7]);
  });

  it('should wrap around for index 16', () => {
    expect(getFacetColor(16)).toBe(expectedColors[0]);
  });

  it('should wrap around for large indices', () => {
    expect(getFacetColor(100)).toBe(expectedColors[100 % 8]);
  });

  it('should return consistent results across multiple cycles', () => {
    for (let i = 0; i < 24; i++) {
      expect(getFacetColor(i)).toBe(expectedColors[i % 8]);
    }
  });
});

describe('getFacetStrokeColor', () => {
  const expectedStrokeColors = [
    '#f59e0b',
    '#3b82f6',
    '#10b981',
    '#8b5cf6',
    '#ec4899',
    '#f97316',
    '#06b6d4',
    '#84cc16',
  ];

  it('should return correct color for index 0', () => {
    expect(getFacetStrokeColor(0)).toBe(expectedStrokeColors[0]);
  });

  it('should return correct color for index 1', () => {
    expect(getFacetStrokeColor(1)).toBe(expectedStrokeColors[1]);
  });

  it('should return correct color for index 2', () => {
    expect(getFacetStrokeColor(2)).toBe(expectedStrokeColors[2]);
  });

  it('should return correct color for index 3', () => {
    expect(getFacetStrokeColor(3)).toBe(expectedStrokeColors[3]);
  });

  it('should return correct color for index 4', () => {
    expect(getFacetStrokeColor(4)).toBe(expectedStrokeColors[4]);
  });

  it('should return correct color for index 5', () => {
    expect(getFacetStrokeColor(5)).toBe(expectedStrokeColors[5]);
  });

  it('should return correct color for index 6', () => {
    expect(getFacetStrokeColor(6)).toBe(expectedStrokeColors[6]);
  });

  it('should return correct color for index 7', () => {
    expect(getFacetStrokeColor(7)).toBe(expectedStrokeColors[7]);
  });

  it('should wrap around for index 8 (modulo)', () => {
    expect(getFacetStrokeColor(8)).toBe(expectedStrokeColors[0]);
  });

  it('should wrap around for index 9', () => {
    expect(getFacetStrokeColor(9)).toBe(expectedStrokeColors[1]);
  });

  it('should wrap around for index 15', () => {
    expect(getFacetStrokeColor(15)).toBe(expectedStrokeColors[7]);
  });

  it('should wrap around for index 16', () => {
    expect(getFacetStrokeColor(16)).toBe(expectedStrokeColors[0]);
  });

  it('should wrap around for large indices', () => {
    expect(getFacetStrokeColor(100)).toBe(expectedStrokeColors[100 % 8]);
  });

  it('should return consistent results across multiple cycles', () => {
    for (let i = 0; i < 24; i++) {
      expect(getFacetStrokeColor(i)).toBe(expectedStrokeColors[i % 8]);
    }
  });
});

describe('EDGE_COLORS', () => {
  it('should have all 7 edge types', () => {
    const expectedTypes = ['ridge', 'hip', 'valley', 'rake', 'eave', 'flashing', 'step-flashing'];
    expect(Object.keys(EDGE_COLORS)).toHaveLength(7);
    for (const type of expectedTypes) {
      expect(EDGE_COLORS).toHaveProperty(type);
    }
  });

  it('should have string color values for every edge type', () => {
    for (const color of Object.values(EDGE_COLORS)) {
      expect(typeof color).toBe('string');
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('should map to the specific expected hex colors', () => {
    expect(EDGE_COLORS.ridge).toBe('#ef4444');
    expect(EDGE_COLORS.hip).toBe('#8b5cf6');
    expect(EDGE_COLORS.valley).toBe('#3b82f6');
    expect(EDGE_COLORS.rake).toBe('#10b981');
    expect(EDGE_COLORS.eave).toBe('#06b6d4');
    expect(EDGE_COLORS.flashing).toBe('#f97316');
    expect(EDGE_COLORS['step-flashing']).toBe('#ec4899');
  });
});

describe('EDGE_LABELS', () => {
  it('should have all 7 edge types', () => {
    const expectedTypes = ['ridge', 'hip', 'valley', 'rake', 'eave', 'flashing', 'step-flashing'];
    expect(Object.keys(EDGE_LABELS)).toHaveLength(7);
    for (const type of expectedTypes) {
      expect(EDGE_LABELS).toHaveProperty(type);
    }
  });

  it('should have human-readable labels for every edge type', () => {
    expect(EDGE_LABELS.ridge).toBe('Ridge');
    expect(EDGE_LABELS.hip).toBe('Hip');
    expect(EDGE_LABELS.valley).toBe('Valley');
    expect(EDGE_LABELS.rake).toBe('Rake');
    expect(EDGE_LABELS.eave).toBe('Eave');
    expect(EDGE_LABELS.flashing).toBe('Flashing');
    expect(EDGE_LABELS['step-flashing']).toBe('Step Flashing');
  });

  it('should have the same keys as EDGE_COLORS', () => {
    const colorKeys = Object.keys(EDGE_COLORS).sort();
    const labelKeys = Object.keys(EDGE_LABELS).sort();
    expect(colorKeys).toEqual(labelKeys);
  });
});

describe('FACET_COLORS', () => {
  it('should have 8 entries', () => {
    expect(FACET_COLORS).toHaveLength(8);
  });

  it('should contain rgba color strings', () => {
    for (const color of FACET_COLORS) {
      expect(typeof color).toBe('string');
      expect(color).toMatch(/^rgba\(/);
    }
  });

  it('should all use 0.25 alpha', () => {
    for (const color of FACET_COLORS) {
      expect(color).toContain('0.25)');
    }
  });
});

describe('FACET_STROKE_COLORS', () => {
  it('should have 8 entries', () => {
    expect(FACET_STROKE_COLORS).toHaveLength(8);
  });

  it('should contain hex color strings', () => {
    for (const color of FACET_STROKE_COLORS) {
      expect(typeof color).toBe('string');
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('should have the same length as FACET_COLORS', () => {
    expect(FACET_STROKE_COLORS).toHaveLength(FACET_COLORS.length);
  });
});
