/**
 * Gemini provider implementation using Google Generative AI SDK
 *
 * Implements the IProvider interface for Google Gemini API integration.
 * Supports both standard and streaming requests with proper error handling.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseProvider, ProviderError, ProviderAuthError, ProviderRateLimitError, ProviderNetworkError, ProviderTimeoutError, } from './ProviderBase.js';
/**
 * Default Gemini models
 */
export const GEMINI_MODELS = {
    'gemini-2.0-flash-exp': 'gemini-2.0-flash-exp',
    'gemini-1.5-pro': 'gemini-1.5-pro',
    'gemini-1.5-flash': 'gemini-1.5-flash',
    'gemini-1.5-flash-8b': 'gemini-1.5-flash-8b',
};
/**
 * Gemini provider implementation
 */
export class GeminiProvider extends BaseProvider {
    name = 'gemini';
    client;
    model;
    constructor(config) {
        super({
            ...config,
            defaultModel: config.defaultModel || GEMINI_MODELS['gemini-2.0-flash-exp'],
        });
        // Initialize Google Generative AI client
        this.client = new GoogleGenerativeAI(config.apiKey || process.env.GOOGLE_API_KEY || '');
        this.model = this.client.getGenerativeModel({
            model: this.config.defaultModel,
        });
    }
    /**
     * Make a standard (non-streaming) request to Gemini
     */
    async request(request) {
        await this.validateConfig();
        return this.retryWithBackoff(async () => {
            const [response, latency] = await this.measureLatency(async () => {
                try {
                    const model = request.model
                        ? this.client.getGenerativeModel({ model: request.model })
                        : this.model;
                    // Convert messages to Gemini format
                    const contents = this.convertMessages(request.messages);
                    return await this.withTimeout(model.generateContent({
                        contents,
                        generationConfig: {
                            maxOutputTokens: request.maxTokens,
                            temperature: request.temperature,
                        },
                    }), request.timeout);
                }
                catch (error) {
                    throw this.handleError(error);
                }
            });
            const result = response.response;
            const content = result.text();
            return {
                content,
                model: request.model || this.config.defaultModel,
                usage: {
                    inputTokens: result.usageMetadata?.promptTokenCount || 0,
                    outputTokens: result.usageMetadata?.candidatesTokenCount || 0,
                    totalTokens: result.usageMetadata?.totalTokenCount || 0,
                },
                finishReason: this.mapFinishReason(result.candidates?.[0]?.finishReason),
                latency,
                provider: this.name,
            };
        });
    }
    /**
     * Make a streaming request to Gemini
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
                const geminiModel = request.model
                    ? this.client.getGenerativeModel({ model: request.model })
                    : this.model;
                const contents = this.convertMessages(request.messages);
                const streamingResponse = await this.withTimeout(geminiModel.generateContentStream({
                    contents,
                    generationConfig: {
                        maxOutputTokens: request.maxTokens,
                        temperature: request.temperature,
                    },
                }), request.timeout);
                for await (const chunk of streamingResponse.stream) {
                    const chunkText = chunk.text();
                    fullContent += chunkText;
                    onChunk({
                        delta: chunkText,
                        model,
                    });
                    // Update token counts if available
                    if (chunk.usageMetadata) {
                        inputTokens = chunk.usageMetadata.promptTokenCount || 0;
                        outputTokens = chunk.usageMetadata.candidatesTokenCount || 0;
                    }
                    // Update finish reason
                    if (chunk.candidates?.[0]?.finishReason) {
                        finishReason = this.mapFinishReason(chunk.candidates[0].finishReason);
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
     * Check Gemini API health
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
                return this.model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
                    generationConfig: { maxOutputTokens: 10 },
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
     * Get list of available Gemini models
     */
    async getAvailableModels() {
        // Google Generative AI SDK doesn't have a listModels method
        // Return hardcoded list
        return Object.values(GEMINI_MODELS);
    }
    /**
     * Convert our message format to Gemini format
     */
    convertMessages(messages) {
        // Gemini uses a different message format
        // System messages need special handling
        const systemMessages = messages.filter((msg) => msg.role === 'system');
        const otherMessages = messages.filter((msg) => msg.role !== 'system');
        // Combine system messages into a single system instruction
        const systemInstruction = systemMessages.map((msg) => msg.content).join('\n\n');
        // Convert other messages to Gemini format
        const contents = otherMessages.map((msg) => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
        }));
        // If we have system messages, prepend them as a user message
        if (systemInstruction) {
            contents.unshift({
                role: 'user',
                parts: [{ text: systemInstruction }],
            });
        }
        return contents;
    }
    /**
     * Map Gemini finish reason to our standard format
     */
    mapFinishReason(finishReason) {
        switch (finishReason) {
            case 'STOP':
                return 'stop';
            case 'MAX_TOKENS':
                return 'length';
            case 'SAFETY':
                return 'error';
            case 'RECITATION':
                return 'error';
            case 'OTHER':
                return 'error';
            default:
                return undefined;
        }
    }
    /**
     * Handle Gemini SDK errors and convert to our error types
     */
    handleError(error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Authentication errors
        if (errorMessage.includes('API_KEY') || errorMessage.includes('401')) {
            return new ProviderAuthError(this.name, errorMessage);
        }
        // Rate limit errors
        if (errorMessage.includes('429') || errorMessage.includes('quota')) {
            return new ProviderRateLimitError(this.name);
        }
        // Timeout errors
        if (errorMessage.includes('timeout') || errorMessage.includes('408')) {
            return new ProviderTimeoutError(this.name, this.config.timeout);
        }
        // Network errors
        if (errorMessage.includes('ECONNREFUSED') ||
            errorMessage.includes('ENOTFOUND') ||
            errorMessage.includes('500') ||
            errorMessage.includes('503')) {
            return new ProviderNetworkError(this.name, errorMessage);
        }
        // Unknown errors
        return new ProviderError(errorMessage, 'UNKNOWN_ERROR', this.name, false);
    }
}
/**
 * Factory function to create a Gemini provider instance
 */
export function createGeminiProvider(config) {
    return new GeminiProvider({
        enabled: true,
        apiKey: process.env.GOOGLE_API_KEY,
        ...config,
    });
}
//# sourceMappingURL=GeminiProvider.js.map