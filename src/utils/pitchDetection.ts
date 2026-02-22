/**
 * Pitch detection utilities.
 * Provides pitch estimation from shadow analysis and AI Vision.
 */

// Common residential roof pitches
export const COMMON_PITCHES = [3, 4, 5, 6, 7, 8, 9, 10, 12, 14] as const;

/**
 * Estimate pitch from shadow length ratio.
 * Uses the sun altitude angle and shadow projection.
 * shadowRatio = shadow length / building height
 */
export function estimatePitchFromShadow(
  shadowLengthFt: number,
  buildingHeightFt: number,
  sunAltitudeDeg: number,
): number {
  if (buildingHeightFt <= 0 || sunAltitudeDeg <= 0 || sunAltitudeDeg >= 90) return 6;

  const sunAngleRad = (sunAltitudeDeg * Math.PI) / 180;
  // The roof shadow projection gives us information about the roof angle
  const roofShadowRatio = shadowLengthFt / buildingHeightFt;

  // Estimate the pitch angle from the shadow geometry
  // Higher shadow ratio relative to sun angle suggests steeper pitch
  const estimatedAngleDeg = Math.atan(roofShadowRatio * Math.tan(sunAngleRad)) * (180 / Math.PI);

  // Convert angle to pitch (rise per 12 inches run)
  const pitchRaw = Math.tan(estimatedAngleDeg * Math.PI / 180) * 12;

  // Snap to nearest common pitch
  return snapToCommonPitch(pitchRaw);
}

/**
 * Snap a raw pitch value to the nearest common residential pitch.
 */
export function snapToCommonPitch(rawPitch: number): number {
  if (rawPitch <= 0) return 0;
  if (rawPitch > 18) return 18;

  let closest: number = COMMON_PITCHES[0];
  let minDiff = Math.abs(rawPitch - closest);

  for (const p of COMMON_PITCHES) {
    const diff = Math.abs(rawPitch - p);
    if (diff < minDiff) {
      minDiff = diff;
      closest = p;
    }
  }

  return closest;
}

/**
 * Convert pitch (x/12) to degrees.
 */
export function pitchToDegrees(pitch: number): number {
  return Math.atan(pitch / 12) * (180 / Math.PI);
}

/**
 * Convert degrees to pitch (x/12).
 */
export function degreesToPitch(degrees: number): number {
  return Math.tan((degrees * Math.PI) / 180) * 12;
}

/**
 * Estimate pitch from Vision API response (degrees -> pitch).
 */
export function estimatePitchFromAI(estimatedPitchDegrees: number): {
  pitch: number;
  confidence: 'high' | 'medium' | 'low';
} {
  const rawPitch = degreesToPitch(estimatedPitchDegrees);
  const pitch = snapToCommonPitch(rawPitch);

  // Confidence based on how close the raw value is to a common pitch
  const diff = Math.abs(rawPitch - pitch);
  let confidence: 'high' | 'medium' | 'low';
  if (diff < 0.5) confidence = 'high';
  else if (diff < 1.5) confidence = 'medium';
  else confidence = 'low';

  return { pitch, confidence };
}

export interface PitchSuggestion {
  pitch: number;
  degrees: number;
  confidence: 'high' | 'medium' | 'low';
  source: 'ai-vision' | 'shadow-analysis' | 'solar-api' | 'manual';
}
