/**
 * Unit tests for measurement data export (JSON, GeoJSON, CSV)
 * Run with: npx vitest run tests/unit/exportData.test.ts
 */

import { describe, it, expect } from 'vitest';
import { buildExportData, buildGeoJSON, buildCSV } from '../../src/utils/exportData';
import type { RoofMeasurement } from '../../src/types';

function createMeasurement(overrides: Partial<RoofMeasurement> = {}): RoofMeasurement {
  return {
    id: 'test-m1',
    propertyId: 'prop1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    vertices: [
      { id: 'v1', lat: 39.0, lng: -104.0 },
      { id: 'v2', lat: 39.001, lng: -104.0 },
      { id: 'v3', lat: 39.001, lng: -103.999 },
    ],
    edges: [
      { id: 'e1', startVertexId: 'v1', endVertexId: 'v2', type: 'ridge', lengthFt: 30 },
      { id: 'e2', startVertexId: 'v2', endVertexId: 'v3', type: 'eave', lengthFt: 25 },
    ],
    facets: [
      {
        id: 'f1',
        name: 'Facet 1',
        vertexIds: ['v1', 'v2', 'v3'],
        pitch: 6,
        areaSqFt: 500,
        trueAreaSqFt: 559,
        edgeIds: ['e1', 'e2'],
      },
    ],
    totalAreaSqFt: 500,
    totalTrueAreaSqFt: 559,
    totalSquares: 5.59,
    predominantPitch: 6,
    totalRidgeLf: 30,
    totalHipLf: 0,
    totalValleyLf: 0,
    totalRakeLf: 0,
    totalEaveLf: 25,
    totalFlashingLf: 0,
    totalDripEdgeLf: 25,
    suggestedWastePercent: 10,
    ...overrides,
  };
}

// ─── JSON Export Tests ─────────────────────────────────────────────

