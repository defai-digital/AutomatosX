// Sprint 2 Day 12: Error Envelope
// Standardized error format for all CLI commands with user-friendly messaging
import { z } from 'zod';
/**
 * Error code constants for machine-readable error identification
 */
export const ErrorCodes = {
    // Validation errors (400-level)
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INVALID_AGENT: 'INVALID_AGENT',
    INVALID_TASK: 'INVALID_TASK',
    INVALID_INPUT: 'INVALID_INPUT',
    // Not found errors (404-level)
    AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
    CONFIG_NOT_FOUND: 'CONFIG_NOT_FOUND',
    MEMORY_NOT_FOUND: 'MEMORY_NOT_FOUND',
    RUN_NOT_FOUND: 'RUN_NOT_FOUND',
    FILE_NOT_FOUND: 'FILE_NOT_FOUND',
    // Provider errors (500-level)
    PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
    PROVIDER_TIMEOUT: 'PROVIDER_TIMEOUT',
    PROVIDER_RATE_LIMIT: 'PROVIDER_RATE_LIMIT',
    PROVIDER_AUTH_ERROR: 'PROVIDER_AUTH_ERROR',
    // System errors (500-level)
    DATABASE_ERROR: 'DATABASE_ERROR',
    FILE_SYSTEM_ERROR: 'FILE_SYSTEM_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    // Runtime errors (500-level)
    STATE_MACHINE_ERROR: 'STATE_MACHINE_ERROR',
    EFFECT_EXECUTION_ERROR: 'EFFECT_EXECUTION_ERROR',
    RULE_ENGINE_ERROR: 'RULE_ENGINE_ERROR',
    ORCHESTRATION_ERROR: 'ORCHESTRATION_ERROR',
    // Generic errors
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
};
/**
 * Error envelope schema for consistent error formatting
 */
export const ErrorEnvelopeSchema = z.object({
    error: z.object({
        code: z.string().describe('Machine-readable error code'),
        message: z.string().describe('Human-readable error message'),
        details: z.unknown().optional().describe('Additional error context'),
        stackTrace: z.string().optional().describe('Stack trace (debug mode only)'),
        suggestions: z.array(z.string()).optional().describe('Actionable suggestions for resolution'),
    }),
    timestamp: z.string().datetime().describe('ISO 8601 timestamp of error occurrence'),
    requestId: z.string().uuid().optional().describe('Unique request identifier for tracing'),
});
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
export function createErrorEnvelope(code, message, options) {
    const envelope = {
        error: {
            code,
            message,
            details: options?.details,
            stackTrace: options?.stackTrace,
            suggestions: options?.suggestions,
        },
        timestamp: new Date().toISOString(),
        requestId: options?.requestId,
    };
    // Validate the envelope structure
    return ErrorEnvelopeSchema.parse(envelope);
}
/**
 * Custom error classes for different error categories
 */
