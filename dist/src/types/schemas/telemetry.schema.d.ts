import { z } from 'zod';
/**
 * Telemetry Event Schema
 *
 * Defines the structure for telemetry events collected by the system.
 * Events are stored in SQLite and used for analytics.
 */
export declare const EventTypeSchema: z.ZodEnum<["command_executed", "query_performed", "parser_invoked", "error_occurred", "performance_metric", "feature_used"]>;
export type EventType = z.infer<typeof EventTypeSchema>;
export declare const TelemetryEventSchema: z.ZodObject<{
    sessionId: z.ZodString;
    eventType: z.ZodEnum<["command_executed", "query_performed", "parser_invoked", "error_occurred", "performance_metric", "feature_used"]>;
    eventData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    timestamp: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    timestamp: number;
    eventType: "error_occurred" | "command_executed" | "query_performed" | "parser_invoked" | "performance_metric" | "feature_used";
    sessionId: string;
    eventData?: Record<string, unknown> | undefined;
}, {
    timestamp: number;
    eventType: "error_occurred" | "command_executed" | "query_performed" | "parser_invoked" | "performance_metric" | "feature_used";
    sessionId: string;
    eventData?: Record<string, unknown> | undefined;
}>;
export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;
export declare const CommandEventDataSchema: z.ZodObject<{
    command: z.ZodString;
    args: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    duration: z.ZodNumber;
    exitCode: z.ZodNumber;
    error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    duration: number;
    command: string;
    exitCode: number;
    error?: string | undefined;
    args?: string[] | undefined;
}, {
    duration: number;
    command: string;
    exitCode: number;
    error?: string | undefined;
    args?: string[] | undefined;
}>;
export type CommandEventData = z.infer<typeof CommandEventDataSchema>;
export declare const QueryEventDataSchema: z.ZodObject<{
    queryType: z.ZodEnum<["symbol", "text", "hybrid"]>;
    query: z.ZodString;
    resultCount: z.ZodNumber;
    duration: z.ZodNumber;
    cached: z.ZodBoolean;
    language: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    query: string;
    cached: boolean;
    duration: number;
    queryType: "symbol" | "text" | "hybrid";
    resultCount: number;
    language?: string | undefined;
}, {
    query: string;
    cached: boolean;
    duration: number;
    queryType: "symbol" | "text" | "hybrid";
    resultCount: number;
    language?: string | undefined;
}>;
export type QueryEventData = z.infer<typeof QueryEventDataSchema>;
export declare const ParserEventDataSchema: z.ZodObject<{
    language: z.ZodString;
    fileExtension: z.ZodString;
    duration: z.ZodNumber;
    symbolCount: z.ZodNumber;
    lineCount: z.ZodNumber;
    error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    language: string;
    duration: number;
    fileExtension: string;
    symbolCount: number;
    lineCount: number;
    error?: string | undefined;
}, {
    language: string;
    duration: number;
    fileExtension: string;
    symbolCount: number;
    lineCount: number;
    error?: string | undefined;
}>;
export type ParserEventData = z.infer<typeof ParserEventDataSchema>;
export declare const ErrorEventDataSchema: z.ZodObject<{
    errorType: z.ZodString;
    message: z.ZodString;
    stack: z.ZodOptional<z.ZodString>;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    fatal: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    message: string;
    fatal: boolean;
    errorType: string;
    context?: Record<string, string> | undefined;
    stack?: string | undefined;
}, {
    message: string;
    fatal: boolean;
    errorType: string;
    context?: Record<string, string> | undefined;
    stack?: string | undefined;
}>;
export type ErrorEventData = z.infer<typeof ErrorEventDataSchema>;
export declare const PerformanceMetricSchema: z.ZodObject<{
    metricName: z.ZodString;
    value: z.ZodNumber;
    unit: z.ZodEnum<["ms", "bytes", "count", "percentage"]>;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    value: number;
    unit: "count" | "ms" | "bytes" | "percentage";
    metricName: string;
    context?: Record<string, string> | undefined;
}, {
    value: number;
    unit: "count" | "ms" | "bytes" | "percentage";
    metricName: string;
    context?: Record<string, string> | undefined;
}>;
export type PerformanceMetric = z.infer<typeof PerformanceMetricSchema>;
export declare const FeatureUsageSchema: z.ZodObject<{
    featureName: z.ZodString;
    enabled: z.ZodBoolean;
    variant: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    featureName: string;
    variant?: string | undefined;
}, {
    enabled: boolean;
    featureName: string;
    variant?: string | undefined;
}>;
export type FeatureUsage = z.infer<typeof FeatureUsageSchema>;
export declare const TelemetryConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    remote: z.ZodDefault<z.ZodBoolean>;
    sessionId: z.ZodString;
    consentDate: z.ZodOptional<z.ZodNumber>;
    optOutDate: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    sessionId: string;
    remote: boolean;
    consentDate?: number | undefined;
    optOutDate?: number | undefined;
}, {
    sessionId: string;
    enabled?: boolean | undefined;
    remote?: boolean | undefined;
    consentDate?: number | undefined;
    optOutDate?: number | undefined;
}>;
export type TelemetryConfig = z.infer<typeof TelemetryConfigSchema>;
export declare const TelemetryStatsSchema: z.ZodObject<{
    statDate: z.ZodString;
    statType: z.ZodEnum<["command", "query", "error", "performance"]>;
    statKey: z.ZodString;
    count: z.ZodNumber;
    totalDuration: z.ZodOptional<z.ZodNumber>;
    avgDuration: z.ZodOptional<z.ZodNumber>;
    minDuration: z.ZodOptional<z.ZodNumber>;
    maxDuration: z.ZodOptional<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    count: number;
    statDate: string;
    statType: "performance" | "error" | "query" | "command";
    statKey: string;
    metadata?: Record<string, unknown> | undefined;
    totalDuration?: number | undefined;
    avgDuration?: number | undefined;
    minDuration?: number | undefined;
    maxDuration?: number | undefined;
}, {
    count: number;
    statDate: string;
    statType: "performance" | "error" | "query" | "command";
    statKey: string;
    metadata?: Record<string, unknown> | undefined;
    totalDuration?: number | undefined;
    avgDuration?: number | undefined;
    minDuration?: number | undefined;
    maxDuration?: number | undefined;
}>;
export type TelemetryStats = z.infer<typeof TelemetryStatsSchema>;
export declare const TelemetryEventRecordSchema: z.ZodObject<{
    id: z.ZodNumber;
    session_id: z.ZodString;
    event_type: z.ZodString;
    event_data: z.ZodNullable<z.ZodString>;
    timestamp: z.ZodNumber;
    created_at: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: number;
    created_at: number;
    timestamp: number;
    session_id: string;
    event_type: string;
    event_data: string | null;
}, {
    id: number;
    created_at: number;
    timestamp: number;
    session_id: string;
    event_type: string;
    event_data: string | null;
}>;
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
}, "strip", z.ZodTypeAny, {
    id: number;
    count: number;
    metadata: string | null;
    updated_at: number;
    stat_date: string;
    stat_type: string;
    stat_key: string;
    total_duration: number | null;
    avg_duration: number | null;
    min_duration: number | null;
    max_duration: number | null;
}, {
    id: number;
    count: number;
    metadata: string | null;
    updated_at: number;
    stat_date: string;
    stat_type: string;
    stat_key: string;
    total_duration: number | null;
    avg_duration: number | null;
    min_duration: number | null;
    max_duration: number | null;
}>;
export type TelemetryStatsRecord = z.infer<typeof TelemetryStatsRecordSchema>;
export declare const SubmissionConfigSchema: z.ZodObject<{
    endpoint: z.ZodString;
    apiKey: z.ZodOptional<z.ZodString>;
    timeout: z.ZodDefault<z.ZodNumber>;
    maxRetries: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    endpoint: string;
    timeout: number;
    maxRetries: number;
    apiKey?: string | undefined;
}, {
    endpoint: string;
    timeout?: number | undefined;
    apiKey?: string | undefined;
    maxRetries?: number | undefined;
}>;
export type SubmissionConfig = z.infer<typeof SubmissionConfigSchema>;
export declare const SubmissionResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    accepted: z.ZodNumber;
    rejected: z.ZodNumber;
    errors: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    accepted: number;
    rejected: number;
    errors?: string[] | undefined;
}, {
    success: boolean;
    accepted: number;
    rejected: number;
    errors?: string[] | undefined;
}>;
export type SubmissionResult = z.infer<typeof SubmissionResultSchema>;
export declare const ServerInfoSchema: z.ZodObject<{
    version: z.ZodString;
    status: z.ZodEnum<["healthy", "degraded", "down"]>;
    acceptingEvents: z.ZodBoolean;
    maxBatchSize: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    version: string;
    status: "healthy" | "degraded" | "down";
    acceptingEvents: boolean;
    maxBatchSize?: number | undefined;
}, {
    version: string;
    status: "healthy" | "degraded" | "down";
    acceptingEvents: boolean;
    maxBatchSize?: number | undefined;
}>;
export type ServerInfo = z.infer<typeof ServerInfoSchema>;
//# sourceMappingURL=telemetry.schema.d.ts.map