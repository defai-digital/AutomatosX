/**
 * OpenAIProvider.ts
 *
 * OpenAI GPT provider implementation with streaming support.
 * Integrates with openai SDK for OpenAI API access.
 *
 * Phase 2 Week 2 Day 9: OpenAIProvider Implementation
 */
import { BaseProvider, type ProviderConfig, type StreamOptions } from './BaseProvider.js';
import type { ProviderRequest, ProviderResponse, ProviderError } from '../../../../src/types/schemas/provider.schema.js';
export interface OpenAIProviderConfig extends ProviderConfig {
    defaultModel?: string;
    maxTokens?: number;
    organization?: string;
}
/**
 * OpenAIProvider implements BaseProvider for OpenAI API.
 * Supports both streaming and non-streaming requests with comprehensive error handling.
 */
export declare class OpenAIProvider extends BaseProvider {
    private client;
    private defaultMaxTokens;
    constructor(config: OpenAIProviderConfig);
    /**
     * Send a non-streaming request to OpenAI
     */
    sendRequest(request: ProviderRequest): Promise<ProviderResponse>;
    /**
     * Send a streaming request to OpenAI
     */
    sendStreamingRequest(request: ProviderRequest, options: StreamOptions): Promise<ProviderResponse>;
    /**
     * Check if OpenAI API is healthy
     */
    isHealthy(): Promise<boolean>;
    /**
     * Get the default OpenAI model
     */
    protected getProviderDefaultModel(): string;
    /**
     * Transform generic ProviderRequest to OpenAI API format
     */
    protected transformRequest(request: ProviderRequest): unknown;
    /**
     * Transform OpenAI API response to generic ProviderResponse
     */
    protected transformResponse(data: any): ProviderResponse;
    /**
     * Transform OpenAI API error to generic ProviderError
     */
    protected transformError(error: unknown): ProviderError;
}
//# sourceMappingURL=OpenAIProvider.d.ts.map