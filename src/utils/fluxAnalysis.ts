/**
 * GeoTIFF Flux/Shade Processing (Phase 6).
 *
 * Parses Google Solar API annual and monthly flux GeoTIFFs,
 * analyzes per-facet solar flux, shading percentages, and
 * provides color-mapping for visualization.
 */

import type { LatLng } from '../types';
import type {
  GeoTiffAffine,
  ParsedFluxMap,
  ParsedMonthlyFlux,
  FacetFluxAnalysis,
  FluxMapAnalysis,
  ShadeAnalysisResult,
} from '../types/solar';
import { latLngToPixel } from './contour';

/** Default shade threshold: pixels below this kWh/kW/year are considered shaded */
const DEFAULT_SHADE_THRESHOLD_KWH = 400;

/**
 * Check if the affine transform uses projected coordinates (meters) rather than
 * geographic coordinates (degrees).
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

// ─── GeoTIFF Parsing ─────────────────────────────────────────────

/**
 * Extract affine parameters from a GeoTIFF image.
 * Mirrors the logic in contour.ts but kept local to avoid coupling.
 */
async function getAffineFromImage(image: import('geotiff').GeoTIFFImage): Promise<number[]> {
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

  const bbox = image.getBoundingBox();
  const width = image.getWidth();
  const height = image.getHeight();
  const pixelWidth = (bbox[2] - bbox[0]) / width;
  const pixelHeight = -(bbox[3] - bbox[1]) / height;
  return [bbox[0], pixelWidth, 0, bbox[3], 0, pixelHeight];
}

/**
 * Parse the annual flux GeoTIFF into a ParsedFluxMap.
 * The raster contains kWh/kW/year per pixel. NoData is typically -9999 or 0.
 */
export async function parseFluxGeoTiff(buffer: ArrayBuffer): Promise<ParsedFluxMap> {
  const { fromArrayBuffer } = await import('geotiff');
  const tiff = await fromArrayBuffer(buffer);
  const image = await tiff.getImage();
  const rasters = await image.readRasters();
  const rawData = rasters[0] as Float32Array | Float64Array | Uint8Array;

  const width = image.getWidth();
  const height = image.getHeight();

  const data = new Float32Array(width * height);
  for (let i = 0; i < rawData.length; i++) {
    data[i] = rawData[i];
  }

  const affineParams = await getAffineFromImage(image);

  // Attempt to read the nodata value from GeoTIFF metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fileDir = image.getFileDirectory() as any;
  const gdalNoData = fileDir?.GDAL_NODATA;
  const noDataValue = gdalNoData != null ? Number(gdalNoData) : -9999;

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
    noDataValue,
  };
}

/**
 * Parse monthly flux GeoTIFF (12 bands) into ParsedMonthlyFlux.
 * Each band represents one month of flux in kWh/kW/year.
 */
export async function parseMonthlyFluxGeoTiff(buffer: ArrayBuffer): Promise<ParsedMonthlyFlux> {
  const { fromArrayBuffer } = await import('geotiff');
  const tiff = await fromArrayBuffer(buffer);
  const image = await tiff.getImage();
  const rasters = await image.readRasters();

  const width = image.getWidth();
  const height = image.getHeight();
  const bandCount = rasters.length;

  const bands: Float32Array[] = [];
  for (let b = 0; b < Math.min(bandCount, 12); b++) {
    const rawBand = rasters[b] as Float32Array | Float64Array | Uint8Array;
    const band = new Float32Array(width * height);
    for (let i = 0; i < rawBand.length; i++) {
      band[i] = rawBand[i];
    }
    bands.push(band);
  }

  // Pad to 12 bands if fewer were available
  while (bands.length < 12) {
    bands.push(new Float32Array(width * height));
  }

  const affineParams = await getAffineFromImage(image);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fileDir = image.getFileDirectory() as any;
  const gdalNoData = fileDir?.GDAL_NODATA;
  const noDataValue = gdalNoData != null ? Number(gdalNoData) : -9999;

  return {
    bands,
    width,
    height,
    affine: {
      originX: affineParams[0],
      originY: affineParams[3],
      pixelWidth: affineParams[1],
      pixelHeight: affineParams[5],
    },
    noDataValue,
  };
}

