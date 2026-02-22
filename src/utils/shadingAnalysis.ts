/**
 * Shading analysis utilities.
 * Calculates shade impact on solar panels throughout the day/year.
 */

export interface HourlyShading {
  hour: number;          // 0-23
  shadeFraction: number; // 0-1 (0=full sun, 1=full shade)
  solarAltitude: number; // degrees above horizon
  solarAzimuth: number;  // degrees from north
}

export interface MonthlyShading {
  month: number;         // 0-11
  monthName: string;
  avgShadeFraction: number;
  peakSunHours: number;
  hourlyProfile: HourlyShading[];
}

export interface ShadingAnalysisResult {
  annualShadeFraction: number;    // 0-1 average
  annualEffectiveSunHours: number;
  monthlyAnalysis: MonthlyShading[];
  bestMonth: { month: number; name: string; shadeFraction: number };
  worstMonth: { month: number; name: string; shadeFraction: number };
  shadingImpactPercent: number;   // % production lost to shading
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Calculate solar altitude angle for a given latitude, day of year, and hour.
 * Uses simplified solar position equations.
 */
export function calculateSolarAltitude(
  latitude: number,
  dayOfYear: number,
  hour: number,
): number {
  const latRad = (latitude * Math.PI) / 180;

  // Solar declination (approximate)
  const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
  const declRad = (declination * Math.PI) / 180;

  // Hour angle (15 degrees per hour from solar noon)
  const hourAngle = (hour - 12) * 15;
  const hourAngleRad = (hourAngle * Math.PI) / 180;

  // Solar altitude
  const sinAlt = Math.sin(latRad) * Math.sin(declRad) +
    Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourAngleRad);

  return Math.max(0, Math.asin(sinAlt) * (180 / Math.PI));
}

/**
 * Calculate solar azimuth angle.
 */
export function calculateSolarAzimuth(
  latitude: number,
  dayOfYear: number,
  hour: number,
): number {
  const latRad = (latitude * Math.PI) / 180;
  const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
  const declRad = (declination * Math.PI) / 180;
  const hourAngle = (hour - 12) * 15;
  const hourAngleRad = (hourAngle * Math.PI) / 180;

  const altitude = calculateSolarAltitude(latitude, dayOfYear, hour);
  if (altitude <= 0) return 0;

  const altRad = (altitude * Math.PI) / 180;

  const cosAz = (Math.sin(declRad) - Math.sin(latRad) * Math.sin(altRad)) /
    (Math.cos(latRad) * Math.cos(altRad));

  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * (180 / Math.PI);

  // Adjust for afternoon (azimuth > 180)
  if (hourAngleRad > 0) azimuth = 360 - azimuth;

  return azimuth;
}

/**
 * Estimate shade fraction based on solar altitude and surrounding obstructions.
 * Lower sun angles have higher shade probability.
 * This is a simplified model - real shading requires 3D obstruction data.
 */
export function estimateShadeFraction(
  solarAltitude: number,
  obstructionAngle: number = 15, // average obstruction horizon angle in degrees
): number {
  if (solarAltitude <= 0) return 1.0; // below horizon = full shade
  if (solarAltitude <= obstructionAngle) return 0.8; // below obstruction line
  if (solarAltitude <= obstructionAngle + 10) {
    // Transition zone
    return 0.8 * (1 - (solarAltitude - obstructionAngle) / 10);
  }
  return 0.0; // clear of obstructions
}

/**
 * Analyze hourly shading for a specific day.
 */
export function analyzeHourlyShading(
  latitude: number,
  dayOfYear: number,
  obstructionAngle?: number,
): HourlyShading[] {
  const hourly: HourlyShading[] = [];

  for (let hour = 5; hour <= 20; hour++) {
    const solarAltitude = calculateSolarAltitude(latitude, dayOfYear, hour);
    const solarAzimuth = calculateSolarAzimuth(latitude, dayOfYear, hour);
    const shadeFraction = estimateShadeFraction(solarAltitude, obstructionAngle);

    hourly.push({ hour, shadeFraction, solarAltitude, solarAzimuth });
  }

  return hourly;
}

/**
 * Full shading analysis for all 12 months.
 */
export function analyzeShadingProfile(
  latitude: number,
  obstructionAngle?: number,
): ShadingAnalysisResult {
  // Representative day for each month (approximately mid-month)
  const midMonthDays = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349];

  const monthlyAnalysis: MonthlyShading[] = midMonthDays.map((day, i) => {
    const hourlyProfile = analyzeHourlyShading(latitude, day, obstructionAngle);

    const sunHours = hourlyProfile.filter(h => h.solarAltitude > 0);
    const avgShadeFraction = sunHours.length > 0
      ? sunHours.reduce((sum, h) => sum + h.shadeFraction, 0) / sunHours.length
      : 1.0;

    const peakSunHours = sunHours.reduce((sum, h) => sum + (1 - h.shadeFraction), 0);

    return {
      month: i,
      monthName: MONTH_NAMES[i],
      avgShadeFraction,
      peakSunHours: Math.round(peakSunHours * 10) / 10,
      hourlyProfile,
    };
  });

  const annualShadeFraction = monthlyAnalysis.reduce(
    (sum, m) => sum + m.avgShadeFraction, 0
  ) / 12;

  const annualEffectiveSunHours = monthlyAnalysis.reduce(
    (sum, m) => sum + m.peakSunHours * 30.44, 0 // avg days/month
  );

  // Find best and worst months
  const sorted = [...monthlyAnalysis].sort((a, b) => a.avgShadeFraction - b.avgShadeFraction);
  const bestMonth = sorted[0];
  const worstMonth = sorted[sorted.length - 1];

  const shadingImpactPercent = Math.round(annualShadeFraction * 100);

  return {
    annualShadeFraction: Math.round(annualShadeFraction * 100) / 100,
    annualEffectiveSunHours: Math.round(annualEffectiveSunHours),
    monthlyAnalysis,
    bestMonth: { month: bestMonth.month, name: bestMonth.monthName, shadeFraction: bestMonth.avgShadeFraction },
    worstMonth: { month: worstMonth.month, name: worstMonth.monthName, shadeFraction: worstMonth.avgShadeFraction },
    shadingImpactPercent,
  };
}
