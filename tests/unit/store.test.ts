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

// --- Selection Actions ---

describe('Selection Actions', () => {
  beforeEach(() => {
    useStore.setState({
      properties: [],
      activePropertyId: null,
      activeMeasurement: null,
      selectedVertexId: null,
      selectedEdgeId: null,
      selectedFacetId: null,
      edgeStartVertexId: null,
    });
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
  });

  it('should select a vertex and clear other selections', () => {
    useStore.setState({ selectedEdgeId: 'some-edge', selectedFacetId: 'some-facet' });
    useStore.getState().selectVertex('vertex-1');
    expect(useStore.getState().selectedVertexId).toBe('vertex-1');
    expect(useStore.getState().selectedEdgeId).toBeNull();
    expect(useStore.getState().selectedFacetId).toBeNull();
  });

  it('should clear vertex selection when passing null', () => {
    useStore.getState().selectVertex('vertex-1');
    expect(useStore.getState().selectedVertexId).toBe('vertex-1');
    useStore.getState().selectVertex(null);
    expect(useStore.getState().selectedVertexId).toBeNull();
  });

  it('should select an edge and clear other selections', () => {
    useStore.setState({ selectedVertexId: 'some-vertex', selectedFacetId: 'some-facet' });
    useStore.getState().selectEdge('edge-1');
    expect(useStore.getState().selectedEdgeId).toBe('edge-1');
    expect(useStore.getState().selectedVertexId).toBeNull();
    expect(useStore.getState().selectedFacetId).toBeNull();
  });

  it('should clear edge selection when passing null', () => {
    useStore.getState().selectEdge('edge-1');
    expect(useStore.getState().selectedEdgeId).toBe('edge-1');
    useStore.getState().selectEdge(null);
    expect(useStore.getState().selectedEdgeId).toBeNull();
  });

  it('should select a facet and clear other selections', () => {
    useStore.setState({ selectedVertexId: 'some-vertex', selectedEdgeId: 'some-edge' });
    useStore.getState().selectFacet('facet-1');
    expect(useStore.getState().selectedFacetId).toBe('facet-1');
    expect(useStore.getState().selectedVertexId).toBeNull();
    expect(useStore.getState().selectedEdgeId).toBeNull();
  });

  it('should clear facet selection when passing null', () => {
    useStore.getState().selectFacet('facet-1');
    expect(useStore.getState().selectedFacetId).toBe('facet-1');
    useStore.getState().selectFacet(null);
    expect(useStore.getState().selectedFacetId).toBeNull();
  });

  it('should set edge start vertex', () => {
    useStore.getState().setEdgeStartVertex('vertex-1');
    expect(useStore.getState().edgeStartVertexId).toBe('vertex-1');
  });

  it('should clear edge start vertex when passing null', () => {
    useStore.getState().setEdgeStartVertex('vertex-1');
    useStore.getState().setEdgeStartVertex(null);
    expect(useStore.getState().edgeStartVertexId).toBeNull();
  });
});

// --- Map State Actions ---

describe('Map State Actions', () => {
  beforeEach(() => {
    useStore.setState({
      mapType: 'satellite',
      mapCenter: { lat: 39.8283, lng: -98.5795 },
      mapZoom: 5,
    });
  });

  it('should change mapType', () => {
    useStore.getState().setMapType('roadmap');
    expect(useStore.getState().mapType).toBe('roadmap');
  });

  it('should change mapType to hybrid', () => {
    useStore.getState().setMapType('hybrid');
    expect(useStore.getState().mapType).toBe('hybrid');
  });

  it('should change mapCenter', () => {
    useStore.getState().setMapCenter({ lat: 41.8781, lng: -87.6298 });
    expect(useStore.getState().mapCenter.lat).toBe(41.8781);
    expect(useStore.getState().mapCenter.lng).toBe(-87.6298);
  });

  it('should change mapZoom', () => {
    useStore.getState().setMapZoom(15);
    expect(useStore.getState().mapZoom).toBe(15);
  });
});

// --- UI Actions ---

