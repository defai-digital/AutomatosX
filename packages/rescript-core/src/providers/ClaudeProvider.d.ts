/**
 * ClaudeProvider.ts
 *
 * Anthropic Claude provider implementation with streaming support.
 * Integrates with @anthropic-ai/sdk for Claude API access.
 *
 * Phase 2 Week 2 Day 7: ClaudeProvider Implementation
 */
import { BaseProvider, type ProviderConfig, type StreamOptions } from './BaseProvider.js';
import type { ProviderRequest, ProviderResponse, ProviderError } from '../../../../src/types/schemas/provider.schema.js';
export interface ClaudeProviderConfig extends ProviderConfig {
    defaultModel?: string;
    maxTokens?: number;
}
/**
 * ClaudeProvider implements BaseProvider for Anthropic Claude API.
 * Supports both streaming and non-streaming requests with full error handling.
 */
export declare class ClaudeProvider extends BaseProvider {
    private client;
    private defaultMaxTokens;
    constructor(config: ClaudeProviderConfig);
    /**
     * Send a non-streaming request to Claude
     */
    sendRequest(request: ProviderRequest): Promise<ProviderResponse>;
    /**
     * Send a streaming request to Claude with Server-Sent Events
     */
    sendStreamingRequest(request: ProviderRequest, options: StreamOptions): Promise<ProviderResponse>;
    /**
     * Check if Claude API is healthy
     */
    isHealthy(): Promise<boolean>;
    /**
     * Get the default Claude model
     */
    protected getProviderDefaultModel(): string;
    /**
     * Transform generic ProviderRequest to Claude API format
     */
    protected transformRequest(request: ProviderRequest): unknown;
    /**
     * Transform Claude API response to generic ProviderResponse
     */
    protected transformResponse(data: any): ProviderResponse;
    /**
     * Transform Claude API error to generic ProviderError
     */
    protected transformError(error: unknown): ProviderError;
}
//# sourceMappingURL=ClaudeProvider.d.ts.map