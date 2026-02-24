/**
 * Oblique satellite imagery service for PDF reports.
 * Captures 4-direction satellite views (N/S/E/W) using Google Maps Static API
 * to match EagleView's multi-angle oblique view pages.
 */

/** Result of capturing oblique views for a property */
export interface ObliqueViews {
  north?: string;  // base64 data URL
  south?: string;
  east?: string;
  west?: string;
}

/** Direction configuration for satellite captures */
interface DirectionConfig {
  key: keyof ObliqueViews;
  heading: number;   // Map heading in degrees (0=N, 90=E, 180=S, 270=W)
  latOffset: number;  // Offset from center to shift view perspective
  lngOffset: number;
}

const DIRECTIONS: DirectionConfig[] = [
  { key: 'north', heading: 0,   latOffset: 0.0003,  lngOffset: 0 },
  { key: 'east',  heading: 90,  latOffset: 0,        lngOffset: 0.0004 },
  { key: 'south', heading: 180, latOffset: -0.0003,  lngOffset: 0 },
  { key: 'west',  heading: 270, latOffset: 0,        lngOffset: -0.0004 },
];

/**
 * Build Google Maps Static API URL for a given direction.
 * Uses satellite maptype at zoom 20 with a slight offset to simulate
 * looking at the property from that cardinal direction.
 */
export function buildStaticMapUrl(
  lat: number,
  lng: number,
  apiKey: string,
  direction: DirectionConfig,
  size: string = '640x480'
): string {
  const centerLat = lat + direction.latOffset;
  const centerLng = lng + direction.lngOffset;

  return `https://maps.googleapis.com/maps/api/staticmap?` +
    `center=${centerLat},${centerLng}` +
    `&zoom=20` +
    `&size=${size}` +
    `&maptype=satellite` +
    `&heading=${direction.heading}` +
    `&key=${apiKey}`;
}

/**
 * Fetch a single satellite image as a base64 data URL.
 * Returns undefined if the fetch fails.
 */
async function fetchImageAsBase64(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;

    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

/**
 * Capture oblique satellite views from 4 cardinal directions.
 * Uses Google Maps Static API to get satellite imagery with slight
 * offset from the property center for each direction.
 *
 * @param lat - Property latitude
 * @param lng - Property longitude
 * @param apiKey - Google Maps API key
 * @returns ObliqueViews with base64 data URLs for each direction
 */
export async function captureObliqueViews(
  lat: number,
  lng: number,
  apiKey: string
): Promise<ObliqueViews> {
  const results: ObliqueViews = {};

  // Fetch all 4 directions in parallel
  const promises = DIRECTIONS.map(async (dir) => {
    const url = buildStaticMapUrl(lat, lng, apiKey, dir);
    const image = await fetchImageAsBase64(url);
    return { key: dir.key, image };
  });

  const settled = await Promise.allSettled(promises);

  for (const result of settled) {
    if (result.status === 'fulfilled' && result.value.image) {
      results[result.value.key] = result.value.image;
    }
  }

  return results;
}

/**
 * Get the directions configuration (useful for testing).
 */
export function getDirections(): DirectionConfig[] {
  return [...DIRECTIONS];
}
