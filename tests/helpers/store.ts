/**
 * Store utilities for tests.
 * Provides helpers for resetting and setting up common store states.
 */
import { useStore } from '../../src/store/useStore';

/**
 * Reset the store to its initial default state.
 * Call this in beforeEach to ensure test isolation.
 */
export function resetStore(): void {
  useStore.setState({
    token: null,
    username: null,
    isAuthenticated: false,
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
    mapType: 'satellite',
    mapCenter: { lat: 39.8283, lng: -98.5795 },
    mapZoom: 5,
    sidebarOpen: true,
    activePanel: 'tools',
    _undoStack: [],
    _redoStack: [],
    selectedDamageId: null,
    activeDamageType: 'hail',
    activeDamageSeverity: 'moderate',
    adjusters: [],
    inspections: [],
    roofCondition: null,
    showVertexMarkers: true,
  });
}

/**
 * Create a property and start a new measurement on it.
 * Returns { propertyId, measurementId }.
 */
export function setupPropertyAndMeasurement(
  address = '123 Main St',
  lat = 39.7817,
  lng = -89.6501,
): { propertyId: string } {
  const { createProperty, startNewMeasurement } = useStore.getState();
  const propertyId = createProperty(address, 'Springfield', 'IL', '62701', lat, lng);
  startNewMeasurement();
  return { propertyId };
}

/**
 * Create a property, start a measurement, and draw a rectangular outline.
 * Returns { propertyId } with the outline applied to activeMeasurement.
 */
export function setupPropertyWithOutline(
  lat = 39.7817,
  lng = -89.6501,
): { propertyId: string } {
  const { propertyId } = setupPropertyAndMeasurement('123 Main St', lat, lng);
  const { addOutlinePoint, finishOutline, setDrawingMode } = useStore.getState();

  setDrawingMode('outline');

  // Draw a rectangular outline (~55ft x 36ft)
  const offset = 0.00025;
  addOutlinePoint(lat + offset, lng - offset);
  addOutlinePoint(lat + offset, lng + offset);
  addOutlinePoint(lat - offset, lng + offset);
  addOutlinePoint(lat - offset, lng - offset);
  finishOutline();

  return { propertyId };
}

/**
 * Create a property, apply auto-measurement, and optionally change edge types.
 * Useful for integration tests that need a fully populated measurement.
 */
export function setupPropertyWithEdges(
  edgeTypes?: ('ridge' | 'hip' | 'valley' | 'rake' | 'eave' | 'flashing')[],
): { propertyId: string } {
  const { propertyId } = setupPropertyWithOutline();

  if (edgeTypes) {
    const state = useStore.getState();
    const measurement = state.activeMeasurement;
    if (measurement) {
      // Update edge types to match requested types
      const edges = measurement.edges;
      for (let i = 0; i < Math.min(edges.length, edgeTypes.length); i++) {
        state.updateEdgeType(edges[i].id, edgeTypes[i]);
      }
    }
  }

  return { propertyId };
}
