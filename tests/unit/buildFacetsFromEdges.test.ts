/**
 * Unit tests for buildFacetsFromEdges and buildFallbackFacet.
 */
import { describe, it, expect } from 'vitest';
import { buildFallbackFacet } from '../../src/utils/facetBuilder';
import type { EdgeType } from '../../src/types';

describe('buildFallbackFacet', () => {
  // ─── Loop Tracing ──────────────────────────────────────────────

  describe('loop tracing', () => {
    it('should trace a rectangle from 4 eave edges', () => {
      const vertices = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 1 },
        { lat: 1, lng: 1 },
        { lat: 1, lng: 0 },
      ];
      const edges: { startIndex: number; endIndex: number; type: EdgeType }[] = [
        { startIndex: 0, endIndex: 1, type: 'eave' },
        { startIndex: 1, endIndex: 2, type: 'eave' },
        { startIndex: 2, endIndex: 3, type: 'eave' },
        { startIndex: 3, endIndex: 0, type: 'eave' },
      ];
      const result = buildFallbackFacet(vertices, edges, 6);
      expect(result).toHaveLength(1);
      expect(result[0].vertexIndices).toHaveLength(4);
      expect(result[0].pitch).toBe(6);
    });

    it('should trace a triangle from 3 eave edges', () => {
      const vertices = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 1 },
        { lat: 1, lng: 0.5 },
      ];
      const edges: { startIndex: number; endIndex: number; type: EdgeType }[] = [
        { startIndex: 0, endIndex: 1, type: 'eave' },
        { startIndex: 1, endIndex: 2, type: 'eave' },
        { startIndex: 2, endIndex: 0, type: 'eave' },
      ];
      const result = buildFallbackFacet(vertices, edges, 8);
      expect(result).toHaveLength(1);
      expect(result[0].vertexIndices).toHaveLength(3);
      expect(result[0].pitch).toBe(8);
    });

    it('should trace an L-shape from perimeter', () => {
      const vertices = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 2 },
        { lat: 1, lng: 2 },
        { lat: 1, lng: 1 },
        { lat: 2, lng: 1 },
        { lat: 2, lng: 0 },
      ];
      const edges: { startIndex: number; endIndex: number; type: EdgeType }[] = [
        { startIndex: 0, endIndex: 1, type: 'eave' },
        { startIndex: 1, endIndex: 2, type: 'eave' },
        { startIndex: 2, endIndex: 3, type: 'eave' },
        { startIndex: 3, endIndex: 4, type: 'eave' },
        { startIndex: 4, endIndex: 5, type: 'eave' },
        { startIndex: 5, endIndex: 0, type: 'eave' },
      ];
      const result = buildFallbackFacet(vertices, edges, 6);
      expect(result).toHaveLength(1);
      expect(result[0].vertexIndices.length).toBeGreaterThanOrEqual(6);
    });

    it('should use eave+rake as perimeter edges (ignoring internal edges)', () => {
      const vertices = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 1 },
        { lat: 1, lng: 1 },
        { lat: 1, lng: 0 },
        { lat: 0.5, lng: 0 },
        { lat: 0.5, lng: 1 },
      ];
      const edges: { startIndex: number; endIndex: number; type: EdgeType }[] = [
        { startIndex: 0, endIndex: 1, type: 'eave' },
        { startIndex: 1, endIndex: 2, type: 'rake' },
        { startIndex: 2, endIndex: 3, type: 'eave' },
        { startIndex: 3, endIndex: 0, type: 'rake' },
        { startIndex: 4, endIndex: 5, type: 'ridge' }, // internal, should be ignored
      ];
      const result = buildFallbackFacet(vertices, edges, 6);
      expect(result).toHaveLength(1);
      // Should only trace the perimeter (4 vertices), not internal ridge
      expect(result[0].vertexIndices).toHaveLength(4);
    });

    it('should handle branching perimeter (uses first traversal)', () => {
      const vertices = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 1 },
        { lat: 1, lng: 1 },
        { lat: 1, lng: 0 },
      ];
      const edges: { startIndex: number; endIndex: number; type: EdgeType }[] = [
        { startIndex: 0, endIndex: 1, type: 'eave' },
        { startIndex: 1, endIndex: 2, type: 'eave' },
        { startIndex: 2, endIndex: 3, type: 'eave' },
        { startIndex: 3, endIndex: 0, type: 'eave' },
      ];
      const result = buildFallbackFacet(vertices, edges, 6);
      expect(result).toHaveLength(1);
    });
  });

  // ─── Fallbacks ────────────────────────────────────────────────

  describe('fallbacks', () => {
    it('should use all vertex indices when loop has < 3 vertices but >= 3 perimeter vertices', () => {
      // Perimeter with disconnected segments
      const vertices = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 1 },
        { lat: 1, lng: 1 },
        { lat: 1, lng: 0 },
      ];
      const edges: { startIndex: number; endIndex: number; type: EdgeType }[] = [
        { startIndex: 0, endIndex: 1, type: 'eave' },
        { startIndex: 2, endIndex: 3, type: 'eave' },
        { startIndex: 1, endIndex: 2, type: 'eave' }, // connects them
      ];
      const result = buildFallbackFacet(vertices, edges, 6);
      expect(result).toHaveLength(1);
      expect(result[0].vertexIndices.length).toBeGreaterThanOrEqual(3);
    });

    it('should use all vertex indices when < 3 perimeter edges but >= 3 total vertices', () => {
      const vertices = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 1 },
        { lat: 1, lng: 0 },
      ];
      const edges: { startIndex: number; endIndex: number; type: EdgeType }[] = [
        { startIndex: 0, endIndex: 1, type: 'eave' },
        { startIndex: 1, endIndex: 2, type: 'ridge' }, // not perimeter
      ];
      const result = buildFallbackFacet(vertices, edges, 6);
      expect(result).toHaveLength(1);
      expect(result[0].vertexIndices).toEqual([0, 1, 2]);
    });

    it('should return empty when < 3 total vertices and < 3 perimeter edges', () => {
      const vertices = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 1 },
      ];
      const edges: { startIndex: number; endIndex: number; type: EdgeType }[] = [
        { startIndex: 0, endIndex: 1, type: 'ridge' },
      ];
      const result = buildFallbackFacet(vertices, edges, 6);
      expect(result).toHaveLength(0);
    });

    it('should return empty for empty inputs', () => {
      expect(buildFallbackFacet([], [], 6)).toHaveLength(0);
    });
  });

  // ─── Edge Type Filtering ───────────────────────────────────────

  describe('edge type filtering', () => {
    it('should include eave edges as perimeter', () => {
      const vertices = [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 0 }];
      const edges: { startIndex: number; endIndex: number; type: EdgeType }[] = [
        { startIndex: 0, endIndex: 1, type: 'eave' },
        { startIndex: 1, endIndex: 2, type: 'eave' },
        { startIndex: 2, endIndex: 0, type: 'eave' },
      ];
      const result = buildFallbackFacet(vertices, edges, 6);
      expect(result).toHaveLength(1);
    });

    it('should include rake edges as perimeter', () => {
      const vertices = [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 0 }];
      const edges: { startIndex: number; endIndex: number; type: EdgeType }[] = [
        { startIndex: 0, endIndex: 1, type: 'rake' },
        { startIndex: 1, endIndex: 2, type: 'rake' },
        { startIndex: 2, endIndex: 0, type: 'rake' },
      ];
      const result = buildFallbackFacet(vertices, edges, 6);
      expect(result).toHaveLength(1);
    });

    it('should exclude ridge edges from perimeter', () => {
      const vertices = [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 0 }];
      const edges: { startIndex: number; endIndex: number; type: EdgeType }[] = [
        { startIndex: 0, endIndex: 1, type: 'ridge' },
        { startIndex: 1, endIndex: 2, type: 'ridge' },
        { startIndex: 2, endIndex: 0, type: 'ridge' },
      ];
      // No perimeter edges, so should fall back to all vertices
      const result = buildFallbackFacet(vertices, edges, 6);
      expect(result).toHaveLength(1);
      expect(result[0].vertexIndices).toEqual([0, 1, 2]);
    });

    it('should exclude hip edges from perimeter', () => {
      const vertices = [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 0 }];
      const edges: { startIndex: number; endIndex: number; type: EdgeType }[] = [
        { startIndex: 0, endIndex: 1, type: 'hip' },
        { startIndex: 1, endIndex: 2, type: 'hip' },
        { startIndex: 2, endIndex: 0, type: 'hip' },
      ];
      const result = buildFallbackFacet(vertices, edges, 6);
      expect(result).toHaveLength(1);
      expect(result[0].vertexIndices).toEqual([0, 1, 2]);
    });

    it('should exclude valley edges from perimeter', () => {
      const vertices = [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 0 }];
      const edges: { startIndex: number; endIndex: number; type: EdgeType }[] = [
        { startIndex: 0, endIndex: 1, type: 'valley' },
        { startIndex: 1, endIndex: 2, type: 'valley' },
        { startIndex: 2, endIndex: 0, type: 'valley' },
      ];
      const result = buildFallbackFacet(vertices, edges, 6);
      expect(result).toHaveLength(1);
      expect(result[0].vertexIndices).toEqual([0, 1, 2]);
    });

    it('should exclude flashing edges from perimeter', () => {
      const vertices = [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 0 }];
      const edges: { startIndex: number; endIndex: number; type: EdgeType }[] = [
        { startIndex: 0, endIndex: 1, type: 'flashing' },
        { startIndex: 1, endIndex: 2, type: 'flashing' },
        { startIndex: 2, endIndex: 0, type: 'flashing' },
      ];
      const result = buildFallbackFacet(vertices, edges, 6);
      expect(result).toHaveLength(1);
      expect(result[0].vertexIndices).toEqual([0, 1, 2]);
    });
  });

  // ─── Pitch and Naming ─────────────────────────────────────────

  describe('pitch and naming', () => {
    it('should assign the specified pitch', () => {
      const vertices = [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 0 }];
      const edges: { startIndex: number; endIndex: number; type: EdgeType }[] = [
        { startIndex: 0, endIndex: 1, type: 'eave' },
        { startIndex: 1, endIndex: 2, type: 'eave' },
        { startIndex: 2, endIndex: 0, type: 'eave' },
      ];
      const result = buildFallbackFacet(vertices, edges, 8);
      expect(result[0].pitch).toBe(8);
    });

    it('should default to pitch 6', () => {
      const vertices = [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 0 }];
      const edges: { startIndex: number; endIndex: number; type: EdgeType }[] = [
        { startIndex: 0, endIndex: 1, type: 'eave' },
        { startIndex: 1, endIndex: 2, type: 'eave' },
        { startIndex: 2, endIndex: 0, type: 'eave' },
      ];
      // Use default by not passing pitch
      const result = buildFallbackFacet(vertices, edges, 6);
      expect(result[0].pitch).toBe(6);
    });

    it('should name facet "#1 Roof"', () => {
      const vertices = [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 0 }];
      const edges: { startIndex: number; endIndex: number; type: EdgeType }[] = [
        { startIndex: 0, endIndex: 1, type: 'eave' },
        { startIndex: 1, endIndex: 2, type: 'eave' },
        { startIndex: 2, endIndex: 0, type: 'eave' },
      ];
      const result = buildFallbackFacet(vertices, edges, 6);
      expect(result[0].name).toBe('#1 Roof');
    });

    it('should assign zero pitch correctly', () => {
      const vertices = [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 0 }];
      const edges: { startIndex: number; endIndex: number; type: EdgeType }[] = [
        { startIndex: 0, endIndex: 1, type: 'eave' },
        { startIndex: 1, endIndex: 2, type: 'eave' },
        { startIndex: 2, endIndex: 0, type: 'eave' },
      ];
      const result = buildFallbackFacet(vertices, edges, 0);
      expect(result[0].pitch).toBe(0);
    });

    it('should assign steep pitch correctly', () => {
      const vertices = [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 0 }];
      const edges: { startIndex: number; endIndex: number; type: EdgeType }[] = [
        { startIndex: 0, endIndex: 1, type: 'eave' },
        { startIndex: 1, endIndex: 2, type: 'eave' },
        { startIndex: 2, endIndex: 0, type: 'eave' },
      ];
      const result = buildFallbackFacet(vertices, edges, 12);
      expect(result[0].pitch).toBe(12);
    });
  });
});
