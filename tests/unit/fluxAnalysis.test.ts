/**
 * Unit tests for flux analysis module: parseFluxGeoTiff, parseMonthlyFluxGeoTiff,
 * analyzeFluxForFacets, analyzeShading, getFluxColorForPixel
 * Run with: npx vitest run tests/unit/fluxAnalysis.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeFluxForFacets,
  analyzeShading,
  getFluxColorForPixel,
} from '../../src/utils/fluxAnalysis';
import type { ParsedFluxMap, ParsedMonthlyFlux, GeoTiffAffine } from '../../src/types/solar';
import type { LatLng } from '../../src/types';

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Create a test flux map with geographic (lat/lng) coordinates.
 */
function createTestFluxMap(opts: {
  width: number;
  height: number;
  fluxFn: (col: number, row: number) => number;
  originLat?: number;
  originLng?: number;
  pixelSizeDeg?: number;
  noDataValue?: number;
}): ParsedFluxMap {
  const {
    width,
    height,
    fluxFn,
    originLat = 35.5,
    originLng = -97.5,
    pixelSizeDeg = 0.00001,
    noDataValue = -9999,
  } = opts;

  const data = new Float32Array(width * height);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      data[row * width + col] = fluxFn(col, row);
    }
  }

  const affine: GeoTiffAffine = {
    originX: originLng,
    originY: originLat,
    pixelWidth: pixelSizeDeg,
    pixelHeight: -pixelSizeDeg,
  };

  return { data, width, height, affine, noDataValue };
}

/**
 * Create a test monthly flux with 12 identical bands (scaled by month weight).
 */
function createTestMonthlyFlux(
  fluxMap: ParsedFluxMap,
  monthWeights?: number[],
): ParsedMonthlyFlux {
  const weights = monthWeights ?? [0.5, 0.6, 0.8, 0.9, 1.0, 1.1, 1.2, 1.1, 1.0, 0.8, 0.6, 0.5];
  const bands: Float32Array[] = [];

  for (let m = 0; m < 12; m++) {
    const band = new Float32Array(fluxMap.width * fluxMap.height);
    for (let i = 0; i < fluxMap.data.length; i++) {
      const val = fluxMap.data[i];
      if (val > 0 && val !== fluxMap.noDataValue) {
        band[i] = val * weights[m] / 12; // Monthly fraction of annual
      } else {
        band[i] = val;
      }
    }
    bands.push(band);
  }

  return {
    bands,
    width: fluxMap.width,
    height: fluxMap.height,
    affine: fluxMap.affine,
    noDataValue: fluxMap.noDataValue,
  };
}

/**
 * Build a simple facet + vertices array covering a region of the test grid.
 */
function createTestFacet(opts: {
  originLat?: number;
  originLng?: number;
  pixelSizeDeg?: number;
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}): { facets: { vertexIndices: number[]; pitch: number; name: string }[]; vertices: LatLng[] } {
  const {
    originLat = 35.5,
    originLng = -97.5,
    pixelSizeDeg = 0.00001,
    minCol, maxCol, minRow, maxRow,
  } = opts;

  // 4 corner vertices
  const vertices: LatLng[] = [
    { lat: originLat - minRow * pixelSizeDeg, lng: originLng + minCol * pixelSizeDeg },
    { lat: originLat - minRow * pixelSizeDeg, lng: originLng + maxCol * pixelSizeDeg },
    { lat: originLat - maxRow * pixelSizeDeg, lng: originLng + maxCol * pixelSizeDeg },
    { lat: originLat - maxRow * pixelSizeDeg, lng: originLng + minCol * pixelSizeDeg },
  ];

  const facets = [{ vertexIndices: [0, 1, 2, 3], pitch: 6, name: '#1 Front' }];

  return { facets, vertices };
}

// ─── analyzeFluxForFacets tests ──────────────────────────────────