export class ValidationError extends Error {
    code;
    suggestions;
    constructor(message, suggestions) {
        super(message);
        this.name = 'ValidationError';
        this.code = ErrorCodes.VALIDATION_ERROR;
        this.suggestions = suggestions;
    }
}
export class NotFoundError extends Error {
    code;
    suggestions;
    constructor(message, code = ErrorCodes.AGENT_NOT_FOUND, suggestions) {
        super(message);
        this.name = 'NotFoundError';
        this.code = code;
        this.suggestions = suggestions;
    }
}
export class ProviderError extends Error {
    code;
    providerName;
    suggestions;
    constructor(message, code = ErrorCodes.PROVIDER_UNAVAILABLE, options) {
        super(message);
        this.name = 'ProviderError';
        this.code = code;
        this.providerName = options?.providerName;
        this.suggestions = options?.suggestions;
    }
}
export class SystemError extends Error {
    code;
    suggestions;
    constructor(message, code = ErrorCodes.INTERNAL_ERROR, suggestions) {
        super(message);
        this.name = 'SystemError';
        this.code = code;
        this.suggestions = suggestions;
    }
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
export async function errorHandler(error, options) {
    let envelope;
    if (error instanceof z.ZodError) {
        // Zod validation errors
        envelope = createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Invalid command arguments', {
            details: error.issues.map((e) => ({
                path: e.path.join('.'),
                message: e.message,
            })),
            suggestions: [
                'Run the command with --help to see valid arguments',
                'Check the documentation at https://github.com/defai-digital/automatosx',
            ],
            requestId: options?.requestId,
        });
    }
    else if (error instanceof ValidationError) {
        envelope = createErrorEnvelope(error.code, error.message, {
            suggestions: error.suggestions,
            stackTrace: options?.debug ? error.stack : undefined,
            requestId: options?.requestId,
        });
    }
    else if (error instanceof NotFoundError) {
        envelope = createErrorEnvelope(error.code, error.message, {
            suggestions: error.suggestions,
            stackTrace: options?.debug ? error.stack : undefined,
            requestId: options?.requestId,
        });
    }
    else if (error instanceof ProviderError) {
        envelope = createErrorEnvelope(error.code, error.message, {
            details: { provider: error.providerName },
            suggestions: error.suggestions || [
                'Check your internet connection',
                'Verify your API keys in automatosx.config.json',
                'Try a different provider with --provider flag',
            ],
            stackTrace: options?.debug ? error.stack : undefined,
            requestId: options?.requestId,
        });
    }
    else if (error instanceof SystemError) {
        envelope = createErrorEnvelope(error.code, error.message, {
            suggestions: error.suggestions,
            stackTrace: options?.debug ? error.stack : undefined,
            requestId: options?.requestId,
        });
    }
    else if (error instanceof Error) {
        // Generic Error objects
        envelope = createErrorEnvelope(ErrorCodes.UNKNOWN_ERROR, error.message || 'An unexpected error occurred', {
            details: error.name !== 'Error' ? { errorType: error.name } : undefined,
            stackTrace: options?.debug ? error.stack : undefined,
            requestId: options?.requestId,
        });
    }
    else {
        // Non-Error objects
        envelope = createErrorEnvelope(ErrorCodes.UNKNOWN_ERROR, 'An unexpected error occurred', {
            details: { error: String(error) },
            requestId: options?.requestId,
        });
    }
    // Format output
    if (options?.json) {
        console.error(JSON.stringify(envelope, null, 2));
    }
    else {
        printErrorEnvelope(envelope, options?.debug);
    }
    process.exit(1);
}
/**
 * Print error envelope in human-readable format
 */
function printErrorEnvelope(envelope, debug) {
    const { error } = envelope;
    // ANSI color codes
    const red = '\x1b[31m';
    const yellow = '\x1b[33m';
    const gray = '\x1b[90m';
    const reset = '\x1b[0m';
    console.error(`\n${red}✗ Error:${reset} ${error.message}`);
    console.error(`${gray}Code: ${error.code}${reset}`);
    if (error.details) {
        console.error(`\n${gray}Details:${reset}`);
        console.error(JSON.stringify(error.details, null, 2));
    }
    if (error.suggestions && error.suggestions.length > 0) {
        console.error(`\n${yellow}Suggestions:${reset}`);
        error.suggestions.forEach((suggestion, i) => {
            console.error(`  ${i + 1}. ${suggestion}`);
        });
    }
    if (debug && error.stackTrace) {
        console.error(`\n${gray}Stack Trace:${reset}`);
        console.error(error.stackTrace);
    }
    console.error(`\n${gray}Timestamp: ${envelope.timestamp}${reset}`);
    if (envelope.requestId) {
        console.error(`${gray}Request ID: ${envelope.requestId}${reset}\n`);
    }
}
/**
 * Helper to get user-friendly error suggestions based on error code
 */
export function getDefaultSuggestions(code) {
    switch (code) {
        case ErrorCodes.AGENT_NOT_FOUND:
            return ['Run `ax list agents` to see available agents', 'Check for typos in the agent name'];
        case ErrorCodes.CONFIG_NOT_FOUND:
            return [
                'Run `ax config show` to see current configuration',
                'Check if automatosx.config.json exists in project root',
            ];
        case ErrorCodes.PROVIDER_UNAVAILABLE:
            return [
                'Check your internet connection',
                'Verify API keys in automatosx.config.json',
                'Try a different provider with --provider flag',
            ];
        case ErrorCodes.DATABASE_ERROR:
            return [
                'Check if .automatosx/memory/ directory exists',
                'Try running `ax cache clear` to reset the database',
                'Check file permissions on the database file',
            ];
        case ErrorCodes.PERMISSION_DENIED:
            return ['Check file permissions', 'Try running with appropriate permissions', 'Check if files are locked'];
        default:
            return ['Check the documentation at https://github.com/defai-digital/automatosx', 'Run with --debug for more details'];
    }
}
//# sourceMappingURL=ErrorEnvelope.js.map