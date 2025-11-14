/**
 * provider.schema.ts
 *
 * Zod schemas for AI provider request/response validation.
 * Provides type-safe validation for provider lifecycle management.
 *
 * Phase 2 Week 1 Day 3: Provider Schemas
 */
import { z } from 'zod';
export declare const ProviderTypeSchema: z.ZodEnum<{
    claude: "claude";
    gemini: "gemini";
    openai: "openai";
}>;
export type ProviderType = z.infer<typeof ProviderTypeSchema>;
export declare const ProviderModelSchema: z.ZodObject<{
    provider: z.ZodEnum<{
        claude: "claude";
        gemini: "gemini";
        openai: "openai";
    }>;
    model: z.ZodString;
    maxTokens: z.ZodOptional<z.ZodNumber>;
    temperature: z.ZodOptional<z.ZodNumber>;
    topP: z.ZodOptional<z.ZodNumber>;
    topK: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type ProviderModel = z.infer<typeof ProviderModelSchema>;
export declare const MessageRoleSchema: z.ZodEnum<{
    system: "system";
    user: "user";
    assistant: "assistant";
}>;
export type MessageRole = z.infer<typeof MessageRoleSchema>;
export declare const MessageContentSchema: z.ZodObject<{
    role: z.ZodEnum<{
        system: "system";
        user: "user";
        assistant: "assistant";
    }>;
    content: z.ZodString;
}, z.core.$strip>;
export type MessageContent = z.infer<typeof MessageContentSchema>;
export declare const ProviderRequestSchema: z.ZodObject<{
    provider: z.ZodEnum<{
        claude: "claude";
        gemini: "gemini";
        openai: "openai";
    }>;
    model: z.ZodString;
    messages: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<{
            system: "system";
            user: "user";
            assistant: "assistant";
        }>;
        content: z.ZodString;
    }, z.core.$strip>>;
    maxTokens: z.ZodOptional<z.ZodNumber>;
    temperature: z.ZodOptional<z.ZodNumber>;
    topP: z.ZodOptional<z.ZodNumber>;
    topK: z.ZodOptional<z.ZodNumber>;
    stream: z.ZodDefault<z.ZodBoolean>;
    stopSequences: z.ZodOptional<z.ZodArray<z.ZodString>>;
    metadata: z.ZodObject<{
        requestId: z.ZodString;
        conversationId: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type ProviderRequest = z.infer<typeof ProviderRequestSchema>;
export declare const StreamingRequestSchema: z.ZodObject<{
    provider: z.ZodEnum<{
        claude: "claude";
        gemini: "gemini";
        openai: "openai";
    }>;
    model: z.ZodString;
    messages: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<{
            system: "system";
            user: "user";
            assistant: "assistant";
        }>;
        content: z.ZodString;
    }, z.core.$strip>>;
    maxTokens: z.ZodOptional<z.ZodNumber>;
    temperature: z.ZodOptional<z.ZodNumber>;
    topP: z.ZodOptional<z.ZodNumber>;
    topK: z.ZodOptional<z.ZodNumber>;
    stopSequences: z.ZodOptional<z.ZodArray<z.ZodString>>;
    metadata: z.ZodObject<{
        requestId: z.ZodString;
        conversationId: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    stream: z.ZodLiteral<true>;
}, z.core.$strip>;
export type StreamingRequest = z.infer<typeof StreamingRequestSchema>;
export declare const NonStreamingRequestSchema: z.ZodObject<{
    provider: z.ZodEnum<{
        claude: "claude";
        gemini: "gemini";
        openai: "openai";
    }>;
    model: z.ZodString;
    messages: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<{
            system: "system";
            user: "user";
            assistant: "assistant";
        }>;
        content: z.ZodString;
    }, z.core.$strip>>;
    maxTokens: z.ZodOptional<z.ZodNumber>;
    temperature: z.ZodOptional<z.ZodNumber>;
    topP: z.ZodOptional<z.ZodNumber>;
    topK: z.ZodOptional<z.ZodNumber>;
    stopSequences: z.ZodOptional<z.ZodArray<z.ZodString>>;
    metadata: z.ZodObject<{
        requestId: z.ZodString;
        conversationId: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    stream: z.ZodLiteral<false>;
}, z.core.$strip>;
export type NonStreamingRequest = z.infer<typeof NonStreamingRequestSchema>;
export declare const TokenUsageSchema: z.ZodObject<{
    input: z.ZodNumber;
    output: z.ZodNumber;
    total: z.ZodNumber;
}, z.core.$strip>;
export type TokenUsage = z.infer<typeof TokenUsageSchema>;
export declare const ProviderResponseSchema: z.ZodObject<{
    content: z.ZodString;
    tokens: z.ZodObject<{
        input: z.ZodNumber;
        output: z.ZodNumber;
        total: z.ZodNumber;
    }, z.core.$strip>;
    duration: z.ZodNumber;
    model: z.ZodString;
    provider: z.ZodEnum<{
        claude: "claude";
        gemini: "gemini";
        openai: "openai";
    }>;
    finishReason: z.ZodOptional<z.ZodEnum<{
        length: "length";
        error: "error";
        stop: "stop";
        content_filter: "content_filter";
    }>>;
}, z.core.$strip>;
export type ProviderResponse = z.infer<typeof ProviderResponseSchema>;
export declare const StreamChunkSchema: z.ZodObject<{
    chunk: z.ZodString;
    index: z.ZodNumber;
    delta: z.ZodString;
    finishReason: z.ZodOptional<z.ZodEnum<{
        length: "length";
        error: "error";
        stop: "stop";
        content_filter: "content_filter";
    }>>;
}, z.core.$strip>;
export type StreamChunk = z.infer<typeof StreamChunkSchema>;
export declare const RateLimitInfoSchema: z.ZodObject<{
    retryAfter: z.ZodNumber;
    limit: z.ZodOptional<z.ZodNumber>;
    remaining: z.ZodOptional<z.ZodNumber>;
    reset: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type RateLimitInfo = z.infer<typeof RateLimitInfoSchema>;
export declare const ProviderErrorCodeSchema: z.ZodEnum<{
    timeout: "timeout";
    content_filter: "content_filter";
    authentication_error: "authentication_error";
    invalid_request: "invalid_request";
    rate_limit_exceeded: "rate_limit_exceeded";
    server_error: "server_error";
    network_error: "network_error";
    model_not_found: "model_not_found";
    quota_exceeded: "quota_exceeded";
    unknown_error: "unknown_error";
}>;
export type ProviderErrorCode = z.infer<typeof ProviderErrorCodeSchema>;
export declare const ProviderErrorSchema: z.ZodObject<{
    error: z.ZodString;
    code: z.ZodOptional<z.ZodEnum<{
        timeout: "timeout";
        content_filter: "content_filter";
        authentication_error: "authentication_error";
        invalid_request: "invalid_request";
        rate_limit_exceeded: "rate_limit_exceeded";
        server_error: "server_error";
        network_error: "network_error";
        model_not_found: "model_not_found";
        quota_exceeded: "quota_exceeded";
        unknown_error: "unknown_error";
    }>>;
    provider: z.ZodOptional<z.ZodEnum<{
        claude: "claude";
        gemini: "gemini";
        openai: "openai";
    }>>;
    statusCode: z.ZodOptional<z.ZodNumber>;
    retryable: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type ProviderError = z.infer<typeof ProviderErrorSchema>;
export declare const RetryStrategySchema: z.ZodEnum<{
    constant: "constant";
    exponential: "exponential";
    linear: "linear";
}>;
export type RetryStrategy = z.infer<typeof RetryStrategySchema>;
export declare const RetryConfigSchema: z.ZodObject<{
    maxAttempts: z.ZodDefault<z.ZodNumber>;
    initialDelayMs: z.ZodDefault<z.ZodNumber>;
    maxDelayMs: z.ZodDefault<z.ZodNumber>;
    strategy: z.ZodDefault<z.ZodEnum<{
        constant: "constant";
        exponential: "exponential";
        linear: "linear";
    }>>;
    backoffMultiplier: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type RetryConfig = z.infer<typeof RetryConfigSchema>;
export declare const RetryInfoSchema: z.ZodObject<{
    attempt: z.ZodNumber;
    maxAttempts: z.ZodNumber;
    delayMs: z.ZodOptional<z.ZodNumber>;
    lastError: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type RetryInfo = z.infer<typeof RetryInfoSchema>;
export declare const FallbackConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    providers: z.ZodArray<z.ZodEnum<{
        claude: "claude";
        gemini: "gemini";
        openai: "openai";
    }>>;
    modelMapping: z.ZodOptional<z.ZodRecord<z.ZodString, z.core.SomeType>>;
}, z.core.$strip>;
export type FallbackConfig = z.infer<typeof FallbackConfigSchema>;
export declare const FallbackInfoSchema: z.ZodObject<{
    provider: z.ZodEnum<{
        claude: "claude";
        gemini: "gemini";
        openai: "openai";
    }>;
    model: z.ZodString;
    reason: z.ZodString;
}, z.core.$strip>;
export type FallbackInfo = z.infer<typeof FallbackInfoSchema>;
export declare const ProviderStateSchema: z.ZodEnum<{
    streaming: "streaming";
    completed: "completed";
    failed: "failed";
    idle: "idle";
    validating: "validating";
    requesting: "requesting";
    rate_limited: "rate_limited";
    retrying: "retrying";
}>;
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
    }, z.core.$strip>;
}, z.core.$strip>;
export type ProviderMetrics = z.infer<typeof ProviderMetricsSchema>;
export declare const ProviderContextSchema: z.ZodObject<{
    state: z.ZodEnum<{
        streaming: "streaming";
        completed: "completed";
        failed: "failed";
        idle: "idle";
        validating: "validating";
        requesting: "requesting";
        rate_limited: "rate_limited";
        retrying: "retrying";
    }>;
    provider: z.ZodEnum<{
        claude: "claude";
        gemini: "gemini";
        openai: "openai";
    }>;
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
        }, z.core.$strip>;
    }, z.core.$strip>;
    retryAttempt: z.ZodDefault<z.ZodNumber>;
    maxRetries: z.ZodDefault<z.ZodNumber>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
    fallbackProvider: z.ZodOptional<z.ZodEnum<{
        claude: "claude";
        gemini: "gemini";
        openai: "openai";
    }>>;
}, z.core.$strip>;
export type ProviderContext = z.infer<typeof ProviderContextSchema>;
export declare const ProviderLogSchema: z.ZodObject<{
    id: z.ZodString;
    requestId: z.ZodString;
    conversationId: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
    provider: z.ZodEnum<{
        claude: "claude";
        gemini: "gemini";
        openai: "openai";
    }>;
    model: z.ZodString;
    state: z.ZodEnum<{
        streaming: "streaming";
        completed: "completed";
        failed: "failed";
        idle: "idle";
        validating: "validating";
        requesting: "requesting";
        rate_limited: "rate_limited";
        retrying: "retrying";
    }>;
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
    }, z.core.$strip>>;
    retryAttempt: z.ZodNumber;
    tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, z.core.$strip>;
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