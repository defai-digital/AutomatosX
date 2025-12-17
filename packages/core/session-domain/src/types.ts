/**
 * Session Domain Types
 */

import type {
  Session,
  SessionTask,
  SessionStatus,
  SessionEvent,
  CreateSessionInput,
  JoinSessionInput,
  StartTaskInput,
  CompleteTaskInput,
  FailTaskInput,
  // Run history types from CLI contracts
  RunRecord,
  HistoryQuery,
} from '@automatosx/contracts';

/**
 * Session store interface
 */
export interface SessionStore {
  /**
   * Create a new session
   */
  create(input: CreateSessionInput): Promise<Session>;

  /**
   * Get a session by ID
   */
  get(sessionId: string): Promise<Session | undefined>;

  /**
   * Update a session
   */
  update(sessionId: string, session: Session): Promise<void>;

  /**
   * Delete a session
   */
  delete(sessionId: string): Promise<void>;

  /**
   * List sessions with optional filters
   */
  list(filter?: SessionFilter): Promise<Session[]>;

  /**
   * Find active session for an agent
   */
  findActiveForAgent(agentId: string, workspace?: string): Promise<Session | undefined>;

  /**
   * Apply a governance policy to a session
   */
  applyPolicy(sessionId: string, policyId: string): Promise<Session>;

  /**
   * Get applied policies for a session
   */
  getAppliedPolicies(sessionId: string): Promise<string[]>;
}

/**
 * Filter options for listing sessions
 */
export interface SessionFilter {
  status?: SessionStatus;
  initiator?: string;
  participant?: string;
  workspace?: string;
  createdAfter?: string;
  createdBefore?: string;
  limit?: number;
}

/**
 * Session manager interface
 */
export interface SessionManager {
  /**
   * Create a new session
   */
  createSession(input: CreateSessionInput): Promise<Session>;

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): Promise<Session | undefined>;

  /**
   * Join an existing session
   */
  joinSession(input: JoinSessionInput): Promise<Session>;

  /**
   * Leave a session
   */
  leaveSession(sessionId: string, agentId: string): Promise<Session>;

  /**
   * Start a task within a session
   */
  startTask(input: StartTaskInput): Promise<SessionTask>;

  /**
   * Complete a task
   */
  completeTask(input: CompleteTaskInput): Promise<SessionTask>;

  /**
   * Fail a task
   */
  failTask(input: FailTaskInput): Promise<SessionTask>;

  /**
   * Complete a session
   */
  completeSession(sessionId: string, summary?: string): Promise<Session>;

  /**
   * Fail a session
   */
  failSession(sessionId: string, error: SessionFailure): Promise<Session>;

  /**
   * List sessions
   */
  listSessions(filter?: SessionFilter): Promise<Session[]>;

  /**
   * Get run history across all sessions
   * Aggregates tasks from all participants across sessions
   */
  getRunHistory(options?: HistoryQuery): Promise<RunRecord[]>;

  /**
   * Count active sessions
   */
  countActiveSessions(): Promise<number>;
}

/**
 * Session failure info
 * Matches SessionErrorSchema from contracts
 */
export interface SessionFailure {
  code: string;
  message: string;
  taskId?: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
}

/**
 * Session event handler
 */
export type SessionEventHandler = (event: SessionEvent) => void | Promise<void>;

/**
 * Session event emitter interface
 */
export interface SessionEventEmitter {
  /**
   * Subscribe to session events
   */
  on(type: SessionEvent['type'] | '*', handler: SessionEventHandler): void;

  /**
   * Unsubscribe from session events
   */
  off(type: SessionEvent['type'] | '*', handler: SessionEventHandler): void;

  /**
   * Emit a session event
   */
  emit(event: SessionEvent): void;
}

/**
 * Session domain configuration
 */
export interface SessionDomainConfig {
  maxParticipants: number;
  maxTasksPerParticipant: number;
  sessionTimeout: number;
  eventBufferSize: number;
}

/**
 * Default session domain configuration
 */
export const DEFAULT_SESSION_DOMAIN_CONFIG: SessionDomainConfig = {
  maxParticipants: 10,
  maxTasksPerParticipant: 50,
  sessionTimeout: 3600000, // 1 hour
  eventBufferSize: 1000,
};

// ============================================================================
// Run History Types - Re-exported from contracts for convenience
// The authoritative definitions are in @automatosx/contracts (cli/v1)
// ============================================================================

// Re-export contract types to maintain backwards compatibility
// and provide a convenient import path for session-domain consumers
export type { RunRecord, RunStatus, HistoryQuery } from '@automatosx/contracts';

// Backwards compatibility alias
export type RunHistoryOptions = HistoryQuery;
