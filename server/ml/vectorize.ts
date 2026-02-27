/**
 * Line Vectorization Module — Convert pixel segmentation mask to vector edges.
 *
 * Pipeline:
 *   1. Extract per-class binary masks
 *   2. Morphological cleanup (close small gaps)
 *   3. Zhang-Suen thinning (skeletonize to 1px-wide lines)
 *   4. Trace connected components
 *   5. Douglas-Peucker simplification
 *   6. Snap endpoints at intersections
 *   7. Output: { start, end, type }[] — same format as Claude Vision
 */

const IMAGE_SIZE = 640;

type EdgeType = 'ridge' | 'hip' | 'valley' | 'eave' | 'rake' | 'flashing';

interface Point {
  x: number;
  y: number;
}

interface VectorEdge {
  start: Point;
  end: Point;
  type: EdgeType;
}

// Map class IDs to edge types
const CLASS_TO_TYPE: Record<number, EdgeType> = {
  2: 'ridge',
  3: 'hip',
  4: 'valley',
  5: 'eave', // eave_rake mapped to eave for edge detection
  6: 'flashing',
};

// --- Binary image operations ---

/**
 * Extract binary mask for a specific class.
 */
function extractClassMask(mask: Uint8Array, classId: number): Uint8Array {
  const result = new Uint8Array(IMAGE_SIZE * IMAGE_SIZE);
  for (let i = 0; i < mask.length; i++) {
    result[i] = mask[i] === classId ? 1 : 0;
  }
  return result;
}

/**
 * Morphological dilation (3x3 kernel).
 */
function dilate(binary: Uint8Array, w: number, h: number): Uint8Array {
  const result = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let val = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (binary[(y + dy) * w + (x + dx)]) {
            val = 1;
            break;
          }
        }
        if (val) break;
      }
      result[y * w + x] = val;
    }
  }
  return result;
}

/**
 * Morphological erosion (3x3 kernel).
 */
function erode(binary: Uint8Array, w: number, h: number): Uint8Array {
  const result = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let allSet = true;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!binary[(y + dy) * w + (x + dx)]) {
            allSet = false;
            break;
          }
        }
        if (!allSet) break;
      }
      result[y * w + x] = allSet ? 1 : 0;
    }
  }
  return result;
}

/**
 * Morphological close (dilate then erode) — fills small gaps.
 */
function morphClose(binary: Uint8Array, w: number, h: number): Uint8Array {
  return erode(dilate(binary, w, h), w, h);
}

// --- Zhang-Suen Thinning Algorithm ---

/**
 * Zhang-Suen thinning: reduces binary region to 1px-wide skeleton.
 * Standard algorithm, well-documented in literature.
 */
function zhangSuenThin(binary: Uint8Array, w: number, h: number): Uint8Array {
  const img = new Uint8Array(binary);
  let changed = true;

  while (changed) {
    changed = false;

    // Sub-iteration 1
    const toRemove1: number[] = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (!img[y * w + x]) continue;

        const p2 = img[(y - 1) * w + x];
        const p3 = img[(y - 1) * w + (x + 1)];
        const p4 = img[y * w + (x + 1)];
        const p5 = img[(y + 1) * w + (x + 1)];
        const p6 = img[(y + 1) * w + x];
        const p7 = img[(y + 1) * w + (x - 1)];
        const p8 = img[y * w + (x - 1)];
        const p9 = img[(y - 1) * w + (x - 1)];

        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (B < 2 || B > 6) continue;

        // Count 0→1 transitions in clockwise order
        let A = 0;
        if (!p2 && p3) A++;
        if (!p3 && p4) A++;
        if (!p4 && p5) A++;
        if (!p5 && p6) A++;
        if (!p6 && p7) A++;
        if (!p7 && p8) A++;
        if (!p8 && p9) A++;
        if (!p9 && p2) A++;
        if (A !== 1) continue;

        if (p2 && p4 && p6) continue;
        if (p4 && p6 && p8) continue;

        toRemove1.push(y * w + x);
      }
    }
    for (const idx of toRemove1) {
      img[idx] = 0;
      changed = true;
    }

    // Sub-iteration 2
    const toRemove2: number[] = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (!img[y * w + x]) continue;

        const p2 = img[(y - 1) * w + x];
        const p3 = img[(y - 1) * w + (x + 1)];
        const p4 = img[y * w + (x + 1)];
        const p5 = img[(y + 1) * w + (x + 1)];
        const p6 = img[(y + 1) * w + x];
        const p7 = img[(y + 1) * w + (x - 1)];
        const p8 = img[y * w + (x - 1)];
        const p9 = img[(y - 1) * w + (x - 1)];

        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (B < 2 || B > 6) continue;

        let A = 0;
        if (!p2 && p3) A++;
        if (!p3 && p4) A++;
        if (!p4 && p5) A++;
        if (!p5 && p6) A++;
        if (!p6 && p7) A++;
        if (!p7 && p8) A++;
        if (!p8 && p9) A++;
        if (!p9 && p2) A++;
        if (A !== 1) continue;

        if (p2 && p4 && p8) continue;
        if (p2 && p6 && p8) continue;

        toRemove2.push(y * w + x);
      }
    }
    for (const idx of toRemove2) {
      img[idx] = 0;
      changed = true;
    }
  }

  return img;
}

