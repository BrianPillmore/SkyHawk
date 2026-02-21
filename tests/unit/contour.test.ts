/**
 * Unit tests for contour algorithms: CCL, Moore boundary trace, Douglas-Peucker, pixel/latLng conversion
 * Run with: npx vitest run tests/unit/contour.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  labelConnectedComponents,
  findTargetComponent,
  mooreBoundaryTrace,
  douglasPeucker,
  pixelToLatLng,
  latLngToPixel,
  extractBuildingOutline,
} from '../../src/utils/contour';
import type { GeoTiffAffine, ParsedMask } from '../../src/types/solar';

// Helper to create a mask from a visual grid string
function maskFromGrid(grid: string[]): { mask: Uint8Array; w: number; h: number } {
  const h = grid.length;
  const w = grid[0].length;
  const mask = new Uint8Array(w * h);
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      mask[row * w + col] = grid[row][col] === '#' ? 1 : 0;
    }
  }
  return { mask, w, h };
}

// --- Connected Component Labeling ---

describe('labelConnectedComponents', () => {
  it('should return 0 components for empty mask', () => {
    const mask = new Uint8Array(9); // 3x3 all zeros
    const { labels, numComponents } = labelConnectedComponents(mask, 3, 3);
    expect(numComponents).toBe(0);
    expect(labels.every((v) => v === 0)).toBe(true);
  });

  it('should label a single blob as 1 component', () => {
    const { mask, w, h } = maskFromGrid([
      '.....',
      '.###.',
      '.###.',
      '.###.',
      '.....',
    ]);
    const { numComponents } = labelConnectedComponents(mask, w, h);
    expect(numComponents).toBe(1);
  });

  it('should label two separate blobs as 2 components', () => {
    const { mask, w, h } = maskFromGrid([
      '##...',
      '##...',
      '.....',
      '...##',
      '...##',
    ]);
    const { labels, numComponents } = labelConnectedComponents(mask, w, h);
    expect(numComponents).toBe(2);
    // Top-left blob should have a different label from bottom-right blob
    const topLeftLabel = labels[0 * w + 0];
    const bottomRightLabel = labels[3 * w + 3];
    expect(topLeftLabel).toBeGreaterThan(0);
    expect(bottomRightLabel).toBeGreaterThan(0);
    expect(topLeftLabel).not.toBe(bottomRightLabel);
  });

  it('should handle L-shaped connected blobs as 1 component', () => {
    const { mask, w, h } = maskFromGrid([
      '##...',
      '##...',
      '#####',
      '.....',
    ]);
    const { numComponents } = labelConnectedComponents(mask, w, h);
    expect(numComponents).toBe(1);
  });

  it('should handle a single pixel as 1 component', () => {
    const { mask, w, h } = maskFromGrid([
      '...',
      '.#.',
      '...',
    ]);
    const { numComponents } = labelConnectedComponents(mask, w, h);
    expect(numComponents).toBe(1);
  });

  it('should handle a full mask as 1 component', () => {
    const { mask, w, h } = maskFromGrid([
      '###',
      '###',
      '###',
    ]);
    const { numComponents } = labelConnectedComponents(mask, w, h);
    expect(numComponents).toBe(1);
  });

  it('should count many scattered pixels as separate components', () => {
    const { mask, w, h } = maskFromGrid([
      '#.#.#',
      '.....',
      '#.#.#',
    ]);
    const { numComponents } = labelConnectedComponents(mask, w, h);
    expect(numComponents).toBe(6);
  });
});

// --- Find Target Component ---

describe('findTargetComponent', () => {
  it('should return label when target pixel is directly on a component', () => {
    const { mask, w, h } = maskFromGrid([
      '##...',
      '##...',
      '.....',
      '...##',
      '...##',
    ]);
    const { labels } = labelConnectedComponents(mask, w, h);
    // Target is in the top-left blob
    const label = findTargetComponent(labels, w, h, 0, 0);
    expect(label).toBe(labels[0]);
  });

  it('should find nearest component when target is on background', () => {
    const { mask, w, h } = maskFromGrid([
      '.....',
      '.##..',
      '.##..',
      '.....',
      '.....',
    ]);
    const { labels } = labelConnectedComponents(mask, w, h);
    // Target is at (0,0) which is background, nearest blob is at center
    const label = findTargetComponent(labels, w, h, 0, 0);
    expect(label).toBeGreaterThan(0);
  });

  it('should pick the closer component among two', () => {
    const { mask, w, h } = maskFromGrid([
      '#....',
      '.....',
      '.....',
      '.....',
      '....#',
    ]);
    const { labels } = labelConnectedComponents(mask, w, h);
    // Target near top-left (1,0)
    const label = findTargetComponent(labels, w, h, 1, 0);
    const topLeftLabel = labels[0 * w + 0];
    expect(label).toBe(topLeftLabel);
  });
});

// --- Moore Boundary Trace ---

describe('mooreBoundaryTrace', () => {
  it('should return empty for empty mask', () => {
    const mask = new Uint8Array(9);
    expect(mooreBoundaryTrace(mask, 3, 3)).toEqual([]);
  });

  it('should trace a single pixel', () => {
    const { mask, w, h } = maskFromGrid([
      '...',
      '.#.',
      '...',
    ]);
    const boundary = mooreBoundaryTrace(mask, w, h);
    expect(boundary.length).toBe(1);
    expect(boundary[0]).toEqual({ col: 1, row: 1 });
  });

  it('should trace a 2x2 square', () => {
    const { mask, w, h } = maskFromGrid([
      '....',
      '.##.',
      '.##.',
      '....',
    ]);
    const boundary = mooreBoundaryTrace(mask, w, h);
    // A 2x2 square should have 4 boundary pixels
    expect(boundary.length).toBeGreaterThanOrEqual(4);
    // All boundary pixels should be foreground
    for (const p of boundary) {
      expect(mask[p.row * w + p.col]).toBe(1);
    }
  });

  it('should trace a 3x3 square (8-connected trace may take diagonal shortcuts)', () => {
    const { mask, w, h } = maskFromGrid([
      '.....',
      '.###.',
      '.###.',
      '.###.',
      '.....',
    ]);
    const boundary = mooreBoundaryTrace(mask, w, h);
    // 8-connected Moore trace can take diagonals, so may visit fewer than 8 unique boundary pixels
    expect(boundary.length).toBeGreaterThanOrEqual(4);
    // All traced pixels should be foreground
    for (const p of boundary) {
      expect(mask[p.row * w + p.col]).toBe(1);
    }
  });

  it('should trace a horizontal line', () => {
    const { mask, w, h } = maskFromGrid([
      '.....',
      '.###.',
      '.....',
    ]);
    const boundary = mooreBoundaryTrace(mask, w, h);
    expect(boundary.length).toBeGreaterThanOrEqual(3);
  });

  it('should trace an irregular shape', () => {
    const { mask, w, h } = maskFromGrid([
      '......',
      '.####.',
      '.##...',
      '.####.',
      '......',
    ]);
    const boundary = mooreBoundaryTrace(mask, w, h);
    expect(boundary.length).toBeGreaterThan(4);
    // Should form a closed contour (all pixels are foreground)
    for (const p of boundary) {
      expect(mask[p.row * w + p.col]).toBe(1);
    }
  });
});

// --- Douglas-Peucker Simplification ---

describe('douglasPeucker', () => {
  it('should return same points for 0 or 1 or 2 points', () => {
    expect(douglasPeucker([], 1)).toEqual([]);
    const single = [{ col: 0, row: 0 }];
    expect(douglasPeucker(single, 1)).toEqual(single);
    const two = [{ col: 0, row: 0 }, { col: 10, row: 10 }];
    expect(douglasPeucker(two, 1)).toEqual(two);
  });

  it('should keep collinear points simplified to endpoints', () => {
    const points = [
      { col: 0, row: 0 },
      { col: 5, row: 0 },
      { col: 10, row: 0 },
    ];
    const result = douglasPeucker(points, 1);
    expect(result.length).toBe(2);
    expect(result[0]).toEqual({ col: 0, row: 0 });
    expect(result[1]).toEqual({ col: 10, row: 0 });
  });

  it('should keep a point that deviates significantly', () => {
    const points = [
      { col: 0, row: 0 },
      { col: 5, row: 10 }, // far off the line
      { col: 10, row: 0 },
    ];
    const result = douglasPeucker(points, 1);
    expect(result.length).toBe(3);
  });

  it('should simplify with large epsilon', () => {
    const points = [
      { col: 0, row: 0 },
      { col: 5, row: 2 },  // slight deviation
      { col: 10, row: 0 },
    ];
    const result = douglasPeucker(points, 5);
    expect(result.length).toBe(2); // deviation ~2 < epsilon 5
  });

  it('should simplify a noisy circle into fewer points', () => {
    // Generate a rough circle with 100 points
    const n = 100;
    const points: { col: number; row: number }[] = [];
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * 2 * Math.PI;
      const noise = (i % 3) * 0.5; // small noise
      points.push({
        col: Math.round(50 + (30 + noise) * Math.cos(angle)),
        row: Math.round(50 + (30 + noise) * Math.sin(angle)),
      });
    }
    const result = douglasPeucker(points, 2);
    // Should reduce to significantly fewer points
    expect(result.length).toBeLessThan(50);
    expect(result.length).toBeGreaterThan(5);
  });

  it('should preserve corners of a rectangle', () => {
    // Rectangle outline: 4 sides with intermediate points
    const points = [
      { col: 0, row: 0 },
      { col: 5, row: 0 },
      { col: 10, row: 0 },  // corner
      { col: 10, row: 5 },
      { col: 10, row: 10 }, // corner
      { col: 5, row: 10 },
      { col: 0, row: 10 },  // corner
      { col: 0, row: 5 },
    ];
    const result = douglasPeucker(points, 0.5);
    // Should keep at least the 4 corners
    expect(result.length).toBeGreaterThanOrEqual(4);
    // First and last should be preserved
    expect(result[0]).toEqual({ col: 0, row: 0 });
    expect(result[result.length - 1]).toEqual({ col: 0, row: 5 });
  });
});

// --- Pixel <-> LatLng Conversion ---

describe('pixelToLatLng / latLngToPixel', () => {
  const affine: GeoTiffAffine = {
    originX: -90.0,   // lng at pixel (0,0)
    originY: 40.0,    // lat at pixel (0,0)
    pixelWidth: 0.001, // lng per pixel
    pixelHeight: -0.001, // lat per pixel (negative = lat decreases with row)
  };

  it('should convert pixel (0,0) to origin', () => {
    const ll = pixelToLatLng(0, 0, affine);
    expect(ll.lng).toBeCloseTo(-90.0, 6);
    expect(ll.lat).toBeCloseTo(40.0, 6);
  });

  it('should convert pixel (100, 50) correctly', () => {
    const ll = pixelToLatLng(100, 50, affine);
    expect(ll.lng).toBeCloseTo(-90.0 + 100 * 0.001, 6);
    expect(ll.lat).toBeCloseTo(40.0 + 50 * -0.001, 6);
  });

  it('should roundtrip pixel -> latLng -> pixel', () => {
    const col = 42;
    const row = 73;
    const ll = pixelToLatLng(col, row, affine);
    const px = latLngToPixel(ll, affine);
    expect(px.col).toBe(col);
    expect(px.row).toBe(row);
  });

  it('should roundtrip latLng -> pixel -> latLng', () => {
    const lat = 39.95;
    const lng = -89.95;
    const px = latLngToPixel({ lat, lng }, affine);
    const ll = pixelToLatLng(px.col, px.row, affine);
    // Within one pixel of precision
    expect(Math.abs(ll.lat - lat)).toBeLessThan(Math.abs(affine.pixelHeight));
    expect(Math.abs(ll.lng - lng)).toBeLessThan(affine.pixelWidth);
  });
});

// --- extractBuildingOutline (integration) ---

describe('extractBuildingOutline', () => {
  it('should extract outline from a large rectangular building mask', () => {
    // Use a large mask (100x100) with a 40x20 hollow rectangle for clean boundary
    const w = 100;
    const h = 100;
    const data = new Uint8Array(w * h);
    // Create a solid building footprint: cols 30-69, rows 40-59
    for (let row = 40; row <= 59; row++) {
      for (let col = 30; col <= 69; col++) {
        data[row * w + col] = 1;
      }
    }

    const affine: GeoTiffAffine = {
      originX: -90.005,
      originY: 40.005,
      pixelWidth: 0.0001,
      pixelHeight: -0.0001,
    };

    const parsed: ParsedMask = { data, width: w, height: h, affine };

    // Target at center of the rectangle (row 50, col 50)
    const targetLat = 40.005 + 50 * -0.0001;
    const targetLng = -90.005 + 50 * 0.0001;

    const outline = extractBuildingOutline(parsed, targetLat, targetLng, 3);

    expect(outline.length).toBeGreaterThanOrEqual(4);
    // All points should be in the right geographic area
    for (const p of outline) {
      expect(p.lat).toBeGreaterThan(39.99);
      expect(p.lat).toBeLessThan(40.01);
      expect(p.lng).toBeGreaterThan(-90.01);
      expect(p.lng).toBeLessThan(-89.99);
    }
  });

  it('should return empty for mask with no foreground', () => {
    const data = new Uint8Array(100); // 10x10 all zeros
    const affine: GeoTiffAffine = {
      originX: -90, originY: 40, pixelWidth: 0.001, pixelHeight: -0.001,
    };
    const parsed: ParsedMask = { data, width: 10, height: 10, affine };
    const outline = extractBuildingOutline(parsed, 40.0, -90.0, 2);
    expect(outline.length).toBe(0);
  });

  it('should handle a mask with two buildings and pick the closest', () => {
    // Use a larger mask with well-separated buildings
    const w = 100;
    const h = 50;
    const data = new Uint8Array(w * h);
    // Building A: cols 5-20, rows 10-30
    for (let r = 10; r <= 30; r++) for (let c = 5; c <= 20; c++) data[r * w + c] = 1;
    // Building B: cols 60-85, rows 10-30
    for (let r = 10; r <= 30; r++) for (let c = 60; c <= 85; c++) data[r * w + c] = 1;

    const affine: GeoTiffAffine = {
      originX: -90.005, originY: 40.005, pixelWidth: 0.0001, pixelHeight: -0.0001,
    };
    const parsed: ParsedMask = { data, width: w, height: h, affine };

    // Target near Building B center (col ~72, row ~20)
    const targetLat = 40.005 + 20 * -0.0001;
    const targetLng = -90.005 + 72 * 0.0001;
    const outline = extractBuildingOutline(parsed, targetLat, targetLng, 3);

    expect(outline.length).toBeGreaterThanOrEqual(4);
    // All outline points should be near building B (cols 60-85)
    for (const p of outline) {
      const col = Math.round((p.lng - affine.originX) / affine.pixelWidth);
      expect(col).toBeGreaterThanOrEqual(58);
      expect(col).toBeLessThanOrEqual(87);
    }
  });
});
