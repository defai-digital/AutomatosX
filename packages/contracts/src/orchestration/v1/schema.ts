/**
 * Orchestration Domain Contracts v1
 *
 * Schemas for task orchestration, scheduling, and multi-agent coordination.
 */

import { z } from 'zod';

// ============================================================================
// Task Status and Priority Schemas
// ============================================================================

/**
 * Orchestration task status
 */
export const OrchTaskStatusSchema = z.enum([
  'pending',
  'queued',
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled',
  'timeout',
]);
export type OrchTaskStatus = z.infer<typeof OrchTaskStatusSchema>;

/**
 * Orchestration task priority
 */
export const OrchTaskPrioritySchema = z.enum(['critical', 'high', 'medium', 'low', 'background']);
export type OrchTaskPriority = z.infer<typeof OrchTaskPrioritySchema>;

/**
 * Orchestration task type
 */
export const OrchTaskTypeSchema = z.enum([
  'sequential',
  'parallel',
  'conditional',
  'loop',
  'retry',
  'timeout',
  'wait',
  'callback',
  'other',
]);
export type OrchTaskType = z.infer<typeof OrchTaskTypeSchema>;

// ============================================================================
// Task Definition Schemas
// ============================================================================

/**
 * Task dependency
 */
export const TaskDependencySchema = z.object({
  taskId: z.string().uuid(),
  condition: z.enum(['completed', 'failed', 'any', 'all']).default('completed'),
  timeout: z.number().int().min(0).optional(),
});
export type TaskDependency = z.infer<typeof TaskDependencySchema>;

/**
 * Orchestration retry policy
 */
export const OrchRetryPolicySchema = z.object({
  maxAttempts: z.number().int().min(1).max(10).default(3),
  initialDelayMs: z.number().int().min(100).max(60000).default(1000),
  maxDelayMs: z.number().int().min(1000).max(3600000).default(30000),
  backoffMultiplier: z.number().min(1).max(5).default(2),
  retryableErrors: z.array(z.string().max(100)).max(20).optional(),
});
export type OrchRetryPolicy = z.infer<typeof OrchRetryPolicySchema>;

/**
 * Task timeout policy
 */
export const TimeoutPolicySchema = z.object({
  executionTimeoutMs: z.number().int().min(1000).max(86400000).default(300000),
  queueTimeoutMs: z.number().int().min(1000).max(86400000).optional(),
  gracefulShutdownMs: z.number().int().min(1000).max(60000).default(10000),
});
export type TimeoutPolicy = z.infer<typeof TimeoutPolicySchema>;

/**
 * Task definition
 */
