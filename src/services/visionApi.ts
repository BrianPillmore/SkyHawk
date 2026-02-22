import type { LatLng, EdgeType } from '../types';
import type { ReconstructedRoof, SolarRoofSegment, DetectedRoofEdges, RoofType } from '../types/solar';
import { reconstructRoof } from '../utils/roofReconstruction';
import { useStore } from '../store/useStore';

function getAuthHeaders(): Record<string, string> {
  const token = useStore.getState().token;
  if (token) {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }
  return { 'Content-Type': 'application/json' };
}

interface VisionRoofResponse {
  outline: { x: number; y: number }[];
  roofType: string;
  ridgeDirection?: number;
  numFacets: number;
  estimatedPitchDegrees: number;
}

/**
 * Capture a satellite image of the property using Google Maps Static API.
 * Returns a base64-encoded image suitable for sending to the vision API.
 */
export async function capturePropertyImage(
  lat: number,
  lng: number,
  apiKey: string,
  zoom: number = 20,
  size: number = 640
): Promise<{ base64: string; bounds: { north: number; south: number; east: number; west: number } }> {
  const url = `https://maps.googleapis.com/maps/api/staticmap?` +
    new URLSearchParams({
      center: `${lat},${lng}`,
      zoom: zoom.toString(),
      size: `${size}x${size}`,
      maptype: 'satellite',
      key: apiKey,
    });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to capture satellite image: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );

  // Calculate approximate image bounds at given zoom level
  const metersPerPixel = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  const halfSizeMeters = (size / 2) * metersPerPixel;
  const degPerMeter = 1 / 111320;

  const bounds = {
    north: lat + halfSizeMeters * degPerMeter,
    south: lat - halfSizeMeters * degPerMeter,
    east: lng + halfSizeMeters * degPerMeter / Math.cos((lat * Math.PI) / 180),
    west: lng - halfSizeMeters * degPerMeter / Math.cos((lat * Math.PI) / 180),
  };

  return { base64, bounds };
}

/**
 * Analyze a satellite image using Claude AI Vision to detect roof outlines.
 * Used as fallback when Google Solar API has no coverage for the location.
 */
export async function analyzeRoofImage(
  imageBase64: string,
  imageBounds: { north: number; south: number; east: number; west: number },
  imageSize: number = 640
): Promise<ReconstructedRoof> {
  const response = await fetch('/api/vision/analyze', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ imageBase64, imageBounds, imageSize }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${body}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  // Parse JSON from response (handle potential markdown wrapping)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse roof analysis response from AI');
  }

  const parsed: VisionRoofResponse = JSON.parse(jsonMatch[0]);

  // Convert pixel coordinates to lat/lng
  const outline: LatLng[] = parsed.outline.map((p) => ({
    lat: imageBounds.north - (p.y / imageSize) * (imageBounds.north - imageBounds.south),
    lng: imageBounds.west + (p.x / imageSize) * (imageBounds.east - imageBounds.west),
  }));

  // Create synthetic Solar-like segments for the reconstruction pipeline
  const syntheticSegments: SolarRoofSegment[] = [];
  const pitchDeg = parsed.estimatedPitchDegrees || 22; // ~5/12 default

  if (parsed.roofType === 'gable' && parsed.ridgeDirection !== undefined) {
    syntheticSegments.push(
      createSyntheticSegment(pitchDeg, parsed.ridgeDirection),
      createSyntheticSegment(pitchDeg, (parsed.ridgeDirection + 180) % 360)
    );
  } else if (parsed.roofType === 'hip' && parsed.ridgeDirection !== undefined) {
    syntheticSegments.push(
      createSyntheticSegment(pitchDeg, parsed.ridgeDirection),
      createSyntheticSegment(pitchDeg, (parsed.ridgeDirection + 90) % 360),
      createSyntheticSegment(pitchDeg, (parsed.ridgeDirection + 180) % 360),
      createSyntheticSegment(pitchDeg, (parsed.ridgeDirection + 270) % 360)
    );
  } else if (parsed.roofType === 'shed') {
    syntheticSegments.push(createSyntheticSegment(pitchDeg, parsed.ridgeDirection || 0));
  }
  // flat and complex: empty segments array is fine

  const result = reconstructRoof(outline, syntheticSegments);

  // Override confidence to 'low' for AI-estimated results
  result.confidence = 'low';

  return result;
}

function createSyntheticSegment(pitchDeg: number, azimuthDeg: number): SolarRoofSegment {
  return {
    pitchDegrees: pitchDeg,
    azimuthDegrees: azimuthDeg,
    stats: {
      areaMeters2: 50, // placeholder
      sunshineQuantiles: [],
      groundAreaMeters2: 50,
    },
    center: { latitude: 0, longitude: 0 },
    boundingBox: {
      sw: { latitude: 0, longitude: 0 },
      ne: { latitude: 0, longitude: 0 },
    },
    planeHeightAtCenterMeters: 5,
  };
}

