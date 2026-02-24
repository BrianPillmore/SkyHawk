/**
 * Unit tests for multi-structure detection
 */
import { describe, it, expect } from 'vitest';
import { detectMultipleStructures } from '../../src/utils/multiStructureDetection';
import type { SolarRoofSegment } from '../../src/types/solar';

function seg(lat: number, lng: number, area: number = 50): SolarRoofSegment {
  return {
    pitchDegrees: 22,
    azimuthDegrees: 0,
    stats: { areaMeters2: area, sunshineQuantiles: [], groundAreaMeters2: area },
    center: { latitude: lat, longitude: lng },
    boundingBox: {
      sw: { latitude: lat - 0.0001, longitude: lng - 0.0001 },
      ne: { latitude: lat + 0.0001, longitude: lng + 0.0001 },
    },
    planeHeightAtCenterMeters: 5,
  };
}

describe('detectMultipleStructures', () => {
  it('should return 0 structures for empty segments', () => {
    const result = detectMultipleStructures([]);
    expect(result.structureCount).toBe(0);
    expect(result.hasMultipleStructures).toBe(false);
  });

  it('should return 1 structure for single segment', () => {
    const result = detectMultipleStructures([seg(40.0, -90.0)]);
    expect(result.structureCount).toBe(1);
    expect(result.hasMultipleStructures).toBe(false);
    expect(result.structures[0].isPrimary).toBe(true);
  });

  it('should group nearby segments into one structure', () => {
    // All segments within ~10ft of each other
    const segments = [
      seg(40.0000, -90.0000, 100),
      seg(40.0000, -90.0001, 80), // ~30ft east
      seg(40.0001, -90.0000, 60), // ~36ft north
    ];
    const result = detectMultipleStructures(segments, 50); // 50ft threshold
    expect(result.structureCount).toBe(1);
    expect(result.hasMultipleStructures).toBe(false);
    expect(result.structures[0].segmentIndices.length).toBe(3);
  });

  it('should detect two separate structures when gap exceeds threshold', () => {
    // Main house segments
    const mainHouse = [
      seg(40.0000, -90.0000, 100),
      seg(40.0000, -90.0001, 80),
    ];
    // Detached garage ~150ft away
    const garage = [
      seg(40.0005, -90.0005, 30),
    ];
    const result = detectMultipleStructures([...mainHouse, ...garage], 50);

    expect(result.structureCount).toBe(2);
    expect(result.hasMultipleStructures).toBe(true);
    // Primary is the larger structure
    expect(result.structures[0].isPrimary).toBe(true);
    expect(result.structures[0].totalAreaM2).toBe(180); // 100 + 80
    expect(result.structures[1].totalAreaM2).toBe(30);
  });

  it('should detect three separate structures', () => {
    const house = [seg(40.0000, -90.0000, 150)];
    const garage = [seg(40.0005, -90.0000, 40)]; // ~182ft north
    const shed = [seg(40.0000, -90.0010, 15)]; // ~260ft west

    const result = detectMultipleStructures([...house, ...garage, ...shed], 50);
    expect(result.structureCount).toBe(3);
    expect(result.hasMultipleStructures).toBe(true);
    // Sorted by area (largest first)
    expect(result.structures[0].totalAreaM2).toBe(150);
    expect(result.structures[1].totalAreaM2).toBe(40);
    expect(result.structures[2].totalAreaM2).toBe(15);
  });

  it('should handle chain connectivity (A near B, B near C, all in one cluster)', () => {
    // A -- 20ft -- B -- 20ft -- C (total A-C = 40ft, but chained via B)
    const segments = [
      seg(40.0000, -90.0000, 50), // A
      seg(40.00006, -90.0000, 50), // B: ~22ft from A
      seg(40.00012, -90.0000, 50), // C: ~22ft from B, ~44ft from A
    ];
    const result = detectMultipleStructures(segments, 25);
    // B connects A and C, so they should all be in one structure
    expect(result.structureCount).toBe(1);
    expect(result.structures[0].segmentIndices.length).toBe(3);
  });

  it('should compute correct centroids for each structure', () => {
    const segments = [
      seg(40.0000, -90.0000, 100),
      seg(40.0010, -90.0010, 50), // far away
    ];
    const result = detectMultipleStructures(segments, 10);
    expect(result.structureCount).toBe(2);

    expect(result.structures[0].center.lat).toBeCloseTo(40.0000, 3);
    expect(result.structures[1].center.lat).toBeCloseTo(40.0010, 3);
  });

  it('should mark only the largest structure as primary', () => {
    const segments = [
      seg(40.0000, -90.0000, 30), // small
      seg(40.0010, -90.0000, 100), // large
    ];
    const result = detectMultipleStructures(segments, 10);
    expect(result.structures[0].isPrimary).toBe(true);
    expect(result.structures[0].totalAreaM2).toBe(100); // largest first
    expect(result.structures[1].isPrimary).toBe(false);
  });
});
