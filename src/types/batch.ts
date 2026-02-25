// ─── Batch Property Processing Types ─────────────────────────────

export type BatchItemStatus = 'queued' | 'geocoding' | 'measuring' | 'complete' | 'error' | 'skipped';

export interface BatchAddress {
  raw: string;         // Original input text
  address: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
}

export interface BatchItem {
  id: string;
  index: number;
  input: BatchAddress;
  status: BatchItemStatus;
  progress: number;     // 0-100
  message: string;
  result?: BatchItemResult;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface BatchItemResult {
  propertyId: string;
  address: string;
  totalAreaSqFt: number;
  totalSquares: number;
  facetCount: number;
  predominantPitch: number;
  dataSource: string;
  confidence: string;
}

export type BatchJobStatus = 'idle' | 'parsing' | 'running' | 'paused' | 'complete' | 'cancelled';

export interface BatchJob {
  id: string;
  name: string;
  status: BatchJobStatus;
  items: BatchItem[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  concurrency: number;  // How many to process in parallel
}

export interface BatchStats {
  total: number;
  queued: number;
  processing: number;
  complete: number;
  errors: number;
  skipped: number;
  totalAreaSqFt: number;
  totalSquares: number;
  avgTimePerProperty: number; // ms
  estimatedTimeRemaining: number; // ms
}

export interface ParsedAddressLine {
  address: string;
  city: string;
  state: string;
  zip: string;
}

export const BATCH_STATUS_LABELS: Record<BatchItemStatus, string> = {
  queued: 'Queued',
  geocoding: 'Geocoding',
  measuring: 'Measuring',
  complete: 'Complete',
  error: 'Error',
  skipped: 'Skipped',
};

export const BATCH_STATUS_COLORS: Record<BatchItemStatus, string> = {
  queued: '#6b7280',
  geocoding: '#3b82f6',
  measuring: '#f59e0b',
  complete: '#10b981',
  error: '#ef4444',
  skipped: '#9ca3af',
};

export const BATCH_JOB_STATUS_LABELS: Record<BatchJobStatus, string> = {
  idle: 'Ready',
  parsing: 'Parsing Addresses',
  running: 'Processing',
  paused: 'Paused',
  complete: 'Complete',
  cancelled: 'Cancelled',
};
