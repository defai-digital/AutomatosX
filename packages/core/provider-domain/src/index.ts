/**
 * @automatosx/provider-domain
 *
 * Provider Resilience Domain
 *
 * Provides circuit breaker, rate limiting, and health monitoring
 * for intelligent provider management and fault tolerance.
 */

// Circuit Breaker
export {
  createCircuitBreaker,
  CircuitBreakerError,
  type CircuitBreaker,
  type CircuitEventListener,
} from './circuit-breaker.js';

// Rate Limiter
export {
  createRateLimiter,
  RateLimitError,
  type RateLimiter,
  type RateLimitEventListener,
} from './rate-limiter.js';

// Health Monitor
export {
  createHealthMonitor,
  HealthMonitorError,
  type HealthMonitor,
  type HealthEventListener,
  type HealthCheckFn,
} from './health-monitor.js';

// Provider Manager
export {
  createManagedProvider,
  createProviderManager,
  type ProviderConfig,
  type ManagedProvider,
  type ProviderManager,
} from './provider-manager.js';