describe('UI Actions', () => {
  beforeEach(() => {
    useStore.setState({
      sidebarOpen: true,
      activePanel: 'tools',
    });
  });

  it('should toggle sidebar from open to closed', () => {
    expect(useStore.getState().sidebarOpen).toBe(true);
    useStore.getState().toggleSidebar();
    expect(useStore.getState().sidebarOpen).toBe(false);
  });

  it('should toggle sidebar from closed to open', () => {
    useStore.setState({ sidebarOpen: false });
    useStore.getState().toggleSidebar();
    expect(useStore.getState().sidebarOpen).toBe(true);
  });

  it('should toggle sidebar twice to return to original state', () => {
    const original = useStore.getState().sidebarOpen;
    useStore.getState().toggleSidebar();
    useStore.getState().toggleSidebar();
    expect(useStore.getState().sidebarOpen).toBe(original);
  });

  it('should change activePanel to measurements', () => {
    useStore.getState().setActivePanel('measurements');
    expect(useStore.getState().activePanel).toBe('measurements');
  });

  it('should change activePanel to report', () => {
    useStore.getState().setActivePanel('report');
    expect(useStore.getState().activePanel).toBe('report');
  });

  it('should change activePanel to compare', () => {
    useStore.getState().setActivePanel('compare');
    expect(useStore.getState().activePanel).toBe('compare');
  });
});

// --- Damage Annotation Actions ---

describe('Damage Annotation Actions', () => {
  beforeEach(() => {
    useStore.setState({
      properties: [],
      activePropertyId: null,
      activeMeasurement: null,
      selectedDamageId: null,
      activeDamageType: 'hail',
      activeDamageSeverity: 'moderate',
    });
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
  });

  it('should add a damage annotation to the active property', () => {
    const id = useStore.getState().addDamageAnnotation(40.0, -90.0, 'hail', 'severe', 'Large dents');
    expect(id).toBeTruthy();
    const prop = useStore.getState().properties.find((p) => p.id === useStore.getState().activePropertyId);
    expect(prop!.damageAnnotations.length).toBe(1);
    expect(prop!.damageAnnotations[0].type).toBe('hail');
    expect(prop!.damageAnnotations[0].severity).toBe('severe');
    expect(prop!.damageAnnotations[0].note).toBe('Large dents');
    expect(prop!.damageAnnotations[0].lat).toBe(40.0);
    expect(prop!.damageAnnotations[0].lng).toBe(-90.0);
  });

  it('should return empty string if no active property', () => {
    useStore.setState({ activePropertyId: null });
    const id = useStore.getState().addDamageAnnotation(40.0, -90.0, 'hail', 'moderate', 'test');
    expect(id).toBe('');
  });

  it('should delete a damage annotation by id', () => {
    const id = useStore.getState().addDamageAnnotation(40.0, -90.0, 'hail', 'moderate', 'test');
    const prop1 = useStore.getState().properties.find((p) => p.id === useStore.getState().activePropertyId);
    expect(prop1!.damageAnnotations.length).toBe(1);

    useStore.getState().deleteDamageAnnotation(id);
    const prop2 = useStore.getState().properties.find((p) => p.id === useStore.getState().activePropertyId);
    expect(prop2!.damageAnnotations.length).toBe(0);
  });

  it('should clear selectedDamageId when deleting the selected damage', () => {
    const id = useStore.getState().addDamageAnnotation(40.0, -90.0, 'hail', 'moderate', 'test');
    useStore.getState().selectDamage(id);
    expect(useStore.getState().selectedDamageId).toBe(id);

    useStore.getState().deleteDamageAnnotation(id);
    expect(useStore.getState().selectedDamageId).toBeNull();
  });

  it('should not clear selectedDamageId when deleting a different damage', () => {
    const id1 = useStore.getState().addDamageAnnotation(40.0, -90.0, 'hail', 'moderate', 'first');
    const id2 = useStore.getState().addDamageAnnotation(40.001, -90.001, 'wind', 'minor', 'second');
    useStore.getState().selectDamage(id1);
    expect(useStore.getState().selectedDamageId).toBe(id1);

    useStore.getState().deleteDamageAnnotation(id2);
    expect(useStore.getState().selectedDamageId).toBe(id1);
  });

  it('should select a damage annotation', () => {
    const id = useStore.getState().addDamageAnnotation(40.0, -90.0, 'hail', 'moderate', 'test');
    useStore.getState().selectDamage(id);
    expect(useStore.getState().selectedDamageId).toBe(id);
  });

  it('should clear damage selection with null', () => {
    const id = useStore.getState().addDamageAnnotation(40.0, -90.0, 'hail', 'moderate', 'test');
    useStore.getState().selectDamage(id);
    useStore.getState().selectDamage(null);
    expect(useStore.getState().selectedDamageId).toBeNull();
  });

  it('should change activeDamageType', () => {
    useStore.getState().setActiveDamageType('wind');
    expect(useStore.getState().activeDamageType).toBe('wind');
  });

  it('should change activeDamageSeverity', () => {
    useStore.getState().setActiveDamageSeverity('severe');
    expect(useStore.getState().activeDamageSeverity).toBe('severe');
  });
});

