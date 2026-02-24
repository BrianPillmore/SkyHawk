/**
 * Unit tests for updateEdgeType store action.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useStore } from '../../src/store/useStore';
import { resetStore, setupPropertyWithOutline } from '../helpers/store';

describe('updateEdgeType', () => {
  beforeEach(() => {
    resetStore();
  });

  it('should change edge type from eave to ridge', () => {
    setupPropertyWithOutline();
    const edges = useStore.getState().activeMeasurement!.edges;
    const edgeId = edges[0].id;
    expect(edges[0].type).toBe('eave');

    useStore.getState().updateEdgeType(edgeId, 'ridge');
    const updated = useStore.getState().activeMeasurement!.edges.find(e => e.id === edgeId);
    expect(updated!.type).toBe('ridge');
  });

  it('should change edge type from eave to hip', () => {
    setupPropertyWithOutline();
    const edgeId = useStore.getState().activeMeasurement!.edges[0].id;
    useStore.getState().updateEdgeType(edgeId, 'hip');
    expect(useStore.getState().activeMeasurement!.edges.find(e => e.id === edgeId)!.type).toBe('hip');
  });

  it('should change edge type to valley', () => {
    setupPropertyWithOutline();
    const edgeId = useStore.getState().activeMeasurement!.edges[1].id;
    useStore.getState().updateEdgeType(edgeId, 'valley');
    expect(useStore.getState().activeMeasurement!.edges.find(e => e.id === edgeId)!.type).toBe('valley');
  });

  it('should change edge type to flashing', () => {
    setupPropertyWithOutline();
    const edgeId = useStore.getState().activeMeasurement!.edges[0].id;
    useStore.getState().updateEdgeType(edgeId, 'flashing');
    expect(useStore.getState().activeMeasurement!.edges.find(e => e.id === edgeId)!.type).toBe('flashing');
  });

  it('should change edge type to step-flashing', () => {
    setupPropertyWithOutline();
    const edgeId = useStore.getState().activeMeasurement!.edges[0].id;
    useStore.getState().updateEdgeType(edgeId, 'step-flashing');
    expect(useStore.getState().activeMeasurement!.edges.find(e => e.id === edgeId)!.type).toBe('step-flashing');
  });

  it('should push to undo stack', () => {
    setupPropertyWithOutline();
    const undoBefore = useStore.getState()._undoStack.length;
    const edgeId = useStore.getState().activeMeasurement!.edges[0].id;
    useStore.getState().updateEdgeType(edgeId, 'ridge');
    expect(useStore.getState()._undoStack.length).toBe(undoBefore + 1);
  });

  it('should clear redo stack', () => {
    setupPropertyWithOutline();
    // Create an undo entry then undo to populate redo
    const edgeId = useStore.getState().activeMeasurement!.edges[0].id;
    useStore.getState().updateEdgeType(edgeId, 'ridge');
    useStore.getState().undo();
    expect(useStore.getState()._redoStack.length).toBeGreaterThan(0);

    // updateEdgeType should clear redo
    useStore.getState().updateEdgeType(edgeId, 'hip');
    expect(useStore.getState()._redoStack.length).toBe(0);
  });

  it('should recalculate totalRidgeLf after changing to ridge', () => {
    setupPropertyWithOutline();
    expect(useStore.getState().activeMeasurement!.totalRidgeLf).toBe(0);
    const edgeId = useStore.getState().activeMeasurement!.edges[0].id;
    const edgeLength = useStore.getState().activeMeasurement!.edges[0].lengthFt;
    useStore.getState().updateEdgeType(edgeId, 'ridge');
    expect(useStore.getState().activeMeasurement!.totalRidgeLf).toBeCloseTo(edgeLength, 1);
  });

  it('should recalculate totalHipLf after changing to hip', () => {
    setupPropertyWithOutline();
    const edgeId = useStore.getState().activeMeasurement!.edges[0].id;
    const edgeLength = useStore.getState().activeMeasurement!.edges[0].lengthFt;
    useStore.getState().updateEdgeType(edgeId, 'hip');
    expect(useStore.getState().activeMeasurement!.totalHipLf).toBeCloseTo(edgeLength, 1);
  });

  it('should recalculate totalEaveLf after removing an eave', () => {
    setupPropertyWithOutline();
    const totalEaveBefore = useStore.getState().activeMeasurement!.totalEaveLf;
    const edgeId = useStore.getState().activeMeasurement!.edges[0].id;
    const edgeLength = useStore.getState().activeMeasurement!.edges[0].lengthFt;
    useStore.getState().updateEdgeType(edgeId, 'ridge');
    expect(useStore.getState().activeMeasurement!.totalEaveLf).toBeCloseTo(totalEaveBefore - edgeLength, 1);
  });

  it('should recalculate totalFlashingLf and totalStepFlashingLf separately', () => {
    setupPropertyWithOutline();
    const edges = useStore.getState().activeMeasurement!.edges;
    const len0 = edges[0].lengthFt;
    const len1 = edges[1].lengthFt;
    useStore.getState().updateEdgeType(edges[0].id, 'flashing');
    useStore.getState().updateEdgeType(edges[1].id, 'step-flashing');
    const m = useStore.getState().activeMeasurement!;
    // Flashing and step-flashing are tracked separately
    expect(m.totalFlashingLf).toBeCloseTo(len0, 1);
    expect(m.totalStepFlashingLf).toBeCloseTo(len1, 1);
    // Edge counts should also be tracked
    expect(m.flashingCount).toBe(1);
    expect(m.stepFlashingCount).toBe(1);
  });

  it('should recalculate totalDripEdgeLf (rake + eave)', () => {
    setupPropertyWithOutline();
    const edges = useStore.getState().activeMeasurement!.edges;
    const len0 = edges[0].lengthFt;
    useStore.getState().updateEdgeType(edges[0].id, 'rake');
    const m = useStore.getState().activeMeasurement!;
    // Drip edge = totalRakeLf + totalEaveLf
    expect(m.totalDripEdgeLf).toBeCloseTo(m.totalRakeLf + m.totalEaveLf, 1);
  });

  it('should be a no-op when activeMeasurement is null', () => {
    // No property/measurement set up
    expect(useStore.getState().activeMeasurement).toBeNull();
    // This should not throw
    useStore.getState().updateEdgeType('nonexistent', 'ridge');
    expect(useStore.getState().activeMeasurement).toBeNull();
  });

  it('should update updatedAt timestamp', () => {
    vi.useFakeTimers({ now: new Date('2025-01-01T00:00:00Z') });
    setupPropertyWithOutline();
    const before = useStore.getState().activeMeasurement!.updatedAt;
    vi.advanceTimersByTime(1000);
    const edgeId = useStore.getState().activeMeasurement!.edges[0].id;
    useStore.getState().updateEdgeType(edgeId, 'ridge');
    const after = useStore.getState().activeMeasurement!.updatedAt;
    expect(after).not.toBe(before);
    vi.useRealTimers();
  });

  it('should preserve all other edges unchanged', () => {
    setupPropertyWithOutline();
    const edges = useStore.getState().activeMeasurement!.edges;
    const targetId = edges[0].id;
    const otherEdges = edges.slice(1).map(e => ({ id: e.id, type: e.type }));

    useStore.getState().updateEdgeType(targetId, 'ridge');

    const updatedEdges = useStore.getState().activeMeasurement!.edges;
    for (const orig of otherEdges) {
      const found = updatedEdges.find(e => e.id === orig.id);
      expect(found).toBeDefined();
      expect(found!.type).toBe(orig.type);
    }
  });
});
