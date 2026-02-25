/**
 * API client for accessing shared reports.
 * No authentication required — shared reports are accessed via token.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface SharedReportShare {
  id: string;
  permissions: 'view' | 'comment' | 'edit';
  sharedByUsername: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface SharedReportProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SharedReportMeasurement {
  id: string;
  total_area_sqft: number;
  total_true_area_sqft: number;
  total_squares: number;
  predominant_pitch: number;
  suggested_waste_percent: number;
  structure_complexity: string;
  data_source: string;
  created_at: string;
  updated_at: string;
}

export interface SharedReportDamage {
  id: string;
  lat: number;
  lng: number;
  type: string;
  severity: string;
  note: string | null;
  created_at: string;
}

export interface SharedReportData {
  share: SharedReportShare;
  property: SharedReportProperty;
  measurements: SharedReportMeasurement[];
  damageAnnotations: SharedReportDamage[];
}

/**
 * Fetch a shared report by token. No auth required.
 */
export async function fetchSharedReport(token: string): Promise<SharedReportData> {
  const res = await fetch(`${API_BASE}/api/shared/${encodeURIComponent(token)}`);

  if (res.status === 404) {
    throw new SharedReportError(404, 'This shared report was not found or has been revoked.');
  }
  if (res.status === 410) {
    throw new SharedReportError(410, 'This share link has expired.');
  }
  if (!res.ok) {
    throw new SharedReportError(res.status, 'Failed to load shared report.');
  }

  return res.json();
}

export class SharedReportError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'SharedReportError';
    this.status = status;
  }
}