describe('analyzeFluxForFacets', () => {
  it('should compute mean flux for a uniform flux map', () => {
    const fluxMap = createTestFluxMap({
      width: 100,
      height: 100,
      fluxFn: () => 1000,
    });

    const { facets, vertices } = createTestFacet({
      minCol: 20, maxCol: 80, minRow: 20, maxRow: 80,
    });

    const bounds = {
      sw: { lat: 35.5 - 80 * 0.00001, lng: -97.5 + 20 * 0.00001 },
      ne: { lat: 35.5 - 20 * 0.00001, lng: -97.5 + 80 * 0.00001 },
    };

    const result = analyzeFluxForFacets(fluxMap, facets, vertices, bounds);

    expect(result.totalRoofPixels).toBeGreaterThan(0);
    expect(result.meanRoofFlux).toBeCloseTo(1000, 0);
    expect(result.facetAnalyses).toHaveLength(1);
    expect(result.facetAnalyses[0].meanAnnualFlux).toBeCloseTo(1000, 0);
    expect(result.facetAnalyses[0].fluxUniformity).toBeCloseTo(1, 1);
    expect(result.facetAnalyses[0].shadedPixelPercent).toBe(0);
  });

  it('should detect shaded pixels below threshold', () => {
    const fluxMap = createTestFluxMap({
      width: 100,
      height: 100,
      fluxFn: (col) => col < 50 ? 200 : 1000, // Left half is shaded (below 400)
    });

    const { facets, vertices } = createTestFacet({
      minCol: 10, maxCol: 90, minRow: 10, maxRow: 90,
    });

    const bounds = {
      sw: { lat: 35.5 - 90 * 0.00001, lng: -97.5 + 10 * 0.00001 },
      ne: { lat: 35.5 - 10 * 0.00001, lng: -97.5 + 90 * 0.00001 },
    };

    const result = analyzeFluxForFacets(fluxMap, facets, vertices, bounds, undefined, 400);

    expect(result.overallShadingPercent).toBeGreaterThan(20);
    expect(result.facetAnalyses[0].shadedPixelPercent).toBeGreaterThan(20);
    expect(result.facetAnalyses[0].minAnnualFlux).toBeCloseTo(200, 0);
    expect(result.facetAnalyses[0].maxAnnualFlux).toBeCloseTo(1000, 0);
  });

  it('should calculate flux uniformity correctly for variable flux', () => {
    // High variation: half at 200, half at 1000
    const fluxMap = createTestFluxMap({
      width: 100,
      height: 100,
      fluxFn: (col) => col < 50 ? 200 : 1000,
    });

    const { facets, vertices } = createTestFacet({
      minCol: 10, maxCol: 90, minRow: 10, maxRow: 90,
    });

    const bounds = {
      sw: { lat: 35.5 - 90 * 0.00001, lng: -97.5 + 10 * 0.00001 },
      ne: { lat: 35.5 - 10 * 0.00001, lng: -97.5 + 90 * 0.00001 },
    };

    const result = analyzeFluxForFacets(fluxMap, facets, vertices, bounds);

    // High variation = low uniformity
    expect(result.facetAnalyses[0].fluxUniformity).toBeLessThan(0.6);
  });

  it('should handle monthly flux data for best/worst month', () => {
    const fluxMap = createTestFluxMap({
      width: 50,
      height: 50,
      fluxFn: () => 800,
    });

    // Summer months weighted highest, winter lowest
    const monthlyFlux = createTestMonthlyFlux(fluxMap, [
      0.4, 0.5, 0.7, 0.9, 1.0, 1.2, 1.3, 1.2, 1.0, 0.8, 0.5, 0.4,
    ]);

    const { facets, vertices } = createTestFacet({
      minCol: 5, maxCol: 45, minRow: 5, maxRow: 45,
    });

    const bounds = {
      sw: { lat: 35.5 - 45 * 0.00001, lng: -97.5 + 5 * 0.00001 },
      ne: { lat: 35.5 - 5 * 0.00001, lng: -97.5 + 45 * 0.00001 },
    };

    const result = analyzeFluxForFacets(fluxMap, facets, vertices, bounds, monthlyFlux);

    const fa = result.facetAnalyses[0];
    // Best month should be June (index 6, weight 1.3)
    expect(fa.bestMonth).toBe(6);
    // Worst month should be January (index 0) or December (index 11) - both 0.4
    expect([0, 11]).toContain(fa.worstMonth);
    // Seasonal variation should be > 1
    expect(fa.seasonalVariation).toBeGreaterThan(1);
  });

  it('should handle no-data pixels gracefully', () => {
    const fluxMap = createTestFluxMap({
      width: 50,
      height: 50,
      fluxFn: () => -9999, // All nodata
    });

    const { facets, vertices } = createTestFacet({
      minCol: 5, maxCol: 45, minRow: 5, maxRow: 45,
    });

    const bounds = {
      sw: { lat: 35.5 - 45 * 0.00001, lng: -97.5 + 5 * 0.00001 },
      ne: { lat: 35.5 - 5 * 0.00001, lng: -97.5 + 45 * 0.00001 },
    };

    const result = analyzeFluxForFacets(fluxMap, facets, vertices, bounds);

    expect(result.totalRoofPixels).toBe(0);
    expect(result.meanRoofFlux).toBe(0);
    expect(result.facetAnalyses[0].meanAnnualFlux).toBe(0);
  });

  it('should handle empty facet (less than 3 vertices)', () => {
    const fluxMap = createTestFluxMap({
      width: 50,
      height: 50,
      fluxFn: () => 800,
    });

    // Facet with only 2 vertex indices (invalid polygon)
    const vertices: LatLng[] = [
      { lat: 35.4999, lng: -97.4999 },
      { lat: 35.4998, lng: -97.4998 },
    ];
    const facets = [{ vertexIndices: [0, 1], pitch: 6, name: '#1 Bad' }];

    const bounds = {
      sw: { lat: 35.4995, lng: -97.5005 },
      ne: { lat: 35.5005, lng: -97.4995 },
    };

    const result = analyzeFluxForFacets(fluxMap, facets, vertices, bounds);

    expect(result.facetAnalyses[0].meanAnnualFlux).toBe(0);
    expect(result.facetAnalyses[0].shadedPixelPercent).toBe(100);
  });

  it('should analyze multiple facets independently', () => {
    const fluxMap = createTestFluxMap({
      width: 100,
      height: 100,
      fluxFn: (col) => col < 50 ? 500 : 1200,
    });

    const vertices: LatLng[] = [
      // Facet 1: left side (low flux)
      { lat: 35.5 - 20 * 0.00001, lng: -97.5 + 10 * 0.00001 },
      { lat: 35.5 - 20 * 0.00001, lng: -97.5 + 40 * 0.00001 },
      { lat: 35.5 - 80 * 0.00001, lng: -97.5 + 40 * 0.00001 },
      { lat: 35.5 - 80 * 0.00001, lng: -97.5 + 10 * 0.00001 },
      // Facet 2: right side (high flux)
      { lat: 35.5 - 20 * 0.00001, lng: -97.5 + 60 * 0.00001 },
      { lat: 35.5 - 20 * 0.00001, lng: -97.5 + 90 * 0.00001 },
      { lat: 35.5 - 80 * 0.00001, lng: -97.5 + 90 * 0.00001 },
      { lat: 35.5 - 80 * 0.00001, lng: -97.5 + 60 * 0.00001 },
    ];

    const facets = [
      { vertexIndices: [0, 1, 2, 3], pitch: 6, name: '#1 Left' },
      { vertexIndices: [4, 5, 6, 7], pitch: 4, name: '#2 Right' },
    ];

    const bounds = {
      sw: { lat: 35.5 - 80 * 0.00001, lng: -97.5 + 10 * 0.00001 },
      ne: { lat: 35.5 - 20 * 0.00001, lng: -97.5 + 90 * 0.00001 },
    };

    const result = analyzeFluxForFacets(fluxMap, facets, vertices, bounds);

    expect(result.facetAnalyses).toHaveLength(2);
    // Left facet should have lower flux
    expect(result.facetAnalyses[0].meanAnnualFlux).toBeLessThan(result.facetAnalyses[1].meanAnnualFlux);
  });
});

