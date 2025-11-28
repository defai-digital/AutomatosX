import { z } from 'zod';

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

export { AgentId, CheckpointId, DurationMs, ErrorInfo, ISODateString, IntegrationMode, LogLevel, MemoryId, MemoryType, Metadata, NonEmptyStringArray, NormalizedScore, Percentage, ProviderType, Result, SessionId, TaskStatus, TokenUsage, ValidationError, parseOrThrow, safeParse };
