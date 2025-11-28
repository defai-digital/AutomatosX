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

// =============================================================================
// Router Constants
// =============================================================================

/** Default provider priority (lowest precedence) */
const DEFAULT_PROVIDER_PRIORITY = 99;

/** Default routing complexity */
const DEFAULT_ROUTING_COMPLEXITY = 5;

/** Health check interval in milliseconds */
const DEFAULT_HEALTH_CHECK_INTERVAL_MS = 60_000;

/** Maximum retry attempts for routing */
const MAX_ROUTING_RETRIES = 3;

/** Delay between retries in milliseconds */
const RETRY_DELAY_MS = 1000;

// =============================================================================
// Imports
// =============================================================================

import {
  type Config,
  type ProviderType,
  type ExecutionRequest,
  type ExecutionResponse,
} from '@ax/schemas';
import {
  type Provider as RoutingProvider,
  type RoutingContext as AlgorithmRoutingContext,
  type RoutingResult,
  selectProvider,
  getFallbackOrder,
  defaultRoutingContext,
} from '@ax/algorithms';
import {
  BaseProvider,
  createProvider,
  type ProviderFactoryOptions,
} from '@ax/providers';

// =============================================================================
// Types
// =============================================================================

export interface ProviderRouterOptions {
  /** Configuration object */
  config: Config;
  /** Provider factory options */
  providerOptions?: ProviderFactoryOptions;
  /** Health check interval in ms (default: 60000) */
  healthCheckInterval?: number;
  /** Enable automatic health checks */
  autoHealthCheck?: boolean;
}

export interface RouteOptions {
  /** Routing context override */
  context?: Partial<AlgorithmRoutingContext>;
  /** Force specific provider */
  forceProvider?: ProviderType;
  /** Providers to exclude */
  excludeProviders?: ProviderType[];
  /** Enable fallback on failure */
  enableFallback?: boolean;
  /** Maximum retry attempts */
  maxRetries?: number;
}

export interface RoutingMetrics {
  /** Total requests routed */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Fallback attempts */
  fallbackAttempts: number;
  /** Requests per provider */
  requestsByProvider: Map<ProviderType, number>;
  /** Average latency per provider */
  avgLatencyByProvider: Map<ProviderType, number>;
}

export interface ProviderRouterEvents {
  onProviderSelected?: (provider: ProviderType, reason: string) => void;
  onFallback?: (from: ProviderType, to: ProviderType, reason: string) => void;
  onAllProvidersFailed?: (providers: ProviderType[], error: Error) => void;
  onHealthUpdate?: (provider: ProviderType, healthy: boolean) => void;
}

// =============================================================================
// Provider Router Class
// =============================================================================

export class ProviderRouter {
  private readonly config: Config;
  private readonly providers: Map<ProviderType, BaseProvider> = new Map();
  private readonly metrics: RoutingMetrics;
  private readonly events: ProviderRouterEvents = {};
  private healthCheckIntervalId: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  constructor(options: ProviderRouterOptions) {
    this.config = options.config;
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      fallbackAttempts: 0,
      requestsByProvider: new Map(),
      avgLatencyByProvider: new Map(),
    };

    // Initialize enabled providers
    this.initializeProviders(options.providerOptions);

