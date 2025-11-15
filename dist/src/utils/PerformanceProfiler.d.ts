import { EventEmitter } from 'events';
/**
 * Performance measurement result
 */
export interface PerformanceMeasurement {
    name: string;
    duration: number;
    startTime: number;
    endTime: number;
    metadata?: Record<string, unknown>;
}
/**
 * Performance profile summary
 */
export interface PerformanceProfile {
    totalDuration: number;
    measurements: PerformanceMeasurement[];
    overhead: number;
    targetOverhead: number;
    passes: boolean;
}
/**
 * Performance profiler options
 */
export interface ProfilerOptions {
    targetOverhead?: number;
    enableLogging?: boolean;
    sampleSize?: number;
}
/**
 * Performance Profiler
 *
 * Tracks execution time of CLI bridge operations
 *
 * @example
 * ```typescript
 * const profiler = new PerformanceProfiler({ targetOverhead: 10 })
 *
 * profiler.start('validation')
 * // ... validation code
 * profiler.end('validation')
 *
 * profiler.start('execution')
 * // ... execution code
 * profiler.end('execution')
 *
 * const profile = profiler.getProfile()
 * console.log(`Total overhead: ${profile.overhead}ms`)
 * console.log(`Passes: ${profile.passes}`)
 * ```
 */
export declare class PerformanceProfiler extends EventEmitter {
    private measurements;
    private activeTimers;
    private targetOverhead;
    private enableLogging;
    private sampleSize;
    private samples;
    constructor(options?: ProfilerOptions);
    /**
     * Start timing a measurement
     */
    start(name: string, metadata?: Record<string, unknown>): void;
    /**
     * End timing a measurement
     */
    end(name: string, metadata?: Record<string, unknown>): PerformanceMeasurement | undefined;
    /**
     * Measure a synchronous function
     */
    measure<T>(name: string, fn: () => T, metadata?: Record<string, unknown>): T;
    /**
     * Measure an async function
     */
    measureAsync<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, unknown>): Promise<T>;
    /**
     * Get performance profile
     */
    getProfile(): PerformanceProfile;
    /**
     * Get measurement by name
     */
    getMeasurement(name: string): PerformanceMeasurement | undefined;
    /**
     * Get all measurements
     */
    getAllMeasurements(): PerformanceMeasurement[];
    /**
     * Get statistics for a measurement
     */
    getStatistics(): PerformanceStatistics;
    /**
     * Check if overhead target is met
     */
    meetsTarget(): boolean;
    /**
     * Reset all measurements
     */
    reset(): void;
    /**
     * Export measurements as JSON
     */
    export(): string;
    /**
     * Get high-resolution time in milliseconds
     */
    private getHighResolutionTime;
    /**
     * Log message
     */
    private log;
}
/**
 * Performance statistics
 */
export interface PerformanceStatistics {
    count: number;
    mean: number;
    median: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
    stdDev: number;
}
/**
 * Get or create global profiler
 */
export declare function getGlobalProfiler(options?: ProfilerOptions): PerformanceProfiler;
/**
 * Reset global profiler
 */
export declare function resetGlobalProfiler(): void;
//# sourceMappingURL=PerformanceProfiler.d.ts.map