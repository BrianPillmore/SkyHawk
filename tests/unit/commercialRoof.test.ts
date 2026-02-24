/**
 * Unit tests for commercial roof calculations
 * Run with: npx vitest run tests/unit/commercialRoof.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  classifyRoofSection,
  calculateCommercialArea,
  calculatePerimeter,
  calculateParapetLength,
  calculateRooftopPenetrations,
  generateSectionReport,
  mergeCommercialSections,
} from '../../src/utils/commercialRoof';
import type {
  CommercialRoofSection,
  ParapetSegment,
  RooftopUnit,
} from '../../src/types/commercial';

// ─── Helper factories ───────────────────────────────────────────────

function createSection(overrides: Partial<CommercialRoofSection> = {}): CommercialRoofSection {
  return {
    id: 'section-1',
    name: 'Section A - Main Building',
    roofType: 'flat',
    areaSqFt: 25000,
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

function createRooftopUnit(overrides: Partial<RooftopUnit> = {}): RooftopUnit {
  return {
    id: 'unit-1',
    type: 'hvac',
    widthFt: 6,
    lengthFt: 8,
    heightFt: 4,
    lat: 35.0,
    lng: -97.0,
    flashingCondition: 'good',
    ...overrides,
  };
}

// ─── classifyRoofSection ────────────────────────────────────────────

describe('classifyRoofSection', () => {
  it('should classify 0 pitch as flat', () => {
    expect(classifyRoofSection(0)).toBe('flat');
  });

  it('should classify 0.25/12 pitch as flat', () => {
    expect(classifyRoofSection(0.25)).toBe('flat');
  });

  it('should classify 0.49/12 pitch as flat', () => {
    expect(classifyRoofSection(0.49)).toBe('flat');
  });

  it('should classify 0.5/12 pitch as low-slope', () => {
    expect(classifyRoofSection(0.5)).toBe('low-slope');
  });

  it('should classify 1/12 pitch as low-slope', () => {
    expect(classifyRoofSection(1)).toBe('low-slope');
  });

  it('should classify 1.99/12 pitch as low-slope', () => {
    expect(classifyRoofSection(1.99)).toBe('low-slope');
  });

  it('should classify 2/12 pitch as metal-standing-seam', () => {
    expect(classifyRoofSection(2)).toBe('metal-standing-seam');
  });

  it('should classify 6/12 pitch as metal-standing-seam', () => {
    expect(classifyRoofSection(6)).toBe('metal-standing-seam');
  });
});

// ─── calculateCommercialArea ────────────────────────────────────────

describe('calculateCommercialArea', () => {
  it('should return 0 for fewer than 3 vertices', () => {
    expect(calculateCommercialArea([])).toBe(0);
    expect(calculateCommercialArea([{ lat: 35, lng: -97 }])).toBe(0);
    expect(calculateCommercialArea([{ lat: 35, lng: -97 }, { lat: 35.001, lng: -97 }])).toBe(0);
  });

  it('should calculate area for a simple rectangle', () => {
    // A roughly 100ft x 200ft rectangle near Oklahoma City
    // At lat 35, 1 degree lat ≈ 364,000 ft, 1 degree lng ≈ 298,000 ft
    const vertices = [
      { lat: 35.0, lng: -97.0 },
      { lat: 35.0, lng: -96.99933 }, // ~200 ft east
      { lat: 35.00027, lng: -96.99933 }, // ~100 ft north
      { lat: 35.00027, lng: -97.0 },
    ];
    const area = calculateCommercialArea(vertices);
    // Should be approximately 20,000 sqft (100 x 200)
    expect(area).toBeGreaterThan(15000);
    expect(area).toBeLessThan(25000);
  });

  it('should calculate area for a triangle', () => {
    const vertices = [
      { lat: 35.0, lng: -97.0 },
      { lat: 35.0, lng: -96.99933 },
      { lat: 35.00027, lng: -97.0 },
    ];
    const area = calculateCommercialArea(vertices);
    // Triangle is half the rectangle
    expect(area).toBeGreaterThan(7000);
    expect(area).toBeLessThan(13000);
  });
});

// ─── calculatePerimeter ────────────────────────────────────────────

describe('calculatePerimeter', () => {
  it('should return 0 for fewer than 2 vertices', () => {
    expect(calculatePerimeter([])).toBe(0);
    expect(calculatePerimeter([{ lat: 35, lng: -97 }])).toBe(0);
  });

  it('should calculate perimeter for a rectangle', () => {
    const vertices = [
      { lat: 35.0, lng: -97.0 },
      { lat: 35.0, lng: -96.99933 },
      { lat: 35.00027, lng: -96.99933 },
      { lat: 35.00027, lng: -97.0 },
    ];
    const perimeter = calculatePerimeter(vertices);
    // Perimeter of ~100x200 rectangle = ~600 ft
    expect(perimeter).toBeGreaterThan(400);
    expect(perimeter).toBeLessThan(800);
  });
});

// ─── calculateParapetLength ─────────────────────────────────────────

describe('calculateParapetLength', () => {
  it('should return zeros for empty array', () => {
    const result = calculateParapetLength([]);
    expect(result.totalLf).toBe(0);
    expect(result.copingLf).toBe(0);
  });

  it('should calculate total and coping lengths', () => {
    const segments = [
      createParapet({ lengthFt: 100, copingType: 'metal' }),
      createParapet({ id: 'p2', lengthFt: 80, copingType: 'stone' }),
      createParapet({ id: 'p3', lengthFt: 50, copingType: 'none' }),
    ];
    const result = calculateParapetLength(segments);
    expect(result.totalLf).toBe(230); // 100 + 80 + 50
    expect(result.copingLf).toBe(180); // 100 + 80 (none excluded)
  });

  it('should count all as coping when none have copingType "none"', () => {
    const segments = [
      createParapet({ lengthFt: 50, copingType: 'metal' }),
      createParapet({ id: 'p2', lengthFt: 75, copingType: 'concrete' }),
    ];
    const result = calculateParapetLength(segments);
    expect(result.totalLf).toBe(125);
    expect(result.copingLf).toBe(125);
  });
});

// ─── calculateRooftopPenetrations ───────────────────────────────────

describe('calculateRooftopPenetrations', () => {
  it('should return zeros for empty array', () => {
    const result = calculateRooftopPenetrations([]);
    expect(result.totalArea).toBe(0);
    expect(result.flashingPerimeter).toBe(0);
  });

  it('should calculate area and perimeter for a single unit', () => {
    const units = [createRooftopUnit({ widthFt: 6, lengthFt: 8 })];
    const result = calculateRooftopPenetrations(units);
    expect(result.totalArea).toBe(48); // 6 * 8
    expect(result.flashingPerimeter).toBe(28); // 2*(6+8)
  });

  it('should aggregate multiple units', () => {
    const units = [
      createRooftopUnit({ widthFt: 6, lengthFt: 8 }),
      createRooftopUnit({ id: 'u2', widthFt: 4, lengthFt: 4 }),
      createRooftopUnit({ id: 'u3', widthFt: 2, lengthFt: 3 }),
    ];
    const result = calculateRooftopPenetrations(units);
    expect(result.totalArea).toBe(48 + 16 + 6); // 70
    expect(result.flashingPerimeter).toBe(28 + 16 + 10); // 54
  });
});

// ─── generateSectionReport ──────────────────────────────────────────

describe('generateSectionReport', () => {
  it('should generate a section summary', () => {
    const section = createSection({
      yearInstalled: 2015,
    });
    const report = generateSectionReport(section);
    expect(report.sectionId).toBe('section-1');
    expect(report.name).toBe('Section A - Main Building');
    expect(report.roofType).toBe('flat');
    expect(report.areaSqFt).toBe(25000);
    expect(report.condition).toBe('good');
    expect(report.slopeInPerFt).toBe(0.25);
    // Age should be current year - 2015
    const expectedAge = new Date().getFullYear() - 2015;
    expect(report.ageYears).toBe(expectedAge);
  });

  it('should return null age when yearInstalled is undefined', () => {
    const section = createSection({ yearInstalled: undefined });
    const report = generateSectionReport(section);
    expect(report.ageYears).toBeNull();
  });
});

// ─── mergeCommercialSections ────────────────────────────────────────

describe('mergeCommercialSections', () => {
  it('should return empty summary for no sections', () => {
    const result = mergeCommercialSections([]);
    expect(result.totalAreaSqFt).toBe(0);
    expect(result.sectionCount).toBe(0);
    expect(result.sections).toHaveLength(0);
    expect(result.predominantRoofType).toBe('flat');
    expect(result.overallCondition).toBe('good');
    expect(result.totalPerimeterLf).toBe(0);
  });

  it('should aggregate areas from multiple sections', () => {
    const sections = [
      createSection({ id: 's1', areaSqFt: 10000 }),
      createSection({ id: 's2', areaSqFt: 15000 }),
      createSection({ id: 's3', areaSqFt: 5000 }),
    ];
    const result = mergeCommercialSections(sections);
    expect(result.totalAreaSqFt).toBe(30000);
    expect(result.sectionCount).toBe(3);
    expect(result.sections).toHaveLength(3);
  });

  it('should find predominant roof type by area', () => {
    const sections = [
      createSection({ id: 's1', areaSqFt: 10000, roofType: 'flat' }),
      createSection({ id: 's2', areaSqFt: 25000, roofType: 'single-ply' }),
      createSection({ id: 's3', areaSqFt: 5000, roofType: 'flat' }),
    ];
    const result = mergeCommercialSections(sections);
    // single-ply has 25000 vs flat 15000
    expect(result.predominantRoofType).toBe('single-ply');
  });

  it('should use worst condition as overall', () => {
    const sections = [
      createSection({ id: 's1', condition: 'good' }),
      createSection({ id: 's2', condition: 'fair' }),
      createSection({ id: 's3', condition: 'good' }),
    ];
    expect(mergeCommercialSections(sections).overallCondition).toBe('fair');
  });

  it('should detect "failed" as worst condition', () => {
    const sections = [
      createSection({ id: 's1', condition: 'good' }),
      createSection({ id: 's2', condition: 'failed' }),
    ];
    expect(mergeCommercialSections(sections).overallCondition).toBe('failed');
  });

  it('should detect "poor" condition above "fair"', () => {
    const sections = [
      createSection({ id: 's1', condition: 'fair' }),
      createSection({ id: 's2', condition: 'poor' }),
    ];
    expect(mergeCommercialSections(sections).overallCondition).toBe('poor');
  });
});
