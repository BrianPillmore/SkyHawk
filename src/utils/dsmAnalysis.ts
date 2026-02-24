import type { LatLng } from '../types';
import type { ParsedDSM, DsmFacetAnalysis, BuildingHeightAnalysis } from '../types/solar';
import { latLngToPixel } from './contour';

const SQ_M_TO_SQ_FT = 10.7639;
const M_TO_FT = 3.28084;

/**
 * Fit a plane z = ax + by + c to a set of 3D points using least-squares.
 * Returns [a, b, c] coefficients.
 */
export function fitPlane(
  points: { x: number; y: number; z: number }[]
): [number, number, number] {
  const n = points.length;
  if (n < 3) return [0, 0, 0];

  // Normal equations: solve for [a, b, c] in z = ax + by + c
  let sumX = 0, sumY = 0, sumZ = 0;
  let sumXX = 0, sumXY = 0, sumXZ = 0;
  let sumYY = 0, sumYZ = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumZ += p.z;
    sumXX += p.x * p.x;
    sumXY += p.x * p.y;
    sumXZ += p.x * p.z;
    sumYY += p.y * p.y;
    sumYZ += p.y * p.z;
  }

  // Matrix form: A^T A * [a, b, c]^T = A^T z
  // where A = [[x1, y1, 1], [x2, y2, 1], ...]
  const A00 = sumXX, A01 = sumXY, A02 = sumX;
  const A10 = sumXY, A11 = sumYY, A12 = sumY;
  const A20 = sumX, A21 = sumY, A22 = n;

  const b0 = sumXZ;
  const b1 = sumYZ;
  const b2 = sumZ;

  // Cramer's rule for 3x3
  const det = A00 * (A11 * A22 - A12 * A21)
            - A01 * (A10 * A22 - A12 * A20)
            + A02 * (A10 * A21 - A11 * A20);

  if (Math.abs(det) < 1e-12) return [0, 0, sumZ / n];

  const a = (b0 * (A11 * A22 - A12 * A21)
           - A01 * (b1 * A22 - A12 * b2)
           + A02 * (b1 * A21 - A11 * b2)) / det;

  const b = (A00 * (b1 * A22 - A12 * b2)
           - b0 * (A10 * A22 - A12 * A20)
           + A02 * (A10 * b2 - b1 * A20)) / det;

  const c = (A00 * (A11 * b2 - b1 * A21)
           - A01 * (A10 * b2 - b1 * A20)
           + b0 * (A10 * A21 - A11 * A20)) / det;

  return [a, b, c];
}

/**
 * Compute the 3D area of a triangle given three 3D points.
 * Uses the cross-product magnitude / 2 formula.
 */
export function triangleArea3D(
  p1: { x: number; y: number; z: number },
  p2: { x: number; y: number; z: number },
  p3: { x: number; y: number; z: number }
): number {
  // Vectors v1 = p2 - p1, v2 = p3 - p1
  const v1x = p2.x - p1.x;
  const v1y = p2.y - p1.y;
  const v1z = p2.z - p1.z;
  const v2x = p3.x - p1.x;
  const v2y = p3.y - p1.y;
  const v2z = p3.z - p1.z;

  // Cross product
  const cx = v1y * v2z - v1z * v2y;
  const cy = v1z * v2x - v1x * v2z;
  const cz = v1x * v2y - v1y * v2x;

  return Math.sqrt(cx * cx + cy * cy + cz * cz) / 2;
}

/**
 * Compute the median of an array of numbers.
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Check if a point (px, py) is inside a polygon defined by vertices.
 * Uses ray-casting algorithm in pixel coordinates.
 */
function isPointInPolygonPixel(
  px: number,
  py: number,
  polygon: { col: number; row: number }[]
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].col, yi = polygon[i].row;
    const xj = polygon[j].col, yj = polygon[j].row;

    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Analyze a single roof facet using DSM elevation data.
 * Samples all DSM pixels inside the facet polygon, fits a plane to get
 * pitch/azimuth, and computes triangulated mesh area for true 3D surface area.
 *
 * @param facetVertices - LatLng vertices defining the facet polygon
 * @param dsm - Parsed DSM data with Float32 elevation values
 * @param targetLng - Longitude for UTM zone determination
 * @returns DsmFacetAnalysis with pitch, azimuth, true area, and elevation data
 */
