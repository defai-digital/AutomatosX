import { z } from 'zod';
export { AbilitySelection, AbilitySelectionSchema, AgentProfile, AgentProfileSchema, AgentRegistration, AgentRegistrationSchema, AgentResponse, AgentResponseSchema, CommunicationStyle, CommunicationStyle as CommunicationStyleType, DecisionMaking, DecisionMaking as DecisionMakingType, ExecutionContext, ExecutionContextSchema, Orchestration, OrchestrationSchema, PartialAgentProfile, PartialAgentProfileSchema, Personality, PersonalitySchema, safeValidateAgentProfile, validateAgentProfile } from './agent.js';
export { CircuitBreakerConfig, CircuitBreakerConfigSchema, DEFAULT_HEALTH_VALUES, ExecutionMetadata, ExecutionMetadataSchema, ExecutionRequest, ExecutionRequestSchema, ExecutionResponse, ExecutionResponseSchema, HealthCheckConfig, HealthCheckConfigSchema, ProviderConfig, ProviderConfigSchema, ProviderHealth, ProviderHealthSchema, ProviderRegistration, ProviderRegistrationSchema, RoutingContext, RoutingContextSchema, RoutingDecision, RoutingDecisionSchema, createDefaultHealth, validateExecutionRequest, validateProviderConfig } from './provider.js';
export { CleanupStrategy, CleanupStrategy as CleanupStrategyType, ExportFormat, ExportFormat as ExportFormatType, MemoryAddInput, MemoryAddInputSchema, MemoryBulkAddInput, MemoryBulkAddInputSchema, MemoryCleanupConfig, MemoryCleanupConfigSchema, MemoryCleanupResult, MemoryCleanupResultSchema, MemoryEntry, MemoryEntrySchema, MemoryExportOptions, MemoryExportOptionsSchema, MemoryFilter, MemoryFilterSchema, MemoryImportOptions, MemoryImportOptionsSchema, MemoryMetadata, MemoryMetadataSchema, MemorySearchOptions, MemorySearchOptionsSchema, MemorySearchResult, MemorySearchResultSchema, MemoryStats, MemoryStatsSchema, MemoryUpdateInput, MemoryUpdateInputSchema, validateMemoryAddInput, validateMemoryEntry, validateSearchOptions } from './memory.js';
export { CheckpointConfig, CheckpointConfigSchema, Config, ConfigSchema, DEFAULT_CONFIG, ExecutionConfig, ExecutionConfigSchema, LoggingConfig, LoggingConfigSchema, MemoryConfig, MemoryConfigSchema, MinimalConfig, MinimalConfigSchema, ProvidersConfig, ProvidersConfigSchema, RetryConfig, RetryConfigSchema, RouterConfig, RouterConfigSchema, SessionConfigSchema, SessionConfig as SessionConfigType, WorkspaceConfig, WorkspaceConfigSchema, expandMinimalConfig, mergeConfig, safeValidateConfig, validateConfig } from './config.js';
export { AddTaskInput, AddTaskInputSchema, Checkpoint, CheckpointSchema, CreateSessionInput, CreateSessionInputSchema, DelegationRequest, DelegationRequestSchema, DelegationResult, DelegationResultSchema, Session, SessionSchema, SessionState, SessionState as SessionStateType, SessionSummary, SessionSummarySchema, SessionTask, SessionTaskSchema, UpdateTaskInput, UpdateTaskInputSchema, createSessionSummary, validateCheckpoint, validateCreateSessionInput, validateSession } from './session.js';
export { BYTES_PER_GB, BYTES_PER_KB, BYTES_PER_MB, CIRCUIT_CLOSED, CIRCUIT_HALF_OPEN, CIRCUIT_OPEN, CLEANUP_ACCESS_WEIGHT, CLEANUP_AGE_WEIGHT, CLEANUP_IMPORTANCE_WEIGHT, CircuitState, DB_CACHE_SIZE_KB, DB_DEFAULT_SUCCESS_RATE, DB_REQUEST_HISTORY_SIZE, DEFAULT_MEMORY_IMPORTANCE, DEFAULT_MEMORY_SOURCE, DEFAULT_MEMORY_TYPE, DIR_AGENTS, DIR_AUTOMATOSX, DIR_CHECKPOINTS, DIR_LOGS, DIR_MEMORY, DIR_SESSIONS, DIR_TRACES, DIR_WORKSPACE_PRD, DIR_WORKSPACE_TMP, DISPLAY_ID_LENGTH, DISPLAY_NAME_LENGTH, DISPLAY_PREVIEW_LONG, DISPLAY_PREVIEW_MEDIUM, DISPLAY_PREVIEW_SHORT, DISPLAY_PREVIEW_XLARGE, DISPLAY_ROLE_LENGTH, DISPLAY_TASK_LENGTH, FILE_CONFIG, FILE_MEMORY_DB, LIMIT_CHECKPOINTS_PER_SESSION, LIMIT_CHECKPOINT_RETENTION_DAYS, LIMIT_CIRCUIT_BREAKER_THRESHOLD, LIMIT_CONCURRENCY, LIMIT_DEFAULT_PROVIDER_PRIORITY, LIMIT_MAX_LOG_FILES, LIMIT_MAX_LOG_SIZE, LIMIT_MAX_SESSIONS, LIMIT_MEMORY_ENTRIES, LIMIT_RETENTION_DAYS, LIMIT_RETRY_ATTEMPTS, LIMIT_TMP_RETENTION_DAYS, LIST_PREVIEW_LIMIT, LIST_SEARCH_LIMIT, LIST_TOP_TAGS, MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE, MS_PER_SECOND, MS_PER_WEEK, PATH_CHECKPOINTS, PATH_LOGS, PATH_MEMORY_DB, PATH_SESSIONS, PATH_TRACES, TIMEOUT_AUTO_SAVE, TIMEOUT_CIRCUIT_FAILURE_WINDOW, TIMEOUT_CIRCUIT_RECOVERY, TIMEOUT_EXECUTION, TIMEOUT_HEALTH_CHECK, TIMEOUT_HEALTH_CHECK_REQUEST, TIMEOUT_PROVIDER_COOLDOWN, TIMEOUT_RETRY_INITIAL, TIMEOUT_RETRY_MAX, TIMEOUT_SAVE_DEBOUNCE, TIMEOUT_SESSION, VERSION } from './constants.js';
export { formatBytes, formatDuration, formatDurationLong, formatRelativeTime, truncate, truncateId } from './format.js';

