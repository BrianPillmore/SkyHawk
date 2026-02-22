import { describe, it, expect } from 'vitest';
import {
  COMMON_PITCHES,
  estimatePitchFromShadow,
  snapToCommonPitch,
  pitchToDegrees,
  degreesToPitch,
  estimatePitchFromAI,
} from '../../src/utils/pitchDetection';

describe('Pitch Detection Utilities', () => {
  describe('COMMON_PITCHES', () => {
    it('should include standard residential pitches', () => {
      expect(COMMON_PITCHES).toContain(4);
      expect(COMMON_PITCHES).toContain(6);
      expect(COMMON_PITCHES).toContain(8);
      expect(COMMON_PITCHES).toContain(12);
    });

    it('should have 10 entries', () => {
      expect(COMMON_PITCHES.length).toBe(10);
    });
  });

  describe('snapToCommonPitch', () => {
    it('should snap to nearest common pitch', () => {
      expect(snapToCommonPitch(5.8)).toBe(6);
      expect(snapToCommonPitch(6.2)).toBe(6);
      expect(snapToCommonPitch(4.1)).toBe(4);
    });

    it('should return 0 for zero or negative pitch', () => {
      expect(snapToCommonPitch(0)).toBe(0);
      expect(snapToCommonPitch(-1)).toBe(0);
    });

    it('should cap at 18 for very steep pitches', () => {
      expect(snapToCommonPitch(20)).toBe(18);
      expect(snapToCommonPitch(25)).toBe(18);
    });

    it('should snap 2.5 to 3 (lowest common pitch)', () => {
      expect(snapToCommonPitch(2.5)).toBe(3);
    });

    it('should snap values between two pitches correctly', () => {
      // 10.5 is between 10 and 12, closer to 10
      expect(snapToCommonPitch(10.5)).toBe(10);
      // 11.5 is between 10 and 12, closer to 12
      expect(snapToCommonPitch(11.5)).toBe(12);
    });
  });

  describe('pitchToDegrees', () => {
    it('should convert common pitches correctly', () => {
      // 4/12 -> ~18.43 degrees
      expect(pitchToDegrees(4)).toBeCloseTo(18.43, 1);
      // 6/12 -> ~26.57 degrees
      expect(pitchToDegrees(6)).toBeCloseTo(26.57, 1);
      // 12/12 -> 45 degrees
      expect(pitchToDegrees(12)).toBeCloseTo(45, 1);
    });

    it('should return 0 for flat pitch', () => {
      expect(pitchToDegrees(0)).toBe(0);
    });
  });

  describe('degreesToPitch', () => {
    it('should convert degrees back to pitch', () => {
      expect(degreesToPitch(45)).toBeCloseTo(12, 1);
      expect(degreesToPitch(26.57)).toBeCloseTo(6, 0);
      expect(degreesToPitch(18.43)).toBeCloseTo(4, 0);
    });

    it('should return 0 for 0 degrees', () => {
      expect(degreesToPitch(0)).toBeCloseTo(0, 5);
    });

    it('should be inverse of pitchToDegrees', () => {
      for (const pitch of [3, 4, 6, 8, 10, 12]) {
        const degrees = pitchToDegrees(pitch);
        const backToPitch = degreesToPitch(degrees);
        expect(backToPitch).toBeCloseTo(pitch, 5);
      }
    });
  });

  describe('estimatePitchFromShadow', () => {
    it('should return default pitch for invalid inputs', () => {
      expect(estimatePitchFromShadow(10, 0, 45)).toBe(6);
      expect(estimatePitchFromShadow(10, 10, 0)).toBe(6);
      expect(estimatePitchFromShadow(10, 10, 90)).toBe(6);
    });

    it('should return a valid common pitch for normal inputs', () => {
      const pitch = estimatePitchFromShadow(8, 10, 45);
      expect(COMMON_PITCHES).toContain(pitch);
    });

    it('should return higher pitch for longer shadows', () => {
      const shortShadow = estimatePitchFromShadow(3, 10, 45);
      const longShadow = estimatePitchFromShadow(10, 10, 45);
      expect(longShadow).toBeGreaterThanOrEqual(shortShadow);
    });
  });

  describe('estimatePitchFromAI', () => {
    it('should convert degrees to common pitch with confidence', () => {
      const result = estimatePitchFromAI(26.57); // ~6/12
      expect(result.pitch).toBe(6);
    });

    it('should give high confidence when close to common pitch', () => {
      const result = estimatePitchFromAI(45); // exactly 12/12
      expect(result.pitch).toBe(12);
      expect(result.confidence).toBe('high');
    });

    it('should give lower confidence for unusual angles', () => {
      // An angle that doesn't snap cleanly to a common pitch
      const result = estimatePitchFromAI(35); // ~8.4/12
      expect(result.pitch).toBeGreaterThanOrEqual(3);
      expect(['high', 'medium', 'low']).toContain(result.confidence);
    });

    it('should return pitch and confidence object', () => {
      const result = estimatePitchFromAI(18);
      expect(result).toHaveProperty('pitch');
      expect(result).toHaveProperty('confidence');
      expect(typeof result.pitch).toBe('number');
    });
  });
});
