/**
 * AutomatosX v8.0.0 - Progress Monitor
 *
 * Real-time progress tracking for Iterate Mode
 * Uses cli-progress for visual feedback
 */
/**
 * Progress state
 */
export interface ProgressState {
    currentIteration: number;
    maxIterations: number;
    currentStrategy: string;
    success: boolean;
    startTime: number;
    lastUpdateTime: number;
    estimatedTimeRemaining?: number;
}
/**
 * Progress metrics
 */
export interface ProgressMetrics {
    totalIterations: number;
    successfulIterations: number;
    failedIterations: number;
    averageIterationTime: number;
    elapsedTime: number;
    estimatedCompletion: number;
    successRate: number;
}
/**
 * Progress Monitor
 *
 * Provides real-time visual feedback during iterate execution
 * Tracks progress, estimates completion time, and displays metrics
 */
export declare class ProgressMonitor {
    private progressBar;
    private state;
    private iterationTimes;
    constructor(maxIterations?: number);
    /**
     * Start progress monitoring
     */
    start(): void;
    /**
     * Update progress
     */
    update(iteration: number, strategy: string, success: boolean, status?: string): void;
    /**
     * Stop progress monitoring
     */
    stop(success: boolean, message?: string): void;
    /**
     * Display detailed metrics
     */
    displayMetrics(): void;
    /**
     * Get current metrics
     */
    getMetrics(): ProgressMetrics;
    /**
     * Calculate estimated time remaining
     */
    private calculateETA;
    /**
     * Get progress bar format string
     */
    private getProgressFormat;
    /**
     * Format status indicator
     */
    private formatStatus;
    /**
     * Format ETA
     */
    private formatETA;
    /**
     * Format duration
     */
    private formatDuration;
    /**
     * Format success rate
     */
    private formatSuccessRate;
    /**
     * Truncate string to max length
     */
    private truncate;
    /**
     * Pause progress bar
     */
    pause(): void;
    /**
     * Resume progress bar
     */
    resume(): void;
}
//# sourceMappingURL=ProgressMonitor.d.ts.map