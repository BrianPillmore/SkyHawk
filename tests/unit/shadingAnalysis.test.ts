import { describe, it, expect } from 'vitest';
import {
  calculateSolarAltitude,
  calculateSolarAzimuth,
  estimateShadeFraction,
  analyzeHourlyShading,
  analyzeShadingProfile,
  analyzeSunshineQuantiles,
  analyzeSegmentShading,
  validatePanelPlacement,
} from '../../src/utils/shadingAnalysis';
import type { SolarBuildingInsights, SolarRoofSegment } from '../../src/types/solar';

describe('Shading Analysis', () => {
  // Denver, CO latitude for testing
  const DENVER_LAT = 39.74;

  describe('calculateSolarAltitude', () => {
    it('should return 0 for nighttime hours', () => {
      // At midnight, sun should be below horizon
      const alt = calculateSolarAltitude(DENVER_LAT, 172, 0);
      expect(alt).toBe(0);
    });

    it('should return positive value at solar noon in summer', () => {
      // June 21 (day 172), noon
      const alt = calculateSolarAltitude(DENVER_LAT, 172, 12);
      expect(alt).toBeGreaterThan(50);
    });

    it('should be highest at solar noon', () => {
      const day = 172; // summer solstice
      const morning = calculateSolarAltitude(DENVER_LAT, day, 9);
      const noon = calculateSolarAltitude(DENVER_LAT, day, 12);
      const afternoon = calculateSolarAltitude(DENVER_LAT, day, 15);

      expect(noon).toBeGreaterThan(morning);
      expect(noon).toBeGreaterThan(afternoon);
    });

    it('should be higher in summer than winter at noon', () => {
      const summer = calculateSolarAltitude(DENVER_LAT, 172, 12); // June 21
      const winter = calculateSolarAltitude(DENVER_LAT, 355, 12); // Dec 21

      expect(summer).toBeGreaterThan(winter);
    });

    it('should be higher at equator than at high latitude', () => {
      const equator = calculateSolarAltitude(0, 80, 12); // equinox
      const highLat = calculateSolarAltitude(60, 80, 12);

      expect(equator).toBeGreaterThan(highLat);
    });

    it('should never return negative values', () => {
      for (let hour = 0; hour < 24; hour++) {
        const alt = calculateSolarAltitude(DENVER_LAT, 1, hour);
        expect(alt).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('calculateSolarAzimuth', () => {
    it('should return 0 when sun is below horizon', () => {
      const az = calculateSolarAzimuth(DENVER_LAT, 172, 0);
      expect(az).toBe(0);
    });

    it('should be roughly south (~180) at solar noon in northern hemisphere', () => {
      const az = calculateSolarAzimuth(DENVER_LAT, 172, 12);
      expect(az).toBeGreaterThan(150);
      expect(az).toBeLessThan(210);
    });

    it('should be east-ish in morning and west-ish in afternoon', () => {
      const morning = calculateSolarAzimuth(DENVER_LAT, 172, 8);
      const afternoon = calculateSolarAzimuth(DENVER_LAT, 172, 16);

      // Morning should be east (< 180), afternoon west (> 180)
      expect(morning).toBeLessThan(180);
      expect(afternoon).toBeGreaterThan(180);
    });
  });

  describe('estimateShadeFraction', () => {
    it('should return 1.0 when sun is below horizon', () => {
      expect(estimateShadeFraction(0)).toBe(1.0);
      expect(estimateShadeFraction(-5)).toBe(1.0);
    });

    it('should return 0.8 when sun is below obstruction angle', () => {
      expect(estimateShadeFraction(10, 15)).toBe(0.8);
    });

    it('should return 0 when sun is well above obstructions', () => {
      expect(estimateShadeFraction(50, 15)).toBe(0);
    });

    it('should return partial shade in transition zone', () => {
      const shade = estimateShadeFraction(20, 15);
      expect(shade).toBeGreaterThan(0);
      expect(shade).toBeLessThan(0.8);
    });

    it('should respect custom obstruction angle', () => {
      // With higher obstruction, same altitude might still be shaded
      const lowObstruction = estimateShadeFraction(20, 10);
      const highObstruction = estimateShadeFraction(20, 20);

      expect(highObstruction).toBeGreaterThan(lowObstruction);
    });

    it('should default to 15-degree obstruction angle', () => {
      const withDefault = estimateShadeFraction(10);
      const withExplicit = estimateShadeFraction(10, 15);
      expect(withDefault).toBe(withExplicit);
    });
  });

  describe('analyzeHourlyShading', () => {
    it('should return entries from hour 5 to 20', () => {
      const hourly = analyzeHourlyShading(DENVER_LAT, 172);
      expect(hourly.length).toBe(16); // 5-20 inclusive
      expect(hourly[0].hour).toBe(5);
      expect(hourly[hourly.length - 1].hour).toBe(20);
    });

    it('should include all required fields', () => {
      const hourly = analyzeHourlyShading(DENVER_LAT, 172);
      for (const h of hourly) {
        expect(h).toHaveProperty('hour');
        expect(h).toHaveProperty('shadeFraction');
        expect(h).toHaveProperty('solarAltitude');
        expect(h).toHaveProperty('solarAzimuth');
      }
    });

    it('should show less shade at midday in summer', () => {
      const hourly = analyzeHourlyShading(DENVER_LAT, 172);
      const morning = hourly.find(h => h.hour === 6)!;
      const noon = hourly.find(h => h.hour === 12)!;

      expect(noon.shadeFraction).toBeLessThanOrEqual(morning.shadeFraction);
    });

    it('should accept custom obstruction angle', () => {
      const lowObs = analyzeHourlyShading(DENVER_LAT, 172, 5);
      const highObs = analyzeHourlyShading(DENVER_LAT, 172, 30);

      const lowNoon = lowObs.find(h => h.hour === 12)!;
      const highNoon = highObs.find(h => h.hour === 12)!;

      expect(highNoon.shadeFraction).toBeGreaterThanOrEqual(lowNoon.shadeFraction);
    });
  });

  describe('analyzeShadingProfile', () => {
    it('should return 12 monthly entries', () => {
      const result = analyzeShadingProfile(DENVER_LAT);
      expect(result.monthlyAnalysis.length).toBe(12);
    });

    it('should include month names', () => {
      const result = analyzeShadingProfile(DENVER_LAT);
      expect(result.monthlyAnalysis[0].monthName).toBe('January');
      expect(result.monthlyAnalysis[5].monthName).toBe('June');
      expect(result.monthlyAnalysis[11].monthName).toBe('December');
    });

    it('should identify best and worst months', () => {
      const result = analyzeShadingProfile(DENVER_LAT);

      expect(result.bestMonth).toHaveProperty('month');
      expect(result.bestMonth).toHaveProperty('name');
      expect(result.bestMonth).toHaveProperty('shadeFraction');
      expect(result.worstMonth).toHaveProperty('month');

      // Best month should have less shade than worst
      expect(result.bestMonth.shadeFraction).toBeLessThanOrEqual(result.worstMonth.shadeFraction);
    });

    it('should have summer as less shaded than winter', () => {
      const result = analyzeShadingProfile(DENVER_LAT);
      const june = result.monthlyAnalysis[5];
      const december = result.monthlyAnalysis[11];

      expect(june.avgShadeFraction).toBeLessThan(december.avgShadeFraction);
    });

    it('should calculate annual averages', () => {
      const result = analyzeShadingProfile(DENVER_LAT);

      expect(result.annualShadeFraction).toBeGreaterThanOrEqual(0);
      expect(result.annualShadeFraction).toBeLessThanOrEqual(1);
      expect(result.annualEffectiveSunHours).toBeGreaterThan(0);
      expect(result.shadingImpactPercent).toBeGreaterThanOrEqual(0);
      expect(result.shadingImpactPercent).toBeLessThanOrEqual(100);
    });

    it('should show more effective sun hours with lower obstruction', () => {
      const lowObs = analyzeShadingProfile(DENVER_LAT, 5);
      const highObs = analyzeShadingProfile(DENVER_LAT, 30);

      expect(lowObs.annualEffectiveSunHours).toBeGreaterThan(highObs.annualEffectiveSunHours);
    });

    it('should include peak sun hours per month', () => {
      const result = analyzeShadingProfile(DENVER_LAT);
      for (const month of result.monthlyAnalysis) {
        expect(month.peakSunHours).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

// ─── Sunshine Quantile Analysis Tests ─────────────────────────────

function createSegment(overrides: Partial<SolarRoofSegment> = {}): SolarRoofSegment {
  return {
    pitchDegrees: 27,
    azimuthDegrees: 180,
    stats: {
      areaMeters2: 50,
      sunshineQuantiles: [800, 900, 1000, 1100, 1200, 1300, 1400, 1450, 1500, 1550, 1600],
      groundAreaMeters2: 45,
    },
    center: { latitude: 35, longitude: -97 },
    boundingBox: {
      sw: { latitude: 34.99, longitude: -97.01 },
      ne: { latitude: 35.01, longitude: -96.99 },
    },
    planeHeightAtCenterMeters: 5,
    ...overrides,
  };
}

function createTestInsights(segments?: SolarRoofSegment[]): SolarBuildingInsights {
  const segs = segments ?? [
    createSegment(),
    createSegment({
      azimuthDegrees: 0,
      stats: {
        areaMeters2: 40,
        sunshineQuantiles: [400, 500, 600, 700, 800, 900, 1000, 1050, 1100, 1150, 1200],
        groundAreaMeters2: 35,
      },
    }),
  ];

  return {
    name: 'buildings/test',
    center: { latitude: 35, longitude: -97 },
    boundingBox: {
      sw: { latitude: 34.99, longitude: -97.01 },
      ne: { latitude: 35.01, longitude: -96.99 },
    },
    imageryDate: { year: 2023, month: 6, day: 15 },
    imageryProcessedDate: { year: 2023, month: 7, day: 1 },
    postalCode: '73034',
    administrativeArea: 'OK',
    statisticalArea: '',
    regionCode: 'US',
    imageryQuality: 'HIGH',
    solarPotential: {
      maxArrayPanelsCount: 30,
      maxArrayAreaMeters2: 60,
      maxSunshineHoursPerYear: 1800,
      carbonOffsetFactorKgPerMwh: 417,
      wholeRoofStats: {
        areaMeters2: 90,
        sunshineQuantiles: [600, 750, 900, 1050, 1100, 1200, 1300, 1350, 1400, 1500, 1600],
        groundAreaMeters2: 80,
      },
      roofSegmentStats: segs,
      buildingStats: {
        areaMeters2: 90,
        sunshineQuantiles: [600, 750, 900, 1050, 1100, 1200, 1300, 1350, 1400, 1500, 1600],
        groundAreaMeters2: 80,
      },
      solarPanels: [
        { center: { latitude: 35.001, longitude: -97.001 }, orientation: 'LANDSCAPE', yearlyEnergyDcKwh: 400, segmentIndex: 0 },
        { center: { latitude: 35.001, longitude: -97.001 }, orientation: 'LANDSCAPE', yearlyEnergyDcKwh: 400, segmentIndex: 0 },
        { center: { latitude: 35.001, longitude: -97.001 }, orientation: 'LANDSCAPE', yearlyEnergyDcKwh: 400, segmentIndex: 0 },
        { center: { latitude: 35.001, longitude: -97.001 }, orientation: 'LANDSCAPE', yearlyEnergyDcKwh: 400, segmentIndex: 0 },
        { center: { latitude: 35.001, longitude: -97.001 }, orientation: 'LANDSCAPE', yearlyEnergyDcKwh: 400, segmentIndex: 0 },
        { center: { latitude: 35.002, longitude: -97.002 }, orientation: 'LANDSCAPE', yearlyEnergyDcKwh: 300, segmentIndex: 1 },
        { center: { latitude: 35.002, longitude: -97.002 }, orientation: 'LANDSCAPE', yearlyEnergyDcKwh: 300, segmentIndex: 1 },
      ],
      solarPanelConfigs: [
        {
          panelsCount: 7,
          yearlyEnergyDcKwh: 2600,
          roofSegmentSummaries: [
            { pitchDegrees: 27, azimuthDegrees: 180, panelsCount: 5, yearlyEnergyDcKwh: 2000, segmentIndex: 0 },
            { pitchDegrees: 27, azimuthDegrees: 0, panelsCount: 2, yearlyEnergyDcKwh: 600, segmentIndex: 1 },
          ],
        },
      ],
    },
  };
}

describe('analyzeSunshineQuantiles', () => {
  it('should return isApiSourced = true', () => {
    const insights = createTestInsights();
    const result = analyzeSunshineQuantiles(insights);
    expect(result.isApiSourced).toBe(true);
  });

  it('should return whole-roof median and max hours', () => {
    const insights = createTestInsights();
    const result = analyzeSunshineQuantiles(insights);
    expect(result.wholeRoofMedianHours).toBe(1200); // Q50 = index 5
    expect(result.wholeRoofMaxHours).toBe(1600); // Q100 = index 10
  });

  it('should return segment scores for each roof segment', () => {
    const insights = createTestInsights();
    const result = analyzeSunshineQuantiles(insights);
    expect(result.segmentScores).toHaveLength(2);
  });

  it('should rate south-facing segment with good sunshine as minimal/low shading', () => {
    const insights = createTestInsights();
    const result = analyzeSunshineQuantiles(insights);
    const south = result.segmentScores[0];
    expect(['minimal', 'low']).toContain(south.shadingRating);
  });

  it('should rate north-facing segment with lower sunshine as more shaded', () => {
    const insights = createTestInsights();
    const result = analyzeSunshineQuantiles(insights);
    const north = result.segmentScores[1];
    expect(north.shadingQuality).toBeLessThan(result.segmentScores[0].shadingQuality);
  });

  it('should calculate overall shading impact between 0 and 100', () => {
    const insights = createTestInsights();
    const result = analyzeSunshineQuantiles(insights);
    expect(result.overallShadingImpact).toBeGreaterThanOrEqual(0);
    expect(result.overallShadingImpact).toBeLessThanOrEqual(100);
  });

  it('should have higher uniformity for segments with narrow IQR', () => {
    // Uniform segment: all quantiles close together
    const uniform = createSegment({
      stats: { areaMeters2: 50, sunshineQuantiles: [1490, 1495, 1497, 1498, 1499, 1500, 1501, 1502, 1503, 1505, 1510], groundAreaMeters2: 45 },
    });
    // Variable segment: wide spread
    const variable = createSegment({
      stats: { areaMeters2: 50, sunshineQuantiles: [200, 400, 600, 800, 1000, 1200, 1400, 1500, 1600, 1700, 1800], groundAreaMeters2: 45 },
    });

    const uniformScore = analyzeSegmentShading(uniform, 0, 1600);
    const variableScore = analyzeSegmentShading(variable, 1, 1800);

    expect(uniformScore.uniformityScore).toBeGreaterThan(variableScore.uniformityScore);
  });

  it('should handle empty quantiles gracefully', () => {
    const emptyQ = createSegment({
      stats: { areaMeters2: 50, sunshineQuantiles: [], groundAreaMeters2: 45 },
    });
    const result = analyzeSegmentShading(emptyQ, 0, 1600);
    expect(result.medianSunshineHours).toBe(0);
    expect(result.uniformityScore).toBe(1); // no range = perfectly uniform
  });
});

describe('analyzeSegmentShading', () => {
  it('should compute IQR from Q75 - Q25', () => {
    const seg = createSegment();
    const result = analyzeSegmentShading(seg, 0, 1600);
    // Q75 = index 7 = 1450, Q25 = index 2.5 → rounded to index 3 = 1100
    // Actually: Q25 → percentile 25, idx = round(25/10) = 3 → 1100
    // Q75 → percentile 75, idx = round(75/10) = 8 → 1500
    expect(result.iqr).toBe(1500 - 1100);
  });

  it('should compute shading quality as median / roof max', () => {
    const seg = createSegment();
    const result = analyzeSegmentShading(seg, 0, 1600);
    // median (Q50) = index 5 = 1300
    expect(result.shadingQuality).toBeCloseTo(1300 / 1600, 2);
  });

  it('should convert area to sq ft', () => {
    const seg = createSegment({ stats: { areaMeters2: 100, sunshineQuantiles: [0,0,0,0,0,0,0,0,0,0,0], groundAreaMeters2: 90 } });
    const result = analyzeSegmentShading(seg, 0, 1600);
    expect(result.areaSqFt).toBe(Math.round(100 * 10.7639));
  });

  it('should assign rating based on shading quality', () => {
    // Quality >= 0.90 → minimal
    const highQ = createSegment({
      stats: { areaMeters2: 50, sunshineQuantiles: [1400,1420,1440,1460,1480,1500,1520,1540,1560,1580,1600], groundAreaMeters2: 45 },
    });
    const result = analyzeSegmentShading(highQ, 0, 1600);
    expect(result.shadingRating).toBe('minimal');

    // Quality < 0.55 → high
    const lowQ = createSegment({
      stats: { areaMeters2: 50, sunshineQuantiles: [100,150,200,300,400,500,600,650,700,750,800], groundAreaMeters2: 45 },
    });
    const resultLow = analyzeSegmentShading(lowQ, 0, 1600);
    expect(resultLow.shadingRating).toBe('high');
  });
});

describe('validatePanelPlacement', () => {
  it('should count total panels from API', () => {
    const insights = createTestInsights();
    const result = validatePanelPlacement(insights);
    expect(result.googlePanelCount).toBe(7);
  });

  it('should count panels per segment', () => {
    const insights = createTestInsights();
    const result = validatePanelPlacement(insights);
    expect(result.segmentPanelCounts).toHaveLength(2);
    expect(result.segmentPanelCounts[0].panelCount).toBe(5);
    expect(result.segmentPanelCounts[1].panelCount).toBe(2);
  });

  it('should compute placement ratio', () => {
    const insights = createTestInsights();
    const result = validatePanelPlacement(insights);
    expect(result.placementRatio).toBeGreaterThan(0);
  });

  it('should detect obstructions when Google places significantly fewer panels', () => {
    const insights = createTestInsights();
    // Segment 0 has 50 m² * 10.7639 = 538 sqft * 0.80 = 430 usable / 17.55 = ~24 expected
    // But Google only places 5 → that's way fewer → should be detected
    const result = validatePanelPlacement(insights);
    const seg0 = result.possibleObstructions.find(o => o.segmentIndex === 0);
    expect(seg0).toBeDefined();
    expect(seg0!.lostCapacityPercent).toBeGreaterThan(50);
  });

  it('should calculate overall obstruction impact', () => {
    const insights = createTestInsights();
    const result = validatePanelPlacement(insights);
    expect(result.obstructionImpactPercent).toBeGreaterThanOrEqual(0);
    expect(result.obstructionImpactPercent).toBeLessThanOrEqual(100);
  });

  it('should handle no panels gracefully', () => {
    const insights = createTestInsights();
    insights.solarPotential.solarPanels = [];
    const result = validatePanelPlacement(insights);
    expect(result.googlePanelCount).toBe(0);
  });

  it('should include energy per segment', () => {
    const insights = createTestInsights();
    const result = validatePanelPlacement(insights);
    expect(result.segmentPanelCounts[0].yearlyEnergyDcKwh).toBe(2000); // 5 * 400
    expect(result.segmentPanelCounts[1].yearlyEnergyDcKwh).toBe(600); // 2 * 300
  });
});
