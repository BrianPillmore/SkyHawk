import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  listProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
  saveMeasurement,
  deleteMeasurement,
  checkServerHealth,
  ApiError,
} from '../../src/services/propertyApi';

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock localStorage for token retrieval
const mockStorage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => mockStorage.get(key) ?? null,
    setItem: (key: string, value: string) => mockStorage.set(key, value),
    removeItem: (key: string) => mockStorage.delete(key),
  },
  writable: true,
});

// Store a fake auth token
function setAuthToken(token: string) {
  mockStorage.set(
    'skyhawk-storage',
    JSON.stringify({ state: { token } }),
  );
}

function mockJsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: vi.fn().mockResolvedValue(data),
  };
}

describe('propertyApi', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockStorage.clear();
    setAuthToken('test-jwt-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('listProperties', () => {
    it('fetches properties list with auth header', async () => {
      const properties = [
        { id: '1', address: '123 Main St', lat: 35.0, lng: -97.0, created_at: '2026-01-01' },
      ];
      mockFetch.mockResolvedValue(mockJsonResponse({ properties }));

      const result = await listProperties();

      expect(result).toEqual(properties);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/properties'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-jwt-token',
          }),
        }),
      );
    });

    it('throws ApiError on server error', async () => {
      mockFetch.mockResolvedValue(mockJsonResponse({ error: 'Unauthorized' }, 401));

      await expect(listProperties()).rejects.toThrow(ApiError);
      await expect(listProperties()).rejects.toThrow('Unauthorized');
    });
  });

  describe('getProperty', () => {
    it('fetches a single property with measurements', async () => {
      const property = {
        id: 'abc',
        address: '456 Oak Ave',
        lat: 35.0,
        lng: -97.0,
        measurements: [{ id: 'm1', total_area_sqft: 2500 }],
        damageAnnotations: [],
        claims: [],
        snapshots: [],
      };
      mockFetch.mockResolvedValue(mockJsonResponse(property));

      const result = await getProperty('abc');

      expect(result.id).toBe('abc');
      expect(result.measurements).toHaveLength(1);
    });
  });

  describe('createProperty', () => {
    it('sends POST with property data', async () => {
      const newProperty = {
        id: 'new-1',
        address: '789 Pine St',
        city: 'Yukon',
        state: 'OK',
        zip: '73099',
        lat: 35.5,
        lng: -97.7,
        notes: '',
        created_at: '2026-02-24',
        updated_at: '2026-02-24',
      };
      mockFetch.mockResolvedValue(mockJsonResponse(newProperty, 201));

      const result = await createProperty({
        address: '789 Pine St',
        city: 'Yukon',
        state: 'OK',
        zip: '73099',
        lat: 35.5,
        lng: -97.7,
      });

      expect(result.id).toBe('new-1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/properties'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('789 Pine St'),
        }),
      );
    });
  });

  describe('updateProperty', () => {
    it('sends PUT with partial update data', async () => {
      mockFetch.mockResolvedValue(
        mockJsonResponse({
          id: 'abc',
          address: '123 Main St',
          notes: 'updated notes',
        }),
      );

      const result = await updateProperty('abc', { notes: 'updated notes' });

      expect(result.notes).toBe('updated notes');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/properties/abc'),
        expect.objectContaining({ method: 'PUT' }),
      );
    });
  });

  describe('deleteProperty', () => {
    it('sends DELETE request', async () => {
      mockFetch.mockResolvedValue(mockJsonResponse({ deleted: true, id: 'abc' }));

      await expect(deleteProperty('abc')).resolves.not.toThrow();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/properties/abc'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('throws on 404', async () => {
      mockFetch.mockResolvedValue(mockJsonResponse({ error: 'Property not found' }, 404));

      await expect(deleteProperty('nonexistent')).rejects.toThrow(ApiError);
    });
  });

  describe('saveMeasurement', () => {
    it('sends full measurement graph to server', async () => {
      mockFetch.mockResolvedValue(
        mockJsonResponse({ id: 'meas-1', createdAt: '2026-02-24' }, 201),
      );

      const result = await saveMeasurement('prop-1', {
        vertices: [{ id: 'v1', lat: 35.0, lng: -97.0 }],
        edges: [{ id: 'e1', startVertexId: 'v1', endVertexId: 'v1', type: 'eave', lengthFt: 10 }],
        facets: [{
          id: 'f1', name: '#1', pitch: 6, areaSqFt: 100,
          trueAreaSqFt: 112, vertexIds: ['v1'], edgeIds: ['e1'],
        }],
        totalAreaSqFt: 100,
        totalTrueAreaSqFt: 112,
        totalSquares: 1.12,
        predominantPitch: 6,
        totalRidgeLf: 0,
        totalHipLf: 0,
        totalValleyLf: 0,
        totalRakeLf: 0,
        totalEaveLf: 10,
        totalFlashingLf: 0,
        totalStepFlashingLf: 0,
        totalDripEdgeLf: 0,
        suggestedWastePercent: 15,
        ridgeCount: 0,
        hipCount: 0,
        valleyCount: 0,
        rakeCount: 0,
        eaveCount: 1,
        flashingCount: 0,
        stepFlashingCount: 0,
        structureComplexity: 'Simple',
        estimatedAtticSqFt: 100,
        pitchBreakdown: [],
      });

      expect(result.id).toBe('meas-1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/properties/prop-1/measurements'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('deleteMeasurement', () => {
    it('sends DELETE for a specific measurement', async () => {
      mockFetch.mockResolvedValue(mockJsonResponse({ deleted: true }));

      await expect(deleteMeasurement('prop-1', 'meas-1')).resolves.not.toThrow();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/properties/prop-1/measurements/meas-1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('checkServerHealth', () => {
    it('returns true when server is healthy', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const result = await checkServerHealth();
      expect(result).toBe(true);
    });

    it('returns false when server is down', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await checkServerHealth();
      expect(result).toBe(false);
    });

    it('returns false on non-ok response', async () => {
      mockFetch.mockResolvedValue({ ok: false });

      const result = await checkServerHealth();
      expect(result).toBe(false);
    });
  });

  describe('auth token handling', () => {
    it('sends requests without auth when no token', async () => {
      mockStorage.clear();
      mockFetch.mockResolvedValue(mockJsonResponse({ properties: [] }));

      await listProperties();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.any(String),
          }),
        }),
      );
    });
  });

  describe('ApiError', () => {
    it('has status and message', () => {
      const err = new ApiError(404, 'Not found');
      expect(err.status).toBe(404);
      expect(err.message).toBe('Not found');
      expect(err.name).toBe('ApiError');
    });
  });
});
