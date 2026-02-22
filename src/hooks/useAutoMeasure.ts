import { useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import type { AutoMeasureProgress, ReconstructedRoof } from '../types/solar';
import { fetchBuildingInsights, SolarApiError } from '../services/solarApi';
import { capturePropertyImage, detectRoofEdges } from '../services/visionApi';
import type { EdgeType } from '../types';

export function useAutoMeasure() {
  const [progress, setProgress] = useState<AutoMeasureProgress>({
    status: 'idle',
    percent: 0,
    message: '',
  });

  const applyAutoMeasurement = useStore((s) => s.applyAutoMeasurement);

  const detect = useCallback(async (
    lat: number,
    lng: number,
    googleApiKey: string,
  ) => {
    try {
      // Step 1: Try Solar API for pitch data (non-blocking)
      setProgress({ status: 'detecting', percent: 5, message: 'Checking Solar API for pitch data...' });

      let solarPitchDeg: number | null = null;
      try {
        const insights = await fetchBuildingInsights(lat, lng, googleApiKey);
        const segments = insights.solarPotential?.roofSegmentStats || [];
        if (segments.length > 0) {
          // Use the largest segment's pitch as primary
          const sorted = [...segments].sort((a, b) => b.stats.areaMeters2 - a.stats.areaMeters2);
          solarPitchDeg = sorted[0].pitchDegrees;
          setProgress({ status: 'detecting', percent: 15, message: `Solar pitch data found: ${solarPitchDeg.toFixed(0)}°` });
        }
      } catch (err) {
        // Solar API failure is non-fatal
        console.warn('Solar API unavailable, using AI-only:', err);
        setProgress({ status: 'detecting', percent: 10, message: 'No Solar data available, proceeding with AI...' });
      }

      // Step 2: Capture satellite image
      setProgress({ status: 'downloading', percent: 25, message: 'Capturing satellite imagery...' });
      const { base64, bounds } = await capturePropertyImage(lat, lng, googleApiKey);

      // Step 3: AI Edge Detection (PRIMARY)
      setProgress({ status: 'ai-fallback', percent: 40, message: 'AI analyzing roof edges...' });
      const detected = await detectRoofEdges(base64, bounds);

      setProgress({ status: 'processing', percent: 70, message: `Detected ${detected.edges.length} edges, ${detected.vertices.length} vertices` });

      // Step 4: Merge Solar pitch with AI edges
      const pitchDeg = solarPitchDeg ?? detected.estimatedPitchDegrees;
      const pitchOver12 = Math.round(Math.tan(pitchDeg * Math.PI / 180) * 12);

      // Build a ReconstructedRoof from the detected edges
      // Group edges to form facets: find closed loops of eave edges as facet boundaries
      // For now, create a single facet from all vertices if we have enough, or skip facets
      const reconstructed: ReconstructedRoof = {
        vertices: detected.vertices,
        edges: detected.edges.map(e => ({
          startIndex: e.startIndex,
          endIndex: e.endIndex,
          type: e.type as 'ridge' | 'hip' | 'valley' | 'rake' | 'eave' | 'flashing',
        })),
        facets: buildFacetsFromEdges(detected, pitchOver12),
        roofType: detected.roofType,
        confidence: detected.confidence >= 0.7 ? 'high' : detected.confidence >= 0.4 ? 'medium' : 'low',
      };

      setProgress({ status: 'reconstructing', percent: 85, message: `${capitalize(reconstructed.roofType)} roof — applying ${reconstructed.edges.length} edges...` });

      // Step 5: Apply to store
      applyAutoMeasurement(reconstructed);

      setProgress({ status: 'complete', percent: 100, message: `${capitalize(reconstructed.roofType)} roof detected (${reconstructed.confidence} confidence, ${reconstructed.edges.length} edges)` });

      return reconstructed;
    } catch (err) {
      const message = err instanceof SolarApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Unknown error during auto-detection';

      setProgress({ status: 'error', percent: 0, message });
      throw err;
    }
  }, [applyAutoMeasurement]);

  const reset = useCallback(() => {
    setProgress({ status: 'idle', percent: 0, message: '' });
  }, []);

  return { progress, detect, reset };
}

/**
 * Build facets from detected edges by finding perimeter (eave/rake) edges
 * that form closed loops. If we can't find clean loops, create a single
 * facet from all unique eave/rake vertices.
 */
function buildFacetsFromEdges(
  detected: { vertices: { lat: number; lng: number }[]; edges: { startIndex: number; endIndex: number; type: EdgeType }[] },
  pitch: number,
): { vertexIndices: number[]; pitch: number; name: string }[] {
  // Collect all perimeter (eave + rake) edges
  const perimeterEdges = detected.edges.filter(e => e.type === 'eave' || e.type === 'rake');

  if (perimeterEdges.length < 3) {
    // Not enough perimeter edges to form a facet — use all vertices
    if (detected.vertices.length >= 3) {
      return [{
        vertexIndices: detected.vertices.map((_, i) => i),
        pitch,
        name: 'Facet 1',
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

  // Simple loop finding: start from first vertex, follow edges
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
      name: 'Facet 1',
    }];
  }

  // Fallback: collect unique vertex indices from perimeter edges
  const uniqueIndices = new Set<number>();
  for (const e of perimeterEdges) {
    uniqueIndices.add(e.startIndex);
    uniqueIndices.add(e.endIndex);
  }

  if (uniqueIndices.size >= 3) {
    return [{
      vertexIndices: Array.from(uniqueIndices),
      pitch,
      name: 'Facet 1',
    }];
  }

  return [];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
