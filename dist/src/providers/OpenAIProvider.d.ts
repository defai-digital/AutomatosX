/**
 * OpenAI provider implementation using OpenAI SDK
 *
 * Implements the IProvider interface for OpenAI API integration.
 * Supports both standard and streaming requests with proper error handling.
 */
import { BaseProvider, ProviderRequest, ProviderResponse, StreamingChunk, ProviderConfig, ProviderHealth } from './ProviderBase.js';
/**
 * OpenAI-specific configuration
 */
export interface OpenAIConfig extends ProviderConfig {
    defaultModel?: string;
    organization?: string;
}
/**
 * Default OpenAI models
 */
export declare const OPENAI_MODELS: {
    readonly 'gpt-4o': "gpt-4o";
    readonly 'gpt-4o-mini': "gpt-4o-mini";
    readonly 'gpt-4-turbo': "gpt-4-turbo";
    readonly 'gpt-4': "gpt-4";
    readonly 'gpt-3.5-turbo': "gpt-3.5-turbo";
};
/**
 * OpenAI provider implementation
 */
export declare class OpenAIProvider extends BaseProvider {
    readonly name = "openai";
    private client;
    constructor(config: OpenAIConfig);
    /**
     * Make a standard (non-streaming) request to OpenAI
     */
    request(request: ProviderRequest): Promise<ProviderResponse>;
    /**
     * Make a streaming request to OpenAI
     */
    streamRequest(request: ProviderRequest, onChunk: (chunk: StreamingChunk) => void): Promise<ProviderResponse>;
    /**
     * Check OpenAI API health
     */
    healthCheck(): Promise<ProviderHealth>;
    /**
     * Get list of available OpenAI models
     */
    getAvailableModels(): Promise<string[]>;
    /**
     * Map OpenAI finish reason to our standard format
     */
    private mapFinishReason;
    /**
     * Handle OpenAI SDK errors and convert to our error types
     */
    private handleError;
}
/**
 * Factory function to create an OpenAI provider instance
 */
export declare function createOpenAIProvider(config?: Partial<OpenAIConfig>): OpenAIProvider;
//# sourceMappingURL=OpenAIProvider.d.ts.map