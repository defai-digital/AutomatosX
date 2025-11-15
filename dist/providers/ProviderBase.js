/**
 * Base provider interface and types for AI provider integrations
 *
 * All providers (Claude, Gemini, OpenAI) implement this interface for consistent
 * interaction with the ProviderRouter.
 */
import { z } from 'zod';
/**
 * Provider request schema
 */
export const ProviderRequestSchema = z.object({
    model: z.string().optional(),
    messages: z.array(z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
    })),
    maxTokens: z.number().int().positive().optional().default(4096),
    temperature: z.number().min(0).max(2).optional().default(1.0),
    streaming: z.boolean().optional().default(false),
    timeout: z.number().int().positive().optional().default(60000),
});
/**
 * Provider response schema
 */
export const ProviderResponseSchema = z.object({
    content: z.string(),
    model: z.string(),
    usage: z.object({
        inputTokens: z.number().int().nonnegative(),
        outputTokens: z.number().int().nonnegative(),
        totalTokens: z.number().int().nonnegative(),
    }),
    finishReason: z.enum(['stop', 'length', 'tool_use', 'error']).optional(),
    latency: z.number().nonnegative(),
    provider: z.string(),
});
/**
 * Streaming chunk schema
 */
export const StreamingChunkSchema = z.object({
    delta: z.string(),
    model: z.string().optional(),
    finishReason: z.enum(['stop', 'length', 'tool_use', 'error']).optional(),
});
/**
 * Provider configuration schema
 */
export const ProviderConfigSchema = z.object({
    enabled: z.boolean().default(true),
    apiKey: z.string().optional(),
    baseUrl: z.string().url().optional(),
    defaultModel: z.string().optional(),
    maxRetries: z.number().int().nonnegative().default(3),
    timeout: z.number().int().positive().default(60000),
    priority: z.number().int().positive().default(1),
}).passthrough();
/**
 * Provider error types
 */
export class ProviderError extends Error {
    code;
    provider;
    retryable;
    statusCode;
    constructor(message, code, provider, retryable = false, statusCode) {
        super(message);
        this.code = code;
        this.provider = provider;
        this.retryable = retryable;
        this.statusCode = statusCode;
        this.name = 'ProviderError';
    }
}
export class ProviderAuthError extends ProviderError {
    constructor(provider, message = 'Authentication failed') {
        super(message, 'AUTH_ERROR', provider, false, 401);
        this.name = 'ProviderAuthError';
    }
}
export class ProviderRateLimitError extends ProviderError {
    constructor(provider, retryAfter) {
        super('Rate limit exceeded', 'RATE_LIMIT', provider, true, 429);
        this.name = 'ProviderRateLimitError';
        this.retryAfter = retryAfter;
    }
    retryAfter;
}
export class ProviderTimeoutError extends ProviderError {
    constructor(provider, timeout) {
        super(`Request timeout after ${timeout}ms`, 'TIMEOUT', provider, true, 408);
        this.name = 'ProviderTimeoutError';
    }
}
export class ProviderNetworkError extends ProviderError {
    constructor(provider, message) {
        super(message, 'NETWORK_ERROR', provider, true);
        this.name = 'ProviderNetworkError';
    }
}
/**
 * Abstract base provider class
 *
 * Provides common functionality for all providers
 */
export class BaseProvider {
    config;
    constructor(config) {
        this.config = ProviderConfigSchema.parse(config);
    }
    async validateConfig() {
        if (!this.config.enabled) {
            return false;
        }
        if (!this.config.apiKey) {
            throw new ProviderAuthError(this.name, 'API key is required');
        }
        return true;
    }
    /**
     * Helper method to measure request latency
     */
    async measureLatency(fn) {
        const start = Date.now();
        const result = await fn();
        const latency = Date.now() - start;
        return [result, latency];
    }
    /**
     * Helper method to handle retries with exponential backoff
     */
    async retryWithBackoff(fn, maxRetries = this.config.maxRetries) {
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            }
            catch (error) {
                lastError = error;
                // Don't retry on non-retryable errors
                if (error instanceof ProviderError && !error.retryable) {
                    throw error;
                }
                // Don't retry on last attempt
                if (attempt === maxRetries) {
                    throw error;
                }
                // Exponential backoff: 1s, 2s, 4s, 8s, etc.
                // Fixed: Cap delay at 60 seconds to prevent excessive wait times
                const delay = Math.min(Math.pow(2, attempt) * 1000, 60000);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw lastError;
    }
    /**
     * Helper method to apply timeout to a promise
     */
    async withTimeout(promise, timeout = this.config.timeout) {
        // Fixed: Clear timeout to prevent memory leak
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new ProviderTimeoutError(this.name, timeout)), timeout);
        });
        try {
            return await Promise.race([promise, timeoutPromise]);
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
}
//# sourceMappingURL=ProviderBase.js.map