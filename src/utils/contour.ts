import type { GeoTIFFImage } from 'geotiff';
import type { GeoTiffAffine, ParsedMask } from '../types/solar';
import type { LatLng } from '../types';

/**
 * Parse a GeoTIFF mask buffer into a binary mask array + affine transform.
 * The mask indicates which pixels are rooftop (non-zero) vs ground (zero).
 * Uses dynamic import() for geotiff to enable code-splitting.
 */
export async function parseMaskGeoTiff(buffer: ArrayBuffer): Promise<ParsedMask> {
  const { fromArrayBuffer } = await import('geotiff');
  const tiff = await fromArrayBuffer(buffer);
  const image = await tiff.getImage();
  const rasters = await image.readRasters();
  const rawData = rasters[0] as Uint8Array | Float32Array | Float64Array;

  const width = image.getWidth();
  const height = image.getHeight();

  // Convert to binary mask (0 or 1)
  const data = new Uint8Array(width * height);
  for (let i = 0; i < rawData.length; i++) {
    data[i] = rawData[i] > 0 ? 1 : 0;
  }

  // Extract affine transform from GeoTIFF metadata
  const affineParams = getAffineFromImage(image);

  return {
    data,
    width,
    height,
    affine: {
      originX: affineParams[0],
      originY: affineParams[3],
      pixelWidth: affineParams[1],
      pixelHeight: affineParams[5],
    },
  };
}

function getAffineFromImage(image: GeoTIFFImage): number[] {
  // Try tiepoints + pixel scale first
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fileDir = image.getFileDirectory() as any;
    const modelTiepoint = fileDir.ModelTiepoint as number[] | undefined;
    const modelPixelScale = fileDir.ModelPixelScale as number[] | undefined;

    if (modelTiepoint && modelPixelScale && modelTiepoint.length >= 6 && modelPixelScale.length >= 2) {
      const i = modelTiepoint[0], j = modelTiepoint[1];
      const x = modelTiepoint[3], y = modelTiepoint[4];
      return [
        x - i * modelPixelScale[0],
        modelPixelScale[0],
        0,
        y - j * (-modelPixelScale[1]),
        0,
        -modelPixelScale[1],
      ];
    }
  } catch {
    // Fall through to bounding box method
  }

  // Fallback: compute from bounding box
  const bbox = image.getBoundingBox();
  const width = image.getWidth();
  const height = image.getHeight();

  const pixelWidth = (bbox[2] - bbox[0]) / width;
  const pixelHeight = -(bbox[3] - bbox[1]) / height;

  return [bbox[0], pixelWidth, 0, bbox[3], 0, pixelHeight];
}

/**
 * Check if the affine transform uses projected coordinates (meters) rather than
 * geographic coordinates (degrees). Google Solar API GeoTIFFs typically use UTM.
 */
function isProjectedCRS(affine: GeoTiffAffine): boolean {
  return Math.abs(affine.originX) > 180 || Math.abs(affine.originY) > 90;
}

/**
 * Determine UTM zone number from a longitude value.
 */
function utmZoneFromLng(lng: number): number {
  return Math.floor((lng + 180) / 6) + 1;
}

/**
 * Convert UTM (easting, northing) to WGS84 lat/lng.
 * Assumes northern hemisphere.
 */
function utmToLatLng(easting: number, northing: number, zone: number): LatLng {
  const a = 6378137; // WGS84 semi-major axis
  const f = 1 / 298.257223563;
  const e = Math.sqrt(2 * f - f * f);
  const e2 = e * e;
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const k0 = 0.9996;

  const x = easting - 500000; // remove false easting
  const y = northing; // northern hemisphere (no false northing)

  const M = y / k0;
  const mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256));

  const phi1 = mu
    + (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * Math.sin(2 * mu)
    + (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) * Math.sin(4 * mu)
    + (151 * e1 * e1 * e1 / 96) * Math.sin(6 * mu)
    + (1097 * e1 * e1 * e1 * e1 / 512) * Math.sin(8 * mu);

  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);
  const N1 = a / Math.sqrt(1 - e2 * sinPhi1 * sinPhi1);
  const T1 = tanPhi1 * tanPhi1;
  const C1 = (e2 / (1 - e2)) * cosPhi1 * cosPhi1;
  const R1 = a * (1 - e2) / Math.pow(1 - e2 * sinPhi1 * sinPhi1, 1.5);
  const D = x / (N1 * k0);
  const ep2 = e2 / (1 - e2);

  const lat = phi1 - (N1 * tanPhi1 / R1) * (
    D * D / 2
    - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D * D * D * D / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D * D * D * D * D * D / 720
  );

  const centralMeridian = (zone - 1) * 6 - 180 + 3;
  const lng = centralMeridian + (180 / Math.PI) * (
    D
    - (1 + 2 * T1 + C1) * D * D * D / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D * D * D * D * D / 120
  ) / cosPhi1;

  return { lat: lat * 180 / Math.PI, lng };
}

