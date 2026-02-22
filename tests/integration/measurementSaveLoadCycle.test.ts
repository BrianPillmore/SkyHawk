/**
 * Integration: Save/load/export cycle.
 * No mocks.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../src/store/useStore';
import { resetStore, setupPropertyWithOutline } from '../helpers/store';
import { buildExportData, buildGeoJSON, buildCSV } from '../../src/utils/exportData';

describe('Measurement Save/Load Cycle', () => {
  beforeEach(() => {
    resetStore();
  });

  // ─── Save ─────────────────────────────────────────────────────

  describe('save', () => {
    it('should save measurement to property', () => {
      setupPropertyWithOutline();
      useStore.getState().saveMeasurement();

      const property = useStore.getState().properties.find(p => p.id === useStore.getState().activePropertyId);
      expect(property!.measurements).toHaveLength(1);
    });

    it('should update existing measurement on re-save', () => {
      setupPropertyWithOutline();
      useStore.getState().saveMeasurement();

      // Modify and re-save
      const facetId = useStore.getState().activeMeasurement!.facets[0].id;
      useStore.getState().updateFacetPitch(facetId, 10);
      useStore.getState().saveMeasurement();

      const property = useStore.getState().properties.find(p => p.id === useStore.getState().activePropertyId);
      expect(property!.measurements).toHaveLength(1);
      expect(property!.measurements[0].facets[0].pitch).toBe(10);
    });

    it('should preserve measurement id on update', () => {
      setupPropertyWithOutline();
      const origId = useStore.getState().activeMeasurement!.id;
      useStore.getState().saveMeasurement();

      const facetId = useStore.getState().activeMeasurement!.facets[0].id;
      useStore.getState().updateFacetPitch(facetId, 8);
      useStore.getState().saveMeasurement();

      const property = useStore.getState().properties.find(p => p.id === useStore.getState().activePropertyId);
      expect(property!.measurements[0].id).toBe(origId);
    });
  });

  // ─── Load ─────────────────────────────────────────────────────

  describe('load', () => {
    it('should load measurement as deep clone', () => {
      setupPropertyWithOutline();
      useStore.getState().saveMeasurement();
      const savedId = useStore.getState().activeMeasurement!.id;

      // Start new measurement (clears active)
      useStore.getState().startNewMeasurement();
      expect(useStore.getState().activeMeasurement!.id).not.toBe(savedId);

      // Load the saved one
      useStore.getState().loadMeasurement(savedId);
      expect(useStore.getState().activeMeasurement!.id).toBe(savedId);
    });

    it('should preserve all vertices on load', () => {
      setupPropertyWithOutline();
      const vertexCount = useStore.getState().activeMeasurement!.vertices.length;
      useStore.getState().saveMeasurement();
      const savedId = useStore.getState().activeMeasurement!.id;

      useStore.getState().startNewMeasurement();
      useStore.getState().loadMeasurement(savedId);

      expect(useStore.getState().activeMeasurement!.vertices).toHaveLength(vertexCount);
    });

    it('should preserve all edges on load', () => {
      setupPropertyWithOutline();
      const edgeCount = useStore.getState().activeMeasurement!.edges.length;
      useStore.getState().saveMeasurement();
      const savedId = useStore.getState().activeMeasurement!.id;

      useStore.getState().startNewMeasurement();
      useStore.getState().loadMeasurement(savedId);

      expect(useStore.getState().activeMeasurement!.edges).toHaveLength(edgeCount);
    });

    it('should preserve all facets on load', () => {
      setupPropertyWithOutline();
      const facetCount = useStore.getState().activeMeasurement!.facets.length;
      useStore.getState().saveMeasurement();
      const savedId = useStore.getState().activeMeasurement!.id;

      useStore.getState().startNewMeasurement();
      useStore.getState().loadMeasurement(savedId);

      expect(useStore.getState().activeMeasurement!.facets).toHaveLength(facetCount);
    });

    it('should preserve totals on load', () => {
      setupPropertyWithOutline();
      const totalArea = useStore.getState().activeMeasurement!.totalAreaSqFt;
      useStore.getState().saveMeasurement();
      const savedId = useStore.getState().activeMeasurement!.id;

      useStore.getState().startNewMeasurement();
      useStore.getState().loadMeasurement(savedId);

      expect(useStore.getState().activeMeasurement!.totalAreaSqFt).toBeCloseTo(totalArea, 1);
    });

    it('should reset undo/redo stacks on load', () => {
      setupPropertyWithOutline();
      useStore.getState().saveMeasurement();
      const savedId = useStore.getState().activeMeasurement!.id;

      // Create some undo history
      useStore.getState().addVertex(39.78, -89.65);

      useStore.getState().loadMeasurement(savedId);
      expect(useStore.getState()._undoStack).toHaveLength(0);
      expect(useStore.getState()._redoStack).toHaveLength(0);
    });

    it('should set drawingMode to select on load', () => {
      setupPropertyWithOutline();
      useStore.getState().saveMeasurement();
      const savedId = useStore.getState().activeMeasurement!.id;

      useStore.getState().loadMeasurement(savedId);
      expect(useStore.getState().drawingMode).toBe('select');
    });
  });

  // ─── JSON Export ──────────────────────────────────────────────

  describe('JSON export', () => {
    it('should include measurement fields', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      const data = buildExportData(m);

      expect(data.version).toBe('1.0');
      expect(data.measurement.id).toBe(m.id);
      expect(data.measurement.summary.totalAreaSqFt).toBe(m.totalAreaSqFt);
      expect(data.measurement.summary.totalTrueAreaSqFt).toBe(m.totalTrueAreaSqFt);
      expect(data.measurement.summary.totalSquares).toBe(m.totalSquares);
    });

    it('should include lineMeasurements', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      const data = buildExportData(m);

      expect(data.measurement.lineMeasurements.totalEaveLf).toBe(m.totalEaveLf);
      expect(data.measurement.lineMeasurements.totalRidgeLf).toBe(m.totalRidgeLf);
    });

    it('should include vertices and edges', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      const data = buildExportData(m);

      expect(data.measurement.vertices).toHaveLength(m.vertices.length);
      expect(data.measurement.edges).toHaveLength(m.edges.length);
    });

    it('should include facets', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      const data = buildExportData(m);

      expect(data.measurement.facets).toHaveLength(m.facets.length);
      expect(data.measurement.facets[0].pitch).toBe(m.facets[0].pitch);
    });
  });

  // ─── GeoJSON Export ───────────────────────────────────────────

  describe('GeoJSON export', () => {
    it('should produce a FeatureCollection', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      const geo = buildGeoJSON(m);

      expect(geo.type).toBe('FeatureCollection');
      expect(Array.isArray(geo.features)).toBe(true);
    });

    it('should include LineString features for edges', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      const geo = buildGeoJSON(m);

      const lineStrings = geo.features.filter(f => f.geometry.type === 'LineString');
      expect(lineStrings.length).toBe(m.edges.length);
    });

    it('should include Polygon features for facets', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      const geo = buildGeoJSON(m);

      const polygons = geo.features.filter(f => f.geometry.type === 'Polygon');
      expect(polygons.length).toBe(m.facets.length);
    });

    it('should include Point features for vertices', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      const geo = buildGeoJSON(m);

      const points = geo.features.filter(f => f.geometry.type === 'Point');
      expect(points.length).toBe(m.vertices.length);
    });

    it('should have correct coordinate order (lng, lat)', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      const geo = buildGeoJSON(m);

      const point = geo.features.find(f => f.geometry.type === 'Point');
      const coords = point!.geometry.coordinates as number[];
      const vertex = m.vertices[0];
      expect(coords[0]).toBeCloseTo(vertex.lng, 5);
      expect(coords[1]).toBeCloseTo(vertex.lat, 5);
    });
  });

  // ─── CSV Export ───────────────────────────────────────────────

  describe('CSV export', () => {
    it('should include ROOF MEASUREMENT SUMMARY section', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      const csv = buildCSV(m);

      expect(csv).toContain('ROOF MEASUREMENT SUMMARY');
      expect(csv).toContain('Total True Area');
    });

    it('should include LINE MEASUREMENTS section', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      const csv = buildCSV(m);

      expect(csv).toContain('LINE MEASUREMENTS');
      expect(csv).toContain('Ridges');
      expect(csv).toContain('Eaves');
    });

    it('should include FACET DETAILS section', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      const csv = buildCSV(m);

      expect(csv).toContain('FACET DETAILS');
    });

    it('should include EDGE DETAILS section', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      const csv = buildCSV(m);

      expect(csv).toContain('EDGE DETAILS');
    });

    it('should be valid CSV format', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      const csv = buildCSV(m);
      const lines = csv.split('\n');

      // Should have multiple lines
      expect(lines.length).toBeGreaterThan(10);
      // Comma-separated values
      expect(lines.some(l => l.includes(','))).toBe(true);
    });
  });

  // ─── Delete Saved Measurement ─────────────────────────────────

  describe('delete saved measurement', () => {
    it('should remove from property', () => {
      setupPropertyWithOutline();
      useStore.getState().saveMeasurement();
      const savedId = useStore.getState().activeMeasurement!.id;

      useStore.getState().deleteSavedMeasurement(savedId);
      const property = useStore.getState().properties.find(p => p.id === useStore.getState().activePropertyId);
      expect(property!.measurements).toHaveLength(0);
    });

    it('should clear active if deleted is current', () => {
      setupPropertyWithOutline();
      useStore.getState().saveMeasurement();
      const savedId = useStore.getState().activeMeasurement!.id;

      useStore.getState().deleteSavedMeasurement(savedId);
      expect(useStore.getState().activeMeasurement).toBeNull();
    });
  });
});
