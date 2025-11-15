/**
 * AutomatosX v8.0.0 - Safety Evaluator
 *
 * Evaluates safety of continuing iterations based on:
 * - Cost limits
 * - Duration limits
 * - Risk level
 * - Failure patterns
 */
import type { SafetyEvaluation, Strategy, IterationResult } from '../types/iterate.types.js';
/**
 * Safety Evaluator
 *
 * Determines if it's safe to continue iterating based on:
 * - Cost constraints
 * - Time constraints
 * - Risk assessment
 * - Failure patterns
 */
export declare class SafetyEvaluator {
    /**
     * Evaluate safety of continuing with given strategy
     */
    evaluate(strategy: Strategy, safetyLevel: 'permissive' | 'normal' | 'paranoid', iterationHistory: IterationResult[]): Promise<SafetyEvaluation>;
    /**
     * Check if cost limit exceeded
     */
    private checkCostLimit;
    /**
     * Check if duration limit exceeded
     */
    private checkDurationLimit;
    /**
     * Check failure pattern safety
     */
    private checkFailurePattern;
    /**
     * Calculate risk score (0.0-1.0)
     */
    private calculateRiskScore;
    /**
     * Calculate failure rate
     */
    private calculateFailureRate;
    /**
     * Count consecutive failures at end of history
     */
    private countConsecutiveFailures;
    /**
     * Calculate total cost
     */
    private calculateTotalCost;
    /**
     * Calculate total duration
     */
    private calculateTotalDuration;
    /**
     * Get safety thresholds for level
     */
    getSafetyThresholds(safetyLevel: 'permissive' | 'normal' | 'paranoid'): {
        maxCostPerIteration: number;
        maxTotalCost: number;
        maxDurationPerIteration: number;
        maxTotalDuration: number;
        maxConsecutiveFailures: number;
        riskTolerance: number;
    } | {
        maxCostPerIteration: number;
        maxTotalCost: number;
        maxDurationPerIteration: number;
        maxTotalDuration: number;
        maxConsecutiveFailures: number;
        riskTolerance: number;
    } | {
        maxCostPerIteration: number;
        maxTotalCost: number;
        maxDurationPerIteration: number;
        maxTotalDuration: number;
        maxConsecutiveFailures: number;
        riskTolerance: number;
    };
}
//# sourceMappingURL=SafetyEvaluator.d.ts.map