// ─── Point-in-polygon for facet pixel sampling ───────────────────

/**
 * Check if a pixel (px, py) is inside a polygon defined in pixel coordinates.
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

// ─── Facet Flux Analysis ─────────────────────────────────────────

/**
 * Facet definition for flux analysis.
 * Uses LatLng vertices to define a polygon on the roof.
 */
export interface RoofFacetForFlux {
  vertexIndices: number[];
  pitch: number;
  name: string;
}

/**
 * Analyze flux for all facets on the roof.
 *
 * @param fluxMap - Parsed annual flux GeoTIFF
 * @param facets - Array of roof facets with vertex indices
 * @param vertices - Array of LatLng vertices referenced by facets
 * @param buildingBounds - SW/NE corners of the building bounding box
 * @param monthlyFlux - Optional parsed monthly flux for per-month stats
 * @param shadeThreshold - kWh/kW/year below which a pixel is "shaded"
 */
export function analyzeFluxForFacets(
  fluxMap: ParsedFluxMap,
  facets: RoofFacetForFlux[],
  vertices: LatLng[],
  buildingBounds: { sw: LatLng; ne: LatLng },
  monthlyFlux?: ParsedMonthlyFlux,
  shadeThreshold: number = DEFAULT_SHADE_THRESHOLD_KWH,
): FluxMapAnalysis {
  const { data, width, height, affine, noDataValue } = fluxMap;

  const projected = isProjectedCRS(affine);
  const utmZone = projected ? utmZoneFromLng((buildingBounds.sw.lng + buildingBounds.ne.lng) / 2) : undefined;

  // Convert building bounds to pixel range
  const swPx = latLngToPixel(buildingBounds.sw, affine, utmZone);
  const nePx = latLngToPixel(buildingBounds.ne, affine, utmZone);

  const minCol = Math.max(0, Math.min(swPx.col, nePx.col) - 2);
  const maxCol = Math.min(width - 1, Math.max(swPx.col, nePx.col) + 2);
  const minRow = Math.max(0, Math.min(swPx.row, nePx.row) - 2);
  const maxRow = Math.min(height - 1, Math.max(swPx.row, nePx.row) + 2);

  // Count valid roof pixels (any pixel in building bounds with valid flux)
  let totalRoofPixels = 0;
  let totalFluxSum = 0;
  let overallShadedPixels = 0;

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const idx = row * width + col;
      const val = data[idx];
      if (isNoData(val, noDataValue)) continue;
      if (val <= 0) continue;
      totalRoofPixels++;
      totalFluxSum += val;
      if (val < shadeThreshold) overallShadedPixels++;
    }
  }

  const meanRoofFlux = totalRoofPixels > 0 ? totalFluxSum / totalRoofPixels : 0;

  // Analyze each facet
  const facetAnalyses: FacetFluxAnalysis[] = facets.map((facet, facetIdx) => {
    return analyzeSingleFacet(
      facetIdx,
      facet,
      vertices,
      fluxMap,
      monthlyFlux,
      utmZone,
      shadeThreshold,
    );
  });

  const overallShadingPercent = totalRoofPixels > 0
    ? (overallShadedPixels / totalRoofPixels) * 100
    : 0;

  return {
    totalRoofPixels,
    meanRoofFlux: Math.round(meanRoofFlux * 10) / 10,
    facetAnalyses,
    shadeThresholdKwh: shadeThreshold,
    overallShadingPercent: Math.round(overallShadingPercent * 10) / 10,
  };
}

/**
 * Analyze flux for a single facet.
 */
