/**
 * Planar Face Extraction from a 2D edge graph.
 *
 * Given a set of vertices (lat/lng) and edges (index pairs + type),
 * this module finds all enclosed polygonal faces using a half-edge
 * traversal (next-edge-by-angle) approach.
 *
 * Steps:
 * 1. Project lat/lng to local Cartesian (feet)
 * 2. Merge near-coincident vertices
 * 3. Fix T-junctions (split edges at nearby vertices)
 * 4. Remove dangling edges (degree-1 vertices)
 * 5. Build half-edge structure, compute next pointers by angle
 * 6. Trace faces
 * 7. Filter out unbounded face and degenerate faces
 * 8. Assign properties (match to Solar segments)
 */

import type { LatLng } from '../types';
import type { SolarRoofSegment } from '../types/solar';
import { latLngToLocalFt, getCentroid } from './geometry';

export interface ExtractedFacet {
  /** Indices into the ORIGINAL (pre-merge) vertex array */
  vertexIndices: number[];
  /** Pitch in x/12 format */
  pitch: number;
  /** Compass-based name, e.g. "South Facet" */
  name: string;
}

interface Point2D {
  x: number;
  y: number;
}

interface HalfEdge {
  /** Index of origin vertex (in merged vertex list) */
  origin: number;
  /** Index of destination vertex */
  dest: number;
  /** The twin half-edge (opposite direction) index */
  twin: number;
  /** Next half-edge in the face traversal */
  next: number;
  /** The original undirected edge index (for type lookup) */
  edgeIdx: number;
}

/**
 * Extract individual roof facets from an edge graph.
 *
 * @param vertices Original vertex positions
 * @param edges Edge list with indices and types
 * @param solarSegments Optional Solar API segments for pitch/azimuth matching
 * @param defaultPitch Default pitch (x/12) if no solar data
 * @returns Array of extracted facets, or empty if extraction fails
 */
