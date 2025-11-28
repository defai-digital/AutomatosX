import { CreateSessionInput, Session, SessionState, SessionSummary, AddTaskInput, SessionTask, UpdateTaskInput } from '@ax/schemas';

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

interface SessionManagerOptions {
    /** Base storage path (.automatosx directory) */
    storagePath: string;
    /** Maximum sessions to keep in memory */
    maxInMemorySessions?: number;
    /** Auto-persist sessions to disk */
    autoPersist?: boolean;
}
interface SessionFilter {
    state?: SessionState;
    agent?: string;
    tags?: string[];
    createdAfter?: Date;
    createdBefore?: Date;
}
interface SessionManagerEvents {
    onSessionCreated?: (session: Session) => void;
    onSessionUpdated?: (session: Session) => void;
    onSessionCompleted?: (session: Session) => void;
    onTaskAdded?: (session: Session, task: SessionTask) => void;
    onTaskUpdated?: (session: Session, task: SessionTask) => void;
}
declare class SessionManager {
    private readonly storagePath;
    private readonly sessionsPath;
    private readonly maxInMemorySessions;
    private readonly autoPersist;
    private readonly sessions;
    private readonly events;
    private initialized;
    constructor(options: SessionManagerOptions);
    /**
     * Initialize session manager and load existing sessions
     */
    initialize(): Promise<void>;
    /**
     * Cleanup and persist all sessions
     */
    cleanup(): Promise<void>;
    /**
     * Create a new session
     */
    create(input: CreateSessionInput): Promise<Session>;
    /**
     * Get session by ID
     */
    get(sessionId: string): Promise<Session | null>;
    /**
     * Get session (throws if not found)
     */
    getOrThrow(sessionId: string): Promise<Session>;
    /**
     * List sessions with optional filtering
     */
    list(filter?: SessionFilter): Promise<SessionSummary[]>;
    /**
     * Update session state
     */
    updateState(sessionId: string, state: SessionState): Promise<Session>;
    /**
     * Complete a session
     */
    complete(sessionId: string): Promise<Session>;
    /**
     * Pause a session
     */
    pause(sessionId: string): Promise<Session>;
    /**
     * Resume a paused session
     */
    resume(sessionId: string): Promise<Session>;
    /**
     * Cancel a session
     */
    cancel(sessionId: string): Promise<Session>;
    /**
     * Fail a session
     */
    fail(sessionId: string, error?: string): Promise<Session>;
    /**
     * Delete a session
     */
    delete(sessionId: string): Promise<boolean>;
    /**
     * Add a task to a session
     */
    addTask(input: AddTaskInput): Promise<SessionTask>;
    /**
     * Update task status and result
     */
    updateTask(input: UpdateTaskInput): Promise<SessionTask>;
    /**
     * Start a task
     */
    startTask(sessionId: string, taskId: string): Promise<SessionTask>;
    /**
     * Complete a task
     */
    completeTask(sessionId: string, taskId: string, result: string): Promise<SessionTask>;
    /**
     * Fail a task
     */
    failTask(sessionId: string, taskId: string, error: string): Promise<SessionTask>;
    /**
     * Get pending tasks for a session
     */
    getPendingTasks(sessionId: string): Promise<SessionTask[]>;
    /**
     * Get tasks by agent
     */
    getTasksByAgent(sessionId: string, agentId: string): Promise<SessionTask[]>;
    /**
     * Set event handlers
     */
    setEvents(events: SessionManagerEvents): void;
    /**
     * Generate a unique session ID (UUID format)
     */
    private generateSessionId;
    /**
     * Get file path for session storage
     */
    private getSessionFilePath;
    /**
     * Persist session to disk
     */
    private persistSession;
    /**
     * Persist all in-memory sessions
     */
    private persistAll;
    /**
     * Load session from disk
     */
    private loadSession;
    /**
     * Load recent sessions from disk
     */
    private loadRecentSessions;
    /**
     * Load all sessions from disk
     */
    private loadAllSessions;
    /**
     * Evict oldest sessions from memory when limit exceeded
     */
    private evictOldSessions;
}
/**
 * Create a new session manager instance
 */
declare function createSessionManager(options: SessionManagerOptions): SessionManager;

export { type SessionFilter, SessionManager, type SessionManagerEvents, type SessionManagerOptions, createSessionManager };
