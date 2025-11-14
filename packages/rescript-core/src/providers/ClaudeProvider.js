/**
 * ClaudeProvider.ts
 *
 * Anthropic Claude provider implementation with streaming support.
 * Integrates with @anthropic-ai/sdk for Claude API access.
 *
 * Phase 2 Week 2 Day 7: ClaudeProvider Implementation
 */
import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider } from './BaseProvider.js';
/**
 * ClaudeProvider implements BaseProvider for Anthropic Claude API.
 * Supports both streaming and non-streaming requests with full error handling.
 */
export class ClaudeProvider extends BaseProvider {
    client;
    defaultMaxTokens = 4096;
    constructor(config) {
        super(config, 'claude');
        this.client = new Anthropic({
            apiKey: config.apiKey,
            baseURL: config.baseUrl,
            timeout: config.timeout || 30000,
            maxRetries: 0, // We handle retries in ProviderRouter
        });
        if (config.maxTokens) {
            this.defaultMaxTokens = config.maxTokens;
        }
        this.validateConfig();
    }
    /**
     * Send a non-streaming request to Claude
     */
    async sendRequest(request) {
        this.validateRequest(request);
        const startTime = Date.now();
        try {
            const claudeRequest = this.transformRequest(request);
            this.log('info', 'Sending request to Claude', {
                model: request.model,
                messageCount: request.messages.length,
            });
            const response = await this.client.messages.create(claudeRequest);
            const endTime = Date.now();
            const duration = endTime - startTime;
            return this.transformResponse({
                response,
                duration,
                model: request.model,
            });
        }
        catch (error) {
            this.log('error', 'Claude request failed', { error });
            throw this.transformError(error);
        }
    }
    /**
     * Send a streaming request to Claude with Server-Sent Events
     */
    async sendStreamingRequest(request, options) {
        this.validateRequest(request);
        const startTime = Date.now();
        let firstTokenTime;
        let chunkIndex = 0;
        let accumulatedContent = '';
        try {
            const claudeRequest = {
                ...this.transformRequest(request),
                stream: true,
            };
            this.log('info', 'Starting streaming request to Claude', {
                model: request.model,
            });
            const stream = await this.client.messages.create(claudeRequest);
            // Track usage from final message
            let finalUsage = null;
            for await (const event of stream) {
                if (event.type === 'content_block_delta' && event.delta?.text) {
                    // Record first token latency
                    if (firstTokenTime === undefined) {
                        firstTokenTime = Date.now();
                    }
                    const delta = event.delta.text;
                    accumulatedContent += delta;
                    if (options.onChunk) {
                        options.onChunk({
                            chunk: accumulatedContent,
                            index: chunkIndex++,
                            delta,
                        });
                    }
                }
                else if (event.type === 'message_delta' && event.usage) {
                    finalUsage = event.usage;
                }
                else if (event.type === 'message_stop') {
                    if (options.onComplete) {
                        options.onComplete();
                    }
                }
            }
            const endTime = Date.now();
            const duration = endTime - startTime;
            // Build final response
            return {
                content: accumulatedContent,
                tokens: {
                    input: finalUsage?.input_tokens || 0,
                    output: finalUsage?.output_tokens || 0,
                    total: (finalUsage?.input_tokens || 0) + (finalUsage?.output_tokens || 0),
                },
                duration,
                model: request.model,
                provider: 'claude',
                finishReason: 'stop',
            };
        }
        catch (error) {
            this.log('error', 'Claude streaming request failed', { error });
            if (options.onError) {
                options.onError(this.transformError(error));
            }
            throw this.transformError(error);
        }
    }
    /**
     * Check if Claude API is healthy
     */
    async isHealthy() {
        try {
            // Simple health check: try to create a minimal message
            await this.client.messages.create({
                model: this.getProviderDefaultModel(),
                max_tokens: 10,
                messages: [{ role: 'user', content: 'ping' }],
            });
            return true;
        }
        catch (error) {
            this.log('warn', 'Claude health check failed', { error });
            return false;
        }
    }
    /**
     * Get the default Claude model
     */
    getProviderDefaultModel() {
        return this.config.defaultModel || 'claude-3-5-sonnet-20241022';
    }
    /**
     * Transform generic ProviderRequest to Claude API format
     */
    transformRequest(request) {
        // Extract system message if present
        const systemMessage = request.messages.find((m) => m.role === 'system');
        const userMessages = request.messages.filter((m) => m.role !== 'system');
        // Transform messages to Claude format
        const claudeMessages = userMessages.map((msg) => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content,
        }));
        const claudeRequest = {
            model: request.model || this.getProviderDefaultModel(),
            max_tokens: request.maxTokens || this.defaultMaxTokens,
            messages: claudeMessages,
        };
        // Add system prompt if present
        if (systemMessage) {
            claudeRequest.system = systemMessage.content;
        }
        // Add optional parameters
        if (request.temperature !== undefined) {
            claudeRequest.temperature = request.temperature;
        }
        if (request.topP !== undefined) {
            claudeRequest.top_p = request.topP;
        }
        if (request.topK !== undefined) {
            claudeRequest.top_k = request.topK;
        }
        if (request.stopSequences && request.stopSequences.length > 0) {
            claudeRequest.stop_sequences = request.stopSequences;
        }
        return claudeRequest;
    }
    /**
     * Transform Claude API response to generic ProviderResponse
     */
    transformResponse(data) {
        const { response, duration, model } = data;
        // Extract text content from response
        let content = '';
        if (response.content && Array.isArray(response.content)) {
            content = response.content
                .filter((block) => block.type === 'text')
                .map((block) => block.text)
                .join('');
        }
        // Map finish reason
        let finishReason = 'stop';
        if (response.stop_reason === 'max_tokens') {
            finishReason = 'length';
        }
        else if (response.stop_reason === 'end_turn') {
            finishReason = 'stop';
        }
        return {
            content,
            tokens: {
                input: response.usage?.input_tokens || 0,
                output: response.usage?.output_tokens || 0,
                total: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
            },
            duration,
            model: model || response.model,
            provider: 'claude',
            finishReason,
        };
    }
    /**
     * Transform Claude API error to generic ProviderError
     */
    transformError(error) {
        if (error instanceof Anthropic.APIError) {
            const statusCode = error.status;
            let code = 'unknown_error';
            let retryable = false;
            // Map Anthropic error types to our error codes
            if (statusCode === 401) {
                code = 'authentication_error';
                retryable = false;
            }
            else if (statusCode === 400) {
                code = 'invalid_request';
                retryable = false;
            }
            else if (statusCode === 429) {
                code = 'rate_limit_exceeded';
                retryable = true;
            }
            else if (statusCode === 500 || statusCode === 503) {
                code = 'server_error';
                retryable = true;
            }
            else if (error.message.includes('timeout')) {
                code = 'timeout';
                retryable = true;
            }
            else if (error.message.includes('network')) {
                code = 'network_error';
                retryable = true;
            }
            return {
                error: error.message,
                code: code,
                provider: 'claude',
                statusCode,
                retryable,
            };
        }
        if (error instanceof Error) {
            return {
                error: error.message,
                code: 'unknown_error',
                provider: 'claude',
                retryable: false,
            };
        }
        return {
            error: String(error),
            code: 'unknown_error',
            provider: 'claude',
            retryable: false,
        };
    }
}
//# sourceMappingURL=ClaudeProvider.js.map