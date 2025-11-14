/**
 * CLI Startup Monitor
 * Sprint 5 Day 44: Monitor and optimize CLI startup performance
 */
import { EventEmitter } from 'events';
/**
 * Startup phase
 */
export interface StartupPhase {
    name: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    memoryDelta?: number;
    metadata?: Record<string, any>;
}
/**
 * Startup report
 */
export interface StartupReport {
    totalDuration: number;
    phases: StartupPhase[];
    slowestPhases: StartupPhase[];
    memoryUsage: {
        initial: number;
        final: number;
        delta: number;
    };
    recommendations: string[];
}
/**
 * Startup monitor for CLI performance
 */
export declare class StartupMonitor extends EventEmitter {
    private enabled;
    private startTime;
    private initialMemory;
    private phases;
    private activePhase;
    private thresholds;
    /**
     * Start monitoring startup
     */
    start(): void;
    /**
     * Start a startup phase
     */
    startPhase(name: string, metadata?: Record<string, any>): void;
    /**
     * End current phase
     */
    endPhase(): void;
    /**
     * Finish monitoring and generate report
     */
    finish(): StartupReport;
    /**
     * Generate optimization recommendations
     */
    private generateRecommendations;
    /**
     * Create empty report
     */
    private createEmptyReport;
    /**
     * Get current phases
     */
    getPhases(): StartupPhase[];
    /**
     * Set thresholds
     */
    setThresholds(thresholds: Partial<typeof this.thresholds>): void;
    /**
     * Get thresholds
     */
    getThresholds(): typeof this.thresholds;
    /**
     * Enable monitoring
     */
    enable(): void;
    /**
     * Disable monitoring
     */
    disable(): void;
    /**
     * Check if enabled
     */
    isEnabled(): boolean;
    /**
     * Format report as text
     */
    static formatReport(report: StartupReport): string;
}
/**
 * Create startup monitor
 */
export declare function createStartupMonitor(): StartupMonitor;
/**
 * Get global monitor
 */
export declare function getGlobalMonitor(): StartupMonitor;
/**
 * Reset global monitor
 */
export declare function resetGlobalMonitor(): void;
//# sourceMappingURL=StartupMonitor.d.ts.map