import { getErrorMessage } from '@defai.digital/contracts';
import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
export function createRuntime(options) {
    const basePath = options.outputDir ?? process.cwd();
    return createSharedRuntimeService({ basePath });
}
export function success(message, data = undefined) {
    return {
        success: true,
        message,
        data,
        exitCode: 0,
    };
}
export function failure(message, data = undefined) {
    return {
        success: false,
        message,
        data,
        exitCode: 1,
    };
}
export function failureFromError(action, error) {
    const message = getErrorMessage(error);
    const stack = error instanceof Error ? error.stack : undefined;
    return failure(`Failed to ${action}: ${message}`, stack !== undefined ? { stack } : undefined);
}
export function usageError(usage) {
    return failure(`Usage: ${usage}`);
}
