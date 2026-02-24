import { useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import type { AutoMeasureProgress, ReconstructedRoof, SolarRoofSegment } from '../types/solar';
import { fetchBuildingInsights, fetchDataLayers, fetchGeoTiff, SolarApiError } from '../services/solarApi';
import { capturePropertyImage, detectRoofEdges } from '../services/visionApi';
import type { EdgeType } from '../types';
import { extractFacetsFromEdges } from '../utils/planarFaceExtraction';
import { parseMaskGeoTiff, parseDsmGeoTiff, extractBuildingOutline } from '../utils/contour';
import { reconstructRoof } from '../utils/roofReconstruction';
import { analyzeFacetFromDSM, computeBuildingHeight } from '../utils/dsmAnalysis';
import { degreesToPitch, clampPitch } from '../utils/geometry';

export function useAutoMeasure() {
  const [progress, setProgress] = useState<AutoMeasureProgress>({
    status: 'idle',
    percent: 0,
    message: '',
  });

  const applyAutoMeasurement = useStore((s) => s.applyAutoMeasurement);
  const setSolarInsights = useStore((s) => s.setSolarInsights);

  const detect = useCallback(async (
    lat: number,
    lng: number,
    googleApiKey: string,
  ) => {
    try {
      // Step 1: Fetch Solar API data in parallel — buildingInsights + dataLayers
      setProgress({ status: 'detecting', percent: 5, message: 'Querying Solar API...' });

      const [insightsResult, layersResult] = await Promise.allSettled([
        fetchBuildingInsights(lat, lng, googleApiKey),
        fetchDataLayers(lat, lng, 50, googleApiKey),
      ]);

      const insights = insightsResult.status === 'fulfilled' ? insightsResult.value : null;
      const dataLayers = layersResult.status === 'fulfilled' ? layersResult.value : null;

      // Cache building insights for solar panel analysis
      setSolarInsights(insights);

      const solarSegments: SolarRoofSegment[] = insights?.solarPotential?.roofSegmentStats || [];
      if (solarSegments.length > 0) {
        const sorted = [...solarSegments].sort((a, b) => b.stats.areaMeters2 - a.stats.areaMeters2);
        setProgress({ status: 'detecting', percent: 15, message: `Solar: ${solarSegments.length} segments, pitch ${sorted[0].pitchDegrees.toFixed(0)}°` });
      }

      // Step 2: LIDAR path — if dataLayers available, use mask+DSM for high-accuracy measurement
      if (dataLayers) {
        try {
          setProgress({ status: 'downloading', percent: 20, message: 'Downloading LIDAR data (mask + DSM)...' });

          // Download mask and DSM GeoTIFFs in parallel
          const [maskBuffer, dsmBuffer] = await Promise.all([
            fetchGeoTiff(dataLayers.maskUrl, googleApiKey),
            fetchGeoTiff(dataLayers.dsmUrl, googleApiKey),
          ]);

          setProgress({ status: 'processing', percent: 40, message: 'Parsing LIDAR mask and elevation data...' });

          // Parse GeoTIFFs
          const [parsedMask, parsedDsm] = await Promise.all([
            parseMaskGeoTiff(maskBuffer),
            parseDsmGeoTiff(dsmBuffer),
          ]);

          // Extract building outline from LIDAR mask
          setProgress({ status: 'processing', percent: 50, message: 'Extracting building outline from LIDAR mask...' });
          const lidarOutline = extractBuildingOutline(parsedMask, lat, lng);

          if (lidarOutline.length >= 3 && solarSegments.length > 0) {
            // Reconstruct roof using LIDAR outline + Solar segments
            setProgress({ status: 'reconstructing', percent: 60, message: 'Reconstructing roof from LIDAR outline...' });
            const reconstructed = reconstructRoof(lidarOutline, solarSegments);

            // Analyze each facet with DSM for 3D pitch and true surface area
            setProgress({ status: 'processing', percent: 70, message: 'Computing 3D pitch and area from DSM elevation...' });
            const facetAnalyses = reconstructed.facets.map((facet) => {
              const facetVertices = facet.vertexIndices
                .map((idx) => reconstructed.vertices[idx])
                .filter(Boolean);
              if (facetVertices.length < 3) return null;
              return analyzeFacetFromDSM(facetVertices, parsedDsm, lng);
            });

            // Merge DSM pitch with Solar API pitch for each facet
            for (let i = 0; i < reconstructed.facets.length; i++) {
              const dsmAnalysis = facetAnalyses[i];
              if (dsmAnalysis && dsmAnalysis.sampleCount >= 10) {
                // Average Solar API pitch and DSM pitch for best accuracy
                const solarPitch = reconstructed.facets[i].pitch;
                const dsmPitch = clampPitch(Math.round(degreesToPitch(dsmAnalysis.pitchDegrees) * 10) / 10);
                reconstructed.facets[i].pitch = Math.round(((solarPitch + dsmPitch) / 2) * 10) / 10;
                reconstructed.facets[i].trueArea3DSqFt = dsmAnalysis.trueAreaSqFt3D;
              }
            }

            // Compute building height
            setProgress({ status: 'processing', percent: 80, message: 'Estimating building height...' });
            const buildingHeight = computeBuildingHeight(lidarOutline, parsedDsm, lng);

            // Attach LIDAR metadata
            reconstructed.dataSource = 'lidar-mask';
            reconstructed.buildingHeight = buildingHeight;
            reconstructed.facetDsmAnalysis = facetAnalyses.filter(Boolean) as typeof reconstructed.facetDsmAnalysis;

            setProgress({ status: 'reconstructing', percent: 90, message: `LIDAR: ${capitalize(reconstructed.roofType)} roof — ${reconstructed.facets.length} facets, ${buildingHeight.stories} ${buildingHeight.stories === 1 ? 'story' : 'stories'}` });

            // Apply to store
            applyAutoMeasurement(reconstructed);

            setProgress({ status: 'complete', percent: 100, message: `LIDAR ${capitalize(reconstructed.roofType)} roof: ${reconstructed.facets.length} facets, ${buildingHeight.heightFt.toFixed(0)} ft tall (${reconstructed.confidence} confidence)` });

            return reconstructed;
          }

          // LIDAR outline too small or no solar segments — fall through to AI Vision
          console.warn('LIDAR outline insufficient, falling back to AI Vision');
        } catch (lidarErr) {
          // LIDAR path failed — fall through to AI Vision
          console.warn('LIDAR path failed, falling back to AI Vision:', lidarErr);
        }
      }

      // Step 3: AI Vision fallback path (original pipeline)
      setProgress({ status: 'downloading', percent: 25, message: 'Capturing satellite imagery...' });
      const { base64, bounds } = await capturePropertyImage(lat, lng, googleApiKey);

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

      // Merge Solar pitch with AI edges
      const solarPitchDeg = solarSegments.length > 0
        ? [...solarSegments].sort((a, b) => b.stats.areaMeters2 - a.stats.areaMeters2)[0].pitchDegrees
        : null;
      const pitchDeg = solarPitchDeg ?? detected.estimatedPitchDegrees;
      const pitchOver12 = Math.round(Math.tan(pitchDeg * Math.PI / 180) * 12);

      // Extract individual facets
      setProgress({ status: 'processing', percent: 80, message: 'Extracting roof facets...' });
      let facets = extractFacetsFromEdges(
        detected.vertices,
        detected.edges,
        solarSegments.length > 0 ? solarSegments : undefined,
        pitchOver12,
      );

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
        dataSource: 'ai-vision',
      };

      setProgress({ status: 'reconstructing', percent: 85, message: `${capitalize(reconstructed.roofType)} roof — ${reconstructed.facets.length} facets, ${reconstructed.edges.length} edges` });

      applyAutoMeasurement(reconstructed);

      setProgress({ status: 'complete', percent: 100, message: `AI Vision ${capitalize(reconstructed.roofType)} roof: ${reconstructed.facets.length} facets (${reconstructed.confidence} confidence)` });

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
