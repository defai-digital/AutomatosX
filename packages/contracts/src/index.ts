/**
 * @automatosx/contracts
 *
 * Contract schemas and behavioral invariants - Single Source of Truth
 * All external behavior must be defined by these explicit contracts.
 */

// Workflow Contract V1
export * from './workflow/v1/index.js';

// MCP Tool Contract V1
export * from './mcp/v1/index.js';

// Routing Decision Contract V1
export * from './routing/v1/index.js';

// Memory Event Contract V1
export * from './memory/v1/index.js';

// Trace Event Contract V1
export * from './trace/v1/index.js';

// Guard Policy Contract V1
export * from './guard/v1/index.js';

// Agent Contract V1
export * from './agent/v1/index.js';

// Session Contract V1
export * from './session/v1/index.js';

// Token Budget Contract V1
export * from './token-budget/v1/index.js';

// Config Contract V1
export * from './config/v1/index.js';

// Ability Contract V1
export * from './ability/v1/index.js';

// Bugfix Contract V1
export * from './bugfix/v1/index.js';

// Refactor Contract V1
export * from './refactor/v1/index.js';

// Design Contract V1
export * from './design/v1/index.js';

// Orchestration Contract V1
export * from './orchestration/v1/index.js';

// Telemetry Contract V1
export * from './telemetry/v1/index.js';

// Provider Contract V1
export * from './provider/v1/index.js';

// Cross-Cutting Contract V1
export * from './cross-cutting/v1/index.js';

// Context Contract V1
export * from './context/v1/index.js';

// Iterate Mode Contract V1
export * from './iterate/v1/index.js';

// CLI Contract V1
export * from './cli/v1/index.js';

// Analysis Contract V1
export * from './analysis/v1/index.js';

// Resilience Contract V1 (selective exports to avoid conflicts)
export {
  // Circuit Breaker (prefixed to avoid conflict with provider/v1)
  CircuitBreakerStateSchema as ResilienceCircuitBreakerStateSchema,
  CircuitBreakerConfigSchema as ResilienceCircuitBreakerConfigSchema,
  CircuitBreakerStatsSchema as ResilienceCircuitBreakerStatsSchema,
  CircuitBreakerEventSchema as ResilienceCircuitBreakerEventSchema,
  CircuitBreakerErrorCodes as ResilienceCircuitBreakerErrorCodes,
  createDefaultCircuitBreakerConfig as createDefaultResilienceCircuitBreakerConfig,
  createCircuitBreakerStats as createResilienceCircuitBreakerStats,
  type CircuitBreakerState as ResilienceCircuitBreakerState,
  type CircuitBreakerConfig as ResilienceCircuitBreakerConfig,
  type CircuitBreakerStats as ResilienceCircuitBreakerStats,
  type CircuitBreakerEvent as ResilienceCircuitBreakerEvent,
  type CircuitBreakerErrorCode as ResilienceCircuitBreakerErrorCode,
  // Rate Limiter (unique to resilience)
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
  // Loop Guard (unique to resilience)
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
  // Resource Limits (unique to resilience - uses different schema than guard)
  ResourceLimitsConfigSchema,
  ResourceCheckResultSchema,
  ResourceRequestInfoSchema,
  ResourceLimitsErrorCodes,
  validateResourceLimitsConfig,
  safeValidateResourceLimitsConfig,
  createDefaultResourceLimitsConfig,
  estimateCost,
  type ResourceLimitsConfig,
  type ResourceCheckResult,
  type ResourceRequestInfo,
  type ResourceLimitsErrorCode,
  // Metrics (unique exports)
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
} from './resilience/v1/index.js';

// Re-export resilience-specific ResourceUsage with unique name
export {
  ResourceUsageSchema as ResilienceResourceUsageSchema,
  createResourceUsage as createResilienceResourceUsage,
  type ResourceUsage as ResilienceResourceUsage,
} from './resilience/v1/index.js';

// Storage Contract V1
export * from './storage/v1/index.js';

// Version exports for contract versioning
export const CONTRACT_VERSIONS = {
  workflow: 'v1',
  mcp: 'v1',
  routing: 'v1',
  memory: 'v1',
  trace: 'v1',
  guard: 'v1',
  agent: 'v1',
  session: 'v1',
  tokenBudget: 'v1',
  config: 'v1',
  ability: 'v1',
  bugfix: 'v1',
  refactor: 'v1',
  design: 'v1',
  orchestration: 'v1',
  telemetry: 'v1',
  provider: 'v1',
  crossCutting: 'v1',
  context: 'v1',
  iterate: 'v1',
  cli: 'v1',
  analysis: 'v1',
  resilience: 'v1',
  storage: 'v1',
} as const;