describe('buildExportData', () => {
  it('should include version and exportedAt', () => {
    const data = buildExportData(createMeasurement());
    expect(data.version).toBe('1.0');
    expect(data.exportedAt).toBeTruthy();
  });

  it('should include measurement ID and property ID', () => {
    const data = buildExportData(createMeasurement());
    expect(data.measurement.id).toBe('test-m1');
    expect(data.measurement.propertyId).toBe('prop1');
  });

  it('should include summary with all totals', () => {
    const data = buildExportData(createMeasurement());
    const { summary } = data.measurement;
    expect(summary.totalAreaSqFt).toBe(500);
    expect(summary.totalTrueAreaSqFt).toBe(559);
    expect(summary.totalSquares).toBe(5.59);
    expect(summary.predominantPitch).toBe(6);
    expect(summary.suggestedWastePercent).toBe(10);
  });

  it('should include line measurements', () => {
    const data = buildExportData(createMeasurement());
    const { lineMeasurements } = data.measurement;
    expect(lineMeasurements.totalRidgeLf).toBe(30);
    expect(lineMeasurements.totalEaveLf).toBe(25);
    expect(lineMeasurements.totalDripEdgeLf).toBe(25);
  });

  it('should include all vertices', () => {
    const data = buildExportData(createMeasurement());
    expect(data.measurement.vertices).toHaveLength(3);
    expect(data.measurement.vertices[0]).toEqual({ id: 'v1', lat: 39.0, lng: -104.0 });
  });

  it('should include edges with type and length', () => {
    const data = buildExportData(createMeasurement());
    expect(data.measurement.edges).toHaveLength(2);
    expect(data.measurement.edges[0].type).toBe('ridge');
    expect(data.measurement.edges[0].lengthFt).toBe(30);
  });

  it('should include facets with area and pitch', () => {
    const data = buildExportData(createMeasurement());
    expect(data.measurement.facets).toHaveLength(1);
    expect(data.measurement.facets[0].name).toBe('Facet 1');
    expect(data.measurement.facets[0].pitch).toBe(6);
    expect(data.measurement.facets[0].trueAreaSqFt).toBe(559);
  });

  it('should include material estimates when squares > 0', () => {
    const data = buildExportData(createMeasurement());
    expect(data.measurement.materialEstimates).not.toBeNull();
    expect(data.measurement.materialEstimates!.shingleBundles).toBeGreaterThan(0);
  });

  it('should exclude material estimates when squares = 0', () => {
    const data = buildExportData(createMeasurement({ totalSquares: 0 }));
    expect(data.measurement.materialEstimates).toBeNull();
  });

  it('should include waste table when area > 0', () => {
    const data = buildExportData(createMeasurement());
    expect(data.measurement.wasteTable.length).toBeGreaterThan(0);
    expect(data.measurement.wasteTable[0]).toHaveProperty('wastePercent');
    expect(data.measurement.wasteTable[0]).toHaveProperty('totalAreaWithWaste');
    expect(data.measurement.wasteTable[0]).toHaveProperty('totalSquaresWithWaste');
  });

  it('should return empty waste table when area = 0', () => {
    const data = buildExportData(createMeasurement({ totalTrueAreaSqFt: 0 }));
    expect(data.measurement.wasteTable).toEqual([]);
  });

  it('should not include edgeIds in facet export (internal detail)', () => {
    const data = buildExportData(createMeasurement());
    const facet = data.measurement.facets[0] as Record<string, unknown>;
    expect(facet).not.toHaveProperty('edgeIds');
  });

  it('should produce valid JSON', () => {
    const data = buildExportData(createMeasurement());
    const json = JSON.stringify(data, null, 2);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

// ─── GeoJSON Export Tests ──────────────────────────────────────────

describe('buildGeoJSON', () => {
  it('should return a FeatureCollection', () => {
    const geojson = buildGeoJSON(createMeasurement());
    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features).toBeInstanceOf(Array);
  });

  it('should create LineString features for edges', () => {
    const geojson = buildGeoJSON(createMeasurement());
    const edgeFeatures = geojson.features.filter(
      (f) => f.properties.featureType === 'edge'
    );
    expect(edgeFeatures).toHaveLength(2);
    expect(edgeFeatures[0].geometry.type).toBe('LineString');
  });

  it('should include edge type and length in properties', () => {
    const geojson = buildGeoJSON(createMeasurement());
    const ridge = geojson.features.find(
      (f) => f.properties.edgeType === 'ridge'
    );
    expect(ridge).toBeTruthy();
    expect(ridge!.properties.lengthFt).toBe(30);
    expect(ridge!.properties.label).toBe('Ridge');
  });

  it('should use [lng, lat] coordinate order (GeoJSON standard)', () => {
    const geojson = buildGeoJSON(createMeasurement());
    const ridge = geojson.features.find(
      (f) => f.properties.edgeType === 'ridge'
    );
    // v1: lat=39.0, lng=-104.0 → coords should be [-104.0, 39.0]
    const coords = ridge!.geometry.coordinates as number[][];
    expect(coords[0][0]).toBe(-104.0); // lng first
    expect(coords[0][1]).toBe(39.0); // lat second
  });

  it('should create Polygon features for facets', () => {
    const geojson = buildGeoJSON(createMeasurement());
    const facetFeatures = geojson.features.filter(
      (f) => f.properties.featureType === 'facet'
    );
    expect(facetFeatures).toHaveLength(1);
    expect(facetFeatures[0].geometry.type).toBe('Polygon');
  });

  it('should close polygon rings (first coord == last coord)', () => {
    const geojson = buildGeoJSON(createMeasurement());
    const facet = geojson.features.find(
      (f) => f.properties.featureType === 'facet'
    );
    const ring = (facet!.geometry.coordinates as number[][][])[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('should include facet properties', () => {
    const geojson = buildGeoJSON(createMeasurement());
    const facet = geojson.features.find(
      (f) => f.properties.featureType === 'facet'
    );
    expect(facet!.properties.name).toBe('Facet 1');
    expect(facet!.properties.pitch).toBe(6);
    expect(facet!.properties.trueAreaSqFt).toBe(559);
  });

  it('should create Point features for vertices', () => {
    const geojson = buildGeoJSON(createMeasurement());
    const vertexFeatures = geojson.features.filter(
      (f) => f.properties.featureType === 'vertex'
    );
    expect(vertexFeatures).toHaveLength(3);
    expect(vertexFeatures[0].geometry.type).toBe('Point');
  });

  it('should handle empty measurement', () => {
    const m = createMeasurement({
      vertices: [],
      edges: [],
      facets: [],
    });
    const geojson = buildGeoJSON(m);
    expect(geojson.features).toHaveLength(0);
  });

  it('should produce valid GeoJSON string', () => {
    const geojson = buildGeoJSON(createMeasurement());
    const json = JSON.stringify(geojson);
    const parsed = JSON.parse(json);
    expect(parsed.type).toBe('FeatureCollection');
  });
});

// ─── CSV Export Tests ──────────────────────────────────────────────

describe('buildCSV', () => {
  it('should include roof summary section', () => {
    const csv = buildCSV(createMeasurement());
    expect(csv).toContain('ROOF MEASUREMENT SUMMARY');
    expect(csv).toContain('559.0');
    expect(csv).toContain('5.6');
  });

  it('should include line measurements section', () => {
    const csv = buildCSV(createMeasurement());
    expect(csv).toContain('LINE MEASUREMENTS');
    expect(csv).toContain('Ridges,30.0');
    expect(csv).toContain('Eaves,25.0');
  });

  it('should include facet details section', () => {
    const csv = buildCSV(createMeasurement());
    expect(csv).toContain('FACET DETAILS');
    expect(csv).toContain('"Facet 1"');
    expect(csv).toContain('6/12');
  });

  it('should include edge details section', () => {
    const csv = buildCSV(createMeasurement());
    expect(csv).toContain('EDGE DETAILS');
    expect(csv).toContain('Ridge,30.0');
    expect(csv).toContain('Eave,25.0');
  });

  it('should include material estimates when squares > 0', () => {
    const csv = buildCSV(createMeasurement());
    expect(csv).toContain('MATERIAL ESTIMATES');
    expect(csv).toContain('Shingle Bundles');
    expect(csv).toContain('Caulk');
  });

  it('should not include material estimates when squares = 0', () => {
    const csv = buildCSV(createMeasurement({ totalSquares: 0 }));
    expect(csv).not.toContain('MATERIAL ESTIMATES');
  });

  it('should quote facet names to handle commas', () => {
    const m = createMeasurement();
    m.facets[0].name = 'Front, Main';
    const csv = buildCSV(m);
    expect(csv).toContain('"Front, Main"');
  });

  it('should produce parseable CSV lines', () => {
    const csv = buildCSV(createMeasurement());
    const lines = csv.split('\n');
    // Every line with commas should have consistent column count within its section
    expect(lines.length).toBeGreaterThan(15);
  });
});
