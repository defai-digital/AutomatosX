/**
 * Parallel Agent Execution Contracts v1
 *
 * Schemas for executing multiple agents concurrently with DAG-based
 * dependency management and result aggregation.
 *
 * This enables orchestrated multi-agent workflows where independent
 * agents execute in parallel while respecting dependencies.
 */

import { z } from 'zod';
import {
  LIMIT_PARALLEL_CONCURRENT,
  TIMEOUT_WORKFLOW_STEP,
  TIMEOUT_WORKFLOW_MAX,
  PRIORITY_DEFAULT,
  PRIORITY_MAX,
} from '../../constants.js';

// ============================================================================
// Failure Strategy & Result Aggregation
// ============================================================================

/**
 * Strategy for handling failures in parallel execution
 *
 * - failFast: Cancel remaining tasks and fail immediately on first error
 * - failSafe: Wait for all tasks to complete, then report all errors
 * - continueOnError: Log errors but continue execution, exclude failed from results
 */
export const AgentFailureStrategySchema = z.enum([
  'failFast',
  'failSafe',
  'continueOnError',
]);
export type AgentFailureStrategy = z.infer<typeof AgentFailureStrategySchema>;

/**
 * Strategy for aggregating results from parallel agent execution
 *
 * - merge: Combine all outputs into a single object (INV-APE-004)
 * - list: Return array of individual agent results
 * - firstSuccess: Return first successful result
 * - custom: Use custom aggregation function
 */
export const ResultAggregationStrategySchema = z.enum([
  'merge',
  'list',
  'firstSuccess',
  'custom',
]);
export type ResultAggregationStrategy = z.infer<typeof ResultAggregationStrategySchema>;

// ============================================================================
// Configuration Schemas
// ============================================================================

/**
 * Configuration for parallel agent execution
 *
 * Invariants:
 * - INV-APE-001: Concurrent agents MUST NOT exceed maxConcurrentAgents
 * - INV-APE-005: Timeout enforced per-agent independently
 */
export const AgentParallelExecutionConfigSchema = z.object({
  /**
   * Maximum number of agents to execute concurrently
   * INV-APE-001: Enforced during execution
   */
  maxConcurrentAgents: z.number()
    .int()
    .min(1)
    .max(10)
    .default(LIMIT_PARALLEL_CONCURRENT),

  /**
   * Timeout per agent in milliseconds
   * INV-APE-005: Each agent has independent timeout
   */
  agentTimeout: z.number()
    .int()
    .min(1000)
    .max(TIMEOUT_WORKFLOW_MAX)
    .default(TIMEOUT_WORKFLOW_STEP),

  /**
   * Timeout for entire parallel group in milliseconds
   */
  groupTimeout: z.number()
    .int()
    .min(1000)
    .max(TIMEOUT_WORKFLOW_MAX)
    .optional(),

  /**
   * Strategy when one agent fails
   */
  failureStrategy: AgentFailureStrategySchema.default('failSafe'),

  /**
   * Strategy for combining results
   * INV-APE-004: Result aggregation follows configured strategy
   */
  resultAggregation: ResultAggregationStrategySchema.default('merge'),

  /**
   * Whether to enable checkpointing during parallel execution
   */
  enableCheckpointing: z.boolean().default(false),

  /**
   * Whether to share context between agents (read-only)
   * INV-APE-003: Shared context immutable during parallel execution
   */
  shareContext: z.boolean().default(true),
});

export type AgentParallelExecutionConfig = z.infer<typeof AgentParallelExecutionConfigSchema>;

// ============================================================================
// Task Schemas
// ============================================================================

/**
 * A single task in a parallel agent execution
 *
 * Invariants:
 * - INV-APE-002: Dependencies honored (DAG ordering)
 */
