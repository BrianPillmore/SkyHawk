import type { RoofConditionAssessment, RoofMaterialType } from '../types';

// Material expected lifespans in years
const MATERIAL_LIFESPAN: Record<RoofMaterialType, number> = {
  'asphalt-shingle': 25,
  'metal': 50,
  'tile': 50,
  'slate': 100,
  'wood-shake': 30,
  'tpo': 25,
  'epdm': 25,
  'built-up': 20,
  'concrete': 50,
  'unknown': 25,
};

export function getExpectedLifespan(material: RoofMaterialType): number {
  return MATERIAL_LIFESPAN[material] ?? 25;
}

export function calculateConditionCategory(score: number): RoofConditionAssessment['category'] {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  if (score >= 30) return 'poor';
  return 'critical';
}

export function estimateRemainingLife(material: RoofMaterialType, ageYears: number, conditionScore: number): number {
  const lifespan = getExpectedLifespan(material);
  const conditionFactor = conditionScore / 100;
  const remaining = (lifespan - ageYears) * conditionFactor;
  return Math.max(0, Math.round(remaining));
}

export function generateFindings(assessment: Partial<RoofConditionAssessment>): string[] {
  const findings: string[] = [];
  const score = assessment.overallScore ?? 0;
  const age = assessment.estimatedAgeYears ?? 0;
  const material = assessment.materialType ?? 'unknown';
  const lifespan = getExpectedLifespan(material);

  if (score >= 85) findings.push('Roof is in excellent overall condition');
  else if (score >= 70) findings.push('Roof is in good condition with minor wear');
  else if (score >= 50) findings.push('Roof shows moderate wear and aging');
  else if (score >= 30) findings.push('Roof shows significant deterioration');
  else findings.push('Roof is in critical condition requiring immediate attention');

  if (age > lifespan * 0.8) findings.push(`Roof is approaching end of expected ${lifespan}-year lifespan`);
  if (age > lifespan) findings.push('Roof has exceeded its expected lifespan');

  const damages = assessment.damageDetected ?? [];
  const severeDamage = damages.filter(d => d.severity === 'severe');
  if (severeDamage.length > 0) findings.push(`${severeDamage.length} severe damage area(s) detected`);

  return findings;
}

export function generateRecommendations(assessment: Partial<RoofConditionAssessment>): string[] {
  const recs: string[] = [];
  const score = assessment.overallScore ?? 0;
  const remaining = assessment.estimatedRemainingLifeYears ?? 0;

  if (score >= 85) {
    recs.push('Continue regular maintenance schedule');
    recs.push('Schedule inspection in 2-3 years');
  } else if (score >= 70) {
    recs.push('Address minor repairs within 6 months');
    recs.push('Schedule annual inspections');
  } else if (score >= 50) {
    recs.push('Professional inspection recommended within 30 days');
    recs.push('Budget for potential replacement within 3-5 years');
  } else if (score >= 30) {
    recs.push('Urgent professional inspection required');
    recs.push('Begin planning roof replacement');
  } else {
    recs.push('Immediate professional evaluation required');
    recs.push('Roof replacement should be prioritized');
    recs.push('Check for interior water damage');
  }

  if (remaining <= 2 && remaining > 0) recs.push('Consider replacement within 1-2 years');
  if (remaining <= 0) recs.push('Roof has exceeded useful life - replacement recommended');

  const damages = assessment.damageDetected ?? [];
  if (damages.some(d => d.type === 'hail')) recs.push('File insurance claim for hail damage');
  if (damages.some(d => d.type === 'wind')) recs.push('Repair wind-damaged sections before next storm');

  return recs;
}
