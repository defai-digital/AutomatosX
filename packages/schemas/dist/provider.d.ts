import { z } from 'zod';

/**
 * Provider schemas for AutomatosX
 * @module @ax/schemas/provider
 */

/**
 * Circuit breaker configuration for fault tolerance
 */
declare const CircuitBreakerConfigSchema: z.ZodObject<{
    /** Whether circuit breaker is enabled */
    enabled: z.ZodDefault<z.ZodBoolean>;
    /** Number of failures before opening circuit */
    failureThreshold: z.ZodDefault<z.ZodNumber>;
    /** Time to wait before attempting recovery (ms) */
    recoveryTimeout: z.ZodDefault<z.ZodNumber>;
    /** Time window for counting failures (ms) */
    failureWindow: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    failureThreshold: number;
    recoveryTimeout: number;
    failureWindow: number;
}, {
    enabled?: boolean | undefined;
    failureThreshold?: number | undefined;
    recoveryTimeout?: number | undefined;
    failureWindow?: number | undefined;
}>;
type CircuitBreakerConfig = z.infer<typeof CircuitBreakerConfigSchema>;
/**
 * Health check configuration
 */
declare const HealthCheckConfigSchema: z.ZodObject<{
    /** Whether health checks are enabled */
    enabled: z.ZodDefault<z.ZodBoolean>;
    /** Interval between health checks (ms) */
    interval: z.ZodDefault<z.ZodNumber>;
    /** Timeout for health check (ms) */
    timeout: z.ZodDefault<z.ZodNumber>;
    /** Number of retries before marking unhealthy */
    retries: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    timeout: number;
    interval: number;
    retries: number;
}, {
    enabled?: boolean | undefined;
    timeout?: number | undefined;
    interval?: number | undefined;
    retries?: number | undefined;
}>;
type HealthCheckConfig = z.infer<typeof HealthCheckConfigSchema>;
/**
 * Individual provider configuration
 */
declare const ProviderConfigSchema: z.ZodObject<{
    /** Provider type identifier */
    type: z.ZodEnum<["claude", "gemini", "ax-cli", "openai"]>;
    /** Whether this provider is enabled */
    enabled: z.ZodDefault<z.ZodBoolean>;
    /** Priority for routing (lower = higher priority) */
    priority: z.ZodDefault<z.ZodNumber>;
    /** Integration mode (mcp, sdk, bash) */
    integrationMode: z.ZodEnum<["mcp", "sdk", "bash"]>;
    /** Default timeout for requests (ms) */
    timeout: z.ZodDefault<z.ZodNumber>;
    /** Maximum concurrent requests */
    maxConcurrency: z.ZodDefault<z.ZodNumber>;
    /** Circuit breaker configuration */
    circuitBreaker: z.ZodDefault<z.ZodObject<{
        /** Whether circuit breaker is enabled */
        enabled: z.ZodDefault<z.ZodBoolean>;
        /** Number of failures before opening circuit */
        failureThreshold: z.ZodDefault<z.ZodNumber>;
        /** Time to wait before attempting recovery (ms) */
        recoveryTimeout: z.ZodDefault<z.ZodNumber>;
        /** Time window for counting failures (ms) */
        failureWindow: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        failureThreshold: number;
        recoveryTimeout: number;
        failureWindow: number;
    }, {
        enabled?: boolean | undefined;
        failureThreshold?: number | undefined;
        recoveryTimeout?: number | undefined;
        failureWindow?: number | undefined;
    }>>;
    /** Health check configuration */
    healthCheck: z.ZodDefault<z.ZodObject<{
        /** Whether health checks are enabled */
        enabled: z.ZodDefault<z.ZodBoolean>;
        /** Interval between health checks (ms) */
        interval: z.ZodDefault<z.ZodNumber>;
        /** Timeout for health check (ms) */
        timeout: z.ZodDefault<z.ZodNumber>;
        /** Number of retries before marking unhealthy */
        retries: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        timeout: number;
        interval: number;
        retries: number;
    }, {
        enabled?: boolean | undefined;
        timeout?: number | undefined;
        interval?: number | undefined;
        retries?: number | undefined;
    }>>;
    /** Command to execute (for bash mode) */
    command: z.ZodOptional<z.ZodString>;
    /** Arguments for command */
    args: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Environment variables */
    env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    /** Custom metadata */
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    type: "claude" | "gemini" | "ax-cli" | "openai";
    enabled: boolean;
    timeout: number;
    priority: number;
    integrationMode: "mcp" | "sdk" | "bash";
    maxConcurrency: number;
    circuitBreaker: {
        enabled: boolean;
        failureThreshold: number;
        recoveryTimeout: number;
        failureWindow: number;
    };
    healthCheck: {
        enabled: boolean;
        timeout: number;
        interval: number;
        retries: number;
    };
    args: string[];
    metadata?: Record<string, unknown> | undefined;
    command?: string | undefined;
    env?: Record<string, string> | undefined;
}, {
    type: "claude" | "gemini" | "ax-cli" | "openai";
    integrationMode: "mcp" | "sdk" | "bash";
    enabled?: boolean | undefined;
    timeout?: number | undefined;
    metadata?: Record<string, unknown> | undefined;
    priority?: number | undefined;
    maxConcurrency?: number | undefined;
    circuitBreaker?: {
        enabled?: boolean | undefined;
        failureThreshold?: number | undefined;
        recoveryTimeout?: number | undefined;
        failureWindow?: number | undefined;
    } | undefined;
    healthCheck?: {
        enabled?: boolean | undefined;
        timeout?: number | undefined;
        interval?: number | undefined;
        retries?: number | undefined;
    } | undefined;
    command?: string | undefined;
    args?: string[] | undefined;
    env?: Record<string, string> | undefined;
}>;
type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
/**
 * Current health status of a provider
 */
