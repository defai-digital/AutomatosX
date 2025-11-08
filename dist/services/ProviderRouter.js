// Sprint 2 Day 14: Multi-Provider Routing Adapter
// Provides unified interface for Claude, Gemini, and OpenAI with automatic fallback
import { EventEmitter } from 'events';
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
export class ProviderRouter extends EventEmitter {
    config;
    healthMetrics;
    requestCounts;
    chaosMode;
    constructor(options) {
        super();
        this.config = options;
        this.chaosMode = options.chaosMode ?? false;
        this.healthMetrics = new Map();
        this.requestCounts = new Map();
        // Initialize health metrics
        this.initializeHealthMetrics();
    }
    /**
     * Make a request to the best available provider with automatic fallback
     */
    async request(request) {
        const decision = this.selectProvider();
        this.emit('routing-decision', decision);
        let lastError = null;
        // Try primary provider first, then fallback chain
        for (const provider of [decision.selectedProvider, ...decision.fallbackChain]) {
            const providerConfig = this.config.providers[provider];
            if (!providerConfig?.enabled) {
                continue;
            }
            // Try with retries
            for (let attempt = 0; attempt < providerConfig.maxRetries; attempt++) {
                try {
                    this.emit('attempt', { provider, attempt: attempt + 1 });
                    const response = await this.executeRequest(provider, request, providerConfig);
                    // Update health metrics on success
                    this.updateHealthMetrics(provider, true, response.latency);
                    this.emit('success', { provider, response });
                    return response;
                }
                catch (error) {
                    lastError = error;
                    this.updateHealthMetrics(provider, false, 0, lastError.message);
                    this.emit('error', { provider, attempt: attempt + 1, error: lastError });
                    // Wait before retry (exponential backoff)
                    if (attempt < providerConfig.maxRetries - 1) {
                        await this.delay(Math.pow(2, attempt) * 1000);
                    }
                }
            }
        }
        // All providers failed
        throw new Error(`All providers failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }
    /**
     * Execute request to specific provider
     */
    async executeRequest(provider, request, config) {
        // Chaos mode: randomly fail requests for testing
        if (this.chaosMode && Math.random() < 0.3) {
            throw new Error(`Chaos mode: Simulated failure for ${provider}`);
        }
        const startTime = Date.now();
        // Simulate provider API call (replace with actual implementation)
        const response = await this.callProviderAPI(provider, request, config);
        const latency = Date.now() - startTime;
        return {
            provider,
            model: request.model,
            content: response.content,
            tokensUsed: response.tokensUsed,
            latency,
            finishReason: response.finishReason,
            metadata: response.metadata,
        };
    }
    /**
     * Call provider API (mock implementation)
     * TODO: Replace with actual provider SDK calls
     */
    async callProviderAPI(provider, request, config) {
        // Simulate network delay
        await this.delay(100 + Math.random() * 200);
        // Check timeout
        if (Math.random() < 0.05 && !this.chaosMode) {
            throw new Error('Request timeout');
        }
        // Mock response
        return {
            content: `Mock response from ${provider}: ${request.prompt.substring(0, 50)}...`,
            tokensUsed: 150,
            finishReason: 'complete',
            metadata: { provider, model: request.model },
        };
    }
    /**
     * Select best provider based on health metrics and priority
     */
    selectProvider() {
        const availableProviders = Array.from(this.healthMetrics.entries())
            .filter(([_, health]) => health.available)
            .sort((a, b) => {
            const configA = this.config.providers[a[0]];
            const configB = this.config.providers[b[0]];
            return (configA?.priority || 999) - (configB?.priority || 999);
        });
        if (availableProviders.length === 0) {
            throw new Error('No providers available');
        }
        const [selectedProvider] = availableProviders[0];
        const fallbackChain = availableProviders.slice(1).map(([provider]) => provider);
        return {
            selectedProvider,
            reason: `Priority-based selection (priority ${this.config.providers[selectedProvider]?.priority})`,
            fallbackChain,
            estimatedLatency: availableProviders[0][1].latency,
        };
    }
    /**
     * Get health status for all providers
     */
    getHealthStatus() {
        return new Map(this.healthMetrics);
    }
    /**
     * Get health for specific provider
     */
    getProviderHealth(provider) {
        return this.healthMetrics.get(provider);
    }
    /**
     * Enable/disable chaos mode for testing
     */
    setChaosMode(enabled) {
        this.chaosMode = enabled;
        this.emit('chaos-mode-changed', { enabled });
    }
    /**
     * Force provider availability (for testing)
     */
    setProviderAvailability(provider, available) {
        const health = this.healthMetrics.get(provider);
        if (health) {
            health.available = available;
            this.emit('availability-changed', { provider, available });
        }
    }
    /**
     * Initialize health metrics for all providers
     */
    initializeHealthMetrics() {
        const providers = ['claude', 'gemini', 'openai'];
        providers.forEach(provider => {
            this.healthMetrics.set(provider, {
                provider,
                available: this.config.providers[provider]?.enabled ?? false,
                latency: 0,
                errorRate: 0,
                requestsInLastMinute: 0,
                lastSuccessAt: undefined,
                lastError: undefined,
            });
            this.requestCounts.set(provider, []);
        });
    }
    /**
     * Update health metrics after request
     */
    updateHealthMetrics(provider, success, latency, error) {
        const health = this.healthMetrics.get(provider);
        if (!health)
            return;
        const now = Date.now();
        const counts = this.requestCounts.get(provider) || [];
        // Add current request timestamp
        counts.push(now);
        // Remove timestamps older than 1 minute
        const oneMinuteAgo = now - 60000;
        const recentCounts = counts.filter(timestamp => timestamp > oneMinuteAgo);
        this.requestCounts.set(provider, recentCounts);
        // Update health metrics
        health.requestsInLastMinute = recentCounts.length;
        health.latency = success ? latency : health.latency;
        health.lastError = error;
        health.lastSuccessAt = success ? new Date() : health.lastSuccessAt;
        // Calculate error rate (last 10 requests)
        const last10 = recentCounts.slice(-10);
        const errors = success ? 0 : 1;
        health.errorRate = errors / Math.max(last10.length, 1);
        // Mark unavailable if error rate is too high
        if (health.errorRate > 0.5) {
            health.available = false;
            this.emit('provider-degraded', { provider, errorRate: health.errorRate });
        }
        this.emit('health-updated', { provider, health });
    }
    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Get routing statistics
     */
    getStatistics() {
        const stats = {
            totalRequests: 0,
            requestsByProvider: {},
            averageLatency: 0,
            errorRate: 0,
        };
        let totalLatency = 0;
        let totalErrors = 0;
        this.healthMetrics.forEach((health, provider) => {
            const requests = health.requestsInLastMinute;
            stats.totalRequests += requests;
            stats.requestsByProvider[provider] = requests;
            totalLatency += health.latency * requests;
            totalErrors += health.errorRate * requests;
        });
        stats.averageLatency = stats.totalRequests > 0 ? totalLatency / stats.totalRequests : 0;
        stats.errorRate = stats.totalRequests > 0 ? totalErrors / stats.totalRequests : 0;
        return stats;
    }
}
/**
 * Create default provider router from config
 */
export function createProviderRouter(config) {
    const defaultConfig = {
        providers: {
            claude: {
                enabled: true,
                priority: 1,
                maxRetries: 3,
                timeout: 30000,
                rateLimitPerMinute: 50,
            },
            gemini: {
                enabled: true,
                priority: 2,
                maxRetries: 2,
                timeout: 30000,
                rateLimitPerMinute: 60,
            },
            openai: {
                enabled: false,
                priority: 3,
                maxRetries: 2,
                timeout: 30000,
                rateLimitPerMinute: 50,
            },
        },
        chaosMode: false,
        telemetryEnabled: true,
    };
    return new ProviderRouter({
        ...defaultConfig,
        ...config,
        providers: {
            ...defaultConfig.providers,
            ...config?.providers,
        },
    });
}
//# sourceMappingURL=ProviderRouter.js.map