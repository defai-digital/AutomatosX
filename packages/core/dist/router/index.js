// src/router/provider-router.ts
import "@ax/schemas";
import {
  selectProvider,
  getFallbackOrder,
  defaultRoutingContext
} from "@ax/algorithms";
import {
  createProvider
} from "@ax/providers";
var DEFAULT_PROVIDER_PRIORITY = 99;
var DEFAULT_ROUTING_COMPLEXITY = 5;
var DEFAULT_HEALTH_CHECK_INTERVAL_MS = 6e4;
var MAX_ROUTING_RETRIES = 3;
var ProviderRouter = class {
  config;
  providers = /* @__PURE__ */ new Map();
  metrics;
  events = {};
  healthCheckIntervalId = null;
  initialized = false;
  constructor(options) {
    this.config = options.config;
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      fallbackAttempts: 0,
      requestsByProvider: /* @__PURE__ */ new Map(),
      avgLatencyByProvider: /* @__PURE__ */ new Map()
    };
    this.initializeProviders(options.providerOptions);
    if (options.autoHealthCheck !== false) {
      const interval = options.healthCheckInterval ?? DEFAULT_HEALTH_CHECK_INTERVAL_MS;
      this.startHealthChecks(interval);
    }
    this.initialized = true;
  }
  // =============================================================================
  // Public Methods
  // =============================================================================
  /**
   * Route a task to the best available provider
   */
  async route(request, options = {}) {
    this.metrics.totalRequests++;
    const context = this.buildRoutingContext(request, options);
    const result = this.selectBestProvider(context, options);
    if (!result.provider) {
      this.metrics.failedRequests++;
      throw new Error(`No providers available: ${result.reason}`);
    }
    const provider = this.providers.get(result.provider.id);
    if (!provider) {
      throw new Error(`Provider ${result.provider.id} not found in registry`);
    }
    this.events.onProviderSelected?.(provider.id, result.reason);
    this.incrementProviderMetrics(provider.id);
    const maxRetries = options.maxRetries ?? MAX_ROUTING_RETRIES;
    const enableFallback = options.enableFallback ?? true;
    let lastError;
    const triedProviders = [provider.id];
    let response = await this.executeWithProvider(provider, request);
    if (response.success) {
      this.metrics.successfulRequests++;
      this.updateLatencyMetrics(provider.id, response.metadata.duration);
      return response;
    }
    if (enableFallback && result.alternatives.length > 0) {
      for (const alt of result.alternatives) {
        if (triedProviders.length >= maxRetries) break;
        const altProvider = this.providers.get(alt.provider.id);
        if (!altProvider) continue;
        this.metrics.fallbackAttempts++;
        triedProviders.push(altProvider.id);
        this.events.onFallback?.(provider.id, altProvider.id, response.error ?? "Unknown error");
        response = await this.executeWithProvider(altProvider, request);
        if (response.success) {
          this.metrics.successfulRequests++;
          this.updateLatencyMetrics(altProvider.id, response.metadata.duration);
          return response;
        }
      }
    }
    this.metrics.failedRequests++;
    lastError = new Error(response.error ?? "All providers failed");
    this.events.onAllProvidersFailed?.(triedProviders, lastError);
    return response;
  }
  /**
   * Execute directly with a specific provider (bypass routing)
   */
  async executeWithProvider(providerOrId, request) {
    const provider = typeof providerOrId === "string" ? this.providers.get(providerOrId) : providerOrId;
    if (!provider) {
      throw new Error(`Provider not found: ${providerOrId}`);
    }
    return provider.executeWithTracking(request);
  }
  /**
   * Get provider by type
   */
  getProvider(type) {
    return this.providers.get(type);
  }
  /**
   * Get all providers
   */
  getAllProviders() {
    return new Map(this.providers);
  }
  /**
   * Get enabled provider types
   */
  getEnabledProviders() {
    return Array.from(this.providers.keys());
  }
  /**
   * Check if a provider is available and healthy
   */
  isProviderAvailable(type) {
    const provider = this.providers.get(type);
    return provider !== void 0 && provider.isHealthy();
  }
  /**
   * Get fallback order for providers
   */
  getFallbackChain(context) {
    const routingContext = {
      ...defaultRoutingContext,
      ...context
    };
    const providerStates = this.getProviderStates();
    const ordered = getFallbackOrder(providerStates, routingContext);
    return ordered.map((p) => p.id);
  }
  /**
   * Get routing metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      requestsByProvider: new Map(this.metrics.requestsByProvider),
      avgLatencyByProvider: new Map(this.metrics.avgLatencyByProvider)
    };
  }
  /**
   * Reset routing metrics
   */
  resetMetrics() {
    this.metrics.totalRequests = 0;
    this.metrics.successfulRequests = 0;
    this.metrics.failedRequests = 0;
    this.metrics.fallbackAttempts = 0;
    this.metrics.requestsByProvider.clear();
    this.metrics.avgLatencyByProvider.clear();
  }
  /**
   * Set event handlers
   */
  setEvents(events) {
    Object.assign(this.events, events);
  }
  /**
   * Run health checks on all providers
   */
  async checkAllHealth() {
    const results = /* @__PURE__ */ new Map();
    const checks = Array.from(this.providers.entries()).map(async ([type, provider]) => {
      try {
        const healthy = await provider.checkHealth();
        results.set(type, healthy);
        this.events.onHealthUpdate?.(type, healthy);
      } catch {
        results.set(type, false);
        this.events.onHealthUpdate?.(type, false);
      }
    });
    await Promise.all(checks);
    return results;
  }
  /**
   * Cleanup and stop health checks
   */
  async cleanup() {
    this.stopHealthChecks();
    const cleanups = Array.from(this.providers.values()).map((p) => p.cleanup());
    await Promise.all(cleanups);
    this.providers.clear();
    this.initialized = false;
  }
  // =============================================================================
  // Private Methods
  // =============================================================================
  /**
   * Initialize providers based on configuration
   */
  initializeProviders(factoryOptions) {
    const enabledTypes = this.config.providers.enabled;
    for (const type of enabledTypes) {
      try {
        const provider = createProvider(type, factoryOptions);
        provider.setEvents({
          onHealthChange: (health) => {
            this.events.onHealthUpdate?.(type, health.healthy);
          }
        });
        this.providers.set(type, provider);
      } catch (error) {
        console.warn(
          `[ax/router] Failed to initialize provider ${type}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }
    if (this.providers.size === 0) {
      throw new Error("No providers could be initialized");
    }
  }
  /**
   * Build routing context from request and options
   */
  buildRoutingContext(request, options) {
    const context = {
      taskType: this.inferTaskType(request.task),
      complexity: options.context?.complexity ?? DEFAULT_ROUTING_COMPLEXITY,
      preferMcp: options.context?.preferMcp ?? true,
      excludeProviders: options.excludeProviders ?? []
    };
    if (options.forceProvider) {
      context.forceProvider = options.forceProvider;
    }
    return context;
  }
  /**
   * Select best provider using routing algorithm
   */
  selectBestProvider(context, options) {
    const providerStates = this.getProviderStates();
    if (options.forceProvider) {
      context = { ...context, forceProvider: options.forceProvider };
    }
    return selectProvider(providerStates, context);
  }
  /**
   * Get current state of all providers for routing
   */
  getProviderStates() {
    const fallbackOrder = this.config.providers.fallbackOrder ?? this.config.providers.enabled;
    const getPriority = (type) => {
      const index = fallbackOrder.indexOf(type);
      return index >= 0 ? index + 1 : DEFAULT_PROVIDER_PRIORITY;
    };
    return Array.from(this.providers.entries()).map(([type, provider]) => {
      const health = provider.getHealth();
      return {
        id: type,
        priority: getPriority(type),
        healthy: provider.isHealthy(),
        rateLimit: 0,
        // TODO: implement rate limit tracking
        latencyMs: health.latencyMs,
        successRate: health.successRate,
        integrationMode: provider.integrationMode
      };
    });
  }
  /**
   * Infer task type from task description
   */
  inferTaskType(task) {
    const lowerTask = task.toLowerCase();
    if (lowerTask.includes("code") || lowerTask.includes("implement") || lowerTask.includes("write")) {
      return "coding";
    }
    if (lowerTask.includes("test") || lowerTask.includes("verify") || lowerTask.includes("validate")) {
      return "testing";
    }
    if (lowerTask.includes("review") || lowerTask.includes("analyze") || lowerTask.includes("audit")) {
      return "analysis";
    }
    if (lowerTask.includes("design") || lowerTask.includes("architect") || lowerTask.includes("plan")) {
      return "design";
    }
    if (lowerTask.includes("fix") || lowerTask.includes("debug") || lowerTask.includes("resolve")) {
      return "debugging";
    }
    return "general";
  }
  /**
   * Increment request count for provider
   */
  incrementProviderMetrics(type) {
    const current = this.metrics.requestsByProvider.get(type) ?? 0;
    this.metrics.requestsByProvider.set(type, current + 1);
  }
  /**
   * Update latency metrics for provider
   */
  updateLatencyMetrics(type, latency) {
    const currentAvg = this.metrics.avgLatencyByProvider.get(type) ?? 0;
    const requestCount = this.metrics.requestsByProvider.get(type) ?? 1;
    const newAvg = currentAvg + (latency - currentAvg) / requestCount;
    this.metrics.avgLatencyByProvider.set(type, newAvg);
  }
  /**
   * Start periodic health checks
   */
  startHealthChecks(intervalMs) {
    this.healthCheckIntervalId = setInterval(async () => {
      try {
        await this.checkAllHealth();
      } catch (error) {
        console.warn(
          `[ax/router] Health check failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }, intervalMs);
  }
  /**
   * Stop periodic health checks
   */
  stopHealthChecks() {
    if (this.healthCheckIntervalId) {
      clearInterval(this.healthCheckIntervalId);
      this.healthCheckIntervalId = null;
    }
  }
};
function createProviderRouter(options) {
  return new ProviderRouter(options);
}
export {
  ProviderRouter,
  createProviderRouter
};
/**
 * Provider Router - Intelligent provider selection and routing
 *
 * Uses ReScript routing algorithms for multi-factor provider selection
 * with health monitoring and fallback chain support.
 *
 * @module @ax/core/router
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Router exports
 *
 * @module @ax/core/router
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
//# sourceMappingURL=index.js.map