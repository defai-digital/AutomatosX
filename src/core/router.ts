/**
 * Router - AI Provider Router with Fallback
 *
 * Routes requests to available providers based on:
 * - Provider priority
 * - Provider health
 * - Rate limit status
 * - Automatic fallback on failure
 */

import type {
  Provider,
  ExecutionRequest,
  ExecutionResponse,
  HealthStatus
} from '../types/provider.js';
import { logger } from '../utils/logger.js';
import { ProviderError, ErrorCode } from '../utils/errors.js';
import type { ResponseCache } from './response-cache.js';
import { getProviderLimitManager } from './provider-limit-manager.js';
import {
  ComponentType,
  LifecycleState,
  markState,
  markCacheHit,
  PerformanceTimer
} from '../utils/performance-markers.js';

export interface RouterConfig {
  providers: Provider[];
  fallbackEnabled: boolean;
  healthCheckInterval?: number;
  providerCooldownMs?: number; // Cooldown period for failed providers (default: 30000ms)
  cache?: ResponseCache; // Optional response cache
}

export class Router {
  private providers: Provider[];
  private fallbackEnabled: boolean;
  private healthCheckInterval?: NodeJS.Timeout;
  private penalizedProviders: Map<string, number>; // provider name -> penalty expiry timestamp
  private providerCooldownMs: number;
  private cache?: ResponseCache;

  // Phase 3: Health check metrics tracking
  private healthCheckIntervalMs?: number;
  private healthCheckMetrics = {
    lastCheckTime: 0,
    checksPerformed: 0,
    totalDuration: 0,
    failures: 0
  };

  constructor(config: RouterConfig) {
    // Sort providers by priority (lower number = higher priority)
    this.providers = [...config.providers].sort((a, b) => {
      return a.priority - b.priority;
    });
    this.fallbackEnabled = config.fallbackEnabled;
    this.penalizedProviders = new Map();
    this.providerCooldownMs = config.providerCooldownMs ?? 30000; // Default: 30 seconds
    this.cache = config.cache;

    // v5.7.0: Initialize provider limit manager (non-blocking)
    const limitManager = getProviderLimitManager();
    void limitManager.initialize().catch(err => {
      logger.warn('Failed to initialize ProviderLimitManager', { error: err.message });
    });

    // Phase 3: Store interval value for observability
    this.healthCheckIntervalMs = config.healthCheckInterval;

    // Start health checks if interval is provided
    if (config.healthCheckInterval) {
      this.startHealthChecks(config.healthCheckInterval);

      // Phase 3: Immediate cache warmup on startup (only if health checks enabled)
      // Warm up caches immediately to eliminate first-request cold start
      // CRITICAL FIX (v5.6.18): Add catch handler to prevent unhandled rejection
      if (this.providers.length > 0) {
        void this.warmupCaches().catch(err => {
          logger.error('Cache warmup failed', { error: err.message });
        });
      }
    }
  }

  /**
   * Warm up provider availability caches immediately.
   * Phase 3 (v5.6.3): Eliminates cold-start latency on first request.
   *
   * Runs in background (non-blocking) to avoid delaying router initialization.
   */
  private async warmupCaches(): Promise<void> {
    logger.debug('Warming up provider caches...', {
      providers: this.providers.map(p => p.name)
    });

    const startTime = Date.now();

    await Promise.allSettled(
      this.providers.map(async (provider) => {
        try {
          await provider.isAvailable();
          logger.debug(`Cache warmed for ${provider.name}`);
        } catch (error) {
          logger.warn(`Failed to warm cache for ${provider.name}`, {
            error: (error as Error).message
          });
        }
      })
    );

    const duration = Date.now() - startTime;
    logger.debug('Cache warmup completed', {
      duration,
      providers: this.providers.length
    });
  }

