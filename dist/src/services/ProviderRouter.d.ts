import { EventEmitter } from 'events';
/**
 * Supported AI providers
 */
export type ProviderType = 'claude' | 'gemini' | 'openai';
/**
 * Provider configuration
 */
export interface ProviderConfig {
    enabled: boolean;
    priority: number;
    apiKey?: string;
    maxRetries: number;
    timeout: number;
    rateLimitPerMinute?: number;
}
/**
 * Provider request
 */
export interface ProviderRequest {
    model: string;
    prompt: string;
    maxTokens?: number;
    temperature?: number;
    stopSequences?: string[];
    metadata?: Record<string, any>;
}
/**
 * Provider response
 */
export interface ProviderResponse {
    provider: ProviderType;
    model: string;
    content: string;
    tokensUsed: number;
    latency: number;
    finishReason: 'complete' | 'length' | 'stop' | 'error';
    metadata?: Record<string, any>;
}
/**
 * Provider health metrics
 */
export interface ProviderHealth {
    provider: ProviderType;
    available: boolean;
    latency: number;
    errorRate: number;
    requestsInLastMinute: number;
    lastError?: string;
    lastSuccessAt?: Date;
}
/**
 * Routing decision
 */
export interface RoutingDecision {
    selectedProvider: ProviderType;
    reason: string;
    fallbackChain: ProviderType[];
    estimatedLatency: number;
}
/**
 * Provider Router Options
 */
export interface ProviderRouterOptions {
    providers: Record<ProviderType, ProviderConfig>;
    chaosMode?: boolean;
    telemetryEnabled?: boolean;
}
/**
 * Provider Router
 *
 * Manages multiple AI providers with automatic fallback, retry logic, and SLA tracking
 *
 * @example
 * ```typescript
 * const router = new ProviderRouter({
 *   providers: {
 *     claude: { enabled: true, priority: 1, maxRetries: 3, timeout: 30000 },
 *     gemini: { enabled: true, priority: 2, maxRetries: 2, timeout: 30000 },
 *     openai: { enabled: false, priority: 3, maxRetries: 2, timeout: 30000 }
 *   }
 * })
 *
 * const response = await router.request({
 *   model: 'claude-sonnet-4-5',
 *   prompt: 'Write a function...',
 *   maxTokens: 4096
 * })
 * ```
 */
export declare class ProviderRouter extends EventEmitter {
    private config;
    private healthMetrics;
    private requestCounts;
    private chaosMode;
    constructor(options: ProviderRouterOptions);
    /**
     * Make a request to the best available provider with automatic fallback
     */
    request(request: ProviderRequest): Promise<ProviderResponse>;
    /**
     * Execute request to specific provider
     */
    private executeRequest;
    /**
     * Call provider API (mock implementation)
     * TODO: Replace with actual provider SDK calls
     */
    private callProviderAPI;
    /**
     * Select best provider based on health metrics and priority
     */
    selectProvider(): RoutingDecision;
    /**
     * Get health status for all providers
     */
    getHealthStatus(): Map<ProviderType, ProviderHealth>;
    /**
     * Get health for specific provider
     */
    getProviderHealth(provider: ProviderType): ProviderHealth | undefined;
    /**
     * Enable/disable chaos mode for testing
     */
    setChaosMode(enabled: boolean): void;
    /**
     * Force provider availability (for testing)
     */
    setProviderAvailability(provider: ProviderType, available: boolean): void;
    /**
     * Initialize health metrics for all providers
     */
    private initializeHealthMetrics;
    /**
     * Update health metrics after request
     */
    private updateHealthMetrics;
    /**
     * Delay helper
     */
    private delay;
    /**
     * Get routing statistics
     */
    getStatistics(): {
        totalRequests: number;
        requestsByProvider: Record<ProviderType, number>;
        averageLatency: number;
        errorRate: number;
    };
}
/**
 * Create default provider router from config
 */
export declare function createProviderRouter(config?: Partial<ProviderRouterOptions>): ProviderRouter;
//# sourceMappingURL=ProviderRouter.d.ts.map