    // Start health checks if enabled
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
  async route(
    request: ExecutionRequest,
    options: RouteOptions = {}
  ): Promise<ExecutionResponse> {
    this.metrics.totalRequests++;

    const context = this.buildRoutingContext(request, options);
    const result = this.selectBestProvider(context, options);

    if (!result.provider) {
      this.metrics.failedRequests++;
      throw new Error(`No providers available: ${result.reason}`);
    }

    const provider = this.providers.get(result.provider.id as ProviderType);
    if (!provider) {
      throw new Error(`Provider ${result.provider.id} not found in registry`);
    }

    this.events.onProviderSelected?.(provider.id, result.reason);
    this.incrementProviderMetrics(provider.id);

    // Execute with fallback support
    const maxRetries = options.maxRetries ?? MAX_ROUTING_RETRIES;
    const enableFallback = options.enableFallback ?? true;

    const triedProviders: ProviderType[] = [provider.id];

    // First attempt
    let response = await this.executeWithProvider(provider, request);

    if (response.success) {
      this.metrics.successfulRequests++;
      this.updateLatencyMetrics(provider.id, response.metadata.duration);
      return response;
    }

    // Fallback attempts
    if (enableFallback && result.alternatives.length > 0) {
      for (const alt of result.alternatives) {
        if (triedProviders.length >= maxRetries) break;

        const altProvider = this.providers.get(alt.provider.id as ProviderType);
        if (!altProvider) continue;

        this.metrics.fallbackAttempts++;
        triedProviders.push(altProvider.id);
        this.events.onFallback?.(provider.id, altProvider.id, response.error ?? 'Unknown error');

        response = await this.executeWithProvider(altProvider, request);

        if (response.success) {
          this.metrics.successfulRequests++;
          this.updateLatencyMetrics(altProvider.id, response.metadata.duration);
          return response;
        }
      }
    }

    // All attempts failed
    this.metrics.failedRequests++;
    const lastError = new Error(response.error ?? 'All providers failed');
    this.events.onAllProvidersFailed?.(triedProviders, lastError);

    return response;
  }

  /**
   * Execute directly with a specific provider (bypass routing)
   */
  async executeWithProvider(
    providerOrId: BaseProvider | ProviderType,
    request: ExecutionRequest
  ): Promise<ExecutionResponse> {
    const provider = typeof providerOrId === 'string'
      ? this.providers.get(providerOrId)
      : providerOrId;

    if (!provider) {
      throw new Error(`Provider not found: ${providerOrId}`);
    }

    return provider.executeWithTracking(request);
  }

  /**
   * Get provider by type
   */
  getProvider(type: ProviderType): BaseProvider | undefined {
    return this.providers.get(type);
  }

  /**
   * Get all providers
   */
  getAllProviders(): Map<ProviderType, BaseProvider> {
    return new Map(this.providers);
  }

  /**
   * Get enabled provider types
   */
  getEnabledProviders(): ProviderType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider is available and healthy
   */
  isProviderAvailable(type: ProviderType): boolean {
    const provider = this.providers.get(type);
    return provider !== undefined && provider.isHealthy();
  }

  /**
   * Get fallback order for providers
   */
  getFallbackChain(context?: Partial<AlgorithmRoutingContext>): ProviderType[] {
    const routingContext: AlgorithmRoutingContext = {
      ...defaultRoutingContext,
      ...context,
    };

    const providerStates = this.getProviderStates();
    const ordered = getFallbackOrder(providerStates, routingContext);

    return ordered.map(p => p.id as ProviderType);
  }

  /**
   * Get routing metrics
   */
  getMetrics(): RoutingMetrics {
    return {
      ...this.metrics,
      requestsByProvider: new Map(this.metrics.requestsByProvider),
      avgLatencyByProvider: new Map(this.metrics.avgLatencyByProvider),
    };
  }

