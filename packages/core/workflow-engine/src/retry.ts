import {
  type RetryPolicy,
  DEFAULT_RETRY_POLICY,
  DEFAULT_BACKOFF_CAP_MS,
} from '@automatosx/contracts';
import type { StepError } from './types.js';

// Re-export for backwards compatibility
export { DEFAULT_RETRY_POLICY };

/**
 * Merges a partial retry policy with defaults
 */
export function mergeRetryPolicy(
  policy?: RetryPolicy
): Required<RetryPolicy> {
  if (policy === undefined) {
    return DEFAULT_RETRY_POLICY;
  }

  // Cast to partial to allow null coalescing
  // Runtime objects may be incomplete even if TypeScript says otherwise
  const partial = policy as Partial<RetryPolicy>;
  return {
    maxAttempts: partial.maxAttempts ?? DEFAULT_RETRY_POLICY.maxAttempts,
    backoffMs: partial.backoffMs ?? DEFAULT_RETRY_POLICY.backoffMs,
    backoffMultiplier: partial.backoffMultiplier ?? DEFAULT_RETRY_POLICY.backoffMultiplier,
    retryOn: partial.retryOn ?? DEFAULT_RETRY_POLICY.retryOn,
  };
}

/**
 * Determines if an error should trigger a retry
 * INV-WF-002: Retries are scoped to the current step only
 */
export function shouldRetry(
  error: StepError,
  policy: Required<RetryPolicy>,
  currentAttempt: number
): boolean {
  // Check if we have attempts remaining
  if (currentAttempt >= policy.maxAttempts) {
    return false;
  }

  // Check if the error is retryable
  if (!error.retryable) {
    return false;
  }

  // Check if the error code matches retry conditions
  const errorType = mapErrorCodeToRetryType(error.code);
  if (errorType === null) {
    return false;
  }

  // If retryOn is not defined, allow retry for any retryable error
  if (policy.retryOn === undefined) {
    return true;
  }

  return policy.retryOn.includes(errorType);
}

/**
 * Calculates the backoff delay for a retry attempt
 */
export function calculateBackoff(
  policy: Required<RetryPolicy>,
  attempt: number
): number {
  // Exponential backoff: baseDelay * multiplier^(attempt-1)
  const delay = policy.backoffMs * Math.pow(policy.backoffMultiplier, attempt - 1);
  return Math.min(delay, DEFAULT_BACKOFF_CAP_MS); // Cap at contract-defined max
}

/**
 * Maps error codes to retry types
 */
function mapErrorCodeToRetryType(
  code: string
): 'timeout' | 'rate_limit' | 'server_error' | 'network_error' | null {
  const codeUpper = code.toUpperCase();

  if (codeUpper.includes('TIMEOUT')) {
    return 'timeout';
  }
  if (codeUpper.includes('RATE_LIMIT') || codeUpper.includes('RATE_LIMITED')) {
    return 'rate_limit';
  }
  if (
    codeUpper.includes('SERVER_ERROR') ||
    codeUpper.includes('INTERNAL_ERROR') ||
    codeUpper.startsWith('5')
  ) {
    return 'server_error';
  }
  if (
    codeUpper.includes('NETWORK') ||
    codeUpper.includes('CONNECTION') ||
    codeUpper.includes('ECONNREFUSED')
  ) {
    return 'network_error';
  }

  return null;
}

/**
 * Sleeps for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
