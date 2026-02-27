import { describe, it, expect } from 'vitest';
import { vectorizeEdges } from '../../server/ml/vectorize';

const IMAGE_SIZE = 640;

/** Create a blank mask. */
function blankMask(): Uint8Array {
  return new Uint8Array(IMAGE_SIZE * IMAGE_SIZE);
}

/** Draw a horizontal line of a given class on a mask. */
function drawHorizontalLine(mask: Uint8Array, y: number, x0: number, x1: number, classId: number, width = 3) {
  const half = Math.floor(width / 2);
  for (let dy = -half; dy <= half; dy++) {
    const py = y + dy;
    if (py < 0 || py >= IMAGE_SIZE) continue;
    for (let x = x0; x <= x1; x++) {
      if (x >= 0 && x < IMAGE_SIZE) {
        mask[py * IMAGE_SIZE + x] = classId;
      }
    }
  }
}

/** Draw a vertical line of a given class on a mask. */
function drawVerticalLine(mask: Uint8Array, x: number, y0: number, y1: number, classId: number, width = 3) {
  const half = Math.floor(width / 2);
  for (let dx = -half; dx <= half; dx++) {
    const px = x + dx;
    if (px < 0 || px >= IMAGE_SIZE) continue;
    for (let y = y0; y <= y1; y++) {
      if (y >= 0 && y < IMAGE_SIZE) {
        mask[y * IMAGE_SIZE + px] = classId;
      }
    }
  }
}

describe('mlVectorize', () => {
  describe('vectorizeEdges', () => {
    it('returns empty array for blank mask', () => {
      const mask = blankMask();
      const edges = vectorizeEdges(mask);
      expect(edges).toEqual([]);
    });

    it('returns empty array for mask with only background and roof surface', () => {
      const mask = blankMask();
      // Fill center with roof surface (class 1)
      for (let y = 200; y < 400; y++) {
        for (let x = 200; x < 400; x++) {
          mask[y * IMAGE_SIZE + x] = 1;
        }
      }
      const edges = vectorizeEdges(mask);
      expect(edges).toEqual([]);
    });

    it('detects a horizontal ridge line', () => {
      const mask = blankMask();
      // Draw a horizontal ridge (class 2) from x=100 to x=500 at y=320
      drawHorizontalLine(mask, 320, 100, 500, 2);

      const edges = vectorizeEdges(mask);
      expect(edges.length).toBeGreaterThanOrEqual(1);

      // All edges should be type 'ridge'
      for (const edge of edges) {
        expect(edge.type).toBe('ridge');
      }

      // Total span should cover most of the drawn line
      const minX = Math.min(...edges.map(e => Math.min(e.start.x, e.end.x)));
      const maxX = Math.max(...edges.map(e => Math.max(e.start.x, e.end.x)));
      expect(maxX - minX).toBeGreaterThan(300);
    });

    it('detects edges of different types', () => {
      const mask = blankMask();

      // Ridge (class 2) — horizontal at y=200
      drawHorizontalLine(mask, 200, 100, 500, 2);

      // Hip (class 3) — horizontal at y=300
      drawHorizontalLine(mask, 300, 100, 500, 3);

      // Eave (class 5) — horizontal at y=400
      drawHorizontalLine(mask, 400, 100, 500, 5);

      const edges = vectorizeEdges(mask);
      const types = new Set(edges.map(e => e.type));

      expect(types.has('ridge')).toBe(true);
      expect(types.has('hip')).toBe(true);
      expect(types.has('eave')).toBe(true);
    });

    it('detects a vertical line', () => {
      const mask = blankMask();
      // Vertical valley (class 4) at x=320
      drawVerticalLine(mask, 320, 100, 500, 4);

      const edges = vectorizeEdges(mask);
      expect(edges.length).toBeGreaterThanOrEqual(1);

      for (const edge of edges) {
        expect(edge.type).toBe('valley');
      }

      const minY = Math.min(...edges.map(e => Math.min(e.start.y, e.end.y)));
      const maxY = Math.max(...edges.map(e => Math.max(e.start.y, e.end.y)));
      expect(maxY - minY).toBeGreaterThan(300);
    });

    it('filters out very short edges', () => {
      const mask = blankMask();
      // Very short line (5 pixels) — should be filtered out
      drawHorizontalLine(mask, 320, 300, 305, 2);

      const edges = vectorizeEdges(mask);
      expect(edges.length).toBe(0);
    });

    it('snaps nearby endpoints together', () => {
      const mask = blankMask();

      // Two lines that almost meet at (320, 320)
      // Line 1: horizontal from (100, 320) to (318, 320)
      drawHorizontalLine(mask, 320, 100, 318, 2);
      // Line 2: vertical from (322, 100) to (322, 320)
      drawVerticalLine(mask, 322, 100, 318, 3);

      const edges = vectorizeEdges(mask);

      // There should be edges from both classes
      const ridgeEdges = edges.filter(e => e.type === 'ridge');
      const hipEdges = edges.filter(e => e.type === 'hip');
      expect(ridgeEdges.length).toBeGreaterThanOrEqual(1);
      expect(hipEdges.length).toBeGreaterThanOrEqual(1);
    });

    it('handles flashing class', () => {
      const mask = blankMask();
      drawHorizontalLine(mask, 320, 100, 400, 6); // flashing = class 6

      const edges = vectorizeEdges(mask);
      const flashingEdges = edges.filter(e => e.type === 'flashing');
      expect(flashingEdges.length).toBeGreaterThanOrEqual(1);
    });
  });
});
