/**
 * MCP Tool Rate Limiter Middleware
 *
 * Implements rate limiting for MCP tools using a sliding window algorithm
 * with token bucket for burst handling.
 *
 * Invariants enforced:
 * - INV-MCP-006: Rate limits enforced per tool
 * - INV-MCP-007: RATE_LIMITED errors include retryAfter
 * - INV-RL-001: Rate limits are enforced per tool
 * - INV-RL-002: Exceeded limits return RATE_LIMITED error with retryAfter
 * - INV-RL-003: Limits are configurable without code changes
 * - INV-RL-004: Read tools have higher limits than mutation tools
 */

import type {
  RateLimitConfig,
  RateLimitResult,
  RateLimitError,
  McpRateLimitToolCategory as ToolCategory,
} from '@automatosx/contracts';
import {
  getToolCategory,
  getDefaultRateLimit,
  createRateLimitError,
} from '@automatosx/contracts';

/**
 * Internal state for tracking rate limits per tool
 */
interface RateLimitBucket {
  /** Tokens available (for burst) */
  tokens: number;

  /** Last refill timestamp */
  lastRefill: number;

  /** Request count in current minute window */
  minuteCount: number;

  /** Minute window start timestamp */
  minuteStart: number;
}

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Whether rate limiting is enabled globally */
  enabled: boolean;

  /** Custom limits per tool (overrides defaults) */
  customLimits: Map<string, RateLimitConfig>;

  /** Custom limits per category (overrides defaults) */
  categoryLimits: Map<ToolCategory, RateLimitConfig>;
}

/**
 * Rate Limiter for MCP Tools
 *
 * Uses a combination of:
 * 1. Token bucket for burst handling
 * 2. Sliding window for requests-per-minute tracking
 */
