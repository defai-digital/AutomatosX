/**
 * MCP Metrics Collector
 *
 * Collects performance metrics for MCP servers including:
 * - CPU usage
 * - Memory usage
 * - Response times
 * - Request counts
 * - Error rates
 *
 * Phase 4D: Performance Monitoring & Metrics
 *
 * @module mcp/metrics-collector
 */

import { logger } from '../shared/logging/logger.js';

/**
 * Server Metrics
 */
export interface ServerMetrics {
  /** Server name */
  serverName: string;

  /** Metrics collection timestamp */
  timestamp: Date;

  /** CPU usage percentage (0-100) */
  cpuUsagePercent: number;

  /** Memory usage in MB */
  memoryUsageMB: number;

  /** Server uptime in seconds */
  uptimeSeconds: number;

  /** Total requests handled */
  totalRequests: number;

  /** Failed requests count */
  failedRequests: number;

  /** Average response time in ms */
  avgResponseTimeMs: number;

  /** Min response time in ms */
  minResponseTimeMs: number;

  /** Max response time in ms */
  maxResponseTimeMs: number;

  /** Restart count */
  restartCount: number;
}

/**
 * Aggregated Metrics Summary
 */
export interface MetricsSummary {
  /** Total servers monitored */
  totalServers: number;

  /** Healthy servers count */
  healthyServers: number;

  /** Total CPU usage across all servers */
  totalCpuUsagePercent: number;

  /** Total memory usage across all servers (MB) */
  totalMemoryUsageMB: number;

  /** Total requests handled */
  totalRequests: number;

  /** Total failed requests */
  totalFailedRequests: number;

  /** Overall error rate percentage */
  errorRatePercent: number;

  /** Average response time across all servers */
  avgResponseTimeMs: number;

  /** Total restart count */
  totalRestarts: number;

  /** Collection timestamp */
  timestamp: Date;
}

/**
 * Metrics Collector Options
 */
export interface MetricsCollectorOptions {
  /** Enable metrics collection */
  enabled?: boolean;

  /** Collection interval in milliseconds */
  collectionIntervalMs?: number;

  /** Retention period in hours */
  retentionHours?: number;

  /** Maximum metrics history size */
  maxHistorySize?: number;
}

/**
 * Metrics time-series data point
 */
interface MetricsDataPoint {
  timestamp: number;
  metrics: ServerMetrics;
}

/**
 * MCP Metrics Collector
 *
 * Collects and stores performance metrics for MCP servers.
 */
export class MetricsCollector {
  private enabled: boolean;
  private collectionIntervalMs: number;
  private retentionHours: number;
  private maxHistorySize: number;
  private collectionInterval?: NodeJS.Timeout;

  // Metrics storage: serverName -> time-series data
  private metricsHistory: Map<string, MetricsDataPoint[]> = new Map();

  // Request tracking: serverName -> request data
  private requestCounts: Map<string, number> = new Map();
  private failedRequestCounts: Map<string, number> = new Map();
  private responseTimes: Map<string, number[]> = new Map();
  private restartCounts: Map<string, number> = new Map();
  /** Track which servers have had their first start recorded */
  private serverStarted: Set<string> = new Set();

  constructor(options: MetricsCollectorOptions = {}) {
    this.enabled = options.enabled ?? true;
    this.collectionIntervalMs = options.collectionIntervalMs ?? 10000; // 10 seconds
    this.retentionHours = options.retentionHours ?? 24; // 24 hours
    this.maxHistorySize = options.maxHistorySize ?? 8640; // 24h at 10s intervals
  }

  /**
   * Start metrics collection
   */
  start(): void {
    if (!this.enabled) {
      logger.debug('MetricsCollector: Disabled, not starting');
      return;
    }

    if (this.collectionInterval) {
      logger.warn('MetricsCollector: Already running');
      return;
    }

    logger.info('MetricsCollector: Starting collection', {
      intervalMs: this.collectionIntervalMs,
      retentionHours: this.retentionHours,
    });

    this.collectionInterval = setInterval(() => {
      this.cleanup();
    }, this.collectionIntervalMs);
    // v12.5.3: Prevent blocking process exit
    if (this.collectionInterval.unref) this.collectionInterval.unref();
  }

