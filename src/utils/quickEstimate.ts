/**
 * Quick Estimate Calculator
 *
 * Provides instant material and cost estimates from basic property parameters
 * without requiring a full auto-measurement. Useful for sales quotes, initial
 * assessments, and homeowner conversations.
 */

export type RoofComplexity = 'simple' | 'moderate' | 'complex' | 'very_complex';
export type ShingleGrade = 'three_tab' | 'architectural' | 'premium' | 'designer';
export type UnderlaymentType = 'felt_15' | 'felt_30' | 'synthetic';

export interface QuickEstimateInput {
  /** Total roof area in square feet (flat/plan area or true area) */
  areaSqFt: number;
  /** Predominant pitch in x/12 */
  pitch: number;
  /** Whether the input area is already pitch-adjusted */
  isPitchAdjusted?: boolean;
  /** Roof complexity */
  complexity: RoofComplexity;
  /** Number of stories (affects labor) */
  stories: number;
  /** Shingle grade */
  shingleGrade: ShingleGrade;
  /** Underlayment type */
  underlayment: UnderlaymentType;
  /** Whether tearoff of existing roof is needed */
  tearoff: boolean;
  /** Number of layers to tear off (1 or 2) */
  tearoffLayers?: number;
}

export interface QuickEstimateResult {
  /** True area (pitch-adjusted if input was flat area) */
  trueAreaSqFt: number;
  /** Roofing squares */
  squares: number;
  /** Squares with waste */
  squaresWithWaste: number;
  /** Waste percentage applied */
  wastePercent: number;

  /** Material quantities */
  materials: {
    shingleBundles: number;
    underlaymentRolls: number;
    iceWaterRolls: number;
    starterStripLf: number;
    ridgeCapLf: number;
    dripEdgeLf: number;
    nailsLbs: number;
    ventLf: number;
  };

  /** Cost breakdown */
  costs: {
    shingles: number;
    underlayment: number;
    iceWater: number;
    accessories: number;
    tearoff: number;
    labor: number;
    disposal: number;
    totalMaterials: number;
    totalLabor: number;
    grandTotal: number;
  };

  /** Per-square cost */
  costPerSquare: number;
}

// ─── Price tables ────────────────────────────────────────────────

const SHINGLE_PRICES_PER_BUNDLE: Record<ShingleGrade, number> = {
  three_tab: 30,
  architectural: 42,
  premium: 65,
  designer: 95,
};

const UNDERLAYMENT_PRICES_PER_ROLL: Record<UnderlaymentType, number> = {
  felt_15: 22,
  felt_30: 32,
  synthetic: 65,
};

const ICE_WATER_PRICE_PER_ROLL = 75;
const STARTER_STRIP_PRICE_PER_LF = 0.45;
const RIDGE_CAP_PRICE_PER_LF = 1.50;
const DRIP_EDGE_PRICE_PER_LF = 0.75;
const NAILS_PRICE_PER_LB = 2.50;
const VENT_PRICE_PER_LF = 4.00;

const LABOR_PER_SQUARE: Record<RoofComplexity, number> = {
  simple: 75,
  moderate: 95,
  complex: 120,
  very_complex: 155,
};

const STORY_LABOR_MULTIPLIER: Record<number, number> = {
  1: 1.0,
  2: 1.15,
  3: 1.35,
};

const TEAROFF_COST_PER_SQUARE = 45; // per layer
const DISPOSAL_COST_PER_SQUARE = 25;

// ─── Waste factors ───────────────────────────────────────────────

const WASTE_FACTORS: Record<RoofComplexity, number> = {
  simple: 8,
  moderate: 12,
  complex: 17,
  very_complex: 22,
};

// ─── Pitch multiplier ────────────────────────────────────────────

/**
 * Pitch-to-area multiplier for converting flat area to true area.
 * Formula: sqrt(1 + (pitch/12)^2)
 */
export function pitchMultiplier(pitch: number): number {
  return Math.sqrt(1 + (pitch / 12) ** 2);
}

// ─── Perimeter estimation ────────────────────────────────────────

/**
 * Estimate perimeter (eave + rake) from area and complexity.
 * Uses a simplified model: perimeter ≈ k * sqrt(area).
 */
export function estimatePerimeter(areaSqFt: number, complexity: RoofComplexity): number {
  const perimeterFactors: Record<RoofComplexity, number> = {
    simple: 4.0,
    moderate: 4.5,
    complex: 5.2,
    very_complex: 6.0,
  };
  return perimeterFactors[complexity] * Math.sqrt(areaSqFt);
}

/**
 * Estimate ridge length from area and complexity.
 */
export function estimateRidgeLength(areaSqFt: number, complexity: RoofComplexity): number {
  const ridgeFactors: Record<RoofComplexity, number> = {
    simple: 0.8,
    moderate: 1.0,
    complex: 1.3,
    very_complex: 1.6,
  };
  return ridgeFactors[complexity] * Math.sqrt(areaSqFt);
}

// ─── Main calculator ─────────────────────────────────────────────

