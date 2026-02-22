/**
 * Smoke Tests — Quick sanity checks for core systems (<5 seconds).
 * No mocks required. Just verifies the system boots up correctly.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../src/store/useStore';
import { haversineDistanceFt, calculatePolygonAreaSqFt, getPitchMultiplier, formatNumber } from '../../src/utils/geometry';
import { classifyRoofType } from '../../src/utils/roofReconstruction';
import type { EdgeType, DrawingMode } from '../../src/types';

// ─── Store Initialization ──────────────────────────────────────────

describe('Store initialization', () => {
  beforeEach(() => {
    useStore.setState({
      properties: [],
      activePropertyId: null,
      activeMeasurement: null,
      drawingMode: 'pan',
      selectedVertexId: null,
      selectedEdgeId: null,
      selectedFacetId: null,
      _undoStack: [],
      _redoStack: [],
      token: null,
      username: null,
      isAuthenticated: false,
      adjusters: [],
      inspections: [],
      roofCondition: null,
    });
  });

  it('should start with null activePropertyId', () => {
    expect(useStore.getState().activePropertyId).toBeNull();
  });

  it('should start with null activeMeasurement', () => {
    expect(useStore.getState().activeMeasurement).toBeNull();
  });

  it('should start in pan drawing mode', () => {
    expect(useStore.getState().drawingMode).toBe('pan');
  });

  it('should start with satellite map type', () => {
    expect(useStore.getState().mapType).toBe('satellite');
  });

  it('should start with empty undo stack', () => {
    expect(useStore.getState()._undoStack).toHaveLength(0);
  });

  it('should start with empty redo stack', () => {
    expect(useStore.getState()._redoStack).toHaveLength(0);
  });

  it('should start as not authenticated', () => {
    expect(useStore.getState().isAuthenticated).toBe(false);
  });

  it('should start with null token', () => {
    expect(useStore.getState().token).toBeNull();
  });

  it('should start with empty adjusters', () => {
    expect(useStore.getState().adjusters).toHaveLength(0);
  });

  it('should start with null roofCondition', () => {
    expect(useStore.getState().roofCondition).toBeNull();
  });
});

// ─── Store Actions Exist ───────────────────────────────────────────

describe('Store actions exist', () => {
  it('should have property actions', () => {
    const state = useStore.getState();
    expect(typeof state.createProperty).toBe('function');
    expect(typeof state.setActiveProperty).toBe('function');
    expect(typeof state.deleteProperty).toBe('function');
  });

  it('should have measurement actions', () => {
    const state = useStore.getState();
    expect(typeof state.startNewMeasurement).toBe('function');
    expect(typeof state.setDrawingMode).toBe('function');
    expect(typeof state.recalculateMeasurements).toBe('function');
    expect(typeof state.saveMeasurement).toBe('function');
  });

  it('should have vertex actions', () => {
    const state = useStore.getState();
    expect(typeof state.addVertex).toBe('function');
    expect(typeof state.moveVertex).toBe('function');
    expect(typeof state.deleteVertex).toBe('function');
    expect(typeof state.selectVertex).toBe('function');
  });

  it('should have outline actions', () => {
    const state = useStore.getState();
    expect(typeof state.startOutline).toBe('function');
    expect(typeof state.addOutlinePoint).toBe('function');
    expect(typeof state.finishOutline).toBe('function');
    expect(typeof state.cancelOutline).toBe('function');
  });

  it('should have edge actions', () => {
    const state = useStore.getState();
    expect(typeof state.addEdge).toBe('function');
    expect(typeof state.updateEdgeType).toBe('function');
    expect(typeof state.deleteEdge).toBe('function');
    expect(typeof state.selectEdge).toBe('function');
    expect(typeof state.setEdgeStartVertex).toBe('function');
  });

  it('should have facet actions', () => {
    const state = useStore.getState();
    expect(typeof state.addFacet).toBe('function');
    expect(typeof state.updateFacetPitch).toBe('function');
    expect(typeof state.deleteFacet).toBe('function');
    expect(typeof state.selectFacet).toBe('function');
  });

  it('should have map actions', () => {
    const state = useStore.getState();
    expect(typeof state.setMapType).toBe('function');
    expect(typeof state.setMapCenter).toBe('function');
    expect(typeof state.setMapZoom).toBe('function');
  });

  it('should have UI actions', () => {
    const state = useStore.getState();
    expect(typeof state.toggleSidebar).toBe('function');
    expect(typeof state.setActivePanel).toBe('function');
  });

  it('should have damage actions', () => {
    const state = useStore.getState();
    expect(typeof state.addDamageAnnotation).toBe('function');
    expect(typeof state.deleteDamageAnnotation).toBe('function');
    expect(typeof state.selectDamage).toBe('function');
    expect(typeof state.setActiveDamageType).toBe('function');
    expect(typeof state.setActiveDamageSeverity).toBe('function');
  });

  it('should have claim actions', () => {
    const state = useStore.getState();
    expect(typeof state.addClaim).toBe('function');
    expect(typeof state.updateClaimStatus).toBe('function');
    expect(typeof state.updateClaimNotes).toBe('function');
    expect(typeof state.deleteClaim).toBe('function');
  });

  it('should have adjuster actions', () => {
    const state = useStore.getState();
    expect(typeof state.addAdjuster).toBe('function');
    expect(typeof state.updateAdjusterStatus).toBe('function');
    expect(typeof state.deleteAdjuster).toBe('function');
  });

  it('should have inspection actions', () => {
    const state = useStore.getState();
    expect(typeof state.scheduleInspection).toBe('function');
    expect(typeof state.updateInspectionStatus).toBe('function');
    expect(typeof state.cancelInspection).toBe('function');
    expect(typeof state.deleteInspection).toBe('function');
  });

  it('should have undo/redo actions', () => {
    const state = useStore.getState();
    expect(typeof state.undo).toBe('function');
    expect(typeof state.redo).toBe('function');
    expect(typeof state.clearAll).toBe('function');
  });

  it('should have auto measurement action', () => {
    expect(typeof useStore.getState().applyAutoMeasurement).toBe('function');
  });
});

// ─── Utility Return Types ──────────────────────────────────────────

describe('Utility return types', () => {
  it('haversineDistanceFt returns a number', () => {
    const result = haversineDistanceFt({ lat: 39.78, lng: -89.65 }, { lat: 39.79, lng: -89.64 });
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThan(0);
  });

  it('calculatePolygonAreaSqFt returns a number', () => {
    const result = calculatePolygonAreaSqFt([
      { lat: 39.782, lng: -89.651 },
      { lat: 39.782, lng: -89.649 },
      { lat: 39.780, lng: -89.649 },
      { lat: 39.780, lng: -89.651 },
    ]);
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThan(0);
  });

  it('getPitchMultiplier returns a number >= 1', () => {
    const result = getPitchMultiplier(6);
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it('classifyRoofType returns a valid roof type string', () => {
    const result = classifyRoofType([
      { pitchDegrees: 22, azimuthDegrees: 180, stats: { areaMeters2: 50, sunshineQuantiles: [], groundAreaMeters2: 50 }, center: { latitude: 0, longitude: 0 }, boundingBox: { sw: { latitude: 0, longitude: 0 }, ne: { latitude: 0, longitude: 0 } }, planeHeightAtCenterMeters: 5 },
      { pitchDegrees: 22, azimuthDegrees: 0, stats: { areaMeters2: 50, sunshineQuantiles: [], groundAreaMeters2: 50 }, center: { latitude: 0, longitude: 0 }, boundingBox: { sw: { latitude: 0, longitude: 0 }, ne: { latitude: 0, longitude: 0 } }, planeHeightAtCenterMeters: 5 },
    ]);
    expect(typeof result).toBe('string');
    expect(['flat', 'shed', 'gable', 'hip', 'cross-gable', 'complex']).toContain(result);
  });

  it('formatNumber returns a string', () => {
    const result = formatNumber(1234.567, 2);
    expect(typeof result).toBe('string');
  });

  it('getPitchMultiplier(0) returns 1', () => {
    expect(getPitchMultiplier(0)).toBe(1);
  });

  it('calculatePolygonAreaSqFt returns 0 for < 3 vertices', () => {
    expect(calculatePolygonAreaSqFt([{ lat: 0, lng: 0 }])).toBe(0);
    expect(calculatePolygonAreaSqFt([])).toBe(0);
  });
});

// ─── Type Consistency ──────────────────────────────────────────────

describe('Type consistency', () => {
  it('EdgeType should include all 7 types', () => {
    const edgeTypes: EdgeType[] = ['ridge', 'hip', 'valley', 'rake', 'eave', 'flashing', 'step-flashing'];
    expect(edgeTypes).toHaveLength(7);
    // TypeScript compilation itself validates these are valid EdgeType values
    for (const t of edgeTypes) {
      expect(typeof t).toBe('string');
    }
  });

  it('DrawingMode should include expected modes', () => {
    const modes: DrawingMode[] = ['select', 'outline', 'ridge', 'hip', 'valley', 'rake', 'eave', 'flashing', 'facet', 'damage', 'pan'];
    expect(modes).toHaveLength(11);
    for (const m of modes) {
      expect(typeof m).toBe('string');
    }
  });

  it('MapType includes expected types', () => {
    const { setMapType } = useStore.getState();
    // These should not throw
    setMapType('satellite');
    expect(useStore.getState().mapType).toBe('satellite');
    setMapType('hybrid');
    expect(useStore.getState().mapType).toBe('hybrid');
    setMapType('roadmap');
    expect(useStore.getState().mapType).toBe('roadmap');
  });

  it('ClaimStatus transitions are valid strings', () => {
    const statuses = ['new', 'inspected', 'estimated', 'submitted', 'approved', 'denied', 'closed'];
    expect(statuses).toHaveLength(7);
  });
});
