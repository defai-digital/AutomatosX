/**
 * ValidationConfig.ts
 *
 * Feature flag configuration for validation rollout.
 * Enables gradual, non-breaking deployment with kill switches.
 *
 * ADR-014 Phase 6: Feature Flags
 * Week 2 Day 6 Part 4
 */
/**
 * Validation mode for each boundary
 */
export declare enum ValidationMode {
    DISABLED = "disabled",// No validation
    LOG_ONLY = "log_only",// Validate but only log errors
    ENFORCE = "enforce"
}
/**
 * Configuration for validation system
 */
export interface ValidationConfig {
    enabled: boolean;
    boundaries: {
        parser: {
            mode: ValidationMode;
            sampleRate: number;
        };
        database: {
            mode: ValidationMode;
            sampleRate: number;
        };
    };
    performance: {
        maxValidationTimeMs: number;
        enableBatchOptimization: boolean;
    };
    monitoring: {
        logSuccesses: boolean;
        logFailures: boolean;
        collectMetrics: boolean;
    };
}
/**
 * Default configuration (safe, gradual rollout)
 */
export declare const DEFAULT_VALIDATION_CONFIG: ValidationConfig;
/**
 * Production configuration (full enforcement)
 */
export declare const PRODUCTION_VALIDATION_CONFIG: ValidationConfig;
/**
 * Get validation config from environment
 */
export declare function getValidationConfig(): ValidationConfig;
/**
 * Check if validation should run for this request (sampling)
 */
export declare function shouldValidate(sampleRate: number): boolean;
/**
 * Validation context for metrics
 */
export interface ValidationContext {
    boundary: 'parser' | 'database';
    operation: string;
    startTime: number;
}
/**
 * Create validation context
 */
export declare function createValidationContext(boundary: 'parser' | 'database', operation: string): ValidationContext;
//# sourceMappingURL=ValidationConfig.d.ts.map