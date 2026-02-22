import { describe, it, expect } from 'vitest';
import {
  calculateWallArea,
  calculateOpeningArea,
  calculateNetWallArea,
  calculateWallSegment,
  calculateWallSummary,
  estimateSidingMaterials,
  STANDARD_OPENINGS,
  type WallOpening,
  type WallSegment,
} from '../../src/utils/wallCalculations';

describe('Wall Calculations', () => {
  describe('STANDARD_OPENINGS', () => {
    it('should have standard window sizes', () => {
      expect(STANDARD_OPENINGS['window-standard']).toEqual({ widthFt: 3, heightFt: 4 });
      expect(STANDARD_OPENINGS['window-small']).toEqual({ widthFt: 2.5, heightFt: 3 });
      expect(STANDARD_OPENINGS['window-large']).toEqual({ widthFt: 4, heightFt: 5 });
    });

    it('should have standard door sizes', () => {
      expect(STANDARD_OPENINGS['door-standard']).toEqual({ widthFt: 3, heightFt: 6.67 });
      expect(STANDARD_OPENINGS['door-double']).toEqual({ widthFt: 6, heightFt: 6.67 });
    });

    it('should have garage door sizes', () => {
      expect(STANDARD_OPENINGS['garage-single']).toEqual({ widthFt: 9, heightFt: 7 });
      expect(STANDARD_OPENINGS['garage-double']).toEqual({ widthFt: 16, heightFt: 7 });
    });
  });

  describe('calculateWallArea', () => {
    it('should calculate area correctly', () => {
      expect(calculateWallArea(20, 10)).toBe(200);
    });

    it('should return 0 for zero dimensions', () => {
      expect(calculateWallArea(0, 10)).toBe(0);
      expect(calculateWallArea(20, 0)).toBe(0);
    });

    it('should clamp negative values to 0', () => {
      expect(calculateWallArea(-5, 10)).toBe(0);
    });
  });

  describe('calculateOpeningArea', () => {
    it('should calculate opening area correctly', () => {
      expect(calculateOpeningArea(3, 4)).toBe(12);
    });

    it('should return 0 for zero dimensions', () => {
      expect(calculateOpeningArea(0, 4)).toBe(0);
    });

    it('should clamp negative values to 0', () => {
      expect(calculateOpeningArea(-3, 4)).toBe(0);
    });
  });

  describe('calculateNetWallArea', () => {
    it('should subtract openings from gross area', () => {
      const openings: WallOpening[] = [
        { id: '1', type: 'window', widthFt: 3, heightFt: 4, areaSqFt: 12 },
        { id: '2', type: 'door', widthFt: 3, heightFt: 6.67, areaSqFt: 20.01 },
      ];
      expect(calculateNetWallArea(200, openings)).toBeCloseTo(167.99, 1);
    });

    it('should return gross area when no openings', () => {
      expect(calculateNetWallArea(200, [])).toBe(200);
    });

    it('should not go below 0', () => {
      const openings: WallOpening[] = [
        { id: '1', type: 'window', widthFt: 100, heightFt: 100, areaSqFt: 10000 },
      ];
      expect(calculateNetWallArea(200, openings)).toBe(0);
    });
  });

  describe('calculateWallSegment', () => {
    it('should calculate a complete wall segment', () => {
      const openings: WallOpening[] = [
        { id: 'w1', type: 'window', widthFt: 3, heightFt: 4, areaSqFt: 12 },
      ];
      const segment = calculateWallSegment('s1', 'Front Wall', 30, 9, openings);

      expect(segment.id).toBe('s1');
      expect(segment.name).toBe('Front Wall');
      expect(segment.lengthFt).toBe(30);
      expect(segment.heightFt).toBe(9);
      expect(segment.grossAreaSqFt).toBe(270);
      expect(segment.netAreaSqFt).toBe(258);
      expect(segment.openings).toHaveLength(1);
    });

    it('should handle segment with no openings', () => {
      const segment = calculateWallSegment('s2', 'Side Wall', 20, 9, []);
      expect(segment.grossAreaSqFt).toBe(180);
      expect(segment.netAreaSqFt).toBe(180);
    });
  });

  describe('calculateWallSummary', () => {
    const segments: WallSegment[] = [
      {
        id: 's1', name: 'Front', lengthFt: 40, heightFt: 9, grossAreaSqFt: 360,
        openings: [
          { id: 'w1', type: 'window', widthFt: 3, heightFt: 4, areaSqFt: 12 },
          { id: 'w2', type: 'window', widthFt: 3, heightFt: 4, areaSqFt: 12 },
          { id: 'd1', type: 'door', widthFt: 3, heightFt: 7, areaSqFt: 21 },
        ],
        netAreaSqFt: 315,
      },
      {
        id: 's2', name: 'Back', lengthFt: 40, heightFt: 9, grossAreaSqFt: 360,
        openings: [
          { id: 'w3', type: 'window', widthFt: 4, heightFt: 5, areaSqFt: 20 },
          { id: 'gd1', type: 'garage-door', widthFt: 16, heightFt: 7, areaSqFt: 112 },
        ],
        netAreaSqFt: 228,
      },
      {
        id: 's3', name: 'Left', lengthFt: 30, heightFt: 9, grossAreaSqFt: 270,
        openings: [],
        netAreaSqFt: 270,
      },
    ];

    it('should count total wall segments', () => {
      const summary = calculateWallSummary(segments);
      expect(summary.totalWallSegments).toBe(3);
    });

    it('should sum gross areas', () => {
      const summary = calculateWallSummary(segments);
      expect(summary.totalGrossAreaSqFt).toBe(990);
    });

    it('should sum net areas', () => {
      const summary = calculateWallSummary(segments);
      expect(summary.totalNetAreaSqFt).toBe(813);
    });

    it('should count openings by type', () => {
      const summary = calculateWallSummary(segments);
      expect(summary.totalWindowCount).toBe(3);
      expect(summary.totalDoorCount).toBe(1);
      expect(summary.totalGarageDoorCount).toBe(1);
    });

    it('should calculate siding squares', () => {
      const summary = calculateWallSummary(segments);
      expect(summary.sidingSquares).toBe(8.1); // 813 / 100 rounded to 1 decimal
    });

    it('should calculate opening area total', () => {
      const summary = calculateWallSummary(segments);
      expect(summary.totalOpeningsAreaSqFt).toBe(177); // 12+12+21+20+112
    });

    it('should handle empty segments array', () => {
      const summary = calculateWallSummary([]);
      expect(summary.totalWallSegments).toBe(0);
      expect(summary.totalGrossAreaSqFt).toBe(0);
      expect(summary.totalNetAreaSqFt).toBe(0);
      expect(summary.sidingSquares).toBe(0);
    });
  });

  describe('estimateSidingMaterials', () => {
    it('should estimate materials with waste factor', () => {
      const summary = calculateWallSummary([
        {
          id: 's1', name: 'Test', lengthFt: 100, heightFt: 10, grossAreaSqFt: 1000,
          openings: [], netAreaSqFt: 1000,
        },
      ]);
      const materials = estimateSidingMaterials(summary);

      // 1000 * 1.10 / 100 = 11 squares
      expect(materials.vinylSidingSquares).toBe(11);
      expect(materials.hardiePlankSquares).toBe(11);
    });

    it('should estimate trim based on openings', () => {
      const summary = {
        totalWallSegments: 1,
        totalGrossAreaSqFt: 500,
        totalOpeningsAreaSqFt: 50,
        totalNetAreaSqFt: 450,
        totalWindowCount: 4,
        totalDoorCount: 2,
        totalGarageDoorCount: 0,
        sidingSquares: 4.5,
      };
      const materials = estimateSidingMaterials(summary);

      // jChannelLf: 4*12 + 2*20 = 88
      expect(materials.jChannelLf).toBe(88);
      // trimCoilRolls: ceil((4+2)/4) = 2
      expect(materials.trimCoilRolls).toBe(2);
    });

    it('should handle zero area', () => {
      const summary = {
        totalWallSegments: 0,
        totalGrossAreaSqFt: 0,
        totalOpeningsAreaSqFt: 0,
        totalNetAreaSqFt: 0,
        totalWindowCount: 0,
        totalDoorCount: 0,
        totalGarageDoorCount: 0,
        sidingSquares: 0,
      };
      const materials = estimateSidingMaterials(summary);
      expect(materials.vinylSidingSquares).toBe(0);
      expect(materials.jChannelLf).toBe(0);
    });
  });
});
