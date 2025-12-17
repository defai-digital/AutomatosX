/**
 * Session Domain Contracts v1
 *
 * @packageDocumentation
 */

export {
  // Status Schemas
  SessionStatusSchema,
  TaskStatusSchema,
  ParticipantRoleSchema,

  // State Machine Transitions
  SESSION_TRANSITIONS,
  TASK_TRANSITIONS,

  // Error Schema
  SessionErrorSchema,

  // Core Schemas
  SessionTaskSchema,
  SessionParticipantSchema,
  SessionSchema,

  // Event Schemas
  SessionEventTypeSchema,
  SessionBaseEventSchema,
  SessionEventPayloadSchema,
  SessionEventSchema,

  // Operation Schemas
  CreateSessionInputSchema,
  JoinSessionInputSchema,
  StartTaskInputSchema,
  CompleteTaskInputSchema,
  FailTaskInputSchema,

  // Error Codes
  SessionErrorCode,

  // Validation Functions
  validateSession,
  safeValidateSession,
  isValidSessionTransition,
  isValidTaskTransition,
  validateCreateSessionInput,
  validateJoinSessionInput,
  validateStartTaskInput,

  // Types
  type SessionStatus,
  type TaskStatus,
  type ParticipantRole,
  type SessionError,
  type SessionTask,
  type SessionParticipant,
  type Session,
  type SessionEventType,
  type SessionEventPayload,
  type SessionEvent,
  type CreateSessionInput,
  type JoinSessionInput,
  type StartTaskInput,
  type CompleteTaskInput,
  type FailTaskInput,
} from './schema.js';