// ─── analyzeShading tests ────────────────────────────────────────

describe('analyzeShading', () => {
  it('should compute seasonal shading from monthly flux', () => {
    const fluxMap = createTestFluxMap({
      width: 50,
      height: 50,
      fluxFn: () => 800,
    });

    const monthlyFlux = createTestMonthlyFlux(fluxMap, [
      0.4, 0.5, 0.7, 0.9, 1.0, 1.2, 1.3, 1.2, 1.0, 0.8, 0.5, 0.4,
    ]);

    const result = analyzeShading(fluxMap, monthlyFlux);

    // Summer should have minimal relative shading
    expect(result.seasonalShading.summer).toBeLessThan(result.seasonalShading.winter);
    // Annual shading should be 0 since all pixels are above default threshold (400)
    expect(result.annualShadingPercent).toBe(0);
  });

  it('should detect high annual shading when flux is low', () => {
    const fluxMap = createTestFluxMap({
      width: 50,
      height: 50,
      fluxFn: () => 200, // All below shade threshold of 400
    });

    const monthlyFlux = createTestMonthlyFlux(fluxMap);

    const result = analyzeShading(fluxMap, monthlyFlux);

    expect(result.annualShadingPercent).toBe(100);
  });

  it('should have hourly shading map with daylight hours', () => {
    const fluxMap = createTestFluxMap({
      width: 50,
      height: 50,
      fluxFn: () => 800,
    });

    const monthlyFlux = createTestMonthlyFlux(fluxMap);

    const result = analyzeShading(fluxMap, monthlyFlux);

    // Should have entries for hours 6-18
    expect(result.hourlyShading.size).toBeGreaterThan(0);
    expect(result.hourlyShading.has(12)).toBe(true);
    expect(result.hourlyShading.has(6)).toBe(true);
  });

  it('should handle all-nodata flux map', () => {
    const fluxMap = createTestFluxMap({
      width: 20,
      height: 20,
      fluxFn: () => -9999,
    });

    const monthlyFlux = createTestMonthlyFlux(fluxMap);

    const result = analyzeShading(fluxMap, monthlyFlux);

    expect(result.annualShadingPercent).toBe(0); // 0 valid pixels = 0%
  });
});

