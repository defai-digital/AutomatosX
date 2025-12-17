/**
 * Circuit Breaker Contract
 *
 * Prevents cascade failures by stopping calls to unhealthy providers.
 */

import { z } from 'zod';

// ============================================================================
// Circuit Breaker State
// ============================================================================

export const CircuitBreakerStateSchema = z.enum(['closed', 'open', 'half-open']);
export type CircuitBreakerState = z.infer<typeof CircuitBreakerStateSchema>;

// ============================================================================
// Configuration
// ============================================================================

export const CircuitBreakerConfigSchema = z.object({
  /** Number of failures before opening circuit */
  failureThreshold: z.number().int().min(1).max(100).default(5),

  /** Time in ms before attempting recovery (half-open) */
  resetTimeoutMs: z.number().int().min(1000).max(300000).default(30000),

  /** Number of test requests allowed in half-open state */
  halfOpenMaxAttempts: z.number().int().min(1).max(10).default(1),

  /** Time window for counting failures in ms */
  failureWindowMs: z.number().int().min(1000).max(300000).default(60000),
});

export type CircuitBreakerConfig = z.infer<typeof CircuitBreakerConfigSchema>;

// ============================================================================
// Stats
// ============================================================================

export const CircuitBreakerStatsSchema = z.object({
  /** Current state */
  state: CircuitBreakerStateSchema,

  /** Total successful calls */
  successCount: z.number().int().min(0),

  /** Total failed calls */
  failureCount: z.number().int().min(0),

  /** Failures in current window */
  recentFailures: z.number().int().min(0),

  /** Last failure timestamp */
  lastFailureAt: z.string().datetime().optional(),

  /** Last success timestamp */
  lastSuccessAt: z.string().datetime().optional(),

  /** When circuit opened (if open) */
  openedAt: z.string().datetime().optional(),

  /** Consecutive successes in half-open */
  halfOpenSuccesses: z.number().int().min(0),
});

export type CircuitBreakerStats = z.infer<typeof CircuitBreakerStatsSchema>;

// ============================================================================
// Events
// ============================================================================

export const CircuitBreakerEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('state-change'),
    from: CircuitBreakerStateSchema,
    to: CircuitBreakerStateSchema,
    timestamp: z.string().datetime(),
  }),
  z.object({
    type: z.literal('call-success'),
    durationMs: z.number().int().min(0),
    timestamp: z.string().datetime(),
  }),
  z.object({
    type: z.literal('call-failure'),
    error: z.string(),
    timestamp: z.string().datetime(),
  }),
  z.object({
    type: z.literal('call-rejected'),
    reason: z.string(),
    timestamp: z.string().datetime(),
  }),
]);

export type CircuitBreakerEvent = z.infer<typeof CircuitBreakerEventSchema>;

// ============================================================================
// Error Codes
// ============================================================================

export const CircuitBreakerErrorCodes = {
  CIRCUIT_OPEN: 'CIRCUIT_BREAKER_OPEN',
  EXECUTION_FAILED: 'CIRCUIT_BREAKER_EXECUTION_FAILED',
} as const;

export type CircuitBreakerErrorCode =
  (typeof CircuitBreakerErrorCodes)[keyof typeof CircuitBreakerErrorCodes];

// ============================================================================
// Validation Functions
// ============================================================================

export function validateCircuitBreakerConfig(data: unknown): CircuitBreakerConfig {
  return CircuitBreakerConfigSchema.parse(data);
}

export function safeValidateCircuitBreakerConfig(
  data: unknown
): { success: true; data: CircuitBreakerConfig } | { success: false; error: z.ZodError } {
  const result = CircuitBreakerConfigSchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createDefaultCircuitBreakerConfig(): CircuitBreakerConfig {
  return CircuitBreakerConfigSchema.parse({});
}

export function createCircuitBreakerStats(): CircuitBreakerStats {
  return {
    state: 'closed',
    successCount: 0,
    failureCount: 0,
    recentFailures: 0,
    halfOpenSuccesses: 0,
  };
}
