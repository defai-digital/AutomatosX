/**
 * Plugin Profiler
 * Sprint 5 Day 49: Per-plugin profiling and metrics
 */
import { EventEmitter } from 'events';
/**
 * Plugin metrics
 */
export interface PluginMetrics {
    pluginId: string;
    totalCalls: number;
    totalDuration: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    memoryUsed: number;
    peakMemory: number;
    cpuTime: number;
    errors: number;
    lastError?: string;
    lastCallTime: number;
}
/**
 * Plugin call record
 */
export interface PluginCallRecord {
    pluginId: string;
    method: string;
    startTime: number;
    endTime: number;
    duration: number;
    memoryBefore: number;
    memoryAfter: number;
    success: boolean;
    error?: string;
}
/**
 * Plugin profiler
 */
export declare class PluginProfiler extends EventEmitter {
    private metrics;
    private calls;
    private activeProfiles;
    private enabled;
    /**
     * Start profiling a plugin call
     */
    startProfile(pluginId: string, method: string): string;
    /**
     * End profiling a plugin call
     */
    endProfile(profileId: string, error?: Error): PluginCallRecord | null;
    /**
     * Update plugin metrics
     */
    private updateMetrics;
    /**
     * Get metrics for a plugin
     */
    getMetrics(pluginId: string): PluginMetrics | undefined;
    /**
     * Get all metrics
     */
    getAllMetrics(): PluginMetrics[];
    /**
     * Get call history for a plugin
     */
    getCallHistory(pluginId: string, limit?: number): PluginCallRecord[];
    /**
     * Get all call history
     */
    getAllCallHistory(limit?: number): PluginCallRecord[];
    /**
     * Get top plugins by calls
     */
    getTopPluginsByCalls(limit?: number): PluginMetrics[];
    /**
     * Get top plugins by duration
     */
    getTopPluginsByDuration(limit?: number): PluginMetrics[];
    /**
     * Get top plugins by memory
     */
    getTopPluginsByMemory(limit?: number): PluginMetrics[];
    /**
     * Get plugins with errors
     */
    getPluginsWithErrors(): PluginMetrics[];
    /**
     * Clear metrics for a plugin
     */
    clearMetrics(pluginId: string): void;
    /**
     * Clear all metrics
     */
    clearAllMetrics(): void;
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
     * Get memory usage
     */
    private getMemoryUsage;
    /**
     * Get statistics
     */
    getStatistics(): {
        totalPlugins: number;
        totalCalls: number;
        totalDuration: number;
        totalMemory: number;
        totalErrors: number;
        averageCallsPerPlugin: number;
        averageDurationPerCall: number;
    };
    /**
     * Export metrics as JSON
     */
    exportMetrics(): string;
    /**
     * Format metrics for display
     */
    static formatMetrics(metrics: PluginMetrics): string;
}
/**
 * Create plugin profiler
 */
export declare function createPluginProfiler(): PluginProfiler;
/**
 * Get global profiler
 */
export declare function getGlobalPluginProfiler(): PluginProfiler;
/**
 * Reset global profiler
 */
export declare function resetGlobalPluginProfiler(): void;
//# sourceMappingURL=PluginProfiler.d.ts.map