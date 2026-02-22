/**
 * Sun path simulation utilities.
 * Calculates and provides data for visualizing the sun's trajectory.
 */
import { calculateSolarAltitude, calculateSolarAzimuth } from './shadingAnalysis';

export interface SunPosition {
  hour: number;
  minute: number;
  altitude: number;   // degrees above horizon
  azimuth: number;    // degrees from north
  isAboveHorizon: boolean;
}

export interface SunPathData {
  date: Date;
  latitude: number;
  longitude: number;
  sunrise: { hour: number; minute: number };
  sunset: { hour: number; minute: number };
  solarNoon: { hour: number; minute: number; altitude: number };
  daylightHours: number;
  positions: SunPosition[];
}

export interface AnnualSunPaths {
  latitude: number;
  solsticeSummer: SunPathData;
  solsticeWinter: SunPathData;
  equinox: SunPathData;
  monthly: SunPathData[];
}

/**
 * Calculate day of year from a Date.
 */
export function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Calculate sun path for a specific date and location.
 * Returns positions at 15-minute intervals.
 */
export function calculateSunPath(
  latitude: number,
  longitude: number,
  date: Date,
): SunPathData {
  const doy = dayOfYear(date);
  const positions: SunPosition[] = [];

  // Calculate at 15-minute intervals
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const fractionalHour = hour + minute / 60;
      const altitude = calculateSolarAltitude(latitude, doy, fractionalHour);
      const azimuth = calculateSolarAzimuth(latitude, doy, fractionalHour);

      positions.push({
        hour,
        minute,
        altitude,
        azimuth,
        isAboveHorizon: altitude > 0,
      });
    }
  }

  // Find sunrise/sunset (first/last position above horizon)
  const aboveHorizon = positions.filter(p => p.isAboveHorizon);
  const sunrise = aboveHorizon.length > 0
    ? { hour: aboveHorizon[0].hour, minute: aboveHorizon[0].minute }
    : { hour: 6, minute: 0 };
  const sunset = aboveHorizon.length > 0
    ? { hour: aboveHorizon[aboveHorizon.length - 1].hour, minute: aboveHorizon[aboveHorizon.length - 1].minute }
    : { hour: 18, minute: 0 };

  // Solar noon (highest altitude)
  const noon = positions.reduce((max, p) => p.altitude > max.altitude ? p : max, positions[0]);

  // Daylight hours
  const sunriseDecimal = sunrise.hour + sunrise.minute / 60;
  const sunsetDecimal = sunset.hour + sunset.minute / 60;
  const daylightHours = Math.round((sunsetDecimal - sunriseDecimal) * 10) / 10;

  return {
    date,
    latitude,
    longitude,
    sunrise,
    sunset,
    solarNoon: { hour: noon.hour, minute: noon.minute, altitude: Math.round(noon.altitude * 10) / 10 },
    daylightHours,
    positions,
  };
}

/**
 * Calculate annual sun paths for solstices, equinox, and each month.
 */
export function calculateAnnualSunPaths(
  latitude: number,
  longitude: number,
  year: number = new Date().getFullYear(),
): AnnualSunPaths {
  const summerSolstice = new Date(year, 5, 21); // June 21
  const winterSolstice = new Date(year, 11, 21); // Dec 21
  const equinox = new Date(year, 2, 20); // March 20

  const monthly: SunPathData[] = [];
  for (let month = 0; month < 12; month++) {
    monthly.push(calculateSunPath(latitude, longitude, new Date(year, month, 15)));
  }

  return {
    latitude,
    solsticeSummer: calculateSunPath(latitude, longitude, summerSolstice),
    solsticeWinter: calculateSunPath(latitude, longitude, winterSolstice),
    equinox: calculateSunPath(latitude, longitude, equinox),
    monthly,
  };
}
