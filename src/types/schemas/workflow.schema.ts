// Phase 4 Week 1: Workflow Engine Schemas
// Zod schemas for workflow definitions, executions, checkpoints
// All cross-boundary data validation for the workflow system

import { z } from 'zod';

// ============================================================================
// Workflow State Machine States
// ============================================================================

export const WorkflowStateSchema = z.enum([
  'idle',
  'parsing',
  'validating',
  'building_graph',
  'scheduling',
  'executing',
  'awaiting_completion',
  'creating_checkpoint',
  'restoring_checkpoint',
  'aggregating_results',
  'completed',
  'failed',
  'paused',
  'cancelled',
]);

export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

// ============================================================================
// Retry Policy
// ============================================================================

export const RetryPolicySchema = z.object({
  maxRetries: z.number().int().min(0).default(3),
  retryDelayMs: z.number().int().min(0).default(1000),
  retryBackoffMultiplier: z.number().min(1).default(2.0),
  retryableErrors: z.array(z.string()).optional(), // Retry only on specific errors
});

export type RetryPolicy = z.infer<typeof RetryPolicySchema>;

// ============================================================================
// Workflow Step Definition
// ============================================================================

export const WorkflowStepSchema = z.object({
  key: z.string().min(1, 'Step key is required'), // Unique key within workflow (e.g., "parse-changes")
  agent: z.string().min(1, 'Agent name is required'), // Agent name (e.g., "backend", "security", "quality")
  prompt: z.string().min(1, 'Prompt is required'), // Prompt with {{variable}} placeholders
  dependencies: z.array(z.string()).default([]), // Array of step keys this depends on
  parallel: z.boolean().default(false), // Can execute in parallel with other steps
  optional: z.boolean().default(false), // Workflow continues even if this fails
  timeoutMs: z.number().int().min(0).optional(), // Step timeout
  retryPolicy: RetryPolicySchema.optional(),
  outputSchema: z.record(z.string(), z.unknown()).optional(), // JSON schema for expected output
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

// ============================================================================
// Workflow Configuration
// ============================================================================

export const WorkflowConfigSchema = z.object({
  timeout: z.number().int().min(0).optional(), // Overall workflow timeout (ms)
  maxRetries: z.number().int().min(0).default(0), // Default retry count for all steps
  checkpointInterval: z.number().int().min(0).optional(), // Auto-checkpoint every N ms
  parallelism: z.number().int().min(1).default(5), // Max parallel steps
  continueOnError: z.boolean().default(false), // Continue even if optional steps fail
});

export type WorkflowConfig = z.infer<typeof WorkflowConfigSchema>;

// ============================================================================
// Workflow Definition
// ============================================================================

export const WorkflowDefinitionSchema = z.object({
  name: z.string().min(1, 'Workflow name is required'),
  description: z.string().optional(),
  version: z.string().default('1.0.0'),
  steps: z.array(WorkflowStepSchema).min(1, 'At least one step is required'),
  config: WorkflowConfigSchema.optional(),
  tags: z.array(z.string()).optional(),
  author: z.string().optional(),
});

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

// ============================================================================
// Workflow Instance (Database Model)
// ============================================================================

export const WorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  definition: z.string(), // JSON string of WorkflowDefinition
  version: z.string(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  author: z.string().optional(),
  tags: z.string().optional(), // JSON array string
  isActive: z.number().int().min(0).max(1).default(1),
  totalExecutions: z.number().int().default(0),
  successfulExecutions: z.number().int().default(0),
  failedExecutions: z.number().int().default(0),
  avgDurationMs: z.number().int().optional(),
});

export type Workflow = z.infer<typeof WorkflowSchema>;

// ============================================================================
// Workflow Execution Context
// ============================================================================

export const WorkflowContextSchema = z.record(z.string(), z.unknown()); // Flexible context object

export type WorkflowContext = z.infer<typeof WorkflowContextSchema>;

// ============================================================================
// Workflow Execution
// ============================================================================

export const WorkflowExecutionSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  state: WorkflowStateSchema,
  context: z.string(), // JSON string of WorkflowContext
  createdAt: z.number().int(),
  startedAt: z.number().int().optional(),
  completedAt: z.number().int().optional(),
  pausedAt: z.number().int().optional(),
  cancelledAt: z.number().int().optional(),
  durationMs: z.number().int().optional(),
  error: z.string().optional(),
  errorStepId: z.string().optional(),
  lastCheckpointId: z.string().optional(),
  resumeCount: z.number().int().default(0),
  triggeredBy: z.string().optional(),
  priority: z.number().int().default(0),
  parentExecutionId: z.string().optional(),
});

