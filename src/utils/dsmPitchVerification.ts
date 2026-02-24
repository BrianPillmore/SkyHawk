/**
 * DSM-Based Pitch Verification and Building Height Extraction (Phase 7).
 *
 * Builds a VERIFICATION layer on top of the existing DSM analysis
 * (dsmAnalysis.ts) that compares DSM-derived pitches with Solar API data
 * and makes recommendations about which source to trust.
 */

import type { LatLng } from '../types';
import type {
  ParsedDSM,
  GeoTiffAffine,
  PitchVerificationResult,
  BuildingHeightResult,
  ReconstructedRoof,
} from '../types/solar';
import { fitPlane, median } from './dsmAnalysis';
import { latLngToPixel } from './contour';
import { degreesToPitch, clampPitch } from './geometry';

const M_TO_FT = 3.28084;

/** Pitch difference threshold in x/12 that triggers manual review */
const PITCH_DEVIATION_THRESHOLD = 2;

/** Minimum sample count for high confidence */
const HIGH_CONFIDENCE_SAMPLE_COUNT = 50;

/** Minimum sample count for medium confidence */
const MEDIUM_CONFIDENCE_SAMPLE_COUNT = 15;

/** Minimum R-squared for high confidence plane fit */
const HIGH_CONFIDENCE_R_SQUARED = 0.85;

/** Minimum R-squared for medium confidence plane fit */
const MEDIUM_CONFIDENCE_R_SQUARED = 0.6;

// ─── Helpers ─────────────────────────────────────────────────────

function isProjectedCRS(affine: GeoTiffAffine): boolean {
  return Math.abs(affine.originX) > 180 || Math.abs(affine.originY) > 90;
}

function utmZoneFromLng(lng: number): number {
  return Math.floor((lng + 180) / 6) + 1;
}

/**
 * Check if a point (px, py) is inside a polygon defined in pixel coordinates.
 * Uses ray-casting algorithm.
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
 * Calculate R-squared (coefficient of determination) for a plane fit.
 * Measures how well the fitted plane explains the elevation variance.
 *
 * R^2 = 1 - SS_res / SS_tot
 * where SS_res = sum of squared residuals, SS_tot = total sum of squares
 */
export function calculateRSquared(
  points: { x: number; y: number; z: number }[],
  planeCoeffs: [number, number, number],
): number {
  if (points.length < 3) return 0;

  const [a, b, c] = planeCoeffs;
  const meanZ = points.reduce((s, p) => s + p.z, 0) / points.length;

  let ssTot = 0;
  let ssRes = 0;

  for (const p of points) {
    const predicted = a * p.x + b * p.y + c;
    ssRes += (p.z - predicted) ** 2;
    ssTot += (p.z - meanZ) ** 2;
  }

  if (ssTot === 0) return 1; // All points at same elevation = perfect flat plane
  return Math.max(0, 1 - ssRes / ssTot);
}

/**
 * Determine confidence level based on sample count and R-squared.
 */
export function determineConfidence(
  sampleCount: number,
  rSquared: number,
): 'high' | 'medium' | 'low' {
  if (sampleCount >= HIGH_CONFIDENCE_SAMPLE_COUNT && rSquared >= HIGH_CONFIDENCE_R_SQUARED) {
    return 'high';
  }
  if (sampleCount >= MEDIUM_CONFIDENCE_SAMPLE_COUNT && rSquared >= MEDIUM_CONFIDENCE_R_SQUARED) {
    return 'medium';
  }
  return 'low';
}

/**
 * Determine recommendation based on pitch difference, confidence, and R-squared.
 *
 * Logic:
 * - Small difference (< 2/12): accept Solar API (more stable/canonical)
 * - Large difference with high confidence DSM: accept DSM
 * - Large difference with low confidence: manual review
 */
export function determineRecommendation(
  pitchDifference: number,
  confidence: 'high' | 'medium' | 'low',
  rSquared: number,
): 'accept-solar' | 'accept-dsm' | 'manual-review' {
  // Small difference: Solar API and DSM agree, trust Solar API
  if (pitchDifference < PITCH_DEVIATION_THRESHOLD) {
    return 'accept-solar';
  }

  // Large difference with high-quality DSM data: trust DSM
  if (confidence === 'high' && rSquared >= HIGH_CONFIDENCE_R_SQUARED) {
    return 'accept-dsm';
  }

  // Large difference with medium confidence: depends on R-squared
  if (confidence === 'medium' && rSquared >= 0.75) {
    return 'accept-dsm';
  }

  // Otherwise, manual review needed
  return 'manual-review';
}

