/**
 * Unit tests for analyzeRoofCondition from visionApi.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { analyzeRoofCondition } from '../../src/services/visionApi';
import { useStore } from '../../src/store/useStore';
import { setupFetchMock, claudeResponse, mockResponse } from '../helpers/mocks';

describe('analyzeRoofCondition', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = setupFetchMock();
    useStore.setState({ token: 'test-token', isAuthenticated: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should POST to /api/vision/condition', async () => {
    const conditionJson = JSON.stringify({
      overallScore: 75,
      estimatedAgeYears: 10,
      materialType: 'asphalt-shingle',
      materialConfidence: 0.85,
      damages: [],
      findings: ['Good condition'],
    });
    fetchMock.mockResolvedValueOnce(claudeResponse(conditionJson));

    await analyzeRoofCondition('base64image');

    expect(fetchMock).toHaveBeenCalledWith('/api/vision/condition', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('should include auth headers', async () => {
    fetchMock.mockResolvedValueOnce(claudeResponse(JSON.stringify({
      overallScore: 75, estimatedAgeYears: 10, materialType: 'asphalt-shingle',
      materialConfidence: 0.85, damages: [], findings: [],
    })));

    await analyzeRoofCondition('base64image');

    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[1].headers.Authorization).toBe('Bearer test-token');
  });

  it('should send imageBase64 in body', async () => {
    fetchMock.mockResolvedValueOnce(claudeResponse(JSON.stringify({
      overallScore: 75, estimatedAgeYears: 10, materialType: 'asphalt-shingle',
      materialConfidence: 0.85, damages: [], findings: [],
    })));

    await analyzeRoofCondition('myBase64Data');

    const callArgs = fetchMock.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.imageBase64).toBe('myBase64Data');
  });

  it('should parse valid JSON response', async () => {
    const conditionData = {
      overallScore: 82,
      estimatedAgeYears: 8,
      materialType: 'metal',
      materialConfidence: 0.92,
      damages: [
        { type: 'hail', severity: 'minor', description: 'Small dents', confidence: 0.7 },
      ],
      findings: ['Minor surface wear'],
    };
    fetchMock.mockResolvedValueOnce(claudeResponse(JSON.stringify(conditionData)));

    const result = await analyzeRoofCondition('base64image');

    expect(result.overallScore).toBe(82);
    expect(result.estimatedAgeYears).toBe(8);
    expect(result.materialType).toBe('metal');
    expect(result.damages).toHaveLength(1);
    expect(result.findings).toHaveLength(1);
  });

  it('should handle non-JSON response with defaults', async () => {
    // Claude returns non-parseable text
    fetchMock.mockResolvedValueOnce(mockResponse({
      content: [{ type: 'text', text: 'I cannot analyze this image properly.' }],
    }));

    const result = await analyzeRoofCondition('base64image');

    // Should return defaults
    expect(result.overallScore).toBe(50);
    expect(result.estimatedAgeYears).toBe(15);
    expect(result.materialType).toBe('unknown');
    expect(result.materialConfidence).toBe(0);
    expect(result.damages).toHaveLength(0);
    expect(result.findings).toContain('Unable to parse AI analysis results');
  });

  it('should throw on non-ok response', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ error: 'Server error' }, { status: 500 }));

    await expect(analyzeRoofCondition('base64image')).rejects.toThrow('Vision API error: 500');
  });

  it('should throw on 400 response', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ error: 'Bad request' }, { status: 400 }));

    await expect(analyzeRoofCondition('base64image')).rejects.toThrow('Vision API error: 400');
  });

  it('should handle empty content response with defaults', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ content: [] }));

    const result = await analyzeRoofCondition('base64image');
    // Falls back to default when content is empty
    expect(result.overallScore).toBe(50);
  });

  it('should handle response without content field', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({}));

    const result = await analyzeRoofCondition('base64image');
    expect(result.overallScore).toBe(50);
  });

  it('should work without auth token', async () => {
    useStore.setState({ token: null, isAuthenticated: false });
    fetchMock.mockResolvedValueOnce(claudeResponse(JSON.stringify({
      overallScore: 60, estimatedAgeYears: 20, materialType: 'tile',
      materialConfidence: 0.7, damages: [], findings: [],
    })));

    const result = await analyzeRoofCondition('base64image');
    expect(result.overallScore).toBe(60);

    // Should not have auth header
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[1].headers.Authorization).toBeUndefined();
  });

  it('should handle response with multiple damages', async () => {
    const conditionData = {
      overallScore: 35,
      estimatedAgeYears: 25,
      materialType: 'asphalt-shingle',
      materialConfidence: 0.95,
      damages: [
        { type: 'hail', severity: 'severe', description: 'Major impact damage', confidence: 0.9 },
        { type: 'wind', severity: 'moderate', description: 'Lifted shingles', confidence: 0.85 },
        { type: 'missing-shingle', severity: 'severe', description: 'Multiple missing', confidence: 0.95 },
      ],
      findings: ['Advanced deterioration', 'Multiple damage types'],
    };
    fetchMock.mockResolvedValueOnce(claudeResponse(JSON.stringify(conditionData)));

    const result = await analyzeRoofCondition('base64image');
    expect(result.damages).toHaveLength(3);
    expect(result.findings).toHaveLength(2);
  });

  it('should handle network errors', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network failure'));
    await expect(analyzeRoofCondition('base64image')).rejects.toThrow('Network failure');
  });

  it('should parse response where content text is empty object', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({
      content: [{ type: 'text', text: '{}' }],
    }));

    const result = await analyzeRoofCondition('base64image');
    // Empty object parsed = undefined fields, should work without throwing
    expect(result).toBeDefined();
  });

  it('should handle malformed JSON in text gracefully', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({
      content: [{ type: 'text', text: '{invalid json' }],
    }));

    const result = await analyzeRoofCondition('base64image');
    // Should fall back to defaults
    expect(result.overallScore).toBe(50);
    expect(result.materialType).toBe('unknown');
  });
});