  /**
   * Execute request with automatic provider fallback
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    const timer = new PerformanceTimer(
      ComponentType.ROUTER,
      'execute',
      'provider'
    );

    const availableProviders = await this.getAvailableProviders();

    markState(ComponentType.ROUTER, LifecycleState.EXECUTING, {
      message: 'starting execution',
      totalProviders: this.providers.length,
      availableProviders: availableProviders.length,
      fallbackEnabled: this.fallbackEnabled,
      cacheEnabled: this.cache?.isEnabled ?? false
    });

    if (availableProviders.length === 0) {
      // v5.7.0: Check if all providers are limited (quota exhausted)
      const limitManager = getProviderLimitManager();
      const allProviders = this.providers;
      const limitedProviders = [];

      for (const provider of allProviders) {
        const limitCheck = limitManager.isProviderLimited(provider.name);
        if (limitCheck.isLimited && limitCheck.resetAtMs) {
          limitedProviders.push({
            name: provider.name,
            resetAtMs: limitCheck.resetAtMs
          });
        }
      }

      // If all providers are limited, throw specialized error
      if (limitedProviders.length === allProviders.length && limitedProviders.length > 0) {
        const soonestReset = Math.min(...limitedProviders.map(p => p.resetAtMs));
        throw ProviderError.allProvidersLimited(limitedProviders, soonestReset);
      }

      // Otherwise throw generic "no available providers" error
      throw ProviderError.noAvailableProviders();
    }

    let lastError: Error | undefined;
    let attemptNumber = 0;

    for (const provider of availableProviders) {
      attemptNumber++;

      try {
        logger.info(`Selecting provider: ${provider.name} (attempt ${attemptNumber}/${availableProviders.length})`);

        // Check cache first (if enabled and available)
        if (this.cache?.isEnabled) {
          const modelParams = {
            temperature: request.temperature,
            maxTokens: request.maxTokens
          };

          const cachedContent = this.cache.get(
            provider.name,
            request.prompt,
            modelParams
          );

          if (cachedContent) {
            markCacheHit(ComponentType.ROUTER, 'execute', {
              provider: provider.name,
              attempt: attemptNumber
            });

            timer.end({ cached: true, provider: provider.name });

            // Return cached response with minimal latency
            return {
              content: cachedContent,
              model: request.model || 'cached',
              latencyMs: 0,
              tokensUsed: {
                prompt: 0,
                completion: 0,
                total: 0
              },
              finishReason: 'stop',
              cached: true
            };
          }
        }

        logger.info(`Attempting execution with provider: ${provider.name}`);

        const response = await provider.execute(request);

        timer.end({
          provider: provider.name,
          attempt: attemptNumber,
          latency: response.latencyMs,
          tokens: response.tokensUsed.total
        });

        markState(ComponentType.ROUTER, LifecycleState.COMPLETED, {
          message: 'execution successful',
          provider: provider.name,
          attempt: attemptNumber
        });

        // Cache successful response (if cache is enabled)
        if (this.cache?.isEnabled) {
          const modelParams = {
            temperature: request.temperature,
            maxTokens: request.maxTokens
          };

          this.cache.set(
            provider.name,
            request.prompt,
            response.content,
            modelParams
          );
        }

        // Remove provider from penalty list on success
        this.penalizedProviders.delete(provider.name);

        return response;

      } catch (error) {
        lastError = error as Error;

        // v5.7.0: Check if this is a rate limit error (quota exceeded)
        const isRateLimitError = error instanceof ProviderError &&
                                  error.code === ErrorCode.PROVIDER_RATE_LIMIT;

        if (isRateLimitError) {
          // Rate limit error - record to limitManager and don't penalize
          const providerError = error as ProviderError;
          const limitManager = getProviderLimitManager();

          // Ensure limit is recorded (idempotent - safe to call even if already recorded)
          if (providerError.context?.resetAtMs && providerError.context?.limitWindow) {
            await limitManager.recordLimitHit(
              provider.name,
              providerError.context.limitWindow as 'daily' | 'weekly' | 'custom',
              providerError.context.resetAtMs,
              {
                reason: providerError.context.reason as string || 'usage_limit_exceeded',
                rawMessage: providerError.message
              }
            );
          }

          logger.warn('⚠️  Router: provider hit usage limit, auto-rotating', {
            provider: provider.name,
            attempt: attemptNumber,
            resetAtMs: providerError.context?.resetAtMs,
            willFallback: this.fallbackEnabled && attemptNumber < availableProviders.length
          });
        } else {
          // Other error - apply cooldown penalty (existing logic)
          logger.warn('❌ Router: provider failed', {
            provider: provider.name,
            attempt: attemptNumber,
            error: lastError.message,
            willFallback: this.fallbackEnabled && attemptNumber < availableProviders.length
          });

          // Penalize failed provider (add cooldown period)
          const penaltyExpiry = Date.now() + this.providerCooldownMs;
          this.penalizedProviders.set(provider.name, penaltyExpiry);

          logger.debug(`Provider ${provider.name} penalized until ${new Date(penaltyExpiry).toISOString()}`);
        }

        // If fallback is disabled, throw immediately
        if (!this.fallbackEnabled) {
          throw lastError;
        }

        // v5.6.24: Lifecycle logging - Fallback triggered
        if (attemptNumber < availableProviders.length) {
          const reason = isRateLimitError ? 'usage limit hit' : 'error';
          logger.info('🔄 Router: fallback triggered', {
            reason,
            failedProvider: provider.name,
            nextProvider: availableProviders[attemptNumber]?.name,
            remainingProviders: availableProviders.length - attemptNumber
          });
        }

        // Continue to next provider
        continue;
      }
    }

    // v5.6.24: Lifecycle logging - All providers failed
    logger.error('❌ Router: all providers failed', {
      totalAttempts: attemptNumber,
      lastError: lastError?.message
    });

    // v5.7.0: Check if all providers are limited (quota exhausted)
    const limitManager = getProviderLimitManager();
    const limitedProviders = [];

    for (const provider of availableProviders) {
      const limitCheck = limitManager.isProviderLimited(provider.name);
      if (limitCheck.isLimited && limitCheck.resetAtMs) {
        limitedProviders.push({
          name: provider.name,
          resetAtMs: limitCheck.resetAtMs
        });
      }
    }

    // If all attempted providers are limited, throw specialized error
    if (limitedProviders.length === availableProviders.length && limitedProviders.length > 0) {
      const soonestReset = Math.min(...limitedProviders.map(p => p.resetAtMs));
      throw ProviderError.allProvidersLimited(limitedProviders, soonestReset);
    }

    // Otherwise, throw generic error (existing logic)
    throw new ProviderError(
      `All providers failed. Last error: ${lastError?.message || 'Unknown error'}`,
      ErrorCode.PROVIDER_NO_AVAILABLE,
      [
        'Check provider availability with "automatosx status"',
        'Verify provider CLIs are installed and in PATH',
        'Check provider configuration in automatosx.config.json',
        'Review error logs for more details'
      ],
      { lastError: lastError?.message }
    );
  }

  /**
   * Get available providers sorted by priority
   * v5.7.0: Enhanced with provider limit detection
   * Filters out penalized providers (those in cooldown period) and limited providers (quota exceeded)
   */
  async getAvailableProviders(): Promise<Provider[]> {
    const now = Date.now();
    const limitManager = getProviderLimitManager();

    // Clean up expired penalties
    for (const [providerName, expiryTime] of this.penalizedProviders.entries()) {
      if (now >= expiryTime) {
        this.penalizedProviders.delete(providerName);
        logger.debug(`Provider ${providerName} penalty expired`);
      }
    }

    // Check availability in parallel
    const checks = this.providers.map(async provider => {
      try {
        // v5.7.0: Check limit manager first (< 1ms, O(1) operation)
        const limitCheck = limitManager.isProviderLimited(provider.name, now);
        if (limitCheck.isLimited) {
          const remainingSec = Math.ceil((limitCheck.remainingMs || 0) / 1000);
          const remainingHours = Math.ceil(remainingSec / 3600);
          logger.debug(`Skipping limited provider ${provider.name} (resets in ${remainingHours}h)`);
          return null;
        }

        // Skip penalized providers (existing logic)
        if (this.penalizedProviders.has(provider.name)) {
          const expiryTime = this.penalizedProviders.get(provider.name)!;
          const remainingMs = expiryTime - now;
          logger.debug(`Skipping penalized provider ${provider.name} (${Math.ceil(remainingMs / 1000)}s remaining)`);
          return null;
        }

        // Check if provider is available
        const isAvailable = await provider.isAvailable();
        return isAvailable ? provider : null;
      } catch (error) {
        logger.warn('Provider availability check failed', {
          provider: provider.name,
          error: (error as Error).message
        });
        return null;
      }
    });

    const results = await Promise.all(checks);
    return results.filter((p): p is Provider => p !== null);
  }

