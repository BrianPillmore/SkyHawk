import type { RoofFacet, RoofMeasurement } from '../types';

// ─── Configuration ─────────────────────────────────────────────────

export interface SolarPanelConfig {
  panelWidthFt: number;       // default 3.25 (standard 65" panel)
  panelHeightFt: number;      // default 5.4 (standard 65" panel)
  panelWattage: number;       // default 400W
  efficiency: number;         // default 0.20 (20%)
  systemLosses: number;       // default 0.14 (14% system losses)
  costPerWatt: number;        // default 2.77 ($/W)
  electricityRate: number;    // default 0.16 ($/kWh)
  annualRateIncrease: number; // default 0.03 (3%)
  federalTaxCredit: number;   // default 0.30 (30%)
}

export const DEFAULT_SOLAR_CONFIG: SolarPanelConfig = {
  panelWidthFt: 3.25,
  panelHeightFt: 5.4,
  panelWattage: 400,
  efficiency: 0.20,
  systemLosses: 0.14,
  costPerWatt: 2.77,
  electricityRate: 0.16,
  annualRateIncrease: 0.03,
  federalTaxCredit: 0.30,
};

// ─── Result Types ──────────────────────────────────────────────────

export interface SolarFacetAnalysis {
  facetId: string;
  facetName: string;
  azimuthDeg: number;         // 0=N, 90=E, 180=S, 270=W
  tiltDeg: number;            // from pitch
  usableAreaSqFt: number;     // true area minus setbacks
  panelCount: number;
  panelCapacityKw: number;
  annualProductionKwh: number;
  solarAccessFactor: number;  // 0-1, based on azimuth/tilt
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface SolarSystemSummary {
  totalPanels: number;
  totalCapacityKw: number;
  annualProductionKwh: number;
  monthlyProductionKwh: number[];  // 12 months
  systemCost: number;
  federalTaxCredit: number;
  netCost: number;
  annualSavings: number;
  paybackYears: number;
  twentyFiveYearSavings: number;
  carbonOffsetLbs: number;  // annual CO2 offset
  treesEquivalent: number;
  facetAnalyses: SolarFacetAnalysis[];
}

// ─── Conversion Helpers ────────────────────────────────────────────

/**
 * Convert roof pitch (x/12) to tilt degrees.
 * pitch is rise-over-run in x/12 format (e.g., 6 means 6:12).
 */
export function pitchToTiltDeg(pitch: number): number {
  return Math.atan(pitch / 12) * (180 / Math.PI);
}

/**
 * Rough estimate of azimuth from facet name.
 * If name contains "south" -> 180, "north" -> 0, "east" -> 90, "west" -> 270.
 * Default 180 (south-facing) when no directional keyword is found.
 */
export function estimateAzimuthFromName(facetName: string): number {
  const lower = facetName.toLowerCase();
  if (lower.includes('north') && lower.includes('east')) return 45;
  if (lower.includes('north') && lower.includes('west')) return 315;
  if (lower.includes('south') && lower.includes('east')) return 135;
  if (lower.includes('south') && lower.includes('west')) return 225;
  if (lower.includes('south')) return 180;
  if (lower.includes('north')) return 0;
  if (lower.includes('east')) return 90;
  if (lower.includes('west')) return 270;
  return 180; // default: south-facing
}

// ─── Solar Access Factor ───────────────────────────────────────────

/**
 * Calculate solar access factor (0-1) based on azimuth, tilt, and latitude.
 * South-facing (170-190 deg) at optimal tilt (latitude +/- 15) gets ~1.0.
 * East/West facing gets ~0.75. North-facing gets ~0.4.
 * Tilt too steep or too shallow reduces the factor.
 */
export function calculateSolarAccessFactor(
  azimuthDeg: number,
  tiltDeg: number,
  latitude: number,
): number {
  // Normalize azimuth to 0-360
  const azimuth = ((azimuthDeg % 360) + 360) % 360;

  // --- Azimuth factor ---
  // Deviation from south (180 deg). 0 deg deviation = 1.0, 180 deg deviation (north) = 0.4
  const azimuthDeviation = Math.abs(azimuth - 180);
  // Smooth cosine-based falloff from south to north
  // At 0 deviation (south): 1.0, at 90 (east/west): ~0.75, at 180 (north): ~0.4
  // Piecewise approach for clarity
  let azFactor: number;
  if (azimuthDeviation <= 20) {
    // Near south: excellent
    azFactor = 0.95 + 0.05 * (1 - azimuthDeviation / 20);
  } else if (azimuthDeviation <= 90) {
    // East/west quadrant: good to fair
    azFactor = 0.95 - (azimuthDeviation - 20) * (0.20 / 70); // 0.95 -> 0.75
  } else if (azimuthDeviation <= 150) {
    // Northeast/northwest: fair to poor
    azFactor = 0.75 - (azimuthDeviation - 90) * (0.25 / 60); // 0.75 -> 0.50
  } else {
    // Near north: poor
    azFactor = 0.50 - (azimuthDeviation - 150) * (0.10 / 30); // 0.50 -> 0.40
  }

  // --- Tilt factor ---
  // Optimal tilt is approximately equal to latitude for annual production
  const optimalTilt = Math.abs(latitude);
  const tiltDeviation = Math.abs(tiltDeg - optimalTilt);

  let tiltFactor: number;
  if (tiltDeviation <= 15) {
    // Within 15 degrees of optimal: near perfect
    tiltFactor = 1.0 - (tiltDeviation / 15) * 0.05; // 1.0 -> 0.95
  } else if (tiltDeviation <= 30) {
    // Moderate deviation
    tiltFactor = 0.95 - ((tiltDeviation - 15) / 15) * 0.15; // 0.95 -> 0.80
  } else {
    // Large deviation (too steep or too shallow)
    tiltFactor = Math.max(0.50, 0.80 - ((tiltDeviation - 30) / 30) * 0.30);
  }

  // Combined factor
  const combined = azFactor * tiltFactor;
  return Math.max(0, Math.min(1, combined));
}

// ─── Peak Sun Hours ────────────────────────────────────────────────

/**
 * Estimate annual average peak sun hours per day.
 * Base of 4.5 for US average, modified by latitude and orientation.
 * Range: 3-7.
 */
export function calculatePeakSunHours(
  latitude: number,
  tiltDeg: number,
  azimuthDeg: number,
): number {
  const absLat = Math.abs(latitude);

  // Base sun hours by latitude (US range roughly 25-48 degrees)
  // Southern US (25 deg): ~5.5 hrs, Northern US (48 deg): ~3.8 hrs
  let baseHours: number;
  if (absLat <= 25) {
    baseHours = 5.8;
  } else if (absLat <= 35) {
    baseHours = 5.8 - (absLat - 25) * (0.8 / 10); // 5.8 -> 5.0
  } else if (absLat <= 45) {
    baseHours = 5.0 - (absLat - 35) * (0.8 / 10); // 5.0 -> 4.2
  } else {
    baseHours = Math.max(3.0, 4.2 - (absLat - 45) * (0.6 / 10)); // 4.2 -> 3.6
  }

  // Orientation modifier using the solar access factor
  const accessFactor = calculateSolarAccessFactor(azimuthDeg, tiltDeg, latitude);

  const result = baseHours * accessFactor;
  return Math.max(3, Math.min(7, result));
}

// ─── Monthly Production Distribution ──────────────────────────────

/**
 * Distribute annual production across 12 months using a sine-curve model
 * centered on June/July. Higher latitudes have more seasonal variation.
 */
export function calculateMonthlyProduction(
  annualKwh: number,
  latitude: number,
): number[] {
  const absLat = Math.abs(latitude);

  // Seasonal variation factor: higher latitudes have more variation
  // At equator: nearly uniform. At 45 deg: significant variation.
  const variationAmplitude = Math.min(0.6, absLat / 90);

  // Generate monthly weights using sine curve centered on month 6 (June/July)
  // Month 0 = January, month 5-6 = June/July peak
  const weights: number[] = [];
  for (let m = 0; m < 12; m++) {
    // Sine peak at month 5.5 (between June and July)
    const angle = ((m - 5.5) / 12) * 2 * Math.PI;
    const weight = 1 + variationAmplitude * Math.cos(angle);
    weights.push(Math.max(0.2, weight));
  }

  // Normalize weights so they sum to 12 (each weight represents fraction of monthly average)
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const normalizedWeights = weights.map((w) => (w / weightSum) * 12);

  // Distribute annual production
  const monthlyAvg = annualKwh / 12;
  return normalizedWeights.map((w) => Math.round(monthlyAvg * w));
}

// ─── Facet Analysis ────────────────────────────────────────────────

/**
 * Analyze a single roof facet for solar potential.
 * Applies 3ft edge setbacks to reduce usable area.
 * Calculates panel count, capacity, and production.
 */
export function analyzeFacet(
  facet: RoofFacet,
  config: SolarPanelConfig,
  latitude: number,
): SolarFacetAnalysis {
  const tiltDeg = pitchToTiltDeg(facet.pitch);
  const azimuthDeg = estimateAzimuthFromName(facet.name);

  // Apply 3ft edge setbacks to reduce usable area
  // Approximate: reduce true area by a setback margin.
  // For a roughly rectangular facet, subtracting a 3ft border from each edge:
  // usable = trueArea * (1 - setbackFraction). We estimate the perimeter-to-area ratio.
  // A conservative estimate: reduce area by ~20% for small facets, ~10% for large.
  const setbackFt = 3;
  const areaBasedReduction = Math.min(
    0.40,
    (setbackFt * 2 * Math.sqrt(facet.trueAreaSqFt) * 2) / facet.trueAreaSqFt,
  );
  const usableAreaSqFt = Math.max(0, facet.trueAreaSqFt * (1 - areaBasedReduction));

  // Panel area and count
  const panelAreaSqFt = config.panelWidthFt * config.panelHeightFt;
  const panelCount = Math.max(0, Math.floor(usableAreaSqFt / panelAreaSqFt));

  // Capacity in kW
  const panelCapacityKw = (panelCount * config.panelWattage) / 1000;

  // Solar access
  const solarAccessFactor = calculateSolarAccessFactor(azimuthDeg, tiltDeg, latitude);

  // Peak sun hours for this orientation
  const peakSunHours = calculatePeakSunHours(latitude, tiltDeg, azimuthDeg);

  // Annual production: capacity (kW) * peak sun hours/day * 365 * (1 - systemLosses)
  const annualProductionKwh =
    panelCapacityKw * peakSunHours * 365 * (1 - config.systemLosses);

  // Rating based on solar access factor
  let rating: SolarFacetAnalysis['rating'];
  if (solarAccessFactor >= 0.85) {
    rating = 'excellent';
  } else if (solarAccessFactor >= 0.70) {
    rating = 'good';
  } else if (solarAccessFactor >= 0.55) {
    rating = 'fair';
  } else {
    rating = 'poor';
  }

  return {
    facetId: facet.id,
    facetName: facet.name,
    azimuthDeg,
    tiltDeg: Math.round(tiltDeg * 10) / 10,
    usableAreaSqFt: Math.round(usableAreaSqFt),
    panelCount,
    panelCapacityKw: Math.round(panelCapacityKw * 100) / 100,
    annualProductionKwh: Math.round(annualProductionKwh),
    solarAccessFactor: Math.round(solarAccessFactor * 100) / 100,
    rating,
  };
}

// ─── Full System Analysis ──────────────────────────────────────────

/**
 * Analyze all facets and aggregate into a system summary.
 * Calculates costs, savings, payback period, and environmental impact.
 * CO2 offset: 1.22 lbs CO2 per kWh.
 * Trees equivalent: 48 lbs CO2 per tree per year.
 */
export function analyzeSolarPotential(
  measurement: RoofMeasurement,
  config: SolarPanelConfig,
  latitude: number,
): SolarSystemSummary {
  // Analyze each facet
  const facetAnalyses = measurement.facets.map((facet) =>
    analyzeFacet(facet, config, latitude),
  );

  // Aggregate totals
  const totalPanels = facetAnalyses.reduce((sum, fa) => sum + fa.panelCount, 0);
  const totalCapacityKw = facetAnalyses.reduce(
    (sum, fa) => sum + fa.panelCapacityKw,
    0,
  );
  const annualProductionKwh = facetAnalyses.reduce(
    (sum, fa) => sum + fa.annualProductionKwh,
    0,
  );

  // Monthly distribution
  const monthlyProductionKwh = calculateMonthlyProduction(
    annualProductionKwh,
    latitude,
  );

  // Financial calculations
  const systemCost = totalCapacityKw * 1000 * config.costPerWatt;
  const federalTaxCredit = systemCost * config.federalTaxCredit;
  const netCost = systemCost - federalTaxCredit;
  const annualSavings = annualProductionKwh * config.electricityRate;

  // Payback period considering annual rate increases
  let paybackYears = 0;
  let cumulativeSavings = 0;
  if (annualSavings > 0 && netCost > 0) {
    let currentRate = config.electricityRate;
    for (let year = 1; year <= 50; year++) {
      const yearlySavings = annualProductionKwh * currentRate;
      cumulativeSavings += yearlySavings;
      if (cumulativeSavings >= netCost) {
        // Interpolate within the year
        const prevCumulative = cumulativeSavings - yearlySavings;
        const remaining = netCost - prevCumulative;
        paybackYears = year - 1 + remaining / yearlySavings;
        break;
      }
      currentRate *= 1 + config.annualRateIncrease;
    }
    if (cumulativeSavings < netCost) {
      paybackYears = 50; // won't pay back in 50 years
    }
  }

  // 25-year savings
  let twentyFiveYearSavings = 0;
  {
    let currentRate = config.electricityRate;
    for (let year = 1; year <= 25; year++) {
      twentyFiveYearSavings += annualProductionKwh * currentRate;
      currentRate *= 1 + config.annualRateIncrease;
    }
    twentyFiveYearSavings -= netCost;
  }

  // Environmental impact
  const CO2_LBS_PER_KWH = 1.22;
  const CO2_LBS_PER_TREE_PER_YEAR = 48;
  const carbonOffsetLbs = annualProductionKwh * CO2_LBS_PER_KWH;
  const treesEquivalent = carbonOffsetLbs / CO2_LBS_PER_TREE_PER_YEAR;

  return {
    totalPanels,
    totalCapacityKw: Math.round(totalCapacityKw * 100) / 100,
    annualProductionKwh: Math.round(annualProductionKwh),
    monthlyProductionKwh,
    systemCost: Math.round(systemCost),
    federalTaxCredit: Math.round(federalTaxCredit),
    netCost: Math.round(netCost),
    annualSavings: Math.round(annualSavings),
    paybackYears: Math.round(paybackYears * 10) / 10,
    twentyFiveYearSavings: Math.round(twentyFiveYearSavings),
    carbonOffsetLbs: Math.round(carbonOffsetLbs),
    treesEquivalent: Math.round(treesEquivalent),
    facetAnalyses,
  };
}
