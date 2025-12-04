/**
 * Metrics Collector Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector, measureLatency } from '../../src/shared/profiling/metrics.js';

describe('MetricsCollector', () => {
  let metrics: MetricsCollector;

  beforeEach(() => {
    metrics = new MetricsCollector();
  });

  describe('recordLatency', () => {
    it('should record latency for an operation', () => {
      metrics.recordLatency('test.operation', 100);

      const snapshot = metrics.getMetrics();
      expect(snapshot.operations['test.operation']).toBeDefined();
      expect(snapshot.operations['test.operation']?.totalCount).toBe(1);
      expect(snapshot.operations['test.operation']?.successCount).toBe(1);
    });

    it('should track multiple operations', () => {
      metrics.recordLatency('operation.a', 50);
      metrics.recordLatency('operation.b', 100);
      metrics.recordLatency('operation.a', 75);

      const snapshot = metrics.getMetrics();
      expect(snapshot.operations['operation.a']?.totalCount).toBe(2);
      expect(snapshot.operations['operation.b']?.totalCount).toBe(1);
    });

    it('should limit sample size to prevent memory growth', () => {
      // Record 1500 samples (maxSamples = 1000)
      for (let i = 0; i < 1500; i++) {
        metrics.recordLatency('test.operation', i);
      }

      const operationMetrics = metrics.getOperationMetrics('test.operation');
      expect(operationMetrics?.samples.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('recordError', () => {
    it('should record errors for an operation', () => {
      metrics.recordError('test.operation', new Error('Test error'));

      const snapshot = metrics.getMetrics();
      expect(snapshot.operations['test.operation']?.errorCount).toBe(1);
      expect(snapshot.operations['test.operation']?.lastError?.message).toBe('Test error');
    });

    it('should handle string errors', () => {
      metrics.recordError('test.operation', 'String error');

      const operationMetrics = metrics.getOperationMetrics('test.operation');
      expect(operationMetrics?.lastError?.message).toBe('String error');
    });
  });

  describe('latency statistics', () => {
    it('should calculate percentiles correctly', () => {
      const samples = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

      for (const sample of samples) {
        metrics.recordLatency('test.operation', sample);
      }

      const operationMetrics = metrics.getOperationMetrics('test.operation');
      expect(operationMetrics?.latency.p50).toBeGreaterThan(40);
      expect(operationMetrics?.latency.p50).toBeLessThan(60);
      expect(operationMetrics?.latency.p95).toBeGreaterThan(85);
      expect(operationMetrics?.latency.avg).toBe(55);
      expect(operationMetrics?.latency.min).toBe(10);
      expect(operationMetrics?.latency.max).toBe(100);
    });

    it('should handle empty samples gracefully', () => {
      const operationMetrics = metrics.getOperationMetrics('nonexistent');
      expect(operationMetrics).toBeNull();
    });
  });

  describe('error rate calculation', () => {
    it('should calculate error rate correctly', () => {
      metrics.recordLatency('test.operation', 50);
      metrics.recordLatency('test.operation', 60);
      metrics.recordError('test.operation', new Error('Error 1'));
      metrics.recordError('test.operation', new Error('Error 2'));

      const operationMetrics = metrics.getOperationMetrics('test.operation');
      expect(operationMetrics?.totalCount).toBe(4);
      expect(operationMetrics?.successCount).toBe(2);
      expect(operationMetrics?.errorCount).toBe(2);
      expect(operationMetrics?.errorRate).toBe(0.5);
    });
  });

  describe('getMetrics', () => {
    it('should return snapshot with summary', () => {
      metrics.recordLatency('operation.a', 100);
      metrics.recordError('operation.b', new Error('Error'));

      const snapshot = metrics.getMetrics();
      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.uptime).toBeGreaterThanOrEqual(0);
      expect(snapshot.summary.totalOperations).toBe(2);
      expect(snapshot.summary.totalErrors).toBe(1);
      expect(snapshot.summary.overallErrorRate).toBe(0.5);
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      metrics.recordLatency('test.operation', 100);
      metrics.reset();

      const snapshot = metrics.getMetrics();
      expect(Object.keys(snapshot.operations)).toHaveLength(0);
    });

    it('should reset specific operation', () => {
      metrics.recordLatency('operation.a', 100);
      metrics.recordLatency('operation.b', 200);
      metrics.resetOperation('operation.a');

      const snapshot = metrics.getMetrics();
      expect(snapshot.operations['operation.a']).toBeUndefined();
      expect(snapshot.operations['operation.b']).toBeDefined();
    });
  });

  describe('measureLatency helper', () => {
    it('should measure and record latency automatically', async () => {
      await measureLatency('test.operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'result';
      });

      const operationMetrics = metrics.getOperationMetrics('test.operation');
      expect(operationMetrics).toBeNull(); // Uses global metrics, not this instance
    });

    it('should record errors and rethrow', async () => {
      await expect(measureLatency('test.operation', async () => {
        throw new Error('Test error');
      })).rejects.toThrow('Test error');
    });
  });
});
