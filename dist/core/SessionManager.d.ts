/**
 * SessionManager - Manage multi-agent sessions
 * Phase 3: Advanced Features - Week 3
 */
/**
 * Session history entry
 */
export interface SessionHistoryEntry {
    timestamp: Date;
    agent: string;
    task: string;
    result: string;
    duration: number;
    provider?: string;
    model?: string;
}
/**
 * Session configuration
 */
export interface Session {
    id: string;
    name: string;
    agents: string[];
    createdAt: Date;
    updatedAt: Date;
    status: 'active' | 'closed';
    history: SessionHistoryEntry[];
    metadata?: Record<string, any>;
}
/**
 * Manages multi-agent sessions with persistence
 */
export declare class SessionManager {
    private projectRoot;
    private sessionsDir;
    private sessionLocks;
    constructor(projectRoot?: string);
    /**
     * Acquire lock for a session (prevents concurrent modifications)
     */
    private acquireLock;
    /**
     * Create a new session
     */
    createSession(name: string, agents: string[]): Promise<Session>;
    /**
     * Load a session by ID
     */
    loadSession(id: string): Promise<Session | null>;
    /**
     * List all sessions
     */
    listSessions(): Promise<Session[]>;
    /**
     * Add an agent to an existing session
     */
    joinSession(id: string, agent: string): Promise<void>;
    /**
     * Add execution history to session
     */
    addToHistory(id: string, entry: Omit<SessionHistoryEntry, 'timestamp'>): Promise<void>;
    /**
     * Close a session
     */
    closeSession(id: string): Promise<void>;
    /**
     * Delete a session
     */
    deleteSession(id: string): Promise<void>;
    /**
     * Save session to disk
     */
    private saveSession;
}
//# sourceMappingURL=SessionManager.d.ts.map