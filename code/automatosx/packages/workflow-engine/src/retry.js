import { DEFAULT_BACKOFF_CAP_MS, DEFAULT_RETRY_POLICY, } from '@defai.digital/contracts';
export { DEFAULT_RETRY_POLICY };
export function mergeRetryPolicy(policy) {
    if (policy === undefined) {
        return { ...DEFAULT_RETRY_POLICY };
    }
    const partial = policy;
    return {
        maxAttempts: partial.maxAttempts ?? DEFAULT_RETRY_POLICY.maxAttempts,
        backoffMs: partial.backoffMs ?? DEFAULT_RETRY_POLICY.backoffMs,
        backoffMultiplier: partial.backoffMultiplier ?? DEFAULT_RETRY_POLICY.backoffMultiplier,
        retryOn: partial.retryOn ?? DEFAULT_RETRY_POLICY.retryOn,
    };
}
export function shouldRetry(error, policy, currentAttempt) {
    if (currentAttempt >= policy.maxAttempts) {
        return false;
    }
    if (!error.retryable) {
        return false;
    }
    const errorType = mapErrorCodeToRetryType(error.code);
    if (errorType === null) {
        return false;
    }
    return policy.retryOn === undefined ? true : policy.retryOn.includes(errorType);
}
export function calculateBackoff(policy, attempt) {
    const delay = policy.backoffMs * Math.pow(policy.backoffMultiplier, attempt - 1);
    return Math.min(delay, DEFAULT_BACKOFF_CAP_MS);
}
function mapErrorCodeToRetryType(code) {
    const codeUpper = code.toUpperCase();
    if (codeUpper.includes('TIMEOUT')) {
        return 'timeout';
    }
    if (codeUpper.includes('RATE_LIMIT')) {
        return 'rate_limit';
    }
    if (codeUpper.includes('SERVER_ERROR') || codeUpper.includes('INTERNAL_ERROR') || /^5\d{2}$/.test(codeUpper)) {
        return 'server_error';
    }
    if (codeUpper.includes('NETWORK') || codeUpper.includes('CONNECTION') || codeUpper.includes('ECONNREFUSED')) {
        return 'network_error';
    }
    return null;
}
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
