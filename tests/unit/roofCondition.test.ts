import { describe, it, expect } from 'vitest';
import {
  getExpectedLifespan,
  calculateConditionCategory,
  estimateRemainingLife,
  generateFindings,
  generateRecommendations,
} from '../../src/utils/roofCondition';
import type { RoofConditionAssessment, RoofMaterialType } from '../../src/types';

describe('Roof Condition Utilities', () => {
  describe('getExpectedLifespan', () => {
    it('should return correct lifespan for asphalt shingle', () => {
      expect(getExpectedLifespan('asphalt-shingle')).toBe(25);
    });

    it('should return correct lifespan for metal', () => {
      expect(getExpectedLifespan('metal')).toBe(50);
    });

    it('should return correct lifespan for tile', () => {
      expect(getExpectedLifespan('tile')).toBe(50);
    });

    it('should return correct lifespan for slate', () => {
      expect(getExpectedLifespan('slate')).toBe(100);
    });

    it('should return correct lifespan for wood-shake', () => {
      expect(getExpectedLifespan('wood-shake')).toBe(30);
    });

    it('should return correct lifespan for tpo', () => {
      expect(getExpectedLifespan('tpo')).toBe(25);
    });

    it('should return correct lifespan for epdm', () => {
      expect(getExpectedLifespan('epdm')).toBe(25);
    });

    it('should return correct lifespan for built-up', () => {
      expect(getExpectedLifespan('built-up')).toBe(20);
    });

    it('should return correct lifespan for concrete', () => {
      expect(getExpectedLifespan('concrete')).toBe(50);
    });

    it('should return default lifespan for unknown material', () => {
      expect(getExpectedLifespan('unknown')).toBe(25);
    });
  });

  describe('calculateConditionCategory', () => {
    it('should return excellent for score >= 85', () => {
      expect(calculateConditionCategory(85)).toBe('excellent');
      expect(calculateConditionCategory(100)).toBe('excellent');
      expect(calculateConditionCategory(95)).toBe('excellent');
    });

    it('should return good for score >= 70 and < 85', () => {
      expect(calculateConditionCategory(70)).toBe('good');
      expect(calculateConditionCategory(84)).toBe('good');
    });

    it('should return fair for score >= 50 and < 70', () => {
      expect(calculateConditionCategory(50)).toBe('fair');
      expect(calculateConditionCategory(69)).toBe('fair');
    });

    it('should return poor for score >= 30 and < 50', () => {
      expect(calculateConditionCategory(30)).toBe('poor');
      expect(calculateConditionCategory(49)).toBe('poor');
    });

    it('should return critical for score < 30', () => {
      expect(calculateConditionCategory(29)).toBe('critical');
      expect(calculateConditionCategory(0)).toBe('critical');
      expect(calculateConditionCategory(10)).toBe('critical');
    });
  });

  describe('estimateRemainingLife', () => {
    it('should estimate remaining life correctly for healthy roof', () => {
      // 25-year lifespan, 5 years old, score 80 -> (25-5)*0.8 = 16
      expect(estimateRemainingLife('asphalt-shingle', 5, 80)).toBe(16);
    });

    it('should return 0 for roof past its lifespan', () => {
      expect(estimateRemainingLife('asphalt-shingle', 30, 50)).toBe(0);
    });

    it('should return 0 for poor condition old roof', () => {
      expect(estimateRemainingLife('built-up', 20, 10)).toBe(0);
    });

    it('should handle perfect condition', () => {
      // 50-year lifespan, 10 years old, score 100 -> (50-10)*1.0 = 40
      expect(estimateRemainingLife('metal', 10, 100)).toBe(40);
    });

    it('should handle zero age', () => {
      // 25-year lifespan, 0 years old, score 100 -> 25*1.0 = 25
      expect(estimateRemainingLife('asphalt-shingle', 0, 100)).toBe(25);
    });

    it('should handle slate with long lifespan', () => {
      // 100-year lifespan, 50 years old, score 70 -> (100-50)*0.7 = 35
      expect(estimateRemainingLife('slate', 50, 70)).toBe(35);
    });
  });

  describe('generateFindings', () => {
    it('should generate excellent finding for high score', () => {
      const findings = generateFindings({ overallScore: 90 });
      expect(findings).toContain('Roof is in excellent overall condition');
    });

    it('should generate good finding for score 70-84', () => {
      const findings = generateFindings({ overallScore: 75 });
      expect(findings).toContain('Roof is in good condition with minor wear');
    });

    it('should generate fair finding for score 50-69', () => {
      const findings = generateFindings({ overallScore: 55 });
      expect(findings).toContain('Roof shows moderate wear and aging');
    });

    it('should generate poor finding for score 30-49', () => {
      const findings = generateFindings({ overallScore: 35 });
      expect(findings).toContain('Roof shows significant deterioration');
    });

    it('should generate critical finding for low score', () => {
      const findings = generateFindings({ overallScore: 20 });
      expect(findings).toContain('Roof is in critical condition requiring immediate attention');
    });

    it('should note approaching end of lifespan', () => {
      const findings = generateFindings({
        overallScore: 50,
        materialType: 'asphalt-shingle',
        estimatedAgeYears: 22, // > 25 * 0.8 = 20
      });
      expect(findings.some(f => f.includes('approaching end of expected'))).toBe(true);
    });

    it('should note exceeded lifespan', () => {
      const findings = generateFindings({
        overallScore: 40,
        materialType: 'asphalt-shingle',
        estimatedAgeYears: 30, // > 25
      });
      expect(findings.some(f => f.includes('exceeded its expected lifespan'))).toBe(true);
    });

    it('should note severe damage areas', () => {
      const findings = generateFindings({
        overallScore: 40,
        damageDetected: [
          { type: 'hail', severity: 'severe', description: 'Impact marks', location: 'north' },
          { type: 'wind', severity: 'severe', description: 'Lifted shingles', location: 'south' },
        ],
      });
      expect(findings.some(f => f.includes('2 severe damage area(s) detected'))).toBe(true);
    });

    it('should not note mild damage as severe', () => {
      const findings = generateFindings({
        overallScore: 60,
        damageDetected: [
          { type: 'wear', severity: 'mild', description: 'Normal wear', location: 'all' },
        ],
      });
      expect(findings.some(f => f.includes('severe'))).toBe(false);
    });

    it('should use defaults when fields are missing', () => {
      const findings = generateFindings({});
      expect(findings.length).toBeGreaterThan(0);
      // Score defaults to 0 -> critical
      expect(findings).toContain('Roof is in critical condition requiring immediate attention');
    });
  });

  describe('generateRecommendations', () => {
    it('should recommend maintenance for excellent condition', () => {
      const recs = generateRecommendations({ overallScore: 90 });
      expect(recs).toContain('Continue regular maintenance schedule');
      expect(recs).toContain('Schedule inspection in 2-3 years');
    });

    it('should recommend minor repairs for good condition', () => {
      const recs = generateRecommendations({ overallScore: 75 });
      expect(recs).toContain('Address minor repairs within 6 months');
      expect(recs).toContain('Schedule annual inspections');
    });

    it('should recommend professional inspection for fair condition', () => {
      const recs = generateRecommendations({ overallScore: 55 });
      expect(recs).toContain('Professional inspection recommended within 30 days');
    });

    it('should recommend urgent inspection for poor condition', () => {
      const recs = generateRecommendations({ overallScore: 35 });
      expect(recs).toContain('Urgent professional inspection required');
      expect(recs).toContain('Begin planning roof replacement');
    });

    it('should recommend immediate action for critical condition', () => {
      const recs = generateRecommendations({ overallScore: 15 });
      expect(recs).toContain('Immediate professional evaluation required');
      expect(recs).toContain('Roof replacement should be prioritized');
      expect(recs).toContain('Check for interior water damage');
    });

    it('should recommend replacement when remaining life is low', () => {
      const recs = generateRecommendations({ overallScore: 55, estimatedRemainingLifeYears: 1 });
      expect(recs).toContain('Consider replacement within 1-2 years');
    });

    it('should note exceeded useful life', () => {
      const recs = generateRecommendations({ overallScore: 40, estimatedRemainingLifeYears: 0 });
      expect(recs).toContain('Roof has exceeded useful life - replacement recommended');
    });

    it('should recommend hail insurance claim', () => {
      const recs = generateRecommendations({
        overallScore: 50,
        damageDetected: [{ type: 'hail', severity: 'moderate', description: '', location: '' }],
      });
      expect(recs).toContain('File insurance claim for hail damage');
    });

    it('should recommend wind damage repair', () => {
      const recs = generateRecommendations({
        overallScore: 50,
        damageDetected: [{ type: 'wind', severity: 'moderate', description: '', location: '' }],
      });
      expect(recs).toContain('Repair wind-damaged sections before next storm');
    });
  });
});
