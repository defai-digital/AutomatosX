/**
 * Plugin Profiler
 * Sprint 5 Day 49: Per-plugin profiling and metrics
 */
import { EventEmitter } from 'events';
/**
 * Plugin profiler
 */
export class PluginProfiler extends EventEmitter {
    metrics = new Map();
    calls = [];
    activeProfiles = new Map();
    enabled = true;
    /**
     * Start profiling a plugin call
     */
    startProfile(pluginId, method) {
        if (!this.enabled)
            return '';
        const profileId = `${pluginId}:${method}:${Date.now()}`;
        this.activeProfiles.set(profileId, {
            startTime: Date.now(),
            memoryBefore: this.getMemoryUsage(),
        });
        return profileId;
    }
    /**
     * End profiling a plugin call
     */
    endProfile(profileId, error) {
        if (!this.enabled)
            return null;
        const profile = this.activeProfiles.get(profileId);
        if (!profile)
            return null;
        const [pluginId, method] = profileId.split(':');
        const endTime = Date.now();
        const duration = endTime - profile.startTime;
        const memoryAfter = this.getMemoryUsage();
        const record = {
            pluginId,
            method,
            startTime: profile.startTime,
            endTime,
            duration,
            memoryBefore: profile.memoryBefore,
            memoryAfter,
            success: !error,
            error: error?.message,
        };
        this.calls.push(record);
        this.activeProfiles.delete(profileId);
        // Update metrics
        this.updateMetrics(record);
        this.emit('profile-completed', record);
        return record;
    }
    /**
     * Update plugin metrics
     */
    updateMetrics(record) {
        let metrics = this.metrics.get(record.pluginId);
        if (!metrics) {
            metrics = {
                pluginId: record.pluginId,
                totalCalls: 0,
                totalDuration: 0,
                averageDuration: 0,
                minDuration: Infinity,
                maxDuration: 0,
                memoryUsed: 0,
                peakMemory: 0,
                cpuTime: 0,
                errors: 0,
                lastCallTime: 0,
            };
            this.metrics.set(record.pluginId, metrics);
        }
        metrics.totalCalls++;
        metrics.totalDuration += record.duration;
        metrics.averageDuration = metrics.totalDuration / metrics.totalCalls;
        metrics.minDuration = Math.min(metrics.minDuration, record.duration);
        metrics.maxDuration = Math.max(metrics.maxDuration, record.duration);
        const memoryDelta = record.memoryAfter - record.memoryBefore;
        metrics.memoryUsed += memoryDelta;
        metrics.peakMemory = Math.max(metrics.peakMemory, record.memoryAfter);
        if (!record.success) {
            metrics.errors++;
            metrics.lastError = record.error;
        }
        metrics.lastCallTime = record.endTime;
        this.emit('metrics-updated', { pluginId: record.pluginId, metrics });
    }
    /**
     * Get metrics for a plugin
     */
    getMetrics(pluginId) {
        return this.metrics.get(pluginId);
    }
    /**
     * Get all metrics
     */
    getAllMetrics() {
        return Array.from(this.metrics.values());
    }
    /**
     * Get call history for a plugin
     */
    getCallHistory(pluginId, limit) {
        const history = this.calls.filter((c) => c.pluginId === pluginId);
        if (limit) {
            return history.slice(-limit);
        }
        return history;
    }
    /**
     * Get all call history
     */
    getAllCallHistory(limit) {
        if (limit) {
            return this.calls.slice(-limit);
        }
        return [...this.calls];
    }
    /**
     * Get top plugins by calls
     */
    getTopPluginsByCalls(limit = 10) {
        return Array.from(this.metrics.values())
            .sort((a, b) => b.totalCalls - a.totalCalls)
            .slice(0, limit);
    }
    /**
     * Get top plugins by duration
     */
    getTopPluginsByDuration(limit = 10) {
        return Array.from(this.metrics.values())
            .sort((a, b) => b.totalDuration - a.totalDuration)
            .slice(0, limit);
    }
    /**
     * Get top plugins by memory
     */
    getTopPluginsByMemory(limit = 10) {
        return Array.from(this.metrics.values())
            .sort((a, b) => b.peakMemory - a.peakMemory)
            .slice(0, limit);
    }
    /**
     * Get plugins with errors
     */
    getPluginsWithErrors() {
        return Array.from(this.metrics.values())
            .filter((m) => m.errors > 0)
            .sort((a, b) => b.errors - a.errors);
    }
    /**
     * Clear metrics for a plugin
     */
    clearMetrics(pluginId) {
        this.metrics.delete(pluginId);
        this.calls = this.calls.filter((c) => c.pluginId !== pluginId);
        this.emit('metrics-cleared', { pluginId });
    }
    /**
     * Clear all metrics
     */
    clearAllMetrics() {
        this.metrics.clear();
        this.calls = [];
        this.emit('all-metrics-cleared');
    }
    /**
     * Enable profiling
     */
    enable() {
        this.enabled = true;
        this.emit('enabled');
    }
    /**
     * Disable profiling
     */
    disable() {
        this.enabled = false;
        this.emit('disabled');
    }
    /**
     * Check if enabled
     */
    isEnabled() {
        return this.enabled;
    }
    /**
     * Get memory usage
     */
    getMemoryUsage() {
        return process.memoryUsage().heapUsed;
    }
    /**
     * Get statistics
     */
    getStatistics() {
        const metricsArray = Array.from(this.metrics.values());
        const totalCalls = metricsArray.reduce((sum, m) => sum + m.totalCalls, 0);
        const totalDuration = metricsArray.reduce((sum, m) => sum + m.totalDuration, 0);
        const totalMemory = metricsArray.reduce((sum, m) => sum + m.peakMemory, 0);
        const totalErrors = metricsArray.reduce((sum, m) => sum + m.errors, 0);
        return {
            totalPlugins: metricsArray.length,
            totalCalls,
            totalDuration,
            totalMemory,
            totalErrors,
            averageCallsPerPlugin: metricsArray.length > 0 ? totalCalls / metricsArray.length : 0,
            averageDurationPerCall: totalCalls > 0 ? totalDuration / totalCalls : 0,
        };
    }
    /**
     * Export metrics as JSON
     */
    exportMetrics() {
        return JSON.stringify({
            metrics: Array.from(this.metrics.values()),
            calls: this.calls,
            statistics: this.getStatistics(),
        }, null, 2);
    }
    /**
     * Format metrics for display
     */
    static formatMetrics(metrics) {
        return `Plugin: ${metrics.pluginId}
  Total Calls: ${metrics.totalCalls}
  Average Duration: ${metrics.averageDuration.toFixed(2)}ms
  Min/Max Duration: ${metrics.minDuration.toFixed(2)}ms / ${metrics.maxDuration.toFixed(2)}ms
  Peak Memory: ${(metrics.peakMemory / 1024 / 1024).toFixed(2)}MB
  Errors: ${metrics.errors}${metrics.lastError ? `\n  Last Error: ${metrics.lastError}` : ''}`;
    }
}
/**
 * Create plugin profiler
 */
export function createPluginProfiler() {
    return new PluginProfiler();
}
/**
 * Global profiler instance
 */
let globalProfiler = null;
/**
 * Get global profiler
 */
export function getGlobalPluginProfiler() {
    if (!globalProfiler) {
        globalProfiler = createPluginProfiler();
    }
    return globalProfiler;
}
/**
 * Reset global profiler
 */
export function resetGlobalPluginProfiler() {
    globalProfiler = null;
}
//# sourceMappingURL=PluginProfiler.js.map