/**
 * Convert WGS84 lat/lng to UTM (easting, northing).
 * Assumes northern hemisphere.
 */
function latLngToUtm(latLng: LatLng, zone: number): { x: number; y: number } {
  const a = 6378137;
  const f = 1 / 298.257223563;
  const e = Math.sqrt(2 * f - f * f);
  const e2 = e * e;
  const k0 = 0.9996;

  const latRad = (latLng.lat * Math.PI) / 180;
  const centralMeridian = (zone - 1) * 6 - 180 + 3;
  const lngRad = ((latLng.lng - centralMeridian) * Math.PI) / 180;

  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const tanLat = Math.tan(latRad);
  const ep2 = e2 / (1 - e2);

  const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);
  const T = tanLat * tanLat;
  const C = ep2 * cosLat * cosLat;
  const A = cosLat * lngRad;

  const M = a * (
    (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256) * latRad
    - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 * e2 * e2 / 1024) * Math.sin(2 * latRad)
    + (15 * e2 * e2 / 256 + 45 * e2 * e2 * e2 / 1024) * Math.sin(4 * latRad)
    - (35 * e2 * e2 * e2 / 3072) * Math.sin(6 * latRad)
  );

  const x = k0 * N * (
    A
    + (1 - T + C) * A * A * A / 6
    + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A * A * A * A * A / 120
  ) + 500000; // false easting

  const y = k0 * (
    M + N * tanLat * (
      A * A / 2
      + (5 - T + 9 * C + 4 * C * C) * A * A * A * A / 24
      + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A * A * A * A * A * A / 720
    )
  );

  return { x, y };
}

/**
 * Convert pixel coordinates to lat/lng using the affine transform.
 * Handles UTM projected GeoTIFFs (used by Google Solar API) by converting
 * UTM easting/northing to WGS84 using the target location to determine the UTM zone.
 */
export function pixelToLatLng(col: number, row: number, affine: GeoTiffAffine, utmZone?: number): LatLng {
  const x = affine.originX + col * affine.pixelWidth;
  const y = affine.originY + row * affine.pixelHeight;

  if (isProjectedCRS(affine) && utmZone) {
    return utmToLatLng(x, y, utmZone);
  }

  return { lat: y, lng: x };
}

/**
 * Convert lat/lng to pixel coordinates.
 * Handles UTM projected GeoTIFFs by converting WGS84 to UTM.
 */
export function latLngToPixel(latLng: LatLng, affine: GeoTiffAffine, utmZone?: number): { col: number; row: number } {
  if (isProjectedCRS(affine) && utmZone) {
    const { x, y } = latLngToUtm(latLng, utmZone);
    return {
      col: Math.round((x - affine.originX) / affine.pixelWidth),
      row: Math.round((y - affine.originY) / affine.pixelHeight),
    };
  }

  return {
    col: Math.round((latLng.lng - affine.originX) / affine.pixelWidth),
    row: Math.round((latLng.lat - affine.originY) / affine.pixelHeight),
  };
}

/**
 * Two-pass connected component labeling with union-find.
 * Identifies distinct buildings (connected blobs) in the binary mask.
 * Returns label array where each pixel has its component ID (0 = background).
 */
