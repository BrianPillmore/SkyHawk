import type { LatLng } from '../types';
import type { ReconstructedRoof, SolarRoofSegment } from '../types/solar';
import { reconstructRoof } from '../utils/roofReconstruction';

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
  anthropicApiKey: string,
  imageSize: number = 640
): Promise<ReconstructedRoof> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `Analyze this satellite image of a building roof. The image is ${imageSize}x${imageSize} pixels.

Return a JSON object with:
1. "outline": array of {x, y} pixel coordinates tracing the building roof outline clockwise. Use 8-20 points to define the polygon. Each x,y should be in the range [0, ${imageSize}].
2. "roofType": one of "flat", "shed", "gable", "hip", "complex"
3. "ridgeDirection": angle in degrees (0=north, 90=east) of the main ridge line, if applicable
4. "numFacets": estimated number of roof facets
5. "estimatedPitchDegrees": estimated roof pitch in degrees (typical residential: 15-35 degrees)

Return ONLY the JSON object, no other text.`,
          },
        ],
      }],
    }),
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
  apiKey: string,
): Promise<RoofConditionResponse> {
  const prompt = `Analyze this aerial/satellite image of a roof and provide a detailed condition assessment.

Return a JSON object with:
- overallScore: number 1-100 (100=perfect, 1=failed)
- estimatedAgeYears: estimated age in years based on visual wear
- materialType: one of "asphalt-shingle", "metal", "tile", "slate", "wood-shake", "tpo", "epdm", "built-up", "concrete", "unknown"
- materialConfidence: 0-1 confidence in material identification
- damages: array of detected damage areas, each with:
  - type: "hail", "wind", "missing-shingle", "crack", "ponding", "debris", "other"
  - severity: "minor", "moderate", "severe"
  - description: brief description
  - confidence: 0-1
- findings: array of observation strings

Assess wear patterns, color fading, granule loss, curling, missing/damaged areas, debris, moss/algae growth, and structural issues.

Return ONLY valid JSON, no markdown.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [{
          type: 'image',
          source: { type: 'base64', media_type: 'image/png', data: imageBase64 },
        }, {
          type: 'text',
          text: prompt,
        }],
      }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Vision API error: ${response.status}`);
  }

  const result = await response.json();
  const text = result.content?.[0]?.text ?? '{}';

  try {
    return JSON.parse(text);
  } catch {
    return {
      overallScore: 50,
      estimatedAgeYears: 15,
      materialType: 'unknown',
      materialConfidence: 0,
      damages: [],
      findings: ['Unable to parse AI analysis results'],
    };
  }
}
