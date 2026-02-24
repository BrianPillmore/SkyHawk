import type {
  CommercialRoofSection,
  DrainageZone,
  DrainageAnalysisResult,
  DrainLayoutRecommendation,
} from '../types/commercial';
import { calculatePerimeter } from './commercialRoof';

/**
 * Standard: 1 drain per 10,000 sqft for flat/low-slope roofs.
 * For areas with higher rainfall intensity, use 1 per 7,500 sqft.
 */
const SQFT_PER_DRAIN = 10_000;

/**
 * Minimum slope (in inches per foot) considered adequate for drainage.
 * Industry standard for flat roofs: 1/4 inch per foot.
 */
const ADEQUATE_SLOPE_IN_PER_FT = 0.25;

/**
 * Marginal slope threshold: slopes between 1/8" and 1/4" per foot
 * are considered marginal for drainage.
 */
const MARGINAL_SLOPE_IN_PER_FT = 0.125;

/**
 * Calculate the ponding risk for a given roof section based on area,
 * slope, and drain count.
 *
 *   - Low: proper slope (>= 1/4"/ft) AND adequate drain count
 *   - Medium: marginal slope (1/8" to 1/4"/ft) OR slightly insufficient drains
 *   - High: no/minimal slope (< 1/8"/ft) OR very few drains for the area
 */
export function calculatePondingRisk(
  areaSqFt: number,
  slopePctPerFt: number,
  drainCount: number
): 'low' | 'medium' | 'high' {
  const recommendedDrains = Math.max(1, Math.ceil(areaSqFt / SQFT_PER_DRAIN));
  const drainRatio = drainCount / recommendedDrains;
  const hasAdequateSlope = slopePctPerFt >= ADEQUATE_SLOPE_IN_PER_FT;
  const hasMarginalSlope = slopePctPerFt >= MARGINAL_SLOPE_IN_PER_FT;

  // High risk: nearly no slope or severely under-drained
  if (!hasMarginalSlope || drainRatio < 0.5) {
    return 'high';
  }

  // Low risk: good slope and adequate drains
  if (hasAdequateSlope && drainRatio >= 1.0) {
    return 'low';
  }

  // Everything else is medium
  return 'medium';
}

/**
 * Analyze drainage for a commercial roof section given its drainage zones.
 * Evaluates capacity, ponding risk, and generates recommendations.
 */
export function analyzeDrainage(
  section: CommercialRoofSection,
  drains: DrainageZone[]
): DrainageAnalysisResult {
  const sectionDrains = drains.filter((d) => d.sectionId === section.id);
  const existingDrainCount = sectionDrains.reduce((sum, d) => sum + d.drainCount, 0);
  const recommendedDrainCount = Math.max(1, Math.ceil(section.areaSqFt / SQFT_PER_DRAIN));

  const pondingRisk = calculatePondingRisk(
    section.areaSqFt,
    section.slopePctPerFt,
    existingDrainCount
  );

  // Determine adequacy
  let adequacy: 'adequate' | 'marginal' | 'inadequate';
  if (existingDrainCount >= recommendedDrainCount) {
    adequacy = 'adequate';
  } else if (existingDrainCount >= recommendedDrainCount * 0.75) {
    adequacy = 'marginal';
  } else {
    adequacy = 'inadequate';
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (existingDrainCount < recommendedDrainCount) {
    const deficit = recommendedDrainCount - existingDrainCount;
    recommendations.push(
      `Add ${deficit} additional drain(s) — current: ${existingDrainCount}, recommended: ${recommendedDrainCount}.`
    );
  }

  if (section.slopePctPerFt < ADEQUATE_SLOPE_IN_PER_FT) {
    if (section.slopePctPerFt < MARGINAL_SLOPE_IN_PER_FT) {
      recommendations.push(
        'Install tapered insulation to create positive drainage slope (minimum 1/4" per foot).'
      );
    } else {
      recommendations.push(
        'Current slope is marginal. Consider tapered insulation to improve drainage to 1/4" per foot.'
      );
    }
  }

  if (pondingRisk === 'high') {
    recommendations.push(
      'High ponding risk: schedule immediate inspection and consider emergency drainage improvements.'
    );
  }

  if (sectionDrains.length === 0) {
    recommendations.push(
      'No drainage zones configured for this section. Add internal drains or scuppers.'
    );
  }

  // Check for drains with poor adequacy
  const poorDrains = sectionDrains.filter((d) => d.adequacy === 'inadequate');
  if (poorDrains.length > 0) {
    recommendations.push(
      `${poorDrains.length} drainage zone(s) rated inadequate — upgrade or supplement.`
    );
  }

  return {
    sectionId: section.id,
    areaSqFt: section.areaSqFt,
    existingDrainCount,
    recommendedDrainCount,
    adequacy,
    pondingRisk,
    recommendations,
  };
}

/**
 * Recommend a drain layout for a commercial roof section.
 * Considers section shape, area, and slope direction.
 */
export function recommendDrainLayout(section: CommercialRoofSection): DrainLayoutRecommendation {
  const recommendedDrainCount = Math.max(1, Math.ceil(section.areaSqFt / SQFT_PER_DRAIN));

  // Determine recommended drain type based on section characteristics
  let drainType: 'internal-drain' | 'scupper' | 'gutter';
  const notes: string[] = [];

  if (section.areaSqFt >= 20_000) {
    // Large sections: internal drains are more effective
    drainType = 'internal-drain';
    notes.push('Internal drains recommended for large roof sections (>20,000 sqft).');
  } else if (section.slopePctPerFt >= ADEQUATE_SLOPE_IN_PER_FT) {
    // Adequate slope: scuppers at perimeter can work well
    drainType = 'scupper';
    notes.push('Scuppers suitable for this section given adequate slope.');
  } else {
    // Default to internal drains
    drainType = 'internal-drain';
    notes.push('Internal drains recommended to minimize ponding risk.');
  }

  // Calculate spacing between drains
  const perimeterLf = calculatePerimeter(section.vertices);
  let spacingFt: number;

  if (recommendedDrainCount <= 1) {
    spacingFt = 0; // Single drain, no spacing
  } else if (drainType === 'scupper') {
    // Scuppers are placed along the perimeter
    spacingFt = perimeterLf > 0 ? perimeterLf / recommendedDrainCount : 0;
  } else {
    // Internal drains: evenly distribute across the area
    // Approximate spacing as sqrt(area / drain_count)
    spacingFt = Math.sqrt(section.areaSqFt / recommendedDrainCount);
  }

  // Add slope-related notes
  if (section.slopePctPerFt < MARGINAL_SLOPE_IN_PER_FT) {
    notes.push('Consider tapered insulation crickets to direct water toward drains.');
  }

  if (section.roofType === 'flat' || section.roofType === 'single-ply') {
    notes.push('Ensure all drain sumps are recessed below membrane level.');
  }

  return {
    sectionId: section.id,
    recommendedDrainCount,
    drainType,
    spacingFt: Math.round(spacingFt * 10) / 10,
    notes,
  };
}