  /**
   * Stop metrics collection
   */
  stop(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = undefined;
      logger.info('MetricsCollector: Stopped collection');
    }
  }

  /**
   * Record server start
   *
   * BUG FIX: Previously incremented restartCount on every start including the first one,
   * so a server that never restarted would show restartCount: 1. Now correctly tracks
   * only actual restarts (starts after the first one).
   */
  recordServerStart(serverName: string): void {
    if (!this.enabled) return;

    // BUG FIX: Only count as restart if server has started before
    if (this.serverStarted.has(serverName)) {
      const currentRestarts = this.restartCounts.get(serverName) || 0;
      this.restartCounts.set(serverName, currentRestarts + 1);

      logger.debug('MetricsCollector: Recorded server restart', {
        serverName,
        restartCount: currentRestarts + 1,
      });
    } else {
      // First start - mark as started but don't count as restart
      this.serverStarted.add(serverName);
      this.restartCounts.set(serverName, 0);

      logger.debug('MetricsCollector: Recorded server first start', {
        serverName,
      });
    }
  }

  /**
   * Record request
   */
  recordRequest(serverName: string, responseTimeMs: number, failed: boolean): void {
    if (!this.enabled) return;

    // Update request count
    const currentCount = this.requestCounts.get(serverName) || 0;
    this.requestCounts.set(serverName, currentCount + 1);

    // Update failed count if applicable
    if (failed) {
      const currentFailed = this.failedRequestCounts.get(serverName) || 0;
      this.failedRequestCounts.set(serverName, currentFailed + 1);
    }

    // Store response time
    const times = this.responseTimes.get(serverName) || [];
    times.push(responseTimeMs);

    // Keep only last 100 response times to prevent memory bloat
    if (times.length > 100) {
      times.shift();
    }

    this.responseTimes.set(serverName, times);

    logger.debug('MetricsCollector: Recorded request', {
      serverName,
      responseTimeMs,
      failed,
      totalRequests: currentCount + 1,
    });
  }

  /**
   * Collect current metrics for a server
   */
  async collectServerMetrics(
    serverName: string,
    pid?: number
  ): Promise<ServerMetrics> {
    // Get process metrics if PID available
    let cpuUsage = 0;
    let memoryUsage = 0;
    let uptime = 0;

    if (pid) {
      try {
        const metrics = await this.getProcessMetrics(pid);
        cpuUsage = metrics.cpu;
        memoryUsage = metrics.memory;
        uptime = metrics.uptime;
      } catch (error) {
        logger.debug('MetricsCollector: Failed to get process metrics', {
          serverName,
          pid,
          error,
        });
      }
    }

    // Get request metrics
    const totalRequests = this.requestCounts.get(serverName) || 0;
    const failedRequests = this.failedRequestCounts.get(serverName) || 0;
    const responseTimes = this.responseTimes.get(serverName) || [];

    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

    const minResponseTime =
      responseTimes.length > 0 ? Math.min(...responseTimes) : 0;

    const maxResponseTime =
      responseTimes.length > 0 ? Math.max(...responseTimes) : 0;

    const restartCount = this.restartCounts.get(serverName) || 0;

    const metrics: ServerMetrics = {
      serverName,
      timestamp: new Date(),
      cpuUsagePercent: cpuUsage,
      memoryUsageMB: memoryUsage,
      uptimeSeconds: uptime,
      totalRequests,
      failedRequests,
      avgResponseTimeMs: avgResponseTime,
      minResponseTimeMs: minResponseTime,
      maxResponseTimeMs: maxResponseTime,
      restartCount,
    };

    // Store in history
    this.addToHistory(serverName, metrics);

    return metrics;
  }

  /**
   * Get aggregated metrics summary
   */
  getMetricsSummary(serverMetrics: ServerMetrics[]): MetricsSummary {
    const totalServers = serverMetrics.length;

    // Single pass O(n) instead of O(7n)
    let healthyServers = 0;
    let totalCpu = 0;
    let totalMemory = 0;
    let totalRequests = 0;
    let totalFailed = 0;
    let totalRestarts = 0;
    let totalResponseTime = 0;

    for (const m of serverMetrics) {
      if (m.memoryUsageMB > 0) healthyServers++;
      totalCpu += m.cpuUsagePercent;
      totalMemory += m.memoryUsageMB;
      totalRequests += m.totalRequests;
      totalFailed += m.failedRequests;
      totalRestarts += m.restartCount;
      totalResponseTime += m.avgResponseTimeMs;
    }

    const avgResponseTime = totalServers > 0 ? totalResponseTime / totalServers : 0;

    const errorRate = totalRequests > 0 ? (totalFailed / totalRequests) * 100 : 0;

    return {
      totalServers,
      healthyServers,
      totalCpuUsagePercent: totalCpu,
      totalMemoryUsageMB: totalMemory,
      totalRequests,
      totalFailedRequests: totalFailed,
      errorRatePercent: errorRate,
      avgResponseTimeMs: avgResponseTime,
      totalRestarts,
      timestamp: new Date(),
    };
  }

  /**
   * Get metrics history for a server
   */
  getHistory(serverName: string, limit: number = 100): ServerMetrics[] {
    const history = this.metricsHistory.get(serverName) || [];
    return history
      .slice(-limit)
      .map(dp => dp.metrics);
  }

  /**
   * Get all metrics history
   */
  getAllHistory(): Map<string, ServerMetrics[]> {
    const result = new Map<string, ServerMetrics[]>();

    for (const [serverName, dataPoints] of this.metricsHistory) {
      result.set(serverName, dataPoints.map(dp => dp.metrics));
    }

    return result;
  }

  /**
   * Clear metrics history
   */
  clearHistory(serverName?: string): void {
    if (serverName) {
      this.metricsHistory.delete(serverName);
      this.requestCounts.delete(serverName);
      this.failedRequestCounts.delete(serverName);
      this.responseTimes.delete(serverName);
      this.restartCounts.delete(serverName);
      this.serverStarted.delete(serverName);
      logger.info('MetricsCollector: Cleared history for server', { serverName });
    } else {
      this.metricsHistory.clear();
      this.requestCounts.clear();
      this.failedRequestCounts.clear();
      this.responseTimes.clear();
      this.restartCounts.clear();
      this.serverStarted.clear();
      logger.info('MetricsCollector: Cleared all history');
    }
  }

  // ========== Private Methods ==========

  /**
   * Get process metrics (CPU, memory, uptime)
   */
  private async getProcessMetrics(
    pid: number
  ): Promise<{ cpu: number; memory: number; uptime: number }> {
    try {
      // Try to use pidusage for accurate metrics (optional dependency)
      const pidusage = await import('pidusage' as any);
      const stats = await pidusage.default(pid);

      return {
        cpu: stats.cpu,
        memory: stats.memory / (1024 * 1024), // Convert to MB
        uptime: stats.elapsed / 1000, // Convert to seconds
      };
    } catch (error) {
      // Fallback: use basic process.memoryUsage()
      // Note: This won't give us CPU or uptime
      // pidusage is an optional dependency
      return {
        cpu: 0,
        memory: 0,
        uptime: 0,
      };
    }
  }

  /**
   * Add metrics to history
   */
  private addToHistory(serverName: string, metrics: ServerMetrics): void {
    const history = this.metricsHistory.get(serverName) || [];

    history.push({
      timestamp: Date.now(),
      metrics,
    });

    // Enforce max history size
    if (history.length > this.maxHistorySize) {
      history.shift();
    }

    this.metricsHistory.set(serverName, history);
  }

  /**
   * Cleanup old metrics data
   */
  private cleanup(): void {
    const now = Date.now();
    const retentionMs = this.retentionHours * 60 * 60 * 1000;

    for (const [serverName, history] of this.metricsHistory) {
      // Remove data points older than retention period
      const filtered = history.filter(
        dp => now - dp.timestamp < retentionMs
      );

      if (filtered.length < history.length) {
        logger.debug('MetricsCollector: Cleaned up old metrics', {
          serverName,
          removed: history.length - filtered.length,
        });
      }

      if (filtered.length === 0) {
        this.metricsHistory.delete(serverName);
      } else {
        this.metricsHistory.set(serverName, filtered);
      }
    }
  }
}

/**
 * Default metrics collector instance
 */
let defaultCollector: MetricsCollector | undefined;

/**
 * Get default metrics collector
 */
export function getMetricsCollector(): MetricsCollector {
  if (!defaultCollector) {
    defaultCollector = new MetricsCollector();
  }
  return defaultCollector;
}

/**
 * Initialize default metrics collector
 */
export function initializeMetricsCollector(
  options?: MetricsCollectorOptions
): MetricsCollector {
  if (!defaultCollector) {
    defaultCollector = new MetricsCollector(options);
  }
  return defaultCollector;
}
