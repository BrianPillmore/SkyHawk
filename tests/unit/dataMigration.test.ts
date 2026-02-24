import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  migrateLocalDataToServer,
  readPersistedProperties,
  needsMigration,
  type MigrationResult,
} from '../../src/utils/dataMigration';

// ─── Mock fetch globally ──────────────────────────────────────────

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// ─── Mock localStorage ────────────────────────────────────────────

const mockStorage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => mockStorage.get(key) ?? null,
    setItem: (key: string, value: string) => mockStorage.set(key, value),
    removeItem: (key: string) => mockStorage.delete(key),
    clear: () => mockStorage.clear(),
  },
  writable: true,
});

// ─── Helpers ──────────────────────────────────────────────────────

function setAuthToken(token: string) {
  const currentRaw = mockStorage.get('skyhawk-storage');
  const current = currentRaw ? JSON.parse(currentRaw) : { state: {} };
  current.state.token = token;
  mockStorage.set('skyhawk-storage', JSON.stringify(current));
}

function setPersistedProperties(properties: unknown[]) {
  const currentRaw = mockStorage.get('skyhawk-storage');
  const current = currentRaw ? JSON.parse(currentRaw) : { state: {} };
  current.state.properties = properties;
  mockStorage.set('skyhawk-storage', JSON.stringify(current));
}

function makeProperty(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prop-1',
    address: '123 Main St',
    city: 'Yukon',
    state: 'OK',
    zip: '73099',
    lat: 35.5,
    lng: -97.7,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    measurements: [],
    damageAnnotations: [],
    snapshots: [],
    claims: [],
    notes: 'test notes',
    ...overrides,
  };
}

function makeMeasurement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'meas-1',
    propertyId: 'prop-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
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
    ...overrides,
  };
}

function mockJsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: vi.fn().mockResolvedValue(data),
  };
}

// ─── Tests ────────────────────────────────────────────────────────

