/**
 * Saga Pattern Contract V1
 *
 * Provides contracts for managing distributed transactions with compensation.
 * Enables rollback of multi-step operations on failure.
 *
 * Invariants:
 * - INV-SG-001: Compensations run in reverse order on failure
 * - INV-SG-002: Required compensations must succeed
 * - INV-SG-003: Saga state transitions are valid
 */

import { z } from 'zod';

/**
 * Compensation action type
 */
export const CompensationActionTypeSchema = z.enum([
  'rollback',  // Undo the step's changes
  'notify',    // Send notification about failure
  'log',       // Log the failure for investigation
  'custom',    // Custom compensation handler
]);

export type CompensationActionType = z.infer<typeof CompensationActionTypeSchema>;

/**
 * Compensation action definition
 */
export const CompensationActionSchema = z.object({
  /** Step this compensation is for */
  stepId: z.string(),

  /** Type of compensation action */
  action: CompensationActionTypeSchema,

  /** Handler function name or agent ID */
  handler: z.string(),

  /** Timeout for compensation in ms */
  timeout: z.number().int().min(1000).max(300000).default(30000),

  /** Whether this compensation must succeed (INV-SG-002) */
  required: z.boolean().default(true),

  /** Retry configuration for compensation */
  retryCount: z.number().int().min(0).max(3).default(1),

  /** Additional configuration */
  config: z.record(z.string(), z.unknown()).optional(),
});

export type CompensationAction = z.infer<typeof CompensationActionSchema>;

/**
 * Saga failure handling strategy
 */
export const SagaFailureStrategySchema = z.enum([
  'compensate',  // Run compensations in reverse order
  'pause',       // Pause for manual intervention
  'continue',    // Continue without compensation (log only)
]);

export type SagaFailureStrategy = z.infer<typeof SagaFailureStrategySchema>;

/**
 * Compensation execution order
 */
export const CompensationOrderSchema = z.enum([
  'reverse',   // Execute in reverse step order (INV-SG-001)
  'parallel',  // Execute all compensations in parallel
]);

export type CompensationOrder = z.infer<typeof CompensationOrderSchema>;

/**
 * Saga definition
 */
export const SagaDefinitionSchema = z.object({
  /** Unique saga identifier */
  sagaId: z.string(),

  /** Associated workflow ID */
  workflowId: z.string().optional(),

  /** Compensation actions for each step */
  compensations: z.array(CompensationActionSchema),

  /** What to do on step failure */
  onFailure: SagaFailureStrategySchema.default('compensate'),

  /** Order to run compensations */
  compensationOrder: CompensationOrderSchema.default('reverse'),

  /** Saga description */
  description: z.string().optional(),

  /** Version for definition tracking */
  version: z.string().optional(),
});

export type SagaDefinition = z.infer<typeof SagaDefinitionSchema>;

/**
 * Saga execution status
 */
export const SagaStatusSchema = z.enum([
  'running',       // Saga is executing steps
  'completed',     // All steps completed successfully
  'compensating',  // Running compensations
  'compensated',   // Compensations completed
  'failed',        // Saga or compensation failed
  'paused',        // Paused for intervention
]);

export type SagaStatus = z.infer<typeof SagaStatusSchema>;

/**
 * Compensation error record
 */
export const CompensationErrorSchema = z.object({
  stepId: z.string(),
  error: z.string(),
  timestamp: z.string().datetime(),
  retryCount: z.number().int().min(0),
});

export type CompensationError = z.infer<typeof CompensationErrorSchema>;

/**
 * Saga execution state
 */
