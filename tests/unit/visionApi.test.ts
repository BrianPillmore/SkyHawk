/**
 * Unit tests for Vision API service (capturePropertyImage & analyzeRoofImage)
 * Run with: npx vitest run tests/unit/visionApi.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { capturePropertyImage, analyzeRoofImage } from '../../src/services/visionApi';
import type { ReconstructedRoof } from '../../src/types/solar';

// ---------------------------------------------------------------------------
// Mock global.fetch
// ---------------------------------------------------------------------------
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Mock btoa (not always available in Node/test environments)
// ---------------------------------------------------------------------------
if (typeof globalThis.btoa === 'undefined') {
  globalThis.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
}

// ---------------------------------------------------------------------------
// Mock roofReconstruction
// ---------------------------------------------------------------------------
const mockReconstructRoof = vi.fn<(outline: unknown[], segments: unknown[]) => ReconstructedRoof>();

vi.mock('../../src/utils/roofReconstruction', () => ({
  reconstructRoof: (...args: unknown[]) => mockReconstructRoof(...(args as [unknown[], unknown[]])),
}));

beforeEach(() => {
  mockFetch.mockReset();
  mockReconstructRoof.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a mock Response for fetch */
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
    arrayBuffer: vi.fn().mockResolvedValue(
      body instanceof ArrayBuffer ? body : new ArrayBuffer(8),
    ),
  };
}

/** Build a Claude API response wrapper around a text string */
function claudeResponse(text: string) {
  return {
    content: [{ type: 'text', text }],
  };
}

/** A valid VisionRoofResponse JSON string */
function validRoofJson(overrides: Record<string, unknown> = {}) {
  const base = {
    outline: [
      { x: 100, y: 100 },
      { x: 540, y: 100 },
      { x: 540, y: 540 },
      { x: 100, y: 540 },
    ],
    roofType: 'gable',
    ridgeDirection: 90,
    numFacets: 2,
    estimatedPitchDegrees: 25,
    ...overrides,
  };
  return JSON.stringify(base);
}

/** Standard image bounds for testing */
const testBounds = {
  north: 37.423,
  south: 37.421,
  east: -122.083,
  west: -122.085,
};

/** Default reconstructed roof mock return value */
const mockRoofResult: ReconstructedRoof = {
  vertices: [],
  edges: [],
  facets: [],
  roofType: 'gable',
  confidence: 'high',
};

