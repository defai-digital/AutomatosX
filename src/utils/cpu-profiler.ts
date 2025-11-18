/**
 * CPU Profiler
 *
 * Measures CPU time (user + system) for functions and tracks CPU usage over time.
 * Useful for identifying CPU bottlenecks in parallel execution.
 */

import { performance } from 'perf_hooks';

export interface CPUSample {
  label: string;
  timestamp: number;
  userMs: number;
  systemMs: number;
  totalMs: number;
  durationMs: number;
}

export class CPUProfiler {
  private samples: CPUSample[] = [];
  private readonly enabled: boolean;

  constructor(enabled: boolean = process.env.AX_PROFILE === 'true') {
    this.enabled = enabled && typeof process.cpuUsage === 'function';
  }

  /**
   * Measures CPU time for a given function.
   * Returns both the function result and the CPU sample.
   */
  async measureCPUTime<T>(
    label: string,
    fn: () => Promise<T> | T
  ): Promise<{ result: T; sample: CPUSample }> {
    const startUsage = this.enabled ? process.cpuUsage() : undefined;
    const startTime = performance.now();

    try {
      const result = await Promise.resolve(fn());
      const sample = this.captureSample(label, startUsage, startTime);
      return { result, sample };
    } catch (error) {
      this.captureSample(label, startUsage, startTime);
      throw error;
    }
  }

  private captureSample(
    label: string,
    startUsage: NodeJS.CpuUsage | undefined,
    startTime: number
  ): CPUSample {
    const endTime = performance.now();
    const durationMs = endTime - startTime;

    let userMs = 0;
    let systemMs = 0;

    if (this.enabled && startUsage) {
      const endUsage = process.cpuUsage(startUsage);
      userMs = endUsage.user / 1000;
      systemMs = endUsage.system / 1000;
    }

    const sample: CPUSample = {
      label,
      timestamp: Date.now(),
      userMs,
      systemMs,
      totalMs: userMs + systemMs,
      durationMs
    };

    if (this.enabled) {
      this.samples.push(sample);
    }

    return sample;
  }

  /**
   * Generates a human-readable report of all CPU samples.
   */
  generateReport(): string {
    if (this.samples.length === 0) {
      return 'No CPU samples captured.\n';
    }

    const lines: string[] = [
      '=== CPU Profile Report ===',
      ''
    ];

    for (let i = 0; i < this.samples.length; i++) {
      const sample = this.samples[i]!;
      lines.push(`[${i}] ${sample.label}`);
      lines.push(`  Timestamp: ${new Date(sample.timestamp).toISOString()}`);
      lines.push(`  Duration: ${sample.durationMs.toFixed(2)} ms`);
      lines.push(`  User CPU: ${sample.userMs.toFixed(2)} ms`);
      lines.push(`  System CPU: ${sample.systemMs.toFixed(2)} ms`);
      lines.push(`  Total CPU: ${sample.totalMs.toFixed(2)} ms`);

      if (sample.durationMs > 0) {
        const cpuPercent = (sample.totalMs / sample.durationMs) * 100;
        lines.push(`  CPU Usage: ${cpuPercent.toFixed(2)}%`);
      }

      lines.push('');
    }

    // Summary statistics
    if (this.samples.length > 1) {
      const totalDuration = this.samples.reduce((sum, s) => sum + s.durationMs, 0);
      const totalCPU = this.samples.reduce((sum, s) => sum + s.totalMs, 0);
      const avgCPUPercent = totalDuration > 0 ? (totalCPU / totalDuration) * 100 : 0;

      lines.push('=== Summary ===');
      lines.push(`Total Samples: ${this.samples.length}`);
      lines.push(`Total Duration: ${totalDuration.toFixed(2)} ms`);
      lines.push(`Total CPU Time: ${totalCPU.toFixed(2)} ms`);
      lines.push(`Average CPU Usage: ${avgCPUPercent.toFixed(2)}%`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Returns all captured CPU samples.
   */
  getSamples(): CPUSample[] {
    return [...this.samples];
  }

  /**
   * Clears all captured samples.
   */
  clear(): void {
    this.samples = [];
  }

  /**
   * Checks if profiling is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
