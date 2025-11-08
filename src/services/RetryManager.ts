/**
 * RetryManager.ts
 *
 * Exponential backoff retry logic for telemetry submission
 * Implements smart retry delays with jitter to prevent thundering herd
 */

/**
 * Retry configuration
 */
export interface RetryConfig {
  baseDelay?: number; // Base delay in milliseconds (default: 1000ms)
  maxRetries?: number; // Maximum retry attempts (default: 5)
  maxDelay?: number; // Maximum delay cap in milliseconds (default: 1 hour)
  jitterFactor?: number; // Jitter as fraction of delay (default: 0.25 = ±25%)
}

/**
 * Manages retry timing with exponential backoff
 *
 * Features:
 * - Exponential backoff: delay = 2^retryCount * baseDelay
 * - Jitter to prevent thundering herd problem
 * - Configurable max retries and delay cap
 * - Simple, deterministic algorithm
 *
 * Example backoff schedule (default config):
 * - Retry 0: 1s (±250ms)
 * - Retry 1: 2s (±500ms)
 * - Retry 2: 4s (±1s)
 * - Retry 3: 8s (±2s)
 * - Retry 4: 16s (±4s)
 * - Retry 5+: Stops retrying
 */
export class RetryManager {
  private baseDelay: number;
  private maxRetries: number;
  private maxDelay: number;
  private jitterFactor: number;

  /**
   * Create a new retry manager
   *
   * @param config - Retry configuration
   */
  constructor(config?: RetryConfig) {
    this.baseDelay = config?.baseDelay ?? 1000; // 1 second
    this.maxRetries = config?.maxRetries ?? 5;
    this.maxDelay = config?.maxDelay ?? 3600000; // 1 hour
    this.jitterFactor = config?.jitterFactor ?? 0.25; // ±25%
  }

  /**
   * Calculate the next retry delay in milliseconds
   *
   * Uses exponential backoff with jitter:
   * delay = min(2^retryCount * baseDelay, maxDelay)
   * jitter = delay * jitterFactor * (random between -0.5 and 0.5)
   *
   * @param retryCount - Current retry count (0-based)
   * @returns Delay in milliseconds until next retry
   */
  getNextRetryDelay(retryCount: number): number {
    // Exponential backoff: 2^retryCount * baseDelay
    const exponentialDelay = Math.pow(2, retryCount) * this.baseDelay;

    // Cap delay at maxDelay
    const cappedDelay = Math.min(exponentialDelay, this.maxDelay);

    // Add jitter (random variation between -jitterFactor and +jitterFactor)
    // This prevents thundering herd when many clients retry simultaneously
    const jitter = cappedDelay * this.jitterFactor * (Math.random() - 0.5) * 2;

    // Ensure delay is always positive
    const finalDelay = Math.max(0, cappedDelay + jitter);

    return Math.floor(finalDelay);
  }

  /**
   * Check if should retry based on retry count
   *
   * @param retryCount - Current retry count (0-based)
   * @returns True if should retry, false if max retries exceeded
   */
  shouldRetry(retryCount: number): boolean {
    return retryCount < this.maxRetries;
  }

  /**
   * Get the timestamp for the next retry attempt
   *
   * @param retryCount - Current retry count (0-based)
   * @returns Timestamp (milliseconds since epoch) for next retry
   */
  getNextRetryTimestamp(retryCount: number): number {
    const delay = this.getNextRetryDelay(retryCount);
    return Date.now() + delay;
  }

  /**
   * Get the base delay configuration
   *
   * @returns Base delay in milliseconds
   */
  getBaseDelay(): number {
    return this.baseDelay;
  }

  /**
   * Get the maximum retry count
   *
   * @returns Maximum number of retries
   */
  getMaxRetries(): number {
    return this.maxRetries;
  }

  /**
   * Get the maximum delay cap
   *
   * @returns Maximum delay in milliseconds
   */
  getMaxDelay(): number {
    return this.maxDelay;
  }
}
