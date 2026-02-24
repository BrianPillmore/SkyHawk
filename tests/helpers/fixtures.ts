/**
 * Shared test fixtures and factory functions.
 */
import type {
  RoofMeasurement,
  RoofVertex,
  RoofEdge,
  RoofFacet,
  Property,
  EdgeType,
  Claim,
  Adjuster,
  AdjusterSpecialty,
  RoofConditionAssessment,
} from '../../src/types';
import type { ReconstructedRoof, DetectedRoofEdges } from '../../src/types/solar';

let _id = 0;
function nextId(): string {
  return `test-id-${++_id}`;
}

/** Reset the auto-increment ID counter (call in beforeEach) */
export function resetFixtureIds(): void {
  _id = 0;
}

// ─── Vertex Factories ──────────────────────────────────────────────

export function createVertex(lat = 39.78, lng = -89.65, id?: string): RoofVertex {
  return { id: id ?? nextId(), lat, lng };
}

// ─── Edge Factories ────────────────────────────────────────────────

export function createEdge(
  startVertexId: string,
  endVertexId: string,
  type: EdgeType = 'eave',
  lengthFt = 25,
  id?: string,
): RoofEdge {
  return { id: id ?? nextId(), startVertexId, endVertexId, type, lengthFt };
}

// ─── Facet Factories ───────────────────────────────────────────────

export function createFacet(
  vertexIds: string[],
  opts?: Partial<Pick<RoofFacet, 'pitch' | 'areaSqFt' | 'trueAreaSqFt' | 'name' | 'edgeIds' | 'id'>>,
): RoofFacet {
  const pitch = opts?.pitch ?? 6;
  const areaSqFt = opts?.areaSqFt ?? 500;
  const pitchFactor = Math.sqrt(1 + (pitch / 12) ** 2);
  const trueAreaSqFt = opts?.trueAreaSqFt ?? areaSqFt * pitchFactor;
  return {
    id: opts?.id ?? nextId(),
    name: opts?.name ?? 'Facet 1',
    vertexIds,
    pitch,
    areaSqFt,
    trueAreaSqFt,
    edgeIds: opts?.edgeIds ?? [],
  };
}

// ─── Measurement Factory ───────────────────────────────────────────

export function createMeasurement(
  propertyId = 'prop-1',
  overrides?: Partial<RoofMeasurement>,
): RoofMeasurement {
  return {
    id: overrides?.id ?? nextId(),
    propertyId,
    createdAt: overrides?.createdAt ?? new Date().toISOString(),
    updatedAt: overrides?.updatedAt ?? new Date().toISOString(),
    vertices: overrides?.vertices ?? [],
    edges: overrides?.edges ?? [],
    facets: overrides?.facets ?? [],
    totalAreaSqFt: overrides?.totalAreaSqFt ?? 0,
    totalTrueAreaSqFt: overrides?.totalTrueAreaSqFt ?? 0,
    totalSquares: overrides?.totalSquares ?? 0,
    predominantPitch: overrides?.predominantPitch ?? 0,
    totalRidgeLf: overrides?.totalRidgeLf ?? 0,
    totalHipLf: overrides?.totalHipLf ?? 0,
    totalValleyLf: overrides?.totalValleyLf ?? 0,
    totalRakeLf: overrides?.totalRakeLf ?? 0,
    totalEaveLf: overrides?.totalEaveLf ?? 0,
    totalFlashingLf: overrides?.totalFlashingLf ?? 0,
    totalDripEdgeLf: overrides?.totalDripEdgeLf ?? 0,
    totalStepFlashingLf: overrides?.totalStepFlashingLf ?? 0,
    suggestedWastePercent: overrides?.suggestedWastePercent ?? 10,
    ridgeCount: overrides?.ridgeCount ?? 0,
    hipCount: overrides?.hipCount ?? 0,
    valleyCount: overrides?.valleyCount ?? 0,
    rakeCount: overrides?.rakeCount ?? 0,
    eaveCount: overrides?.eaveCount ?? 0,
    flashingCount: overrides?.flashingCount ?? 0,
    stepFlashingCount: overrides?.stepFlashingCount ?? 0,
    structureComplexity: overrides?.structureComplexity ?? 'Simple',
    estimatedAtticSqFt: overrides?.estimatedAtticSqFt ?? 0,
    pitchBreakdown: overrides?.pitchBreakdown ?? [],
    buildingHeightFt: overrides?.buildingHeightFt,
    stories: overrides?.stories,
    dataSource: overrides?.dataSource,
  };
}