declare const ProviderHealthSchema: z.ZodObject<{
    /** Whether provider is healthy */
    healthy: z.ZodBoolean;
    /** Last health check timestamp */
    lastCheck: z.ZodDate;
    /** Number of consecutive failures */
    consecutiveFailures: z.ZodNumber;
    /** Average latency in milliseconds */
    latencyMs: z.ZodNumber;
    /** Success rate (0-1) */
    successRate: z.ZodNumber;
    /** Circuit breaker state */
    circuitState: z.ZodDefault<z.ZodEnum<["closed", "open", "half-open"]>>;
    /** Error message if unhealthy */
    errorMessage: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    healthy: boolean;
    lastCheck: Date;
    consecutiveFailures: number;
    latencyMs: number;
    successRate: number;
    circuitState: "closed" | "open" | "half-open";
    errorMessage?: string | undefined;
}, {
    healthy: boolean;
    lastCheck: Date;
    consecutiveFailures: number;
    latencyMs: number;
    successRate: number;
    circuitState?: "closed" | "open" | "half-open" | undefined;
    errorMessage?: string | undefined;
}>;
type ProviderHealth = z.infer<typeof ProviderHealthSchema>;
/**
 * Request to execute a task via provider
 */
declare const ExecutionRequestSchema: z.ZodObject<{
    /** Task description/prompt */
    task: z.ZodString;
    /** Optional agent identifier */
    agent: z.ZodOptional<z.ZodString>;
    /** Additional context for execution */
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    /** Timeout in milliseconds */
    timeout: z.ZodDefault<z.ZodNumber>;
    /** Whether to stream output */
    stream: z.ZodDefault<z.ZodBoolean>;
    /** Session ID for context continuity */
    sessionId: z.ZodOptional<z.ZodString>;
    /** Request priority */
    priority: z.ZodDefault<z.ZodEnum<["low", "normal", "high"]>>;
}, "strip", z.ZodTypeAny, {
    timeout: number;
    task: string;
    priority: "low" | "normal" | "high";
    stream: boolean;
    sessionId?: string | undefined;
    context?: Record<string, unknown> | undefined;
    agent?: string | undefined;
}, {
    task: string;
    timeout?: number | undefined;
    sessionId?: string | undefined;
    priority?: "low" | "normal" | "high" | undefined;
    context?: Record<string, unknown> | undefined;
    stream?: boolean | undefined;
    agent?: string | undefined;
}>;
type ExecutionRequest = z.infer<typeof ExecutionRequestSchema>;
/**
 * Response metadata from execution
 */
