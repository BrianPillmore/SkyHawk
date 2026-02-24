import type {
  CommercialRoofType,
  CommercialRoofSection,
  CommercialMaterialEstimate,
  ParapetSegment,
} from '../types/commercial';
import { calculatePerimeter } from './commercialRoof';

// ─── Material Cost Constants (per-unit, installed) ──────────────────

/** Membrane cost per sqft by roof type */
const MEMBRANE_COST_PER_SQFT: Record<string, number> = {
  'single-ply': 3.5,       // TPO membrane
  'flat': 3.5,             // Default to TPO for flat
  'low-slope': 3.5,        // Default to TPO for low-slope
  'modified-bitumen': 5.5,
  'built-up': 6.0,
  'spray-foam': 4.5,
  'metal-standing-seam': 8.0,
};

/** EPDM membrane cost per sqft (alternative single-ply) */
export const EPDM_COST_PER_SQFT = 4.0;

/** Metal coping cost per linear foot installed */
export const METAL_COPING_COST_PER_LF = 15.0;

/** Polyiso insulation (2") cost per sqft */
export const INSULATION_COST_PER_SQFT = 1.2;

/** Standard polyiso insulation board dimensions (4ft x 8ft = 32 sqft) */
const INSULATION_BOARD_SQFT = 32;

/** Adhesive coverage: ~1 gallon per 100 sqft */
const ADHESIVE_SQFT_PER_GALLON = 100;

/** Fastener density: ~1 per sqft for mechanically attached systems */
const FASTENERS_PER_SQFT = 1;

/** Membrane overlap waste factor (10%) */
const MEMBRANE_WASTE_FACTOR = 1.10;

/** Labor rate per sqft by system type */
const LABOR_COST_PER_SQFT: Record<string, number> = {
  'single-ply': 1.5,
  'flat': 1.5,
  'low-slope': 1.5,
  'modified-bitumen': 2.0,
  'built-up': 2.5,
  'spray-foam': 2.0,
  'metal-standing-seam': 3.5,
};

/** Labor hours per 100 sqft by system type */
const LABOR_HOURS_PER_100SQFT: Record<string, number> = {
  'single-ply': 1.5,
  'flat': 1.5,
  'low-slope': 1.5,
  'modified-bitumen': 2.0,
  'built-up': 2.5,
  'spray-foam': 1.0,
  'metal-standing-seam': 3.0,
};

/**
 * Get membrane cost per sqft for a given roof type.
 */
export function getMembraneCostPerSqFt(roofType: CommercialRoofType): number {
  return MEMBRANE_COST_PER_SQFT[roofType] ?? 3.5;
}

/**
 * Get labor cost per sqft for a given roof type.
 */
export function getLaborCostPerSqFt(roofType: CommercialRoofType): number {
  return LABOR_COST_PER_SQFT[roofType] ?? 1.5;
}

/**
 * Get labor hours per 100 sqft for a given roof type.
 */
export function getLaborHoursPer100SqFt(roofType: CommercialRoofType): number {
  return LABOR_HOURS_PER_100SQFT[roofType] ?? 1.5;
}

/**
 * Estimate commercial roofing materials for a section with its parapets.
 *
 * Calculations:
 *   - Membrane: area + 10% overlap waste
 *   - Insulation: area in 4x8 boards
 *   - Adhesive: ~1 gallon per 100 sqft
 *   - Fasteners: ~1 per sqft (mechanically attached)
 *   - Flashing: perimeter + penetration perimeters
 *   - Coping: total parapet length with coping
 *   - Drain assemblies: 1 per 10,000 sqft
 */
export function estimateCommercialMaterials(
  section: CommercialRoofSection,
  parapets: ParapetSegment[]
): CommercialMaterialEstimate {
  const area = section.areaSqFt;

  // Membrane with 10% waste for overlaps
  const membraneSqFt = Math.ceil(area * MEMBRANE_WASTE_FACTOR);

  // Insulation: covers the full area, in 4x8 boards
  const insulationSqFt = area;
  const insulationBoardCount = Math.ceil(area / INSULATION_BOARD_SQFT);

  // Adhesive: 1 gallon per 100 sqft
  const adhesiveGallons = Math.ceil(area / ADHESIVE_SQFT_PER_GALLON);

  // Fasteners: 1 per sqft for mechanically attached
  const fastenerCount = Math.ceil(area * FASTENERS_PER_SQFT);

  // Flashing: perimeter of the section
  const perimeterLf = calculatePerimeter(section.vertices);
  const flashingLf = Math.ceil(perimeterLf);

  // Coping: total parapet length with coping installed
  let copingLf = 0;
  for (const seg of parapets) {
    if (seg.copingType !== 'none') {
      copingLf += seg.lengthFt;
    }
  }
  copingLf = Math.ceil(copingLf);

  // Drain assemblies: 1 per 10,000 sqft, minimum 1
  const drainAssemblies = Math.max(1, Math.ceil(area / 10_000));

  // Labor hours
  const laborHoursRate = getLaborHoursPer100SqFt(section.roofType);
  const laborHours = Math.ceil((area / 100) * laborHoursRate);

  // Costs
  const membraneCostPerSqFt = getMembraneCostPerSqFt(section.roofType);
  const materialCost =
    membraneSqFt * membraneCostPerSqFt +
    insulationSqFt * INSULATION_COST_PER_SQFT +
    copingLf * METAL_COPING_COST_PER_LF;

  const laborCostPerSqFt = getLaborCostPerSqFt(section.roofType);
  const laborCost = area * laborCostPerSqFt;

  const totalCost = materialCost + laborCost;

  return {
    roofType: section.roofType,
    sectionId: section.id,
    membraneSqFt,
    insulationSqFt,
    insulationBoardCount,
    adhesiveGallons,
    flashingLf,
    copingLf,
    drainAssemblies,
    fastenerCount,
    laborHours,
    materialCost: Math.round(materialCost * 100) / 100,
    laborCost: Math.round(laborCost * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
  };
}

/**
 * Format a dollar amount for display.
 */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
