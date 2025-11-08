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
    baseDelay?: number;
    maxRetries?: number;
    maxDelay?: number;
    jitterFactor?: number;
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
export declare class RetryManager {
    private baseDelay;
    private maxRetries;
    private maxDelay;
    private jitterFactor;
    /**
     * Create a new retry manager
     *
     * @param config - Retry configuration
     */
    constructor(config?: RetryConfig);
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
    getNextRetryDelay(retryCount: number): number;
    /**
     * Check if should retry based on retry count
     *
     * @param retryCount - Current retry count (0-based)
     * @returns True if should retry, false if max retries exceeded
     */
    shouldRetry(retryCount: number): boolean;
    /**
     * Get the timestamp for the next retry attempt
     *
     * @param retryCount - Current retry count (0-based)
     * @returns Timestamp (milliseconds since epoch) for next retry
     */
    getNextRetryTimestamp(retryCount: number): number;
    /**
     * Get the base delay configuration
     *
     * @returns Base delay in milliseconds
     */
    getBaseDelay(): number;
    /**
     * Get the maximum retry count
     *
     * @returns Maximum number of retries
     */
    getMaxRetries(): number;
    /**
     * Get the maximum delay cap
     *
     * @returns Maximum delay in milliseconds
     */
    getMaxDelay(): number;
}
//# sourceMappingURL=RetryManager.d.ts.map