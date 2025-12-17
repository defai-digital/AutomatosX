/**
 * Resilience Contracts v1
 *
 * Production-grade resilience patterns: circuit breaker, rate limiter,
 * loop guard, resource limits, and metrics.
 */

// Circuit Breaker
export {
  CircuitBreakerStateSchema,
  CircuitBreakerConfigSchema,
  CircuitBreakerStatsSchema,
  CircuitBreakerEventSchema,
  CircuitBreakerErrorCodes,
  validateCircuitBreakerConfig,
  safeValidateCircuitBreakerConfig,
  createDefaultCircuitBreakerConfig,
  createCircuitBreakerStats,
} from './circuit-breaker.js';

export type {
  CircuitBreakerState,
  CircuitBreakerConfig,
  CircuitBreakerStats,
  CircuitBreakerEvent,
  CircuitBreakerErrorCode,
} from './circuit-breaker.js';

// Rate Limiter
export {
  RateLimiterConfigSchema,
  RateLimiterStatsSchema,
  RateLimiterAcquireResultSchema,
  RateLimiterErrorCodes,
  validateRateLimiterConfig,
  safeValidateRateLimiterConfig,
  createDefaultRateLimiterConfig,
  createRateLimiterStats,
  DEFAULT_TOKEN_WINDOW_MS,
  DEFAULT_CHECK_INTERVAL_MS,
  TIME_MULTIPLIERS,
  DEFAULT_TIME_RANGE_MS,
} from './rate-limiter.js';

export type {
  RateLimiterConfig,
  RateLimiterStats,
  RateLimiterAcquireResult,
  RateLimiterErrorCode,
} from './rate-limiter.js';

// Loop Guard
export {
  LoopGuardConfigSchema,
  LoopGuardContextSchema,
  LoopGuardResultSchema,
  LoopGuardErrorCodes,
  validateLoopGuardConfig,
  safeValidateLoopGuardConfig,
  createDefaultLoopGuardConfig,
  createLoopGuardContext,
} from './loop-guard.js';

export type {
  LoopGuardConfig,
  LoopGuardContext,
  LoopGuardResult,
  LoopGuardErrorCode,
} from './loop-guard.js';

// Resource Limits
export {
  ResourceLimitsConfigSchema,
  ResourceUsageSchema,
  ResourceCheckResultSchema,
  ResourceRequestInfoSchema,
  ResourceLimitsErrorCodes,
  validateResourceLimitsConfig,
  safeValidateResourceLimitsConfig,
  createDefaultResourceLimitsConfig,
  createResourceUsage,
  estimateCost,
} from './resource-limits.js';

export type {
  ResourceLimitsConfig,
  ResourceUsage,
  ResourceCheckResult,
  ResourceRequestInfo,
  ResourceLimitsErrorCode,
} from './resource-limits.js';

// Metrics
export {
  MetricsTimeRangeSchema,
  RequestMetricSchema,
  ErrorMetricSchema,
  LatencyStatsSchema,
  MetricsSnapshotSchema,
  validateRequestMetric,
  validateErrorMetric,
  validateMetricsSnapshot,
  createEmptyMetricsSnapshot,
  createRequestMetric,
  createErrorMetric,
} from './metrics.js';

export type {
  MetricsTimeRange,
  RequestMetric,
  ErrorMetric,
  LatencyStats,
  MetricsSnapshot,
} from './metrics.js';
