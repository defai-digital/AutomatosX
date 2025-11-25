/**
 * Session schemas for AutomatosX
 * @module @ax/schemas/session
 */

import { z } from 'zod';
import { SessionId, CheckpointId, TaskStatus, DurationMs } from './common.js';

// =============================================================================
// Session Task Schema
// =============================================================================

/**
 * A task within a session
 */
export const SessionTaskSchema = z.object({
  /** Unique task identifier */
  id: z.string().uuid(),
  /** Task description */
  description: z.string().min(1),
  /** Agent assigned to this task */
  agentId: z.string(),
  /** Current status */
  status: TaskStatus,
  /** Task result/output */
  result: z.string().optional(),
  /** Error if failed */
  error: z.string().optional(),
  /** Start timestamp */
  startedAt: z.date().optional(),
  /** Completion timestamp */
  completedAt: z.date().optional(),
  /** Duration in milliseconds */
  duration: DurationMs.optional(),
  /** Parent task ID (for subtasks) */
  parentTaskId: z.string().uuid().optional(),
  /** Delegated from agent */
  delegatedFrom: z.string().optional(),
  /** Task metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type SessionTask = z.infer<typeof SessionTaskSchema>;

// =============================================================================
// Session Schema
// =============================================================================

/**
 * Session state
 */
export const SessionState = z.enum(['active', 'paused', 'completed', 'failed', 'cancelled']);
export type SessionState = z.infer<typeof SessionState>;

/**
 * Multi-agent session
 */
export const SessionSchema = z.object({
  /** Unique session identifier */
  id: SessionId,
  /** Session name/title */
  name: z.string().min(1).max(200),
  /** Session description */
  description: z.string().max(1000).optional(),
  /** Current state */
  state: SessionState.default('active'),
  /** Agents participating in this session */
  agents: z.array(z.string()).min(1),
  /** Tasks in this session */
  tasks: z.array(SessionTaskSchema).default([]),
  /** Creation timestamp */
  createdAt: z.date(),
  /** Last update timestamp */
  updatedAt: z.date(),
  /** Completion timestamp */
  completedAt: z.date().optional(),
  /** Total duration in milliseconds */
  duration: DurationMs.optional(),
  /** Session goal/objective */
  goal: z.string().optional(),
  /** Session tags */
  tags: z.array(z.string()).default([]),
  /** Session metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type Session = z.infer<typeof SessionSchema>;

// =============================================================================
// Checkpoint Schema
// =============================================================================

/**
 * Execution checkpoint for resume capability
 */
export const CheckpointSchema = z.object({
  /** Unique checkpoint identifier */
  id: CheckpointId,
  /** Session ID this checkpoint belongs to */
  sessionId: SessionId,
  /** Checkpoint name */
  name: z.string().default('auto'),
  /** Checkpoint creation timestamp */
  createdAt: z.date(),
  /** Session state at checkpoint */
  sessionState: SessionSchema,
  /** Current task index */
  currentTaskIndex: z.number().int().nonnegative(),
  /** Completed task IDs */
  completedTaskIds: z.array(z.string().uuid()).default([]),
  /** Execution context snapshot */
  contextSnapshot: z.record(z.string(), z.unknown()).optional(),
  /** Memory entries created since session start */
  memoryEntryIds: z.array(z.number().int().positive()).default([]),
  /** Is this an auto-save checkpoint */
  isAutoSave: z.boolean().default(true),
  /** Checkpoint metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type Checkpoint = z.infer<typeof CheckpointSchema>;

// =============================================================================
// Session Operations
// =============================================================================

/**
 * Input for creating a new session
 */
export const CreateSessionInputSchema = z.object({
  /** Session name */
  name: z.string().min(1).max(200),
  /** Session description */
  description: z.string().max(1000).optional(),
  /** Initial agents */
  agents: z.array(z.string()).min(1),
  /** Session goal */
  goal: z.string().optional(),
  /** Initial tasks */
  tasks: z.array(z.object({
    description: z.string().min(1),
    agentId: z.string(),
  })).optional(),
  /** Session tags */
  tags: z.array(z.string()).optional(),
  /** Session metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateSessionInput = z.infer<typeof CreateSessionInputSchema>;

/**
 * Input for adding a task to session
 */
export const AddTaskInputSchema = z.object({
  /** Session ID */
  sessionId: SessionId,
  /** Task description */
  description: z.string().min(1),
  /** Agent to assign */
  agentId: z.string(),
  /** Parent task ID */
  parentTaskId: z.string().uuid().optional(),
  /** Task metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type AddTaskInput = z.infer<typeof AddTaskInputSchema>;

/**
 * Input for updating task status
 */
export const UpdateTaskInputSchema = z.object({
  /** Session ID */
  sessionId: SessionId,
  /** Task ID */
  taskId: z.string().uuid(),
  /** New status */
  status: TaskStatus,
  /** Result if completed */
  result: z.string().optional(),
  /** Error if failed */
  error: z.string().optional(),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;

// =============================================================================
// Session Summary
// =============================================================================

/**
 * Session summary for listing
 */
export const SessionSummarySchema = z.object({
  /** Session ID */
  id: SessionId,
  /** Session name */
  name: z.string(),
  /** Current state */
  state: SessionState,
  /** Number of agents */
  agentCount: z.number().int().nonnegative(),
  /** Total tasks */
  totalTasks: z.number().int().nonnegative(),
  /** Completed tasks */
  completedTasks: z.number().int().nonnegative(),
  /** Failed tasks */
  failedTasks: z.number().int().nonnegative(),
  /** Creation timestamp */
  createdAt: z.date(),
  /** Last update timestamp */
  updatedAt: z.date(),
  /** Duration so far */
  duration: DurationMs.optional(),
});
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

/**
 * Create session summary from full session
 */
export function createSessionSummary(session: Session): SessionSummary {
  return {
    id: session.id,
    name: session.name,
    state: session.state,
    agentCount: session.agents.length,
    totalTasks: session.tasks.length,
    completedTasks: session.tasks.filter(t => t.status === 'completed').length,
    failedTasks: session.tasks.filter(t => t.status === 'failed').length,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    duration: session.duration,
  };
}

// =============================================================================
// Delegation Schema
// =============================================================================

/**
 * Delegation request from one agent to another
 */
export const DelegationRequestSchema = z.object({
  /** Source agent */
  fromAgent: z.string(),
  /** Target agent */
  toAgent: z.string(),
  /** Task to delegate */
  task: z.string().min(1),
  /** Delegation context */
  context: z.object({
    /** Shared data between agents */
    sharedData: z.record(z.string(), z.unknown()).optional(),
    /** Requirements for the delegated task */
    requirements: z.array(z.string()).optional(),
    /** Expected outputs */
    expectedOutputs: z.array(z.string()).optional(),
    /** Session ID */
    sessionId: SessionId.optional(),
    /** Delegation chain for tracking depth */
    delegationChain: z.array(z.string()).default([]),
  }).default({}),
  /** Delegation options */
  options: z.object({
    /** Timeout for delegated task */
    timeout: DurationMs.optional(),
    /** Priority level */
    priority: z.enum(['low', 'normal', 'high']).default('normal'),
    /** Whether to wait for result */
    waitForResult: z.boolean().default(true),
  }).default({}),
});
export type DelegationRequest = z.infer<typeof DelegationRequestSchema>;

/**
 * Delegation result
 */
export const DelegationResultSchema = z.object({
  /** Whether delegation was successful */
  success: z.boolean(),
  /** Delegation request */
  request: DelegationRequestSchema,
  /** Result from delegated agent */
  result: z.string().optional(),
  /** Error if failed */
  error: z.string().optional(),
  /** Execution duration */
  duration: DurationMs,
  /** Agent that completed the task */
  completedBy: z.string(),
});
export type DelegationResult = z.infer<typeof DelegationResultSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate session data
 */
export function validateSession(data: unknown): Session {
  return SessionSchema.parse(data);
}

/**
 * Validate checkpoint data
 */
export function validateCheckpoint(data: unknown): Checkpoint {
  return CheckpointSchema.parse(data);
}

/**
 * Validate create session input
 */
export function validateCreateSessionInput(data: unknown): CreateSessionInput {
  return CreateSessionInputSchema.parse(data);
}
