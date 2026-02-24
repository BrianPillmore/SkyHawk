/**
 * Unit tests for diagramRenderer.ts
 * Tests the wireframe diagram rendering functions.
 * Since these rely on canvas/DOM APIs, we mock the canvas context.
 * Run with: npx vitest run tests/unit/diagramRenderer.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { RoofMeasurement, RoofVertex, RoofEdge, RoofFacet } from '../../src/types';

// ─── Mock Canvas ────────────────────────────────────────────────────
const mockFillRect = vi.fn();
const mockRect = vi.fn();
const mockBeginPath = vi.fn();
const mockMoveTo = vi.fn();
const mockLineTo = vi.fn();
const mockClosePath = vi.fn();
const mockFill = vi.fn();
const mockStroke = vi.fn();
const mockArc = vi.fn();
const mockFillText = vi.fn();
const mockMeasureText = vi.fn().mockReturnValue({ width: 50 });
const mockToDataURL = vi.fn().mockReturnValue('data:image/png;base64,mockdata');

const mockCtx = {
  fillRect: mockFillRect,
  rect: mockRect,
  beginPath: mockBeginPath,
  moveTo: mockMoveTo,
  lineTo: mockLineTo,
  closePath: mockClosePath,
  fill: mockFill,
  stroke: mockStroke,
  arc: mockArc,
  fillText: mockFillText,
  measureText: mockMeasureText,
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: '',
  textBaseline: '',
};

// Mock document.createElement to return a fake canvas
const origCreateElement = globalThis.document?.createElement;
beforeEach(() => {
  vi.clearAllMocks();
  // Ensure document exists for the test environment
  if (typeof globalThis.document === 'undefined') {
    // @ts-expect-error - mocking document for test environment
    globalThis.document = {
      createElement: vi.fn().mockReturnValue({
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue(mockCtx),
        toDataURL: mockToDataURL,
      }),
    };
  } else {
    vi.spyOn(document, 'createElement').mockReturnValue({
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockCtx),
      toDataURL: mockToDataURL,
    } as unknown as HTMLElement);
  }
});

// ─── Helpers ────────────────────────────────────────────────────────

function createVertex(id: string, lat: number, lng: number): RoofVertex {
  return { id, lat, lng };
}

function createEdge(id: string, startId: string, endId: string, type: RoofEdge['type'], lengthFt: number): RoofEdge {
  return { id, startVertexId: startId, endVertexId: endId, type, lengthFt };
}

function createFacet(id: string, name: string, vertexIds: string[], pitch: number, areaSqFt: number, trueAreaSqFt: number): RoofFacet {
  return { id, name, vertexIds, pitch, areaSqFt, trueAreaSqFt, edgeIds: [] };
}

function createMeasurement(overrides: Partial<RoofMeasurement> = {}): RoofMeasurement {
  const v1 = createVertex('v1', 36.1070, -97.0520);
  const v2 = createVertex('v2', 36.1072, -97.0520);
  const v3 = createVertex('v3', 36.1072, -97.0518);
  const v4 = createVertex('v4', 36.1070, -97.0518);

  return {
    id: 'meas-1',
    propertyId: 'prop-1',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    vertices: [v1, v2, v3, v4],
    edges: [
      createEdge('e1', 'v1', 'v2', 'eave', 22.9),
      createEdge('e2', 'v2', 'v3', 'rake', 16.4),
      createEdge('e3', 'v3', 'v4', 'ridge', 22.9),
      createEdge('e4', 'v4', 'v1', 'rake', 16.4),
    ],
    facets: [
      createFacet('f1', 'South Slope', ['v1', 'v2', 'v3', 'v4'], 7, 375, 412),
    ],
    totalAreaSqFt: 375,
    totalTrueAreaSqFt: 412,
    totalSquares: 4.12,
    predominantPitch: 7,
    totalRidgeLf: 22.9,
    totalHipLf: 0,
    totalValleyLf: 0,
    totalRakeLf: 32.8,
    totalEaveLf: 22.9,
    totalFlashingLf: 0,
    totalStepFlashingLf: 0,
    totalDripEdgeLf: 55.7,
    suggestedWastePercent: 10,
    ridgeCount: 1,
    hipCount: 0,
    valleyCount: 0,
    rakeCount: 2,
    eaveCount: 1,
    flashingCount: 0,
    stepFlashingCount: 0,
    structureComplexity: 'Simple',
    estimatedAtticSqFt: 375,
    pitchBreakdown: [{ pitch: 7, areaSqFt: 412, percentOfRoof: 100 }],
    ...overrides,
  };
}

// ─── Import after mocks ─────────────────────────────────────────────
import { renderLengthDiagram, renderAreaDiagram, renderPitchDiagram } from '../../src/utils/diagramRenderer';

// ─── Tests ──────────────────────────────────────────────────────────

describe('diagramRenderer', () => {
  describe('renderLengthDiagram', () => {
    it('should return a base64 PNG data URL for valid measurement', () => {
      const measurement = createMeasurement();
      const result = renderLengthDiagram(measurement);
      expect(result).toBe('data:image/png;base64,mockdata');
    });

    it('should return null when there are no vertices', () => {
      const measurement = createMeasurement({ vertices: [] });
      const result = renderLengthDiagram(measurement);
      // With no vertices, projectVertices returns empty map → null
      expect(result).toBeNull();
    });

    it('should draw edge lines for each edge', () => {
      const measurement = createMeasurement();
      renderLengthDiagram(measurement);
      // Should call moveTo/lineTo for each edge (4 edges)
      // Plus facet polygon drawing and compass and legend
      expect(mockMoveTo.mock.calls.length).toBeGreaterThanOrEqual(4);
      expect(mockLineTo.mock.calls.length).toBeGreaterThanOrEqual(4);
    });

    it('should draw vertex dots', () => {
      const measurement = createMeasurement();
      renderLengthDiagram(measurement);
      // Should draw arcs for vertex dots (4 vertices) + compass arc
      expect(mockArc.mock.calls.length).toBeGreaterThanOrEqual(4);
    });

    it('should label edges with their lengths', () => {
      const measurement = createMeasurement();
      renderLengthDiagram(measurement);
      // Check that fillText was called with edge length labels
      const texts = mockFillText.mock.calls.map(c => c[0]);
      expect(texts.some((t: string) => t.includes("22.9'"))).toBe(true);
      expect(texts.some((t: string) => t.includes("16.4'"))).toBe(true);
    });

    it('should call toDataURL to produce the output', () => {
      const measurement = createMeasurement();
      renderLengthDiagram(measurement);
      expect(mockToDataURL).toHaveBeenCalledWith('image/png');
    });
  });

  describe('renderAreaDiagram', () => {
    it('should return a base64 PNG data URL for valid measurement', () => {
      const measurement = createMeasurement();
      const result = renderAreaDiagram(measurement);
      expect(result).toBe('data:image/png;base64,mockdata');
    });

    it('should return null when there are no vertices', () => {
      const measurement = createMeasurement({ vertices: [] });
      const result = renderAreaDiagram(measurement);
      expect(result).toBeNull();
    });

    it('should label facets with numbered area text', () => {
      const measurement = createMeasurement();
      renderAreaDiagram(measurement);
      const texts = mockFillText.mock.calls.map(c => c[0]);
      // Should contain "#1 — 412 sf" or similar
      expect(texts.some((t: string) => t.includes('#1') && t.includes('sf'))).toBe(true);
    });

    it('should draw facet polygons', () => {
      const measurement = createMeasurement();
      renderAreaDiagram(measurement);
      // beginPath called at least once for facet polygon + wireframe edges + compass
      expect(mockBeginPath.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(mockClosePath.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle multiple facets', () => {
      const measurement = createMeasurement({
        facets: [
          createFacet('f1', 'South', ['v1', 'v2', 'v3'], 7, 200, 220),
          createFacet('f2', 'North', ['v2', 'v3', 'v4'], 5, 175, 185),
        ],
      });
      const result = renderAreaDiagram(measurement);
      expect(result).toBe('data:image/png;base64,mockdata');
      const texts = mockFillText.mock.calls.map(c => c[0]);
      expect(texts.some((t: string) => t.includes('#1'))).toBe(true);
      expect(texts.some((t: string) => t.includes('#2'))).toBe(true);
    });
  });

  describe('renderPitchDiagram', () => {
    it('should return a base64 PNG data URL for valid measurement', () => {
      const measurement = createMeasurement();
      const result = renderPitchDiagram(measurement);
      expect(result).toBe('data:image/png;base64,mockdata');
    });

    it('should return null when there are no vertices', () => {
      const measurement = createMeasurement({ vertices: [] });
      const result = renderPitchDiagram(measurement);
      expect(result).toBeNull();
    });

    it('should label facets with pitch values', () => {
      const measurement = createMeasurement();
      renderPitchDiagram(measurement);
      const texts = mockFillText.mock.calls.map(c => c[0]);
      // Should contain "7/12" pitch label
      expect(texts.some((t: string) => t.includes('7/12'))).toBe(true);
    });

    it('should handle flat pitch (0/12)', () => {
      const measurement = createMeasurement({
        facets: [
          createFacet('f1', 'Flat Roof', ['v1', 'v2', 'v3', 'v4'], 0, 375, 375),
        ],
      });
      const result = renderPitchDiagram(measurement);
      expect(result).not.toBeNull();
      const texts = mockFillText.mock.calls.map(c => c[0]);
      expect(texts.some((t: string) => t === 'Flat')).toBe(true);
    });

    it('should handle steep pitch (12+/12)', () => {
      const measurement = createMeasurement({
        facets: [
          createFacet('f1', 'Steep', ['v1', 'v2', 'v3', 'v4'], 14, 375, 500),
        ],
      });
      const result = renderPitchDiagram(measurement);
      expect(result).not.toBeNull();
      const texts = mockFillText.mock.calls.map(c => c[0]);
      expect(texts.some((t: string) => t.includes('14/12'))).toBe(true);
    });

    it('should draw pitch legend', () => {
      const measurement = createMeasurement();
      renderPitchDiagram(measurement);
      const texts = mockFillText.mock.calls.map(c => c[0]);
      // Legend should contain pitch range labels
      expect(texts.some((t: string) => t.includes('Flat-3/12'))).toBe(true);
      expect(texts.some((t: string) => t.includes('12+/12'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle measurement with edges but no facets', () => {
      const measurement = createMeasurement({ facets: [] });
      const lengthResult = renderLengthDiagram(measurement);
      expect(lengthResult).not.toBeNull(); // Still draws edges
    });

    it('should handle facets with missing vertex references gracefully', () => {
      const measurement = createMeasurement({
        facets: [
          createFacet('f1', 'Bad Refs', ['v1', 'v99', 'v100'], 7, 100, 110),
        ],
      });
      // Should not throw - just skips unfound vertices
      expect(() => renderAreaDiagram(measurement)).not.toThrow();
    });

    it('should handle single vertex (degenerate case)', () => {
      const measurement = createMeasurement({
        vertices: [createVertex('v1', 36.1070, -97.0520)],
        edges: [],
        facets: [],
      });
      const result = renderLengthDiagram(measurement);
      // Single vertex produces a valid canvas but minimal drawing
      expect(result).toBe('data:image/png;base64,mockdata');
    });
  });
});
