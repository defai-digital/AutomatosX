/**
 * Iterate Mode Contracts v1
 *
 * Zod schemas for iterate mode - autonomous execution with structured
 * intent classification and safety controls.
 *
 * Invariants:
 * - INV-ITR-001: Budget limits must be enforced (iterations, time, tokens)
 * - INV-ITR-002: Safety guards must pause on dangerous patterns
 * - INV-ITR-003: Intent classification drives action decisions
 */

import { z } from 'zod';
import { ITERATE_TIMEOUT_DEFAULT, ITERATE_MAX_DEFAULT } from '../../constants.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default budget values
 * Note: Uses constants from central constants.ts for consistency
 */
export const DEFAULT_MAX_ITERATIONS = ITERATE_MAX_DEFAULT;
export const DEFAULT_MAX_TIME_MS = ITERATE_TIMEOUT_DEFAULT;
export const DEFAULT_MAX_CONSECUTIVE_ERRORS = 3;

// ============================================================================
// Intent Schema
// ============================================================================

/**
 * Intent classification from LLM response
 * This determines whether to continue, pause, or stop iteration
 */
export const IterateIntentSchema = z.enum([
  'continue', // Task in progress, no input needed
  'question', // Needs user decision (which approach?)
  'blocked', // Needs external input (API key, credentials)
  'complete', // Task finished successfully
  'error', // Something failed
]);

export type IterateIntent = z.infer<typeof IterateIntentSchema>;

// ============================================================================
// Action Schema
// ============================================================================

/**
 * Action to take based on intent and budget
 */
export const IterateActionTypeSchema = z.enum([
  'CONTINUE', // Auto-proceed to next iteration
  'PAUSE', // Pause and wait for user input
  'STOP', // End iteration loop
  'RETRY', // Retry with different provider (rate limit)
]);

export type IterateActionType = z.infer<typeof IterateActionTypeSchema>;

/**
 * Full action with reason
 */
export const IterateActionSchema = z.object({
  type: IterateActionTypeSchema,
  reason: z.string(),
  requiresInput: z.boolean().default(false),
  suggestedInput: z.string().optional(),
});

export type IterateAction = z.infer<typeof IterateActionSchema>;

// ============================================================================
// Budget Schema
// ============================================================================

/**
 * Budget constraints for iterate mode
 */
export const IterateBudgetSchema = z.object({
  maxIterations: z.number().int().min(1).max(1000).default(DEFAULT_MAX_ITERATIONS),
  maxTimeMs: z.number().int().min(1000).max(3600000).default(DEFAULT_MAX_TIME_MS),
  maxTokens: z.number().int().min(1000).optional(),
});

export type IterateBudget = z.infer<typeof IterateBudgetSchema>;

/**
 * Budget consumption tracking
 */
export const BudgetConsumedSchema = z.object({
  iterations: z.number().int().min(0),
  timeMs: z.number().int().min(0),
  tokens: z.number().int().min(0).optional(),
});

export type BudgetConsumed = z.infer<typeof BudgetConsumedSchema>;

/**
 * Budget status check result
 */
export const IterateBudgetStatusSchema = z.object({
  exceeded: z.boolean(),
  reason: z.string().optional(),
  remaining: z.object({
    iterations: z.number().int(),
    timeMs: z.number().int(),
    tokens: z.number().int().optional(),
  }),
});

export type IterateBudgetStatus = z.infer<typeof IterateBudgetStatusSchema>;

// ============================================================================
// State Schema
// ============================================================================

/**
 * Iterate mode state
 */
export const IterateStateSchema = z.object({
  // Identity
  sessionId: z.string(),
  taskId: z.string().optional(),

  // Budget
  budget: IterateBudgetSchema,
  consumed: BudgetConsumedSchema,

  // Progress
  iteration: z.number().int().min(0),
  startedAt: z.string().datetime(),
  lastActivityAt: z.string().datetime(),

  // Status
  status: z.enum(['running', 'paused', 'completed', 'failed', 'budget_exceeded']),
  lastIntent: IterateIntentSchema.optional(),
  lastAction: IterateActionSchema.optional(),

  // Error tracking
  consecutiveErrors: z.number().int().min(0).default(0),
  errors: z
    .array(
      z.object({
        iteration: z.number().int(),
        message: z.string(),
        timestamp: z.string().datetime(),
      })
    )
    .optional(),

  // History (optional, for debugging)
  history: z
    .array(
      z.object({
        iteration: z.number().int(),
        intent: IterateIntentSchema,
        action: IterateActionTypeSchema,
        timestamp: z.string().datetime(),
      })
    )
    .optional(),
});

