import { describe, it, expect } from 'vitest';
import {
  calculateSolarAltitude,
  calculateSolarAzimuth,
  estimateShadeFraction,
  analyzeHourlyShading,
  analyzeShadingProfile,
} from '../../src/utils/shadingAnalysis';

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
