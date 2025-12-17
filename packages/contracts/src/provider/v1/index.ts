/**
 * Provider Contract V1
 *
 * Contracts for provider resilience patterns including
 * circuit breaker, rate limiting, and health monitoring.
 *
 * Also includes provider port interfaces for Ports & Adapters pattern.
 */

// Provider Port Interfaces
export {
  ProviderMessageSchema,
  ProviderRequestSchema,
  ProviderResponseSchema,
  ModelInfoSchema,
  validateProviderRequest,
  validateProviderResponse,
  safeValidateProviderRequest,
  createProviderSuccessResponse,
  createProviderErrorResponse,
  type ProviderMessage,
  type ProviderRequest,
  type ProviderResponse,
  type ModelInfo,
  type ProviderPort,
  type ProviderRegistryPort,
} from './port.js';

// Circuit Breaker
export {
  CircuitStateSchema,
  CircuitBreakerConfigSchema,
  CircuitBreakerStateSchema,
  CircuitBreakerEventTypeSchema,
  CircuitBreakerEventSchema,
  CircuitBreakerErrorCodes,
  validateCircuitBreakerConfig,
  validateCircuitBreakerState,
  createDefaultCircuitBreakerConfig,
  createInitialCircuitBreakerState,
  type CircuitState,
  type CircuitBreakerConfig,
  type CircuitBreakerState,
  type CircuitBreakerEventType,
  type CircuitBreakerEvent,
  type CircuitBreakerErrorCode,
} from './circuit-breaker.js';

// Rate Limiting
export {
  RateLimitStrategySchema,
  RateLimitStateEnumSchema,
  RateLimitConfigSchema,
  RateLimitStateSchema,
  RateLimitResultSchema,
  RateLimitEventTypeSchema,
  RateLimitEventSchema,
  RateLimitErrorCodes,
  validateRateLimitConfig,
  validateRateLimitState,
  createDefaultRateLimitConfig,
  createInitialRateLimitState,
  type RateLimitStrategy,
  type RateLimitStateEnum,
  type RateLimitConfig,
  type RateLimitState,
  type RateLimitResult,
  type RateLimitEventType,
  type RateLimitEvent,
  type RateLimitErrorCode,
} from './rate-limit.js';

// Health Monitoring
export {
  HealthCheckConfigSchema,
  HealthLevelSchema,
  HealthStatusSchema,
  HealthCheckResultSchema,
  HealthEventTypeSchema,
  HealthEventSchema,
  HealthErrorCodes,
  validateHealthCheckConfig,
  validateHealthStatus,
  createDefaultHealthCheckConfig,
  createInitialHealthStatus,
  calculatePercentile,
  type HealthCheckConfig,
  type HealthLevel,
  type HealthStatus,
  type HealthCheckResult,
  type HealthEventType,
  type HealthEvent,
  type HealthErrorCode,
} from './health.js';
