/**
 * Unit tests for Solar API service
 * Run with: npx vitest run tests/unit/solarApi.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SolarApiError,
  fetchBuildingInsights,
  fetchDataLayers,
  fetchGeoTiff,
} from '../../src/services/solarApi';

// ---------------------------------------------------------------------------
// Mock global.fetch
// ---------------------------------------------------------------------------
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  mockFetch.mockReset();
});

// ---------------------------------------------------------------------------
// Helper - create a mock Response
// ---------------------------------------------------------------------------
function mockResponse(
  body: unknown,
  {
    ok = true,
    status = 200,
    statusText = 'OK',
  }: Partial<{ ok: boolean; status: number; statusText: string }> = {},
) {
  return {
    ok,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
    arrayBuffer: vi.fn().mockResolvedValue(body),
  };
}

// ===========================================================================
// SolarApiError class
// ===========================================================================
describe('SolarApiError', () => {
  it('should set name to "SolarApiError"', () => {
    const err = new SolarApiError('test', 500);
    expect(err.name).toBe('SolarApiError');
  });

  it('should inherit from Error', () => {
    const err = new SolarApiError('msg', 400);
    expect(err).toBeInstanceOf(Error);
  });

  it('should store the message', () => {
    const err = new SolarApiError('bad request', 400);
    expect(err.message).toBe('bad request');
  });

  it('should store statusCode', () => {
    const err = new SolarApiError('msg', 422);
    expect(err.statusCode).toBe(422);
  });

  it('should store details when provided', () => {
    const err = new SolarApiError('msg', 500, 'some details');
    expect(err.details).toBe('some details');
  });

  it('should leave details undefined when not provided', () => {
    const err = new SolarApiError('msg', 500);
    expect(err.details).toBeUndefined();
  });
});

// ===========================================================================
// fetchBuildingInsights
// ===========================================================================
describe('fetchBuildingInsights', () => {
  const lat = 37.4219999;
  const lng = -122.0840575;
  const apiKey = 'test-api-key';
  const mockInsights = { name: 'building/1', solarPotential: {} };

  it('should return data when HIGH quality succeeds on first try', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(mockInsights));

    const result = await fetchBuildingInsights(lat, lng, apiKey);

    expect(result).toEqual(mockInsights);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // Verify the URL contains HIGH quality
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('requiredQuality=HIGH');
    expect(url).toContain(`location.latitude=${lat}`);
    expect(url).toContain(`location.longitude=${lng}`);
    expect(url).toContain(`key=${apiKey}`);
  });

  it('should construct the correct Solar API base URL', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(mockInsights));
    await fetchBuildingInsights(lat, lng, apiKey);

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toMatch(/^https:\/\/solar\.googleapis\.com\/v1\/buildingInsights:findClosest\?/);
  });

  it('should fallback to MEDIUM quality when HIGH returns 404', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(null, { ok: false, status: 404, statusText: 'Not Found' }))
      .mockResolvedValueOnce(mockResponse(mockInsights));

    const result = await fetchBuildingInsights(lat, lng, apiKey);

    expect(result).toEqual(mockInsights);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const firstUrl = mockFetch.mock.calls[0][0] as string;
    expect(firstUrl).toContain('requiredQuality=HIGH');
    const secondUrl = mockFetch.mock.calls[1][0] as string;
    expect(secondUrl).toContain('requiredQuality=MEDIUM');
  });

  it('should return MEDIUM data when MEDIUM succeeds after HIGH 404', async () => {
    const mediumData = { name: 'building/2', solarPotential: { quality: 'MEDIUM' } };
    mockFetch
      .mockResolvedValueOnce(mockResponse(null, { ok: false, status: 404, statusText: 'Not Found' }))
      .mockResolvedValueOnce(mockResponse(mediumData));

    const result = await fetchBuildingInsights(lat, lng, apiKey);
    expect(result).toEqual(mediumData);
  });

  it('should throw SolarApiError 404 when both HIGH and MEDIUM return 404', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(null, { ok: false, status: 404, statusText: 'Not Found' }))
      .mockResolvedValueOnce(mockResponse(null, { ok: false, status: 404, statusText: 'Not Found' }));

    try {
      await fetchBuildingInsights(lat, lng, apiKey);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(SolarApiError);
      const solarErr = err as SolarApiError;
      expect(solarErr.statusCode).toBe(404);
      expect(solarErr.message).toBe('No Solar data available for this location.');
    }
  });

  it('should throw SolarApiError on 403 about Solar API not enabled', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(null, { ok: false, status: 403, statusText: 'Forbidden' }));

    try {
      await fetchBuildingInsights(lat, lng, apiKey);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(SolarApiError);
      const solarErr = err as SolarApiError;
      expect(solarErr.statusCode).toBe(403);
      expect(solarErr.message).toBe(
        'Solar API not enabled. Please enable the Solar API in Google Cloud Console.'
      );
    }
  });

  it('should throw SolarApiError on 403 during MEDIUM quality (after HIGH 404)', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(null, { ok: false, status: 404, statusText: 'Not Found' }))
      .mockResolvedValueOnce(mockResponse(null, { ok: false, status: 403, statusText: 'Forbidden' }));

    await expect(fetchBuildingInsights(lat, lng, apiKey)).rejects.toThrow(SolarApiError);
  });

  it('should throw SolarApiError with error body on other HTTP errors (e.g. 500)', async () => {
    const errorBody = '{"error": "internal server error"}';
    mockFetch.mockResolvedValueOnce(
      mockResponse(errorBody, { ok: false, status: 500, statusText: 'Internal Server Error' }),
    );

    try {
      await fetchBuildingInsights(lat, lng, apiKey);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(SolarApiError);
      const solarErr = err as SolarApiError;
      expect(solarErr.statusCode).toBe(500);
      expect(solarErr.message).toContain('Solar API error');
      expect(solarErr.message).toContain('Internal Server Error');
      expect(solarErr.details).toBe(errorBody);
    }
  });

  it('should throw SolarApiError with details on 429 rate limit', async () => {
    const errorBody = 'Rate limited';
    mockFetch.mockResolvedValueOnce(
      mockResponse(errorBody, { ok: false, status: 429, statusText: 'Too Many Requests' }),
    );

    try {
      await fetchBuildingInsights(lat, lng, apiKey);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(SolarApiError);
      const solarErr = err as SolarApiError;
      expect(solarErr.statusCode).toBe(429);
      expect(solarErr.details).toBe('Rate limited');
    }
  });
});

// ===========================================================================
// fetchDataLayers
// ===========================================================================
describe('fetchDataLayers', () => {
  const lat = 37.4219999;
  const lng = -122.0840575;
  const radius = 50;
  const apiKey = 'test-api-key';
  const mockLayers = { maskUrl: 'https://example.com/mask.tiff', dsmUrl: 'https://example.com/dsm.tiff' };

  it('should return data when HIGH quality succeeds on first try', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(mockLayers));

    const result = await fetchDataLayers(lat, lng, radius, apiKey);

    expect(result).toEqual(mockLayers);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('requiredQuality=HIGH');
  });

  it('should construct the correct dataLayers URL', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(mockLayers));
    await fetchDataLayers(lat, lng, radius, apiKey);

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toMatch(/^https:\/\/solar\.googleapis\.com\/v1\/dataLayers:get\?/);
  });

  it('should include all required query parameters', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(mockLayers));
    await fetchDataLayers(lat, lng, radius, apiKey);

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain(`location.latitude=${lat}`);
    expect(url).toContain(`location.longitude=${lng}`);
    expect(url).toContain(`radiusMeters=${radius}`);
    expect(url).toContain('view=FULL_LAYERS');
    expect(url).toContain('pixelSizeMeters=0.1');
    expect(url).toContain(`key=${apiKey}`);
  });

  it('should fallback to MEDIUM quality when HIGH returns 404', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(null, { ok: false, status: 404, statusText: 'Not Found' }))
      .mockResolvedValueOnce(mockResponse(mockLayers));

    const result = await fetchDataLayers(lat, lng, radius, apiKey);

    expect(result).toEqual(mockLayers);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const secondUrl = mockFetch.mock.calls[1][0] as string;
    expect(secondUrl).toContain('requiredQuality=MEDIUM');
  });

  it('should return MEDIUM data when MEDIUM succeeds after HIGH 404', async () => {
    const mediumLayers = { maskUrl: 'medium/mask.tiff' };
    mockFetch
      .mockResolvedValueOnce(mockResponse(null, { ok: false, status: 404, statusText: 'Not Found' }))
      .mockResolvedValueOnce(mockResponse(mediumLayers));

    const result = await fetchDataLayers(lat, lng, radius, apiKey);
    expect(result).toEqual(mediumLayers);
  });

  it('should throw SolarApiError on 403 about Solar API not enabled', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(null, { ok: false, status: 403, statusText: 'Forbidden' }));

    try {
      await fetchDataLayers(lat, lng, radius, apiKey);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(SolarApiError);
      const solarErr = err as SolarApiError;
      expect(solarErr.statusCode).toBe(403);
      expect(solarErr.message).toContain('Solar API not enabled');
    }
  });

  it('should throw SolarApiError with details on other HTTP errors (e.g. 502)', async () => {
    const errorBody = 'server error body';
    mockFetch.mockResolvedValueOnce(
      mockResponse(errorBody, { ok: false, status: 502, statusText: 'Bad Gateway' }),
    );

    try {
      await fetchDataLayers(lat, lng, radius, apiKey);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(SolarApiError);
      const solarErr = err as SolarApiError;
      expect(solarErr.statusCode).toBe(502);
      expect(solarErr.message).toContain('dataLayers error');
      expect(solarErr.message).toContain('Bad Gateway');
      expect(solarErr.details).toBe('server error body');
    }
  });

  it('should throw SolarApiError 404 when both HIGH and MEDIUM return 404', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(null, { ok: false, status: 404, statusText: 'Not Found' }))
      .mockResolvedValueOnce(mockResponse(null, { ok: false, status: 404, statusText: 'Not Found' }));

    try {
      await fetchDataLayers(lat, lng, radius, apiKey);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(SolarApiError);
      const solarErr = err as SolarApiError;
      expect(solarErr.statusCode).toBe(404);
      expect(solarErr.message).toBe('No Solar data layers available for this location.');
    }
  });

  it('should throw SolarApiError on 403 during MEDIUM quality (after HIGH 404)', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(null, { ok: false, status: 404, statusText: 'Not Found' }))
      .mockResolvedValueOnce(mockResponse(null, { ok: false, status: 403, statusText: 'Forbidden' }));

    await expect(fetchDataLayers(lat, lng, radius, apiKey)).rejects.toThrow(SolarApiError);
  });
});

// ===========================================================================
// fetchGeoTiff
// ===========================================================================
describe('fetchGeoTiff', () => {
  const apiKey = 'test-key';

  it('should append key with "?" for URLs without query params', async () => {
    const tiffUrl = 'https://solar.googleapis.com/v1/geoTiff';
    const buffer = new ArrayBuffer(8);
    mockFetch.mockResolvedValueOnce(mockResponse(buffer));

    await fetchGeoTiff(tiffUrl, apiKey);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toBe(`${tiffUrl}?key=${apiKey}`);
  });

  it('should append key with "&" for URLs with existing query params', async () => {
    const tiffUrl = 'https://solar.googleapis.com/v1/geoTiff?layer=mask';
    const buffer = new ArrayBuffer(8);
    mockFetch.mockResolvedValueOnce(mockResponse(buffer));

    await fetchGeoTiff(tiffUrl, apiKey);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toBe(`${tiffUrl}&key=${apiKey}`);
  });

  it('should return an ArrayBuffer on success', async () => {
    const buffer = new ArrayBuffer(16);
    mockFetch.mockResolvedValueOnce(mockResponse(buffer));

    const result = await fetchGeoTiff('https://example.com/file.tiff', apiKey);

    expect(result).toBe(buffer);
  });

  it('should throw SolarApiError on non-ok response (500)', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(null, { ok: false, status: 500, statusText: 'Internal Server Error' }),
    );

    try {
      await fetchGeoTiff('https://example.com/file.tiff', apiKey);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(SolarApiError);
      const solarErr = err as SolarApiError;
      expect(solarErr.statusCode).toBe(500);
      expect(solarErr.message).toContain('Failed to download GeoTIFF');
      expect(solarErr.message).toContain('Internal Server Error');
    }
  });

  it('should throw SolarApiError on 404 response', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(null, { ok: false, status: 404, statusText: 'Not Found' }),
    );

    await expect(fetchGeoTiff('https://example.com/missing.tiff', apiKey)).rejects.toThrow(SolarApiError);
  });

  it('should correctly detect "?" in URL with multiple existing params', async () => {
    const tiffUrl = 'https://example.com/tiff?existingParam=1&other=2';
    const buffer = new ArrayBuffer(4);
    mockFetch.mockResolvedValueOnce(mockResponse(buffer));

    await fetchGeoTiff(tiffUrl, apiKey);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toBe(`${tiffUrl}&key=${apiKey}`);
  });
});
