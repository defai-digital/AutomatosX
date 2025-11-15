/**
 * AutomatosX v8.0.0 - Failure Analyzer
 *
 * Analyzes failures to classify errors and detect patterns
 */
import type { FailureAnalysis, ProgressSnapshot, IterationResult } from '../types/iterate.types.js';
/**
 * Failure Analyzer
 *
 * Analyzes errors to:
 * - Classify error types
 * - Determine if transient or permanent
 * - Detect failure patterns across iterations
 * - Recommend recovery strategies
 */
export declare class FailureAnalyzer {
    /**
     * Analyze a failure and provide classification
     */
    analyze(error: Error, progress: ProgressSnapshot, iterationHistory: IterationResult[]): Promise<FailureAnalysis>;
    /**
     * Classify error into a category
     */
    private classifyError;
    /**
     * Determine if error is transient (can be retried)
     */
    private isTransientError;
    /**
     * Determine if error is permanent (no point retrying)
     */
    private isPermanentError;
    /**
     * Assess error severity
     */
    private assessSeverity;
    /**
     * Detect failure pattern across iterations
     */
    private detectPattern;
    /**
     * Generate actionable recommendations
     */
    private generateRecommendations;
    /**
     * Calculate confidence in analysis
     */
    private calculateConfidence;
    /**
     * Extract failed step from error and progress
     */
    private extractFailedStep;
}
//# sourceMappingURL=FailureAnalyzer.d.ts.map