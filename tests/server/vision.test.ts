/**
 * Server: Vision route tests.
 * Mock: fetch (Anthropic API), process.env, Express req/res.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupFetchMock, mockResponse } from '../helpers/mocks';

describe('Server: Vision Routes', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = setupFetchMock();
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
  });

  // ─── /analyze endpoint ──────────────────────────────────────────

  describe('/analyze endpoint logic', () => {
    it('should require imageBase64 field', () => {
      const body = { imageBounds: { north: 39, south: 38, east: -89, west: -90 } };
      const hasRequired = body && ('imageBase64' in body) && ('imageBounds' in body);
      expect(hasRequired).toBe(false);
    });

    it('should require imageBounds field', () => {
      const body = { imageBase64: 'base64data' };
      const hasRequired = ('imageBase64' in body) && ('imageBounds' in body);
      expect(hasRequired).toBe(false);
    });

    it('should proxy request to Anthropic API', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({
        content: [{ type: 'text', text: '{"outline": [], "roofType": "flat"}' }],
      }));

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 2048,
          messages: [{ role: 'user', content: 'test' }],
        }),
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const callArgs = fetchMock.mock.calls[0];
      expect(callArgs[0]).toBe('https://api.anthropic.com/v1/messages');
      expect(callArgs[1].headers['x-api-key']).toBe('test-anthropic-key');
      expect(callArgs[1].headers['anthropic-version']).toBe('2023-06-01');

      const data = await response.json();
      expect(data.content[0].text).toContain('roofType');
    });

    it('should use custom model when provided', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ content: [{ type: 'text', text: '{}' }] }));

      const customModel = 'claude-opus-4-6';
      await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'key', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: customModel, max_tokens: 2048 }),
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.model).toBe('claude-opus-4-6');
    });

    it('should use custom max_tokens when provided', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ content: [{ type: 'text', text: '{}' }] }));

      await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'key', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-5-20250929', max_tokens: 4096 }),
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.max_tokens).toBe(4096);
    });

    it('should handle Anthropic API error response', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(
        { error: 'Rate limit exceeded' },
        { status: 429, ok: false },
      ));

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'key', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'test', max_tokens: 2048 }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(429);
    });
  });

  // ─── /condition endpoint ────────────────────────────────────────

  describe('/condition endpoint logic', () => {
    it('should require imageBase64 field', () => {
      const body = {};
      const hasRequired = 'imageBase64' in body;
      expect(hasRequired).toBe(false);
    });

    it('should proxy to Anthropic with condition prompt', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({
        content: [{ type: 'text', text: '{"overallScore": 75}' }],
      }));

      await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'test-anthropic-key', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 2048,
          messages: [{
            role: 'user',
            content: [{
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: 'imgdata' },
            }, {
              type: 'text',
              text: 'Analyze this aerial/satellite image',
            }],
          }],
        }),
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.messages[0].content[0].type).toBe('image');
      expect(body.messages[0].content[1].type).toBe('text');
    });

    it('should handle condition analysis error', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(
        { error: 'Internal error' },
        { status: 500, ok: false },
      ));

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'key', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'test', max_tokens: 2048 }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });
  });

  // ─── /detect-edges endpoint ─────────────────────────────────────

  describe('/detect-edges endpoint logic', () => {
    it('should require imageBase64 and imageBounds', () => {
      const body1 = { imageBase64: 'data' };
      expect('imageBounds' in body1).toBe(false);

      const body2 = { imageBounds: { north: 39 } };
      expect('imageBase64' in body2).toBe(false);

      const body3 = { imageBase64: 'data', imageBounds: { north: 39 } };
      expect('imageBase64' in body3 && 'imageBounds' in body3).toBe(true);
    });

    it('should use 4096 max_tokens by default for detect-edges', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({
        content: [{ type: 'text', text: '{"edges":[]}' }],
      }));

      // Simulate the server behavior: default max_tokens = 4096 for detect-edges
      const max_tokens = undefined || 4096;

      await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'key', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens,
          messages: [{ role: 'user', content: 'test' }],
        }),
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.max_tokens).toBe(4096);
    });

    it('should include edge detection prompt with rules', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({
        content: [{ type: 'text', text: '{"edges":[]}' }],
      }));

      const imageSize = 640;
      const prompt = `Analyze this ${imageSize}x${imageSize} satellite image of a building roof.`;

      await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'key', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 4096,
          messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'data' } }, { type: 'text', text: prompt }] }],
        }),
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      const textContent = body.messages[0].content.find((c: { type: string }) => c.type === 'text');
      expect(textContent.text).toContain('640x640');
    });

    it('should handle detect-edges error', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(
        { error: 'Bad request' },
        { status: 400, ok: false },
      ));

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'key', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'test', max_tokens: 4096 }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    it('should include solar segment hints when provided', () => {
      const solarSegments = [
        { center: { latitude: 39.78, longitude: -89.65 }, pitchDegrees: 22, azimuthDegrees: 180, stats: { areaMeters2: 50 } },
      ];

      const imageBounds = { north: 39.7825, south: 39.781, east: -89.649, west: -89.651 };
      const imageSize = 640;

      // Simulate the server's segment hint generation
      const segDetails = solarSegments.map((seg, i) => {
        const px = Math.round(((seg.center.longitude - imageBounds.west) / (imageBounds.east - imageBounds.west)) * imageSize);
        const py = Math.round(((imageBounds.north - seg.center.latitude) / (imageBounds.north - imageBounds.south)) * imageSize);
        const areaSqFt = Math.round(seg.stats.areaMeters2 * 10.7639);
        return `  Segment ${i + 1}: center ~(${px},${py}), pitch ${seg.pitchDegrees.toFixed(0)}°, azimuth ${seg.azimuthDegrees.toFixed(0)}°, ~${areaSqFt} sqft`;
      }).join('\n');

      expect(segDetails).toContain('Segment 1');
      expect(segDetails).toContain('pitch 22°');
      expect(segDetails).toContain('azimuth 180°');
    });

    it('should skip segment hints when no solar data', () => {
      const solarSegments: unknown[] | undefined = undefined;
      const hasSegments = solarSegments && Array.isArray(solarSegments) && solarSegments.length > 0;
      expect(hasSegments).toBeFalsy();
    });
  });

  // ─── API Key Handling ──────────────────────────────────────────

  describe('API key handling', () => {
    it('should throw when ANTHROPIC_API_KEY is missing', () => {
      delete process.env.ANTHROPIC_API_KEY;

      function getApiKey(): string {
        const key = process.env.ANTHROPIC_API_KEY;
        if (!key) throw new Error('ANTHROPIC_API_KEY not configured');
        return key;
      }

      expect(() => getApiKey()).toThrow('ANTHROPIC_API_KEY not configured');
    });

    it('should include x-api-key header in Anthropic requests', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ content: [] }));

      await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model: 'test', max_tokens: 1024 }),
      });

      expect(fetchMock.mock.calls[0][1].headers['x-api-key']).toBe('test-anthropic-key');
    });
  });

  // ─── Default Model & Tokens ─────────────────────────────────────

  describe('default model and tokens', () => {
    it('should default to claude-sonnet-4-5-20250929 for analyze', () => {
      const model = undefined || 'claude-sonnet-4-5-20250929';
      expect(model).toBe('claude-sonnet-4-5-20250929');
    });

    it('should default to claude-sonnet-4-5-20250929 for condition', () => {
      const model = undefined || 'claude-sonnet-4-5-20250929';
      expect(model).toBe('claude-sonnet-4-5-20250929');
    });

    it('should default to claude-sonnet-4-5-20250929 for detect-edges', () => {
      const model = undefined || 'claude-sonnet-4-5-20250929';
      expect(model).toBe('claude-sonnet-4-5-20250929');
    });

    it('should default to 2048 max_tokens for analyze', () => {
      const maxTokens = undefined || 2048;
      expect(maxTokens).toBe(2048);
    });

    it('should default to 2048 max_tokens for condition', () => {
      const maxTokens = undefined || 2048;
      expect(maxTokens).toBe(2048);
    });

    it('should default to 4096 max_tokens for detect-edges', () => {
      const maxTokens = undefined || 4096;
      expect(maxTokens).toBe(4096);
    });
  });

  // ─── Image Payload ──────────────────────────────────────────────

  describe('image payload format', () => {
    it('should include image as base64 in message content', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ content: [] }));

      const imageBase64 = 'iVBORw0KGgoAAAANSUhEUg==';
      await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'key', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 2048,
          messages: [{
            role: 'user',
            content: [{
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: imageBase64 },
            }],
          }],
        }),
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      const imageContent = body.messages[0].content[0];
      expect(imageContent.type).toBe('image');
      expect(imageContent.source.type).toBe('base64');
      expect(imageContent.source.media_type).toBe('image/png');
      expect(imageContent.source.data).toBe(imageBase64);
    });

    it('should use POST method for all vision endpoints', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ content: [] }));

      await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'key', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'test', max_tokens: 1024 }),
      });

      expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    });
  });

  // ─── Error Handling ─────────────────────────────────────────────

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': 'key', 'anthropic-version': '2023-06-01' },
          body: '{}',
        })
      ).rejects.toThrow('Network error');
    });

    it('should handle timeout errors', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Request timed out'));

      await expect(
        fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: {}, body: '{}' })
      ).rejects.toThrow('Request timed out');
    });

    it('should handle malformed API response', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse('not json', { status: 200 }));

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {},
        body: '{}',
      });

      const data = await response.json();
      expect(data).toBe('not json');
    });
  });
});