export type IterateState = z.infer<typeof IterateStateSchema>;

// ============================================================================
// Safety Schema
// ============================================================================

/**
 * Safety guard configuration
 */
export const IterateSafetyConfigSchema = z.object({
  // Error limits
  maxConsecutiveErrors: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(DEFAULT_MAX_CONSECUTIVE_ERRORS),

  // Dangerous pattern detection
  enableDangerousPatternDetection: z.boolean().default(true),
  dangerousPatterns: z
    .array(z.string())
    .default([
      'rm\\s+-rf\\s+[/~]',
      'DROP\\s+TABLE',
      'DELETE\\s+FROM\\s+\\w+\\s*;',
      'TRUNCATE\\s+TABLE',
      'format\\s+[cC]:',
      'mkfs\\.',
      ':(){ :|:& };:', // fork bomb
    ]),

  // Custom patterns (user can add project-specific)
  customDangerousPatterns: z.array(z.string()).optional(),
});

export type IterateSafetyConfig = z.infer<typeof IterateSafetyConfigSchema>;

/**
 * Safety check result
 */
export const SafetyCheckResultSchema = z.object({
  safe: z.boolean(),
  reason: z.string().optional(),
  matchedPattern: z.string().optional(),
  severity: z.enum(['warning', 'danger', 'critical']).optional(),
});

export type SafetyCheckResult = z.infer<typeof SafetyCheckResultSchema>;

// ============================================================================
// Request/Response Schemas
// ============================================================================

/**
 * Request to start iterate mode
 */
export const IterateStartRequestSchema = z.object({
  task: z.string().min(1).max(10000),
  sessionId: z.string().optional(), // Will be generated if not provided
  budget: IterateBudgetSchema.optional(),
  safety: IterateSafetyConfigSchema.optional(),
});

export type IterateStartRequest = z.infer<typeof IterateStartRequestSchema>;

/**
 * Response from handling an iteration
 */
export const IterateHandleResponseSchema = z.object({
  action: IterateActionSchema,
  newState: IterateStateSchema,
  content: z.string().optional(), // Response content to show user
  autoResponse: z.string().optional(), // Auto-generated response for CONTINUE
});

export type IterateHandleResponse = z.infer<typeof IterateHandleResponseSchema>;

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Iterate error codes
 */
export const IterateErrorCode = {
  ITERATE_BUDGET_EXCEEDED: 'ITERATE_BUDGET_EXCEEDED',
  ITERATE_MAX_ERRORS: 'ITERATE_MAX_ERRORS',
  ITERATE_DANGEROUS_PATTERN: 'ITERATE_DANGEROUS_PATTERN',
  ITERATE_INVALID_STATE: 'ITERATE_INVALID_STATE',
  ITERATE_PROVIDER_ERROR: 'ITERATE_PROVIDER_ERROR',
} as const;

export type IterateErrorCode = (typeof IterateErrorCode)[keyof typeof IterateErrorCode];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates iterate intent
 */
export function validateIterateIntent(data: unknown): IterateIntent {
  return IterateIntentSchema.parse(data);
}

/**
 * Safely validates iterate intent
 */
export function safeValidateIterateIntent(
  data: unknown
): { success: true; data: IterateIntent } | { success: false; error: z.ZodError } {
  const result = IterateIntentSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validates iterate budget
 */
export function validateIterateBudget(data: unknown): IterateBudget {
  return IterateBudgetSchema.parse(data);
}

/**
 * Validates iterate state
 */
export function validateIterateState(data: unknown): IterateState {
  return IterateStateSchema.parse(data);
}

/**
 * Validates iterate start request
 */
export function validateIterateStartRequest(data: unknown): IterateStartRequest {
  return IterateStartRequestSchema.parse(data);
}

/**
 * Validates safety config
 */
export function validateIterateSafetyConfig(data: unknown): IterateSafetyConfig {
  return IterateSafetyConfigSchema.parse(data);
}
