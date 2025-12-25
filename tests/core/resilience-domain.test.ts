/**
 * Resilience Domain Tests
 *
 * Tests for resilience pattern implementations: circuit breaker, rate limiter,
 * loop guard, resource enforcer, and metrics collector.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCircuitBreaker,
  createRateLimiter,
  createLoopGuard,
  createStrictLoopGuard,
  createResourceEnforcer,
  createStrictResourceEnforcer,
  createMetricsCollector,
  CircuitBreakerError,
  RateLimiterError,
  LoopGuardError,
  ResourceEnforcerError,
} from '@defai.digital/resilience-domain';

describe('Circuit Breaker', () => {
  it('should start in closed state', () => {
    const cb = createCircuitBreaker();
    expect(cb.state).toBe('closed');
  });

  it('should execute function in closed state', async () => {
    const cb = createCircuitBreaker();
    const result = await cb.execute(async () => 'success');
    expect(result).toBe('success');
    expect(cb.state).toBe('closed');
  });

  it('should record success and stay closed', async () => {
    const cb = createCircuitBreaker();
    cb.recordSuccess();
    const stats = cb.getStats();
    expect(stats.successCount).toBe(1);
    expect(cb.state).toBe('closed');
  });

  it('should open after failure threshold', () => {
    const cb = createCircuitBreaker({
      failureThreshold: 3,
      failureWindowMs: 60000,
    });

    cb.recordFailure();
    expect(cb.state).toBe('closed');
    cb.recordFailure();
    expect(cb.state).toBe('closed');
    cb.recordFailure();
    expect(cb.state).toBe('open');
  });

  it('should reject calls when open', async () => {
    const cb = createCircuitBreaker({
      failureThreshold: 1,
    });

    cb.recordFailure();
    expect(cb.state).toBe('open');

    await expect(cb.execute(async () => 'success')).rejects.toThrow(CircuitBreakerError);
  });

  it('should emit events on state changes', () => {
    const events: string[] = [];
    const cb = createCircuitBreaker({
      failureThreshold: 1,
    });

    cb.onEvent((event) => {
      events.push(event.type);
    });

    cb.recordFailure();
    expect(events).toContain('state-change');
  });

  it('should reset to closed state', () => {
    const cb = createCircuitBreaker({
      failureThreshold: 1,
    });

    cb.recordFailure();
    expect(cb.state).toBe('open');

    cb.reset();
    expect(cb.state).toBe('closed');
  });
});

describe('Rate Limiter', () => {
  it('should allow requests within limit', async () => {
    const rl = createRateLimiter({
      requestsPerMinute: 60,
      burstMultiplier: 1,
    });

    const result = await rl.acquire();
    expect(result.acquired).toBe(true);
    if (result.acquired) {
      expect(result.waitedMs).toBe(0);
    }
  });

  it('should support tryAcquire for non-blocking check', () => {
    const rl = createRateLimiter({
      requestsPerMinute: 60,
      burstMultiplier: 1,
    });

    const result = rl.tryAcquire();
    expect(result).toBe(true);
  });

  it('should track stats', async () => {
    const rl = createRateLimiter({
      requestsPerMinute: 60,
    });

    await rl.acquire();
    await rl.acquire();

    const stats = rl.getStats();
    expect(stats.requestsAllowed).toBe(2);
    expect(stats.requestsRejected).toBe(0);
  });

  it('should reset correctly', async () => {
    const rl = createRateLimiter();

    await rl.acquire();
    const statsBefore = rl.getStats();
    expect(statsBefore.requestsAllowed).toBe(1);

    rl.reset();
    const statsAfter = rl.getStats();
    expect(statsAfter.requestsAllowed).toBe(0);
  });
});

describe('Loop Guard', () => {
  it('should track iterations', () => {
    const lg = createLoopGuard();

    lg.startContext('test');
    const result1 = lg.checkIteration('test');
    expect(result1.status).toBe('ok');
    expect(result1.iteration).toBe(1);

    const result2 = lg.checkIteration('test');
    expect(result2.status).toBe('ok');
    expect(result2.iteration).toBe(2);

    lg.endContext('test');
  });

  it('should issue warning at threshold', () => {
    const lg = createLoopGuard({
      maxIterations: 100,
      warnAtIterations: 5,
    });

    const warnings: string[] = [];
    lg.onWarning((contextId, result) => {
      warnings.push(`${contextId}: ${result.message}`);
    });

    lg.startContext('test');
    for (let i = 0; i < 5; i++) {
      lg.checkIteration('test');
    }

    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('test');
  });

  it('should block at max iterations', () => {
    const lg = createLoopGuard({
      maxIterations: 5,
      warnAtIterations: 3,
    });

    lg.startContext('test');
    for (let i = 0; i < 4; i++) {
      lg.checkIteration('test');
    }

    const result = lg.checkIteration('test');
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      expect(result.blockType).toBe('max-iterations');
    }
  });

  it('strict mode should throw on blocked', () => {
    const lg = createStrictLoopGuard({
      maxIterations: 2,
      warnAtIterations: 1,
    });

    lg.startContext('test');
    lg.checkIteration('test'); // iteration 1 (warning)

    expect(() => lg.checkIteration('test')).toThrow(LoopGuardError);
  });

  it('should get context info', () => {
    const lg = createLoopGuard();

    lg.startContext('test', { foo: 'bar' });
    lg.checkIteration('test');
    lg.checkIteration('test');

    const context = lg.getContext('test');
    expect(context?.contextId).toBe('test');
    expect(context?.iterations).toBe(2);
    expect(context?.metadata).toEqual({ foo: 'bar' });
  });

  it('should throw for unknown context', () => {
    const lg = createLoopGuard();
    expect(() => lg.checkIteration('unknown')).toThrow(LoopGuardError);
  });
});

describe('Resource Enforcer', () => {
  it('should allow requests within limits', () => {
    const re = createResourceEnforcer();

    const result = re.checkLimits('session-1');
    expect(result.allowed).toBe(true);
  });

  it('should track usage', () => {
    const re = createResourceEnforcer();

    re.recordUsage('session-1', 100, 50, 500);
    re.recordUsage('session-1', 200, 100, 1000);

    const usage = re.getUsage('session-1');
    expect(usage.inputTokens).toBe(300);
    expect(usage.outputTokens).toBe(150);
    expect(usage.totalDurationMs).toBe(1500);
    expect(usage.requestCount).toBe(2);
  });

  it('should block when token limit exceeded', () => {
    const re = createResourceEnforcer({
      maxTokensPerRequest: 100,
    });

    const result = re.checkLimits('session-1', {
      isConcurrent: false,
      estimatedInputTokens: 80,
      estimatedOutputTokens: 30, // Total 110 > 100
    });

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.limitType).toBe('tokens-per-request');
    }
  });

  it('should track concurrent requests', () => {
    const re = createResourceEnforcer({
      maxConcurrentRequests: 2,
    });

    re.startRequest('session-1');
    re.startRequest('session-1');

    const usage = re.getUsage('session-1');
    expect(usage.concurrentRequests).toBe(2);

    re.endRequest('session-1');
    const usageAfter = re.getUsage('session-1');
    expect(usageAfter.concurrentRequests).toBe(1);
  });

  it('should block when concurrency exceeded', () => {
    const re = createResourceEnforcer({
      maxConcurrentRequests: 2,
    });

    re.startRequest('session-1');
    re.startRequest('session-1');

    const result = re.checkLimits('session-1', { isConcurrent: true });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.limitType).toBe('concurrency');
    }
  });

  it('strict mode should throw on limit exceeded', () => {
    const re = createStrictResourceEnforcer({
      maxTokensPerRequest: 50,
    });

    expect(() => {
      re.checkLimits('session-1', {
        isConcurrent: false,
        estimatedInputTokens: 100,
      });
    }).toThrow(ResourceEnforcerError);
  });

  it('should reset session usage', () => {
    const re = createResourceEnforcer();

    re.recordUsage('session-1', 100, 50, 500);
    expect(re.getUsage('session-1').requestCount).toBe(1);

    re.resetUsage('session-1');
    // After reset, getting usage creates a new one with zero values
    expect(re.getUsage('session-1').requestCount).toBe(0);
  });

  it('should list active sessions', () => {
    const re = createResourceEnforcer();

    re.recordUsage('session-1', 100, 50, 500);
    re.recordUsage('session-2', 100, 50, 500);

    const sessions = re.getActiveSessions();
    expect(sessions).toContain('session-1');
    expect(sessions).toContain('session-2');
  });
});

describe('Metrics Collector', () => {
  let mc: ReturnType<typeof createMetricsCollector>;

  beforeEach(() => {
    mc = createMetricsCollector();
  });

  it('should record request metrics', () => {
    mc.recordRequest({
      timestamp: new Date().toISOString(),
      providerId: 'claude',
      operation: 'complete',
      success: true,
      durationMs: 1500,
      inputTokens: 100,
      outputTokens: 200,
    });

    const metrics = mc.getRequestMetrics();
    expect(metrics.length).toBe(1);
    expect(metrics[0]?.providerId).toBe('claude');
  });

  it('should record error metrics', () => {
    mc.recordError({
      timestamp: new Date().toISOString(),
      code: 'RATE_LIMIT',
      message: 'Rate limit exceeded',
      providerId: 'claude',
      recoverable: true,
    });

    const errors = mc.getErrorMetrics();
    expect(errors.length).toBe(1);
    expect(errors[0]?.code).toBe('RATE_LIMIT');
  });

  it('should compute stats correctly', () => {
    // Record some requests
    mc.recordRequest({
      timestamp: new Date().toISOString(),
      providerId: 'claude',
      operation: 'complete',
      success: true,
      durationMs: 1000,
      inputTokens: 100,
      outputTokens: 200,
    });

    mc.recordRequest({
      timestamp: new Date().toISOString(),
      providerId: 'claude',
      operation: 'complete',
      success: true,
      durationMs: 2000,
      inputTokens: 150,
      outputTokens: 250,
    });

    mc.recordRequest({
      timestamp: new Date().toISOString(),
      providerId: 'gemini',
      operation: 'complete',
      success: false,
      durationMs: 500,
    });

    const stats = mc.getStats();
    expect(stats.requests.total).toBe(3);
    expect(stats.requests.success).toBe(2);
    expect(stats.requests.failure).toBe(1);
    expect(stats.tokens.input).toBe(250);
    expect(stats.tokens.output).toBe(450);
  });

  it('should track per-provider breakdown', () => {
    mc.recordRequest({
      timestamp: new Date().toISOString(),
      providerId: 'claude',
      operation: 'complete',
      success: true,
      durationMs: 1000,
      inputTokens: 100,
      outputTokens: 200,
    });

    mc.recordRequest({
      timestamp: new Date().toISOString(),
      providerId: 'gemini',
      operation: 'complete',
      success: true,
      durationMs: 800,
      inputTokens: 50,
      outputTokens: 100,
    });

    const stats = mc.getStats();
    expect(stats.byProvider.claude?.requests).toBe(1);
    expect(stats.byProvider.gemini?.requests).toBe(1);
    expect(stats.byProvider.claude?.tokens).toBe(300);
    expect(stats.byProvider.gemini?.tokens).toBe(150);
  });

  it('should reset all metrics', () => {
    mc.recordRequest({
      timestamp: new Date().toISOString(),
      providerId: 'claude',
      operation: 'complete',
      success: true,
      durationMs: 1000,
    });

    mc.reset();

    const stats = mc.getStats();
    expect(stats.requests.total).toBe(0);
    expect(mc.getRequestMetrics().length).toBe(0);
  });

  it('should limit stored metrics', () => {
    const smallMc = createMetricsCollector({
      maxRequestMetrics: 5,
      maxErrorMetrics: 3,
    });

    // Record more than the limit
    for (let i = 0; i < 10; i++) {
      smallMc.recordRequest({
        timestamp: new Date().toISOString(),
        providerId: 'claude',
        operation: 'complete',
        success: true,
        durationMs: 1000,
      });
    }

    const metrics = smallMc.getRequestMetrics();
    expect(metrics.length).toBe(5);
  });
});