export function extractFacetsFromEdges(
  vertices: LatLng[],
  edges: { startIndex: number; endIndex: number; type: string }[],
  solarSegments?: SolarRoofSegment[],
  defaultPitch: number = 6,
): ExtractedFacet[] {
  if (vertices.length < 3 || edges.length < 3) return [];

  // 1. Project to local feet
  const centroid = getCentroid(vertices);
  const pts: Point2D[] = vertices.map((v) => latLngToLocalFt(v, centroid));

  // 2. Merge near-coincident vertices (0.5 ft tolerance)
  const MERGE_TOL = 0.5;
  const mergeMap = new Int32Array(pts.length); // mergeMap[i] = canonical index
  const mergedPts: Point2D[] = [];
  const mergedToOriginal: number[][] = []; // mergedIdx -> array of original indices

  for (let i = 0; i < pts.length; i++) {
    let found = -1;
    for (let j = 0; j < mergedPts.length; j++) {
      const dx = pts[i].x - mergedPts[j].x;
      const dy = pts[i].y - mergedPts[j].y;
      if (Math.sqrt(dx * dx + dy * dy) < MERGE_TOL) {
        found = j;
        break;
      }
    }
    if (found >= 0) {
      mergeMap[i] = found;
      mergedToOriginal[found].push(i);
    } else {
      mergeMap[i] = mergedPts.length;
      mergedToOriginal.push([i]);
      mergedPts.push({ ...pts[i] });
    }
  }

  // Remap edges to merged indices and deduplicate
  const edgeSet = new Set<string>();
  const mergedEdges: { s: number; e: number; idx: number }[] = [];

  for (let i = 0; i < edges.length; i++) {
    const s = mergeMap[edges[i].startIndex];
    const e = mergeMap[edges[i].endIndex];
    if (s === e) continue;
    const key = s < e ? `${s}-${e}` : `${e}-${s}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      mergedEdges.push({ s, e, idx: i });
    }
  }

  if (mergedEdges.length < 3) return [];

  // 3. Fix T-junctions: if a vertex lies within tolerance of an edge interior, split it
  const TJUNCTION_TOL = 1.0; // feet
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 5) {
    changed = false;
    iterations++;
    for (let ei = mergedEdges.length - 1; ei >= 0; ei--) {
      const edge = mergedEdges[ei];
      const pa = mergedPts[edge.s];
      const pb = mergedPts[edge.e];

      for (let vi = 0; vi < mergedPts.length; vi++) {
        if (vi === edge.s || vi === edge.e) continue;
        const pv = mergedPts[vi];
        const t = projectPointOnSegment(pv, pa, pb);
        if (t <= 0.02 || t >= 0.98) continue; // near endpoints, skip
        const proj = { x: pa.x + t * (pb.x - pa.x), y: pa.y + t * (pb.y - pa.y) };
        const dist = Math.sqrt((pv.x - proj.x) ** 2 + (pv.y - proj.y) ** 2);
        if (dist < TJUNCTION_TOL) {
          // Split edge at this vertex
          const origIdx = edge.idx;
          mergedEdges.splice(ei, 1);
          const keyA = edge.s < vi ? `${edge.s}-${vi}` : `${vi}-${edge.s}`;
          const keyB = vi < edge.e ? `${vi}-${edge.e}` : `${edge.e}-${vi}`;
          if (!edgeSet.has(keyA)) {
            edgeSet.add(keyA);
            mergedEdges.push({ s: edge.s, e: vi, idx: origIdx });
          }
          if (!edgeSet.has(keyB)) {
            edgeSet.add(keyB);
            mergedEdges.push({ s: vi, e: edge.e, idx: origIdx });
          }
          changed = true;
          break;
        }
      }
    }
  }

  // 4. Remove dangling edges (iteratively remove degree-1 vertices)
  let removedDangling = true;
  while (removedDangling) {
    removedDangling = false;
    const degree = new Map<number, number>();
    for (const e of mergedEdges) {
      degree.set(e.s, (degree.get(e.s) || 0) + 1);
      degree.set(e.e, (degree.get(e.e) || 0) + 1);
    }
    for (let i = mergedEdges.length - 1; i >= 0; i--) {
      const e = mergedEdges[i];
      if ((degree.get(e.s) || 0) <= 1 || (degree.get(e.e) || 0) <= 1) {
        mergedEdges.splice(i, 1);
        removedDangling = true;
      }
    }
  }

  if (mergedEdges.length < 3) return [];

  // 5. Build half-edge structure
  const halfEdges: HalfEdge[] = [];
  const outgoing = new Map<number, number[]>(); // vertex -> [halfEdge indices]

  for (let i = 0; i < mergedEdges.length; i++) {
    const { s, e, idx } = mergedEdges[i];
    const heIdx1 = halfEdges.length;
    const heIdx2 = heIdx1 + 1;

    halfEdges.push({ origin: s, dest: e, twin: heIdx2, next: -1, edgeIdx: idx });
    halfEdges.push({ origin: e, dest: s, twin: heIdx1, next: -1, edgeIdx: idx });

    if (!outgoing.has(s)) outgoing.set(s, []);
    if (!outgoing.has(e)) outgoing.set(e, []);
    outgoing.get(s)!.push(heIdx1);
    outgoing.get(e)!.push(heIdx2);
  }

  // Sort outgoing half-edges at each vertex by angle
  for (const [v, heIdxs] of outgoing) {
    const vp = mergedPts[v];
    heIdxs.sort((a, b) => {
      const ahe = halfEdges[a];
      const bhe = halfEdges[b];
      const angleA = Math.atan2(mergedPts[ahe.dest].y - vp.y, mergedPts[ahe.dest].x - vp.x);
      const angleB = Math.atan2(mergedPts[bhe.dest].y - vp.y, mergedPts[bhe.dest].x - vp.x);
      return angleA - angleB;
    });
  }

  // 6. Compute next pointers
  // For half-edge u->v, the "next" is the half-edge leaving v that is the
  // clockwise-next after the twin of (u->v). The twin is v->u, so we find
  // v->u in the sorted outgoing of v, then take the PREVIOUS entry (CW next).
  for (const he of halfEdges) {
    const v = he.dest;
    const twinIdx = he.twin;
    const vOutgoing = outgoing.get(v);
    if (!vOutgoing || vOutgoing.length === 0) continue;

    // Find twin in v's outgoing list
    const twinPos = vOutgoing.indexOf(twinIdx);
    if (twinPos === -1) continue;

    // Previous in CCW order = next in CW order
    const nextPos = (twinPos - 1 + vOutgoing.length) % vOutgoing.length;
    he.next = vOutgoing[nextPos];
  }

  // 7. Trace faces
  const visited = new Set<number>();
  const faces: number[][] = []; // each face is a list of vertex indices

  for (let i = 0; i < halfEdges.length; i++) {
    if (visited.has(i)) continue;
    if (halfEdges[i].next === -1) continue;

    const face: number[] = [];
    let current = i;
    let safe = 0;
    const maxSteps = halfEdges.length + 1;

    while (!visited.has(current) && safe < maxSteps) {
      visited.add(current);
      face.push(halfEdges[current].origin);
      current = halfEdges[current].next;
      if (current === -1) break;
      safe++;
    }

    if (face.length >= 3 && current === i) {
      faces.push(face);
    }
  }

  if (faces.length === 0) return [];

  // 8. Filter faces
  const validFaces: { verts: number[]; area: number; centroid: Point2D }[] = [];

  for (const face of faces) {
    const facePoints = face.map((vi) => mergedPts[vi]);
    const signedArea = computeSignedArea(facePoints);

    // Skip unbounded face (largest negative area) and degenerate faces
    if (signedArea < 0) continue; // wound clockwise = exterior face
    const area = Math.abs(signedArea);
    if (area < 10) continue; // less than 10 sq ft = noise

    const cx = facePoints.reduce((s, p) => s + p.x, 0) / facePoints.length;
    const cy = facePoints.reduce((s, p) => s + p.y, 0) / facePoints.length;

    validFaces.push({ verts: face, area, centroid: { x: cx, y: cy } });
  }

  if (validFaces.length === 0) return [];

  // 9. Map merged vertex indices back to original indices & assign properties
  const segmentCenters = (solarSegments || []).map((seg) => {
    const segLatLng = { lat: seg.center.latitude, lng: seg.center.longitude };
    return {
      pt: latLngToLocalFt(segLatLng, centroid),
      pitchDeg: seg.pitchDegrees,
      azimuthDeg: seg.azimuthDegrees,
      area: seg.stats.areaMeters2 * 10.7639, // m2 to sq ft
    };
  });

  const facets: ExtractedFacet[] = validFaces.map((face, idx) => {
    // Map merged indices to original indices
    const originalIndices = face.verts.map((mergedIdx) => {
      const originals = mergedToOriginal[mergedIdx];
      return originals ? originals[0] : mergedIdx;
    });

    // Match to nearest Solar segment
    let pitch = defaultPitch;
    let azimuth = 0;

    if (segmentCenters.length > 0) {
      let bestDist = Infinity;
      let bestSeg = 0;
      for (let s = 0; s < segmentCenters.length; s++) {
        const dx = face.centroid.x - segmentCenters[s].pt.x;
        const dy = face.centroid.y - segmentCenters[s].pt.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < bestDist) {
          bestDist = d;
          bestSeg = s;
        }
      }
      const seg = segmentCenters[bestSeg];
      pitch = Math.round(Math.tan(seg.pitchDeg * Math.PI / 180) * 12);
      azimuth = seg.azimuthDeg;
    }

    const name = `#${idx + 1} ${compassDirection(azimuth)}`;

    return { vertexIndices: originalIndices, pitch, name };
  });

  return facets;
}

/** Project point P onto line segment AB, return parameter t in [0,1] */
function projectPointOnSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-10) return 0;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  return Math.max(0, Math.min(1, t));
}

/** Compute signed area of a polygon (positive = CCW, negative = CW) */
function computeSignedArea(pts: Point2D[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  return area / 2;
}

/** Convert azimuth degrees to compass direction label */
function compassDirection(azimuth: number): string {
  // Azimuth: 0=North, 90=East, 180=South, 270=West
  const dirs = ['North', 'NE', 'East', 'SE', 'South', 'SW', 'West', 'NW'];
  const idx = Math.round(((azimuth % 360 + 360) % 360) / 45) % 8;
  return dirs[idx];
}