// --- Connected Component Tracing ---

/**
 * Trace connected skeleton pixels into chains of points.
 */
function traceChains(skeleton: Uint8Array, w: number, h: number): Point[][] {
  const visited = new Uint8Array(w * h);
  const chains: Point[][] = [];

  // 8-connected neighbors
  const dx = [-1, 0, 1, -1, 1, -1, 0, 1];
  const dy = [-1, -1, -1, 0, 0, 1, 1, 1];

  // Find endpoints and junction points first
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (!skeleton[y * w + x] || visited[y * w + x]) continue;

      // Count neighbors
      let neighbors = 0;
      for (let d = 0; d < 8; d++) {
        if (skeleton[(y + dy[d]) * w + (x + dx[d])]) neighbors++;
      }

      // Start tracing from endpoints (1 neighbor) or isolated pixels
      if (neighbors <= 1 || neighbors >= 3) {
        const chain: Point[] = [];
        let cx = x, cy = y;

        while (true) {
          chain.push({ x: cx, y: cy });
          visited[cy * w + cx] = 1;

          // Find unvisited neighbor
          let found = false;
          for (let d = 0; d < 8; d++) {
            const nx = cx + dx[d];
            const ny = cy + dy[d];
            if (nx >= 0 && nx < w && ny >= 0 && ny < h &&
                skeleton[ny * w + nx] && !visited[ny * w + nx]) {
              cx = nx;
              cy = ny;
              found = true;
              break;
            }
          }

          if (!found) break;
        }

        if (chain.length >= 2) {
          chains.push(chain);
        }
      }
    }
  }

  // Pick up any remaining unvisited skeleton pixels
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (!skeleton[y * w + x] || visited[y * w + x]) continue;

      const chain: Point[] = [];
      let cx = x, cy = y;

      while (true) {
        chain.push({ x: cx, y: cy });
        visited[cy * w + cx] = 1;

        let found = false;
        for (let d = 0; d < 8; d++) {
          const nx = cx + dx[d];
          const ny = cy + dy[d];
          if (nx >= 0 && nx < w && ny >= 0 && ny < h &&
              skeleton[ny * w + nx] && !visited[ny * w + nx]) {
            cx = nx;
            cy = ny;
            found = true;
            break;
          }
        }

        if (!found) break;
      }

      if (chain.length >= 2) {
        chains.push(chain);
      }
    }
  }

  return chains;
}

// --- Douglas-Peucker Line Simplification ---

/**
 * Perpendicular distance from point to line segment.
 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // lineStart == lineEnd
    const ex = point.x - lineStart.x;
    const ey = point.y - lineStart.y;
    return Math.sqrt(ex * ex + ey * ey);
  }

  const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq));
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  const ex = point.x - projX;
  const ey = point.y - projY;
  return Math.sqrt(ex * ex + ey * ey);
}

/**
 * Douglas-Peucker line simplification.
 */
