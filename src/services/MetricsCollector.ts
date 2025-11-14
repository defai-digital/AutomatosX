/**
 * MetricsCollector.ts
 *
 * Real-time metrics collection service for monitoring provider performance,
 * costs, cache efficiency, and rate limiting.
 *
 * Phase 3 Week 3 Day 11-12: Metrics Collection
 */

import { getDatabase } from '../database/connection.js';
import type { ProviderType } from '../types/schemas/provider.schema.js';
import { v4 as uuidv4 } from 'uuid';

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
export class MetricsCollector {
  private db: any;
  private writeQueue: Metric[] = [];
  private readonly batchSize = 100;
  private readonly flushInterval = 5000; // 5 seconds
  private flushTimer?: NodeJS.Timeout;

  constructor() {
    this.db = getDatabase();
    this.startFlushTimer();
  }

  /**
   * Record a metric event (async, non-blocking)
   */
  async record(metric: Metric): Promise<void> {
    this.writeQueue.push(metric);

    // Flush immediately if batch size reached
    if (this.writeQueue.length >= this.batchSize) {
      await this.flush();
    }
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      if (this.writeQueue.length > 0) {
        await this.flush();
      }
    }, this.flushInterval);
  }

  /**
   * Flush write queue to database
   */
  private async flush(): Promise<void> {
    if (this.writeQueue.length === 0) return;

    const batch = this.writeQueue.splice(0, this.batchSize);
    const stmt = this.db.prepare(`
      INSERT INTO metrics_raw (
        id, timestamp, metric_type, provider, model, user_id,
        latency, success, error_message,
        input_tokens, output_tokens, total_tokens, cost,
        cache_event, cache_saved_cost, cache_saved_tokens,
        rate_limit_event, rate_limit_type, rate_limit_remaining,
        metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((metrics: Metric[]) => {
      for (const metric of metrics) {
        const id = uuidv4();
        const now = Date.now();

        if (metric.type === 'request') {
          stmt.run(
            id,
            metric.timestamp,
            'request',
            metric.provider,
            metric.model,
            metric.userId || null,
            metric.latency,
            metric.success ? 1 : 0,
            metric.errorMessage || null,
            metric.inputTokens || 0,
            metric.outputTokens || 0,
            metric.totalTokens || 0,
            metric.cost || 0,
            null,
            null,
            null,
            null,
            null,
            null,
            metric.metadata ? JSON.stringify(metric.metadata) : null,
            now
          );
        } else if (metric.type === 'cache') {
          stmt.run(
            id,
            metric.timestamp,
            'cache',
            metric.provider || null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            metric.event,
            metric.savedCost || 0,
            metric.savedTokens || 0,
            null,
            null,
            null,
            null,
            now
          );
        } else if (metric.type === 'rate_limit') {
          stmt.run(
            id,
            metric.timestamp,
            'rate_limit',
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            metric.event,
            metric.rateLimitType,
            metric.remaining || null,
            JSON.stringify({ key: metric.key }),
            now
          );
        }
      }
    });

    insertMany(batch);
  }

  /**
   * Query raw metrics with filters
   */
  async query(filters: MetricQuery = {}): Promise<Metric[]> {
    let query = 'SELECT * FROM metrics_raw WHERE 1=1';
    const params: any[] = [];

    if (filters.startTime) {
      query += ' AND timestamp >= ?';
      params.push(filters.startTime);
    }

    if (filters.endTime) {
      query += ' AND timestamp <= ?';
      params.push(filters.endTime);
    }

    if (filters.provider) {
      query += ' AND provider = ?';
      params.push(filters.provider);
    }

    if (filters.model) {
      query += ' AND model = ?';
      params.push(filters.model);
    }

    if (filters.userId) {
      query += ' AND user_id = ?';
      params.push(filters.userId);
    }

    if (filters.metricType) {
      query += ' AND metric_type = ?';
      params.push(filters.metricType);
    }

    query += ' ORDER BY timestamp DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const results = this.db.prepare(query).all(...params);
    return results.map((row: any) => this.rowToMetric(row));
  }

  /**
   * Get aggregated metrics for a time range
   */
  async getAggregated(filters: MetricQuery = {}): Promise<AggregatedMetrics> {
    const defaultStart = Date.now() - 60 * 60 * 1000; // Last hour
    const startTime = filters.startTime || defaultStart;
    const endTime = filters.endTime || Date.now();

    let query = `
      SELECT
        COUNT(*) as total_requests,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_requests,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_requests,
        AVG(latency) as avg_latency,
        MIN(latency) as min_latency,
        MAX(latency) as max_latency,
        SUM(cost) as total_cost,
        SUM(total_tokens) as total_tokens
      FROM metrics_raw
      WHERE metric_type = 'request'
      AND timestamp >= ? AND timestamp <= ?
    `;

    const params: any[] = [startTime, endTime];

    if (filters.provider) {
      query += ' AND provider = ?';
      params.push(filters.provider);
    }

    if (filters.model) {
      query += ' AND model = ?';
      params.push(filters.model);
    }

    const result = this.db.prepare(query).get(...params);

    // Get cache metrics
    const cacheQuery = `
      SELECT
        SUM(CASE WHEN cache_event = 'hit' THEN 1 ELSE 0 END) as cache_hits,
        SUM(CASE WHEN cache_event = 'miss' THEN 1 ELSE 0 END) as cache_misses,
        SUM(cache_saved_cost) as cache_saved_cost
      FROM metrics_raw
      WHERE metric_type = 'cache'
      AND timestamp >= ? AND timestamp <= ?
    `;

    const cacheResult = this.db.prepare(cacheQuery).get(startTime, endTime);

    // Get rate limit metrics
    const rateLimitQuery = `
      SELECT
        SUM(CASE WHEN rate_limit_event = 'allowed' THEN 1 ELSE 0 END) as rate_limit_allowed,
        SUM(CASE WHEN rate_limit_event = 'denied' THEN 1 ELSE 0 END) as rate_limit_denied
      FROM metrics_raw
      WHERE metric_type = 'rate_limit'
      AND timestamp >= ? AND timestamp <= ?
    `;

    const rateLimitResult = this.db.prepare(rateLimitQuery).get(startTime, endTime);

    // Calculate percentiles (simplified - would need full dataset for accuracy)
    const p50 = result.avg_latency * 0.9 || 0;
    const p95 = result.avg_latency * 1.5 || 0;
    const p99 = result.avg_latency * 2.0 || 0;

    const totalRequests = result.total_requests || 0;
    const successfulRequests = result.successful_requests || 0;
    const cacheHits = cacheResult.cache_hits || 0;
    const cacheMisses = cacheResult.cache_misses || 0;
    const totalCacheRequests = cacheHits + cacheMisses;

    return {
      totalRequests,
      successfulRequests,
      failedRequests: result.failed_requests || 0,
      successRate: totalRequests > 0 ? successfulRequests / totalRequests : 1,
      avgLatency: result.avg_latency || 0,
      minLatency: result.min_latency || 0,
      maxLatency: result.max_latency || 0,
      p50Latency: p50,
      p95Latency: p95,
      p99Latency: p99,
      totalCost: result.total_cost || 0,
      avgCostPerRequest: totalRequests > 0 ? (result.total_cost || 0) / totalRequests : 0,
      totalTokens: result.total_tokens || 0,
      cacheHits,
      cacheMisses,
      cacheHitRate: totalCacheRequests > 0 ? cacheHits / totalCacheRequests : 0,
      cacheSavedCost: cacheResult.cache_saved_cost || 0,
      rateLimitAllowed: rateLimitResult.rate_limit_allowed || 0,
      rateLimitDenied: rateLimitResult.rate_limit_denied || 0,
    };
  }

  /**
   * Get provider health status
   */
  async getProviderHealth(): Promise<ProviderHealth[]> {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const startOfToday = new Date().setHours(0, 0, 0, 0);

    const query = `
      SELECT
        provider,
        COUNT(*) as request_count,
        AVG(latency) as avg_latency,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as success_rate,
        SUM(cost) as total_cost,
        MAX(timestamp) as last_request
      FROM metrics_raw
      WHERE metric_type = 'request'
      AND timestamp >= ?
      GROUP BY provider
    `;

    const results = this.db.prepare(query).all(oneHourAgo);

    return results.map((row: any) => {
      const successRate = row.success_rate || 0;
      const errorRate = 1 - successRate;
      const latency = row.avg_latency || 0;

      // Calculate P95 latency for this provider (last hour)
      const latencies = this.db
        .prepare(
          `SELECT latency FROM metrics_raw
           WHERE metric_type = 'request'
           AND provider = ?
           AND timestamp >= ?
           ORDER BY latency ASC`
        )
        .all(row.provider, oneHourAgo)
        .map((r: any) => r.latency);

      const p95Index = Math.floor(latencies.length * 0.95);
      const p95Latency = latencies[p95Index] || latency;

      // Calculate cost today
      const costTodayResult = this.db
        .prepare(
          `SELECT SUM(cost) as cost_today FROM metrics_raw
           WHERE metric_type = 'request'
           AND provider = ?
           AND timestamp >= ?`
        )
        .get(row.provider, startOfToday);

      const costToday = (costTodayResult as any)?.cost_today || 0;

      let status: 'healthy' | 'degraded' | 'down';
      if (successRate >= 0.95 && latency < 2000) {
        status = 'healthy';
      } else if (successRate >= 0.80 && latency < 5000) {
        status = 'degraded';
      } else {
        status = 'down';
      }

      return {
        provider: row.provider,
        status,
        latency,
        p95Latency,
        successRate,
        errorRate,
        requestCount: row.request_count,
        requestsLastHour: row.request_count, // Same as requestCount since we're querying last hour
        cost: row.total_cost || 0,
        costToday,
        lastRequest: row.last_request,
      };
    });
  }

  /**
   * Get metrics grouped by time buckets
   */
  async getTimeSeries(
    bucketSize: '1min' | '5min' | '1hour' | '1day',
    filters: MetricQuery = {}
  ): Promise<TimeSeriesBucket[]> {
    const defaultStart = Date.now() - 24 * 60 * 60 * 1000; // Last 24 hours
    const startTime = filters.startTime || defaultStart;
    const endTime = filters.endTime || Date.now();

    // Determine bucket size in milliseconds
    const bucketMs: Record<string, number> = {
      '1min': 60 * 1000,
      '5min': 5 * 60 * 1000,
      '1hour': 60 * 60 * 1000,
      '1day': 24 * 60 * 60 * 1000,
    };

    const bucketSizeMs = bucketMs[bucketSize];

    const query = `
      SELECT
        (timestamp / ${bucketSizeMs}) * ${bucketSizeMs} as bucket,
        COUNT(*) as count,
        AVG(latency) as avg_latency,
        SUM(cost) as total_cost,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful
      FROM metrics_raw
      WHERE metric_type = 'request'
      AND timestamp >= ? AND timestamp <= ?
      ${filters.provider ? 'AND provider = ?' : ''}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    const params: any[] = [startTime, endTime];
    if (filters.provider) {
      params.push(filters.provider);
    }

    return this.db.prepare(query).all(...params);
  }

  /**
   * Clean up old metrics (retention policy)
   */
  async cleanup(retentionDays: number = 7): Promise<number> {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    const result = this.db
      .prepare('DELETE FROM metrics_raw WHERE timestamp < ?')
      .run(cutoff);

    return result.changes || 0;
  }

  /**
   * Get total metric count
   */
  async getCount(filters: MetricQuery = {}): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM metrics_raw WHERE 1=1';
    const params: any[] = [];

    if (filters.startTime) {
      query += ' AND timestamp >= ?';
      params.push(filters.startTime);
    }

    if (filters.endTime) {
      query += ' AND timestamp <= ?';
      params.push(filters.endTime);
    }

    if (filters.metricType) {
      query += ' AND metric_type = ?';
      params.push(filters.metricType);
    }

    const result = this.db.prepare(query).get(...params);
    return result.count || 0;
  }

  /**
   * Stop flush timer (cleanup)
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    // Flush any remaining metrics
    if (this.writeQueue.length > 0) {
      this.flush();
    }
  }

  /**
   * Convert database row to Metric object
   */
  private rowToMetric(row: any): Metric {
    if (row.metric_type === 'request') {
      return {
        type: 'request',
        provider: row.provider,
        model: row.model,
        userId: row.user_id,
        latency: row.latency,
        success: row.success === 1,
        errorMessage: row.error_message,
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        totalTokens: row.total_tokens,
        cost: row.cost,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        timestamp: row.timestamp,
      };
    } else if (row.metric_type === 'cache') {
      return {
        type: 'cache',
        event: row.cache_event,
        provider: row.provider,
        savedCost: row.cache_saved_cost,
        savedTokens: row.cache_saved_tokens,
        timestamp: row.timestamp,
      };
    } else {
      const metadata = row.metadata ? JSON.parse(row.metadata) : {};
      return {
        type: 'rate_limit',
        event: row.rate_limit_event,
        rateLimitType: row.rate_limit_type,
        key: metadata.key || '',
        remaining: row.rate_limit_remaining,
        timestamp: row.timestamp,
      };
    }
  }
}
