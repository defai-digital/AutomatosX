import { z } from 'zod';

/**
 * Configuration schemas for AutomatosX
 * @module @ax/schemas/config
 */

/**
 * Providers configuration section
 */
declare const ProvidersConfigSchema: z.ZodObject<{
    /** Default provider to use */
    default: z.ZodDefault<z.ZodEnum<["claude", "gemini", "ax-cli", "openai"]>>;
    /** Enabled providers */
    enabled: z.ZodDefault<z.ZodArray<z.ZodEnum<["claude", "gemini", "ax-cli", "openai"]>, "many">>;
    /** Fallback order when default fails */
    fallbackOrder: z.ZodOptional<z.ZodArray<z.ZodEnum<["claude", "gemini", "ax-cli", "openai"]>, "many">>;
}, "strip", z.ZodTypeAny, {
    default: "claude" | "gemini" | "ax-cli" | "openai";
    enabled: ("claude" | "gemini" | "ax-cli" | "openai")[];
    fallbackOrder?: ("claude" | "gemini" | "ax-cli" | "openai")[] | undefined;
}, {
    default?: "claude" | "gemini" | "ax-cli" | "openai" | undefined;
    enabled?: ("claude" | "gemini" | "ax-cli" | "openai")[] | undefined;
    fallbackOrder?: ("claude" | "gemini" | "ax-cli" | "openai")[] | undefined;
}>;
type ProvidersConfig = z.infer<typeof ProvidersConfigSchema>;
/**
 * Retry configuration
 */
declare const RetryConfigSchema: z.ZodEffects<z.ZodObject<{
    /** Maximum retry attempts */
    maxAttempts: z.ZodDefault<z.ZodNumber>;
    /** Initial delay between retries (ms) */
    initialDelay: z.ZodDefault<z.ZodNumber>;
    /** Maximum delay between retries (ms) */
    maxDelay: z.ZodDefault<z.ZodNumber>;
    /** Backoff multiplier */
    backoffFactor: z.ZodDefault<z.ZodNumber>;
    /** Jitter factor (0-1) to add randomness */
    jitterFactor: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffFactor: number;
    jitterFactor: number;
}, {
    maxAttempts?: number | undefined;
    initialDelay?: number | undefined;
    maxDelay?: number | undefined;
    backoffFactor?: number | undefined;
    jitterFactor?: number | undefined;
}>, {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffFactor: number;
    jitterFactor: number;
}, {
    maxAttempts?: number | undefined;
    initialDelay?: number | undefined;
    maxDelay?: number | undefined;
    backoffFactor?: number | undefined;
    jitterFactor?: number | undefined;
}>;
type RetryConfig = z.infer<typeof RetryConfigSchema>;
/**
 * Execution configuration section
 */
declare const ExecutionConfigSchema: z.ZodObject<{
    /** Default timeout for agent execution (ms), 1ms to 1 hour */
    timeout: z.ZodDefault<z.ZodNumber>;
    /** Maximum concurrent agent executions */
    concurrency: z.ZodDefault<z.ZodNumber>;
    /** Retry configuration */
    retry: z.ZodDefault<z.ZodEffects<z.ZodObject<{
        /** Maximum retry attempts */
        maxAttempts: z.ZodDefault<z.ZodNumber>;
        /** Initial delay between retries (ms) */
        initialDelay: z.ZodDefault<z.ZodNumber>;
        /** Maximum delay between retries (ms) */
        maxDelay: z.ZodDefault<z.ZodNumber>;
        /** Backoff multiplier */
        backoffFactor: z.ZodDefault<z.ZodNumber>;
        /** Jitter factor (0-1) to add randomness */
        jitterFactor: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        maxAttempts: number;
        initialDelay: number;
        maxDelay: number;
        backoffFactor: number;
        jitterFactor: number;
    }, {
        maxAttempts?: number | undefined;
        initialDelay?: number | undefined;
        maxDelay?: number | undefined;
        backoffFactor?: number | undefined;
        jitterFactor?: number | undefined;
    }>, {
        maxAttempts: number;
        initialDelay: number;
        maxDelay: number;
        backoffFactor: number;
        jitterFactor: number;
    }, {
        maxAttempts?: number | undefined;
        initialDelay?: number | undefined;
        maxDelay?: number | undefined;
        backoffFactor?: number | undefined;
        jitterFactor?: number | undefined;
    }>>;
    /** Enable execution tracing */
    tracing: z.ZodDefault<z.ZodBoolean>;
    /** Trace output directory */
    traceDir: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    timeout: number;
    concurrency: number;
    retry: {
        maxAttempts: number;
        initialDelay: number;
        maxDelay: number;
        backoffFactor: number;
        jitterFactor: number;
    };
    tracing: boolean;
    traceDir: string;
}, {
    timeout?: number | undefined;
    concurrency?: number | undefined;
    retry?: {
        maxAttempts?: number | undefined;
        initialDelay?: number | undefined;
        maxDelay?: number | undefined;
        backoffFactor?: number | undefined;
        jitterFactor?: number | undefined;
    } | undefined;
    tracing?: boolean | undefined;
    traceDir?: string | undefined;
}>;
type ExecutionConfig = z.infer<typeof ExecutionConfigSchema>;
/**
 * Memory configuration section
 */
