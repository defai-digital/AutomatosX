/**
 * ProviderRouter.ts
 *
 * Routes requests to appropriate AI providers with automatic fallback support.
 * Implements circuit breaker pattern for resilience.
 *
 * Phase 2 Week 2 Day 6: ProviderRouter Core
 */
import type { BaseProvider } from './BaseProvider.js';
import type { ProviderRequest, ProviderResponse, ProviderType } from '../../../../src/types/schemas/provider.schema.js';
export interface ProviderRouterConfig {
    primaryProvider: ProviderType;
    fallbackChain: ProviderType[];
    circuitBreakerThreshold?: number;
    circuitBreakerTimeout?: number;
    enableFallback?: boolean;
}
interface CircuitBreakerState {
    failures: number;
    lastFailureTime: number;
    state: 'closed' | 'open' | 'half-open';
}
/**
 * ProviderRouter manages multiple AI providers with automatic fallback.
 * Implements circuit breaker pattern to avoid cascading failures.
 */
export declare class ProviderRouter {
    private providers;
    private config;
    private circuitBreakers;
    private readonly defaultCircuitBreakerThreshold;
    private readonly defaultCircuitBreakerTimeout;
    constructor(config: ProviderRouterConfig);
    /**
     * Register a provider implementation
     * @param provider - The provider instance to register
     */
    registerProvider(provider: BaseProvider): void;
    /**
     * Route a request to the appropriate provider with fallback support
     * @param request - The provider request
     * @returns Promise<ProviderResponse> - The provider response
     */
    routeRequest(request: ProviderRequest): Promise<ProviderResponse>;
    /**
     * Check if a provider is available (circuit breaker check)
     * @param providerType - The provider type to check
     * @returns boolean - True if provider is available
     */
    private isProviderAvailable;
    /**
     * Record a successful request for circuit breaker
     * @param providerType - The provider type
     */
    private recordSuccess;
    /**
     * Record a failed request for circuit breaker
     * @param providerType - The provider type
     */
    private recordFailure;
    /**
     * Get the health status of all registered providers
     * @returns Promise<Map<ProviderType, boolean>> - Health status map
     */
    getProviderHealthStatus(): Promise<Map<ProviderType, boolean>>;
    /**
     * Get the circuit breaker states for all providers
     * @returns Map<ProviderType, CircuitBreakerState> - Circuit breaker states
     */
    getCircuitBreakerStates(): Map<ProviderType, CircuitBreakerState>;
    /**
     * Manually reset a provider's circuit breaker
     * @param providerType - The provider type to reset
     */
    resetCircuitBreaker(providerType: ProviderType): void;
    /**
     * Get router configuration
     */
    getConfig(): ProviderRouterConfig;
    /**
     * Update router configuration
     * @param config - Partial configuration to update
     */
    updateConfig(config: Partial<ProviderRouterConfig>): void;
    /**
     * Normalize different error types into ProviderError
     * @param error - The error to normalize
     * @param providerType - The provider type
     * @returns ProviderError
     */
    private normalizeError;
    /**
     * Determine if an error message indicates a retryable error
     * @param message - The error message
     * @returns boolean
     */
    private isRetryableErrorMessage;
    /**
     * Create a standardized ProviderError
     * @param message - Error message
     * @param code - Error code
     * @returns ProviderError
     */
    private createError;
    /**
     * Log router activity
     * @param level - Log level
     * @param message - Log message
     * @param data - Additional data
     */
    private log;
}
export {};
//# sourceMappingURL=ProviderRouter.d.ts.map