// ─── getFluxColorForPixel tests ──────────────────────────────────

describe('getFluxColorForPixel', () => {
  it('should return dark color for zero flux', () => {
    const color = getFluxColorForPixel(0, 1000);
    expect(color).toMatch(/^rgb\(/);
    // First component should be low (dark)
    const [r] = parseRgb(color);
    expect(r).toBeLessThan(50);
  });

  it('should return bright color for max flux', () => {
    const color = getFluxColorForPixel(1000, 1000);
    expect(color).toMatch(/^rgb\(/);
    // Should be bright
    const [r, g, b] = parseRgb(color);
    expect(r).toBeGreaterThan(200);
    expect(g + b).toBeGreaterThan(200);
  });

  it('should return mid-range color for half flux', () => {
    const color = getFluxColorForPixel(500, 1000);
    expect(color).toMatch(/^rgb\(/);
  });

  it('should handle maxFlux = 0', () => {
    const color = getFluxColorForPixel(500, 0);
    expect(color).toMatch(/^rgb\(/);
  });

  it('should handle negative flux (clamped to 0)', () => {
    const color = getFluxColorForPixel(-100, 1000);
    expect(color).toMatch(/^rgb\(/);
    const [r] = parseRgb(color);
    expect(r).toBeLessThan(50);
  });

  it('should produce different colors for different flux levels', () => {
    const low = getFluxColorForPixel(100, 1000);
    const mid = getFluxColorForPixel(500, 1000);
    const high = getFluxColorForPixel(900, 1000);

    expect(low).not.toBe(mid);
    expect(mid).not.toBe(high);
    expect(low).not.toBe(high);
  });

  it('should clamp flux above maxFlux to 1.0', () => {
    const atMax = getFluxColorForPixel(1000, 1000);
    const aboveMax = getFluxColorForPixel(1500, 1000);
    expect(atMax).toBe(aboveMax);
  });
});

// ─── Helper to parse rgb() strings ──────────────────────────────

function parseRgb(color: string): [number, number, number] {
  const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return [0, 0, 0];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