  /**
   * Get health status of all providers
   */
  async getHealthStatus(): Promise<Map<string, HealthStatus>> {
    const healthMap = new Map<string, HealthStatus>();

    for (const provider of this.providers) {
      const health = await provider.getHealth();
      healthMap.set(provider.name, health);
    }

    return healthMap;
  }

  /**
   * Select best provider based on health and availability
   */
  async selectProvider(): Promise<Provider | null> {
    const availableProviders = await this.getAvailableProviders();

    if (availableProviders.length === 0) {
      return null;
    }

    // Return first available provider (already sorted by priority)
    return availableProviders[0] ?? null;
  }

  /**
   * Start periodic health checks.
   * Phase 2 (v5.6.2): Enhanced to refresh provider availability cache.
   *
   * Background health checks serve two purposes:
   * 1. Monitor provider health status (latency, errors, failures)
   * 2. Proactively refresh availability cache to keep it warm
   *
   * This eliminates cold-start latency when providers are first used.
   */
  private startHealthChecks(intervalMs: number): void {
    const runHealthChecks = async () => {
      const checkStartTime = Date.now();
      this.healthCheckMetrics.checksPerformed++;

      try {
        // v5.7.0: Refresh expired provider limits (automatic recovery)
        const limitManager = getProviderLimitManager();
        const restoredProviders = await limitManager.refreshExpired();

        if (restoredProviders.length > 0) {
          logger.info('✅ Router: provider limits auto-restored', {
            providers: restoredProviders,
            count: restoredProviders.length
          });
        }

        // Phase 2: Call isAvailable() to refresh cache for all providers
        // This ensures availability cache is always fresh and reduces
        // synchronous checks during actual request execution
        const availabilityResults = await Promise.allSettled(
          this.providers.map(async (provider) => {
            const startTime = Date.now();
            const available = await provider.isAvailable();
            const duration = Date.now() - startTime;

            return {
              name: provider.name,
              available,
              duration
            };
          })
        );

        // Get detailed health status
        const healthStatus = await this.getHealthStatus();

        // Phase 3: Track metrics
        const checkDuration = Date.now() - checkStartTime;
        this.healthCheckMetrics.lastCheckTime = checkStartTime;
        this.healthCheckMetrics.totalDuration += checkDuration;

        // Phase 3: Enhanced logging with cache statistics
        logger.debug('Health check completed', {
          duration: checkDuration,
          providers: this.providers.map(p => {
            const metrics = p.getCacheMetrics();
            return {
              name: p.name,
              available: metrics.health.consecutiveFailures === 0,
              cacheHitRate: (metrics.availability.hitRate * 100).toFixed(1) + '%',
              avgCacheAge: Math.round(metrics.availability.avgAge) + 'ms',
              uptime: metrics.health.uptime.toFixed(1) + '%'
            };
          })
        });

        // Original debug logging for detailed inspection
        logger.debug('Provider health check details', {
          interval: intervalMs,
          providers: Array.from(healthStatus.entries()).map(([name, health]) => {
            const availResult = availabilityResults.find(
              r => r.status === 'fulfilled' && r.value.name === name
            );
            const avail = availResult?.status === 'fulfilled' ? availResult.value : null;

            return {
              name,
              available: health.available,
              latency: health.latencyMs,
              failures: health.consecutiveFailures,
              // Phase 2: Include availability check duration
              availCheckDuration: avail?.duration,
              availCached: avail?.duration !== undefined && avail.duration < 10 // < 10ms likely cached
            };
          })
        });
      } catch (error) {
        this.healthCheckMetrics.failures++;
        logger.warn('Provider health check failed', {
          error: (error as Error).message
        });
      }
    };

    // Set up interval
    // CRITICAL FIX (v5.6.18): Add catch handler to prevent unhandled rejection
    this.healthCheckInterval = setInterval(() => {
      void runHealthChecks().catch(err => {
        logger.error('Health check interval failed', { error: err.message });
      });
    }, intervalMs);

    // Run immediately on start to warm up caches
    logger.debug('Starting background health checks', {
      interval: intervalMs,
      providers: this.providers.map(p => p.name)
    });
    void runHealthChecks().catch(err => {
      logger.error('Initial health check failed', { error: err.message });
    });
  }

