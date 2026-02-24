/**
 * Unit tests for accuracy scoring system
 */
import { describe, it, expect } from 'vitest';
import { computeAccuracyScore } from '../../src/utils/accuracyScore';
import type { RoofMeasurement } from '../../src/types';
import type { SolarBuildingInsights } from '../../src/types/solar';

function makeMeasurement(overrides: Partial<RoofMeasurement> = {}): RoofMeasurement {
  return {
    id: 'test-1',
    propertyId: 'prop-1',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    vertices: [],
    edges: [],
    facets: [
      { id: 'f1', name: 'Facet 1', vertexIds: [], pitch: 7, areaSqFt: 2000, trueAreaSqFt: 2200, edgeIds: [] },
      { id: 'f2', name: 'Facet 2', vertexIds: [], pitch: 7, areaSqFt: 1800, trueAreaSqFt: 2000, edgeIds: [] },
    ],
    totalAreaSqFt: 3800,
    totalTrueAreaSqFt: 4200,
    totalSquares: 42,
    predominantPitch: 7,
    totalRidgeLf: 40,
    totalHipLf: 60,
    totalValleyLf: 20,
    totalRakeLf: 80,
    totalEaveLf: 100,
    totalFlashingLf: 10,
    totalStepFlashingLf: 0,
    totalDripEdgeLf: 180,
    suggestedWastePercent: 15,
    ridgeCount: 1,
    hipCount: 4,
    valleyCount: 2,
    rakeCount: 4,
    eaveCount: 4,
    flashingCount: 1,
    stepFlashingCount: 0,
    structureComplexity: 'Normal',
    estimatedAtticSqFt: 3800,
    pitchBreakdown: [],
    ...overrides,
  } as RoofMeasurement;
}

function makeSolarInsights(opts: {
  areaM2?: number;
  segments?: number;
} = {}): SolarBuildingInsights {
  const segCount = opts.segments ?? 4;
  return {
    name: 'test',
    center: { latitude: 40, longitude: -90 },
    boundingBox: {
      sw: { latitude: 39.999, longitude: -90.001 },
      ne: { latitude: 40.001, longitude: -89.999 },
    },
    imageryDate: { year: 2024, month: 6, day: 15 },
    imageryProcessedDate: { year: 2024, month: 7, day: 1 },
    postalCode: '73099',
    administrativeArea: 'OK',
    statisticalArea: '',
    regionCode: 'US',
    imageryQuality: 'HIGH',
    solarPotential: {
      maxArrayPanelsCount: 20,
      maxArrayAreaMeters2: 50,
      maxSunshineHoursPerYear: 1800,
      carbonOffsetFactorKgPerMwh: 500,
      wholeRoofStats: {
        areaMeters2: opts.areaM2 ?? 390, // ~4200 sq ft
        sunshineQuantiles: [],
        groundAreaMeters2: 350,
      },
      roofSegmentStats: Array.from({ length: segCount }, (_, i) => ({
        pitchDegrees: 30,
        azimuthDegrees: i * (360 / segCount),
        stats: { areaMeters2: (opts.areaM2 ?? 390) / segCount, sunshineQuantiles: [], groundAreaMeters2: 87.5 },
        center: { latitude: 40, longitude: -90 },
        boundingBox: {
          sw: { latitude: 39.999, longitude: -90.001 },
          ne: { latitude: 40.001, longitude: -89.999 },
        },
        planeHeightAtCenterMeters: 5,
      })),
      buildingStats: { areaMeters2: 400, sunshineQuantiles: [], groundAreaMeters2: 400 },
    },
  };
}

