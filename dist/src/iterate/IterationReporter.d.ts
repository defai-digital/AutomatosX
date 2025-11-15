/**
 * AutomatosX v8.0.0 - Iteration Reporter
 *
 * Generates comprehensive reports for Iterate Mode execution
 * Provides detailed analysis, metrics, and visualizations
 */
/**
 * Iteration result
 */
export interface IterationResult {
    iteration: number;
    strategy: string;
    success: boolean;
    executionTime: number;
    error?: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}
/**
 * Execution summary
 */
export interface ExecutionSummary {
    taskId: string;
    totalIterations: number;
    successfulIterations: number;
    failedIterations: number;
    totalExecutionTime: number;
    averageIterationTime: number;
    finalStatus: 'success' | 'failure' | 'timeout' | 'aborted';
    strategiesUsed: string[];
    mostEffectiveStrategy?: string;
    iterations: IterationResult[];
}
/**
 * Iteration Reporter
 *
 * Analyzes iteration execution and generates detailed reports
 */
export declare class IterationReporter {
    /**
     * Generate comprehensive execution report
     */
    generateReport(summary: ExecutionSummary): string;
    /**
     * Add timeline visualization
     */
    private addTimeline;
    /**
     * Add error analysis
     */
    private addErrorAnalysis;
    /**
     * Add recommendations
     */
    private addRecommendations;
    /**
     * Generate compact summary (for inline display)
     */
    generateCompactSummary(summary: ExecutionSummary): string;
    /**
     * Generate markdown report (for file export)
     */
    generateMarkdownReport(summary: ExecutionSummary): string;
    /**
     * Format status
     */
    private formatStatus;
    /**
     * Format success rate
     */
    private formatSuccessRate;
    /**
     * Format duration
     */
    private formatDuration;
    /**
     * Count consecutive failures
     */
    private countConsecutiveFailures;
    /**
     * Truncate string
     */
    private truncate;
}
//# sourceMappingURL=IterationReporter.d.ts.map