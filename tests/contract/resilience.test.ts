/**
 * Resilience Contracts Tests
 *
 * Tests for resilience pattern contracts: circuit breaker, rate limiter,
 * loop guard, resource limits, and metrics.
 */

import { describe, it, expect } from 'vitest';
import {
  // Rate Limiter
  RateLimiterConfigSchema,
  RateLimiterStatsSchema,
  createDefaultRateLimiterConfig,
  validateRateLimiterConfig,
  // Loop Guard
  LoopGuardConfigSchema,
  LoopGuardContextSchema,
  LoopGuardResultSchema,
  createDefaultLoopGuardConfig,
  createLoopGuardContext,
  validateLoopGuardConfig,
  // Resource Limits
  ResourceLimitsConfigSchema,
  createDefaultResourceLimitsConfig,
  validateResourceLimitsConfig,
  estimateCost,
  // Metrics
  MetricsTimeRangeSchema,
  RequestMetricSchema,
  ErrorMetricSchema,
  MetricsSnapshotSchema,
  createRequestMetric,
  createErrorMetric,
  createEmptyMetricsSnapshot,
} from '@automatosx/contracts';

describe('Rate Limiter Contracts', () => {
  it('should validate default config', () => {
    const config = createDefaultRateLimiterConfig();
    const result = RateLimiterConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('should validate custom config', () => {
    const config = {
      requestsPerMinute: 120,
      tokensPerMinute: 100000,
      maxQueueSize: 50,
      queueTimeoutMs: 15000,
      burstMultiplier: 2,
    };
    const result = validateRateLimiterConfig(config);
    expect(result.requestsPerMinute).toBe(120);
  });

  it('should reject invalid config', () => {
    const config = {
      requestsPerMinute: -1, // Invalid
    };
    const result = RateLimiterConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('should validate stats schema', () => {
    const stats = {
      requestsAllowed: 100,
      requestsRejected: 5,
      queueSize: 0,
      tokensUsed: 50000,
      availableCapacity: 45,
      nextRefillMs: 1000,
      windowStart: new Date().toISOString(),
    };
    const result = RateLimiterStatsSchema.safeParse(stats);
    expect(result.success).toBe(true);
  });
});

describe('Loop Guard Contracts', () => {
  it('should validate default config', () => {
    const config = createDefaultLoopGuardConfig();
    const result = LoopGuardConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('should create loop guard context', () => {
    const context = createLoopGuardContext('test-context');
    expect(context.contextId).toBe('test-context');
    expect(context.iterations).toBe(0);
    expect(context.elapsedMs).toBe(0);
    expect(context.warningIssued).toBe(false);
  });

  it('should validate loop guard result - ok', () => {
    const result = {
      status: 'ok',
      iteration: 1,
      elapsedMs: 100,
    };
    const parseResult = LoopGuardResultSchema.safeParse(result);
    expect(parseResult.success).toBe(true);
  });

  it('should validate loop guard result - warning', () => {
    const result = {
      status: 'warning',
      iteration: 50,
      elapsedMs: 10000,
      message: 'Approaching iteration limit',
      warningType: 'iteration',
    };
    const parseResult = LoopGuardResultSchema.safeParse(result);
    expect(parseResult.success).toBe(true);
  });

  it('should validate loop guard result - blocked', () => {
    const result = {
      status: 'blocked',
      iteration: 100,
      elapsedMs: 300000,
      reason: 'Maximum iterations exceeded',
      blockType: 'max-iterations',
    };
    const parseResult = LoopGuardResultSchema.safeParse(result);
    expect(parseResult.success).toBe(true);
  });

  it('should validate custom config', () => {
    const config = {
      maxIterations: 200,
      warnAtIterations: 100,
      maxDurationMs: 600000,
      warnAtDurationMs: 300000,
    };
    const result = validateLoopGuardConfig(config);
    expect(result.maxIterations).toBe(200);
  });
});

describe('Resource Limits Contracts', () => {
  it('should validate default config', () => {
    const config = createDefaultResourceLimitsConfig();
    const result = ResourceLimitsConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('should validate custom config', () => {
    const config = {
      maxTokensPerRequest: 50000,
      maxTokensPerSession: 500000,
      maxDurationMs: 600000,
      maxCostPerSession: 20,
      maxConcurrentRequests: 10,
      costPer1kInputTokens: 0.005,
      costPer1kOutputTokens: 0.02,
    };
    const result = validateResourceLimitsConfig(config);
    expect(result.maxTokensPerRequest).toBe(50000);
  });

  it('should estimate cost correctly', () => {
    const config = createDefaultResourceLimitsConfig();
    const cost = estimateCost(1000, 500, config);
    // 1000 * 0.003 / 1000 + 500 * 0.015 / 1000 = 0.003 + 0.0075 = 0.0105
    expect(cost).toBeCloseTo(0.0105, 4);
  });
});

describe('Metrics Contracts', () => {
  it('should validate time range', () => {
    const timeRange = {
      start: '-1h',
      end: 'now',
    };
    const result = MetricsTimeRangeSchema.safeParse(timeRange);
    expect(result.success).toBe(true);
  });

  it('should validate time range with ISO dates', () => {
    const timeRange = {
      start: '2024-01-01T00:00:00Z',
      end: '2024-01-01T01:00:00Z',
    };
    const result = MetricsTimeRangeSchema.safeParse(timeRange);
    expect(result.success).toBe(true);
  });

  it('should create request metric', () => {
    const metric = createRequestMetric('claude', 'complete', true, 1500);
    expect(metric.providerId).toBe('claude');
    expect(metric.operation).toBe('complete');
    expect(metric.success).toBe(true);
    expect(metric.durationMs).toBe(1500);
    expect(metric.timestamp).toBeDefined();
  });

  it('should create error metric', () => {
    const metric = createErrorMetric('RATE_LIMIT', 'Rate limit exceeded', {
      providerId: 'claude',
      operation: 'complete',
      recoverable: true,
    });
    expect(metric.code).toBe('RATE_LIMIT');
    expect(metric.message).toBe('Rate limit exceeded');
    expect(metric.recoverable).toBe(true);
  });

  it('should validate request metric schema', () => {
    const metric = {
      timestamp: new Date().toISOString(),
      providerId: 'claude',
      operation: 'complete',
      success: true,
      durationMs: 1500,
      inputTokens: 100,
      outputTokens: 200,
      estimatedCost: 0.01,
    };
    const result = RequestMetricSchema.safeParse(metric);
    expect(result.success).toBe(true);
  });

  it('should validate error metric schema', () => {
    const metric = {
      timestamp: new Date().toISOString(),
      code: 'NETWORK_ERROR',
      message: 'Connection timeout',
      providerId: 'gemini',
      operation: 'complete',
      recoverable: true,
    };
    const result = ErrorMetricSchema.safeParse(metric);
    expect(result.success).toBe(true);
  });

  it('should create empty metrics snapshot', () => {
    const snapshot = createEmptyMetricsSnapshot();
    expect(snapshot.requests.total).toBe(0);
    expect(snapshot.requests.success).toBe(0);
    expect(snapshot.requests.failure).toBe(0);
    expect(snapshot.requests.successRate).toBe(1);
    expect(snapshot.latency.count).toBe(0);
    expect(snapshot.tokens.total).toBe(0);
    expect(snapshot.cost.estimated).toBe(0);
    expect(Object.keys(snapshot.errors)).toHaveLength(0);
    expect(Object.keys(snapshot.byProvider)).toHaveLength(0);
  });

  it('should validate metrics snapshot schema', () => {
    const snapshot = createEmptyMetricsSnapshot({ start: '-1h', end: 'now' });
    const result = MetricsSnapshotSchema.safeParse(snapshot);
    expect(result.success).toBe(true);
  });
});
