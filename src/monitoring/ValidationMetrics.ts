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
  errorCount?: number; // For batch validation
  totalCount?: number; // For batch validation
}

/**
 * Aggregated validation metrics
 */
export interface ValidationMetrics {
  // Per-boundary metrics
  parser: BoundaryMetrics;
  database: BoundaryMetrics;

  // Overall metrics
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
  errorPatterns: Record<string, number>; // error message → count
}

/**
 * In-memory metrics collector
 */
class MetricsCollector {
  private results: ValidationResult[] = [];
  private readonly maxResults = 10000; // Keep last 10k results

  /**
   * Record validation result
   */
  record(result: ValidationResult): void {
    this.results.push(result);

    // Trim old results (LRU)
    if (this.results.length > this.maxResults) {
      this.results = this.results.slice(-this.maxResults);
    }

    // Log failures
    if (!result.success && result.error) {
      console.error('[Validation] Failed', {
        boundary: result.context.boundary,
        operation: result.context.operation,
        durationMs: result.durationMs.toFixed(3),
        errors: result.error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
    }
  }

  /**
   * Get aggregated metrics
   */
  getMetrics(): ValidationMetrics {
    const parserResults = this.results.filter(r => r.context.boundary === 'parser');
    const databaseResults = this.results.filter(r => r.context.boundary === 'database');

    return {
      parser: this.aggregateBoundaryMetrics(parserResults),
      database: this.aggregateBoundaryMetrics(databaseResults),
      total: {
        validations: this.results.length,
        successes: this.results.filter(r => r.success).length,
        failures: this.results.filter(r => !r.success).length,
        successRate: this.results.length > 0
          ? this.results.filter(r => r.success).length / this.results.length
          : 1,
        avgDurationMs: this.avg(this.results.map(r => r.durationMs)),
        p95DurationMs: this.percentile(this.results.map(r => r.durationMs), 95),
        p99DurationMs: this.percentile(this.results.map(r => r.durationMs), 99),
      },
    };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.results = [];
  }

  private aggregateBoundaryMetrics(results: ValidationResult[]): BoundaryMetrics {
    const operations: Record<string, OperationMetrics> = {};

    for (const result of results) {
      const op = result.context.operation;
      if (!operations[op]) {
        operations[op] = {
          validations: 0,
          successes: 0,
          failures: 0,
          avgDurationMs: 0,
          errorPatterns: {},
        };
      }

      operations[op].validations++;
      if (result.success) {
        operations[op].successes++;
      } else {
        operations[op].failures++;

        // Collect error patterns
        if (result.error) {
          for (const error of result.error.errors) {
            const key = `${error.path.join('.')}: ${error.message}`;
            operations[op].errorPatterns[key] = (operations[op].errorPatterns[key] || 0) + 1;
          }
        }
      }
    }

    // Calculate averages
    for (const op in operations) {
      const opResults = results.filter(r => r.context.operation === op);
      operations[op].avgDurationMs = this.avg(opResults.map(r => r.durationMs));
    }

    return {
      validations: results.length,
      successes: results.filter(r => r.success).length,
      failures: results.filter(r => !r.success).length,
      successRate: results.length > 0
        ? results.filter(r => r.success).length / results.length
        : 1,
      avgDurationMs: this.avg(results.map(r => r.durationMs)),
      operations,
    };
  }

  private avg(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}

// Singleton instance
export const validationMetrics = new MetricsCollector();

/**
 * Record validation result
 */
export function recordValidation(result: ValidationResult): void {
  validationMetrics.record(result);
}

/**
 * Get current metrics
 */
export function getValidationMetrics(): ValidationMetrics {
  return validationMetrics.getMetrics();
}

/**
 * Reset metrics (for testing)
 */
export function resetValidationMetrics(): void {
  validationMetrics.reset();
}
