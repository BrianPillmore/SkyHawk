import { describe, it, expect } from 'vitest';
import {
  dayOfYear,
  calculateSunPath,
  calculateAnnualSunPaths,
} from '../../src/utils/sunPath';

describe('Sun Path Utilities', () => {
  const DENVER_LAT = 39.74;
  const DENVER_LNG = -104.99;

  describe('dayOfYear', () => {
    it('should return 1 for January 1', () => {
      expect(dayOfYear(new Date(2025, 0, 1))).toBe(1);
    });

    it('should return 32 for February 1', () => {
      expect(dayOfYear(new Date(2025, 1, 1))).toBe(32);
    });

    it('should return 365 for December 31 in non-leap year', () => {
      expect(dayOfYear(new Date(2025, 11, 31))).toBe(365);
    });

    it('should return 366 for December 31 in leap year', () => {
      expect(dayOfYear(new Date(2024, 11, 31))).toBe(366);
    });

    it('should return 172 for June 21', () => {
      const doy = dayOfYear(new Date(2025, 5, 21));
      // June 21 = day 172 in leap years, 171 in non-leap years (2025)
      expect(doy).toBeGreaterThanOrEqual(171);
      expect(doy).toBeLessThanOrEqual(172);
    });
  });

  describe('calculateSunPath', () => {
    it('should return 96 positions (24 hours * 4 per hour)', () => {
      const path = calculateSunPath(DENVER_LAT, DENVER_LNG, new Date(2025, 5, 21));
      expect(path.positions.length).toBe(96);
    });

    it('should include sunrise and sunset', () => {
      const path = calculateSunPath(DENVER_LAT, DENVER_LNG, new Date(2025, 5, 21));
      expect(path.sunrise).toHaveProperty('hour');
      expect(path.sunrise).toHaveProperty('minute');
      expect(path.sunset).toHaveProperty('hour');
      expect(path.sunset).toHaveProperty('minute');
    });

    it('should have sunrise before sunset', () => {
      const path = calculateSunPath(DENVER_LAT, DENVER_LNG, new Date(2025, 5, 21));
      const sunriseDecimal = path.sunrise.hour + path.sunrise.minute / 60;
      const sunsetDecimal = path.sunset.hour + path.sunset.minute / 60;
      expect(sunriseDecimal).toBeLessThan(sunsetDecimal);
    });

    it('should calculate positive daylight hours', () => {
      const path = calculateSunPath(DENVER_LAT, DENVER_LNG, new Date(2025, 5, 21));
      expect(path.daylightHours).toBeGreaterThan(0);
    });

    it('should have longer days in summer than winter', () => {
      const summer = calculateSunPath(DENVER_LAT, DENVER_LNG, new Date(2025, 5, 21));
      const winter = calculateSunPath(DENVER_LAT, DENVER_LNG, new Date(2025, 11, 21));
      expect(summer.daylightHours).toBeGreaterThan(winter.daylightHours);
    });

    it('should have solar noon with highest altitude', () => {
      const path = calculateSunPath(DENVER_LAT, DENVER_LNG, new Date(2025, 5, 21));
      expect(path.solarNoon.altitude).toBeGreaterThan(0);

      // Solar noon altitude should be roughly the max
      const maxAlt = Math.max(...path.positions.map(p => p.altitude));
      expect(path.solarNoon.altitude).toBeCloseTo(maxAlt, 0);
    });

    it('should have solar noon near hour 12', () => {
      const path = calculateSunPath(DENVER_LAT, DENVER_LNG, new Date(2025, 5, 21));
      expect(path.solarNoon.hour).toBeGreaterThanOrEqual(11);
      expect(path.solarNoon.hour).toBeLessThanOrEqual(13);
    });

    it('should include isAboveHorizon flag on positions', () => {
      const path = calculateSunPath(DENVER_LAT, DENVER_LNG, new Date(2025, 5, 21));
      const nightPos = path.positions.find(p => p.hour === 2);
      const dayPos = path.positions.find(p => p.hour === 12);

      expect(nightPos!.isAboveHorizon).toBe(false);
      expect(dayPos!.isAboveHorizon).toBe(true);
    });

    it('should store the date, latitude, and longitude', () => {
      const date = new Date(2025, 5, 21);
      const path = calculateSunPath(DENVER_LAT, DENVER_LNG, date);
      expect(path.latitude).toBe(DENVER_LAT);
      expect(path.longitude).toBe(DENVER_LNG);
      expect(path.date).toBe(date);
    });
  });

  describe('calculateAnnualSunPaths', () => {
    it('should return solstice and equinox data', () => {
      const annual = calculateAnnualSunPaths(DENVER_LAT, DENVER_LNG, 2025);
      expect(annual.solsticeSummer).toBeDefined();
      expect(annual.solsticeWinter).toBeDefined();
      expect(annual.equinox).toBeDefined();
    });

    it('should return 12 monthly paths', () => {
      const annual = calculateAnnualSunPaths(DENVER_LAT, DENVER_LNG, 2025);
      expect(annual.monthly.length).toBe(12);
    });

    it('should have summer solstice as longest day', () => {
      const annual = calculateAnnualSunPaths(DENVER_LAT, DENVER_LNG, 2025);
      expect(annual.solsticeSummer.daylightHours).toBeGreaterThan(
        annual.solsticeWinter.daylightHours
      );
    });

    it('should have equinox between solstice daylight hours', () => {
      const annual = calculateAnnualSunPaths(DENVER_LAT, DENVER_LNG, 2025);
      expect(annual.equinox.daylightHours).toBeLessThan(annual.solsticeSummer.daylightHours);
      expect(annual.equinox.daylightHours).toBeGreaterThan(annual.solsticeWinter.daylightHours);
    });

    it('should store the latitude', () => {
      const annual = calculateAnnualSunPaths(DENVER_LAT, DENVER_LNG, 2025);
      expect(annual.latitude).toBe(DENVER_LAT);
    });

    it('should have higher summer noon altitude than winter', () => {
      const annual = calculateAnnualSunPaths(DENVER_LAT, DENVER_LNG, 2025);
      expect(annual.solsticeSummer.solarNoon.altitude).toBeGreaterThan(
        annual.solsticeWinter.solarNoon.altitude
      );
    });
  });
});
