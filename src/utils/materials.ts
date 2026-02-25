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

// ============ MATERIAL COST PRICING ============

/**
 * National average material prices (2025-2026).
 * Prices are per unit (bundle, roll, linear foot, piece, etc.).
 * These serve as defaults — can be overridden with regional pricing.
 */
export const DEFAULT_MATERIAL_PRICES = {
  shingleBundlePrice: 35.00,        // per bundle (architectural)
  hipRidgeBundlePrice: 45.00,       // per bundle (hip & ridge cap)
  underlaymentRollPrice: 55.00,     // per roll (synthetic)
  iceWaterRollPrice: 95.00,         // per roll
  starterStripPerLf: 0.45,          // per linear foot
  ridgeCapPerLf: 1.20,              // per linear foot (installed price)
  dripEdgePerLf: 0.85,              // per 10ft piece / 10
  valleyMetalPerLf: 2.50,           // per linear foot (W-valley)
  stepFlashingPerPc: 1.50,          // per piece
  roofToWallFlashingPerPc: 8.00,    // per 10ft piece
  pipeBootPrice: 12.00,             // each
  coilNailBoxPrice: 45.00,          // per box
  handNailPerLb: 3.50,              // per lb
  caulkTubePrice: 6.50,             // per tube
  ridgeVentPerLf: 3.50,             // per linear foot
  sheathingSheetPrice: 28.00,       // per 4x8 sheet
} as const;

export type MaterialPrices = typeof DEFAULT_MATERIAL_PRICES;

export interface MaterialCostEstimate {
  /** Per-item cost breakdown */
  items: {
    name: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
  }[];
  /** Total material cost */
  totalMaterialCost: number;
  /** Estimated labor cost (materials * labor multiplier) */
  estimatedLaborCost: number;
  /** Total project cost (materials + labor) */
  totalProjectCost: number;
  /** Cost per square (total / squares) */
  costPerSquare: number;
}

/**
 * Compute estimated material costs from a material estimate.
 * Uses national average pricing with optional regional overrides.
 *
 * Labor cost is estimated at 1.5x material cost (industry standard ratio
 * for residential roofing — materials ~40%, labor ~60% of total job).
 */
export function estimateMaterialCosts(
  materials: MaterialEstimate,
  squares: number,
  prices: Partial<MaterialPrices> = {},
): MaterialCostEstimate {
  const p = { ...DEFAULT_MATERIAL_PRICES, ...prices };

  const items: MaterialCostEstimate['items'] = [
    { name: 'Shingle Bundles', quantity: materials.shingleBundles, unit: 'bundles', unitPrice: p.shingleBundlePrice, totalPrice: materials.shingleBundles * p.shingleBundlePrice },
    { name: 'Hip & Ridge Shingles', quantity: materials.hipRidgeBundles, unit: 'bundles', unitPrice: p.hipRidgeBundlePrice, totalPrice: materials.hipRidgeBundles * p.hipRidgeBundlePrice },
    { name: 'Underlayment', quantity: materials.underlaymentRolls, unit: 'rolls', unitPrice: p.underlaymentRollPrice, totalPrice: materials.underlaymentRolls * p.underlaymentRollPrice },
    { name: 'Ice & Water Shield', quantity: materials.iceWaterRolls, unit: 'rolls', unitPrice: p.iceWaterRollPrice, totalPrice: materials.iceWaterRolls * p.iceWaterRollPrice },
    { name: 'Starter Strip', quantity: materials.starterStripLf, unit: 'lf', unitPrice: p.starterStripPerLf, totalPrice: materials.starterStripLf * p.starterStripPerLf },
    { name: 'Ridge Cap', quantity: materials.ridgeCapLf, unit: 'lf', unitPrice: p.ridgeCapPerLf, totalPrice: materials.ridgeCapLf * p.ridgeCapPerLf },
    { name: 'Drip Edge', quantity: materials.dripEdgeLf, unit: 'lf', unitPrice: p.dripEdgePerLf, totalPrice: materials.dripEdgeLf * p.dripEdgePerLf },
    { name: 'Valley Metal', quantity: materials.valleyMetalLf, unit: 'lf', unitPrice: p.valleyMetalPerLf, totalPrice: materials.valleyMetalLf * p.valleyMetalPerLf },
    { name: 'Step Flashing', quantity: materials.stepFlashingPcs, unit: 'pcs', unitPrice: p.stepFlashingPerPc, totalPrice: materials.stepFlashingPcs * p.stepFlashingPerPc },
    { name: 'Roof-to-Wall Flashing', quantity: materials.roofToWallFlashingPcs, unit: 'pcs', unitPrice: p.roofToWallFlashingPerPc, totalPrice: materials.roofToWallFlashingPcs * p.roofToWallFlashingPerPc },
    { name: 'Pipe Boots', quantity: materials.pipeBoots, unit: 'pcs', unitPrice: p.pipeBootPrice, totalPrice: materials.pipeBoots * p.pipeBootPrice },
    { name: 'Coil Nails', quantity: materials.coilNailBoxes, unit: 'boxes', unitPrice: p.coilNailBoxPrice, totalPrice: materials.coilNailBoxes * p.coilNailBoxPrice },
    { name: 'Hand Nails', quantity: materials.nailsLbs, unit: 'lbs', unitPrice: p.handNailPerLb, totalPrice: materials.nailsLbs * p.handNailPerLb },
    { name: 'Caulk', quantity: materials.caulkTubes, unit: 'tubes', unitPrice: p.caulkTubePrice, totalPrice: materials.caulkTubes * p.caulkTubePrice },
    { name: 'Ridge Vent', quantity: materials.ridgeVentLf, unit: 'lf', unitPrice: p.ridgeVentPerLf, totalPrice: materials.ridgeVentLf * p.ridgeVentPerLf },
    { name: 'Sheathing (OSB)', quantity: materials.sheathingSheets, unit: 'sheets', unitPrice: p.sheathingSheetPrice, totalPrice: materials.sheathingSheets * p.sheathingSheetPrice },
  ].filter(item => item.quantity > 0);

  const totalMaterialCost = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const estimatedLaborCost = totalMaterialCost * 1.5; // 60/40 labor/material ratio
  const totalProjectCost = totalMaterialCost + estimatedLaborCost;
  const costPerSquare = squares > 0 ? totalProjectCost / squares : 0;

  return {
    items,
    totalMaterialCost: Math.round(totalMaterialCost * 100) / 100,
    estimatedLaborCost: Math.round(estimatedLaborCost * 100) / 100,
    totalProjectCost: Math.round(totalProjectCost * 100) / 100,
    costPerSquare: Math.round(costPerSquare * 100) / 100,
  };
}

/** Format a dollar amount */
export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
