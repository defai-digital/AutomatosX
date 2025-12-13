/**
 * Router Circuit Breaker Integration Tests
 *
 * Tests the circuit breaker functionality across multiple providers:
 * - State transitions (CLOSED → OPEN → HALF_OPEN → CLOSED)
 * - Time-window based failure counting
 * - Recovery after cooldown period
 * - Multiple resource management
 *
 * @since v12.8.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CircuitBreaker, type CircuitBreakerConfig } from '../../../src/core/router/circuit-breaker.js';

describe('Circuit Breaker Integration', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('State Transitions', () => {
    it('should start in CLOSED state', () => {
      circuitBreaker = new CircuitBreaker();

      expect(circuitBreaker.getState('provider-1')).toBe('CLOSED');
      expect(circuitBreaker.isOpen('provider-1')).toBe(false);
    });

    it('should transition to OPEN after failure threshold', () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        cooldownMs: 60000
      });

      // Record failures to reach threshold
      circuitBreaker.recordFailure('provider-1');
      expect(circuitBreaker.getState('provider-1')).toBe('CLOSED');

      circuitBreaker.recordFailure('provider-1');
      expect(circuitBreaker.getState('provider-1')).toBe('CLOSED');

      circuitBreaker.recordFailure('provider-1');
      expect(circuitBreaker.getState('provider-1')).toBe('OPEN');
      expect(circuitBreaker.isOpen('provider-1')).toBe(true);
    });

    it('should transition to HALF_OPEN after cooldown', () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        cooldownMs: 30000
      });

      // Open the circuit
      circuitBreaker.recordFailure('provider-1');
      circuitBreaker.recordFailure('provider-1');
      expect(circuitBreaker.getState('provider-1')).toBe('OPEN');

      // Advance time past cooldown
      vi.advanceTimersByTime(31000);

      // Check triggers transition to HALF_OPEN
      expect(circuitBreaker.isOpen('provider-1')).toBe(false);
      expect(circuitBreaker.getState('provider-1')).toBe('HALF_OPEN');
    });

    it('should close circuit after success threshold in HALF_OPEN', () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        cooldownMs: 1000,
        successThreshold: 2
      });

      // Open circuit
      circuitBreaker.recordFailure('provider-1');
      circuitBreaker.recordFailure('provider-1');
      expect(circuitBreaker.getState('provider-1')).toBe('OPEN');

      // Wait for cooldown
      vi.advanceTimersByTime(1100);
      circuitBreaker.isOpen('provider-1'); // Triggers HALF_OPEN

      // Record successes
      circuitBreaker.recordSuccess('provider-1');
      expect(circuitBreaker.getState('provider-1')).toBe('HALF_OPEN');

      circuitBreaker.recordSuccess('provider-1');
      expect(circuitBreaker.getState('provider-1')).toBe('CLOSED');
    });

    it('should reopen circuit on failure in HALF_OPEN', () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        cooldownMs: 1000,
        successThreshold: 3
      });

      // Open circuit
      circuitBreaker.recordFailure('provider-1');
      circuitBreaker.recordFailure('provider-1');

      // Wait for cooldown and transition to HALF_OPEN
      vi.advanceTimersByTime(1100);
      circuitBreaker.isOpen('provider-1');
      expect(circuitBreaker.getState('provider-1')).toBe('HALF_OPEN');

      // Failure in HALF_OPEN should immediately reopen
      circuitBreaker.recordFailure('provider-1');
      expect(circuitBreaker.getState('provider-1')).toBe('OPEN');
    });
  });

  describe('Time-Window Based Failure Counting', () => {
    it('should count only failures within the window', () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        cooldownMs: 60000,
        failureWindowMs: 10000 // 10 second window
      });

      // Record failure
      circuitBreaker.recordFailure('provider-1');

      // Advance time but stay within window
      vi.advanceTimersByTime(5000);
      circuitBreaker.recordFailure('provider-1');

      // Advance past window for first failure
      vi.advanceTimersByTime(6000); // Now at 11s, first failure is outside window
      circuitBreaker.recordFailure('provider-1');

      // Should still be CLOSED because first failure is outside window
      // Only 2 failures within window
      expect(circuitBreaker.getState('provider-1')).toBe('CLOSED');

      // One more failure should open (3 within window now)
      circuitBreaker.recordFailure('provider-1');
      expect(circuitBreaker.getState('provider-1')).toBe('OPEN');
    });

    it('should reset failure count on success in CLOSED state', () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        cooldownMs: 60000
      });

      // Record some failures
      circuitBreaker.recordFailure('provider-1');
      circuitBreaker.recordFailure('provider-1');

      const statsBeforeSuccess = circuitBreaker.getStats('provider-1');
      expect(statsBeforeSuccess.failureCount).toBe(2);

      // Success should reset
      circuitBreaker.recordSuccess('provider-1');

      const statsAfterSuccess = circuitBreaker.getStats('provider-1');
      expect(statsAfterSuccess.failureCount).toBe(0);
    });
  });

  describe('Multiple Resource Management', () => {
    it('should manage circuits independently for different resources', () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        cooldownMs: 30000
      });

      // Open circuit for provider-1
      circuitBreaker.recordFailure('provider-1');
      circuitBreaker.recordFailure('provider-1');
      expect(circuitBreaker.getState('provider-1')).toBe('OPEN');

      // provider-2 should still be CLOSED
      expect(circuitBreaker.getState('provider-2')).toBe('CLOSED');
      expect(circuitBreaker.isOpen('provider-2')).toBe(false);

      // Record failure for provider-2 (not enough to open)
      circuitBreaker.recordFailure('provider-2');
      expect(circuitBreaker.getState('provider-2')).toBe('CLOSED');
    });

    it('should provide stats for all circuits', () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        cooldownMs: 60000
      });

      // Interact with multiple providers
      circuitBreaker.recordFailure('provider-1');
      circuitBreaker.recordSuccess('provider-2');
      circuitBreaker.recordFailure('provider-3');
      circuitBreaker.recordFailure('provider-3');
      circuitBreaker.recordFailure('provider-3'); // Opens circuit

      const allStats = circuitBreaker.getAllStats();

      expect(allStats.size).toBe(3);
      expect(allStats.get('provider-1')?.state).toBe('CLOSED');
      expect(allStats.get('provider-2')?.state).toBe('CLOSED');
      expect(allStats.get('provider-3')?.state).toBe('OPEN');
    });

    it('should reset all circuits', () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        cooldownMs: 60000
      });

      // Open multiple circuits
      circuitBreaker.recordFailure('provider-1');
      circuitBreaker.recordFailure('provider-1');
      circuitBreaker.recordFailure('provider-2');
      circuitBreaker.recordFailure('provider-2');

      expect(circuitBreaker.getState('provider-1')).toBe('OPEN');
      expect(circuitBreaker.getState('provider-2')).toBe('OPEN');

      // Reset all
      circuitBreaker.resetAll();

      expect(circuitBreaker.getState('provider-1')).toBe('CLOSED');
      expect(circuitBreaker.getState('provider-2')).toBe('CLOSED');
    });
  });

  describe('Manual Circuit Control', () => {
    it('should manually open circuit', () => {
      circuitBreaker = new CircuitBreaker();

      circuitBreaker.open('provider-1');

      expect(circuitBreaker.getState('provider-1')).toBe('OPEN');
      expect(circuitBreaker.isOpen('provider-1')).toBe(true);
    });

    it('should manually close circuit', () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        cooldownMs: 60000
      });

      // Open circuit via failures
      circuitBreaker.recordFailure('provider-1');
      circuitBreaker.recordFailure('provider-1');
      expect(circuitBreaker.getState('provider-1')).toBe('OPEN');

      // Manually close
      circuitBreaker.close('provider-1');

      expect(circuitBreaker.getState('provider-1')).toBe('CLOSED');
      expect(circuitBreaker.isOpen('provider-1')).toBe(false);

      // Stats should be reset
      const stats = circuitBreaker.getStats('provider-1');
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration', () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 5,
        cooldownMs: 120000,
        successThreshold: 3,
        failureWindowMs: 60000
      };

      circuitBreaker = new CircuitBreaker(config);

      const retrievedConfig = circuitBreaker.getConfig();
      expect(retrievedConfig.failureThreshold).toBe(5);
      expect(retrievedConfig.cooldownMs).toBe(120000);
      expect(retrievedConfig.successThreshold).toBe(3);
      expect(retrievedConfig.failureWindowMs).toBe(60000);
    });

    it('should use default configuration when not specified', () => {
      circuitBreaker = new CircuitBreaker();

      const config = circuitBreaker.getConfig();
      expect(config.failureThreshold).toBe(3);
      expect(config.successThreshold).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid failure/success cycles', () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        cooldownMs: 1000,
        successThreshold: 1
      });

      // Rapid failures
      circuitBreaker.recordFailure('provider-1');
      circuitBreaker.recordFailure('provider-1');
      circuitBreaker.recordFailure('provider-1');
      expect(circuitBreaker.getState('provider-1')).toBe('OPEN');

      // Wait for cooldown
      vi.advanceTimersByTime(1100);
      circuitBreaker.isOpen('provider-1'); // Transition to HALF_OPEN

      // Rapid success
      circuitBreaker.recordSuccess('provider-1');
      expect(circuitBreaker.getState('provider-1')).toBe('CLOSED');

      // Immediately fail again
      circuitBreaker.recordFailure('provider-1');
      circuitBreaker.recordFailure('provider-1');
      circuitBreaker.recordFailure('provider-1');
      expect(circuitBreaker.getState('provider-1')).toBe('OPEN');
    });

    it('should handle zero failures at start', () => {
      circuitBreaker = new CircuitBreaker();

      const stats = circuitBreaker.getStats('new-provider');
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
      expect(stats.state).toBe('CLOSED');
      expect(stats.lastFailureTime).toBeNull();
      expect(stats.nextAttemptTime).toBeNull();
    });

    it('should track failure timestamps correctly', () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 5,
        cooldownMs: 60000,
        failureWindowMs: 10000
      });

      const baseTime = Date.now();
      vi.setSystemTime(baseTime);

      circuitBreaker.recordFailure('provider-1');

      vi.advanceTimersByTime(2000);
      circuitBreaker.recordFailure('provider-1');

      vi.advanceTimersByTime(2000);
      circuitBreaker.recordFailure('provider-1');

      const stats = circuitBreaker.getStats('provider-1');
      expect(stats.failureTimestamps.length).toBe(3);
      expect(stats.lastFailureTime).toBe(baseTime + 4000);
    });
  });
});
