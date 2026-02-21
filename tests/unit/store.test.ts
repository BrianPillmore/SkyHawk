/**
 * Unit tests for Zustand store
 * Run with: npx vitest run tests/unit/store.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../src/store/useStore';

describe('Property Management', () => {
  beforeEach(() => {
    useStore.setState({
      properties: [],
      activePropertyId: null,
      activeMeasurement: null,
    });
  });

  it('should create a property', () => {
    const id = useStore.getState().createProperty('123 Main St', 'Springfield', 'IL', '62701', 39.7817, -89.6501);
    expect(id).toBeTruthy();
    expect(useStore.getState().properties.length).toBe(1);
    expect(useStore.getState().properties[0].address).toBe('123 Main St');
    expect(useStore.getState().activePropertyId).toBe(id);
  });

  it('should set map center when creating property', () => {
    useStore.getState().createProperty('123 Main St', 'Springfield', 'IL', '62701', 39.7817, -89.6501);
    expect(useStore.getState().mapCenter.lat).toBe(39.7817);
    expect(useStore.getState().mapCenter.lng).toBe(-89.6501);
    expect(useStore.getState().mapZoom).toBe(20);
  });

  it('should delete a property', () => {
    const id = useStore.getState().createProperty('123 Main St', 'Springfield', 'IL', '62701', 39.7817, -89.6501);
    useStore.getState().deleteProperty(id);
    expect(useStore.getState().properties.length).toBe(0);
    expect(useStore.getState().activePropertyId).toBeNull();
  });

  it('should set active property', () => {
    const id1 = useStore.getState().createProperty('123 Main St', 'Springfield', 'IL', '62701', 39.7817, -89.6501);
    const id2 = useStore.getState().createProperty('456 Oak Ave', 'Chicago', 'IL', '60601', 41.8781, -87.6298);
    useStore.getState().setActiveProperty(id1);
    expect(useStore.getState().activePropertyId).toBe(id1);
  });
});

describe('Measurement Session', () => {
  beforeEach(() => {
    useStore.setState({
      properties: [],
      activePropertyId: null,
      activeMeasurement: null,
      drawingMode: 'pan',
    });
    useStore.getState().createProperty('123 Main St', 'Springfield', 'IL', '62701', 39.7817, -89.6501);
  });

  it('should start a new measurement', () => {
    useStore.getState().startNewMeasurement();
    const m = useStore.getState().activeMeasurement;
    expect(m).not.toBeNull();
    expect(m!.vertices).toHaveLength(0);
    expect(m!.edges).toHaveLength(0);
    expect(m!.facets).toHaveLength(0);
    expect(useStore.getState().drawingMode).toBe('outline');
  });

  it('should add vertices', () => {
    useStore.getState().startNewMeasurement();
    const id = useStore.getState().addVertex(39.7817, -89.6501);
    expect(id).toBeTruthy();
    expect(useStore.getState().activeMeasurement!.vertices.length).toBe(1);
  });

  it('should set drawing mode', () => {
    useStore.getState().startNewMeasurement();
    useStore.getState().setDrawingMode('ridge');
    expect(useStore.getState().drawingMode).toBe('ridge');
  });
});

describe('Outline Drawing', () => {
  beforeEach(() => {
    useStore.setState({
      properties: [],
      activePropertyId: null,
      activeMeasurement: null,
      isDrawingOutline: false,
      currentOutlineVertices: [],
    });
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
  });

  it('should add outline points', () => {
    useStore.getState().addOutlinePoint(40.0, -90.0);
    useStore.getState().addOutlinePoint(40.001, -90.0);
    useStore.getState().addOutlinePoint(40.001, -89.999);
    expect(useStore.getState().currentOutlineVertices.length).toBe(3);
  });

  it('should finish outline and create facet', () => {
    useStore.getState().setDrawingMode('outline');
    useStore.getState().addOutlinePoint(40.0, -90.0);
    useStore.getState().addOutlinePoint(40.001, -90.0);
    useStore.getState().addOutlinePoint(40.001, -89.999);
    useStore.getState().finishOutline();

    const m = useStore.getState().activeMeasurement!;
    expect(m.facets.length).toBe(1);
    expect(m.vertices.length).toBe(3);
    expect(m.edges.length).toBe(3); // 3 eave edges forming the outline
    expect(m.facets[0].pitch).toBe(6); // Default pitch
    expect(m.facets[0].areaSqFt).toBeGreaterThan(0);
    expect(m.facets[0].trueAreaSqFt).toBeGreaterThan(m.facets[0].areaSqFt);
  });

  it('should cancel outline without creating facet', () => {
    useStore.getState().addOutlinePoint(40.0, -90.0);
    useStore.getState().addOutlinePoint(40.001, -90.0);
    useStore.getState().cancelOutline();

    expect(useStore.getState().currentOutlineVertices.length).toBe(0);
    expect(useStore.getState().isDrawingOutline).toBe(false);
    expect(useStore.getState().activeMeasurement!.facets.length).toBe(0);
  });
});

describe('Edge Management', () => {
  beforeEach(() => {
    useStore.setState({
      properties: [],
      activePropertyId: null,
      activeMeasurement: null,
    });
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
  });

  it('should add an edge between vertices', () => {
    const v1 = useStore.getState().addVertex(40.0, -90.0);
    const v2 = useStore.getState().addVertex(40.001, -90.0);
    const edgeId = useStore.getState().addEdge(v1, v2, 'ridge');
    expect(edgeId).toBeTruthy();
    const m = useStore.getState().activeMeasurement!;
    expect(m.edges.length).toBe(1);
    expect(m.edges[0].type).toBe('ridge');
    expect(m.edges[0].lengthFt).toBeGreaterThan(0);
  });

  it('should delete an edge', () => {
    const v1 = useStore.getState().addVertex(40.0, -90.0);
    const v2 = useStore.getState().addVertex(40.001, -90.0);
    const edgeId = useStore.getState().addEdge(v1, v2, 'ridge');
    useStore.getState().deleteEdge(edgeId);
    expect(useStore.getState().activeMeasurement!.edges.length).toBe(0);
  });
});

describe('Facet Pitch', () => {
  beforeEach(() => {
    useStore.setState({
      properties: [],
      activePropertyId: null,
      activeMeasurement: null,
      currentOutlineVertices: [],
    });
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    useStore.getState().setDrawingMode('outline');
    useStore.getState().addOutlinePoint(40.0, -90.0);
    useStore.getState().addOutlinePoint(40.001, -90.0);
    useStore.getState().addOutlinePoint(40.001, -89.999);
    useStore.getState().finishOutline();
  });

  it('should update facet pitch', () => {
    const facetId = useStore.getState().activeMeasurement!.facets[0].id;
    const originalTrueArea = useStore.getState().activeMeasurement!.facets[0].trueAreaSqFt;

    useStore.getState().updateFacetPitch(facetId, 12);

    const updatedFacet = useStore.getState().activeMeasurement!.facets[0];
    expect(updatedFacet.pitch).toBe(12);
    expect(updatedFacet.trueAreaSqFt).toBeGreaterThan(originalTrueArea);
  });

  it('should recalculate totals after pitch change', () => {
    const facetId = useStore.getState().activeMeasurement!.facets[0].id;
    const originalTotal = useStore.getState().activeMeasurement!.totalTrueAreaSqFt;

    useStore.getState().updateFacetPitch(facetId, 12);

    expect(useStore.getState().activeMeasurement!.totalTrueAreaSqFt).toBeGreaterThan(originalTotal);
  });
});

describe('Clear All', () => {
  it('should reset measurement state', () => {
    useStore.setState({
      properties: [],
      activePropertyId: null,
      activeMeasurement: null,
      currentOutlineVertices: [],
      _undoStack: [],
      _redoStack: [],
    });
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    useStore.getState().addVertex(40.0, -90.0);
    useStore.getState().clearAll();

    const m = useStore.getState().activeMeasurement!;
    expect(m.vertices.length).toBe(0);
    expect(m.edges.length).toBe(0);
    expect(m.facets.length).toBe(0);
    expect(useStore.getState().drawingMode).toBe('outline');
  });
});

// --- Undo/Redo ---

describe('Undo/Redo', () => {
  beforeEach(() => {
    useStore.setState({
      properties: [],
      activePropertyId: null,
      activeMeasurement: null,
      currentOutlineVertices: [],
      _undoStack: [],
      _redoStack: [],
    });
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
  });

  it('should have empty undo/redo stacks initially', () => {
    expect(useStore.getState()._undoStack.length).toBe(0);
    expect(useStore.getState()._redoStack.length).toBe(0);
  });

  it('should push to undo stack when adding a vertex', () => {
    useStore.getState().addVertex(40.0, -90.0);
    expect(useStore.getState()._undoStack.length).toBe(1);
    expect(useStore.getState().activeMeasurement!.vertices.length).toBe(1);
  });

  it('should undo adding a vertex', () => {
    useStore.getState().addVertex(40.0, -90.0);
    expect(useStore.getState().activeMeasurement!.vertices.length).toBe(1);

    useStore.getState().undo();
    expect(useStore.getState().activeMeasurement!.vertices.length).toBe(0);
    expect(useStore.getState()._undoStack.length).toBe(0);
    expect(useStore.getState()._redoStack.length).toBe(1);
  });

  it('should redo after undo', () => {
    useStore.getState().addVertex(40.0, -90.0);
    useStore.getState().undo();
    expect(useStore.getState().activeMeasurement!.vertices.length).toBe(0);

    useStore.getState().redo();
    expect(useStore.getState().activeMeasurement!.vertices.length).toBe(1);
    expect(useStore.getState()._undoStack.length).toBe(1);
    expect(useStore.getState()._redoStack.length).toBe(0);
  });

  it('should clear redo stack when new action is performed', () => {
    useStore.getState().addVertex(40.0, -90.0);
    useStore.getState().undo();
    expect(useStore.getState()._redoStack.length).toBe(1);

    // New action should clear redo
    useStore.getState().addVertex(40.001, -90.001);
    expect(useStore.getState()._redoStack.length).toBe(0);
  });

  it('should undo multiple actions in order', () => {
    useStore.getState().addVertex(40.0, -90.0);
    useStore.getState().addVertex(40.001, -90.001);
    useStore.getState().addVertex(40.002, -90.002);
    expect(useStore.getState().activeMeasurement!.vertices.length).toBe(3);

    useStore.getState().undo(); // remove 3rd vertex
    expect(useStore.getState().activeMeasurement!.vertices.length).toBe(2);

    useStore.getState().undo(); // remove 2nd vertex
    expect(useStore.getState().activeMeasurement!.vertices.length).toBe(1);

    useStore.getState().undo(); // remove 1st vertex
    expect(useStore.getState().activeMeasurement!.vertices.length).toBe(0);
  });

  it('should undo edge creation', () => {
    const v1 = useStore.getState().addVertex(40.0, -90.0);
    const v2 = useStore.getState().addVertex(40.001, -90.0);
    useStore.getState().addEdge(v1, v2, 'ridge');
    expect(useStore.getState().activeMeasurement!.edges.length).toBe(1);

    useStore.getState().undo(); // undo edge creation
    expect(useStore.getState().activeMeasurement!.edges.length).toBe(0);
    expect(useStore.getState().activeMeasurement!.vertices.length).toBe(2); // vertices still there
  });

  it('should undo edge deletion', () => {
    const v1 = useStore.getState().addVertex(40.0, -90.0);
    const v2 = useStore.getState().addVertex(40.001, -90.0);
    const edgeId = useStore.getState().addEdge(v1, v2, 'ridge');

    useStore.getState().deleteEdge(edgeId);
    expect(useStore.getState().activeMeasurement!.edges.length).toBe(0);

    useStore.getState().undo(); // undo deletion
    expect(useStore.getState().activeMeasurement!.edges.length).toBe(1);
  });

  it('should undo facet pitch change', () => {
    // Create a facet via outline
    useStore.getState().setDrawingMode('outline');
    useStore.getState().addOutlinePoint(40.0, -90.0);
    useStore.getState().addOutlinePoint(40.001, -90.0);
    useStore.getState().addOutlinePoint(40.001, -89.999);
    useStore.getState().finishOutline();

    const facetId = useStore.getState().activeMeasurement!.facets[0].id;
    const originalPitch = useStore.getState().activeMeasurement!.facets[0].pitch;

    useStore.getState().updateFacetPitch(facetId, 12);
    expect(useStore.getState().activeMeasurement!.facets[0].pitch).toBe(12);

    useStore.getState().undo();
    expect(useStore.getState().activeMeasurement!.facets[0].pitch).toBe(originalPitch);
  });

  it('should undo clearAll', () => {
    useStore.getState().addVertex(40.0, -90.0);
    useStore.getState().addVertex(40.001, -90.0);
    expect(useStore.getState().activeMeasurement!.vertices.length).toBe(2);

    useStore.getState().clearAll();
    expect(useStore.getState().activeMeasurement!.vertices.length).toBe(0);

    useStore.getState().undo();
    expect(useStore.getState().activeMeasurement!.vertices.length).toBe(2);
  });

  it('should do nothing when undoing with empty stack', () => {
    const before = useStore.getState().activeMeasurement;
    useStore.getState().undo();
    expect(useStore.getState().activeMeasurement).toEqual(before);
  });

  it('should do nothing when redoing with empty stack', () => {
    const before = useStore.getState().activeMeasurement;
    useStore.getState().redo();
    expect(useStore.getState().activeMeasurement).toEqual(before);
  });

  it('should limit undo stack size', () => {
    // Add more than MAX_UNDO_STACK (50) actions
    for (let i = 0; i < 55; i++) {
      useStore.getState().addVertex(40.0 + i * 0.001, -90.0);
    }
    expect(useStore.getState()._undoStack.length).toBeLessThanOrEqual(50);
    expect(useStore.getState().activeMeasurement!.vertices.length).toBe(55);
  });
});
