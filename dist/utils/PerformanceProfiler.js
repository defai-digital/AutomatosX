// Sprint 2 Day 15: Performance Profiler
// Measures CLI bridge overhead and execution metrics
import { EventEmitter } from 'events';
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
export class PerformanceProfiler extends EventEmitter {
    measurements;
    activeTimers;
    targetOverhead;
    enableLogging;
    sampleSize;
    samples;
    constructor(options = {}) {
        super();
        this.measurements = new Map();
        this.activeTimers = new Map();
        this.targetOverhead = options.targetOverhead || 10; // Default 10ms
        this.enableLogging = options.enableLogging ?? false;
        this.sampleSize = options.sampleSize || 100;
        this.samples = [];
    }
    /**
     * Start timing a measurement
     */
    start(name, metadata) {
        const startTime = this.getHighResolutionTime();
        this.activeTimers.set(name, startTime);
        if (this.enableLogging) {
            this.log(`⏱️  Started: ${name}`);
        }
        this.emit('measurement-start', { name, startTime, metadata });
    }
    /**
     * End timing a measurement
     */
    end(name, metadata) {
        const endTime = this.getHighResolutionTime();
        const startTime = this.activeTimers.get(name);
        if (!startTime) {
            if (this.enableLogging) {
                this.log(`⚠️  Warning: No start time for "${name}"`);
            }
            return undefined;
        }
        const duration = endTime - startTime;
        const measurement = {
            name,
            duration,
            startTime,
            endTime,
            metadata,
        };
        this.measurements.set(name, measurement);
        this.activeTimers.delete(name);
        this.samples.push(duration);
        // Keep only recent samples
        if (this.samples.length > this.sampleSize) {
            this.samples.shift();
        }
        if (this.enableLogging) {
            this.log(`✅ Completed: ${name} (${duration.toFixed(2)}ms)`);
        }
        this.emit('measurement-end', measurement);
        return measurement;
    }
    /**
     * Measure a synchronous function
     */
    measure(name, fn, metadata) {
        this.start(name, metadata);
        try {
            const result = fn();
            this.end(name, metadata);
            return result;
        }
        catch (error) {
            this.end(name, { ...metadata, error: true });
            throw error;
        }
    }
    /**
     * Measure an async function
     */
    async measureAsync(name, fn, metadata) {
        this.start(name, metadata);
        try {
            const result = await fn();
            this.end(name, metadata);
            return result;
        }
        catch (error) {
            this.end(name, { ...metadata, error: true });
            throw error;
        }
    }
    /**
     * Get performance profile
     */
    getProfile() {
        const measurements = Array.from(this.measurements.values());
        const totalDuration = measurements.reduce((sum, m) => sum + m.duration, 0);
        const overhead = totalDuration;
        return {
            totalDuration,
            measurements,
            overhead,
            targetOverhead: this.targetOverhead,
            passes: overhead <= this.targetOverhead,
        };
    }
    /**
     * Get measurement by name
     */
    getMeasurement(name) {
        return this.measurements.get(name);
    }
    /**
     * Get all measurements
     */
    getAllMeasurements() {
        return Array.from(this.measurements.values());
    }
    /**
     * Get statistics for a measurement
     */
    getStatistics() {
        const durations = Array.from(this.measurements.values()).map(m => m.duration);
        if (durations.length === 0) {
            return {
                count: 0,
                mean: 0,
                median: 0,
                min: 0,
                max: 0,
                p95: 0,
                p99: 0,
                stdDev: 0,
            };
        }
        const sorted = [...durations].sort((a, b) => a - b);
        const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
        const variance = durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / durations.length;
        const stdDev = Math.sqrt(variance);
        return {
            count: durations.length,
            mean,
            median: sorted[Math.floor(sorted.length / 2)],
            min: sorted[0],
            max: sorted[sorted.length - 1],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)],
            stdDev,
        };
    }
    /**
     * Check if overhead target is met
     */
    meetsTarget() {
        const profile = this.getProfile();
        return profile.passes;
    }
    /**
     * Reset all measurements
     */
    reset() {
        this.measurements.clear();
        this.activeTimers.clear();
        this.samples = [];
        if (this.enableLogging) {
            this.log('🔄 Profiler reset');
        }
        this.emit('reset');
    }
    /**
     * Export measurements as JSON
     */
    export() {
        const profile = this.getProfile();
        const stats = this.getStatistics();
        return JSON.stringify({
            profile,
            statistics: stats,
            timestamp: new Date().toISOString(),
        }, null, 2);
    }
    /**
     * Get high-resolution time in milliseconds
     */
    getHighResolutionTime() {
        if (typeof performance !== 'undefined' && performance.now) {
            return performance.now();
        }
        return Date.now();
    }
    /**
     * Log message
     */
    log(message) {
        console.log(`[Profiler] ${message}`);
    }
}
/**
 * Global profiler instance
 */
let globalProfiler = null;
/**
 * Get or create global profiler
 */
export function getGlobalProfiler(options) {
    if (!globalProfiler) {
        globalProfiler = new PerformanceProfiler(options);
    }
    return globalProfiler;
}
/**
 * Reset global profiler
 */
export function resetGlobalProfiler() {
    globalProfiler = null;
}
//# sourceMappingURL=PerformanceProfiler.js.map