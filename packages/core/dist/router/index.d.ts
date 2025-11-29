import { Config, ExecutionRequest, ProviderType, ExecutionResponse } from '@ax/schemas';
import { RoutingContext } from '@ax/algorithms';
import { ProviderFactoryOptions, BaseProvider } from '@ax/providers';

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

interface ProviderRouterOptions {
    /** Configuration object */
    config: Config;
    /** Provider factory options */
    providerOptions?: ProviderFactoryOptions;
    /** Health check interval in ms (default: 60000) */
    healthCheckInterval?: number;
    /** Enable automatic health checks */
    autoHealthCheck?: boolean;
}
interface RouteOptions {
    /** Routing context override */
    context?: Partial<RoutingContext>;
    /** Force specific provider */
    forceProvider?: ProviderType;
    /** Providers to exclude */
    excludeProviders?: ProviderType[];
    /** Enable fallback on failure */
    enableFallback?: boolean;
    /** Maximum retry attempts */
    maxRetries?: number;
}
interface RoutingMetrics {
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
interface ProviderRouterEvents {
    onProviderSelected?: (provider: ProviderType, reason: string) => void;
    onFallback?: (from: ProviderType, to: ProviderType, reason: string) => void;
    onAllProvidersFailed?: (providers: ProviderType[], error: Error) => void;
    onHealthUpdate?: (provider: ProviderType, healthy: boolean) => void;
}
declare class ProviderRouter {
    private readonly config;
    private readonly providers;
    private readonly metrics;
    private readonly events;
    private healthCheckIntervalId;
    private initialized;
    constructor(options: ProviderRouterOptions);
    /**
     * Route a task to the best available provider
     */
    route(request: ExecutionRequest, options?: RouteOptions): Promise<ExecutionResponse>;
    /**
     * Execute directly with a specific provider (bypass routing)
     */
    executeWithProvider(providerOrId: BaseProvider | ProviderType, request: ExecutionRequest): Promise<ExecutionResponse>;
    /**
     * Get provider by type
     */
    getProvider(type: ProviderType): BaseProvider | undefined;
    /**
     * Get all providers
     */
    getAllProviders(): Map<ProviderType, BaseProvider>;
    /**
     * Get enabled provider types
     */
    getEnabledProviders(): ProviderType[];
    /**
     * Check if a provider is available and healthy
     */
    isProviderAvailable(type: ProviderType): boolean;
    /**
     * Get fallback order for providers
     */
    getFallbackChain(context?: Partial<RoutingContext>): ProviderType[];
    /**
     * Get routing metrics
     */
    getMetrics(): RoutingMetrics;
    /**
     * Reset routing metrics
     */
    resetMetrics(): void;
    /**
     * Set event handlers
     */
    setEvents(events: ProviderRouterEvents): void;
    /**
     * Run health checks on all providers
     */
    checkAllHealth(): Promise<Map<ProviderType, boolean>>;
    /**
     * Cleanup and stop health checks
     */
    cleanup(): Promise<void>;
    /**
     * Initialize providers based on configuration
     */
    private initializeProviders;
    /**
     * Build routing context from request and options
     *
     * The context now includes:
     * - taskType: Inferred from task description
     * - agentId: For agent-specific provider affinity
     * - taskDescription: For keyword-based routing analysis
     */
    private buildRoutingContext;
    /**
     * Select best provider using routing algorithm
     */
    private selectBestProvider;
    /**
     * Get current state of all providers for routing
     */
    private getProviderStates;
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
    private inferTaskType;
    /**
     * Increment request count for provider
     */
    private incrementProviderMetrics;
    /**
     * Update latency metrics for provider using cumulative moving average
     */
    private updateLatencyMetrics;
    /**
     * Start periodic health checks
     */
    private startHealthChecks;
    /**
     * Stop periodic health checks
     */
    private stopHealthChecks;
}
/**
 * Create a new provider router instance
 */
declare function createProviderRouter(options: ProviderRouterOptions): ProviderRouter;

export { ProviderRouter, type ProviderRouterEvents, type ProviderRouterOptions, type RouteOptions, type RoutingMetrics, createProviderRouter };
