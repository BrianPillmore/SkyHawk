/**
 * Shading analysis utilities.
 * Calculates shade impact on solar panels throughout the day/year.
 * Supports both a simplified math model (obstruction angle) and
 * Google Solar API sunshine quantiles for real measured shading.
 */

import type { SolarBuildingInsights, SolarRoofSegment } from '../types/solar';

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

// ─── Sunshine Quantile Analysis (Google Solar API) ─────────────

export interface SegmentShadingScore {
  segmentIndex: number;
  azimuthDeg: number;
  pitchDeg: number;
  areaSqFt: number;
  /** Median (Q50) annual sunshine hours/m² */
  medianSunshineHours: number;
  /** Max (Q100) annual sunshine hours/m² */
  maxSunshineHours: number;
  /** Min (Q0) annual sunshine hours/m² */
  minSunshineHours: number;
  /** Interquartile range (Q75 - Q25) — narrow = uniform, wide = variable shading */
  iqr: number;
  /** Uniformity score 0-1 (1 = perfectly uniform sunshine across segment) */
  uniformityScore: number;
  /** Shading quality: how much of max potential is realized (median / max of whole roof) */
  shadingQuality: number;
  /** Qualitative rating */
  shadingRating: 'minimal' | 'low' | 'moderate' | 'high';
}

export interface SunshineQuantileAnalysis {
  /** Whole-roof median sunshine hours/m² */
  wholeRoofMedianHours: number;
  /** Whole-roof max sunshine hours/m² (best possible for this location) */
  wholeRoofMaxHours: number;
  /** Overall shading impact 0-100% (how much production is lost to shading) */
  overallShadingImpact: number;
  /** Per-segment shading scores */
  segmentScores: SegmentShadingScore[];
  /** Whether data came from Google Solar API */
  isApiSourced: boolean;
}

/**
 * Extract the quantile at a given percentile from the 11-element array.
 * Quantiles are at 0, 10, 20, ..., 100 percentile.
 */
function quantileAt(quantiles: number[], percentile: number): number {
  if (!quantiles || quantiles.length === 0) return 0;
  const idx = Math.round(percentile / 10);
  return quantiles[Math.min(idx, quantiles.length - 1)] ?? 0;
}

/**
 * Analyze shading from Google Solar API sunshine quantiles.
 *
 * The `sunshineQuantiles` array contains 11 values representing the 0th through
 * 100th percentile of annual sunshine hours per m² across pixels in that segment.
 * - Narrow IQR (Q75-Q25) → uniform sunshine → minimal shading
 * - Wide IQR → significant shading variation (trees, chimneys, etc.)
 * - Low median relative to max → segment receives less sun overall
 *
 * @param insights - SolarBuildingInsights from Google API
 * @returns Per-segment shading scores and overall analysis
 */
export function analyzeSunshineQuantiles(
  insights: SolarBuildingInsights,
): SunshineQuantileAnalysis {
  const sp = insights.solarPotential;
  const wholeRoofQ = sp.wholeRoofStats.sunshineQuantiles;
  const segments = sp.roofSegmentStats ?? [];

  // Whole-roof reference values
  const wholeRoofMedianHours = quantileAt(wholeRoofQ, 50);
  const wholeRoofMaxHours = quantileAt(wholeRoofQ, 100);

  const segmentScores: SegmentShadingScore[] = segments.map((seg, i) => {
    return analyzeSegmentShading(seg, i, wholeRoofMaxHours);
  });

  // Overall shading impact = weighted average of segment quality (by area)
  const totalArea = segmentScores.reduce((s, sc) => s + sc.areaSqFt, 0);
  const weightedQuality = totalArea > 0
    ? segmentScores.reduce((s, sc) => s + sc.shadingQuality * sc.areaSqFt, 0) / totalArea
    : 1;
  const overallShadingImpact = Math.round((1 - weightedQuality) * 100);

  return {
    wholeRoofMedianHours: Math.round(wholeRoofMedianHours),
    wholeRoofMaxHours: Math.round(wholeRoofMaxHours),
    overallShadingImpact,
    segmentScores,
    isApiSourced: true,
  };
}

/**
 * Analyze shading for a single roof segment from its sunshine quantiles.
 */
