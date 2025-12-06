/**
 * Task Rate Limiter
 *
 * Per-client rate limiting using token bucket algorithm.
 * Prevents any single client from overwhelming the Task Engine.
 *
 * Features:
 * - Token bucket per client
 * - Configurable tokens/minute and max concurrent
 * - Automatic bucket cleanup for inactive clients
 * - Statistics tracking
 *
 * Part of Phase 4: Production Hardening
 *
 * @module core/task-engine/rate-limiter
 * @version 1.0.0
 */

import { logger } from '../../shared/logging/logger.js';

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum tokens per minute per client (default: 100) */
  tokensPerMinute?: number;
  /** Maximum concurrent tasks per client (default: 10) */
  maxConcurrentPerClient?: number;
  /** Bucket cleanup interval in ms (default: 60000) */
  cleanupIntervalMs?: number;
  /** Inactive bucket TTL in ms (default: 300000 = 5 minutes) */
  inactiveTtlMs?: number;
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Milliseconds to wait before retrying (if not allowed) */
  retryAfterMs?: number;
  /** Remaining tokens */
  remainingTokens: number;
  /** Current concurrent tasks for this client */
  currentConcurrent: number;
  /** Reason for rejection (if not allowed) */
  reason?: 'TOKEN_EXHAUSTED' | 'CONCURRENT_LIMIT' | 'CLIENT_BLOCKED';
}

/**
 * Rate limiter statistics
 */
export interface RateLimiterStats {
  /** Total requests checked */
  totalRequests: number;
  /** Requests allowed */
  allowedRequests: number;
  /** Requests rejected */
  rejectedRequests: number;
  /** Active client buckets */
  activeBuckets: number;
  /** Rejection rate (0-1) */
  rejectionRate: number;
}

/**
 * Token bucket for a single client
 */
interface TokenBucket {
  /** Available tokens */
  tokens: number;
  /** Last refill timestamp */
  lastRefillAt: number;
  /** Current concurrent tasks */
  concurrent: number;
  /** Last activity timestamp */
  lastActivityAt: number;
  /** Whether client is temporarily blocked */
  blocked: boolean;
  /** Block expires at (if blocked) */
  blockExpiresAt?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<RateLimiterConfig> = {
  tokensPerMinute: 100,
  maxConcurrentPerClient: 10,
  cleanupIntervalMs: 60000,
  inactiveTtlMs: 300000
};

/**
 * TaskRateLimiter - Per-client rate limiting
 *
 * @example
 * ```typescript
 * const limiter = new TaskRateLimiter({
 *   tokensPerMinute: 100,
 *   maxConcurrentPerClient: 10
 * });
 *
 * // Before executing a task
 * const result = limiter.checkLimit('client-123');
 * if (!result.allowed) {
 *   throw new Error(`Rate limited. Retry after ${result.retryAfterMs}ms`);
 * }
 *
 * // Track concurrent task start
 * limiter.trackStart('client-123');
 *
 * // After task completes
 * limiter.trackComplete('client-123');
 * ```
 */
export class TaskRateLimiter {
  private readonly config: Required<RateLimiterConfig>;
  private readonly buckets = new Map<string, TokenBucket>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  // Statistics
  private stats = {
    totalRequests: 0,
    allowedRequests: 0,
    rejectedRequests: 0
  };

  // Derived values
  private readonly tokensPerMs: number;

  constructor(config: RateLimiterConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tokensPerMs = this.config.tokensPerMinute / 60000;

    // Start cleanup timer
    this.startCleanupTimer();

    logger.debug('[TaskRateLimiter] Initialized', {
      tokensPerMinute: this.config.tokensPerMinute,
      maxConcurrentPerClient: this.config.maxConcurrentPerClient
    });
  }

  /**
   * Check if a request is allowed for a client
   */
  checkLimit(clientId: string): RateLimitResult {
    this.stats.totalRequests++;

    const bucket = this.getOrCreateBucket(clientId);
    this.refillBucket(bucket);

    // Check if blocked
    if (bucket.blocked) {
      if (bucket.blockExpiresAt && Date.now() >= bucket.blockExpiresAt) {
        bucket.blocked = false;
        bucket.blockExpiresAt = undefined;
      } else {
        this.stats.rejectedRequests++;
        return {
          allowed: false,
          retryAfterMs: bucket.blockExpiresAt ? bucket.blockExpiresAt - Date.now() : 60000,
          remainingTokens: 0,
          currentConcurrent: bucket.concurrent,
          reason: 'CLIENT_BLOCKED'
        };
      }
    }

    // Check concurrent limit
    if (bucket.concurrent >= this.config.maxConcurrentPerClient) {
      this.stats.rejectedRequests++;
      return {
        allowed: false,
        retryAfterMs: 1000, // Retry after 1 second
        remainingTokens: Math.floor(bucket.tokens),
        currentConcurrent: bucket.concurrent,
        reason: 'CONCURRENT_LIMIT'
      };
    }

    // Check token availability
    if (bucket.tokens < 1) {
      this.stats.rejectedRequests++;
      const msUntilToken = Math.ceil((1 - bucket.tokens) / this.tokensPerMs);
      return {
        allowed: false,
        retryAfterMs: msUntilToken,
        remainingTokens: 0,
        currentConcurrent: bucket.concurrent,
        reason: 'TOKEN_EXHAUSTED'
      };
    }

    // Consume token
    bucket.tokens -= 1;
    bucket.lastActivityAt = Date.now();
    this.stats.allowedRequests++;

    return {
      allowed: true,
      remainingTokens: Math.floor(bucket.tokens),
      currentConcurrent: bucket.concurrent
    };
  }