export type WorkflowExecution = z.infer<typeof WorkflowExecutionSchema>;

// ============================================================================
// Workflow Step Execution State
// ============================================================================

export const StepExecutionStateSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'skipped',
  'cancelled',
]);

export type StepExecutionState = z.infer<typeof StepExecutionStateSchema>;

// ============================================================================
// Workflow Step Execution
// ============================================================================

export const WorkflowStepExecutionSchema = z.object({
  id: z.string(),
  executionId: z.string(),
  stepId: z.string(),
  state: StepExecutionStateSchema,
  result: z.string().optional(), // JSON string of step output
  error: z.string().optional(),
  startedAt: z.number().int().optional(),
  completedAt: z.number().int().optional(),
  durationMs: z.number().int().optional(),
  retryCount: z.number().int().default(0),
  previousErrors: z.string().optional(), // JSON array of errors from previous attempts
  agentUsed: z.string().optional(),
  providerUsed: z.string().optional(),
  modelUsed: z.string().optional(),
  tokensUsed: z.number().int().optional(),
  cost: z.number().optional(),
});

export type WorkflowStepExecution = z.infer<typeof WorkflowStepExecutionSchema>;

// ============================================================================
// Workflow Checkpoint
// ============================================================================

export const WorkflowCheckpointSchema = z.object({
  id: z.string(),
  executionId: z.string(),
  state: WorkflowStateSchema,
  context: z.string(), // JSON string of WorkflowContext
  completedSteps: z.string(), // JSON array of completed step keys
  pendingSteps: z.string(), // JSON array of remaining step keys
  createdAt: z.number().int(),
  createdBy: z.string().optional(), // 'automatic', 'manual', or user ID
  label: z.string().optional(),
  sizeBytes: z.number().int().optional(),
});

export type WorkflowCheckpoint = z.infer<typeof WorkflowCheckpointSchema>;

// ============================================================================
// Workflow Event Type
// ============================================================================

export const WorkflowEventTypeSchema = z.enum([
  'workflow_created',
  'workflow_started',
  'workflow_paused',
  'workflow_resumed',
  'workflow_completed',
  'workflow_failed',
  'workflow_cancelled',
  'step_started',
  'step_completed',
  'step_failed',
  'step_retried',
  'step_skipped',
  'state_transition',
  'checkpoint_created',
  'checkpoint_restored',
  'error_occurred',
]);

export type WorkflowEventType = z.infer<typeof WorkflowEventTypeSchema>;

// ============================================================================
// Workflow Event
// ============================================================================

export const WorkflowEventSchema = z.object({
  id: z.string(),
  executionId: z.string(),
  eventType: WorkflowEventTypeSchema,
  eventData: z.string().optional(), // JSON string
  timestamp: z.number().int(),
});

export type WorkflowEvent = z.infer<typeof WorkflowEventSchema>;

// ============================================================================
// Dependency Graph Node
// ============================================================================

export const DependencyNodeSchema = z.object({
  stepKey: z.string(),
  dependencies: z.array(z.string()),
  dependents: z.array(z.string()),
  level: z.number().int().min(0), // Topological level for scheduling
});

export type DependencyNode = z.infer<typeof DependencyNodeSchema>;

// ============================================================================
// Dependency Graph
// ============================================================================

