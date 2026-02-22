/**
 * Shared mock utilities for tests that need fetch mocking.
 */
import { vi } from 'vitest';

/**
 * Setup a global fetch mock. Returns the mock function.
 * Call in beforeEach; vi.restoreAllMocks() in afterEach cleans up.
 */
export function setupFetchMock(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/**
 * Create a mock Response object with JSON body.
 */
export function mockResponse(body: unknown, opts?: { status?: number; ok?: boolean; headers?: Record<string, string> }): Response {
  const status = opts?.status ?? 200;
  const ok = opts?.ok ?? (status >= 200 && status < 300);
  const jsonBody = JSON.stringify(body);

  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    headers: new Headers(opts?.headers ?? { 'Content-Type': 'application/json' }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(jsonBody),
    arrayBuffer: () => Promise.resolve(new TextEncoder().encode(jsonBody).buffer),
    blob: () => Promise.resolve(new Blob([jsonBody])),
    clone: () => mockResponse(body, opts),
    body: null,
    bodyUsed: false,
    formData: () => Promise.resolve(new FormData()),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

/**
 * Create a mock response shaped like Anthropic Claude API response.
 * Used for /api/vision/* endpoints.
 */
export function claudeResponse(text: string): Response {
  return mockResponse({
    content: [{ type: 'text', text }],
  });
}

/**
 * Create a mock Claude response for edge detection.
 */
export function claudeEdgesResponse(
  edges: { type: string; start: { x: number; y: number }; end: { x: number; y: number } }[],
  opts?: { roofType?: string; pitchDeg?: number; confidence?: number },
): Response {
  const json = JSON.stringify({
    edges,
    roofType: opts?.roofType ?? 'gable',
    estimatedPitchDegrees: opts?.pitchDeg ?? 22,
    confidence: opts?.confidence ?? 0.8,
  });
  return claudeResponse(json);
}

/**
 * Create a mock Solar Building Insights response.
 */
export function mockSolarInsightsResponse(
  segments: { pitchDegrees: number; azimuthDegrees: number; areaMeters2: number }[],
): Response {
  return mockResponse({
    name: 'test-building',
    center: { latitude: 39.78, longitude: -89.65 },
    boundingBox: {
      sw: { latitude: 39.779, longitude: -89.651 },
      ne: { latitude: 39.781, longitude: -89.649 },
    },
    imageryDate: { year: 2024, month: 6, day: 15 },
    imageryProcessedDate: { year: 2024, month: 7, day: 1 },
    postalCode: '62701',
    administrativeArea: 'IL',
    statisticalArea: '',
    regionCode: 'US',
    imageryQuality: 'HIGH',
    solarPotential: {
      maxArrayPanelsCount: 30,
      maxArrayAreaMeters2: 50,
      maxSunshineHoursPerYear: 1500,
      carbonOffsetFactorKgPerMwh: 400,
      wholeRoofStats: {
        areaMeters2: 100,
        sunshineQuantiles: [],
        groundAreaMeters2: 100,
      },
      roofSegmentStats: segments.map((seg, i) => ({
        pitchDegrees: seg.pitchDegrees,
        azimuthDegrees: seg.azimuthDegrees,
        stats: {
          areaMeters2: seg.areaMeters2,
          sunshineQuantiles: [],
          groundAreaMeters2: seg.areaMeters2,
        },
        center: { latitude: 39.78 + i * 0.0001, longitude: -89.65 },
        boundingBox: {
          sw: { latitude: 39.779, longitude: -89.651 },
          ne: { latitude: 39.781, longitude: -89.649 },
        },
        planeHeightAtCenterMeters: 5,
      })),
      buildingStats: {
        areaMeters2: 100,
        sunshineQuantiles: [],
        groundAreaMeters2: 100,
      },
    },
  });
}

/**
 * Create mock Express req/res objects for server route testing.
 */
export function createMockReqRes(body?: Record<string, unknown>, headers?: Record<string, string>) {
  const req = {
    body: body ?? {},
    headers: headers ?? {},
    query: {},
    params: {},
  };

  const resData: { status: number; json: unknown; sent: boolean } = {
    status: 200,
    json: null,
    sent: false,
  };

  const res = {
    status(code: number) {
      resData.status = code;
      return res;
    },
    json(data: unknown) {
      resData.json = data;
      resData.sent = true;
      return res;
    },
    _getData: () => resData,
  };

  return { req, res, resData };
}