  /**
   * Reset routing metrics
   */
  resetMetrics(): void {
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
  setEvents(events: ProviderRouterEvents): void {
    Object.assign(this.events, events);
  }

  /**
   * Run health checks on all providers
   */
  async checkAllHealth(): Promise<Map<ProviderType, boolean>> {
    const results = new Map<ProviderType, boolean>();

    const checks = Array.from(this.providers.entries()).map(async ([type, provider]) => {
      try {
        const healthy = await provider.checkHealth();
        results.set(type, healthy);
        this.events.onHealthUpdate?.(type, healthy);
      } catch (error) {
        console.warn(
          `[ax/router] Health check failed for ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
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
  async cleanup(): Promise<void> {
    this.stopHealthChecks();

    const cleanups = Array.from(this.providers.values()).map(p => p.cleanup());
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
  private initializeProviders(factoryOptions?: ProviderFactoryOptions): void {
    const enabledTypes = this.config.providers.enabled;

    for (const type of enabledTypes) {
      try {
        const provider = createProvider(type, factoryOptions);

        // Set up health change events
        provider.setEvents({
          onHealthChange: (health) => {
            this.events.onHealthUpdate?.(type, health.healthy);
          },
        });

        this.providers.set(type, provider);
      } catch (error) {
        console.warn(
          `[ax/router] Failed to initialize provider ${type}: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    if (this.providers.size === 0) {
      throw new Error('No providers could be initialized');
    }
  }

  /**
   * Build routing context from request and options
   *
   * The context now includes:
   * - taskType: Inferred from task description
   * - agentId: For agent-specific provider affinity
   * - taskDescription: For keyword-based routing analysis
   */
  private buildRoutingContext(
    request: ExecutionRequest,
    options: RouteOptions
  ): AlgorithmRoutingContext {
    const context: AlgorithmRoutingContext = {
      taskType: this.inferTaskType(request.task),
      complexity: (options.context?.complexity as number) ?? DEFAULT_ROUTING_COMPLEXITY,
      preferMcp: (options.context?.preferMcp as boolean) ?? true,
      excludeProviders: options.excludeProviders ?? [],
      // Pass full task description for keyword analysis
      taskDescription: request.task,
    };

    // Only set agentId if it exists (for agent-provider affinity matching)
    if (request.agent) {
      context.agentId = request.agent;
    }

    // Only set forceProvider if it exists
    if (options.forceProvider) {
      context.forceProvider = options.forceProvider;
    }

    return context;
  }

  /**
   * Select best provider using routing algorithm
   */
  private selectBestProvider(
    context: AlgorithmRoutingContext,
    options: RouteOptions
  ): RoutingResult {
    const providerStates = this.getProviderStates();

    // Apply force provider if specified
    if (options.forceProvider) {
      context = { ...context, forceProvider: options.forceProvider };
    }

    return selectProvider(providerStates, context);
  }

  /**
   * Get current state of all providers for routing
   */
  private getProviderStates(): RoutingProvider[] {
    // Get priority from fallback order position, or use default
    const fallbackOrder = this.config.providers.fallbackOrder ?? this.config.providers.enabled;
    const getPriority = (type: ProviderType): number => {
      const index = fallbackOrder.indexOf(type);
      return index >= 0 ? index + 1 : DEFAULT_PROVIDER_PRIORITY;
    };

    return Array.from(this.providers.entries()).map(([type, provider]) => {
      const health = provider.getHealth();

      return {
        id: type,
        priority: getPriority(type),
        healthy: provider.isHealthy(),
        rateLimit: 0, // TODO: implement rate limit tracking
        latencyMs: health.latencyMs,
        successRate: health.successRate,
        integrationMode: provider.integrationMode,
      };
    });
  }

  /**
   * Infer task type from task description
   *
   * Three task classes with provider assignments:
   *
   * CLASS 1: PLANNING/STRATEGY → OpenAI primary
   *   planning, architecture, strategy, research, requirements, roadmap, analysis
   *
   * CLASS 2: FRONTEND/CREATIVE → Gemini primary
   *   frontend, ui, ux, creative, styling, animation, visual, design, branding, marketing
   *
   * CLASS 3: CODING/TECHNICAL → Claude primary
   *   coding, debugging, implementation, refactoring, testing, review, security,
   *   devops, infrastructure, backend, api, database, documentation
   *
   * ax-cli is always the last fallback for all task types.
   */
  private inferTaskType(task: string): string {
    const lowerTask = task.toLowerCase();

    // =========================================================================
    // CLASS 1: PLANNING/STRATEGY → OpenAI primary
    // =========================================================================

    // Planning and roadmap tasks
    if (/\b(plan|roadmap|requirements|prd|specification|propose)\b/.test(lowerTask)) {
      return 'planning';
    }

    // Architecture and system design
    if (/\b(architect|system design|design system|scalab|microservice|monolith)\b/.test(lowerTask)) {
      return 'architecture';
    }

    // Strategy tasks
    if (/\b(strategy|strategic|decision|trade-?off|evaluate options)\b/.test(lowerTask)) {
      return 'strategy';
    }

    // Research tasks
    if (/\b(research|investigate|explore|compare|benchmark|study)\b/.test(lowerTask)) {
      return 'research';
    }

    // =========================================================================
    // CLASS 2: FRONTEND/CREATIVE → Gemini primary
    // =========================================================================

    // Frontend development
    if (/\b(frontend|front-end|react|vue|angular|svelte|nextjs|nuxt)\b/.test(lowerTask)) {
      return 'frontend';
    }

    // UI/UX tasks
    if (/\b(ui|ux|user interface|user experience|component|widget)\b/.test(lowerTask)) {
      return 'ui';
    }

    // Styling and CSS
    if (/\b(css|tailwind|styled|styling|sass|scss|responsive|layout)\b/.test(lowerTask)) {
      return 'styling';
    }

    // Animation
    if (/\b(animation|animate|motion|transition|framer)\b/.test(lowerTask)) {
      return 'animation';
    }

    // Creative and visual
    if (/\b(creative|visual|graphic|illustration|artwork)\b/.test(lowerTask)) {
      return 'creative';
    }

    // Design (UI design goes to Gemini)
    if (/\b(design|wireframe|mockup|prototype|figma)\b/.test(lowerTask)) {
      return 'design';
    }

    // Branding and marketing
    if (/\b(brand|branding|marketing|campaign|content|copy)\b/.test(lowerTask)) {
      return 'marketing';
    }

    // =========================================================================
    // CLASS 3: CODING/TECHNICAL → Claude primary
    // =========================================================================

    // Debugging
    if (/\b(debug|fix|bug|error|issue|problem|troubleshoot|resolve)\b/.test(lowerTask)) {
      return 'debugging';
    }

    // Implementation and coding
    if (/\b(implement|code|write|create function|build|develop)\b/.test(lowerTask)) {
      return 'coding';
    }

    // Refactoring
    if (/\b(refactor|restructure|reorganize|clean up|optimize code)\b/.test(lowerTask)) {
      return 'refactoring';
    }

    // Testing
    if (/\b(test|spec|coverage|unit|e2e|integration|verify|validate)\b/.test(lowerTask)) {
      return 'testing';
    }

    // Code review
    if (/\b(review|code review|pull request|pr|audit code)\b/.test(lowerTask)) {
      return 'review';
    }

    // Security
    if (/\b(security|vulnerab|threat|owasp|penetration|xss|injection)\b/.test(lowerTask)) {
      return 'security';
    }

    // DevOps and infrastructure
    if (/\b(devops|deploy|ci|cd|pipeline|docker|kubernetes|terraform)\b/.test(lowerTask)) {
      return 'devops';
    }

    // Backend and API
    if (/\b(backend|back-end|api|endpoint|rest|graphql|server)\b/.test(lowerTask)) {
      return 'backend';
    }

    // Database
    if (/\b(database|db|sql|query|migration|schema|postgres|mysql|mongo)\b/.test(lowerTask)) {
      return 'database';
    }

    // Documentation
    if (/\b(document|docs|readme|explain|describe|guide|tutorial)\b/.test(lowerTask)) {
      return 'documentation';
    }

    // Data and ML (leans toward OpenAI but Claude is secondary)
    if (/\b(data|etl|ml|machine learning|model|training|prediction)\b/.test(lowerTask)) {
      return 'data';
    }

    return 'general';
  }

  /**
   * Increment request count for provider
   */
  private incrementProviderMetrics(type: ProviderType): void {
    const current = this.metrics.requestsByProvider.get(type) ?? 0;
    this.metrics.requestsByProvider.set(type, current + 1);
  }

  /**
   * Update latency metrics for provider
   */
  private updateLatencyMetrics(type: ProviderType, latency: number): void {
    const currentAvg = this.metrics.avgLatencyByProvider.get(type) ?? 0;
    const requestCount = this.metrics.requestsByProvider.get(type) ?? 1;

    // Running average calculation
    const newAvg = currentAvg + (latency - currentAvg) / requestCount;
    this.metrics.avgLatencyByProvider.set(type, newAvg);
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(intervalMs: number): void {
    this.healthCheckIntervalId = setInterval(async () => {
      try {
        await this.checkAllHealth();
      } catch (error) {
        console.warn(
          `[ax/router] Health check failed: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }, intervalMs);

    // Unref the interval so it doesn't prevent process exit
    if (this.healthCheckIntervalId.unref) {
      this.healthCheckIntervalId.unref();
    }
  }

  /**
   * Stop periodic health checks
   */
  private stopHealthChecks(): void {
    if (this.healthCheckIntervalId) {
      clearInterval(this.healthCheckIntervalId);
      this.healthCheckIntervalId = null;
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new provider router instance
 */
export function createProviderRouter(options: ProviderRouterOptions): ProviderRouter {
  return new ProviderRouter(options);
}