// ===========================================================================
// capturePropertyImage
// ===========================================================================
describe('capturePropertyImage', () => {
  const lat = 37.4219999;
  const lng = -122.0840575;
  const apiKey = 'test-maps-key';

  it('should construct the correct Google Maps Static API URL', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(new ArrayBuffer(8)));

    await capturePropertyImage(lat, lng, apiKey);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('https://maps.googleapis.com/maps/api/staticmap?');
    expect(url).toContain(`center=${lat}%2C${lng}`);
    expect(url).toContain('maptype=satellite');
    expect(url).toContain(`key=${apiKey}`);
  });

  it('should use default zoom=20 and size=640', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(new ArrayBuffer(8)));

    await capturePropertyImage(lat, lng, apiKey);

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('zoom=20');
    expect(url).toContain('size=640x640');
  });

  it('should use custom zoom and size when provided', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(new ArrayBuffer(8)));

    await capturePropertyImage(lat, lng, apiKey, 18, 512);

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('zoom=18');
    expect(url).toContain('size=512x512');
  });

  it('should return a base64-encoded string', async () => {
    // Create a small buffer with known bytes
    const buffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;
    mockFetch.mockResolvedValueOnce(mockResponse(buffer));

    const result = await capturePropertyImage(lat, lng, apiKey);

    expect(typeof result.base64).toBe('string');
    expect(result.base64.length).toBeGreaterThan(0);
  });

  it('should return calculated bounds', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(new ArrayBuffer(8)));

    const result = await capturePropertyImage(lat, lng, apiKey);

    expect(result.bounds).toHaveProperty('north');
    expect(result.bounds).toHaveProperty('south');
    expect(result.bounds).toHaveProperty('east');
    expect(result.bounds).toHaveProperty('west');
  });

  it('should calculate bounds with north > south', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(new ArrayBuffer(8)));

    const result = await capturePropertyImage(lat, lng, apiKey);

    expect(result.bounds.north).toBeGreaterThan(result.bounds.south);
  });

  it('should calculate bounds with east > west (for negative longitudes)', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(new ArrayBuffer(8)));

    const result = await capturePropertyImage(lat, lng, apiKey);

    // For negative longitudes: west is more negative, east is less negative
    expect(result.bounds.east).toBeGreaterThan(result.bounds.west);
  });

  it('should calculate bounds centered on the given lat/lng', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(new ArrayBuffer(8)));

    const result = await capturePropertyImage(lat, lng, apiKey);

    const centerLat = (result.bounds.north + result.bounds.south) / 2;
    const centerLng = (result.bounds.east + result.bounds.west) / 2;

    expect(centerLat).toBeCloseTo(lat, 4);
    expect(centerLng).toBeCloseTo(lng, 4);
  });

  it('should produce smaller bounds at higher zoom levels', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(new ArrayBuffer(8)));
    const result20 = await capturePropertyImage(lat, lng, apiKey, 20, 640);

    mockFetch.mockResolvedValueOnce(mockResponse(new ArrayBuffer(8)));
    const result18 = await capturePropertyImage(lat, lng, apiKey, 18, 640);

    const span20 = result20.bounds.north - result20.bounds.south;
    const span18 = result18.bounds.north - result18.bounds.south;

    // Zoom 20 should cover a smaller area than zoom 18
    expect(span20).toBeLessThan(span18);
  });

  it('should calculate bounds correctly with known zoom and size values', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(new ArrayBuffer(8)));

    const testLat = 34.0522;
    const testLng = -118.2437;
    const result = await capturePropertyImage(testLat, testLng, apiKey);

    // Verify computation matches the formula in the source
    const metersPerPixel = (156543.03392 * Math.cos((testLat * Math.PI) / 180)) / Math.pow(2, 20);
    const halfSizeMeters = (640 / 2) * metersPerPixel;
    const degPerMeter = 1 / 111320;

    const expectedNorth = testLat + halfSizeMeters * degPerMeter;
    const expectedSouth = testLat - halfSizeMeters * degPerMeter;
    const expectedEast = testLng + halfSizeMeters * degPerMeter / Math.cos((testLat * Math.PI) / 180);
    const expectedWest = testLng - halfSizeMeters * degPerMeter / Math.cos((testLat * Math.PI) / 180);

    expect(result.bounds.north).toBeCloseTo(expectedNorth, 10);
    expect(result.bounds.south).toBeCloseTo(expectedSouth, 10);
    expect(result.bounds.east).toBeCloseTo(expectedEast, 10);
    expect(result.bounds.west).toBeCloseTo(expectedWest, 10);
  });

  it('should throw an Error on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(null, { ok: false, status: 403, statusText: 'Forbidden' }),
    );

    await expect(capturePropertyImage(lat, lng, apiKey)).rejects.toThrow(
      'Failed to capture satellite image: Forbidden',
    );
  });

  it('should throw an Error (not SolarApiError) on failure', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(null, { ok: false, status: 500, statusText: 'Server Error' }),
    );

    await expect(capturePropertyImage(lat, lng, apiKey)).rejects.toThrow(Error);
  });
});

