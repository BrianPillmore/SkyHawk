/**
 * Integration: applyAutoMeasurement with realistic ReconstructedRoof data.
 * No mocks — tests the store pipeline with real geometry calculations.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../src/store/useStore';
import { resetStore, setupPropertyAndMeasurement } from '../helpers/store';
import { createReconstructedRoof, createHipRoofReconstructed } from '../helpers/fixtures';

describe('Auto Measure Pipeline', () => {
  beforeEach(() => {
    resetStore();
    setupPropertyAndMeasurement();
  });

  // ─── Gable Roof ───────────────────────────────────────────────

  describe('gable roof', () => {
    it('should create correct vertex count', () => {
      const roof = createReconstructedRoof();
      useStore.getState().applyAutoMeasurement(roof);
      expect(useStore.getState().activeMeasurement!.vertices).toHaveLength(6);
    });

    it('should create correct edge count', () => {
      const roof = createReconstructedRoof();
      useStore.getState().applyAutoMeasurement(roof);
      expect(useStore.getState().activeMeasurement!.edges).toHaveLength(5);
    });

    it('should create correct facet count', () => {
      const roof = createReconstructedRoof();
      useStore.getState().applyAutoMeasurement(roof);
      expect(useStore.getState().activeMeasurement!.facets).toHaveLength(2);
    });

    it('should compute haversine edge lengths', () => {
      const roof = createReconstructedRoof();
      useStore.getState().applyAutoMeasurement(roof);
      const m = useStore.getState().activeMeasurement!;
      for (const e of m.edges) {
        expect(e.lengthFt).toBeGreaterThan(0);
        expect(typeof e.lengthFt).toBe('number');
        expect(isFinite(e.lengthFt)).toBe(true);
      }
    });

    it('should compute polygon areas for facets', () => {
      const roof = createReconstructedRoof();
      useStore.getState().applyAutoMeasurement(roof);
      const m = useStore.getState().activeMeasurement!;
      for (const f of m.facets) {
        expect(f.areaSqFt).toBeGreaterThan(0);
        expect(f.trueAreaSqFt).toBeGreaterThanOrEqual(f.areaSqFt);
      }
    });

    it('should compute pitch-adjusted areas', () => {
      const roof = createReconstructedRoof();
      useStore.getState().applyAutoMeasurement(roof);
      const m = useStore.getState().activeMeasurement!;
      // Pitch 6/12 -> multiplier ~1.118
      for (const f of m.facets) {
        const ratio = f.trueAreaSqFt / f.areaSqFt;
        expect(ratio).toBeCloseTo(Math.sqrt(1 + (6 / 12) ** 2), 2);
      }
    });
  });

  // ─── Hip Roof ─────────────────────────────────────────────────

  describe('hip roof', () => {
    it('should create 4 facets for hip roof', () => {
      const roof = createHipRoofReconstructed();
      useStore.getState().applyAutoMeasurement(roof);
      expect(useStore.getState().activeMeasurement!.facets).toHaveLength(4);
    });

    it('should create correct edge count (9 for hip)', () => {
      const roof = createHipRoofReconstructed();
      useStore.getState().applyAutoMeasurement(roof);
      expect(useStore.getState().activeMeasurement!.edges).toHaveLength(9);
    });

    it('should have ridge and hip edges', () => {
      const roof = createHipRoofReconstructed();
      useStore.getState().applyAutoMeasurement(roof);
      const m = useStore.getState().activeMeasurement!;
      expect(m.totalRidgeLf).toBeGreaterThan(0);
      expect(m.totalHipLf).toBeGreaterThan(0);
    });
  });

  // ─── Drawing State ────────────────────────────────────────────

  describe('drawing state after apply', () => {
    it('should set drawingMode to select', () => {
      useStore.getState().applyAutoMeasurement(createReconstructedRoof());
      expect(useStore.getState().drawingMode).toBe('select');
    });

    it('should clear all selections', () => {
      useStore.getState().applyAutoMeasurement(createReconstructedRoof());
      expect(useStore.getState().selectedVertexId).toBeNull();
      expect(useStore.getState().selectedEdgeId).toBeNull();
      expect(useStore.getState().selectedFacetId).toBeNull();
    });

    it('should push undo entry', () => {
      useStore.getState().applyAutoMeasurement(createReconstructedRoof());
      // The undo stack should have at least the pre-apply state
      expect(useStore.getState()._undoStack.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Measurement Totals ───────────────────────────────────────

  describe('measurement totals', () => {
    it('should compute totalAreaSqFt > 0', () => {
      useStore.getState().applyAutoMeasurement(createReconstructedRoof());
      expect(useStore.getState().activeMeasurement!.totalAreaSqFt).toBeGreaterThan(0);
    });

    it('should compute totalTrueAreaSqFt > totalAreaSqFt', () => {
      useStore.getState().applyAutoMeasurement(createReconstructedRoof());
      const m = useStore.getState().activeMeasurement!;
      expect(m.totalTrueAreaSqFt).toBeGreaterThan(m.totalAreaSqFt);
    });

    it('should compute totalSquares', () => {
      useStore.getState().applyAutoMeasurement(createReconstructedRoof());
      const m = useStore.getState().activeMeasurement!;
      expect(m.totalSquares).toBeCloseTo(m.totalTrueAreaSqFt / 100, 2);
    });

    it('should compute totalEaveLf > 0', () => {
      useStore.getState().applyAutoMeasurement(createReconstructedRoof());
      expect(useStore.getState().activeMeasurement!.totalEaveLf).toBeGreaterThan(0);
    });

    it('should compute totalRidgeLf > 0 for gable roof', () => {
      useStore.getState().applyAutoMeasurement(createReconstructedRoof());
      expect(useStore.getState().activeMeasurement!.totalRidgeLf).toBeGreaterThan(0);
    });

    it('should compute predominantPitch = 6', () => {
      useStore.getState().applyAutoMeasurement(createReconstructedRoof());
      expect(useStore.getState().activeMeasurement!.predominantPitch).toBe(6);
    });
  });

  // ─── Edge Cases ───────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle empty vertices/facets', () => {
      const roof = createReconstructedRoof({
        vertices: [],
        edges: [],
        facets: [],
      });
      useStore.getState().applyAutoMeasurement(roof);
      const m = useStore.getState().activeMeasurement!;
      expect(m.vertices).toHaveLength(0);
      expect(m.totalAreaSqFt).toBe(0);
    });

    it('should handle single-facet flat roof', () => {
      const roof = createReconstructedRoof({
        vertices: [
          { lat: 39.782, lng: -89.651 },
          { lat: 39.782, lng: -89.649 },
          { lat: 39.780, lng: -89.649 },
          { lat: 39.780, lng: -89.651 },
        ],
        edges: [
          { startIndex: 0, endIndex: 1, type: 'eave' },
          { startIndex: 1, endIndex: 2, type: 'eave' },
          { startIndex: 2, endIndex: 3, type: 'eave' },
          { startIndex: 3, endIndex: 0, type: 'eave' },
        ],
        facets: [{ vertexIndices: [0, 1, 2, 3], pitch: 0, name: '#1 Flat' }],
        roofType: 'flat',
      });
      useStore.getState().applyAutoMeasurement(roof);
      const m = useStore.getState().activeMeasurement!;
      expect(m.facets).toHaveLength(1);
      expect(m.facets[0].pitch).toBe(0);
      // For flat roof, true area equals flat area
      expect(m.facets[0].trueAreaSqFt).toBeCloseTo(m.facets[0].areaSqFt, 1);
    });

    it('should be no-op when activePropertyId is null', () => {
      resetStore(); // no property
      useStore.getState().applyAutoMeasurement(createReconstructedRoof());
      expect(useStore.getState().activeMeasurement).toBeNull();
    });
  });
});
