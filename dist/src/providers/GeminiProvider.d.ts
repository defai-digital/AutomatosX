/**
 * Gemini provider implementation using Google Generative AI SDK
 *
 * Implements the IProvider interface for Google Gemini API integration.
 * Supports both standard and streaming requests with proper error handling.
 */
import { BaseProvider, ProviderRequest, ProviderResponse, StreamingChunk, ProviderConfig, ProviderHealth } from './ProviderBase.js';
/**
 * Gemini-specific configuration
 */
export interface GeminiConfig extends ProviderConfig {
    defaultModel?: string;
}
/**
 * Default Gemini models
 */
export declare const GEMINI_MODELS: {
    readonly 'gemini-2.0-flash-exp': "gemini-2.0-flash-exp";
    readonly 'gemini-1.5-pro': "gemini-1.5-pro";
    readonly 'gemini-1.5-flash': "gemini-1.5-flash";
    readonly 'gemini-1.5-flash-8b': "gemini-1.5-flash-8b";
};
/**
 * Gemini provider implementation
 */
export declare class GeminiProvider extends BaseProvider {
    readonly name = "gemini";
    private client;
    private model;
    constructor(config: GeminiConfig);
    /**
     * Make a standard (non-streaming) request to Gemini
     */
    request(request: ProviderRequest): Promise<ProviderResponse>;
    /**
     * Make a streaming request to Gemini
     */
    streamRequest(request: ProviderRequest, onChunk: (chunk: StreamingChunk) => void): Promise<ProviderResponse>;
    /**
     * Check Gemini API health
     */
    healthCheck(): Promise<ProviderHealth>;
    /**
     * Get list of available Gemini models
     */
    getAvailableModels(): Promise<string[]>;
    /**
     * Convert our message format to Gemini format
     */
    private convertMessages;
    /**
     * Map Gemini finish reason to our standard format
     */
    private mapFinishReason;
    /**
     * Handle Gemini SDK errors and convert to our error types
     */
    private handleError;
}
/**
 * Factory function to create a Gemini provider instance
 */
export declare function createGeminiProvider(config?: Partial<GeminiConfig>): GeminiProvider;
//# sourceMappingURL=GeminiProvider.d.ts.map