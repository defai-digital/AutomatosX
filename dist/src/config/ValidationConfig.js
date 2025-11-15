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
export var ValidationMode;
(function (ValidationMode) {
    ValidationMode["DISABLED"] = "disabled";
    ValidationMode["LOG_ONLY"] = "log_only";
    ValidationMode["ENFORCE"] = "enforce";
})(ValidationMode || (ValidationMode = {}));
/**
 * Default configuration (safe, gradual rollout)
 */
export const DEFAULT_VALIDATION_CONFIG = {
    enabled: true,
    boundaries: {
        parser: {
            mode: ValidationMode.LOG_ONLY, // Start with log-only
            sampleRate: 0.1, // 10% of requests
        },
        database: {
            mode: ValidationMode.LOG_ONLY,
            sampleRate: 0.1,
        },
    },
    performance: {
        maxValidationTimeMs: 50, // 50ms max overhead
        enableBatchOptimization: true,
    },
    monitoring: {
        logSuccesses: false, // Don't spam logs
        logFailures: true, // Always log failures
        collectMetrics: true,
    },
};
/**
 * Production configuration (full enforcement)
 */
export const PRODUCTION_VALIDATION_CONFIG = {
    enabled: true,
    boundaries: {
        parser: {
            mode: ValidationMode.ENFORCE,
            sampleRate: 1.0, // 100% of requests
        },
        database: {
            mode: ValidationMode.ENFORCE,
            sampleRate: 1.0,
        },
    },
    performance: {
        maxValidationTimeMs: 50,
        enableBatchOptimization: true,
    },
    monitoring: {
        logSuccesses: false,
        logFailures: true,
        collectMetrics: true,
    },
};
/**
 * Get validation config from environment
 */
export function getValidationConfig() {
    const env = process.env.NODE_ENV || 'development';
    // Allow override via environment variables
    const enabled = process.env.VALIDATION_ENABLED !== 'false';
    const parserMode = process.env.VALIDATION_PARSER_MODE || undefined;
    const databaseMode = process.env.VALIDATION_DATABASE_MODE || undefined;
    const sampleRate = parseFloat(process.env.VALIDATION_SAMPLE_RATE || '');
    const baseConfig = env === 'production'
        ? PRODUCTION_VALIDATION_CONFIG
        : DEFAULT_VALIDATION_CONFIG;
    return {
        ...baseConfig,
        enabled,
        boundaries: {
            parser: {
                ...baseConfig.boundaries.parser,
                ...(parserMode && { mode: parserMode }),
                ...(!isNaN(sampleRate) && { sampleRate }),
            },
            database: {
                ...baseConfig.boundaries.database,
                ...(databaseMode && { mode: databaseMode }),
                ...(!isNaN(sampleRate) && { sampleRate }),
            },
        },
    };
}
/**
 * Check if validation should run for this request (sampling)
 */
export function shouldValidate(sampleRate) {
    if (sampleRate >= 1.0)
        return true;
    if (sampleRate <= 0.0)
        return false;
    return Math.random() < sampleRate;
}
/**
 * Create validation context
 */
export function createValidationContext(boundary, operation) {
    return {
        boundary,
        operation,
        startTime: performance.now(),
    };
}
//# sourceMappingURL=ValidationConfig.js.map