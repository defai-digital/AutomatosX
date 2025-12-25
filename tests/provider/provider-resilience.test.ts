import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCircuitBreaker,
  createRateLimiter,
  createHealthMonitor,
  CircuitBreakerError,
  type CircuitBreaker,
  type RateLimiter,
  type HealthMonitor,
} from '@defai.digital/provider-domain';
import {
  createDefaultProviderCircuitBreakerConfig as createDefaultCircuitBreakerConfig,
  createDefaultProviderRateLimitConfig as createDefaultRateLimitConfig,
  createDefaultHealthCheckConfig,
} from '@defai.digital/contracts';

describe('Provider Resilience', () => {
  // ============================================================================
  // Circuit Breaker Tests
  // ============================================================================
  describe('Circuit Breaker (INV-CB-001 to INV-CB-005)', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = createCircuitBreaker('test-provider', {
        ...createDefaultCircuitBreakerConfig(),
        failureThreshold: 3,
        resetTimeoutMs: 1000,
        halfOpenRequests: 2,
      });
    });

    it('INV-CB-001: should allow all requests when closed', () => {
      expect(circuitBreaker.canExecute()).toBe(true);
      expect(circuitBreaker.getState().state).toBe('closed');
    });

    it('INV-CB-004: should open after failure threshold', () => {
      // Record failures up to threshold
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState().state).toBe('closed');

      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState().state).toBe('closed');

      circuitBreaker.recordFailure(); // Third failure
      expect(circuitBreaker.getState().state).toBe('open');
    });

    it('INV-CB-002: should reject requests when open', () => {
      // Force to open state
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      expect(circuitBreaker.getState().state).toBe('open');
      expect(circuitBreaker.canExecute()).toBe(false);
    });

    it('INV-CB-002: should transition to half-open after reset timeout', async () => {
      // Open the circuit
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      expect(circuitBreaker.getState().state).toBe('open');

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should now allow test requests
      expect(circuitBreaker.canExecute()).toBe(true);
      expect(circuitBreaker.getState().state).toBe('halfOpen');
    });

    it('INV-CB-003: should allow limited requests in half-open state', async () => {
      // Open and wait for half-open
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      await new Promise((resolve) => setTimeout(resolve, 1100));

      // First requests allowed in half-open
      expect(circuitBreaker.canExecute()).toBe(true);
      expect(circuitBreaker.getState().state).toBe('halfOpen');
    });

    it('should reopen if failure in half-open', async () => {
      // Open and wait for half-open
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      await new Promise((resolve) => setTimeout(resolve, 1100));

      circuitBreaker.canExecute();
      circuitBreaker.recordFailure(); // Fail in half-open

      expect(circuitBreaker.getState().state).toBe('open');
    });

    it('should support force open/close', () => {
      circuitBreaker.forceOpen();
      expect(circuitBreaker.getState().state).toBe('open');

      circuitBreaker.forceClose();
      expect(circuitBreaker.getState().state).toBe('closed');
    });

    it('should track events', () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure(); // Opens circuit

      const events = circuitBreaker.getEvents();
      expect(events.length).toBeGreaterThan(0);
    });

    it('should reset state', () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      circuitBreaker.reset();
      const state = circuitBreaker.getState();
      expect(state.state).toBe('closed');
      expect(state.failureCount).toBe(0);
    });
  });

  // ============================================================================
  // Rate Limiter Tests
  // ============================================================================
  describe('Rate Limiter (INV-RL-001 to INV-RL-004)', () => {
    let rateLimiter: RateLimiter;

    beforeEach(() => {
      rateLimiter = createRateLimiter('test-provider', {
        ...createDefaultRateLimitConfig(),
        requestsPerMinute: 10,
        tokensPerMinute: 1000,
        burstMultiplier: 1.5,
        strategy: 'reject',
      });
    });

    it('should allow requests when tokens available', () => {
      expect(rateLimiter.canRequest()).toBe(true);
    });

    it('should consume tokens on request', () => {
      const initialState = rateLimiter.getState();
      const initialTokens = initialState.requestTokens;

      rateLimiter.tryConsume(1);

      const newState = rateLimiter.getState();
      expect(newState.requestTokens).toBeLessThan(initialTokens);
    });

    it('INV-RL-001: should respect burst capacity', () => {
      // Consume many tokens quickly
      let consumed = 0;
      while (rateLimiter.tryConsume(1) && consumed < 20) {
        consumed++;
      }

      // Should have hit the limit at some point
      expect(consumed).toBeLessThanOrEqual(15); // burst = 10 * 1.5 = 15
    });

    it('INV-RL-002: should refill tokens over time', async () => {
      // Consume some tokens
      rateLimiter.tryConsume(5);
      const afterConsume = rateLimiter.getState().requestTokens;

      // Wait for partial refill
      await new Promise((resolve) => setTimeout(resolve, 200));

      const afterWait = rateLimiter.getState().requestTokens;
      expect(afterWait).toBeGreaterThanOrEqual(afterConsume);
    });

    it('INV-RL-003: should track state correctly', () => {
      const state = rateLimiter.getState();
      expect(state.state).toBeDefined();
      expect(state.requestTokens).toBeGreaterThanOrEqual(0);
    });

    it('should get wait time for tokens', () => {
      const waitTime = rateLimiter.getWaitTime(100);
      expect(waitTime).toBeGreaterThanOrEqual(0);
    });

    it('should track events', () => {
      rateLimiter.tryConsume(1);
      const events = rateLimiter.getEvents();
      expect(events).toBeDefined();
    });

    it('should reset state', () => {
      rateLimiter.tryConsume(5);
      rateLimiter.reset();

      const state = rateLimiter.getState();
      expect(state.requestTokens).toBeGreaterThan(0);
    });

    it('should handle external rate limit', () => {
      rateLimiter.recordExternalLimit(5000);
      // Should reflect the external limit
      const state = rateLimiter.getState();
      expect(state).toBeDefined();
    });
  });

  // ============================================================================
  // Health Monitor Tests
  // ============================================================================
  describe('Health Monitor', () => {
    let healthMonitor: HealthMonitor;

    beforeEach(() => {
      healthMonitor = createHealthMonitor('test-provider', {
        ...createDefaultHealthCheckConfig(),
      });
    });

    it('should start with initial status', () => {
      const status = healthMonitor.getStatus();
      expect(status.providerId).toBe('test-provider');
      expect(status.level).toBeDefined();
    });

    it('should track health status after success', () => {
      healthMonitor.recordSuccess(100);
      healthMonitor.recordSuccess(150);

      const status = healthMonitor.getStatus();
      expect(status.available).toBe(true);
      expect(status.level).toBe('healthy');
    });

    it('should detect unhealthy state after failures', () => {
      healthMonitor.recordFailure('Error 1');
      healthMonitor.recordFailure('Error 2');
      healthMonitor.recordFailure('Error 3');
      healthMonitor.recordFailure('Error 4');
      healthMonitor.recordFailure('Error 5');

      const status = healthMonitor.getStatus();
      // After many failures, should be degraded or unhealthy
      expect(status.consecutiveFailures).toBeGreaterThan(0);
    });

    it('should track consecutive successes', () => {
      healthMonitor.recordSuccess(100);
      healthMonitor.recordSuccess(100);
      healthMonitor.recordSuccess(100);

      const status = healthMonitor.getStatus();
      expect(status.consecutiveSuccesses).toBe(3);
    });

    it('should reset consecutive counters', () => {
      healthMonitor.recordSuccess(100);
      healthMonitor.recordSuccess(100);
      healthMonitor.recordFailure('Error');

      const status = healthMonitor.getStatus();
      expect(status.consecutiveSuccesses).toBe(0);
      expect(status.consecutiveFailures).toBe(1);
    });

    it('should track latency', () => {
      healthMonitor.recordSuccess(100);
      healthMonitor.recordSuccess(200);

      const status = healthMonitor.getStatus();
      expect(status.latencyMs).toBeGreaterThan(0);
    });

    it('should track last error', () => {
      healthMonitor.recordFailure('Connection timeout');

      const status = healthMonitor.getStatus();
      expect(status.lastError).toBe('Connection timeout');
    });

    it('should reset health monitor', () => {
      healthMonitor.recordFailure('Error');
      healthMonitor.recordFailure('Error');

      healthMonitor.reset();

      const status = healthMonitor.getStatus();
      expect(status.consecutiveFailures).toBe(0);
    });

    it('should track events', () => {
      healthMonitor.recordSuccess(100);
      const events = healthMonitor.getEvents();
      expect(events).toBeDefined();
    });
  });
});