// --- Snapshot Actions ---

describe('Snapshot Actions', () => {
  beforeEach(() => {
    useStore.setState({
      properties: [],
      activePropertyId: null,
      activeMeasurement: null,
      mapCenter: { lat: 40.0, lng: -90.0 },
      mapZoom: 18,
    });
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
  });

  it('should add a snapshot to the active property with current mapCenter/zoom', () => {
    // Set known map state
    useStore.setState({ mapCenter: { lat: 41.0, lng: -88.0 }, mapZoom: 19 });
    const id = useStore.getState().addSnapshot('Before repair', 'data:image/png;base64,abc');
    expect(id).toBeTruthy();

    const prop = useStore.getState().properties.find((p) => p.id === useStore.getState().activePropertyId);
    expect(prop!.snapshots.length).toBe(1);
    expect(prop!.snapshots[0].label).toBe('Before repair');
    expect(prop!.snapshots[0].dataUrl).toBe('data:image/png;base64,abc');
    expect(prop!.snapshots[0].lat).toBe(41.0);
    expect(prop!.snapshots[0].lng).toBe(-88.0);
    expect(prop!.snapshots[0].zoom).toBe(19);
  });

  it('should return empty string if no active property', () => {
    useStore.setState({ activePropertyId: null });
    const id = useStore.getState().addSnapshot('test', 'data:image/png;base64,abc');
    expect(id).toBe('');
  });

  it('should delete a snapshot by id', () => {
    const id = useStore.getState().addSnapshot('test', 'data:image/png;base64,abc');
    const prop1 = useStore.getState().properties.find((p) => p.id === useStore.getState().activePropertyId);
    expect(prop1!.snapshots.length).toBe(1);

    useStore.getState().deleteSnapshot(id);
    const prop2 = useStore.getState().properties.find((p) => p.id === useStore.getState().activePropertyId);
    expect(prop2!.snapshots.length).toBe(0);
  });

  it('should not change anything when deleting a non-existent snapshot', () => {
    useStore.getState().addSnapshot('test', 'data:image/png;base64,abc');
    const prop1 = useStore.getState().properties.find((p) => p.id === useStore.getState().activePropertyId);
    const countBefore = prop1!.snapshots.length;

    useStore.getState().deleteSnapshot('non-existent-id');
    const prop2 = useStore.getState().properties.find((p) => p.id === useStore.getState().activePropertyId);
    expect(prop2!.snapshots.length).toBe(countBefore);
  });
});

// --- Multi-structure Actions ---

