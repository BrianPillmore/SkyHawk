/**
 * Integration: detectRoofEdges -> applyAutoMeasurement -> store state.
 * Mock: fetch only (for API calls).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useStore } from '../../src/store/useStore';
import { detectRoofEdges } from '../../src/services/visionApi';
import { resetStore, setupPropertyAndMeasurement } from '../helpers/store';
import { setupFetchMock, claudeEdgesResponse, mockResponse } from '../helpers/mocks';
import { STANDARD_BOUNDS } from '../helpers/fixtures';
import type { ReconstructedRoof } from '../../src/types/solar';

describe('Vision -> Store Pipeline', () => {
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

  // Helper to apply detected edges to store
  function applyToStore(detected: Awaited<ReturnType<typeof detectRoofEdges>>, pitch: number = 6) {
    const reconstructed: ReconstructedRoof = {
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
    useStore.getState().applyAutoMeasurement(reconstructed);
  }

  it('should produce lat/lng vertices in store from pixel edges', async () => {
    fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
      { type: 'eave', start: { x: 100, y: 100 }, end: { x: 500, y: 100 } },
      { type: 'eave', start: { x: 500, y: 100 }, end: { x: 500, y: 500 } },
      { type: 'eave', start: { x: 500, y: 500 }, end: { x: 100, y: 500 } },
      { type: 'eave', start: { x: 100, y: 500 }, end: { x: 100, y: 100 } },
    ]));

    const detected = await detectRoofEdges('base64', STANDARD_BOUNDS, 640);
    applyToStore(detected);

    const m = useStore.getState().activeMeasurement!;
    expect(m.vertices.length).toBe(4);
    for (const v of m.vertices) {
      expect(v.lat).toBeGreaterThan(STANDARD_BOUNDS.south);
      expect(v.lat).toBeLessThan(STANDARD_BOUNDS.north);
      expect(v.lng).toBeGreaterThan(STANDARD_BOUNDS.west);
      expect(v.lng).toBeLessThan(STANDARD_BOUNDS.east);
    }
  });

  it('should deduplicate shared vertices', async () => {
    fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
      { type: 'eave', start: { x: 100, y: 100 }, end: { x: 300, y: 100 } },
      { type: 'ridge', start: { x: 300, y: 100 }, end: { x: 300, y: 300 } },
      { type: 'eave', start: { x: 300, y: 300 }, end: { x: 100, y: 100 } },
    ]));

    const detected = await detectRoofEdges('base64', STANDARD_BOUNDS, 640);
    // Shared endpoint (300,100) should be deduplicated
    expect(detected.edges[0].endIndex).toBe(detected.edges[1].startIndex);
    // shared endpoint (100,100) for edge 0 start and edge 2 end
    expect(detected.edges[0].startIndex).toBe(detected.edges[2].endIndex);
  });

  it('should use Solar pitch when available', async () => {
    fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
      { type: 'eave', start: { x: 100, y: 100 }, end: { x: 500, y: 100 } },
      { type: 'eave', start: { x: 500, y: 100 }, end: { x: 500, y: 500 } },
      { type: 'eave', start: { x: 500, y: 500 }, end: { x: 100, y: 500 } },
      { type: 'eave', start: { x: 100, y: 500 }, end: { x: 100, y: 100 } },
    ]));

    const detected = await detectRoofEdges('base64', STANDARD_BOUNDS, 640);
    // Apply with Solar pitch of 8/12
    applyToStore(detected, 8);

    const m = useStore.getState().activeMeasurement!;
    expect(m.facets[0].pitch).toBe(8);
    expect(m.predominantPitch).toBe(8);
  });

  it('should use AI pitch as fallback when no Solar data', async () => {
    fetchMock.mockResolvedValueOnce(claudeEdgesResponse(
      [
        { type: 'eave', start: { x: 100, y: 100 }, end: { x: 500, y: 100 } },
        { type: 'eave', start: { x: 500, y: 500 }, end: { x: 100, y: 100 } },
      ],
      { pitchDeg: 30 },
    ));

    const detected = await detectRoofEdges('base64', STANDARD_BOUNDS, 640);
    expect(detected.estimatedPitchDegrees).toBe(30);
    // Convert: pitch = tan(30°)*12 ≈ 6.93 → round to 7
    const pitchOver12 = Math.round(Math.tan(30 * Math.PI / 180) * 12);
    applyToStore(detected, pitchOver12);

    const m = useStore.getState().activeMeasurement!;
    expect(m.facets[0].pitch).toBe(pitchOver12);
  });

  it('should handle error: no edges returned', async () => {
    const json = JSON.stringify({
      edges: [],
      roofType: 'flat',
      estimatedPitchDegrees: 0,
      confidence: 0.5,
    });
    fetchMock.mockResolvedValueOnce(mockResponse({ content: [{ type: 'text', text: json }] }));

    await expect(detectRoofEdges('base64', STANDARD_BOUNDS, 640))
      .rejects.toThrow('AI detected no roof edges');
  });

  it('should handle error: bad status code', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ error: 'Bad' }, { status: 500 }));

    await expect(detectRoofEdges('base64', STANDARD_BOUNDS, 640))
      .rejects.toThrow('Edge detection API error: 500');
  });

  it('should handle error: no JSON in response', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({
      content: [{ type: 'text', text: 'I cannot analyze this image' }],
    }));

    await expect(detectRoofEdges('base64', STANDARD_BOUNDS, 640))
      .rejects.toThrow('Could not parse edge detection response');
  });

  it('should produce measurable areas after full pipeline', async () => {
    fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
      { type: 'eave', start: { x: 100, y: 100 }, end: { x: 500, y: 100 } },
      { type: 'eave', start: { x: 500, y: 100 }, end: { x: 500, y: 500 } },
      { type: 'eave', start: { x: 500, y: 500 }, end: { x: 100, y: 500 } },
      { type: 'eave', start: { x: 100, y: 500 }, end: { x: 100, y: 100 } },
    ]));

    const detected = await detectRoofEdges('base64', STANDARD_BOUNDS, 640);
    applyToStore(detected);

    const m = useStore.getState().activeMeasurement!;
    expect(m.totalAreaSqFt).toBeGreaterThan(0);
    expect(m.totalTrueAreaSqFt).toBeGreaterThan(0);
    expect(m.totalSquares).toBeGreaterThan(0);
    expect(m.totalEaveLf).toBeGreaterThan(0);
  });

  it('should set mode to select after pipeline', async () => {
    fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
      { type: 'eave', start: { x: 100, y: 100 }, end: { x: 500, y: 100 } },
      { type: 'eave', start: { x: 500, y: 500 }, end: { x: 100, y: 100 } },
    ]));

    const detected = await detectRoofEdges('base64', STANDARD_BOUNDS, 640);
    applyToStore(detected);

    expect(useStore.getState().drawingMode).toBe('select');
  });

  it('should handle mixed edge types from AI', async () => {
    fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
      { type: 'eave', start: { x: 100, y: 100 }, end: { x: 500, y: 100 } },
      { type: 'rake', start: { x: 500, y: 100 }, end: { x: 500, y: 500 } },
      { type: 'eave', start: { x: 500, y: 500 }, end: { x: 100, y: 500 } },
      { type: 'rake', start: { x: 100, y: 500 }, end: { x: 100, y: 100 } },
      { type: 'ridge', start: { x: 100, y: 300 }, end: { x: 500, y: 300 } },
    ]));

    const detected = await detectRoofEdges('base64', STANDARD_BOUNDS, 640);
    applyToStore(detected);

    const m = useStore.getState().activeMeasurement!;
    expect(m.totalEaveLf).toBeGreaterThan(0);
    expect(m.totalRakeLf).toBeGreaterThan(0);
    expect(m.totalRidgeLf).toBeGreaterThan(0);
  });
});
