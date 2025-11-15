/**
 * MetricsCollector.ts
 *
 * Performance metrics collection and aggregation
 * Phase 6 Week 1: Advanced Monitoring & Observability
 */
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { getDatabase } from '../database/connection.js';
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
export class MetricsCollector extends EventEmitter {
    db;
    metricsBuffer = [];
    bufferSize = 100;
    flushInterval = null;
    constructor(db, bufferSize = 100) {
        super();
        this.db = db || getDatabase();
        this.bufferSize = bufferSize;
        this.initializeSchema();
        this.startAutoFlush();
    }
    /**
     * Initialize metrics schema
     */
    initializeSchema() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        metric_type TEXT NOT NULL,
        value REAL NOT NULL,
        unit TEXT NOT NULL,
        labels TEXT NOT NULL,
        tenant_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_metrics_type_timestamp ON performance_metrics(metric_type, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_metrics_tenant ON performance_metrics(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON performance_metrics(timestamp DESC);
    `);
    }
    /**
     * Record a metric
     */
    record(metricType, value, options) {
        const metric = {
            id: randomUUID(),
            timestamp: Date.now(),
            metricType,
            value,
            unit: options?.unit || this.getDefaultUnit(metricType),
            labels: options?.labels || {},
            tenantId: options?.tenantId,
        };
        this.metricsBuffer.push(metric);
        // Auto-flush if buffer is full
        if (this.metricsBuffer.length >= this.bufferSize) {
            this.flush();
        }
        this.emit('metric.recorded', metric);
    }
    /**
     * Record a metric (alias for record() for compatibility)
     */
    recordMetric(name, value, labels) {
        // Convert to MetricType - use 'custom' as default
        const metricType = name;
        const stringLabels = {};
        if (labels) {
            for (const [key, val] of Object.entries(labels)) {
                stringLabels[key] = String(val);
            }
        }
        this.record(metricType, value, { labels: stringLabels });
    }
    /**
     * Flush metrics buffer to database
     */
    flush() {
        if (this.metricsBuffer.length === 0)
            return;
        const transaction = this.db.transaction((metrics) => {
            const stmt = this.db.prepare(`
        INSERT INTO performance_metrics (
          id, timestamp, metric_type, value, unit, labels, tenant_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
            for (const metric of metrics) {
                stmt.run(metric.id, metric.timestamp, metric.metricType, metric.value, metric.unit, JSON.stringify(metric.labels), metric.tenantId || null);
            }
        });
        try {
            transaction(this.metricsBuffer);
            this.metricsBuffer = [];
        }
        catch (error) {
            this.emit('flush_error', error);
        }
    }
    /**
     * Start auto-flush interval
     */
    startAutoFlush() {
        // Flush every 10 seconds
        this.flushInterval = setInterval(() => {
            this.flush();
        }, 10000);
    }
    /**
     * Stop auto-flush
     */
    stop() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
        this.flush(); // Final flush
    }
    /**
     * Query metrics aggregation
     */
    getAggregation(metricType, startTime, endTime, tenantId) {
        let query = `
      SELECT
        COUNT(*) as count,
        SUM(value) as sum,
        AVG(value) as avg,
        MIN(value) as min,
        MAX(value) as max
      FROM performance_metrics
      WHERE metric_type = ?
        AND timestamp >= ?
        AND timestamp <= ?
    `;
        const params = [metricType, startTime, endTime];
        if (tenantId) {
            query += ` AND tenant_id = ?`;
            params.push(tenantId);
        }
        const row = this.db.prepare(query).get(...params);
        if (!row || row.count === 0)
            return null;
        // Calculate percentiles
        const percentiles = this.calculatePercentiles(metricType, startTime, endTime, tenantId);
        return {
            metricType,
            startTime,
            endTime,
            count: row.count,
            sum: row.sum,
            avg: row.avg,
            min: row.min,
            max: row.max,
            p50: percentiles.p50,
            p95: percentiles.p95,
            p99: percentiles.p99,
        };
    }
    /**
     * Calculate percentiles (p50, p95, p99)
     */
    calculatePercentiles(metricType, startTime, endTime, tenantId) {
        let query = `
      SELECT value
      FROM performance_metrics
      WHERE metric_type = ?
        AND timestamp >= ?
        AND timestamp <= ?
    `;
        const params = [metricType, startTime, endTime];
        if (tenantId) {
            query += ` AND tenant_id = ?`;
            params.push(tenantId);
        }
        query += ` ORDER BY value ASC`;
        const rows = this.db.prepare(query).all(...params);
        if (rows.length === 0) {
            return { p50: 0, p95: 0, p99: 0 };
        }
        const values = rows.map(r => r.value);
        return {
            p50: this.percentile(values, 0.50),
            p95: this.percentile(values, 0.95),
            p99: this.percentile(values, 0.99),
        };
    }
    /**
     * Calculate percentile from sorted array
     */
    percentile(sortedValues, p) {
        const index = Math.ceil(sortedValues.length * p) - 1;
        return sortedValues[Math.max(0, index)];
    }
    /**
     * Get time series data
     */
    getTimeSeries(metricType, startTime, endTime, intervalMs = 60000, // 1 minute buckets
    labels, tenantId) {
        let query = `
      SELECT
        (timestamp / ?) * ? as bucket_time,
        AVG(value) as value
      FROM performance_metrics
      WHERE metric_type = ?
        AND timestamp >= ?
        AND timestamp <= ?
    `;
        const params = [intervalMs, intervalMs, metricType, startTime, endTime];
        if (tenantId) {
            query += ` AND tenant_id = ?`;
            params.push(tenantId);
        }
        // Filter by labels
        if (labels) {
            for (const [key, value] of Object.entries(labels)) {
                query += ` AND json_extract(labels, '$.${key}') = ?`;
                params.push(value);
            }
        }
        query += ` GROUP BY bucket_time ORDER BY bucket_time ASC`;
        const rows = this.db.prepare(query).all(...params);
        const dataPoints = rows.map(row => ({
            timestamp: row.bucket_time,
            value: row.value,
        }));
        return {
            metricType,
            labels: labels || {},
            dataPoints,
        };
    }
    /**
     * Get default unit for metric type
     */
    getDefaultUnit(metricType) {
        if (metricType.includes('.duration'))
            return 'ms';
        if (metricType.includes('.count'))
            return 'count';
        if (metricType.includes('.rate'))
            return 'rate';
        if (metricType.includes('.usage'))
            return 'percent';
        if (metricType.includes('.size'))
            return 'bytes';
        return 'count';
    }
    /**
     * Cleanup old metrics (retention policy)
     */
    async cleanup(retentionDays = 90) {
        const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
        const result = this.db.prepare(`
      DELETE FROM performance_metrics
      WHERE timestamp < ?
    `).run(cutoff);
        return result.changes;
    }
    /**
     * Get metric count by type
     */
    getMetricCount(metricType, tenantId) {
        let query = `SELECT COUNT(*) as count FROM performance_metrics`;
        const conditions = [];
        const params = [];
        if (metricType) {
            conditions.push('metric_type = ?');
            params.push(metricType);
        }
        if (tenantId) {
            conditions.push('tenant_id = ?');
            params.push(tenantId);
        }
        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }
        const row = this.db.prepare(query).get(...params);
        return row.count;
    }
}
//# sourceMappingURL=MetricsCollector.js.map