export const DependencyGraphSchema = z.object({
  nodes: z.array(DependencyNodeSchema),
  hasCycle: z.boolean(),
  topologicalOrder: z.array(z.string()), // Ordered list of step keys
  levels: z.array(z.array(z.string())), // Steps grouped by execution level (for parallelism)
});

export type DependencyGraph = z.infer<typeof DependencyGraphSchema>;

// ============================================================================
// Workflow Result
// ============================================================================

export const WorkflowResultSchema = z.object({
  executionId: z.string(),
  workflowId: z.string(),
  workflowName: z.string(),
  state: WorkflowStateSchema,
  context: WorkflowContextSchema,
  stepResults: z.record(z.string(), z.unknown()), // Map of step key to result
  startedAt: z.number().int().optional(),
  completedAt: z.number().int().optional(),
  durationMs: z.number().int().optional(),
  error: z.string().optional(),
});

export type WorkflowResult = z.infer<typeof WorkflowResultSchema>;

// ============================================================================
// Workflow Execution Options
// ============================================================================

export const WorkflowExecutionOptionsSchema = z.object({
  triggeredBy: z.string().optional(),
  priority: z.number().int().optional(),
  parentExecutionId: z.string().optional(),
  context: WorkflowContextSchema.optional(), // Initial context
  resumeFromCheckpoint: z.string().optional(), // Checkpoint ID to resume from
});

export type WorkflowExecutionOptions = z.infer<typeof WorkflowExecutionOptionsSchema>;

// ============================================================================
// Step Schedule (for parallel execution planning)
// ============================================================================

export const StepScheduleSchema = z.object({
  levels: z.array(z.array(z.string())), // Array of parallel execution groups
  totalSteps: z.number().int(),
  maxParallelism: z.number().int(),
  estimatedDurationMs: z.number().int().optional(),
});

export type StepSchedule = z.infer<typeof StepScheduleSchema>;

// ============================================================================
// Workflow Statistics
// ============================================================================

export const WorkflowStatsSchema = z.object({
  workflowId: z.string(),
  workflowName: z.string(),
  version: z.string(),
  totalExecutions: z.number().int(),
  successfulExecutions: z.number().int(),
  failedExecutions: z.number().int(),
  successRatePercent: z.number(),
  avgDurationMs: z.number().int().optional(),
  activeExecutions: z.number().int(),
  lastExecutionAt: z.number().int().optional(),
});

export type WorkflowStats = z.infer<typeof WorkflowStatsSchema>;

// ============================================================================
// Helper Functions for Validation
// ============================================================================

/**
 * Parse and validate a workflow definition from JSON string
 */
export function parseWorkflowDefinition(jsonString: string): WorkflowDefinition {
  const parsed = JSON.parse(jsonString);
  return WorkflowDefinitionSchema.parse(parsed);
}

/**
 * Parse and validate workflow context from JSON string
 */
export function parseWorkflowContext(jsonString: string): WorkflowContext {
  const parsed = JSON.parse(jsonString);
  return WorkflowContextSchema.parse(parsed);
}

/**
 * Validate a workflow definition object
 */
export function validateWorkflowDefinition(definition: unknown): WorkflowDefinition {
  return WorkflowDefinitionSchema.parse(definition);
}

/**
 * Validate workflow execution options
 */
export function validateExecutionOptions(options: unknown): WorkflowExecutionOptions {
  return WorkflowExecutionOptionsSchema.parse(options);
}

/**
 * Check if a workflow state is terminal
 */
export function isTerminalState(state: WorkflowState): boolean {
  return ['completed', 'failed', 'cancelled'].includes(state);
}

/**
 * Check if a workflow can be resumed
 */
export function canResumeFromState(state: WorkflowState): boolean {
  return ['paused', 'failed'].includes(state);
}

/**
 * Check if a step execution state is terminal
 */
export function isStepTerminalState(state: StepExecutionState): boolean {
  return ['completed', 'failed', 'skipped', 'cancelled'].includes(state);
}
