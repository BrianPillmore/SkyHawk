/**
 * Correction Exporter — Converts corrected edge data into training masks.
 *
 * When "Save as Training Data" is clicked in the CorrectionOverlay:
 * 1. Takes corrected edge list (vertices + edges + types)
 * 2. Renders them onto a 640x640 mask (3px-wide lines, pixel values 0-6)
 * 3. Saves original satellite image + corrected mask as a new training pair
 */

import fs from 'fs';
import path from 'path';

const IMAGE_SIZE = 640;
const LINE_WIDTH = 3;

const TYPE_TO_CLASS: Record<string, number> = {
  ridge: 2,
  hip: 3,
  valley: 4,
  rake: 5,
  eave: 5,
  flashing: 6,
  'step-flashing': 6,
};

interface LatLng {
  lat: number;
  lng: number;
}

interface CorrectionEdge {
  startVertexId: string;
  endVertexId: string;
  type: string;
}

interface CorrectionData {
  vertices: LatLng[];
  edges: CorrectionEdge[];
  imageBounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

/**
 * Convert lat/lng coordinates to pixel coordinates given image bounds.
 */
function latLngToPixel(
  ll: LatLng,
  bounds: { north: number; south: number; east: number; west: number }
): { x: number; y: number } {
  const latRange = bounds.north - bounds.south;
  const lngRange = bounds.east - bounds.west;
  return {
    x: Math.round(((ll.lng - bounds.west) / lngRange) * IMAGE_SIZE),
    y: Math.round(((bounds.north - ll.lat) / latRange) * IMAGE_SIZE),
  };
}

/**
 * Draw a line on a mask buffer (Bresenham's algorithm with width).
 */
function drawLine(
  mask: Uint8Array,
  x0: number, y0: number,
  x1: number, y1: number,
  classId: number,
  width: number = LINE_WIDTH
): void {
  const halfW = Math.floor(width / 2);

  // Bresenham's line algorithm
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let cx = x0;
  let cy = y0;

  while (true) {
    // Draw a square kernel around the current point
    for (let ky = -halfW; ky <= halfW; ky++) {
      for (let kx = -halfW; kx <= halfW; kx++) {
        const px = cx + kx;
        const py = cy + ky;
        if (px >= 0 && px < IMAGE_SIZE && py >= 0 && py < IMAGE_SIZE) {
          mask[py * IMAGE_SIZE + px] = classId;
        }
      }
    }

    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 < dx) { err += dx; cy += sy; }
  }
}

/**
 * Render corrected edges to a 640x640 mask.
 */
export function renderCorrectionMask(
  data: CorrectionData,
  bounds: { north: number; south: number; east: number; west: number }
): Uint8Array {
  const mask = new Uint8Array(IMAGE_SIZE * IMAGE_SIZE); // all zeros = background

  // Build vertex lookup (index → pixel coords)
  const vertexPixels = data.vertices.map((v) => latLngToPixel(v, bounds));

  // Draw edges
  for (const edge of data.edges) {
    const startIdx = parseInt(edge.startVertexId, 10);
    const endIdx = parseInt(edge.endVertexId, 10);

    if (isNaN(startIdx) || isNaN(endIdx)) continue;
    if (startIdx >= vertexPixels.length || endIdx >= vertexPixels.length) continue;

    const classId = TYPE_TO_CLASS[edge.type];
    if (classId === undefined) continue;

    const start = vertexPixels[startIdx];
    const end = vertexPixels[endIdx];
    drawLine(mask, start.x, start.y, end.x, end.y, classId);
  }

  return mask;
}

/**
 * Save a correction as training data.
 */
export function saveCorrectionAsTraining(
  imageBase64: string | null,
  correctionMask: Uint8Array,
  name: string,
  outputDir: string
): { imagePath: string; maskPath: string } {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80);
  const dir = path.resolve(outputDir);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Save mask as raw pixel data (consumer must convert to PNG)
  // For simplicity, save as a JSON array that Python can read
  const maskPath = path.join(dir, `${slug}_mask_raw.json`);
  fs.writeFileSync(maskPath, JSON.stringify({
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    data: Array.from(correctionMask),
  }));

  // Save source image if provided
  let imagePath = '';
  if (imageBase64) {
    imagePath = path.join(dir, `${slug}.png`);
    fs.writeFileSync(imagePath, Buffer.from(imageBase64, 'base64'));
  }

  return { imagePath, maskPath };
}

/**
 * Auto-save user's manual edge drawings as training data.
 *
 * Active learning: every time a user draws/edits edges on a roof in MapView,
 * this captures it as a training pair (satellite image + edge mask).
 * This is the most powerful training data source because it represents
 * real-world corrections from real users.
 *
 * Called automatically after every edge edit session (debounced).
 */
export function saveUserDrawingAsTraining(
  imageBase64: string,
  correctionData: CorrectionData,
  bounds: { north: number; south: number; east: number; west: number },
  address: string,
  outputDir: string
): { saved: boolean; imagePath: string; maskPath: string; metaPath: string } {
  const timestamp = Date.now();
  const slug = address.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
  const name = `user-${slug}-${timestamp}`;
  const dir = path.resolve(outputDir);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Render edges to mask
  const mask = renderCorrectionMask(correctionData, bounds);

  // Check if mask has meaningful content (at least some edge pixels)
  let edgePixels = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > 0) edgePixels++;
  }
  if (edgePixels < 10) {
    return { saved: false, imagePath: '', maskPath: '', metaPath: '' };
  }

  // Save satellite image
  const imagePath = path.join(dir, `${name}.png`);
  fs.writeFileSync(imagePath, Buffer.from(imageBase64, 'base64'));

  // Save mask as raw pixel data
  const maskPath = path.join(dir, `${name}_mask_raw.json`);
  fs.writeFileSync(maskPath, JSON.stringify({
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    data: Array.from(mask),
  }));

  // Save metadata (marks this as user correction for weighted sampling)
  const metaPath = path.join(dir, `${name}_meta.json`);
  fs.writeFileSync(metaPath, JSON.stringify({
    address,
    bounds,
    timestamp: new Date().toISOString(),
    source: 'user-correction',
    edgePixels,
    edgeCount: correctionData.edges.length,
    vertexCount: correctionData.vertices.length,
  }, null, 2));

  return { saved: true, imagePath, maskPath, metaPath };
}