export const TaskDefinitionSchema = z.object({
  taskId: z.string().uuid(),
  name: z.string().max(200),
  description: z.string().max(2000).optional(),
  type: OrchTaskTypeSchema.default('sequential'),
  priority: OrchTaskPrioritySchema.default('medium'),
  agentId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  dependencies: z.array(TaskDependencySchema).max(50).optional(),
  retryPolicy: OrchRetryPolicySchema.optional(),
  timeoutPolicy: TimeoutPolicySchema.optional(),
  scheduledAt: z.string().datetime().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type TaskDefinition = z.infer<typeof TaskDefinitionSchema>;

/**
 * Task execution state
 */
export const TaskExecutionSchema = z.object({
  taskId: z.string().uuid(),
  status: OrchTaskStatusSchema,
  attempt: z.number().int().min(1).default(1),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  output: z.record(z.string(), z.unknown()).optional(),
  error: z.string().max(5000).optional(),
  progress: z.number().min(0).max(100).optional(),
  lastHeartbeat: z.string().datetime().optional(),
});
export type TaskExecution = z.infer<typeof TaskExecutionSchema>;

// ============================================================================
// Task Queue Schemas
// ============================================================================

/**
 * Queue create request
 */
export const QueueCreateRequestSchema = z.object({
  name: z.string().max(100),
  description: z.string().max(1000).optional(),
  maxConcurrency: z.number().int().min(1).max(100).default(5),
  defaultPriority: OrchTaskPrioritySchema.default('medium'),
  defaultRetryPolicy: OrchRetryPolicySchema.optional(),
  defaultTimeoutPolicy: TimeoutPolicySchema.optional(),
});
export type QueueCreateRequest = z.infer<typeof QueueCreateRequestSchema>;

/**
 * Queue state
 */
export const QueueStateSchema = z.object({
  queueId: z.string().uuid(),
  name: z.string(),
  pending: z.number().int().min(0),
  running: z.number().int().min(0),
  completed: z.number().int().min(0),
  failed: z.number().int().min(0),
  maxConcurrency: z.number().int().min(1),
  isPaused: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type QueueState = z.infer<typeof QueueStateSchema>;

// ============================================================================
// Task Submission Schemas
// ============================================================================

/**
 * Task submit request
 */
export const TaskSubmitRequestSchema = z.object({
  queueId: z.string().uuid().optional(),
  name: z.string().max(200),
  description: z.string().max(2000).optional(),
  type: OrchTaskTypeSchema.default('sequential'),
  priority: OrchTaskPrioritySchema.default('medium'),
  agentId: z.string().uuid().optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  dependencies: z.array(z.string().uuid()).max(50).optional(),
  retryPolicy: OrchRetryPolicySchema.optional(),
  timeoutPolicy: TimeoutPolicySchema.optional(),
  scheduledAt: z.string().datetime().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});
export type TaskSubmitRequest = z.infer<typeof TaskSubmitRequestSchema>;

/**
 * Task submit result
 */
export const TaskSubmitResultSchema = z.object({
  taskId: z.string().uuid(),
  queueId: z.string().uuid(),
  status: OrchTaskStatusSchema,
  position: z.number().int().min(0).optional(),
  estimatedStartTime: z.string().datetime().optional(),
  submittedAt: z.string().datetime(),
});
export type TaskSubmitResult = z.infer<typeof TaskSubmitResultSchema>;

// ============================================================================
// Task Query Schemas
// ============================================================================

/**
 * Task query request
 */
export const TaskQueryRequestSchema = z.object({
  queueId: z.string().uuid().optional(),
  status: z.array(OrchTaskStatusSchema).optional(),
  priority: z.array(OrchTaskPrioritySchema).optional(),
  agentId: z.string().uuid().optional(),
  tags: z.array(z.string().max(50)).optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  orderBy: z.enum(['createdAt', 'priority', 'scheduledAt', 'status']).default('createdAt'),
  orderDir: z.enum(['asc', 'desc']).default('desc'),
});
export type TaskQueryRequest = z.infer<typeof TaskQueryRequestSchema>;

/**
 * Task query result
 */
export const TaskQueryResultSchema = z.object({
  tasks: z.array(TaskDefinitionSchema.merge(TaskExecutionSchema.partial())),
  total: z.number().int().min(0),
  hasMore: z.boolean(),
});
export type TaskQueryResult = z.infer<typeof TaskQueryResultSchema>;

// ============================================================================
// Task Control Schemas
// ============================================================================

/**
 * Task cancel request
 */
export const TaskCancelRequestSchema = z.object({
  taskId: z.string().uuid(),
  reason: z.string().max(500).optional(),
  force: z.boolean().default(false),
});
export type TaskCancelRequest = z.infer<typeof TaskCancelRequestSchema>;

/**
 * Task pause request
 */
export const TaskPauseRequestSchema = z.object({
  taskId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});
export type TaskPauseRequest = z.infer<typeof TaskPauseRequestSchema>;

/**
 * Task resume request
 */
export const TaskResumeRequestSchema = z.object({
  taskId: z.string().uuid(),
});
export type TaskResumeRequest = z.infer<typeof TaskResumeRequestSchema>;

/**
 * Task retry request
 */
export const TaskRetryRequestSchema = z.object({
  taskId: z.string().uuid(),
  resetAttempts: z.boolean().default(false),
});
export type TaskRetryRequest = z.infer<typeof TaskRetryRequestSchema>;

// ============================================================================
// Orchestration Flow Schemas
// ============================================================================

/**
 * Flow step
 */
export const FlowStepSchema = z.object({
  stepId: z.string().max(100),
  name: z.string().max(200),
  type: OrchTaskTypeSchema,
  agentId: z.string().uuid().optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  condition: z.string().max(500).optional(),
  onSuccess: z.string().max(100).optional(),
  onFailure: z.string().max(100).optional(),
  retryPolicy: OrchRetryPolicySchema.optional(),
  timeoutPolicy: TimeoutPolicySchema.optional(),
});
export type FlowStep = z.infer<typeof FlowStepSchema>;

/**
 * Orchestration flow definition
 */
export const FlowDefinitionSchema = z.object({
  flowId: z.string().uuid(),
  name: z.string().max(200),
  description: z.string().max(2000).optional(),
  version: z.string().max(50).default('1.0.0'),
  steps: z.array(FlowStepSchema).min(1).max(100),
  startStep: z.string().max(100),
  endSteps: z.array(z.string().max(100)).min(1).max(10),
  defaultRetryPolicy: OrchRetryPolicySchema.optional(),
  defaultTimeoutPolicy: TimeoutPolicySchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type FlowDefinition = z.infer<typeof FlowDefinitionSchema>;

/**
 * Flow execution state
 */
export const FlowExecutionSchema = z.object({
  executionId: z.string().uuid(),
  flowId: z.string().uuid(),
  status: OrchTaskStatusSchema,
  currentStep: z.string().max(100).optional(),
  stepHistory: z.array(z.object({
    stepId: z.string(),
    status: OrchTaskStatusSchema,
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
    output: z.record(z.string(), z.unknown()).optional(),
    error: z.string().optional(),
  })).optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  output: z.record(z.string(), z.unknown()).optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});
export type FlowExecution = z.infer<typeof FlowExecutionSchema>;

// ============================================================================
// Error Codes
// ============================================================================

export const OrchestrationErrorCode = {
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  QUEUE_NOT_FOUND: 'QUEUE_NOT_FOUND',
  FLOW_NOT_FOUND: 'FLOW_NOT_FOUND',
  INVALID_STATE: 'INVALID_STATE',
  DEPENDENCY_FAILED: 'DEPENDENCY_FAILED',
  TIMEOUT: 'TIMEOUT',
  CANCELLED: 'CANCELLED',
  MAX_RETRIES: 'MAX_RETRIES',
  QUEUE_FULL: 'QUEUE_FULL',
  AGENT_UNAVAILABLE: 'AGENT_UNAVAILABLE',
} as const;

export type OrchestrationErrorCode =
  (typeof OrchestrationErrorCode)[keyof typeof OrchestrationErrorCode];

// ============================================================================
// Validation Functions
// ============================================================================

export function validateTaskSubmitRequest(data: unknown): TaskSubmitRequest {
  return TaskSubmitRequestSchema.parse(data);
}

export function validateTaskQueryRequest(data: unknown): TaskQueryRequest {
  return TaskQueryRequestSchema.parse(data);
}

export function validateFlowDefinition(data: unknown): FlowDefinition {
  return FlowDefinitionSchema.parse(data);
}

export function validateQueueCreateRequest(data: unknown): QueueCreateRequest {
  return QueueCreateRequestSchema.parse(data);
}

export function safeValidateTaskSubmitRequest(
  data: unknown
): { success: true; data: TaskSubmitRequest } | { success: false; error: z.ZodError } {
  const result = TaskSubmitRequestSchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}

// ============================================================================
// Application Initialization Schemas
// ============================================================================

/**
 * Storage mode for application initialization
 * Note: This is specific to app bootstrap - see storage/v1 for the canonical StorageMode
 */
export const AppStorageModeSchema = z.enum(['sqlite', 'memory']);
export type AppStorageMode = z.infer<typeof AppStorageModeSchema>;

/**
 * Application initialization configuration
 */
export const AppInitConfigSchema = z.object({
  /** Storage backend mode */
  storageMode: AppStorageModeSchema.default('sqlite'),

  /** Custom storage path (optional, defaults to ~/.automatosx/data.db) */
  storagePath: z.string().optional(),

  /** Enable agent registry initialization */
  enableAgents: z.boolean().default(true),

  /** Enable ability registry initialization */
  enableAbilities: z.boolean().default(true),

  /** Enable provider registry initialization */
  enableProviders: z.boolean().default(true),

  /** Enable trace store initialization */
  enableTracing: z.boolean().default(true),
});
export type AppInitConfig = z.infer<typeof AppInitConfigSchema>;

/**
 * Dependency container for initialized application
 */
export const DependencyContainerSchema = z.object({
  /** Whether SQLite is actually being used (may fall back to memory) */
  usingSqlite: z.boolean(),

  /** Storage mode that was requested */
  requestedMode: AppStorageModeSchema,

  /** Initialization timestamp */
  initializedAt: z.string().datetime(),

  /** Features that were enabled */
  enabledFeatures: z.object({
    agents: z.boolean(),
    abilities: z.boolean(),
    providers: z.boolean(),
    tracing: z.boolean(),
  }),
});
export type DependencyContainer = z.infer<typeof DependencyContainerSchema>;

/**
 * Bootstrap result
 */
export const BootstrapResultSchema = z.object({
  /** Whether bootstrap succeeded */
  success: z.boolean(),

  /** Container if successful */
  container: DependencyContainerSchema.optional(),

  /** Error message if failed */
  error: z.string().optional(),

  /** Warnings during initialization */
  warnings: z.array(z.string()).default([]),
});
export type BootstrapResult = z.infer<typeof BootstrapResultSchema>;

// ============================================================================
// App Initialization Error Codes
// ============================================================================

export const AppInitErrorCode = {
  SQLITE_UNAVAILABLE: 'APP_INIT_SQLITE_UNAVAILABLE',
  STORAGE_INIT_FAILED: 'APP_INIT_STORAGE_FAILED',
  PROVIDER_INIT_FAILED: 'APP_INIT_PROVIDER_FAILED',
  AGENT_INIT_FAILED: 'APP_INIT_AGENT_FAILED',
  ABILITY_INIT_FAILED: 'APP_INIT_ABILITY_FAILED',
  ALREADY_INITIALIZED: 'APP_INIT_ALREADY_INITIALIZED',
} as const;

export type AppInitErrorCode =
  (typeof AppInitErrorCode)[keyof typeof AppInitErrorCode];

// ============================================================================
// App Initialization Validation Functions
// ============================================================================

export function validateAppInitConfig(data: unknown): AppInitConfig {
  return AppInitConfigSchema.parse(data);
}

export function safeValidateAppInitConfig(
  data: unknown
): { success: true; data: AppInitConfig } | { success: false; error: z.ZodError } {
  const result = AppInitConfigSchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}

export function createDefaultAppInitConfig(): AppInitConfig {
  return AppInitConfigSchema.parse({});
}