function analyzeSingleFacet(
  facetIndex: number,
  facet: RoofFacetForFlux,
  vertices: LatLng[],
  fluxMap: ParsedFluxMap,
  monthlyFlux: ParsedMonthlyFlux | undefined,
  utmZone: number | undefined,
  shadeThreshold: number,
): FacetFluxAnalysis {
  const { data, width, height, affine, noDataValue } = fluxMap;

  // Convert facet vertices to pixel coordinates
  const facetVertices = facet.vertexIndices
    .map(idx => vertices[idx])
    .filter(Boolean);

  if (facetVertices.length < 3) {
    return emptyFacetFluxAnalysis(facetIndex);
  }

  const facetPixels = facetVertices.map(v => latLngToPixel(v, affine, utmZone));

  // Bounding box in pixel coords
  const cols = facetPixels.map(p => p.col);
  const rows = facetPixels.map(p => p.row);
  const minCol = Math.max(0, Math.min(...cols) - 1);
  const maxCol = Math.min(width - 1, Math.max(...cols) + 1);
  const minRow = Math.max(0, Math.min(...rows) - 1);
  const maxRow = Math.min(height - 1, Math.max(...rows) + 1);

  // Sample flux pixels inside the facet polygon
  const fluxValues: number[] = [];
  const monthlyTotals = new Array(12).fill(0);
  let monthlyCount = 0;
  let shadedCount = 0;

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (!isPointInPolygonPixel(col, row, facetPixels)) continue;

      const idx = row * width + col;
      const val = data[idx];
      if (isNoData(val, noDataValue) || val <= 0) continue;

      fluxValues.push(val);
      if (val < shadeThreshold) shadedCount++;

      // Accumulate monthly flux if available
      if (monthlyFlux) {
        for (let m = 0; m < 12; m++) {
          const monthVal = monthlyFlux.bands[m][idx];
          if (!isNoData(monthVal, monthlyFlux.noDataValue) && monthVal > 0) {
            monthlyTotals[m] += monthVal;
          }
        }
        monthlyCount++;
      }
    }
  }

  if (fluxValues.length === 0) {
    return emptyFacetFluxAnalysis(facetIndex);
  }

  const meanAnnualFlux = fluxValues.reduce((s, v) => s + v, 0) / fluxValues.length;
  const minAnnualFlux = Math.min(...fluxValues);
  const maxAnnualFlux = Math.max(...fluxValues);

  // Flux uniformity: 1 - (stdDev / mean), clamped to [0, 1]
  const variance = fluxValues.reduce((s, v) => s + (v - meanAnnualFlux) ** 2, 0) / fluxValues.length;
  const stdDev = Math.sqrt(variance);
  const fluxUniformity = meanAnnualFlux > 0
    ? Math.max(0, Math.min(1, 1 - stdDev / meanAnnualFlux))
    : 0;

  // Monthly mean flux
  const monthlyMeanFlux = monthlyCount > 0
    ? monthlyTotals.map(t => Math.round((t / monthlyCount) * 10) / 10)
    : new Array(12).fill(0);

  // Best/worst months
  let bestMonth = 0;
  let worstMonth = 0;
  let bestVal = -Infinity;
  let worstVal = Infinity;
  for (let m = 0; m < 12; m++) {
    if (monthlyMeanFlux[m] > bestVal) { bestVal = monthlyMeanFlux[m]; bestMonth = m; }
    if (monthlyMeanFlux[m] < worstVal) { worstVal = monthlyMeanFlux[m]; worstMonth = m; }
  }

  // Seasonal variation: ratio of best to worst month flux
  const seasonalVariation = worstVal > 0 ? bestVal / worstVal : bestVal > 0 ? Infinity : 1;

  const shadedPixelPercent = (shadedCount / fluxValues.length) * 100;

  return {
    facetIndex,
    meanAnnualFlux: Math.round(meanAnnualFlux * 10) / 10,
    minAnnualFlux: Math.round(minAnnualFlux * 10) / 10,
    maxAnnualFlux: Math.round(maxAnnualFlux * 10) / 10,
    fluxUniformity: Math.round(fluxUniformity * 1000) / 1000,
    monthlyMeanFlux,
    shadedPixelPercent: Math.round(shadedPixelPercent * 10) / 10,
    bestMonth,
    worstMonth,
    seasonalVariation: Math.round(seasonalVariation * 100) / 100,
  };
}

