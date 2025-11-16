/**
 * Memory Profiler
 *
 * Captures memory snapshots during execution to track heap usage, RSS, and memory deltas.
 * Useful for identifying memory leaks and optimizing memory usage in parallel execution.
 */

export interface MemorySnapshot {
  label: string;
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  arrayBuffers: number;
}

export class MemoryProfiler {
  private snapshots: MemorySnapshot[] = [];
  private readonly enabled: boolean;

  constructor(enabled: boolean = process.env.AUTOMATOSX_PROFILE === 'true') {
    this.enabled = enabled && typeof process.memoryUsage === 'function';
  }

  /**
   * Takes a memory snapshot at the current point in execution.
   */
  takeSnapshot(label: string): MemorySnapshot | undefined {
    if (!this.enabled) return undefined;

    const usage = process.memoryUsage();
    const snapshot: MemorySnapshot = {
      label,
      timestamp: Date.now(),
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      rss: usage.rss,
      external: usage.external ?? 0,
      arrayBuffers: usage.arrayBuffers ?? 0
    };

    this.snapshots.push(snapshot);
    return snapshot;
  }

  /**
   * Generates a human-readable report of all memory snapshots.
   */
  generateReport(): string {
    if (this.snapshots.length === 0) {
      return 'No memory snapshots captured.\n';
    }

    const lines: string[] = [
      '=== Memory Profile Report ===',
      ''
    ];

    for (let i = 0; i < this.snapshots.length; i++) {
      const snapshot = this.snapshots[i]!;
      lines.push(`[${i}] ${snapshot.label}`);
      lines.push(`  Timestamp: ${new Date(snapshot.timestamp).toISOString()}`);
      lines.push(`  Heap Used: ${this.formatBytes(snapshot.heapUsed)}`);
      lines.push(`  Heap Total: ${this.formatBytes(snapshot.heapTotal)}`);
      lines.push(`  RSS: ${this.formatBytes(snapshot.rss)}`);
      lines.push(`  External: ${this.formatBytes(snapshot.external)}`);
      lines.push(`  Array Buffers: ${this.formatBytes(snapshot.arrayBuffers)}`);

      if (i > 0) {
        const prev = this.snapshots[i - 1]!;
        const heapDelta = snapshot.heapUsed - prev.heapUsed;
        const rssDelta = snapshot.rss - prev.rss;
        lines.push(`  Heap Delta: ${this.formatBytes(heapDelta)} (${heapDelta >= 0 ? '+' : ''}${heapDelta})`);
        lines.push(`  RSS Delta: ${this.formatBytes(rssDelta)} (${rssDelta >= 0 ? '+' : ''}${rssDelta})`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Returns all captured snapshots.
   */
  getSnapshots(): MemorySnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Clears all captured snapshots.
   */
  clear(): void {
    this.snapshots = [];
  }

  /**
   * Checks if profiling is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const absBytes = Math.abs(bytes);

    // Handle very small values (< 1 byte)
    if (absBytes < 1) {
      return `${bytes.toFixed(4)} B`;
    }

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(absBytes) / Math.log(k));

    // Ensure index is within bounds
    const sizeIndex = Math.min(i, sizes.length - 1);
    const value = bytes / Math.pow(k, sizeIndex);

    return `${value.toFixed(2)} ${sizes[sizeIndex]}`;
  }
}
