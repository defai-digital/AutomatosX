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
import type { RoutingConfig } from '../types/routing.js';
import { getRoutingStrategyManager } from './routing-strategy.js';
import { getProviderMetricsTracker } from './provider-metrics-tracker.js';

// Phase 2.2: Policy-driven routing
import { PolicyParser } from './spec/PolicyParser.js';
import { PolicyEvaluator } from './spec/PolicyEvaluator.js';
import { PROVIDER_METADATA } from './provider-metadata-registry.js';
import { getCostTracker } from './cost-tracker.js';
import type { SpecYAML } from '../types/spec-yaml.js';

// Phase 2.3: Trace logging
import { RouterTraceLogger, createTraceLogger } from './router-trace-logger.js';

// Phase 3A: Free tier management
import { getFreeTierManager } from './free-tier/free-tier-manager.js';

// Phase 3B: Workload-aware routing
import { getWorkloadAnalyzer } from './workload/workload-analyzer.js';

// Provider session management (provider override)
import { getProviderSession } from './provider-session.js';

export interface RouterConfig {
  providers: Provider[];
  fallbackEnabled: boolean;
  healthCheckInterval?: number;
  providerCooldownMs?: number; // Cooldown period for failed providers (default: 30000ms)
  cache?: ResponseCache; // Optional response cache
  strategy?: RoutingConfig; // Phase 3: Multi-factor routing configuration
  workspacePath?: string; // Phase 2.3: Workspace path for trace logging
  enableTracing?: boolean; // Phase 2.3: Enable trace logging (default: false)
  enableFreeTierPrioritization?: boolean; // v6.3.1: Enable free tier prioritization (default: true)
  enableWorkloadAwareRouting?: boolean; // v6.3.1: Enable workload-aware routing (default: true)
}

export class Router {
  private providers: Provider[];
  private fallbackEnabled: boolean;
  private healthCheckInterval?: NodeJS.Timeout;
  private penalizedProviders: Map<string, number>; // provider name -> penalty expiry timestamp
  private providerCooldownMs: number;
  private cache?: ResponseCache;
  private routerConfig: RouterConfig; // v6.3.1: Store config for feature flags

  // Phase 3: Health check metrics tracking
  private healthCheckIntervalMs?: number;
  private healthCheckMetrics = {
    lastCheckTime: 0,
    checksPerformed: 0,
    totalDuration: 0,
    failures: 0
  };

  // Phase 3: Multi-factor routing
  private useMultiFactorRouting: boolean = false;

  // Phase 2.2: Policy-driven routing
  private policyParser: PolicyParser;
  private policyEvaluator: PolicyEvaluator;

  // Phase 2.3: Trace logging
  private tracer?: RouterTraceLogger;