describe('computeAccuracyScore', () => {
  it('should return high score for LIDAR + HIGH quality + matching area', () => {
    const m = makeMeasurement({
      dataSource: 'lidar-mask',
      imageryQuality: 'HIGH',
    });
    const solar = makeSolarInsights({ areaM2: 390, segments: 2 });
    const result = computeAccuracyScore(m, solar);

    expect(result.overallScore).toBeGreaterThanOrEqual(80);
    expect(result.grade).toMatch(/A/);
    expect(result.label).toContain('High');
    expect(result.factors.dataSource.score).toBe(30);
    expect(result.factors.imageryQuality.score).toBe(20);
  });

  it('should return lower score for AI Vision + no solar data', () => {
    const m = makeMeasurement({
      dataSource: 'ai-vision',
    });
    const result = computeAccuracyScore(m, null);

    expect(result.overallScore).toBeLessThan(70);
    expect(result.factors.dataSource.score).toBe(15);
  });

  it('should return lowest score for manual measurement', () => {
    const m = makeMeasurement({
      dataSource: undefined,
      facets: [{ id: 'f1', name: 'Facet 1', vertexIds: [], pitch: 0, areaSqFt: 100, trueAreaSqFt: 100, edgeIds: [] }],
    });
    const result = computeAccuracyScore(m, null);

    expect(result.overallScore).toBeLessThan(55);
    expect(result.factors.dataSource.score).toBe(8);
  });

  it('should penalize MEDIUM quality imagery', () => {
    const m = makeMeasurement({
      dataSource: 'lidar-mask',
      imageryQuality: 'MEDIUM',
    });
    const solar = makeSolarInsights({ areaM2: 390 });
    const result = computeAccuracyScore(m, solar);

    expect(result.factors.imageryQuality.score).toBe(10);
    expect(result.factors.imageryQuality.label).toContain('MEDIUM');
  });

  it('should reward area within 5% of Solar API', () => {
    // Measured: 4200 sq ft, Solar: ~4200 sq ft (390 m2 * 10.7639)
    const m = makeMeasurement({
      dataSource: 'lidar-mask',
      imageryQuality: 'HIGH',
      totalTrueAreaSqFt: 4200,
    });
    const solar = makeSolarInsights({ areaM2: 390 }); // 390 * 10.7639 = 4197.9
    const result = computeAccuracyScore(m, solar);

    expect(result.factors.areaValidation.score).toBe(25);
    expect(result.areaDeltaPercent).toBeLessThan(5);
  });

  it('should penalize large area deviation', () => {
    const m = makeMeasurement({
      dataSource: 'lidar-mask',
      imageryQuality: 'HIGH',
      totalTrueAreaSqFt: 8000, // much larger than Solar API says
    });
    const solar = makeSolarInsights({ areaM2: 390 }); // ~4200 sq ft
    const result = computeAccuracyScore(m, solar);

    expect(result.factors.areaValidation.score).toBeLessThanOrEqual(10);
    expect(result.areaDeltaPercent).toBeGreaterThan(25);
  });

  it('should reward matching facet count to Solar API segments', () => {
    const m = makeMeasurement({
      facets: Array.from({ length: 4 }, (_, i) => ({
        id: `f${i}`, name: `Facet ${i + 1}`, vertexIds: [], pitch: 7,
        areaSqFt: 1000, trueAreaSqFt: 1100, edgeIds: [],
      })),
    });
    const solar = makeSolarInsights({ segments: 4 });
    const result = computeAccuracyScore(m, solar);

    expect(result.factors.facetCount.score).toBe(15);
    expect(result.factors.facetCount.label).toContain('matched');
  });

  it('should detect inconsistent pitch across facets', () => {
    const m = makeMeasurement({
      facets: [
        { id: 'f1', name: 'Facet 1', vertexIds: [], pitch: 4, areaSqFt: 1000, trueAreaSqFt: 1100, edgeIds: [] },
        { id: 'f2', name: 'Facet 2', vertexIds: [], pitch: 12, areaSqFt: 1000, trueAreaSqFt: 1100, edgeIds: [] },
        { id: 'f3', name: 'Facet 3', vertexIds: [], pitch: 20, areaSqFt: 1000, trueAreaSqFt: 1100, edgeIds: [] },
      ],
    });
    const result = computeAccuracyScore(m, null);

    expect(result.factors.pitchConsistency.score).toBeLessThanOrEqual(5);
  });

  it('should clamp score between 0 and 100', () => {
    const m = makeMeasurement({
      dataSource: 'lidar-mask',
      imageryQuality: 'HIGH',
    });
    const solar = makeSolarInsights({ areaM2: 390 });
    const result = computeAccuracyScore(m, solar);

    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it('should assign correct grades based on score', () => {
    // LIDAR + HIGH + matched = should be A range
    const highM = makeMeasurement({
      dataSource: 'lidar-mask',
      imageryQuality: 'HIGH',
      totalTrueAreaSqFt: 4200,
    });
    const solar = makeSolarInsights({ areaM2: 390, segments: 2 });
    const highResult = computeAccuracyScore(highM, solar);
    expect(['A+', 'A']).toContain(highResult.grade);

    // Manual + no solar = should be C or D
    const lowM = makeMeasurement({
      dataSource: undefined,
      imageryQuality: undefined,
      facets: [{ id: 'f1', name: 'F1', vertexIds: [], pitch: 0, areaSqFt: 100, trueAreaSqFt: 100, edgeIds: [] }],
    });
    const lowResult = computeAccuracyScore(lowM, null);
    expect(['C', 'D']).toContain(lowResult.grade);
  });

  it('should handle measurement with no facets', () => {
    const m = makeMeasurement({
      facets: [],
      totalTrueAreaSqFt: 0,
      totalAreaSqFt: 0,
    });
    const result = computeAccuracyScore(m, null);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it('should handle null solar insights gracefully', () => {
    const m = makeMeasurement({ dataSource: 'lidar-mask' });
    const result = computeAccuracyScore(m, null);

    expect(result.factors.areaValidation.label).toContain('No cross-validation');
    expect(result.overallScore).toBeGreaterThan(0);
  });
});
