/**
 * Provider Router V2 - Real Provider SDK Integration
 *
 * Sprint 3 Day 22-23: Updated to use real Claude, Gemini, and OpenAI providers
 * instead of mocks. Maintains backward compatibility with existing interface.
 */
import { EventEmitter } from 'events';
/**
 * Supported AI providers
 */
export type ProviderType = 'claude' | 'gemini' | 'openai';
/**
 * Provider configuration (backward compatible with V1)
 */
export interface ProviderConfig {
    enabled: boolean;
    priority: number;
    apiKey?: string;
    maxRetries: number;
    timeout: number;
    defaultModel?: string;
    rateLimitPerMinute?: number;
}
/**
 * Legacy provider request format (for backward compatibility)
 */
export interface ProviderRequest {
    model?: string;
    prompt?: string;
    messages?: Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
    }>;
    maxTokens?: number;
    temperature?: number;
    stopSequences?: string[];
    metadata?: Record<string, any>;
}
/**
 * Provider response (backward compatible with V1)
 */
export interface ProviderResponse {
    provider: ProviderType;
    model: string;
    content: string;
    tokensUsed: number;
    latency: number;
    finishReason: 'complete' | 'length' | 'stop' | 'error' | 'tool_use';
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
    defaultProvider?: ProviderType;
    chaosMode?: boolean;
    telemetryEnabled?: boolean;
}
/**
 * Provider Router V2
 *
 * Manages multiple AI providers with real SDK integration, automatic fallback,
 * retry logic, and SLA tracking.
 *
 * @example
 * ```typescript
 * const router = new ProviderRouterV2({
 *   providers: {
 *     claude: {
 *       enabled: true,
 *       priority: 1,
 *       apiKey: process.env.ANTHROPIC_API_KEY,
 *       maxRetries: 3,
 *       timeout: 30000
 *     },
 *     gemini: {
 *       enabled: true,
 *       priority: 2,
 *       apiKey: process.env.GOOGLE_API_KEY,
 *       maxRetries: 2,
 *       timeout: 30000
 *     }
 *   }
 * })
 *
 * const response = await router.request({
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   maxTokens: 100
 * })
 * ```
 */
export declare class ProviderRouterV2 extends EventEmitter {
    private config;
    private providers;
    private healthMetrics;
    private requestCounts;
    private chaosMode;
    constructor(options: ProviderRouterOptions);
    /**
     * Initialize real provider SDK instances
     */
    private initializeProviders;
    /**
     * Initialize health metrics for all enabled providers
     */
    private initializeHealthMetrics;
    /**
     * Make a request to the best available provider with automatic fallback
     */
    request(request: ProviderRequest): Promise<ProviderResponse>;
    /**
     * Execute request to specific provider using real SDK
     */
    private executeRequest;
    /**
     * Convert legacy request format to SDK provider request format
     */
    private convertToSDKRequest;
    /**
     * Convert SDK provider response to legacy format
     */
    private convertFromSDKResponse;
    /**
     * Map SDK finish reason to legacy format
     */
    private mapFinishReason;
    /**
     * Select best provider based on health metrics and priority
     */
    selectProvider(): RoutingDecision;
    /**
     * Get health status for all providers
     */
    getHealthStatus(): Map<ProviderType, ProviderHealth>;
    /**
     * Get health status for specific provider
     */
    getProviderHealth(provider: ProviderType): ProviderHealth | undefined;
    /**
     * Perform health check on all providers
     */
    performHealthChecks(): Promise<Map<ProviderType, boolean>>;
    /**
     * Update health metrics for a provider
     */
    private updateHealthMetrics;
    /**
     * Delay utility for exponential backoff
     */
    private delay;
    /**
     * Get routing statistics
     */
    getStatistics(): Record<string, any>;
    /**
     * Get health status for all providers (compatibility method)
     */
    getHealth(): Promise<Record<string, unknown>>;
    /**
     * Route request (V1 compatibility wrapper)
     */
    route(request: any): Promise<any>;
}
/**
 * Factory function to create a ProviderRouterV2 instance with sensible defaults
 */
export declare function createProviderRouter(options?: Partial<ProviderRouterOptions>): ProviderRouterV2;
//# sourceMappingURL=ProviderRouterV2.d.ts.map