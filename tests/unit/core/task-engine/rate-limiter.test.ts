/**
 * TaskRateLimiter Unit Tests
 *
 * Tests for per-client rate limiting functionality.
 *
 * Part of Phase 4: Production Hardening
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskRateLimiter, createRateLimiter } from '@/core/task-engine/rate-limiter';

describe('TaskRateLimiter', () => {
  let limiter: TaskRateLimiter;

  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    if (limiter) {
      limiter.shutdown();
    }
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      limiter = new TaskRateLimiter();
      const stats = limiter.getStats();

      expect(stats.activeBuckets).toBe(0);
      expect(stats.totalRequests).toBe(0);
    });

    it('should accept custom config', () => {
      limiter = new TaskRateLimiter({
        tokensPerMinute: 50,
        maxConcurrentPerClient: 5
      });

      // Should work with custom config
      const result = limiter.checkLimit('client-1');
      expect(result.allowed).toBe(true);
    });
  });

  describe('checkLimit', () => {
    it('should allow requests within limit', () => {
      limiter = new TaskRateLimiter({ tokensPerMinute: 10 });

      for (let i = 0; i < 5; i++) {
        const result = limiter.checkLimit('client-1');
        expect(result.allowed).toBe(true);
      }
    });

    it('should reject requests when tokens exhausted', () => {
      limiter = new TaskRateLimiter({ tokensPerMinute: 3 });

      // Exhaust tokens
      limiter.checkLimit('client-1');
      limiter.checkLimit('client-1');
      limiter.checkLimit('client-1');

      // Should be rejected
      const result = limiter.checkLimit('client-1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('TOKEN_EXHAUSTED');
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('should reject when concurrent limit reached', () => {
      limiter = new TaskRateLimiter({
        tokensPerMinute: 100,
        maxConcurrentPerClient: 2
      });

      // Track 2 concurrent tasks
      limiter.checkLimit('client-1');
      limiter.trackStart('client-1');
      limiter.checkLimit('client-1');
      limiter.trackStart('client-1');

      // Third should be rejected
      const result = limiter.checkLimit('client-1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('CONCURRENT_LIMIT');
    });

    it('should track separate buckets per client', () => {
      limiter = new TaskRateLimiter({ tokensPerMinute: 2 });

      // Client 1 exhausts tokens
      limiter.checkLimit('client-1');
      limiter.checkLimit('client-1');

      // Client 2 should still have tokens
      const result = limiter.checkLimit('client-2');
      expect(result.allowed).toBe(true);
    });

    it('should refill tokens over time', async () => {
      limiter = new TaskRateLimiter({ tokensPerMinute: 60 }); // 1 token per second

      // Exhaust some tokens
      for (let i = 0; i < 55; i++) {
        limiter.checkLimit('client-1');
      }

      // Wait for refill
      await new Promise(r => setTimeout(r, 100));

      // Should have some tokens now
      const result = limiter.checkLimit('client-1');
      expect(result.allowed).toBe(true);
    });
  });

  describe('trackStart/trackComplete', () => {
    it('should track concurrent tasks', () => {
      limiter = new TaskRateLimiter({ maxConcurrentPerClient: 5 });

      limiter.trackStart('client-1');
      limiter.trackStart('client-1');

      const status = limiter.getClientStatus('client-1');
      expect(status.concurrent).toBe(2);

      limiter.trackComplete('client-1');
      const status2 = limiter.getClientStatus('client-1');
      expect(status2.concurrent).toBe(1);
    });

    it('should not go below zero concurrent', () => {
      limiter = new TaskRateLimiter();

      // Complete without start
      limiter.trackComplete('client-1');

      const status = limiter.getClientStatus('client-1');
      expect(status.concurrent).toBe(0);
    });
  });

  describe('blockClient/unblockClient', () => {
    it('should block client requests', () => {
      limiter = new TaskRateLimiter();

      limiter.blockClient('client-1', 60000);

      const result = limiter.checkLimit('client-1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('CLIENT_BLOCKED');
    });

    it('should unblock client', () => {
      limiter = new TaskRateLimiter();

      limiter.blockClient('client-1', 60000);
      limiter.unblockClient('client-1');

      const result = limiter.checkLimit('client-1');
      expect(result.allowed).toBe(true);
    });

    it('should auto-unblock after duration', async () => {
      limiter = new TaskRateLimiter();

      limiter.blockClient('client-1', 50);

      // Should be blocked
      expect(limiter.checkLimit('client-1').allowed).toBe(false);

      // Wait for block to expire
      await new Promise(r => setTimeout(r, 60));

      // Should be unblocked
      expect(limiter.checkLimit('client-1').allowed).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should track statistics', () => {
      limiter = new TaskRateLimiter({ tokensPerMinute: 5 });

      // Make some requests
      limiter.checkLimit('client-1');
      limiter.checkLimit('client-1');
      limiter.checkLimit('client-2');

      const stats = limiter.getStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.allowedRequests).toBe(3);
      expect(stats.activeBuckets).toBe(2);
    });

    it('should track rejection rate', () => {
      limiter = new TaskRateLimiter({ tokensPerMinute: 2 });

      // 2 allowed, 2 rejected
      limiter.checkLimit('client-1');
      limiter.checkLimit('client-1');
      limiter.checkLimit('client-1');
      limiter.checkLimit('client-1');

      const stats = limiter.getStats();
      expect(stats.rejectionRate).toBe(0.5);
    });

    it('should reset statistics', () => {
      limiter = new TaskRateLimiter();

      limiter.checkLimit('client-1');
      limiter.resetStats();

      const stats = limiter.getStats();
      expect(stats.totalRequests).toBe(0);
    });
  });

  describe('getClientStatus', () => {
    it('should return status for existing client', () => {
      limiter = new TaskRateLimiter({ tokensPerMinute: 100 });

      limiter.checkLimit('client-1');
      limiter.trackStart('client-1');

      const status = limiter.getClientStatus('client-1');
      expect(status.exists).toBe(true);
      expect(status.tokens).toBeLessThanOrEqual(99);
      expect(status.concurrent).toBe(1);
      expect(status.blocked).toBe(false);
    });

    it('should return non-existent for unknown client', () => {
      limiter = new TaskRateLimiter();

      const status = limiter.getClientStatus('unknown');
      expect(status.exists).toBe(false);
    });
  });

  describe('shutdown', () => {
    it('should clean up resources', () => {
      limiter = new TaskRateLimiter();

      limiter.checkLimit('client-1');
      limiter.shutdown();

      // Should have cleared buckets
      expect(limiter.getStats().activeBuckets).toBe(0);
    });
  });

  describe('createRateLimiter', () => {
    it('should create a limiter instance', () => {
      limiter = createRateLimiter();
      expect(limiter).toBeInstanceOf(TaskRateLimiter);
    });

    it('should accept custom config', () => {
      limiter = createRateLimiter({ tokensPerMinute: 200 });
      expect(limiter).toBeInstanceOf(TaskRateLimiter);
    });
  });

  describe('acquireSlot (atomic concurrent check)', () => {
    it('should atomically check and acquire slot', () => {
      limiter = new TaskRateLimiter({
        tokensPerMinute: 100,
        maxConcurrentPerClient: 2
      });

      // First acquire
      const result1 = limiter.acquireSlot('client-1');
      expect(result1.allowed).toBe(true);
      expect(result1.currentConcurrent).toBe(1);

      // Second acquire
      const result2 = limiter.acquireSlot('client-1');
      expect(result2.allowed).toBe(true);
      expect(result2.currentConcurrent).toBe(2);

      // Third should be rejected (concurrent limit reached)
      const result3 = limiter.acquireSlot('client-1');
      expect(result3.allowed).toBe(false);
      expect(result3.reason).toBe('CONCURRENT_LIMIT');
    });

    it('should be race-condition-free (no gap between check and acquire)', () => {
      limiter = new TaskRateLimiter({
        tokensPerMinute: 100,
        maxConcurrentPerClient: 1
      });

      // acquireSlot atomically checks and increments
      const result1 = limiter.acquireSlot('client-1');
      expect(result1.allowed).toBe(true);
      expect(result1.currentConcurrent).toBe(1);

      // Status should show 1 concurrent (already acquired)
      const status = limiter.getClientStatus('client-1');
      expect(status.concurrent).toBe(1);

      // Second acquire should fail immediately
      const result2 = limiter.acquireSlot('client-1');
      expect(result2.allowed).toBe(false);
    });

    it('should release slot on trackComplete after acquireSlot', () => {
      limiter = new TaskRateLimiter({
        tokensPerMinute: 100,
        maxConcurrentPerClient: 1
      });

      // Acquire slot atomically
      const result1 = limiter.acquireSlot('client-1');
      expect(result1.allowed).toBe(true);

      // Complete the task
      limiter.trackComplete('client-1');

      // Now we can acquire another slot
      const result2 = limiter.acquireSlot('client-1');
      expect(result2.allowed).toBe(true);
    });

    it('should handle tokens exhausted with acquireSlot', () => {
      limiter = new TaskRateLimiter({
        tokensPerMinute: 2,
        maxConcurrentPerClient: 10
      });

      // First two acquire work
      limiter.acquireSlot('client-1');
      limiter.trackComplete('client-1');
      limiter.acquireSlot('client-1');
      limiter.trackComplete('client-1');

      // Third should fail due to tokens
      const result = limiter.acquireSlot('client-1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('TOKEN_EXHAUSTED');
    });
  });
});
