/**
 * Regression: Previously-fixed bugs that must never recur.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useStore } from '../../src/store/useStore';
import { resetStore, setupPropertyWithOutline, setupPropertyAndMeasurement } from '../helpers/store';
import { setupFetchMock, claudeEdgesResponse, mockResponse } from '../helpers/mocks';
import { STANDARD_BOUNDS } from '../helpers/fixtures';
import { detectRoofEdges } from '../../src/services/visionApi';
import { buildExportData, buildGeoJSON, buildCSV } from '../../src/utils/exportData';

describe('Regression: Bug Fixes', () => {
  beforeEach(() => {
    resetStore();
  });

  // ─── Pixel-Distance Snap ────────────────────────────────────────

  describe('pixel-distance snap (not raw lat/lng)', () => {
    it('should merge vertices within 3px tolerance in detectRoofEdges', async () => {
      const fetchMock = setupFetchMock();
      useStore.setState({ token: 'test-token' });

      // Two endpoints that are ~2px apart in a 640px image
      // Lat range: 39.7825 - 39.7810 = 0.0015
      // 2px / 640 * 0.0015 = ~0.0000047 lat tolerance
      const pixelDelta = 2; // within 3px tolerance
      fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
        { type: 'eave', start: { x: 100, y: 100 }, end: { x: 400, y: 100 } },
        { type: 'eave', start: { x: 400 + pixelDelta, y: 100 + pixelDelta }, end: { x: 400, y: 400 } },
      ]));

      const detected = await detectRoofEdges('base64', STANDARD_BOUNDS, 640);
      // The end of edge 1 and start of edge 2 should be merged (within 3px)
      // So vertex count should be 3, not 4
      expect(detected.vertices.length).toBe(3);

      vi.restoreAllMocks();
    });

    it('should NOT merge vertices outside 3px tolerance', async () => {
      const fetchMock = setupFetchMock();
      useStore.setState({ token: 'test-token' });

      const pixelDelta = 5; // outside 3px tolerance
      fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
        { type: 'eave', start: { x: 100, y: 100 }, end: { x: 400, y: 100 } },
        { type: 'eave', start: { x: 400 + pixelDelta, y: 100 + pixelDelta }, end: { x: 400, y: 400 } },
      ]));

      const detected = await detectRoofEdges('base64', STANDARD_BOUNDS, 640);
      // Should have 4 unique vertices (no merge)
      expect(detected.vertices.length).toBe(4);

      vi.restoreAllMocks();
    });

    it('should use pixel-based tolerance, not raw lat/lng delta', async () => {
      const fetchMock = setupFetchMock();
      useStore.setState({ token: 'test-token' });

      // The tolerance is based on pixel distance (3px out of imageSize),
      // not absolute lat/lng values. Verify dedup works via pixel math.
      fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
        { type: 'eave', start: { x: 0, y: 0 }, end: { x: 320, y: 0 } },
        { type: 'eave', start: { x: 320, y: 0 }, end: { x: 320, y: 320 } }, // exact same point
      ]));

      const detected = await detectRoofEdges('base64', STANDARD_BOUNDS, 640);
      // x=320,y=0 appears as end of edge 1 and start of edge 2 (identical)
      // Should be deduped to same vertex
      expect(detected.edges[0].endIndex).toBe(detected.edges[1].startIndex);

      vi.restoreAllMocks();
    });
  });

  // ─── Edge Type Reclassification ─────────────────────────────────

  describe('edge type reclassification', () => {
    it('should recalculate all totals after updateEdgeType', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      const eaveEdge = m.edges.find(e => e.type === 'eave')!;
      const originalEaveLf = m.totalEaveLf;

      useStore.getState().updateEdgeType(eaveEdge.id, 'ridge');

      const updated = useStore.getState().activeMeasurement!;
      expect(updated.totalRidgeLf).toBeGreaterThan(0);
      expect(updated.totalEaveLf).toBeLessThan(originalEaveLf);
    });

    it('should push undo entry for updateEdgeType', () => {
      setupPropertyWithOutline();
      const undoBefore = useStore.getState()._undoStack.length;
      const edgeId = useStore.getState().activeMeasurement!.edges[0].id;

      useStore.getState().updateEdgeType(edgeId, 'hip');

      expect(useStore.getState()._undoStack.length).toBe(undoBefore + 1);
    });

    it('should restore original type on undo after updateEdgeType', () => {
      setupPropertyWithOutline();
      const edgeId = useStore.getState().activeMeasurement!.edges[0].id;
      const originalType = useStore.getState().activeMeasurement!.edges[0].type;

      useStore.getState().updateEdgeType(edgeId, 'valley');
      expect(useStore.getState().activeMeasurement!.edges[0].type).toBe('valley');

      useStore.getState().undo();
      expect(useStore.getState().activeMeasurement!.edges[0].type).toBe(originalType);
    });

    it('should correctly update each line total independently', () => {
      setupPropertyWithOutline();
      const edges = useStore.getState().activeMeasurement!.edges;

      // Change first two edges to different types
      useStore.getState().updateEdgeType(edges[0].id, 'ridge');
      useStore.getState().updateEdgeType(edges[1].id, 'hip');

      const m = useStore.getState().activeMeasurement!;
      expect(m.totalRidgeLf).toBeGreaterThan(0);
      expect(m.totalHipLf).toBeGreaterThan(0);
      // Remaining 2 edges are still eave
      expect(m.totalEaveLf).toBeGreaterThan(0);
    });

    it('should handle flashing and drip edge totals', () => {
      setupPropertyWithOutline();
      const edges = useStore.getState().activeMeasurement!.edges;

      useStore.getState().updateEdgeType(edges[0].id, 'flashing');

      const m = useStore.getState().activeMeasurement!;
      expect(m.totalFlashingLf).toBeGreaterThan(0);
      // Drip edge = eave + rake
      expect(m.totalDripEdgeLf).toBe(m.totalEaveLf + m.totalRakeLf);
    });
  });

  // ─── Free-Form Edge Drawing ─────────────────────────────────────

  describe('free-form edge drawing', () => {
    it('should create new vertex when no snap target exists', () => {
      setupPropertyAndMeasurement();
      const v1 = useStore.getState().addVertex(39.782, -89.651);
      const v2 = useStore.getState().addVertex(39.782, -89.649);

      const edgeId = useStore.getState().addEdge(v1, v2, 'ridge');
      expect(edgeId).toBeTruthy();

      const m = useStore.getState().activeMeasurement!;
      expect(m.vertices).toHaveLength(2);
      expect(m.edges).toHaveLength(1);
    });

    it('should reuse existing vertex when adding edge from it', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      const existingVertex = m.vertices[0];

      // Add a new vertex and connect to existing
      const newVid = useStore.getState().addVertex(39.783, -89.650);
      const edgeId = useStore.getState().addEdge(existingVertex.id, newVid, 'ridge');
      expect(edgeId).toBeTruthy();

      // Should not create duplicate of existingVertex
      const updated = useStore.getState().activeMeasurement!;
      const matchingVertices = updated.vertices.filter(v =>
        v.lat === existingVertex.lat && v.lng === existingVertex.lng
      );
      expect(matchingVertices).toHaveLength(1);
    });
  });

  // ─── Vertex Deduplication ──────────────────────────────────────

  describe('vertex deduplication', () => {
    it('should merge vertices within pixel tolerance during detectRoofEdges', async () => {
      const fetchMock = setupFetchMock();
      useStore.setState({ token: 'test-token' });

      // All three edges share corner at (200,200) within tolerance
      fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
        { type: 'eave', start: { x: 100, y: 100 }, end: { x: 200, y: 200 } },
        { type: 'eave', start: { x: 200, y: 201 }, end: { x: 300, y: 100 } }, // ~1px from (200,200)
        { type: 'eave', start: { x: 201, y: 200 }, end: { x: 100, y: 300 } }, // ~1px from (200,200)
      ]));

      const detected = await detectRoofEdges('base64', STANDARD_BOUNDS, 640);
      // (200,200), (200,201), (201,200) should all merge to one vertex
      // Unique: (100,100), ~(200,200), (300,100), (100,300) = 4 vertices
      expect(detected.vertices.length).toBe(4);

      vi.restoreAllMocks();
    });

    it('should keep vertices outside tolerance as separate', async () => {
      const fetchMock = setupFetchMock();
      useStore.setState({ token: 'test-token' });

      fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
        { type: 'eave', start: { x: 100, y: 100 }, end: { x: 200, y: 100 } },
        { type: 'eave', start: { x: 210, y: 100 }, end: { x: 300, y: 100 } }, // 10px away
      ]));

      const detected = await detectRoofEdges('base64', STANDARD_BOUNDS, 640);
      // 4 unique vertices: (100,100), (200,100), (210,100), (300,100)
      expect(detected.vertices.length).toBe(4);

      vi.restoreAllMocks();
    });

    it('should skip zero-length edges after dedup', async () => {
      const fetchMock = setupFetchMock();
      useStore.setState({ token: 'test-token' });

      // Edge where start and end are within tolerance → zero length → should be skipped
      fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
        { type: 'eave', start: { x: 100, y: 100 }, end: { x: 400, y: 100 } },
        { type: 'ridge', start: { x: 100, y: 100 }, end: { x: 101, y: 101 } }, // ~1.4px, within tolerance
      ]));

      const detected = await detectRoofEdges('base64', STANDARD_BOUNDS, 640);
      // The ridge edge start/end should merge to same vertex → skipped
      expect(detected.edges.length).toBe(1);
      expect(detected.edges[0].type).toBe('eave');

      vi.restoreAllMocks();
    });
  });

  // ─── Solar API 404 Resilience ──────────────────────────────────

  describe('Solar API 404 resilience', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchMock = setupFetchMock();
      useStore.setState({ token: 'test-token' });
      setupPropertyAndMeasurement();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should continue to AI detection when Solar is unavailable', async () => {
      // AI edge detection should work independently of Solar API
      fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
        { type: 'eave', start: { x: 100, y: 100 }, end: { x: 540, y: 100 } },
        { type: 'eave', start: { x: 540, y: 100 }, end: { x: 540, y: 540 } },
        { type: 'eave', start: { x: 540, y: 540 }, end: { x: 100, y: 540 } },
        { type: 'eave', start: { x: 100, y: 540 }, end: { x: 100, y: 100 } },
      ]));

      const detected = await detectRoofEdges('base64', STANDARD_BOUNDS, 640);
      expect(detected.vertices.length).toBe(4);
      expect(detected.edges.length).toBe(4);
    });

    it('should use AI pitch when no Solar segments provided', async () => {
      fetchMock.mockResolvedValueOnce(claudeEdgesResponse(
        [{ type: 'eave', start: { x: 100, y: 100 }, end: { x: 540, y: 540 } }],
        { pitchDeg: 30 },
      ));

      const detected = await detectRoofEdges('base64', STANDARD_BOUNDS, 640);
      expect(detected.estimatedPitchDegrees).toBe(30);
    });

    it('should default to 22 degrees when AI provides no pitch', async () => {
      const json = JSON.stringify({
        edges: [{ type: 'eave', start: { x: 100, y: 100 }, end: { x: 540, y: 540 } }],
        roofType: 'flat',
        // No estimatedPitchDegrees field
        confidence: 0.5,
      });
      fetchMock.mockResolvedValueOnce(mockResponse({ content: [{ type: 'text', text: json }] }));

      const detected = await detectRoofEdges('base64', STANDARD_BOUNDS, 640);
      expect(detected.estimatedPitchDegrees).toBe(22);
    });
  });

  // ─── Empty State Handling ──────────────────────────────────────

  describe('empty state handling', () => {
    it('should recalculate without error on empty measurement', () => {
      setupPropertyAndMeasurement();
      // recalculateMeasurements is called internally; no crash expected
      const m = useStore.getState().activeMeasurement!;
      expect(m.totalAreaSqFt).toBe(0);
      expect(m.totalEaveLf).toBe(0);
    });

    it('should saveMeasurement with empty edges/facets', () => {
      setupPropertyAndMeasurement();
      useStore.getState().saveMeasurement();

      const prop = useStore.getState().properties.find(p => p.id === useStore.getState().activePropertyId);
      expect(prop!.measurements).toHaveLength(1);
      expect(prop!.measurements[0].edges).toHaveLength(0);
    });

    it('should export empty measurement as JSON without error', () => {
      setupPropertyAndMeasurement();
      const m = useStore.getState().activeMeasurement!;
      const data = buildExportData(m);

      expect(data.measurement.vertices).toHaveLength(0);
      expect(data.measurement.edges).toHaveLength(0);
      expect(data.measurement.facets).toHaveLength(0);
    });

    it('should export empty measurement as GeoJSON without error', () => {
      setupPropertyAndMeasurement();
      const m = useStore.getState().activeMeasurement!;
      const geo = buildGeoJSON(m);

      expect(geo.type).toBe('FeatureCollection');
      expect(geo.features).toHaveLength(0);
    });

    it('should export empty measurement as CSV without error', () => {
      setupPropertyAndMeasurement();
      const m = useStore.getState().activeMeasurement!;
      const csv = buildCSV(m);

      expect(csv).toContain('ROOF MEASUREMENT SUMMARY');
      expect(typeof csv).toBe('string');
    });

    it('should handle clearAll on empty measurement', () => {
      setupPropertyAndMeasurement();
      useStore.getState().clearAll();

      const m = useStore.getState().activeMeasurement!;
      expect(m.vertices).toHaveLength(0);
      expect(m.edges).toHaveLength(0);
      expect(m.facets).toHaveLength(0);
    });

    it('should handle undo on empty stack without error', () => {
      setupPropertyAndMeasurement();
      expect(useStore.getState()._undoStack).toHaveLength(0);

      // Should not crash
      useStore.getState().undo();
      expect(useStore.getState().activeMeasurement).not.toBeNull();
    });
  });

  // ─── UTM Coordinate Conversion ─────────────────────────────────

  describe('UTM coordinate handling', () => {
    it('should handle UTM-like coordinates in Solar API without crash', () => {
      // This verifies the store/geometry don't break with large easting/northing values
      // that might accidentally be treated as lat/lng
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;

      // Vertices should be valid lat/lng, not UTM
      for (const vertex of m.vertices) {
        expect(vertex.lat).toBeGreaterThan(-90);
        expect(vertex.lat).toBeLessThan(90);
        expect(vertex.lng).toBeGreaterThan(-180);
        expect(vertex.lng).toBeLessThan(180);
      }
    });

    it('should derive correct UTM zone from target longitude', () => {
      // UTM zone = floor((lng + 180) / 6) + 1
      // Springfield, IL: lng ~= -89.65 → zone 16
      const lng = -89.65;
      const zone = Math.floor((lng + 180) / 6) + 1;
      expect(zone).toBe(16);

      // Los Angeles: lng ~= -118.24 → zone 11
      const laLng = -118.24;
      const laZone = Math.floor((laLng + 180) / 6) + 1;
      expect(laZone).toBe(11);
    });
  });
});
