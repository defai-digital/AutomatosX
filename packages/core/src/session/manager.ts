/**
 * Session Manager - Session lifecycle and state management
 *
 * Manages multi-agent sessions with task tracking, state persistence,
 * and checkpoint support for resumable workflows.
 *
 * @module @ax/core/session
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

// =============================================================================
// Session Constants
// =============================================================================

/** Default session name when none provided */
const DEFAULT_SESSION_NAME = 'Untitled Session';

/** Maximum sessions to keep in memory */
const MAX_IN_MEMORY_SESSIONS = 100;

/** Session file extension */
const SESSION_FILE_EXT = '.json';

/** Session storage directory name */
const SESSIONS_DIR = 'sessions';

// =============================================================================
// State Transition Rules
// =============================================================================

/**
 * Valid state transitions for session state machine.
 * Key is current state, value is array of valid target states.
 */
const VALID_STATE_TRANSITIONS: Record<string, readonly string[]> = {
  active: ['paused', 'completed', 'failed', 'cancelled'],
  paused: ['active', 'cancelled'],
  completed: [], // Terminal state - no transitions allowed
  failed: [], // Terminal state - no transitions allowed
  cancelled: [], // Terminal state - no transitions allowed
} as const;

/**
 * Check if a state transition is valid
 */
function isValidTransition(fromState: string, toState: string): boolean {
  const validTargets = VALID_STATE_TRANSITIONS[fromState];
  return validTargets?.includes(toState) ?? false;
}

// =============================================================================
// Imports
// =============================================================================