function emptyFacetFluxAnalysis(facetIndex: number): FacetFluxAnalysis {
  return {
    facetIndex,
    meanAnnualFlux: 0,
    minAnnualFlux: 0,
    maxAnnualFlux: 0,
    fluxUniformity: 0,
    monthlyMeanFlux: new Array(12).fill(0),
    shadedPixelPercent: 100,
    bestMonth: 0,
    worstMonth: 0,
    seasonalVariation: 1,
  };
}

// ─── Shade Analysis ──────────────────────────────────────────────

/**
 * Analyze shading from flux and monthly flux data.
 * Estimates hourly shading from monthly flux patterns and calculates
 * seasonal variation.
 */
export function analyzeShading(
  fluxMap: ParsedFluxMap,
  monthlyFlux: ParsedMonthlyFlux,
): ShadeAnalysisResult {
  const { data, width, height, noDataValue } = fluxMap;

  // Compute monthly mean flux across all valid roof pixels
  const monthlyTotals = new Array(12).fill(0);
  let validPixelCount = 0;
  const maxFluxValue = findMaxFlux(data, noDataValue);

  for (let i = 0; i < data.length; i++) {
    const val = data[i];
    if (isNoData(val, noDataValue) || val <= 0) continue;
    validPixelCount++;
    for (let m = 0; m < 12; m++) {
      const mVal = monthlyFlux.bands[m][i];
      if (!isNoData(mVal, monthlyFlux.noDataValue) && mVal > 0) {
        monthlyTotals[m] += mVal;
      }
    }
  }

  const monthlyMeans = validPixelCount > 0
    ? monthlyTotals.map(t => t / validPixelCount)
    : new Array(12).fill(0);

  // Estimate hourly shading by distributing monthly flux across daylight hours.
  // This is an approximation: assume ~10 hours of usable daylight per day.
  // Hours with lower sun angles (morning/evening) receive less flux.
  const hourlyShading = new Map<number, number>();
  const daylightHourWeights: Record<number, number> = {
    6: 0.3, 7: 0.5, 8: 0.7, 9: 0.85, 10: 0.95, 11: 1.0,
    12: 1.0, 13: 1.0, 14: 0.95, 15: 0.85, 16: 0.7, 17: 0.5, 18: 0.3,
  };

  const totalWeight = Object.values(daylightHourWeights).reduce((s, w) => s + w, 0);
  const annualMeanFlux = monthlyMeans.reduce((s, v) => s + v, 0) / 12;

  // For each hour, estimate shading as 1 - (hourFluxFraction / maxPossibleFluxFraction)
  for (const [hourStr, weight] of Object.entries(daylightHourWeights)) {
    const hour = Number(hourStr);
    const hourFluxFraction = weight / totalWeight;
    // If annual mean flux is low relative to max, the hour is more shaded
    const hourShadingPercent = maxFluxValue > 0
      ? Math.max(0, (1 - (annualMeanFlux / maxFluxValue)) * 100 * (1.2 - hourFluxFraction))
      : 100;
    hourlyShading.set(hour, Math.round(Math.min(100, hourShadingPercent) * 10) / 10);
  }

  // Seasonal shading: group months by season
  // Summer: Jun-Aug (5,6,7), Winter: Dec-Feb (11,0,1), Spring: Mar-May (2,3,4), Fall: Sep-Nov (8,9,10)
  const seasonMeans = {
    summer: meanOfIndices(monthlyMeans, [5, 6, 7]),
    winter: meanOfIndices(monthlyMeans, [11, 0, 1]),
    spring: meanOfIndices(monthlyMeans, [2, 3, 4]),
    fall: meanOfIndices(monthlyMeans, [8, 9, 10]),
  };

  const maxSeasonFlux = Math.max(seasonMeans.summer, seasonMeans.winter, seasonMeans.spring, seasonMeans.fall);
  const seasonalShading = {
    summer: maxSeasonFlux > 0 ? Math.round((1 - seasonMeans.summer / maxSeasonFlux) * 100 * 10) / 10 : 0,
    winter: maxSeasonFlux > 0 ? Math.round((1 - seasonMeans.winter / maxSeasonFlux) * 100 * 10) / 10 : 0,
    spring: maxSeasonFlux > 0 ? Math.round((1 - seasonMeans.spring / maxSeasonFlux) * 100 * 10) / 10 : 0,
    fall: maxSeasonFlux > 0 ? Math.round((1 - seasonMeans.fall / maxSeasonFlux) * 100 * 10) / 10 : 0,
  };

  // Overall annual shading: percent of valid pixels below shade threshold
  let shadedPixels = 0;
  for (let i = 0; i < data.length; i++) {
    const val = data[i];
    if (isNoData(val, noDataValue) || val <= 0) continue;
    if (val < DEFAULT_SHADE_THRESHOLD_KWH) shadedPixels++;
  }

  const annualShadingPercent = validPixelCount > 0
    ? Math.round((shadedPixels / validPixelCount) * 100 * 10) / 10
    : 0;

  return {
    hourlyShading,
    seasonalShading,
    annualShadingPercent,
  };
}