  /**
   * Stop health checks and cleanup resources
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // Clear penalty list
    this.penalizedProviders.clear();
  }

  /**
   * Get health check status and metrics.
   * Phase 2 (v5.6.2): New API for observability.
   * Phase 3 (v5.6.3): Enhanced with detailed metrics.
   *
   * @returns Comprehensive health check configuration and status
   */
  getHealthCheckStatus(): {
    enabled: boolean;
    interval?: number;
    lastCheck?: number;
    checksPerformed: number;
    avgDuration: number;
    successRate: number;
    providersMonitored: number;
    providers: Array<{
      name: string;
      cacheHitRate: number;
      avgCacheAge: number;
      uptime: number;
    }>;
  } {
    return {
      enabled: this.healthCheckInterval !== undefined,
      interval: this.healthCheckIntervalMs,
      lastCheck: this.healthCheckMetrics.lastCheckTime || undefined,
      checksPerformed: this.healthCheckMetrics.checksPerformed,
      avgDuration: this.healthCheckMetrics.checksPerformed > 0
        ? this.healthCheckMetrics.totalDuration / this.healthCheckMetrics.checksPerformed
        : 0,
      successRate: this.healthCheckMetrics.checksPerformed > 0
        ? ((this.healthCheckMetrics.checksPerformed - this.healthCheckMetrics.failures) /
           this.healthCheckMetrics.checksPerformed) * 100
        : 0,
      providersMonitored: this.providers.length,
      providers: this.providers.map(p => {
        const metrics = p.getCacheMetrics();
        return {
          name: p.name,
          cacheHitRate: metrics.availability.hitRate,
          avgCacheAge: metrics.availability.avgAge,
          uptime: metrics.health.uptime
        };
      })
    };
  }
}
