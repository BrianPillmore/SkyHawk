import { useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import type { AutoMeasureProgress, ReconstructedRoof, SolarRoofSegment } from '../types/solar';
import { fetchBuildingInsights, SolarApiError } from '../services/solarApi';
import { capturePropertyImage, detectRoofEdges } from '../services/visionApi';
import type { EdgeType } from '../types';
import { extractFacetsFromEdges } from '../utils/planarFaceExtraction';

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
      // Step 1: Try Solar API for pitch data + segment info (non-blocking)
      setProgress({ status: 'detecting', percent: 5, message: 'Checking Solar API for pitch data...' });

      let solarPitchDeg: number | null = null;
      let solarSegments: SolarRoofSegment[] = [];
      try {
        const insights = await fetchBuildingInsights(lat, lng, googleApiKey);
        const segments = insights.solarPotential?.roofSegmentStats || [];
        if (segments.length > 0) {
          solarSegments = segments;
          // Use the largest segment's pitch as primary
          const sorted = [...segments].sort((a, b) => b.stats.areaMeters2 - a.stats.areaMeters2);
          solarPitchDeg = sorted[0].pitchDegrees;
          setProgress({ status: 'detecting', percent: 15, message: `Solar data: ${segments.length} segments, pitch ${solarPitchDeg.toFixed(0)}°` });
        }
      } catch (err) {
        // Solar API failure is non-fatal
        console.warn('Solar API unavailable, using AI-only:', err);
        setProgress({ status: 'detecting', percent: 10, message: 'No Solar data available, proceeding with AI...' });
      }

      // Step 2: Capture satellite image
      setProgress({ status: 'downloading', percent: 25, message: 'Capturing satellite imagery...' });
      const { base64, bounds } = await capturePropertyImage(lat, lng, googleApiKey);

      // Step 3: AI Edge Detection (PRIMARY) — pass solar segments for context
      setProgress({ status: 'ai-fallback', percent: 40, message: 'AI analyzing roof edges...' });
      const segmentHints = solarSegments.length > 0
        ? solarSegments.map((s) => ({
            center: s.center,
            pitchDegrees: s.pitchDegrees,
            azimuthDegrees: s.azimuthDegrees,
            stats: { areaMeters2: s.stats.areaMeters2 },
          }))
        : undefined;
      const detected = await detectRoofEdges(base64, bounds, 640, segmentHints);

      setProgress({ status: 'processing', percent: 70, message: `Detected ${detected.edges.length} edges, ${detected.vertices.length} vertices` });

      // Step 4: Merge Solar pitch with AI edges
      const pitchDeg = solarPitchDeg ?? detected.estimatedPitchDegrees;
      const pitchOver12 = Math.round(Math.tan(pitchDeg * Math.PI / 180) * 12);

      // Step 5: Extract individual facets using planar face algorithm
      setProgress({ status: 'processing', percent: 80, message: 'Extracting roof facets...' });
      let facets = extractFacetsFromEdges(
        detected.vertices,
        detected.edges,
        solarSegments.length > 0 ? solarSegments : undefined,
        pitchOver12,
      );

      // Fallback: if extraction produces 0 facets, use single-facet approach
      if (facets.length === 0) {
        facets = buildFallbackFacet(detected, pitchOver12);
      }

      const reconstructed: ReconstructedRoof = {
        vertices: detected.vertices,
        edges: detected.edges.map(e => ({
          startIndex: e.startIndex,
          endIndex: e.endIndex,
          type: e.type as 'ridge' | 'hip' | 'valley' | 'rake' | 'eave' | 'flashing',
        })),
        facets,
        roofType: detected.roofType,
        confidence: detected.confidence >= 0.7 ? 'high' : detected.confidence >= 0.4 ? 'medium' : 'low',
      };

      setProgress({ status: 'reconstructing', percent: 85, message: `${capitalize(reconstructed.roofType)} roof — ${reconstructed.facets.length} facets, ${reconstructed.edges.length} edges` });

      // Step 6: Apply to store
      applyAutoMeasurement(reconstructed);

      setProgress({ status: 'complete', percent: 100, message: `${capitalize(reconstructed.roofType)} roof: ${reconstructed.facets.length} facets (${reconstructed.confidence} confidence)` });

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
 * Fallback: create a single facet from perimeter edges when planar extraction fails.
 */
function buildFallbackFacet(
  detected: { vertices: { lat: number; lng: number }[]; edges: { startIndex: number; endIndex: number; type: EdgeType }[] },
  pitch: number,
): { vertexIndices: number[]; pitch: number; name: string }[] {
  const perimeterEdges = detected.edges.filter(e => e.type === 'eave' || e.type === 'rake');

  if (perimeterEdges.length < 3) {
    if (detected.vertices.length >= 3) {
      return [{
        vertexIndices: detected.vertices.map((_, i) => i),
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
