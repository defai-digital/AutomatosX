/**
 * Circuit Breaker Contract V1
 *
 * Provides circuit breaker pattern for provider resilience.
 * Prevents cascading failures when providers become unhealthy.
 *
 * Invariants:
 * - INV-CB-001: Closed state allows all requests
 * - INV-CB-002: Open state rejects until resetTimeout elapsed
 * - INV-CB-003: Half-open state allows limited test requests
 * - INV-CB-004: Failure threshold triggers transition to open
 * - INV-CB-005: Successful tests in half-open trigger transition to closed
 */

import { z } from 'zod';

/**
 * Circuit breaker states
 */
export const CircuitStateSchema = z.enum(['closed', 'open', 'halfOpen']);

export type CircuitState = z.infer<typeof CircuitStateSchema>;

/**
 * Circuit breaker configuration
 */
export const CircuitBreakerConfigSchema = z.object({
  /** Failures before opening circuit (INV-CB-004) */
  failureThreshold: z.number().int().min(1).max(100).default(5),

  /** Time before attempting half-open state in ms (INV-CB-002) */
  resetTimeoutMs: z.number().int().min(1000).max(300000).default(30000),

  /** Number of test requests allowed in half-open state (INV-CB-003) */
  halfOpenRequests: z.number().int().min(1).max(10).default(3),

  /** Interval for passive health checks in ms */
  monitorIntervalMs: z.number().int().min(1000).max(60000).default(10000),

  /** Success threshold to close circuit from half-open */
  successThreshold: z.number().int().min(1).max(10).default(3),
});

export type CircuitBreakerConfig = z.infer<typeof CircuitBreakerConfigSchema>;

/**
 * Circuit breaker state snapshot
 */
export const CircuitBreakerStateSchema = z.object({
  /** Current circuit state */
  state: CircuitStateSchema,

  /** Consecutive failure count */
  failureCount: z.number().int().min(0),

  /** Success count in half-open state */
  successCount: z.number().int().min(0),

  /** Timestamp of last failure */
  lastFailureTime: z.string().datetime().optional(),

  /** Timestamp of last success */
  lastSuccessTime: z.string().datetime().optional(),

  /** Next allowed attempt time (when open) */
  nextAttemptTime: z.string().datetime().optional(),

  /** Time of last state transition */
  lastTransitionTime: z.string().datetime().optional(),

  /** Total requests since last reset */
  totalRequests: z.number().int().min(0).default(0),

  /** Total failures since last reset */
  totalFailures: z.number().int().min(0).default(0),
});

export type CircuitBreakerState = z.infer<typeof CircuitBreakerStateSchema>;

/**
 * Circuit breaker event types
 */
export const CircuitBreakerEventTypeSchema = z.enum([
  'circuit.opened',
  'circuit.closed',
  'circuit.halfOpen',
  'circuit.requestAllowed',
  'circuit.requestRejected',
  'circuit.successRecorded',
  'circuit.failureRecorded',
]);

export type CircuitBreakerEventType = z.infer<typeof CircuitBreakerEventTypeSchema>;

/**
 * Circuit breaker event
 */
export const CircuitBreakerEventSchema = z.object({
  eventId: z.string().uuid(),
  type: CircuitBreakerEventTypeSchema,
  providerId: z.string(),
  timestamp: z.string().datetime(),
  previousState: CircuitStateSchema.optional(),
  currentState: CircuitStateSchema,
  details: z.record(z.unknown()).optional(),
});

export type CircuitBreakerEvent = z.infer<typeof CircuitBreakerEventSchema>;

/**
 * Error codes for circuit breaker operations
 */
export const CircuitBreakerErrorCodes = {
  CIRCUIT_OPEN: 'CIRCUIT_BREAKER_OPEN',
  HALF_OPEN_LIMIT: 'CIRCUIT_BREAKER_HALF_OPEN_LIMIT',
  INVALID_CONFIG: 'CIRCUIT_BREAKER_INVALID_CONFIG',
} as const;

export type CircuitBreakerErrorCode =
  (typeof CircuitBreakerErrorCodes)[keyof typeof CircuitBreakerErrorCodes];

/**
 * Validates circuit breaker configuration
 */
export function validateCircuitBreakerConfig(data: unknown): CircuitBreakerConfig {
  return CircuitBreakerConfigSchema.parse(data);
}

/**
 * Validates circuit breaker state
 */
export function validateCircuitBreakerState(data: unknown): CircuitBreakerState {
  return CircuitBreakerStateSchema.parse(data);
}

/**
 * Creates default circuit breaker configuration
 */
export function createDefaultCircuitBreakerConfig(): CircuitBreakerConfig {
  return CircuitBreakerConfigSchema.parse({});
}

/**
 * Creates initial circuit breaker state (closed)
 */
export function createInitialCircuitBreakerState(): CircuitBreakerState {
  return {
    state: 'closed',
    failureCount: 0,
    successCount: 0,
    totalRequests: 0,
    totalFailures: 0,
  };
}
