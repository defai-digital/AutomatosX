/**
 * ConversationDAO - Data Access Object for conversations table
 * Provides CRUD operations with Zod validation
 */
import type { Database } from 'better-sqlite3';
import { type Conversation, type CreateConversation, type UpdateConversation, type ConversationWithMessages, type ConversationListOptions, type ConversationListResult } from '../../types/schemas/memory.schema.js';
export declare class ConversationDAO {
    private db;
    constructor(db: Database);
    /**
     * Create a new conversation
     */
    create(data: CreateConversation): Conversation;
    /**
     * Get conversation by ID
     */
    getById(id: string): Conversation | null;
    /**
     * Update conversation
     */
    update(data: UpdateConversation): Conversation;
    /**
     * Delete conversation (soft delete by marking as deleted)
     */
    delete(id: string): boolean;
    /**
     * Permanently delete conversation and all messages
     */
    permanentlyDelete(id: string): boolean;
    /**
     * Archive conversation
     */
    archive(id: string): boolean;
    /**
     * Restore conversation from archived or deleted state
     */
    restore(id: string): boolean;
    /**
     * Increment message count
     */
    incrementMessageCount(id: string, tokens?: number): boolean;
    /**
     * List conversations with filters
     */
    list(options: ConversationListOptions): ConversationListResult;
    /**
     * Get conversation with all messages
     */
    getWithMessages(id: string): ConversationWithMessages | null;
    /**
     * Search conversations by title
     */
    searchByTitle(query: string, limit?: number): Conversation[];
    /**
     * Get conversations by agent
     */
    getByAgent(agentId: string, limit?: number): Conversation[];
    /**
     * Get conversations by user
     */
    getByUser(userId: string, limit?: number): Conversation[];
    /**
     * Get conversation count by state
     */
    getCountByState(state: string): number;
    /**
     * Convert database row to Conversation object
     */
    private rowToConversation;
}
//# sourceMappingURL=ConversationDAO.d.ts.map