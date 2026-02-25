/**
 * Unit tests for environmental impact calculations
 */
import { describe, it, expect } from 'vitest';
import { calculateEnvironmentalImpact } from '../../src/utils/environmentalImpact';
import type { SolarBuildingInsights } from '../../src/types/solar';

function makeSolarInsights(opts: {
  yearlyEnergyDcKwh?: number;
  carbonFactor?: number;
  maxPanels?: number;
  panelWatts?: number;
  maxSunshineHours?: number;
} = {}): SolarBuildingInsights {
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
      maxArrayPanelsCount: opts.maxPanels ?? 20,
      maxArrayAreaMeters2: 50,
      maxSunshineHoursPerYear: opts.maxSunshineHours ?? 1800,
      carbonOffsetFactorKgPerMwh: opts.carbonFactor ?? 500,
      wholeRoofStats: {
        areaMeters2: 390,
        sunshineQuantiles: [],
        groundAreaMeters2: 350,
      },
      roofSegmentStats: [],
      buildingStats: { areaMeters2: 400, sunshineQuantiles: [], groundAreaMeters2: 400 },
      solarPanelConfigs: opts.yearlyEnergyDcKwh
        ? [{
            panelsCount: opts.maxPanels ?? 20,
            yearlyEnergyDcKwh: opts.yearlyEnergyDcKwh,
            roofSegmentSummaries: [],
          }]
        : undefined,
    },
  };
}

describe('calculateEnvironmentalImpact', () => {
  it('should calculate annual CO2 offset from panel config energy', () => {
    // 10,000 kWh DC * 0.85 efficiency = 8,500 kWh AC
    // 8.5 MWh * 500 kg/MWh = 4,250 kg = 4.25 metric tons
    const insights = makeSolarInsights({ yearlyEnergyDcKwh: 10000, carbonFactor: 500 });
    const result = calculateEnvironmentalImpact(insights);

    expect(result.annualEnergyKwh).toBe(8500);
    expect(result.annualCO2OffsetTons).toBeCloseTo(4.25, 1);
  });

  it('should calculate lifetime CO2 offset with degradation', () => {
    const insights = makeSolarInsights({ yearlyEnergyDcKwh: 10000, carbonFactor: 500 });
    const result = calculateEnvironmentalImpact(insights);

    // 25 years with 0.5% degradation should be less than 25x annual
    expect(result.lifetimeCO2OffsetTons).toBeGreaterThan(result.annualCO2OffsetTons * 20);
    expect(result.lifetimeCO2OffsetTons).toBeLessThan(result.annualCO2OffsetTons * 25);
  });

  it('should calculate tree equivalents', () => {
    const insights = makeSolarInsights({ yearlyEnergyDcKwh: 10000, carbonFactor: 500 });
    const result = calculateEnvironmentalImpact(insights);

    // 4,250 kg CO2 / 21.8 kg per tree = ~195 trees
    expect(result.treeEquivalent).toBeGreaterThan(150);
    expect(result.treeEquivalent).toBeLessThan(250);
  });

  it('should calculate miles not driven', () => {
    const insights = makeSolarInsights({ yearlyEnergyDcKwh: 10000, carbonFactor: 500 });
    const result = calculateEnvironmentalImpact(insights);

    // 4,250 kg CO2 / 0.404 kg per mile = ~10,519 miles
    expect(result.milesNotDriven).toBeGreaterThan(8000);
    expect(result.milesNotDriven).toBeLessThan(15000);
  });

  it('should calculate homes powered equivalent', () => {
    const insights = makeSolarInsights({ yearlyEnergyDcKwh: 10000 });
    const result = calculateEnvironmentalImpact(insights);

    // 8,500 kWh / 10,500 kWh per home = ~0.81
    expect(result.homesPowered).toBeCloseTo(0.81, 1);
  });

  it('should use system size fallback when no panel configs', () => {
    const insights = makeSolarInsights({});
    // Remove panel configs to use system size path
    insights.solarPotential.solarPanelConfigs = [];
    const result = calculateEnvironmentalImpact(insights, 5); // 5kW system

    // 5 kW * 1,400 kWh/kW = 7,000 kWh
    expect(result.annualEnergyKwh).toBe(7000);
  });

  it('should estimate from max panels when no configs and no system size', () => {
    const insights = makeSolarInsights({
      maxPanels: 20,
      panelWatts: 400,
      maxSunshineHours: 1800,
    });
    insights.solarPotential.solarPanelConfigs = [];
    const result = calculateEnvironmentalImpact(insights, 0);

    // 20 panels * 400W * 1800 hours / 1000 * 0.85 = 12,240 kWh
    expect(result.annualEnergyKwh).toBe(12240);
  });

  it('should default to US average carbon factor when missing', () => {
    const insights = makeSolarInsights({ yearlyEnergyDcKwh: 10000 });
    insights.solarPotential.carbonOffsetFactorKgPerMwh = 0;
    const result = calculateEnvironmentalImpact(insights);

    // Should use 400 kg/MWh default
    expect(result.carbonFactorKgPerMwh).toBe(400);
  });

  it('should return the carbon factor from the API', () => {
    const insights = makeSolarInsights({ carbonFactor: 750 });
    insights.solarPotential.solarPanelConfigs = [];
    const result = calculateEnvironmentalImpact(insights, 5);

    expect(result.carbonFactorKgPerMwh).toBe(750);
  });

  it('should return all fields with correct types', () => {
    const insights = makeSolarInsights({ yearlyEnergyDcKwh: 10000 });
    const result = calculateEnvironmentalImpact(insights);

    expect(typeof result.annualCO2OffsetTons).toBe('number');
    expect(typeof result.lifetimeCO2OffsetTons).toBe('number');
    expect(typeof result.treeEquivalent).toBe('number');
    expect(typeof result.milesNotDriven).toBe('number');
    expect(typeof result.homesPowered).toBe('number');
    expect(typeof result.annualEnergyKwh).toBe('number');
    expect(typeof result.carbonFactorKgPerMwh).toBe('number');

    // All values should be non-negative
    expect(result.annualCO2OffsetTons).toBeGreaterThanOrEqual(0);
    expect(result.lifetimeCO2OffsetTons).toBeGreaterThanOrEqual(0);
    expect(result.treeEquivalent).toBeGreaterThanOrEqual(0);
    expect(result.milesNotDriven).toBeGreaterThanOrEqual(0);
    expect(result.homesPowered).toBeGreaterThanOrEqual(0);
  });

  it('should handle missing panelCapacityWatts gracefully', () => {
    const insights = makeSolarInsights({ maxPanels: 10, maxSunshineHours: 1500 });
    insights.solarPotential.solarPanelConfigs = [];
    delete (insights.solarPotential as Record<string, unknown>).panelCapacityWatts;
    const result = calculateEnvironmentalImpact(insights, 0);

    // Should default to 400W per panel
    expect(result.annualEnergyKwh).toBeGreaterThan(0);
  });
});
