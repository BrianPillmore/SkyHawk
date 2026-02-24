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

// --- Individual Solar Panel Placement ---

export interface SolarPanel {
  center: SolarLatLng;
  orientation: 'LANDSCAPE' | 'PORTRAIT';
  yearlyEnergyDcKwh: number;
  segmentIndex: number;
}

// --- Panel Configuration (system sizing) ---

export interface SolarPanelConfigSegmentSummary {
  pitchDegrees: number;
  azimuthDegrees: number;
  panelsCount: number;
  yearlyEnergyDcKwh: number;
  segmentIndex: number;
}

export interface SolarPanelConfig {
  panelsCount: number;
  yearlyEnergyDcKwh: number;
  roofSegmentSummaries: SolarPanelConfigSegmentSummary[];
}

// --- Financial Analysis Types ---

export interface SolarMoney {
  currencyCode: string;
  units: string;
  nanos?: number;
}

export interface SolarSavingsOverTime {
  savingsYear1: SolarMoney;
  savingsYear20: SolarMoney;
  presentValueOfSavingsYear20: SolarMoney;
  savingsLifetime: SolarMoney;
  presentValueOfSavingsLifetime: SolarMoney;
}

export interface SolarCashPurchaseSavings {
  outOfPocketCost: SolarMoney;
  upfrontCost: SolarMoney;
  rebateValue: SolarMoney;
  paybackYears: number;
  savings: SolarSavingsOverTime;
}

export interface SolarFinancedPurchaseSavings {
  annualLoanPayment: SolarMoney;
  rebateValue: SolarMoney;
  loanInterestRate: number;
  savings: SolarSavingsOverTime;
}

export interface SolarLeasingSavings {
  leasesAllowed: boolean;
  leasesSupported: boolean;
  annualLeasingCost: SolarMoney;
  savings: SolarSavingsOverTime;
}

export interface SolarFinancialDetails {
  initialAcKwhPerYear: number;
  remainingLifetimeUtilityBill: SolarMoney;
  federalIncentive: SolarMoney;
  stateIncentive: SolarMoney;
  utilityIncentive: SolarMoney;
  lifetimeSrecTotal: SolarMoney;
  costOfElectricityWithoutSolar: SolarMoney;
  netMeteringAllowed: boolean;
  solarPercentage: number;
  percentageExportedToGrid: number;
}

export interface SolarFinancialAnalysis {
  monthlyBill: SolarMoney;
  defaultBill: boolean;
  averageKwhPerMonth: number;
  panelConfigIndex: number;
  financialDetails: SolarFinancialDetails;
  leasingSavings?: SolarLeasingSavings;
  cashPurchaseSavings?: SolarCashPurchaseSavings;
  financedPurchaseSavings?: SolarFinancedPurchaseSavings;
}

// --- Building Insights (Extended with full Solar API response) ---

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
    panelCapacityWatts?: number;
    panelHeightMeters?: number;
    panelWidthMeters?: number;
    panelLifetimeYears?: number;
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
    solarPanels?: SolarPanel[];
    solarPanelConfigs?: SolarPanelConfig[];
    financialAnalyses?: SolarFinancialAnalysis[];
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

export interface ParsedDSM {
  /** Float32 elevation data in meters (row-major) */
  data: Float32Array;
  width: number;
  height: number;
  affine: GeoTiffAffine;
}

export interface DsmFacetAnalysis {
  pitchDegrees: number;
  azimuthDegrees: number;
  trueAreaSqFt3D: number;
  avgElevationMeters: number;
  sampleCount: number;
}

export interface BuildingHeightAnalysis {
  heightFt: number;
  stories: number;
  hasParapet: boolean;
  parapetHeightFt: number;
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
    trueArea3DSqFt?: number;
  }[];
  roofType: RoofType;
  confidence: 'high' | 'medium' | 'low';
  dataSource?: 'lidar-mask' | 'ai-vision' | 'hybrid';
  buildingHeight?: BuildingHeightAnalysis;
  facetDsmAnalysis?: DsmFacetAnalysis[];
  imageryQuality?: 'HIGH' | 'MEDIUM' | 'LOW';
  solarApiAreaSqFt?: number;
}

export interface DetectedRoofEdge {
  startIndex: number;
  endIndex: number;
  type: 'ridge' | 'hip' | 'valley' | 'rake' | 'eave' | 'flashing' | 'step-flashing';
}

export interface DetectedRoofEdges {
  vertices: LatLng[];
  edges: DetectedRoofEdge[];
  roofType: RoofType;
  estimatedPitchDegrees: number;
  confidence: number;
}

// --- Flux / Shade Analysis Types ---

export interface FluxPixelData {
  lat: number;
  lng: number;
  annualFluxKwhPerKwPerYear: number;
  monthlyFlux: number[]; // 12 values
}

export interface ParsedFluxMap {
  /** Float32 annual flux data in kWh/kW/year (row-major) */
  data: Float32Array;
  width: number;
  height: number;
  affine: GeoTiffAffine;
  noDataValue: number;
}

export interface ParsedMonthlyFlux {
  /** 12 Float32Arrays, one per month (row-major) */
  bands: Float32Array[];
  width: number;
  height: number;
  affine: GeoTiffAffine;
  noDataValue: number;
}

export interface FacetFluxAnalysis {
  facetIndex: number;
  meanAnnualFlux: number;
  minAnnualFlux: number;
  maxAnnualFlux: number;
  fluxUniformity: number; // 0-1, higher = more uniform
  monthlyMeanFlux: number[]; // 12 values
  shadedPixelPercent: number; // % pixels below shade threshold
  bestMonth: number; // 0-11
  worstMonth: number; // 0-11
  seasonalVariation: number; // ratio of best/worst month
}

export interface FluxMapAnalysis {
  totalRoofPixels: number;
  meanRoofFlux: number;
  facetAnalyses: FacetFluxAnalysis[];
  shadeThresholdKwh: number;
  overallShadingPercent: number;
}

export interface ShadeAnalysisResult {
  hourlyShading: Map<number, number>; // hour -> % shaded
  seasonalShading: { summer: number; winter: number; spring: number; fall: number };
  annualShadingPercent: number;
}

// --- Pitch Verification Types ---

export interface PitchVerificationResult {
  facetIndex: number;
  solarApiPitch: number; // x/12 format
  dsmPitch: number; // x/12 format
  pitchDifference: number; // absolute difference
  confidence: 'high' | 'medium' | 'low';
  sampleCount: number;
  rSquared: number; // plane fit quality
  recommendation: 'accept-solar' | 'accept-dsm' | 'manual-review';
}

export interface BuildingHeightResult {
  heightFt: number;
  ridgeHeightFt: number;
  estimatedStories: number;
  groundElevationFt: number;
  roofElevationFt: number;
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
