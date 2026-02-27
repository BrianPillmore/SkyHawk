import type { RoofVertex, RoofEdge } from '../types';

/**
 * Training Data Auto-Save Service
 *
 * Captures user edge drawings as ML training annotations whenever they finish
 * an editing session on a roof. Uses a debounced approach (5s after last edit)
 * so it doesn't fire on every individual vertex move or edge type change.
 */

// ── Types ──────────────────────────────────────────────────────────────────

interface ImageBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface TrainingAnnotation {
  imageBase64: string;
  vertices: { id: string; lat: number; lng: number }[];
  edges: { id: string; startVertexId: string; endVertexId: string; type: string; lengthFt: number }[];
  bounds: ImageBounds;
  address: string;
  capturedAt: string;
}

interface AutoSaveStore {
  token: string | null;
  activeMeasurement: {
    id: string;
    vertices: RoofVertex[];
    edges: RoofEdge[];
    updatedAt: string;
  } | null;
  activePropertyId: string | null;
  properties: {
    id: string;
    address: string;
    lat: number;
    lng: number;
  }[];
  mapCenter: { lat: number; lng: number };
  mapZoom: number;
}

// ── Core API call ──────────────────────────────────────────────────────────

/**
 * Save a user's edge drawing as ML training data.
 *
 * POSTs the satellite image + vertex/edge annotations to the backend so they
 * can be used to train/fine-tune the roof edge detection model.
 */
export async function saveDrawingAsTrainingData(
  imageBase64: string,
  vertices: RoofVertex[],
  edges: RoofEdge[],
  bounds: ImageBounds,
  address: string,
  token: string | null,
): Promise<{ saved: boolean; annotationId?: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const annotation: TrainingAnnotation = {
    imageBase64,
    vertices: vertices.map((v) => ({ id: v.id, lat: v.lat, lng: v.lng })),
    edges: edges.map((e) => ({
      id: e.id,
      startVertexId: e.startVertexId,
      endVertexId: e.endVertexId,
      type: e.type,
      lengthFt: e.lengthFt,
    })),
    bounds,
    address,
    capturedAt: new Date().toISOString(),
  };

  const response = await fetch('/api/ml/annotations/auto-save-drawing', {
    method: 'POST',
    headers,
    body: JSON.stringify(annotation),
  });

  if (!response.ok) {
    // Non-critical: log but don't throw so it never disrupts the user
    console.warn(
      `[TrainingData] auto-save failed: ${response.status} ${response.statusText}`,
    );
    return { saved: false };
  }

  const data = await response.json();
  return { saved: true, annotationId: data.annotationId };
}

// ── Satellite image capture (matches visionApi.ts pattern) ─────────────────

/**
 * Capture a satellite image for the current map view.
 * Returns base64 + computed bounds matching the capturePropertyImage() helper
 * in visionApi.ts, but simplified for internal use.
 */
async function captureMapImage(
  lat: number,
  lng: number,
  zoom: number,
  size: number = 640,
): Promise<{ base64: string; bounds: ImageBounds }> {
  // Use the Google Maps Static API key from env if available
  const apiKey =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY) || '';

  if (!apiKey) {
    throw new Error('[TrainingData] No Google Maps API key available for satellite capture');
  }

  const url =
    `https://maps.googleapis.com/maps/api/staticmap?` +
    new URLSearchParams({
      center: `${lat},${lng}`,
      zoom: zoom.toString(),
      size: `${size}x${size}`,
      maptype: 'satellite',
      key: apiKey,
    });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`[TrainingData] Satellite image fetch failed: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''),
  );

  // Compute approximate image bounds (same formula as visionApi.ts)
  const metersPerPixel =
    (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  const halfSizeMeters = (size / 2) * metersPerPixel;
  const degPerMeter = 1 / 111320;

  const bounds: ImageBounds = {
    north: lat + halfSizeMeters * degPerMeter,
    south: lat - halfSizeMeters * degPerMeter,
    east: lng + (halfSizeMeters * degPerMeter) / Math.cos((lat * Math.PI) / 180),
    west: lng - (halfSizeMeters * degPerMeter) / Math.cos((lat * Math.PI) / 180),
  };

  return { base64, bounds };
}

// ── Debounced auto-save ────────────────────────────────────────────────────

/** Minimum number of edges before we consider the drawing worth saving. */
const MIN_EDGES_FOR_SAVE = 3;

/** Debounce delay in ms — wait for 5 seconds of inactivity after the last edit. */
const DEBOUNCE_MS = 5_000;

/** Track the last measurement snapshot we saved to avoid duplicate submissions. */
let _lastSavedUpdatedAt: string | null = null;

/** Handle for the pending debounce timer. */
let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Check whether the current store state has a meaningful drawing and, if so,
 * capture the satellite image and save the annotation. This function is
 * debounced: it resets a 5-second timer on every call, so it only fires once
 * the user stops editing for 5 seconds.
 *
 * Call this from store subscribers or after any edge-mutating action
 * (addEdge, updateEdgeType, moveVertex, deleteEdge, finishOutline, etc.).
 *
 * @param store  A snapshot of the relevant store fields (or the full store).
 */
export function autoSaveIfReady(store: AutoSaveStore): void {
  // Clear any pending timer — the user is still editing
  if (_debounceTimer !== null) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }

  // Quick bail-outs before scheduling the timer
  const { activeMeasurement, activePropertyId, properties, token } = store;
  if (!activeMeasurement || !activePropertyId) return;
  if (activeMeasurement.edges.length < MIN_EDGES_FOR_SAVE) return;
  if (activeMeasurement.updatedAt === _lastSavedUpdatedAt) return;

  // Find the property for its address + coordinates
  const property = properties.find((p) => p.id === activePropertyId);
  if (!property) return;

  // Snapshot the values we need — the store may change before the timer fires
  const snapshotMeasurement = {
    vertices: [...activeMeasurement.vertices],
    edges: [...activeMeasurement.edges],
    updatedAt: activeMeasurement.updatedAt,
  };
  const snapshotAddress = property.address;
  const snapshotLat = store.mapCenter.lat;
  const snapshotLng = store.mapCenter.lng;
  const snapshotZoom = store.mapZoom;
  const snapshotToken = token;

  // Schedule the save after debounce delay
  _debounceTimer = setTimeout(async () => {
    _debounceTimer = null;

    try {
      const { base64, bounds } = await captureMapImage(
        snapshotLat,
        snapshotLng,
        snapshotZoom,
      );

      const result = await saveDrawingAsTrainingData(
        base64,
        snapshotMeasurement.vertices,
        snapshotMeasurement.edges,
        bounds,
        snapshotAddress,
        snapshotToken,
      );

      if (result.saved) {
        _lastSavedUpdatedAt = snapshotMeasurement.updatedAt;
        console.info(
          `[TrainingData] Auto-saved drawing (${snapshotMeasurement.edges.length} edges) ` +
            `as annotation ${result.annotationId}`,
        );
      }
    } catch (err) {
      // Non-critical — never disrupt the user
      console.warn('[TrainingData] auto-save error:', err);
    }
  }, DEBOUNCE_MS);
}

/**
 * Cancel any pending auto-save. Useful when the user navigates away from
 * the measurement or clears the canvas.
 */
export function cancelPendingAutoSave(): void {
  if (_debounceTimer !== null) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }
}

/**
 * Reset the "last saved" tracker. Useful in tests or when switching properties.
 */
export function resetAutoSaveState(): void {
  cancelPendingAutoSave();
  _lastSavedUpdatedAt = null;
}
