/**
 * Session Domain Contracts v1
 *
 * Zod schemas for session lifecycle, participants, and tasks.
 */

import { z } from 'zod';

// ============================================================================
// Status Enums and State Machines
// ============================================================================

/**
 * Session status
 */
export const SessionStatusSchema = z.enum(['active', 'completed', 'failed']);

export type SessionStatus = z.infer<typeof SessionStatusSchema>;

/**
 * Valid session status transitions
 */
export const SESSION_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  active: ['completed', 'failed'],
  completed: [], // Terminal
  failed: [], // Terminal
};

/**
 * Task status
 */
export const TaskStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
]);

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/**
 * Valid task status transitions
 */
export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ['running', 'cancelled'],
  running: ['completed', 'failed', 'cancelled'],
  completed: [], // Terminal
  failed: ['pending'], // Retry allowed
  cancelled: [], // Terminal
};

/**
 * Participant role
 */
export const ParticipantRoleSchema = z.enum([
  'initiator',
  'collaborator',
  'delegate',
]);

export type ParticipantRole = z.infer<typeof ParticipantRoleSchema>;

// ============================================================================
// Session Error Schema
// ============================================================================

/**
 * Session error schema
 */
export const SessionErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  taskId: z.string().uuid().optional(),
  retryable: z.boolean().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type SessionError = z.infer<typeof SessionErrorSchema>;

// ============================================================================
// Session Task Schema
// ============================================================================

/**
 * Task within a session
 */
export const SessionTaskSchema = z.object({
  taskId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  status: TaskStatusSchema,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  durationMs: z.number().int().min(0).optional(),
  output: z.unknown().optional(),
  error: SessionErrorSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type SessionTask = z.infer<typeof SessionTaskSchema>;

// ============================================================================
// Session Participant Schema
// ============================================================================

/**
 * Participant in a session
 */
export const SessionParticipantSchema = z.object({
  agentId: z.string().min(1).max(50),
  role: ParticipantRoleSchema,
  joinedAt: z.string().datetime(),
  leftAt: z.string().datetime().optional(),
  tasks: z.array(SessionTaskSchema).default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type SessionParticipant = z.infer<typeof SessionParticipantSchema>;

// ============================================================================
// Session Schema
// ============================================================================

/**
 * Session schema - the aggregate root for sessions
 * Schema strictness rejects unknown fields
 */
export const SessionSchema = z.object({
  sessionId: z.string().uuid(),
  initiator: z.string().min(1).max(50), // Agent ID that started session
  task: z.string().min(1).max(5000), // Task description
  participants: z.array(SessionParticipantSchema).default([]),
  status: SessionStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  version: z.number().int().min(1), // For optimistic concurrency
  workspace: z.string().max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  appliedPolicies: z.array(z.string()).default([]), // Applied governance policies
}).strict();

export type Session = z.infer<typeof SessionSchema>;

// ============================================================================
// Session Events
// ============================================================================

/**
 * Session event types
 */
export const SessionEventTypeSchema = z.enum([
  'session.created',
  'session.agentJoined',
  'session.agentLeft',
  'session.taskStarted',
  'session.taskCompleted',
  'session.taskFailed',
  'session.completed',
  'session.failed',
  'session.policyApplied',
]);

export type SessionEventType = z.infer<typeof SessionEventTypeSchema>;

/**
 * Base event schema for session events
 */
export const SessionBaseEventSchema = z.object({
  eventId: z.string().uuid(),
  timestamp: z.string().datetime(),
  version: z.number().int().min(1),
  correlationId: z.string().uuid(),
  causationId: z.string().uuid().optional(),
  spanId: z.string().optional(),
  traceId: z.string().optional(),
});

/**
 * Session event payload variants
 */
export const SessionEventPayloadSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('created'),
    initiator: z.string(),
    task: z.string(),
  }),
  z.object({
    type: z.literal('agentJoined'),
    agentId: z.string(),
    role: ParticipantRoleSchema,
  }),
  z.object({
    type: z.literal('agentLeft'),
    agentId: z.string(),
    reason: z.string().optional(),
  }),
  z.object({
    type: z.literal('taskStarted'),
    taskId: z.string().uuid(),
    agentId: z.string(),
    title: z.string(),
  }),
  z.object({
    type: z.literal('taskCompleted'),
    taskId: z.string().uuid(),
    agentId: z.string(),
    output: z.unknown().optional(),
    durationMs: z.number(),
  }),
  z.object({
    type: z.literal('taskFailed'),
    taskId: z.string().uuid(),
    agentId: z.string(),
    error: SessionErrorSchema,
  }),
  z.object({
    type: z.literal('completed'),
    summary: z.string().optional(),
    durationMs: z.number(),
  }),
  z.object({
    type: z.literal('failed'),
    error: SessionErrorSchema,
  }),
  z.object({
    type: z.literal('policyApplied'),
    policyId: z.string(),
    appliedBy: z.string().optional(),
  }),
]);