export function labelConnectedComponents(
  mask: Uint8Array,
  w: number,
  h: number
): { labels: Int32Array; numComponents: number } {
  const labels = new Int32Array(w * h);
  const parent: number[] = [];
  let nextLabel = 1;

  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]; // path compression
      x = parent[x];
    }
    return x;
  }

  function union(a: number, b: number) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  }

  // First pass: assign provisional labels
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const idx = row * w + col;
      if (mask[idx] === 0) continue;

      const neighbors: number[] = [];
      if (row > 0 && labels[(row - 1) * w + col] > 0) {
        neighbors.push(labels[(row - 1) * w + col]);
      }
      if (col > 0 && labels[row * w + (col - 1)] > 0) {
        neighbors.push(labels[row * w + (col - 1)]);
      }

      if (neighbors.length === 0) {
        labels[idx] = nextLabel;
        parent[nextLabel] = nextLabel;
        nextLabel++;
      } else {
        const minLabel = Math.min(...neighbors);
        labels[idx] = minLabel;
        for (const n of neighbors) {
          union(minLabel, n);
        }
      }
    }
  }

  // Second pass: resolve labels to roots
  const componentMap = new Map<number, number>();
  let numComponents = 0;

  for (let i = 0; i < labels.length; i++) {
    if (labels[i] === 0) continue;
    const root = find(labels[i]);
    if (!componentMap.has(root)) {
      numComponents++;
      componentMap.set(root, numComponents);
    }
    labels[i] = componentMap.get(root)!;
  }

  return { labels, numComponents };
}

/**
 * Find the component whose centroid is closest to the target pixel.
 * Used to identify which building in the mask is our target building.
 */
export function findTargetComponent(
  labels: Int32Array,
  w: number,
  h: number,
  targetCol: number,
  targetRow: number
): number {
  // Check if target pixel is directly on a component
  const directLabel = labels[targetRow * w + targetCol];
  if (directLabel > 0) return directLabel;

  // Otherwise find component with centroid closest to target
  const componentCentroids = new Map<number, { sumCol: number; sumRow: number; count: number }>();

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const label = labels[row * w + col];
      if (label === 0) continue;
      const entry = componentCentroids.get(label) || { sumCol: 0, sumRow: 0, count: 0 };
      entry.sumCol += col;
      entry.sumRow += row;
      entry.count++;
      componentCentroids.set(label, entry);
    }
  }

  let bestLabel = 1;
  let bestDist = Infinity;

  for (const [label, { sumCol, sumRow, count }] of componentCentroids) {
    const cx = sumCol / count;
    const cy = sumRow / count;
    const dist = Math.hypot(cx - targetCol, cy - targetRow);
    if (dist < bestDist) {
      bestDist = dist;
      bestLabel = label;
    }
  }

  return bestLabel;
}

/**
 * Extract boundary-only mask for a single component.
 * A pixel is a boundary pixel if it belongs to the component AND
 * has at least one 4-connected neighbor that is background (label 0).
 * This produces a 1-pixel-thick outline suitable for Moore boundary tracing.
 */
function extractComponentBoundaryMask(
  labels: Int32Array,
  w: number,
  h: number,
  componentId: number
): Uint8Array {
  const mask = new Uint8Array(w * h);
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const idx = row * w + col;
      if (labels[idx] !== componentId) continue;

      // Check if any 4-connected neighbor is background
      const isEdge =
        row === 0 || row === h - 1 || col === 0 || col === w - 1 ||
        labels[(row - 1) * w + col] !== componentId ||
        labels[(row + 1) * w + col] !== componentId ||
        labels[row * w + (col - 1)] !== componentId ||
        labels[row * w + (col + 1)] !== componentId;

      if (isEdge) mask[idx] = 1;
    }
  }
  return mask;
}

/**
 * Moore boundary trace: trace the outer boundary of a binary blob clockwise.
 * Returns ordered pixel coordinates forming the contour.
 */
