import type { RoofMeasurement } from '../types';
import type { SolarBuildingInsights } from '../types/solar';

export interface AccuracyBreakdown {
  /** Overall accuracy score 0-100 */
  overallScore: number;
  /** Letter grade */
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D';
  /** Display label like "High Accuracy" */
  label: string;
  /** Individual factor scores */
  factors: {
    dataSource: { score: number; label: string; weight: number };
    imageryQuality: { score: number; label: string; weight: number };
    facetCount: { score: number; label: string; weight: number };
    areaValidation: { score: number; label: string; weight: number };
    pitchConsistency: { score: number; label: string; weight: number };
  };
  /** Solar API area vs measured area delta percentage (if available) */
  areaDeltaPercent?: number;
}

/**
 * Compute a measurable accuracy score based on multiple quality signals.
 *
 * Factors:
 * 1. Data source (30%): LIDAR+Solar > hybrid > AI Vision > manual
 * 2. Imagery quality (20%): HIGH > MEDIUM > LOW
 * 3. Facet count (15%): More facets relative to Solar API segments = better reconstruction
 * 4. Area cross-validation (25%): Measured area vs Solar API wholeRoofStats area
 * 5. Pitch consistency (10%): Low variance across facets = more reliable
 */
export function computeAccuracyScore(
  measurement: RoofMeasurement,
  solarInsights?: SolarBuildingInsights | null,
): AccuracyBreakdown {
  // Factor 1: Data source (30 points max)
  const dataSourceScore = getDataSourceScore(measurement.dataSource);

  // Factor 2: Imagery quality (20 points max)
  const imageryScore = getImageryQualityScore(measurement.imageryQuality);

  // Factor 3: Facet count vs Solar API segments (15 points max)
  const solarSegmentCount = solarInsights?.solarPotential?.roofSegmentStats?.length ?? 0;
  const facetScore = getFacetCountScore(measurement.facets.length, solarSegmentCount);

  // Factor 4: Area cross-validation (25 points max)
  const solarAreaM2 = solarInsights?.solarPotential?.wholeRoofStats?.areaMeters2;
  const solarAreaSqFt = solarAreaM2 ? solarAreaM2 * 10.7639 : undefined;
  const areaResult = getAreaValidationScore(measurement.totalTrueAreaSqFt, solarAreaSqFt);

  // Factor 5: Pitch consistency (10 points max)
  const pitchScore = getPitchConsistencyScore(measurement.facets);

  const overallScore = Math.round(
    dataSourceScore.score + imageryScore.score + facetScore.score +
    areaResult.score + pitchScore.score
  );

  const clampedScore = Math.max(0, Math.min(100, overallScore));

  return {
    overallScore: clampedScore,
    grade: scoreToGrade(clampedScore),
    label: scoreToLabel(clampedScore),
    factors: {
      dataSource: { ...dataSourceScore, weight: 30 },
      imageryQuality: { ...imageryScore, weight: 20 },
      facetCount: { ...facetScore, weight: 15 },
      areaValidation: { ...areaResult, weight: 25 },
      pitchConsistency: { ...pitchScore, weight: 10 },
    },
    areaDeltaPercent: areaResult.deltaPercent,
  };
}

function getDataSourceScore(dataSource?: string): { score: number; label: string } {
  switch (dataSource) {
    case 'lidar-mask':
      return { score: 30, label: 'LIDAR + Solar API (best)' };
    case 'hybrid':
      return { score: 22, label: 'Solar API + AI (good)' };
    case 'ai-vision':
      return { score: 15, label: 'AI Vision only (moderate)' };
    default:
      return { score: 8, label: 'Manual measurement' };
  }
}

function getImageryQualityScore(quality?: string): { score: number; label: string } {
  switch (quality) {
    case 'HIGH':
      return { score: 20, label: 'HIGH quality imagery' };
    case 'MEDIUM':
      return { score: 10, label: 'MEDIUM quality (reduced accuracy)' };
    case 'LOW':
      return { score: 5, label: 'LOW quality (limited accuracy)' };
    default:
      // No quality info — assume moderate
      return { score: 12, label: 'Quality unknown' };
  }
}

