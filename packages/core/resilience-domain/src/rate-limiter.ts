/**
 * Rate Limiter Implementation
 *
 * Token bucket rate limiting to prevent API limit violations.
 */

import {
  type RateLimiterConfig,
  type RateLimiterStats,
  type RateLimiterAcquireResult,
  RateLimiterErrorCodes,
  createDefaultRateLimiterConfig,
  DEFAULT_TOKEN_WINDOW_MS,
  DEFAULT_CHECK_INTERVAL_MS,
} from './_contracts.js';

/**
 * Rate limiter error
 */
export class RateLimiterError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = 'RateLimiterError';
  }

  static rateLimited(retryAfterMs: number): RateLimiterError {
    return new RateLimiterError(
      RateLimiterErrorCodes.RATE_LIMITED,
      `Rate limit exceeded. Retry after ${retryAfterMs}ms`,
      retryAfterMs
    );
  }

  static queueFull(): RateLimiterError {
    return new RateLimiterError(
      RateLimiterErrorCodes.QUEUE_FULL,
      'Rate limiter queue is full'
    );
  }

  static timeout(): RateLimiterError {
    return new RateLimiterError(
      RateLimiterErrorCodes.TIMEOUT,
      'Rate limiter queue timeout'
    );
  }
}

/**
 * Queued request
 */
interface QueuedRequest {
  tokens: number;
  resolve: (result: RateLimiterAcquireResult) => void;
  enqueuedAt: number;
}

/**
 * Rate limiter interface
 */
export interface RateLimiter {
  /** Acquire capacity (waits if needed) */
  acquire(tokens?: number): Promise<RateLimiterAcquireResult>;

  /** Try to acquire capacity (non-blocking) */
  tryAcquire(tokens?: number): boolean;

  /** Get current statistics */
  getStats(): RateLimiterStats;

  /** Reset the limiter */
  reset(): void;
}

/**
 * Creates a rate limiter
 */
export function createRateLimiter(
  config?: Partial<RateLimiterConfig>
): RateLimiter {
  const cfg = { ...createDefaultRateLimiterConfig(), ...config };

  // Token bucket state
  let tokens = cfg.requestsPerMinute * cfg.burstMultiplier;
  const maxTokens = cfg.requestsPerMinute * cfg.burstMultiplier;
  const refillRate = cfg.requestsPerMinute / 60000; // tokens per ms
  let lastRefillTime = Date.now();

  // Token tracking for LLM APIs
  let llmTokensUsed = 0;
  let llmTokenWindowStart = Date.now();

  // Statistics
  let requestsAllowed = 0;
  let requestsRejected = 0;
  const windowStart = new Date().toISOString();

  // Queue
  const queue: QueuedRequest[] = [];
  let processingQueue = false;

  function refillTokens(): void {
    const now = Date.now();
    const elapsed = now - lastRefillTime;
    const refill = elapsed * refillRate;

    tokens = Math.min(maxTokens, tokens + refill);
    lastRefillTime = now;

    // Reset LLM token window if minute elapsed
    if (cfg.tokensPerMinute && now - llmTokenWindowStart >= DEFAULT_TOKEN_WINDOW_MS) {
      llmTokensUsed = 0;
      llmTokenWindowStart = now;
    }
  }

  function calculateWaitTime(requestTokens: number): number {
    if (tokens >= requestTokens) return 0;
    const deficit = requestTokens - tokens;
    return Math.ceil(deficit / refillRate);
  }

  function processQueue(): void {
    if (processingQueue || queue.length === 0) return;
    processingQueue = true;

    const processNext = (): void => {
      if (queue.length === 0) {
        processingQueue = false;
        return;
      }

      const request = queue[0];
      if (!request) {
        processingQueue = false;
        return;
      }

      const now = Date.now();

      // Check timeout
      if (now - request.enqueuedAt >= cfg.queueTimeoutMs) {
        queue.shift();
        request.resolve({
          acquired: false,
          reason: 'timeout',
        });
        setTimeout(processNext, 0);
        return;
      }

      refillTokens();

      if (tokens >= request.tokens) {
        queue.shift();
        tokens -= request.tokens;
        llmTokensUsed += request.tokens; // Track LLM tokens used
        requestsAllowed++;
        request.resolve({
          acquired: true,
          waitedMs: now - request.enqueuedAt,
        });
        setTimeout(processNext, 0);
      } else {
        // Wait for tokens
        const waitTime = calculateWaitTime(request.tokens);
        setTimeout(processNext, Math.min(waitTime, DEFAULT_CHECK_INTERVAL_MS));
      }
    };

    processNext();
  }

  return {
    async acquire(requestTokens = 1): Promise<RateLimiterAcquireResult> {
      refillTokens();

      // Check LLM token limit
      if (cfg.tokensPerMinute && llmTokensUsed >= cfg.tokensPerMinute) {
        const retryAfterMs = DEFAULT_TOKEN_WINDOW_MS - (Date.now() - llmTokenWindowStart);
        requestsRejected++;
        return {
          acquired: false,
          reason: 'limit-exceeded',
          retryAfterMs,
        };
      }

      // Try immediate acquisition
      if (tokens >= requestTokens && queue.length === 0) {
        tokens -= requestTokens;
        llmTokensUsed += requestTokens; // Track LLM tokens used
        requestsAllowed++;
        return { acquired: true, waitedMs: 0 };
      }

      // Check queue capacity
      if (queue.length >= cfg.maxQueueSize) {
        requestsRejected++;
        return { acquired: false, reason: 'queue-full' };
      }

      // Queue the request
      return new Promise((resolve) => {
        queue.push({
          tokens: requestTokens,
          resolve,
          enqueuedAt: Date.now(),
        });
        processQueue();
      });
    },

    tryAcquire(requestTokens = 1): boolean {
      refillTokens();

      // Check LLM token limit
      if (cfg.tokensPerMinute && llmTokensUsed >= cfg.tokensPerMinute) {
        requestsRejected++;
        return false;
      }

      if (tokens >= requestTokens && queue.length === 0) {
        tokens -= requestTokens;
        llmTokensUsed += requestTokens; // Track LLM tokens used
        requestsAllowed++;
        return true;
      }

      requestsRejected++;
      return false;
    },

    getStats(): RateLimiterStats {
      refillTokens();
      return {
        requestsAllowed,
        requestsRejected,
        queueSize: queue.length,
        tokensUsed: llmTokensUsed,
        availableCapacity: tokens,
        nextRefillMs: tokens >= maxTokens ? 0 : Math.ceil((maxTokens - tokens) / refillRate),
        windowStart,
      };
    },

    reset(): void {
      tokens = maxTokens;
      lastRefillTime = Date.now();
      llmTokensUsed = 0;
      llmTokenWindowStart = Date.now();
      requestsAllowed = 0;
      requestsRejected = 0;

      // Clear queue
      while (queue.length > 0) {
        const request = queue.shift();
        if (request) {
          request.resolve({ acquired: false, reason: 'timeout' });
        }
      }
    },
  };
}
