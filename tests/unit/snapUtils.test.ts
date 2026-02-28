import { describe, it, expect } from 'vitest';
import { pointToSegmentDistSq } from '../../src/utils/snapUtils';

describe('pointToSegmentDistSq', () => {
  it('returns correct t and distance for perpendicular projection at midpoint', () => {
    // Segment from (0,0) to (10,0), point at (5,3)
    const result = pointToSegmentDistSq(5, 3, 0, 0, 10, 0);
    expect(result.t).toBeCloseTo(0.5, 5);
    expect(result.distSq).toBeCloseTo(9, 5); // distance = 3, distSq = 9
  });

  it('returns t=0 when closest point is the start', () => {
    // Segment from (0,0) to (10,0), point at (-2,0)
    const result = pointToSegmentDistSq(-2, 0, 0, 0, 10, 0);
    expect(result.t).toBe(0);
    expect(result.distSq).toBeCloseTo(4, 5); // distance = 2
  });

  it('returns t=1 when closest point is the end', () => {
    // Segment from (0,0) to (10,0), point at (12,0)
    const result = pointToSegmentDistSq(12, 0, 0, 0, 10, 0);
    expect(result.t).toBe(1);
    expect(result.distSq).toBeCloseTo(4, 5); // distance = 2
  });

  it('handles zero-length segments', () => {
    // Segment from (5,5) to (5,5), point at (8,5)
    const result = pointToSegmentDistSq(8, 5, 5, 5, 5, 5);
    expect(result.t).toBe(0);
    expect(result.distSq).toBeCloseTo(9, 5); // distance = 3
  });

  it('returns exact distance for perpendicular projection', () => {
    // Segment from (0,0) to (0,10), point at (4,5) — perpendicular distance = 4
    const result = pointToSegmentDistSq(4, 5, 0, 0, 0, 10);
    expect(result.t).toBeCloseTo(0.5, 5);
    expect(Math.sqrt(result.distSq)).toBeCloseTo(4, 5);
  });

  it('handles diagonal segments', () => {
    // Segment from (0,0) to (10,10), point at (0,10) — closest is (5,5)
    const result = pointToSegmentDistSq(0, 10, 0, 0, 10, 10);
    expect(result.t).toBeCloseTo(0.5, 5);
    // Distance from (0,10) to (5,5) = sqrt(25+25) = sqrt(50)
    expect(result.distSq).toBeCloseTo(50, 5);
  });

  it('returns t between 0 and 1 for points projecting onto the segment interior', () => {
    // Segment from (0,0) to (100,0), point at (25,10)
    const result = pointToSegmentDistSq(25, 10, 0, 0, 100, 0);
    expect(result.t).toBeCloseTo(0.25, 5);
    expect(result.distSq).toBeCloseTo(100, 5); // distance = 10
  });

  it('clamps t to [0,1] for points beyond end', () => {
    // Point beyond end of segment
    const result = pointToSegmentDistSq(200, 0, 0, 0, 100, 0);
    expect(result.t).toBe(1);
    expect(result.distSq).toBeCloseTo(10000, 5); // distance = 100
  });
});