declare const MemoryConfigSchema: z.ZodObject<{
    /** Whether memory system is enabled */
    enabled: z.ZodDefault<z.ZodBoolean>;
    /** Maximum number of entries */
    maxEntries: z.ZodDefault<z.ZodNumber>;
    /** Database path */
    databasePath: z.ZodDefault<z.ZodString>;
    /** Retention period in days */
    retentionDays: z.ZodDefault<z.ZodNumber>;
    /** Cleanup strategy */
    cleanupStrategy: z.ZodDefault<z.ZodEnum<["oldest", "least_accessed", "hybrid", "low_importance"]>>;
    /** Auto cleanup enabled */
    autoCleanup: z.ZodDefault<z.ZodBoolean>;
    /** Search result limit */
    searchLimit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    maxEntries: number;
    databasePath: string;
    retentionDays: number;
    cleanupStrategy: "oldest" | "least_accessed" | "hybrid" | "low_importance";
    autoCleanup: boolean;
    searchLimit: number;
}, {
    enabled?: boolean | undefined;
    maxEntries?: number | undefined;
    databasePath?: string | undefined;
    retentionDays?: number | undefined;
    cleanupStrategy?: "oldest" | "least_accessed" | "hybrid" | "low_importance" | undefined;
    autoCleanup?: boolean | undefined;
    searchLimit?: number | undefined;
}>;
type MemoryConfig = z.infer<typeof MemoryConfigSchema>;
/**
 * Session configuration section
 */
declare const SessionConfigSchema: z.ZodObject<{
    /** Maximum active sessions */
    maxSessions: z.ZodDefault<z.ZodNumber>;
    /** Session timeout (ms) */
    timeout: z.ZodDefault<z.ZodNumber>;
    /** Session data directory */
    dataDir: z.ZodDefault<z.ZodString>;
    /** Auto-save interval (ms) */
    autoSaveInterval: z.ZodDefault<z.ZodNumber>;
    /** Debounce time for saves (ms) */
    saveDebounce: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    timeout: number;
    maxSessions: number;
    dataDir: string;
    autoSaveInterval: number;
    saveDebounce: number;
}, {
    timeout?: number | undefined;
    maxSessions?: number | undefined;
    dataDir?: string | undefined;
    autoSaveInterval?: number | undefined;
    saveDebounce?: number | undefined;
}>;
type SessionConfig = z.infer<typeof SessionConfigSchema>;
/**
 * Checkpoint configuration section
 */
