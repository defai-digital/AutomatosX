/**
 * Metrics Contract
 *
 * Basic observability metrics for monitoring system health.
 */

import { z } from 'zod';

// ============================================================================
// Metrics Time Range (supports relative times like '-1h')
// ============================================================================

export const MetricsTimeRangeSchema = z.object({
  /** Start time (ISO string or relative like '-1h', '-30m', '-1d') */
  start: z.string(),

  /** End time (ISO string or 'now') */
  end: z.string().default('now'),
});

export type MetricsTimeRange = z.infer<typeof MetricsTimeRangeSchema>;

// ============================================================================
// Request Metric
// ============================================================================

export const RequestMetricSchema = z.object({
  /** Timestamp */
  timestamp: z.string().datetime(),

  /** Provider ID */
  providerId: z.string(),

  /** Operation type */
  operation: z.string(),

  /** Whether request succeeded */
  success: z.boolean(),

  /** Duration in ms */
  durationMs: z.number().int().min(0),

  /** Input tokens used */
  inputTokens: z.number().int().min(0).optional(),

  /** Output tokens used */
  outputTokens: z.number().int().min(0).optional(),

  /** Estimated cost */
  estimatedCost: z.number().min(0).optional(),

  /** Error code if failed */
  errorCode: z.string().optional(),

  /** Additional metadata */
  metadata: z.record(z.unknown()).optional(),
});

export type RequestMetric = z.infer<typeof RequestMetricSchema>;

// ============================================================================
// Error Metric
// ============================================================================

export const ErrorMetricSchema = z.object({
  /** Timestamp */
  timestamp: z.string().datetime(),

  /** Error code */
  code: z.string(),

  /** Error message */
  message: z.string(),

  /** Provider ID if applicable */
  providerId: z.string().optional(),

  /** Operation that failed */
  operation: z.string().optional(),

  /** Whether error was recoverable */
  recoverable: z.boolean().default(false),

  /** Stack trace (truncated) */
  stack: z.string().max(2000).optional(),
});

export type ErrorMetric = z.infer<typeof ErrorMetricSchema>;

// ============================================================================
// Latency Stats
// ============================================================================

export const LatencyStatsSchema = z.object({
  /** Minimum latency in ms */
  min: z.number().int().min(0),

  /** Maximum latency in ms */
  max: z.number().int().min(0),

  /** Mean latency in ms */
  mean: z.number().min(0),

  /** Median (p50) latency in ms */
  p50: z.number().int().min(0),

  /** 95th percentile latency in ms */
  p95: z.number().int().min(0),

  /** 99th percentile latency in ms */
  p99: z.number().int().min(0),

  /** Sample count */
  count: z.number().int().min(0),
});

export type LatencyStats = z.infer<typeof LatencyStatsSchema>;

// ============================================================================
// Metrics Snapshot
// ============================================================================

export const MetricsSnapshotSchema = z.object({
  /** Time range for this snapshot */
  timeRange: MetricsTimeRangeSchema,

  /** Request counts */
  requests: z.object({
    total: z.number().int().min(0),
    success: z.number().int().min(0),
    failure: z.number().int().min(0),
    successRate: z.number().min(0).max(1),
  }),

  /** Latency statistics */
  latency: LatencyStatsSchema,

  /** Token usage */
  tokens: z.object({
    input: z.number().int().min(0),
    output: z.number().int().min(0),
    total: z.number().int().min(0),
  }),

  /** Cost statistics */
  cost: z.object({
    estimated: z.number().min(0),
    perRequest: z.number().min(0),
  }),

  /** Error breakdown by code */
  errors: z.record(z.number().int().min(0)),

  /** Per-provider breakdown */
  byProvider: z.record(
    z.object({
      requests: z.number().int().min(0),
      failures: z.number().int().min(0),
      latencyP50: z.number().int().min(0),
      tokens: z.number().int().min(0),
    })
  ),

  /** Generated at timestamp */
  generatedAt: z.string().datetime(),
});

export type MetricsSnapshot = z.infer<typeof MetricsSnapshotSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

export function validateRequestMetric(data: unknown): RequestMetric {
  return RequestMetricSchema.parse(data);
}

export function validateErrorMetric(data: unknown): ErrorMetric {
  return ErrorMetricSchema.parse(data);
}

export function validateMetricsSnapshot(data: unknown): MetricsSnapshot {
  return MetricsSnapshotSchema.parse(data);
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createEmptyMetricsSnapshot(timeRange?: MetricsTimeRange): MetricsSnapshot {
  const now = new Date().toISOString();
  return {
    timeRange: timeRange ?? { start: now, end: 'now' },
    requests: {
      total: 0,
      success: 0,
      failure: 0,
      successRate: 1,
    },
    latency: {
      min: 0,
      max: 0,
      mean: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      count: 0,
    },
    tokens: {
      input: 0,
      output: 0,
      total: 0,
    },
    cost: {
      estimated: 0,
      perRequest: 0,
    },
    errors: {},
    byProvider: {},
    generatedAt: now,
  };
}

export function createRequestMetric(
  providerId: string,
  operation: string,
  success: boolean,
  durationMs: number
): RequestMetric {
  return {
    timestamp: new Date().toISOString(),
    providerId,
    operation,
    success,
    durationMs,
  };
}

export function createErrorMetric(
  code: string,
  message: string,
  options?: Partial<ErrorMetric>
): ErrorMetric {
  return {
    timestamp: new Date().toISOString(),
    code,
    message,
    recoverable: false,
    ...options,
  };
}
