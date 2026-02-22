import { useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import type { AutoMeasureProgress, ReconstructedRoof } from '../types/solar';
import { fetchBuildingInsights, fetchDataLayers, fetchGeoTiff, SolarApiError } from '../services/solarApi';
import { parseMaskGeoTiff, extractBuildingOutline } from '../utils/contour';
import { reconstructRoof } from '../utils/roofReconstruction';
import { capturePropertyImage, analyzeRoofImage } from '../services/visionApi';

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
    anthropicApiKey?: string
  ) => {
    try {
      // Step 1: Fetch building insights
      setProgress({ status: 'detecting', percent: 5, message: 'Detecting building...' });

      let insights;
      try {
        insights = await fetchBuildingInsights(lat, lng, googleApiKey);
      } catch (err) {
        if (err instanceof SolarApiError && err.statusCode === 404 && anthropicApiKey) {
          // No Solar data, try AI Vision fallback
          return await runAiFallback(lat, lng, googleApiKey, anthropicApiKey);
        }
        throw err;
      }

      setProgress({ status: 'detecting', percent: 15, message: 'Building detected. Fetching roof data...' });

      const segments = insights.solarPotential?.roofSegmentStats || [];

      // Step 2: Fetch data layers (mask GeoTIFF)
      setProgress({ status: 'downloading', percent: 25, message: 'Downloading LIDAR data...' });

      let outline;
      try {
        const layers = await fetchDataLayers(lat, lng, 50, googleApiKey);

        setProgress({ status: 'downloading', percent: 40, message: 'Downloading building mask...' });

        const maskBuffer = await fetchGeoTiff(layers.maskUrl, googleApiKey);

        // Step 3: Parse GeoTIFF and extract outline
        setProgress({ status: 'processing', percent: 55, message: 'Processing LIDAR mask...' });

        const parsed = await parseMaskGeoTiff(maskBuffer);
        outline = extractBuildingOutline(parsed, lat, lng);
      } catch {
        // If mask processing fails, fall back to bounding box from insights
        setProgress({ status: 'processing', percent: 55, message: 'Using building bounds as outline...' });

        const bb = insights.boundingBox;
        outline = [
          { lat: bb.sw.latitude, lng: bb.sw.longitude },
          { lat: bb.sw.latitude, lng: bb.ne.longitude },
          { lat: bb.ne.latitude, lng: bb.ne.longitude },
          { lat: bb.ne.latitude, lng: bb.sw.longitude },
        ];
      }

      if (outline.length < 3) {
        throw new Error('Could not extract building outline. Try manual tools.');
      }

      setProgress({ status: 'processing', percent: 70, message: `Outline extracted (${outline.length} vertices)` });

      // Step 4: Reconstruct roof geometry
      setProgress({ status: 'reconstructing', percent: 80, message: 'Reconstructing roof geometry...' });

      const reconstructed = reconstructRoof(outline, segments);

      setProgress({ status: 'reconstructing', percent: 90, message: `${reconstructed.roofType} roof detected. Applying...` });

      // Step 5: Apply to store
      applyAutoMeasurement(reconstructed);

      setProgress({ status: 'complete', percent: 100, message: `${capitalize(reconstructed.roofType)} roof detected (${reconstructed.confidence} confidence)` });

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

  const runAiFallback = useCallback(async (
    lat: number,
    lng: number,
    googleApiKey: string,
    anthropicApiKey: string
  ): Promise<ReconstructedRoof> => {
    setProgress({ status: 'ai-fallback', percent: 30, message: 'No LIDAR data. Using AI Vision fallback...' });

    // Capture satellite image
    const { base64, bounds } = await capturePropertyImage(lat, lng, googleApiKey);

    setProgress({ status: 'ai-fallback', percent: 50, message: 'Analyzing satellite image with AI...' });

    // Analyze with Claude
    const reconstructed = await analyzeRoofImage(base64, bounds, anthropicApiKey);

    setProgress({ status: 'ai-fallback', percent: 85, message: 'AI analysis complete. Applying...' });

    // Apply to store
    applyAutoMeasurement(reconstructed);

    setProgress({ status: 'complete', percent: 100, message: `AI estimated: ${capitalize(reconstructed.roofType)} roof (verify measurements)` });

    return reconstructed;
  }, [applyAutoMeasurement]);

  const reset = useCallback(() => {
    setProgress({ status: 'idle', percent: 0, message: '' });
  }, []);

  return { progress, detect, reset };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
