/**
 * @automatosx/iterate-domain
 *
 * Iterate mode for AutomatosX - autonomous execution with
 * structured intent classification and safety controls.
 *
 * Key concepts:
 * - Intent: What the LLM is communicating (continue, question, blocked, complete, error)
 * - Action: What to do next (CONTINUE, PAUSE, STOP, RETRY)
 * - Budget: Resource limits (iterations, time, tokens)
 * - Safety: Pattern detection and error limits
 */

// Types
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
  IBudgetTracker,
  ISafetyGuard,
  IIterateController,
} from './types.js';

// Budget Tracker
export { BudgetTracker, createBudgetTracker } from './budget.js';

// Safety Guard
export { SafetyGuard, createSafetyGuard, isContentSafe } from './safety.js';

// Iterate Controller
export { IterateController, createIterateController } from './controller.js';

// Re-export contract constants
export {
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_MAX_TIME_MS,
  DEFAULT_MAX_CONSECUTIVE_ERRORS,
  IterateIntentSchema,
  IterateActionTypeSchema,
  IterateBudgetSchema,
  IterateStateSchema,
  validateIterateIntent,
  safeValidateIterateIntent,
  validateIterateBudget,
  validateIterateState,
  IterateErrorCode,
} from '@automatosx/contracts';
