/**
 * Metrics Collector Implementation
 *
 * Basic observability metrics for monitoring system health.
 */

import {
  type MetricsTimeRange,
  type RequestMetric,
  type ErrorMetric,
  type LatencyStats,
  type MetricsSnapshot,
  TIME_MULTIPLIERS,
  DEFAULT_TIME_RANGE_MS,
} from './_contracts.js';

/**
 * Metrics collector interface
 */
export interface MetricsCollector {
  /** Record a request metric */
  recordRequest(metric: RequestMetric): void;

  /** Record an error metric */
  recordError(metric: ErrorMetric): void;

  /** Get metrics snapshot */
  getStats(timeRange?: MetricsTimeRange): MetricsSnapshot;

  /** Reset all metrics */
  reset(): void;

  /** Get raw request metrics */
  getRequestMetrics(limit?: number): RequestMetric[];

  /** Get raw error metrics */
  getErrorMetrics(limit?: number): ErrorMetric[];
}

/**
 * Metrics collector configuration
 */
export interface MetricsCollectorConfig {
  /** Maximum number of request metrics to retain */
  maxRequestMetrics: number;

  /** Maximum number of error metrics to retain */
  maxErrorMetrics: number;

  /** Default time range for stats (e.g., '-1h') */
  defaultTimeRange: string;
}

const DEFAULT_CONFIG: MetricsCollectorConfig = {
  maxRequestMetrics: 10000,
  maxErrorMetrics: 1000,
  defaultTimeRange: '-1h',
};

/**
 * Creates a metrics collector
 */
