/**
 * MetricsCollector.ts
 *
 * Real-time metrics collection service for monitoring provider performance,
 * costs, cache efficiency, and rate limiting.
 *
 * Phase 3 Week 3 Day 11-12: Metrics Collection
 */
import type { ProviderType } from '../types/schemas/provider.schema.js';
/**
 * Metric event types
 */
export type MetricType = 'request' | 'cache' | 'rate_limit';
/**
 * Request metric event
 */
export interface RequestMetric {
    type: 'request';
    provider: ProviderType;
    model: string;
    userId?: string;
    latency: number;
    success: boolean;
    errorMessage?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    cost?: number;
    metadata?: Record<string, any>;
    timestamp: number;
}
/**
 * Cache metric event
 */
export interface CacheMetric {
    type: 'cache';
    event: 'hit' | 'miss' | 'store';
    provider?: ProviderType;
    savedCost?: number;
    savedTokens?: number;
    timestamp: number;
}
/**
 * Rate limit metric event
 */
export interface RateLimitMetric {
    type: 'rate_limit';
    event: 'allowed' | 'denied';
    rateLimitType: 'user' | 'provider' | 'ip' | 'global';
    key: string;
    remaining?: number;
    timestamp: number;
}
/**
 * Union type for all metrics
 */
export type Metric = RequestMetric | CacheMetric | RateLimitMetric;
/**
 * Metric query filters
 */
export interface MetricQuery {
    startTime?: number;
    endTime?: number;
    provider?: ProviderType;
    model?: string;
    userId?: string;
    metricType?: MetricType;
    limit?: number;
    offset?: number;
}
/**
 * Aggregated metrics result
 */
export interface AggregatedMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    avgLatency: number;
    minLatency: number;
    maxLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    totalCost: number;
    avgCostPerRequest: number;
    totalTokens: number;
    cacheHits: number;
    cacheMisses: number;
    cacheHitRate: number;
    cacheSavedCost: number;
    rateLimitAllowed: number;
    rateLimitDenied: number;
}
/**
 * Provider health status
 */
export interface ProviderHealth {
    provider: ProviderType;
    status: 'healthy' | 'degraded' | 'down';
    latency: number;
    p95Latency: number;
    successRate: number;
    errorRate: number;
    requestCount: number;
    requestsLastHour: number;
    cost: number;
    costToday: number;
    lastRequest: number;
}
/**
 * Time series bucket data
 */
export interface TimeSeriesBucket {
    bucket: number;
    count: number;
    avgLatency: number;
    totalCost: number;
    successful: number;
}
/**
 * MetricsCollector - Real-time metrics collection and querying
 *
 * Features:
 * - Async metric recording (non-blocking)
 * - Batch writes for performance
 * - Time-series queries with filters
 * - Aggregated statistics
 * - Provider health monitoring
 */
export declare class MetricsCollector {
    private db;
    private writeQueue;
    private readonly batchSize;
    private readonly flushInterval;
    private flushTimer?;
    constructor();
    /**
     * Record a metric event (async, non-blocking)
     */
    record(metric: Metric): Promise<void>;
    /**
     * Start periodic flush timer
     */
    private startFlushTimer;
    /**
     * Flush write queue to database
     */
    private flush;
    /**
     * Query raw metrics with filters
     */
    query(filters?: MetricQuery): Promise<Metric[]>;
    /**
     * Get aggregated metrics for a time range
     */
    getAggregated(filters?: MetricQuery): Promise<AggregatedMetrics>;
    /**
     * Get provider health status
     */
    getProviderHealth(): Promise<ProviderHealth[]>;
    /**
     * Get metrics grouped by time buckets
     */
    getTimeSeries(bucketSize: '1min' | '5min' | '1hour' | '1day', filters?: MetricQuery): Promise<TimeSeriesBucket[]>;
    /**
     * Clean up old metrics (retention policy)
     */
    cleanup(retentionDays?: number): Promise<number>;
    /**
     * Get total metric count
     */
    getCount(filters?: MetricQuery): Promise<number>;
    /**
     * Stop flush timer (cleanup)
     */
    destroy(): void;
    /**
     * Convert database row to Metric object
     */
    private rowToMetric;
}
//# sourceMappingURL=MetricsCollector.d.ts.map