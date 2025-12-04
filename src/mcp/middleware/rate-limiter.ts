/**
 * Rate Limiter - Token bucket algorithm
 *
 * Prevents abuse by limiting requests per time window per client.
 */

import { logger } from '../../shared/logging/logger.js';

export interface RateLimiterOptions {
  windowMs: number;        // Time window in milliseconds
  maxRequests: number;     // Maximum requests per window
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean;     // Don't count failed requests
}

export const DEFAULT_RATE_LIMITER_OPTIONS: RateLimiterOptions = {
  windowMs: 60000,  // 1 minute
  maxRequests: 100  // 100 requests per minute
};

interface ClientRecord {
  timestamps: number[];
  blocked: boolean;
  blockUntil: number;
}

/**
 * Token Bucket Rate Limiter
 */
export class RateLimiter {
  private clients: Map<string, ClientRecord> = new Map();
  private readonly options: RateLimiterOptions;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: Partial<RateLimiterOptions> = {}) {
    this.options = { ...DEFAULT_RATE_LIMITER_OPTIONS, ...options };

    // Start cleanup interval (every 5 minutes)
    this.startCleanup();
  }

  /**
   * Check if request is allowed for client
   * @param clientId - Unique identifier for client
   * @returns true if request is allowed, false if rate limited
   */
  checkLimit(clientId: string): boolean {
    const now = Date.now();
    let client = this.clients.get(clientId);

    if (!client) {
      client = {
        timestamps: [],
        blocked: false,
        blockUntil: 0
      };
      this.clients.set(clientId, client);
    }

    // Check if client is temporarily blocked
    if (client.blocked && now < client.blockUntil) {
      logger.warn('Rate limit exceeded, client blocked', {
        clientId,
        blockUntil: new Date(client.blockUntil).toISOString()
      });
      return false;
    }

    // Reset block if expired
    if (client.blocked && now >= client.blockUntil) {
      client.blocked = false;
      client.timestamps = [];
    }

    // Remove old timestamps outside the window
    const windowStart = now - this.options.windowMs;
    client.timestamps = client.timestamps.filter(ts => ts >= windowStart);

    // Check if limit exceeded
    // v6.2.11: Bug fix #38 - Guard against maxRequests = 0 causing undefined array access
    // When maxRequests is 0, timestamps.length >= 0 is always true even when empty
    // Must check timestamps has elements before accessing timestamps[0]
    if (client.timestamps.length >= this.options.maxRequests && client.timestamps.length > 0) {
      // Block client for the remainder of the window
      client.blocked = true;
      client.blockUntil = client.timestamps[0]! + this.options.windowMs;

      logger.warn('Rate limit exceeded, blocking client', {
        clientId,
        requestCount: client.timestamps.length,
        maxRequests: this.options.maxRequests,
        windowMs: this.options.windowMs,
        blockUntil: new Date(client.blockUntil).toISOString()
      });

      return false;
    }

    // Allow request and record timestamp
    client.timestamps.push(now);
    return true;
  }

  /**
   * Record successful request (optional, for accounting)
   */
  recordSuccess(clientId: string): void {
    if (this.options.skipSuccessfulRequests) {
      const client = this.clients.get(clientId);
      if (client && client.timestamps.length > 0) {
        client.timestamps.pop();
      }
    }
  }

  /**
   * Record failed request (optional, for accounting)
   */
  recordFailure(clientId: string): void {
    if (this.options.skipFailedRequests) {
      const client = this.clients.get(clientId);
      if (client && client.timestamps.length > 0) {
        client.timestamps.pop();
      }
    }
  }

  /**
   * Get remaining requests for client
   */
  getRemainingRequests(clientId: string): number {
    const client = this.clients.get(clientId);
    if (!client) {
      return this.options.maxRequests;
    }

    const now = Date.now();
    const windowStart = now - this.options.windowMs;
    const recentRequests = client.timestamps.filter(ts => ts >= windowStart);

    return Math.max(0, this.options.maxRequests - recentRequests.length);
  }

  /**
   * Get time until rate limit resets for client
   */
  getResetTime(clientId: string): number {
    const client = this.clients.get(clientId);
    if (!client || client.timestamps.length === 0) {
      return 0;
    }

    const oldestTimestamp = client.timestamps[0]!;
    const resetTime = oldestTimestamp + this.options.windowMs;
    const now = Date.now();

    return Math.max(0, resetTime - now);
  }

  /**
   * Reset rate limit for specific client
   */
  resetClient(clientId: string): void {
    this.clients.delete(clientId);
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.clients.clear();
  }

  /**
   * Get current stats
   */
  getStats(): {
    totalClients: number;
    blockedClients: number;
    activeRequests: number;
  } {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;
    let blockedClients = 0;
    let activeRequests = 0;

    for (const client of this.clients.values()) {
      if (client.blocked && now < client.blockUntil) {
        blockedClients++;
      }

      const recentRequests = client.timestamps.filter(ts => ts >= windowStart);
      activeRequests += recentRequests.length;
    }

    return {
      totalClients: this.clients.size,
      blockedClients,
      activeRequests
    };
  }

  /**
   * Start periodic cleanup of old client records
   */
  private startCleanup(): void {
    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    // Prevent process from hanging on exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Clean up old client records
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredThreshold = now - (this.options.windowMs * 2);
    let removedCount = 0;

    for (const [clientId, client] of this.clients.entries()) {
      // Remove if no recent activity and not blocked
      const hasRecentActivity = client.timestamps.some(ts => ts > expiredThreshold);
      const isActivelyBlocked = client.blocked && now < client.blockUntil;

      if (!hasRecentActivity && !isActivelyBlocked) {
        this.clients.delete(clientId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.debug('Rate limiter cleanup completed', {
        removedClients: removedCount,
        remainingClients: this.clients.size
      });
    }
  }

  /**
   * Stop cleanup interval
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

/**
 * Create rate limiter middleware for MCP server
 */
export function createRateLimiterMiddleware(
  options: Partial<RateLimiterOptions> = {}
): RateLimiter {
  return new RateLimiter(options);
}
