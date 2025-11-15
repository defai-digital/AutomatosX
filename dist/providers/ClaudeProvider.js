/**
 * Claude provider implementation using Anthropic SDK
 *
 * Implements the IProvider interface for Claude (Anthropic) API integration.
 * Supports both standard and streaming requests with proper error handling.
 */
import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider, ProviderError, ProviderAuthError, ProviderRateLimitError, ProviderNetworkError, ProviderTimeoutError, } from './ProviderBase.js';
/**
 * Default Claude models by tier
 */
export const CLAUDE_MODELS = {
    'claude-sonnet-4-5': 'claude-sonnet-4-5-20250929',
    'claude-opus-4': 'claude-opus-4-20250514',
    'claude-haiku-4': 'claude-haiku-4-20250430',
    'claude-3.5-sonnet': 'claude-3-5-sonnet-20241022',
    'claude-3-opus': 'claude-3-opus-20240229',
    'claude-3-haiku': 'claude-3-haiku-20240307',
};
/**
 * Claude provider implementation
 */
export class ClaudeProvider extends BaseProvider {
    name = 'claude';
    client;
    constructor(config) {
        super({
            ...config,
            defaultModel: config.defaultModel || CLAUDE_MODELS['claude-sonnet-4-5'],
        });
        // Initialize Anthropic client
        this.client = new Anthropic({
            apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
            baseURL: config.baseUrl,
            maxRetries: 0, // We handle retries ourselves
            timeout: config.timeout,
        });
    }
    /**
     * Make a standard (non-streaming) request to Claude
     */
    async request(request) {
        await this.validateConfig();
        return this.retryWithBackoff(async () => {
            const [response, latency] = await this.measureLatency(async () => {
                try {
                    return await this.withTimeout(this.client.messages.create({
                        model: request.model || this.config.defaultModel,
                        max_tokens: request.maxTokens,
                        temperature: request.temperature,
                        messages: request.messages.map(msg => ({
                            role: msg.role === 'system' ? 'user' : msg.role,
                            content: msg.content,
                        })),
                    }), request.timeout);
                }
                catch (error) {
                    throw this.handleError(error);
                }
            });
            // Extract content from response
            const content = response.content
                .filter((block) => block.type === 'text')
                .map((block) => block.text)
                .join('\n');
            return {
                content,
                model: response.model,
                usage: {
                    inputTokens: response.usage.input_tokens,
                    outputTokens: response.usage.output_tokens,
                    totalTokens: response.usage.input_tokens + response.usage.output_tokens,
                },
                finishReason: this.mapStopReason(response.stop_reason),
                latency,
                provider: this.name,
            };
        });
    }
    /**
     * Make a streaming request to Claude
     */
    async streamRequest(request, onChunk) {
        await this.validateConfig();
        return this.retryWithBackoff(async () => {
            const startTime = Date.now();
            let fullContent = '';
            let inputTokens = 0;
            let outputTokens = 0;
            let model = request.model || this.config.defaultModel;
            let finishReason;
            try {
                const stream = await this.withTimeout(this.client.messages.create({
                    model: model,
                    max_tokens: request.maxTokens,
                    temperature: request.temperature,
                    messages: request.messages.map(msg => ({
                        role: msg.role === 'system' ? 'user' : msg.role,
                        content: msg.content,
                    })),
                    stream: true,
                }), request.timeout);
                for await (const event of stream) {
                    if (event.type === 'message_start') {
                        model = event.message.model;
                        inputTokens = event.message.usage.input_tokens;
                    }
                    else if (event.type === 'content_block_delta') {
                        if (event.delta.type === 'text_delta') {
                            const delta = event.delta.text;
                            fullContent += delta;
                            onChunk({
                                delta,
                                model,
                            });
                        }
                    }
                    else if (event.type === 'message_delta') {
                        outputTokens = event.usage.output_tokens;
                        finishReason = this.mapStopReason(event.delta.stop_reason);
                    }
                }
                const latency = Date.now() - startTime;
                return {
                    content: fullContent,
                    model,
                    usage: {
                        inputTokens,
                        outputTokens,
                        totalTokens: inputTokens + outputTokens,
                    },
                    finishReason,
                    latency,
                    provider: this.name,
                };
            }
            catch (error) {
                throw this.handleError(error);
            }
        });
    }
    /**
     * Check Claude API health
     */
    async healthCheck() {
        const health = {
            available: false,
            latency: 0,
            errorRate: 0,
            lastCheckedAt: Date.now(),
        };
        try {
            // Make a minimal request to check API availability
            const [, latency] = await this.measureLatency(async () => {
                return this.client.messages.create({
                    model: this.config.defaultModel,
                    max_tokens: 10,
                    messages: [{ role: 'user', content: 'ping' }],
                });
            });
            health.available = true;
            health.latency = latency;
        }
        catch (error) {
            health.available = false;
            health.lastError = error instanceof Error ? error.message : 'Unknown error';
            health.errorRate = 1.0;
        }
        return health;
    }
    /**
     * Get list of available Claude models
     */
    async getAvailableModels() {
        // Anthropic doesn't have a models API endpoint, so we return the hardcoded list
        return Object.values(CLAUDE_MODELS);
    }
    /**
     * Map Anthropic stop reason to our standard format
     */
    mapStopReason(stopReason) {
        switch (stopReason) {
            case 'end_turn':
                return 'stop';
            case 'max_tokens':
                return 'length';
            case 'tool_use':
                return 'tool_use';
            case 'stop_sequence':
                return 'stop';
            default:
                return undefined;
        }
    }
    /**
     * Handle Anthropic SDK errors and convert to our error types
     */
    handleError(error) {
        if (error instanceof Anthropic.APIError) {
            // Authentication errors
            if (error.status === 401) {
                return new ProviderAuthError(this.name, error.message);
            }
            // Rate limit errors
            if (error.status === 429) {
                const retryAfter = error.headers?.['retry-after']
                    ? parseInt(error.headers['retry-after'], 10)
                    : undefined;
                return new ProviderRateLimitError(this.name, retryAfter);
            }
            // Timeout errors
            if (error.status === 408 || error.message.includes('timeout')) {
                return new ProviderTimeoutError(this.name, this.config.timeout);
            }
            // Network errors (5xx)
            if (error.status && error.status >= 500) {
                return new ProviderNetworkError(this.name, error.message);
            }
            // Other API errors
            return new ProviderError(error.message, 'API_ERROR', this.name, error.status ? error.status >= 500 : false, error.status);
        }
        // Network/connection errors
        if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
            return new ProviderNetworkError(this.name, 'Connection refused');
        }
        // Unknown errors
        return new ProviderError(error instanceof Error ? error.message : 'Unknown error', 'UNKNOWN_ERROR', this.name, false);
    }
}
/**
 * Factory function to create a Claude provider instance
 */
export function createClaudeProvider(config) {
    return new ClaudeProvider({
        enabled: true,
        priority: 1,
        maxRetries: 3,
        timeout: 60000,
        apiKey: process.env.ANTHROPIC_API_KEY,
        ...config,
    });
}
//# sourceMappingURL=ClaudeProvider.js.map