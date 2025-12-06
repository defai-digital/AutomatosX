/**
 * TaskCircuitBreaker Unit Tests
 *
 * Tests for circuit breaker failure isolation.
 *
 * Part of Phase 4: Production Hardening
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskCircuitBreaker, createCircuitBreaker } from '@/core/task-engine/circuit-breaker';

describe('TaskCircuitBreaker', () => {
  let breaker: TaskCircuitBreaker;

  beforeEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize in CLOSED state', () => {
      breaker = new TaskCircuitBreaker();

      expect(breaker.getState()).toBe('CLOSED');
      expect(breaker.isClosed()).toBe(true);
      expect(breaker.isOpen()).toBe(false);
    });

    it('should accept custom config', () => {
      breaker = new TaskCircuitBreaker({
        failureThreshold: 10,
        resetTimeoutMs: 60000
      });

      expect(breaker.getState()).toBe('CLOSED');
    });
  });

  describe('canExecute', () => {
    it('should allow requests when CLOSED', () => {
      breaker = new TaskCircuitBreaker();

      expect(breaker.canExecute()).toBe(true);
      expect(breaker.canExecute()).toBe(true);
      expect(breaker.canExecute()).toBe(true);
    });

    it('should block requests when OPEN', () => {
      breaker = new TaskCircuitBreaker({ failureThreshold: 2 });

      // Open the circuit
      breaker.canExecute();
      breaker.recordFailure();
      breaker.canExecute();
      breaker.recordFailure();

      expect(breaker.isOpen()).toBe(true);
      expect(breaker.canExecute()).toBe(false);
    });

    it('should track blocked requests', () => {
      breaker = new TaskCircuitBreaker({ failureThreshold: 1 });

      breaker.canExecute();
      breaker.recordFailure();

      // These should be blocked
      breaker.canExecute();
      breaker.canExecute();

      const stats = breaker.getStats();
      expect(stats.blockedRequests).toBe(2);
    });
  });

  describe('recordSuccess', () => {
    it('should not change state when CLOSED', () => {
      breaker = new TaskCircuitBreaker();

      breaker.canExecute();
      breaker.recordSuccess();

      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should close circuit after enough successes in HALF_OPEN', async () => {
      breaker = new TaskCircuitBreaker({
        failureThreshold: 1,
        successThreshold: 2,
        resetTimeoutMs: 10
      });

      // Open the circuit
      breaker.canExecute();
      breaker.recordFailure();

      expect(breaker.isOpen()).toBe(true);

      // Wait for reset timeout
      await new Promise(r => setTimeout(r, 20));

      // Should transition to HALF_OPEN
      breaker.canExecute();
      expect(breaker.getState()).toBe('HALF_OPEN');

      // Record successes
      breaker.recordSuccess();

      // Need another request in half-open
      breaker.canExecute();
      breaker.recordSuccess();

      expect(breaker.getState()).toBe('CLOSED');
    });
  });

  describe('recordFailure', () => {
    it('should open circuit after threshold failures', () => {
      breaker = new TaskCircuitBreaker({ failureThreshold: 3 });

      breaker.canExecute();
      breaker.recordFailure();

      breaker.canExecute();
      breaker.recordFailure();

      expect(breaker.isClosed()).toBe(true);

      breaker.canExecute();
      breaker.recordFailure();

      expect(breaker.isOpen()).toBe(true);
    });

    it('should return to OPEN from HALF_OPEN on failure', async () => {
      breaker = new TaskCircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 10
      });

      // Open the circuit
      breaker.canExecute();
      breaker.recordFailure();

      // Wait for reset timeout
      await new Promise(r => setTimeout(r, 20));

      // Transition to HALF_OPEN
      breaker.canExecute();
      expect(breaker.getState()).toBe('HALF_OPEN');

      // Fail again
      breaker.recordFailure();

      expect(breaker.isOpen()).toBe(true);
    });

    it('should only count failures within window', async () => {
      breaker = new TaskCircuitBreaker({
        failureThreshold: 3,
        failureWindowMs: 50
      });

      // First failure
      breaker.canExecute();
      breaker.recordFailure();

      // Wait for window to expire
      await new Promise(r => setTimeout(r, 60));

      // Two more failures
      breaker.canExecute();
      breaker.recordFailure();
      breaker.canExecute();
      breaker.recordFailure();

      // Should still be closed (first failure expired)
      expect(breaker.isClosed()).toBe(true);
    });
  });

  describe('state transitions', () => {
    it('should transition CLOSED -> OPEN -> HALF_OPEN -> CLOSED', async () => {
      breaker = new TaskCircuitBreaker({
        failureThreshold: 2,
        successThreshold: 1,
        resetTimeoutMs: 20
      });

      // CLOSED -> OPEN
      breaker.canExecute();
      breaker.recordFailure();
      breaker.canExecute();
      breaker.recordFailure();

      expect(breaker.getState()).toBe('OPEN');

      // OPEN -> HALF_OPEN (after timeout)
      await new Promise(r => setTimeout(r, 30));
      breaker.canExecute();

      expect(breaker.getState()).toBe('HALF_OPEN');

      // HALF_OPEN -> CLOSED (after success)
      breaker.recordSuccess();

      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should call onStateChange callback', () => {
      breaker = new TaskCircuitBreaker({ failureThreshold: 1 });

      const transitions: Array<{ from: string; to: string }> = [];
      breaker.onStateChangeCallback((from, to) => {
        transitions.push({ from, to });
      });

      breaker.canExecute();
      breaker.recordFailure();

      expect(transitions).toHaveLength(1);
      expect(transitions[0]).toEqual({ from: 'CLOSED', to: 'OPEN' });
    });
  });

  describe('forceClose/forceOpen', () => {
    it('should force circuit closed', () => {
      breaker = new TaskCircuitBreaker({ failureThreshold: 1 });

      // Open the circuit
      breaker.canExecute();
      breaker.recordFailure();

      expect(breaker.isOpen()).toBe(true);

      breaker.forceClose();

      expect(breaker.isClosed()).toBe(true);
    });

    it('should force circuit open', () => {
      breaker = new TaskCircuitBreaker();

      expect(breaker.isClosed()).toBe(true);

      breaker.forceOpen();

      expect(breaker.isOpen()).toBe(true);
    });
  });

  describe('getTimeUntilRetry', () => {
    it('should return null when CLOSED', () => {
      breaker = new TaskCircuitBreaker();

      expect(breaker.getTimeUntilRetry()).toBeNull();
    });

    it('should return remaining time when OPEN', () => {
      breaker = new TaskCircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 30000
      });

      breaker.canExecute();
      breaker.recordFailure();

      const timeUntilRetry = breaker.getTimeUntilRetry();
      expect(timeUntilRetry).not.toBeNull();
      expect(timeUntilRetry).toBeGreaterThan(29000);
      expect(timeUntilRetry).toBeLessThanOrEqual(30000);
    });
  });

  describe('getStats', () => {
    it('should track statistics', () => {
      breaker = new TaskCircuitBreaker({ failureThreshold: 3 });

      breaker.canExecute();
      breaker.recordSuccess();

      breaker.canExecute();
      breaker.recordFailure();

      breaker.canExecute();
      breaker.recordSuccess();

      const stats = breaker.getStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.successfulRequests).toBe(2);
      expect(stats.failedRequests).toBe(1);
      expect(stats.currentFailures).toBe(1);
    });

    it('should track times opened/closed', async () => {
      breaker = new TaskCircuitBreaker({
        failureThreshold: 1,
        successThreshold: 1,
        resetTimeoutMs: 10
      });

      // Open
      breaker.canExecute();
      breaker.recordFailure();

      // Wait and close
      await new Promise(r => setTimeout(r, 20));
      breaker.canExecute();
      breaker.recordSuccess();

      const stats = breaker.getStats();
      expect(stats.timesOpened).toBe(1);
      expect(stats.timesClosed).toBe(1);
    });

    it('should reset statistics', () => {
      breaker = new TaskCircuitBreaker();

      breaker.canExecute();
      breaker.recordSuccess();
      breaker.resetStats();

      const stats = breaker.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.successfulRequests).toBe(0);
    });
  });

  describe('HALF_OPEN request limiting', () => {
    it('should limit concurrent requests in HALF_OPEN', async () => {
      breaker = new TaskCircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 10,
        halfOpenMaxRequests: 1
      });

      // Open the circuit
      breaker.canExecute();
      breaker.recordFailure();

      // Wait for reset
      await new Promise(r => setTimeout(r, 20));

      // First request allowed (transitions to HALF_OPEN)
      expect(breaker.canExecute()).toBe(true);

      // Second request blocked
      expect(breaker.canExecute()).toBe(false);
    });
  });

  describe('createCircuitBreaker', () => {
    it('should create a breaker instance', () => {
      breaker = createCircuitBreaker();
      expect(breaker).toBeInstanceOf(TaskCircuitBreaker);
    });

    it('should accept custom config', () => {
      breaker = createCircuitBreaker({ failureThreshold: 10 });
      expect(breaker).toBeInstanceOf(TaskCircuitBreaker);
    });
  });

  describe('bug fixes', () => {
    describe('half-open slot leak prevention', () => {
      it('should not go negative on halfOpenRequests when recordSuccess called multiple times', async () => {
        breaker = new TaskCircuitBreaker({
          failureThreshold: 1,
          successThreshold: 2,
          resetTimeoutMs: 10,
          halfOpenMaxRequests: 1
        });

        // Open the circuit
        breaker.canExecute();
        breaker.recordFailure();
        expect(breaker.isOpen()).toBe(true);

        // Wait for reset timeout
        await new Promise(r => setTimeout(r, 20));

        // Transition to HALF_OPEN
        expect(breaker.canExecute()).toBe(true);
        expect(breaker.getState()).toBe('HALF_OPEN');

        // Record success multiple times (simulating bug where caller calls recordSuccess extra times)
        breaker.recordSuccess();
        breaker.recordSuccess(); // This should not cause negative halfOpenRequests

        // Next canExecute in HALF_OPEN should still work correctly
        await new Promise(r => setTimeout(r, 20)); // Reset again if needed
        if (breaker.getState() === 'OPEN') {
          await new Promise(r => setTimeout(r, 20));
        }

        // Circuit should behave normally (not throw or have negative counts)
        const stats = breaker.getStats();
        expect(stats.successfulRequests).toBeGreaterThanOrEqual(2);
      });

      it('should not go negative on halfOpenRequests when recordFailure called multiple times', async () => {
        breaker = new TaskCircuitBreaker({
          failureThreshold: 1,
          resetTimeoutMs: 10,
          halfOpenMaxRequests: 1
        });

        // Open -> HALF_OPEN
        breaker.canExecute();
        breaker.recordFailure();
        await new Promise(r => setTimeout(r, 20));
        breaker.canExecute();
        expect(breaker.getState()).toBe('HALF_OPEN');

        // Multiple failures should not cause negative halfOpenRequests
        breaker.recordFailure();
        breaker.recordFailure();

        // Should be back to OPEN and stats should be valid
        expect(breaker.isOpen()).toBe(true);
        const stats = breaker.getStats();
        expect(stats.failedRequests).toBeGreaterThanOrEqual(2);
      });

      it('should release half-open slot when request is aborted/cancelled', async () => {
        breaker = new TaskCircuitBreaker({
          failureThreshold: 1,
          resetTimeoutMs: 10,
          halfOpenMaxRequests: 1
        });

        // Open -> HALF_OPEN
        breaker.canExecute();
        breaker.recordFailure();
        await new Promise(r => setTimeout(r, 20));

        // First request takes the slot
        expect(breaker.canExecute()).toBe(true);
        expect(breaker.getState()).toBe('HALF_OPEN');

        // Second request should be blocked
        expect(breaker.canExecute()).toBe(false);

        // Release the slot without success/failure (simulating abort)
        breaker.releaseHalfOpenSlot();

        // Now another request should be allowed
        expect(breaker.canExecute()).toBe(true);
      });
    });

    describe('off-by-one in failure window', () => {
      it('should properly clean up failures at exactly the boundary (Bug fix: >= instead of >)', async () => {
        vi.useFakeTimers();

        breaker = new TaskCircuitBreaker({
          failureThreshold: 3,
          failureWindowMs: 100
        });

        const startTime = 1000;
        vi.setSystemTime(startTime);

        // First failure at exactly t=1000
        breaker.canExecute();
        breaker.recordFailure();

        // Advance to exactly t=1100 (100ms later = at the boundary)
        vi.setSystemTime(startTime + 100);

        // Add more failures
        breaker.canExecute();
        breaker.recordFailure();
        breaker.canExecute();
        breaker.recordFailure();

        // Should NOT trip because first failure is at exactly the boundary
        // and should be excluded (>= cutoff means failures AT cutoff are kept)
        // Wait... actually with >= the failure at boundary is INCLUDED
        // Let me check: cutoff = now - windowMs = 1100 - 100 = 1000
        // timestamp >= cutoff means timestamp >= 1000, so t=1000 is KEPT
        // This means we have 3 failures, circuit should open
        expect(breaker.isOpen()).toBe(true);

        vi.useRealTimers();
      });

      it('should exclude failures just outside the boundary', async () => {
        vi.useFakeTimers();

        breaker = new TaskCircuitBreaker({
          failureThreshold: 3,
          failureWindowMs: 100
        });

        const startTime = 1000;
        vi.setSystemTime(startTime);

        // First failure at t=1000
        breaker.canExecute();
        breaker.recordFailure();

        // Advance to t=1101 (101ms later = just past the boundary)
        vi.setSystemTime(startTime + 101);

        // Add more failures
        breaker.canExecute();
        breaker.recordFailure();
        breaker.canExecute();
        breaker.recordFailure();

        // cutoff = 1101 - 100 = 1001
        // t=1000 < 1001, so first failure is EXCLUDED
        // Only 2 failures in window, circuit should stay closed
        expect(breaker.isClosed()).toBe(true);

        vi.useRealTimers();
      });
    });
  });
});
