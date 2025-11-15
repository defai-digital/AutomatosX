/**
 * ValidationConfig.ts
 *
 * Feature flag configuration for validation rollout.
 * Enables gradual, non-breaking deployment with kill switches.
 *
 * ADR-014 Phase 6: Feature Flags
 * Week 2 Day 6 Part 4
 */

import { z } from 'zod';

/**
 * Validation mode for each boundary
 */
export enum ValidationMode {
  DISABLED = 'disabled',    // No validation
  LOG_ONLY = 'log_only',    // Validate but only log errors
  ENFORCE = 'enforce',       // Validate and throw on errors
}

/**
 * Configuration for validation system
 */
export interface ValidationConfig {
  // Global kill switch
  enabled: boolean;

  // Per-boundary configuration
  boundaries: {
    parser: {
      mode: ValidationMode;
      sampleRate: number; // 0.0 to 1.0 (for gradual rollout)
    };
    database: {
      mode: ValidationMode;
      sampleRate: number;
    };
  };

  // Performance limits
  performance: {
    maxValidationTimeMs: number; // Fail-fast if validation takes too long
    enableBatchOptimization: boolean;
  };

  // Monitoring
  monitoring: {
    logSuccesses: boolean;
    logFailures: boolean;
    collectMetrics: boolean;
  };
}

/**
 * Default configuration (safe, gradual rollout)
 */
export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
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
    logFailures: true,   // Always log failures
    collectMetrics: true,
  },
};

/**
 * Production configuration (full enforcement)
 */
export const PRODUCTION_VALIDATION_CONFIG: ValidationConfig = {
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
export function getValidationConfig(): ValidationConfig {
  const env = process.env.NODE_ENV || 'development';

  // Allow override via environment variables
  const enabled = process.env.VALIDATION_ENABLED !== 'false';
  const parserMode = process.env.VALIDATION_PARSER_MODE as ValidationMode || undefined;
  const databaseMode = process.env.VALIDATION_DATABASE_MODE as ValidationMode || undefined;
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
export function shouldValidate(sampleRate: number): boolean {
  if (sampleRate >= 1.0) return true;
  if (sampleRate <= 0.0) return false;
  return Math.random() < sampleRate;
}

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
export function createValidationContext(
  boundary: 'parser' | 'database',
  operation: string
): ValidationContext {
  return {
    boundary,
    operation,
    startTime: performance.now(),
  };
}