/**
 * Common schemas and branded types used across AutomatosX
 * @module @ax/schemas/common
 */

/**
 * Branded type for Agent IDs
 * Ensures type-safe agent identification across the system
 */
declare const AgentId: z.ZodBranded<z.ZodString, "AgentId">;
type AgentId = z.infer<typeof AgentId>;
/**
 * Branded type for Session IDs
 */
declare const SessionId: z.ZodBranded<z.ZodString, "SessionId">;
type SessionId = z.infer<typeof SessionId>;
/**
 * Branded type for Memory Entry IDs
 */
declare const MemoryId: z.ZodBranded<z.ZodNumber, "MemoryId">;
type MemoryId = z.infer<typeof MemoryId>;
/**
 * Branded type for Checkpoint IDs
 */
declare const CheckpointId: z.ZodBranded<z.ZodString, "CheckpointId">;
type CheckpointId = z.infer<typeof CheckpointId>;
/**
 * Supported AI providers
 */
declare const ProviderType: z.ZodEnum<["claude", "gemini", "ax-cli", "openai"]>;
type ProviderType = z.infer<typeof ProviderType>;
/**
 * Provider integration modes
 */
declare const IntegrationMode: z.ZodEnum<["mcp", "sdk", "bash"]>;
type IntegrationMode = z.infer<typeof IntegrationMode>;
/**
 * Task status for tracking execution
 */
declare const TaskStatus: z.ZodEnum<["pending", "running", "completed", "failed", "cancelled"]>;
type TaskStatus = z.infer<typeof TaskStatus>;
/**
 * Memory entry types for categorization
 */
declare const MemoryType: z.ZodEnum<["conversation", "code", "document", "task", "decision"]>;
type MemoryType = z.infer<typeof MemoryType>;
/**
 * Log levels for structured logging
 */
declare const LogLevel: z.ZodEnum<["debug", "info", "warn", "error", "fatal"]>;
type LogLevel = z.infer<typeof LogLevel>;
/**
 * ISO 8601 date string schema
 */
declare const ISODateString: z.ZodString;
type ISODateString = z.infer<typeof ISODateString>;
/**
 * Positive duration in milliseconds
 */
