/**
 * ProviderRouter.ts
 *
 * Routes requests to appropriate AI providers with automatic fallback support.
 * Implements circuit breaker pattern for resilience.
 *
 * Phase 2 Week 2 Day 6: ProviderRouter Core
 */
import { validateProviderRequest } from '../../../../src/types/schemas/provider.schema.js';
/**
 * ProviderRouter manages multiple AI providers with automatic fallback.
 * Implements circuit breaker pattern to avoid cascading failures.
 */
export class ProviderRouter {
    providers;
    config;
    circuitBreakers;
    defaultCircuitBreakerThreshold = 5;
    defaultCircuitBreakerTimeout = 60000; // 60 seconds
    constructor(config) {
        this.config = {
            ...config,
            circuitBreakerThreshold: config.circuitBreakerThreshold ?? this.defaultCircuitBreakerThreshold,
            circuitBreakerTimeout: config.circuitBreakerTimeout ?? this.defaultCircuitBreakerTimeout,
            enableFallback: config.enableFallback ?? true,
        };
        this.providers = new Map();
        this.circuitBreakers = new Map();
    }
    /**
     * Register a provider implementation
     * @param provider - The provider instance to register
     */
    registerProvider(provider) {
        const providerType = provider.getProviderType();
        this.providers.set(providerType, provider);
        this.circuitBreakers.set(providerType, {
            failures: 0,
            lastFailureTime: 0,
            state: 'closed',
        });
    }
    /**
     * Route a request to the appropriate provider with fallback support
     * @param request - The provider request
     * @returns Promise<ProviderResponse> - The provider response
     */
    async routeRequest(request) {
        // Validate request
        validateProviderRequest(request);
        // Build provider chain: primary + fallbacks
        const providerChain = [
            this.config.primaryProvider,
            ...(this.config.enableFallback ? this.config.fallbackChain : []),
        ];
        let lastError = null;
        // Try each provider in the chain
        for (const providerType of providerChain) {
            try {
                // Check circuit breaker
                if (!this.isProviderAvailable(providerType)) {
                    this.log('warn', `Provider ${providerType} circuit breaker is open, skipping`);
                    continue;
                }
                const provider = this.providers.get(providerType);
                if (!provider) {
                    this.log('warn', `Provider ${providerType} not registered, skipping`);
                    continue;
                }
                // Update request to use this provider
                const providerRequest = {
                    ...request,
                    provider: providerType,
                };
                this.log('info', `Routing request to ${providerType}`, {
                    requestId: request.metadata.requestId,
                    model: request.model,
                });
                // Send request
                const response = request.stream
                    ? await provider.sendStreamingRequest(providerRequest, {})
                    : await provider.sendRequest(providerRequest);
                // Success - reset circuit breaker
                this.recordSuccess(providerType);
                return response;
            }
            catch (error) {
                lastError = this.normalizeError(error, providerType);
                this.recordFailure(providerType);
                this.log('error', `Provider ${providerType} failed`, {
                    error: lastError.error,
                    code: lastError.code,
                    retryable: lastError.retryable,
                });
                // If not retryable and fallback is disabled, throw immediately
                if (!lastError.retryable && !this.config.enableFallback) {
                    throw lastError;
                }
                // Continue to next provider in chain
                continue;
            }
        }
        // All providers failed
        throw lastError || this.createError('All providers failed', 'all_providers_failed');
    }
    /**
     * Check if a provider is available (circuit breaker check)
     * @param providerType - The provider type to check
     * @returns boolean - True if provider is available
     */
    isProviderAvailable(providerType) {
        const breaker = this.circuitBreakers.get(providerType);
        if (!breaker) {
            return true;
        }
        const now = Date.now();
        switch (breaker.state) {
            case 'closed':
                return true;
            case 'open':
                // Check if timeout has elapsed
                const timeoutElapsed = now - breaker.lastFailureTime > (this.config.circuitBreakerTimeout || 60000);
                if (timeoutElapsed) {
                    // Transition to half-open
                    breaker.state = 'half-open';
                    this.log('info', `Circuit breaker for ${providerType} transitioning to half-open`);
                    return true;
                }
                return false;
            case 'half-open':
                // Allow one request to test if provider is back
                return true;
            default:
                return true;
        }
    }
    /**
     * Record a successful request for circuit breaker
     * @param providerType - The provider type
     */
    recordSuccess(providerType) {
        const breaker = this.circuitBreakers.get(providerType);
        if (!breaker) {
            return;
        }
        if (breaker.state === 'half-open') {
            this.log('info', `Circuit breaker for ${providerType} closing after successful request`);
        }
        // Reset circuit breaker
        breaker.failures = 0;
        breaker.state = 'closed';
    }
    /**
     * Record a failed request for circuit breaker
     * @param providerType - The provider type
     */
    recordFailure(providerType) {
        const breaker = this.circuitBreakers.get(providerType);
        if (!breaker) {
            return;
        }
        breaker.failures += 1;
        breaker.lastFailureTime = Date.now();
        const threshold = this.config.circuitBreakerThreshold || 5;
        if (breaker.state === 'half-open') {
            // Failed in half-open state, reopen circuit
            breaker.state = 'open';
            this.log('warn', `Circuit breaker for ${providerType} reopening after failure in half-open state`);
        }
        else if (breaker.failures >= threshold) {
            // Threshold reached, open circuit
            breaker.state = 'open';
            this.log('warn', `Circuit breaker for ${providerType} opening after ${breaker.failures} failures`);
        }
    }
    /**
     * Get the health status of all registered providers
     * @returns Promise<Map<ProviderType, boolean>> - Health status map
     */
    async getProviderHealthStatus() {
        const healthMap = new Map();
        for (const [providerType, provider] of this.providers) {
            try {
                const isHealthy = await provider.isHealthy();
                healthMap.set(providerType, isHealthy);
            }
            catch (error) {
                healthMap.set(providerType, false);
            }
        }
        return healthMap;
    }
    /**
     * Get the circuit breaker states for all providers
     * @returns Map<ProviderType, CircuitBreakerState> - Circuit breaker states
     */
    getCircuitBreakerStates() {
        return new Map(this.circuitBreakers);
    }
    /**
     * Manually reset a provider's circuit breaker
     * @param providerType - The provider type to reset
     */
    resetCircuitBreaker(providerType) {
        const breaker = this.circuitBreakers.get(providerType);
        if (breaker) {
            breaker.failures = 0;
            breaker.lastFailureTime = 0;
            breaker.state = 'closed';
            this.log('info', `Circuit breaker for ${providerType} manually reset`);
        }
    }
    /**
     * Get router configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Update router configuration
     * @param config - Partial configuration to update
     */
    updateConfig(config) {
        this.config = {
            ...this.config,
            ...config,
        };
    }
    /**
     * Normalize different error types into ProviderError
     * @param error - The error to normalize
     * @param providerType - The provider type
     * @returns ProviderError
     */
    normalizeError(error, providerType) {
        if (typeof error === 'object' && error !== null && 'error' in error) {
            return error;
        }
        if (error instanceof Error) {
            return {
                error: error.message,
                provider: providerType,
                retryable: this.isRetryableErrorMessage(error.message),
            };
        }
        return {
            error: String(error),
            provider: providerType,
            retryable: false,
        };
    }
    /**
     * Determine if an error message indicates a retryable error
     * @param message - The error message
     * @returns boolean
     */
    isRetryableErrorMessage(message) {
        const retryablePatterns = [
            /rate limit/i,
            /timeout/i,
            /network/i,
            /connection/i,
            /503/,
            /502/,
            /429/,
        ];
        return retryablePatterns.some((pattern) => pattern.test(message));
    }
    /**
     * Create a standardized ProviderError
     * @param message - Error message
     * @param code - Error code
     * @returns ProviderError
     */
    createError(message, code) {
        return {
            error: message,
            code: code,
            retryable: false,
        };
    }
    /**
     * Log router activity
     * @param level - Log level
     * @param message - Log message
     * @param data - Additional data
     */
    log(level, message, data) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            component: 'ProviderRouter',
            level,
            message,
            data,
        };
        // TODO: Integrate with proper logging system
        if (level === 'error') {
            console.error(`[${timestamp}] [ProviderRouter] ERROR:`, message, data);
        }
        else if (level === 'warn') {
            console.warn(`[${timestamp}] [ProviderRouter] WARN:`, message, data);
        }
        else {
            console.log(`[${timestamp}] [ProviderRouter] INFO:`, message, data);
        }
    }
}
//# sourceMappingURL=ProviderRouter.js.map