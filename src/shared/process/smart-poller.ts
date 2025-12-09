/**
 * Smart Poller - Exponential backoff polling utility
 *
 * Provides intelligent polling with exponential backoff to reduce
 * unnecessary API calls and improve user experience.
 *
 * @since v8.5.2
 */

import { logger } from '../logging/logger.js';
import { sleep } from '../utils/safe-timers.js';

/**
 * Polling options
 */
export interface PollingOptions<T> {
  /**
   * Maximum number of polling attempts
   * @default 20
   */
  maxAttempts?: number;

  /**
   * Maximum total polling time in milliseconds
   * @default 600000 (10 minutes)
   */
  maxTime?: number;

  /**
   * Progress callback invoked after each attempt
   * @param attempt - Current attempt number (1-based)
   * @param elapsed - Time elapsed in milliseconds
   */
  onProgress?: (attempt: number, elapsed: number) => void;

  /**
   * Custom interval strategy (overrides default exponential backoff)
   */
  intervals?: number[];
}

/**
 * Smart Poller with Exponential Backoff
 *
 * Default intervals: [30, 15, 20, 30, 30, ...] seconds
 * - First check: 30s (let agent start)
 * - Second check: +15s (45s total)
 * - Third check: +20s (65s total)
 * - Fourth+ checks: +30s each
 *
 * @example
 * ```typescript
 * const poller = new SmartPoller();
 *
 * const result = await poller.poll(async () => {
 *   const output = await checkBashOutput(shellId);
 *   return output.status === 'completed' ? output : null;
 * });
 * ```
 */
export class SmartPoller {
  private defaultIntervals = [30, 15, 20, 30]; // seconds

  /**
   * Poll with exponential backoff
   *
   * @param checkFn - Function that returns result when complete, or null to continue
   * @param options - Polling options
   * @returns Result when checkFn returns non-null value
   * @throws Error if maxAttempts or maxTime exceeded
   */
  async poll<T>(
    checkFn: () => Promise<T | null>,
    options: PollingOptions<T> = {}
  ): Promise<T> {
    const {
      maxAttempts = 20,
      maxTime = 600000, // 10 minutes
      onProgress,
      intervals = this.defaultIntervals
    } = options;

    const startTime = Date.now();
    let currentInterval = 0;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Calculate wait time for this attempt
      const intervalIndex = Math.min(currentInterval, intervals.length - 1);
      const waitTime = (intervals[intervalIndex] ?? 30) * 1000; // Convert to ms

      // Wait before checking
      logger.debug(`Smart poller: waiting ${waitTime}ms before attempt ${attempt + 1}`);
      await sleep(waitTime);

      // Check elapsed time
      const elapsed = Date.now() - startTime;
      if (elapsed > maxTime) {
        throw new Error(
          `Polling timeout: exceeded maxTime of ${maxTime}ms after ${attempt + 1} attempts`
        );
      }

      // Call progress callback
      if (onProgress) {
        try {
          onProgress(attempt + 1, elapsed);
        } catch (error) {
          logger.warn('Progress callback failed', {
            attempt: attempt + 1,
            error: (error as Error).message
          });
        }
      }

      // Check for completion
      try {
        const result = await checkFn();
        if (result !== null) {
          logger.debug(`Smart poller: completed after ${attempt + 1} attempts (${elapsed}ms)`);
          return result;
        }
      } catch (error) {
        logger.warn('Check function failed', {
          attempt: attempt + 1,
          error: (error as Error).message
        });
        // Continue polling on error (unless it's a terminal error)
      }

      // Move to next interval
      currentInterval++;
    }

    throw new Error(
      `Polling timeout: max attempts (${maxAttempts}) reached without completion`
    );
  }

  /**
   * Create poller with custom intervals
   *
   * @param intervals - Array of wait times in seconds
   * @returns New SmartPoller instance
   */
  static withIntervals(intervals: number[]): SmartPoller {
    const poller = new SmartPoller();
    poller.defaultIntervals = intervals;
    return poller;
  }
}

/**
 * Simple wait utility (no polling, just wait)
 *
 * @param ms - Milliseconds to wait
 * @returns Promise that resolves after specified time
 */
export async function wait(ms: number): Promise<void> {
  return sleep(ms);
}

/**
 * Wait for condition with timeout
 *
 * @param conditionFn - Function that returns true when condition met
 * @param options - Polling options
 * @returns True when condition met
 * @throws Error if timeout exceeded
 */
export async function waitFor(
  conditionFn: () => Promise<boolean> | boolean,
  options: PollingOptions<boolean> = {}
): Promise<boolean> {
  const poller = new SmartPoller();
  return poller.poll(async () => {
    const result = await conditionFn();
    return result ? true : null;
  }, options);
}
