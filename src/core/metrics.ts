/**
 * Metrics Collector
 *
 * Collects and exports metrics in Prometheus format for parallel execution monitoring.
 * Tracks agent execution counts, durations, and error rates.
 */

export class MetricsCollector {
  private parallelAgentsTotal = 0;
  private parallelErrorsTotal = 0;
  private durationSum = 0;
  private durationCount = 0;
  private durationMin = Number.POSITIVE_INFINITY;
  private durationMax = 0;

  /**
   * Increment the total count of parallel agents executed
   */
  incrementParallelAgents(count: number = 1): void {
    if (!Number.isFinite(count) || count < 0) {
      throw new Error('parallel agent increment must be a non-negative finite number');
    }
    this.parallelAgentsTotal += count;
  }

  /**
   * Increment the total count of parallel execution errors
   */
  incrementParallelErrors(count: number = 1): void {
    if (!Number.isFinite(count) || count < 0) {
      throw new Error('parallel error increment must be a non-negative finite number');
    }
    this.parallelErrorsTotal += count;
  }

  /**
   * Record a parallel execution duration observation
   */
  observeParallelExecutionDuration(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new Error('execution duration must be a non-negative finite number');
    }

    this.durationSum += seconds;
    this.durationCount += 1;
    this.durationMin = Math.min(this.durationMin, seconds);
    this.durationMax = Math.max(this.durationMax, seconds);
  }

  /**
   * Export all metrics in Prometheus format
   */
  exportPrometheus(): string {
    const min = this.durationCount > 0 ? this.durationMin : 0;
    const max = this.durationCount > 0 ? this.durationMax : 0;

    const lines = [
      '# HELP automatosx_parallel_agents_total Total number of agents executed in parallel.',
      '# TYPE automatosx_parallel_agents_total counter',
      `automatosx_parallel_agents_total ${this.formatMetric(this.parallelAgentsTotal)}`,
      '',
      '# HELP automatosx_parallel_execution_duration_seconds Parallel execution durations in seconds.',
      '# TYPE automatosx_parallel_execution_duration_seconds summary',
      `automatosx_parallel_execution_duration_seconds_count ${this.durationCount}`,
      `automatosx_parallel_execution_duration_seconds_sum ${this.formatMetric(this.durationSum)}`,
      `automatosx_parallel_execution_duration_seconds_min ${this.formatMetric(min)}`,
      `automatosx_parallel_execution_duration_seconds_max ${this.formatMetric(max)}`,
      '',
      '# HELP automatosx_parallel_errors_total Total number of parallel execution errors observed.',
      '# TYPE automatosx_parallel_errors_total counter',
      `automatosx_parallel_errors_total ${this.formatMetric(this.parallelErrorsTotal)}`
    ];

    return lines.join('\n') + '\n';
  }

  /**
   * Format a metric value for Prometheus export
   */
  private formatMetric(value: number): string {
    return value.toFixed(6).replace(/\.?0+$/, '');
  }
}
