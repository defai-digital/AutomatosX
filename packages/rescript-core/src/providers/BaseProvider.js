/**
 * BaseProvider.ts
 *
 * Abstract base class for all AI provider implementations.
 * Provides common functionality for request handling, streaming, and error management.
 *
 * Phase 2 Week 2 Day 6: Provider Infrastructure
 */
/**
 * Abstract base class for AI provider implementations.
 * All provider implementations (ClaudeProvider, GeminiProvider, OpenAIProvider)
 * must extend this class and implement the abstract methods.
 */
export class BaseProvider {
    config;
    providerType;
    constructor(config, providerType) {
        this.config = config;
        this.providerType = providerType;
    }
    /**
     * Get the provider type (claude, gemini, openai)
     */
    getProviderType() {
        return this.providerType;
    }
    /**
     * Get the default model for this provider
     */
    getDefaultModel() {
        return this.config.defaultModel || this.getProviderDefaultModel();
    }
    /**
     * Validate the provider configuration
     */
    validateConfig() {
        if (!this.config.apiKey) {
            throw new Error(`API key is required for ${this.providerType} provider`);
        }
    }
    /**
     * Get the timeout value in milliseconds
     */
    getTimeout() {
        return this.config.timeout || 30000; // Default 30 seconds
    }
    /**
     * Get the max retry attempts
     */
    getMaxRetries() {
        return this.config.maxRetries || 3;
    }
    /**
     * Calculate exponential backoff delay for retries
     * @param attempt - The retry attempt number (0-indexed)
     * @returns number - The delay in milliseconds
     */
    calculateBackoffDelay(attempt) {
        const baseDelay = 1000; // 1 second
        const maxDelay = 30000; // 30 seconds
        const exponentialDelay = baseDelay * Math.pow(2, attempt);
        return Math.min(exponentialDelay, maxDelay);
    }
    /**
     * Determine if an error is retryable
     * @param error - The provider error
     * @returns boolean - True if the error is retryable
     */
    isRetryableError(error) {
        return error.retryable === true;
    }
    /**
     * Log provider activity for debugging and analytics
     * @param level - Log level (info, warn, error)
     * @param message - Log message
     * @param data - Additional data to log
     */
    log(level, message, data) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            provider: this.providerType,
            level,
            message,
            data,
        };
        // TODO: Integrate with proper logging system
        if (level === 'error') {
            console.error(`[${timestamp}] [${this.providerType}] ERROR:`, message, data);
        }
        else if (level === 'warn') {
            console.warn(`[${timestamp}] [${this.providerType}] WARN:`, message, data);
        }
        else {
            console.log(`[${timestamp}] [${this.providerType}] INFO:`, message, data);
        }
    }
    /**
     * Create a standardized ProviderError
     * @param message - Error message
     * @param code - Error code
     * @param statusCode - HTTP status code
     * @param retryable - Whether the error is retryable
     * @returns ProviderError
     */
    createError(message, code, statusCode, retryable = false) {
        return {
            error: message,
            code: code,
            provider: this.providerType,
            statusCode,
            retryable,
        };
    }
    /**
     * Validate that a request is properly formatted
     * @param request - The provider request
     * @throws Error if request is invalid
     */
    validateRequest(request) {
        if (!request.messages || request.messages.length === 0) {
            throw this.createError('Messages array cannot be empty', 'invalid_request');
        }
        if (!request.model) {
            throw this.createError('Model is required', 'invalid_request');
        }
        if (request.maxTokens !== undefined && request.maxTokens <= 0) {
            throw this.createError('maxTokens must be positive', 'invalid_request');
        }
        if (request.temperature !== undefined && (request.temperature < 0 || request.temperature > 2)) {
            throw this.createError('temperature must be between 0 and 2', 'invalid_request');
        }
    }
}
//# sourceMappingURL=BaseProvider.js.map