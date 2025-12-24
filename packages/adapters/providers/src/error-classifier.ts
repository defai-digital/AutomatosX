/**
 * Error classifier for CLI-based providers
 *
 * Classifies errors from:
 * - CLI exit codes
 * - stderr output
 * - Error messages
 *
 * Provides retry/fallback guidance based on error type
 */

import type { ClassifiedError, ErrorCategory, SpawnResult } from './types.js';

/**
 * Error patterns for classification
 * Organized by category, each pattern is case-insensitive regex
 */
const ERROR_PATTERNS: Record<ErrorCategory, readonly RegExp[]> = {
  // Quota exhausted - fallback to different provider
  quota: [
    /insufficient.?quota/i,
    /quota.?exceeded/i,
    /billing.?hard.?limit/i,
    /RESOURCE_EXHAUSTED/i,
    /credit.?limit/i,
    /usage.?limit/i,
  ],

  // Rate limit - retry with backoff
  rate_limit: [
    /rate.?limit/i,
    /too.?many.?requests/i,
    /overloaded/i,
    /RATE_LIMIT_EXCEEDED/i,
    /throttl/i,
    /\b429\b/,  // Word boundary to prevent false matches like "4290"
  ],

  // Authentication - don't retry
  authentication: [
    /invalid.?api.?key/i,
    /unauthorized/i,
    /UNAUTHENTICATED/i,
    /PERMISSION_DENIED/i,
    /authentication.?failed/i,
    /not.?authenticated/i,
    /\b401\b/,  // Word boundary to prevent false matches
    /\b403\b/,  // Word boundary to prevent false matches
  ],

  // Validation - don't retry
  validation: [
    /invalid.?request/i,
    /malformed/i,
    /bad.?request/i,
    /validation.?error/i,
    /invalid.?parameter/i,
    /\b400\b/,  // Word boundary to prevent false matches
  ],

  // Network - retry
  network: [
    /ECONNRESET/,
    /ETIMEDOUT/,
    /ENOTFOUND/,
    /ECONNREFUSED/,
    /network.?error/i,
    /connection.?failed/i,
    /DEADLINE_EXCEEDED/i,
    /socket.?hang.?up/i,
  ],

  // Server errors - retry then fallback
  server: [
    /internal.?server.?error/i,
    /service.?unavailable/i,
    /bad.?gateway/i,
    /\b500\b/,  // Word boundary to prevent false matches
    /\b502\b/,  // Word boundary to prevent false matches
    /\b503\b/,  // Word boundary to prevent false matches
    /\b504\b/,  // Word boundary to prevent false matches
  ],

  // Timeout - retry or fallback
  timeout: [
    /timed?.?out/i,
    /timeout/i,
    /SIGTERM/,
    /SIGKILL/,
  ],

  // Not found - don't retry
  not_found: [
    /command.?not.?found/i,
    /ENOENT/,
    /not.?found/i,
    /model.?not.?found/i,
    /\b404\b/,  // Word boundary to prevent false matches
  ],

  // Configuration - don't retry
  configuration: [
    /not.?configured/i,
    /missing.?config/i,
    /invalid.?config/i,
    /cli.?not.?installed/i,
  ],

  // Unknown - default
  unknown: [],
};

/**
 * Retry guidance by error category
 */
const RETRY_GUIDANCE: Record<ErrorCategory, { shouldRetry: boolean; shouldFallback: boolean }> = {
  quota: { shouldRetry: false, shouldFallback: true },
  rate_limit: { shouldRetry: true, shouldFallback: false },
  authentication: { shouldRetry: false, shouldFallback: false },
  validation: { shouldRetry: false, shouldFallback: false },
  network: { shouldRetry: true, shouldFallback: true },
  server: { shouldRetry: true, shouldFallback: true },
  timeout: { shouldRetry: true, shouldFallback: true },
  not_found: { shouldRetry: false, shouldFallback: true },
  configuration: { shouldRetry: false, shouldFallback: false },
  unknown: { shouldRetry: false, shouldFallback: true },
};

