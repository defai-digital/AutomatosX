/**
 * Runtime Profiler
 * Sprint 5 Day 43: Runtime performance profiling with resource tracking
 */
import { EventEmitter } from 'events';
/**
 * Runtime profile result
 */
export interface RuntimeProfile {
    commandId: string;
    command: string;
    startTime: number;
    endTime: number;
    duration: number;
    cpuTime: number;
    memoryUsage: MemoryUsageSnapshot;
    peakMemory: number;
    gcStats: GCStats;
    metadata: Record<string, any>;
}
/**
 * Memory usage snapshot
 */
export interface MemoryUsageSnapshot {
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
    rss: number;
}
/**
 * GC statistics
 */
export interface GCStats {
    count: number;
    totalDuration: number;
    majorGC: number;
    minorGC: number;
}
/**
 * Profile options
 */
export interface ProfileOptions {
    trackMemory?: boolean;
    trackGC?: boolean;
    sampleInterval?: number;
    metadata?: Record<string, any>;
}
/**
 * Runtime profiler for performance tracking
 */
export declare class RuntimeProfiler extends EventEmitter {
    private activeProfiles;
    private completedProfiles;
    private enabled;
    private sampleInterval;
    /**
     * Start profiling a command
     */
    startProfile(command: string, options?: ProfileOptions): string;
    /**
     * End profiling
     */
    endProfile(commandId: string): RuntimeProfile | null;
    /**
     * Capture memory snapshot
     */
    private captureMemory;
    /**
     * Start memory sampling
     */
    private startMemorySampling;
    /**
     * Stop memory sampling
     */
    private stopMemorySampling;
    /**
     * Add metadata to active profile
     */
    addMetadata(commandId: string, key: string, value: any): void;
    /**
     * Get completed profiles
     */
    getCompletedProfiles(): RuntimeProfile[];
    /**
     * Get active profiles
     */
    getActiveProfiles(): string[];
    /**
     * Clear completed profiles
     */
    clearProfiles(): void;
    /**
     * Enable profiling
     */
    enable(): void;
    /**
     * Disable profiling
     */
    disable(): void;
    /**
     * Check if enabled
     */
    isEnabled(): boolean;
    /**
     * Generate unique ID
     */
    private generateId;
    /**
     * Get profile statistics
     */
    getStatistics(): ProfileStatistics;
    /**
     * Calculate average
     */
    private average;
}
/**
 * Profile statistics
 */
export interface ProfileStatistics {
    count: number;
    averageDuration: number;
    averageCPU: number;
    averageMemory: number;
    peakMemory: number;
}
/**
 * Create runtime profiler
 */
export declare function createRuntimeProfiler(): RuntimeProfiler;
/**
 * Get global profiler
 */
export declare function getGlobalProfiler(): RuntimeProfiler;
/**
 * Reset global profiler
 */
export declare function resetGlobalProfiler(): void;
//# sourceMappingURL=RuntimeProfiler.d.ts.map