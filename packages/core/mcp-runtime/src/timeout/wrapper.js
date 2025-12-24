import { TOOL_CATEGORIES, getToolTimeout } from '@automatosx/contracts';
/**
 * Default timeout configuration.
 */
export const DEFAULT_TIMEOUT_CONFIG = {
    defaultTimeoutMs: 30_000,
    toolTimeouts: {
        query: 10_000, // 10 seconds
        mutation: 30_000, // 30 seconds
        scan: 120_000, // 2 minutes
        execution: 1_200_000, // 20 minutes
    },
    toolOverrides: {},
};
/**
 * Timeout error class for identification.
 */
export class TimeoutError extends Error {
    code = 'TOOL_TIMEOUT';
    timeoutMs;
    constructor(timeoutMs, message) {
        super(message ?? `Operation timed out after ${timeoutMs}ms`);
        this.name = 'TimeoutError';
        this.timeoutMs = timeoutMs;
    }
}
/**
 * Wrap an async operation with timeout protection.
 *
 * Invariants enforced:
 * - INV-MCP-TIMEOUT-001: Guaranteed termination
 * - INV-MCP-TIMEOUT-004: Returns TOOL_TIMEOUT error code
 * - INV-MCP-TIMEOUT-005: Duration tracking
 */
export async function withTimeout(operation, timeoutMs) {
    const startTime = Date.now();
    // Create timeout promise
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new TimeoutError(timeoutMs));
        }, timeoutMs);
    });
    try {
        // Race between operation and timeout
        const result = await Promise.race([operation(), timeoutPromise]);
        // Clear timeout if operation completed first
        if (timeoutId)
            clearTimeout(timeoutId);
        return {
            status: 'completed',
            result,
            durationMs: Date.now() - startTime,
        };
    }
    catch (error) {
        // Clear timeout
        if (timeoutId)
            clearTimeout(timeoutId);
        const durationMs = Date.now() - startTime;
        // Check if it was a timeout
        if (error instanceof TimeoutError) {
            return {
                status: 'timeout',
                timeoutMs: error.timeoutMs,
                durationMs,
            };
        }
        // Other error
        return {
            status: 'error',
            error: {
                code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            },
            durationMs,
        };
    }
}
/**
 * Wrap a tool handler with timeout protection.
 *
 * Invariants enforced:
 * - INV-MCP-TIMEOUT-002: Category consistency
 * - INV-MCP-TIMEOUT-003: Override precedence
 */
export function withToolTimeout(toolName, handler, config = DEFAULT_TIMEOUT_CONFIG) {
    const timeoutMs = getToolTimeout(toolName, config);
    return async (args) => {
        return withTimeout(() => handler(args), timeoutMs);
    };
}
/**
 * Create a timeout-wrapped handler factory.
 */
export function createTimeoutWrapper(config = DEFAULT_TIMEOUT_CONFIG) {
    return function wrapHandler(toolName, handler) {
        return withToolTimeout(toolName, handler, config);
    };
}
/**
 * Get the category for a tool.
 */
export function getToolCategory(toolName) {
    return TOOL_CATEGORIES[toolName];
}
/**
 * Check if a result is a timeout.
 */
export function isTimeoutResult(result) {
    return result.status === 'timeout';
}
/**
 * Check if a result is successful.
 */
export function isSuccessResult(result) {
    return result.status === 'completed';
}
/**
 * Extract the result value from a successful TimeoutResult.
 * Throws if result is not successful.
 */
export function unwrapResult(result) {
    if (result.status !== 'completed') {
        if (result.status === 'timeout') {
            throw new TimeoutError(result.timeoutMs);
        }
        throw new Error(result.error.message);
    }
    return result.result;
}
//# sourceMappingURL=wrapper.js.map