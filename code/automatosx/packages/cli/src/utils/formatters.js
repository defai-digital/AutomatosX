/**
 * Build a success command result.
 */
export function success(message, data = undefined) {
    return {
        success: true,
        message,
        data,
        exitCode: 0,
    };
}
/**
 * Build a failure command result.
 */
export function failure(message, data = undefined) {
    return {
        success: false,
        message,
        data,
        exitCode: 1,
    };
}
/**
 * Build a failure command result from an error.
 */
export function failureFromError(action, error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    return failure(`Failed to ${action}: ${message}`, stack !== undefined ? { stack } : undefined);
}
/**
 * Build a usage error command result.
 */
export function usageError(usage) {
    return failure(`Usage: ${usage}`);
}
