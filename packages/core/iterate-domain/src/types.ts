/**
 * Iterate Domain Internal Types
 *
 * Internal types for the iterate mode implementation.
 */

import type {
  IterateIntent,
  IterateAction,
  IterateBudget,
  BudgetConsumed,
  IterateBudgetStatus,
  IterateState,
  IterateSafetyConfig,
  SafetyCheckResult,
  IterateStartRequest,
  IterateHandleResponse,
} from '@defai.digital/contracts';

// Re-export contract types for convenience
export type {
  IterateIntent,
  IterateAction,
  IterateBudget,
  BudgetConsumed,
  IterateBudgetStatus,
  IterateState,
  IterateSafetyConfig,
  SafetyCheckResult,
  IterateStartRequest,
  IterateHandleResponse,
};

/**
 * Budget tracker interface
 */
export interface IBudgetTracker {
  /**
   * Start tracking budget
   */
  start(): void;

  /**
   * Record an iteration
   */
  recordIteration(tokens?: number): void;

  /**
   * Check budget status
   */
  check(): IterateBudgetStatus;

  /**
   * Check if budget is exceeded
   */
  isExceeded(): boolean;

  /**
   * Get current consumption
   */
  getConsumed(): BudgetConsumed;

  /**
   * Get budget limits
   */
  getBudget(): IterateBudget;
}

/**
 * Safety guard interface
 */
export interface ISafetyGuard {
  /**
   * Check content for dangerous patterns
   */
  checkContent(content: string): SafetyCheckResult;

  /**
   * Check if too many consecutive errors
   */
  checkErrors(consecutiveErrors: number): SafetyCheckResult;

  /**
   * Get safety configuration
   */
  getConfig(): IterateSafetyConfig;
}

/**
 * Iterate controller interface
 */
export interface IIterateController {
  /**
   * Start a new iterate session
   */
  start(request: IterateStartRequest): IterateState;

  /**
   * Handle a response from the LLM
   */
  handleResponse(
    state: IterateState,
    intent: IterateIntent,
    content?: string
  ): IterateHandleResponse;

  /**
   * Get auto-response for CONTINUE action
   */
  getAutoResponse(intent: IterateIntent): string;
}