/**
 * Calculate a quick material and cost estimate from basic inputs.
 */
export function calculateQuickEstimate(input: QuickEstimateInput): QuickEstimateResult {
  // 1. Compute true area
  const trueAreaSqFt = input.isPitchAdjusted
    ? input.areaSqFt
    : input.areaSqFt * pitchMultiplier(input.pitch);

  // 2. Compute squares and waste
  const squares = trueAreaSqFt / 100;
  const wastePercent = WASTE_FACTORS[input.complexity];
  const wasteMult = 1 + wastePercent / 100;
  const squaresWithWaste = squares * wasteMult;

  // 3. Estimate perimeter and ridge
  const perimeterLf = estimatePerimeter(trueAreaSqFt, input.complexity);
  const ridgeLf = estimateRidgeLength(trueAreaSqFt, input.complexity);

  // 4. Compute material quantities
  const shingleBundles = Math.ceil(squaresWithWaste * 3);
  const underlaymentRolls = Math.ceil(squaresWithWaste / 4);
  const iceWaterRolls = Math.ceil(perimeterLf / 66); // 66 LF per roll along eaves
  const starterStripLf = Math.ceil(perimeterLf);
  const ridgeCapLf = Math.ceil(ridgeLf);
  const dripEdgeLf = Math.ceil(perimeterLf);
  const nailsLbs = Math.ceil(squaresWithWaste * 1.75);
  const ventLf = Math.ceil(ridgeLf * 0.7); // ~70% of ridge gets vent

  // 5. Compute costs
  const shinglesCost = shingleBundles * SHINGLE_PRICES_PER_BUNDLE[input.shingleGrade];
  const underlaymentCost = underlaymentRolls * UNDERLAYMENT_PRICES_PER_ROLL[input.underlayment];
  const iceWaterCost = iceWaterRolls * ICE_WATER_PRICE_PER_ROLL;
  const accessoriesCost =
    starterStripLf * STARTER_STRIP_PRICE_PER_LF +
    ridgeCapLf * RIDGE_CAP_PRICE_PER_LF +
    dripEdgeLf * DRIP_EDGE_PRICE_PER_LF +
    nailsLbs * NAILS_PRICE_PER_LB +
    ventLf * VENT_PRICE_PER_LF;

  const totalMaterials = shinglesCost + underlaymentCost + iceWaterCost + accessoriesCost;

  const storyMult = STORY_LABOR_MULTIPLIER[Math.min(input.stories, 3)] || 1.35;
  const laborCost = squaresWithWaste * LABOR_PER_SQUARE[input.complexity] * storyMult;

  const tearoffCost = input.tearoff
    ? squaresWithWaste * TEAROFF_COST_PER_SQUARE * (input.tearoffLayers || 1)
    : 0;
  const disposalCost = input.tearoff
    ? squaresWithWaste * DISPOSAL_COST_PER_SQUARE * (input.tearoffLayers || 1)
    : 0;

  const totalLabor = laborCost + tearoffCost + disposalCost;
  const grandTotal = totalMaterials + totalLabor;

  return {
    trueAreaSqFt: Math.round(trueAreaSqFt),
    squares: Math.round(squares * 10) / 10,
    squaresWithWaste: Math.round(squaresWithWaste * 10) / 10,
    wastePercent,
    materials: {
      shingleBundles,
      underlaymentRolls,
      iceWaterRolls,
      starterStripLf,
      ridgeCapLf,
      dripEdgeLf,
      nailsLbs,
      ventLf,
    },
    costs: {
      shingles: Math.round(shinglesCost),
      underlayment: Math.round(underlaymentCost),
      iceWater: Math.round(iceWaterCost),
      accessories: Math.round(accessoriesCost),
      tearoff: Math.round(tearoffCost),
      labor: Math.round(laborCost),
      disposal: Math.round(disposalCost),
      totalMaterials: Math.round(totalMaterials),
      totalLabor: Math.round(totalLabor),
      grandTotal: Math.round(grandTotal),
    },
    costPerSquare: Math.round(grandTotal / squaresWithWaste),
  };
}

/**
 * Format a dollar amount.
 */
export function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-US');
}

/**
 * Get a human label for complexity.
 */
export const COMPLEXITY_LABELS: Record<RoofComplexity, string> = {
  simple: 'Simple (gable, few facets)',
  moderate: 'Moderate (hip, some valleys)',
  complex: 'Complex (many facets, valleys, dormers)',
  very_complex: 'Very Complex (multi-level, turrets, extensive detail)',
};

/**
 * Get a human label for shingle grade.
 */
export const SHINGLE_LABELS: Record<ShingleGrade, string> = {
  three_tab: '3-Tab Standard',
  architectural: 'Architectural',
  premium: 'Premium/Lifetime',
  designer: 'Designer/Luxury',
};

/**
 * Get a human label for underlayment type.
 */
export const UNDERLAYMENT_LABELS: Record<UnderlaymentType, string> = {
  felt_15: '15 lb Felt',
  felt_30: '30 lb Felt',
  synthetic: 'Synthetic',
};
