/**
 * Integration: Edge drawing workflow through store.
 * No mocks.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../src/store/useStore';
import { resetStore, setupPropertyAndMeasurement } from '../helpers/store';

describe('Edge Drawing Workflow', () => {
  beforeEach(() => {
    resetStore();
    setupPropertyAndMeasurement();
  });

  it('should set edge start vertex', () => {
    const v1 = useStore.getState().addVertex(39.782, -89.651);
    useStore.getState().setEdgeStartVertex(v1);
    expect(useStore.getState().edgeStartVertexId).toBe(v1);
  });

  it('should add edge and clear start vertex', () => {
    const v1 = useStore.getState().addVertex(39.782, -89.651);
    const v2 = useStore.getState().addVertex(39.782, -89.649);
    useStore.getState().setEdgeStartVertex(v1);
    const edgeId = useStore.getState().addEdge(v1, v2, 'eave');

    expect(edgeId).toBeTruthy();
    expect(useStore.getState().edgeStartVertexId).toBeNull();
    const edge = useStore.getState().activeMeasurement!.edges.find(e => e.id === edgeId);
    expect(edge).toBeDefined();
    expect(edge!.lengthFt).toBeGreaterThan(0);
  });

  it('should chain edges (v1->v2, v2->v3)', () => {
    const v1 = useStore.getState().addVertex(39.782, -89.651);
    const v2 = useStore.getState().addVertex(39.782, -89.649);
    const v3 = useStore.getState().addVertex(39.780, -89.649);

    const e1 = useStore.getState().addEdge(v1, v2, 'eave');
    const e2 = useStore.getState().addEdge(v2, v3, 'eave');

    const edges = useStore.getState().activeMeasurement!.edges;
    expect(edges.find(e => e.id === e1)!.endVertexId).toBe(v2);
    expect(edges.find(e => e.id === e2)!.startVertexId).toBe(v2);
  });

  it('should recalculate totals after addEdge', () => {
    const v1 = useStore.getState().addVertex(39.782, -89.651);
    const v2 = useStore.getState().addVertex(39.782, -89.649);
    useStore.getState().addEdge(v1, v2, 'eave');

    const m = useStore.getState().activeMeasurement!;
    expect(m.totalEaveLf).toBeGreaterThan(0);
  });

  it('should updateEdgeType and recalculate', () => {
    const v1 = useStore.getState().addVertex(39.782, -89.651);
    const v2 = useStore.getState().addVertex(39.782, -89.649);
    const edgeId = useStore.getState().addEdge(v1, v2, 'eave');

    useStore.getState().updateEdgeType(edgeId, 'ridge');
    const m = useStore.getState().activeMeasurement!;
    expect(m.totalRidgeLf).toBeGreaterThan(0);
    expect(m.totalEaveLf).toBe(0);
  });

  it('should handle outline + internal ridge edge', () => {
    const { addOutlinePoint, finishOutline, setDrawingMode, addVertex, addEdge } = useStore.getState();

    // Draw outline
    setDrawingMode('outline');
    addOutlinePoint(39.782, -89.651);
    addOutlinePoint(39.782, -89.649);
    addOutlinePoint(39.780, -89.649);
    addOutlinePoint(39.780, -89.651);
    finishOutline();

    // Add a ridge across the middle
    const v1 = addVertex(39.781, -89.651);
    const v2 = addVertex(39.781, -89.649);
    addEdge(v1, v2, 'ridge');

    const m = useStore.getState().activeMeasurement!;
    expect(m.totalRidgeLf).toBeGreaterThan(0);
    expect(m.totalEaveLf).toBeGreaterThan(0);
  });

  // ─── Undo/Redo ────────────────────────────────────────────────

  describe('undo/redo across edge operations', () => {
    it('should undo addEdge', () => {
      const v1 = useStore.getState().addVertex(39.782, -89.651);
      const v2 = useStore.getState().addVertex(39.782, -89.649);
      const edgesBefore = useStore.getState().activeMeasurement!.edges.length;
      useStore.getState().addEdge(v1, v2, 'eave');
      expect(useStore.getState().activeMeasurement!.edges.length).toBe(edgesBefore + 1);

      useStore.getState().undo();
      expect(useStore.getState().activeMeasurement!.edges.length).toBe(edgesBefore);
    });

    it('should redo addEdge', () => {
      const v1 = useStore.getState().addVertex(39.782, -89.651);
      const v2 = useStore.getState().addVertex(39.782, -89.649);
      useStore.getState().addEdge(v1, v2, 'eave');
      const edgesWithNew = useStore.getState().activeMeasurement!.edges.length;

      useStore.getState().undo();
      useStore.getState().redo();
      expect(useStore.getState().activeMeasurement!.edges.length).toBe(edgesWithNew);
    });

    it('should undo updateEdgeType', () => {
      const v1 = useStore.getState().addVertex(39.782, -89.651);
      const v2 = useStore.getState().addVertex(39.782, -89.649);
      const edgeId = useStore.getState().addEdge(v1, v2, 'eave');

      useStore.getState().updateEdgeType(edgeId, 'ridge');
      expect(useStore.getState().activeMeasurement!.edges.find(e => e.id === edgeId)!.type).toBe('ridge');

      useStore.getState().undo();
      // After undo, the entire measurement snapshot is restored
      // The edge may have a different id in the restored snapshot, but the type should be the pre-update state
      const m = useStore.getState().activeMeasurement!;
      // Check that the ridge total is back to what it was (the original addEdge state)
      // In the pre-updateEdgeType state, the edge was 'eave'
      expect(m.totalRidgeLf).toBe(0);
    });

    it('should undo deleteEdge', () => {
      const v1 = useStore.getState().addVertex(39.782, -89.651);
      const v2 = useStore.getState().addVertex(39.782, -89.649);
      const edgeId = useStore.getState().addEdge(v1, v2, 'eave');
      const countWithEdge = useStore.getState().activeMeasurement!.edges.length;

      useStore.getState().deleteEdge(edgeId);
      expect(useStore.getState().activeMeasurement!.edges.length).toBeLessThan(countWithEdge);

      useStore.getState().undo();
      expect(useStore.getState().activeMeasurement!.edges.length).toBe(countWithEdge);
    });

    it('should handle multiple undo/redo in sequence', () => {
      const v1 = useStore.getState().addVertex(39.782, -89.651);
      const v2 = useStore.getState().addVertex(39.782, -89.649);
      const v3 = useStore.getState().addVertex(39.780, -89.649);

      useStore.getState().addEdge(v1, v2, 'eave');
      useStore.getState().addEdge(v2, v3, 'ridge');

      const state2 = useStore.getState().activeMeasurement!.edges.length;

      useStore.getState().undo(); // undo addEdge v2->v3
      useStore.getState().undo(); // undo addEdge v1->v2

      useStore.getState().redo(); // redo addEdge v1->v2
      useStore.getState().redo(); // redo addEdge v2->v3

      expect(useStore.getState().activeMeasurement!.edges.length).toBe(state2);
    });
  });

  // ─── Edge deletion ────────────────────────────────────────────

  describe('edge deletion', () => {
    it('should remove edge and recalculate', () => {
      const v1 = useStore.getState().addVertex(39.782, -89.651);
      const v2 = useStore.getState().addVertex(39.782, -89.649);
      const edgeId = useStore.getState().addEdge(v1, v2, 'eave');

      useStore.getState().deleteEdge(edgeId);
      const m = useStore.getState().activeMeasurement!;
      expect(m.edges.find(e => e.id === edgeId)).toBeUndefined();
      expect(m.totalEaveLf).toBe(0);
    });

    it('should clear selectedEdgeId if deleted edge was selected', () => {
      const v1 = useStore.getState().addVertex(39.782, -89.651);
      const v2 = useStore.getState().addVertex(39.782, -89.649);
      const edgeId = useStore.getState().addEdge(v1, v2, 'eave');
      useStore.getState().selectEdge(edgeId);
      expect(useStore.getState().selectedEdgeId).toBe(edgeId);

      useStore.getState().deleteEdge(edgeId);
      expect(useStore.getState().selectedEdgeId).toBeNull();
    });
  });
});
