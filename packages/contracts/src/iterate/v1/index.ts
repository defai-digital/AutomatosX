/**
 * Iterate Mode Contracts v1
 */

export {
  // Constants
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_MAX_TIME_MS,
  DEFAULT_MAX_CONSECUTIVE_ERRORS,
  // Schemas
  IterateIntentSchema,
  IterateActionTypeSchema,
  IterateActionSchema,
  IterateBudgetSchema,
  BudgetConsumedSchema,
  IterateBudgetStatusSchema,
  IterateStateSchema,
  IterateSafetyConfigSchema,
  SafetyCheckResultSchema,
  IterateStartRequestSchema,
  IterateHandleResponseSchema,
  // Error codes
  IterateErrorCode,
  // Validation functions
  validateIterateIntent,
  safeValidateIterateIntent,
  validateIterateBudget,
  validateIterateState,
  validateIterateStartRequest,
  validateIterateSafetyConfig,
  // Types
  type IterateIntent,
  type IterateActionType,
  type IterateAction,
  type IterateBudget,
  type BudgetConsumed,
  type IterateBudgetStatus,
  type IterateState,
  type IterateSafetyConfig,
  type SafetyCheckResult,
  type IterateStartRequest,
  type IterateHandleResponse,
} from './schema.js';
