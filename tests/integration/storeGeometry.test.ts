/**
 * Integration: Store + geometry calculations.
 * No mocks — tests real calculations through store actions.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../src/store/useStore';
import { resetStore, setupPropertyWithOutline, setupPropertyAndMeasurement } from '../helpers/store';

describe('Store + Geometry Integration', () => {
  beforeEach(() => {
    resetStore();
  });

  // ─── Outline -> Area Calculations ─────────────────────────────

  describe('outline to area calculations', () => {
    it('should calculate flat area from outline', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      expect(m.totalAreaSqFt).toBeGreaterThan(0);
    });

    it('should calculate true area (> flat area at pitch > 0)', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      expect(m.totalTrueAreaSqFt).toBeGreaterThan(m.totalAreaSqFt);
    });

    it('should calculate edge lengths', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      for (const e of m.edges) {
        expect(e.lengthFt).toBeGreaterThan(0);
      }
    });

    it('should sum eave lengths as totalEaveLf', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      const eaveSum = m.edges.filter(e => e.type === 'eave').reduce((s, e) => s + e.lengthFt, 0);
      expect(m.totalEaveLf).toBeCloseTo(eaveSum, 1);
    });

    it('should set predominant pitch from facets', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      expect(m.predominantPitch).toBe(6); // default outline pitch
    });
  });

  // ─── Multiple Facets ──────────────────────────────────────────

  describe('multiple facets', () => {
    it('should sum areas from multiple outlines', () => {
      setupPropertyWithOutline();
      const area1 = useStore.getState().activeMeasurement!.totalAreaSqFt;

      // Save the first measurement and start a new one
      useStore.getState().saveMeasurement();
      useStore.getState().startNewMeasurement();

      // Draw second outline
      const { addOutlinePoint, finishOutline, setDrawingMode } = useStore.getState();
      setDrawingMode('outline');
      addOutlinePoint(39.780, -89.648);
      addOutlinePoint(39.780, -89.647);
      addOutlinePoint(39.779, -89.647);
      addOutlinePoint(39.779, -89.648);
      finishOutline();

      const area2 = useStore.getState().activeMeasurement!.totalAreaSqFt;
      expect(area2).toBeGreaterThan(0);
      // area2 is for a different measurement (second outline only)
      expect(area1).not.toBe(area2);
    });

    it('should recalculate after deleting a facet', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      const areaBefore = m.totalAreaSqFt;
      const facetId = m.facets[0].id;

      useStore.getState().deleteFacet(facetId);
      const after = useStore.getState().activeMeasurement!;
      expect(after.totalAreaSqFt).toBeLessThan(areaBefore);
    });

    it('should recalculate after pitch change', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      const trueBefore = m.totalTrueAreaSqFt;
      const facetId = m.facets[0].id;

      useStore.getState().updateFacetPitch(facetId, 12);
      const after = useStore.getState().activeMeasurement!;
      expect(after.totalTrueAreaSqFt).toBeGreaterThan(trueBefore);
      expect(after.predominantPitch).toBe(12);
    });
  });

  // ─── Edge Type Totals ─────────────────────────────────────────

  describe('edge type totals', () => {
    it('should update totalRidgeLf when edge type changes', () => {
      setupPropertyWithOutline();
      const edges = useStore.getState().activeMeasurement!.edges;
      useStore.getState().updateEdgeType(edges[0].id, 'ridge');
      expect(useStore.getState().activeMeasurement!.totalRidgeLf).toBeGreaterThan(0);
    });

    it('should update totalHipLf when edge type changes', () => {
      setupPropertyWithOutline();
      const edges = useStore.getState().activeMeasurement!.edges;
      useStore.getState().updateEdgeType(edges[0].id, 'hip');
      expect(useStore.getState().activeMeasurement!.totalHipLf).toBeGreaterThan(0);
    });

    it('should update totalValleyLf when edge type changes', () => {
      setupPropertyWithOutline();
      const edges = useStore.getState().activeMeasurement!.edges;
      useStore.getState().updateEdgeType(edges[0].id, 'valley');
      expect(useStore.getState().activeMeasurement!.totalValleyLf).toBeGreaterThan(0);
    });

    it('should update totalFlashingLf for flashing + step-flashing', () => {
      setupPropertyWithOutline();
      const edges = useStore.getState().activeMeasurement!.edges;
      useStore.getState().updateEdgeType(edges[0].id, 'flashing');
      useStore.getState().updateEdgeType(edges[1].id, 'step-flashing');
      expect(useStore.getState().activeMeasurement!.totalFlashingLf).toBeGreaterThan(0);
    });

    it('should compute totalDripEdgeLf as rake + eave', () => {
      setupPropertyWithOutline();
      const edges = useStore.getState().activeMeasurement!.edges;
      useStore.getState().updateEdgeType(edges[0].id, 'rake');
      const m = useStore.getState().activeMeasurement!;
      expect(m.totalDripEdgeLf).toBeCloseTo(m.totalRakeLf + m.totalEaveLf, 1);
    });
  });

  // ─── Vertex Operations ────────────────────────────────────────

  describe('vertex operations', () => {
    it('should recalculate edge lengths after moveVertex', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      const vertex = m.vertices[0];
      const edgeBefore = m.edges[0].lengthFt;

      useStore.getState().moveVertex(vertex.id, vertex.lat + 0.001, vertex.lng);
      const after = useStore.getState().activeMeasurement!;
      const edgeAfter = after.edges[0].lengthFt;
      expect(edgeAfter).not.toBeCloseTo(edgeBefore, 1);
    });

    it('should cascade delete edges/facets when vertex deleted', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      const vertexId = m.vertices[0].id;

      useStore.getState().deleteVertex(vertexId);
      const after = useStore.getState().activeMeasurement!;

      // Vertex should be gone
      expect(after.vertices.find(v => v.id === vertexId)).toBeUndefined();
      // Edges referencing this vertex should be gone
      for (const e of after.edges) {
        expect(e.startVertexId).not.toBe(vertexId);
        expect(e.endVertexId).not.toBe(vertexId);
      }
    });

    it('should recalculate areas after vertex deletion', () => {
      setupPropertyWithOutline();
      const areaBefore = useStore.getState().activeMeasurement!.totalAreaSqFt;
      const vertexId = useStore.getState().activeMeasurement!.vertices[0].id;

      useStore.getState().deleteVertex(vertexId);
      const areaAfter = useStore.getState().activeMeasurement!.totalAreaSqFt;
      // Area should change (facets with this vertex are deleted)
      expect(areaAfter).not.toBe(areaBefore);
    });
  });

  // ─── Squares and Waste ────────────────────────────────────────

  describe('squares and waste', () => {
    it('should compute squares from true area', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      expect(m.totalSquares).toBeCloseTo(m.totalTrueAreaSqFt / 100, 2);
    });

    it('should compute suggested waste percent', () => {
      setupPropertyWithOutline();
      const m = useStore.getState().activeMeasurement!;
      expect(m.suggestedWastePercent).toBeGreaterThanOrEqual(5);
      expect(m.suggestedWastePercent).toBeLessThanOrEqual(25);
    });
  });

  // ─── Edge Add + Recalculate ───────────────────────────────────

  describe('edge add and recalculate', () => {
    it('should add an edge between two vertices with correct length', () => {
      setupPropertyAndMeasurement();
      const { addVertex, addEdge } = useStore.getState();
      const v1 = addVertex(39.782, -89.651);
      const v2 = addVertex(39.782, -89.649);
      const edgeId = addEdge(v1, v2, 'ridge');

      const edge = useStore.getState().activeMeasurement!.edges.find(e => e.id === edgeId);
      expect(edge).toBeDefined();
      expect(edge!.lengthFt).toBeGreaterThan(0);
      expect(edge!.type).toBe('ridge');
    });

    it('should return empty string if activeMeasurement is null for addEdge', () => {
      const result = useStore.getState().addEdge('v1', 'v2', 'eave');
      expect(result).toBe('');
    });
  });
});
