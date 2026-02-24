/**
 * Client-side API service for property CRUD operations.
 * All methods use the server-side REST API and return typed responses.
 * Falls back gracefully when the server is unreachable.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getToken(): string | null {
  try {
    const stored = localStorage.getItem('skyhawk-storage');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed.state?.token || null;
  } catch {
    return null;
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(response.status, body.error || 'Request failed');
  }

  return response.json() as Promise<T>;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// ─── Property Types (API response shapes) ──────────────────────────

export interface ApiProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ApiMeasurementSummary {
  id: string;
  total_area_sqft: number;
  total_true_area_sqft: number;
  total_squares: number;
  predominant_pitch: number;
  suggested_waste_percent: number;
  structure_complexity: string;
  data_source: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiMeasurementFull {
  id: string;
  propertyId: string;
  createdAt: string;
  updatedAt: string;
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
  ridgeCount: number;
  hipCount: number;
  valleyCount: number;
  rakeCount: number;
  eaveCount: number;
  flashingCount: number;
  stepFlashingCount: number;
  structureComplexity: string;
  estimatedAtticSqFt: number;
  pitchBreakdown: unknown[];
  buildingHeightFt?: number;
  stories?: number;
  dataSource?: string;
  vertices: { id: string; lat: number; lng: number }[];
  edges: { id: string; startVertexId: string; endVertexId: string; type: string; lengthFt: number }[];
  facets: { id: string; name: string; pitch: number; areaSqFt: number; trueAreaSqFt: number; vertexIds: string[]; edgeIds: string[] }[];
}

// ─── Property API ──────────────────────────────────────────────────

export async function listProperties(): Promise<ApiProperty[]> {
  const result = await apiFetch<{ properties: ApiProperty[] }>('/api/properties');
  return result.properties;
}

export async function getProperty(id: string): Promise<ApiProperty & {
  measurements: ApiMeasurementSummary[];
  damageAnnotations: unknown[];
  claims: unknown[];
  snapshots: unknown[];
}> {
  return apiFetch(`/api/properties/${id}`);
}

export async function createProperty(data: {
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  lat: number;
  lng: number;
  notes?: string;
}): Promise<ApiProperty> {
  return apiFetch('/api/properties', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProperty(
  id: string,
  data: Partial<{
    address: string;
    city: string;
    state: string;
    zip: string;
    lat: number;
    lng: number;
    notes: string;
  }>,
): Promise<ApiProperty> {
  return apiFetch(`/api/properties/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteProperty(id: string): Promise<void> {
  await apiFetch(`/api/properties/${id}`, { method: 'DELETE' });
}

// ─── Measurement API ───────────────────────────────────────────────

export async function listMeasurements(
  propertyId: string,
): Promise<ApiMeasurementSummary[]> {
  const result = await apiFetch<{ measurements: ApiMeasurementSummary[] }>(
    `/api/properties/${propertyId}/measurements`,
  );
  return result.measurements;
}

export async function getMeasurement(
  propertyId: string,
  measurementId: string,
): Promise<ApiMeasurementFull> {
  return apiFetch(`/api/properties/${propertyId}/measurements/${measurementId}`);
}

export async function saveMeasurement(
  propertyId: string,
  data: {
    vertices: { id: string; lat: number; lng: number }[];
    edges: { id: string; startVertexId: string; endVertexId: string; type: string; lengthFt: number }[];
    facets: { id: string; name: string; pitch: number; areaSqFt: number; trueAreaSqFt: number; vertexIds: string[]; edgeIds: string[] }[];
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
    ridgeCount: number;
    hipCount: number;
    valleyCount: number;
    rakeCount: number;
    eaveCount: number;
    flashingCount: number;
    stepFlashingCount: number;
    structureComplexity: string;
    estimatedAtticSqFt: number;
    pitchBreakdown: unknown[];
    buildingHeightFt?: number;
    stories?: number;
    dataSource?: string;
  },
): Promise<{ id: string; createdAt: string }> {
  return apiFetch(`/api/properties/${propertyId}/measurements`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteMeasurement(
  propertyId: string,
  measurementId: string,
): Promise<void> {
  await apiFetch(`/api/properties/${propertyId}/measurements/${measurementId}`, {
    method: 'DELETE',
  });
}

// ─── Claims API ────────────────────────────────────────────────────

export async function createClaim(
  propertyId: string,
  data: {
    claimNumber?: string;
    insuredName?: string;
    dateOfLoss?: string;
    notes?: string;
  },
): Promise<unknown> {
  return apiFetch(`/api/properties/${propertyId}/claims`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateClaim(
  propertyId: string,
  claimId: string,
  data: Partial<{
    claimNumber: string;
    insuredName: string;
    dateOfLoss: string;
    status: string;
    notes: string;
  }>,
): Promise<unknown> {
  return apiFetch(`/api/properties/${propertyId}/claims/${claimId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteClaim(
  propertyId: string,
  claimId: string,
): Promise<void> {
  await apiFetch(`/api/properties/${propertyId}/claims/${claimId}`, {
    method: 'DELETE',
  });
}

// ─── Damage Annotations API ────────────────────────────────────────

export async function addDamageAnnotation(
  propertyId: string,
  data: {
    lat: number;
    lng: number;
    type: string;
    severity: string;
    note?: string;
  },
): Promise<unknown> {
  return apiFetch(`/api/properties/${propertyId}/damage-annotations`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function removeDamageAnnotation(
  propertyId: string,
  annotationId: string,
): Promise<void> {
  await apiFetch(`/api/properties/${propertyId}/damage-annotations/${annotationId}`, {
    method: 'DELETE',
  });
}

// ─── Server health check ──────────────────────────────────────────

export async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
