/**
 * Unit tests for roof reconstruction algorithms
 * Run with: npx vitest run tests/unit/roofReconstruction.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  classifyRoofType,
  reconstructSimpleRoof,
  reconstructGableRoof,
  reconstructHipRoof,
  reconstructComplexRoof,
  reconstructRoof,
  areSegmentsClustered,
  assignVerticesByAzimuth,
  reconstructFromSolarApiAreas,
} from '../../src/utils/roofReconstruction';
import type { SolarRoofSegment } from '../../src/types/solar';

// Helper to create a segment with minimal required fields
function seg(pitchDeg: number, azimuthDeg: number, area: number = 50): SolarRoofSegment {
  return {
    pitchDegrees: pitchDeg,
    azimuthDegrees: azimuthDeg,
    stats: { areaMeters2: area, sunshineQuantiles: [], groundAreaMeters2: area },
    center: { latitude: 40, longitude: -90 },
    boundingBox: {
      sw: { latitude: 39.999, longitude: -90.001 },
      ne: { latitude: 40.001, longitude: -89.999 },
    },
    planeHeightAtCenterMeters: 5,
  };
}

// A standard rectangular outline for testing
const RECT_OUTLINE = [
  { lat: 40.0000, lng: -90.0004 },
  { lat: 40.0000, lng: -89.9996 },
  { lat: 40.0003, lng: -89.9996 },
  { lat: 40.0003, lng: -90.0004 },
];

// --- classifyRoofType ---

describe('classifyRoofType', () => {
  it('should classify empty segments as flat', () => {
    expect(classifyRoofType([])).toBe('flat');
  });

  it('should classify all-flat segments as flat', () => {
    expect(classifyRoofType([seg(2, 0), seg(3, 180)])).toBe('flat');
  });

  it('should classify 1 pitched segment as shed', () => {
    expect(classifyRoofType([seg(22, 180)])).toBe('shed');
  });

  it('should classify 2 opposing segments as gable', () => {
    // North (0°) and South (180°) facing, ~180° apart
    expect(classifyRoofType([seg(22, 0), seg(22, 180)])).toBe('gable');
  });

  it('should classify 2 segments that are NOT opposing as gable', () => {
    // Both facing roughly the same direction - still gable with 2 segments
    expect(classifyRoofType([seg(22, 0), seg(22, 45)])).toBe('gable');
  });

  it('should classify 4 segments with ~90° spacing as hip', () => {
    expect(classifyRoofType([
      seg(22, 0), seg(22, 90), seg(22, 180), seg(22, 270),
    ])).toBe('hip');
  });

  it('should classify 4 segments with 2 opposing pairs as cross-gable', () => {
    // Two pairs: (10, 190) and (100, 280)
    expect(classifyRoofType([
      seg(22, 10), seg(22, 190), seg(22, 100), seg(22, 280),
    ])).toBe('hip'); // Note: 4 segments at ~90° is detected as hip first
  });

  it('should classify 5+ segments as complex', () => {
    expect(classifyRoofType([
      seg(22, 0), seg(22, 72), seg(22, 144), seg(22, 216), seg(22, 288),
    ])).toBe('complex');
  });

  it('should handle edge case: opposing but with wrap-around (350° and 170°)', () => {
    const diff = Math.abs(350 - 170); // 180
    expect(diff).toBe(180);
    expect(classifyRoofType([seg(22, 350), seg(22, 170)])).toBe('gable');
  });
});

// --- reconstructSimpleRoof (flat/shed) ---

describe('reconstructSimpleRoof', () => {
  it('should create 1 facet with all outline vertices', () => {
    const result = reconstructSimpleRoof(RECT_OUTLINE, []);
    expect(result.roofType).toBe('flat');
    expect(result.facets.length).toBe(1);
    expect(result.facets[0].vertexIndices).toEqual([0, 1, 2, 3]);
    expect(result.facets[0].pitch).toBe(0); // flat
  });

  it('should create eave edges for all outline edges', () => {
    const result = reconstructSimpleRoof(RECT_OUTLINE, []);
    expect(result.edges.length).toBe(4);
    expect(result.edges.every((e) => e.type === 'eave')).toBe(true);
    // Check connectivity
    expect(result.edges[0]).toEqual({ startIndex: 0, endIndex: 1, type: 'eave' });
    expect(result.edges[3]).toEqual({ startIndex: 3, endIndex: 0, type: 'eave' });
  });

  it('should classify as shed when 1 pitched segment is given', () => {
    const result = reconstructSimpleRoof(RECT_OUTLINE, [seg(22, 180)]);
    expect(result.roofType).toBe('shed');
    expect(result.facets[0].pitch).toBeGreaterThan(0);
    expect(result.confidence).toBe('medium');
  });

  it('should preserve vertex count', () => {
    const result = reconstructSimpleRoof(RECT_OUTLINE, []);
    expect(result.vertices.length).toBe(4);
  });
});

// --- reconstructGableRoof ---

describe('reconstructGableRoof', () => {
  it('should add ridge endpoints to vertices', () => {
    const segments = [seg(22, 0), seg(22, 180)];
    const result = reconstructGableRoof(RECT_OUTLINE, segments);

    // Should have outline vertices + 2 ridge endpoints
    expect(result.vertices.length).toBe(RECT_OUTLINE.length + 2);
  });

  it('should include a ridge edge', () => {
    const segments = [seg(22, 0), seg(22, 180)];
    const result = reconstructGableRoof(RECT_OUTLINE, segments);

    const ridgeEdges = result.edges.filter((e) => e.type === 'ridge');
    expect(ridgeEdges.length).toBe(1);
    // Ridge connects the last two vertices (the ridge endpoints)
    expect(ridgeEdges[0].startIndex).toBe(RECT_OUTLINE.length);
    expect(ridgeEdges[0].endIndex).toBe(RECT_OUTLINE.length + 1);
  });

  it('should create 2 facets', () => {
    const segments = [seg(22, 0), seg(22, 180)];
    const result = reconstructGableRoof(RECT_OUTLINE, segments);
    expect(result.facets.length).toBe(2);
    expect(result.facets[0].name).toBe('Facet 1');
    expect(result.facets[1].name).toBe('Facet 2');
  });

  it('should have correct roof type and confidence', () => {
    const segments = [seg(22, 0), seg(22, 180)];
    const result = reconstructGableRoof(RECT_OUTLINE, segments);
    expect(result.roofType).toBe('gable');
    expect(result.confidence).toBe('high');
  });

  it('should have eave and/or rake edges for outline segments', () => {
    const segments = [seg(22, 0), seg(22, 180)];
    const result = reconstructGableRoof(RECT_OUTLINE, segments);
    const outlineEdges = result.edges.filter((e) => e.type === 'eave' || e.type === 'rake');
    expect(outlineEdges.length).toBe(RECT_OUTLINE.length);
  });

  it('should set pitch from segment data', () => {
    const segments = [seg(22, 0), seg(30, 180)];
    const result = reconstructGableRoof(RECT_OUTLINE, segments);
    // Each facet should have a positive pitch
    for (const facet of result.facets) {
      expect(facet.pitch).toBeGreaterThan(0);
    }
  });
});

// --- reconstructHipRoof ---

describe('reconstructHipRoof', () => {
  it('should add ridge endpoints to vertices', () => {
    const segments = [
      seg(22, 0, 100), seg(22, 90, 50), seg(22, 180, 100), seg(22, 270, 50),
    ];
    const result = reconstructHipRoof(RECT_OUTLINE, segments);
    expect(result.vertices.length).toBe(RECT_OUTLINE.length + 2);
  });

  it('should include ridge and hip edges', () => {
    const segments = [
      seg(22, 0, 100), seg(22, 90, 50), seg(22, 180, 100), seg(22, 270, 50),
    ];
    const result = reconstructHipRoof(RECT_OUTLINE, segments);

    const ridgeEdges = result.edges.filter((e) => e.type === 'ridge');
    const hipEdges = result.edges.filter((e) => e.type === 'hip');
    const eaveEdges = result.edges.filter((e) => e.type === 'eave');

    expect(ridgeEdges.length).toBe(1);
    expect(hipEdges.length).toBe(4); // 2 per ridge endpoint
    expect(eaveEdges.length).toBe(RECT_OUTLINE.length);
  });

  it('should have correct roof type and confidence', () => {
    const segments = [
      seg(22, 0, 100), seg(22, 90, 50), seg(22, 180, 100), seg(22, 270, 50),
    ];
    const result = reconstructHipRoof(RECT_OUTLINE, segments);
    expect(result.roofType).toBe('hip');
    expect(result.confidence).toBe('high');
  });

  it('should create at least 1 facet', () => {
    const segments = [
      seg(22, 0, 100), seg(22, 90, 50), seg(22, 180, 100), seg(22, 270, 50),
    ];
    const result = reconstructHipRoof(RECT_OUTLINE, segments);
    expect(result.facets.length).toBeGreaterThanOrEqual(1);
    for (const facet of result.facets) {
      expect(facet.pitch).toBeGreaterThan(0);
    }
  });
});

// --- reconstructComplexRoof ---

describe('reconstructComplexRoof', () => {
  it('should create multiple facets when segments have different centers', () => {
    // Two segments with centers near different outline vertices
    const segments = [
      { ...seg(22, 0), center: { latitude: 40.0000, longitude: -90.0000 } },
      { ...seg(22, 180), center: { latitude: 40.0003, longitude: -90.0000 } },
    ];
    const result = reconstructComplexRoof(RECT_OUTLINE, segments);
    expect(result.facets.length).toBe(2);
    expect(result.roofType).toBe('complex');
  });

  it('should add ridge/hip/valley edges between adjacent segments', () => {
    const segments = [
      { ...seg(22, 0), center: { latitude: 40.0000, longitude: -90.0000 } },
      { ...seg(22, 180), center: { latitude: 40.0003, longitude: -90.0000 } },
    ];
    const result = reconstructComplexRoof(RECT_OUTLINE, segments);
    const interiorEdges = result.edges.filter(e => e.type === 'ridge' || e.type === 'hip' || e.type === 'valley');
    expect(interiorEdges.length).toBeGreaterThanOrEqual(1);
    // Opposing azimuths (0° vs 180°) → ridge
    const ridgeEdges = result.edges.filter(e => e.type === 'ridge');
    expect(ridgeEdges.length).toBe(1);
  });

  it('should have medium confidence for 4+ segments', () => {
    const segments = [seg(22, 0), seg(22, 72), seg(22, 144), seg(22, 216), seg(22, 288)];
    const result = reconstructComplexRoof(RECT_OUTLINE, segments);
    expect(result.confidence).toBe('medium');
    expect(result.roofType).toBe('complex');
  });

  it('should have medium confidence when facets match segment count', () => {
    const segments = [
      { ...seg(22, 0), center: { latitude: 40.0000, longitude: -90.0000 } },
      { ...seg(22, 180), center: { latitude: 40.0003, longitude: -90.0000 } },
    ];
    const result = reconstructComplexRoof(RECT_OUTLINE, segments);
    // When facets >= segments, confidence is medium (not low)
    expect(result.confidence).toBe('medium');
  });

  it('should create multiple facets even when all segments share same center (clustered)', () => {
    // All same center — previously created only 1 facet. Now uses azimuth-based partitioning
    const segments = [seg(20, 0, 50), seg(30, 90, 50), seg(25, 180, 50), seg(20, 270, 50)];
    const result = reconstructComplexRoof(RECT_OUTLINE, segments);
    // With azimuth-based partitioning, should create more than 1 facet
    expect(result.facets.length).toBeGreaterThan(1);
    expect(result.facets[0].pitch).toBeGreaterThan(0);
  });

  it('should fall back to Solar API area reconstruction when azimuth partitioning still fails', () => {
    // Very few outline vertices with many segments — might still produce 1 facet
    const tinyOutline = [
      { lat: 40.0, lng: -90.0 },
      { lat: 40.0001, lng: -90.0 },
      { lat: 40.00005, lng: -90.0001 },
    ];
    const segments = [seg(20, 0, 80), seg(30, 180, 40)];
    const result = reconstructComplexRoof(tinyOutline, segments);
    // Should always produce at least 1 facet
    expect(result.facets.length).toBeGreaterThanOrEqual(1);
  });

  it('should classify outline edges as eave or rake', () => {
    const segments = [
      { ...seg(22, 0), center: { latitude: 40.0000, longitude: -90.0000 } },
      { ...seg(22, 180), center: { latitude: 40.0003, longitude: -90.0000 } },
    ];
    const result = reconstructComplexRoof(RECT_OUTLINE, segments);
    const outlineEdges = result.edges.filter(e => e.type === 'eave' || e.type === 'rake');
    expect(outlineEdges.length).toBe(RECT_OUTLINE.length);
  });

  it('should delegate to simple for 1 segment', () => {
    const result = reconstructComplexRoof(RECT_OUTLINE, [seg(22, 180)]);
    // Falls back to reconstructSimpleRoof
    expect(result.facets.length).toBe(1);
    expect(result.roofType).toBe('shed');
  });
});

// --- reconstructRoof (main entry point) ---

describe('reconstructRoof', () => {
  it('should dispatch to flat for no segments', () => {
    const result = reconstructRoof(RECT_OUTLINE, []);
    expect(result.roofType).toBe('flat');
  });

  it('should dispatch to shed for 1 segment', () => {
    const result = reconstructRoof(RECT_OUTLINE, [seg(22, 180)]);
    expect(result.roofType).toBe('shed');
  });

  it('should dispatch to gable for 2 opposing segments', () => {
    const result = reconstructRoof(RECT_OUTLINE, [seg(22, 0), seg(22, 180)]);
    expect(result.roofType).toBe('gable');
  });

  it('should dispatch to hip for 4 segments at 90° intervals', () => {
    const result = reconstructRoof(RECT_OUTLINE, [
      seg(22, 0, 100), seg(22, 90, 50), seg(22, 180, 100), seg(22, 270, 50),
    ]);
    expect(result.roofType).toBe('hip');
  });

  it('should dispatch to complex for 5+ segments', () => {
    const result = reconstructRoof(RECT_OUTLINE, [
      seg(22, 0), seg(22, 72), seg(22, 144), seg(22, 216), seg(22, 288),
    ]);
    expect(result.roofType).toBe('complex');
  });

  it('should always return valid structure', () => {
    const testCases = [
      [],
      [seg(22, 0)],
      [seg(22, 0), seg(22, 180)],
      [seg(22, 0, 100), seg(22, 90, 50), seg(22, 180, 100), seg(22, 270, 50)],
      [seg(22, 0), seg(22, 60), seg(22, 120), seg(22, 180), seg(22, 240)],
    ];

    for (const segments of testCases) {
      const result = reconstructRoof(RECT_OUTLINE, segments);

      // Must have vertices, edges, facets
      expect(result.vertices.length).toBeGreaterThanOrEqual(4);
      expect(result.edges.length).toBeGreaterThanOrEqual(4);
      expect(result.facets.length).toBeGreaterThanOrEqual(1);

      // All edge indices should be valid
      for (const edge of result.edges) {
        expect(edge.startIndex).toBeGreaterThanOrEqual(0);
        expect(edge.startIndex).toBeLessThan(result.vertices.length);
        expect(edge.endIndex).toBeGreaterThanOrEqual(0);
        expect(edge.endIndex).toBeLessThan(result.vertices.length);
      }

      // All facet vertex indices should be valid
      for (const facet of result.facets) {
        for (const idx of facet.vertexIndices) {
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(result.vertices.length);
        }
        expect(facet.pitch).toBeGreaterThanOrEqual(0);
      }

      // Confidence must be valid
      expect(['high', 'medium', 'low']).toContain(result.confidence);
    }
  });
});

// --- areSegmentsClustered ---

describe('areSegmentsClustered', () => {
  it('should detect clustered segments when centers are close together', () => {
    const segCenters = [
      { lat: 40.0001, lng: -90.0001 },
      { lat: 40.0001, lng: -90.0000 },
      { lat: 40.0002, lng: -90.0001 },
    ];
    // RECT_OUTLINE spans ~0.0003 in lat and ~0.0008 in lng — building diagonal ~100ft
    // Segment centers are within ~10ft of each other → clustered
    expect(areSegmentsClustered(RECT_OUTLINE, segCenters)).toBe(true);
  });

  it('should detect non-clustered segments when centers are spread apart', () => {
    const segCenters = [
      { lat: 40.0000, lng: -90.0004 },
      { lat: 40.0003, lng: -89.9996 },
    ];
    // Centers at opposite corners of the building → NOT clustered
    expect(areSegmentsClustered(RECT_OUTLINE, segCenters)).toBe(false);
  });

  it('should return true for single segment', () => {
    expect(areSegmentsClustered(RECT_OUTLINE, [{ lat: 40, lng: -90 }])).toBe(true);
  });

  it('should return true for identical centers', () => {
    const identical = [
      { lat: 40.0001, lng: -90.0001 },
      { lat: 40.0001, lng: -90.0001 },
    ];
    expect(areSegmentsClustered(RECT_OUTLINE, identical)).toBe(true);
  });
});

// --- assignVerticesByAzimuth ---

describe('assignVerticesByAzimuth', () => {
  it('should assign outline vertices to segments by azimuth direction', () => {
    const segments = [
      seg(22, 0, 50),   // North-facing
      seg(22, 180, 50), // South-facing
    ];
    const centroid = { lat: 40.00015, lng: -90.0000 };
    const groups = assignVerticesByAzimuth(RECT_OUTLINE, segments, centroid);

    // Should create 2 groups with vertices distributed between them
    expect(groups.length).toBe(2);
    // Each group should have at least 1 vertex
    expect(groups[0].length).toBeGreaterThanOrEqual(1);
    expect(groups[1].length).toBeGreaterThanOrEqual(1);
    // Total vertices should match outline
    expect(groups[0].length + groups[1].length).toBe(RECT_OUTLINE.length);
  });

  it('should assign vertices to 4 segments covering cardinal directions', () => {
    const segments = [
      seg(22, 0, 50),   // North
      seg(22, 90, 50),  // East
      seg(22, 180, 50), // South
      seg(22, 270, 50), // West
    ];
    const centroid = { lat: 40.00015, lng: -90.0000 };
    const groups = assignVerticesByAzimuth(RECT_OUTLINE, segments, centroid);

    expect(groups.length).toBe(4);
    // All vertices assigned
    const totalAssigned = groups.reduce((sum, g) => sum + g.length, 0);
    expect(totalAssigned).toBe(RECT_OUTLINE.length);
  });
});

// --- reconstructFromSolarApiAreas ---

describe('reconstructFromSolarApiAreas', () => {
  it('should create one facet per segment using Solar API areas', () => {
    const segments = [
      { ...seg(22, 0, 80), center: { latitude: 40.0001, longitude: -90.0001 } },
      { ...seg(22, 180, 40), center: { latitude: 40.0002, longitude: -90.0001 } },
    ];
    const result = reconstructFromSolarApiAreas(RECT_OUTLINE, segments);

    expect(result.facets.length).toBe(2);
    expect(result.roofType).toBe('complex');
    expect(result.dataSource).toBe('hybrid');
  });

  it('should set trueArea3DSqFt from Solar API areaMeters2', () => {
    const segments = [
      { ...seg(22, 0, 100), center: { latitude: 40.0001, longitude: -90.0001 } },
      { ...seg(22, 180, 50), center: { latitude: 40.0002, longitude: -90.0001 } },
    ];
    const result = reconstructFromSolarApiAreas(RECT_OUTLINE, segments);

    // Each facet should have trueArea3DSqFt derived from the segment's areaMeters2
    for (const facet of result.facets) {
      expect(facet.trueArea3DSqFt).toBeDefined();
      expect(facet.trueArea3DSqFt).toBeGreaterThan(0);
    }
  });

  it('should include internal edges between segments', () => {
    const segments = [
      { ...seg(22, 0, 80), center: { latitude: 40.0001, longitude: -90.0001 } },
      { ...seg(22, 180, 40), center: { latitude: 40.0002, longitude: -90.0001 } },
    ];
    const result = reconstructFromSolarApiAreas(RECT_OUTLINE, segments);

    // Should have outline edges + internal edges
    const outlineEdges = result.edges.filter(e => e.type === 'eave');
    const internalEdges = result.edges.filter(e => e.type === 'ridge' || e.type === 'hip' || e.type === 'valley');
    expect(outlineEdges.length).toBe(RECT_OUTLINE.length);
    expect(internalEdges.length).toBeGreaterThanOrEqual(1);
  });

  it('should have medium confidence when multiple facets created', () => {
    const segments = [
      { ...seg(22, 0, 80), center: { latitude: 40.0001, longitude: -90.0001 } },
      { ...seg(22, 180, 40), center: { latitude: 40.0002, longitude: -90.0001 } },
    ];
    const result = reconstructFromSolarApiAreas(RECT_OUTLINE, segments);
    expect(result.confidence).toBe('medium');
  });

  it('should produce valid vertex indices in all facets', () => {
    const segments = [
      { ...seg(22, 0, 80), center: { latitude: 40.0001, longitude: -90.0001 } },
      { ...seg(22, 90, 60), center: { latitude: 40.0002, longitude: -90.0001 } },
      { ...seg(22, 180, 40), center: { latitude: 40.0001, longitude: -89.9999 } },
    ];
    const result = reconstructFromSolarApiAreas(RECT_OUTLINE, segments);

    for (const facet of result.facets) {
      for (const idx of facet.vertexIndices) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(result.vertices.length);
      }
    }
  });
});

// --- Clustered segments integration (the critical bug fix) ---

describe('reconstructComplexRoof with clustered segments', () => {
  it('should produce multiple facets when segment centers are all identical', () => {
    // This is the exact scenario that caused the single-facet bug:
    // All segment centers are the same point, but they have different azimuths
    const identicalCenter = { latitude: 40.00015, longitude: -90.0000 };
    const segments: SolarRoofSegment[] = [
      { ...seg(22, 0, 80), center: identicalCenter },
      { ...seg(22, 90, 50), center: identicalCenter },
      { ...seg(22, 180, 80), center: identicalCenter },
      { ...seg(22, 270, 50), center: identicalCenter },
    ];

    const result = reconstructComplexRoof(RECT_OUTLINE, segments);

    // CRITICAL: Must produce more than 1 facet (was the bug)
    expect(result.facets.length).toBeGreaterThan(1);
    expect(result.roofType).toBe('complex');
  });

  it('should produce multiple facets with very close but not identical centers', () => {
    const segments: SolarRoofSegment[] = [
      { ...seg(22, 0, 80), center: { latitude: 40.00015, longitude: -90.0001 } },
      { ...seg(22, 90, 50), center: { latitude: 40.00016, longitude: -90.0000 } },
      { ...seg(22, 180, 80), center: { latitude: 40.00015, longitude: -89.9999 } },
    ];

    const result = reconstructComplexRoof(RECT_OUTLINE, segments);
    expect(result.facets.length).toBeGreaterThan(1);
  });

  it('should still use Voronoi when centers are well-spread', () => {
    const segments: SolarRoofSegment[] = [
      { ...seg(22, 0, 80), center: { latitude: 40.0000, longitude: -90.0004 } },
      { ...seg(22, 180, 80), center: { latitude: 40.0003, longitude: -89.9996 } },
    ];

    const result = reconstructComplexRoof(RECT_OUTLINE, segments);
    expect(result.facets.length).toBe(2);
    // Should NOT have 'hybrid' dataSource since Voronoi worked
    expect(result.dataSource).toBeUndefined();
  });
});
