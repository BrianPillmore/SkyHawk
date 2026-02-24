export interface LatLng {
  lat: number;
  lng: number;
}

export interface RoofVertex extends LatLng {
  id: string;
}

export interface RoofEdge {
  id: string;
  startVertexId: string;
  endVertexId: string;
  type: EdgeType;
  lengthFt: number;
}

export type EdgeType = 'ridge' | 'hip' | 'valley' | 'rake' | 'eave' | 'flashing' | 'step-flashing';

export interface RoofFacet {
  id: string;
  name: string;
  vertexIds: string[];
  pitch: number; // in x/12 format
  areaSqFt: number; // flat area
  trueAreaSqFt: number; // area adjusted for pitch
  edgeIds: string[];
}

export interface RoofMeasurement {
  id: string;
  propertyId: string;
  createdAt: string;
  updatedAt: string;
  vertices: RoofVertex[];
  edges: RoofEdge[];
  facets: RoofFacet[];
  totalAreaSqFt: number;
  totalTrueAreaSqFt: number;
  totalSquares: number;
  predominantPitch: number;
  totalRidgeLf: number;
  totalHipLf: number;
  totalValleyLf: number;
  totalRakeLf: number;
  totalEaveLf: number;
  totalFlashingLf: number;
  totalStepFlashingLf: number;
  totalDripEdgeLf: number;
  suggestedWastePercent: number;
  // Edge counts (EagleView parity)
  ridgeCount: number;
  hipCount: number;
  valleyCount: number;
  rakeCount: number;
  eaveCount: number;
  flashingCount: number;
  stepFlashingCount: number;
  // Structure classification
  structureComplexity: 'Simple' | 'Normal' | 'Complex';
  estimatedAtticSqFt: number;
  // Pitch breakdown table
  pitchBreakdown: PitchBreakdownEntry[];
  // LIDAR / DSM data
  buildingHeightFt?: number;
  stories?: number;
  dataSource?: 'lidar-mask' | 'ai-vision' | 'hybrid';
  // Imagery quality and cross-validation
  imageryQuality?: 'HIGH' | 'MEDIUM' | 'LOW';
  solarApiAreaSqFt?: number;
}

export interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  createdAt: string;
  updatedAt: string;
  measurements: RoofMeasurement[];
  damageAnnotations: DamageAnnotation[];
  snapshots: ImageSnapshot[];
  claims: Claim[];
  notes: string;
}

export interface WasteCalculation {
  wastePercent: number;
  totalSquaresWithWaste: number;
  totalAreaWithWaste: number;
}

export interface PitchBreakdownEntry {
  pitch: number; // in x/12 format
  areaSqFt: number;
  percentOfRoof: number;
}

export type DrawingMode =
  | 'select'
  | 'outline'
  | 'ridge'
  | 'hip'
  | 'valley'
  | 'rake'
  | 'eave'
  | 'flashing'
  | 'facet'
  | 'damage'
  | 'pan';

export type MapType = 'satellite' | 'hybrid' | 'roadmap';

// ─── Damage Assessment Types ───────────────────────────────────────

export type DamageType = 'hail' | 'wind' | 'missing-shingle' | 'crack' | 'ponding' | 'debris' | 'other';

export type DamageSeverity = 'minor' | 'moderate' | 'severe';

export interface DamageAnnotation {
  id: string;
  lat: number;
  lng: number;
  type: DamageType;
  severity: DamageSeverity;
  note: string;
  createdAt: string;
}

export const DAMAGE_TYPE_LABELS: Record<DamageType, string> = {
  hail: 'Hail Impact',
  wind: 'Wind Damage',
  'missing-shingle': 'Missing Shingle',
  crack: 'Crack/Split',
  ponding: 'Ponding/Water',
  debris: 'Debris Impact',
  other: 'Other Damage',
};

export const DAMAGE_SEVERITY_COLORS: Record<DamageSeverity, string> = {
  minor: '#f59e0b',
  moderate: '#f97316',
  severe: '#ef4444',
};

