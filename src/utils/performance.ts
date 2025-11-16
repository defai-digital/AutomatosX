/**
 * Performance Tracking Utilities
 *
 * Provides lightweight performance measurement and profiling tools.
 */

export interface PerformanceMark {
  name: string;
  timestamp: number;
  duration?: number;
}

export interface PerformanceMetrics {
  marks: PerformanceMark[];
  totalDuration: number;
  breakdown: Record<string, number>;
}

/**
 * Performance tracker for profiling application startup and operations
 */
export class PerformanceTracker {
  private marks: Map<string, number> = new Map();
  private measurements: PerformanceMark[] = [];
  private startTime: number;
  private enabled: boolean;

  constructor(enabled: boolean = false) {
    this.enabled = enabled || process.env.AUTOMATOSX_PROFILE === 'true';
    this.startTime = performance.now();
  }

  /**
   * Mark a point in time
   */
  mark(name: string): void {
    if (!this.enabled) return;

    const timestamp = performance.now() - this.startTime;
    this.marks.set(name, timestamp);
  }

  /**
   * Measure duration between two marks
   */
  measure(name: string, startMark: string, endMark?: string): number | undefined {
    if (!this.enabled) return undefined;

    const start = this.marks.get(startMark);
    if (!start) return undefined;

    const end = endMark ? this.marks.get(endMark) : performance.now() - this.startTime;
    if (end === undefined) return undefined;

    const duration = end - start;
    this.measurements.push({
      name,
      timestamp: start,
      duration
    });

    return duration;
  }

  /**
   * Get all measurements
   */
  getMeasurements(): PerformanceMark[] {
    return [...this.measurements];
  }

  /**
   * Get performance metrics summary
   */
  getMetrics(): PerformanceMetrics {
    const totalDuration = performance.now() - this.startTime;
    const breakdown: Record<string, number> = {};

    for (const measurement of this.measurements) {
      if (measurement.duration !== undefined) {
        breakdown[measurement.name] = measurement.duration;
      }
    }

    return {
      marks: this.getMeasurements(),
      totalDuration,
      breakdown
    };
  }

  /**
   * Generate formatted report
   */
  generateReport(): string {
    const metrics = this.getMetrics();
    const lines: string[] = [];

    lines.push('=== Performance Profile ===');
    lines.push(`Total Duration: ${metrics.totalDuration.toFixed(2)}ms`);
    lines.push('');
    lines.push('Breakdown:');

    // Sort by duration (descending)
    const sorted = Object.entries(metrics.breakdown)
      .sort(([, a], [, b]) => b - a);

    for (const [name, duration] of sorted) {
      // v6.2.12: Bug fix #39 - Prevent division by zero when totalDuration = 0
      // If performance.now() returns same value as startTime, totalDuration = 0
      // This can happen on extremely fast operations or right after clear()
      const percentage = metrics.totalDuration > 0
        ? (duration / metrics.totalDuration * 100).toFixed(1)
        : '0.0';
      lines.push(`  ${name.padEnd(40)} ${duration.toFixed(2)}ms (${percentage}%)`);
    }

    return lines.join('\n');
  }

  /**
   * Clear all measurements
   */
  clear(): void {
    this.marks.clear();
    this.measurements = [];
    this.startTime = performance.now();
  }

  /**
   * Check if profiling is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * Global performance tracker instance
 */
export const globalTracker = new PerformanceTracker(
  process.env.AUTOMATOSX_PROFILE === 'true'
);

/**
 * Measure async function execution time
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!globalTracker.isEnabled()) {
    return fn();
  }

  const startMark = `${name}_start`;
  const endMark = `${name}_end`;

  globalTracker.mark(startMark);
  try {
    const result = await fn();
    globalTracker.mark(endMark);
    globalTracker.measure(name, startMark, endMark);
    return result;
  } catch (error) {
    globalTracker.mark(endMark);
    globalTracker.measure(`${name}_error`, startMark, endMark);
    throw error;
  }
}

/**
 * Measure sync function execution time
 */
export function measureSync<T>(
  name: string,
  fn: () => T
): T {
  if (!globalTracker.isEnabled()) {
    return fn();
  }

  const startMark = `${name}_start`;
  const endMark = `${name}_end`;

  globalTracker.mark(startMark);
  try {
    const result = fn();
    globalTracker.mark(endMark);
    globalTracker.measure(name, startMark, endMark);
    return result;
  } catch (error) {
    globalTracker.mark(endMark);
    globalTracker.measure(`${name}_error`, startMark, endMark);
    throw error;
  }
}