declare const DurationMs: z.ZodNumber;
type DurationMs = z.infer<typeof DurationMs>;
/**
 * Percentage value (0-100)
 */
declare const Percentage: z.ZodNumber;
type Percentage = z.infer<typeof Percentage>;
/**
 * Normalized score (0-1)
 */
declare const NormalizedScore: z.ZodNumber;
type NormalizedScore = z.infer<typeof NormalizedScore>;
/**
 * Non-empty string array
 */
declare const NonEmptyStringArray: z.ZodArray<z.ZodString, "many">;
type NonEmptyStringArray = z.infer<typeof NonEmptyStringArray>;
/**
 * Generic metadata object
 */
declare const Metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
type Metadata = z.infer<typeof Metadata>;
/**
 * Token usage tracking (shared by agent and provider responses)
 */
declare const TokenUsage: z.ZodObject<{
    input: z.ZodOptional<z.ZodNumber>;
    output: z.ZodOptional<z.ZodNumber>;
    total: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    output?: number | undefined;
    input?: number | undefined;
    total?: number | undefined;
}, {
    output?: number | undefined;
    input?: number | undefined;
    total?: number | undefined;
}>;
type TokenUsage = z.infer<typeof TokenUsage>;
/**
 * Structured error information
 */
declare const ErrorInfo: z.ZodObject<{
    code: z.ZodString;
    message: z.ZodString;
    details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    stack: z.ZodOptional<z.ZodString>;
    cause: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    message: string;
    details?: Record<string, unknown> | undefined;
    stack?: string | undefined;
    cause?: string | undefined;
}, {
    code: string;
    message: string;
    details?: Record<string, unknown> | undefined;
    stack?: string | undefined;
    cause?: string | undefined;
}>;
type ErrorInfo = z.infer<typeof ErrorInfo>;
/**
 * Result type for operations that can fail
 */
declare const Result: <T extends z.ZodTypeAny>(dataSchema: T) => z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: T;
}, "strip", z.ZodTypeAny, z.objectUtil.addQuestionMarks<z.baseObjectOutputType<{
    success: z.ZodLiteral<true>;
    data: T;
}>, any> extends infer T_1 ? { [k in keyof T_1]: T_1[k]; } : never, z.baseObjectInputType<{
    success: z.ZodLiteral<true>;
    data: T;
}> extends infer T_2 ? { [k_1 in keyof T_2]: T_2[k_1]; } : never>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        stack: z.ZodOptional<z.ZodString>;
        cause: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        details?: Record<string, unknown> | undefined;
        stack?: string | undefined;
        cause?: string | undefined;
    }, {
        code: string;
        message: string;
        details?: Record<string, unknown> | undefined;
        stack?: string | undefined;
        cause?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    success: false;
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown> | undefined;
        stack?: string | undefined;
        cause?: string | undefined;
    };
}, {
    success: false;
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown> | undefined;
        stack?: string | undefined;
        cause?: string | undefined;
    };
}>]>;
/**
 * Custom validation error class
 */
declare class ValidationError extends Error {
    readonly zodError: z.ZodError;
    constructor(message: string, zodError: z.ZodError);
    toJSON(): {
        name: string;
        message: string;
        issues: z.ZodIssue[];
    };
}
/**
 * Safe parse helper that returns a typed result
 */
declare function safeParse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.SafeParseReturnType<z.input<T>, z.output<T>>;
/**
 * Parse with custom error message
 */
declare function parseOrThrow<T extends z.ZodTypeAny>(schema: T, data: unknown, errorMessage: string): z.output<T>;

export { AgentId, AgentId as AgentIdType, CheckpointId, CheckpointId as CheckpointIdType, DurationMs, ErrorInfo, ISODateString, IntegrationMode, IntegrationMode as IntegrationModeEnum, LogLevel, LogLevel as LogLevelEnum, MemoryId, MemoryId as MemoryIdType, MemoryType, MemoryType as MemoryTypeEnum, Metadata, NonEmptyStringArray, NormalizedScore, Percentage, ProviderType, ProviderType as ProviderTypeEnum, Result, SessionId, SessionId as SessionIdType, TaskStatus, TaskStatus as TaskStatusEnum, TokenUsage, TokenUsage as TokenUsageType, ValidationError, parseOrThrow, safeParse };
