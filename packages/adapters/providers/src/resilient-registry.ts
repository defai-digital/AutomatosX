/**
 * Resilient Provider Registry
 *
 * Wraps the provider registry with production-grade resilience patterns:
 * - Circuit Breaker: Prevents cascade failures
 * - Rate Limiter: Prevents API limit violations
 * - Metrics: Records request metrics for observability
 */

import type {
  LLMProvider,
  CompletionRequest,
  CompletionResponse,
  HealthCheckResult,
  ModelConfig,
  ClassifiedError,
} from './types.js';
import { ProviderRegistry, createProviderRegistry as createBaseRegistry } from './registry.js';
import {
  createCircuitBreaker,
  createRateLimiter,
  createMetricsCollector,
  type CircuitBreaker,
  type RateLimiter,
  type MetricsCollector,
} from '@automatosx/resilience-domain';
import {
  type CircuitBreakerConfig,
  type RateLimiterConfig,
} from '@automatosx/contracts/resilience/v1';
import {
  CIRCUIT_FAILURE_THRESHOLD,
  CIRCUIT_RESET_TIMEOUT,
  CIRCUIT_FAILURE_WINDOW,
  CIRCUIT_QUEUE_TIMEOUT,
  RATE_LIMIT_RPM_DEFAULT,
  RETRY_DELAY_DEFAULT,
} from '@automatosx/contracts';

/**
 * Configuration for resilient provider registry
 */
export interface ResilientRegistryConfig {
  /** Circuit breaker configuration (per provider) */
  circuitBreaker?: Partial<CircuitBreakerConfig>;

  /** Rate limiter configuration (global) */
  rateLimiter?: Partial<RateLimiterConfig>;

  /** Enable metrics collection */
  enableMetrics?: boolean;
}

const DEFAULT_CONFIG: Required<ResilientRegistryConfig> = {
  circuitBreaker: {
    failureThreshold: CIRCUIT_FAILURE_THRESHOLD,
    resetTimeoutMs: CIRCUIT_RESET_TIMEOUT,
    halfOpenMaxAttempts: 1,
    failureWindowMs: CIRCUIT_FAILURE_WINDOW,
  },
  rateLimiter: {
    requestsPerMinute: RATE_LIMIT_RPM_DEFAULT,
    maxQueueSize: 100,
    queueTimeoutMs: CIRCUIT_QUEUE_TIMEOUT,
    burstMultiplier: 1.5,
  },
  enableMetrics: true,
};

/**
 * Provider with resilience patterns
 */
interface ResilientProvider {
  provider: LLMProvider;
  circuitBreaker: CircuitBreaker;
}

/**
 * Resilient provider registry that wraps calls with circuit breaker and rate limiting
 */
export class ResilientProviderRegistry {
  private readonly baseRegistry: ProviderRegistry;
  private readonly resilientProviders = new Map<string, ResilientProvider>();
  private readonly rateLimiter: RateLimiter;
  private readonly metrics: MetricsCollector | null;
  private readonly config: Required<ResilientRegistryConfig>;

  constructor(
    baseRegistry: ProviderRegistry,
    config?: ResilientRegistryConfig
  ) {
    this.baseRegistry = baseRegistry;
    // Deep merge config to preserve nested defaults
    this.config = {
      circuitBreaker: {
        ...DEFAULT_CONFIG.circuitBreaker,
        ...config?.circuitBreaker,
      },
      rateLimiter: {
        ...DEFAULT_CONFIG.rateLimiter,
        ...config?.rateLimiter,
      },
      enableMetrics: config?.enableMetrics ?? DEFAULT_CONFIG.enableMetrics,
    };

    // Create global rate limiter
    this.rateLimiter = createRateLimiter(this.config.rateLimiter);

    // Create metrics collector
    this.metrics = this.config.enableMetrics ? createMetricsCollector() : null;

    // Initialize circuit breakers for each provider
    this.initializeProviders();
  }

  private initializeProviders(): void {
    for (const providerId of this.baseRegistry.getProviderIds()) {
      const provider = this.baseRegistry.get(providerId);
      if (provider) {
        this.resilientProviders.set(providerId, {
          provider,
          circuitBreaker: createCircuitBreaker(this.config.circuitBreaker),
        });
      }
    }
  }

