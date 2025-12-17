/**
 * Internal re-export of resilience contracts
 *
 * This file provides a stable import path for resilience contracts
 * that works in both build and test environments.
 *
 * It imports from the main @automatosx/contracts and re-exports with
 * the canonical names for internal use.
 */

// Import circuit breaker with prefixed names from main contracts
export {
  ResilienceCircuitBreakerStateSchema as CircuitBreakerStateSchema,
  ResilienceCircuitBreakerConfigSchema as CircuitBreakerConfigSchema,
  ResilienceCircuitBreakerStatsSchema as CircuitBreakerStatsSchema,
  ResilienceCircuitBreakerEventSchema as CircuitBreakerEventSchema,
  ResilienceCircuitBreakerErrorCodes as CircuitBreakerErrorCodes,
  createDefaultResilienceCircuitBreakerConfig as createDefaultCircuitBreakerConfig,
  createResilienceCircuitBreakerStats as createCircuitBreakerStats,
  type ResilienceCircuitBreakerState as CircuitBreakerState,
  type ResilienceCircuitBreakerConfig as CircuitBreakerConfig,
  type ResilienceCircuitBreakerStats as CircuitBreakerStats,
  type ResilienceCircuitBreakerEvent as CircuitBreakerEvent,
  type ResilienceCircuitBreakerErrorCode as CircuitBreakerErrorCode,
  // Rate Limiter (unique names)
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
  type RateLimiterConfig,
  type RateLimiterStats,
  type RateLimiterAcquireResult,
  type RateLimiterErrorCode,
  // Loop Guard (unique names)
  LoopGuardConfigSchema,
  LoopGuardContextSchema,
  LoopGuardResultSchema,
  LoopGuardErrorCodes,
  validateLoopGuardConfig,
  safeValidateLoopGuardConfig,
  createDefaultLoopGuardConfig,
  createLoopGuardContext,
  type LoopGuardConfig,
  type LoopGuardContext,
  type LoopGuardResult,
  type LoopGuardErrorCode,
  // Resource Limits (unique names, but ResourceUsage renamed)
  ResourceLimitsConfigSchema,
  ResilienceResourceUsageSchema as ResourceUsageSchema,
  ResourceCheckResultSchema,
  ResourceRequestInfoSchema,
  ResourceLimitsErrorCodes,
  validateResourceLimitsConfig,
  safeValidateResourceLimitsConfig,
  createDefaultResourceLimitsConfig,
  createResilienceResourceUsage as createResourceUsage,
  estimateCost,
  type ResourceLimitsConfig,
  type ResilienceResourceUsage as ResourceUsage,
  type ResourceCheckResult,
  type ResourceRequestInfo,
  type ResourceLimitsErrorCode,
  // Metrics (unique names)
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
  type MetricsTimeRange,
  type RequestMetric,
  type ErrorMetric,
  type LatencyStats,
  type MetricsSnapshot,
} from '@automatosx/contracts';
