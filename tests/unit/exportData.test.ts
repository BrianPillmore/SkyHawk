/**
 * Unit tests for measurement data export
 * Run with: npx vitest run tests/unit/exportData.test.ts
 */

import { describe, it, expect } from 'vitest';
import { buildExportData } from '../../src/utils/exportData';
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
