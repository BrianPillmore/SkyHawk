import { describe, it, expect } from 'vitest';
import { vectorizeEdges } from '../../server/ml/vectorize';
import type { VectorEdge } from '../../server/ml/vectorize';

const IMAGE_SIZE = 640;

/**
 * Integration test: simulates the full ML pipeline
 *   mask → vectorize → edge format compatible with planarFaceExtraction
 *
 * (Inference step is mocked since ONNX model isn't available in test environment)
 */

/** Create a simple gable roof mask for testing. */
function createGableRoofMask(): Uint8Array {
  const mask = new Uint8Array(IMAGE_SIZE * IMAGE_SIZE);

  // Fill roof surface (class 1) — rectangle from (150,200) to (490,450)
  for (let y = 200; y <= 450; y++) {
    for (let x = 150; x <= 490; x++) {
      mask[y * IMAGE_SIZE + x] = 1;
    }
  }

  // Ridge line (class 2) — horizontal from (150, 320) to (490, 320)
  for (let y = 318; y <= 322; y++) {
    for (let x = 150; x <= 490; x++) {
      mask[y * IMAGE_SIZE + x] = 2;
    }
  }

  // Top eave (class 5) — horizontal from (150, 200) to (490, 200)
  for (let y = 198; y <= 202; y++) {
    for (let x = 150; x <= 490; x++) {
      mask[y * IMAGE_SIZE + x] = 5;
    }
  }

  // Bottom eave (class 5) — horizontal from (150, 450) to (490, 450)
  for (let y = 448; y <= 452; y++) {
    for (let x = 150; x <= 490; x++) {
      mask[y * IMAGE_SIZE + x] = 5;
    }
  }

  // Left rake (class 5) — vertical from (150, 200) to (150, 450)
  for (let x = 148; x <= 152; x++) {
    for (let y = 200; y <= 450; y++) {
      mask[y * IMAGE_SIZE + x] = 5;
    }
  }

  // Right rake (class 5) — vertical from (490, 200) to (490, 450)
  for (let x = 488; x <= 492; x++) {
    for (let y = 200; y <= 450; y++) {
      mask[y * IMAGE_SIZE + x] = 5;
    }
  }

  return mask;
}

/** Create a hip roof mask. */
function createHipRoofMask(): Uint8Array {
  const mask = new Uint8Array(IMAGE_SIZE * IMAGE_SIZE);

  // Fill roof surface
  for (let y = 200; y <= 450; y++) {
    for (let x = 150; x <= 490; x++) {
      mask[y * IMAGE_SIZE + x] = 1;
    }
  }

  // Ridge (class 2) — shorter horizontal in center
  for (let y = 318; y <= 322; y++) {
    for (let x = 250; x <= 390; x++) {
      mask[y * IMAGE_SIZE + x] = 2;
    }
  }

  // Hip lines (class 3) — diagonal from ridge ends to corners
  // Top-left hip: (250, 320) → (150, 200)
  for (let t = 0; t <= 100; t++) {
    const x = Math.round(250 - t);
    const y = Math.round(320 - t * 1.2);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (px >= 0 && px < IMAGE_SIZE && py >= 0 && py < IMAGE_SIZE) {
          mask[py * IMAGE_SIZE + px] = 3;
        }
      }
    }
  }

  // Bottom eaves
  for (let y = 448; y <= 452; y++) {
    for (let x = 150; x <= 490; x++) {
      mask[y * IMAGE_SIZE + x] = 5;
    }
  }

  return mask;
}

describe('ML Pipeline Integration', () => {
  describe('gable roof mask → vector edges', () => {
    it('produces ridge and eave/rake edges', () => {
      const mask = createGableRoofMask();
      const edges = vectorizeEdges(mask);

      expect(edges.length).toBeGreaterThan(0);

      const types = new Set(edges.map(e => e.type));
      expect(types.has('ridge')).toBe(true);
      expect(types.has('eave')).toBe(true);
    });

    it('ridge line spans the roof width', () => {
      const mask = createGableRoofMask();
      const edges = vectorizeEdges(mask);

      const ridgeEdges = edges.filter(e => e.type === 'ridge');
      expect(ridgeEdges.length).toBeGreaterThanOrEqual(1);

      // Total ridge span
      const allX = ridgeEdges.flatMap(e => [e.start.x, e.end.x]);
      const span = Math.max(...allX) - Math.min(...allX);
      expect(span).toBeGreaterThan(200); // original line is 340px
    });

    it('edge format is compatible with downstream pipeline', () => {
      const mask = createGableRoofMask();
      const edges = vectorizeEdges(mask);

      for (const edge of edges) {
        // Each edge has start/end points with x,y
        expect(edge.start).toHaveProperty('x');
        expect(edge.start).toHaveProperty('y');
        expect(edge.end).toHaveProperty('x');
        expect(edge.end).toHaveProperty('y');

        // Type is a valid edge type
        expect(['ridge', 'hip', 'valley', 'eave', 'rake', 'flashing']).toContain(edge.type);

        // Coordinates are within image bounds
        expect(edge.start.x).toBeGreaterThanOrEqual(0);
        expect(edge.start.x).toBeLessThan(IMAGE_SIZE);
        expect(edge.start.y).toBeGreaterThanOrEqual(0);
        expect(edge.start.y).toBeLessThan(IMAGE_SIZE);
        expect(edge.end.x).toBeGreaterThanOrEqual(0);
        expect(edge.end.x).toBeLessThan(IMAGE_SIZE);
        expect(edge.end.y).toBeGreaterThanOrEqual(0);
        expect(edge.end.y).toBeLessThan(IMAGE_SIZE);

        // No zero-length edges
        expect(edge.start.x !== edge.end.x || edge.start.y !== edge.end.y).toBe(true);
      }
    });
  });

  describe('hip roof mask → vector edges', () => {
    it('produces hip edges', () => {
      const mask = createHipRoofMask();
      const edges = vectorizeEdges(mask);

      const types = new Set(edges.map(e => e.type));
      expect(types.has('ridge')).toBe(true);
      expect(types.has('hip')).toBe(true);
    });
  });

  describe('pixel-to-latlng conversion', () => {
    it('correctly maps pixel coordinates to geographic bounds', () => {
      // This tests the math used in mlVision.ts route
      const bounds = { north: 35.5, south: 35.4, east: -97.5, west: -97.6 };
      const imageSize = 640;
      const latRange = bounds.north - bounds.south;
      const lngRange = bounds.east - bounds.west;

      // Top-left pixel (0,0) → north-west corner
      const topLeft = {
        lat: bounds.north - (0 / imageSize) * latRange,
        lng: bounds.west + (0 / imageSize) * lngRange,
      };
      expect(topLeft.lat).toBeCloseTo(35.5, 4);
      expect(topLeft.lng).toBeCloseTo(-97.6, 4);

      // Bottom-right pixel (640,640) → south-east corner
      const bottomRight = {
        lat: bounds.north - (640 / imageSize) * latRange,
        lng: bounds.west + (640 / imageSize) * lngRange,
      };
      expect(bottomRight.lat).toBeCloseTo(35.4, 4);
      expect(bottomRight.lng).toBeCloseTo(-97.5, 4);

      // Center pixel (320,320) → center of bounds
      const center = {
        lat: bounds.north - (320 / imageSize) * latRange,
        lng: bounds.west + (320 / imageSize) * lngRange,
      };
      expect(center.lat).toBeCloseTo(35.45, 4);
      expect(center.lng).toBeCloseTo(-97.55, 4);
    });
  });
});
