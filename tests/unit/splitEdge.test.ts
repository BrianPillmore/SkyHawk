import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../src/store/useStore';

/**
 * Helper to set up a minimal measurement with vertices, edges, and optionally a facet.
 * Returns the IDs created.
 */
function setupBasicMeasurement() {
  const store = useStore.getState();
  // Create a property and start a measurement
  const propId = store.createProperty('Test', 'City', 'ST', '00000', 35.0, -97.0);
  store.setActiveProperty(propId);
  store.startNewMeasurement();

  // Add 3 vertices forming a triangle
  const v1 = store.addVertex(35.0, -97.0);
  const v2 = store.addVertex(35.001, -97.0);
  const v3 = store.addVertex(35.0005, -96.999);

  // Add edges
  const e1 = store.addEdge(v1, v2, 'ridge');
  const e2 = store.addEdge(v2, v3, 'hip');
  const e3 = store.addEdge(v3, v1, 'eave');

  return { propId, v1, v2, v3, e1, e2, e3 };
}

describe('splitEdge', () => {
  beforeEach(() => {
    useStore.setState({
      activeMeasurement: null,
      properties: [],
      activePropertyId: null,
      _undoStack: [],
      _redoStack: [],
    });
  });

  it('creates a new vertex at the split point', () => {
    const { e1 } = setupBasicMeasurement();
    const state = useStore.getState();
    const verticesBefore = state.activeMeasurement!.vertices.length;

    const newVertexId = state.splitEdge(e1, 35.0005, -97.0);

    const after = useStore.getState().activeMeasurement!;
    expect(newVertexId).toBeTruthy();
    expect(after.vertices.length).toBe(verticesBefore + 1);

    const newVertex = after.vertices.find((v) => v.id === newVertexId);
    expect(newVertex).toBeDefined();
    expect(newVertex!.lat).toBeCloseTo(35.0005, 5);
    expect(newVertex!.lng).toBeCloseTo(-97.0, 5);
  });

  it('replaces the original edge with two new edges of the same type', () => {
    const { e1 } = setupBasicMeasurement();
    const state = useStore.getState();
    const origEdge = state.activeMeasurement!.edges.find((e) => e.id === e1)!;

    state.splitEdge(e1, 35.0005, -97.0);

    const after = useStore.getState().activeMeasurement!;

    // Original edge should be gone
    expect(after.edges.find((e) => e.id === e1)).toBeUndefined();

    // Two new edges of same type should exist
    const newEdges = after.edges.filter((e) => e.type === origEdge.type);
    // At least 2 edges with 'ridge' type (the two new ones)
    expect(newEdges.length).toBeGreaterThanOrEqual(2);
  });

  it('sum of child edge lengths approximately equals original length', () => {
    const { v1, v2, e1 } = setupBasicMeasurement();
    const state = useStore.getState();
    const origEdge = state.activeMeasurement!.edges.find((e) => e.id === e1)!;
    const origLength = origEdge.lengthFt;

    const newVertexId = state.splitEdge(e1, 35.0005, -97.0);

    const after = useStore.getState().activeMeasurement!;
    // Find the two new edges that connect to the new vertex
    const childEdges = after.edges.filter(
      (e) => e.startVertexId === newVertexId || e.endVertexId === newVertexId
    );

    // Should have at least 2 child edges (the split pair)
    expect(childEdges.length).toBeGreaterThanOrEqual(2);

    // Find specifically the two edges from the split (connecting v1-newV and newV-v2)
    const splitEdge1 = childEdges.find(
      (e) =>
        (e.startVertexId === v1 && e.endVertexId === newVertexId) ||
        (e.startVertexId === newVertexId && e.endVertexId === v1)
    );
    const splitEdge2 = childEdges.find(
      (e) =>
        (e.startVertexId === v2 && e.endVertexId === newVertexId) ||
        (e.startVertexId === newVertexId && e.endVertexId === v2)
    );

    expect(splitEdge1).toBeDefined();
    expect(splitEdge2).toBeDefined();

    const sumLength = splitEdge1!.lengthFt + splitEdge2!.lengthFt;
    // Allow small floating point tolerance
    expect(sumLength).toBeCloseTo(origLength, 0);
  });

  it('updates facet edgeIds and vertexIds when facet references the split edge', () => {
    const { v1, v2, v3, e1, e2, e3 } = setupBasicMeasurement();
    const state = useStore.getState();

    // Add a facet referencing the edges
    const facetId = state.addFacet('Test Facet', [v1, v2, v3], 6);
    // Manually set the facet's edgeIds
    useStore.setState((s) => ({
      activeMeasurement: s.activeMeasurement ? {
        ...s.activeMeasurement,
        facets: s.activeMeasurement.facets.map((f) =>
          f.id === facetId ? { ...f, edgeIds: [e1, e2, e3] } : f
        ),
      } : null,
    }));

    useStore.getState().splitEdge(e1, 35.0005, -97.0);

    const after = useStore.getState().activeMeasurement!;
    const facet = after.facets.find((f) => f.id === facetId)!;

    // The old edge should no longer be in facet edgeIds
    expect(facet.edgeIds).not.toContain(e1);
    // Two new edge IDs should be in its place
    expect(facet.edgeIds.length).toBe(4); // was 3, split adds 1

    // The new vertex should be in facet vertexIds
    expect(facet.vertexIds.length).toBe(4); // was 3, split adds 1
  });

  it('single undo restores original state', () => {
    const { e1 } = setupBasicMeasurement();
    const stateBefore = JSON.parse(
      JSON.stringify(useStore.getState().activeMeasurement)
    );

    useStore.getState().splitEdge(e1, 35.0005, -97.0);

    // Verify the split happened
    const afterSplit = useStore.getState().activeMeasurement!;
    expect(afterSplit.edges.find((e) => e.id === e1)).toBeUndefined();

    // Undo
    useStore.getState().undo();

    const afterUndo = useStore.getState().activeMeasurement!;
    // Original edge should be back
    expect(afterUndo.edges.find((e) => e.id === e1)).toBeDefined();
    expect(afterUndo.vertices.length).toBe(stateBefore.vertices.length);
    expect(afterUndo.edges.length).toBe(stateBefore.edges.length);
  });

  it('returns empty string when edge does not exist', () => {
    setupBasicMeasurement();
    const result = useStore.getState().splitEdge('nonexistent-edge-id', 35.0005, -97.0);
    expect(result).toBe('');
  });

  it('returns empty string when no active measurement', () => {
    useStore.setState({ activeMeasurement: null });
    const result = useStore.getState().splitEdge('some-edge', 35.0, -97.0);
    expect(result).toBe('');
  });
});