describe('Multi-structure Actions', () => {
  let propertyId: string;

  beforeEach(() => {
    useStore.setState({
      properties: [],
      activePropertyId: null,
      activeMeasurement: null,
      _undoStack: [],
      _redoStack: [],
      currentOutlineVertices: [],
    });
    propertyId = useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
  });

  it('should save activeMeasurement to the property measurements array', () => {
    useStore.getState().startNewMeasurement();
    useStore.getState().addVertex(40.0, -90.0);
    useStore.getState().saveMeasurement();

    const prop = useStore.getState().properties.find((p) => p.id === propertyId);
    expect(prop!.measurements.length).toBe(1);
    expect(prop!.measurements[0].vertices.length).toBe(1);
  });

  it('should update an existing measurement if same id is saved again', () => {
    useStore.getState().startNewMeasurement();
    useStore.getState().addVertex(40.0, -90.0);
    useStore.getState().saveMeasurement();

    const prop1 = useStore.getState().properties.find((p) => p.id === propertyId);
    expect(prop1!.measurements.length).toBe(1);

    // Add another vertex and save again (same measurement id)
    useStore.getState().addVertex(40.001, -90.001);
    useStore.getState().saveMeasurement();

    const prop2 = useStore.getState().properties.find((p) => p.id === propertyId);
    expect(prop2!.measurements.length).toBe(1);
    expect(prop2!.measurements[0].vertices.length).toBe(2);
  });

  it('should load a saved measurement as active', () => {
    useStore.getState().startNewMeasurement();
    useStore.getState().addVertex(40.0, -90.0);
    useStore.getState().addVertex(40.001, -90.0);
    useStore.getState().saveMeasurement();

    const savedId = useStore.getState().activeMeasurement!.id;

    // Start a fresh measurement
    useStore.getState().startNewMeasurement();
    expect(useStore.getState().activeMeasurement!.vertices.length).toBe(0);

    // Load the saved one
    useStore.getState().loadMeasurement(savedId);
    expect(useStore.getState().activeMeasurement!.vertices.length).toBe(2);
    expect(useStore.getState().activeMeasurement!.id).toBe(savedId);
    expect(useStore.getState().drawingMode).toBe('select');
    expect(useStore.getState()._undoStack.length).toBe(0);
    expect(useStore.getState()._redoStack.length).toBe(0);
  });

  it('should do nothing if loading a non-existent measurement', () => {
    useStore.getState().startNewMeasurement();
    const before = useStore.getState().activeMeasurement;
    useStore.getState().loadMeasurement('non-existent-id');
    expect(useStore.getState().activeMeasurement).toEqual(before);
  });

  it('should do nothing if loading measurement with no activePropertyId', () => {
    useStore.getState().startNewMeasurement();
    useStore.getState().saveMeasurement();
    const savedId = useStore.getState().activeMeasurement!.id;

    useStore.setState({ activePropertyId: null });
    const before = useStore.getState().activeMeasurement;
    useStore.getState().loadMeasurement(savedId);
    expect(useStore.getState().activeMeasurement).toEqual(before);
  });

  it('should delete a saved measurement from property', () => {
    useStore.getState().startNewMeasurement();
    useStore.getState().addVertex(40.0, -90.0);
    useStore.getState().saveMeasurement();

    const savedId = useStore.getState().activeMeasurement!.id;
    const prop1 = useStore.getState().properties.find((p) => p.id === propertyId);
    expect(prop1!.measurements.length).toBe(1);

    useStore.getState().deleteSavedMeasurement(savedId);
    const prop2 = useStore.getState().properties.find((p) => p.id === propertyId);
    expect(prop2!.measurements.length).toBe(0);
  });

  it('should clear activeMeasurement if the deleted measurement was the active one', () => {
    useStore.getState().startNewMeasurement();
    useStore.getState().addVertex(40.0, -90.0);
    useStore.getState().saveMeasurement();

    const savedId = useStore.getState().activeMeasurement!.id;
    expect(useStore.getState().activeMeasurement).not.toBeNull();

    useStore.getState().deleteSavedMeasurement(savedId);
    expect(useStore.getState().activeMeasurement).toBeNull();
    expect(useStore.getState()._undoStack.length).toBe(0);
    expect(useStore.getState()._redoStack.length).toBe(0);
  });

  it('should not clear activeMeasurement if a different measurement was deleted', () => {
    // Save first measurement
    useStore.getState().startNewMeasurement();
    useStore.getState().addVertex(40.0, -90.0);
    useStore.getState().saveMeasurement();
    const firstSavedId = useStore.getState().activeMeasurement!.id;

    // Start and save a second measurement
    useStore.getState().startNewMeasurement();
    useStore.getState().addVertex(40.001, -90.001);
    useStore.getState().saveMeasurement();
    const secondSavedId = useStore.getState().activeMeasurement!.id;

    // Active measurement is the second one; delete the first
    useStore.getState().deleteSavedMeasurement(firstSavedId);
    expect(useStore.getState().activeMeasurement).not.toBeNull();
    expect(useStore.getState().activeMeasurement!.id).toBe(secondSavedId);
  });
});

// --- Edge Cases in Existing Actions ---

