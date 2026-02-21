import type { LatLng } from './index';

// --- Google Solar API Response Types ---

export interface SolarLatLng {
  latitude: number;
  longitude: number;
}

export interface SolarBoundingBox {
  sw: SolarLatLng;
  ne: SolarLatLng;
}

export interface SolarRoofSegment {
  pitchDegrees: number;
  azimuthDegrees: number;
  stats: {
    areaMeters2: number;
    sunshineQuantiles: number[];
    groundAreaMeters2: number;
  };
  center: SolarLatLng;
  boundingBox: SolarBoundingBox;
  planeHeightAtCenterMeters: number;
}

export interface SolarBuildingInsights {
  name: string;
  center: SolarLatLng;
  boundingBox: SolarBoundingBox;
  imageryDate: { year: number; month: number; day: number };
  imageryProcessedDate: { year: number; month: number; day: number };
  postalCode: string;
  administrativeArea: string;
  statisticalArea: string;
  regionCode: string;
  solarPotential: {
    maxArrayPanelsCount: number;
    maxArrayAreaMeters2: number;
    maxSunshineHoursPerYear: number;
    carbonOffsetFactorKgPerMwh: number;
    wholeRoofStats: {
      areaMeters2: number;
      sunshineQuantiles: number[];
      groundAreaMeters2: number;
    };
    roofSegmentStats: SolarRoofSegment[];
    buildingStats: {
      areaMeters2: number;
      sunshineQuantiles: number[];
      groundAreaMeters2: number;
    };
  };
  imageryQuality: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface SolarDataLayerUrls {
  maskUrl: string;
  dsmUrl: string;
  rgbUrl: string;
  annualFluxUrl: string;
  monthlyFluxUrl: string;
  hourlyShadeUrls: string[];
  imageryDate: { year: number; month: number; day: number };
  imageryProcessedDate: { year: number; month: number; day: number };
  imageryQuality: 'HIGH' | 'MEDIUM' | 'LOW';
}

// --- Internal Processing Types ---

export interface GeoTiffAffine {
  originX: number;
  originY: number;
  pixelWidth: number;
  pixelHeight: number;
}

export interface ParsedMask {
  data: Uint8Array;
  width: number;
  height: number;
  affine: GeoTiffAffine;
}

export type RoofType = 'flat' | 'shed' | 'gable' | 'hip' | 'cross-gable' | 'complex';

export interface ReconstructedRoof {
  vertices: LatLng[];
  edges: {
    startIndex: number;
    endIndex: number;
    type: 'ridge' | 'hip' | 'valley' | 'rake' | 'eave' | 'flashing';
  }[];
  facets: {
    vertexIndices: number[];
    pitch: number;
    name: string;
  }[];
  roofType: RoofType;
  confidence: 'high' | 'medium' | 'low';
}

export type AutoMeasureStatus =
  | 'idle'
  | 'detecting'
  | 'downloading'
  | 'processing'
  | 'reconstructing'
  | 'complete'
  | 'error'
  | 'ai-fallback';

export interface AutoMeasureProgress {
  status: AutoMeasureStatus;
  percent: number;
  message: string;
}