export const AgentParallelTaskSchema = z.object({
  /**
   * Unique identifier for this task
   */
  taskId: z.string().uuid(),

  /**
   * Agent ID to execute
   */
  agentId: z.string().min(1).max(50),

  /**
   * Input data for the agent
   */
  input: z.unknown(),

  /**
   * Task IDs this task depends on (must complete first)
   * INV-APE-002: Forms DAG for execution ordering
   */
  dependencies: z.array(z.string().uuid()).default([]),

  /**
   * Execution priority (higher = earlier in same layer)
   */
  priority: z.number().int().min(0).max(PRIORITY_MAX).default(PRIORITY_DEFAULT),

  /**
   * Optional timeout override for this specific task
   */
  timeout: z.number().int().min(1000).max(TIMEOUT_WORKFLOW_MAX).optional(),

  /**
   * Optional provider override for this task
   */
  provider: z.string().max(50).optional(),

  /**
   * Optional model override for this task
   */
  model: z.string().max(100).optional(),

  /**
   * Task metadata for tracking/debugging
   */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type AgentParallelTask = z.infer<typeof AgentParallelTaskSchema>;

// ============================================================================
// Result Schemas
// ============================================================================

/**
 * Status of a parallel task execution
 */
export const AgentParallelTaskStatusSchema = z.enum([
  'pending',
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
  'timeout',
  'skipped',
]);
export type AgentParallelTaskStatus = z.infer<typeof AgentParallelTaskStatusSchema>;

/**
 * Result of a single task in parallel execution
 */
export const AgentParallelTaskResultSchema = z.object({
  /**
   * Task identifier
   */
  taskId: z.string().uuid(),

  /**
   * Agent that was executed
   */
  agentId: z.string(),

  /**
   * Final status
   */
  status: AgentParallelTaskStatusSchema,

  /**
   * Whether execution succeeded
   */
  success: z.boolean(),

  /**
   * Output from the agent
   */
  output: z.unknown().optional(),

  /**
   * Error message if failed
   */
  error: z.string().optional(),

  /**
   * Error code if failed
   */
  errorCode: z.string().optional(),

  /**
   * Execution duration in milliseconds
   */
  durationMs: z.number().int().min(0),

  /**
   * Number of retries attempted
   */
  retryCount: z.number().int().min(0).default(0),

  /**
   * Execution layer in DAG
   */
  layer: z.number().int().min(0).optional(),

  /**
   * Start timestamp
   */
  startedAt: z.string().datetime().optional(),

  /**
   * Completion timestamp
   */
  completedAt: z.string().datetime().optional(),
});

export type AgentParallelTaskResult = z.infer<typeof AgentParallelTaskResultSchema>;

/**
 * Result of parallel agent group execution
 */
export const AgentParallelGroupResultSchema = z.object({
  /**
   * Unique identifier for this execution group
   */
  groupId: z.string().uuid(),

  /**
   * Results for each task
   */
  taskResults: z.array(AgentParallelTaskResultSchema),

  /**
   * Aggregated output based on strategy
   */
  aggregatedOutput: z.unknown().optional(),

  /**
   * Whether all tasks succeeded
   */
  allSucceeded: z.boolean(),

  /**
   * List of failed task IDs
   */
  failedTasks: z.array(z.string().uuid()),

  /**
   * List of cancelled task IDs
   */
  cancelledTasks: z.array(z.string().uuid()).optional(),

  /**
   * List of skipped task IDs (due to dependency failures)
   */
  skippedTasks: z.array(z.string().uuid()).optional(),

  /**
   * Total execution duration in milliseconds
   */
  totalDurationMs: z.number().int().min(0),

  /**
   * Number of tasks executed
   */
  tasksExecuted: z.number().int().min(0),

  /**
   * Number of tasks skipped
   */
  tasksSkipped: z.number().int().min(0).default(0),

  /**
   * Number of execution layers in DAG
   */
  layerCount: z.number().int().min(0).optional(),

  /**
   * Maximum concurrent tasks reached
   */
  peakConcurrency: z.number().int().min(0).optional(),

  /**
   * Configuration used
   */
  config: AgentParallelExecutionConfigSchema.optional(),

  /**
   * Start timestamp
   */
  startedAt: z.string().datetime(),

  /**
   * Completion timestamp
   */
  completedAt: z.string().datetime(),
});

export type AgentParallelGroupResult = z.infer<typeof AgentParallelGroupResultSchema>;

// ============================================================================
// Execution Plan Schemas
// ============================================================================

/**
 * Execution layer in DAG - tasks at same level can run in parallel
 */
export const ExecutionLayerSchema = z.object({
  /**
   * Layer index (0 = first layer, no dependencies)
   */
  index: z.number().int().min(0),

  /**
   * Tasks in this layer (can run in parallel)
   */
  tasks: z.array(AgentParallelTaskSchema),

  /**
   * Total tasks in layer
   */
  taskCount: z.number().int().min(0),
});

export type ExecutionLayer = z.infer<typeof ExecutionLayerSchema>;

/**
 * Execution plan built from DAG analysis
 */
export const ExecutionPlanSchema = z.object({
  /**
   * Unique plan identifier
   */
  planId: z.string().uuid(),

  /**
   * Execution layers (in order)
   */
  layers: z.array(ExecutionLayerSchema),

  /**
   * Total tasks in plan
   */
  totalTasks: z.number().int().min(0),

  /**
   * Total layers in plan
   */
  totalLayers: z.number().int().min(0),

  /**
   * Maximum parallelism (max tasks in any layer)
   */
  maxParallelism: z.number().int().min(0),

  /**
   * Whether plan has any circular dependencies (invalid)
   */
  hasCycles: z.boolean(),

  /**
   * Plan creation timestamp
   */
  createdAt: z.string().datetime(),
});

export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;

// ============================================================================
// Request/Response Schemas
// ============================================================================

/**
 * Request to execute agents in parallel
 */
export const ParallelExecutionRequestSchema = z.object({
  /**
   * Tasks to execute
   */
  tasks: z.array(AgentParallelTaskSchema).min(1).max(100),

  /**
   * Execution configuration
   */
  config: AgentParallelExecutionConfigSchema.optional(),

  /**
   * Shared context for all agents (read-only)
   * INV-APE-003: Immutable during execution
   */
  sharedContext: z.record(z.string(), z.unknown()).optional(),

  /**
   * Session ID for tracking
   */
  sessionId: z.string().uuid().optional(),

  /**
   * Idempotency key for safe retries
   */
  idempotencyKey: z.string().uuid().optional(),
});

export type ParallelExecutionRequest = z.infer<typeof ParallelExecutionRequestSchema>;

/**
 * Request to preview execution plan without executing
 */
export const PreviewPlanRequestSchema = z.object({
  /**
   * Tasks to plan
   */
  tasks: z.array(AgentParallelTaskSchema).min(1).max(100),

  /**
   * Optional config to apply
   */
  config: AgentParallelExecutionConfigSchema.optional(),
});

export type PreviewPlanRequest = z.infer<typeof PreviewPlanRequestSchema>;

// ============================================================================
// Context Schemas
// ============================================================================

/**
 * Shared context passed to all parallel agents
 * INV-APE-003: This context is immutable during execution
 */
export const SharedContextSchema = z.object({
  /**
   * Context data (immutable during execution)
   */
  data: z.record(z.string(), z.unknown()),

  /**
   * When context was created
   */
  createdAt: z.string().datetime(),

  /**
   * Context version for debugging
   */
  version: z.string().default('1'),
});

export type SharedContext = z.infer<typeof SharedContextSchema>;

// ============================================================================
// Error Codes
// ============================================================================

export const ParallelExecutionErrorCodes = {
  /** Circular dependency detected in task graph */
  CIRCULAR_DEPENDENCY: 'PARALLEL_CIRCULAR_DEPENDENCY',
  /** Maximum concurrency exceeded */
  CONCURRENCY_EXCEEDED: 'PARALLEL_CONCURRENCY_EXCEEDED',
  /** Group timeout exceeded */
  GROUP_TIMEOUT: 'PARALLEL_GROUP_TIMEOUT',
  /** Task timeout exceeded */
  TASK_TIMEOUT: 'PARALLEL_TASK_TIMEOUT',
  /** Task execution failed */
  TASK_FAILED: 'PARALLEL_TASK_FAILED',
  /** Agent not found */
  AGENT_NOT_FOUND: 'PARALLEL_AGENT_NOT_FOUND',
  /** Dependency failed, task skipped */
  DEPENDENCY_FAILED: 'PARALLEL_DEPENDENCY_FAILED',
  /** Execution cancelled */
  CANCELLED: 'PARALLEL_CANCELLED',
  /** Invalid execution plan */
  INVALID_PLAN: 'PARALLEL_INVALID_PLAN',
  /** Context modification attempted */
  CONTEXT_MUTATION: 'PARALLEL_CONTEXT_MUTATION',
} as const;

export type ParallelExecutionErrorCode =
  (typeof ParallelExecutionErrorCodes)[keyof typeof ParallelExecutionErrorCodes];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates parallel execution configuration
 */
export function validateAgentParallelExecutionConfig(
  data: unknown
): AgentParallelExecutionConfig {
  return AgentParallelExecutionConfigSchema.parse(data);
}

/**
 * Safely validates parallel execution configuration
 */
export function safeValidateAgentParallelExecutionConfig(
  data: unknown
): { success: true; data: AgentParallelExecutionConfig } | { success: false; error: z.ZodError } {
  const result = AgentParallelExecutionConfigSchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}

/**
 * Validates a parallel task
 */
export function validateAgentParallelTask(data: unknown): AgentParallelTask {
  return AgentParallelTaskSchema.parse(data);
}

/**
 * Validates parallel execution request
 */
export function validateParallelExecutionRequest(
  data: unknown
): ParallelExecutionRequest {
  return ParallelExecutionRequestSchema.parse(data);
}

/**
 * Validates execution plan
 */
export function validateExecutionPlan(data: unknown): ExecutionPlan {
  return ExecutionPlanSchema.parse(data);
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates default parallel execution configuration
 */
export function createDefaultAgentParallelExecutionConfig(): AgentParallelExecutionConfig {
  return AgentParallelExecutionConfigSchema.parse({});
}

/**
 * Creates a parallel task with defaults
 */
export function createAgentParallelTask(
  agentId: string,
  input: unknown,
  options?: Partial<Omit<AgentParallelTask, 'taskId' | 'agentId' | 'input'>>
): AgentParallelTask {
  return AgentParallelTaskSchema.parse({
    taskId: crypto.randomUUID(),
    agentId,
    input,
    ...options,
  });
}

/**
 * Creates a shared context with immutability marker
 * INV-APE-003: Shared context is frozen for immutability during parallel execution
 */
export function createSharedContext(
  data: Record<string, unknown>
): SharedContext {
  const context = SharedContextSchema.parse({
    data: { ...data },
    createdAt: new Date().toISOString(),
  });
  // Freeze data after parsing to ensure immutability
  Object.freeze(context.data);
  return Object.freeze(context) as SharedContext;
}