export class RateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private config: RateLimiterConfig;

  constructor(config?: Partial<RateLimiterConfig>) {
    this.config = {
      enabled: config?.enabled ?? true,
      customLimits: config?.customLimits ?? new Map(),
      categoryLimits: config?.categoryLimits ?? new Map(),
    };
  }

  /**
   * Gets the effective rate limit for a tool
   * Priority: customLimits > categoryLimits > DEFAULT_RATE_LIMITS
   */
  getLimit(toolName: string): RateLimitConfig {
    // Check custom tool-specific limit
    const customLimit = this.config.customLimits.get(toolName);
    if (customLimit !== undefined) {
      return customLimit;
    }

    // Check category limit
    const category = getToolCategory(toolName);
    const categoryLimit = this.config.categoryLimits.get(category);
    if (categoryLimit !== undefined) {
      return categoryLimit;
    }

    // Fall back to default
    return getDefaultRateLimit(toolName);
  }

  /**
   * Checks if a tool call is allowed under rate limits
   * INV-RL-001: Rate limits are enforced per tool
   */
  check(toolName: string): RateLimitResult {
    // If rate limiting is disabled, always allow
    if (!this.config.enabled) {
      const limit = this.getLimit(toolName);
      return {
        allowed: true,
        remaining: limit.rpm,
        resetIn: 0,
        limit,
      };
    }

    const limit = this.getLimit(toolName);

    // If tool-specific rate limiting is disabled, allow
    if (!limit.enabled) {
      return {
        allowed: true,
        remaining: limit.rpm,
        resetIn: 0,
        limit,
      };
    }

    const now = Date.now();
    const bucket = this.getOrCreateBucket(toolName, limit, now);

    // Refill tokens based on time elapsed
    this.refillTokens(bucket, limit, now);

    // Check minute window
    const minuteElapsed = now - bucket.minuteStart;
    if (minuteElapsed >= 60000) {
      // Reset minute window
      bucket.minuteCount = 0;
      bucket.minuteStart = now;
    }

    // Calculate remaining and reset time
    const remaining = Math.max(0, limit.rpm - bucket.minuteCount);
    const resetIn = Math.ceil((60000 - (now - bucket.minuteStart)) / 1000);

    // Check if request is allowed
    // Must have both: tokens available AND not exceeded RPM
    if (bucket.tokens < 1 || bucket.minuteCount >= limit.rpm) {
      // INV-RL-002: Return retryAfter
      // Guard against division by zero when rpm is 0 (rate limiting disabled at limit level)
      const tokenRefillTime = limit.rpm > 0
        ? Math.ceil((1 / (limit.rpm / 60)) * 1000) / 1000 // Time for 1 token
        : 60; // Default to 60 seconds if rpm is 0
      const retryAfter = bucket.tokens < 1
        ? tokenRefillTime
        : resetIn;

      return {
        allowed: false,
        remaining,
        resetIn,
        retryAfter: Math.ceil(retryAfter),
        limit,
      };
    }

    return {
      allowed: true,
      remaining: remaining - 1, // Account for this request
      resetIn,
      limit,
    };
  }

  /**
   * Consumes a rate limit token for a tool
   * Call this after check() returns allowed: true and before executing the tool
   */
  consume(toolName: string): void {
    const bucket = this.buckets.get(toolName);
    if (bucket !== undefined) {
      bucket.tokens = Math.max(0, bucket.tokens - 1);
      bucket.minuteCount++;
    }
  }

  /**
   * Checks and consumes in one operation
   * Returns the check result, and if allowed, also consumes the token
   */
  checkAndConsume(toolName: string): RateLimitResult {
    const result = this.check(toolName);
    if (result.allowed) {
      this.consume(toolName);
    }
    return result;
  }

  /**
   * Creates a rate limit error for rejected requests
   * INV-MCP-007: RATE_LIMITED errors include retryAfter
   */
  createError(toolName: string, result: RateLimitResult): RateLimitError {
    return createRateLimitError(
      toolName,
      result.retryAfter ?? 60,
      result.limit.rpm
    );
  }

  /**
   * Updates rate limiter configuration
   * INV-RL-003: Limits are configurable without code changes
   */
  configure(config: Partial<RateLimiterConfig>): void {
    if (config.enabled !== undefined) {
      this.config.enabled = config.enabled;
    }
    if (config.customLimits !== undefined) {
      this.config.customLimits = config.customLimits;
    }
    if (config.categoryLimits !== undefined) {
      this.config.categoryLimits = config.categoryLimits;
    }
  }

  /**
   * Sets a custom limit for a specific tool
   */
  setToolLimit(toolName: string, limit: RateLimitConfig): void {
    this.config.customLimits.set(toolName, limit);
  }

  /**
   * Sets a custom limit for a category
   */
  setCategoryLimit(category: ToolCategory, limit: RateLimitConfig): void {
    this.config.categoryLimits.set(category, limit);
  }

  /**
   * Removes custom limit for a tool (reverts to category/default)
   */
  removeToolLimit(toolName: string): void {
    this.config.customLimits.delete(toolName);
  }

  /**
   * Gets current state for a tool (for debugging/monitoring)
   */
  getState(toolName: string): {
    bucket: RateLimitBucket | undefined;
    limit: RateLimitConfig;
    category: ToolCategory;
  } {
    return {
      bucket: this.buckets.get(toolName),
      limit: this.getLimit(toolName),
      category: getToolCategory(toolName),
    };
  }

  /**
   * Resets rate limit state for a tool
   */
  reset(toolName: string): void {
    this.buckets.delete(toolName);
  }

  /**
   * Resets all rate limit state
   */
  resetAll(): void {
    this.buckets.clear();
  }

  /**
   * Checks if rate limiting is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Gets or creates a bucket for a tool
   */
  private getOrCreateBucket(
    toolName: string,
    limit: RateLimitConfig,
    now: number
  ): RateLimitBucket {
    let bucket = this.buckets.get(toolName);

    if (bucket === undefined) {
      bucket = {
        tokens: limit.burst,
        lastRefill: now,
        minuteCount: 0,
        minuteStart: now,
      };
      this.buckets.set(toolName, bucket);
    }

    return bucket;
  }

  /**
   * Refills tokens based on elapsed time
   * Uses token bucket algorithm: tokens refill at rate of rpm/60 per second
   */
  private refillTokens(
    bucket: RateLimitBucket,
    limit: RateLimitConfig,
    now: number
  ): void {
    const elapsed = now - bucket.lastRefill;
    const refillRate = limit.rpm / 60000; // Tokens per millisecond
    const tokensToAdd = elapsed * refillRate;

    bucket.tokens = Math.min(limit.burst, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }
}

/**
 * Global rate limiter instance
 */
let globalRateLimiter: RateLimiter | null = null;

/**
 * Gets the global rate limiter instance (singleton)
 */
export function getRateLimiter(): RateLimiter {
  if (globalRateLimiter === null) {
    globalRateLimiter = new RateLimiter();
  }
  return globalRateLimiter;
}

/**
 * Sets the global rate limiter instance (for testing)
 */
export function setRateLimiter(limiter: RateLimiter): void {
  globalRateLimiter = limiter;
}

/**
 * Resets the global rate limiter (for testing)
 */
export function resetRateLimiter(): void {
  if (globalRateLimiter !== null) {
    globalRateLimiter.resetAll();
  }
}