import { randomUUID } from 'node:crypto';
import { readFile, writeFile, readdir, mkdir, unlink, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import {
  type Session,
  type SessionState,
  type SessionTask,
  type SessionSummary,
  type CreateSessionInput,
  type AddTaskInput,
  type UpdateTaskInput,
  type SessionIdType,
  SessionSchema,
  SessionTaskSchema,
  CreateSessionInputSchema,
  AddTaskInputSchema,
  UpdateTaskInputSchema,
  createSessionSummary,
  TaskStatus,
  SessionId,
} from '@ax/schemas';

/**
 * Parse a session ID string to the branded SessionId type.
 * Falls back to casting if not a valid UUID (for backward compatibility).
 */
function parseSessionId(sessionId: string): SessionIdType {
  const result = SessionId.safeParse(sessionId);
  if (result.success) {
    return result.data;
  }
  // Fallback for non-UUID session IDs (backward compatibility)
  return sessionId as SessionIdType;
}

/**
 * Safely invoke an event callback, catching and logging any errors.
 * This prevents user-provided callbacks from crashing the session manager.
 */
function safeInvokeEvent<T extends unknown[]>(
  eventName: string,
  callback: ((...args: T) => void) | undefined,
  ...args: T
): void {
  if (!callback) return;
  try {
    callback(...args);
  } catch (error) {
    console.error(
      `[ax/session] Event callback "${eventName}" threw an error:`,
      error instanceof Error ? error.message : error
    );
  }
}

// =============================================================================
// Types
// =============================================================================

export interface SessionManagerOptions {
  /** Base storage path (.automatosx directory) */
  storagePath: string;
  /** Maximum sessions to keep in memory */
  maxInMemorySessions?: number;
  /** Auto-persist sessions to disk */
  autoPersist?: boolean;
}

export interface SessionFilter {
  state?: SessionState;
  agent?: string;
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface SessionManagerEvents {
  onSessionCreated?: (session: Session) => void;
  onSessionUpdated?: (session: Session) => void;
  onSessionCompleted?: (session: Session) => void;
  onTaskAdded?: (session: Session, task: SessionTask) => void;
  onTaskUpdated?: (session: Session, task: SessionTask) => void;
}

// =============================================================================
// Session Manager Class
// =============================================================================

export class SessionManager {
  private readonly sessionsPath: string;
  private readonly maxInMemorySessions: number;
  private readonly autoPersist: boolean;
  private readonly sessions: Map<string, Session> = new Map();
  private readonly events: SessionManagerEvents = {};
  private readonly sessionLocks: Map<string, Promise<void>> = new Map();
  private initialized = false;

  constructor(options: SessionManagerOptions) {
    this.sessionsPath = join(options.storagePath, SESSIONS_DIR);
    this.maxInMemorySessions = options.maxInMemorySessions ?? MAX_IN_MEMORY_SESSIONS;
    this.autoPersist = options.autoPersist ?? true;
  }

  // =============================================================================
  // Lifecycle Methods
  // =============================================================================

  /**
   * Initialize session manager and load existing sessions
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Ensure sessions directory exists
    await mkdir(this.sessionsPath, { recursive: true });

    // Load recent sessions from disk
    await this.loadRecentSessions();

    this.initialized = true;
  }

  /**
   * Cleanup and persist all sessions
   */
  async cleanup(): Promise<void> {
    if (this.autoPersist) {
      await this.persistAll();
    }
    this.sessions.clear();
    this.initialized = false;
  }

  // =============================================================================
  // Session CRUD Operations
  // =============================================================================

  /**
   * Ensure the manager is initialized before performing operations
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        'SessionManager not initialized. Call initialize() before performing operations.'
      );
    }
  }

  /**
   * Create a new session
   */
  async create(input: CreateSessionInput): Promise<Session> {
    this.ensureInitialized();
    const validated = CreateSessionInputSchema.parse(input);
    const now = new Date();
    const sessionId = this.generateSessionId();

    // Create initial tasks if provided
    const tasks: SessionTask[] = (validated.tasks ?? []).map(t =>
      SessionTaskSchema.parse({
        id: randomUUID(),
        description: t.description,
        agentId: t.agentId,
        status: 'pending',
        createdAt: now,
      })
    );

    const session = SessionSchema.parse({
      id: sessionId,
      name: validated.name || DEFAULT_SESSION_NAME,
      description: validated.description,
      state: 'active',
      agents: validated.agents,
      tasks,
      createdAt: now,
      updatedAt: now,
      goal: validated.goal,
      tags: validated.tags ?? [],
      metadata: validated.metadata,
    });

    this.sessions.set(session.id, session);
    this.evictOldSessions();

    if (this.autoPersist) {
      await this.persistSession(session);
    }

    safeInvokeEvent('onSessionCreated', this.events.onSessionCreated, session);
    return session;
  }

  /**
   * Get session by ID
   */
  async get(sessionId: string): Promise<Session | null> {
    this.ensureInitialized();
    // Check memory first
    let session: Session | null | undefined = this.sessions.get(sessionId);

    if (!session) {
      // Try to load from disk
      session = await this.loadSession(sessionId);
      if (session) {
        this.sessions.set(session.id, session);
        this.evictOldSessions();
      }
    }

    return session ?? null;
  }

  /**
   * Get session (throws if not found)
   */
  async getOrThrow(sessionId: string): Promise<Session> {
    const session = await this.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }

  /**
   * List sessions with optional filtering
   */
  async list(filter?: SessionFilter): Promise<SessionSummary[]> {
    this.ensureInitialized();
    // Ensure all persisted sessions are loaded for listing
    await this.loadAllSessions();

    let sessions = Array.from(this.sessions.values());

    // Apply filters
    if (filter) {
      if (filter.state) {
        sessions = sessions.filter(s => s.state === filter.state);
      }
      if (filter.agent) {
        sessions = sessions.filter(s => s.agents.includes(filter.agent!));
      }
      if (filter.tags && filter.tags.length > 0) {
        sessions = sessions.filter(s =>
          filter.tags!.some(tag => s.tags.includes(tag))
        );
      }
      if (filter.createdAfter) {
        sessions = sessions.filter(s => s.createdAt >= filter.createdAfter!);
      }
      if (filter.createdBefore) {
        sessions = sessions.filter(s => s.createdAt <= filter.createdBefore!);
      }
    }

    // Sort by most recent first
    sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return sessions.map(createSessionSummary);
  }

  /**
   * Update session state
   */
  async updateState(sessionId: string, state: SessionState): Promise<Session> {
    return this.withSessionLock(sessionId, async () => {
      const session = await this.getOrThrow(sessionId);

      // Validate state transition
      if (!isValidTransition(session.state, state)) {
        throw new Error(
          `Invalid state transition: cannot transition from '${session.state}' to '${state}'`
        );
      }

      session.state = state;
      session.updatedAt = new Date();

      if (state === 'completed' || state === 'failed' || state === 'cancelled') {
        session.completedAt = new Date();
        const rawDuration = session.completedAt.getTime() - session.createdAt.getTime();
        // Ensure duration is never negative (can happen with system clock adjustments)
        session.duration = Math.max(0, rawDuration);
      }

      if (this.autoPersist) {
        await this.persistSession(session);
      }

      safeInvokeEvent('onSessionUpdated', this.events.onSessionUpdated, session);

      if (state === 'completed') {
        safeInvokeEvent('onSessionCompleted', this.events.onSessionCompleted, session);
      }

      return session;
    });
  }

  /**
   * Complete a session
   */
  async complete(sessionId: string): Promise<Session> {
    return this.updateState(sessionId, 'completed');
  }

  /**
   * Pause a session
   */
  async pause(sessionId: string): Promise<Session> {
    return this.updateState(sessionId, 'paused');
  }

  /**
   * Resume a paused session
   */
  async resume(sessionId: string): Promise<Session> {
    // Use session lock to prevent race condition between state check and update
    return this.withSessionLock(sessionId, async () => {
      const session = await this.getOrThrow(sessionId);

      if (session.state !== 'paused') {
        throw new Error(`Cannot resume session in state: ${session.state}`);
      }

      // Validate transition (should always pass since we checked state is 'paused')
      if (!isValidTransition(session.state, 'active')) {
        throw new Error(
          `Invalid state transition: cannot transition from '${session.state}' to 'active'`
        );
      }

      session.state = 'active';
      session.updatedAt = new Date();

      if (this.autoPersist) {
        await this.persistSession(session);
      }

      safeInvokeEvent('onSessionUpdated', this.events.onSessionUpdated, session);
      return session;
    });
  }

  /**
   * Cancel a session
   */
  async cancel(sessionId: string): Promise<Session> {
    return this.updateState(sessionId, 'cancelled');
  }

  /**
   * Fail a session with an optional error message
   */
  async fail(sessionId: string, error?: string): Promise<Session> {
    return this.withSessionLock(sessionId, async () => {
      const session = await this.getOrThrow(sessionId);

      // Validate state transition (same rules as updateState)
      if (!isValidTransition(session.state, 'failed')) {
        throw new Error(
          `Invalid state transition: cannot transition from '${session.state}' to 'failed'`
        );
      }

      // Store error in metadata before state transition
      if (error) {
        session.metadata = {
          ...session.metadata,
          failureReason: error,
        };
      }

      session.state = 'failed';
      session.updatedAt = new Date();
      session.completedAt = new Date();
      const rawDuration = session.completedAt.getTime() - session.createdAt.getTime();
      session.duration = Math.max(0, rawDuration);

      if (this.autoPersist) {
        await this.persistSession(session);
      }

      safeInvokeEvent('onSessionUpdated', this.events.onSessionUpdated, session);
      return session;
    });
  }

  /**
   * Delete a session
   */
  async delete(sessionId: string): Promise<boolean> {
    this.sessions.delete(sessionId);

    try {
      const filePath = this.getSessionFilePath(sessionId);
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // =============================================================================
  // Task Operations
  // =============================================================================

  /**
   * Add a task to a session
   */
  async addTask(input: AddTaskInput): Promise<SessionTask> {
    const validated = AddTaskInputSchema.parse(input);

    return this.withSessionLock(validated.sessionId, async () => {
      const session = await this.getOrThrow(validated.sessionId);

      const task = SessionTaskSchema.parse({
        id: randomUUID(),
        description: validated.description,
        agentId: validated.agentId,
        status: 'pending',
        createdAt: new Date(),
        parentTaskId: validated.parentTaskId,
        metadata: validated.metadata,
      });

      session.tasks.push(task);
      session.updatedAt = new Date();

      // Add agent if not already in session
      if (!session.agents.includes(validated.agentId)) {
        session.agents.push(validated.agentId);
      }

      if (this.autoPersist) {
        await this.persistSession(session);
      }

      safeInvokeEvent('onTaskAdded', this.events.onTaskAdded, session, task);
      return task;
    });
  }

  /**
   * Update task status and result
   */
  async updateTask(input: UpdateTaskInput): Promise<SessionTask> {
    const validated = UpdateTaskInputSchema.parse(input);

    return this.withSessionLock(validated.sessionId, async () => {
      const session = await this.getOrThrow(validated.sessionId);

      const task = session.tasks.find(t => t.id === validated.taskId);
      if (!task) {
        throw new Error(`Task not found: ${validated.taskId}`);
      }

      const previousStatus = task.status;
      task.status = validated.status;

      if (validated.result !== undefined) {
        task.result = validated.result;
      }
      if (validated.error !== undefined) {
        task.error = validated.error;
      }

      // Track timing
      if (validated.status === 'running' && previousStatus === 'pending') {
        task.startedAt = new Date();
      }
      if (validated.status === 'completed' || validated.status === 'failed') {
        task.completedAt = new Date();
        // Use startedAt if available, otherwise fall back to task creation time
        const startTime = task.startedAt?.getTime() ?? new Date(task.createdAt ?? Date.now()).getTime();
        const rawDuration = task.completedAt.getTime() - startTime;
        // Ensure duration is never negative (can happen with system clock adjustments)
        task.duration = Math.max(0, rawDuration);
      }

      session.updatedAt = new Date();

      if (this.autoPersist) {
        await this.persistSession(session);
      }

      safeInvokeEvent('onTaskUpdated', this.events.onTaskUpdated, session, task);
      return task;
    });
  }

  /**
   * Start a task
   */
  async startTask(sessionId: string, taskId: string): Promise<SessionTask> {
    return this.updateTask({
      sessionId: parseSessionId(sessionId),
      taskId,
      status: 'running',
    });
  }

  /**
   * Complete a task
   */
  async completeTask(
    sessionId: string,
    taskId: string,
    result: string
  ): Promise<SessionTask> {
    return this.updateTask({
      sessionId: parseSessionId(sessionId),
      taskId,
      status: 'completed',
      result,
    });
  }

  /**
   * Fail a task
   */
  async failTask(
    sessionId: string,
    taskId: string,
    error: string
  ): Promise<SessionTask> {
    return this.updateTask({
      sessionId: parseSessionId(sessionId),
      taskId,
      status: 'failed',
      error,
    });
  }

  /**
   * Get pending tasks for a session
   */
  async getPendingTasks(sessionId: string): Promise<SessionTask[]> {
    const session = await this.getOrThrow(sessionId);
    return session.tasks.filter(t => t.status === 'pending');
  }

  /**
   * Get tasks by agent
   */
  async getTasksByAgent(sessionId: string, agentId: string): Promise<SessionTask[]> {
    const session = await this.getOrThrow(sessionId);
    return session.tasks.filter(t => t.agentId === agentId);
  }

  // =============================================================================
  // Event Management
  // =============================================================================

  /**
   * Set event handlers
   */
  setEvents(events: SessionManagerEvents): void {
    Object.assign(this.events, events);
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  /**
   * Execute an operation with a session lock to prevent race conditions.
   * Only one operation can modify a session at a time.
   */
  private async withSessionLock<T>(
    sessionId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    // Wait for any existing lock on this session
    const existingLock = this.sessionLocks.get(sessionId);
    if (existingLock) {
      await existingLock.catch(() => {}); // Ignore errors from previous operations
    }

    // Create a new lock for this operation
    let releaseLock: () => void;
    const lockPromise = new Promise<void>(resolve => {
      releaseLock = resolve;
    });
    this.sessionLocks.set(sessionId, lockPromise);

    try {
      return await operation();
    } finally {
      releaseLock!();
      // Clean up lock if it's still ours
      if (this.sessionLocks.get(sessionId) === lockPromise) {
        this.sessionLocks.delete(sessionId);
      }
    }
  }

  /**
   * Generate a unique session ID (UUID format)
   */
  private generateSessionId(): string {
    return randomUUID();
  }

  /**
   * Get file path for session storage
   */
  private getSessionFilePath(sessionId: string): string {
    return join(this.sessionsPath, `${sessionId}${SESSION_FILE_EXT}`);
  }

  /**
   * Persist session to disk
   */
  private async persistSession(session: Session): Promise<void> {
    const filePath = this.getSessionFilePath(session.id);
    const data = JSON.stringify(session, null, 2);
    await writeFile(filePath, data, 'utf-8');
  }

  /**
   * Persist all in-memory sessions
   */
  private async persistAll(): Promise<void> {
    const promises = Array.from(this.sessions.values()).map(s =>
      this.persistSession(s)
    );
    await Promise.all(promises);
  }

  /**
   * Load session from disk
   */
  private async loadSession(sessionId: string): Promise<Session | null> {
    const filePath = this.getSessionFilePath(sessionId);
    try {
      const data = await readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Parse dates
      parsed.createdAt = new Date(parsed.createdAt);
      parsed.updatedAt = new Date(parsed.updatedAt);
      if (parsed.completedAt) {
        parsed.completedAt = new Date(parsed.completedAt);
      }
      // Safely iterate tasks array (defend against corrupted JSON)
      if (Array.isArray(parsed.tasks)) {
        for (const task of parsed.tasks) {
          if (task.createdAt) task.createdAt = new Date(task.createdAt);
          if (task.startedAt) task.startedAt = new Date(task.startedAt);
          if (task.completedAt) task.completedAt = new Date(task.completedAt);
        }
      }

      return SessionSchema.parse(parsed);
    } catch (error) {
      // Log corruption/parse errors but not missing file errors
      const errno = error as NodeJS.ErrnoException;
      if (errno.code !== 'ENOENT') {
        console.warn(
          `[ax/session] Failed to load session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      return null;
    }
  }

  /**
   * Load recent sessions from disk
   */
  private async loadRecentSessions(): Promise<void> {
    try {
      const files = await readdir(this.sessionsPath);
      const sessionFiles = files
        .filter(f => f.endsWith(SESSION_FILE_EXT))
        .map(f => basename(f, SESSION_FILE_EXT));

      // Get file stats for sorting by modification time
      const fileStats = await Promise.all(
        sessionFiles.map(async id => {
          const filePath = this.getSessionFilePath(id);
          try {
            const stats = await stat(filePath);
            return { id, mtime: stats.mtime };
          } catch {
            return { id, mtime: new Date(0) };
          }
        })
      );

      // Sort by modification time (most recent first)
      fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Load most recent sessions
      const toLoad = fileStats.slice(0, this.maxInMemorySessions);

      for (const { id } of toLoad) {
        const session = await this.loadSession(id);
        if (session) {
          this.sessions.set(session.id, session);
        }
      }
    } catch {
      // Directory might not exist yet
    }
  }

  /**
   * Load all sessions from disk
   */
  private async loadAllSessions(): Promise<void> {
    try {
      const files = await readdir(this.sessionsPath);
      const sessionFiles = files
        .filter(f => f.endsWith(SESSION_FILE_EXT))
        .map(f => basename(f, SESSION_FILE_EXT));

      for (const id of sessionFiles) {
        if (!this.sessions.has(id)) {
          const session = await this.loadSession(id);
          if (session) {
            this.sessions.set(session.id, session);
          }
        }
      }
    } catch {
      // Directory might not exist
    }
  }

  /**
   * Evict oldest sessions from memory when limit exceeded
   */
  private evictOldSessions(): void {
    if (this.sessions.size <= this.maxInMemorySessions) return;

    const sessions = Array.from(this.sessions.entries())
      .sort((a, b) => b[1].updatedAt.getTime() - a[1].updatedAt.getTime());

    // Keep most recent, evict the rest
    const toEvict = sessions.slice(this.maxInMemorySessions);
    for (const [id] of toEvict) {
      this.sessions.delete(id);
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new session manager instance
 */
export function createSessionManager(options: SessionManagerOptions): SessionManager {
  return new SessionManager(options);
}
