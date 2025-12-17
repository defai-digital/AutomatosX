/**
 * Rate Limit Contract V1
 *
 * Provides rate limiting for provider requests using token bucket algorithm.
 * Prevents overwhelming providers with too many requests.
 *
 * Invariants:
 * - INV-RL-001: Tokens never exceed burst capacity
 * - INV-RL-002: Tokens refill at configured rate
 * - INV-RL-003: Strategy (reject/queue/backoff) honored
 * - INV-RL-004: Queue never exceeds maxQueueSize
 */

import { z } from 'zod';

/**
 * Rate limit strategy when limit is reached
 */
export const RateLimitStrategySchema = z.enum([
  'reject',   // Immediately reject request
  'queue',    // Queue request for later
  'backoff',  // Wait with exponential backoff
]);

export type RateLimitStrategy = z.infer<typeof RateLimitStrategySchema>;

/**
 * Rate limit state
 */
export const RateLimitStateEnumSchema = z.enum([
  'normal',     // Operating normally
  'throttled',  // Rate limited but requests allowed
  'blocked',    // All requests blocked
]);

export type RateLimitStateEnum = z.infer<typeof RateLimitStateEnumSchema>;

/**
 * Rate limit configuration
 */
export const RateLimitConfigSchema = z.object({
  /** Requests per minute per provider */
  requestsPerMinute: z.number().int().min(1).max(10000).default(60),

  /** Tokens per minute per provider */
  tokensPerMinute: z.number().int().min(1000).max(10000000).default(100000),

  /** Burst allowance multiplier (INV-RL-001) */
  burstMultiplier: z.number().min(1).max(5).default(1.5),

  /** Strategy when limit reached (INV-RL-003) */
  strategy: RateLimitStrategySchema.default('backoff'),

  /** Max queue size if strategy is 'queue' (INV-RL-004) */
  maxQueueSize: z.number().int().min(0).max(1000).default(100),

  /** Backoff base delay in ms */
  backoffBaseMs: z.number().int().min(100).max(10000).default(1000),

  /** Backoff multiplier for exponential backoff */
  backoffMultiplier: z.number().min(1).max(4).default(2),

  /** Maximum backoff delay in ms */
  maxBackoffMs: z.number().int().min(1000).max(60000).default(30000),

  /** Enable token-based rate limiting */
  enableTokenLimit: z.boolean().default(true),

  /** Enable request-based rate limiting */
  enableRequestLimit: z.boolean().default(true),
});

export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;

/**
 * Rate limit state snapshot
 */
export const RateLimitStateSchema = z.object({
  /** Current available request tokens */
  requestTokens: z.number().min(0),

  /** Current available output tokens */
  outputTokens: z.number().min(0),

  /** Requests in current window */
  requestCount: z.number().int().min(0),

  /** Tokens used in current window */
  tokenCount: z.number().int().min(0),

  /** Start of current rate limit window */
  windowStart: z.string().datetime(),

  /** Current queue size */
  queueSize: z.number().int().min(0),

  /** Next allowed request time (if rate limited) */
  nextAllowedTime: z.string().datetime().optional(),

  /** Current state */
  state: RateLimitStateEnumSchema,

  /** Last refill timestamp */
  lastRefillTime: z.string().datetime(),
});

export type RateLimitState = z.infer<typeof RateLimitStateSchema>;

/**
 * Rate limit result
 */
export const RateLimitResultSchema = z.object({
  /** Whether request is allowed */
  allowed: z.boolean(),

  /** Wait time in ms (for backoff strategy) */
  waitMs: z.number().int().min(0),

  /** Whether request was queued */
  queued: z.boolean().optional(),

  /** Queue position if queued */
  queuePosition: z.number().int().min(0).optional(),

  /** Error code if rejected */
  error: z.string().optional(),

  /** Remaining requests in window */
  remainingRequests: z.number().int().min(0).optional(),

  /** Remaining tokens in window */
  remainingTokens: z.number().int().min(0).optional(),

  /** Time until rate limit resets */
  resetInMs: z.number().int().min(0).optional(),
});

export type RateLimitResult = z.infer<typeof RateLimitResultSchema>;

/**
 * Rate limit event types
 */
export const RateLimitEventTypeSchema = z.enum([
  'rateLimit.acquired',
  'rateLimit.rejected',
  'rateLimit.queued',
  'rateLimit.dequeued',
  'rateLimit.refilled',
  'rateLimit.stateChanged',
]);

export type RateLimitEventType = z.infer<typeof RateLimitEventTypeSchema>;

/**
 * Rate limit event
 */
export const RateLimitEventSchema = z.object({
  eventId: z.string().uuid(),
  type: RateLimitEventTypeSchema,
  providerId: z.string(),
  timestamp: z.string().datetime(),
  requestId: z.string().uuid().optional(),
  details: z.record(z.unknown()).optional(),
});

export type RateLimitEvent = z.infer<typeof RateLimitEventSchema>;

/**
 * Error codes for rate limit operations
 */
export const RateLimitErrorCodes = {
  RATE_LIMITED: 'RATE_LIMIT_EXCEEDED',
  QUEUE_FULL: 'RATE_LIMIT_QUEUE_FULL',
  TOKEN_LIMIT: 'RATE_LIMIT_TOKEN_EXCEEDED',
  REQUEST_LIMIT: 'RATE_LIMIT_REQUEST_EXCEEDED',
  INVALID_CONFIG: 'RATE_LIMIT_INVALID_CONFIG',
} as const;

export type RateLimitErrorCode =
  (typeof RateLimitErrorCodes)[keyof typeof RateLimitErrorCodes];

/**
 * Validates rate limit configuration
 */
export function validateRateLimitConfig(data: unknown): RateLimitConfig {
  return RateLimitConfigSchema.parse(data);
}

/**
 * Validates rate limit state
 */
export function validateRateLimitState(data: unknown): RateLimitState {
  return RateLimitStateSchema.parse(data);
}

/**
 * Creates default rate limit configuration
 */
export function createDefaultRateLimitConfig(): RateLimitConfig {
  return RateLimitConfigSchema.parse({});
}

/**
 * Creates initial rate limit state
 */
export function createInitialRateLimitState(config: RateLimitConfig): RateLimitState {
  const now = new Date().toISOString();
  return {
    requestTokens: config.requestsPerMinute * config.burstMultiplier,
    outputTokens: config.tokensPerMinute * config.burstMultiplier,
    requestCount: 0,
    tokenCount: 0,
    windowStart: now,
    queueSize: 0,
    state: 'normal',
    lastRefillTime: now,
  };
}
