/**
 * Retry Utility - Exponential backoff retry logic
 *
 * Provides configurable retry logic with exponential backoff for transient errors.
 */

import { logger } from '../logging/logger.js';
import { sleep as safeSleep } from '../utils/safe-timers.js';

export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: Array<string | RegExp>;
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2
};

/**
 * Check if error is retryable
 */
export function isRetryableError(
  error: Error,
  retryableErrors?: Array<string | RegExp>
): boolean {
  const message = error.message.toLowerCase();

  // Default retryable errors
  const defaultRetryable = [
    /timeout/i,
    /econnreset/i,
    /econnrefused/i,
    /socket hang up/i,
    /network error/i,
    /rate limit/i,
    /too many requests/i,
    /503/,
    /502/,
    /504/
  ];

  const patterns = retryableErrors || defaultRetryable;

  return patterns.some(pattern => {
    if (typeof pattern === 'string') {
      return message.includes(pattern.toLowerCase());
    }
    return pattern.test(message);
  });
}

/**
 * Calculate delay with exponential backoff and jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number
): number {
  // Exponential backoff: initialDelay * (multiplier ^ attempt)
  const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt);

  // Add jitter (±12.5% randomness) to prevent thundering herd
  // Formula: 0.25 * [-0.5, 0.5] = [-0.125, 0.125]
  const jitter = exponentialDelay * 0.25 * (Math.random() - 0.5);
  const delayWithJitter = exponentialDelay + jitter;

  // Cap at maxDelay
  return Math.min(delayWithJitter, maxDelayMs);
}

/**
 * Sleep for specified milliseconds
 * Uses safe timer that won't prevent process exit
 */
export function sleep(ms: number): Promise<void> {
  return safeSleep(ms);
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      if (!isRetryableError(lastError, opts.retryableErrors)) {
        logger.debug('Non-retryable error, failing immediately', {
          error: lastError.message,
          attempt
        });
        throw lastError;
      }

      // Don't retry if this was the last attempt
      if (attempt === opts.maxRetries - 1) {
        logger.warn('Max retries exceeded', {
          maxRetries: opts.maxRetries,
          error: lastError.message
        });
        throw lastError;
      }

      // Calculate backoff delay
      const delayMs = calculateBackoffDelay(
        attempt,
        opts.initialDelayMs,
        opts.maxDelayMs,
        opts.backoffMultiplier
      );

      logger.info('Retrying after error', {
        attempt: attempt + 1,
        maxRetries: opts.maxRetries,
        delayMs: Math.round(delayMs),
        error: lastError.message
      });

      // Call onRetry callback if provided
      if (opts.onRetry) {
        opts.onRetry(attempt + 1, lastError, delayMs);
      }

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Retry failed with unknown error');
}

/**
 * Retry decorator for class methods
 */
export function Retry(options: Partial<RetryOptions> = {}) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      return retry(
        () => originalMethod.apply(this, args),
        options
      );
    };

    return descriptor;
  };
}

// Re-export CircuitBreaker for backward compatibility
// CircuitBreaker was extracted to its own module in v12.8.5
export {
  CircuitBreaker,
  CircuitState,
  DEFAULT_CIRCUIT_BREAKER_OPTIONS,
  type CircuitBreakerOptions
} from './circuit-breaker.js';