function getFacetCountScore(
  measuredFacets: number,
  solarSegments: number,
): { score: number; label: string } {
  if (solarSegments === 0) {
    // No Solar API reference — give moderate score based on facet count alone
    if (measuredFacets >= 4) return { score: 10, label: `${measuredFacets} facets detected` };
    if (measuredFacets >= 2) return { score: 7, label: `${measuredFacets} facets detected` };
    return { score: 3, label: 'Single facet' };
  }

  // Compare measured facets to Solar API segment count
  const ratio = measuredFacets / solarSegments;
  if (ratio >= 0.8 && ratio <= 1.3) {
    return { score: 15, label: `${measuredFacets}/${solarSegments} segments matched` };
  }
  if (ratio >= 0.5 && ratio <= 1.8) {
    return { score: 10, label: `${measuredFacets}/${solarSegments} segments (partial match)` };
  }
  return { score: 5, label: `${measuredFacets}/${solarSegments} segments (mismatch)` };
}

function getAreaValidationScore(
  measuredAreaSqFt: number,
  solarAreaSqFt?: number,
): { score: number; label: string; deltaPercent?: number } {
  if (!solarAreaSqFt || solarAreaSqFt === 0 || measuredAreaSqFt === 0) {
    return { score: 12, label: 'No cross-validation available' };
  }

  const deltaPercent = Math.abs(measuredAreaSqFt - solarAreaSqFt) / solarAreaSqFt * 100;

  if (deltaPercent <= 5) {
    return { score: 25, label: `Within 5% of Solar API (${deltaPercent.toFixed(1)}%)`, deltaPercent };
  }
  if (deltaPercent <= 10) {
    return { score: 20, label: `Within 10% of Solar API (${deltaPercent.toFixed(1)}%)`, deltaPercent };
  }
  if (deltaPercent <= 15) {
    return { score: 15, label: `Within 15% of Solar API (${deltaPercent.toFixed(1)}%)`, deltaPercent };
  }
  if (deltaPercent <= 25) {
    return { score: 10, label: `Within 25% of Solar API (${deltaPercent.toFixed(1)}%)`, deltaPercent };
  }
  return { score: 5, label: `>${deltaPercent.toFixed(0)}% deviation from Solar API`, deltaPercent };
}

function getPitchConsistencyScore(
  facets: { pitch: number }[],
): { score: number; label: string } {
  if (facets.length <= 1) {
    return { score: 7, label: 'Single facet (no comparison)' };
  }

  // Compute coefficient of variation of pitch values
  const pitches = facets.map(f => f.pitch).filter(p => p > 0);
  if (pitches.length === 0) return { score: 5, label: 'No pitch data' };

  const mean = pitches.reduce((a, b) => a + b, 0) / pitches.length;
  if (mean === 0) return { score: 5, label: 'Flat roof' };

  const variance = pitches.reduce((sum, p) => sum + (p - mean) ** 2, 0) / pitches.length;
  const cv = Math.sqrt(variance) / mean;

  // Low CV = consistent pitches (typical for well-detected roofs)
  if (cv <= 0.15) return { score: 10, label: 'Consistent pitch across facets' };
  if (cv <= 0.3) return { score: 8, label: 'Moderate pitch variation' };
  if (cv <= 0.5) return { score: 5, label: 'High pitch variation' };
  return { score: 3, label: 'Very high pitch variation (review recommended)' };
}

function scoreToGrade(score: number): AccuracyBreakdown['grade'] {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 45) return 'C';
  return 'D';
}

function scoreToLabel(score: number): string {
  if (score >= 90) return 'Very High Accuracy';
  if (score >= 80) return 'High Accuracy';
  if (score >= 70) return 'Good Accuracy';
  if (score >= 60) return 'Moderate Accuracy';
  if (score >= 45) return 'Limited Accuracy';
  return 'Low Accuracy — Manual Review Recommended';
}
