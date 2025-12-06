/**
 * RequestCoalescer Unit Tests
 *
 * Tests for request coalescing and deduplication functionality.
 *
 * Part of Phase 3: Scaling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RequestCoalescer,
  createRequestCoalescer,
  generateCoalesceKey
} from '@/core/task-engine/request-coalescer';

describe('RequestCoalescer', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  describe('generateCoalesceKey', () => {
    it('should generate consistent keys for same inputs', () => {
      const key1 = generateCoalesceKey('search', { query: 'test' });
      const key2 = generateCoalesceKey('search', { query: 'test' });

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different types', () => {
      const key1 = generateCoalesceKey('search', { query: 'test' });
      const key2 = generateCoalesceKey('analyze', { query: 'test' });

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different payloads', () => {
      const key1 = generateCoalesceKey('search', { query: 'foo' });
      const key2 = generateCoalesceKey('search', { query: 'bar' });

      expect(key1).not.toBe(key2);
    });

    it('should include engine in key generation', () => {
      const key1 = generateCoalesceKey('search', { query: 'test' }, 'claude');
      const key2 = generateCoalesceKey('search', { query: 'test' }, 'gemini');

      expect(key1).not.toBe(key2);
    });

    it('should use "auto" as default engine', () => {
      const key1 = generateCoalesceKey('search', { query: 'test' });
      const key2 = generateCoalesceKey('search', { query: 'test' }, 'auto');

      expect(key1).toBe(key2);
    });

    // Bug fix tests: stable key generation regardless of key order
    it('should generate same key regardless of object key order', () => {
      const key1 = generateCoalesceKey('search', { b: 2, a: 1 });
      const key2 = generateCoalesceKey('search', { a: 1, b: 2 });

      expect(key1).toBe(key2);
    });

    it('should generate same key for nested objects with different key order', () => {
      const key1 = generateCoalesceKey('search', {
        outer: { z: 3, y: 2, x: 1 },
        config: { enabled: true, name: 'test' }
      });
      const key2 = generateCoalesceKey('search', {
        config: { name: 'test', enabled: true },
        outer: { x: 1, y: 2, z: 3 }
      });

      expect(key1).toBe(key2);
    });

    it('should generate same key for deeply nested objects', () => {
      const key1 = generateCoalesceKey('analysis', {
        level1: {
          level2: {
            level3: { c: 3, b: 2, a: 1 }
          }
        }
      });
      const key2 = generateCoalesceKey('analysis', {
        level1: {
          level2: {
            level3: { a: 1, b: 2, c: 3 }
          }
        }
      });

      expect(key1).toBe(key2);
    });
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const coalescer = new RequestCoalescer();
      expect(coalescer.pendingCount).toBe(0);
    });

    it('should accept custom config', () => {
      const coalescer = new RequestCoalescer({
        maxPending: 100,
        timeoutMs: 5000,
        debug: true
      });
      expect(coalescer.pendingCount).toBe(0);
    });
  });

  describe('execute', () => {
    it('should execute a single request', async () => {
      const coalescer = new RequestCoalescer<number>();

      const result = await coalescer.execute('key-1', async () => {
        return 42;
      });

      expect(result).toBe(42);
    });

    it('should coalesce concurrent identical requests', async () => {
      const coalescer = new RequestCoalescer<number>();
      let executionCount = 0;

      const executor = async () => {
        executionCount++;
        await new Promise(r => setTimeout(r, 50));
        return 42;
      };

      // Run three concurrent requests with same key
      const [r1, r2, r3] = await Promise.all([
        coalescer.execute('same-key', executor),
        coalescer.execute('same-key', executor),
        coalescer.execute('same-key', executor)
      ]);

      // All should get same result
      expect(r1).toBe(42);
      expect(r2).toBe(42);
      expect(r3).toBe(42);

      // But only one execution
      expect(executionCount).toBe(1);
    });

    it('should not coalesce requests with different keys', async () => {
      const coalescer = new RequestCoalescer<string>();
      let executionCount = 0;

      const executor = (key: string) => async () => {
        executionCount++;
        await new Promise(r => setTimeout(r, 20));
        return key;
      };

      const [r1, r2, r3] = await Promise.all([
        coalescer.execute('key-a', executor('a')),
        coalescer.execute('key-b', executor('b')),
        coalescer.execute('key-c', executor('c'))
      ]);

      expect(r1).toBe('a');
      expect(r2).toBe('b');
      expect(r3).toBe('c');
      expect(executionCount).toBe(3);
    });

    it('should share errors with all waiters', async () => {
      const coalescer = new RequestCoalescer<number>();

      const executor = async () => {
        await new Promise(r => setTimeout(r, 20));
        throw new Error('Test error');
      };

      // All should get the same error
      await expect(Promise.all([
        coalescer.execute('error-key', executor),
        coalescer.execute('error-key', executor),
        coalescer.execute('error-key', executor)
      ])).rejects.toThrow('Test error');
    });

    it('should clean up pending entry after completion', async () => {
      const coalescer = new RequestCoalescer<number>();

      expect(coalescer.pendingCount).toBe(0);

      await coalescer.execute('cleanup-key', async () => 1);

      expect(coalescer.pendingCount).toBe(0);
    });

    it('should clean up pending entry after error', async () => {
      const coalescer = new RequestCoalescer<number>();

      try {
        await coalescer.execute('error-cleanup', async () => {
          throw new Error('Fail');
        });
      } catch {
        // Expected
      }

      expect(coalescer.pendingCount).toBe(0);
    });

    it('should execute without coalescing when at capacity', async () => {
      const coalescer = new RequestCoalescer<number>({ maxPending: 2 });
      let executionCount = 0;

      const slowExecutor = async () => {
        executionCount++;
        await new Promise(r => setTimeout(r, 100));
        return 1;
      };

      // Fill up capacity
      const pending1 = coalescer.execute('fill-1', slowExecutor);
      const pending2 = coalescer.execute('fill-2', slowExecutor);

      // This one should execute immediately without coalescing
      const pending3 = coalescer.execute('overflow', async () => {
        return 99;
      });

      const r3 = await pending3;
      expect(r3).toBe(99);

      // Clean up
      await Promise.all([pending1, pending2]);
    });
  });

  describe('isPending', () => {
    it('should return true for pending request', async () => {
      const coalescer = new RequestCoalescer<number>();

      const promise = coalescer.execute('pending-check', async () => {
        await new Promise(r => setTimeout(r, 50));
        return 1;
      });

      expect(coalescer.isPending('pending-check')).toBe(true);

      await promise;

      expect(coalescer.isPending('pending-check')).toBe(false);
    });

    it('should return false for non-existent key', () => {
      const coalescer = new RequestCoalescer();
      expect(coalescer.isPending('non-existent')).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should track statistics correctly', async () => {
      const coalescer = new RequestCoalescer<number>();

      const executor = async () => {
        await new Promise(r => setTimeout(r, 20));
        return 1;
      };

      // First batch: 3 requests, 1 execution
      await Promise.all([
        coalescer.execute('stats-1', executor),
        coalescer.execute('stats-1', executor),
        coalescer.execute('stats-1', executor)
      ]);

      // Second batch: 2 requests, 1 execution
      await Promise.all([
        coalescer.execute('stats-2', executor),
        coalescer.execute('stats-2', executor)
      ]);

      const stats = coalescer.getStats();

      expect(stats.totalRequests).toBe(5);
      expect(stats.freshExecutions).toBe(2);
      expect(stats.coalescedRequests).toBe(3);
      expect(stats.waitersSaved).toBe(3);
      expect(stats.pendingCount).toBe(0);
      expect(stats.coalesceRate).toBe(3 / 5);
    });

    it('should reset statistics', async () => {
      const coalescer = new RequestCoalescer<number>();

      await coalescer.execute('reset-test', async () => 1);

      expect(coalescer.getStats().totalRequests).toBe(1);

      coalescer.resetStats();

      const stats = coalescer.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.freshExecutions).toBe(0);
      expect(stats.coalescedRequests).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear pending requests', async () => {
      const coalescer = new RequestCoalescer<number>();

      const promise = coalescer.execute('clear-test', async () => {
        await new Promise(r => setTimeout(r, 100));
        return 1;
      });

      expect(coalescer.pendingCount).toBe(1);

      coalescer.clear();

      expect(coalescer.pendingCount).toBe(0);

      // The original promise should still complete
      await promise;
    });
  });

  describe('timeout', () => {
    it('should timeout long-running requests', async () => {
      const coalescer = new RequestCoalescer<number>({ timeoutMs: 50 });

      await expect(coalescer.execute('timeout-test', async () => {
        await new Promise(r => setTimeout(r, 200));
        return 1;
      })).rejects.toThrow('timeout');
    });
  });

  describe('createRequestCoalescer', () => {
    it('should create a coalescer instance', () => {
      const coalescer = createRequestCoalescer<string>();
      expect(coalescer).toBeInstanceOf(RequestCoalescer);
    });

    it('should accept custom config', () => {
      const coalescer = createRequestCoalescer({ maxPending: 500 });
      expect(coalescer).toBeInstanceOf(RequestCoalescer);
    });
  });
});
