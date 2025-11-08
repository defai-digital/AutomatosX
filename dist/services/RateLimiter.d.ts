/**
 * RateLimiter.ts
 *
 * Token bucket rate limiter for telemetry submission
 * Prevents API abuse and enforces rate limits
 */
/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
    rate: number;
    burst: number;
}
/**
 * Token bucket rate limiter
 *
 * Implements the token bucket algorithm for rate limiting:
 * - Tokens are added to the bucket at a constant rate
 * - Each event consumes one token
 * - Bucket has a maximum capacity (burst size)
 * - If bucket is empty, requests are rejected
 *
 * Features:
 * - Smooth rate limiting over time
 * - Allows controlled bursts
 * - Automatic token refill
 * - Thread-safe (single-threaded JavaScript)
 *
 * Example:
 * - Rate: 60 events/minute = 1 event/second
 * - Burst: 10 events
 * - Can submit 10 events immediately, then 1 event/second
 */
export declare class RateLimiter {
    private tokens;
    private lastRefill;
    private readonly rate;
    private readonly burst;
    /**
     * Create a new rate limiter
     *
     * @param config - Rate limiter configuration
     */
    constructor(config: RateLimiterConfig);
    /**
     * Refill tokens based on elapsed time
     *
     * Tokens are added at the configured rate.
     * Bucket cannot exceed burst capacity.
     *
     * @private
     */
    private refill;
    /**
     * Check if N events can be submitted without consuming tokens
     *
     * @param count - Number of events to check
     * @returns True if sufficient tokens available
     */
    canSubmit(count: number): boolean;
    /**
     * Consume tokens for N events
     *
     * Attempts to consume the specified number of tokens.
     * If insufficient tokens available, no tokens are consumed.
     *
     * @param count - Number of tokens to consume
     * @returns True if tokens were consumed, false if insufficient
     */
    consume(count: number): boolean;
    /**
     * Get time (in milliseconds) until next token is available
     *
     * Useful for implementing backoff when rate limited.
     *
     * @returns Milliseconds until next token, or 0 if tokens available
     */
    getWaitTime(): number;
    /**
     * Get current token count
     *
     * @returns Current number of tokens available
     */
    getAvailableTokens(): number;
    /**
     * Get rate limit configuration
     *
     * @returns Events per minute
     */
    getRate(): number;
    /**
     * Get burst capacity
     *
     * @returns Maximum burst size
     */
    getBurst(): number;
    /**
     * Reset rate limiter to initial state
     *
     * Useful for testing or when rate limits change
     */
    reset(): void;
}
//# sourceMappingURL=RateLimiter.d.ts.map