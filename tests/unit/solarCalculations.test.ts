/**
 * Unit tests for solar calculations utility
 * Run with: npx vitest run tests/unit/solarCalculations.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  pitchToTiltDeg,
  estimateAzimuthFromName,
  calculateSolarAccessFactor,
  calculatePeakSunHours,
  calculateMonthlyProduction,
  analyzeFacet,
  analyzeSolarPotential,
  analyzeSolarPotentialFromApi,
  solarMoneyToNumber,
  DEFAULT_SOLAR_CONFIG,
} from '../../src/utils/solarCalculations';
import type { SolarPanelConfig } from '../../src/utils/solarCalculations';
import type { RoofFacet, RoofMeasurement } from '../../src/types';
import type { SolarBuildingInsights } from '../../src/types/solar';

// ─── Helpers ────────────────────────────────────────────────────────

function createFacet(overrides: Partial<RoofFacet> = {}): RoofFacet {
  return {
    id: 'f1',
    name: 'South Facet',
    vertexIds: ['v1', 'v2', 'v3'],
    pitch: 6,
    areaSqFt: 500,
    trueAreaSqFt: 600,
    edgeIds: ['e1', 'e2', 'e3'],
    ...overrides,
  };
}

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
    totalFlashingLf: 10,
    totalStepFlashingLf: 0,
    totalDripEdgeLf: 90,
    suggestedWastePercent: 15,
    ridgeCount: 2,
    hipCount: 2,
    valleyCount: 1,
    rakeCount: 4,
    eaveCount: 4,
    flashingCount: 1,
    stepFlashingCount: 0,
    structureComplexity: 'Simple',
    estimatedAtticSqFt: 1800,
    pitchBreakdown: [],
    ...overrides,
  };
}

// ─── DEFAULT_SOLAR_CONFIG ───────────────────────────────────────────

describe('DEFAULT_SOLAR_CONFIG', () => {
  it('should have expected panel dimensions', () => {
    expect(DEFAULT_SOLAR_CONFIG.panelWidthFt).toBe(3.25);
    expect(DEFAULT_SOLAR_CONFIG.panelHeightFt).toBe(5.4);
  });

  it('should have expected wattage and efficiency', () => {
    expect(DEFAULT_SOLAR_CONFIG.panelWattage).toBe(400);
    expect(DEFAULT_SOLAR_CONFIG.efficiency).toBe(0.20);
  });

  it('should have expected financial defaults', () => {
    expect(DEFAULT_SOLAR_CONFIG.costPerWatt).toBe(2.77);
    expect(DEFAULT_SOLAR_CONFIG.electricityRate).toBe(0.16);
    expect(DEFAULT_SOLAR_CONFIG.annualRateIncrease).toBe(0.03);
    expect(DEFAULT_SOLAR_CONFIG.federalTaxCredit).toBe(0.30);
  });

  it('should have system losses of 14%', () => {
    expect(DEFAULT_SOLAR_CONFIG.systemLosses).toBe(0.14);
  });
});

// ─── pitchToTiltDeg ─────────────────────────────────────────────────

describe('pitchToTiltDeg', () => {
  it('should return 0 degrees for zero pitch', () => {
    expect(pitchToTiltDeg(0)).toBe(0);
  });

  it('should return 45 degrees for 12/12 pitch', () => {
    expect(pitchToTiltDeg(12)).toBeCloseTo(45, 5);
  });

  it('should return approximately 26.57 degrees for 6/12 pitch', () => {
    const result = pitchToTiltDeg(6);
    expect(result).toBeCloseTo(26.565, 2);
  });

  it('should return approximately 18.43 degrees for 4/12 pitch', () => {
    const result = pitchToTiltDeg(4);
    expect(result).toBeCloseTo(18.435, 2);
  });

  it('should handle steep pitch (24/12)', () => {
    const result = pitchToTiltDeg(24);
    expect(result).toBeCloseTo(63.435, 2);
  });

  it('should handle very low pitch (1/12)', () => {
    const result = pitchToTiltDeg(1);
    expect(result).toBeCloseTo(4.764, 2);
  });
});

// ─── estimateAzimuthFromName ────────────────────────────────────────

describe('estimateAzimuthFromName', () => {
  it('should return 180 for south-facing', () => {
    expect(estimateAzimuthFromName('South Facet')).toBe(180);
  });

  it('should return 0 for north-facing', () => {
    expect(estimateAzimuthFromName('North Side')).toBe(0);
  });

  it('should return 90 for east-facing', () => {
    expect(estimateAzimuthFromName('East Wing')).toBe(90);
  });

  it('should return 270 for west-facing', () => {
    expect(estimateAzimuthFromName('West Face')).toBe(270);
  });

  it('should return 45 for northeast', () => {
    expect(estimateAzimuthFromName('North East Facet')).toBe(45);
  });

  it('should return 315 for northwest', () => {
    expect(estimateAzimuthFromName('Northwest Corner')).toBe(315);
  });

  it('should return 135 for southeast', () => {
    expect(estimateAzimuthFromName('South East Facet')).toBe(135);
  });

  it('should return 225 for southwest', () => {
    expect(estimateAzimuthFromName('Southwest Side')).toBe(225);
  });

  it('should be case-insensitive', () => {
    expect(estimateAzimuthFromName('SOUTH')).toBe(180);
    expect(estimateAzimuthFromName('north')).toBe(0);
  });

  it('should default to 180 for unknown direction', () => {
    expect(estimateAzimuthFromName('Main Roof')).toBe(180);
    expect(estimateAzimuthFromName('Facet A')).toBe(180);
  });
});

// ─── calculateSolarAccessFactor ─────────────────────────────────────

describe('calculateSolarAccessFactor', () => {
  const latitude = 35;

  it('should return close to 1.0 for south-facing at optimal tilt', () => {
    const result = calculateSolarAccessFactor(180, 35, 35);
    expect(result).toBeGreaterThanOrEqual(0.9);
    expect(result).toBeLessThanOrEqual(1.0);
  });

  it('should return lower factor for north-facing', () => {
    const northFacing = calculateSolarAccessFactor(0, 35, 35);
    const southFacing = calculateSolarAccessFactor(180, 35, 35);
    expect(northFacing).toBeLessThan(southFacing);
    expect(northFacing).toBeLessThanOrEqual(0.5);
  });

  it('should return moderate factor for east-facing', () => {
    const result = calculateSolarAccessFactor(90, 35, 35);
    expect(result).toBeGreaterThanOrEqual(0.5);
    expect(result).toBeLessThanOrEqual(0.85);
  });

  it('should return moderate factor for west-facing', () => {
    const result = calculateSolarAccessFactor(270, 35, 35);
    expect(result).toBeGreaterThanOrEqual(0.5);
    expect(result).toBeLessThanOrEqual(0.85);
  });

  it('should return value between 0 and 1', () => {
    const result = calculateSolarAccessFactor(45, 20, 40);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  it('should penalize tilt far from optimal', () => {
    const optimal = calculateSolarAccessFactor(180, 35, 35);
    const tooSteep = calculateSolarAccessFactor(180, 80, 35);
    expect(tooSteep).toBeLessThan(optimal);
  });

  it('should penalize very flat tilt at moderate latitude', () => {
    const optimal = calculateSolarAccessFactor(180, 35, 35);
    const tooFlat = calculateSolarAccessFactor(180, 0, 35);
    expect(tooFlat).toBeLessThan(optimal);
  });

  it('should handle negative azimuth by normalizing', () => {
    const result = calculateSolarAccessFactor(-180, 35, 35);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  it('should handle azimuth over 360 by normalizing', () => {
    const normal = calculateSolarAccessFactor(180, 35, 35);
    const wrapped = calculateSolarAccessFactor(540, 35, 35);
    expect(wrapped).toBeCloseTo(normal, 5);
  });

  it('should handle latitude of 0 (equator)', () => {
    const result = calculateSolarAccessFactor(180, 0, 0);
    expect(result).toBeGreaterThan(0.5);
  });

  it('should handle high latitude', () => {
    const result = calculateSolarAccessFactor(180, 60, 60);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });
});

// ─── calculatePeakSunHours ──────────────────────────────────────────

describe('calculatePeakSunHours', () => {
  it('should return higher hours for southern latitudes', () => {
    const southern = calculatePeakSunHours(28, 28, 180);
    const northern = calculatePeakSunHours(48, 48, 180);
    expect(southern).toBeGreaterThan(northern);
  });

  it('should return value between 3 and 7', () => {
    const result = calculatePeakSunHours(35, 35, 180);
    expect(result).toBeGreaterThanOrEqual(3);
    expect(result).toBeLessThanOrEqual(7);
  });

  it('should clamp to minimum of 3 for bad orientation', () => {
    const result = calculatePeakSunHours(48, 80, 0);
    expect(result).toBeGreaterThanOrEqual(3);
  });

  it('should return higher hours for south-facing vs north-facing', () => {
    const south = calculatePeakSunHours(35, 35, 180);
    const north = calculatePeakSunHours(35, 35, 0);
    expect(south).toBeGreaterThan(north);
  });

  it('should handle equatorial latitude', () => {
    const result = calculatePeakSunHours(0, 0, 180);
    expect(result).toBeGreaterThanOrEqual(3);
    expect(result).toBeLessThanOrEqual(7);
  });

  it('should handle very high latitude (60 degrees)', () => {
    const result = calculatePeakSunHours(60, 60, 180);
    expect(result).toBeGreaterThanOrEqual(3);
    expect(result).toBeLessThanOrEqual(7);
  });
});

// ─── calculateMonthlyProduction ─────────────────────────────────────

describe('calculateMonthlyProduction', () => {
  it('should return 12 months', () => {
    const result = calculateMonthlyProduction(12000, 35);
    expect(result).toHaveLength(12);
  });

  it('should sum approximately to the annual total', () => {
    const annual = 12000;
    const result = calculateMonthlyProduction(annual, 35);
    const sum = result.reduce((a, b) => a + b, 0);
    // Allow some rounding tolerance
    expect(sum).toBeGreaterThanOrEqual(annual - 12);
    expect(sum).toBeLessThanOrEqual(annual + 12);
  });

  it('should have peak production in summer months (June/July)', () => {
    const result = calculateMonthlyProduction(12000, 40);
    const june = result[5];
    const july = result[6];
    const january = result[0];
    const december = result[11];
    expect(june).toBeGreaterThan(january);
    expect(july).toBeGreaterThan(december);
  });

  it('should have less seasonal variation near the equator', () => {
    const equatorial = calculateMonthlyProduction(12000, 5);
    const highLat = calculateMonthlyProduction(12000, 50);

    const equatorialRange = Math.max(...equatorial) - Math.min(...equatorial);
    const highLatRange = Math.max(...highLat) - Math.min(...highLat);
    expect(equatorialRange).toBeLessThan(highLatRange);
  });

  it('should produce all positive values', () => {
    const result = calculateMonthlyProduction(12000, 45);
    result.forEach((month) => {
      expect(month).toBeGreaterThan(0);
    });
  });

  it('should return all zeros for zero annual production', () => {
    const result = calculateMonthlyProduction(0, 35);
    result.forEach((month) => {
      expect(month).toBe(0);
    });
  });

  it('should handle negative latitude (southern hemisphere)', () => {
    const result = calculateMonthlyProduction(12000, -35);
    expect(result).toHaveLength(12);
    const sum = result.reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThanOrEqual(12000 - 12);
    expect(sum).toBeLessThanOrEqual(12000 + 12);
  });
});

// ─── analyzeFacet ───────────────────────────────────────────────────

describe('analyzeFacet', () => {
  const config = DEFAULT_SOLAR_CONFIG;
  const latitude = 35;

  it('should return correct facetId and facetName', () => {
    const facet = createFacet({ id: 'f42', name: 'South Main' });
    const result = analyzeFacet(facet, config, latitude);
    expect(result.facetId).toBe('f42');
    expect(result.facetName).toBe('South Main');
  });

  it('should calculate tilt from pitch', () => {
    const facet = createFacet({ pitch: 6 });
    const result = analyzeFacet(facet, config, latitude);
    expect(result.tiltDeg).toBeCloseTo(26.6, 0);
  });

  it('should estimate azimuth from name', () => {
    const southFacet = createFacet({ name: 'South Roof' });
    const northFacet = createFacet({ name: 'North Roof' });
    expect(analyzeFacet(southFacet, config, latitude).azimuthDeg).toBe(180);
    expect(analyzeFacet(northFacet, config, latitude).azimuthDeg).toBe(0);
  });

  it('should reduce usable area from true area via setbacks', () => {
    const facet = createFacet({ trueAreaSqFt: 600 });
    const result = analyzeFacet(facet, config, latitude);
    expect(result.usableAreaSqFt).toBeLessThan(600);
    expect(result.usableAreaSqFt).toBeGreaterThan(0);
  });

  it('should calculate panel count based on usable area', () => {
    const facet = createFacet({ trueAreaSqFt: 1000 });
    const result = analyzeFacet(facet, config, latitude);
    const panelArea = config.panelWidthFt * config.panelHeightFt;
    // Panel count should be usable area / panel area (floored)
    expect(result.panelCount).toBeGreaterThanOrEqual(0);
    expect(result.panelCount).toBeLessThanOrEqual(Math.floor(1000 / panelArea));
  });

  it('should calculate capacity in kW from panel count', () => {
    const facet = createFacet({ trueAreaSqFt: 1000 });
    const result = analyzeFacet(facet, config, latitude);
    const expectedKw = (result.panelCount * config.panelWattage) / 1000;
    expect(result.panelCapacityKw).toBeCloseTo(expectedKw, 2);
  });

  it('should calculate positive annual production for south-facing facet', () => {
    const facet = createFacet({ name: 'South', trueAreaSqFt: 800 });
    const result = analyzeFacet(facet, config, latitude);
    expect(result.annualProductionKwh).toBeGreaterThan(0);
  });

  it('should rate south-facing facet at optimal tilt as excellent or good', () => {
    const facet = createFacet({ name: 'South', pitch: 8, trueAreaSqFt: 800 });
    const result = analyzeFacet(facet, config, latitude);
    expect(['excellent', 'good']).toContain(result.rating);
  });

  it('should rate north-facing facet as poor or fair', () => {
    const facet = createFacet({ name: 'North', pitch: 6, trueAreaSqFt: 800 });
    const result = analyzeFacet(facet, config, latitude);
    expect(['poor', 'fair']).toContain(result.rating);
  });

  it('should return zero panels for very small facet', () => {
    const facet = createFacet({ trueAreaSqFt: 5 });
    const result = analyzeFacet(facet, config, latitude);
    expect(result.panelCount).toBe(0);
    expect(result.panelCapacityKw).toBe(0);
    expect(result.annualProductionKwh).toBe(0);
  });

  it('should have solarAccessFactor between 0 and 1', () => {
    const facet = createFacet();
    const result = analyzeFacet(facet, config, latitude);
    expect(result.solarAccessFactor).toBeGreaterThanOrEqual(0);
    expect(result.solarAccessFactor).toBeLessThanOrEqual(1);
  });
});

// ─── analyzeSolarPotential ──────────────────────────────────────────

describe('analyzeSolarPotential', () => {
  const config = DEFAULT_SOLAR_CONFIG;
  const latitude = 35;

  it('should return empty facetAnalyses for measurement with no facets', () => {
    const measurement = createMeasurement({ facets: [] });
    const result = analyzeSolarPotential(measurement, config, latitude);
    expect(result.facetAnalyses).toHaveLength(0);
    expect(result.totalPanels).toBe(0);
    expect(result.totalCapacityKw).toBe(0);
    expect(result.annualProductionKwh).toBe(0);
  });

  it('should analyze a single facet', () => {
    const facet = createFacet({ name: 'South Main', trueAreaSqFt: 800 });
    const measurement = createMeasurement({ facets: [facet] });
    const result = analyzeSolarPotential(measurement, config, latitude);
    expect(result.facetAnalyses).toHaveLength(1);
    expect(result.totalPanels).toBeGreaterThan(0);
    expect(result.annualProductionKwh).toBeGreaterThan(0);
  });

  it('should aggregate panels and capacity from multiple facets', () => {
    const southFacet = createFacet({ id: 'f1', name: 'South', trueAreaSqFt: 800 });
    const eastFacet = createFacet({ id: 'f2', name: 'East', trueAreaSqFt: 600 });
    const measurement = createMeasurement({ facets: [southFacet, eastFacet] });
    const result = analyzeSolarPotential(measurement, config, latitude);

    expect(result.facetAnalyses).toHaveLength(2);
    const sumPanels = result.facetAnalyses.reduce((s, fa) => s + fa.panelCount, 0);
    expect(result.totalPanels).toBe(sumPanels);
  });

  it('should return 12 monthly production values', () => {
    const facet = createFacet({ name: 'South', trueAreaSqFt: 800 });
    const measurement = createMeasurement({ facets: [facet] });
    const result = analyzeSolarPotential(measurement, config, latitude);
    expect(result.monthlyProductionKwh).toHaveLength(12);
  });

  it('should calculate system cost as capacity * 1000 * costPerWatt', () => {
    const facet = createFacet({ name: 'South', trueAreaSqFt: 800 });
    const measurement = createMeasurement({ facets: [facet] });
    const result = analyzeSolarPotential(measurement, config, latitude);
    const expectedCost = result.totalCapacityKw * 1000 * config.costPerWatt;
    expect(result.systemCost).toBe(Math.round(expectedCost));
  });

  it('should calculate federal tax credit correctly', () => {
    const facet = createFacet({ name: 'South', trueAreaSqFt: 800 });
    const measurement = createMeasurement({ facets: [facet] });
    const result = analyzeSolarPotential(measurement, config, latitude);
    const rawCost = result.totalCapacityKw * 1000 * config.costPerWatt;
    const expectedCredit = Math.round(rawCost * config.federalTaxCredit);
    expect(result.federalTaxCredit).toBe(expectedCredit);
  });

  it('should calculate net cost as system cost minus tax credit', () => {
    const facet = createFacet({ name: 'South', trueAreaSqFt: 800 });
    const measurement = createMeasurement({ facets: [facet] });
    const result = analyzeSolarPotential(measurement, config, latitude);
    expect(result.netCost).toBe(result.systemCost - result.federalTaxCredit);
  });

  it('should calculate annual savings from production and electricity rate', () => {
    const facet = createFacet({ name: 'South', trueAreaSqFt: 800 });
    const measurement = createMeasurement({ facets: [facet] });
    const result = analyzeSolarPotential(measurement, config, latitude);
    const expectedSavings = Math.round(result.annualProductionKwh * config.electricityRate);
    expect(result.annualSavings).toBe(expectedSavings);
  });

  it('should have payback years greater than 0 for a non-trivial system', () => {
    const facet = createFacet({ name: 'South', trueAreaSqFt: 800 });
    const measurement = createMeasurement({ facets: [facet] });
    const result = analyzeSolarPotential(measurement, config, latitude);
    expect(result.paybackYears).toBeGreaterThan(0);
  });

  it('should have payback years of 0 when no facets produce energy', () => {
    const measurement = createMeasurement({ facets: [] });
    const result = analyzeSolarPotential(measurement, config, latitude);
    expect(result.paybackYears).toBe(0);
  });

  it('should calculate carbon offset using 1.22 lbs CO2 per kWh', () => {
    const facet = createFacet({ name: 'South', trueAreaSqFt: 800 });
    const measurement = createMeasurement({ facets: [facet] });
    const result = analyzeSolarPotential(measurement, config, latitude);
    expect(result.carbonOffsetLbs).toBe(Math.round(result.annualProductionKwh * 1.22));
  });

  it('should calculate trees equivalent using 48 lbs CO2 per tree per year', () => {
    const facet = createFacet({ name: 'South', trueAreaSqFt: 800 });
    const measurement = createMeasurement({ facets: [facet] });
    const result = analyzeSolarPotential(measurement, config, latitude);
    const expectedTrees = Math.round((result.annualProductionKwh * 1.22) / 48);
    expect(result.treesEquivalent).toBe(expectedTrees);
  });

  it('should have zero carbon offset and trees for empty measurement', () => {
    const measurement = createMeasurement({ facets: [] });
    const result = analyzeSolarPotential(measurement, config, latitude);
    expect(result.carbonOffsetLbs).toBe(0);
    expect(result.treesEquivalent).toBe(0);
  });

  it('should compute twenty-five year savings', () => {
    const facet = createFacet({ name: 'South', trueAreaSqFt: 800 });
    const measurement = createMeasurement({ facets: [facet] });
    const result = analyzeSolarPotential(measurement, config, latitude);
    // 25-year savings should be positive for a south-facing productive system
    expect(result.twentyFiveYearSavings).toBeGreaterThan(0);
  });

  it('should have south-facing facets produce more than north-facing', () => {
    const southFacet = createFacet({ id: 'f1', name: 'South', trueAreaSqFt: 800 });
    const northFacet = createFacet({ id: 'f2', name: 'North', trueAreaSqFt: 800 });

    const southMeasurement = createMeasurement({ facets: [southFacet] });
    const northMeasurement = createMeasurement({ facets: [northFacet] });

    const southResult = analyzeSolarPotential(southMeasurement, config, latitude);
    const northResult = analyzeSolarPotential(northMeasurement, config, latitude);

    expect(southResult.annualProductionKwh).toBeGreaterThan(northResult.annualProductionKwh);
  });

  it('should handle a large number of facets', () => {
    const facets = Array.from({ length: 10 }, (_, i) =>
      createFacet({ id: `f${i}`, name: `South Facet ${i}`, trueAreaSqFt: 300 }),
    );
    const measurement = createMeasurement({ facets });
    const result = analyzeSolarPotential(measurement, config, latitude);
    expect(result.facetAnalyses).toHaveLength(10);
    expect(result.totalPanels).toBeGreaterThan(0);
  });
});

// ─── solarMoneyToNumber ──────────────────────────────────────────

describe('solarMoneyToNumber', () => {
  it('should return 0 for null/undefined', () => {
    expect(solarMoneyToNumber(null)).toBe(0);
    expect(solarMoneyToNumber(undefined)).toBe(0);
  });

  it('should convert units string to number', () => {
    expect(solarMoneyToNumber({ currencyCode: 'USD', units: '1500' })).toBe(1500);
  });

  it('should add nanos as fractional', () => {
    expect(solarMoneyToNumber({ currencyCode: 'USD', units: '10', nanos: 500000000 })).toBeCloseTo(10.5, 5);
  });

  it('should handle zero nanos', () => {
    expect(solarMoneyToNumber({ currencyCode: 'USD', units: '42', nanos: 0 })).toBe(42);
  });

  it('should handle empty string units as 0', () => {
    expect(solarMoneyToNumber({ currencyCode: 'USD', units: '' })).toBe(0);
  });
});

// ─── analyzeSolarPotentialFromApi ────────────────────────────────

describe('analyzeSolarPotentialFromApi', () => {
  const config = DEFAULT_SOLAR_CONFIG;

  function createInsights(overrides: Partial<SolarBuildingInsights> = {}): SolarBuildingInsights {
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
        maxArrayPanelsCount: 40,
        maxArrayAreaMeters2: 80,
        maxSunshineHoursPerYear: 1800,
        carbonOffsetFactorKgPerMwh: 417,
        panelCapacityWatts: 400,
        panelHeightMeters: 1.65,
        panelWidthMeters: 0.99,
        panelLifetimeYears: 25,
        wholeRoofStats: { areaMeters2: 200, sunshineQuantiles: [], groundAreaMeters2: 180 },
        roofSegmentStats: [
          {
            pitchDegrees: 27,
            azimuthDegrees: 180,
            stats: { areaMeters2: 100, sunshineQuantiles: [], groundAreaMeters2: 90 },
            center: { latitude: 35.001, longitude: -97.001 },
            boundingBox: {
              sw: { latitude: 34.999, longitude: -97.002 },
              ne: { latitude: 35.002, longitude: -97.0 },
            },
            planeHeightAtCenterMeters: 5,
          },
          {
            pitchDegrees: 27,
            azimuthDegrees: 0,
            stats: { areaMeters2: 80, sunshineQuantiles: [], groundAreaMeters2: 70 },
            center: { latitude: 35.001, longitude: -97.001 },
            boundingBox: {
              sw: { latitude: 34.999, longitude: -97.002 },
              ne: { latitude: 35.002, longitude: -97.0 },
            },
            planeHeightAtCenterMeters: 5,
          },
        ],
        buildingStats: { areaMeters2: 200, sunshineQuantiles: [], groundAreaMeters2: 180 },
        solarPanelConfigs: [
          {
            panelsCount: 10,
            yearlyEnergyDcKwh: 5000,
            roofSegmentSummaries: [
              { pitchDegrees: 27, azimuthDegrees: 180, panelsCount: 10, yearlyEnergyDcKwh: 5000, segmentIndex: 0 },
            ],
          },
          {
            panelsCount: 30,
            yearlyEnergyDcKwh: 12000,
            roofSegmentSummaries: [
              { pitchDegrees: 27, azimuthDegrees: 180, panelsCount: 20, yearlyEnergyDcKwh: 8000, segmentIndex: 0 },
              { pitchDegrees: 27, azimuthDegrees: 0, panelsCount: 10, yearlyEnergyDcKwh: 4000, segmentIndex: 1 },
            ],
          },
        ],
        financialAnalyses: [
          {
            monthlyBill: { currencyCode: 'USD', units: '150' },
            defaultBill: true,
            averageKwhPerMonth: 900,
            panelConfigIndex: 1,
            financialDetails: {
              initialAcKwhPerYear: 10320,
              remainingLifetimeUtilityBill: { currencyCode: 'USD', units: '5000' },
              federalIncentive: { currencyCode: 'USD', units: '7500' },
              stateIncentive: { currencyCode: 'USD', units: '0' },
              utilityIncentive: { currencyCode: 'USD', units: '0' },
              lifetimeSrecTotal: { currencyCode: 'USD', units: '0' },
              costOfElectricityWithoutSolar: { currencyCode: 'USD', units: '45000' },
              netMeteringAllowed: true,
              solarPercentage: 85,
              percentageExportedToGrid: 20,
            },
            cashPurchaseSavings: {
              outOfPocketCost: { currencyCode: 'USD', units: '17500' },
              upfrontCost: { currencyCode: 'USD', units: '25000' },
              rebateValue: { currencyCode: 'USD', units: '7500' },
              paybackYears: 8.5,
              savings: {
                savingsYear1: { currencyCode: 'USD', units: '1800' },
                savingsYear20: { currencyCode: 'USD', units: '42000' },
                presentValueOfSavingsYear20: { currencyCode: 'USD', units: '30000' },
                savingsLifetime: { currencyCode: 'USD', units: '55000' },
                presentValueOfSavingsLifetime: { currencyCode: 'USD', units: '38000' },
              },
            },
          },
        ],
        solarPanels: [],
      },
      ...overrides,
    };
  }

  it('should use the last (max panel) config by default', () => {
    const insights = createInsights();
    const measurement = createMeasurement({ facets: [createFacet()] });
    const result = analyzeSolarPotentialFromApi(insights, measurement, config);
    expect(result.totalPanels).toBe(30);
  });

  it('should use a specific config when configIndex is provided', () => {
    const insights = createInsights();
    const measurement = createMeasurement({ facets: [createFacet()] });
    const result = analyzeSolarPotentialFromApi(insights, measurement, config, 0);
    expect(result.totalPanels).toBe(10);
  });

  it('should apply system losses to DC energy for annual production', () => {
    const insights = createInsights();
    const measurement = createMeasurement({ facets: [createFacet()] });
    const result = analyzeSolarPotentialFromApi(insights, measurement, config);
    // 12000 DC * (1 - 0.14) = 10320 AC
    expect(result.annualProductionKwh).toBe(Math.round(12000 * (1 - config.systemLosses)));
  });

  it('should return 12 monthly production values', () => {
    const insights = createInsights();
    const measurement = createMeasurement({ facets: [createFacet()] });
    const result = analyzeSolarPotentialFromApi(insights, measurement, config);
    expect(result.monthlyProductionKwh).toHaveLength(12);
  });

  it('should use Google financial data when available', () => {
    const insights = createInsights();
    const measurement = createMeasurement({ facets: [createFacet()] });
    const result = analyzeSolarPotentialFromApi(insights, measurement, config);
    expect(result.systemCost).toBe(25000);
    expect(result.netCost).toBe(17500);
    expect(result.federalTaxCredit).toBe(7500);
    expect(result.annualSavings).toBe(1800);
    expect(result.paybackYears).toBe(8.5);
  });

  it('should fall back to our financial model when API lacks cashPurchaseSavings', () => {
    const insights = createInsights();
    insights.solarPotential.financialAnalyses = [];
    const measurement = createMeasurement({ facets: [createFacet()] });
    const result = analyzeSolarPotentialFromApi(insights, measurement, config);
    // Should still compute financials
    expect(result.systemCost).toBeGreaterThan(0);
    expect(result.annualSavings).toBeGreaterThan(0);
  });

  it('should produce per-segment facet analyses from API roof summaries', () => {
    const insights = createInsights();
    const measurement = createMeasurement({ facets: [createFacet(), createFacet({ id: 'f2', name: 'North Facet' })] });
    const result = analyzeSolarPotentialFromApi(insights, measurement, config);
    expect(result.facetAnalyses).toHaveLength(2);
    expect(result.facetAnalyses[0].azimuthDeg).toBe(180);
    expect(result.facetAnalyses[1].azimuthDeg).toBe(0);
  });

  it('should calculate capacity from API panelCapacityWatts', () => {
    const insights = createInsights();
    const measurement = createMeasurement({ facets: [createFacet()] });
    const result = analyzeSolarPotentialFromApi(insights, measurement, config);
    // 30 panels * 400W / 1000 = 12 kW
    expect(result.totalCapacityKw).toBe(12);
  });

  it('should calculate environmental impact', () => {
    const insights = createInsights();
    const measurement = createMeasurement({ facets: [createFacet()] });
    const result = analyzeSolarPotentialFromApi(insights, measurement, config);
    expect(result.carbonOffsetLbs).toBe(Math.round(result.annualProductionKwh * 1.22));
    expect(result.treesEquivalent).toBe(Math.round(result.carbonOffsetLbs / 48));
  });

  it('should fall back to analyzeSolarPotential when no panel configs', () => {
    const insights = createInsights();
    insights.solarPotential.solarPanelConfigs = [];
    const facet = createFacet({ name: 'South', trueAreaSqFt: 800 });
    const measurement = createMeasurement({ facets: [facet] });
    const apiResult = analyzeSolarPotentialFromApi(insights, measurement, config);
    const handResult = analyzeSolarPotential(measurement, config, 35);
    // Should produce identical results since it falls back
    expect(apiResult.totalPanels).toBe(handResult.totalPanels);
    expect(apiResult.annualProductionKwh).toBe(handResult.annualProductionKwh);
  });

  it('should clamp configIndex to available configs', () => {
    const insights = createInsights();
    const measurement = createMeasurement({ facets: [createFacet()] });
    // Config index 999 should clamp to last config (index 1)
    const result = analyzeSolarPotentialFromApi(insights, measurement, config, 999);
    expect(result.totalPanels).toBe(30);
  });

  it('should fall back to local facet analyses when no segment summaries', () => {
    const insights = createInsights();
    insights.solarPotential.solarPanelConfigs = [
      { panelsCount: 20, yearlyEnergyDcKwh: 8000, roofSegmentSummaries: [] },
    ];
    const facet = createFacet({ name: 'South', trueAreaSqFt: 800 });
    const measurement = createMeasurement({ facets: [facet] });
    const result = analyzeSolarPotentialFromApi(insights, measurement, config, 0);
    // Should fall back to analyzeFacet for per-facet details
    expect(result.facetAnalyses).toHaveLength(1);
    expect(result.facetAnalyses[0].facetName).toBe('South');
  });

  it('should use panelCapacityWatts from API over config panelWattage', () => {
    const insights = createInsights();
    insights.solarPotential.panelCapacityWatts = 350;
    const measurement = createMeasurement({ facets: [createFacet()] });
    const result = analyzeSolarPotentialFromApi(insights, measurement, config);
    // 30 panels * 350W / 1000 = 10.5 kW
    expect(result.totalCapacityKw).toBe(10.5);
  });
});