// ─── Property Factory ──────────────────────────────────────────────

export function createProperty(overrides?: Partial<Property>): Property {
  return {
    id: overrides?.id ?? nextId(),
    address: overrides?.address ?? '123 Main St',
    city: overrides?.city ?? 'Springfield',
    state: overrides?.state ?? 'IL',
    zip: overrides?.zip ?? '62701',
    lat: overrides?.lat ?? 39.7817,
    lng: overrides?.lng ?? -89.6501,
    createdAt: overrides?.createdAt ?? new Date().toISOString(),
    updatedAt: overrides?.updatedAt ?? new Date().toISOString(),
    measurements: overrides?.measurements ?? [],
    damageAnnotations: overrides?.damageAnnotations ?? [],
    snapshots: overrides?.snapshots ?? [],
    claims: overrides?.claims ?? [],
    notes: overrides?.notes ?? '',
  };
}

// ─── Claim Factory ─────────────────────────────────────────────────

export function createClaim(overrides?: Partial<Claim>): Claim {
  return {
    id: overrides?.id ?? nextId(),
    propertyId: overrides?.propertyId ?? 'prop-1',
    claimNumber: overrides?.claimNumber ?? 'CLM-001',
    insuredName: overrides?.insuredName ?? 'John Doe',
    dateOfLoss: overrides?.dateOfLoss ?? '2025-01-15',
    status: overrides?.status ?? 'new',
    notes: overrides?.notes ?? '',
    createdAt: overrides?.createdAt ?? new Date().toISOString(),
    updatedAt: overrides?.updatedAt ?? new Date().toISOString(),
  };
}

// ─── Adjuster Factory ──────────────────────────────────────────────

export function createAdjuster(overrides?: Partial<Adjuster>): Adjuster {
  return {
    id: overrides?.id ?? nextId(),
    name: overrides?.name ?? 'Jane Smith',
    email: overrides?.email ?? 'jane@example.com',
    phone: overrides?.phone ?? '555-0100',
    specialty: overrides?.specialty ?? ('residential' as AdjusterSpecialty),
    status: overrides?.status ?? 'available',
    createdAt: overrides?.createdAt ?? new Date().toISOString(),
  };
}

// ─── ReconstructedRoof Factory ─────────────────────────────────────

export function createReconstructedRoof(overrides?: Partial<ReconstructedRoof>): ReconstructedRoof {
  // A simple gable roof by default
  return {
    vertices: overrides?.vertices ?? [
      { lat: 39.7820, lng: -89.6505 },
      { lat: 39.7820, lng: -89.6495 },
      { lat: 39.7815, lng: -89.6495 },
      { lat: 39.7815, lng: -89.6505 },
      { lat: 39.78175, lng: -89.6505 }, // ridge start
      { lat: 39.78175, lng: -89.6495 }, // ridge end
    ],
    edges: overrides?.edges ?? [
      { startIndex: 0, endIndex: 1, type: 'eave' },
      { startIndex: 1, endIndex: 2, type: 'rake' },
      { startIndex: 2, endIndex: 3, type: 'eave' },
      { startIndex: 3, endIndex: 0, type: 'rake' },
      { startIndex: 4, endIndex: 5, type: 'ridge' },
    ],
    facets: overrides?.facets ?? [
      { vertexIndices: [0, 1, 5, 4], pitch: 6, name: '#1 South' },
      { vertexIndices: [4, 5, 2, 3], pitch: 6, name: '#2 North' },
    ],
    roofType: overrides?.roofType ?? 'gable',
    confidence: overrides?.confidence ?? 'high',
  };
}

// ─── DetectedRoofEdges Factory ─────────────────────────────────────

