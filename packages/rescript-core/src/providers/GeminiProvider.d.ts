/**
 * GeminiProvider.ts
 *
 * Google Gemini provider implementation with streaming support.
 * Integrates with @google/generative-ai for Gemini API access.
 *
 * Phase 2 Week 2 Day 8: GeminiProvider Implementation
 */
import { BaseProvider, type ProviderConfig, type StreamOptions } from './BaseProvider.js';
import type { ProviderRequest, ProviderResponse, ProviderError } from '../../../../src/types/schemas/provider.schema.js';
export interface GeminiProviderConfig extends ProviderConfig {
    defaultModel?: string;
    maxTokens?: number;
    safetySettings?: Array<{
        category: string;
        threshold: string;
    }>;
}
/**
 * GeminiProvider implements BaseProvider for Google Gemini API.
 * Supports both streaming and non-streaming requests with safety settings.
 */
export declare class GeminiProvider extends BaseProvider {
    private client;
    private defaultMaxTokens;
    private safetySettings;
    constructor(config: GeminiProviderConfig);
    /**
     * Send a non-streaming request to Gemini
     */
    sendRequest(request: ProviderRequest): Promise<ProviderResponse>;
    /**
     * Send a streaming request to Gemini
     */
    sendStreamingRequest(request: ProviderRequest, options: StreamOptions): Promise<ProviderResponse>;
    /**
     * Check if Gemini API is healthy
     */
    isHealthy(): Promise<boolean>;
    /**
     * Get the default Gemini model
     */
    protected getProviderDefaultModel(): string;
    /**
     * Transform generic ProviderRequest to Gemini API format
     */
    protected transformRequest(request: ProviderRequest): any;
    /**
     * Transform Gemini API response to generic ProviderResponse
     */
    protected transformResponse(data: any): ProviderResponse;
    /**
     * Transform Gemini API error to generic ProviderError
     */
    protected transformError(error: unknown): ProviderError;
}
//# sourceMappingURL=GeminiProvider.d.ts.map