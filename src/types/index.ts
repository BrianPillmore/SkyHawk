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
  totalDripEdgeLf: number;
  suggestedWastePercent: number;
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
  notes: string;
}

export interface WasteCalculation {
  wastePercent: number;
  totalSquaresWithWaste: number;
  totalAreaWithWaste: number;
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