export function analyzeSegmentShading(
  segment: SolarRoofSegment,
  index: number,
  wholeRoofMaxHours: number,
): SegmentShadingScore {
  const q = segment.stats.sunshineQuantiles;
  const areaM2 = segment.stats.areaMeters2;
  const areaSqFt = Math.round(areaM2 * 10.7639);

  const q0 = quantileAt(q, 0);
  const q25 = quantileAt(q, 25);
  const q50 = quantileAt(q, 50);
  const q75 = quantileAt(q, 75);
  const q100 = quantileAt(q, 100);

  const iqr = q75 - q25;

  // Uniformity: how narrow the IQR is relative to the range
  const range = q100 - q0;
  const uniformityScore = range > 0
    ? Math.max(0, Math.min(1, 1 - (iqr / range)))
    : 1;

  // Shading quality: median sunshine relative to the best on the whole roof
  const refMax = wholeRoofMaxHours > 0 ? wholeRoofMaxHours : q100;
  const shadingQuality = refMax > 0
    ? Math.max(0, Math.min(1, q50 / refMax))
    : 1;

  // Rating
  let shadingRating: SegmentShadingScore['shadingRating'];
  if (shadingQuality >= 0.90) shadingRating = 'minimal';
  else if (shadingQuality >= 0.75) shadingRating = 'low';
  else if (shadingQuality >= 0.55) shadingRating = 'moderate';
  else shadingRating = 'high';

  return {
    segmentIndex: index,
    azimuthDeg: Math.round(segment.azimuthDegrees),
    pitchDeg: Math.round(segment.pitchDegrees * 10) / 10,
    areaSqFt,
    medianSunshineHours: Math.round(q50),
    maxSunshineHours: Math.round(q100),
    minSunshineHours: Math.round(q0),
    iqr: Math.round(iqr),
    uniformityScore: Math.round(uniformityScore * 100) / 100,
    shadingQuality: Math.round(shadingQuality * 100) / 100,
    shadingRating,
  };
}

// ─── Panel Placement Validation (Google Solar API) ─────────────

export interface PanelPlacementValidation {
  /** Total panels Google places on the roof */
  googlePanelCount: number;
  /** Total panels SkyHawk calculates */
  skyhawkPanelCount: number;
  /** Ratio of Google to SkyHawk (>1 = SkyHawk underestimates, <1 = overestimates) */
  placementRatio: number;
  /** Per-segment panel counts from Google */
  segmentPanelCounts: { segmentIndex: number; panelCount: number; yearlyEnergyDcKwh: number }[];
  /** Detected obstructions: segments where Google places fewer panels than area would suggest */
  possibleObstructions: { segmentIndex: number; expectedPanels: number; actualPanels: number; lostCapacityPercent: number }[];
  /** Overall obstruction impact as percentage of usable area lost */
  obstructionImpactPercent: number;
}

/**
 * Validate panel placement using Google's solarPanels[] array.
 *
 * Google's Solar API computes exact panel placements accounting for skylights,
 * vents, chimneys, HVAC units, and other obstructions. Comparing their panel
 * count per segment against our area-based estimate reveals obstructions.
 *
 * @param insights - SolarBuildingInsights from Google API
 * @param panelAreaSqFt - Area of one panel in sq ft (default: 3.25 * 5.4 = 17.55)
 */
export function validatePanelPlacement(
  insights: SolarBuildingInsights,
  panelAreaSqFt: number = 17.55,
): PanelPlacementValidation {
  const sp = insights.solarPotential;
  const panels = sp.solarPanels ?? [];
  const segments = sp.roofSegmentStats ?? [];
  const configs = sp.solarPanelConfigs ?? [];

  // Count panels per segment from the panels array
  const segmentCounts = new Map<number, number>();
  const segmentEnergy = new Map<number, number>();
  for (const panel of panels) {
    const idx = panel.segmentIndex;
    segmentCounts.set(idx, (segmentCounts.get(idx) ?? 0) + 1);
    segmentEnergy.set(idx, (segmentEnergy.get(idx) ?? 0) + panel.yearlyEnergyDcKwh);
  }

  const googlePanelCount = panels.length;
  // Use the max config for SkyHawk comparison
  const maxConfig = configs.length > 0 ? configs[configs.length - 1] : null;

  const segmentPanelCounts = segments.map((_, i) => ({
    segmentIndex: i,
    panelCount: segmentCounts.get(i) ?? 0,
    yearlyEnergyDcKwh: Math.round(segmentEnergy.get(i) ?? 0),
  }));

  // Estimate expected panels per segment from area (with ~20% setback reduction)
  const possibleObstructions: PanelPlacementValidation['possibleObstructions'] = [];
  let totalExpected = 0;
  let totalActual = 0;

  for (let i = 0; i < segments.length; i++) {
    const areaM2 = segments[i].stats.areaMeters2;
    const areaSqFt = areaM2 * 10.7639;
    const usableArea = areaSqFt * 0.80; // 20% setback
    const expectedPanels = Math.floor(usableArea / panelAreaSqFt);
    const actualPanels = segmentCounts.get(i) ?? 0;

    totalExpected += expectedPanels;
    totalActual += actualPanels;

    if (expectedPanels > 0 && actualPanels < expectedPanels * 0.7) {
      // Google places significantly fewer panels than area suggests → obstruction
      const lostCapacityPercent = Math.round((1 - actualPanels / expectedPanels) * 100);
      possibleObstructions.push({
        segmentIndex: i,
        expectedPanels,
        actualPanels,
        lostCapacityPercent,
      });
    }
  }

  const skyhawkPanelCount = totalExpected;
  const placementRatio = skyhawkPanelCount > 0 ? googlePanelCount / skyhawkPanelCount : 1;
  const obstructionImpactPercent = totalExpected > 0
    ? Math.round(((totalExpected - totalActual) / totalExpected) * 100)
    : 0;

  return {
    googlePanelCount,
    skyhawkPanelCount,
    placementRatio: Math.round(placementRatio * 100) / 100,
    segmentPanelCounts,
    possibleObstructions,
    obstructionImpactPercent: Math.max(0, obstructionImpactPercent),
  };
}
