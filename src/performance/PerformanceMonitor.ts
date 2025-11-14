/**
 * Performance Monitor
 *
 * Tracks and reports performance metrics for indexing, queries, and analysis
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
}

export interface PerformanceStats {
  indexing: {
    totalFiles: number;
    totalTime: number;
    averageTimePerFile: number;
    filesPerSecond: number;
    parseTime: number;
    dbTime: number;
  };
  queries: {
    totalQueries: number;
    cachedQueries: number;
    uncachedQueries: number;
    averageCachedLatency: number;
    averageUncachedLatency: number;
    p95Latency: number;
    p99Latency: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
    evictions: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
}

/**
 * Performance monitoring service
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private indexingTimes: number[] = [];
  private queryTimes: Map<'cached' | 'uncached', number[]> = new Map([
    ['cached', []],
    ['uncached', []],
  ]);

  /**
   * Record indexing performance
   */
  recordIndexing(fileCount: number, totalTime: number, parseTime: number): void {
    this.indexingTimes.push(totalTime / fileCount);

    this.metrics.push({
      name: 'indexing.filesPerSecond',
      value: (fileCount / totalTime) * 1000,
      unit: 'files/sec',
      timestamp: Date.now(),
    });

    this.metrics.push({
      name: 'indexing.parseTime',
      value: parseTime,
      unit: 'ms',
      timestamp: Date.now(),
    });
  }

  /**
   * Record query performance
   */
  recordQuery(latency: number, cached: boolean): void {
    const type = cached ? 'cached' : 'uncached';
    this.queryTimes.get(type)!.push(latency);

    this.metrics.push({
      name: `query.${type}.latency`,
      value: latency,
      unit: 'ms',
      timestamp: Date.now(),
    });
  }

  /**
   * Record memory usage
   */
  recordMemory(): void {
    const mem = process.memoryUsage();

    this.metrics.push({
      name: 'memory.heapUsed',
      value: mem.heapUsed / 1024 / 1024,
      unit: 'MB',
      timestamp: Date.now(),
    });

    this.metrics.push({
      name: 'memory.rss',
      value: mem.rss / 1024 / 1024,
      unit: 'MB',
      timestamp: Date.now(),
    });
  }

  /**
   * Get current performance statistics
   */
  getStats(): PerformanceStats {
    const mem = process.memoryUsage();

    // Calculate indexing stats
    const totalIndexingTime = this.indexingTimes.reduce((sum, t) => sum + t, 0);
    const avgIndexingTime = this.indexingTimes.length > 0
      ? totalIndexingTime / this.indexingTimes.length
      : 0;

    // Calculate query stats
    const cachedTimes = this.queryTimes.get('cached')!;
    const uncachedTimes = this.queryTimes.get('uncached')!;
    const allQueryTimes = [...cachedTimes, ...uncachedTimes].sort((a, b) => a - b);

    const avgCached = cachedTimes.length > 0
      ? cachedTimes.reduce((sum, t) => sum + t, 0) / cachedTimes.length
      : 0;

    const avgUncached = uncachedTimes.length > 0
      ? uncachedTimes.reduce((sum, t) => sum + t, 0) / uncachedTimes.length
      : 0;

    const p95Index = Math.floor(allQueryTimes.length * 0.95);
    const p99Index = Math.floor(allQueryTimes.length * 0.99);

    return {
      indexing: {
        totalFiles: this.indexingTimes.length,
        totalTime: totalIndexingTime,
        averageTimePerFile: avgIndexingTime,
        filesPerSecond: avgIndexingTime > 0 ? 1000 / avgIndexingTime : 0,
        parseTime: 0, // Calculated separately
        dbTime: 0, // Calculated separately
      },
      queries: {
        totalQueries: cachedTimes.length + uncachedTimes.length,
        cachedQueries: cachedTimes.length,
        uncachedQueries: uncachedTimes.length,
        averageCachedLatency: avgCached,
        averageUncachedLatency: avgUncached,
        p95Latency: allQueryTimes[p95Index] || 0,
        p99Latency: allQueryTimes[p99Index] || 0,
      },
      cache: {
        hits: cachedTimes.length,
        misses: uncachedTimes.length,
        hitRate: (cachedTimes.length + uncachedTimes.length) > 0
          ? cachedTimes.length / (cachedTimes.length + uncachedTimes.length)
          : 0,
        size: 0, // Filled by cache implementation
        evictions: 0, // Filled by cache implementation
      },
      memory: {
        heapUsed: mem.heapUsed / 1024 / 1024,
        heapTotal: mem.heapTotal / 1024 / 1024,
        external: mem.external / 1024 / 1024,
        rss: mem.rss / 1024 / 1024,
      },
    };
  }

  /**
   * Format stats as text report
   */
  formatReport(): string {
    const stats = this.getStats();
    const lines: string[] = [];

    lines.push('\n' + '='.repeat(80));
    lines.push('Performance Statistics');
    lines.push('='.repeat(80) + '\n');

    // Indexing
    lines.push('Indexing:');
    lines.push(`  Files Indexed: ${stats.indexing.totalFiles}`);
    lines.push(`  Files/Second: ${stats.indexing.filesPerSecond.toFixed(2)}`);
    lines.push(`  Avg Time/File: ${stats.indexing.averageTimePerFile.toFixed(2)}ms\n`);

    // Queries
    lines.push('Queries:');
    lines.push(`  Total: ${stats.queries.totalQueries}`);
    lines.push(`  Cached: ${stats.queries.cachedQueries} (${(stats.cache.hitRate * 100).toFixed(1)}%)`);
    lines.push(`  Avg Latency (cached): ${stats.queries.averageCachedLatency.toFixed(2)}ms`);
    lines.push(`  Avg Latency (uncached): ${stats.queries.averageUncachedLatency.toFixed(2)}ms`);
    lines.push(`  P95 Latency: ${stats.queries.p95Latency.toFixed(2)}ms`);
    lines.push(`  P99 Latency: ${stats.queries.p99Latency.toFixed(2)}ms\n`);

    // Memory
    lines.push('Memory:');
    lines.push(`  Heap Used: ${stats.memory.heapUsed.toFixed(2)} MB`);
    lines.push(`  Heap Total: ${stats.memory.heapTotal.toFixed(2)} MB`);
    lines.push(`  RSS: ${stats.memory.rss.toFixed(2)} MB\n`);

    lines.push('='.repeat(80) + '\n');

    return lines.join('\n');
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = [];
    this.indexingTimes = [];
    this.queryTimes.set('cached', []);
    this.queryTimes.set('uncached', []);
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }
}

// Singleton instance
let monitorInstance: PerformanceMonitor | null = null;

/**
 * Get singleton performance monitor
 */
export function getPerformanceMonitor(): PerformanceMonitor {
  if (!monitorInstance) {
    monitorInstance = new PerformanceMonitor();
  }
  return monitorInstance;
}

/**
 * Reset singleton instance
 */
export function resetPerformanceMonitor(): void {
  monitorInstance = null;
}
