/**
 * CLI Startup Monitor
 * Sprint 5 Day 44: Monitor and optimize CLI startup performance
 */
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
/**
 * Startup monitor for CLI performance
 */
export class StartupMonitor extends EventEmitter {
    enabled = true;
    startTime = 0;
    initialMemory = 0;
    phases = [];
    activePhase = null;
    thresholds = {
        slowPhase: 50, // ms
        totalStartup: 200, // ms
    };
    /**
     * Start monitoring startup
     */
    start() {
        if (!this.enabled)
            return;
        this.startTime = performance.now();
        this.initialMemory = process.memoryUsage().heapUsed;
        this.phases = [];
        this.activePhase = null;
        this.emit('startup-started', { startTime: this.startTime });
    }
    /**
     * Start a startup phase
     */
    startPhase(name, metadata) {
        if (!this.enabled)
            return;
        // End previous phase if exists
        if (this.activePhase) {
            this.endPhase();
        }
        this.activePhase = {
            name,
            startTime: performance.now(),
            metadata,
        };
        this.emit('phase-started', { name });
    }
    /**
     * End current phase
     */
    endPhase() {
        if (!this.enabled || !this.activePhase)
            return;
        const endTime = performance.now();
        const currentMemory = process.memoryUsage().heapUsed;
        this.activePhase.endTime = endTime;
        this.activePhase.duration = endTime - this.activePhase.startTime;
        // Calculate memory delta from start
        this.activePhase.memoryDelta = currentMemory - this.initialMemory;
        this.phases.push(this.activePhase);
        this.emit('phase-ended', {
            name: this.activePhase.name,
            duration: this.activePhase.duration,
        });
        this.activePhase = null;
    }
    /**
     * Finish monitoring and generate report
     */
    finish() {
        if (!this.enabled) {
            return this.createEmptyReport();
        }
        // End active phase if any
        if (this.activePhase) {
            this.endPhase();
        }
        const endTime = performance.now();
        const finalMemory = process.memoryUsage().heapUsed;
        const totalDuration = endTime - this.startTime;
        // Find slowest phases
        const sortedPhases = [...this.phases].sort((a, b) => (b.duration || 0) - (a.duration || 0));
        const slowestPhases = sortedPhases.slice(0, 3);
        // Generate recommendations
        const recommendations = this.generateRecommendations(totalDuration, sortedPhases);
        const report = {
            totalDuration,
            phases: this.phases,
            slowestPhases,
            memoryUsage: {
                initial: this.initialMemory,
                final: finalMemory,
                delta: finalMemory - this.initialMemory,
            },
            recommendations,
        };
        this.emit('startup-finished', report);
        return report;
    }
    /**
     * Generate optimization recommendations
     */
    generateRecommendations(totalDuration, sortedPhases) {
        const recommendations = [];
        // Check total startup time
        if (totalDuration > this.thresholds.totalStartup) {
            recommendations.push(`Startup time (${totalDuration.toFixed(2)}ms) exceeds target (${this.thresholds.totalStartup}ms)`);
        }
        // Check for slow phases
        for (const phase of sortedPhases) {
            if ((phase.duration || 0) > this.thresholds.slowPhase) {
                recommendations.push(`Phase "${phase.name}" is slow (${phase.duration?.toFixed(2)}ms). Consider lazy loading or optimization.`);
            }
        }
        // Check memory usage
        const memoryMB = (process.memoryUsage().heapUsed - this.initialMemory) / 1024 / 1024;
        if (memoryMB > 50) {
            recommendations.push(`High memory usage during startup (${memoryMB.toFixed(2)}MB). Review loaded modules.`);
        }
        return recommendations;
    }
    /**
     * Create empty report
     */
    createEmptyReport() {
        return {
            totalDuration: 0,
            phases: [],
            slowestPhases: [],
            memoryUsage: {
                initial: 0,
                final: 0,
                delta: 0,
            },
            recommendations: [],
        };
    }
    /**
     * Get current phases
     */
    getPhases() {
        return [...this.phases];
    }
    /**
     * Set thresholds
     */
    setThresholds(thresholds) {
        this.thresholds = {
            ...this.thresholds,
            ...thresholds,
        };
    }
    /**
     * Get thresholds
     */
    getThresholds() {
        return { ...this.thresholds };
    }
    /**
     * Enable monitoring
     */
    enable() {
        this.enabled = true;
    }
    /**
     * Disable monitoring
     */
    disable() {
        this.enabled = false;
    }
    /**
     * Check if enabled
     */
    isEnabled() {
        return this.enabled;
    }
    /**
     * Format report as text
     */
    static formatReport(report) {
        const lines = [];
        lines.push('=== Startup Performance Report ===');
        lines.push('');
        lines.push(`Total Duration: ${report.totalDuration.toFixed(2)}ms`);
        lines.push(`Memory Usage: ${(report.memoryUsage.delta / 1024 / 1024).toFixed(2)}MB`);
        lines.push('');
        if (report.phases.length > 0) {
            lines.push('Phases:');
            for (const phase of report.phases) {
                lines.push(`  - ${phase.name}: ${phase.duration?.toFixed(2)}ms ${phase.memoryDelta ? `(+${(phase.memoryDelta / 1024).toFixed(0)}KB)` : ''}`);
            }
            lines.push('');
        }
        if (report.slowestPhases.length > 0) {
            lines.push('Slowest Phases:');
            for (const phase of report.slowestPhases) {
                lines.push(`  - ${phase.name}: ${phase.duration?.toFixed(2)}ms`);
            }
            lines.push('');
        }
        if (report.recommendations.length > 0) {
            lines.push('Recommendations:');
            for (const rec of report.recommendations) {
                lines.push(`  - ${rec}`);
            }
        }
        return lines.join('\n');
    }
}
/**
 * Create startup monitor
 */
export function createStartupMonitor() {
    return new StartupMonitor();
}
/**
 * Global monitor instance
 */
let globalMonitor = null;
/**
 * Get global monitor
 */
export function getGlobalMonitor() {
    if (!globalMonitor) {
        globalMonitor = createStartupMonitor();
    }
    return globalMonitor;
}
/**
 * Reset global monitor
 */
export function resetGlobalMonitor() {
    globalMonitor = null;
}
//# sourceMappingURL=StartupMonitor.js.map