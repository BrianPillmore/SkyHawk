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
  | 'pan';

export type MapType = 'satellite' | 'hybrid' | 'roadmap';

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