// ─── Before/After Comparison Types ────────────────────────────────

export interface ImageSnapshot {
  id: string;
  label: string;
  dataUrl: string;
  capturedAt: string;
  lat: number;
  lng: number;
  zoom: number;
}

// ─── Claims Workflow Types ──────────────────────────────────────

export type ClaimStatus = 'new' | 'inspected' | 'estimated' | 'submitted' | 'approved' | 'denied' | 'closed';

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  new: 'New',
  inspected: 'Inspected',
  estimated: 'Estimated',
  submitted: 'Submitted',
  approved: 'Approved',
  denied: 'Denied',
  closed: 'Closed',
};

export const CLAIM_STATUS_COLORS: Record<ClaimStatus, string> = {
  new: '#6b7280',
  inspected: '#3b82f6',
  estimated: '#8b5cf6',
  submitted: '#f59e0b',
  approved: '#10b981',
  denied: '#ef4444',
  closed: '#6b7280',
};

export interface Claim {
  id: string;
  propertyId: string;
  claimNumber: string;
  insuredName: string;
  dateOfLoss: string;
  status: ClaimStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Adjuster Assignment & Scheduling Types ──────────────────────

export interface Adjuster {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialty: AdjusterSpecialty;
  status: AdjusterStatus;
  createdAt: string;
}

export type AdjusterSpecialty = 'residential' | 'commercial' | 'catastrophe' | 'general';
export type AdjusterStatus = 'available' | 'assigned' | 'on-site' | 'unavailable';

export const ADJUSTER_SPECIALTY_LABELS: Record<AdjusterSpecialty, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  catastrophe: 'Catastrophe',
  general: 'General',
};

export const ADJUSTER_STATUS_COLORS: Record<AdjusterStatus, string> = {
  available: '#10b981',
  assigned: '#3b82f6',
  'on-site': '#f59e0b',
  unavailable: '#6b7280',
};

export interface Inspection {
  id: string;
  claimId: string;
  adjusterId: string;
  scheduledDate: string;
  scheduledTime: string;
  status: InspectionStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type InspectionStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled';

export const INSPECTION_STATUS_LABELS: Record<InspectionStatus, string> = {
  scheduled: 'Scheduled',
  'in-progress': 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const INSPECTION_STATUS_COLORS: Record<InspectionStatus, string> = {
  scheduled: '#3b82f6',
  'in-progress': '#f59e0b',
  completed: '#10b981',
  cancelled: '#6b7280',
};

export interface ReportConfig {
  includeOverview: boolean;
  includePitchDiagram: boolean;
  includeWasteTable: boolean;
  includeMaterialEstimate: boolean;
  includeLineDetails: boolean;
  companyName: string;
  companyLogo?: string;
  notes: string;
}

// ─── AI Analysis Types ─────────────────────────────────────────────

export type RoofMaterialType = 'asphalt-shingle' | 'metal' | 'tile' | 'slate' | 'wood-shake' | 'tpo' | 'epdm' | 'built-up' | 'concrete' | 'unknown';

export const ROOF_MATERIAL_LABELS: Record<RoofMaterialType, string> = {
  'asphalt-shingle': 'Asphalt Shingle',
  'metal': 'Standing Seam Metal',
  'tile': 'Clay/Concrete Tile',
  'slate': 'Natural Slate',
  'wood-shake': 'Wood Shake/Shingle',
  'tpo': 'TPO Membrane',
  'epdm': 'EPDM Rubber',
  'built-up': 'Built-Up (BUR)',
  'concrete': 'Concrete',
  'unknown': 'Unknown',
};

export interface RoofConditionAssessment {
  overallScore: number;         // 1-100
  category: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  estimatedAgeYears: number;
  estimatedRemainingLifeYears: number;
  materialType: RoofMaterialType;
  materialConfidence: number;   // 0-1
  findings: string[];
  recommendations: string[];
  damageDetected: {
    type: DamageType;
    severity: DamageSeverity;
    description: string;
    confidence: number;
  }[];
  assessedAt: string;
}