describe('Edge Cases in Existing Actions', () => {
  beforeEach(() => {
    useStore.setState({
      properties: [],
      activePropertyId: null,
      activeMeasurement: null,
      isDrawingOutline: false,
      currentOutlineVertices: [],
      _undoStack: [],
      _redoStack: [],
    });
  });

  it('should return empty string when addEdge vertices do not exist', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    const edgeId = useStore.getState().addEdge('nonexistent-v1', 'nonexistent-v2', 'ridge');
    expect(edgeId).toBe('');
    expect(useStore.getState().activeMeasurement!.edges.length).toBe(0);
  });

  it('should return empty string when addEdge has one valid and one invalid vertex', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    const v1 = useStore.getState().addVertex(40.0, -90.0);
    const edgeId = useStore.getState().addEdge(v1, 'nonexistent-v2', 'ridge');
    expect(edgeId).toBe('');
    expect(useStore.getState().activeMeasurement!.edges.length).toBe(0);
  });

  it('should cascade deleteVertex to remove edges referencing that vertex', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    const v1 = useStore.getState().addVertex(40.0, -90.0);
    const v2 = useStore.getState().addVertex(40.001, -90.0);
    const v3 = useStore.getState().addVertex(40.001, -89.999);
    useStore.getState().addEdge(v1, v2, 'ridge');
    useStore.getState().addEdge(v2, v3, 'hip');

    expect(useStore.getState().activeMeasurement!.edges.length).toBe(2);

    // Delete v2 — should remove both edges since both reference v2
    useStore.getState().deleteVertex(v2);
    expect(useStore.getState().activeMeasurement!.vertices.length).toBe(2);
    expect(useStore.getState().activeMeasurement!.edges.length).toBe(0);
  });

  it('should cascade deleteVertex to remove facets referencing that vertex', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();

    // Create a facet via outline
    useStore.getState().setDrawingMode('outline');
    useStore.getState().addOutlinePoint(40.0, -90.0);
    useStore.getState().addOutlinePoint(40.001, -90.0);
    useStore.getState().addOutlinePoint(40.001, -89.999);
    useStore.getState().finishOutline();

    expect(useStore.getState().activeMeasurement!.facets.length).toBe(1);

    // Get one of the vertices used by the facet
    const vertexId = useStore.getState().activeMeasurement!.facets[0].vertexIds[0];
    useStore.getState().deleteVertex(vertexId);

    expect(useStore.getState().activeMeasurement!.facets.length).toBe(0);
  });

  it('should do nothing in startNewMeasurement if no activePropertyId', () => {
    // activePropertyId is null from beforeEach
    useStore.getState().startNewMeasurement();
    expect(useStore.getState().activeMeasurement).toBeNull();
  });

  it('should set isDrawingOutline true and clear outline vertices when setDrawingMode to outline', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();

    // Add some outline vertices first in a different mode
    useStore.setState({ currentOutlineVertices: [{ id: 'temp', lat: 40.0, lng: -90.0 }] });

    useStore.getState().setDrawingMode('outline');
    expect(useStore.getState().isDrawingOutline).toBe(true);
    expect(useStore.getState().currentOutlineVertices.length).toBe(0);
  });

  it('should clear selections and edgeStartVertexId when changing drawing mode', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    useStore.setState({
      selectedVertexId: 'v1',
      selectedEdgeId: 'e1',
      selectedFacetId: 'f1',
      edgeStartVertexId: 'v2',
    });

    useStore.getState().setDrawingMode('ridge');
    expect(useStore.getState().selectedVertexId).toBeNull();
    expect(useStore.getState().selectedEdgeId).toBeNull();
    expect(useStore.getState().selectedFacetId).toBeNull();
    expect(useStore.getState().edgeStartVertexId).toBeNull();
  });

  it('should just clear outline without creating facet when finishOutline with < 3 points', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    useStore.getState().setDrawingMode('outline');
    useStore.getState().addOutlinePoint(40.0, -90.0);
    useStore.getState().addOutlinePoint(40.001, -90.0);
    // Only 2 points, not enough for a facet

    useStore.getState().finishOutline();

    expect(useStore.getState().isDrawingOutline).toBe(false);
    expect(useStore.getState().currentOutlineVertices.length).toBe(0);
    expect(useStore.getState().activeMeasurement!.facets.length).toBe(0);
    expect(useStore.getState().activeMeasurement!.vertices.length).toBe(0);
  });

  it('should do nothing in clearAll with no activePropertyId', () => {
    // activePropertyId is null, no measurement
    const before = useStore.getState().activeMeasurement;
    useStore.getState().clearAll();
    expect(useStore.getState().activeMeasurement).toBe(before);
  });

  it('should do nothing in clearAll with no activePropertyId even if measurement exists', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    useStore.getState().addVertex(40.0, -90.0);

    // Now clear activePropertyId but keep the measurement
    useStore.setState({ activePropertyId: null });
    const measurementBefore = useStore.getState().activeMeasurement;

    useStore.getState().clearAll();
    expect(useStore.getState().activeMeasurement).toEqual(measurementBefore);
  });
});
