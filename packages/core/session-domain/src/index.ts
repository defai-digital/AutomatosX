/**
 * @defai.digital/session-domain
 *
 * Session lifecycle management for AutomatosX.
 * Tracks multi-agent collaboration, task progress, and shared state.
 */

// Types
export type {
  SessionStore,
  SessionFilter,
  SessionManager,
  SessionFailure,
  SessionEventHandler,
  SessionEventEmitter,
  SessionDomainConfig,
  RunRecord,
  RunHistoryOptions,
  RunStatus,
} from './types.js';

export { DEFAULT_SESSION_DOMAIN_CONFIG } from './types.js';

// Store
export {
  InMemorySessionStore,
  SessionVersionConflictError,
  createSessionStore,
} from './store.js';

// Manager
export {
  DefaultSessionManager,
  SessionError,
  createSessionManager,
} from './manager.js';

// Re-export contract types for convenience
export type {
  Session,
  SessionTask,
  SessionParticipant,
  SessionStatus,
  TaskStatus,
  ParticipantRole,
  SessionEvent,
  SessionEventType,
  SessionEventPayload,
  SessionError as SessionErrorType,
  CreateSessionInput,
  JoinSessionInput,
  StartTaskInput,
  CompleteTaskInput,
  FailTaskInput,
} from '@defai.digital/contracts';

export {
  SessionSchema,
  SessionTaskSchema,
  SessionParticipantSchema,
  SessionStatusSchema,
  TaskStatusSchema,
  ParticipantRoleSchema,
  SessionEventSchema,
  SessionErrorCode,
  SESSION_TRANSITIONS,
  TASK_TRANSITIONS,
  validateSession,
  safeValidateSession,
  isValidSessionTransition,
  isValidTaskTransition,
  validateCreateSessionInput,
  validateJoinSessionInput,
  validateStartTaskInput,
} from '@defai.digital/contracts';
