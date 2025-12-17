/**
 * Workflow Step Guard Contracts
 *
 * Step guards enable governance checks at workflow step boundaries.
 *
 * Invariants:
 * - INV-WF-GUARD-001: Before guards run before step execution starts
 * - INV-WF-GUARD-002: After guards run after step completes (before next step)
 * - INV-WF-GUARD-003: Block failures prevent step execution/continuation
 * - INV-WF-GUARD-004: Guard results included in trace events
 */

import { z } from 'zod';

// ============================================================================
// Step Guard Configuration
// ============================================================================

/**
 * Position of guard relative to step execution
 */
export const GuardPositionSchema = z.enum(['before', 'after']);
export type GuardPosition = z.infer<typeof GuardPositionSchema>;

/**
 * Action to take when guard fails
 */
export const GuardFailActionSchema = z.enum(['block', 'warn', 'continue']);
export type GuardFailAction = z.infer<typeof GuardFailActionSchema>;

/**
 * Step guard configuration
 */
export const WorkflowStepGuardSchema = z.object({
  /** Unique guard ID */
  guardId: z.string().min(1),
  /** Step ID this guard applies to (or '*' for all steps) */
  stepId: z.string().min(1),
  /** When to run the guard */
  position: GuardPositionSchema,
  /** Gate IDs to run */
  gates: z.array(z.string()).min(1),
  /** Action on failure */
  onFail: GuardFailActionSchema.default('warn'),
  /** Guard description */
  description: z.string().optional(),
  /** Whether guard is enabled */
  enabled: z.boolean().default(true),
});
export type WorkflowStepGuard = z.infer<typeof WorkflowStepGuardSchema>;

// ============================================================================
// Guard Check Results
// ============================================================================

/**
 * Guard check status
 */
export const GuardCheckStatusSchema = z.enum(['PASS', 'WARN', 'FAIL']);
export type GuardCheckStatus = z.infer<typeof GuardCheckStatusSchema>;

/**
 * Individual step gate result
 * (Named StepGateResult to avoid conflict with MCP GateResult)
 */
export const StepGateResultSchema = z.object({
  /** Gate ID */
  gateId: z.string(),
  /** Gate status */
  status: GuardCheckStatusSchema,
  /** Gate message */
  message: z.string(),
  /** Additional details */
  details: z.record(z.unknown()).optional(),
  /** Suggestion for fixing issues */
  suggestion: z.string().optional(),
});
export type StepGateResult = z.infer<typeof StepGateResultSchema>;

/**
 * Step guard check result
 */
export const StepGuardResultSchema = z.object({
  /** Guard ID */
  guardId: z.string(),
  /** Step ID */
  stepId: z.string(),
  /** Guard position */
  position: GuardPositionSchema,
  /** Overall status (FAIL if any gate fails) */
  status: GuardCheckStatusSchema,
  /** Individual gate results */
  gates: z.array(StepGateResultSchema),
  /** Whether step execution should be blocked */
  blocked: z.boolean(),
  /** Human-readable summary */
  summary: z.string(),
  /** Timestamp of check */
  timestamp: z.string().datetime(),
  /** Duration of guard check in ms */
  durationMs: z.number().nonnegative(),
});
export type StepGuardResult = z.infer<typeof StepGuardResultSchema>;

// ============================================================================
// Step Guard Policy
// ============================================================================

/**
 * Policy for applying step guards to workflows
 */
export const StepGuardPolicySchema = z.object({
  /** Policy ID */
  policyId: z.string().min(1),
  /** Policy name */
  name: z.string(),
  /** Policy description */
  description: z.string().optional(),
  /** Workflow patterns this policy applies to (glob) */
  workflowPatterns: z.array(z.string()).default(['*']),
  /** Step types this policy applies to */
  stepTypes: z.array(z.string()).optional(),
  /** Agent patterns this policy applies to (glob) */
  agentPatterns: z.array(z.string()).default(['*']),
  /** Guards to apply */
  guards: z.array(WorkflowStepGuardSchema),
  /** Whether policy is enabled */
  enabled: z.boolean().default(true),
  /** Priority (higher = runs first) */
  priority: z.number().int().default(0),
});
export type StepGuardPolicy = z.infer<typeof StepGuardPolicySchema>;

// ============================================================================
// Step Guard Context
// ============================================================================

/**
 * Context provided to step guards
 */
export const StepGuardContextSchema = z.object({
  /** Agent ID executing the workflow */
  agentId: z.string(),
  /** Execution ID */
  executionId: z.string(),
  /** Session ID (if any) */
  sessionId: z.string().optional(),
  /** Step being guarded */
  stepId: z.string(),
  /** Step type */
  stepType: z.string(),
  /** Step index in workflow */
  stepIndex: z.number().int().nonnegative(),
  /** Total steps in workflow */
  totalSteps: z.number().int().positive(),
  /** Previous step outputs */
  previousOutputs: z.record(z.unknown()),
  /** Step configuration */
  stepConfig: z.record(z.unknown()).optional(),
  /** Workflow ID (if named) */
  workflowId: z.string().optional(),
});
export type StepGuardContext = z.infer<typeof StepGuardContextSchema>;

// ============================================================================
// Progress Event
// ============================================================================

/**
 * Stage progress status
 */
export const StageProgressStatusSchema = z.enum([
  'pending',
  'starting',
  'completed',
  'failed',
  'skipped',
  'blocked',
]);
export type StageProgressStatus = z.infer<typeof StageProgressStatusSchema>;

