// ─── Commercial Property Types ──────────────────────────────────────

export type CommercialRoofType =
  | 'flat'
  | 'low-slope'
  | 'metal-standing-seam'
  | 'built-up'
  | 'modified-bitumen'
  | 'single-ply'
  | 'spray-foam';

export type DrainDirection = 'north' | 'south' | 'east' | 'west' | 'internal' | 'scupper';

export interface CommercialProperty {
  id: string;
  propertyId: string; // links to main Property
  buildingType: 'office' | 'retail' | 'warehouse' | 'industrial' | 'multi-family' | 'mixed-use' | 'other';
  totalRoofAreaSqFt: number;
  sections: CommercialRoofSection[];
  parapets: ParapetSegment[];
  drainageZones: DrainageZone[];
  hvacUnits: RooftopUnit[];
}

export interface CommercialRoofSection {
  id: string;
  name: string; // "Section A - Main Building", etc.
  roofType: CommercialRoofType;
  areaSqFt: number;
  slopePctPerFt: number; // slope in inches per foot (typically 1/4" per ft for flat)
  condition: 'good' | 'fair' | 'poor' | 'failed';
  yearInstalled?: number;
  membrane?: string;
  insulation?: string;
  vertices: { lat: number; lng: number }[];
}

export interface ParapetSegment {
  id: string;
  lengthFt: number;
  heightFt: number;
  copingType: 'metal' | 'stone' | 'concrete' | 'epdm' | 'none';
  copingWidthIn: number;
  condition: 'good' | 'fair' | 'poor';
}

export interface DrainageZone {
  id: string;
  sectionId: string;
  drainType: 'internal-drain' | 'scupper' | 'gutter' | 'crickets' | 'tapered-insulation';
  direction: DrainDirection;
  drainCount: number;
  adequacy: 'adequate' | 'marginal' | 'inadequate';
  pondingRisk: 'low' | 'medium' | 'high';
}

export interface RooftopUnit {
  id: string;
  type: 'hvac' | 'vent' | 'skylight' | 'exhaust-fan' | 'satellite' | 'solar-panel';
  widthFt: number;
  lengthFt: number;
  heightFt: number;
  lat: number;
  lng: number;
  flashingCondition: 'good' | 'fair' | 'poor';
}

export interface CommercialMaterialEstimate {
  roofType: CommercialRoofType;
  sectionId: string;
  membraneSqFt: number;
  insulationSqFt: number;
  insulationBoardCount: number;
  adhesiveGallons: number;
  flashingLf: number;
  copingLf: number;
  drainAssemblies: number;
  fastenerCount: number;
  laborHours: number;
  materialCost: number;
  laborCost: number;
  totalCost: number;
}

// ─── Analysis Result Types ──────────────────────────────────────────

export interface CommercialSectionSummary {
  sectionId: string;
  name: string;
  roofType: CommercialRoofType;
  areaSqFt: number;
  condition: 'good' | 'fair' | 'poor' | 'failed';
  slopeInPerFt: number;
  perimeterLf: number;
  ageYears: number | null;
}

export interface CommercialPropertySummary {
  totalAreaSqFt: number;
  sectionCount: number;
  sections: CommercialSectionSummary[];
  predominantRoofType: CommercialRoofType;
  overallCondition: 'good' | 'fair' | 'poor' | 'failed';
  totalPerimeterLf: number;
}

export interface DrainageAnalysisResult {
  sectionId: string;
  areaSqFt: number;
  existingDrainCount: number;
  recommendedDrainCount: number;
  adequacy: 'adequate' | 'marginal' | 'inadequate';
  pondingRisk: 'low' | 'medium' | 'high';
  recommendations: string[];
}

export interface DrainLayoutRecommendation {
  sectionId: string;
  recommendedDrainCount: number;
  drainType: 'internal-drain' | 'scupper' | 'gutter';
  spacingFt: number;
  notes: string[];
}

// ─── Constants ──────────────────────────────────────────────────────

export const COMMERCIAL_ROOF_TYPE_LABELS: Record<CommercialRoofType, string> = {
  'flat': 'Flat Roof',
  'low-slope': 'Low-Slope',
  'metal-standing-seam': 'Metal Standing Seam',
  'built-up': 'Built-Up (BUR)',
  'modified-bitumen': 'Modified Bitumen',
  'single-ply': 'Single-Ply (TPO/EPDM)',
  'spray-foam': 'Spray Polyurethane Foam',
};

export const BUILDING_TYPE_LABELS: Record<CommercialProperty['buildingType'], string> = {
  office: 'Office',
  retail: 'Retail',
  warehouse: 'Warehouse',
  industrial: 'Industrial',
  'multi-family': 'Multi-Family',
  'mixed-use': 'Mixed-Use',
  other: 'Other',
};

export const CONDITION_COLORS: Record<CommercialRoofSection['condition'], string> = {
  good: '#10b981',
  fair: '#f59e0b',
  poor: '#f97316',
  failed: '#ef4444',
};

export const COPING_TYPE_LABELS: Record<ParapetSegment['copingType'], string> = {
  metal: 'Metal',
  stone: 'Stone',
  concrete: 'Concrete',
  epdm: 'EPDM',
  none: 'None',
};

export const DRAIN_TYPE_LABELS: Record<DrainageZone['drainType'], string> = {
  'internal-drain': 'Internal Drain',
  scupper: 'Scupper',
  gutter: 'Gutter',
  crickets: 'Crickets',
  'tapered-insulation': 'Tapered Insulation',
};

export const PONDING_RISK_COLORS: Record<DrainageZone['pondingRisk'], string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
};