declare const ExecutionMetadataSchema: z.ZodObject<{
    /** Provider that handled the request */
    provider: z.ZodEnum<["claude", "gemini", "ax-cli", "openai"]>;
    /** Integration mode used */
    integrationMode: z.ZodEnum<["mcp", "sdk", "bash"]>;
    /** Execution duration in milliseconds */
    duration: z.ZodNumber;
    /** Token usage if available */
    tokens: z.ZodOptional<z.ZodObject<{
        input: z.ZodOptional<z.ZodNumber>;
        output: z.ZodOptional<z.ZodNumber>;
        total: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        input?: number | undefined;
        output?: number | undefined;
        total?: number | undefined;
    }, {
        input?: number | undefined;
        output?: number | undefined;
        total?: number | undefined;
    }>>;
    /** Request ID for tracing */
    requestId: z.ZodOptional<z.ZodString>;
    /** Model used if applicable */
    model: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    provider: "claude" | "gemini" | "ax-cli" | "openai";
    duration: number;
    integrationMode: "mcp" | "sdk" | "bash";
    tokens?: {
        input?: number | undefined;
        output?: number | undefined;
        total?: number | undefined;
    } | undefined;
    requestId?: string | undefined;
    model?: string | undefined;
}, {
    provider: "claude" | "gemini" | "ax-cli" | "openai";
    duration: number;
    integrationMode: "mcp" | "sdk" | "bash";
    tokens?: {
        input?: number | undefined;
        output?: number | undefined;
        total?: number | undefined;
    } | undefined;
    requestId?: string | undefined;
    model?: string | undefined;
}>;
type ExecutionMetadata = z.infer<typeof ExecutionMetadataSchema>;
/**
 * Response from provider execution
 */
declare const ExecutionResponseSchema: z.ZodObject<{
    /** Whether execution was successful */
    success: z.ZodBoolean;
    /** Output from execution */
    output: z.ZodString;
    /** Execution metadata */
    metadata: z.ZodObject<{
        /** Provider that handled the request */
        provider: z.ZodEnum<["claude", "gemini", "ax-cli", "openai"]>;
        /** Integration mode used */
        integrationMode: z.ZodEnum<["mcp", "sdk", "bash"]>;
        /** Execution duration in milliseconds */
        duration: z.ZodNumber;
        /** Token usage if available */
        tokens: z.ZodOptional<z.ZodObject<{
            input: z.ZodOptional<z.ZodNumber>;
            output: z.ZodOptional<z.ZodNumber>;
            total: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            input?: number | undefined;
            output?: number | undefined;
            total?: number | undefined;
        }, {
            input?: number | undefined;
            output?: number | undefined;
            total?: number | undefined;
        }>>;
        /** Request ID for tracing */
        requestId: z.ZodOptional<z.ZodString>;
        /** Model used if applicable */
        model: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        provider: "claude" | "gemini" | "ax-cli" | "openai";
        duration: number;
        integrationMode: "mcp" | "sdk" | "bash";
        tokens?: {
            input?: number | undefined;
            output?: number | undefined;
            total?: number | undefined;
        } | undefined;
        requestId?: string | undefined;
        model?: string | undefined;
    }, {
        provider: "claude" | "gemini" | "ax-cli" | "openai";
        duration: number;
        integrationMode: "mcp" | "sdk" | "bash";
        tokens?: {
            input?: number | undefined;
            output?: number | undefined;
            total?: number | undefined;
        } | undefined;
        requestId?: string | undefined;
        model?: string | undefined;
    }>;
    /** Error message if failed */
    error: z.ZodOptional<z.ZodString>;
    /** Detailed error info */
    errorDetails: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        retryable: z.ZodDefault<z.ZodBoolean>;
        details: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        retryable: boolean;
        details?: unknown;
    }, {
        code: string;
        message: string;
        details?: unknown;
        retryable?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    output: string;
    success: boolean;
    metadata: {
        provider: "claude" | "gemini" | "ax-cli" | "openai";
        duration: number;
        integrationMode: "mcp" | "sdk" | "bash";
        tokens?: {
            input?: number | undefined;
            output?: number | undefined;
            total?: number | undefined;
        } | undefined;
        requestId?: string | undefined;
        model?: string | undefined;
    };
    error?: string | undefined;
    errorDetails?: {
        code: string;
        message: string;
        retryable: boolean;
        details?: unknown;
    } | undefined;
}, {
    output: string;
    success: boolean;
    metadata: {
        provider: "claude" | "gemini" | "ax-cli" | "openai";
        duration: number;
        integrationMode: "mcp" | "sdk" | "bash";
        tokens?: {
            input?: number | undefined;
            output?: number | undefined;
            total?: number | undefined;
        } | undefined;
        requestId?: string | undefined;
        model?: string | undefined;
    };
    error?: string | undefined;
    errorDetails?: {
        code: string;
        message: string;
        details?: unknown;
        retryable?: boolean | undefined;
    } | undefined;
}>;
type ExecutionResponse = z.infer<typeof ExecutionResponseSchema>;
/**
 * Provider registration in the registry
 */