export type SessionEventPayload = z.infer<typeof SessionEventPayloadSchema>;

/**
 * Session event schema
 */
export const SessionEventSchema = SessionBaseEventSchema.extend({
  aggregateId: z.string().uuid(), // sessionId
  type: SessionEventTypeSchema,
  payload: SessionEventPayloadSchema,
});

export type SessionEvent = z.infer<typeof SessionEventSchema>;

// ============================================================================
// Session Operations
// ============================================================================

/**
 * Create session input
 */
export const CreateSessionInputSchema = z.object({
  initiator: z.string().min(1).max(50),
  task: z.string().min(1).max(5000),
  workspace: z.string().max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateSessionInput = z.infer<typeof CreateSessionInputSchema>;

/**
 * Join session input
 */
export const JoinSessionInputSchema = z.object({
  sessionId: z.string().uuid(),
  agentId: z.string().min(1).max(50),
  role: ParticipantRoleSchema.optional().default('collaborator'),
});

export type JoinSessionInput = z.infer<typeof JoinSessionInputSchema>;

/**
 * Start task input
 */
export const StartTaskInputSchema = z.object({
  sessionId: z.string().uuid(),
  agentId: z.string().min(1).max(50),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
});

export type StartTaskInput = z.infer<typeof StartTaskInputSchema>;

/**
 * Complete task input
 */
export const CompleteTaskInputSchema = z.object({
  sessionId: z.string().uuid(),
  taskId: z.string().uuid(),
  output: z.unknown().optional(),
});

export type CompleteTaskInput = z.infer<typeof CompleteTaskInputSchema>;

/**
 * Fail task input
 */
export const FailTaskInputSchema = z.object({
  sessionId: z.string().uuid(),
  taskId: z.string().uuid(),
  error: SessionErrorSchema,
});

export type FailTaskInput = z.infer<typeof FailTaskInputSchema>;

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Session error codes
 */
export const SessionErrorCode = {
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_ALREADY_COMPLETED: 'SESSION_ALREADY_COMPLETED',
  SESSION_CONCURRENT_MODIFICATION: 'SESSION_CONCURRENT_MODIFICATION',
  SESSION_INVALID_TRANSITION: 'SESSION_INVALID_TRANSITION',
  SESSION_AGENT_NOT_PARTICIPANT: 'SESSION_AGENT_NOT_PARTICIPANT',
  SESSION_TASK_NOT_FOUND: 'SESSION_TASK_NOT_FOUND',
  SESSION_MAX_PARTICIPANTS: 'SESSION_MAX_PARTICIPANTS',
  SESSION_VALIDATION_ERROR: 'SESSION_VALIDATION_ERROR',
} as const;

export type SessionErrorCode =
  (typeof SessionErrorCode)[keyof typeof SessionErrorCode];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates a session
 */
export function validateSession(data: unknown): Session {
  return SessionSchema.parse(data);
}

/**
 * Safely validates a session
 */
export function safeValidateSession(
  data: unknown
): { success: true; data: Session } | { success: false; error: z.ZodError } {
  const result = SessionSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Checks if a session status transition is valid
 */
export function isValidSessionTransition(
  from: SessionStatus,
  to: SessionStatus
): boolean {
  return SESSION_TRANSITIONS[from].includes(to);
}

/**
 * Checks if a task status transition is valid
 */
export function isValidTaskTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_TRANSITIONS[from].includes(to);
}

/**
 * Validates create session input
 */
export function validateCreateSessionInput(data: unknown): CreateSessionInput {
  return CreateSessionInputSchema.parse(data);
}

/**
 * Validates join session input
 */
export function validateJoinSessionInput(data: unknown): JoinSessionInput {
  return JoinSessionInputSchema.parse(data);
}

/**
 * Validates start task input
 */
export function validateStartTaskInput(data: unknown): StartTaskInput {
  return StartTaskInputSchema.parse(data);
}
