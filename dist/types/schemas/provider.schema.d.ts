/**
 * provider.schema.ts
 *
 * Zod schemas for AI provider request/response validation.
 * Provides type-safe validation for provider lifecycle management.
 *
 * Phase 2 Week 1 Day 3: Provider Schemas
 */
import { z } from 'zod';
export declare const ProviderTypeSchema: z.ZodEnum<["claude", "gemini", "openai"]>;
export type ProviderType = z.infer<typeof ProviderTypeSchema>;
export declare const ProviderModelSchema: z.ZodObject<{
    provider: z.ZodEnum<["claude", "gemini", "openai"]>;
    model: z.ZodString;
    maxTokens: z.ZodOptional<z.ZodNumber>;
    temperature: z.ZodOptional<z.ZodNumber>;
    topP: z.ZodOptional<z.ZodNumber>;
    topK: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    provider: "claude" | "gemini" | "openai";
    model: string;
    maxTokens?: number | undefined;
    temperature?: number | undefined;
    topP?: number | undefined;
    topK?: number | undefined;
}, {
    provider: "claude" | "gemini" | "openai";
    model: string;
    maxTokens?: number | undefined;
    temperature?: number | undefined;
    topP?: number | undefined;
    topK?: number | undefined;
}>;
export type ProviderModel = z.infer<typeof ProviderModelSchema>;
export declare const MessageRoleSchema: z.ZodEnum<["user", "assistant", "system"]>;
export type MessageRole = z.infer<typeof MessageRoleSchema>;
export declare const MessageContentSchema: z.ZodObject<{
    role: z.ZodEnum<["user", "assistant", "system"]>;
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    content: string;
    role: "user" | "assistant" | "system";
}, {
    content: string;
    role: "user" | "assistant" | "system";
}>;
export type MessageContent = z.infer<typeof MessageContentSchema>;
export declare const ProviderRequestSchema: z.ZodObject<{
    provider: z.ZodEnum<["claude", "gemini", "openai"]>;
    model: z.ZodString;
    messages: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["user", "assistant", "system"]>;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        content: string;
        role: "user" | "assistant" | "system";
    }, {
        content: string;
        role: "user" | "assistant" | "system";
    }>, "many">;
    maxTokens: z.ZodOptional<z.ZodNumber>;
    temperature: z.ZodOptional<z.ZodNumber>;
    topP: z.ZodOptional<z.ZodNumber>;
    topK: z.ZodOptional<z.ZodNumber>;
    stream: z.ZodDefault<z.ZodBoolean>;
    stopSequences: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    metadata: z.ZodObject<{
        requestId: z.ZodString;
        conversationId: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        tags: string[];
        requestId: string;
        conversationId?: string | undefined;
        userId?: string | undefined;
    }, {
        requestId: string;
        conversationId?: string | undefined;
        userId?: string | undefined;
        tags?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    stream: boolean;
    provider: "claude" | "gemini" | "openai";
    metadata: {
        tags: string[];
        requestId: string;
        conversationId?: string | undefined;
        userId?: string | undefined;
    };
    messages: {
        content: string;
        role: "user" | "assistant" | "system";
    }[];
    model: string;
    maxTokens?: number | undefined;
    temperature?: number | undefined;
    topP?: number | undefined;
    topK?: number | undefined;
    stopSequences?: string[] | undefined;
}, {
    provider: "claude" | "gemini" | "openai";
    metadata: {
        requestId: string;
        conversationId?: string | undefined;
        userId?: string | undefined;
        tags?: string[] | undefined;
    };
    messages: {
        content: string;
        role: "user" | "assistant" | "system";
    }[];
    model: string;
    stream?: boolean | undefined;
    maxTokens?: number | undefined;
    temperature?: number | undefined;
    topP?: number | undefined;
    topK?: number | undefined;
    stopSequences?: string[] | undefined;
}>;
export type ProviderRequest = z.infer<typeof ProviderRequestSchema>;
export declare const StreamingRequestSchema: z.ZodObject<z.objectUtil.extendShape<{
    provider: z.ZodEnum<["claude", "gemini", "openai"]>;
    model: z.ZodString;
    messages: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["user", "assistant", "system"]>;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        content: string;
        role: "user" | "assistant" | "system";
    }, {
        content: string;
        role: "user" | "assistant" | "system";
    }>, "many">;
    maxTokens: z.ZodOptional<z.ZodNumber>;
    temperature: z.ZodOptional<z.ZodNumber>;
    topP: z.ZodOptional<z.ZodNumber>;
    topK: z.ZodOptional<z.ZodNumber>;
    stream: z.ZodDefault<z.ZodBoolean>;
    stopSequences: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    metadata: z.ZodObject<{
        requestId: z.ZodString;
        conversationId: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        tags: string[];
        requestId: string;
        conversationId?: string | undefined;
        userId?: string | undefined;
    }, {
        requestId: string;
        conversationId?: string | undefined;
        userId?: string | undefined;
        tags?: string[] | undefined;
    }>;
}, {
    stream: z.ZodLiteral<true>;
}>, "strip", z.ZodTypeAny, {
    stream: true;
    provider: "claude" | "gemini" | "openai";
    metadata: {
        tags: string[];
        requestId: string;
        conversationId?: string | undefined;
        userId?: string | undefined;
    };
    messages: {
        content: string;
        role: "user" | "assistant" | "system";
    }[];
    model: string;
    maxTokens?: number | undefined;
    temperature?: number | undefined;
    topP?: number | undefined;
    topK?: number | undefined;
    stopSequences?: string[] | undefined;
}, {
    stream: true;
    provider: "claude" | "gemini" | "openai";
    metadata: {
        requestId: string;
        conversationId?: string | undefined;
        userId?: string | undefined;
        tags?: string[] | undefined;
    };
    messages: {
        content: string;
        role: "user" | "assistant" | "system";
    }[];
    model: string;
    maxTokens?: number | undefined;
    temperature?: number | undefined;
    topP?: number | undefined;
    topK?: number | undefined;
    stopSequences?: string[] | undefined;
}>;
export type StreamingRequest = z.infer<typeof StreamingRequestSchema>;
export declare const NonStreamingRequestSchema: z.ZodObject<z.objectUtil.extendShape<{
    provider: z.ZodEnum<["claude", "gemini", "openai"]>;
    model: z.ZodString;
    messages: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["user", "assistant", "system"]>;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        content: string;
        role: "user" | "assistant" | "system";
    }, {
        content: string;
        role: "user" | "assistant" | "system";
    }>, "many">;
    maxTokens: z.ZodOptional<z.ZodNumber>;
    temperature: z.ZodOptional<z.ZodNumber>;
    topP: z.ZodOptional<z.ZodNumber>;
    topK: z.ZodOptional<z.ZodNumber>;
    stream: z.ZodDefault<z.ZodBoolean>;
    stopSequences: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    metadata: z.ZodObject<{
        requestId: z.ZodString;
        conversationId: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        tags: string[];
        requestId: string;
        conversationId?: string | undefined;
        userId?: string | undefined;
    }, {
        requestId: string;
        conversationId?: string | undefined;
        userId?: string | undefined;
        tags?: string[] | undefined;
    }>;
}, {
    stream: z.ZodLiteral<false>;
}>, "strip", z.ZodTypeAny, {
    stream: false;
    provider: "claude" | "gemini" | "openai";
    metadata: {
        tags: string[];
        requestId: string;
        conversationId?: string | undefined;
        userId?: string | undefined;
    };
    messages: {
        content: string;
        role: "user" | "assistant" | "system";
    }[];
    model: string;
    maxTokens?: number | undefined;
    temperature?: number | undefined;
    topP?: number | undefined;
    topK?: number | undefined;
    stopSequences?: string[] | undefined;
}, {
    stream: false;
    provider: "claude" | "gemini" | "openai";
    metadata: {
        requestId: string;
        conversationId?: string | undefined;
        userId?: string | undefined;
        tags?: string[] | undefined;
    };
    messages: {
        content: string;
        role: "user" | "assistant" | "system";
    }[];
    model: string;
    maxTokens?: number | undefined;
    temperature?: number | undefined;
    topP?: number | undefined;
    topK?: number | undefined;
    stopSequences?: string[] | undefined;
}>;
export type NonStreamingRequest = z.infer<typeof NonStreamingRequestSchema>;
export declare const TokenUsageSchema: z.ZodObject<{
    input: z.ZodNumber;
    output: z.ZodNumber;
    total: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    total: number;
    output: number;
    input: number;
}, {
    total: number;
    output: number;
    input: number;
}>;
export type TokenUsage = z.infer<typeof TokenUsageSchema>;
export declare const ProviderResponseSchema: z.ZodObject<{
    content: z.ZodString;
    tokens: z.ZodObject<{
        input: z.ZodNumber;
        output: z.ZodNumber;
        total: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        output: number;
        input: number;
    }, {
        total: number;
        output: number;
        input: number;
    }>;
    duration: z.ZodNumber;
    model: z.ZodString;
    provider: z.ZodEnum<["claude", "gemini", "openai"]>;
    finishReason: z.ZodOptional<z.ZodEnum<["stop", "length", "content_filter", "error"]>>;
}, "strip", z.ZodTypeAny, {
    provider: "claude" | "gemini" | "openai";
    content: string;
    tokens: {
        total: number;
        output: number;
        input: number;
    };
    model: string;
    duration: number;
    finishReason?: "length" | "error" | "stop" | "content_filter" | undefined;
}, {
    provider: "claude" | "gemini" | "openai";
    content: string;
    tokens: {
        total: number;
        output: number;
        input: number;
    };
    model: string;
    duration: number;
    finishReason?: "length" | "error" | "stop" | "content_filter" | undefined;
}>;
export type ProviderResponse = z.infer<typeof ProviderResponseSchema>;
export declare const StreamChunkSchema: z.ZodObject<{
    chunk: z.ZodString;
    index: z.ZodNumber;
    delta: z.ZodString;
    finishReason: z.ZodOptional<z.ZodEnum<["stop", "length", "content_filter", "error"]>>;
}, "strip", z.ZodTypeAny, {
    chunk: string;
    delta: string;
    index: number;
    finishReason?: "length" | "error" | "stop" | "content_filter" | undefined;
}, {
    chunk: string;
    delta: string;
    index: number;
    finishReason?: "length" | "error" | "stop" | "content_filter" | undefined;
}>;
export type StreamChunk = z.infer<typeof StreamChunkSchema>;
export declare const RateLimitInfoSchema: z.ZodObject<{
    retryAfter: z.ZodNumber;
    limit: z.ZodOptional<z.ZodNumber>;
    remaining: z.ZodOptional<z.ZodNumber>;
    reset: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    retryAfter: number;
    limit?: number | undefined;
    remaining?: number | undefined;
    reset?: number | undefined;
}, {
    retryAfter: number;
    limit?: number | undefined;
    remaining?: number | undefined;
    reset?: number | undefined;
}>;
export type RateLimitInfo = z.infer<typeof RateLimitInfoSchema>;
export declare const ProviderErrorCodeSchema: z.ZodEnum<["authentication_error", "invalid_request", "rate_limit_exceeded", "server_error", "timeout", "network_error", "content_filter", "model_not_found", "quota_exceeded", "unknown_error"]>;
export type ProviderErrorCode = z.infer<typeof ProviderErrorCodeSchema>;
export declare const ProviderErrorSchema: z.ZodObject<{
    error: z.ZodString;
    code: z.ZodOptional<z.ZodEnum<["authentication_error", "invalid_request", "rate_limit_exceeded", "server_error", "timeout", "network_error", "content_filter", "model_not_found", "quota_exceeded", "unknown_error"]>>;
    provider: z.ZodOptional<z.ZodEnum<["claude", "gemini", "openai"]>>;
    statusCode: z.ZodOptional<z.ZodNumber>;
    retryable: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    error: string;
    retryable: boolean;
    provider?: "claude" | "gemini" | "openai" | undefined;
    code?: "timeout" | "content_filter" | "network_error" | "authentication_error" | "invalid_request" | "rate_limit_exceeded" | "server_error" | "model_not_found" | "quota_exceeded" | "unknown_error" | undefined;
    statusCode?: number | undefined;
}, {
    error: string;
    provider?: "claude" | "gemini" | "openai" | undefined;
    code?: "timeout" | "content_filter" | "network_error" | "authentication_error" | "invalid_request" | "rate_limit_exceeded" | "server_error" | "model_not_found" | "quota_exceeded" | "unknown_error" | undefined;
    statusCode?: number | undefined;
    retryable?: boolean | undefined;
}>;
export type ProviderError = z.infer<typeof ProviderErrorSchema>;
export declare const RetryStrategySchema: z.ZodEnum<["exponential", "linear", "constant"]>;
export type RetryStrategy = z.infer<typeof RetryStrategySchema>;
export declare const RetryConfigSchema: z.ZodObject<{
    maxAttempts: z.ZodDefault<z.ZodNumber>;
    initialDelayMs: z.ZodDefault<z.ZodNumber>;
    maxDelayMs: z.ZodDefault<z.ZodNumber>;
    strategy: z.ZodDefault<z.ZodEnum<["exponential", "linear", "constant"]>>;
    backoffMultiplier: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    strategy: "constant" | "exponential" | "linear";
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
    maxAttempts: number;
}, {
    strategy?: "constant" | "exponential" | "linear" | undefined;
    initialDelayMs?: number | undefined;
    maxDelayMs?: number | undefined;
    backoffMultiplier?: number | undefined;
    maxAttempts?: number | undefined;
}>;
export type RetryConfig = z.infer<typeof RetryConfigSchema>;
export declare const RetryInfoSchema: z.ZodObject<{
    attempt: z.ZodNumber;
    maxAttempts: z.ZodNumber;
    delayMs: z.ZodOptional<z.ZodNumber>;
    lastError: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    maxAttempts: number;
    attempt: number;
    delayMs?: number | undefined;
    lastError?: string | undefined;
}, {
    maxAttempts: number;
    attempt: number;
    delayMs?: number | undefined;
    lastError?: string | undefined;
}>;
export type RetryInfo = z.infer<typeof RetryInfoSchema>;
export declare const FallbackConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    providers: z.ZodArray<z.ZodEnum<["claude", "gemini", "openai"]>, "many">;
    modelMapping: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    providers: ("claude" | "gemini" | "openai")[];
    modelMapping?: Record<string, string> | undefined;
}, {
    providers: ("claude" | "gemini" | "openai")[];
    enabled?: boolean | undefined;
    modelMapping?: Record<string, string> | undefined;
}>;
export type FallbackConfig = z.infer<typeof FallbackConfigSchema>;
export declare const FallbackInfoSchema: z.ZodObject<{
    provider: z.ZodEnum<["claude", "gemini", "openai"]>;
    model: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    provider: "claude" | "gemini" | "openai";
    model: string;
    reason: string;
}, {
    provider: "claude" | "gemini" | "openai";
    model: string;
    reason: string;
}>;
export type FallbackInfo = z.infer<typeof FallbackInfoSchema>;
export declare const ProviderStateSchema: z.ZodEnum<["idle", "validating", "requesting", "streaming", "rate_limited", "retrying", "completed", "failed"]>;
export type ProviderState = z.infer<typeof ProviderStateSchema>;
export declare const ProviderMetricsSchema: z.ZodObject<{
    startTime: z.ZodNumber;
    endTime: z.ZodOptional<z.ZodNumber>;
    firstTokenLatency: z.ZodOptional<z.ZodNumber>;
    totalDuration: z.ZodOptional<z.ZodNumber>;
    tokenCount: z.ZodObject<{
        input: z.ZodNumber;
        output: z.ZodNumber;
        total: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        output: number;
        input: number;
    }, {
        total: number;
        output: number;
        input: number;
    }>;
}, "strip", z.ZodTypeAny, {
    startTime: number;
    tokenCount: {
        total: number;
        output: number;
        input: number;
    };
    endTime?: number | undefined;
    firstTokenLatency?: number | undefined;
    totalDuration?: number | undefined;
}, {
    startTime: number;
    tokenCount: {
        total: number;
        output: number;
        input: number;
    };
    endTime?: number | undefined;
    firstTokenLatency?: number | undefined;
    totalDuration?: number | undefined;
}>;
export type ProviderMetrics = z.infer<typeof ProviderMetricsSchema>;
export declare const ProviderContextSchema: z.ZodObject<{
    state: z.ZodEnum<["idle", "validating", "requesting", "streaming", "rate_limited", "retrying", "completed", "failed"]>;
    provider: z.ZodEnum<["claude", "gemini", "openai"]>;
    model: z.ZodString;
    requestId: z.ZodString;
    conversationId: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
    metrics: z.ZodObject<{
        startTime: z.ZodNumber;
        endTime: z.ZodOptional<z.ZodNumber>;
        firstTokenLatency: z.ZodOptional<z.ZodNumber>;
        totalDuration: z.ZodOptional<z.ZodNumber>;
        tokenCount: z.ZodObject<{
            input: z.ZodNumber;
            output: z.ZodNumber;
            total: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            total: number;
            output: number;
            input: number;
        }, {
            total: number;
            output: number;
            input: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        startTime: number;
        tokenCount: {
            total: number;
            output: number;
            input: number;
        };
        endTime?: number | undefined;
        firstTokenLatency?: number | undefined;
        totalDuration?: number | undefined;
    }, {
        startTime: number;
        tokenCount: {
            total: number;
            output: number;
            input: number;
        };
        endTime?: number | undefined;
        firstTokenLatency?: number | undefined;
        totalDuration?: number | undefined;
    }>;
    retryAttempt: z.ZodDefault<z.ZodNumber>;
    maxRetries: z.ZodDefault<z.ZodNumber>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    fallbackProvider: z.ZodOptional<z.ZodEnum<["claude", "gemini", "openai"]>>;
}, "strip", z.ZodTypeAny, {
    provider: "claude" | "gemini" | "openai";
    state: "completed" | "failed" | "idle" | "streaming" | "validating" | "requesting" | "rate_limited" | "retrying";
    model: string;
    maxRetries: number;
    metrics: {
        startTime: number;
        tokenCount: {
            total: number;
            output: number;
            input: number;
        };
        endTime?: number | undefined;
        firstTokenLatency?: number | undefined;
        totalDuration?: number | undefined;
    };
    tags: string[];
    requestId: string;
    retryAttempt: number;
    conversationId?: string | undefined;
    userId?: string | undefined;
    fallbackProvider?: "claude" | "gemini" | "openai" | undefined;
}, {
    provider: "claude" | "gemini" | "openai";
    state: "completed" | "failed" | "idle" | "streaming" | "validating" | "requesting" | "rate_limited" | "retrying";
    model: string;
    metrics: {
        startTime: number;
        tokenCount: {
            total: number;
            output: number;
            input: number;
        };
        endTime?: number | undefined;
        firstTokenLatency?: number | undefined;
        totalDuration?: number | undefined;
    };
    requestId: string;
    conversationId?: string | undefined;
    userId?: string | undefined;
    maxRetries?: number | undefined;
    tags?: string[] | undefined;
    retryAttempt?: number | undefined;
    fallbackProvider?: "claude" | "gemini" | "openai" | undefined;
}>;
export type ProviderContext = z.infer<typeof ProviderContextSchema>;
export declare const ProviderLogSchema: z.ZodObject<{
    id: z.ZodString;
    requestId: z.ZodString;
    conversationId: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
    provider: z.ZodEnum<["claude", "gemini", "openai"]>;
    model: z.ZodString;
    state: z.ZodEnum<["idle", "validating", "requesting", "streaming", "rate_limited", "retrying", "completed", "failed"]>;
    request: z.ZodString;
    response: z.ZodOptional<z.ZodString>;
    error: z.ZodOptional<z.ZodString>;
    startTime: z.ZodNumber;
    endTime: z.ZodOptional<z.ZodNumber>;
    duration: z.ZodOptional<z.ZodNumber>;
    tokenCount: z.ZodOptional<z.ZodObject<{
        input: z.ZodNumber;
        output: z.ZodNumber;
        total: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        output: number;
        input: number;
    }, {
        total: number;
        output: number;
        input: number;
    }>>;
    retryAttempt: z.ZodNumber;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    provider: "claude" | "gemini" | "openai";
    createdAt: Date;
    updatedAt: Date;
    state: "completed" | "failed" | "idle" | "streaming" | "validating" | "requesting" | "rate_limited" | "retrying";
    model: string;
    startTime: number;
    tags: string[];
    requestId: string;
    retryAttempt: number;
    request: string;
    error?: string | undefined;
    conversationId?: string | undefined;
    userId?: string | undefined;
    duration?: number | undefined;
    response?: string | undefined;
    endTime?: number | undefined;
    tokenCount?: {
        total: number;
        output: number;
        input: number;
    } | undefined;
}, {
    id: string;
    provider: "claude" | "gemini" | "openai";
    createdAt: Date;
    updatedAt: Date;
    state: "completed" | "failed" | "idle" | "streaming" | "validating" | "requesting" | "rate_limited" | "retrying";
    model: string;
    startTime: number;
    requestId: string;
    retryAttempt: number;
    request: string;
    error?: string | undefined;
    conversationId?: string | undefined;
    userId?: string | undefined;
    duration?: number | undefined;
    response?: string | undefined;
    endTime?: number | undefined;
    tags?: string[] | undefined;
    tokenCount?: {
        total: number;
        output: number;
        input: number;
    } | undefined;
}>;
export type ProviderLog = z.infer<typeof ProviderLogSchema>;
export declare const validateProviderRequest: (data: unknown) => ProviderRequest;
export declare const validateProviderResponse: (data: unknown) => ProviderResponse;
export declare const validateStreamChunk: (data: unknown) => StreamChunk;
export declare const validateProviderError: (data: unknown) => ProviderError;
export declare const validateRetryConfig: (data: unknown) => RetryConfig;
export declare const validateProviderContext: (data: unknown) => ProviderContext;
export declare const isStreamingRequest: (req: ProviderRequest) => req is StreamingRequest;
export declare const isNonStreamingRequest: (req: ProviderRequest) => req is NonStreamingRequest;
export declare const isTerminalState: (state: ProviderState) => boolean;
export declare const isRetryableError: (error: ProviderError) => boolean;
//# sourceMappingURL=provider.schema.d.ts.map