export function createDetectedRoofEdges(overrides?: Partial<DetectedRoofEdges>): DetectedRoofEdges {
  return {
    vertices: overrides?.vertices ?? [
      { lat: 39.7820, lng: -89.6505 },
      { lat: 39.7820, lng: -89.6495 },
      { lat: 39.7815, lng: -89.6495 },
      { lat: 39.7815, lng: -89.6505 },
    ],
    edges: overrides?.edges ?? [
      { startIndex: 0, endIndex: 1, type: 'eave' },
      { startIndex: 1, endIndex: 2, type: 'rake' },
      { startIndex: 2, endIndex: 3, type: 'eave' },
      { startIndex: 3, endIndex: 0, type: 'rake' },
    ],
    roofType: overrides?.roofType ?? 'gable',
    estimatedPitchDegrees: overrides?.estimatedPitchDegrees ?? 22,
    confidence: overrides?.confidence ?? 0.8,
  };
}

// ─── RoofConditionAssessment Factory ───────────────────────────────

export function createRoofCondition(overrides?: Partial<RoofConditionAssessment>): RoofConditionAssessment {
  return {
    overallScore: overrides?.overallScore ?? 75,
    category: overrides?.category ?? 'good',
    estimatedAgeYears: overrides?.estimatedAgeYears ?? 10,
    estimatedRemainingLifeYears: overrides?.estimatedRemainingLifeYears ?? 15,
    materialType: overrides?.materialType ?? 'asphalt-shingle',
    materialConfidence: overrides?.materialConfidence ?? 0.85,
    findings: overrides?.findings ?? ['Minor granule loss', 'Color fading observed'],
    recommendations: overrides?.recommendations ?? ['Schedule inspection in 2 years'],
    damageDetected: overrides?.damageDetected ?? [],
    assessedAt: overrides?.assessedAt ?? new Date().toISOString(),
  };
}

// ─── Standard Geometry Constants ───────────────────────────────────

/** A rectangular outline ~55 ft x 36 ft (lat/lng for Springfield, IL) */
export const RECT_OUTLINE = [
  createVertex(39.7820, -89.6505, 'rect-nw'),
  createVertex(39.7820, -89.6495, 'rect-ne'),
  createVertex(39.7815, -89.6495, 'rect-se'),
  createVertex(39.7815, -89.6505, 'rect-sw'),
];

export const STANDARD_BOUNDS = {
  north: 39.7825,
  south: 39.7810,
  east: -89.6490,
  west: -89.6510,
};

// ─── Hip Roof Preset ──────────────────────────────────────────────

export function createHipRoofReconstructed(): ReconstructedRoof {
  return {
    vertices: [
      { lat: 39.7820, lng: -89.6505 },
      { lat: 39.7820, lng: -89.6495 },
      { lat: 39.7815, lng: -89.6495 },
      { lat: 39.7815, lng: -89.6505 },
      { lat: 39.78185, lng: -89.6503 }, // ridge start
      { lat: 39.78185, lng: -89.6497 }, // ridge end
    ],
    edges: [
      { startIndex: 0, endIndex: 1, type: 'eave' },
      { startIndex: 1, endIndex: 2, type: 'eave' },
      { startIndex: 2, endIndex: 3, type: 'eave' },
      { startIndex: 3, endIndex: 0, type: 'eave' },
      { startIndex: 4, endIndex: 5, type: 'ridge' },
      { startIndex: 0, endIndex: 4, type: 'hip' },
      { startIndex: 1, endIndex: 5, type: 'hip' },
      { startIndex: 2, endIndex: 5, type: 'hip' },
      { startIndex: 3, endIndex: 4, type: 'hip' },
    ],
    facets: [
      { vertexIndices: [0, 1, 5, 4], pitch: 6, name: '#1 South' },
      { vertexIndices: [1, 2, 5], pitch: 6, name: '#2 East' },
      { vertexIndices: [2, 3, 4, 5], pitch: 6, name: '#3 North' },
      { vertexIndices: [3, 0, 4], pitch: 6, name: '#4 West' },
    ],
    roofType: 'hip',
    confidence: 'high',
  };
}