export const SagaStateSchema = z.object({
  /** Saga definition ID */
  sagaId: z.string(),

  /** Unique execution ID */
  executionId: z.string().uuid(),

  /** Current execution status */
  status: SagaStatusSchema,

  /** Steps that completed successfully */
  completedSteps: z.array(z.string()),

  /** Step that failed (if applicable) */
  failedStep: z.string().optional(),

  /** Failure reason */
  failureReason: z.string().optional(),

  /** Steps that have been compensated */
  compensatedSteps: z.array(z.string()),

  /** Errors from compensation attempts */
  compensationErrors: z.array(CompensationErrorSchema),

  /** Execution start time */
  startedAt: z.string().datetime(),

  /** Execution end time */
  completedAt: z.string().datetime().optional(),

  /** Additional context */
  context: z.record(z.string(), z.unknown()).optional(),

  /** Correlation ID for tracing */
  correlationId: z.string().optional(),
});

export type SagaState = z.infer<typeof SagaStateSchema>;

/**
 * Saga execution result
 */
export const SagaResultSchema = z.object({
  /** Whether saga completed successfully */
  success: z.boolean(),

  /** Execution ID */
  executionId: z.string().uuid(),

  /** Step results (if successful) */
  results: z.array(z.unknown()).optional(),

  /** Error message (if failed) */
  error: z.string().optional(),

  /** Whether compensations ran */
  compensated: z.boolean().optional(),

  /** Duration in ms */
  durationMs: z.number().int().min(0),

  /** Final state */
  finalStatus: SagaStatusSchema,
});

export type SagaResult = z.infer<typeof SagaResultSchema>;

/**
 * Saga step definition for execution
 */
export const SagaStepSchema = z.object({
  /** Step identifier */
  stepId: z.string(),

  /** Step name for display */
  name: z.string().optional(),

  /** Step timeout in ms */
  timeout: z.number().int().min(1000).max(600000).optional(),
});

export type SagaStep = z.infer<typeof SagaStepSchema>;

/**
 * Saga context for execution
 */
export const SagaContextSchema = z.object({
  /** Correlation ID for tracing */
  correlationId: z.string(),

  /** Additional context data */
  data: z.record(z.string(), z.unknown()).optional(),
});

export type SagaContext = z.infer<typeof SagaContextSchema>;

/**
 * Saga error codes
 */
export const SagaErrorCodes = {
  SAGA_NOT_FOUND: 'SAGA_NOT_FOUND',
  SAGA_ALREADY_RUNNING: 'SAGA_ALREADY_RUNNING',
  STEP_FAILED: 'SAGA_STEP_FAILED',
  COMPENSATION_FAILED: 'SAGA_COMPENSATION_FAILED',
  REQUIRED_COMPENSATION_FAILED: 'SAGA_REQUIRED_COMPENSATION_FAILED',
  INVALID_STATE_TRANSITION: 'SAGA_INVALID_STATE_TRANSITION',
  TIMEOUT: 'SAGA_TIMEOUT',
} as const;

export type SagaErrorCode = (typeof SagaErrorCodes)[keyof typeof SagaErrorCodes];

/**
 * Valid saga state transitions
 */
export const SAGA_STATE_TRANSITIONS: Record<SagaStatus, SagaStatus[]> = {
  running: ['completed', 'compensating', 'paused', 'failed'],
  completed: [],
  compensating: ['compensated', 'failed', 'paused'],
  compensated: [],
  failed: [],
  paused: ['running', 'compensating', 'failed'],
};

/**
 * Validates saga definition
 */
export function validateSagaDefinition(data: unknown): SagaDefinition {
  return SagaDefinitionSchema.parse(data);
}

/**
 * Validates saga state
 */
export function validateSagaState(data: unknown): SagaState {
  return SagaStateSchema.parse(data);
}

/**
 * Checks if state transition is valid
 */
export function isValidSagaTransition(from: SagaStatus, to: SagaStatus): boolean {
  return SAGA_STATE_TRANSITIONS[from].includes(to);
}

/**
 * Creates initial saga state
 */
export function createInitialSagaState(
  sagaId: string,
  correlationId?: string
): SagaState {
  return {
    sagaId,
    executionId: crypto.randomUUID(),
    status: 'running',
    completedSteps: [],
    compensatedSteps: [],
    compensationErrors: [],
    startedAt: new Date().toISOString(),
    correlationId,
  };
}
