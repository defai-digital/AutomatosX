/**
 * AutomatosX v8.0.0 - Conversation Context Manager
 *
 * Manages conversation state, messages, and context variables
 * Day 3: In-memory implementation
 * Day 4: Will add SQLite persistence
 */
import type { Database } from 'better-sqlite3';
import type { Message, ContextSnapshot } from './types.js';
/**
 * Conversation Context Manager
 *
 * Handles:
 * - Message history (in-memory for Day 3)
 * - Active agent tracking
 * - Active workflow tracking
 * - Context variables
 * - Snapshots for save/load
 */
export declare class ConversationContext {
    private db;
    private conversationId;
    private userId;
    private messages;
    private activeAgent?;
    private activeWorkflow?;
    private variables;
    private createdAt;
    private updatedAt;
    constructor(db: Database, userId: string, conversationId?: string);
    /**
     * Get conversation ID
     */
    getConversationId(): string;
    /**
     * Get user ID
     */
    getUserId(): string;
    /**
     * Add message to conversation
     */
    addMessage(role: 'user' | 'assistant' | 'system', content: string, metadata?: Record<string, unknown>): Message;
    /**
     * Get all messages in conversation
     */
    getMessages(): Message[];
    /**
     * Get recent messages (last N)
     */
    getRecentMessages(limit?: number): Message[];
    /**
     * Get message count
     */
    getMessageCount(): number;
    /**
     * Set active agent
     */
    setActiveAgent(agentName: string | undefined): void;
    /**
     * Get active agent
     */
    getActiveAgent(): string | undefined;
    /**
     * Set active workflow
     */
    setActiveWorkflow(workflowPath: string | undefined): void;
    /**
     * Get active workflow
     */
    getActiveWorkflow(): string | undefined;
    /**
     * Set context variable
     */
    setVariable(key: string, value: unknown): void;
    /**
     * Get context variable
     */
    getVariable(key: string): unknown;
    /**
     * Get all variables
     */
    getVariables(): Record<string, unknown>;
    /**
     * Delete context variable
     */
    deleteVariable(key: string): boolean;
    /**
     * Clear all variables
     */
    clearVariables(): void;
    /**
     * Get context snapshot for save/load
     */
    getSnapshot(): ContextSnapshot;
    /**
     * Restore from snapshot
     */
    restoreFromSnapshot(snapshot: ContextSnapshot): void;
    /**
     * Clear conversation (reset to initial state)
     */
    clear(): void;
    /**
     * Get conversation summary
     */
    getSummary(): {
        conversationId: string;
        messageCount: number;
        activeAgent?: string;
        activeWorkflow?: string;
        variableCount: number;
        createdAt: Date;
        updatedAt: Date;
    };
    /**
     * Save context to SQLite
     * Persists conversation metadata and all messages to database
     */
    saveToDB(): Promise<void>;
    /**
     * Load context from SQLite
     * Reconstructs ConversationContext from database records
     */
    static loadFromDB(db: Database, conversationId: string): Promise<ConversationContext | null>;
    /**
     * Get conversation metadata
     */
    getMetadata(): {
        conversationId: string;
        userId: string;
        createdAt: Date;
        updatedAt: Date;
    };
}
//# sourceMappingURL=ConversationContext.d.ts.map