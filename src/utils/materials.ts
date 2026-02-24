import type { RoofMeasurement } from '../types';

export interface MaterialEstimate {
  /** Roofing shingles: 3 bundles per square */
  shingleBundles: number;
  /** Underlayment rolls: 4 squares per roll (typical 15lb felt or synthetic) */
  underlaymentRolls: number;
  /** Ice & water shield rolls: 2 squares per roll, applied at eaves (3ft wide) */
  iceWaterRolls: number;
  /** Starter strip: linear feet equal to eave + rake length */
  starterStripLf: number;
  /** Ridge cap: linear feet of ridge + hip lines */
  ridgeCapLf: number;
  /** Drip edge: linear feet of eave + rake */
  dripEdgeLf: number;
  /** Step flashing pieces: 1 per foot of flashing/wall-junction length */
  stepFlashingPcs: number;
  /** Pipe boots (estimated based on area) */
  pipeBoots: number;
  /** Roofing nails (lbs): ~1.75 lbs per square */
  nailsLbs: number;
  /** Caulk tubes: 1 per 25 linear feet of flashing */
  caulkTubes: number;
  /** Ventilation (linear feet of ridge vent) */
  ridgeVentLf: number;
  /** Hip & ridge shingle bundles: 1 bundle per ~35 linear feet */
  hipRidgeBundles: number;
  /** Valley metal/ice & water: linear feet of valley */
  valleyMetalLf: number;
  /** Plywood/OSB sheathing: 4x8 sheets (32 sq ft each) */
  sheathingSheets: number;
  /** Coil nails for nail gun: boxes (7200 nails/box, ~320 per square) */
  coilNailBoxes: number;
  /** Roof-to-wall flashing (L-metal): 10ft pieces */
  roofToWallFlashingPcs: number;
}

/**
 * Estimate materials from roof measurements.
 * Uses industry-standard quantities per square/linear foot.
 * All values include the specified waste factor.
 */
export function estimateMaterials(
  measurement: RoofMeasurement,
  wastePercent: number = measurement.suggestedWastePercent
): MaterialEstimate {
  const wasteMult = 1 + wastePercent / 100;
  const squares = measurement.totalSquares * wasteMult;

  const eaveRakeLf = measurement.totalEaveLf + measurement.totalRakeLf;
  const ridgeHipLf = measurement.totalRidgeLf + measurement.totalHipLf;
  const flashingLf = measurement.totalFlashingLf;

  return {
    // 3 bundles per square (standard 3-tab or architectural shingles)
    shingleBundles: Math.ceil(squares * 3),

    // 1 roll covers ~4 squares (400 sq ft) for 15lb felt or synthetic
    underlaymentRolls: Math.ceil(squares / 4),

    // Ice & water shield at eaves: 3ft wide strip along eave length
    // 1 roll = 66.7 linear feet (200 sq ft / 3ft width)
    iceWaterRolls: Math.ceil((measurement.totalEaveLf * wasteMult) / 66.7),

    // Starter strip = eave + rake perimeter length
    starterStripLf: Math.ceil(eaveRakeLf * wasteMult),

    // Ridge cap shingles run along all ridge + hip lines
    ridgeCapLf: Math.ceil(ridgeHipLf * wasteMult),

    // Drip edge along all eave + rake edges
    dripEdgeLf: Math.ceil(eaveRakeLf * wasteMult),

    // Step flashing: 1 piece per foot of wall junction
    stepFlashingPcs: Math.ceil(flashingLf * wasteMult),

    // Pipe boots: estimate 1 per 1000 sq ft of roof area
    pipeBoots: Math.max(1, Math.ceil(measurement.totalTrueAreaSqFt / 1000)),

    // Nails: ~1.75 lbs per square
    nailsLbs: Math.ceil(squares * 1.75),

    // Caulk: 1 tube per 25 linear feet of flashing
    caulkTubes: Math.max(flashingLf > 0 ? 1 : 0, Math.ceil(flashingLf / 25)),

    // Ridge vent: typically runs full ridge length
    ridgeVentLf: Math.ceil(measurement.totalRidgeLf * wasteMult),

    // Hip & ridge shingle bundles: 1 bundle covers ~35 linear feet
    hipRidgeBundles: Math.ceil((ridgeHipLf * wasteMult) / 35),

    // Valley metal (pre-bent W-valley) or ice & water in valleys
    valleyMetalLf: Math.ceil(measurement.totalValleyLf * wasteMult),

    // Plywood/OSB sheathing: 4x8 sheets = 32 sq ft each (for tear-off replacement)
    sheathingSheets: Math.ceil((measurement.totalTrueAreaSqFt * wasteMult) / 32),

    // Coil nails: ~320 nails per square, 7200 per box
    coilNailBoxes: Math.max(1, Math.ceil((squares * 320) / 7200)),

    // Roof-to-wall flashing (L-metal or step flashing) in 10ft pieces
    roofToWallFlashingPcs: Math.ceil((flashingLf + (measurement.totalStepFlashingLf || 0)) * wasteMult / 10),
  };
}

/** Format a material line for display */
export function formatMaterialLine(qty: number, unit: string, name: string): string {
  return `${qty} ${unit} — ${name}`;
}
