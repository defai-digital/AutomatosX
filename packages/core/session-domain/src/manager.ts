/**
 * Session Manager Implementation
 *
 * Manages session lifecycle, participants, and tasks.
 */

import {
  type Session,
  type SessionTask,
  type SessionParticipant,
  type SessionEvent,
  type CreateSessionInput,
  type JoinSessionInput,
  type StartTaskInput,
  type CompleteTaskInput,
  type FailTaskInput,
  SessionErrorCode,
  isValidSessionTransition,
  isValidTaskTransition,
} from '@defai.digital/contracts';
import type {
  SessionManager,
  SessionStore,
  SessionFilter,
  SessionFailure,
  SessionDomainConfig,
  SessionEventEmitter,
} from './types.js';
import type {
  RunRecord,
  RunStatus,
  HistoryQuery,
} from '@defai.digital/contracts';

/**
 * Default session manager implementation
 *
 * Emits events for all state changes when an event emitter is provided.
 * INV-SESS-EVENT: All state changes MUST emit corresponding events
 */
export class DefaultSessionManager implements SessionManager {
  private readonly eventEmitter: SessionEventEmitter | undefined;
  private eventVersion = 1;

  constructor(
    private readonly store: SessionStore,
    private readonly config: SessionDomainConfig,
    eventEmitter?: SessionEventEmitter
  ) {
    this.eventEmitter = eventEmitter;
  }

  /**
   * Emits a session event if an event emitter is configured
   * INV-SESS-EVENT: Events emitted for all state changes
   *
   * Event structure follows the contract schema:
   * - aggregateId: the session ID
   * - type: 'session.created' | 'session.agentJoined' | etc.
   * - payload: discriminated union with type: 'created' | 'agentJoined' | etc.
   */
  private emitEvent(
    type: SessionEvent['type'],
    sessionId: string,
    payload: SessionEvent['payload'],
    correlationId?: string
  ): void {
    if (this.eventEmitter === undefined) return;

    const event: SessionEvent = {
      eventId: crypto.randomUUID(),
      aggregateId: sessionId,
      type,
      payload,
      timestamp: new Date().toISOString(),
      version: this.eventVersion++,
      correlationId: correlationId ?? crypto.randomUUID(),
    };

    this.eventEmitter.emit(event);
  }