declare const CheckpointConfigSchema: z.ZodObject<{
    /** Whether checkpoints are enabled */
    enabled: z.ZodDefault<z.ZodBoolean>;
    /** Checkpoint storage directory */
    storageDir: z.ZodDefault<z.ZodString>;
    /** Auto-save checkpoints */
    autoSave: z.ZodDefault<z.ZodBoolean>;
    /** Checkpoint retention in days */
    retentionDays: z.ZodDefault<z.ZodNumber>;
    /** Maximum checkpoints per session */
    maxPerSession: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    retentionDays: number;
    storageDir: string;
    autoSave: boolean;
    maxPerSession: number;
}, {
    enabled?: boolean | undefined;
    retentionDays?: number | undefined;
    storageDir?: string | undefined;
    autoSave?: boolean | undefined;
    maxPerSession?: number | undefined;
}>;
type CheckpointConfig = z.infer<typeof CheckpointConfigSchema>;
/**
 * Router configuration section
 */
declare const RouterConfigSchema: z.ZodObject<{
    /** Health check interval (ms) */
    healthCheckInterval: z.ZodDefault<z.ZodNumber>;
    /** Circuit breaker failure threshold */
    circuitBreakerThreshold: z.ZodDefault<z.ZodNumber>;
    /** Provider cooldown after failure (ms) */
    cooldownMs: z.ZodDefault<z.ZodNumber>;
    /** Enable workload-aware routing */
    workloadAwareRouting: z.ZodDefault<z.ZodBoolean>;
    /** Prefer MCP providers */
    preferMcp: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    healthCheckInterval: number;
    circuitBreakerThreshold: number;
    cooldownMs: number;
    workloadAwareRouting: boolean;
    preferMcp: boolean;
}, {
    healthCheckInterval?: number | undefined;
    circuitBreakerThreshold?: number | undefined;
    cooldownMs?: number | undefined;
    workloadAwareRouting?: boolean | undefined;
    preferMcp?: boolean | undefined;
}>;
type RouterConfig = z.infer<typeof RouterConfigSchema>;
/**
 * Workspace configuration section
 */
declare const WorkspaceConfigSchema: z.ZodObject<{
    /** PRD documents path */
    prdPath: z.ZodDefault<z.ZodString>;
    /** Temporary files path */
    tmpPath: z.ZodDefault<z.ZodString>;
    /** Auto-cleanup temporary files */
    autoCleanupTmp: z.ZodDefault<z.ZodBoolean>;
    /** Temporary file retention in days */
    tmpRetentionDays: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    prdPath: string;
    tmpPath: string;
    autoCleanupTmp: boolean;
    tmpRetentionDays: number;
}, {
    prdPath?: string | undefined;
    tmpPath?: string | undefined;
    autoCleanupTmp?: boolean | undefined;
    tmpRetentionDays?: number | undefined;
}>;
type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>;
/**
 * Logging configuration section
 */
declare const LoggingConfigSchema: z.ZodObject<{
    /** Log level */
    level: z.ZodDefault<z.ZodEnum<["debug", "info", "warn", "error"]>>;
    /** Log directory */
    dir: z.ZodDefault<z.ZodString>;
    /** Enable file logging */
    fileEnabled: z.ZodDefault<z.ZodBoolean>;
    /** Enable console logging */
    consoleEnabled: z.ZodDefault<z.ZodBoolean>;
    /** Maximum log file size in bytes */
    maxFileSize: z.ZodDefault<z.ZodNumber>;
    /** Maximum log files to keep */
    maxFiles: z.ZodDefault<z.ZodNumber>;
    /** Enable structured JSON logs */
    jsonFormat: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    level: "debug" | "info" | "warn" | "error";
    dir: string;
    fileEnabled: boolean;
    consoleEnabled: boolean;
    maxFileSize: number;
    maxFiles: number;
    jsonFormat: boolean;
}, {
    level?: "debug" | "info" | "warn" | "error" | undefined;
    dir?: string | undefined;
    fileEnabled?: boolean | undefined;
    consoleEnabled?: boolean | undefined;
    maxFileSize?: number | undefined;
    maxFiles?: number | undefined;
    jsonFormat?: boolean | undefined;
}>;
type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
/**
 * Complete AutomatosX configuration
 * This is the main configuration schema for ax.config.json
 */
