/**
 * Resilience Domain
 *
 * Production-ready resilience patterns for LLM operations:
 * - Circuit Breaker: Prevents cascade failures
 * - Rate Limiter: Token bucket rate limiting
 * - Loop Guard: Prevents infinite loops
 * - Resource Enforcer: Enforces token/cost/time limits
 * - Metrics Collector: Basic observability
 */

// Circuit Breaker
export {
  CircuitBreaker,
  CircuitBreakerError,
  CircuitBreakerListener,
  createCircuitBreaker,
} from './circuit-breaker.js';

// Rate Limiter
export {
  RateLimiter,
  RateLimiterError,
  createRateLimiter,
} from './rate-limiter.js';

// Loop Guard
export {
  LoopGuard,
  LoopGuardError,
  LoopGuardWarningListener,
  createLoopGuard,
  createStrictLoopGuard,
} from './loop-guard.js';

// Resource Enforcer
export {
  ResourceEnforcer,
  ResourceEnforcerError,
  createResourceEnforcer,
  createStrictResourceEnforcer,
} from './resource-enforcer.js';

// Metrics Collector
export {
  MetricsCollector,
  MetricsCollectorConfig,
  createMetricsCollector,
  getGlobalMetrics,
  resetGlobalMetrics,
} from './metrics-collector.js';
