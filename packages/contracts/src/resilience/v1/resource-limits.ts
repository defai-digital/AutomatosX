/**
 * Resource Limits Contract
 *
 * Enforces limits on tokens, time, cost, and concurrency.
 */

import { z } from 'zod';

// ============================================================================
// Configuration
// ============================================================================

export const ResourceLimitsConfigSchema = z.object({
  /** Maximum tokens per request */
  maxTokensPerRequest: z.number().int().min(100).max(1000000).default(100000),

  /** Maximum tokens per session */
  maxTokensPerSession: z.number().int().min(1000).max(10000000).default(1000000),

  /** Maximum duration per operation in ms */
  maxDurationMs: z.number().int().min(1000).max(3600000).default(300000), // 5 min

  /** Maximum cost per session in dollars */
  maxCostPerSession: z.number().min(0.01).max(1000).default(10),

  /** Maximum concurrent requests */
  maxConcurrentRequests: z.number().int().min(1).max(100).default(5),

  /** Cost per 1K input tokens (for estimation) */
  costPer1kInputTokens: z.number().min(0).default(0.003),

  /** Cost per 1K output tokens (for estimation) */
  costPer1kOutputTokens: z.number().min(0).default(0.015),
});

export type ResourceLimitsConfig = z.infer<typeof ResourceLimitsConfigSchema>;

// ============================================================================
// Usage Tracking
// ============================================================================

export const ResourceUsageSchema = z.object({
  /** Session identifier */
  sessionId: z.string(),

  /** Total input tokens used */
  inputTokens: z.number().int().min(0),

  /** Total output tokens used */
  outputTokens: z.number().int().min(0),

  /** Total requests made */
  requestCount: z.number().int().min(0),

  /** Total duration in ms */
  totalDurationMs: z.number().int().min(0),

  /** Estimated cost in dollars */
  estimatedCost: z.number().min(0),

  /** Current concurrent requests */
  concurrentRequests: z.number().int().min(0),

  /** First request timestamp */
  startedAt: z.string().datetime(),

  /** Last request timestamp */
  lastRequestAt: z.string().datetime().optional(),
});

export type ResourceUsage = z.infer<typeof ResourceUsageSchema>;

// ============================================================================
// Check Result
// ============================================================================

export const ResourceCheckResultSchema = z.discriminatedUnion('allowed', [
  z.object({
    allowed: z.literal(true),
  }),
  z.object({
    allowed: z.literal(false),
    reason: z.string(),
    limitType: z.enum([
      'tokens-per-request',
      'tokens-per-session',
      'duration',
      'cost',
      'concurrency',
    ]),
    current: z.number(),
    max: z.number(),
    retryAfterMs: z.number().int().min(0).optional(),
  }),
]);

export type ResourceCheckResult = z.infer<typeof ResourceCheckResultSchema>;

// ============================================================================
// Request Info (for checking before request)
// ============================================================================

export const ResourceRequestInfoSchema = z.object({
  /** Estimated input tokens */
  estimatedInputTokens: z.number().int().min(0).optional(),

  /** Estimated output tokens */
  estimatedOutputTokens: z.number().int().min(0).optional(),

  /** Whether this is a new concurrent request */
  isConcurrent: z.boolean().default(false),
});

export type ResourceRequestInfo = z.infer<typeof ResourceRequestInfoSchema>;

// ============================================================================
// Error Codes
// ============================================================================

export const ResourceLimitsErrorCodes = {
  TOKENS_PER_REQUEST_EXCEEDED: 'RESOURCE_TOKENS_PER_REQUEST_EXCEEDED',
  TOKENS_PER_SESSION_EXCEEDED: 'RESOURCE_TOKENS_PER_SESSION_EXCEEDED',
  DURATION_EXCEEDED: 'RESOURCE_DURATION_EXCEEDED',
  COST_EXCEEDED: 'RESOURCE_COST_EXCEEDED',
  CONCURRENCY_EXCEEDED: 'RESOURCE_CONCURRENCY_EXCEEDED',
} as const;

export type ResourceLimitsErrorCode =
  (typeof ResourceLimitsErrorCodes)[keyof typeof ResourceLimitsErrorCodes];

// ============================================================================
// Validation Functions
// ============================================================================

export function validateResourceLimitsConfig(data: unknown): ResourceLimitsConfig {
  return ResourceLimitsConfigSchema.parse(data);
}

export function safeValidateResourceLimitsConfig(
  data: unknown
): { success: true; data: ResourceLimitsConfig } | { success: false; error: z.ZodError } {
  const result = ResourceLimitsConfigSchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createDefaultResourceLimitsConfig(): ResourceLimitsConfig {
  return ResourceLimitsConfigSchema.parse({});
}

export function createResourceUsage(sessionId: string): ResourceUsage {
  return {
    sessionId,
    inputTokens: 0,
    outputTokens: 0,
    requestCount: 0,
    totalDurationMs: 0,
    estimatedCost: 0,
    concurrentRequests: 0,
    startedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  config: ResourceLimitsConfig
): number {
  const inputCost = (inputTokens / 1000) * config.costPer1kInputTokens;
  const outputCost = (outputTokens / 1000) * config.costPer1kOutputTokens;
  return Math.round((inputCost + outputCost) * 10000) / 10000; // Round to 4 decimals
}
