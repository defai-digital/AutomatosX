/**
 * Error Wrapper Utility - Standardizes error handling across the codebase
 *
 * v9.0.2: Created to reduce `any` usage and standardize error handling
 *
 * Provides type-safe error wrapping and conversion utilities.
 */

import type { BaseError } from './errors.js';

/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return String(error);
}

/**
 * Extract error stack from unknown error type
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}

/**
 * Check if error is instance of specific error class
 */
export function isErrorInstance<T extends Error>(
  error: unknown,
  ErrorClass: new (...args: any[]) => T
): error is T {
  return error instanceof ErrorClass;
}

/**
 * Wrap unknown error into typed error
 *
 * @param error - Unknown error from catch block
 * @param ErrorClass - Target error class constructor
 * @param message - Error message prefix
 * @param code - Error code
 * @param metadata - Additional metadata
 * @returns Typed error instance
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   throw wrapError(
 *     error,
 *     DatabaseError,
 *     'Failed to query database',
 *     'QUERY_ERROR'
 *   );
 * }
 * ```
 */
export function wrapError<T extends BaseError>(
  error: unknown,
  ErrorClass: new (message: string, code: string, metadata?: Record<string, unknown>) => T,
  message: string,
  code: string,
  metadata?: Record<string, unknown>
): T {
  // If already the correct error type, return as-is
  if (error instanceof ErrorClass) {
    return error;
  }

  // Extract error details
  const errorMessage = getErrorMessage(error);
  const errorStack = getErrorStack(error);

  // Create metadata with original error
  const fullMetadata: Record<string, unknown> = {
    ...metadata,
    originalError: error instanceof Error ? error.name : typeof error,
    originalMessage: errorMessage
  };

  // Create new error
  const wrappedError = new ErrorClass(
    `${message}: ${errorMessage}`,
    code,
    fullMetadata
  );

  // Preserve stack trace if available
  if (errorStack && wrappedError instanceof Error) {
    wrappedError.stack = `${wrappedError.stack}\n\nCaused by:\n${errorStack}`;
  }

  return wrappedError;
}

/**
 * Safe error handler for async operations
 *
 * @param operation - Async operation to execute
 * @param ErrorClass - Error class to wrap with
 * @param message - Error message prefix
 * @param code - Error code
 * @returns Result or throws typed error
 *
 * @example
 * ```typescript
 * const data = await safeAsync(
 *   () => fetchData(),
 *   NetworkError,
 *   'Failed to fetch data',
 *   'FETCH_ERROR'
 * );
 * ```
 */
export async function safeAsync<T, E extends BaseError>(
  operation: () => Promise<T>,
  ErrorClass: new (message: string, code: string, metadata?: Record<string, unknown>) => E,
  message: string,
  code: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw wrapError(error, ErrorClass, message, code);
  }
}

/**
 * Safe error handler for sync operations
 *
 * @param operation - Sync operation to execute
 * @param ErrorClass - Error class to wrap with
 * @param message - Error message prefix
 * @param code - Error code
 * @returns Result or throws typed error
 *
 * @example
 * ```typescript
 * const result = safeSync(
 *   () => parseJson(data),
 *   ParseError,
 *   'Failed to parse JSON',
 *   'PARSE_ERROR'
 * );
 * ```
 */
export function safeSync<T, E extends BaseError>(
  operation: () => T,
  ErrorClass: new (message: string, code: string, metadata?: Record<string, unknown>) => E,
  message: string,
  code: string
): T {
  try {
    return operation();
  } catch (error) {
    throw wrapError(error, ErrorClass, message, code);
  }
}

/**
 * Convert error to plain object for logging
 */
export function errorToObject(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...('code' in error && { code: error.code }),
      ...('metadata' in error && { metadata: error.metadata })
    };
  }

  if (error && typeof error === 'object') {
    return { ...error };
  }

  return { error: String(error) };
}

/**
 * Check if error should be retried
 *
 * Common retriable errors:
 * - Network timeouts
 * - Rate limits
 * - Temporary unavailability
 * - Database locks
 */
export function isRetriableError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();

  const retriablePatterns = [
    'timeout',
    'econnreset',
    'econnrefused',
    'rate limit',
    'too many requests',
    'temporarily unavailable',
    'service unavailable',
    'database is locked',
    'deadlock',
    'try again'
  ];

  return retriablePatterns.some(pattern => message.includes(pattern));
}

/**
 * Check if error is fatal (should not retry)
 *
 * Common fatal errors:
 * - Authentication failures
 * - Not found
 * - Invalid input
 * - Permission denied
 */
export function isFatalError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();

  const fatalPatterns = [
    'not found',
    'unauthorized',
    'forbidden',
    'invalid',
    'bad request',
    'permission denied',
    'access denied',
    'authentication failed',
    'does not exist'
  ];

  return fatalPatterns.some(pattern => message.includes(pattern));
}
