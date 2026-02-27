import { describe, it, expect, vi } from 'vitest';
import { isModelAvailable } from '../../server/ml/inference';

describe('mlInference', () => {
  describe('isModelAvailable', () => {
    it('returns availability status', () => {
      const status = isModelAvailable();

      // Should return an object with expected shape
      expect(status).toHaveProperty('available');
      expect(status).toHaveProperty('modelVersion');
      expect(typeof status.available).toBe('boolean');

      // Without onnxruntime-node installed, should be unavailable
      if (!status.available) {
        expect(status.reason).toBeDefined();
        expect(typeof status.reason).toBe('string');
      }
    });

    it('reports missing dependencies', () => {
      const status = isModelAvailable();

      // In test environment, onnxruntime-node and sharp are likely not installed
      if (!status.available) {
        expect(status.reason).toMatch(/not installed|not found/i);
      }
    });
  });
});
