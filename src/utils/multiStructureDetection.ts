import type { SolarRoofSegment } from '../types/solar';
import { haversineDistanceFt } from './geometry';

export interface DetectedStructure {
  /** Segments belonging to this structure */
  segmentIndices: number[];
  /** Total area of this structure in sq meters */
  totalAreaM2: number;
  /** Centroid of this structure */
  center: { lat: number; lng: number };
  /** Whether this is the primary (largest) structure */
  isPrimary: boolean;
}

export interface MultiStructureResult {
  /** Number of distinct structures detected */
  structureCount: number;
  /** Details per structure */
  structures: DetectedStructure[];
  /** Whether multiple structures were detected */
  hasMultipleStructures: boolean;
}

/**
 * Detect multiple structures from Solar API roof segments using spatial clustering.
 *
 * When Solar API segments have centers that are far apart (> gap threshold),
 * they likely belong to separate structures (main house, garage, shed, etc.).
 *
 * Uses a simple DBSCAN-like approach: segments within `maxGapFt` of each other
 * are considered part of the same structure.
 */
export function detectMultipleStructures(
  segments: SolarRoofSegment[],
  maxGapFt: number = 25,
): MultiStructureResult {
  if (segments.length === 0) {
    return { structureCount: 0, structures: [], hasMultipleStructures: false };
  }

  if (segments.length === 1) {
    const c = segments[0].center;
    return {
      structureCount: 1,
      structures: [{
        segmentIndices: [0],
        totalAreaM2: segments[0].stats.areaMeters2,
        center: { lat: c.latitude, lng: c.longitude },
        isPrimary: true,
      }],
      hasMultipleStructures: false,
    };
  }

  // Build adjacency: two segments are connected if their centers are within maxGapFt
  const centers = segments.map(s => ({
    lat: s.center.latitude,
    lng: s.center.longitude,
  }));

  const visited = new Set<number>();
  const clusters: number[][] = [];

  for (let i = 0; i < segments.length; i++) {
    if (visited.has(i)) continue;

    // BFS from segment i
    const cluster: number[] = [];
    const queue = [i];
    visited.add(i);

    while (queue.length > 0) {
      const current = queue.shift()!;
      cluster.push(current);

      for (let j = 0; j < segments.length; j++) {
        if (visited.has(j)) continue;
        const dist = haversineDistanceFt(centers[current], centers[j]);
        if (dist <= maxGapFt) {
          visited.add(j);
          queue.push(j);
        }
      }
    }

    clusters.push(cluster);
  }

  // Sort clusters by total area (largest first = primary structure)
  const structures: DetectedStructure[] = clusters.map(indices => {
    const totalAreaM2 = indices.reduce((sum, i) => sum + segments[i].stats.areaMeters2, 0);
    const avgLat = indices.reduce((sum, i) => sum + segments[i].center.latitude, 0) / indices.length;
    const avgLng = indices.reduce((sum, i) => sum + segments[i].center.longitude, 0) / indices.length;
    return {
      segmentIndices: indices,
      totalAreaM2,
      center: { lat: avgLat, lng: avgLng },
      isPrimary: false,
    };
  });

  structures.sort((a, b) => b.totalAreaM2 - a.totalAreaM2);
  if (structures.length > 0) {
    structures[0].isPrimary = true;
  }

  return {
    structureCount: structures.length,
    structures,
    hasMultipleStructures: structures.length > 1,
  };
}