export function mooreBoundaryTrace(
  mask: Uint8Array,
  w: number,
  h: number
): { col: number; row: number }[] {
  // Find starting pixel (top-left foreground pixel)
  let startCol = -1;
  let startRow = -1;

  for (let row = 0; row < h && startRow === -1; row++) {
    for (let col = 0; col < w; col++) {
      if (mask[row * w + col] === 1) {
        startCol = col;
        startRow = row;
        break;
      }
    }
  }

  if (startRow === -1) return [];

  // Moore neighborhood (8-connected), starting from left and going clockwise
  const dx = [-1, -1, 0, 1, 1, 1, 0, -1]; // col offsets
  const dy = [0, -1, -1, -1, 0, 1, 1, 1]; // row offsets

  const boundary: { col: number; row: number }[] = [];
  let col = startCol;
  let row = startRow;
  let dir = 4; // entered from the left during raster scan (moved right), so backtrack = left

  const maxSteps = w * h * 2; // safety limit
  let steps = 0;

  do {
    boundary.push({ col, row });

    // Backtrack direction: come from opposite of entry
    let searchDir = (dir + 5) % 8; // start search from the pixel after backtrack

    let found = false;
    for (let i = 0; i < 8; i++) {
      const nd = (searchDir + i) % 8;
      const nc = col + dx[nd];
      const nr = row + dy[nd];

      if (nc >= 0 && nc < w && nr >= 0 && nr < h && mask[nr * w + nc] === 1) {
        dir = nd;
        col = nc;
        row = nr;
        found = true;
        break;
      }
    }

    if (!found) break;
    steps++;
  } while ((col !== startCol || row !== startRow) && steps < maxSteps);

  return boundary;
}

/**
 * Douglas-Peucker line simplification.
 * Reduces the number of points in a contour while preserving shape.
 * epsilon = maximum allowed distance from original contour (in pixels).
 */
export function douglasPeucker(
  points: { col: number; row: number }[],
  epsilon: number
): { col: number; row: number }[] {
  if (points.length <= 2) return [...points];

  // Find the point with the maximum distance from the line segment (first, last)
  const first = points[0];
  const last = points[points.length - 1];
  let maxDist = 0;
  let maxIdx = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

function perpendicularDistance(
  point: { col: number; row: number },
  lineStart: { col: number; row: number },
  lineEnd: { col: number; row: number }
): number {
  const dx = lineEnd.col - lineStart.col;
  const dy = lineEnd.row - lineStart.row;
  const lineLenSq = dx * dx + dy * dy;

  if (lineLenSq === 0) {
    return Math.hypot(point.col - lineStart.col, point.row - lineStart.row);
  }

  const num = Math.abs(
    dy * point.col - dx * point.row + lineEnd.col * lineStart.row - lineEnd.row * lineStart.col
  );
  return num / Math.sqrt(lineLenSq);
}

/**
 * Full pipeline: extract building outline from mask GeoTIFF.
 * Returns simplified polygon as lat/lng coordinates.
 */
export function extractBuildingOutline(
  parsed: ParsedMask,
  targetLat: number,
  targetLng: number,
  simplifyEpsilon: number = 2
): LatLng[] {
  const { data, width, height, affine } = parsed;

  // Determine UTM zone from target location (for projected CRS GeoTIFFs)
  const utmZone = isProjectedCRS(affine) ? utmZoneFromLng(targetLng) : undefined;

  // Step 1: Connected component labeling
  const { labels } = labelConnectedComponents(data, width, height);

  // Step 2: Find target building component
  const targetPixel = latLngToPixel({ lat: targetLat, lng: targetLng }, affine, utmZone);
  const targetComponent = findTargetComponent(
    labels, width, height,
    Math.max(0, Math.min(width - 1, targetPixel.col)),
    Math.max(0, Math.min(height - 1, targetPixel.row))
  );

  // Step 3: Extract boundary-only mask (1-pixel outline for clean Moore tracing)
  const buildingMask = extractComponentBoundaryMask(labels, width, height, targetComponent);

  // Step 4: Trace boundary
  const boundary = mooreBoundaryTrace(buildingMask, width, height);
  if (boundary.length < 3) return [];

  // Step 5: Simplify (Douglas-Peucker)
  const simplified = douglasPeucker(boundary, simplifyEpsilon);
  if (simplified.length < 3) return [];

  // Step 6: Convert to lat/lng
  return simplified.map((p) => pixelToLatLng(p.col, p.row, affine, utmZone));
}