declare const ProviderRegistrationSchema: z.ZodObject<{
    /** Provider configuration */
    config: z.ZodObject<{
        /** Provider type identifier */
        type: z.ZodEnum<["claude", "gemini", "ax-cli", "openai"]>;
        /** Whether this provider is enabled */
        enabled: z.ZodDefault<z.ZodBoolean>;
        /** Priority for routing (lower = higher priority) */
        priority: z.ZodDefault<z.ZodNumber>;
        /** Integration mode (mcp, sdk, bash) */
        integrationMode: z.ZodEnum<["mcp", "sdk", "bash"]>;
        /** Default timeout for requests (ms) */
        timeout: z.ZodDefault<z.ZodNumber>;
        /** Maximum concurrent requests */
        maxConcurrency: z.ZodDefault<z.ZodNumber>;
        /** Circuit breaker configuration */
        circuitBreaker: z.ZodDefault<z.ZodObject<{
            /** Whether circuit breaker is enabled */
            enabled: z.ZodDefault<z.ZodBoolean>;
            /** Number of failures before opening circuit */
            failureThreshold: z.ZodDefault<z.ZodNumber>;
            /** Time to wait before attempting recovery (ms) */
            recoveryTimeout: z.ZodDefault<z.ZodNumber>;
            /** Time window for counting failures (ms) */
            failureWindow: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            failureThreshold: number;
            recoveryTimeout: number;
            failureWindow: number;
        }, {
            enabled?: boolean | undefined;
            failureThreshold?: number | undefined;
            recoveryTimeout?: number | undefined;
            failureWindow?: number | undefined;
        }>>;
        /** Health check configuration */
        healthCheck: z.ZodDefault<z.ZodObject<{
            /** Whether health checks are enabled */
            enabled: z.ZodDefault<z.ZodBoolean>;
            /** Interval between health checks (ms) */
            interval: z.ZodDefault<z.ZodNumber>;
            /** Timeout for health check (ms) */
            timeout: z.ZodDefault<z.ZodNumber>;
            /** Number of retries before marking unhealthy */
            retries: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            timeout: number;
            interval: number;
            retries: number;
        }, {
            enabled?: boolean | undefined;
            timeout?: number | undefined;
            interval?: number | undefined;
            retries?: number | undefined;
        }>>;
        /** Command to execute (for bash mode) */
        command: z.ZodOptional<z.ZodString>;
        /** Arguments for command */
        args: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Environment variables */
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        /** Custom metadata */
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        type: "claude" | "gemini" | "ax-cli" | "openai";
        enabled: boolean;
        timeout: number;
        priority: number;
        integrationMode: "mcp" | "sdk" | "bash";
        maxConcurrency: number;
        circuitBreaker: {
            enabled: boolean;
            failureThreshold: number;
            recoveryTimeout: number;
            failureWindow: number;
        };
        healthCheck: {
            enabled: boolean;
            timeout: number;
            interval: number;
            retries: number;
        };
        args: string[];
        metadata?: Record<string, unknown> | undefined;
        command?: string | undefined;
        env?: Record<string, string> | undefined;
    }, {
        type: "claude" | "gemini" | "ax-cli" | "openai";
        integrationMode: "mcp" | "sdk" | "bash";
        enabled?: boolean | undefined;
        timeout?: number | undefined;
        metadata?: Record<string, unknown> | undefined;
        priority?: number | undefined;
        maxConcurrency?: number | undefined;
        circuitBreaker?: {
            enabled?: boolean | undefined;
            failureThreshold?: number | undefined;
            recoveryTimeout?: number | undefined;
            failureWindow?: number | undefined;
        } | undefined;
        healthCheck?: {
            enabled?: boolean | undefined;
            timeout?: number | undefined;
            interval?: number | undefined;
            retries?: number | undefined;
        } | undefined;
        command?: string | undefined;
        args?: string[] | undefined;
        env?: Record<string, string> | undefined;
    }>;
    /** Current health status */
    health: z.ZodObject<{
        /** Whether provider is healthy */
        healthy: z.ZodBoolean;
        /** Last health check timestamp */
        lastCheck: z.ZodDate;
        /** Number of consecutive failures */
        consecutiveFailures: z.ZodNumber;
        /** Average latency in milliseconds */
        latencyMs: z.ZodNumber;
        /** Success rate (0-1) */
        successRate: z.ZodNumber;
        /** Circuit breaker state */
        circuitState: z.ZodDefault<z.ZodEnum<["closed", "open", "half-open"]>>;
        /** Error message if unhealthy */
        errorMessage: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        healthy: boolean;
        lastCheck: Date;
        consecutiveFailures: number;
        latencyMs: number;
        successRate: number;
        circuitState: "closed" | "open" | "half-open";
        errorMessage?: string | undefined;
    }, {
        healthy: boolean;
        lastCheck: Date;
        consecutiveFailures: number;
        latencyMs: number;
        successRate: number;
        circuitState?: "closed" | "open" | "half-open" | undefined;
        errorMessage?: string | undefined;
    }>;
    /** Registration timestamp */
    registeredAt: z.ZodDate;
    /** Total requests handled */
    requestCount: z.ZodDefault<z.ZodNumber>;
    /** Successful requests */
    successCount: z.ZodDefault<z.ZodNumber>;
    /** Total tokens used */
    totalTokens: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    registeredAt: Date;
    successCount: number;
    config: {
        type: "claude" | "gemini" | "ax-cli" | "openai";
        enabled: boolean;
        timeout: number;
        priority: number;
        integrationMode: "mcp" | "sdk" | "bash";
        maxConcurrency: number;
        circuitBreaker: {
            enabled: boolean;
            failureThreshold: number;
            recoveryTimeout: number;
            failureWindow: number;
        };
        healthCheck: {
            enabled: boolean;
            timeout: number;
            interval: number;
            retries: number;
        };
        args: string[];
        metadata?: Record<string, unknown> | undefined;
        command?: string | undefined;
        env?: Record<string, string> | undefined;
    };
    health: {
        healthy: boolean;
        lastCheck: Date;
        consecutiveFailures: number;
        latencyMs: number;
        successRate: number;
        circuitState: "closed" | "open" | "half-open";
        errorMessage?: string | undefined;
    };
    requestCount: number;
    totalTokens: number;
}, {
    registeredAt: Date;
    config: {
        type: "claude" | "gemini" | "ax-cli" | "openai";
        integrationMode: "mcp" | "sdk" | "bash";
        enabled?: boolean | undefined;
        timeout?: number | undefined;
        metadata?: Record<string, unknown> | undefined;
        priority?: number | undefined;
        maxConcurrency?: number | undefined;
        circuitBreaker?: {
            enabled?: boolean | undefined;
            failureThreshold?: number | undefined;
            recoveryTimeout?: number | undefined;
            failureWindow?: number | undefined;
        } | undefined;
        healthCheck?: {
            enabled?: boolean | undefined;
            timeout?: number | undefined;
            interval?: number | undefined;
            retries?: number | undefined;
        } | undefined;
        command?: string | undefined;
        args?: string[] | undefined;
        env?: Record<string, string> | undefined;
    };
    health: {
        healthy: boolean;
        lastCheck: Date;
        consecutiveFailures: number;
        latencyMs: number;
        successRate: number;
        circuitState?: "closed" | "open" | "half-open" | undefined;
        errorMessage?: string | undefined;
    };
    successCount?: number | undefined;
    requestCount?: number | undefined;
    totalTokens?: number | undefined;
}>;
type ProviderRegistration = z.infer<typeof ProviderRegistrationSchema>;
/**
 * Routing context for provider selection
 */
