/**
 * Safe Timer Utilities
 *
 * Provides safe wrappers around Node.js timers that:
 * - Automatically call .unref() to prevent blocking process exit
 * - Properly clean up in both success and error paths
 * - Support AbortSignal for cancellation
 *
 * @module shared/utils/safe-timers
 * @since v12.4.0
 */

import { logger } from '../logging/logger.js';

/**
 * Options for safe interval creation
 */
export interface SafeIntervalOptions {
  /** Whether to keep the process alive (default: false, calls .unref()) */
  ref?: boolean;
  /** Name for logging/debugging purposes */
  name?: string;
  /** AbortSignal for external cancellation */
  signal?: AbortSignal;
  /** Run callback immediately before starting interval (default: false) */
  immediate?: boolean;
}

/**
 * Options for safe timeout creation
 */
export interface SafeTimeoutOptions {
  /** Whether to keep the process alive (default: false, calls .unref()) */
  ref?: boolean;
  /** Name for logging/debugging purposes */
  name?: string;
  /** AbortSignal for external cancellation */
  signal?: AbortSignal;
}

/**
 * Options for withTimeout wrapper
 */
export interface WithTimeoutOptions {
  /** Custom error message on timeout */
  message?: string;
  /** Name for logging/debugging purposes */
  name?: string;
}

/**
 * Create a safe interval that:
 * - Automatically calls .unref() by default (won't block process exit)
 * - Returns a cleanup function
 * - Supports AbortSignal for cancellation
 *
 * @param callback - Function to call on each interval tick
 * @param intervalMs - Interval duration in milliseconds
 * @param options - Configuration options
 * @returns Cleanup function to stop the interval
 *
 * @example
 * ```typescript
 * // Basic usage
 * const cleanup = createSafeInterval(() => {
 *   console.log('tick');
 * }, 1000);
 *
 * // Later, clean up
 * cleanup();
 *
 * // With options
 * const cleanup = createSafeInterval(
 *   () => checkHealth(),
 *   30000,
 *   { name: 'health-check', immediate: true }
 * );
 * ```
 */
export function createSafeInterval(
  callback: () => void | Promise<void>,
  intervalMs: number,
  options: SafeIntervalOptions = {}
): () => void {
  const { ref = false, name, signal, immediate = false } = options;

  // Check if already aborted
  if (signal?.aborted) {
    logger.debug('createSafeInterval: already aborted', { name });
    return () => {}; // No-op cleanup
  }

  let cleared = false;
  let intervalId: NodeJS.Timeout | null = null;

  // Wrapper to handle async callbacks safely
  const safeCallback = async (): Promise<void> => {
    if (cleared) return;

    try {
      await callback();
    } catch (error) {
      logger.error('Safe interval callback error', {
        name,
        error: (error as Error).message
      });
    }
  };

  // Run immediately if requested
  if (immediate) {
    // Use setImmediate to ensure cleanup function is available before callback runs
    setImmediate(() => {
      if (!cleared) {
        safeCallback();
      }
    });
  }

  // Create the interval
  intervalId = setInterval(safeCallback, intervalMs);

  // Unref by default to prevent blocking process exit
  if (!ref && intervalId.unref) {
    intervalId.unref();
  }

  // Cleanup function
  const cleanup = (): void => {
    if (cleared) return;
    cleared = true;

    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;

      logger.debug('Safe interval cleared', { name });
    }
  };

  // Handle AbortSignal
  if (signal) {
    signal.addEventListener('abort', cleanup, { once: true });
  }

  logger.debug('Safe interval created', {
    name,
    intervalMs,
    ref,
    immediate
  });

  return cleanup;
}

/**
 * Create a safe timeout that:
 * - Automatically calls .unref() by default (won't block process exit)
 * - Returns a cleanup function
 * - Supports AbortSignal for cancellation
 *
 * @param callback - Function to call when timeout fires
 * @param delayMs - Delay duration in milliseconds
 * @param options - Configuration options
 * @returns Cleanup function to cancel the timeout
 *
 * @example
 * ```typescript
 * // Basic usage
 * const cancel = createSafeTimeout(() => {
 *   console.log('timeout fired');
 * }, 5000);
 *
 * // Cancel if needed
 * cancel();
 * ```
 */
export function createSafeTimeout(
  callback: () => void | Promise<void>,
  delayMs: number,
  options: SafeTimeoutOptions = {}
): () => void {
  const { ref = false, name, signal } = options;

  // Check if already aborted
  if (signal?.aborted) {
    logger.debug('createSafeTimeout: already aborted', { name });
    return () => {}; // No-op cleanup
  }

  let cleared = false;
  let timeoutId: NodeJS.Timeout | null = null;

  // Wrapper to handle async callbacks safely
  const safeCallback = async (): Promise<void> => {
    if (cleared) return;
    cleared = true;

    try {
      await callback();
    } catch (error) {
      logger.error('Safe timeout callback error', {
        name,
        error: (error as Error).message
      });
    }
  };

  // Create the timeout
  timeoutId = setTimeout(safeCallback, delayMs);

  // Unref by default to prevent blocking process exit
  if (!ref && timeoutId.unref) {
    timeoutId.unref();
  }

  // Cleanup function
  const cleanup = (): void => {
    if (cleared) return;
    cleared = true;

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;

      logger.debug('Safe timeout cleared', { name });
    }
  };

  // Handle AbortSignal
  if (signal) {
    signal.addEventListener('abort', cleanup, { once: true });
  }

  logger.debug('Safe timeout created', {
    name,
    delayMs,
    ref
  });

  return cleanup;
}