declare const ConfigSchema: z.ZodObject<{
    /** Configuration schema version */
    $schema: z.ZodOptional<z.ZodString>;
    /** Configuration version */
    version: z.ZodDefault<z.ZodString>;
    /** Providers configuration */
    providers: z.ZodDefault<z.ZodObject<{
        /** Default provider to use */
        default: z.ZodDefault<z.ZodEnum<["claude", "gemini", "ax-cli", "openai"]>>;
        /** Enabled providers */
        enabled: z.ZodDefault<z.ZodArray<z.ZodEnum<["claude", "gemini", "ax-cli", "openai"]>, "many">>;
        /** Fallback order when default fails */
        fallbackOrder: z.ZodOptional<z.ZodArray<z.ZodEnum<["claude", "gemini", "ax-cli", "openai"]>, "many">>;
    }, "strip", z.ZodTypeAny, {
        default: "claude" | "gemini" | "ax-cli" | "openai";
        enabled: ("claude" | "gemini" | "ax-cli" | "openai")[];
        fallbackOrder?: ("claude" | "gemini" | "ax-cli" | "openai")[] | undefined;
    }, {
        default?: "claude" | "gemini" | "ax-cli" | "openai" | undefined;
        enabled?: ("claude" | "gemini" | "ax-cli" | "openai")[] | undefined;
        fallbackOrder?: ("claude" | "gemini" | "ax-cli" | "openai")[] | undefined;
    }>>;
    /** Execution configuration */
    execution: z.ZodDefault<z.ZodObject<{
        /** Default timeout for agent execution (ms), 1ms to 1 hour */
        timeout: z.ZodDefault<z.ZodNumber>;
        /** Maximum concurrent agent executions */
        concurrency: z.ZodDefault<z.ZodNumber>;
        /** Retry configuration */
        retry: z.ZodDefault<z.ZodEffects<z.ZodObject<{
            /** Maximum retry attempts */
            maxAttempts: z.ZodDefault<z.ZodNumber>;
            /** Initial delay between retries (ms) */
            initialDelay: z.ZodDefault<z.ZodNumber>;
            /** Maximum delay between retries (ms) */
            maxDelay: z.ZodDefault<z.ZodNumber>;
            /** Backoff multiplier */
            backoffFactor: z.ZodDefault<z.ZodNumber>;
            /** Jitter factor (0-1) to add randomness */
            jitterFactor: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            maxAttempts: number;
            initialDelay: number;
            maxDelay: number;
            backoffFactor: number;
            jitterFactor: number;
        }, {
            maxAttempts?: number | undefined;
            initialDelay?: number | undefined;
            maxDelay?: number | undefined;
            backoffFactor?: number | undefined;
            jitterFactor?: number | undefined;
        }>, {
            maxAttempts: number;
            initialDelay: number;
            maxDelay: number;
            backoffFactor: number;
            jitterFactor: number;
        }, {
            maxAttempts?: number | undefined;
            initialDelay?: number | undefined;
            maxDelay?: number | undefined;
            backoffFactor?: number | undefined;
            jitterFactor?: number | undefined;
        }>>;
        /** Enable execution tracing */
        tracing: z.ZodDefault<z.ZodBoolean>;
        /** Trace output directory */
        traceDir: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        timeout: number;
        concurrency: number;
        retry: {
            maxAttempts: number;
            initialDelay: number;
            maxDelay: number;
            backoffFactor: number;
            jitterFactor: number;
        };
        tracing: boolean;
        traceDir: string;
    }, {
        timeout?: number | undefined;
        concurrency?: number | undefined;
        retry?: {
            maxAttempts?: number | undefined;
            initialDelay?: number | undefined;
            maxDelay?: number | undefined;
            backoffFactor?: number | undefined;
            jitterFactor?: number | undefined;
        } | undefined;
        tracing?: boolean | undefined;
        traceDir?: string | undefined;
    }>>;
    /** Memory configuration */
    memory: z.ZodDefault<z.ZodObject<{
        /** Whether memory system is enabled */
        enabled: z.ZodDefault<z.ZodBoolean>;
        /** Maximum number of entries */
        maxEntries: z.ZodDefault<z.ZodNumber>;
        /** Database path */
        databasePath: z.ZodDefault<z.ZodString>;
        /** Retention period in days */
        retentionDays: z.ZodDefault<z.ZodNumber>;
        /** Cleanup strategy */
        cleanupStrategy: z.ZodDefault<z.ZodEnum<["oldest", "least_accessed", "hybrid", "low_importance"]>>;
        /** Auto cleanup enabled */
        autoCleanup: z.ZodDefault<z.ZodBoolean>;
        /** Search result limit */
        searchLimit: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        maxEntries: number;
        databasePath: string;
        retentionDays: number;
        cleanupStrategy: "oldest" | "least_accessed" | "hybrid" | "low_importance";
        autoCleanup: boolean;
        searchLimit: number;
    }, {
        enabled?: boolean | undefined;
        maxEntries?: number | undefined;
        databasePath?: string | undefined;
        retentionDays?: number | undefined;
        cleanupStrategy?: "oldest" | "least_accessed" | "hybrid" | "low_importance" | undefined;
        autoCleanup?: boolean | undefined;
        searchLimit?: number | undefined;
    }>>;
    /** Session configuration */
    session: z.ZodDefault<z.ZodObject<{
        /** Maximum active sessions */
        maxSessions: z.ZodDefault<z.ZodNumber>;
        /** Session timeout (ms) */
        timeout: z.ZodDefault<z.ZodNumber>;
        /** Session data directory */
        dataDir: z.ZodDefault<z.ZodString>;
        /** Auto-save interval (ms) */
        autoSaveInterval: z.ZodDefault<z.ZodNumber>;
        /** Debounce time for saves (ms) */
        saveDebounce: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        timeout: number;
        maxSessions: number;
        dataDir: string;
        autoSaveInterval: number;
        saveDebounce: number;
    }, {
        timeout?: number | undefined;
        maxSessions?: number | undefined;
        dataDir?: string | undefined;
        autoSaveInterval?: number | undefined;
        saveDebounce?: number | undefined;
    }>>;
    /** Checkpoint configuration */
    checkpoint: z.ZodDefault<z.ZodObject<{
        /** Whether checkpoints are enabled */
        enabled: z.ZodDefault<z.ZodBoolean>;
        /** Checkpoint storage directory */
        storageDir: z.ZodDefault<z.ZodString>;
        /** Auto-save checkpoints */
        autoSave: z.ZodDefault<z.ZodBoolean>;
        /** Checkpoint retention in days */
        retentionDays: z.ZodDefault<z.ZodNumber>;
        /** Maximum checkpoints per session */
        maxPerSession: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        retentionDays: number;
        storageDir: string;
        autoSave: boolean;
        maxPerSession: number;
    }, {
        enabled?: boolean | undefined;
        retentionDays?: number | undefined;
        storageDir?: string | undefined;
        autoSave?: boolean | undefined;
        maxPerSession?: number | undefined;
    }>>;
    /** Router configuration */
    router: z.ZodDefault<z.ZodObject<{
        /** Health check interval (ms) */
        healthCheckInterval: z.ZodDefault<z.ZodNumber>;
        /** Circuit breaker failure threshold */
        circuitBreakerThreshold: z.ZodDefault<z.ZodNumber>;
        /** Provider cooldown after failure (ms) */
        cooldownMs: z.ZodDefault<z.ZodNumber>;
        /** Enable workload-aware routing */
        workloadAwareRouting: z.ZodDefault<z.ZodBoolean>;
        /** Prefer MCP providers */
        preferMcp: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        healthCheckInterval: number;
        circuitBreakerThreshold: number;
        cooldownMs: number;
        workloadAwareRouting: boolean;
        preferMcp: boolean;
    }, {
        healthCheckInterval?: number | undefined;
        circuitBreakerThreshold?: number | undefined;
        cooldownMs?: number | undefined;
        workloadAwareRouting?: boolean | undefined;
        preferMcp?: boolean | undefined;
    }>>;
    /** Workspace configuration */
    workspace: z.ZodDefault<z.ZodObject<{
        /** PRD documents path */
        prdPath: z.ZodDefault<z.ZodString>;
        /** Temporary files path */
        tmpPath: z.ZodDefault<z.ZodString>;
        /** Auto-cleanup temporary files */
        autoCleanupTmp: z.ZodDefault<z.ZodBoolean>;
        /** Temporary file retention in days */
        tmpRetentionDays: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        prdPath: string;
        tmpPath: string;
        autoCleanupTmp: boolean;
        tmpRetentionDays: number;
    }, {
        prdPath?: string | undefined;
        tmpPath?: string | undefined;
        autoCleanupTmp?: boolean | undefined;
        tmpRetentionDays?: number | undefined;
    }>>;
    /** Logging configuration */
    logging: z.ZodDefault<z.ZodObject<{
        /** Log level */
        level: z.ZodDefault<z.ZodEnum<["debug", "info", "warn", "error"]>>;
        /** Log directory */
        dir: z.ZodDefault<z.ZodString>;
        /** Enable file logging */
        fileEnabled: z.ZodDefault<z.ZodBoolean>;
        /** Enable console logging */
        consoleEnabled: z.ZodDefault<z.ZodBoolean>;
        /** Maximum log file size in bytes */
        maxFileSize: z.ZodDefault<z.ZodNumber>;
        /** Maximum log files to keep */
        maxFiles: z.ZodDefault<z.ZodNumber>;
        /** Enable structured JSON logs */
        jsonFormat: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        level: "debug" | "info" | "warn" | "error";
        dir: string;
        fileEnabled: boolean;
        consoleEnabled: boolean;
        maxFileSize: number;
        maxFiles: number;
        jsonFormat: boolean;
    }, {
        level?: "debug" | "info" | "warn" | "error" | undefined;
        dir?: string | undefined;
        fileEnabled?: boolean | undefined;
        consoleEnabled?: boolean | undefined;
        maxFileSize?: number | undefined;
        maxFiles?: number | undefined;
        jsonFormat?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    memory: {
        enabled: boolean;
        maxEntries: number;
        databasePath: string;
        retentionDays: number;
        cleanupStrategy: "oldest" | "least_accessed" | "hybrid" | "low_importance";
        autoCleanup: boolean;
        searchLimit: number;
    };
    version: string;
    providers: {
        default: "claude" | "gemini" | "ax-cli" | "openai";
        enabled: ("claude" | "gemini" | "ax-cli" | "openai")[];
        fallbackOrder?: ("claude" | "gemini" | "ax-cli" | "openai")[] | undefined;
    };
    execution: {
        timeout: number;
        concurrency: number;
        retry: {
            maxAttempts: number;
            initialDelay: number;
            maxDelay: number;
            backoffFactor: number;
            jitterFactor: number;
        };
        tracing: boolean;
        traceDir: string;
    };
    session: {
        timeout: number;
        maxSessions: number;
        dataDir: string;
        autoSaveInterval: number;
        saveDebounce: number;
    };
    checkpoint: {
        enabled: boolean;
        retentionDays: number;
        storageDir: string;
        autoSave: boolean;
        maxPerSession: number;
    };
    router: {
        healthCheckInterval: number;
        circuitBreakerThreshold: number;
        cooldownMs: number;
        workloadAwareRouting: boolean;
        preferMcp: boolean;
    };
    workspace: {
        prdPath: string;
        tmpPath: string;
        autoCleanupTmp: boolean;
        tmpRetentionDays: number;
    };
    logging: {
        level: "debug" | "info" | "warn" | "error";
        dir: string;
        fileEnabled: boolean;
        consoleEnabled: boolean;
        maxFileSize: number;
        maxFiles: number;
        jsonFormat: boolean;
    };
    $schema?: string | undefined;
}, {
    memory?: {
        enabled?: boolean | undefined;
        maxEntries?: number | undefined;
        databasePath?: string | undefined;
        retentionDays?: number | undefined;
        cleanupStrategy?: "oldest" | "least_accessed" | "hybrid" | "low_importance" | undefined;
        autoCleanup?: boolean | undefined;
        searchLimit?: number | undefined;
    } | undefined;
    $schema?: string | undefined;
    version?: string | undefined;
    providers?: {
        default?: "claude" | "gemini" | "ax-cli" | "openai" | undefined;
        enabled?: ("claude" | "gemini" | "ax-cli" | "openai")[] | undefined;
        fallbackOrder?: ("claude" | "gemini" | "ax-cli" | "openai")[] | undefined;
    } | undefined;
    execution?: {
        timeout?: number | undefined;
        concurrency?: number | undefined;
        retry?: {
            maxAttempts?: number | undefined;
            initialDelay?: number | undefined;
            maxDelay?: number | undefined;
            backoffFactor?: number | undefined;
            jitterFactor?: number | undefined;
        } | undefined;
        tracing?: boolean | undefined;
        traceDir?: string | undefined;
    } | undefined;
    session?: {
        timeout?: number | undefined;
        maxSessions?: number | undefined;
        dataDir?: string | undefined;
        autoSaveInterval?: number | undefined;
        saveDebounce?: number | undefined;
    } | undefined;
    checkpoint?: {
        enabled?: boolean | undefined;
        retentionDays?: number | undefined;
        storageDir?: string | undefined;
        autoSave?: boolean | undefined;
        maxPerSession?: number | undefined;
    } | undefined;
    router?: {
        healthCheckInterval?: number | undefined;
        circuitBreakerThreshold?: number | undefined;
        cooldownMs?: number | undefined;
        workloadAwareRouting?: boolean | undefined;
        preferMcp?: boolean | undefined;
    } | undefined;
    workspace?: {
        prdPath?: string | undefined;
        tmpPath?: string | undefined;
        autoCleanupTmp?: boolean | undefined;
        tmpRetentionDays?: number | undefined;
    } | undefined;
    logging?: {
        level?: "debug" | "info" | "warn" | "error" | undefined;
        dir?: string | undefined;
        fileEnabled?: boolean | undefined;
        consoleEnabled?: boolean | undefined;
        maxFileSize?: number | undefined;
        maxFiles?: number | undefined;
        jsonFormat?: boolean | undefined;
    } | undefined;
}>;
type Config = z.infer<typeof ConfigSchema>;
/**
 * Minimal configuration for quick start
 * Only requires essential settings
 */
declare const MinimalConfigSchema: z.ZodObject<{
    /** Default provider */
    provider: z.ZodDefault<z.ZodEnum<["claude", "gemini", "ax-cli", "openai"]>>;
}, "strip", z.ZodTypeAny, {
    provider: "claude" | "gemini" | "ax-cli" | "openai";
}, {
    provider?: "claude" | "gemini" | "ax-cli" | "openai" | undefined;
}>;
type MinimalConfig = z.infer<typeof MinimalConfigSchema>;
/**
 * Default configuration values
 */
declare const DEFAULT_CONFIG: Config;
/**
 * Validate configuration data
 */
declare function validateConfig(data: unknown): Config;
/**
 * Safe validate configuration
 */
declare function safeValidateConfig(data: unknown): z.SafeParseReturnType<unknown, Config>;
/**
 * Merge partial config with defaults
 */
declare function mergeConfig(partial: Partial<Config>): Config;
/**
 * Expand minimal config to full config
 */
declare function expandMinimalConfig(minimal: MinimalConfig): Config;

export { type CheckpointConfig, CheckpointConfigSchema, type Config, ConfigSchema, DEFAULT_CONFIG, type ExecutionConfig, ExecutionConfigSchema, type LoggingConfig, LoggingConfigSchema, type MemoryConfig, MemoryConfigSchema, type MinimalConfig, MinimalConfigSchema, type ProvidersConfig, ProvidersConfigSchema, type RetryConfig, RetryConfigSchema, type RouterConfig, RouterConfigSchema, type SessionConfig, SessionConfigSchema, type WorkspaceConfig, WorkspaceConfigSchema, expandMinimalConfig, mergeConfig, safeValidateConfig, validateConfig };
