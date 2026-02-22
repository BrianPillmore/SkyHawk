import type {
  SolarBuildingInsights,
  SolarDataLayerUrls,
} from '../types/solar';

const SOLAR_API_BASE = 'https://solar.googleapis.com/v1';

export class SolarApiError extends Error {
  statusCode: number;
  details?: string;

  constructor(message: string, statusCode: number, details?: string) {
    super(message);
    this.name = 'SolarApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Fetch building insights from Google Solar API.
 * Returns roof segment data including pitch, azimuth, area, center, height.
 */
export async function fetchBuildingInsights(
  lat: number,
  lng: number,
  apiKey: string
): Promise<SolarBuildingInsights> {
  // Try HIGH quality first, then MEDIUM
  for (const quality of ['HIGH', 'MEDIUM'] as const) {
    const url = `${SOLAR_API_BASE}/buildingInsights:findClosest?` +
      new URLSearchParams({
        'location.latitude': lat.toString(),
        'location.longitude': lng.toString(),
        requiredQuality: quality,
        key: apiKey,
      });

    const response = await fetch(url);

    if (response.ok) {
      return response.json();
    }

    if (response.status === 404) {
      // No data at this quality, try next
      continue;
    }

    if (response.status === 403) {
      throw new SolarApiError(
        'Solar API not enabled. Please enable the Solar API in Google Cloud Console.',
        403
      );
    }

    const errorBody = await response.text();
    throw new SolarApiError(
      `Solar API error: ${response.statusText}`,
      response.status,
      errorBody
    );
  }

  throw new SolarApiError(
    'No Solar data available for this location.',
    404
  );
}

/**
 * Fetch data layer URLs from Google Solar API.
 * Returns URLs to GeoTIFF files for mask, DSM, RGB, flux.
 */
export async function fetchDataLayers(
  lat: number,
  lng: number,
  radiusMeters: number,
  apiKey: string
): Promise<SolarDataLayerUrls> {
  for (const quality of ['HIGH', 'MEDIUM'] as const) {
    const url = `${SOLAR_API_BASE}/dataLayers:get?` +
      new URLSearchParams({
        'location.latitude': lat.toString(),
        'location.longitude': lng.toString(),
        radiusMeters: radiusMeters.toString(),
        view: 'FULL_LAYERS',
        requiredQuality: quality,
        pixelSizeMeters: '0.1',
        key: apiKey,
      });

    const response = await fetch(url);

    if (response.ok) {
      return response.json();
    }

    if (response.status === 404) {
      continue;
    }

    if (response.status === 403) {
      throw new SolarApiError(
        'Solar API not enabled. Please enable the Solar API in Google Cloud Console.',
        403
      );
    }

    const errorBody = await response.text();
    throw new SolarApiError(
      `Solar API dataLayers error: ${response.statusText}`,
      response.status,
      errorBody
    );
  }

  throw new SolarApiError(
    'No Solar data layers available for this location.',
    404
  );
}

/**
 * Download a GeoTIFF file as ArrayBuffer.
 * The URL comes from the dataLayers response and needs the API key appended.
 */
export async function fetchGeoTiff(
  tiffUrl: string,
  apiKey: string
): Promise<ArrayBuffer> {
  const separator = tiffUrl.includes('?') ? '&' : '?';
  const url = `${tiffUrl}${separator}key=${apiKey}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new SolarApiError(
      `Failed to download GeoTIFF: ${response.statusText}`,
      response.status
    );
  }

  return response.arrayBuffer();
}
