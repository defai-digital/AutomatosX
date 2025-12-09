/**
 * Comprehensive tests for statistics.ts
 *
 * Tests for statistical utility functions.
 */

import { describe, it, expect } from 'vitest';
import {
  getPercentileIndex,
  getPercentile,
  getPercentiles,
  getStatistics
} from '../../../../src/shared/helpers/statistics.js';

describe('statistics', () => {
  describe('getPercentileIndex', () => {
    it('should return 0 for empty array', () => {
      expect(getPercentileIndex(0, 50)).toBe(0);
      expect(getPercentileIndex(0, 95)).toBe(0);
    });

    it('should return correct index for p50', () => {
      // For 10 elements, p50 should return index 4 (5th element)
      expect(getPercentileIndex(10, 50)).toBe(4);
    });

    it('should return correct index for p95', () => {
      // For 100 elements, p95 should return index 94
      expect(getPercentileIndex(100, 95)).toBe(94);
      // For 10 elements, p95 should return index 9
      expect(getPercentileIndex(10, 95)).toBe(9);
    });

    it('should return correct index for p99', () => {
      // For 100 elements, p99 should return index 98
      expect(getPercentileIndex(100, 99)).toBe(98);
    });

    it('should clamp percentile to valid range', () => {
      // Negative percentile should be clamped to 0
      expect(getPercentileIndex(10, -10)).toBe(0);
      // Percentile > 100 should be clamped to 100
      expect(getPercentileIndex(10, 150)).toBe(9);
    });

    it('should handle p0 (minimum)', () => {
      expect(getPercentileIndex(10, 0)).toBe(0);
    });

    it('should handle p100 (maximum)', () => {
      expect(getPercentileIndex(10, 100)).toBe(9);
    });

    it('should handle single element array', () => {
      expect(getPercentileIndex(1, 50)).toBe(0);
      expect(getPercentileIndex(1, 0)).toBe(0);
      expect(getPercentileIndex(1, 100)).toBe(0);
    });

    it('should handle small arrays correctly', () => {
      // For 5 elements
      expect(getPercentileIndex(5, 50)).toBe(2); // Middle element
      expect(getPercentileIndex(5, 80)).toBe(3);
      expect(getPercentileIndex(5, 20)).toBe(0);
    });
  });

  describe('getPercentile', () => {
    it('should return default value for empty array', () => {
      expect(getPercentile([], 50)).toBe(0);
      expect(getPercentile([], 95, 100)).toBe(100);
    });

    it('should return correct percentile value', () => {
      const sortedArray = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

      expect(getPercentile(sortedArray, 50)).toBe(50);
      expect(getPercentile(sortedArray, 10)).toBe(10);
      expect(getPercentile(sortedArray, 90)).toBe(90);
    });

    it('should return p95 correctly', () => {
      const sortedArray = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      expect(getPercentile(sortedArray, 95)).toBe(100);
    });

    it('should return p99 correctly', () => {
      const sortedArray = Array.from({ length: 100 }, (_, i) => i + 1);
      expect(getPercentile(sortedArray, 99)).toBe(99);
    });

    it('should handle single element array', () => {
      expect(getPercentile([42], 50)).toBe(42);
      expect(getPercentile([42], 0)).toBe(42);
      expect(getPercentile([42], 100)).toBe(42);
    });

    it('should return default value when index out of bounds', () => {
      // This tests the fallback in case of edge cases
      const arr = [1, 2, 3];
      expect(getPercentile(arr, 0, 999)).toBe(1);
    });
  });

  describe('getPercentiles', () => {
    it('should return default values for empty array', () => {
      const result = getPercentiles([], [50, 95, 99]);

      expect(result.p50).toBe(0);
      expect(result.p95).toBe(0);
      expect(result.p99).toBe(0);
    });

    it('should return default values with custom default', () => {
      const result = getPercentiles([], [50, 95], -1);

      expect(result.p50).toBe(-1);
      expect(result.p95).toBe(-1);
    });

    it('should calculate multiple percentiles correctly', () => {
      const sortedArray = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const result = getPercentiles(sortedArray, [50, 90, 95]);

      expect(result.p50).toBe(50);
      expect(result.p90).toBe(90);
      expect(result.p95).toBe(100);
    });

    it('should handle single percentile', () => {
      const sortedArray = [1, 2, 3, 4, 5];
      const result = getPercentiles(sortedArray, [50]);

      expect(result.p50).toBe(3);
    });

    it('should handle many percentiles', () => {
      const sortedArray = Array.from({ length: 100 }, (_, i) => i + 1);
      const result = getPercentiles(sortedArray, [10, 25, 50, 75, 90, 95, 99]);

      expect(result.p10).toBe(10);
      expect(result.p25).toBe(25);
      expect(result.p50).toBe(50);
      expect(result.p75).toBe(75);
      expect(result.p90).toBe(90);
      expect(result.p95).toBe(95);
      expect(result.p99).toBe(99);
    });
  });

  describe('getStatistics', () => {
    it('should return zeros for empty array', () => {
      const result = getStatistics([]);

      expect(result.min).toBe(0);
      expect(result.max).toBe(0);
      expect(result.avg).toBe(0);
      expect(result.median).toBe(0);
      expect(result.p95).toBe(0);
      expect(result.p99).toBe(0);
    });

    it('should calculate statistics correctly', () => {
      const values = [100, 200, 150, 300, 250];
      const result = getStatistics(values);

      expect(result.min).toBe(100);
      expect(result.max).toBe(300);
      expect(result.avg).toBe(200);
      expect(result.median).toBe(200); // Middle value of sorted [100, 150, 200, 250, 300]
    });

    it('should handle single element array', () => {
      const result = getStatistics([42]);

      expect(result.min).toBe(42);
      expect(result.max).toBe(42);
      expect(result.avg).toBe(42);
      expect(result.median).toBe(42);
      expect(result.p95).toBe(42);
      expect(result.p99).toBe(42);
    });

    it('should calculate p95 and p99 correctly', () => {
      // Create array with 100 elements for clear percentile testing
      const values = Array.from({ length: 100 }, (_, i) => i + 1);
      const result = getStatistics(values);

      expect(result.min).toBe(1);
      expect(result.max).toBe(100);
      expect(result.avg).toBe(50.5);
      expect(result.p95).toBe(95);
      expect(result.p99).toBe(99);
    });

    it('should not modify original array', () => {
      const original = [3, 1, 4, 1, 5, 9, 2, 6];
      const copy = [...original];

      getStatistics(original);

      expect(original).toEqual(copy);
    });

    it('should handle array with duplicate values', () => {
      const values = [5, 5, 5, 5, 5];
      const result = getStatistics(values);

      expect(result.min).toBe(5);
      expect(result.max).toBe(5);
      expect(result.avg).toBe(5);
      expect(result.median).toBe(5);
    });

    it('should handle array with negative values', () => {
      const values = [-10, -5, 0, 5, 10];
      const result = getStatistics(values);

      expect(result.min).toBe(-10);
      expect(result.max).toBe(10);
      expect(result.avg).toBe(0);
      expect(result.median).toBe(0);
    });

    it('should handle decimal values', () => {
      const values = [1.5, 2.5, 3.5, 4.5, 5.5];
      const result = getStatistics(values);

      expect(result.min).toBe(1.5);
      expect(result.max).toBe(5.5);
      expect(result.avg).toBe(3.5);
      expect(result.median).toBe(3.5);
    });

    it('should handle large arrays efficiently', () => {
      const values = Array.from({ length: 10000 }, () => Math.random() * 1000);

      const startTime = Date.now();
      const result = getStatistics(values);
      const duration = Date.now() - startTime;

      // Should complete quickly (< 100ms)
      expect(duration).toBeLessThan(100);
      expect(result.min).toBeGreaterThanOrEqual(0);
      expect(result.max).toBeLessThanOrEqual(1000);
    });
  });
});