/**
 * Classifies an error from various sources
 *
 * @param error - The error to classify (Error, string, or unknown)
 * @returns Classified error with retry/fallback guidance
 */
export function classifyError(error: unknown): ClassifiedError {
  const message = extractErrorMessage(error);
  const category = categorizeError(message);
  const guidance = RETRY_GUIDANCE[category];

  return {
    category,
    message,
    shouldRetry: guidance.shouldRetry,
    shouldFallback: guidance.shouldFallback,
    retryAfterMs: extractRetryAfter(message),
    originalError: error,
  };
}

/**
 * Safely truncates a string without cutting in the middle of multi-byte UTF-8 characters
 * Uses Array.from to properly handle grapheme clusters
 */
function safeTruncate(str: string, maxLength: number): string {
  const chars = Array.from(str);
  if (chars.length <= maxLength) {
    return str;
  }
  return chars.slice(0, maxLength).join('');
}

/**
 * Classifies a CLI spawn result
 *
 * @param result - The spawn result to classify
 * @returns Classified error with retry/fallback guidance
 */
export function classifySpawnResult(result: SpawnResult): ClassifiedError {
  // Check for timeout
  if (result.timedOut) {
    return {
      category: 'timeout',
      message: 'Process timed out',
      shouldRetry: true,
      shouldFallback: true,
      retryAfterMs: null,
      originalError: result,
    };
  }

  // Check stderr first, then exit code
  const errorText = result.stderr.length > 0 ? result.stderr : `Exit code: ${String(result.exitCode)}`;
  const category = categorizeError(errorText);
  const guidance = RETRY_GUIDANCE[category];

  return {
    category,
    message: safeTruncate(errorText, 500), // Truncate long error messages safely
    shouldRetry: guidance.shouldRetry,
    shouldFallback: guidance.shouldFallback,
    retryAfterMs: extractRetryAfter(errorText),
    originalError: result,
  };
}

/**
 * Extracts error message from various error types
 */
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object' && error !== null) {
    // Handle objects with message property
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === 'string') {
      return obj.message;
    }
    if (typeof obj.error === 'string') {
      return obj.error;
    }
    if (typeof obj.error === 'object' && obj.error !== null) {
      const nested = obj.error as Record<string, unknown>;
      if (typeof nested.message === 'string') {
        return nested.message;
      }
    }
  }
  return String(error);
}

/**
 * Categorizes an error message using pattern matching
 */
function categorizeError(message: string): ErrorCategory {
  // Check each category's patterns
  for (const [category, patterns] of Object.entries(ERROR_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        return category as ErrorCategory;
      }
    }
  }

  // Default to unknown
  return 'unknown';
}

/**
 * Extracts retry-after duration from error message
 * Looks for common patterns like "retry after X seconds"
 */
function extractRetryAfter(message: string): number | null {
  // Pattern: "retry after X seconds"
  const secondsMatch = /retry.?after\s+(\d+)\s*s/i.exec(message);
  if (secondsMatch?.[1] !== undefined) {
    return parseInt(secondsMatch[1], 10) * 1000;
  }

  // Pattern: "retry after X milliseconds" or "retry after Xms"
  const msMatch = /retry.?after\s+(\d+)\s*(?:ms|milliseconds)/i.exec(message);
  if (msMatch?.[1] !== undefined) {
    return parseInt(msMatch[1], 10);
  }

  // Pattern: "wait X seconds"
  const waitMatch = /wait\s+(\d+)\s*s/i.exec(message);
  if (waitMatch?.[1] !== undefined) {
    return parseInt(waitMatch[1], 10) * 1000;
  }

  // For rate limits without explicit retry-after, suggest 1 second
  if (/rate.?limit/i.test(message) || /too.?many.?requests/i.test(message)) {
    return 1000;
  }

  return null;
}

/**
 * Checks if an error is retryable
 */
export function isRetryable(error: ClassifiedError): boolean {
  return error.shouldRetry;
}

/**
 * Checks if fallback to another provider should be attempted
 */
export function shouldFallback(error: ClassifiedError): boolean {
  return error.shouldFallback;
}
