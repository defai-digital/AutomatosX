/**
 * MetricsCollector.ts
 *
 * Performance metrics collection and aggregation
 * Phase 6 Week 1: Advanced Monitoring & Observability
 */
import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { MetricType, MetricAggregation, TimeSeries } from '../types/monitoring.types.js';
/**
 * MetricsCollector - Performance metrics collection and aggregation
 *
 * Features:
 * - Record performance metrics
 * - Time-series data storage
 * - Real-time aggregation (avg, p50, p95, p99)
 * - Query metrics by type and time range
 * - Automatic retention policy
 */
export declare class MetricsCollector extends EventEmitter {
    private db;
    private metricsBuffer;
    private bufferSize;
    private flushInterval;
    constructor(db?: Database.Database, bufferSize?: number);
    /**
     * Initialize metrics schema
     */
    private initializeSchema;
    /**
     * Record a metric
     */
    record(metricType: MetricType, value: number, options?: {
        unit?: string;
        labels?: Record<string, string>;
        tenantId?: string;
    }): void;
    /**
     * Record a metric (alias for record() for compatibility)
     */
    recordMetric(name: string, value: number, labels?: Record<string, string | number>): void;
    /**
     * Flush metrics buffer to database
     */
    flush(): void;
    /**
     * Start auto-flush interval
     */
    private startAutoFlush;
    /**
     * Stop auto-flush
     */
    stop(): void;
    /**
     * Query metrics aggregation
     */
    getAggregation(metricType: MetricType, startTime: number, endTime: number, tenantId?: string): MetricAggregation | null;
    /**
     * Calculate percentiles (p50, p95, p99)
     */
    private calculatePercentiles;
    /**
     * Calculate percentile from sorted array
     */
    private percentile;
    /**
     * Get time series data
     */
    getTimeSeries(metricType: MetricType, startTime: number, endTime: number, intervalMs?: number, // 1 minute buckets
    labels?: Record<string, string>, tenantId?: string): TimeSeries;
    /**
     * Get default unit for metric type
     */
    private getDefaultUnit;
    /**
     * Cleanup old metrics (retention policy)
     */
    cleanup(retentionDays?: number): Promise<number>;
    /**
     * Get metric count by type
     */
    getMetricCount(metricType?: MetricType, tenantId?: string): number;
}
//# sourceMappingURL=MetricsCollector.d.ts.map