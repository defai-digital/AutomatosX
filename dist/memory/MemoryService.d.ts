/**
 * MemoryService - High-level service for memory management
 * Orchestrates ConversationDAO and MessageDAO operations
 */
import type { Database } from 'better-sqlite3';
import { type Conversation, type Message, type CreateConversation, type CreateMessage, type ConversationWithMessages, type MemorySearchOptions, type MemorySearchResult, type ConversationListOptions, type ConversationListResult, type MessageListOptions, type MessageListResult, type MemoryStats } from '../types/schemas/memory.schema.js';
export interface ConversationSearchOptions {
    query?: string;
    agentId?: string;
    userId?: string;
    state?: string;
    limit?: number;
    offset?: number;
    includeArchived?: boolean;
    includeDeleted?: boolean;
}
export declare class MemoryService {
    private conversationDAO;
    private messageDAO;
    private embeddingDAO;
    private embeddingService;
    constructor(db: Database);
    /**
     * Create a new conversation
     */
    createConversation(data: CreateConversation): Promise<Conversation>;
    /**
     * Get conversation by ID
     */
    getConversation(id: string): Promise<Conversation | null>;
    /**
     * Get conversation with all messages
     */
    getConversationWithMessages(id: string): Promise<ConversationWithMessages | null>;
    /**
     * Update conversation
     */
    updateConversation(id: string, updates: {
        title?: string;
        state?: string;
        metadata?: Record<string, string>;
    }): Promise<Conversation>;
    /**
     * Archive conversation
     */
    archiveConversation(id: string): Promise<boolean>;
    /**
     * Restore archived conversation
     */
    restoreConversation(id: string): Promise<boolean>;
    /**
     * Delete conversation (soft delete)
     */
    deleteConversation(id: string): Promise<boolean>;
    /**
     * Permanently delete conversation and all messages
     */
    permanentlyDeleteConversation(id: string): Promise<boolean>;
    /**
     * List conversations with filters
     */
    listConversations(options: ConversationListOptions): Promise<ConversationListResult>;
    /**
     * Get recent conversations
     */
    getRecentConversations(agentId?: string, limit?: number): Promise<Conversation[]>;
    /**
     * Search conversations by title
     */
    searchConversationsByTitle(query: string, limit?: number): Promise<Conversation[]>;
    /**
     * Get conversations by agent
     */
    getConversationsByAgent(agentId: string, limit?: number): Promise<Conversation[]>;
    /**
     * Get conversations by user
     */
    getConversationsByUser(userId: string, limit?: number): Promise<Conversation[]>;
    /**
     * Add message to conversation
     * Automatically generates embedding for semantic search
     */
    addMessage(data: CreateMessage): Promise<Message>;
    /**
     * Get message by ID
     */
    getMessage(id: string): Promise<Message | null>;
    /**
     * Update message content
     */
    updateMessage(id: string, content: string, tokens?: number): Promise<Message>;
    /**
     * Delete message
     */
    deleteMessage(id: string): Promise<boolean>;
    /**
     * List messages for conversation
     */
    listMessages(options: MessageListOptions): Promise<MessageListResult>;
    /**
     * Get messages by conversation
     */
    getMessagesByConversation(conversationId: string, limit?: number): Promise<Message[]>;
    /**
     * Get recent messages across all conversations
     */
    getRecentMessages(limit?: number): Promise<Message[]>;
    /**
     * Search messages using FTS5 full-text search
     */
    searchMessages(options: MemorySearchOptions): Promise<MemorySearchResult>;
    /**
     * Simple search by query string
     */
    searchMessagesByQuery(query: string, conversationId?: string, limit?: number): Promise<Message[]>;
    /**
     * Search messages using vector similarity (semantic search)
     * Natural language queries, finds semantically similar messages
     */
    searchMessagesSemantic(query: string, options?: {
        conversationId?: string;
        agentId?: string;
        userId?: string;
        limit?: number;
        minScore?: number;
    }): Promise<{
        messages: Array<Message & {
            score: number;
            distance: number;
        }>;
        total: number;
        hasMore: boolean;
        searchMode: 'semantic';
    }>;
    /**
     * Search messages using hybrid approach (FTS5 + vector similarity)
     * Combines keyword matching with semantic understanding
     */
    searchMessagesHybrid(query: string, options?: {
        conversationId?: string;
        agentId?: string;
        userId?: string;
        limit?: number;
        ftsWeight?: number;
        vectorWeight?: number;
        minScore?: number;
    }): Promise<{
        messages: Array<Message & {
            score: number;
            ftsScore?: number;
            vectorScore?: number;
        }>;
        total: number;
        hasMore: boolean;
        searchMode: 'hybrid';
    }>;
    /**
     * Combine FTS5 and vector search results using weighted scoring
     */
    private _combineSearchResults;
    /**
     * Get message count by conversation
     */
    getMessageCount(conversationId: string): Promise<number>;
    /**
     * Get total tokens by conversation
     */
    getTotalTokens(conversationId: string): Promise<number>;
    /**
     * Get conversation count by state
     */
    getConversationCountByState(state: string): Promise<number>;
    /**
     * Get memory statistics
     */
    getMemoryStats(): Promise<MemoryStats>;
    /**
     * Delete all messages in a conversation
     */
    deleteConversationMessages(conversationId: string): Promise<number>;
    /**
     * Export conversation with messages
     */
    exportConversation(conversationId: string): Promise<ConversationWithMessages | null>;
    /**
     * Export all conversations for an agent
     */
    exportAgentConversations(agentId: string, includeMessages?: boolean): Promise<Array<Conversation | ConversationWithMessages>>;
    /**
     * Generate embedding for a message (async helper)
     * Private method, fire-and-forget for addMessage()
     */
    private _generateEmbeddingAsync;
    /**
     * Index existing messages (backfill embeddings)
     * Useful for migrating existing conversations to semantic search
     */
    indexExistingMessages(conversationId?: string, options?: {
        batchSize?: number;
        force?: boolean;
        onProgress?: (indexed: number, total: number) => void;
    }): Promise<{
        indexed: number;
        skipped: number;
        failed: number;
        duration: number;
    }>;
    /**
     * Get embedding statistics
     * Useful for monitoring embedding coverage
     */
    getEmbeddingStats(): Promise<{
        totalEmbeddings: number;
        totalMessages: number;
        coveragePercent: number;
        currentModelVersion: string | null;
    }>;
}
//# sourceMappingURL=MemoryService.d.ts.map