// ─── Pitch Verification ──────────────────────────────────────────

/**
 * Verify pitch from DSM for each facet by comparing with Solar API pitch values.
 *
 * For each facet:
 * 1. Sample DSM elevation values within the facet polygon
 * 2. Fit a plane to the elevation samples using least-squares
 * 3. Calculate the pitch of the fitted plane
 * 4. Compare with the pitch assigned from Solar API segments
 * 5. Flag significant deviations
 *
 * @param dsmData - Parsed DSM with elevation data
 * @param roof - Reconstructed roof with facets and vertices
 * @param targetLng - Longitude for UTM zone determination
 */
export function verifyPitchFromDSM(
  dsmData: ParsedDSM,
  roof: ReconstructedRoof,
  targetLng: number,
): PitchVerificationResult[] {
  const { data, width, height, affine } = dsmData;

  const projected = isProjectedCRS(affine);
  const utmZone = projected ? utmZoneFromLng(targetLng) : undefined;

  return roof.facets.map((facet, facetIndex) => {
    // Get facet vertices
    const facetVertices = facet.vertexIndices
      .map(idx => roof.vertices[idx])
      .filter(Boolean);

    if (facetVertices.length < 3) {
      return {
        facetIndex,
        solarApiPitch: facet.pitch,
        dsmPitch: 0,
        pitchDifference: facet.pitch,
        confidence: 'low' as const,
        sampleCount: 0,
        rSquared: 0,
        recommendation: 'accept-solar' as const,
      };
    }

    // Convert to pixel coordinates
    const facetPixels = facetVertices.map(v => latLngToPixel(v, affine, utmZone));

    // Find bounding box
    const cols = facetPixels.map(p => p.col);
    const rows = facetPixels.map(p => p.row);
    const minCol = Math.max(0, Math.min(...cols) - 1);
    const maxCol = Math.min(width - 1, Math.max(...cols) + 1);
    const minRow = Math.max(0, Math.min(...rows) - 1);
    const maxRow = Math.min(height - 1, Math.max(...rows) + 1);

    // Sample DSM within facet
    const samples: { x: number; y: number; z: number }[] = [];

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (!isPointInPolygonPixel(col, row, facetPixels)) continue;

        const idx = row * width + col;
        const z = data[idx];
        if (z <= -9000 || z === 0) continue;

        const xMeters = col * Math.abs(affine.pixelWidth);
        const yMeters = row * Math.abs(affine.pixelHeight);
        samples.push({ x: xMeters, y: yMeters, z });
      }
    }

    if (samples.length < 3) {
      return {
        facetIndex,
        solarApiPitch: facet.pitch,
        dsmPitch: 0,
        pitchDifference: facet.pitch,
        confidence: 'low' as const,
        sampleCount: samples.length,
        rSquared: 0,
        recommendation: 'accept-solar' as const,
      };
    }

    // Fit plane: z = ax + by + c
    const planeCoeffs = fitPlane(samples);
    const [a, b] = planeCoeffs;

    // Pitch = angle from horizontal
    const slopeGradient = Math.sqrt(a * a + b * b);
    const pitchDegrees = Math.atan(slopeGradient) * (180 / Math.PI);
    const dsmPitchOver12 = clampPitch(Math.round(degreesToPitch(pitchDegrees) * 10) / 10);

    // R-squared: how well the plane fits the data
    const rSquared = calculateRSquared(samples, planeCoeffs);

    // Solar API pitch (already in x/12 format)
    const solarApiPitch = facet.pitch;
    const pitchDifference = Math.abs(solarApiPitch - dsmPitchOver12);

    const confidence = determineConfidence(samples.length, rSquared);
    const recommendation = determineRecommendation(pitchDifference, confidence, rSquared);

    return {
      facetIndex,
      solarApiPitch,
      dsmPitch: dsmPitchOver12,
      pitchDifference: Math.round(pitchDifference * 10) / 10,
      confidence,
      sampleCount: samples.length,
      rSquared: Math.round(rSquared * 1000) / 1000,
      recommendation,
    };
  });
}

// ─── Building Height Extraction ──────────────────────────────────

/**
 * Extract building height from DSM data.
 *
 * Approach:
 * 1. Sample ground elevation around the building perimeter (15% beyond outline)
 * 2. Sample roof elevation within the building footprint
 * 3. Calculate building height = roof elevation - ground elevation
 * 4. Estimate stories (height / 10ft per story)
 * 5. Return ridge height (max roof elevation - ground)
 *
 * @param dsmData - Parsed DSM with elevation data
 * @param buildingBounds - SW/NE bounding box of the building
 * @param outline - Building outline vertices (if available)
 * @param targetLng - Longitude for UTM zone determination
 */
