/**
 * Provider Health Contract V1
 *
 * Provides health monitoring for provider resilience.
 * Tracks latency, error rates, and availability for intelligent routing.
 *
 * Invariants:
 * - INV-HM-001: Latency samples bounded by configured size
 * - INV-HM-002: Error rate calculated over sliding window
 * - INV-HM-003: Availability derived from circuit and error state
 */

import { z } from 'zod';
import { CircuitStateSchema } from './circuit-breaker.js';
import { RateLimitStateEnumSchema } from './rate-limit.js';
import { TIMEOUT_HEALTH_CHECK } from '../../constants.js';

/**
 * Health check configuration
 */
export const HealthCheckConfigSchema = z.object({
  /** Interval between active health checks in ms */
  intervalMs: z.number().int().min(5000).max(300000).default(30000),

  /** Timeout for health check request in ms */
  timeoutMs: z.number().int().min(1000).max(30000).default(TIMEOUT_HEALTH_CHECK),

  /** Number of latency samples to retain (INV-HM-001) */
  latencySampleSize: z.number().int().min(1).max(100).default(10),

  /** Error rate threshold for unhealthy status */
  unhealthyErrorRate: z.number().min(0).max(1).default(0.5),

  /** Consecutive failures for degraded status */
  degradedThreshold: z.number().int().min(1).max(20).default(3),

  /** Enable active health checks */
  enableActiveChecks: z.boolean().default(true),

  /** Enable passive health tracking */
  enablePassiveTracking: z.boolean().default(true),
});

export type HealthCheckConfig = z.infer<typeof HealthCheckConfigSchema>;

/**
 * Health status levels
 */
export const HealthLevelSchema = z.enum([
  'healthy',    // Fully operational
  'degraded',   // Experiencing issues but operational
  'unhealthy',  // Not operational
  'unknown',    // No data available
]);

export type HealthLevel = z.infer<typeof HealthLevelSchema>;

/**
 * Provider health status
 */
export const HealthStatusSchema = z.object({
  /** Provider identifier */
  providerId: z.string(),

  /** Whether provider is available for requests */
  available: z.boolean(),

  /** Overall health level */
  level: HealthLevelSchema,

  /** Average latency in ms */
  latencyMs: z.number().min(0),

  /** P50 latency in ms */
  latencyP50Ms: z.number().min(0).optional(),

  /** P95 latency in ms */
  latencyP95Ms: z.number().min(0).optional(),

  /** P99 latency in ms */
  latencyP99Ms: z.number().min(0).optional(),

  /** Error rate (0-1) */
  errorRate: z.number().min(0).max(1),

  /** Consecutive failures */
  consecutiveFailures: z.number().int().min(0),

  /** Consecutive successes */
  consecutiveSuccesses: z.number().int().min(0),

  /** Timestamp of last health check */
  lastCheckTime: z.string().datetime(),

  /** Timestamp of last successful request */
  lastSuccessTime: z.string().datetime().optional(),

  /** Timestamp of last failed request */
  lastErrorTime: z.string().datetime().optional(),

  /** Last error message */
  lastError: z.string().optional(),

  /** Last error code */
  lastErrorCode: z.string().optional(),

  /** Circuit breaker state */
  circuitState: CircuitStateSchema,

  /** Rate limit state */
  rateLimitState: RateLimitStateEnumSchema,

  /** Total requests in monitoring window */
  totalRequests: z.number().int().min(0),

  /** Total errors in monitoring window */
  totalErrors: z.number().int().min(0),

  /** Uptime percentage in monitoring window */
  uptimePercent: z.number().min(0).max(100).optional(),
});

export type HealthStatus = z.infer<typeof HealthStatusSchema>;

/**
 * Health check result
 */
export const HealthCheckResultSchema = z.object({
  /** Check identifier */
  checkId: z.string().uuid(),

  /** Provider identifier */
  providerId: z.string(),

  /** Whether check passed */
  success: z.boolean(),

  /** Latency of health check in ms */
  latencyMs: z.number().min(0),

  /** Timestamp of check */
  timestamp: z.string().datetime(),

  /** Error message if failed */
  error: z.string().optional(),

  /** Error code if failed */
  errorCode: z.string().optional(),

  /** Check type */
  checkType: z.enum(['active', 'passive']),
});

export type HealthCheckResult = z.infer<typeof HealthCheckResultSchema>;

/**
 * Health event types
 */
export const HealthEventTypeSchema = z.enum([
  'health.check.started',
  'health.check.passed',
  'health.check.failed',
  'health.status.changed',
  'health.degraded',
  'health.recovered',
  'health.unhealthy',
]);

export type HealthEventType = z.infer<typeof HealthEventTypeSchema>;

/**
 * Health event
 */
export const HealthEventSchema = z.object({
  eventId: z.string().uuid(),
  type: HealthEventTypeSchema,
  providerId: z.string(),
  timestamp: z.string().datetime(),
  previousLevel: HealthLevelSchema.optional(),
  currentLevel: HealthLevelSchema,
  details: z.record(z.unknown()).optional(),
});

export type HealthEvent = z.infer<typeof HealthEventSchema>;

/**
 * Error codes for health operations
 */
export const HealthErrorCodes = {
  CHECK_TIMEOUT: 'HEALTH_CHECK_TIMEOUT',
  CHECK_FAILED: 'HEALTH_CHECK_FAILED',
  PROVIDER_UNAVAILABLE: 'HEALTH_PROVIDER_UNAVAILABLE',
  INVALID_CONFIG: 'HEALTH_INVALID_CONFIG',
} as const;

export type HealthErrorCode =
  (typeof HealthErrorCodes)[keyof typeof HealthErrorCodes];

/**
 * Validates health check configuration
 */
export function validateHealthCheckConfig(data: unknown): HealthCheckConfig {
  return HealthCheckConfigSchema.parse(data);
}

/**
 * Validates health status
 */
export function validateHealthStatus(data: unknown): HealthStatus {
  return HealthStatusSchema.parse(data);
}

/**
 * Creates default health check configuration
 */
export function createDefaultHealthCheckConfig(): HealthCheckConfig {
  return HealthCheckConfigSchema.parse({});
}

/**
 * Creates initial health status (unknown)
 */
export function createInitialHealthStatus(providerId: string): HealthStatus {
  const now = new Date().toISOString();
  return {
    providerId,
    available: false,
    level: 'unknown',
    latencyMs: 0,
    errorRate: 0,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    lastCheckTime: now,
    circuitState: 'closed',
    rateLimitState: 'normal',
    totalRequests: 0,
    totalErrors: 0,
  };
}

/**
 * Calculate percentile from sorted array
 */
export function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  const safeIndex = Math.max(0, Math.min(index, sortedValues.length - 1));
  return sortedValues[safeIndex] ?? 0;
}