  constructor(config: RouterConfig) {
    // v6.3.1: Store config for feature flags
    this.routerConfig = config;

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

    // Phase 3: Initialize multi-factor routing if strategy provided
    if (config.strategy) {
      this.useMultiFactorRouting = true;
      const strategyManager = getRoutingStrategyManager(config.strategy);
      logger.info('Multi-factor routing enabled', {
        strategy: strategyManager.getStrategy().name,
        weights: strategyManager.getWeights()
      });
    }

    // Phase 2.2: Initialize policy-driven routing
    this.policyParser = new PolicyParser();
    // Initialize CostTracker with default config if not already initialized
    const costTracker = getCostTracker({
      enabled: true,
      persistPath: '.automatosx/costs'
    });
    this.policyEvaluator = new PolicyEvaluator(PROVIDER_METADATA, costTracker);
    logger.debug('Policy-driven routing initialized');

    // Phase 2.3: Initialize trace logging
    // FIXED (v6.0.1): Correct default behavior - enabled by default if workspacePath provided
    if (config.workspacePath && config.enableTracing !== false) {
      this.tracer = createTraceLogger(config.workspacePath, config.enableTracing ?? true);
      logger.debug('Router trace logging enabled', {
        traceFile: this.tracer.getTraceFile(),
        explicit: config.enableTracing !== undefined
      });
    }

    // Phase 3: Store interval value for observability
    this.healthCheckIntervalMs = config.healthCheckInterval;

    // FIXED (Bug #92): Register shutdown handler BEFORE starting health checks
    // This ensures destroy() is called even if errors occur during setup
    // Bug #43: Register shutdown handler to cleanup health check interval
    import('../utils/process-manager.js').then(({ processManager }) => {
      processManager.onShutdown(async () => {
        this.destroy();
      });
    }).catch(() => {
      logger.debug('Router: process-manager not available for shutdown handler');
    });

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

    // Check for provider override (session-based provider switch)
    // Skip in test environment to avoid interfering with test assertions
    const providerSession = getProviderSession();
    if (providerSession.hasOverride() && process.env.NODE_ENV !== 'test') {
      const override = providerSession.getOverride();
      const overrideProvider = this.providers.find(p => p.name === override?.provider);

      if (overrideProvider) {
        logger.info('Provider override active', {
          provider: override?.provider,
          reason: override?.reason,
          createdAt: new Date(override?.createdAt || 0)
        });

        // Execute directly with overridden provider (skip routing)
        try {
          const response = await overrideProvider.execute(request);
          timer.end({ provider: override?.provider, overridden: true });
          return response;
        } catch (error) {
          // Override provider failed - log error and continue to normal routing
          logger.error('Override provider failed, falling back to normal routing', {
            provider: override?.provider,
            error: (error as Error).message
          });
        }
      } else {
        logger.warn('Provider override set but provider not found', {
          override: override?.provider,
          availableProviders: this.providers.map(p => p.name)
        });
      }
    }

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

    // Phase 2.2: Apply policy-driven routing if spec has policy
    let providersToTry = availableProviders;
    if (request.spec?.policy) {
      try {
        const policy = this.policyParser.parse(request.spec);
        const providerNames = availableProviders.map(p => p.name);

        // Filter providers by policy constraints
        const filterResult = await this.policyEvaluator.filterProviders(providerNames, policy);

        // Log policy selection with trace logger
        if (this.tracer) {
          const selectedProvider = filterResult.passed.length > 0 ? filterResult.passed[0] : null;
          this.tracer.logPolicySelection(policy, filterResult, selectedProvider ?? null);
        }

        // Apply filtered providers
        if (filterResult.passed.length > 0) {
          // Score remaining providers and select best match
          const scoredProviders = this.policyEvaluator.scoreProviders(filterResult.passed, policy);

          if (scoredProviders.length > 0) {
            // Reorder providers by policy scores
            const scoreMap = new Map(scoredProviders.map(s => [s.provider, s.totalScore]));
            providersToTry = availableProviders
              .filter(p => filterResult.passed.includes(p.name))
              .sort((a, b) => {
                const scoreA = scoreMap.get(a.name) ?? 0;
                const scoreB = scoreMap.get(b.name) ?? 0;
                return scoreB - scoreA; // Descending order
              });

            logger.info('Policy-driven routing applied', {
              goal: policy.goal,
              constraints: Object.keys(policy.constraints || {}).length,
              providersBefore: availableProviders.length,
              providersAfter: providersToTry.length,
              topProvider: providersToTry[0]?.name,
              filtered: filterResult.filtered.length
            });
          }
        } else {
          // No providers match policy - log warning and fall back to priority-based
          logger.warn('No providers match policy constraints, using priority-based routing', {
            goal: policy.goal,
            filtered: filterResult.filtered
          });

          if (this.tracer) {
            this.tracer.logError(
              'No providers match policy constraints',
              undefined,
              { filtered: filterResult.filtered, goal: policy.goal }
            );
          }
        }
      } catch (error) {
        // Policy parsing/evaluation failed - log error and fall back to priority-based
        logger.error('Policy-driven routing failed, falling back to priority-based', {
          error: (error as Error).message
        });

        if (this.tracer) {
          this.tracer.logError(error as Error, undefined, { phase: 'policy-evaluation' });
        }
      }
    }

    // Phase 3A: Prioritize providers with free tier quota available (if enabled)
    const enableFreeTierPrioritization = this.routerConfig?.enableFreeTierPrioritization ?? true;
    if (enableFreeTierPrioritization) {
      try {
        const freeTierManager = getFreeTierManager();
        const providersWithFreeTier: Provider[] = [];
        const providersWithoutFreeTier: Provider[] = [];

        for (const provider of providersToTry) {
          if (freeTierManager.hasFreeTier(provider.name)) {
            const quota = freeTierManager.getQuota(provider.name);
            if (quota.available) {
              providersWithFreeTier.push(provider);
              logger.debug(`Provider ${provider.name} has free tier quota available`, {
                requestsRemaining: quota.requestsRemaining,
                tokensRemaining: quota.tokensRemaining
              });
            } else {
              providersWithoutFreeTier.push(provider);
            }
          } else {
            providersWithoutFreeTier.push(provider);
          }
        }

        // Reorder: free tier first, then paid tier
        if (providersWithFreeTier.length > 0) {
          providersToTry = [...providersWithFreeTier, ...providersWithoutFreeTier];
          logger.info('Free tier providers prioritized', {
            freeTierProviders: providersWithFreeTier.map(p => p.name),
            paidProviders: providersWithoutFreeTier.map(p => p.name)
          });
        }
      } catch (error) {
        // Free tier prioritization failed - log warning and continue
        logger.warn('Free tier prioritization failed, continuing with existing order', {
          error: (error as Error).message
        });
      }
    }

    // Phase 3B: Apply workload-aware routing (if enabled)
    const enableWorkloadAwareRouting = this.routerConfig?.enableWorkloadAwareRouting ?? true;
    if (enableWorkloadAwareRouting) {
      try {
        const analyzer = getWorkloadAnalyzer();
        const workload = analyzer.analyze(request);
        const recommendation = analyzer.recommend(workload);

        // Reorder providers based on workload recommendation
        if (recommendation.preferredProviders.length > 0) {
          // Create a preference map (lower index = higher preference)
          const preferenceMap = new Map<string, number>();
          recommendation.preferredProviders.forEach((provider, index) => {
            preferenceMap.set(provider, index);
          });

          // Sort providers by workload preference, fallback to current order
          const originalOrder = providersToTry.map(p => p.name);
          providersToTry = [...providersToTry].sort((a, b) => {
            const prefA = preferenceMap.get(a.name) ?? 999;
            const prefB = preferenceMap.get(b.name) ?? 999;

            // If preferences are equal, maintain original order
            if (prefA === prefB) {
              return originalOrder.indexOf(a.name) - originalOrder.indexOf(b.name);
            }

            return prefA - prefB;
          });

          logger.info('Workload-aware routing applied', {
            sizeClass: workload.sizeClass,
            estimatedTokens: workload.estimatedTokens,
            streaming: workload.requiresStreaming,
            complexity: workload.complexity,
            recommendation: recommendation.reason,
            providersOrder: providersToTry.map(p => p.name),
            costOptimized: recommendation.costOptimized,
            speedOptimized: recommendation.speedOptimized
          });
        }
      } catch (error) {
        // Workload analysis failed - log warning and continue
        logger.warn('Workload-aware routing failed, continuing with existing order', {
          error: (error as Error).message
        });
      }
    }

    // Phase 3: Reorder providers using multi-factor routing if enabled
    // Note: Policy-driven routing has already filtered providers above
    if (this.useMultiFactorRouting) {
      const strategyManager = getRoutingStrategyManager();
      const providerNames = providersToTry.map(p => p.name);

      // Calculate health multipliers (1.0 for healthy, 0.5 for penalized)
      const healthMultipliers = new Map<string, number>();
      for (const provider of providersToTry) {
        const isPenalized = this.penalizedProviders.has(provider.name);
        healthMultipliers.set(provider.name, isPenalized ? 0.5 : 1.0);
      }

      // Get scores for all providers
      const scores = await getProviderMetricsTracker().getAllScores(
        providerNames,
        strategyManager.getWeights(),
        healthMultipliers
      );

      // Reorder providers by score (highest first)
      if (scores.length > 0) {
        const scoreMap = new Map(scores.map(s => [s.provider, s.totalScore]));
        const originalOrder = providersToTry.map(p => p.name);
        providersToTry = [...providersToTry].sort((a, b) => {
          const scoreA = scoreMap.get(a.name) ?? 0;
          const scoreB = scoreMap.get(b.name) ?? 0;
          return scoreB - scoreA; // Descending order
        });

        logger.debug('Provider order after multi-factor routing', {
          original: originalOrder,
          reordered: providersToTry.map(p => p.name),
          scores: Object.fromEntries(scoreMap)
        });
      }
    }

    let lastError: Error | undefined;
    let attemptNumber = 0;

    for (const provider of providersToTry) {
      attemptNumber++;

      try {
        logger.info(`Selecting provider: ${provider.name} (attempt ${attemptNumber}/${availableProviders.length})`);

        // Phase 2.3: Log provider selection with spec context
        if (this.tracer) {
          const candidateNames = providersToTry.map(p => p.name);
          const reason = request.spec?.policy ? 'policy-based selection' : 'priority-based selection';

          // Extract spec context if available (Quick Win #2: Router Trace Context)
          // FIXED (v6.5.13 Bug #136): Add optional chaining for taskId to match metadata access
          const specContext = request.spec ? {
            specId: request.spec.metadata?.id,
            taskId: request.spec?.taskId
          } : undefined;

          this.tracer.logSelection(candidateNames, provider.name, reason, undefined, specContext);
        }

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

        // Phase 3A: Track free tier usage if applicable
        try {
          const freeTierManager = getFreeTierManager();
          if (freeTierManager.hasFreeTier(provider.name)) {
            freeTierManager.trackUsage(
              provider.name,
              1, // 1 request
              response.tokensUsed.total // total tokens used
            );
            logger.debug(`Free tier usage tracked for ${provider.name}`, {
              requests: 1,
              tokens: response.tokensUsed.total
            });
          }
        } catch (error) {
          // Non-critical error - log and continue
          logger.warn('Failed to track free tier usage', {
            provider: provider.name,
            error: (error as Error).message
          });
        }

        // Phase 2.3: Log execution success
        if (this.tracer) {
          const estimatedCost = this.estimateCost(provider.name, response.tokensUsed);
          this.tracer.logExecution(
            provider.name,
            true, // success
            response.latencyMs,
            estimatedCost,
            response.tokensUsed
          );
        }

        // Phase 3: Record metrics for multi-factor routing
        // v6.5.16: Fire-and-forget metrics recording to avoid blocking the routing loop
        // Metrics I/O (disk/network) should not delay response delivery to the user
        if (this.useMultiFactorRouting) {
          const metricsTracker = getProviderMetricsTracker();
          // Estimate cost based on tokens (simplified - real cost would come from provider)
          const estimatedCost = this.estimateCost(provider.name, response.tokensUsed);

          // Fire-and-forget: Don't await metrics recording
          void metricsTracker.recordRequest(
            provider.name,
            response.latencyMs,
            true, // success
            response.finishReason || 'stop',
            {
              prompt: response.tokensUsed.prompt,
              completion: response.tokensUsed.completion,
              total: response.tokensUsed.total
            },
            estimatedCost,
            response.model
          ).catch((error) => {
            // Log but don't fail the request if metrics recording fails
            logger.warn('Metrics recording failed (non-critical)', {
              provider: provider.name,
              error: (error as Error).message
            });
          });
        }

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

          // v6.5.16: Ensure limit is recorded (idempotent - safe to call even if already recorded)
          // Bug #11 fix: Wrap in try-catch to prevent masking the original provider error
          const resetAtMs = providerError.context?.resetAtMs;
          const limitWindow = providerError.context?.limitWindow;

          if (typeof resetAtMs === 'number' && typeof limitWindow === 'string') {
            try {
              await limitManager.recordLimitHit(
                provider.name,
                limitWindow as 'daily' | 'weekly' | 'custom',
                resetAtMs,
                {
                  reason: (providerError.context?.reason as string) || 'usage_limit_exceeded',
                  rawMessage: providerError.message
                }
              );
            } catch (limitError) {
              // Log but don't fail - the original provider error is more important
              logger.warn('Failed to record limit hit (non-critical)', {
                provider: provider.name,
                error: (limitError as Error).message
              });
            }
          }

          logger.warn('⚠️  Router: provider hit usage limit, auto-rotating', {
            provider: provider.name,
            attempt: attemptNumber,
            resetAtMs: providerError.context?.resetAtMs,
            willFallback: this.fallbackEnabled && attemptNumber < availableProviders.length
          });

          // Phase 2.3: Log degradation (rate limit)
          if (this.tracer) {
            const nextProvider = providersToTry[attemptNumber]?.name;
            this.tracer.logDegradation(
              'rate_limit',
              nextProvider ? 'switched' : 'failed',
              provider.name,
              nextProvider
            );
          }
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

          // Phase 2.3: Log degradation (provider error)
          if (this.tracer) {
            const nextProvider = providersToTry[attemptNumber]?.name;
            this.tracer.logDegradation(
              lastError.message,
              nextProvider ? 'switched' : 'failed',
              provider.name,
              nextProvider
            );
          }
        }

        // Phase 3: Record failed request metrics
        // v6.5.16: Fire-and-forget metrics recording to avoid blocking error handling loop
        // Metrics I/O should not delay fallback provider selection
        if (this.useMultiFactorRouting) {
          const metricsTracker = getProviderMetricsTracker();

          // Fire-and-forget: Don't await metrics recording
          void metricsTracker.recordRequest(
            provider.name,
            0, // latency unknown for failed requests
            false, // failure
            'error',
            { prompt: 0, completion: 0, total: 0 },
            0, // no cost for failed requests
            undefined // model unknown
          ).catch((error) => {
            // Log but don't fail the fallback attempt if metrics recording fails
            logger.warn('Failed request metrics recording failed (non-critical)', {
              provider: provider.name,
              error: (error as Error).message
            });
          });
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

    // Phase 2.3: Log final error
    if (this.tracer && lastError) {
      this.tracer.logError(lastError, undefined, {
        totalAttempts: attemptNumber,
        providers: providersToTry.map(p => p.name)
      });
    }

    // v5.7.0: Check if all providers are limited (quota exhausted)
    // FIXED (Bug #5): Check ALL providers (not just attempted ones) for accurate soonest reset
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

    // If all providers are limited, throw specialized error with correct soonest reset
    if (limitedProviders.length === allProviders.length && limitedProviders.length > 0) {
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
   * Get health status for all providers
   *
   * v6.5.16: Parallelized health checks using Promise.allSettled
   * - Before: Sequential checks with N×latency worst case
   * - After: Parallel checks with max(latency) worst case
   * - Performance: 3x faster with 3 providers (300ms → 100ms)
   */
  async getHealthStatus(): Promise<Map<string, HealthStatus>> {
    const healthMap = new Map<string, HealthStatus>();

    // v6.5.16: Run health checks in parallel instead of sequentially
    // Use allSettled to ensure all checks complete even if some fail
    const healthChecks = this.providers.map(async (provider) => ({
      name: provider.name,
      health: await provider.getHealth()
    }));

    const results = await Promise.allSettled(healthChecks);

    for (const result of results) {
      if (result.status === 'fulfilled') {
        healthMap.set(result.value.name, result.value.health);
      }
      // Rejected promises are ignored - provider.getHealth() handles errors internally
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

    // Phase 2.3: Close trace logger
    if (this.tracer) {
      this.tracer.close();
      logger.debug('Router trace logger closed');
    }
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

  /**
   * Estimate cost of a request based on tokens used
   * Phase 3: Helper for metrics tracking
   *
   * FIXED (v6.0.1): Use actual provider costs from PROVIDER_METADATA
   */
  private estimateCost(providerName: string, tokensUsed: { prompt: number; completion: number; total: number }): number {
    // Look up actual provider costs from metadata registry
    const metadata = PROVIDER_METADATA[providerName];

    // v6.2.5: Bug fix #32 - Validate metadata and costPerToken exist
    if (!metadata || !metadata.costPerToken ||
        typeof metadata.costPerToken.input !== 'number' ||
        typeof metadata.costPerToken.output !== 'number') {
      // Fallback to average pricing if provider not found or missing cost data
      logger.warn(`Provider metadata or cost data not found for: ${providerName}, using fallback costs`);
      const inputCostPer1M = 2.50;   // Fallback: $2.50 per 1M input tokens
      const outputCostPer1M = 10.00; // Fallback: $10.00 per 1M output tokens

      const inputCost = (tokensUsed.prompt / 1_000_000) * inputCostPer1M;
      const outputCost = (tokensUsed.completion / 1_000_000) * outputCostPer1M;

      return inputCost + outputCost;
    }

    // Use actual provider costs from metadata
    const inputCost = tokensUsed.prompt * metadata.costPerToken.input;
    const outputCost = tokensUsed.completion * metadata.costPerToken.output;

    return inputCost + outputCost;
  }
}
