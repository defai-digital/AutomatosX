import { z } from 'zod';
/**
 * Telemetry Event Schema
 *
 * Defines the structure for telemetry events collected by the system.
 * Events are stored in SQLite and used for analytics.
 */
// Event types
export const EventTypeSchema = z.enum([
    'command_executed',
    'query_performed',
    'parser_invoked',
    'error_occurred',
    'performance_metric',
    'feature_used',
]);
// Base telemetry event
export const TelemetryEventSchema = z.object({
    sessionId: z.string().uuid(),
    eventType: EventTypeSchema,
    eventData: z.record(z.string(), z.unknown()).optional(),
    timestamp: z.number().int().positive(),
});
// Command execution event
export const CommandEventDataSchema = z.object({
    command: z.string(),
    args: z.array(z.string()).optional(),
    duration: z.number().int().positive(), // milliseconds
    exitCode: z.number().int(),
    error: z.string().optional(),
});
// Query performance event
export const QueryEventDataSchema = z.object({
    queryType: z.enum(['symbol', 'text', 'hybrid']),
    query: z.string().max(100), // Truncated for privacy
    resultCount: z.number().int().nonnegative(),
    duration: z.number().int().positive(),
    cached: z.boolean(),
    language: z.string().optional(),
});
// Parser invocation event
export const ParserEventDataSchema = z.object({
    language: z.string(),
    fileExtension: z.string(), // No full paths for privacy
    duration: z.number().int().positive(),
    symbolCount: z.number().int().nonnegative(),
    lineCount: z.number().int().positive(),
    error: z.string().optional(),
});
// Error event
export const ErrorEventDataSchema = z.object({
    errorType: z.string(),
    message: z.string().max(200), // Truncated
    stack: z.string().max(500).optional(), // Truncated stack trace
    context: z.record(z.string(), z.string()).optional(),
    fatal: z.boolean(),
});
// Performance metric event
export const PerformanceMetricSchema = z.object({
    metricName: z.string(),
    value: z.number(),
    unit: z.enum(['ms', 'bytes', 'count', 'percentage']),
    context: z.record(z.string(), z.string()).optional(),
});
// Feature usage event
export const FeatureUsageSchema = z.object({
    featureName: z.string(),
    enabled: z.boolean(),
    variant: z.string().optional(), // For A/B testing
});
// Telemetry configuration
export const TelemetryConfigSchema = z.object({
    enabled: z.boolean().default(false),
    remote: z.boolean().default(false),
    sessionId: z.string().uuid(),
    consentDate: z.number().int().optional(),
    optOutDate: z.number().int().optional(),
});
// Telemetry statistics (aggregated)
export const TelemetryStatsSchema = z.object({
    statDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
    statType: z.enum(['command', 'query', 'error', 'performance']),
    statKey: z.string(),
    count: z.number().int().nonnegative(),
    totalDuration: z.number().int().nonnegative().optional(),
    avgDuration: z.number().nonnegative().optional(),
    minDuration: z.number().int().nonnegative().optional(),
    maxDuration: z.number().int().nonnegative().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});
// Database records
export const TelemetryEventRecordSchema = z.object({
    id: z.number().int().positive(),
    session_id: z.string(),
    event_type: z.string(),
    event_data: z.string().nullable(), // JSON string
    timestamp: z.number().int(),
    created_at: z.number().int(),
});
export const TelemetryStatsRecordSchema = z.object({
    id: z.number().int().positive(),
    stat_date: z.string(),
    stat_type: z.string(),
    stat_key: z.string(),
    count: z.number().int(),
    total_duration: z.number().int().nullable(),
    avg_duration: z.number().nullable(),
    min_duration: z.number().int().nullable(),
    max_duration: z.number().int().nullable(),
    metadata: z.string().nullable(), // JSON string
    updated_at: z.number().int(),
});
// Remote submission configuration
export const SubmissionConfigSchema = z.object({
    endpoint: z.string().url(),
    apiKey: z.string().optional(),
    timeout: z.number().int().positive().default(30000),
    maxRetries: z.number().int().nonnegative().default(3),
});
// Submission result
export const SubmissionResultSchema = z.object({
    success: z.boolean(),
    accepted: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
    errors: z.array(z.string()).optional(),
});
// Server info
export const ServerInfoSchema = z.object({
    version: z.string(),
    status: z.enum(['healthy', 'degraded', 'down']),
    acceptingEvents: z.boolean(),
    maxBatchSize: z.number().int().positive().optional(),
});
//# sourceMappingURL=telemetry.schema.js.map