describe('dataMigration', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockStorage.clear();
    setAuthToken('test-jwt-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── readPersistedProperties ──────────────────────────────────────

  describe('readPersistedProperties', () => {
    it('returns properties from localStorage', () => {
      const props = [makeProperty()];
      setPersistedProperties(props);

      const result = readPersistedProperties();
      expect(result).toEqual(props);
    });

    it('returns empty array when localStorage has no data', () => {
      const result = readPersistedProperties();
      expect(result).toEqual([]);
    });

    it('returns empty array when state is corrupt', () => {
      mockStorage.set('skyhawk-storage', 'not-json');
      const result = readPersistedProperties();
      expect(result).toEqual([]);
    });

    it('returns empty array when properties is not an array', () => {
      mockStorage.set('skyhawk-storage', JSON.stringify({ state: { properties: 'bad' } }));
      const result = readPersistedProperties();
      expect(result).toEqual([]);
    });
  });

  // ── needsMigration ───────────────────────────────────────────────

  describe('needsMigration', () => {
    it('returns true when properties exist and migration flag is not set', () => {
      setPersistedProperties([makeProperty()]);
      expect(needsMigration()).toBe(true);
    });

    it('returns false when migration flag is set', () => {
      setPersistedProperties([makeProperty()]);
      mockStorage.set('skyhawk_data_migrated', 'true');
      expect(needsMigration()).toBe(false);
    });

    it('returns false when no properties exist', () => {
      setPersistedProperties([]);
      expect(needsMigration()).toBe(false);
    });
  });

  // ── migrateLocalDataToServer ─────────────────────────────────────

  describe('migrateLocalDataToServer', () => {
    it('migrates multiple properties successfully', async () => {
      const props = [
        makeProperty({ id: 'p1', address: '111 First St' }),
        makeProperty({ id: 'p2', address: '222 Second St' }),
        makeProperty({ id: 'p3', address: '333 Third St' }),
      ];
      setPersistedProperties(props);

      // Each createProperty call returns a created property
      mockFetch.mockResolvedValue(
        mockJsonResponse({
          id: 'server-id',
          address: 'test',
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        }, 201),
      );

      const result = await migrateLocalDataToServer('test-jwt-token');

      expect(result.migrated).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.errors).toEqual([]);
      expect(result.alreadyMigrated).toBe(false);
      // Migration flag should be set
      expect(mockStorage.get('skyhawk_data_migrated')).toBe('true');
    });

    it('migrates properties with measurements', async () => {
      const measurement = makeMeasurement();
      const props = [
        makeProperty({ id: 'p1', address: '111 First St', measurements: [measurement] }),
      ];
      setPersistedProperties(props);

      // First call: createProperty. Second call: saveMeasurement.
      mockFetch
        .mockResolvedValueOnce(
          mockJsonResponse({
            id: 'server-prop-id',
            address: '111 First St',
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          }, 201),
        )
        .mockResolvedValueOnce(
          mockJsonResponse({ id: 'server-meas-id', createdAt: '2026-01-01' }, 201),
        );

      const result = await migrateLocalDataToServer('test-jwt-token');

      expect(result.migrated).toBe(1);
      expect(result.failed).toBe(0);
      // Should have called createProperty and saveMeasurement
      expect(mockFetch).toHaveBeenCalledTimes(2);
      // The second call should be to the measurements endpoint with the server property ID
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('/api/properties/server-prop-id/measurements'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('returns alreadyMigrated when flag is set', async () => {
      setPersistedProperties([makeProperty()]);
      mockStorage.set('skyhawk_data_migrated', 'true');

      const result = await migrateLocalDataToServer('test-jwt-token');

      expect(result.alreadyMigrated).toBe(true);
      expect(result.migrated).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toEqual([]);
      // No API calls should have been made
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles no properties in localStorage', async () => {
      setPersistedProperties([]);

      const result = await migrateLocalDataToServer('test-jwt-token');

      expect(result.migrated).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toEqual([]);
      expect(result.alreadyMigrated).toBe(false);
      // Flag should still be set (nothing to migrate means we're done)
      expect(mockStorage.get('skyhawk_data_migrated')).toBe('true');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles partial failure (some properties fail)', async () => {
      const props = [
        makeProperty({ id: 'p1', address: '111 First St' }),
        makeProperty({ id: 'p2', address: '222 Second St' }),
        makeProperty({ id: 'p3', address: '333 Third St' }),
      ];
      setPersistedProperties(props);

      // First succeeds, second fails, third succeeds
      mockFetch
        .mockResolvedValueOnce(
          mockJsonResponse({ id: 'server-1', address: '111 First St', created_at: '2026-01-01', updated_at: '2026-01-01' }, 201),
        )
        .mockResolvedValueOnce(
          mockJsonResponse({ error: 'Server error' }, 500),
        )
        .mockResolvedValueOnce(
          mockJsonResponse({ id: 'server-3', address: '333 Third St', created_at: '2026-01-01', updated_at: '2026-01-01' }, 201),
        );

      const result = await migrateLocalDataToServer('test-jwt-token');

      expect(result.migrated).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('222 Second St');
      expect(result.alreadyMigrated).toBe(false);
      // Flag should NOT be set because there were failures
      expect(mockStorage.get('skyhawk_data_migrated')).toBeUndefined();
    });

    it('does not set flag when all properties fail', async () => {
      const props = [makeProperty({ id: 'p1', address: '111 First St' })];
      setPersistedProperties(props);

      mockFetch.mockResolvedValue(mockJsonResponse({ error: 'Server down' }, 500));

      const result = await migrateLocalDataToServer('test-jwt-token');

      expect(result.migrated).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(mockStorage.get('skyhawk_data_migrated')).toBeUndefined();
    });

    it('is idempotent — second call after success returns alreadyMigrated', async () => {
      const props = [makeProperty()];
      setPersistedProperties(props);

      mockFetch.mockResolvedValue(
        mockJsonResponse({ id: 'server-id', address: 'test', created_at: '2026-01-01', updated_at: '2026-01-01' }, 201),
      );

      const first = await migrateLocalDataToServer('test-jwt-token');
      expect(first.migrated).toBe(1);
      expect(first.alreadyMigrated).toBe(false);

      // Reset fetch mock to verify no further calls
      mockFetch.mockReset();

      const second = await migrateLocalDataToServer('test-jwt-token');
      expect(second.alreadyMigrated).toBe(true);
      expect(second.migrated).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('reports correct counts with mixed success and failure', async () => {
      const props = [
        makeProperty({ id: 'p1', address: 'Good 1' }),
        makeProperty({ id: 'p2', address: 'Bad 1' }),
        makeProperty({ id: 'p3', address: 'Good 2' }),
        makeProperty({ id: 'p4', address: 'Bad 2' }),
        makeProperty({ id: 'p5', address: 'Good 3' }),
      ];
      setPersistedProperties(props);

      mockFetch
        .mockResolvedValueOnce(mockJsonResponse({ id: 's1', address: 'Good 1', created_at: '2026-01-01', updated_at: '2026-01-01' }, 201))
        .mockResolvedValueOnce(mockJsonResponse({ error: 'fail' }, 500))
        .mockResolvedValueOnce(mockJsonResponse({ id: 's3', address: 'Good 2', created_at: '2026-01-01', updated_at: '2026-01-01' }, 201))
        .mockResolvedValueOnce(mockJsonResponse({ error: 'fail' }, 500))
        .mockResolvedValueOnce(mockJsonResponse({ id: 's5', address: 'Good 3', created_at: '2026-01-01', updated_at: '2026-01-01' }, 201));

      const result = await migrateLocalDataToServer('test-jwt-token');

      expect(result.migrated).toBe(3);
      expect(result.failed).toBe(2);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('Bad 1');
      expect(result.errors[1]).toContain('Bad 2');
    });

    it('handles network errors gracefully', async () => {
      const props = [makeProperty({ id: 'p1', address: 'Test Property' })];
      setPersistedProperties(props);

      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      const result = await migrateLocalDataToServer('test-jwt-token');

      expect(result.migrated).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors[0]).toContain('Test Property');
      expect(result.errors[0]).toContain('Failed to fetch');
    });
  });
});