/**
 * Custom error class for timeout errors
 */
export class SafeTimerTimeoutError extends Error {
  constructor(message: string, public readonly timeoutMs: number) {
    super(message);
    this.name = 'SafeTimerTimeoutError';
  }
}

/**
 * Wrap a promise with a timeout.
 *
 * Properly clears the timeout in BOTH success and error paths to prevent
 * resource leaks. This is the correct pattern for promise timeouts.
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout duration in milliseconds
 * @param options - Configuration options
 * @returns Promise that rejects with TimeoutError if timeout exceeded
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = await withTimeout(
 *   fetch('https://api.example.com/data'),
 *   5000
 * );
 *
 * // With custom message
 * const result = await withTimeout(
 *   longRunningOperation(),
 *   30000,
 *   { message: 'Operation timed out', name: 'long-op' }
 * );
 * ```
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  options: WithTimeoutOptions = {}
): Promise<T> {
  const { message, name } = options;

  let timeoutId: NodeJS.Timeout | null = null;
  let settled = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      if (!settled) {
        const errorMessage = message || `Operation timed out after ${timeoutMs}ms`;
        reject(new SafeTimerTimeoutError(errorMessage, timeoutMs));
      }
    }, timeoutMs);

    // Unref to prevent blocking process exit
    if (timeoutId.unref) {
      timeoutId.unref();
    }
  });

  // Cleanup function - CRITICAL: must be called in both success and error paths
  const cleanup = (): void => {
    settled = true;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  try {
    // Race between the original promise and timeout
    const result = await Promise.race([promise, timeoutPromise]);

    // SUCCESS PATH: Clean up timeout
    cleanup();

    logger.debug('withTimeout: completed successfully', { name, timeoutMs });
    return result;
  } catch (error) {
    // ERROR PATH: Clean up timeout (prevents leak!)
    cleanup();

    logger.debug('withTimeout: error or timeout', {
      name,
      timeoutMs,
      isTimeout: error instanceof SafeTimerTimeoutError,
      error: (error as Error).message
    });

    throw error;
  }
}

/**
 * Create a deferred promise with timeout support.
 *
 * Useful for creating promises that can be resolved/rejected externally
 * with automatic timeout handling.
 *
 * @param timeoutMs - Timeout duration in milliseconds
 * @param options - Configuration options
 * @returns Object with promise, resolve, reject, and cancel functions
 *
 * @example
 * ```typescript
 * const deferred = createDeferredWithTimeout<string>(5000);
 *
 * // Later, resolve it
 * deferred.resolve('success');
 *
 * // Or cancel it
 * deferred.cancel();
 *
 * // Await the result
 * const result = await deferred.promise;
 * ```
 */
export function createDeferredWithTimeout<T>(
  timeoutMs: number,
  options: WithTimeoutOptions = {}
): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  cancel: () => void;
} {
  const { message, name } = options;

  let timeoutId: NodeJS.Timeout | null = null;
  let settled = false;
  let resolvePromise: (value: T) => void;
  let rejectPromise: (error: Error) => void;

  const cleanup = (): void => {
    settled = true;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;

    timeoutId = setTimeout(() => {
      if (!settled) {
        cleanup();
        const errorMessage = message || `Deferred timed out after ${timeoutMs}ms`;
        reject(new SafeTimerTimeoutError(errorMessage, timeoutMs));
      }
    }, timeoutMs);

    // Unref to prevent blocking process exit
    if (timeoutId.unref) {
      timeoutId.unref();
    }
  });

  logger.debug('Deferred with timeout created', { name, timeoutMs });

  return {
    promise,
    resolve: (value: T): void => {
      if (!settled) {
        cleanup();
        resolvePromise(value);
        logger.debug('Deferred resolved', { name });
      }
    },
    reject: (error: Error): void => {
      if (!settled) {
        cleanup();
        rejectPromise(error);
        logger.debug('Deferred rejected', { name, error: error.message });
      }
    },
    cancel: (): void => {
      if (!settled) {
        cleanup();
        rejectPromise(new Error('Deferred cancelled'));
        logger.debug('Deferred cancelled', { name });
      }
    }
  };
}

/**
 * Sleep for a specified duration with cancellation support.
 *
 * @param ms - Sleep duration in milliseconds
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise that resolves after the delay or rejects if aborted
 *
 * @example
 * ```typescript
 * // Basic sleep
 * await sleep(1000);
 *
 * // With cancellation
 * const controller = new AbortController();
 * setTimeout(() => controller.abort(), 500);
 *
 * try {
 *   await sleep(1000, controller.signal);
 * } catch (error) {
 *   console.log('Sleep was cancelled');
 * }
 * ```
 */
export async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Sleep aborted'));
      return;
    }

    const timeoutId = setTimeout(() => {
      resolve();
    }, ms);

    // Unref to prevent blocking process exit
    if (timeoutId.unref) {
      timeoutId.unref();
    }

    if (signal) {
      const abortHandler = (): void => {
        clearTimeout(timeoutId);
        reject(new Error('Sleep aborted'));
      };
      signal.addEventListener('abort', abortHandler, { once: true });
    }
  });
}
