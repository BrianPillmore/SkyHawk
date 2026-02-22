/**
 * Extended unit tests for Zustand store — covers edge cases and code paths
 * not covered by store.test.ts.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../src/store/useStore';

function setupPropertyWithFacet() {
  const propId = useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
  useStore.getState().startNewMeasurement();
  useStore.getState().setDrawingMode('outline');
  useStore.getState().addOutlinePoint(40.0, -90.0);
  useStore.getState().addOutlinePoint(40.001, -90.0);
  useStore.getState().addOutlinePoint(40.001, -89.999);
  useStore.getState().finishOutline();
  return propId;
}

function resetState() {
  useStore.setState({
    properties: [],
    activePropertyId: null,
    activeMeasurement: null,
    drawingMode: 'pan',
    selectedVertexId: null,
    selectedEdgeId: null,
    selectedFacetId: null,
    isDrawingOutline: false,
    currentOutlineVertices: [],
    edgeStartVertexId: null,
    _undoStack: [],
    _redoStack: [],
    selectedDamageId: null,
    adjusters: [],
    inspections: [],
  });
}

describe('moveVertex', () => {
  beforeEach(resetState);

  it('should update vertex coordinates', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    const vId = useStore.getState().addVertex(40.0, -90.0);
    useStore.getState().moveVertex(vId, 41.0, -91.0);
    const v = useStore.getState().activeMeasurement!.vertices.find((v) => v.id === vId);
    expect(v!.lat).toBe(41.0);
    expect(v!.lng).toBe(-91.0);
  });

  it('should recalculate edge lengths connected to the moved vertex', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    const v1 = useStore.getState().addVertex(40.0, -90.0);
    const v2 = useStore.getState().addVertex(40.001, -90.0);
    useStore.getState().addEdge(v1, v2, 'ridge');
    const originalLength = useStore.getState().activeMeasurement!.edges[0].lengthFt;
    useStore.getState().moveVertex(v2, 40.01, -90.0);
    const newLength = useStore.getState().activeMeasurement!.edges[0].lengthFt;
    expect(newLength).toBeGreaterThan(originalLength);
  });

  it('should not modify edges not connected to the moved vertex', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    const v1 = useStore.getState().addVertex(40.0, -90.0);
    const v2 = useStore.getState().addVertex(40.001, -90.0);
    const v3 = useStore.getState().addVertex(40.002, -90.0);
    useStore.getState().addEdge(v1, v2, 'ridge');
    useStore.getState().addEdge(v2, v3, 'hip');
    const originalRidgeLen = useStore.getState().activeMeasurement!.edges[0].lengthFt;
    useStore.getState().moveVertex(v3, 40.01, -90.0);
    expect(useStore.getState().activeMeasurement!.edges[0].lengthFt).toBe(originalRidgeLen);
  });

  it('should push to undo stack', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    const vId = useStore.getState().addVertex(40.0, -90.0);
    const undoCountBefore = useStore.getState()._undoStack.length;
    useStore.getState().moveVertex(vId, 41.0, -91.0);
    expect(useStore.getState()._undoStack.length).toBe(undoCountBefore + 1);
  });

  it('should do nothing when activeMeasurement is null', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().moveVertex('fake-id', 41.0, -91.0);
    expect(useStore.getState().activeMeasurement).toBeNull();
  });
});

describe('deleteFacet', () => {
  beforeEach(resetState);

  it('should remove a facet by id', () => {
    setupPropertyWithFacet();
    const facetId = useStore.getState().activeMeasurement!.facets[0].id;
    useStore.getState().deleteFacet(facetId);
    expect(useStore.getState().activeMeasurement!.facets.length).toBe(0);
  });

  it('should clear selectedFacetId if the deleted facet was selected', () => {
    setupPropertyWithFacet();
    const facetId = useStore.getState().activeMeasurement!.facets[0].id;
    useStore.getState().selectFacet(facetId);
    useStore.getState().deleteFacet(facetId);
    expect(useStore.getState().selectedFacetId).toBeNull();
  });

  it('should not clear selectedFacetId if a different facet was deleted', () => {
    setupPropertyWithFacet();
    const facet1Id = useStore.getState().activeMeasurement!.facets[0].id;
    useStore.getState().setDrawingMode('outline');
    useStore.getState().addOutlinePoint(40.002, -90.002);
    useStore.getState().addOutlinePoint(40.003, -90.002);
    useStore.getState().addOutlinePoint(40.003, -89.998);
    useStore.getState().finishOutline();
    const facet2Id = useStore.getState().activeMeasurement!.facets[1].id;
    useStore.getState().selectFacet(facet1Id);
    useStore.getState().deleteFacet(facet2Id);
    expect(useStore.getState().selectedFacetId).toBe(facet1Id);
  });

  it('should recalculate measurements after deletion', () => {
    setupPropertyWithFacet();
    expect(useStore.getState().activeMeasurement!.totalTrueAreaSqFt).toBeGreaterThan(0);
    const facetId = useStore.getState().activeMeasurement!.facets[0].id;
    useStore.getState().deleteFacet(facetId);
    expect(useStore.getState().activeMeasurement!.totalTrueAreaSqFt).toBe(0);
  });

  it('should push to undo stack', () => {
    setupPropertyWithFacet();
    const undoCount = useStore.getState()._undoStack.length;
    const facetId = useStore.getState().activeMeasurement!.facets[0].id;
    useStore.getState().deleteFacet(facetId);
    expect(useStore.getState()._undoStack.length).toBe(undoCount + 1);
  });
});

describe('addFacet (direct)', () => {
  beforeEach(resetState);

  it('should create a facet with given vertices and pitch', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    const v1 = useStore.getState().addVertex(40.0, -90.0);
    const v2 = useStore.getState().addVertex(40.001, -90.0);
    const v3 = useStore.getState().addVertex(40.001, -89.999);
    const facetId = useStore.getState().addFacet('Test Facet', [v1, v2, v3], 8);
    expect(facetId).toBeTruthy();
    const facet = useStore.getState().activeMeasurement!.facets[0];
    expect(facet.name).toBe('Test Facet');
    expect(facet.pitch).toBe(8);
    expect(facet.areaSqFt).toBeGreaterThan(0);
    expect(facet.trueAreaSqFt).toBeGreaterThan(facet.areaSqFt);
  });

  it('should return empty string when no activeMeasurement', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    const id = useStore.getState().addFacet('Test', ['v1', 'v2', 'v3'], 6);
    expect(id).toBe('');
  });

  it('should handle non-existent vertex ids (area = 0)', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    const facetId = useStore.getState().addFacet('Empty', ['fake1', 'fake2'], 6);
    expect(facetId).toBeTruthy();
    expect(useStore.getState().activeMeasurement!.facets[0].areaSqFt).toBe(0);
  });

  it('should recalculate measurements after adding facet', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    const v1 = useStore.getState().addVertex(40.0, -90.0);
    const v2 = useStore.getState().addVertex(40.001, -90.0);
    const v3 = useStore.getState().addVertex(40.001, -89.999);
    useStore.getState().addFacet('Facet', [v1, v2, v3], 6);
    expect(useStore.getState().activeMeasurement!.totalTrueAreaSqFt).toBeGreaterThan(0);
    expect(useStore.getState().activeMeasurement!.predominantPitch).toBe(6);
  });
});

describe('addEdge edge cases', () => {
  beforeEach(resetState);

  it('should return empty string when no activeMeasurement', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    const id = useStore.getState().addEdge('v1', 'v2', 'ridge');
    expect(id).toBe('');
  });

  it('should clear edgeStartVertexId after successful add', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    const v1 = useStore.getState().addVertex(40.0, -90.0);
    const v2 = useStore.getState().addVertex(40.001, -90.0);
    useStore.setState({ edgeStartVertexId: v1 });
    useStore.getState().addEdge(v1, v2, 'ridge');
    expect(useStore.getState().edgeStartVertexId).toBeNull();
  });
});

describe('recalculateMeasurements with edge types', () => {
  beforeEach(resetState);

  it('should include step-flashing in total flashing length', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    const v1 = useStore.getState().addVertex(40.0, -90.0);
    const v2 = useStore.getState().addVertex(40.001, -90.0);
    const v3 = useStore.getState().addVertex(40.002, -90.0);
    useStore.getState().addEdge(v1, v2, 'flashing');
    useStore.getState().addEdge(v2, v3, 'step-flashing');
    const m = useStore.getState().activeMeasurement!;
    const f = m.edges.find((e) => e.type === 'flashing')!;
    const sf = m.edges.find((e) => e.type === 'step-flashing')!;
    expect(m.totalFlashingLf).toBeCloseTo(f.lengthFt + sf.lengthFt, 1);
  });

  it('should correctly compute drip edge as rake + eave', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    const v1 = useStore.getState().addVertex(40.0, -90.0);
    const v2 = useStore.getState().addVertex(40.001, -90.0);
    const v3 = useStore.getState().addVertex(40.001, -89.999);
    useStore.getState().addEdge(v1, v2, 'rake');
    useStore.getState().addEdge(v2, v3, 'eave');
    const m = useStore.getState().activeMeasurement!;
    expect(m.totalDripEdgeLf).toBeCloseTo(m.totalRakeLf + m.totalEaveLf, 1);
  });

  it('should compute all edge type totals separately', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    const vs = [];
    for (let i = 0; i < 6; i++) vs.push(useStore.getState().addVertex(40.0 + i * 0.001, -90.0));
    useStore.getState().addEdge(vs[0], vs[1], 'ridge');
    useStore.getState().addEdge(vs[1], vs[2], 'hip');
    useStore.getState().addEdge(vs[2], vs[3], 'valley');
    useStore.getState().addEdge(vs[3], vs[4], 'rake');
    useStore.getState().addEdge(vs[4], vs[5], 'eave');
    const m = useStore.getState().activeMeasurement!;
    expect(m.totalRidgeLf).toBeGreaterThan(0);
    expect(m.totalHipLf).toBeGreaterThan(0);
    expect(m.totalValleyLf).toBeGreaterThan(0);
    expect(m.totalRakeLf).toBeGreaterThan(0);
    expect(m.totalEaveLf).toBeGreaterThan(0);
  });
});

describe('applyAutoMeasurement', () => {
  beforeEach(resetState);

  it('should apply a reconstructed roof', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    useStore.getState().applyAutoMeasurement({
      vertices: [
        { lat: 40.0, lng: -90.0 },
        { lat: 40.001, lng: -90.0 },
        { lat: 40.001, lng: -89.999 },
        { lat: 40.0, lng: -89.999 },
      ],
      edges: [
        { startIndex: 0, endIndex: 1, type: 'eave' },
        { startIndex: 1, endIndex: 2, type: 'eave' },
        { startIndex: 2, endIndex: 3, type: 'eave' },
        { startIndex: 3, endIndex: 0, type: 'eave' },
        { startIndex: 0, endIndex: 2, type: 'ridge' },
      ],
      facets: [
        { vertexIndices: [0, 1, 2], pitch: 6, name: 'Facet 1' },
        { vertexIndices: [0, 2, 3], pitch: 6, name: 'Facet 2' },
      ],
      roofType: 'gable',
      confidence: 'high',
    });
    const m = useStore.getState().activeMeasurement!;
    expect(m.vertices.length).toBe(4);
    expect(m.edges.length).toBe(5);
    expect(m.facets.length).toBe(2);
    expect(m.totalTrueAreaSqFt).toBeGreaterThan(0);
  });

  it('should set drawing mode to select', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    useStore.getState().applyAutoMeasurement({
      vertices: [{ lat: 40.0, lng: -90.0 }],
      edges: [], facets: [], roofType: 'flat', confidence: 'medium',
    });
    expect(useStore.getState().drawingMode).toBe('select');
    expect(useStore.getState().isDrawingOutline).toBe(false);
  });

  it('should do nothing with no activePropertyId', () => {
    useStore.getState().applyAutoMeasurement({
      vertices: [{ lat: 40.0, lng: -90.0 }],
      edges: [], facets: [], roofType: 'flat', confidence: 'low',
    });
    expect(useStore.getState().activeMeasurement).toBeNull();
  });

  it('should calculate edge lengths', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    useStore.getState().applyAutoMeasurement({
      vertices: [{ lat: 40.0, lng: -90.0 }, { lat: 40.001, lng: -90.0 }],
      edges: [{ startIndex: 0, endIndex: 1, type: 'ridge' }],
      facets: [], roofType: 'shed', confidence: 'medium',
    });
    expect(useStore.getState().activeMeasurement!.edges[0].lengthFt).toBeGreaterThan(0);
  });

  it('should handle empty reconstructed roof', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    useStore.getState().applyAutoMeasurement({
      vertices: [], edges: [], facets: [], roofType: 'flat', confidence: 'low',
    });
    const m = useStore.getState().activeMeasurement!;
    expect(m.vertices.length).toBe(0);
    expect(m.edges.length).toBe(0);
  });
});

describe('saveMeasurement edge cases', () => {
  beforeEach(resetState);

  it('should do nothing when activeMeasurement is null', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().saveMeasurement();
    expect(useStore.getState().properties[0].measurements.length).toBe(0);
  });

  it('should do nothing when activePropertyId is null', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    useStore.setState({ activePropertyId: null });
    useStore.getState().saveMeasurement();
    expect(useStore.getState().properties[0].measurements.length).toBe(0);
  });
});

describe('deleteProperty edge cases', () => {
  beforeEach(resetState);

  it('should not change activePropertyId when deleting a non-active property', () => {
    useStore.getState().createProperty('Prop1', 'City', 'ST', '00000', 40.0, -90.0);
    const id2 = useStore.getState().createProperty('Prop2', 'City', 'ST', '00000', 41.0, -91.0);
    const id1 = useStore.getState().properties[0].id;
    useStore.getState().deleteProperty(id1);
    expect(useStore.getState().activePropertyId).toBe(id2);
    expect(useStore.getState().properties.length).toBe(1);
  });

  it('should clear activeMeasurement when deleting property that owns it', () => {
    const id = useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    useStore.getState().addVertex(40.0, -90.0);
    useStore.getState().deleteProperty(id);
    expect(useStore.getState().activeMeasurement).toBeNull();
  });

  it('should clear undo/redo stacks when deleting the active property', () => {
    const id = useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    useStore.getState().addVertex(40.0, -90.0);
    useStore.getState().deleteProperty(id);
    expect(useStore.getState()._undoStack.length).toBe(0);
    expect(useStore.getState()._redoStack.length).toBe(0);
  });
});

describe('setActiveProperty edge cases', () => {
  beforeEach(resetState);

  it('should clear activeMeasurement when switching properties', () => {
    const id1 = useStore.getState().createProperty('Prop1', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    useStore.getState().createProperty('Prop2', 'City', 'ST', '00000', 41.0, -91.0);
    useStore.getState().setActiveProperty(id1);
    expect(useStore.getState().activeMeasurement).toBeNull();
  });

  it('should clear undo/redo stacks when switching', () => {
    useStore.getState().createProperty('Prop1', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    useStore.getState().addVertex(40.0, -90.0);
    const id2 = useStore.getState().createProperty('Prop2', 'City', 'ST', '00000', 41.0, -91.0);
    useStore.getState().setActiveProperty(id2);
    expect(useStore.getState()._undoStack.length).toBe(0);
    expect(useStore.getState()._redoStack.length).toBe(0);
  });

  it('should set mapCenter when switching to a property', () => {
    useStore.getState().createProperty('Prop1', 'City', 'ST', '00000', 40.0, -90.0);
    const id2 = useStore.getState().createProperty('Prop2', 'City', 'ST', '00000', 41.0, -91.0);
    useStore.getState().setActiveProperty(id2);
    expect(useStore.getState().mapCenter.lat).toBe(41.0);
    expect(useStore.getState().mapCenter.lng).toBe(-91.0);
  });

  it('should handle setActiveProperty(null)', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().setActiveProperty(null);
    expect(useStore.getState().activePropertyId).toBeNull();
    expect(useStore.getState().activeMeasurement).toBeNull();
  });
});

describe('No-activeProperty guards', () => {
  beforeEach(resetState);

  it('deleteDamageAnnotation does nothing without active property', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    const id = useStore.getState().addDamageAnnotation(40.0, -90.0, 'hail', 'moderate', 'test');
    useStore.setState({ activePropertyId: null });
    useStore.getState().deleteDamageAnnotation(id);
    expect(useStore.getState().properties[0].damageAnnotations.length).toBe(1);
  });

  it('deleteSnapshot does nothing without active property', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    const id = useStore.getState().addSnapshot('test', 'data:png;base64,abc');
    useStore.setState({ activePropertyId: null });
    useStore.getState().deleteSnapshot(id);
    expect(useStore.getState().properties[0].snapshots.length).toBe(1);
  });

  it('updateClaimStatus does nothing without active property', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    const claimId = useStore.getState().addClaim('CLM', 'John', '2024-01-01');
    useStore.setState({ activePropertyId: null });
    useStore.getState().updateClaimStatus(claimId, 'approved');
    expect(useStore.getState().properties[0].claims[0].status).toBe('new');
  });

  it('updateClaimNotes does nothing without active property', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    const claimId = useStore.getState().addClaim('CLM', 'John', '2024-01-01');
    useStore.setState({ activePropertyId: null });
    useStore.getState().updateClaimNotes(claimId, 'some notes');
    expect(useStore.getState().properties[0].claims[0].notes).toBe('');
  });

  it('deleteClaim does nothing without active property', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    const claimId = useStore.getState().addClaim('CLM', 'John', '2024-01-01');
    useStore.setState({ activePropertyId: null });
    useStore.getState().deleteClaim(claimId);
    expect(useStore.getState().properties[0].claims.length).toBe(1);
  });

  it('deleteSavedMeasurement does nothing without active property', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    useStore.getState().saveMeasurement();
    const savedId = useStore.getState().activeMeasurement!.id;
    useStore.setState({ activePropertyId: null });
    useStore.getState().deleteSavedMeasurement(savedId);
    expect(useStore.getState().properties[0].measurements.length).toBe(1);
  });
});

describe('Undo/Redo with null activeMeasurement', () => {
  beforeEach(resetState);

  it('undo does nothing when activeMeasurement is null', () => {
    useStore.getState().undo();
    expect(useStore.getState().activeMeasurement).toBeNull();
  });

  it('redo does nothing when activeMeasurement is null', () => {
    useStore.getState().redo();
    expect(useStore.getState().activeMeasurement).toBeNull();
  });
});

describe('Drawing mode transitions', () => {
  beforeEach(resetState);

  it('should set isDrawingOutline to false for non-outline modes', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    for (const mode of ['select', 'ridge', 'hip', 'valley', 'rake', 'eave', 'pan'] as const) {
      useStore.getState().setDrawingMode(mode);
      expect(useStore.getState().isDrawingOutline).toBe(false);
    }
  });
});

describe('Outline edge structure', () => {
  beforeEach(resetState);

  it('should create closed polygon edges', () => {
    setupPropertyWithFacet();
    const m = useStore.getState().activeMeasurement!;
    expect(m.edges.length).toBe(3);
    for (const e of m.edges) expect(e.type).toBe('eave');
  });

  it('should name facets sequentially', () => {
    setupPropertyWithFacet();
    expect(useStore.getState().activeMeasurement!.facets[0].name).toBe('Facet 1');
    useStore.getState().setDrawingMode('outline');
    useStore.getState().addOutlinePoint(40.002, -90.002);
    useStore.getState().addOutlinePoint(40.003, -90.002);
    useStore.getState().addOutlinePoint(40.003, -89.998);
    useStore.getState().finishOutline();
    expect(useStore.getState().activeMeasurement!.facets[1].name).toBe('Facet 2');
  });

  it('finishOutline should switch to select mode', () => {
    setupPropertyWithFacet();
    expect(useStore.getState().drawingMode).toBe('select');
  });
});

describe('startOutline action', () => {
  beforeEach(resetState);

  it('should set isDrawingOutline and clear vertices', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    useStore.setState({ currentOutlineVertices: [{ id: 'old', lat: 0, lng: 0 }] });
    useStore.getState().startOutline();
    expect(useStore.getState().isDrawingOutline).toBe(true);
    expect(useStore.getState().currentOutlineVertices.length).toBe(0);
  });
});

describe('deleteEdge selection clearing', () => {
  beforeEach(resetState);

  it('should clear selectedEdgeId when deleting the selected edge', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    const v1 = useStore.getState().addVertex(40.0, -90.0);
    const v2 = useStore.getState().addVertex(40.001, -90.0);
    const edgeId = useStore.getState().addEdge(v1, v2, 'ridge');
    useStore.getState().selectEdge(edgeId);
    useStore.getState().deleteEdge(edgeId);
    expect(useStore.getState().selectedEdgeId).toBeNull();
  });

  it('should not clear selectedEdgeId when deleting a different edge', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    const v1 = useStore.getState().addVertex(40.0, -90.0);
    const v2 = useStore.getState().addVertex(40.001, -90.0);
    const v3 = useStore.getState().addVertex(40.002, -90.0);
    const e1 = useStore.getState().addEdge(v1, v2, 'ridge');
    const e2 = useStore.getState().addEdge(v2, v3, 'hip');
    useStore.getState().selectEdge(e1);
    useStore.getState().deleteEdge(e2);
    expect(useStore.getState().selectedEdgeId).toBe(e1);
  });
});

describe('deleteVertex selection clearing', () => {
  beforeEach(resetState);

  it('should clear selectedVertexId when deleting the selected vertex', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    const vId = useStore.getState().addVertex(40.0, -90.0);
    useStore.getState().selectVertex(vId);
    useStore.getState().deleteVertex(vId);
    expect(useStore.getState().selectedVertexId).toBeNull();
  });

  it('should not clear selectedVertexId when deleting a different vertex', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    const v1 = useStore.getState().addVertex(40.0, -90.0);
    const v2 = useStore.getState().addVertex(40.001, -90.0);
    useStore.getState().selectVertex(v1);
    useStore.getState().deleteVertex(v2);
    expect(useStore.getState().selectedVertexId).toBe(v1);
  });
});

describe('Multiple properties isolation', () => {
  beforeEach(resetState);

  it('damage annotations should only affect active property', () => {
    const id1 = useStore.getState().createProperty('P1', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().addDamageAnnotation(40.0, -90.0, 'hail', 'moderate', 'n1');
    const id2 = useStore.getState().createProperty('P2', 'City', 'ST', '00000', 41.0, -91.0);
    useStore.getState().addDamageAnnotation(41.0, -91.0, 'wind', 'severe', 'n2');
    expect(useStore.getState().properties.find((p) => p.id === id1)!.damageAnnotations.length).toBe(1);
    expect(useStore.getState().properties.find((p) => p.id === id2)!.damageAnnotations.length).toBe(1);
  });

  it('snapshots should only affect active property', () => {
    const id1 = useStore.getState().createProperty('P1', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().addSnapshot('Before', 'data:png;base64,abc');
    const id2 = useStore.getState().createProperty('P2', 'City', 'ST', '00000', 41.0, -91.0);
    useStore.getState().addSnapshot('After', 'data:png;base64,def');
    expect(useStore.getState().properties.find((p) => p.id === id1)!.snapshots.length).toBe(1);
    expect(useStore.getState().properties.find((p) => p.id === id2)!.snapshots.length).toBe(1);
  });
});

describe('Property creation completeness', () => {
  beforeEach(resetState);

  it('should set all property fields', () => {
    const id = useStore.getState().createProperty('123 Main', 'Springfield', 'IL', '62701', 39.78, -89.65);
    const p = useStore.getState().properties[0];
    expect(p.id).toBe(id);
    expect(p.address).toBe('123 Main');
    expect(p.city).toBe('Springfield');
    expect(p.state).toBe('IL');
    expect(p.zip).toBe('62701');
    expect(p.measurements).toEqual([]);
    expect(p.damageAnnotations).toEqual([]);
    expect(p.snapshots).toEqual([]);
    expect(p.claims).toEqual([]);
    expect(p.notes).toBe('');
  });
});

describe('Timestamp updates', () => {
  beforeEach(resetState);

  it('should update updatedAt when adding a vertex', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    const before = useStore.getState().activeMeasurement!.updatedAt;
    useStore.getState().addVertex(40.0, -90.0);
    const after = useStore.getState().activeMeasurement!.updatedAt;
    expect(new Date(after).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
  });

  it('should update updatedAt when adding an edge', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 40.0, -90.0);
    useStore.getState().startNewMeasurement();
    const v1 = useStore.getState().addVertex(40.0, -90.0);
    const v2 = useStore.getState().addVertex(40.001, -90.0);
    const before = useStore.getState().activeMeasurement!.updatedAt;
    useStore.getState().addEdge(v1, v2, 'ridge');
    const after = useStore.getState().activeMeasurement!.updatedAt;
    expect(new Date(after).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
  });
});
