/**
 * Acceptance: Full manual measurement workflow.
 * create property -> outline -> edges -> pitch -> save -> undo/redo
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../src/store/useStore';
import { resetStore } from '../helpers/store';

describe('Manual Measurement Workflow', () => {
  beforeEach(() => {
    resetStore();
  });

  it('should complete full 10-step workflow', () => {
    // Step 1: Create property
    const propId = useStore.getState().createProperty('123 Main St', 'Springfield', 'IL', '62701', 39.7817, -89.6501);
    expect(useStore.getState().activePropertyId).toBe(propId);
    expect(useStore.getState().mapZoom).toBe(20);

    // Step 2: Start new measurement
    useStore.getState().startNewMeasurement();
    expect(useStore.getState().activeMeasurement).not.toBeNull();
    expect(useStore.getState().drawingMode).toBe('outline');

    // Step 3: Draw rectangular outline
    const { addOutlinePoint, finishOutline } = useStore.getState();
    addOutlinePoint(39.7820, -89.6505);
    addOutlinePoint(39.7820, -89.6495);
    addOutlinePoint(39.7815, -89.6495);
    addOutlinePoint(39.7815, -89.6505);
    finishOutline();

    expect(useStore.getState().drawingMode).toBe('select');
    expect(useStore.getState().activeMeasurement!.vertices.length).toBe(4);
    expect(useStore.getState().activeMeasurement!.edges.length).toBe(4);
    expect(useStore.getState().activeMeasurement!.facets.length).toBe(1);

    // Step 4: Check initial area calculation
    const m = useStore.getState().activeMeasurement!;
    expect(m.totalAreaSqFt).toBeGreaterThan(0);
    expect(m.totalTrueAreaSqFt).toBeGreaterThan(m.totalAreaSqFt);
    expect(m.totalEaveLf).toBeGreaterThan(0);

    // Step 5: Add internal ridge edge
    const v1 = useStore.getState().addVertex(39.78175, -89.6505);
    const v2 = useStore.getState().addVertex(39.78175, -89.6495);
    const ridgeId = useStore.getState().addEdge(v1, v2, 'ridge');
    expect(ridgeId).toBeTruthy();
    expect(useStore.getState().activeMeasurement!.totalRidgeLf).toBeGreaterThan(0);

    // Step 6: Change an eave to a rake
    const eaveEdge = useStore.getState().activeMeasurement!.edges.find(e => e.type === 'eave');
    useStore.getState().updateEdgeType(eaveEdge!.id, 'rake');
    expect(useStore.getState().activeMeasurement!.totalRakeLf).toBeGreaterThan(0);

    // Step 7: Update facet pitch
    const facetId = useStore.getState().activeMeasurement!.facets[0].id;
    useStore.getState().updateFacetPitch(facetId, 8);
    expect(useStore.getState().activeMeasurement!.facets[0].pitch).toBe(8);
    expect(useStore.getState().activeMeasurement!.predominantPitch).toBe(8);

    // Step 8: Save measurement
    useStore.getState().saveMeasurement();
    const property = useStore.getState().properties.find(p => p.id === propId);
    expect(property!.measurements).toHaveLength(1);

    // Step 9: Undo (should restore pitch)
    useStore.getState().undo();
    // Pitch should go back to pre-updateFacetPitch state (6)
    expect(useStore.getState().activeMeasurement!.predominantPitch).toBe(6);

    // Step 10: Redo (should re-apply pitch)
    useStore.getState().redo();
    expect(useStore.getState().activeMeasurement!.predominantPitch).toBe(8);
  });

  it('should support multi-structure workflow', () => {
    // Create property
    const propId = useStore.getState().createProperty('456 Oak Ave', 'Chicago', 'IL', '60601', 41.8781, -87.6298);

    // Structure 1: Main house
    useStore.getState().startNewMeasurement();
    const { addOutlinePoint, finishOutline, setDrawingMode } = useStore.getState();
    setDrawingMode('outline');
    addOutlinePoint(41.8784, -87.6302);
    addOutlinePoint(41.8784, -87.6294);
    addOutlinePoint(41.8779, -87.6294);
    addOutlinePoint(41.8779, -87.6302);
    finishOutline();
    const area1 = useStore.getState().activeMeasurement!.totalAreaSqFt;
    useStore.getState().saveMeasurement();

    // Structure 2: Garage
    useStore.getState().startNewMeasurement();
    setDrawingMode('outline');
    useStore.getState().addOutlinePoint(41.8778, -87.6302);
    useStore.getState().addOutlinePoint(41.8778, -87.6298);
    useStore.getState().addOutlinePoint(41.8776, -87.6298);
    useStore.getState().addOutlinePoint(41.8776, -87.6302);
    useStore.getState().finishOutline();
    const area2 = useStore.getState().activeMeasurement!.totalAreaSqFt;
    useStore.getState().saveMeasurement();

    // Verify both saved
    const property = useStore.getState().properties.find(p => p.id === propId);
    expect(property!.measurements).toHaveLength(2);

    // Total area should be sum of both
    const totalArea = property!.measurements.reduce((s, m) => s + m.totalAreaSqFt, 0);
    expect(totalArea).toBeCloseTo(area1 + area2, 0);
  });

  it('should handle outline with < 3 points gracefully', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 39.78, -89.65);
    useStore.getState().startNewMeasurement();
    useStore.getState().addOutlinePoint(39.78, -89.65);
    useStore.getState().addOutlinePoint(39.79, -89.65);
    useStore.getState().finishOutline(); // Should cancel, not crash

    expect(useStore.getState().activeMeasurement!.facets).toHaveLength(0);
  });

  it('should handle cancelOutline', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 39.78, -89.65);
    useStore.getState().startNewMeasurement();
    useStore.getState().addOutlinePoint(39.78, -89.65);
    useStore.getState().addOutlinePoint(39.79, -89.65);
    useStore.getState().addOutlinePoint(39.79, -89.64);
    useStore.getState().cancelOutline();

    expect(useStore.getState().isDrawingOutline).toBe(false);
    expect(useStore.getState().currentOutlineVertices).toHaveLength(0);
    expect(useStore.getState().activeMeasurement!.facets).toHaveLength(0);
  });

  it('should handle clearAll', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 39.78, -89.65);
    useStore.getState().startNewMeasurement();
    useStore.getState().addOutlinePoint(39.78, -89.65);
    useStore.getState().addOutlinePoint(39.79, -89.65);
    useStore.getState().addOutlinePoint(39.79, -89.64);
    useStore.getState().finishOutline();
    expect(useStore.getState().activeMeasurement!.facets.length).toBeGreaterThan(0);

    useStore.getState().clearAll();
    expect(useStore.getState().activeMeasurement!.facets).toHaveLength(0);
    expect(useStore.getState().activeMeasurement!.edges).toHaveLength(0);
    expect(useStore.getState().activeMeasurement!.vertices).toHaveLength(0);
    expect(useStore.getState().drawingMode).toBe('outline');
  });

  it('should persist edge lengths through save/load cycle', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 39.78, -89.65);
    useStore.getState().startNewMeasurement();
    const { addOutlinePoint, finishOutline } = useStore.getState();
    addOutlinePoint(39.782, -89.651);
    addOutlinePoint(39.782, -89.649);
    addOutlinePoint(39.780, -89.649);
    addOutlinePoint(39.780, -89.651);
    finishOutline();

    const originalEdges = useStore.getState().activeMeasurement!.edges.map(e => ({
      type: e.type,
      lengthFt: e.lengthFt,
    }));

    useStore.getState().saveMeasurement();
    const savedId = useStore.getState().activeMeasurement!.id;

    useStore.getState().startNewMeasurement();
    useStore.getState().loadMeasurement(savedId);

    const loadedEdges = useStore.getState().activeMeasurement!.edges;
    for (let i = 0; i < originalEdges.length; i++) {
      expect(loadedEdges[i].type).toBe(originalEdges[i].type);
      expect(loadedEdges[i].lengthFt).toBeCloseTo(originalEdges[i].lengthFt, 5);
    }
  });

  it('should handle vertex selection workflow', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 39.78, -89.65);
    useStore.getState().startNewMeasurement();
    const vid = useStore.getState().addVertex(39.782, -89.651);
    useStore.getState().selectVertex(vid);
    expect(useStore.getState().selectedVertexId).toBe(vid);
    expect(useStore.getState().selectedEdgeId).toBeNull();
    expect(useStore.getState().selectedFacetId).toBeNull();

    useStore.getState().selectVertex(null);
    expect(useStore.getState().selectedVertexId).toBeNull();
  });

  it('should handle edge selection workflow', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 39.78, -89.65);
    useStore.getState().startNewMeasurement();
    const { addOutlinePoint, finishOutline } = useStore.getState();
    addOutlinePoint(39.782, -89.651);
    addOutlinePoint(39.782, -89.649);
    addOutlinePoint(39.780, -89.649);
    addOutlinePoint(39.780, -89.651);
    finishOutline();

    const edgeId = useStore.getState().activeMeasurement!.edges[0].id;
    useStore.getState().selectEdge(edgeId);
    expect(useStore.getState().selectedEdgeId).toBe(edgeId);
    expect(useStore.getState().selectedVertexId).toBeNull();
  });

  it('should handle facet selection workflow', () => {
    useStore.getState().createProperty('Test', 'City', 'ST', '00000', 39.78, -89.65);
    useStore.getState().startNewMeasurement();
    const { addOutlinePoint, finishOutline } = useStore.getState();
    addOutlinePoint(39.782, -89.651);
    addOutlinePoint(39.782, -89.649);
    addOutlinePoint(39.780, -89.649);
    addOutlinePoint(39.780, -89.651);
    finishOutline();

    const facetId = useStore.getState().activeMeasurement!.facets[0].id;
    useStore.getState().selectFacet(facetId);
    expect(useStore.getState().selectedFacetId).toBe(facetId);
    expect(useStore.getState().selectedVertexId).toBeNull();
    expect(useStore.getState().selectedEdgeId).toBeNull();
  });
});
