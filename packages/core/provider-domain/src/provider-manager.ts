/**
 * Provider Manager
 *
 * Integrates circuit breaker, rate limiter, and health monitor
 * to provide unified provider resilience management.
 *
 * This is the main entry point for provider resilience features.
 */

import type {
  CircuitBreakerConfig,
  RateLimitConfig,
  HealthCheckConfig,
  HealthStatus,
} from '@automatosx/contracts';

import {
  createCircuitBreaker,
  CircuitBreaker,
  CircuitBreakerError,
} from './circuit-breaker.js';
import {
  createRateLimiter,
  RateLimiter,
  RateLimitError,
} from './rate-limiter.js';
import {
  createHealthMonitor,
  HealthMonitor,
  HealthCheckFn,
} from './health-monitor.js';

/**
 * Provider configuration
 */
export interface ProviderConfig {
  /** Provider identifier */
  providerId: string;

  /** Circuit breaker configuration */
  circuitBreaker?: Partial<CircuitBreakerConfig>;

  /** Rate limiter configuration */
  rateLimiter?: Partial<RateLimitConfig>;

  /** Health monitor configuration */
  healthMonitor?: Partial<HealthCheckConfig>;

  /** Health check function for active checks */
  healthCheckFn?: HealthCheckFn;
}

/**
 * Managed provider with resilience features
 */
export interface ManagedProvider {
  /** Provider identifier */
  readonly providerId: string;

  /** Circuit breaker instance */
  readonly circuitBreaker: CircuitBreaker;

  /** Rate limiter instance */
  readonly rateLimiter: RateLimiter;

  /** Health monitor instance */
  readonly healthMonitor: HealthMonitor;

  /** Check if provider can handle a request */
  canExecute(tokens?: number): boolean;

  /** Execute a request with resilience wrapping */
  execute<T>(fn: () => Promise<T>, tokens?: number): Promise<T>;

  /** Get combined health status */
  getHealth(): HealthStatus;

  /** Reset all resilience state */
  reset(): void;
}

/**
 * Provider manager for multiple providers
 */
export interface ProviderManager {
  /** Register a provider */
  register(config: ProviderConfig): ManagedProvider;

  /** Get a registered provider */
  get(providerId: string): ManagedProvider | undefined;

  /** List all registered providers */
  list(): ManagedProvider[];

  /** Get health status for all providers */
  getHealthAll(): Map<string, HealthStatus>;

  /** Get the healthiest available provider */
  selectBest(providerIds?: string[]): ManagedProvider | undefined;

  /** Remove a provider */
  remove(providerId: string): boolean;

  /** Reset all providers */
  resetAll(): void;
}

/**
 * Creates a managed provider with integrated resilience
 */
