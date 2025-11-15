/**
 * AutomatosX v8.0.0 - Strategy Telemetry
 *
 * Tracks strategy effectiveness over time
 * Provides analytics for continuous improvement
 */
import type { Database } from 'better-sqlite3';
/**
 * Strategy execution record
 */
export interface StrategyExecution {
    id?: number;
    strategyName: string;
    taskId: string;
    failureType: string;
    success: boolean;
    executionTime: number;
    timestamp: number;
    metadata?: Record<string, unknown>;
}
/**
 * Strategy statistics
 */
export interface StrategyStats {
    strategyName: string;
    totalExecutions: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    averageExecutionTime: number;
    lastUsed: number;
    failureTypes: Record<string, number>;
}
/**
 * Telemetry report
 */
export interface TelemetryReport {
    totalExecutions: number;
    overallSuccessRate: number;
    strategyRankings: Array<{
        strategy: string;
        rank: number;
        successRate: number;
        usage: number;
    }>;
    failureTypeDistribution: Record<string, number>;
    recommendations: string[];
}
/**
 * Strategy Telemetry
 *
 * Tracks and analyzes strategy performance for data-driven improvements
 */
export declare class StrategyTelemetry {
    private db;
    constructor(db: Database);
    /**
     * Initialize telemetry database tables
     */
    private initializeDatabase;
    /**
     * Record strategy execution
     */
    recordExecution(strategyName: string, taskId: string, failureType: string, success: boolean, executionTime: number, metadata?: Record<string, unknown>): void;
    /**
     * Get statistics for a specific strategy
     */
    getStrategyStats(strategyName: string): StrategyStats | null;
    /**
     * Get all strategy statistics
     */
    getAllStats(): StrategyStats[];
    /**
     * Get best strategy for a failure type
     */
    getBestStrategyForFailure(failureType: string): string | null;
    /**
     * Generate comprehensive telemetry report
     */
    generateReport(): TelemetryReport;
    /**
     * Generate recommendations based on telemetry data
     */
    private generateRecommendations;
    /**
     * Display telemetry report
     */
    displayReport(): void;
    /**
     * Display single strategy stats
     */
    displayStrategyStats(strategyName: string): void;
    /**
     * Clear all telemetry data
     */
    clearTelemetry(): void;
    /**
     * Format success rate
     */
    private formatSuccessRate;
    /**
     * Create ASCII progress bar
     */
    private createProgressBar;
}
//# sourceMappingURL=StrategyTelemetry.d.ts.map