// ===========================================================================
// analyzeRoofImage
// ===========================================================================
describe('analyzeRoofImage', () => {
  const imageBase64 = 'iVBORw0KGgo=';

  beforeEach(() => {
    mockReconstructRoof.mockReturnValue({ ...mockRoofResult });
  });

  // ---- Request construction ----
  it('should send a POST request to the proxy endpoint', async () => {
    const json = validRoofJson();
    mockFetch.mockResolvedValueOnce(mockResponse(claudeResponse(json)));

    await analyzeRoofImage(imageBase64, testBounds);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/vision/analyze');
    expect(options.method).toBe('POST');
  });

  it('should include Content-Type header only (no API key headers)', async () => {
    const json = validRoofJson();
    mockFetch.mockResolvedValueOnce(mockResponse(claudeResponse(json)));

    await analyzeRoofImage(imageBase64, testBounds);

    const [, options] = mockFetch.mock.calls[0];
    const headers = options.headers;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['x-api-key']).toBeUndefined();
    expect(headers['anthropic-version']).toBeUndefined();
  });

  it('should include imageBase64 and imageBounds in the request body', async () => {
    const json = validRoofJson();
    mockFetch.mockResolvedValueOnce(mockResponse(claudeResponse(json)));

    await analyzeRoofImage(imageBase64, testBounds);

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.imageBase64).toBe(imageBase64);
    expect(body.imageBounds).toEqual(testBounds);
    expect(body.imageSize).toBe(640);
  });

  it('should include custom imageSize in the request body', async () => {
    const json = validRoofJson();
    mockFetch.mockResolvedValueOnce(mockResponse(claudeResponse(json)));

    await analyzeRoofImage(imageBase64, testBounds, 512);

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.imageSize).toBe(512);
  });

  // ---- Response parsing ----
  it('should parse plain JSON from Claude response text', async () => {
    const json = validRoofJson();
    mockFetch.mockResolvedValueOnce(mockResponse(claudeResponse(json)));

    await analyzeRoofImage(imageBase64, testBounds);

    // Should have called reconstructRoof with outline and segments
    expect(mockReconstructRoof).toHaveBeenCalledTimes(1);
  });

  it('should handle markdown-wrapped JSON (```json ... ```)', async () => {
    const json = validRoofJson();
    const wrappedText = '```json\n' + json + '\n```';
    mockFetch.mockResolvedValueOnce(mockResponse(claudeResponse(wrappedText)));

    await analyzeRoofImage(imageBase64, testBounds);

    expect(mockReconstructRoof).toHaveBeenCalledTimes(1);
  });

  it('should handle JSON with surrounding text', async () => {
    const json = validRoofJson();
    const wrappedText = 'Here is the analysis:\n' + json + '\nHope this helps!';
    mockFetch.mockResolvedValueOnce(mockResponse(claudeResponse(wrappedText)));

    await analyzeRoofImage(imageBase64, testBounds);

    expect(mockReconstructRoof).toHaveBeenCalledTimes(1);
  });

  // ---- Coordinate conversion ----
  it('should convert pixel coordinates to lat/lng using image bounds', async () => {
    const json = validRoofJson({
      outline: [
        { x: 0, y: 0 },       // top-left => north, west
        { x: 640, y: 0 },     // top-right => north, east
        { x: 640, y: 640 },   // bottom-right => south, east
        { x: 0, y: 640 },     // bottom-left => south, west
      ],
    });
    mockFetch.mockResolvedValueOnce(mockResponse(claudeResponse(json)));

    await analyzeRoofImage(imageBase64, testBounds);

    const outline = mockReconstructRoof.mock.calls[0][0] as Array<{ lat: number; lng: number }>;
    expect(outline).toHaveLength(4);

    // x=0, y=0 => lat=north, lng=west
    expect(outline[0].lat).toBeCloseTo(testBounds.north, 5);
    expect(outline[0].lng).toBeCloseTo(testBounds.west, 5);

    // x=640, y=0 => lat=north, lng=east
    expect(outline[1].lat).toBeCloseTo(testBounds.north, 5);
    expect(outline[1].lng).toBeCloseTo(testBounds.east, 5);

    // x=640, y=640 => lat=south, lng=east
    expect(outline[2].lat).toBeCloseTo(testBounds.south, 5);
    expect(outline[2].lng).toBeCloseTo(testBounds.east, 5);

    // x=0, y=640 => lat=south, lng=west
    expect(outline[3].lat).toBeCloseTo(testBounds.south, 5);
    expect(outline[3].lng).toBeCloseTo(testBounds.west, 5);
  });

  it('should convert center pixel to center lat/lng', async () => {
    const json = validRoofJson({
      outline: [{ x: 320, y: 320 }],
    });
    mockFetch.mockResolvedValueOnce(mockResponse(claudeResponse(json)));

    await analyzeRoofImage(imageBase64, testBounds);

    const outline = mockReconstructRoof.mock.calls[0][0] as Array<{ lat: number; lng: number }>;
    const centerLat = (testBounds.north + testBounds.south) / 2;
    const centerLng = (testBounds.east + testBounds.west) / 2;
    expect(outline[0].lat).toBeCloseTo(centerLat, 5);
    expect(outline[0].lng).toBeCloseTo(centerLng, 5);
  });

  // ---- Synthetic segments: gable ----
  it('should create 2 synthetic segments for gable roof', async () => {
    const json = validRoofJson({
      roofType: 'gable',
      ridgeDirection: 90,
      estimatedPitchDegrees: 25,
    });
    mockFetch.mockResolvedValueOnce(mockResponse(claudeResponse(json)));

    await analyzeRoofImage(imageBase64, testBounds);

    const segments = mockReconstructRoof.mock.calls[0][1] as Array<{ pitchDegrees: number; azimuthDegrees: number }>;
    expect(segments).toHaveLength(2);
    expect(segments[0].pitchDegrees).toBe(25);
    expect(segments[0].azimuthDegrees).toBe(90);
    expect(segments[1].pitchDegrees).toBe(25);
    expect(segments[1].azimuthDegrees).toBe(270); // (90 + 180) % 360
  });

  // ---- Synthetic segments: hip ----
  it('should create 4 synthetic segments for hip roof', async () => {
    const json = validRoofJson({
      roofType: 'hip',
      ridgeDirection: 45,
      estimatedPitchDegrees: 30,
    });
    mockFetch.mockResolvedValueOnce(mockResponse(claudeResponse(json)));

    await analyzeRoofImage(imageBase64, testBounds);

    const segments = mockReconstructRoof.mock.calls[0][1] as Array<{ pitchDegrees: number; azimuthDegrees: number }>;
    expect(segments).toHaveLength(4);
    expect(segments[0].azimuthDegrees).toBe(45);
    expect(segments[1].azimuthDegrees).toBe(135);  // (45 + 90) % 360
    expect(segments[2].azimuthDegrees).toBe(225);  // (45 + 180) % 360
    expect(segments[3].azimuthDegrees).toBe(315);  // (45 + 270) % 360
    segments.forEach((seg) => expect(seg.pitchDegrees).toBe(30));
  });

  // ---- Synthetic segments: shed ----
  it('should create 1 synthetic segment for shed roof', async () => {
    const json = validRoofJson({
      roofType: 'shed',
      ridgeDirection: 180,
      estimatedPitchDegrees: 15,
    });
    mockFetch.mockResolvedValueOnce(mockResponse(claudeResponse(json)));

    await analyzeRoofImage(imageBase64, testBounds);

    const segments = mockReconstructRoof.mock.calls[0][1] as Array<{ pitchDegrees: number; azimuthDegrees: number }>;
    expect(segments).toHaveLength(1);
    expect(segments[0].pitchDegrees).toBe(15);
    expect(segments[0].azimuthDegrees).toBe(180);
  });

  it('should use ridgeDirection=0 for shed when ridgeDirection is undefined', async () => {
    const json = validRoofJson({
      roofType: 'shed',
      estimatedPitchDegrees: 20,
    });
    // Remove ridgeDirection from the JSON
    const parsed = JSON.parse(json);
    delete parsed.ridgeDirection;
    mockFetch.mockResolvedValueOnce(mockResponse(claudeResponse(JSON.stringify(parsed))));

    await analyzeRoofImage(imageBase64, testBounds);

    const segments = mockReconstructRoof.mock.calls[0][1] as Array<{ pitchDegrees: number; azimuthDegrees: number }>;
    expect(segments).toHaveLength(1);
    expect(segments[0].azimuthDegrees).toBe(0);
  });

  // ---- Synthetic segments: flat / complex ----
  it('should create 0 synthetic segments for flat roof', async () => {
    const json = validRoofJson({
      roofType: 'flat',
      estimatedPitchDegrees: 2,
    });
    mockFetch.mockResolvedValueOnce(mockResponse(claudeResponse(json)));

    await analyzeRoofImage(imageBase64, testBounds);

    const segments = mockReconstructRoof.mock.calls[0][1] as unknown[];
    expect(segments).toHaveLength(0);
  });

  it('should create 0 synthetic segments for complex roof', async () => {
    const json = validRoofJson({
      roofType: 'complex',
      estimatedPitchDegrees: 30,
    });
    mockFetch.mockResolvedValueOnce(mockResponse(claudeResponse(json)));

    await analyzeRoofImage(imageBase64, testBounds);

    const segments = mockReconstructRoof.mock.calls[0][1] as unknown[];
    expect(segments).toHaveLength(0);
  });

  // ---- Default pitch ----
  it('should use default pitch of 22 when estimatedPitchDegrees is 0/falsy', async () => {
    const json = validRoofJson({
      roofType: 'gable',
      ridgeDirection: 0,
      estimatedPitchDegrees: 0,
    });
    mockFetch.mockResolvedValueOnce(mockResponse(claudeResponse(json)));

    await analyzeRoofImage(imageBase64, testBounds);

    const segments = mockReconstructRoof.mock.calls[0][1] as Array<{ pitchDegrees: number }>;
    expect(segments[0].pitchDegrees).toBe(22);
  });

  // ---- Gable with ridgeDirection undefined ----
  it('should not create gable segments when ridgeDirection is undefined', async () => {
    const parsed = JSON.parse(validRoofJson({ roofType: 'gable' }));
    delete parsed.ridgeDirection;
    mockFetch.mockResolvedValueOnce(mockResponse(claudeResponse(JSON.stringify(parsed))));

    await analyzeRoofImage(imageBase64, testBounds);

    const segments = mockReconstructRoof.mock.calls[0][1] as unknown[];
    // ridgeDirection is undefined, so the gable branch won't execute
    expect(segments).toHaveLength(0);
  });

  // ---- Hip with ridgeDirection undefined ----
  it('should not create hip segments when ridgeDirection is undefined', async () => {
    const parsed = JSON.parse(validRoofJson({ roofType: 'hip' }));
    delete parsed.ridgeDirection;
    mockFetch.mockResolvedValueOnce(mockResponse(claudeResponse(JSON.stringify(parsed))));

    await analyzeRoofImage(imageBase64, testBounds);

    const segments = mockReconstructRoof.mock.calls[0][1] as unknown[];
    expect(segments).toHaveLength(0);
  });

  // ---- Confidence override ----
  it('should set confidence to "low" on the result', async () => {
    const json = validRoofJson();
    mockFetch.mockResolvedValueOnce(mockResponse(claudeResponse(json)));
    mockReconstructRoof.mockReturnValue({ ...mockRoofResult, confidence: 'high' });

    const result = await analyzeRoofImage(imageBase64, testBounds);

    expect(result.confidence).toBe('low');
  });

  // ---- Synthetic segment structure ----
  it('should create synthetic segments with correct placeholder fields', async () => {
    const json = validRoofJson({
      roofType: 'shed',
      ridgeDirection: 45,
      estimatedPitchDegrees: 20,
    });
    mockFetch.mockResolvedValueOnce(mockResponse(claudeResponse(json)));

    await analyzeRoofImage(imageBase64, testBounds);

    const segments = mockReconstructRoof.mock.calls[0][1] as Array<Record<string, unknown>>;
    const seg = segments[0] as Record<string, unknown>;
    expect(seg.pitchDegrees).toBe(20);
    expect(seg.azimuthDegrees).toBe(45);
    expect(seg.planeHeightAtCenterMeters).toBe(5);
    expect((seg.stats as Record<string, unknown>).areaMeters2).toBe(50);
    expect((seg.stats as Record<string, unknown>).groundAreaMeters2).toBe(50);
    expect((seg.stats as Record<string, unknown>).sunshineQuantiles).toEqual([]);
    expect((seg.center as Record<string, unknown>).latitude).toBe(0);
    expect((seg.center as Record<string, unknown>).longitude).toBe(0);
    expect(
      ((seg.boundingBox as Record<string, unknown>).sw as Record<string, unknown>).latitude,
    ).toBe(0);
    expect(
      ((seg.boundingBox as Record<string, unknown>).ne as Record<string, unknown>).latitude,
    ).toBe(0);
  });

  // ---- Custom imageSize for coordinate mapping ----
  it('should use custom imageSize for coordinate conversion', async () => {
    const json = validRoofJson({
      outline: [{ x: 256, y: 256 }], // center of 512px image
    });
    mockFetch.mockResolvedValueOnce(mockResponse(claudeResponse(json)));

    await analyzeRoofImage(imageBase64, testBounds, 512);

    const outline = mockReconstructRoof.mock.calls[0][0] as Array<{ lat: number; lng: number }>;
    const centerLat = (testBounds.north + testBounds.south) / 2;
    const centerLng = (testBounds.east + testBounds.west) / 2;
    expect(outline[0].lat).toBeCloseTo(centerLat, 5);
    expect(outline[0].lng).toBeCloseTo(centerLng, 5);
  });

  // ---- Calls reconstructRoof with correct arguments ----
  it('should pass converted outline and synthetic segments to reconstructRoof', async () => {
    const json = validRoofJson({
      outline: [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 },
      ],
      roofType: 'gable',
      ridgeDirection: 90,
      estimatedPitchDegrees: 25,
    });
    mockFetch.mockResolvedValueOnce(mockResponse(claudeResponse(json)));

    await analyzeRoofImage(imageBase64, testBounds);

    expect(mockReconstructRoof).toHaveBeenCalledTimes(1);
    const [outline, segments] = mockReconstructRoof.mock.calls[0] as [
      Array<{ lat: number; lng: number }>,
      unknown[],
    ];
    expect(outline).toHaveLength(3);
    expect(segments).toHaveLength(2);
  });

  // ---- Error handling ----
  it('should throw on non-ok API response', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse('Unauthorized', {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      }),
    );

    await expect(
      analyzeRoofImage(imageBase64, testBounds),
    ).rejects.toThrow('Claude API error: 401');
  });

  it('should include response body in error message', async () => {
    const errorBody = '{"type":"error","message":"Invalid API key"}';
    mockFetch.mockResolvedValueOnce(
      mockResponse(errorBody, { ok: false, status: 401, statusText: 'Unauthorized' }),
    );

    await expect(
      analyzeRoofImage(imageBase64, testBounds),
    ).rejects.toThrow(errorBody);
  });

  it('should throw when response contains no JSON object', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(claudeResponse('I cannot analyze this image. No roof detected.')),
    );

    await expect(
      analyzeRoofImage(imageBase64, testBounds),
    ).rejects.toThrow('Could not parse roof analysis response from AI');
  });

  it('should throw when response content is empty', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ content: [] }),
    );

    await expect(
      analyzeRoofImage(imageBase64, testBounds),
    ).rejects.toThrow('Could not parse roof analysis response from AI');
  });

  it('should throw when response content text is undefined', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ content: [{ type: 'text' }] }),
    );

    await expect(
      analyzeRoofImage(imageBase64, testBounds),
    ).rejects.toThrow('Could not parse roof analysis response from AI');
  });

  // ---- Gable azimuth wrapping ----
  it('should wrap gable azimuth correctly with ridgeDirection=270', async () => {
    const json = validRoofJson({
      roofType: 'gable',
      ridgeDirection: 270,
      estimatedPitchDegrees: 20,
    });
    mockFetch.mockResolvedValueOnce(mockResponse(claudeResponse(json)));

    await analyzeRoofImage(imageBase64, testBounds);

    const segments = mockReconstructRoof.mock.calls[0][1] as Array<{ azimuthDegrees: number }>;
    expect(segments[0].azimuthDegrees).toBe(270);
    expect(segments[1].azimuthDegrees).toBe(90); // (270 + 180) % 360
  });

  // ---- Hip azimuth wrapping ----
  it('should wrap hip azimuths correctly with ridgeDirection=350', async () => {
    const json = validRoofJson({
      roofType: 'hip',
      ridgeDirection: 350,
      estimatedPitchDegrees: 28,
    });
    mockFetch.mockResolvedValueOnce(mockResponse(claudeResponse(json)));

    await analyzeRoofImage(imageBase64, testBounds);

    const segments = mockReconstructRoof.mock.calls[0][1] as Array<{ azimuthDegrees: number }>;
    expect(segments[0].azimuthDegrees).toBe(350);
    expect(segments[1].azimuthDegrees).toBe(80);   // (350 + 90) % 360
    expect(segments[2].azimuthDegrees).toBe(170);  // (350 + 180) % 360
    expect(segments[3].azimuthDegrees).toBe(260);  // (350 + 270) % 360
  });

  // ---- Returns reconstructRoof result ----
  it('should return the result from reconstructRoof', async () => {
    const json = validRoofJson();
    mockFetch.mockResolvedValueOnce(mockResponse(claudeResponse(json)));
    const customResult: ReconstructedRoof = {
      vertices: [{ lat: 1, lng: 2 }],
      edges: [{ startIndex: 0, endIndex: 0, type: 'ridge' }],
      facets: [{ vertexIndices: [0], pitch: 5, name: 'F1' }],
      roofType: 'gable',
      confidence: 'high',
    };
    mockReconstructRoof.mockReturnValue(customResult);

    const result = await analyzeRoofImage(imageBase64, testBounds);

    // confidence is overridden to 'low'
    expect(result.vertices).toEqual(customResult.vertices);
    expect(result.edges).toEqual(customResult.edges);
    expect(result.facets).toEqual(customResult.facets);
    expect(result.roofType).toBe('gable');
    expect(result.confidence).toBe('low');
  });
});
