/**
 * Unit tests for store roof condition actions.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../src/store/useStore';
import { resetStore } from '../helpers/store';
import { createRoofCondition } from '../helpers/fixtures';

describe('Store Roof Condition', () => {
  beforeEach(() => {
    resetStore();
  });

  it('should start with null roofCondition', () => {
    expect(useStore.getState().roofCondition).toBeNull();
  });

  it('should set roof condition', () => {
    const condition = createRoofCondition({ overallScore: 85 });
    useStore.getState().setRoofCondition(condition);
    expect(useStore.getState().roofCondition).toBeDefined();
    expect(useStore.getState().roofCondition!.overallScore).toBe(85);
  });

  it('should clear roof condition', () => {
    useStore.getState().setRoofCondition(createRoofCondition());
    expect(useStore.getState().roofCondition).not.toBeNull();
    useStore.getState().clearRoofCondition();
    expect(useStore.getState().roofCondition).toBeNull();
  });

  it('should persist all condition fields', () => {
    const condition = createRoofCondition({
      overallScore: 65,
      category: 'fair',
      estimatedAgeYears: 18,
      estimatedRemainingLifeYears: 7,
      materialType: 'metal',
      materialConfidence: 0.92,
      findings: ['Rust spots', 'Loose fasteners'],
      recommendations: ['Apply sealant', 'Tighten fasteners'],
      damageDetected: [
        { type: 'wind', severity: 'moderate', description: 'Panel lifted', confidence: 0.8 },
      ],
    });

    useStore.getState().setRoofCondition(condition);
    const stored = useStore.getState().roofCondition!;

    expect(stored.overallScore).toBe(65);
    expect(stored.category).toBe('fair');
    expect(stored.estimatedAgeYears).toBe(18);
    expect(stored.estimatedRemainingLifeYears).toBe(7);
    expect(stored.materialType).toBe('metal');
    expect(stored.materialConfidence).toBe(0.92);
    expect(stored.findings).toHaveLength(2);
    expect(stored.recommendations).toHaveLength(2);
    expect(stored.damageDetected).toHaveLength(1);
    expect(stored.damageDetected[0].type).toBe('wind');
  });

  it('should replace existing condition', () => {
    useStore.getState().setRoofCondition(createRoofCondition({ overallScore: 90 }));
    useStore.getState().setRoofCondition(createRoofCondition({ overallScore: 50, category: 'poor' }));

    const stored = useStore.getState().roofCondition!;
    expect(stored.overallScore).toBe(50);
    expect(stored.category).toBe('poor');
  });

  it('should handle extreme score values', () => {
    useStore.getState().setRoofCondition(createRoofCondition({ overallScore: 1, category: 'critical' }));
    expect(useStore.getState().roofCondition!.overallScore).toBe(1);

    useStore.getState().setRoofCondition(createRoofCondition({ overallScore: 100, category: 'excellent' }));
    expect(useStore.getState().roofCondition!.overallScore).toBe(100);
  });

  it('should preserve assessedAt timestamp', () => {
    const ts = '2025-06-15T12:00:00.000Z';
    useStore.getState().setRoofCondition(createRoofCondition({ assessedAt: ts }));
    expect(useStore.getState().roofCondition!.assessedAt).toBe(ts);
  });

  it('should handle empty arrays', () => {
    useStore.getState().setRoofCondition(createRoofCondition({
      findings: [],
      recommendations: [],
      damageDetected: [],
    }));

    const stored = useStore.getState().roofCondition!;
    expect(stored.findings).toHaveLength(0);
    expect(stored.recommendations).toHaveLength(0);
    expect(stored.damageDetected).toHaveLength(0);
  });

  it('should handle multiple damage entries', () => {
    useStore.getState().setRoofCondition(createRoofCondition({
      damageDetected: [
        { type: 'hail', severity: 'minor', description: 'Small dents', confidence: 0.7 },
        { type: 'wind', severity: 'severe', description: 'Torn shingles', confidence: 0.95 },
        { type: 'missing-shingle', severity: 'moderate', description: 'Multiple missing', confidence: 0.88 },
      ],
    }));

    expect(useStore.getState().roofCondition!.damageDetected).toHaveLength(3);
  });

  it('clearRoofCondition should be idempotent', () => {
    useStore.getState().clearRoofCondition();
    expect(useStore.getState().roofCondition).toBeNull();
    useStore.getState().clearRoofCondition();
    expect(useStore.getState().roofCondition).toBeNull();
  });
});
