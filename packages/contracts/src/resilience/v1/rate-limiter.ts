/**
 * Rate Limiter Contract
 *
 * Token bucket rate limiting to prevent API limit violations and cost overruns.
 */

import { z } from 'zod';

// ============================================================================
// Configuration
// ============================================================================

export const RateLimiterConfigSchema = z.object({
  /** Maximum requests per minute */
  requestsPerMinute: z.number().int().min(1).max(10000).default(60),

  /** Maximum tokens per minute (for LLM APIs) */
  tokensPerMinute: z.number().int().min(1000).max(10000000).optional(),

  /** Maximum queued requests waiting for capacity */
  maxQueueSize: z.number().int().min(0).max(1000).default(100),

  /** Maximum time to wait in queue (ms) */
  queueTimeoutMs: z.number().int().min(0).max(300000).default(30000),

  /** Burst allowance (extra capacity for bursts) */
  burstMultiplier: z.number().min(1).max(5).default(1.5),
});

export type RateLimiterConfig = z.infer<typeof RateLimiterConfigSchema>;

// ============================================================================
// Stats
// ============================================================================

export const RateLimiterStatsSchema = z.object({
  /** Requests allowed in current window */
  requestsAllowed: z.number().int().min(0),

  /** Requests rejected in current window */
  requestsRejected: z.number().int().min(0),

  /** Current queue size */
  queueSize: z.number().int().min(0),

  /** Tokens used in current window */
  tokensUsed: z.number().int().min(0),

  /** Available capacity (requests) */
  availableCapacity: z.number().min(0),

  /** Time until next refill (ms) */
  nextRefillMs: z.number().int().min(0),

  /** Window start time */
  windowStart: z.string().datetime(),
});

export type RateLimiterStats = z.infer<typeof RateLimiterStatsSchema>;

// ============================================================================
// Acquire Result
// ============================================================================

export const RateLimiterAcquireResultSchema = z.discriminatedUnion('acquired', [
  z.object({
    acquired: z.literal(true),
    waitedMs: z.number().int().min(0),
  }),
  z.object({
    acquired: z.literal(false),
    reason: z.enum(['queue-full', 'timeout', 'limit-exceeded']),
    retryAfterMs: z.number().int().min(0).optional(),
  }),
]);

export type RateLimiterAcquireResult = z.infer<typeof RateLimiterAcquireResultSchema>;

// ============================================================================
// Error Codes
// ============================================================================

export const RateLimiterErrorCodes = {
  RATE_LIMITED: 'RATE_LIMITER_LIMITED',
  QUEUE_FULL: 'RATE_LIMITER_QUEUE_FULL',
  TIMEOUT: 'RATE_LIMITER_TIMEOUT',
} as const;

export type RateLimiterErrorCode =
  (typeof RateLimiterErrorCodes)[keyof typeof RateLimiterErrorCodes];

// ============================================================================
// Validation Functions
// ============================================================================

export function validateRateLimiterConfig(data: unknown): RateLimiterConfig {
  return RateLimiterConfigSchema.parse(data);
}

export function safeValidateRateLimiterConfig(
  data: unknown
): { success: true; data: RateLimiterConfig } | { success: false; error: z.ZodError } {
  const result = RateLimiterConfigSchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createDefaultRateLimiterConfig(): RateLimiterConfig {
  return RateLimiterConfigSchema.parse({});
}

export function createRateLimiterStats(): RateLimiterStats {
  return {
    requestsAllowed: 0,
    requestsRejected: 0,
    queueSize: 0,
    tokensUsed: 0,
    availableCapacity: 60, // Default RPM
    nextRefillMs: 0,
    windowStart: new Date().toISOString(),
  };
}

// ============================================================================
// Default Constants
// Exported for use by implementation code to avoid hardcoding
// ============================================================================

/**
 * Default token window duration in milliseconds (1 minute)
 * Used for per-minute rate limiting calculations
 */
export const DEFAULT_TOKEN_WINDOW_MS = 60000;

/**
 * Default check interval in milliseconds
 * How often to check rate limit status in queue operations
 */
export const DEFAULT_CHECK_INTERVAL_MS = 100;

/**
 * Time multipliers for parsing time range strings
 */
export const TIME_MULTIPLIERS: Record<string, number> = {
  s: 1000,
  m: 60000,
  h: 3600000,
  d: 86400000,
};

/**
 * Default time range in milliseconds (1 hour)
 */
export const DEFAULT_TIME_RANGE_MS = 3600000;
