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
export declare class PerformanceMonitor {
    private metrics;
    private indexingTimes;
    private queryTimes;
    /**
     * Record indexing performance
     */
    recordIndexing(fileCount: number, totalTime: number, parseTime: number): void;
    /**
     * Record query performance
     */
    recordQuery(latency: number, cached: boolean): void;
    /**
     * Record memory usage
     */
    recordMemory(): void;
    /**
     * Get current performance statistics
     */
    getStats(): PerformanceStats;
    /**
     * Format stats as text report
     */
    formatReport(): string;
    /**
     * Reset all metrics
     */
    reset(): void;
    /**
     * Export metrics as JSON
     */
    exportMetrics(): PerformanceMetric[];
}
/**
 * Get singleton performance monitor
 */
export declare function getPerformanceMonitor(): PerformanceMonitor;
/**
 * Reset singleton instance
 */
export declare function resetPerformanceMonitor(): void;
//# sourceMappingURL=PerformanceMonitor.d.ts.map