declare const RoutingContextSchema: z.ZodObject<{
    /** Type of task being routed */
    taskType: z.ZodDefault<z.ZodString>;
    /** Estimated complexity (1-10) */
    complexity: z.ZodDefault<z.ZodNumber>;
    /** Prefer MCP providers */
    preferMcp: z.ZodDefault<z.ZodBoolean>;
    /** Required capabilities */
    requiredCapabilities: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Excluded providers */
    excludeProviders: z.ZodDefault<z.ZodArray<z.ZodEnum<["claude", "gemini", "ax-cli", "openai"]>, "many">>;
    /** Force specific provider */
    forceProvider: z.ZodOptional<z.ZodEnum<["claude", "gemini", "ax-cli", "openai"]>>;
}, "strip", z.ZodTypeAny, {
    preferMcp: boolean;
    taskType: string;
    complexity: number;
    requiredCapabilities: string[];
    excludeProviders: ("claude" | "gemini" | "ax-cli" | "openai")[];
    forceProvider?: "claude" | "gemini" | "ax-cli" | "openai" | undefined;
}, {
    preferMcp?: boolean | undefined;
    taskType?: string | undefined;
    complexity?: number | undefined;
    requiredCapabilities?: string[] | undefined;
    excludeProviders?: ("claude" | "gemini" | "ax-cli" | "openai")[] | undefined;
    forceProvider?: "claude" | "gemini" | "ax-cli" | "openai" | undefined;
}>;
type RoutingContext = z.infer<typeof RoutingContextSchema>;
/**
 * Routing decision result
 */
