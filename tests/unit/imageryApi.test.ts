/**
 * Unit tests for imageryApi.ts
 * Tests the oblique satellite imagery capture service.
 * Run with: npx vitest run tests/unit/imageryApi.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildStaticMapUrl, captureObliqueViews, getDirections } from '../../src/services/imageryApi';

// ─── Mock fetch ─────────────────────────────────────────────────────

const mockBlob = {
  type: 'image/png',
};

const mockReader = {
  result: 'data:image/png;base64,mockimagedata',
  onloadend: null as (() => void) | null,
  onerror: null as (() => void) | null,
  readAsDataURL: vi.fn(function (this: typeof mockReader) {
    // Simulate async completion
    setTimeout(() => {
      if (this.onloadend) this.onloadend();
    }, 0);
  }),
};

beforeEach(() => {
  vi.clearAllMocks();

  // Mock fetch
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    blob: vi.fn().mockResolvedValue(mockBlob),
  });

  // Mock FileReader
  // @ts-expect-error - mocking FileReader for test environment
  globalThis.FileReader = vi.fn().mockImplementation(() => ({
    result: 'data:image/png;base64,mockimagedata',
    onloadend: null,
    onerror: null,
    readAsDataURL: vi.fn(function (this: { onloadend: (() => void) | null }) {
      setTimeout(() => {
        if (this.onloadend) this.onloadend();
      }, 0);
    }),
  }));
});

// ─── Tests ──────────────────────────────────────────────────────────

describe('imageryApi', () => {
  describe('buildStaticMapUrl', () => {
    it('should build a valid Google Maps Static API URL', () => {
      const url = buildStaticMapUrl(36.1070, -97.0520, 'test-api-key', {
        key: 'north',
        heading: 0,
        latOffset: 0.0003,
        lngOffset: 0,
      });

      expect(url).toContain('https://maps.googleapis.com/maps/api/staticmap');
      expect(url).toContain('key=test-api-key');
      expect(url).toContain('maptype=satellite');
      expect(url).toContain('zoom=20');
      expect(url).toContain('heading=0');
    });

    it('should apply lat/lng offsets correctly', () => {
      const url = buildStaticMapUrl(36.1070, -97.0520, 'test-key', {
        key: 'north',
        heading: 0,
        latOffset: 0.0003,
        lngOffset: 0,
      });

      // Center should be lat + offset
      expect(url).toContain('center=36.1073');
    });

    it('should use the specified heading', () => {
      const url = buildStaticMapUrl(36.1070, -97.0520, 'test-key', {
        key: 'east',
        heading: 90,
        latOffset: 0,
        lngOffset: 0.0004,
      });

      expect(url).toContain('heading=90');
    });

    it('should use default size of 640x480', () => {
      const url = buildStaticMapUrl(36.1070, -97.0520, 'test-key', {
        key: 'north',
        heading: 0,
        latOffset: 0,
        lngOffset: 0,
      });

      expect(url).toContain('size=640x480');
    });

    it('should accept custom size parameter', () => {
      const url = buildStaticMapUrl(36.1070, -97.0520, 'test-key', {
        key: 'north',
        heading: 0,
        latOffset: 0,
        lngOffset: 0,
      }, '800x600');

      expect(url).toContain('size=800x600');
    });
  });

  describe('getDirections', () => {
    it('should return 4 directions', () => {
      const directions = getDirections();
      expect(directions).toHaveLength(4);
    });

    it('should include all cardinal directions', () => {
      const directions = getDirections();
      const keys = directions.map(d => d.key);
      expect(keys).toContain('north');
      expect(keys).toContain('south');
      expect(keys).toContain('east');
      expect(keys).toContain('west');
    });

    it('should have correct headings', () => {
      const directions = getDirections();
      const headingMap = Object.fromEntries(directions.map(d => [d.key, d.heading]));
      expect(headingMap.north).toBe(0);
      expect(headingMap.east).toBe(90);
      expect(headingMap.south).toBe(180);
      expect(headingMap.west).toBe(270);
    });

    it('should return a copy (not a mutable reference)', () => {
      const d1 = getDirections();
      const d2 = getDirections();
      expect(d1).not.toBe(d2);
      expect(d1).toEqual(d2);
    });
  });

  describe('captureObliqueViews', () => {
    it('should call fetch 4 times (once per direction)', async () => {
      await captureObliqueViews(36.1070, -97.0520, 'test-api-key');
      expect(globalThis.fetch).toHaveBeenCalledTimes(4);
    });

    it('should return an object with direction keys', async () => {
      const result = await captureObliqueViews(36.1070, -97.0520, 'test-api-key');
      // Even if some fail, the result should be an object
      expect(typeof result).toBe('object');
    });

    it('should include all directions when all fetches succeed', async () => {
      const result = await captureObliqueViews(36.1070, -97.0520, 'test-api-key');
      expect(result.north).toBeDefined();
      expect(result.south).toBeDefined();
      expect(result.east).toBeDefined();
      expect(result.west).toBeDefined();
    });

    it('should handle fetch failures gracefully', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      const result = await captureObliqueViews(36.1070, -97.0520, 'test-api-key');
      // Should not throw, just return empty/partial results
      expect(typeof result).toBe('object');
    });

    it('should handle non-OK responses gracefully', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 403,
        blob: vi.fn(),
      });

      const result = await captureObliqueViews(36.1070, -97.0520, 'test-api-key');
      // Should return empty results when API returns errors
      expect(result.north).toBeUndefined();
      expect(result.south).toBeUndefined();
    });

    it('should pass the correct API key in URLs', async () => {
      await captureObliqueViews(36.1070, -97.0520, 'my-secret-key');

      const fetchCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
      for (const call of fetchCalls) {
        expect(call[0]).toContain('key=my-secret-key');
      }
    });

    it('should use satellite maptype in all URLs', async () => {
      await captureObliqueViews(36.1070, -97.0520, 'test-key');

      const fetchCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
      for (const call of fetchCalls) {
        expect(call[0]).toContain('maptype=satellite');
      }
    });
  });
});
