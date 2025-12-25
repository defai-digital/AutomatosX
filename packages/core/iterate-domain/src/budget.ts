/**
 * Budget Tracker
 *
 * Tracks iteration budget consumption (iterations, time, tokens).
 *
 * Invariants:
 * - INV-ITR-001: Budget limits must be enforced
 */

import {
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_MAX_TIME_MS,
  type IterateBudget,
  type BudgetConsumed,
  type IterateBudgetStatus,
} from '@defai.digital/contracts';
import type { IBudgetTracker } from './types.js';

// ============================================================================
// Budget Tracker Implementation
// ============================================================================

/**
 * Tracks budget consumption for iterate mode
 */
export class BudgetTracker implements IBudgetTracker {
  private budget: IterateBudget;
  private consumed: BudgetConsumed;
  private startTime = 0;

  constructor(budget?: Partial<IterateBudget>) {
    this.budget = {
      maxIterations: budget?.maxIterations ?? DEFAULT_MAX_ITERATIONS,
      maxTimeMs: budget?.maxTimeMs ?? DEFAULT_MAX_TIME_MS,
      maxTokens: budget?.maxTokens,
    };

    this.consumed = {
      iterations: 0,
      timeMs: 0,
      tokens: 0,
    };
  }

  /**
   * Start tracking budget
   */
  start(): void {
    this.startTime = Date.now();
    this.consumed = {
      iterations: 0,
      timeMs: 0,
      tokens: 0,
    };
  }

  /**
   * Record an iteration
   */
  recordIteration(tokens?: number): void {
    this.consumed.iterations++;
    this.consumed.timeMs = Date.now() - this.startTime;
    if (tokens !== undefined) {
      this.consumed.tokens = (this.consumed.tokens ?? 0) + tokens;
    }
  }

  /**
   * Check budget status
   */
  check(): IterateBudgetStatus {
    // Update time consumed
    this.consumed.timeMs = Date.now() - this.startTime;

    const remainingIterations = this.budget.maxIterations - this.consumed.iterations;
    const remainingTimeMs = this.budget.maxTimeMs - this.consumed.timeMs;
    const remainingTokens = this.budget.maxTokens !== undefined
      ? this.budget.maxTokens - (this.consumed.tokens ?? 0)
      : undefined;

    // Check what's exceeded
    if (this.consumed.iterations >= this.budget.maxIterations) {
      return {
        exceeded: true,
        reason: `Max iterations exceeded (${this.consumed.iterations}/${this.budget.maxIterations})`,
        remaining: {
          iterations: 0,
          timeMs: Math.max(0, remainingTimeMs),
          tokens: remainingTokens !== undefined ? Math.max(0, remainingTokens) : undefined,
        },
      };
    }

    if (this.consumed.timeMs >= this.budget.maxTimeMs) {
      return {
        exceeded: true,
        reason: `Max time exceeded (${Math.round(this.consumed.timeMs / 1000)}s/${Math.round(this.budget.maxTimeMs / 1000)}s)`,
        remaining: {
          iterations: Math.max(0, remainingIterations),
          timeMs: 0,
          tokens: remainingTokens !== undefined ? Math.max(0, remainingTokens) : undefined,
        },
      };
    }

    if (
      this.budget.maxTokens !== undefined &&
      this.consumed.tokens !== undefined &&
      this.consumed.tokens >= this.budget.maxTokens
    ) {
      return {
        exceeded: true,
        reason: `Max tokens exceeded (${this.consumed.tokens}/${this.budget.maxTokens})`,
        remaining: {
          iterations: Math.max(0, remainingIterations),
          timeMs: Math.max(0, remainingTimeMs),
          tokens: 0,
        },
      };
    }

    return {
      exceeded: false,
      remaining: {
        iterations: remainingIterations,
        timeMs: remainingTimeMs,
        tokens: remainingTokens,
      },
    };
  }

  /**
   * Check if budget is exceeded
   */
  isExceeded(): boolean {
    return this.check().exceeded;
  }

  /**
   * Get current consumption
   */
  getConsumed(): BudgetConsumed {
    // Update time
    this.consumed.timeMs = Date.now() - this.startTime;
    return { ...this.consumed };
  }

  /**
   * Get budget limits
   */
  getBudget(): IterateBudget {
    return { ...this.budget };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a budget tracker with optional limits
 */
export function createBudgetTracker(budget?: Partial<IterateBudget>): IBudgetTracker {
  return new BudgetTracker(budget);
}
