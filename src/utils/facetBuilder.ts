/**
 * Facet building utilities — extracted for testability.
 *
 * Wraps the planar face extraction + fallback logic from useAutoMeasure
 * into standalone functions that can be unit tested without React hooks.
 */
import type { LatLng, EdgeType } from '../types';
import type { SolarRoofSegment } from '../types/solar';
import { extractFacetsFromEdges } from './planarFaceExtraction';

export { extractFacetsFromEdges } from './planarFaceExtraction';

export interface FacetResult {
  vertexIndices: number[];
  pitch: number;
  name: string;
}

/**
 * Build facets from detected edges using planar face extraction,
 * with a fallback to perimeter-loop tracing.
 */
export function buildFacetsFromEdges(
  vertices: LatLng[],
  edges: { startIndex: number; endIndex: number; type: EdgeType }[],
  solarSegments?: SolarRoofSegment[],
  defaultPitch: number = 6,
): FacetResult[] {
  // Try planar face extraction first
  const facets = extractFacetsFromEdges(vertices, edges, solarSegments, defaultPitch);
  if (facets.length > 0) return facets;

  // Fallback: build from perimeter edges
  return buildFallbackFacet(vertices, edges, defaultPitch);
}

/**
 * Fallback: create a single facet from perimeter edges when planar extraction fails.
 */
export function buildFallbackFacet(
  vertices: LatLng[],
  edges: { startIndex: number; endIndex: number; type: EdgeType }[],
  pitch: number,
): FacetResult[] {
  const perimeterEdges = edges.filter(e => e.type === 'eave' || e.type === 'rake');

  if (perimeterEdges.length < 3) {
    if (vertices.length >= 3) {
      return [{
        vertexIndices: vertices.map((_, i) => i),
        pitch,
        name: '#1 Roof',
      }];
    }
    return [];
  }

  // Try to trace a closed perimeter loop
  const adjacency = new Map<number, number[]>();
  for (const e of perimeterEdges) {
    if (!adjacency.has(e.startIndex)) adjacency.set(e.startIndex, []);
    if (!adjacency.has(e.endIndex)) adjacency.set(e.endIndex, []);
    adjacency.get(e.startIndex)!.push(e.endIndex);
    adjacency.get(e.endIndex)!.push(e.startIndex);
  }

  const visited = new Set<number>();
  const loop: number[] = [];
  const startNode = perimeterEdges[0].startIndex;

  let current = startNode;
  while (true) {
    if (visited.has(current)) break;
    visited.add(current);
    loop.push(current);
    const neighbors = adjacency.get(current) || [];
    const next = neighbors.find(n => !visited.has(n));
    if (next === undefined) break;
    current = next;
  }

  if (loop.length >= 3) {
    return [{
      vertexIndices: loop,
      pitch,
      name: '#1 Roof',
    }];
  }

  // Final fallback: all unique perimeter vertices
  const uniqueIndices = new Set<number>();
  for (const e of perimeterEdges) {
    uniqueIndices.add(e.startIndex);
    uniqueIndices.add(e.endIndex);
  }

  if (uniqueIndices.size >= 3) {
    return [{
      vertexIndices: Array.from(uniqueIndices),
      pitch,
      name: '#1 Roof',
    }];
  }

  return [];
}