export function analyzeFacetFromDSM(
  facetVertices: LatLng[],
  dsm: ParsedDSM,
  targetLng: number
): DsmFacetAnalysis {
  const { data, width, height, affine } = dsm;

  // Determine UTM zone
  const isProjected = Math.abs(affine.originX) > 180 || Math.abs(affine.originY) > 90;
  const utmZone = isProjected ? Math.floor((targetLng + 180) / 6) + 1 : undefined;

  // Convert facet vertices to pixel coordinates
  const facetPixels = facetVertices.map(v => latLngToPixel(v, affine, utmZone));

  // Find bounding box in pixel coords
  const minCol = Math.max(0, Math.min(...facetPixels.map(p => p.col)) - 1);
  const maxCol = Math.min(width - 1, Math.max(...facetPixels.map(p => p.col)) + 1);
  const minRow = Math.max(0, Math.min(...facetPixels.map(p => p.row)) - 1);
  const maxRow = Math.min(height - 1, Math.max(...facetPixels.map(p => p.row)) + 1);

  // Sample all pixels inside facet
  const samples: { x: number; y: number; z: number }[] = [];
  // Build grid of elevations for mesh area calculation
  const grid: Map<string, number> = new Map();

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (!isPointInPolygonPixel(col, row, facetPixels)) continue;

      const idx = row * width + col;
      const z = data[idx];

      // Skip no-data values (typically -9999 or 0)
      if (z <= -9000 || z === 0) continue;

      // Use pixel coords as x, y (in meters, via pixel scale)
      const xMeters = col * Math.abs(affine.pixelWidth);
      const yMeters = row * Math.abs(affine.pixelHeight);

      samples.push({ x: xMeters, y: yMeters, z });
      grid.set(`${col},${row}`, z);
    }
  }

  if (samples.length < 3) {
    return {
      pitchDegrees: 0,
      azimuthDegrees: 0,
      trueAreaSqFt3D: 0,
      avgElevationMeters: 0,
      sampleCount: 0,
    };
  }

  // Fit plane: z = ax + by + c
  const [a, b] = fitPlane(samples);

  // Pitch = angle from horizontal = atan(sqrt(a² + b²))
  const slopeGradient = Math.sqrt(a * a + b * b);
  const pitchDegrees = Math.atan(slopeGradient) * (180 / Math.PI);

  // Azimuth = direction of steepest descent
  // atan2(a, b) gives the direction of the gradient vector
  let azimuthDegrees = Math.atan2(a, -b) * (180 / Math.PI);
  if (azimuthDegrees < 0) azimuthDegrees += 360;

  // Average elevation
  const avgElevationMeters = samples.reduce((s, p) => s + p.z, 0) / samples.length;

  // Triangulated mesh area: for each 2x2 pixel quad, create 2 triangles
  let totalArea3DMeters2 = 0;
  const pixelW = Math.abs(affine.pixelWidth);
  const pixelH = Math.abs(affine.pixelHeight);

  for (let row = minRow; row < maxRow; row++) {
    for (let col = minCol; col < maxCol; col++) {
      const z00 = grid.get(`${col},${row}`);
      const z10 = grid.get(`${col + 1},${row}`);
      const z01 = grid.get(`${col},${row + 1}`);
      const z11 = grid.get(`${col + 1},${row + 1}`);

      // Need at least 3 of 4 corners for a triangle
      if (z00 !== undefined && z10 !== undefined && z01 !== undefined) {
        totalArea3DMeters2 += triangleArea3D(
          { x: col * pixelW, y: row * pixelH, z: z00 },
          { x: (col + 1) * pixelW, y: row * pixelH, z: z10 },
          { x: col * pixelW, y: (row + 1) * pixelH, z: z01 }
        );
      }

      if (z10 !== undefined && z01 !== undefined && z11 !== undefined) {
        totalArea3DMeters2 += triangleArea3D(
          { x: (col + 1) * pixelW, y: row * pixelH, z: z10 },
          { x: (col + 1) * pixelW, y: (row + 1) * pixelH, z: z11 },
          { x: col * pixelW, y: (row + 1) * pixelH, z: z01 }
        );
      }
    }
  }

  const trueAreaSqFt3D = totalArea3DMeters2 * SQ_M_TO_SQ_FT;

  return {
    pitchDegrees,
    azimuthDegrees,
    trueAreaSqFt3D,
    avgElevationMeters,
    sampleCount: samples.length,
  };
}

