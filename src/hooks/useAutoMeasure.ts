import { useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import type { AutoMeasureProgress, ReconstructedRoof, SolarRoofSegment, FluxMapAnalysis } from '../types/solar';
import { fetchBuildingInsights, fetchDataLayers, fetchGeoTiff, SolarApiError } from '../services/solarApi';
import { capturePropertyImage, detectRoofEdges, detectRoofEdgesML, checkMLModelAvailable } from '../services/visionApi';
import type { EdgeType } from '../types';
import { extractFacetsFromEdges } from '../utils/planarFaceExtraction';
import { parseMaskGeoTiff, parseDsmGeoTiff, extractBuildingOutline } from '../utils/contour';
import { reconstructRoof } from '../utils/roofReconstruction';
import { analyzeFacetFromDSM, computeBuildingHeight } from '../utils/dsmAnalysis';
import { degreesToPitch, clampPitch } from '../utils/geometry';
import { parseFluxGeoTiff, parseMonthlyFluxGeoTiff, analyzeFluxForFacets } from '../utils/fluxAnalysis';
import { verifyPitchFromDSM } from '../utils/dsmPitchVerification';
import { detectMultipleStructures } from '../utils/multiStructureDetection';

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
      const imageryQuality = insights?.imageryQuality;
      if (solarSegments.length > 0) {
        const sorted = [...solarSegments].sort((a, b) => b.stats.areaMeters2 - a.stats.areaMeters2);
        const qualityNote = imageryQuality === 'MEDIUM' ? ' (MEDIUM quality — reduced accuracy)' : '';

        // Detect multiple structures (detached garage, shed, etc.)
        const multiStructure = detectMultipleStructures(solarSegments);
        const structureNote = multiStructure.hasMultipleStructures
          ? ` | ${multiStructure.structureCount} structures detected`
          : '';

        setProgress({ status: 'detecting', percent: 15, message: `Solar: ${solarSegments.length} segments, pitch ${sorted[0].pitchDegrees.toFixed(0)}°${qualityNote}${structureNote}` });
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
            reconstructed.imageryQuality = imageryQuality;

            // Attach Solar API total area for cross-validation
            if (insights?.solarPotential?.wholeRoofStats?.areaMeters2) {
              reconstructed.solarApiAreaSqFt = insights.solarPotential.wholeRoofStats.areaMeters2 * 10.7639;
            }

            // Phase 7: Pitch verification — compare Solar API pitch vs DSM pitch
            setProgress({ status: 'processing', percent: 82, message: 'Verifying pitch from DSM...' });
            try {
              const pitchVerifications = verifyPitchFromDSM(parsedDsm, reconstructed, lng);
              // Apply DSM pitch when recommendation is 'accept-dsm'
              for (const pv of pitchVerifications) {
                if (pv.recommendation === 'accept-dsm' && pv.confidence !== 'low') {
                  reconstructed.facets[pv.facetIndex].pitch = pv.dsmPitch;
                }
              }
              // Log verification results for diagnostics
              const deviations = pitchVerifications.filter(pv => pv.pitchDifference >= 2);
              if (deviations.length > 0) {
                console.info(`[SkyHawk] Pitch verification: ${deviations.length} facet(s) deviate >2/12 between Solar API and DSM`);
                for (const d of deviations) {
                  console.info(`  Facet ${d.facetIndex}: Solar ${d.solarApiPitch}/12 vs DSM ${d.dsmPitch}/12 (R²=${d.rSquared}) → ${d.recommendation}`);
                }
              }
            } catch (pvErr) {
              console.warn('Pitch verification failed (non-blocking):', pvErr);
            }

            // Phase 6: Flux analysis — if flux data layers are available
            let fluxResult: FluxMapAnalysis | null = null;
            if (dataLayers.annualFluxUrl) {
              setProgress({ status: 'processing', percent: 85, message: 'Analyzing solar flux data...' });
              try {
                const fluxBufferPromise = fetchGeoTiff(dataLayers.annualFluxUrl, googleApiKey);
                const monthlyFluxBufferPromise = dataLayers.monthlyFluxUrl
                  ? fetchGeoTiff(dataLayers.monthlyFluxUrl, googleApiKey)
                  : Promise.resolve(null);

                const [fluxBuffer, monthlyFluxBuffer] = await Promise.all([
                  fluxBufferPromise,
                  monthlyFluxBufferPromise,
                ]);

                const parsedFlux = await parseFluxGeoTiff(fluxBuffer);
                const parsedMonthlyFlux = monthlyFluxBuffer
                  ? await parseMonthlyFluxGeoTiff(monthlyFluxBuffer)
                  : undefined;

                // Build bounding box from building insights or outline
                const buildingBounds = insights?.boundingBox
                  ? {
                      sw: { lat: insights.boundingBox.sw.latitude, lng: insights.boundingBox.sw.longitude },
                      ne: { lat: insights.boundingBox.ne.latitude, lng: insights.boundingBox.ne.longitude },
                    }
                  : {
                      sw: {
                        lat: Math.min(...lidarOutline.map(v => v.lat)),
                        lng: Math.min(...lidarOutline.map(v => v.lng)),
                      },
                      ne: {
                        lat: Math.max(...lidarOutline.map(v => v.lat)),
                        lng: Math.max(...lidarOutline.map(v => v.lng)),
                      },
                    };

                fluxResult = analyzeFluxForFacets(
                  parsedFlux,
                  reconstructed.facets,
                  reconstructed.vertices,
                  buildingBounds,
                  parsedMonthlyFlux,
                );

                console.info(`[SkyHawk] Flux analysis: ${fluxResult.totalRoofPixels} roof pixels, mean flux ${fluxResult.meanRoofFlux} kWh/kW/yr, ${fluxResult.overallShadingPercent}% shaded`);
              } catch (fluxErr) {
                console.warn('Flux analysis failed (non-blocking):', fluxErr);
              }
            }

            setProgress({ status: 'reconstructing', percent: 90, message: `LIDAR: ${capitalize(reconstructed.roofType)} roof — ${reconstructed.facets.length} facets, ${buildingHeight.stories} ${buildingHeight.stories === 1 ? 'story' : 'stories'}` });

            // Apply to store
            applyAutoMeasurement(reconstructed);

            const qualityWarning = imageryQuality === 'MEDIUM' ? ' ⚠ MEDIUM quality imagery' : '';
            setProgress({ status: 'complete', percent: 100, message: `LIDAR ${capitalize(reconstructed.roofType)} roof: ${reconstructed.facets.length} facets, ${buildingHeight.heightFt.toFixed(0)} ft tall (${reconstructed.confidence} confidence)${qualityWarning}` });

            return reconstructed;
          }

          // LIDAR outline too small or no solar segments — fall through to AI Vision
          console.warn('LIDAR outline insufficient, falling back to AI Vision');
        } catch (lidarErr) {
          // LIDAR path failed — fall through to AI Vision
          console.warn('LIDAR path failed, falling back to AI Vision:', lidarErr);
        }
      }

      // Step 3: ML Model path (when available) — between LIDAR and Claude Vision
      try {
        const mlAvailable = await checkMLModelAvailable();
        if (mlAvailable) {
          setProgress({ status: 'processing', percent: 25, message: 'Capturing satellite imagery for ML model...' });
          const { base64: mlBase64, bounds: mlBounds } = await capturePropertyImage(lat, lng, googleApiKey);

          setProgress({ status: 'processing', percent: 35, message: 'ML model analyzing roof edges...' });
          const mlDetected = await detectRoofEdgesML(mlBase64, mlBounds, 640);

          if (mlDetected.edges.length > 0) {
            setProgress({ status: 'processing', percent: 60, message: `ML detected ${mlDetected.edges.length} edges, ${mlDetected.vertices.length} vertices` });

            // Merge Solar pitch with ML edges
            const solarPitchDeg = solarSegments.length > 0
              ? [...solarSegments].sort((a, b) => b.stats.areaMeters2 - a.stats.areaMeters2)[0].pitchDegrees
              : null;
            const pitchDeg = solarPitchDeg ?? mlDetected.estimatedPitchDegrees;
            const pitchOver12 = Math.round(Math.tan(pitchDeg * Math.PI / 180) * 12);

            setProgress({ status: 'processing', percent: 75, message: 'Extracting roof facets from ML edges...' });
            let facets = extractFacetsFromEdges(
              mlDetected.vertices,
              mlDetected.edges,
              solarSegments.length > 0 ? solarSegments : undefined,
              pitchOver12,
            );

            if (facets.length === 0) {
              facets = buildFallbackFacet(mlDetected, pitchOver12);
            }

            const mlReconstructed: ReconstructedRoof = {
              vertices: mlDetected.vertices,
              edges: mlDetected.edges.map(e => ({
                startIndex: e.startIndex,
                endIndex: e.endIndex,
                type: e.type as 'ridge' | 'hip' | 'valley' | 'rake' | 'eave' | 'flashing',
              })),
              facets,
              roofType: mlDetected.roofType,
              confidence: mlDetected.confidence >= 0.7 ? 'high' : mlDetected.confidence >= 0.4 ? 'medium' : 'low',
              dataSource: 'ml-model',
              imageryQuality: imageryQuality,
            };

            if (insights?.solarPotential?.wholeRoofStats?.areaMeters2) {
              mlReconstructed.solarApiAreaSqFt = insights.solarPotential.wholeRoofStats.areaMeters2 * 10.7639;
            }

            applyAutoMeasurement(mlReconstructed);
            setProgress({ status: 'complete', percent: 100, message: `ML Model ${capitalize(mlReconstructed.roofType)} roof: ${mlReconstructed.facets.length} facets (${mlReconstructed.confidence} confidence)` });
            return mlReconstructed;
          }
          // ML detected no edges — fall through to Claude Vision
          console.warn('ML model detected no edges, falling back to AI Vision');
        }
      } catch (mlErr) {
        console.warn('ML model path failed, falling back to AI Vision:', mlErr);
      }

      // Step 4: AI Vision fallback path (original pipeline)
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
