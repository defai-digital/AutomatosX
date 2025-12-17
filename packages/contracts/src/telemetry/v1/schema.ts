/**
 * Telemetry Domain Contracts v1
 *
 * Schemas for metrics collection, aggregation, and observability.
 */

import { z } from 'zod';

// ============================================================================
// Metric Type Schemas
// ============================================================================

/**
 * Metric type
 */
export const MetricTypeSchema = z.enum([
  'counter',
  'gauge',
  'histogram',
  'summary',
  'timer',
]);
export type MetricType = z.infer<typeof MetricTypeSchema>;

/**
 * Metric unit
 */
export const MetricUnitSchema = z.enum([
  'count',
  'bytes',
  'milliseconds',
  'seconds',
  'percent',
  'ratio',
  'tokens',
  'requests',
  'errors',
  'none',
]);
export type MetricUnit = z.infer<typeof MetricUnitSchema>;

/**
 * Metric category
 */
export const MetricCategorySchema = z.enum([
  'system',
  'application',
  'agent',
  'workflow',
  'session',
  'memory',
  'provider',
  'tool',
  'trace',
  'custom',
]);
export type MetricCategory = z.infer<typeof MetricCategorySchema>;

// ============================================================================
// Metric Value Schemas
// ============================================================================

/**
 * Histogram buckets
 */
export const HistogramBucketsSchema = z.object({
  boundaries: z.array(z.number()).min(1).max(50),
  counts: z.array(z.number().int().min(0)),
  sum: z.number(),
  count: z.number().int().min(0),
});
export type HistogramBuckets = z.infer<typeof HistogramBucketsSchema>;

/**
 * Summary percentiles
 */
export const SummaryPercentilesSchema = z.object({
  p50: z.number(),
  p75: z.number(),
  p90: z.number(),
  p95: z.number(),
  p99: z.number(),
  count: z.number().int().min(0),
  sum: z.number(),
});
export type SummaryPercentiles = z.infer<typeof SummaryPercentilesSchema>;

// ============================================================================
// Metric Definition Schemas
// ============================================================================

/**
 * Metric labels
 */
export const MetricLabelsSchema = z.record(z.string().max(100), z.string().max(200));
export type MetricLabels = z.infer<typeof MetricLabelsSchema>;

/**
 * Metric definition
 */
export const MetricDefinitionSchema = z.object({
  name: z.string().max(200).regex(/^[a-z][a-z0-9_]*$/),
  type: MetricTypeSchema,
  unit: MetricUnitSchema.default('none'),
  category: MetricCategorySchema.default('custom'),
  description: z.string().max(500).optional(),
  labels: z.array(z.string().max(100)).max(10).optional(),
  buckets: z.array(z.number()).max(50).optional(),
});
export type MetricDefinition = z.infer<typeof MetricDefinitionSchema>;

/**
 * Metric data point
 */
export const MetricDataPointSchema = z.object({
  metricName: z.string().max(200),
  value: z.number(),
  labels: MetricLabelsSchema.optional(),
  timestamp: z.string().datetime(),
  histogram: HistogramBucketsSchema.optional(),
  summary: SummaryPercentilesSchema.optional(),
});
export type MetricDataPoint = z.infer<typeof MetricDataPointSchema>;

// ============================================================================
// Metric Recording Schemas
// ============================================================================

/**
 * Record metric request
 */
export const RecordMetricRequestSchema = z.object({
  metricName: z.string().max(200),
  value: z.number(),
  labels: MetricLabelsSchema.optional(),
  timestamp: z.string().datetime().optional(),
});
export type RecordMetricRequest = z.infer<typeof RecordMetricRequestSchema>;

/**
 * Increment counter request
 */
export const IncrementCounterRequestSchema = z.object({
  metricName: z.string().max(200),
  delta: z.number().int().default(1),
  labels: MetricLabelsSchema.optional(),
});
export type IncrementCounterRequest = z.infer<typeof IncrementCounterRequestSchema>;

/**
 * Record histogram request
 */
export const RecordHistogramRequestSchema = z.object({
  metricName: z.string().max(200),
  value: z.number(),
  labels: MetricLabelsSchema.optional(),
});
export type RecordHistogramRequest = z.infer<typeof RecordHistogramRequestSchema>;

/**
 * Start timer request
 */
export const StartTimerRequestSchema = z.object({
  metricName: z.string().max(200),
  labels: MetricLabelsSchema.optional(),
});
export type StartTimerRequest = z.infer<typeof StartTimerRequestSchema>;

/**
 * Timer handle
 */
export const TimerHandleSchema = z.object({
  timerId: z.string().uuid(),
  metricName: z.string(),
  startedAt: z.string().datetime(),
  labels: MetricLabelsSchema.optional(),
});
export type TimerHandle = z.infer<typeof TimerHandleSchema>;

// ============================================================================
// Metric Query Schemas
// ============================================================================

/**
 * Aggregation function
 */
export const AggregationFunctionSchema = z.enum([
  'sum',
  'avg',
  'min',
  'max',
  'count',
  'rate',
  'percentile',
  'last',
]);
export type AggregationFunction = z.infer<typeof AggregationFunctionSchema>;

/**
 * Time range
 */
export const TimeRangeSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  step: z.string().max(50).optional(),
});
export type TimeRange = z.infer<typeof TimeRangeSchema>;