/**
 * Compute building height and stories from DSM data.
 * Samples DSM at outline vertices (eave elevation) and at points
 * 15% beyond the outline from the centroid (ground elevation).
 *
 * @param outline - Building outline vertices as LatLng
 * @param dsm - Parsed DSM data
 * @param targetLng - Longitude for UTM zone determination
 * @returns BuildingHeightAnalysis with height, stories, parapet detection
 */
export function computeBuildingHeight(
  outline: LatLng[],
  dsm: ParsedDSM,
  targetLng: number
): BuildingHeightAnalysis {
  const { data, width, height, affine } = dsm;

  const isProjected = Math.abs(affine.originX) > 180 || Math.abs(affine.originY) > 90;
  const utmZone = isProjected ? Math.floor((targetLng + 180) / 6) + 1 : undefined;

  // Centroid of outline
  const centLat = outline.reduce((s, v) => s + v.lat, 0) / outline.length;
  const centLng = outline.reduce((s, v) => s + v.lng, 0) / outline.length;

  // Sample eave elevations (at outline vertices)
  const eaveElevations: number[] = [];
  for (const v of outline) {
    const px = latLngToPixel(v, affine, utmZone);
    const col = Math.max(0, Math.min(width - 1, px.col));
    const row = Math.max(0, Math.min(height - 1, px.row));
    const z = data[row * width + col];
    if (z > -9000 && z !== 0) {
      eaveElevations.push(z);
    }
  }

  // Sample ground elevations (15% beyond outline from centroid)
  const groundElevations: number[] = [];
  for (const v of outline) {
    const groundLat = centLat + (v.lat - centLat) * 1.15;
    const groundLng = centLng + (v.lng - centLng) * 1.15;
    const px = latLngToPixel({ lat: groundLat, lng: groundLng }, affine, utmZone);
    const col = Math.max(0, Math.min(width - 1, px.col));
    const row = Math.max(0, Math.min(height - 1, px.row));
    const z = data[row * width + col];
    if (z > -9000 && z !== 0) {
      groundElevations.push(z);
    }
  }

  if (eaveElevations.length === 0 || groundElevations.length === 0) {
    return { heightFt: 0, stories: 1, hasParapet: false, parapetHeightFt: 0 };
  }

  const eaveMedian = median(eaveElevations);
  const groundMedian = median(groundElevations);
  const heightMeters = Math.max(0, eaveMedian - groundMedian);
  const heightFt = heightMeters * M_TO_FT;

  // Stories estimation: ~10 ft per story (3.0 meters)
  const stories = Math.max(1, Math.round(heightMeters / 3.0));

  // Parapet detection: if the range of eave elevations is 0.3-1.5m,
  // it suggests a parapet wall at the edge
  const eaveMin = Math.min(...eaveElevations);
  const eaveMax = Math.max(...eaveElevations);
  const eaveRange = eaveMax - eaveMin;
  const hasParapet = eaveRange >= 0.3 && eaveRange <= 1.5 && heightMeters > 3;
  const parapetHeightFt = hasParapet ? eaveRange * M_TO_FT : 0;

  return {
    heightFt: Math.round(heightFt * 10) / 10,
    stories,
    hasParapet,
    parapetHeightFt: Math.round(parapetHeightFt * 10) / 10,
  };
}
