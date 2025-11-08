import { z } from 'zod';
/**
 * Error code constants for machine-readable error identification
 */
export declare const ErrorCodes: {
    readonly VALIDATION_ERROR: "VALIDATION_ERROR";
    readonly INVALID_AGENT: "INVALID_AGENT";
    readonly INVALID_TASK: "INVALID_TASK";
    readonly INVALID_INPUT: "INVALID_INPUT";
    readonly AGENT_NOT_FOUND: "AGENT_NOT_FOUND";
    readonly CONFIG_NOT_FOUND: "CONFIG_NOT_FOUND";
    readonly MEMORY_NOT_FOUND: "MEMORY_NOT_FOUND";
    readonly RUN_NOT_FOUND: "RUN_NOT_FOUND";
    readonly FILE_NOT_FOUND: "FILE_NOT_FOUND";
    readonly PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE";
    readonly PROVIDER_TIMEOUT: "PROVIDER_TIMEOUT";
    readonly PROVIDER_RATE_LIMIT: "PROVIDER_RATE_LIMIT";
    readonly PROVIDER_AUTH_ERROR: "PROVIDER_AUTH_ERROR";
    readonly DATABASE_ERROR: "DATABASE_ERROR";
    readonly FILE_SYSTEM_ERROR: "FILE_SYSTEM_ERROR";
    readonly NETWORK_ERROR: "NETWORK_ERROR";
    readonly PERMISSION_DENIED: "PERMISSION_DENIED";
    readonly STATE_MACHINE_ERROR: "STATE_MACHINE_ERROR";
    readonly EFFECT_EXECUTION_ERROR: "EFFECT_EXECUTION_ERROR";
    readonly RULE_ENGINE_ERROR: "RULE_ENGINE_ERROR";
    readonly ORCHESTRATION_ERROR: "ORCHESTRATION_ERROR";
    readonly UNKNOWN_ERROR: "UNKNOWN_ERROR";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
};
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
/**
 * Error envelope schema for consistent error formatting
 */
export declare const ErrorEnvelopeSchema: z.ZodObject<{
    error: z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodUnknown>;
        stackTrace: z.ZodOptional<z.ZodString>;
        suggestions: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    timestamp: z.ZodString;
    requestId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
/**
 * Options for creating an error envelope
 */
export interface ErrorEnvelopeOptions {
    details?: unknown;
    stackTrace?: string;
    suggestions?: string[];
    requestId?: string;
}
/**
 * Factory function to create standardized error envelopes
 *
 * @param code Machine-readable error code
 * @param message Human-readable error message
 * @param options Additional error context
 * @returns Validated error envelope
 *
 * @example
 * ```typescript
 * const error = createErrorEnvelope(
 *   ErrorCodes.AGENT_NOT_FOUND,
 *   'Agent "backend" not found',
 *   {
 *     details: { agentName: 'backend', availableAgents: ['frontend', 'product'] },
 *     suggestions: [
 *       'Run `ax list agents` to see available agents',
 *       'Check for typos in the agent name'
 *     ]
 *   }
 * )
 * ```
 */
export declare function createErrorEnvelope(code: string, message: string, options?: ErrorEnvelopeOptions): ErrorEnvelope;
/**
 * Custom error classes for different error categories
 */
export declare class ValidationError extends Error {
    code: ErrorCode;
    suggestions?: string[];
    constructor(message: string, suggestions?: string[]);
}
export declare class NotFoundError extends Error {
    code: ErrorCode;
    suggestions?: string[];
    constructor(message: string, code?: ErrorCode, suggestions?: string[]);
}
export declare class ProviderError extends Error {
    code: ErrorCode;
    providerName?: string;
    suggestions?: string[];
    constructor(message: string, code?: ErrorCode, options?: {
        providerName?: string;
        suggestions?: string[];
    });
}
export declare class SystemError extends Error {
    code: ErrorCode;
    suggestions?: string[];
    constructor(message: string, code?: ErrorCode, suggestions?: string[]);
}
/**
 * Error handler middleware for CLI commands
 *
 * Catches errors and formats them as error envelopes with user-friendly messages
 *
 * @param error The error to handle
 * @param options Formatting options
 * @returns Never (exits process)
 *
 * @example
 * ```typescript
 * try {
 *   await runCommand(args)
 * } catch (error) {
 *   await errorHandler(error, { debug: args.debug })
 * }
 * ```
 */
export declare function errorHandler(error: unknown, options?: {
    debug?: boolean;
    json?: boolean;
    requestId?: string;
}): Promise<never>;
/**
 * Helper to get user-friendly error suggestions based on error code
 */
export declare function getDefaultSuggestions(code: ErrorCode): string[];
//# sourceMappingURL=ErrorEnvelope.d.ts.map