export function createManagedProvider(config: ProviderConfig): ManagedProvider {
  const {
    providerId,
    circuitBreaker: cbConfig,
    rateLimiter: rlConfig,
    healthMonitor: hmConfig,
    healthCheckFn,
  } = config;

  const circuitBreaker = createCircuitBreaker(providerId, cbConfig);
  const rateLimiter = createRateLimiter(providerId, rlConfig);
  const healthMonitor = createHealthMonitor(providerId, hmConfig, healthCheckFn);

  // Sync circuit breaker state to health monitor
  const originalRecordSuccess = circuitBreaker.recordSuccess.bind(circuitBreaker);
  const originalRecordFailure = circuitBreaker.recordFailure.bind(circuitBreaker);

  circuitBreaker.recordSuccess = () => {
    originalRecordSuccess();
    healthMonitor.updateCircuitState(circuitBreaker.getState().state);
  };

  circuitBreaker.recordFailure = (error?: string) => {
    originalRecordFailure(error);
    healthMonitor.updateCircuitState(circuitBreaker.getState().state);
  };

  // Sync rate limiter state to health monitor
  const originalTryConsume = rateLimiter.tryConsume.bind(rateLimiter);
  rateLimiter.tryConsume = (tokens?: number) => {
    const result = originalTryConsume(tokens);
    healthMonitor.updateRateLimitState(rateLimiter.getState().state);
    return result;
  };

  return {
    providerId,
    circuitBreaker,
    rateLimiter,
    healthMonitor,

    canExecute(tokens = 1): boolean {
      return circuitBreaker.canExecute() && rateLimiter.canRequest(tokens);
    },

    async execute<T>(fn: () => Promise<T>, tokens = 1): Promise<T> {
      // Check circuit breaker
      if (!circuitBreaker.canExecute()) {
        throw CircuitBreakerError.circuitOpen(providerId);
      }

      // Check rate limiter
      if (!rateLimiter.tryConsume(tokens)) {
        const waitTime = rateLimiter.getWaitTime(tokens);
        throw RateLimitError.exceeded(providerId, waitTime);
      }

      const startTime = Date.now();

      try {
        const result = await fn();
        const latencyMs = Date.now() - startTime;

        // Record success
        circuitBreaker.recordSuccess();
        healthMonitor.recordSuccess(latencyMs);

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        // Check if it's a rate limit error from the API
        if (isRateLimitError(error)) {
          const retryAfter = extractRetryAfter(error);
          rateLimiter.recordExternalLimit(retryAfter);
          healthMonitor.recordFailure(errorMessage, 'RATE_LIMIT');
          throw RateLimitError.exceeded(providerId, retryAfter);
        }

        // Record failure
        circuitBreaker.recordFailure(errorMessage);
        healthMonitor.recordFailure(errorMessage);

        throw error;
      }
    },

    getHealth(): HealthStatus {
      return healthMonitor.getStatus();
    },

    reset(): void {
      circuitBreaker.reset();
      rateLimiter.reset();
      healthMonitor.reset();
    },
  };
}

/**
 * Creates a provider manager
 */
export function createProviderManager(): ProviderManager {
  const providers = new Map<string, ManagedProvider>();

  return {
    register(config: ProviderConfig): ManagedProvider {
      const provider = createManagedProvider(config);
      providers.set(config.providerId, provider);
      return provider;
    },

    get(providerId: string): ManagedProvider | undefined {
      return providers.get(providerId);
    },

    list(): ManagedProvider[] {
      return Array.from(providers.values());
    },

    getHealthAll(): Map<string, HealthStatus> {
      const healthMap = new Map<string, HealthStatus>();
      providers.forEach((provider, id) => {
        healthMap.set(id, provider.getHealth());
      });
      return healthMap;
    },

    selectBest(providerIds?: string[]): ManagedProvider | undefined {
      const candidates = providerIds
        ? providerIds
            .map((id) => providers.get(id))
            .filter((p): p is ManagedProvider => p !== undefined)
        : Array.from(providers.values());

      // Filter to available providers
      const available = candidates.filter((p) => {
        const health = p.getHealth();
        return health.available && p.canExecute();
      });

      if (available.length === 0) return undefined;

      // Sort by health score (lower latency, lower error rate = better)
      available.sort((a, b) => {
        const healthA = a.getHealth();
        const healthB = b.getHealth();

        // Prefer healthy over degraded
        if (healthA.level === 'healthy' && healthB.level !== 'healthy') return -1;
        if (healthB.level === 'healthy' && healthA.level !== 'healthy') return 1;

        // Then by error rate
        const errorDiff = healthA.errorRate - healthB.errorRate;
        if (Math.abs(errorDiff) > 0.1) return errorDiff;

        // Then by latency
        return healthA.latencyMs - healthB.latencyMs;
      });

      return available[0];
    },

    remove(providerId: string): boolean {
      const provider = providers.get(providerId);
      if (provider) {
        provider.reset();
        providers.delete(providerId);
        return true;
      }
      return false;
    },

    resetAll(): void {
      providers.forEach((provider) => {
        provider.reset();
      });
    },
  };
}

/**
 * Helper to detect rate limit errors
 */
function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('429')
    );
  }
  return false;
}

/**
 * Helper to extract retry-after from error
 */
function extractRetryAfter(error: unknown): number | undefined {
  if (error instanceof Error) {
    // Try to extract from error message or properties
    const match = error.message.match(/retry[- ]?after[:\s]*(\d+)/i);
    if (match && match[1]) {
      return parseInt(match[1], 10) * 1000; // Convert to ms
    }
  }
  return undefined;
}