  /**
   * Executes a completion request with resilience patterns
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const startTime = Date.now();
    const provider = this.baseRegistry.getByModel(request.model);

    if (provider === undefined) {
      const error: ClassifiedError = {
        category: 'not_found',
        message: `No provider found for model: ${request.model}`,
        shouldRetry: false,
        shouldFallback: true,
        retryAfterMs: null,
        originalError: undefined,
      };

      return {
        success: false,
        requestId: request.requestId,
        error,
        latencyMs: 0,
      };
    }

    const resilient = this.resilientProviders.get(provider.providerId);
    if (!resilient) {
      // Fallback to direct call if no circuit breaker setup
      return provider.complete(request);
    }

    // Check rate limit
    const rateLimitResult = await this.rateLimiter.acquire();
    if (!rateLimitResult.acquired) {
      const error: ClassifiedError = {
        category: 'rate_limit',
        message: rateLimitResult.reason === 'queue-full'
          ? 'Rate limit queue is full'
          : rateLimitResult.reason === 'timeout'
            ? 'Rate limit queue timeout'
            : 'Rate limit exceeded',
        shouldRetry: true,
        shouldFallback: false,
        retryAfterMs: rateLimitResult.retryAfterMs ?? RETRY_DELAY_DEFAULT,
        originalError: undefined,
      };

      return {
        success: false,
        requestId: request.requestId,
        error,
        latencyMs: Date.now() - startTime,
      };
    }

    // Execute with circuit breaker protection
    try {
      const response = await resilient.circuitBreaker.execute(async () => {
        const result = await provider.complete(request);
        // Throw error for failed responses that should trip the circuit breaker
        // This ensures the circuit breaker tracks provider failures, not just exceptions
        if (!result.success && result.error?.shouldFallback) {
          const error = new Error(result.error.message);
          (error as Error & { response: typeof result }).response = result;
          throw error;
        }
        return result;
      });

      // Record success metrics
      if (this.metrics && response.success) {
        this.metrics.recordRequest({
          timestamp: new Date().toISOString(),
          providerId: provider.providerId,
          operation: 'complete',
          success: true,
          durationMs: response.latencyMs,
          inputTokens: response.usage?.inputTokens,
          outputTokens: response.usage?.outputTokens,
        });
      } else if (this.metrics && !response.success) {
        this.metrics.recordRequest({
          timestamp: new Date().toISOString(),
          providerId: provider.providerId,
          operation: 'complete',
          success: false,
          durationMs: response.latencyMs,
          errorCode: response.error?.category,
        });

        if (response.error) {
          this.metrics.recordError({
            timestamp: new Date().toISOString(),
            code: response.error.category,
            message: response.error.message,
            providerId: provider.providerId,
            operation: 'complete',
            recoverable: response.error.shouldRetry,
          });
        }
      }

      return response;
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      // Check if this is a provider failure (has attached response)
      // We know it's a CompletionFailure because we only throw when success: false
      const errorWithResponse = error as Error & { response?: CompletionResponse };
      if (errorWithResponse.response !== undefined && !errorWithResponse.response.success) {
        // Return the original failed response - circuit breaker already recorded the failure
        const response = errorWithResponse.response;

        // Record failure metrics
        if (this.metrics) {
          this.metrics.recordRequest({
            timestamp: new Date().toISOString(),
            providerId: provider.providerId,
            operation: 'complete',
            success: false,
            durationMs: response.latencyMs,
            errorCode: response.error.category,
          });

          this.metrics.recordError({
            timestamp: new Date().toISOString(),
            code: response.error.category,
            message: response.error.message,
            providerId: provider.providerId,
            operation: 'complete',
            recoverable: response.error.shouldRetry,
          });
        }

        return response;
      }

      // Record failure metrics for circuit breaker errors
      if (this.metrics) {
        this.metrics.recordRequest({
          timestamp: new Date().toISOString(),
          providerId: provider.providerId,
          operation: 'complete',
          success: false,
          durationMs: latencyMs,
          errorCode: 'circuit_open',
        });
      }

      // Circuit breaker is open
      const classifiedError: ClassifiedError = {
        category: 'server',
        message: error instanceof Error ? error.message : 'Circuit breaker is open',
        shouldRetry: true,
        shouldFallback: true,
        retryAfterMs: CIRCUIT_RESET_TIMEOUT,
        originalError: error instanceof Error ? error : undefined,
      };

      return {
        success: false,
        requestId: request.requestId,
        error: classifiedError,
        latencyMs,
      };
    }
  }

  /**
   * Gets provider health status including circuit breaker state
   */
  getProviderHealth(providerId: string): {
    provider: LLMProvider | undefined;
    circuitState: string | undefined;
  } {
    const resilient = this.resilientProviders.get(providerId);
    return {
      provider: resilient?.provider,
      circuitState: resilient?.circuitBreaker.state,
    };
  }

  /**
   * Gets metrics snapshot
   */
  getMetrics() {
    return this.metrics?.getStats();
  }

  /**
   * Gets rate limiter stats
   */
  getRateLimiterStats() {
    return this.rateLimiter.getStats();
  }

  /**
   * Resets circuit breaker for a provider
   */
  resetCircuitBreaker(providerId: string): void {
    const resilient = this.resilientProviders.get(providerId);
    resilient?.circuitBreaker.reset();
  }

  /**
   * Resets all circuit breakers
   */
  resetAllCircuitBreakers(): void {
    for (const resilient of this.resilientProviders.values()) {
      resilient.circuitBreaker.reset();
    }
  }

  /**
   * Checks health of all providers
   */
  async checkAllHealth(): Promise<Map<string, HealthCheckResult>> {
    return this.baseRegistry.checkAllHealth();
  }

  /**
   * Gets all provider IDs
   */
  getProviderIds(): string[] {
    return this.baseRegistry.getProviderIds();
  }

  /**
   * Gets all models
   */
  getAllModels(): { providerId: string; model: ModelConfig }[] {
    return this.baseRegistry.getAllModels();
  }

  /**
   * Checks if model exists
   */
  hasModel(model: string): boolean {
    return this.baseRegistry.hasModel(model);
  }

  /**
   * Gets the underlying base registry
   */
  get base(): ProviderRegistry {
    return this.baseRegistry;
  }
}

/**
 * Creates a resilient provider registry with default providers
 */
export function createResilientProviderRegistry(
  config?: ResilientRegistryConfig
): ResilientProviderRegistry {
  const baseRegistry = createBaseRegistry();
  return new ResilientProviderRegistry(baseRegistry, config);
}
