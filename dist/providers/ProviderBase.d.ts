/**
 * Base provider interface and types for AI provider integrations
 *
 * All providers (Claude, Gemini, OpenAI) implement this interface for consistent
 * interaction with the ProviderRouter.
 */
import { z } from 'zod';
/**
 * Provider request schema
 */
export declare const ProviderRequestSchema: z.ZodObject<{
    model: z.ZodOptional<z.ZodString>;
    messages: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<{
            system: "system";
            user: "user";
            assistant: "assistant";
        }>;
        content: z.ZodString;
    }, z.core.$strip>>;
    maxTokens: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    temperature: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    streaming: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    timeout: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
export type ProviderRequest = z.infer<typeof ProviderRequestSchema>;
/**
 * Provider response schema
 */
export declare const ProviderResponseSchema: z.ZodObject<{
    content: z.ZodString;
    model: z.ZodString;
    usage: z.ZodObject<{
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
        totalTokens: z.ZodNumber;
    }, z.core.$strip>;
    finishReason: z.ZodOptional<z.ZodEnum<{
        length: "length";
        error: "error";
        stop: "stop";
        tool_use: "tool_use";
    }>>;
    latency: z.ZodNumber;
    provider: z.ZodString;
}, z.core.$strip>;
export type ProviderResponse = z.infer<typeof ProviderResponseSchema>;
/**
 * Streaming chunk schema
 */
export declare const StreamingChunkSchema: z.ZodObject<{
    delta: z.ZodString;
    model: z.ZodOptional<z.ZodString>;
    finishReason: z.ZodOptional<z.ZodEnum<{
        length: "length";
        error: "error";
        stop: "stop";
        tool_use: "tool_use";
    }>>;
}, z.core.$strip>;
export type StreamingChunk = z.infer<typeof StreamingChunkSchema>;
/**
 * Provider configuration schema
 */
export declare const ProviderConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    apiKey: z.ZodOptional<z.ZodString>;
    baseUrl: z.ZodOptional<z.ZodString>;
    defaultModel: z.ZodOptional<z.ZodString>;
    maxRetries: z.ZodDefault<z.ZodNumber>;
    timeout: z.ZodDefault<z.ZodNumber>;
    priority: z.ZodDefault<z.ZodNumber>;
}, z.core.$loose>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
/**
 * Provider health status
 */
export interface ProviderHealth {
    available: boolean;
    latency: number;
    errorRate: number;
    lastError?: string;
    lastCheckedAt: number;
}
/**
 * Provider error types
 */
export declare class ProviderError extends Error {
    code: string;
    provider: string;
    retryable: boolean;
    statusCode?: number | undefined;
    constructor(message: string, code: string, provider: string, retryable?: boolean, statusCode?: number | undefined);
}
export declare class ProviderAuthError extends ProviderError {
    constructor(provider: string, message?: string);
}
export declare class ProviderRateLimitError extends ProviderError {
    constructor(provider: string, retryAfter?: number);
    retryAfter?: number;
}
export declare class ProviderTimeoutError extends ProviderError {
    constructor(provider: string, timeout: number);
}
export declare class ProviderNetworkError extends ProviderError {
    constructor(provider: string, message: string);
}
/**
 * Base provider interface
 *
 * All providers must implement this interface to be compatible with ProviderRouter
 */
export interface IProvider {
    /**
     * Provider name (e.g., 'claude', 'gemini', 'openai')
     */
    readonly name: string;
    /**
     * Provider configuration
     */
    readonly config: ProviderConfig;
    /**
     * Make a request to the provider
     */
    request(request: ProviderRequest): Promise<ProviderResponse>;
    /**
     * Make a streaming request to the provider
     */
    streamRequest(request: ProviderRequest, onChunk: (chunk: StreamingChunk) => void): Promise<ProviderResponse>;
    /**
     * Check provider health/availability
     */
    healthCheck(): Promise<ProviderHealth>;
    /**
     * Get available models
     */
    getAvailableModels(): Promise<string[]>;
    /**
     * Validate configuration
     */
    validateConfig(): Promise<boolean>;
}
/**
 * Abstract base provider class
 *
 * Provides common functionality for all providers
 */
export declare abstract class BaseProvider implements IProvider {
    abstract readonly name: string;
    readonly config: ProviderConfig;
    constructor(config: ProviderConfig);
    abstract request(request: ProviderRequest): Promise<ProviderResponse>;
    abstract streamRequest(request: ProviderRequest, onChunk: (chunk: StreamingChunk) => void): Promise<ProviderResponse>;
    abstract healthCheck(): Promise<ProviderHealth>;
    abstract getAvailableModels(): Promise<string[]>;
    validateConfig(): Promise<boolean>;
    /**
     * Helper method to measure request latency
     */
    protected measureLatency<T>(fn: () => Promise<T>): Promise<[T, number]>;
    /**
     * Helper method to handle retries with exponential backoff
     */
    protected retryWithBackoff<T>(fn: () => Promise<T>, maxRetries?: number): Promise<T>;
    /**
     * Helper method to apply timeout to a promise
     */
    protected withTimeout<T>(promise: Promise<T>, timeout?: number): Promise<T>;
}
//# sourceMappingURL=ProviderBase.d.ts.map