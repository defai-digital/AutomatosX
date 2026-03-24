export * from './constants.js';
export * from './workflow/v1/index.js';
export function getErrorMessage(error, fallback = 'Unknown error') {
    if (error instanceof Error && error.message.length > 0) {
        return error.message;
    }
    if (typeof error === 'string' && error.length > 0) {
        return error;
    }
    return fallback;
}
