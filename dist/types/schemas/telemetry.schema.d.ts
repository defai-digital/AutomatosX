import { z } from 'zod';
/**
 * Telemetry Event Schema
 *
 * Defines the structure for telemetry events collected by the system.
 * Events are stored in SQLite and used for analytics.
 */
export declare const EventTypeSchema: z.ZodEnum<{
    error_occurred: "error_occurred";
    command_executed: "command_executed";
    query_performed: "query_performed";
    parser_invoked: "parser_invoked";
    performance_metric: "performance_metric";
    feature_used: "feature_used";
}>;
export type EventType = z.infer<typeof EventTypeSchema>;
export declare const TelemetryEventSchema: z.ZodObject<{
    sessionId: z.ZodString;
    eventType: z.ZodEnum<{
        error_occurred: "error_occurred";
        command_executed: "command_executed";
        query_performed: "query_performed";
        parser_invoked: "parser_invoked";
        performance_metric: "performance_metric";
        feature_used: "feature_used";
    }>;
    eventData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    timestamp: z.ZodNumber;
}, z.core.$strip>;
export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;
export declare const CommandEventDataSchema: z.ZodObject<{
    command: z.ZodString;
    args: z.ZodOptional<z.ZodArray<z.ZodString>>;
    duration: z.ZodNumber;
    exitCode: z.ZodNumber;
    error: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CommandEventData = z.infer<typeof CommandEventDataSchema>;
export declare const QueryEventDataSchema: z.ZodObject<{
    queryType: z.ZodEnum<{
        symbol: "symbol";
        text: "text";
        hybrid: "hybrid";
    }>;
    query: z.ZodString;
    resultCount: z.ZodNumber;
    duration: z.ZodNumber;
    cached: z.ZodBoolean;
    language: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type QueryEventData = z.infer<typeof QueryEventDataSchema>;
export declare const ParserEventDataSchema: z.ZodObject<{
    language: z.ZodString;
    fileExtension: z.ZodString;
    duration: z.ZodNumber;
    symbolCount: z.ZodNumber;
    lineCount: z.ZodNumber;
    error: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ParserEventData = z.infer<typeof ParserEventDataSchema>;
export declare const ErrorEventDataSchema: z.ZodObject<{
    errorType: z.ZodString;
    message: z.ZodString;
    stack: z.ZodOptional<z.ZodString>;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    fatal: z.ZodBoolean;
}, z.core.$strip>;
export type ErrorEventData = z.infer<typeof ErrorEventDataSchema>;
export declare const PerformanceMetricSchema: z.ZodObject<{
    metricName: z.ZodString;
    value: z.ZodNumber;
    unit: z.ZodEnum<{
        count: "count";
        ms: "ms";
        bytes: "bytes";
        percentage: "percentage";
    }>;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
export type PerformanceMetric = z.infer<typeof PerformanceMetricSchema>;
export declare const FeatureUsageSchema: z.ZodObject<{
    featureName: z.ZodString;
    enabled: z.ZodBoolean;
    variant: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type FeatureUsage = z.infer<typeof FeatureUsageSchema>;
export declare const TelemetryConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    remote: z.ZodDefault<z.ZodBoolean>;
    sessionId: z.ZodString;
    consentDate: z.ZodOptional<z.ZodNumber>;
    optOutDate: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type TelemetryConfig = z.infer<typeof TelemetryConfigSchema>;
export declare const TelemetryStatsSchema: z.ZodObject<{
    statDate: z.ZodString;
    statType: z.ZodEnum<{
        query: "query";
        error: "error";
        performance: "performance";
        command: "command";
    }>;
    statKey: z.ZodString;
    count: z.ZodNumber;
    totalDuration: z.ZodOptional<z.ZodNumber>;
    avgDuration: z.ZodOptional<z.ZodNumber>;
    minDuration: z.ZodOptional<z.ZodNumber>;
    maxDuration: z.ZodOptional<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type TelemetryStats = z.infer<typeof TelemetryStatsSchema>;
export declare const TelemetryEventRecordSchema: z.ZodObject<{
    id: z.ZodNumber;
    session_id: z.ZodString;
    event_type: z.ZodString;
    event_data: z.ZodNullable<z.ZodString>;
    timestamp: z.ZodNumber;
    created_at: z.ZodNumber;
}, z.core.$strip>;
export type TelemetryEventRecord = z.infer<typeof TelemetryEventRecordSchema>;
export declare const TelemetryStatsRecordSchema: z.ZodObject<{
    id: z.ZodNumber;
    stat_date: z.ZodString;
    stat_type: z.ZodString;
    stat_key: z.ZodString;
    count: z.ZodNumber;
    total_duration: z.ZodNullable<z.ZodNumber>;
    avg_duration: z.ZodNullable<z.ZodNumber>;
    min_duration: z.ZodNullable<z.ZodNumber>;
    max_duration: z.ZodNullable<z.ZodNumber>;
    metadata: z.ZodNullable<z.ZodString>;
    updated_at: z.ZodNumber;
}, z.core.$strip>;
export type TelemetryStatsRecord = z.infer<typeof TelemetryStatsRecordSchema>;
export declare const SubmissionConfigSchema: z.ZodObject<{
    endpoint: z.ZodString;
    apiKey: z.ZodOptional<z.ZodString>;
    timeout: z.ZodDefault<z.ZodNumber>;
    maxRetries: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type SubmissionConfig = z.infer<typeof SubmissionConfigSchema>;
export declare const SubmissionResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    accepted: z.ZodNumber;
    rejected: z.ZodNumber;
    errors: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type SubmissionResult = z.infer<typeof SubmissionResultSchema>;
export declare const ServerInfoSchema: z.ZodObject<{
    version: z.ZodString;
    status: z.ZodEnum<{
        healthy: "healthy";
        degraded: "degraded";
        down: "down";
    }>;
    acceptingEvents: z.ZodBoolean;
    maxBatchSize: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type ServerInfo = z.infer<typeof ServerInfoSchema>;
//# sourceMappingURL=telemetry.schema.d.ts.map