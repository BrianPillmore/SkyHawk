/**
 * Acceptance: Auto-detect end-to-end workflow.
 * Mock: fetch (for Solar, Maps Static, Vision API).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useStore } from '../../src/store/useStore';
import { detectRoofEdges } from '../../src/services/visionApi';
import { resetStore, setupPropertyAndMeasurement } from '../helpers/store';
import { setupFetchMock, claudeEdgesResponse, mockResponse } from '../helpers/mocks';
import { STANDARD_BOUNDS } from '../helpers/fixtures';
import type { ReconstructedRoof } from '../../src/types/solar';

describe('Auto-Detect Workflow', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetStore();
    setupPropertyAndMeasurement();
    fetchMock = setupFetchMock();
    useStore.setState({ token: 'test-token' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function buildReconstructed(detected: Awaited<ReturnType<typeof detectRoofEdges>>, pitch: number): ReconstructedRoof {
    return {
      vertices: detected.vertices,
      edges: detected.edges.map(e => ({
        startIndex: e.startIndex,
        endIndex: e.endIndex,
        type: e.type as 'ridge' | 'hip' | 'valley' | 'rake' | 'eave' | 'flashing',
      })),
      facets: [{
        vertexIndices: detected.vertices.map((_, i) => i),
        pitch,
        name: '#1 Roof',
      }],
      roofType: detected.roofType,
      confidence: detected.confidence >= 0.7 ? 'high' : 'medium',
    };
  }

  it('should complete Solar pitch + AI edge detection + store pipeline', async () => {
    // AI detects edges
    fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
      { type: 'eave', start: { x: 100, y: 100 }, end: { x: 540, y: 100 } },
      { type: 'rake', start: { x: 540, y: 100 }, end: { x: 540, y: 540 } },
      { type: 'eave', start: { x: 540, y: 540 }, end: { x: 100, y: 540 } },
      { type: 'rake', start: { x: 100, y: 540 }, end: { x: 100, y: 100 } },
      { type: 'ridge', start: { x: 100, y: 320 }, end: { x: 540, y: 320 } },
    ], { roofType: 'gable', pitchDeg: 25 }));

    const detected = await detectRoofEdges('base64', STANDARD_BOUNDS, 640);
    // Solar pitch would be 8/12 (from Solar API segments)
    const solarPitch = 8;
    const reconstructed = buildReconstructed(detected, solarPitch);
    useStore.getState().applyAutoMeasurement(reconstructed);

    const m = useStore.getState().activeMeasurement!;
    expect(m.vertices.length).toBeGreaterThanOrEqual(4);
    expect(m.edges.length).toBe(5);
    expect(m.facets[0].pitch).toBe(8); // Solar pitch used
    expect(m.totalRidgeLf).toBeGreaterThan(0);
    expect(m.totalEaveLf).toBeGreaterThan(0);
    expect(m.totalRakeLf).toBeGreaterThan(0);
    expect(m.totalAreaSqFt).toBeGreaterThan(0);
  });

  it('should work with AI-only path (no Solar data)', async () => {
    fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
      { type: 'eave', start: { x: 100, y: 100 }, end: { x: 540, y: 100 } },
      { type: 'eave', start: { x: 540, y: 100 }, end: { x: 540, y: 540 } },
      { type: 'eave', start: { x: 540, y: 540 }, end: { x: 100, y: 540 } },
      { type: 'eave', start: { x: 100, y: 540 }, end: { x: 100, y: 100 } },
    ], { pitchDeg: 22 }));

    const detected = await detectRoofEdges('base64', STANDARD_BOUNDS, 640);
    // Use AI pitch since no Solar: tan(22°)*12 ≈ 4.8 → 5
    const aiPitch = Math.round(Math.tan(detected.estimatedPitchDegrees * Math.PI / 180) * 12);
    const reconstructed = buildReconstructed(detected, aiPitch);
    useStore.getState().applyAutoMeasurement(reconstructed);

    const m = useStore.getState().activeMeasurement!;
    expect(m.facets[0].pitch).toBe(aiPitch);
    expect(m.totalAreaSqFt).toBeGreaterThan(0);
  });

  it('should handle edge detection failure gracefully', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ error: 'API Error' }, { status: 500 }));

    await expect(detectRoofEdges('base64', STANDARD_BOUNDS, 640))
      .rejects.toThrow();

    // Store should be unchanged
    expect(useStore.getState().activeMeasurement!.vertices).toHaveLength(0);
  });

  it('should handle no edges detected', async () => {
    const json = JSON.stringify({ edges: [], roofType: 'flat', estimatedPitchDegrees: 0, confidence: 0.3 });
    fetchMock.mockResolvedValueOnce(mockResponse({ content: [{ type: 'text', text: json }] }));

    await expect(detectRoofEdges('base64', STANDARD_BOUNDS, 640))
      .rejects.toThrow('AI detected no roof edges');
  });

  it('should produce correct drawing state after workflow', async () => {
    fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
      { type: 'eave', start: { x: 100, y: 100 }, end: { x: 540, y: 100 } },
      { type: 'eave', start: { x: 540, y: 540 }, end: { x: 100, y: 100 } },
    ]));

    const detected = await detectRoofEdges('base64', STANDARD_BOUNDS, 640);
    const reconstructed = buildReconstructed(detected, 6);
    useStore.getState().applyAutoMeasurement(reconstructed);

    expect(useStore.getState().drawingMode).toBe('select');
    expect(useStore.getState().isDrawingOutline).toBe(false);
    expect(useStore.getState().edgeStartVertexId).toBeNull();
    expect(useStore.getState().selectedVertexId).toBeNull();
  });

  it('should allow editing after auto-detect', async () => {
    fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
      { type: 'eave', start: { x: 100, y: 100 }, end: { x: 540, y: 100 } },
      { type: 'eave', start: { x: 540, y: 100 }, end: { x: 540, y: 540 } },
      { type: 'eave', start: { x: 540, y: 540 }, end: { x: 100, y: 540 } },
      { type: 'eave', start: { x: 100, y: 540 }, end: { x: 100, y: 100 } },
    ]));

    const detected = await detectRoofEdges('base64', STANDARD_BOUNDS, 640);
    const reconstructed = buildReconstructed(detected, 6);
    useStore.getState().applyAutoMeasurement(reconstructed);

    // Should be able to update edge types
    const edgeId = useStore.getState().activeMeasurement!.edges[0].id;
    useStore.getState().updateEdgeType(edgeId, 'ridge');
    expect(useStore.getState().activeMeasurement!.totalRidgeLf).toBeGreaterThan(0);

    // Should be able to update pitch
    const facetId = useStore.getState().activeMeasurement!.facets[0].id;
    useStore.getState().updateFacetPitch(facetId, 10);
    expect(useStore.getState().activeMeasurement!.facets[0].pitch).toBe(10);
  });

  it('should support undo after auto-detect apply', async () => {
    fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
      { type: 'eave', start: { x: 100, y: 100 }, end: { x: 540, y: 540 } },
    ]));

    const detected = await detectRoofEdges('base64', STANDARD_BOUNDS, 640);
    const reconstructed = buildReconstructed(detected, 6);
    useStore.getState().applyAutoMeasurement(reconstructed);

    expect(useStore.getState().activeMeasurement!.edges.length).toBeGreaterThan(0);

    // Undo should revert to before auto-apply
    useStore.getState().undo();
    // After undo, the measurement should be the empty one from startNewMeasurement
    expect(useStore.getState().activeMeasurement!.edges).toHaveLength(0);
  });

  it('should handle complex roof with mixed edge types', async () => {
    fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
      { type: 'eave', start: { x: 50, y: 50 }, end: { x: 590, y: 50 } },
      { type: 'rake', start: { x: 590, y: 50 }, end: { x: 590, y: 590 } },
      { type: 'eave', start: { x: 590, y: 590 }, end: { x: 50, y: 590 } },
      { type: 'rake', start: { x: 50, y: 590 }, end: { x: 50, y: 50 } },
      { type: 'ridge', start: { x: 50, y: 320 }, end: { x: 590, y: 320 } },
      { type: 'hip', start: { x: 320, y: 50 }, end: { x: 320, y: 320 } },
      { type: 'valley', start: { x: 320, y: 320 }, end: { x: 320, y: 590 } },
    ], { roofType: 'complex', pitchDeg: 28, confidence: 0.65 }));

    const detected = await detectRoofEdges('base64', STANDARD_BOUNDS, 640);
    expect(detected.roofType).toBe('complex');
    expect(detected.edges.length).toBe(7);

    const reconstructed = buildReconstructed(detected, 7);
    useStore.getState().applyAutoMeasurement(reconstructed);

    const m = useStore.getState().activeMeasurement!;
    expect(m.totalRidgeLf).toBeGreaterThan(0);
    expect(m.totalHipLf).toBeGreaterThan(0);
    expect(m.totalValleyLf).toBeGreaterThan(0);
  });
});
