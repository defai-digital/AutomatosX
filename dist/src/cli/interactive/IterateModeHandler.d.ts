/**
 * AutomatosX v8.0.0 - Iterate Mode Handler
 *
 * Orchestrates iterate mode execution with all strategies, telemetry, and reporting
 */
import type { Database } from 'better-sqlite3';
/**
 * Iterate execution options
 */
export interface IterateOptions {
    maxIterations?: number;
    timeout?: number;
    safetyLevel?: 'low' | 'medium' | 'high';
    verbose?: boolean;
}
/**
 * Iterate Mode Handler
 *
 * Handles autonomous task execution with adaptive retry strategies
 */
export declare class IterateModeHandler {
    private db;
    private strategySelector;
    private telemetry;
    private reporter;
    constructor(db: Database);
    /**
     * Execute task with iterate mode
     */
    execute(taskDescription: string, options?: IterateOptions): Promise<void>;
    /**
     * Execute single iteration
     */
    private executeIteration;
    /**
     * Simulate task execution (placeholder for actual workflow execution)
     */
    private simulateTaskExecution;
    /**
     * Estimate task complexity from description
     */
    private estimateComplexity;
    /**
     * Classify failure type from error message
     */
    private classifyFailureType;
    /**
     * Count consecutive failures
     */
    private countConsecutiveFailures;
    /**
     * Calculate average latency
     */
    private calculateAverageLatency;
    /**
     * Find most effective strategy
     */
    private findMostEffectiveStrategy;
    /**
     * Format duration
     */
    private formatDuration;
    /**
     * Display telemetry report
     */
    displayTelemetry(): void;
    /**
     * Display strategy statistics
     */
    displayStrategyStats(strategyName: string): void;
    /**
     * List all strategies
     */
    listStrategies(): void;
}
//# sourceMappingURL=IterateModeHandler.d.ts.map