declare const RoutingDecisionSchema: z.ZodObject<{
    /** Selected provider */
    provider: z.ZodEnum<["claude", "gemini", "ax-cli", "openai"]>;
    /** Score that led to selection */
    score: z.ZodNumber;
    /** Reason for selection */
    reason: z.ZodString;
    /** Alternative providers considered */
    alternatives: z.ZodDefault<z.ZodArray<z.ZodObject<{
        provider: z.ZodEnum<["claude", "gemini", "ax-cli", "openai"]>;
        score: z.ZodNumber;
        reason: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        provider: "claude" | "gemini" | "ax-cli" | "openai";
        score: number;
        reason: string;
    }, {
        provider: "claude" | "gemini" | "ax-cli" | "openai";
        score: number;
        reason: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    provider: "claude" | "gemini" | "ax-cli" | "openai";
    score: number;
    reason: string;
    alternatives: {
        provider: "claude" | "gemini" | "ax-cli" | "openai";
        score: number;
        reason: string;
    }[];
}, {
    provider: "claude" | "gemini" | "ax-cli" | "openai";
    score: number;
    reason: string;
    alternatives?: {
        provider: "claude" | "gemini" | "ax-cli" | "openai";
        score: number;
        reason: string;
    }[] | undefined;
}>;
type RoutingDecision = z.infer<typeof RoutingDecisionSchema>;
/**
 * Validate execution request
 */
declare function validateExecutionRequest(data: unknown): ExecutionRequest;
/**
 * Validate provider configuration
 */
declare function validateProviderConfig(data: unknown): ProviderConfig;
/**
 * Default health status values (without lastCheck which needs current time)
 */
declare const DEFAULT_HEALTH_VALUES: {
    readonly healthy: true;
    readonly consecutiveFailures: 0;
    readonly latencyMs: 0;
    readonly successRate: 1;
    readonly circuitState: "closed";
};
/**
 * Create default provider health
 */
declare function createDefaultHealth(): ProviderHealth;

export { type CircuitBreakerConfig, CircuitBreakerConfigSchema, DEFAULT_HEALTH_VALUES, type ExecutionMetadata, ExecutionMetadataSchema, type ExecutionRequest, ExecutionRequestSchema, type ExecutionResponse, ExecutionResponseSchema, type HealthCheckConfig, HealthCheckConfigSchema, type ProviderConfig, ProviderConfigSchema, type ProviderHealth, ProviderHealthSchema, type ProviderRegistration, ProviderRegistrationSchema, type RoutingContext, RoutingContextSchema, type RoutingDecision, RoutingDecisionSchema, createDefaultHealth, validateExecutionRequest, validateProviderConfig };