/**
 * Stage progress event for visibility
 *
 * INV-PROG-001: Every stage emits 'starting' event before execution
 * INV-PROG-002: Every stage emits terminal event (completed/failed/skipped/blocked)
 * INV-PROG-003: stageIndex is 0-based, stageTotal is constant per execution
 */
export const StageProgressEventSchema = z.object({
  /** Event type */
  type: z.literal('stage.progress'),
  /** Execution ID */
  executionId: z.string(),
  /** Agent ID */
  agentId: z.string(),
  /** Session ID (if any) */
  sessionId: z.string().optional(),
  /** Stage index (0-based) */
  stageIndex: z.number().int().nonnegative(),
  /** Total stages */
  stageTotal: z.number().int().positive(),
  /** Stage name (step ID) */
  stageName: z.string(),
  /** Stage type */
  stageType: z.string(),
  /** Progress status */
  status: StageProgressStatusSchema,
  /** Duration in ms (for completed/failed) */
  durationMs: z.number().nonnegative().optional(),
  /** Error message (for failed) */
  error: z.string().optional(),
  /** Guard result (if blocked) */
  guardResult: StepGuardResultSchema.optional(),
  /** Additional metadata */
  metadata: z.record(z.unknown()).optional(),
  /** Timestamp */
  timestamp: z.string().datetime(),
});
export type StageProgressEvent = z.infer<typeof StageProgressEventSchema>;

// ============================================================================
// Goal Anchor
// ============================================================================

/**
 * Goal anchor trigger
 */
export const GoalAnchorTriggerSchema = z.enum([
  'every_step',
  'on_checkpoint',
  'on_decision',
  'on_delegation',
]);
export type GoalAnchorTrigger = z.infer<typeof GoalAnchorTriggerSchema>;

/**
 * Goal anchor configuration
 *
 * Prevents context drift by periodically reminding agent of original task.
 */
export const GoalAnchorConfigSchema = z.object({
  /** Original task description */
  originalTask: z.string(),
  /** Key checkpoints/milestones reached */
  checkpointsReached: z.array(z.string()).default([]),
  /** When to inject goal reminder */
  trigger: GoalAnchorTriggerSchema.default('on_checkpoint'),
  /** Include remaining steps in reminder */
  includeRemainingSteps: z.boolean().default(true),
  /** Include progress percentage */
  includeProgress: z.boolean().default(true),
});
export type GoalAnchorConfig = z.infer<typeof GoalAnchorConfigSchema>;

/**
 * Goal anchor context injected into prompts
 */
export const GoalAnchorContextSchema = z.object({
  /** Original task */
  task: z.string(),
  /** Current progress description */
  progress: z.string(),
  /** Checkpoints reached */
  checkpointsReached: z.array(z.string()),
  /** Remaining steps (if available) */
  remainingSteps: z.array(z.string()).optional(),
  /** Completion percentage */
  percentComplete: z.number().min(0).max(100).optional(),
});
export type GoalAnchorContext = z.infer<typeof GoalAnchorContextSchema>;

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default step guard for all workflows
 */
export const DEFAULT_STEP_GUARD: WorkflowStepGuard = {
  guardId: 'default-step-guard',
  stepId: '*',
  position: 'before',
  gates: ['validation'],
  onFail: 'warn',
  enabled: true,
};

/**
 * Creates a step guard result
 */
export function createStepGuardResult(
  guardId: string,
  stepId: string,
  position: GuardPosition,
  gates: StepGateResult[],
  blocked: boolean
): StepGuardResult {
  const hasFailure = gates.some((g) => g.status === 'FAIL');
  const hasWarning = gates.some((g) => g.status === 'WARN');

  const status: GuardCheckStatus = hasFailure ? 'FAIL' : hasWarning ? 'WARN' : 'PASS';

  const passCount = gates.filter((g) => g.status === 'PASS').length;
  const warnCount = gates.filter((g) => g.status === 'WARN').length;
  const failCount = gates.filter((g) => g.status === 'FAIL').length;

  let summary: string;
  if (status === 'PASS') {
    summary = `All ${gates.length} gates passed`;
  } else if (status === 'WARN') {
    summary = `${passCount} passed, ${warnCount} warnings`;
  } else {
    summary = `${failCount} failed, ${warnCount} warnings, ${passCount} passed`;
  }

  return {
    guardId,
    stepId,
    position,
    status,
    gates,
    blocked,
    summary,
    timestamp: new Date().toISOString(),
    durationMs: 0, // Will be set by caller
  };
}

/**
 * Creates a progress event
 */
export function createProgressEvent(
  executionId: string,
  agentId: string,
  stageIndex: number,
  stageTotal: number,
  stageName: string,
  stageType: string,
  status: StageProgressStatus,
  options: {
    sessionId?: string;
    durationMs?: number;
    error?: string;
    guardResult?: StepGuardResult;
    metadata?: Record<string, unknown>;
  } = {}
): StageProgressEvent {
  return {
    type: 'stage.progress',
    executionId,
    agentId,
    sessionId: options.sessionId,
    stageIndex,
    stageTotal,
    stageName,
    stageType,
    status,
    durationMs: options.durationMs,
    error: options.error,
    guardResult: options.guardResult,
    metadata: options.metadata,
    timestamp: new Date().toISOString(),
  };
}