function douglasPeucker(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [points[0], points[points.length - 1]];
}

// --- Endpoint Snapping ---

/**
 * Snap endpoints that are within tolerance of each other to shared vertices.
 */
function snapEndpoints(edges: VectorEdge[], tolerance: number): VectorEdge[] {
  const allPoints: Point[] = [];
  for (const edge of edges) {
    allPoints.push(edge.start, edge.end);
  }

  // Cluster nearby points
  const clusters: Point[][] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < allPoints.length; i++) {
    if (assigned.has(i)) continue;

    const cluster = [allPoints[i]];
    assigned.add(i);

    for (let j = i + 1; j < allPoints.length; j++) {
      if (assigned.has(j)) continue;
      const dist = Math.sqrt(
        (allPoints[i].x - allPoints[j].x) ** 2 +
        (allPoints[i].y - allPoints[j].y) ** 2
      );
      if (dist <= tolerance) {
        cluster.push(allPoints[j]);
        assigned.add(j);
      }
    }

    clusters.push(cluster);
  }

  // Compute centroid for each cluster
  const pointToCluster = new Map<string, Point>();
  for (const cluster of clusters) {
    const cx = cluster.reduce((s, p) => s + p.x, 0) / cluster.length;
    const cy = cluster.reduce((s, p) => s + p.y, 0) / cluster.length;
    const centroid = { x: Math.round(cx), y: Math.round(cy) };
    for (const p of cluster) {
      pointToCluster.set(`${p.x},${p.y}`, centroid);
    }
  }

  // Replace edge endpoints with cluster centroids
  return edges.map((edge) => ({
    start: pointToCluster.get(`${edge.start.x},${edge.start.y}`) || edge.start,
    end: pointToCluster.get(`${edge.end.x},${edge.end.y}`) || edge.end,
    type: edge.type,
  })).filter((edge) => {
    // Remove zero-length edges
    return edge.start.x !== edge.end.x || edge.start.y !== edge.end.y;
  });
}

// --- Main Vectorization Pipeline ---

const SIMPLIFICATION_EPSILON = 2.0; // pixels
const SNAP_TOLERANCE = 5.0; // pixels
const MIN_EDGE_LENGTH = 10; // pixels — ignore very short edges

/**
 * Convert a 640x640 segmentation mask into vector line segments.
 *
 * @param mask - Uint8Array of 640*640 with values 0-6
 * @returns Array of vector edges with pixel coordinates and types
 */
export function vectorizeEdges(mask: Uint8Array): VectorEdge[] {
  const allEdges: VectorEdge[] = [];

  // Process each edge class separately (2=ridge, 3=hip, 4=valley, 5=eave, 6=flashing)
  for (const classId of [2, 3, 4, 5, 6]) {
    const edgeType = CLASS_TO_TYPE[classId];
    if (!edgeType) continue;

    // 1. Extract binary mask for this class
    let classMask = extractClassMask(mask, classId);

    // 2. Morphological close to fill small gaps
    classMask = morphClose(classMask, IMAGE_SIZE, IMAGE_SIZE);

    // 3. Skeletonize to 1px-wide lines
    const skeleton = zhangSuenThin(classMask, IMAGE_SIZE, IMAGE_SIZE);

    // 4. Trace connected chains
    const chains = traceChains(skeleton, IMAGE_SIZE, IMAGE_SIZE);

    // 5. Simplify each chain with Douglas-Peucker
    for (const chain of chains) {
      const simplified = douglasPeucker(chain, SIMPLIFICATION_EPSILON);

      // Convert chain to individual line segments
      for (let i = 0; i < simplified.length - 1; i++) {
        const start = simplified[i];
        const end = simplified[i + 1];

        // Filter very short edges
        const length = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
        if (length < MIN_EDGE_LENGTH) continue;

        allEdges.push({ start, end, type: edgeType });
      }
    }
  }

  // 6. Snap endpoints at intersections
  return snapEndpoints(allEdges, SNAP_TOLERANCE);
}

export type { VectorEdge, Point };