  /**
   * Atomically check limit and acquire a slot if allowed.
   * This prevents race conditions between checkLimit() and trackStart().
   * If allowed, the concurrent count is already incremented.
   * Caller MUST call trackComplete() when the task finishes.
   */
  acquireSlot(clientId: string): RateLimitResult {
    const result = this.checkLimit(clientId);
    if (result.allowed) {
      // Atomically increment concurrent count since check passed
      const bucket = this.buckets.get(clientId);
      if (bucket) {
        bucket.concurrent++;
        // Update the result to reflect the new concurrent count
        return {
          ...result,
          currentConcurrent: bucket.concurrent
        };
      }
    }
    return result;
  }

  /**
   * Track task start for concurrent counting.
   * Use this with checkLimit() for the traditional two-step approach.
   * For race-condition-free code, use acquireSlot() instead which
   * atomically checks and increments in one call.
   */
  trackStart(clientId: string): void {
    const bucket = this.getOrCreateBucket(clientId);
    bucket.concurrent++;
    bucket.lastActivityAt = Date.now();
  }

  /**
   * Track task completion for concurrent counting
   */
  trackComplete(clientId: string): void {
    const bucket = this.buckets.get(clientId);
    if (bucket && bucket.concurrent > 0) {
      bucket.concurrent--;
      bucket.lastActivityAt = Date.now();
    }
  }

  /**
   * Temporarily block a client
   */
  blockClient(clientId: string, durationMs: number): void {
    const bucket = this.getOrCreateBucket(clientId);
    bucket.blocked = true;
    bucket.blockExpiresAt = Date.now() + durationMs;

    logger.warn('[TaskRateLimiter] Client blocked', {
      clientId,
      durationMs
    });
  }

  /**
   * Unblock a client
   */
  unblockClient(clientId: string): void {
    const bucket = this.buckets.get(clientId);
    if (bucket) {
      bucket.blocked = false;
      bucket.blockExpiresAt = undefined;
    }
  }

  /**
   * Get rate limiter statistics
   */
  getStats(): RateLimiterStats {
    const total = this.stats.totalRequests;
    return {
      totalRequests: this.stats.totalRequests,
      allowedRequests: this.stats.allowedRequests,
      rejectedRequests: this.stats.rejectedRequests,
      activeBuckets: this.buckets.size,
      rejectionRate: total > 0 ? this.stats.rejectedRequests / total : 0
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      rejectedRequests: 0
    };
  }

  /**
   * Get client status
   */
  getClientStatus(clientId: string): {
    exists: boolean;
    tokens: number;
    concurrent: number;
    blocked: boolean;
  } {
    const bucket = this.buckets.get(clientId);
    if (!bucket) {
      return { exists: false, tokens: 0, concurrent: 0, blocked: false };
    }

    this.refillBucket(bucket);
    return {
      exists: true,
      tokens: Math.floor(bucket.tokens),
      concurrent: bucket.concurrent,
      blocked: bucket.blocked
    };
  }

  /**
   * Shutdown rate limiter
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.buckets.clear();
    logger.debug('[TaskRateLimiter] Shutdown complete');
  }

  /**
   * Get or create a bucket for a client
   */
  private getOrCreateBucket(clientId: string): TokenBucket {
    let bucket = this.buckets.get(clientId);
    if (!bucket) {
      bucket = {
        tokens: this.config.tokensPerMinute,
        lastRefillAt: Date.now(),
        concurrent: 0,
        lastActivityAt: Date.now(),
        blocked: false
      };
      this.buckets.set(clientId, bucket);
    }
    return bucket;
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillBucket(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsed = now - bucket.lastRefillAt;
    const tokensToAdd = elapsed * this.tokensPerMs;

    bucket.tokens = Math.min(
      this.config.tokensPerMinute,
      bucket.tokens + tokensToAdd
    );
    bucket.lastRefillAt = now;
  }

  /**
   * Start cleanup timer for inactive buckets
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupInactiveBuckets();
    }, this.config.cleanupIntervalMs);

    // Don't prevent process exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Remove inactive buckets to prevent memory growth
   */
  private cleanupInactiveBuckets(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [clientId, bucket] of this.buckets) {
      // Keep buckets with active concurrent tasks
      if (bucket.concurrent > 0) {
        continue;
      }

      // Keep blocked buckets until block expires
      if (bucket.blocked && bucket.blockExpiresAt && bucket.blockExpiresAt > now) {
        continue;
      }

      // Remove inactive buckets
      if (now - bucket.lastActivityAt > this.config.inactiveTtlMs) {
        this.buckets.delete(clientId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('[TaskRateLimiter] Cleaned inactive buckets', { count: cleaned });
    }
  }
}

/**
 * Create a rate limiter instance
 */
export function createRateLimiter(config?: RateLimiterConfig): TaskRateLimiter {
  return new TaskRateLimiter(config);
}
