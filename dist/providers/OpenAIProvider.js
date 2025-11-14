/**
 * OpenAI provider implementation using OpenAI SDK
 *
 * Implements the IProvider interface for OpenAI API integration.
 * Supports both standard and streaming requests with proper error handling.
 */
import OpenAI from 'openai';
import { BaseProvider, ProviderError, ProviderAuthError, ProviderRateLimitError, ProviderNetworkError, ProviderTimeoutError, } from './ProviderBase.js';
/**
 * Default OpenAI models
 */
export const OPENAI_MODELS = {
    'gpt-4o': 'gpt-4o',
    'gpt-4o-mini': 'gpt-4o-mini',
    'gpt-4-turbo': 'gpt-4-turbo',
    'gpt-4': 'gpt-4',
    'gpt-3.5-turbo': 'gpt-3.5-turbo',
};
/**
 * OpenAI provider implementation
 */
export class OpenAIProvider extends BaseProvider {
    name = 'openai';
    client;
    constructor(config) {
        super({
            ...config,
            defaultModel: config.defaultModel || OPENAI_MODELS['gpt-4o'],
        });
        // Initialize OpenAI client
        this.client = new OpenAI({
            apiKey: config.apiKey || process.env.OPENAI_API_KEY,
            baseURL: config.baseUrl,
            organization: config.organization || process.env.OPENAI_ORGANIZATION,
            maxRetries: 0, // We handle retries ourselves
            timeout: config.timeout,
        });
    }
    /**
     * Make a standard (non-streaming) request to OpenAI
     */
    async request(request) {
        await this.validateConfig();
        return this.retryWithBackoff(async () => {
            const [response, latency] = await this.measureLatency(async () => {
                try {
                    return await this.withTimeout(this.client.chat.completions.create({
                        model: request.model || this.config.defaultModel,
                        messages: request.messages.map((msg) => ({
                            role: msg.role,
                            content: msg.content,
                        })),
                        max_tokens: request.maxTokens,
                        temperature: request.temperature,
                        stream: false,
                    }), request.timeout);
                }
                catch (error) {
                    throw this.handleError(error);
                }
            });
            const choice = response.choices[0];
            const content = choice.message.content || '';
            return {
                content,
                model: response.model,
                usage: {
                    inputTokens: response.usage?.prompt_tokens || 0,
                    outputTokens: response.usage?.completion_tokens || 0,
                    totalTokens: response.usage?.total_tokens || 0,
                },
                finishReason: this.mapFinishReason(choice.finish_reason),
                latency,
                provider: this.name,
            };
        });
    }
    /**
     * Make a streaming request to OpenAI
     */
    async streamRequest(request, onChunk) {
        await this.validateConfig();
        return this.retryWithBackoff(async () => {
            const startTime = Date.now();
            let fullContent = '';
            let inputTokens = 0;
            let outputTokens = 0;
            const model = request.model || this.config.defaultModel;
            let finishReason;
            try {
                const stream = await this.withTimeout(this.client.chat.completions.create({
                    model,
                    messages: request.messages.map((msg) => ({
                        role: msg.role,
                        content: msg.content,
                    })),
                    max_tokens: request.maxTokens,
                    temperature: request.temperature,
                    stream: true,
                    stream_options: { include_usage: true },
                }), request.timeout);
                for await (const chunk of stream) {
                    const delta = chunk.choices[0]?.delta?.content || '';
                    if (delta) {
                        fullContent += delta;
                        onChunk({
                            delta,
                            model: chunk.model,
                        });
                    }
                    // Update finish reason
                    if (chunk.choices[0]?.finish_reason) {
                        finishReason = this.mapFinishReason(chunk.choices[0].finish_reason);
                    }
                    // Update token counts if available
                    if (chunk.usage) {
                        inputTokens = chunk.usage.prompt_tokens;
                        outputTokens = chunk.usage.completion_tokens;
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
     * Check OpenAI API health
     */
    async healthCheck() {
        const health = {
            available: false,
            latency: 0,
            errorRate: 0,
            lastCheckedAt: Date.now(),
        };
        try {
            const [, latency] = await this.measureLatency(async () => {
                return this.client.chat.completions.create({
                    model: this.config.defaultModel,
                    messages: [{ role: 'user', content: 'ping' }],
                    max_tokens: 10,
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
     * Get list of available OpenAI models
     */
    async getAvailableModels() {
        try {
            const models = await this.client.models.list();
            return models.data
                .filter((model) => model.id.startsWith('gpt'))
                .map((model) => model.id);
        }
        catch (error) {
            // Fallback to hardcoded list if API call fails
            return Object.values(OPENAI_MODELS);
        }
    }
    /**
     * Map OpenAI finish reason to our standard format
     */
    mapFinishReason(finishReason) {
        switch (finishReason) {
            case 'stop':
                return 'stop';
            case 'length':
                return 'length';
            case 'tool_calls':
                return 'tool_use';
            case 'content_filter':
                return 'error';
            default:
                return undefined;
        }
    }
    /**
     * Handle OpenAI SDK errors and convert to our error types
     */
    handleError(error) {
        if (error instanceof OpenAI.APIError) {
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
 * Factory function to create an OpenAI provider instance
 */
export function createOpenAIProvider(config) {
    return new OpenAIProvider({
        enabled: true,
        apiKey: process.env.OPENAI_API_KEY,
        ...config,
    });
}
//# sourceMappingURL=OpenAIProvider.js.map