export function createMetricsCollector(
  config?: Partial<MetricsCollectorConfig>
): MetricsCollector {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const requestMetrics: RequestMetric[] = [];
  const errorMetrics: ErrorMetric[] = [];

  function parseTimeRange(timeRange: MetricsTimeRange): { start: Date; end: Date } {
    const end = timeRange.end === 'now' ? new Date() : new Date(timeRange.end);

    let start: Date;
    if (timeRange.start.startsWith('-')) {
      // Relative time like '-1h', '-30m', '-1d'
      const match = timeRange.start.match(/^-(\d+)([smhd])$/);
      if (match) {
        const value = parseInt(match[1]!, 10);
        const unit = match[2];
        const ms = value * (TIME_MULTIPLIERS[unit!] ?? DEFAULT_TIME_RANGE_MS);
        start = new Date(end.getTime() - ms);
      } else {
        start = new Date(end.getTime() - DEFAULT_TIME_RANGE_MS);
      }
    } else {
      start = new Date(timeRange.start);
    }

    return { start, end };
  }

  function filterByTimeRange<T extends { timestamp: string }>(
    items: T[],
    timeRange: MetricsTimeRange
  ): T[] {
    const { start, end } = parseTimeRange(timeRange);
    return items.filter((item) => {
      const ts = new Date(item.timestamp);
      return ts >= start && ts <= end;
    });
  }

  function calculateLatencyStats(latencies: number[]): LatencyStats {
    if (latencies.length === 0) {
      return { min: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0, count: 0 };
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const count = sorted.length;

    const percentile = (p: number): number => {
      const index = Math.ceil((p / 100) * count) - 1;
      return sorted[Math.max(0, Math.min(index, count - 1))]!;
    };

    return {
      min: sorted[0]!,
      max: sorted[count - 1]!,
      mean: Math.round(latencies.reduce((a, b) => a + b, 0) / count),
      p50: percentile(50),
      p95: percentile(95),
      p99: percentile(99),
      count,
    };
  }

  return {
    recordRequest(metric: RequestMetric): void {
      requestMetrics.push(metric);

      // Trim if over limit
      if (requestMetrics.length > cfg.maxRequestMetrics) {
        requestMetrics.splice(0, requestMetrics.length - cfg.maxRequestMetrics);
      }
    },

    recordError(metric: ErrorMetric): void {
      errorMetrics.push(metric);

      // Trim if over limit
      if (errorMetrics.length > cfg.maxErrorMetrics) {
        errorMetrics.splice(0, errorMetrics.length - cfg.maxErrorMetrics);
      }
    },

    getStats(timeRange?: MetricsTimeRange): MetricsSnapshot {
      const range = timeRange ?? {
        start: cfg.defaultTimeRange,
        end: 'now',
      };

      const filteredRequests = filterByTimeRange(requestMetrics, range);
      const filteredErrors = filterByTimeRange(errorMetrics, range);

      // Calculate request stats
      const successCount = filteredRequests.filter((r) => r.success).length;
      const failureCount = filteredRequests.length - successCount;
      const successRate =
        filteredRequests.length > 0
          ? successCount / filteredRequests.length
          : 1;

      // Calculate latency stats
      const latencies = filteredRequests.map((r) => r.durationMs);
      const latencyStats = calculateLatencyStats(latencies);

      // Calculate token stats
      const inputTokens = filteredRequests.reduce(
        (sum, r) => sum + (r.inputTokens ?? 0),
        0
      );
      const outputTokens = filteredRequests.reduce(
        (sum, r) => sum + (r.outputTokens ?? 0),
        0
      );

      // Calculate cost stats
      const totalCost = filteredRequests.reduce(
        (sum, r) => sum + (r.estimatedCost ?? 0),
        0
      );

      // Group errors by code
      const errorsByCode: Record<string, number> = {};
      for (const error of filteredErrors) {
        errorsByCode[error.code] = (errorsByCode[error.code] ?? 0) + 1;
      }

      // Group by provider
      const byProvider: Record<
        string,
        { requests: number; failures: number; latencyP50: number; tokens: number }
      > = {};

      for (const req of filteredRequests) {
        if (!byProvider[req.providerId]) {
          byProvider[req.providerId] = {
            requests: 0,
            failures: 0,
            latencyP50: 0,
            tokens: 0,
          };
        }
        const p = byProvider[req.providerId]!;
        p.requests++;
        if (!req.success) p.failures++;
        p.tokens += (req.inputTokens ?? 0) + (req.outputTokens ?? 0);
      }

      // Calculate per-provider p50
      for (const providerId of Object.keys(byProvider)) {
        const providerLatencies = filteredRequests
          .filter((r) => r.providerId === providerId)
          .map((r) => r.durationMs);
        byProvider[providerId]!.latencyP50 =
          calculateLatencyStats(providerLatencies).p50;
      }

      return {
        timeRange: range,
        requests: {
          total: filteredRequests.length,
          success: successCount,
          failure: failureCount,
          successRate: Math.round(successRate * 1000) / 1000,
        },
        latency: latencyStats,
        tokens: {
          input: inputTokens,
          output: outputTokens,
          total: inputTokens + outputTokens,
        },
        cost: {
          estimated: Math.round(totalCost * 10000) / 10000,
          perRequest:
            filteredRequests.length > 0
              ? Math.round((totalCost / filteredRequests.length) * 10000) / 10000
              : 0,
        },
        errors: errorsByCode,
        byProvider,
        generatedAt: new Date().toISOString(),
      };
    },

    reset(): void {
      requestMetrics.length = 0;
      errorMetrics.length = 0;
    },

    getRequestMetrics(limit?: number): RequestMetric[] {
      if (limit) {
        return requestMetrics.slice(-limit);
      }
      return [...requestMetrics];
    },

    getErrorMetrics(limit?: number): ErrorMetric[] {
      if (limit) {
        return errorMetrics.slice(-limit);
      }
      return [...errorMetrics];
    },
  };
}

/**
 * Global metrics collector singleton
 */
let globalMetrics: MetricsCollector | null = null;

export function getGlobalMetrics(): MetricsCollector {
  if (!globalMetrics) {
    globalMetrics = createMetricsCollector();
  }
  return globalMetrics;
}

export function resetGlobalMetrics(): void {
  globalMetrics = null;
}
