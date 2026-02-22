/**
 * Unit tests for detectRoofEdges from visionApi.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { detectRoofEdges } from '../../src/services/visionApi';
import { useStore } from '../../src/store/useStore';
import { setupFetchMock, claudeEdgesResponse, claudeResponse, mockResponse } from '../helpers/mocks';
import { STANDARD_BOUNDS } from '../helpers/fixtures';

describe('detectRoofEdges', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = setupFetchMock();
    useStore.setState({ token: 'test-token', isAuthenticated: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Pixel -> LatLng Conversion ────────────────────────────────

  describe('pixel to lat/lng conversion', () => {
    it('should convert top-left pixel (0,0) to north-west corner', async () => {
      fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
        { type: 'eave', start: { x: 0, y: 0 }, end: { x: 640, y: 0 } },
      ]));

      const result = await detectRoofEdges('base64data', STANDARD_BOUNDS, 640);
      // (0,0) -> north, west
      expect(result.vertices[0].lat).toBeCloseTo(STANDARD_BOUNDS.north, 4);
      expect(result.vertices[0].lng).toBeCloseTo(STANDARD_BOUNDS.west, 4);
    });

    it('should convert center pixel to center of bounds', async () => {
      fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
        { type: 'eave', start: { x: 320, y: 320 }, end: { x: 640, y: 320 } },
      ]));

      const result = await detectRoofEdges('base64data', STANDARD_BOUNDS, 640);
      const centerLat = (STANDARD_BOUNDS.north + STANDARD_BOUNDS.south) / 2;
      const centerLng = (STANDARD_BOUNDS.east + STANDARD_BOUNDS.west) / 2;
      expect(result.vertices[0].lat).toBeCloseTo(centerLat, 4);
      expect(result.vertices[0].lng).toBeCloseTo(centerLng, 4);
    });

    it('should convert bottom-right pixel to south-east corner', async () => {
      fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
        { type: 'eave', start: { x: 0, y: 0 }, end: { x: 640, y: 640 } },
      ]));

      const result = await detectRoofEdges('base64data', STANDARD_BOUNDS, 640);
      const endVertex = result.vertices[result.edges[0].endIndex];
      expect(endVertex.lat).toBeCloseTo(STANDARD_BOUNDS.south, 4);
      expect(endVertex.lng).toBeCloseTo(STANDARD_BOUNDS.east, 4);
    });

    it('should handle custom image sizes', async () => {
      fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
        { type: 'eave', start: { x: 512, y: 512 }, end: { x: 0, y: 0 } },
      ]));

      const result = await detectRoofEdges('base64data', STANDARD_BOUNDS, 1024);
      // (512, 512) on 1024x1024 = center
      const centerLat = (STANDARD_BOUNDS.north + STANDARD_BOUNDS.south) / 2;
      const centerLng = (STANDARD_BOUNDS.east + STANDARD_BOUNDS.west) / 2;
      expect(result.vertices[0].lat).toBeCloseTo(centerLat, 4);
      expect(result.vertices[0].lng).toBeCloseTo(centerLng, 4);
    });

    it('should handle non-square bounds', async () => {
      const asymmetricBounds = {
        north: 40.0,
        south: 39.0,
        east: -88.0,
        west: -90.0,
      };
      fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
        { type: 'eave', start: { x: 0, y: 0 }, end: { x: 640, y: 640 } },
      ]));

      const result = await detectRoofEdges('base64data', asymmetricBounds, 640);
      expect(result.vertices[0].lat).toBeCloseTo(40.0, 2);
      expect(result.vertices[0].lng).toBeCloseTo(-90.0, 2);
    });
  });

  // ─── Vertex Deduplication ──────────────────────────────────────

  describe('vertex deduplication', () => {
    it('should merge vertices within 3px tolerance', async () => {
      // Two edges share a nearly identical endpoint (1px apart)
      fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
        { type: 'eave', start: { x: 100, y: 100 }, end: { x: 200, y: 100 } },
        { type: 'eave', start: { x: 201, y: 101 }, end: { x: 300, y: 100 } },
      ]));

      const result = await detectRoofEdges('base64data', STANDARD_BOUNDS, 640);
      // The end of edge 1 and start of edge 2 should be merged
      expect(result.vertices.length).toBeLessThanOrEqual(3);
    });

    it('should keep vertices outside tolerance', async () => {
      // Two edges with endpoints far apart (50px)
      fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
        { type: 'eave', start: { x: 100, y: 100 }, end: { x: 200, y: 100 } },
        { type: 'eave', start: { x: 250, y: 100 }, end: { x: 350, y: 100 } },
      ]));

      const result = await detectRoofEdges('base64data', STANDARD_BOUNDS, 640);
      expect(result.vertices.length).toBe(4); // all unique
    });

    it('should assign correct indices after merge', async () => {
      fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
        { type: 'eave', start: { x: 100, y: 100 }, end: { x: 200, y: 100 } },
        { type: 'ridge', start: { x: 200, y: 100 }, end: { x: 300, y: 200 } },
      ]));

      const result = await detectRoofEdges('base64data', STANDARD_BOUNDS, 640);
      // The shared point at (200,100) should have the same index
      expect(result.edges[0].endIndex).toBe(result.edges[1].startIndex);
    });

    it('should skip zero-length edges after dedup', async () => {
      // Both endpoints of the second edge are the same after dedup
      fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
        { type: 'eave', start: { x: 100, y: 100 }, end: { x: 200, y: 200 } },
        { type: 'ridge', start: { x: 100, y: 100 }, end: { x: 101, y: 101 } }, // ~1px apart, same vertex after dedup
      ]));

      const result = await detectRoofEdges('base64data', STANDARD_BOUNDS, 640);
      // Zero-length edge should be filtered
      for (const e of result.edges) {
        expect(e.startIndex).not.toBe(e.endIndex);
      }
    });

    it('should merge multiple edges to same vertex', async () => {
      fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
        { type: 'eave', start: { x: 100, y: 100 }, end: { x: 300, y: 100 } },
        { type: 'eave', start: { x: 300, y: 100 }, end: { x: 300, y: 300 } },
        { type: 'eave', start: { x: 300, y: 300 }, end: { x: 100, y: 300 } },
        { type: 'eave', start: { x: 100, y: 300 }, end: { x: 100, y: 100 } },
      ]));

      const result = await detectRoofEdges('base64data', STANDARD_BOUNDS, 640);
      expect(result.vertices.length).toBe(4); // rectangle = 4 unique vertices
      expect(result.edges.length).toBe(4);
    });
  });

  // ─── Type Validation ───────────────────────────────────────────

  describe('edge type validation', () => {
    const validTypes = ['ridge', 'hip', 'valley', 'rake', 'eave', 'flashing'];

    for (const type of validTypes) {
      it(`should accept valid type: ${type}`, async () => {
        fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
          { type, start: { x: 100, y: 100 }, end: { x: 200, y: 200 } },
        ]));

        const result = await detectRoofEdges('base64data', STANDARD_BOUNDS, 640);
        expect(result.edges[0].type).toBe(type);
      });
    }

    it('should default unknown type to eave', async () => {
      fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
        { type: 'unknown-type', start: { x: 100, y: 100 }, end: { x: 200, y: 200 } },
      ]));

      const result = await detectRoofEdges('base64data', STANDARD_BOUNDS, 640);
      expect(result.edges[0].type).toBe('eave');
    });

    it('should default empty type to eave', async () => {
      fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
        { type: '', start: { x: 100, y: 100 }, end: { x: 200, y: 200 } },
      ]));

      const result = await detectRoofEdges('base64data', STANDARD_BOUNDS, 640);
      expect(result.edges[0].type).toBe('eave');
    });
  });

  // ─── Response Parsing ──────────────────────────────────────────

  describe('response parsing', () => {
    it('should parse plain JSON response', async () => {
      const json = JSON.stringify({
        edges: [{ type: 'eave', start: { x: 100, y: 100 }, end: { x: 200, y: 200 } }],
        roofType: 'gable',
        estimatedPitchDegrees: 25,
        confidence: 0.9,
      });
      fetchMock.mockResolvedValueOnce(claudeResponse(json));

      const result = await detectRoofEdges('base64data', STANDARD_BOUNDS, 640);
      expect(result.roofType).toBe('gable');
      expect(result.estimatedPitchDegrees).toBe(25);
      expect(result.confidence).toBe(0.9);
    });

    it('should parse markdown-wrapped JSON', async () => {
      const json = '```json\n' + JSON.stringify({
        edges: [{ type: 'ridge', start: { x: 100, y: 100 }, end: { x: 200, y: 200 } }],
        roofType: 'hip',
        estimatedPitchDegrees: 30,
        confidence: 0.7,
      }) + '\n```';
      fetchMock.mockResolvedValueOnce(claudeResponse(json));

      const result = await detectRoofEdges('base64data', STANDARD_BOUNDS, 640);
      expect(result.roofType).toBe('hip');
      expect(result.edges[0].type).toBe('ridge');
    });

    it('should throw on response with no JSON', async () => {
      fetchMock.mockResolvedValueOnce(claudeResponse('I cannot analyze this image.'));

      await expect(detectRoofEdges('base64data', STANDARD_BOUNDS, 640))
        .rejects.toThrow('Could not parse edge detection response');
    });

    it('should throw on empty edges array', async () => {
      const json = JSON.stringify({
        edges: [],
        roofType: 'flat',
        estimatedPitchDegrees: 0,
        confidence: 0.5,
      });
      fetchMock.mockResolvedValueOnce(claudeResponse(json));

      await expect(detectRoofEdges('base64data', STANDARD_BOUNDS, 640))
        .rejects.toThrow('AI detected no roof edges');
    });

    it('should use defaults for missing fields', async () => {
      const json = JSON.stringify({
        edges: [{ type: 'eave', start: { x: 100, y: 100 }, end: { x: 200, y: 200 } }],
        // roofType, estimatedPitchDegrees, confidence all missing
      });
      fetchMock.mockResolvedValueOnce(claudeResponse(json));

      const result = await detectRoofEdges('base64data', STANDARD_BOUNDS, 640);
      expect(result.roofType).toBe('complex'); // default
      expect(result.estimatedPitchDegrees).toBe(22); // default
      expect(result.confidence).toBe(0.5); // default
    });

    it('should throw on non-ok response', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ error: 'Server error' }, { status: 500 }));

      await expect(detectRoofEdges('base64data', STANDARD_BOUNDS, 640))
        .rejects.toThrow('Edge detection API error: 500');
    });

    it('should include auth header when token is present', async () => {
      fetchMock.mockResolvedValueOnce(claudeEdgesResponse([
        { type: 'eave', start: { x: 100, y: 100 }, end: { x: 200, y: 200 } },
      ]));

      await detectRoofEdges('base64data', STANDARD_BOUNDS, 640);

      const callArgs = fetchMock.mock.calls[0];
      const headers = callArgs[1].headers;
      expect(headers.Authorization).toBe('Bearer test-token');
    });
  });
});
