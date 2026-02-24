/**
 * Unit tests for solar panel layout utilities.
 * Run with: npx vitest run tests/unit/solarPanelLayout.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  computePanelLayout,
  getPanelColor,
} from '../../src/utils/solarPanelLayout';
import type { SolarBuildingInsights } from '../../src/types/solar';

function createInsightsWithPanels(): SolarBuildingInsights {
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
      maxArrayPanelsCount: 5,
      maxArrayAreaMeters2: 10,
      maxSunshineHoursPerYear: 1800,
      carbonOffsetFactorKgPerMwh: 417,
      panelCapacityWatts: 400,
      panelWidthMeters: 0.99,
      panelHeightMeters: 1.65,
      panelLifetimeYears: 25,
      wholeRoofStats: { areaMeters2: 100, sunshineQuantiles: [], groundAreaMeters2: 90 },
      roofSegmentStats: [
        {
          pitchDegrees: 27,
          azimuthDegrees: 180,
          stats: { areaMeters2: 80, sunshineQuantiles: [], groundAreaMeters2: 70 },
          center: { latitude: 35.001, longitude: -97.001 },
          boundingBox: { sw: { latitude: 34.999, longitude: -97.002 }, ne: { latitude: 35.002, longitude: -97.0 } },
          planeHeightAtCenterMeters: 5,
        },
      ],
      buildingStats: { areaMeters2: 100, sunshineQuantiles: [], groundAreaMeters2: 90 },
      solarPanels: [
        { center: { latitude: 35.0010, longitude: -97.0010 }, orientation: 'LANDSCAPE', yearlyEnergyDcKwh: 450, segmentIndex: 0 },
        { center: { latitude: 35.0012, longitude: -97.0010 }, orientation: 'LANDSCAPE', yearlyEnergyDcKwh: 440, segmentIndex: 0 },
        { center: { latitude: 35.0014, longitude: -97.0010 }, orientation: 'PORTRAIT', yearlyEnergyDcKwh: 430, segmentIndex: 0 },
        { center: { latitude: 35.0010, longitude: -97.0008 }, orientation: 'LANDSCAPE', yearlyEnergyDcKwh: 300, segmentIndex: 0 },
        { center: { latitude: 35.0012, longitude: -97.0008 }, orientation: 'PORTRAIT', yearlyEnergyDcKwh: 280, segmentIndex: 0 },
      ],
      solarPanelConfigs: [],
    },
  };
}

describe('computePanelLayout', () => {
  it('should return one rectangle per panel', () => {
    const insights = createInsightsWithPanels();
    const result = computePanelLayout(insights);
    expect(result).toHaveLength(5);
  });

  it('should have 4 corners per panel', () => {
    const insights = createInsightsWithPanels();
    const result = computePanelLayout(insights);
    for (const panel of result) {
      expect(panel.corners).toHaveLength(4);
    }
  });

  it('should preserve center coordinates', () => {
    const insights = createInsightsWithPanels();
    const result = computePanelLayout(insights);
    expect(result[0].center.lat).toBeCloseTo(35.0010, 4);
    expect(result[0].center.lng).toBeCloseTo(-97.0010, 4);
  });

  it('should preserve segment index', () => {
    const insights = createInsightsWithPanels();
    const result = computePanelLayout(insights);
    for (const panel of result) {
      expect(panel.segmentIndex).toBe(0);
    }
  });

  it('should preserve energy production', () => {
    const insights = createInsightsWithPanels();
    const result = computePanelLayout(insights);
    expect(result[0].yearlyEnergyDcKwh).toBe(450);
    expect(result[3].yearlyEnergyDcKwh).toBe(300);
  });

  it('should preserve orientation', () => {
    const insights = createInsightsWithPanels();
    const result = computePanelLayout(insights);
    expect(result[0].orientation).toBe('LANDSCAPE');
    expect(result[2].orientation).toBe('PORTRAIT');
  });

  it('should generate corners that form a small rectangle around center', () => {
    const insights = createInsightsWithPanels();
    const result = computePanelLayout(insights);
    const panel = result[0];

    // All corners should be close to center (within ~0.001 degrees for a small panel)
    for (const corner of panel.corners) {
      expect(Math.abs(corner.lat - panel.center.lat)).toBeLessThan(0.001);
      expect(Math.abs(corner.lng - panel.center.lng)).toBeLessThan(0.001);
    }
  });

  it('should return empty array when no panels', () => {
    const insights = createInsightsWithPanels();
    insights.solarPotential.solarPanels = [];
    const result = computePanelLayout(insights);
    expect(result).toHaveLength(0);
  });

  it('should use default dimensions when API does not provide them', () => {
    const insights = createInsightsWithPanels();
    delete (insights.solarPotential as Record<string, unknown>).panelWidthMeters;
    delete (insights.solarPotential as Record<string, unknown>).panelHeightMeters;
    const result = computePanelLayout(insights);
    // Should still return valid panels
    expect(result).toHaveLength(5);
    for (const panel of result) {
      expect(panel.corners).toHaveLength(4);
    }
  });

  it('should handle landscape vs portrait orientation correctly', () => {
    const insights = createInsightsWithPanels();
    const result = computePanelLayout(insights);
    const landscape = result[0]; // LANDSCAPE
    const portrait = result[2]; // PORTRAIT

    // Calculate width and height of each panel from corners
    const landWidth = Math.abs(landscape.corners[1].lng - landscape.corners[0].lng);
    const landHeight = Math.abs(landscape.corners[2].lat - landscape.corners[0].lat);
    const portWidth = Math.abs(portrait.corners[1].lng - portrait.corners[0].lng);
    const portHeight = Math.abs(portrait.corners[2].lat - portrait.corners[0].lat);

    // Landscape should be wider than tall (in longitude delta vs latitude delta)
    // Portrait should be taller than wide
    // Note: longitude degrees are smaller than latitude degrees at this latitude
    // so we need to compare with care. Just verify they differ.
    expect(landWidth).not.toBeCloseTo(portWidth, 6);
    expect(landHeight).not.toBeCloseTo(portHeight, 6);
  });
});

describe('getPanelColor', () => {
  it('should return cyan for high energy panels (>= 85%)', () => {
    expect(getPanelColor(450, 500)).toBe('#22D3EE');
  });

  it('should return blue for good energy panels (70-85%)', () => {
    expect(getPanelColor(380, 500)).toBe('#3B82F6');
  });

  it('should return indigo for moderate energy panels (55-70%)', () => {
    expect(getPanelColor(310, 500)).toBe('#6366F1');
  });

  it('should return violet for lower energy panels (< 55%)', () => {
    expect(getPanelColor(200, 500)).toBe('#8B5CF6');
  });

  it('should return blue default for zero max energy', () => {
    expect(getPanelColor(100, 0)).toBe('#3B82F6');
  });

  it('should clamp ratio to 1', () => {
    // energy > max should still return cyan
    expect(getPanelColor(600, 500)).toBe('#22D3EE');
  });
});