/**
 * Query metrics request
 */
export const QueryMetricsRequestSchema = z.object({
  metricName: z.string().max(200),
  labels: MetricLabelsSchema.optional(),
  timeRange: TimeRangeSchema.optional(),
  aggregation: AggregationFunctionSchema.optional(),
  groupBy: z.array(z.string().max(100)).max(5).optional(),
  limit: z.number().int().min(1).max(1000).default(100),
});
export type QueryMetricsRequest = z.infer<typeof QueryMetricsRequestSchema>;

/**
 * Query metrics result
 */
export const QueryMetricsResultSchema = z.object({
  metricName: z.string(),
  dataPoints: z.array(MetricDataPointSchema),
  aggregation: AggregationFunctionSchema.optional(),
  timeRange: TimeRangeSchema.optional(),
  total: z.number().int().min(0),
});
export type QueryMetricsResult = z.infer<typeof QueryMetricsResultSchema>;

// ============================================================================
// Telemetry Summary Schemas
// ============================================================================

/**
 * Telemetry summary request
 */
export const TelemetrySummaryRequestSchema = z.object({
  categories: z.array(MetricCategorySchema).optional(),
  timeRange: TimeRangeSchema.optional(),
  includeHistograms: z.boolean().default(false),
});
export type TelemetrySummaryRequest = z.infer<typeof TelemetrySummaryRequestSchema>;

/**
 * Category summary
 */
export const CategorySummarySchema = z.object({
  category: MetricCategorySchema,
  metricCount: z.number().int().min(0),
  dataPointCount: z.number().int().min(0),
  metrics: z.array(z.object({
    name: z.string(),
    type: MetricTypeSchema,
    lastValue: z.number().optional(),
    lastUpdated: z.string().datetime().optional(),
  })).optional(),
});
export type CategorySummary = z.infer<typeof CategorySummarySchema>;

/**
 * Telemetry summary result
 */
export const TelemetrySummaryResultSchema = z.object({
  totalMetrics: z.number().int().min(0),
  totalDataPoints: z.number().int().min(0),
  byCategory: z.array(CategorySummarySchema),
  oldestDataPoint: z.string().datetime().optional(),
  newestDataPoint: z.string().datetime().optional(),
  generatedAt: z.string().datetime(),
});
export type TelemetrySummaryResult = z.infer<typeof TelemetrySummaryResultSchema>;

// ============================================================================
// Built-in Metrics
// ============================================================================

/**
 * System metrics
 */
export const SystemMetrics = {
  CPU_USAGE: 'system_cpu_usage_percent',
  MEMORY_USAGE: 'system_memory_usage_bytes',
  HEAP_USED: 'system_heap_used_bytes',
  UPTIME: 'system_uptime_seconds',
} as const;

/**
 * Agent metrics
 */
export const AgentMetrics = {
  REQUESTS_TOTAL: 'agent_requests_total',
  REQUESTS_DURATION: 'agent_requests_duration_ms',
  ERRORS_TOTAL: 'agent_errors_total',
  TOKENS_USED: 'agent_tokens_used_total',
  ACTIVE_SESSIONS: 'agent_active_sessions',
} as const;

/**
 * Workflow metrics
 */
export const WorkflowMetrics = {
  EXECUTIONS_TOTAL: 'workflow_executions_total',
  EXECUTION_DURATION: 'workflow_execution_duration_ms',
  STEPS_COMPLETED: 'workflow_steps_completed_total',
  FAILURES_TOTAL: 'workflow_failures_total',
} as const;

/**
 * Provider metrics
 */
export const ProviderMetrics = {
  REQUESTS_TOTAL: 'provider_requests_total',
  LATENCY: 'provider_latency_ms',
  TOKENS_INPUT: 'provider_tokens_input_total',
  TOKENS_OUTPUT: 'provider_tokens_output_total',
  ERRORS_TOTAL: 'provider_errors_total',
  RATE_LIMITS: 'provider_rate_limits_total',
} as const;

// ============================================================================
// Error Codes
// ============================================================================

export const TelemetryErrorCode = {
  METRIC_NOT_FOUND: 'METRIC_NOT_FOUND',
  INVALID_METRIC_TYPE: 'INVALID_METRIC_TYPE',
  INVALID_LABELS: 'INVALID_LABELS',
  QUERY_FAILED: 'QUERY_FAILED',
  TIMER_NOT_FOUND: 'TIMER_NOT_FOUND',
  STORAGE_ERROR: 'STORAGE_ERROR',
} as const;

export type TelemetryErrorCode = (typeof TelemetryErrorCode)[keyof typeof TelemetryErrorCode];

// ============================================================================
// Validation Functions
// ============================================================================

export function validateMetricDefinition(data: unknown): MetricDefinition {
  return MetricDefinitionSchema.parse(data);
}

export function validateRecordMetricRequest(data: unknown): RecordMetricRequest {
  return RecordMetricRequestSchema.parse(data);
}

export function validateQueryMetricsRequest(data: unknown): QueryMetricsRequest {
  return QueryMetricsRequestSchema.parse(data);
}

export function safeValidateRecordMetricRequest(
  data: unknown
): { success: true; data: RecordMetricRequest } | { success: false; error: z.ZodError } {
  const result = RecordMetricRequestSchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}