/**
 * AI Edge Detection: Send satellite image to Claude and get back
 * individual roof edges with types + pixel coordinates.
 * Converts pixel coords to lat/lng and deduplicates vertices.
 */
export async function detectRoofEdges(
  imageBase64: string,
  imageBounds: { north: number; south: number; east: number; west: number },
  imageSize: number = 640,
  solarSegments?: { center: { latitude: number; longitude: number }; pitchDegrees: number; azimuthDegrees: number; stats: { areaMeters2: number } }[],
): Promise<DetectedRoofEdges> {
  const response = await fetch('/api/vision/detect-edges', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ imageBase64, imageBounds, imageSize, solarSegments }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Edge detection API error: ${response.status} - ${body}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  // Parse JSON from response (handle potential markdown wrapping)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse edge detection response from AI');
  }

  const parsed = JSON.parse(jsonMatch[0]) as {
    edges: { type: string; start: { x: number; y: number }; end: { x: number; y: number } }[];
    roofType: string;
    estimatedPitchDegrees: number;
    confidence: number;
  };

  if (!parsed.edges || !Array.isArray(parsed.edges) || parsed.edges.length === 0) {
    throw new Error('AI detected no roof edges in the image');
  }

  // Convert pixel coordinates to lat/lng
  const latRange = imageBounds.north - imageBounds.south;
  const lngRange = imageBounds.east - imageBounds.west;

  function pixelToLatLng(px: { x: number; y: number }): LatLng {
    return {
      lat: imageBounds.north - (px.y / imageSize) * latRange,
      lng: imageBounds.west + (px.x / imageSize) * lngRange,
    };
  }

  // Collect all endpoints and deduplicate within tolerance
  const DEDUP_TOLERANCE_PX = 3; // pixels
  const DEDUP_TOLERANCE_LAT = (DEDUP_TOLERANCE_PX / imageSize) * latRange;
  const DEDUP_TOLERANCE_LNG = (DEDUP_TOLERANCE_PX / imageSize) * lngRange;

  const vertices: LatLng[] = [];
  const edgeIndices: { startIndex: number; endIndex: number; type: EdgeType }[] = [];

  function findOrAddVertex(point: { x: number; y: number }): number {
    const ll = pixelToLatLng(point);
    // Check if close to an existing vertex
    for (let i = 0; i < vertices.length; i++) {
      if (
        Math.abs(vertices[i].lat - ll.lat) < DEDUP_TOLERANCE_LAT &&
        Math.abs(vertices[i].lng - ll.lng) < DEDUP_TOLERANCE_LNG
      ) {
        return i;
      }
    }
    vertices.push(ll);
    return vertices.length - 1;
  }

  const validTypes: EdgeType[] = ['ridge', 'hip', 'valley', 'rake', 'eave', 'flashing'];

  for (const edge of parsed.edges) {
    const type = (validTypes.includes(edge.type as EdgeType) ? edge.type : 'eave') as EdgeType;
    const startIdx = findOrAddVertex(edge.start);
    const endIdx = findOrAddVertex(edge.end);
    if (startIdx !== endIdx) {
      edgeIndices.push({ startIndex: startIdx, endIndex: endIdx, type });
    }
  }

  return {
    vertices,
    edges: edgeIndices,
    roofType: (parsed.roofType || 'complex') as RoofType,
    estimatedPitchDegrees: parsed.estimatedPitchDegrees || 22,
    confidence: parsed.confidence || 0.5,
  };
}

export interface RoofConditionResponse {
  overallScore: number;
  estimatedAgeYears: number;
  materialType: string;
  materialConfidence: number;
  damages: {
    type: string;
    severity: string;
    description: string;
    confidence: number;
  }[];
  findings: string[];
}

export async function analyzeRoofCondition(
  imageBase64: string,
): Promise<RoofConditionResponse> {
  const response = await fetch('/api/vision/condition', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ imageBase64 }),
  });

  if (!response.ok) {
    throw new Error(`Vision API error: ${response.status}`);
  }

  const result = await response.json();
  const text = result.content?.[0]?.text ?? '{}';

  const defaults: RoofConditionResponse = {
    overallScore: 50,
    estimatedAgeYears: 15,
    materialType: 'unknown',
    materialConfidence: 0,
    damages: [],
    findings: ['Unable to parse AI analysis results'],
  };

  try {
    const parsed = JSON.parse(text);
    return {
      overallScore: parsed.overallScore ?? defaults.overallScore,
      estimatedAgeYears: parsed.estimatedAgeYears ?? defaults.estimatedAgeYears,
      materialType: parsed.materialType ?? defaults.materialType,
      materialConfidence: parsed.materialConfidence ?? defaults.materialConfidence,
      damages: parsed.damages ?? defaults.damages,
      findings: parsed.findings ?? defaults.findings,
    };
  } catch {
    return defaults;
  }
}
