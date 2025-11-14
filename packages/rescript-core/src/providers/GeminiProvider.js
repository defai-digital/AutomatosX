/**
 * GeminiProvider.ts
 *
 * Google Gemini provider implementation with streaming support.
 * Integrates with @google/generative-ai for Gemini API access.
 *
 * Phase 2 Week 2 Day 8: GeminiProvider Implementation
 */
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { BaseProvider } from './BaseProvider.js';
/**
 * GeminiProvider implements BaseProvider for Google Gemini API.
 * Supports both streaming and non-streaming requests with safety settings.
 */
export class GeminiProvider extends BaseProvider {
    client;
    defaultMaxTokens = 4096;
    safetySettings;
    constructor(config) {
        super(config, 'gemini');
        this.client = new GoogleGenerativeAI(config.apiKey);
        if (config.maxTokens) {
            this.defaultMaxTokens = config.maxTokens;
        }
        // Default safety settings (permissive for developer use)
        this.safetySettings = config.safetySettings || [
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
        ];
        this.validateConfig();
    }
    /**
     * Send a non-streaming request to Gemini
     */
    async sendRequest(request) {
        this.validateRequest(request);
        const startTime = Date.now();
        try {
            const model = this.client.getGenerativeModel({
                model: request.model || this.getProviderDefaultModel(),
            });
            const geminiRequest = this.transformRequest(request);
            this.log('info', 'Sending request to Gemini', {
                model: request.model,
                messageCount: request.messages.length,
            });
            const result = await model.generateContent({
                contents: geminiRequest.contents,
                generationConfig: geminiRequest.generationConfig,
                safetySettings: this.safetySettings,
            });
            const response = await result.response;
            const endTime = Date.now();
            const duration = endTime - startTime;
            return this.transformResponse({
                response,
                duration,
                model: request.model || this.getProviderDefaultModel(),
            });
        }
        catch (error) {
            this.log('error', 'Gemini request failed', { error });
            throw this.transformError(error);
        }
    }
    /**
     * Send a streaming request to Gemini
     */
    async sendStreamingRequest(request, options) {
        this.validateRequest(request);
        const startTime = Date.now();
        let firstTokenTime;
        let chunkIndex = 0;
        let accumulatedContent = '';
        try {
            const model = this.client.getGenerativeModel({
                model: request.model || this.getProviderDefaultModel(),
            });
            const geminiRequest = this.transformRequest(request);
            this.log('info', 'Starting streaming request to Gemini', {
                model: request.model,
            });
            const result = await model.generateContentStream({
                contents: geminiRequest.contents,
                generationConfig: geminiRequest.generationConfig,
                safetySettings: this.safetySettings,
            });
            // Track token usage
            let inputTokens = 0;
            let outputTokens = 0;
            for await (const chunk of result.stream) {
                // Record first token latency
                if (firstTokenTime === undefined) {
                    firstTokenTime = Date.now();
                }
                const chunkText = chunk.text();
                if (chunkText) {
                    const delta = chunkText;
                    accumulatedContent += delta;
                    if (options.onChunk) {
                        options.onChunk({
                            chunk: accumulatedContent,
                            index: chunkIndex++,
                            delta,
                        });
                    }
                }
                // Accumulate usage data if available
                if (chunk.usageMetadata) {
                    inputTokens = chunk.usageMetadata.promptTokenCount || 0;
                    outputTokens = chunk.usageMetadata.candidatesTokenCount || 0;
                }
            }
            if (options.onComplete) {
                options.onComplete();
            }
            const endTime = Date.now();
            const duration = endTime - startTime;
            // Build final response
            return {
                content: accumulatedContent,
                tokens: {
                    input: inputTokens,
                    output: outputTokens,
                    total: inputTokens + outputTokens,
                },
                duration,
                model: request.model || this.getProviderDefaultModel(),
                provider: 'gemini',
                finishReason: 'stop',
            };
        }
        catch (error) {
            this.log('error', 'Gemini streaming request failed', { error });
            if (options.onError) {
                options.onError(this.transformError(error));
            }
            throw this.transformError(error);
        }
    }
    /**
     * Check if Gemini API is healthy
     */
    async isHealthy() {
        try {
            const model = this.client.getGenerativeModel({
                model: this.getProviderDefaultModel(),
            });
            // Simple health check
            await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
                generationConfig: { maxOutputTokens: 10 },
            });
            return true;
        }
        catch (error) {
            this.log('warn', 'Gemini health check failed', { error });
            return false;
        }
    }
    /**
     * Get the default Gemini model
     */
    getProviderDefaultModel() {
        return this.config.defaultModel || 'gemini-2.0-flash-exp';
    }
    /**
     * Transform generic ProviderRequest to Gemini API format
     */
    transformRequest(request) {
        // Gemini uses a different format: contents array with role and parts
        const contents = request.messages.map((msg) => ({
            role: msg.role === 'user' ? 'user' : 'model', // Gemini uses 'model' instead of 'assistant'
            parts: [{ text: msg.content }],
        }));
        // Filter out system messages (Gemini handles them differently)
        const filteredContents = contents.filter((c) => c.role !== 'system');
        // Build generation config
        const generationConfig = {
            maxOutputTokens: request.maxTokens || this.defaultMaxTokens,
        };
        if (request.temperature !== undefined) {
            generationConfig.temperature = request.temperature;
        }
        if (request.topP !== undefined) {
            generationConfig.topP = request.topP;
        }
        if (request.topK !== undefined) {
            generationConfig.topK = request.topK;
        }
        if (request.stopSequences && request.stopSequences.length > 0) {
            generationConfig.stopSequences = request.stopSequences;
        }
        return {
            contents: filteredContents,
            generationConfig,
        };
    }
    /**
     * Transform Gemini API response to generic ProviderResponse
     */
    transformResponse(data) {
        const { response, duration, model } = data;
        // Extract text from candidates
        let content = '';
        if (response.candidates && response.candidates.length > 0) {
            const candidate = response.candidates[0];
            if (candidate.content && candidate.content.parts) {
                content = candidate.content.parts
                    .map((part) => part.text || '')
                    .join('');
            }
        }
        // Map finish reason
        let finishReason = 'stop';
        if (response.candidates && response.candidates[0]) {
            const stopReason = response.candidates[0].finishReason;
            if (stopReason === 'MAX_TOKENS' || stopReason === 'LENGTH') {
                finishReason = 'length';
            }
            else if (stopReason === 'SAFETY') {
                finishReason = 'content_filter';
            }
            else if (stopReason === 'STOP') {
                finishReason = 'stop';
            }
        }
        // Extract token usage
        const inputTokens = response.usageMetadata?.promptTokenCount || 0;
        const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;
        return {
            content,
            tokens: {
                input: inputTokens,
                output: outputTokens,
                total: inputTokens + outputTokens,
            },
            duration,
            model,
            provider: 'gemini',
            finishReason,
        };
    }
    /**
     * Transform Gemini API error to generic ProviderError
     */
    transformError(error) {
        if (error instanceof Error) {
            const message = error.message;
            let code = 'unknown_error';
            let retryable = false;
            let statusCode;
            // Parse error message for common patterns
            if (message.includes('API key')) {
                code = 'authentication_error';
                retryable = false;
                statusCode = 401;
            }
            else if (message.includes('invalid') || message.includes('bad request')) {
                code = 'invalid_request';
                retryable = false;
                statusCode = 400;
            }
            else if (message.includes('quota') || message.includes('rate limit')) {
                code = 'rate_limit_exceeded';
                retryable = true;
                statusCode = 429;
            }
            else if (message.includes('500') || message.includes('503')) {
                code = 'server_error';
                retryable = true;
                statusCode = 503;
            }
            else if (message.includes('timeout')) {
                code = 'timeout';
                retryable = true;
            }
            else if (message.includes('network')) {
                code = 'network_error';
                retryable = true;
            }
            else if (message.includes('SAFETY') || message.includes('blocked')) {
                code = 'content_filter';
                retryable = false;
            }
            return {
                error: message,
                code: code,
                provider: 'gemini',
                statusCode,
                retryable,
            };
        }
        return {
            error: String(error),
            code: 'unknown_error',
            provider: 'gemini',
            retryable: false,
        };
    }
}
//# sourceMappingURL=GeminiProvider.js.map