// ─── Color Mapping ───────────────────────────────────────────────

/**
 * Map a flux value to a color for visualization.
 * Low flux (shaded): dark blue/purple
 * Medium flux: yellow/orange
 * High flux: bright red/white
 */
export function getFluxColorForPixel(flux: number, maxFlux: number): string {
  if (maxFlux <= 0) return 'rgb(30, 20, 60)';

  const ratio = Math.max(0, Math.min(1, flux / maxFlux));

  if (ratio < 0.2) {
    // Dark blue/purple (heavily shaded)
    const t = ratio / 0.2;
    const r = Math.round(30 + t * 30);
    const g = Math.round(20 + t * 10);
    const b = Math.round(60 + t * 80);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (ratio < 0.4) {
    // Blue to cyan
    const t = (ratio - 0.2) / 0.2;
    const r = Math.round(60 - t * 20);
    const g = Math.round(30 + t * 120);
    const b = Math.round(140 + t * 60);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (ratio < 0.6) {
    // Cyan to yellow
    const t = (ratio - 0.4) / 0.2;
    const r = Math.round(40 + t * 215);
    const g = Math.round(150 + t * 80);
    const b = Math.round(200 - t * 180);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (ratio < 0.8) {
    // Yellow to orange/red
    const t = (ratio - 0.6) / 0.2;
    const r = Math.round(255);
    const g = Math.round(230 - t * 130);
    const b = Math.round(20 + t * 10);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Orange/red to white
    const t = (ratio - 0.8) / 0.2;
    const r = 255;
    const g = Math.round(100 + t * 155);
    const b = Math.round(30 + t * 225);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

function isNoData(value: number, noDataValue: number): boolean {
  return value === noDataValue || value <= -9000 || Number.isNaN(value);
}

function findMaxFlux(data: Float32Array, noDataValue: number): number {
  let max = 0;
  for (let i = 0; i < data.length; i++) {
    const val = data[i];
    if (!isNoData(val, noDataValue) && val > max) {
      max = val;
    }
  }
  return max;
}

function meanOfIndices(arr: number[], indices: number[]): number {
  if (indices.length === 0) return 0;
  const sum = indices.reduce((s, idx) => s + (arr[idx] ?? 0), 0);
  return sum / indices.length;
}