  /**
   * Create a new session
   */
  async createSession(input: CreateSessionInput): Promise<Session> {
    const session = await this.store.create(input);

    // Emit session.created event
    this.emitEvent('session.created', session.sessionId, {
      type: 'created',
      initiator: input.initiator,
      task: input.task,
    });

    return session;
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<Session | undefined> {
    return this.store.get(sessionId);
  }

  /**
   * Join an existing session
   */
  async joinSession(input: JoinSessionInput): Promise<Session> {
    const session = await this.store.get(input.sessionId);

    if (session === undefined) {
      throw new SessionError(
        SessionErrorCode.SESSION_NOT_FOUND,
        `Session ${input.sessionId} not found`
      );
    }

    if (session.status !== 'active') {
      throw new SessionError(
        SessionErrorCode.SESSION_ALREADY_COMPLETED,
        `Session ${input.sessionId} is ${session.status}`
      );
    }

    // Check if already a participant
    const existingParticipant = session.participants.find(
      (p) => p.agentId === input.agentId && p.leftAt === undefined
    );
    if (existingParticipant !== undefined) {
      return session; // Already joined
    }

    // Check max participants
    const activeParticipants = session.participants.filter(
      (p) => p.leftAt === undefined
    );
    if (activeParticipants.length >= this.config.maxParticipants) {
      throw new SessionError(
        SessionErrorCode.SESSION_MAX_PARTICIPANTS,
        `Session ${input.sessionId} has reached max participants (${this.config.maxParticipants})`
      );
    }

    // Add participant
    const newParticipant: SessionParticipant = {
      agentId: input.agentId,
      role: input.role ?? 'collaborator',
      joinedAt: new Date().toISOString(),
      tasks: [],
    };

    const updatedSession: Session = {
      sessionId: session.sessionId,
      initiator: session.initiator,
      task: session.task,
      participants: [...session.participants, newParticipant],
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: new Date().toISOString(),
      completedAt: session.completedAt,
      version: session.version + 1,
      workspace: session.workspace,
      metadata: session.metadata,
      appliedPolicies: session.appliedPolicies ?? [],
    };

    await this.store.update(input.sessionId, updatedSession);

    // Emit session.agentJoined event
    this.emitEvent('session.agentJoined', input.sessionId, {
      type: 'agentJoined',
      agentId: input.agentId,
      role: newParticipant.role,
    });

    return updatedSession;
  }

  /**
   * Leave a session
   */
  async leaveSession(sessionId: string, agentId: string): Promise<Session> {
    const session = await this.store.get(sessionId);

    if (session === undefined) {
      throw new SessionError(
        SessionErrorCode.SESSION_NOT_FOUND,
        `Session ${sessionId} not found`
      );
    }

    const participantIndex = session.participants.findIndex(
      (p) => p.agentId === agentId && p.leftAt === undefined
    );

    if (participantIndex === -1) {
      throw new SessionError(
        SessionErrorCode.SESSION_AGENT_NOT_PARTICIPANT,
        `Agent ${agentId} is not a participant in session ${sessionId}`
      );
    }

    // Update participant with leftAt timestamp
    const participant = session.participants[participantIndex];
    if (participant === undefined) {
      throw new SessionError(
        SessionErrorCode.SESSION_AGENT_NOT_PARTICIPANT,
        `Agent ${agentId} is not a participant in session ${sessionId}`
      );
    }

    const updatedParticipant: SessionParticipant = {
      agentId: participant.agentId,
      role: participant.role,
      joinedAt: participant.joinedAt,
      leftAt: new Date().toISOString(),
      tasks: participant.tasks,
      metadata: participant.metadata,
    };

    const updatedParticipants = [...session.participants];
    updatedParticipants[participantIndex] = updatedParticipant;

    const updatedSession: Session = {
      sessionId: session.sessionId,
      initiator: session.initiator,
      task: session.task,
      participants: updatedParticipants,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: new Date().toISOString(),
      completedAt: session.completedAt,
      version: session.version + 1,
      workspace: session.workspace,
      metadata: session.metadata,
      appliedPolicies: session.appliedPolicies ?? [],
    };

    await this.store.update(sessionId, updatedSession);

    // Emit session.agentLeft event
    this.emitEvent('session.agentLeft', sessionId, {
      type: 'agentLeft',
      agentId,
    });

    return updatedSession;
  }

  /**
   * Start a task within a session
   */
  async startTask(input: StartTaskInput): Promise<SessionTask> {
    const session = await this.store.get(input.sessionId);

    if (session === undefined) {
      throw new SessionError(
        SessionErrorCode.SESSION_NOT_FOUND,
        `Session ${input.sessionId} not found`
      );
    }

    if (session.status !== 'active') {
      throw new SessionError(
        SessionErrorCode.SESSION_ALREADY_COMPLETED,
        `Session ${input.sessionId} is ${session.status}`
      );
    }

    // Find participant
    const participantIndex = session.participants.findIndex(
      (p) => p.agentId === input.agentId && p.leftAt === undefined
    );

    if (participantIndex === -1) {
      throw new SessionError(
        SessionErrorCode.SESSION_AGENT_NOT_PARTICIPANT,
        `Agent ${input.agentId} is not a participant in session ${input.sessionId}`
      );
    }

    const participant = session.participants[participantIndex];
    if (participant === undefined) {
      throw new SessionError(
        SessionErrorCode.SESSION_AGENT_NOT_PARTICIPANT,
        `Agent ${input.agentId} is not a participant in session ${input.sessionId}`
      );
    }

    // Check task limit
    if (participant.tasks.length >= this.config.maxTasksPerParticipant) {
      throw new SessionError(
        SessionErrorCode.SESSION_VALIDATION_ERROR,
        `Agent ${input.agentId} has reached max tasks (${this.config.maxTasksPerParticipant})`
      );
    }

    // Create task
    const task: SessionTask = {
      taskId: crypto.randomUUID(),
      title: input.title,
      description: input.description,
      status: 'running',
      startedAt: new Date().toISOString(),
    };

    // Update participant's tasks
    const updatedParticipant: SessionParticipant = {
      agentId: participant.agentId,
      role: participant.role,
      joinedAt: participant.joinedAt,
      leftAt: participant.leftAt,
      tasks: [...participant.tasks, task],
      metadata: participant.metadata,
    };

    const updatedParticipants = [...session.participants];
    updatedParticipants[participantIndex] = updatedParticipant;

    const updatedSession: Session = {
      sessionId: session.sessionId,
      initiator: session.initiator,
      task: session.task,
      participants: updatedParticipants,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: new Date().toISOString(),
      completedAt: session.completedAt,
      version: session.version + 1,
      workspace: session.workspace,
      metadata: session.metadata,
      appliedPolicies: session.appliedPolicies ?? [],
    };

    await this.store.update(input.sessionId, updatedSession);

    // Emit session.taskStarted event
    this.emitEvent('session.taskStarted', input.sessionId, {
      type: 'taskStarted',
      taskId: task.taskId,
      agentId: input.agentId,
      title: task.title,
    });

    return task;
  }

  /**
   * Complete a task
   */
  async completeTask(input: CompleteTaskInput): Promise<SessionTask> {
    const session = await this.store.get(input.sessionId);

    if (session === undefined) {
      throw new SessionError(
        SessionErrorCode.SESSION_NOT_FOUND,
        `Session ${input.sessionId} not found`
      );
    }

    // Find task across all participants
    let foundParticipantIndex = -1;
    let foundTaskIndex = -1;

    for (let pi = 0; pi < session.participants.length; pi++) {
      const participant = session.participants[pi];
      if (participant === undefined) continue;
      const ti = participant.tasks.findIndex((t) => t.taskId === input.taskId);
      if (ti !== -1) {
        foundParticipantIndex = pi;
        foundTaskIndex = ti;
        break;
      }
    }

    if (foundParticipantIndex === -1 || foundTaskIndex === -1) {
      throw new SessionError(
        SessionErrorCode.SESSION_TASK_NOT_FOUND,
        `Task ${input.taskId} not found in session ${input.sessionId}`
      );
    }

    const participant = session.participants[foundParticipantIndex];
    if (participant === undefined) {
      throw new SessionError(
        SessionErrorCode.SESSION_TASK_NOT_FOUND,
        `Task ${input.taskId} not found in session ${input.sessionId}`
      );
    }

    const task = participant.tasks[foundTaskIndex];
    if (task === undefined) {
      throw new SessionError(
        SessionErrorCode.SESSION_TASK_NOT_FOUND,
        `Task ${input.taskId} not found in session ${input.sessionId}`
      );
    }

    // Validate transition
    if (!isValidTaskTransition(task.status, 'completed')) {
      throw new SessionError(
        SessionErrorCode.SESSION_INVALID_TRANSITION,
        `Cannot transition task from ${task.status} to completed`
      );
    }

    const now = new Date().toISOString();
    const startTime = new Date(task.startedAt).getTime();
    const durationMs = new Date(now).getTime() - startTime;

    // Update task
    const updatedTask: SessionTask = {
      taskId: task.taskId,
      title: task.title,
      description: task.description,
      status: 'completed',
      startedAt: task.startedAt,
      completedAt: now,
      durationMs,
      output: input.output,
      error: task.error,
      metadata: task.metadata,
    };

    // Update session
    const updatedTasks = [...participant.tasks];
    updatedTasks[foundTaskIndex] = updatedTask;

    const updatedParticipant: SessionParticipant = {
      agentId: participant.agentId,
      role: participant.role,
      joinedAt: participant.joinedAt,
      leftAt: participant.leftAt,
      tasks: updatedTasks,
      metadata: participant.metadata,
    };

    const updatedParticipants = [...session.participants];
    updatedParticipants[foundParticipantIndex] = updatedParticipant;

    const updatedSession: Session = {
      sessionId: session.sessionId,
      initiator: session.initiator,
      task: session.task,
      participants: updatedParticipants,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: now,
      completedAt: session.completedAt,
      version: session.version + 1,
      workspace: session.workspace,
      metadata: session.metadata,
      appliedPolicies: session.appliedPolicies ?? [],
    };

    await this.store.update(input.sessionId, updatedSession);

    // Emit session.taskCompleted event
    this.emitEvent('session.taskCompleted', input.sessionId, {
      type: 'taskCompleted',
      taskId: input.taskId,
      agentId: participant.agentId,
      durationMs: updatedTask.durationMs ?? 0,
      output: input.output,
    });

    return updatedTask;
  }

  /**
   * Fail a task
   */
  async failTask(input: FailTaskInput): Promise<SessionTask> {
    const session = await this.store.get(input.sessionId);

    if (session === undefined) {
      throw new SessionError(
        SessionErrorCode.SESSION_NOT_FOUND,
        `Session ${input.sessionId} not found`
      );
    }

    // Find task across all participants
    let foundParticipantIndex = -1;
    let foundTaskIndex = -1;

    for (let pi = 0; pi < session.participants.length; pi++) {
      const participant = session.participants[pi];
      if (participant === undefined) continue;
      const ti = participant.tasks.findIndex((t) => t.taskId === input.taskId);
      if (ti !== -1) {
        foundParticipantIndex = pi;
        foundTaskIndex = ti;
        break;
      }
    }

    if (foundParticipantIndex === -1 || foundTaskIndex === -1) {
      throw new SessionError(
        SessionErrorCode.SESSION_TASK_NOT_FOUND,
        `Task ${input.taskId} not found in session ${input.sessionId}`
      );
    }

    const participant = session.participants[foundParticipantIndex];
    if (participant === undefined) {
      throw new SessionError(
        SessionErrorCode.SESSION_TASK_NOT_FOUND,
        `Task ${input.taskId} not found in session ${input.sessionId}`
      );
    }

    const task = participant.tasks[foundTaskIndex];
    if (task === undefined) {
      throw new SessionError(
        SessionErrorCode.SESSION_TASK_NOT_FOUND,
        `Task ${input.taskId} not found in session ${input.sessionId}`
      );
    }

    // Validate transition
    if (!isValidTaskTransition(task.status, 'failed')) {
      throw new SessionError(
        SessionErrorCode.SESSION_INVALID_TRANSITION,
        `Cannot transition task from ${task.status} to failed`
      );
    }

    const now = new Date().toISOString();
    const startTime = new Date(task.startedAt).getTime();
    const durationMs = new Date(now).getTime() - startTime;

    // Update task
    const updatedTask: SessionTask = {
      taskId: task.taskId,
      title: task.title,
      description: task.description,
      status: 'failed',
      startedAt: task.startedAt,
      completedAt: now,
      durationMs,
      output: task.output,
      error: input.error,
      metadata: task.metadata,
    };

    // Update session
    const updatedTasks = [...participant.tasks];
    updatedTasks[foundTaskIndex] = updatedTask;

    const updatedParticipant: SessionParticipant = {
      agentId: participant.agentId,
      role: participant.role,
      joinedAt: participant.joinedAt,
      leftAt: participant.leftAt,
      tasks: updatedTasks,
      metadata: participant.metadata,
    };

    const updatedParticipants = [...session.participants];
    updatedParticipants[foundParticipantIndex] = updatedParticipant;

    const updatedSession: Session = {
      sessionId: session.sessionId,
      initiator: session.initiator,
      task: session.task,
      participants: updatedParticipants,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: now,
      completedAt: session.completedAt,
      version: session.version + 1,
      workspace: session.workspace,
      metadata: session.metadata,
      appliedPolicies: session.appliedPolicies ?? [],
    };

    await this.store.update(input.sessionId, updatedSession);

    // Emit session.taskFailed event
    this.emitEvent('session.taskFailed', input.sessionId, {
      type: 'taskFailed',
      taskId: input.taskId,
      agentId: participant.agentId,
      error: input.error,
    });

    return updatedTask;
  }

  /**
   * Complete a session
   */
  async completeSession(sessionId: string, summary?: string): Promise<Session> {
    const session = await this.store.get(sessionId);

    if (session === undefined) {
      throw new SessionError(
        SessionErrorCode.SESSION_NOT_FOUND,
        `Session ${sessionId} not found`
      );
    }

    if (!isValidSessionTransition(session.status, 'completed')) {
      throw new SessionError(
        SessionErrorCode.SESSION_INVALID_TRANSITION,
        `Cannot transition session from ${session.status} to completed`
      );
    }

    const now = new Date().toISOString();

    const updatedSession: Session = {
      sessionId: session.sessionId,
      initiator: session.initiator,
      task: session.task,
      participants: session.participants,
      status: 'completed',
      createdAt: session.createdAt,
      updatedAt: now,
      completedAt: now,
      version: session.version + 1,
      workspace: session.workspace,
      metadata: summary !== undefined
        ? { ...session.metadata, summary }
        : session.metadata,
      appliedPolicies: session.appliedPolicies ?? [],
    };

    await this.store.update(sessionId, updatedSession);

    // Calculate session duration
    const startTime = new Date(session.createdAt).getTime();
    const durationMs = new Date(now).getTime() - startTime;

    // Emit session.completed event
    this.emitEvent('session.completed', sessionId, {
      type: 'completed',
      summary,
      durationMs,
    });

    return updatedSession;
  }

  /**
   * Fail a session
   */
  async failSession(sessionId: string, error: SessionFailure): Promise<Session> {
    const session = await this.store.get(sessionId);

    if (session === undefined) {
      throw new SessionError(
        SessionErrorCode.SESSION_NOT_FOUND,
        `Session ${sessionId} not found`
      );
    }

    if (!isValidSessionTransition(session.status, 'failed')) {
      throw new SessionError(
        SessionErrorCode.SESSION_INVALID_TRANSITION,
        `Cannot transition session from ${session.status} to failed`
      );
    }

    const now = new Date().toISOString();

    const updatedSession: Session = {
      sessionId: session.sessionId,
      initiator: session.initiator,
      task: session.task,
      participants: session.participants,
      status: 'failed',
      createdAt: session.createdAt,
      updatedAt: now,
      completedAt: now,
      version: session.version + 1,
      workspace: session.workspace,
      metadata: {
        ...session.metadata,
        error: {
          code: error.code,
          message: error.message,
          taskId: error.taskId,
          details: error.details,
        },
      },
      appliedPolicies: session.appliedPolicies ?? [],
    };

    await this.store.update(sessionId, updatedSession);

    // Emit session.failed event
    this.emitEvent('session.failed', sessionId, {
      type: 'failed',
      error: {
        code: error.code,
        message: error.message,
        taskId: error.taskId,
        retryable: error.retryable,
        details: error.details,
      },
    });

    return updatedSession;
  }

  /**
   * List sessions
   */
  async listSessions(filter?: SessionFilter): Promise<Session[]> {
    return this.store.list(filter);
  }

  /**
   * Get run history across all sessions
   * Aggregates tasks from all participants across sessions
   */
  async getRunHistory(options?: HistoryQuery): Promise<RunRecord[]> {
    const sessions = await this.store.list();
    const records: RunRecord[] = [];

    for (const session of sessions) {
      for (const participant of session.participants) {
        // Apply agent filter if specified
        if (options?.agentId !== undefined && participant.agentId !== options.agentId) {
          continue;
        }

        for (const task of participant.tasks) {
          // Map task status to run status
          const runStatus = this.mapTaskStatusToRunStatus(task.status);

          // Apply status filter if specified
          if (options?.status !== undefined && runStatus !== options.status) {
            continue;
          }

          // Build record with optional properties only when defined
          const record: RunRecord = {
            runId: task.taskId,
            agentId: participant.agentId,
            sessionId: session.sessionId,
            task: task.title,
            status: runStatus,
            startedAt: task.startedAt,
            stepsCompleted: task.status === 'completed' ? 1 : 0,
          };

          // Add optional properties only when they have values
          if (task.error?.message !== undefined) {
            record.error = task.error.message;
          }
          if (task.completedAt !== undefined) {
            record.completedAt = task.completedAt;
          }
          if (task.durationMs !== undefined) {
            record.durationMs = task.durationMs;
          }
          if (task.metadata?.tokensUsed !== undefined) {
            record.tokensUsed = task.metadata.tokensUsed as number;
          }
          if (task.metadata?.providerId !== undefined) {
            record.providerId = task.metadata.providerId as string;
          }

          records.push(record);
        }
      }
    }

    // Sort by startedAt descending (most recent first)
    records.sort((a, b) => {
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    });

    // Apply limit
    const limit = options?.limit ?? 50;
    return records.slice(0, limit);
  }

  /**
   * Count active sessions
   */
  async countActiveSessions(): Promise<number> {
    const sessions = await this.store.list({ status: 'active' });
    return sessions.length;
  }

  /**
   * Maps SessionTask status to RunStatus
   */
  private mapTaskStatusToRunStatus(taskStatus: string): RunStatus {
    switch (taskStatus) {
      case 'running':
      case 'pending':
        return 'running';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      default:
        return 'running';
    }
  }
}

/**
 * Session error
 */
export class SessionError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'SessionError';
  }
}

/**
 * Creates a new session manager
 * @param store - Session store implementation
 * @param config - Session domain configuration
 * @param eventEmitter - Optional event emitter for state change events
 */
export function createSessionManager(
  store: SessionStore,
  config: SessionDomainConfig,
  eventEmitter?: SessionEventEmitter
): SessionManager {
  return new DefaultSessionManager(store, config, eventEmitter);
}
