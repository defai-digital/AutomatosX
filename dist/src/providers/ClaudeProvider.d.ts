/**
 * Claude provider implementation using Anthropic SDK
 *
 * Implements the IProvider interface for Claude (Anthropic) API integration.
 * Supports both standard and streaming requests with proper error handling.
 */
import { BaseProvider, ProviderRequest, ProviderResponse, StreamingChunk, ProviderConfig, ProviderHealth } from './ProviderBase.js';
/**
 * Claude-specific configuration
 */
export interface ClaudeConfig extends ProviderConfig {
    defaultModel?: string;
}
/**
 * Default Claude models by tier
 */
export declare const CLAUDE_MODELS: {
    readonly 'claude-sonnet-4-5': "claude-sonnet-4-5-20250929";
    readonly 'claude-opus-4': "claude-opus-4-20250514";
    readonly 'claude-haiku-4': "claude-haiku-4-20250430";
    readonly 'claude-3.5-sonnet': "claude-3-5-sonnet-20241022";
    readonly 'claude-3-opus': "claude-3-opus-20240229";
    readonly 'claude-3-haiku': "claude-3-haiku-20240307";
};
/**
 * Claude provider implementation
 */
export declare class ClaudeProvider extends BaseProvider {
    readonly name = "claude";
    private client;
    constructor(config: ClaudeConfig);
    /**
     * Make a standard (non-streaming) request to Claude
     */
    request(request: ProviderRequest): Promise<ProviderResponse>;
    /**
     * Make a streaming request to Claude
     */
    streamRequest(request: ProviderRequest, onChunk: (chunk: StreamingChunk) => void): Promise<ProviderResponse>;
    /**
     * Check Claude API health
     */
    healthCheck(): Promise<ProviderHealth>;
    /**
     * Get list of available Claude models
     */
    getAvailableModels(): Promise<string[]>;
    /**
     * Map Anthropic stop reason to our standard format
     */
    private mapStopReason;
    /**
     * Handle Anthropic SDK errors and convert to our error types
     */
    private handleError;
}
/**
 * Factory function to create a Claude provider instance
 */
export declare function createClaudeProvider(config?: Partial<ClaudeConfig>): ClaudeProvider;
//# sourceMappingURL=ClaudeProvider.d.ts.map