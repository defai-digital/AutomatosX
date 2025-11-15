/**
 * ValidationMetrics.ts
 *
 * Metrics collection for validation system.
 * Tracks success/failure rates, performance, and error patterns.
 *
 * ADR-014 Phase 6: Monitoring
 * Week 2 Day 6 Part 4
 */
import { ValidationContext } from '../config/ValidationConfig.js';
import { ZodError } from 'zod';
/**
 * Validation result for metrics
 */
export interface ValidationResult {
    context: ValidationContext;
    success: boolean;
    durationMs: number;
    error?: ZodError;
    errorCount?: number;
    totalCount?: number;
}
/**
 * Aggregated validation metrics
 */
export interface ValidationMetrics {
    parser: BoundaryMetrics;
    database: BoundaryMetrics;
    total: {
        validations: number;
        successes: number;
        failures: number;
        successRate: number;
        avgDurationMs: number;
        p95DurationMs: number;
        p99DurationMs: number;
    };
}
export interface BoundaryMetrics {
    validations: number;
    successes: number;
    failures: number;
    successRate: number;
    avgDurationMs: number;
    operations: Record<string, OperationMetrics>;
}
export interface OperationMetrics {
    validations: number;
    successes: number;
    failures: number;
    avgDurationMs: number;
    errorPatterns: Record<string, number>;
}
/**
 * In-memory metrics collector
 */
declare class MetricsCollector {
    private results;
    private readonly maxResults;
    /**
     * Record validation result
     */
    record(result: ValidationResult): void;
    /**
     * Get aggregated metrics
     */
    getMetrics(): ValidationMetrics;
    /**
     * Reset metrics
     */
    reset(): void;
    private aggregateBoundaryMetrics;
    private avg;
    private percentile;
}
export declare const validationMetrics: MetricsCollector;
/**
 * Record validation result
 */
export declare function recordValidation(result: ValidationResult): void;
/**
 * Get current metrics
 */
export declare function getValidationMetrics(): ValidationMetrics;
/**
 * Reset metrics (for testing)
 */
export declare function resetValidationMetrics(): void;
export {};
//# sourceMappingURL=ValidationMetrics.d.ts.map