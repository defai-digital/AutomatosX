/**
 * MessageDAO - Data Access Object for messages table
 * Provides CRUD operations with Zod validation and FTS5 search
 */
import type { Database } from 'better-sqlite3';
import { type Message, type CreateMessage, type MessageListOptions, type MessageListResult, type MemorySearchOptions, type MemorySearchResult } from '../../types/schemas/memory.schema.js';
export declare class MessageDAO {
    private db;
    constructor(db: Database);
    /**
     * Create a new message
     */
    create(data: CreateMessage): Message;
    /**
     * Get message by ID
     */
    getById(id: string): Message | null;
    /**
     * Update message content
     */
    update(id: string, content: string, tokens?: number): Message;
    /**
     * Delete message
     */
    delete(id: string): boolean;
    /**
     * List messages for a conversation
     */
    list(options: MessageListOptions): MessageListResult;
    /**
     * Search messages using FTS5
     */
    search(options: MemorySearchOptions): MemorySearchResult;
    /**
     * Get messages by conversation
     */
    getByConversation(conversationId: string, limit?: number): Message[];
    /**
     * Get recent messages
     */
    getRecent(limit?: number): Message[];
    /**
     * Get message count by conversation
     */
    getCountByConversation(conversationId: string): number;
    /**
     * Get total token count by conversation
     */
    getTotalTokensByConversation(conversationId: string): number;
    /**
     * Delete all messages for a conversation
     */
    deleteByConversation(conversationId: string): number;
    /**
     * Get global statistics for all messages
     * Used by MemoryService.getMemoryStats() to avoid pagination issues
     */
    getGlobalStats(): {
        totalMessages: number;
        totalTokens: number;
    };
    /**
     * Convert database row to Message object
     */
    private rowToMessage;
}
//# sourceMappingURL=MessageDAO.d.ts.map