/**
 * Metrics Collector - Performance and operational metrics
 *
 * Tracks latency, error rates, and operational metrics for monitoring
 * and performance analysis.
 */

export interface MetricSample {
  timestamp: number;
  value: number;
  metadata?: Record<string, unknown>;
}

export interface OperationMetric {
  name: string;
  totalCount: number;
  successCount: number;
  errorCount: number;
  errorRate: number;
  samples: number[];
  latency: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    min: number;
    max: number;
  };
  lastError?: {
    message: string;
    timestamp: number;
  };
}

export interface MetricSnapshot {
  timestamp: string;
  uptime: number;
  operations: Record<string, OperationMetric>;
  summary: {
    totalOperations: number;
    totalErrors: number;
    overallErrorRate: number;
  };
}

interface MetricData {
  totalCount: number;
  successCount: number;
  errorCount: number;
  samples: number[];
  lastError?: {
    message: string;
    timestamp: number;
  };
}

export class MetricsCollector {
  private metrics: Map<string, MetricData> = new Map();
  private startTime: number = Date.now();
  private readonly maxSamples: number = 1000; // Keep last 1000 samples per operation

  /**
   * Record latency for an operation
   * @param operation - Operation name (e.g., 'agent.execute', 'memory.search')
   * @param durationMs - Duration in milliseconds
   * @param metadata - Optional metadata about the operation
   */
  recordLatency(operation: string, durationMs: number, metadata?: Record<string, unknown>): void {
    const metric = this.getOrCreate(operation);

    metric.samples.push(durationMs);
    metric.totalCount++;
    metric.successCount++;

    // Keep only last N samples to prevent memory growth
    if (metric.samples.length > this.maxSamples) {
      metric.samples.shift();
    }
  }

  /**
   * Record an error for an operation
   * @param operation - Operation name
   * @param error - Error that occurred
   */
  recordError(operation: string, error: Error | string): void {
    const metric = this.getOrCreate(operation);

    metric.totalCount++;
    metric.errorCount++;
    metric.lastError = {
      message: typeof error === 'string' ? error : error.message,
      timestamp: Date.now()
    };
  }

  /**
   * Get or create metric data for an operation
   */
  private getOrCreate(operation: string): MetricData {
    let metric = this.metrics.get(operation);
    if (!metric) {
      metric = {
        totalCount: 0,
        successCount: 0,
        errorCount: 0,
        samples: []
      };
      this.metrics.set(operation, metric);
    }
    return metric;
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sortedSamples: number[], p: number): number {
    if (sortedSamples.length === 0) return 0;

    const index = Math.ceil(sortedSamples.length * p) - 1;
    return sortedSamples[Math.max(0, index)] ?? 0;
  }

  /**
   * Calculate latency statistics from samples
   */
  private calculateLatencyStats(samples: number[]): OperationMetric['latency'] {
    if (samples.length === 0) {
      return { p50: 0, p95: 0, p99: 0, avg: 0, min: 0, max: 0 };
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const sum = samples.reduce((acc, val) => acc + val, 0);

    return {
      p50: this.percentile(sorted, 0.5),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
      avg: sum / samples.length,
      min: sorted[0] ?? 0,
      max: sorted[sorted.length - 1] ?? 0
    };
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics(): MetricSnapshot {
    const operations: Record<string, OperationMetric> = {};
    let totalOperations = 0;
    let totalErrors = 0;

    for (const [name, metric] of this.metrics.entries()) {
      const errorRate = metric.totalCount > 0
        ? metric.errorCount / metric.totalCount
        : 0;

      operations[name] = {
        name,
        totalCount: metric.totalCount,
        successCount: metric.successCount,
        errorCount: metric.errorCount,
        errorRate,
        samples: metric.samples,
        latency: this.calculateLatencyStats(metric.samples),
        lastError: metric.lastError
      };

      totalOperations += metric.totalCount;
      totalErrors += metric.errorCount;
    }

    const overallErrorRate = totalOperations > 0
      ? totalErrors / totalOperations
      : 0;

    return {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      operations,
      summary: {
        totalOperations,
        totalErrors,
        overallErrorRate
      }
    };
  }

  /**
   * Get metrics for a specific operation
   */
  getOperationMetrics(operation: string): OperationMetric | null {
    const metric = this.metrics.get(operation);
    if (!metric) return null;

    const errorRate = metric.totalCount > 0
      ? metric.errorCount / metric.totalCount
      : 0;

    return {
      name: operation,
      totalCount: metric.totalCount,
      successCount: metric.successCount,
      errorCount: metric.errorCount,
      errorRate,
      samples: metric.samples,
      latency: this.calculateLatencyStats(metric.samples),
      lastError: metric.lastError
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    this.startTime = Date.now();
  }

  /**
   * Reset metrics for a specific operation
   */
  resetOperation(operation: string): void {
    this.metrics.delete(operation);
  }

  /**
   * Export metrics as JSON
   */
  toJSON(): MetricSnapshot {
    return this.getMetrics();
  }
}

// Global metrics collector instance
export const globalMetrics = new MetricsCollector();

/**
 * Measure execution time of a function
 */
export async function measureLatency<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    globalMetrics.recordLatency(operation, duration);
    return result;
  } catch (error) {
    // Only record error, don't record latency to avoid double-counting
    globalMetrics.recordError(operation, error as Error);
    throw error;
  }
}

/**
 * Decorator to measure method execution time
 */
export function Measure(operation?: string) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const operationName = operation || `${target?.constructor?.name}.${propertyKey}`;

    descriptor.value = async function (...args: unknown[]) {
      return measureLatency(operationName, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