export function extractBuildingHeightFromDSM(
  dsmData: ParsedDSM,
  buildingBounds: { sw: LatLng; ne: LatLng },
  outline?: LatLng[],
  targetLng?: number,
): BuildingHeightResult {
  const { data, width, height, affine } = dsmData;

  const lng = targetLng ?? (buildingBounds.sw.lng + buildingBounds.ne.lng) / 2;
  const projected = isProjectedCRS(affine);
  const utmZone = projected ? utmZoneFromLng(lng) : undefined;

  // Determine sampling points
  const roofVertices = outline && outline.length >= 3
    ? outline
    : boundsToVertices(buildingBounds);

  // Centroid
  const centLat = roofVertices.reduce((s, v) => s + v.lat, 0) / roofVertices.length;
  const centLng = roofVertices.reduce((s, v) => s + v.lng, 0) / roofVertices.length;

  // Sample roof elevations at outline vertices
  const roofElevations: number[] = [];
  for (const v of roofVertices) {
    const px = latLngToPixel(v, affine, utmZone);
    const col = Math.max(0, Math.min(width - 1, px.col));
    const row = Math.max(0, Math.min(height - 1, px.row));
    const z = data[row * width + col];
    if (z > -9000 && z !== 0) {
      roofElevations.push(z);
    }
  }

  // Also sample interior roof points (fill grid within bounds)
  const swPx = latLngToPixel(buildingBounds.sw, affine, utmZone);
  const nePx = latLngToPixel(buildingBounds.ne, affine, utmZone);
  const minCol = Math.max(0, Math.min(swPx.col, nePx.col));
  const maxCol = Math.min(width - 1, Math.max(swPx.col, nePx.col));
  const minRow = Math.max(0, Math.min(swPx.row, nePx.row));
  const maxRow = Math.min(height - 1, Math.max(swPx.row, nePx.row));

  for (let row = minRow; row <= maxRow; row += 3) { // sample every 3rd pixel
    for (let col = minCol; col <= maxCol; col += 3) {
      const z = data[row * width + col];
      if (z > -9000 && z !== 0) {
        roofElevations.push(z);
      }
    }
  }

  // Sample ground elevations (15% beyond outline from centroid)
  const groundElevations: number[] = [];
  for (const v of roofVertices) {
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

  if (roofElevations.length === 0 || groundElevations.length === 0) {
    return {
      heightFt: 0,
      ridgeHeightFt: 0,
      estimatedStories: 1,
      groundElevationFt: 0,
      roofElevationFt: 0,
      confidence: 'low',
    };
  }

  const groundMedian = median(groundElevations);
  const roofMedian = median(roofElevations);
  const roofMax = Math.max(...roofElevations);

  const heightMeters = Math.max(0, roofMedian - groundMedian);
  const ridgeHeightMeters = Math.max(0, roofMax - groundMedian);

  const heightFt = heightMeters * M_TO_FT;
  const ridgeHeightFt = ridgeHeightMeters * M_TO_FT;
  const groundElevationFt = groundMedian * M_TO_FT;
  const roofElevationFt = roofMedian * M_TO_FT;

  // Stories estimation: ~10 ft per story (3.0 meters)
  const estimatedStories = Math.max(1, Math.round(heightMeters / 3.0));

  // Confidence based on sample counts
  const totalSamples = roofElevations.length + groundElevations.length;
  const confidence: 'high' | 'medium' | 'low' =
    totalSamples >= 20 && roofElevations.length >= 10 ? 'high' :
    totalSamples >= 8 && roofElevations.length >= 4 ? 'medium' : 'low';

  return {
    heightFt: Math.round(heightFt * 10) / 10,
    ridgeHeightFt: Math.round(ridgeHeightFt * 10) / 10,
    estimatedStories,
    groundElevationFt: Math.round(groundElevationFt * 10) / 10,
    roofElevationFt: Math.round(roofElevationFt * 10) / 10,
    confidence,
  };
}

/**
 * Convert a bounding box to 4 corner vertices.
 */
function boundsToVertices(bounds: { sw: LatLng; ne: LatLng }): LatLng[] {
  return [
    { lat: bounds.sw.lat, lng: bounds.sw.lng },
    { lat: bounds.sw.lat, lng: bounds.ne.lng },
    { lat: bounds.ne.lat, lng: bounds.ne.lng },
    { lat: bounds.ne.lat, lng: bounds.sw.lng },
  ];
}
