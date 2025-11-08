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
  rate: number; // Events per minute
  burst: number; // Maximum burst size (bucket capacity)
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
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly rate: number; // Tokens per millisecond
  private readonly burst: number; // Maximum tokens

  /**
   * Create a new rate limiter
   *
   * @param config - Rate limiter configuration
   */
  constructor(config: RateLimiterConfig) {
    this.burst = config.burst;
    this.tokens = config.burst; // Start with full bucket
    this.rate = config.rate / 60000; // Convert events/minute to events/ms
    this.lastRefill = Date.now();
  }

  /**
   * Refill tokens based on elapsed time
   *
   * Tokens are added at the configured rate.
   * Bucket cannot exceed burst capacity.
   *
   * @private
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;

    // Calculate tokens to add based on elapsed time
    const tokensToAdd = elapsed * this.rate;

    // Add tokens, but don't exceed burst capacity
    this.tokens = Math.min(this.burst, this.tokens + tokensToAdd);

    // Update last refill time
    this.lastRefill = now;
  }

  /**
   * Check if N events can be submitted without consuming tokens
   *
   * @param count - Number of events to check
   * @returns True if sufficient tokens available
   */
  canSubmit(count: number): boolean {
    this.refill();
    return this.tokens >= count;
  }

  /**
   * Consume tokens for N events
   *
   * Attempts to consume the specified number of tokens.
   * If insufficient tokens available, no tokens are consumed.
   *
   * @param count - Number of tokens to consume
   * @returns True if tokens were consumed, false if insufficient
   */
  consume(count: number): boolean {
    this.refill();

    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }

    return false;
  }

  /**
   * Get time (in milliseconds) until next token is available
   *
   * Useful for implementing backoff when rate limited.
   *
   * @returns Milliseconds until next token, or 0 if tokens available
   */
  getWaitTime(): number {
    this.refill();

    if (this.tokens >= 1) {
      return 0; // Tokens available now
    }

    // Calculate time needed for 1 token
    const tokensNeeded = 1 - this.tokens;
    const timeNeeded = tokensNeeded / this.rate;

    return Math.ceil(timeNeeded);
  }

  /**
   * Get current token count
   *
   * @returns Current number of tokens available
   */
  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  /**
   * Get rate limit configuration
   *
   * @returns Events per minute
   */
  getRate(): number {
    return this.rate * 60000; // Convert back to events/minute
  }

  /**
   * Get burst capacity
   *
   * @returns Maximum burst size
   */
  getBurst(): number {
    return this.burst;
  }

  /**
   * Reset rate limiter to initial state
   *
   * Useful for testing or when rate limits change
   */
  reset(): void {
    this.tokens = this.burst;
    this.lastRefill = Date.now();
  }
}
