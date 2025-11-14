/**
 * ConversationManager - Manages active conversation sessions
 * Tracks in-memory conversation state and provides lifecycle management
 */
import type { MemoryService } from './MemoryService.js';
import type { Conversation, ConversationWithMessages, CreateConversation, CreateMessage, Message } from '../types/schemas/memory.schema.js';
export interface ActiveConversation {
    conversation: Conversation;
    messages: Message[];
    lastActivityAt: number;
}
export interface ConversationManagerOptions {
    maxActiveConversations?: number;
    inactivityTimeoutMs?: number;
}
export declare class ConversationManager {
    private activeConversations;
    private memoryService;
    private maxActiveConversations;
    private inactivityTimeoutMs;
    private cleanupInterval;
    constructor(memoryService: MemoryService, options?: ConversationManagerOptions);
    /**
     * Start a new conversation
     */
    startConversation(data: CreateConversation): Promise<Conversation>;
    /**
     * End a conversation (remove from active tracking)
     */
    endConversation(conversationId: string): Promise<void>;
    /**
     * Resume an existing conversation
     */
    resumeConversation(conversationId: string): Promise<ConversationWithMessages | null>;
    /**
     * Archive a conversation
     */
    archiveConversation(conversationId: string): Promise<boolean>;
    /**
     * Delete a conversation
     */
    deleteConversation(conversationId: string): Promise<boolean>;
    /**
     * Add message to active conversation
     */
    addMessage(conversationId: string, data: CreateMessage): Promise<Message>;
    /**
     * Get messages from active conversation
     */
    getMessages(conversationId: string, limit?: number): Promise<Message[]>;
    /**
     * Get active conversation
     */
    getActiveConversation(conversationId: string): ActiveConversation | null;
    /**
     * Get all active conversations
     */
    getActiveConversations(): ActiveConversation[];
    /**
     * Check if conversation is active
     */
    isConversationActive(conversationId: string): boolean;
    /**
     * Get active conversation count
     */
    getActiveConversationCount(): number;
    /**
     * Get conversation by agent
     */
    getActiveConversationsByAgent(agentId: string): ActiveConversation[];
    /**
     * Get conversation by user
     */
    getActiveConversationsByUser(userId: string): ActiveConversation[];
    /**
     * Evict oldest conversation based on last activity
     */
    private evictOldestConversation;
    /**
     * Clean up inactive conversations
     */
    private cleanupInactiveConversations;
    /**
     * Start cleanup timer
     */
    private startCleanupTimer;
    /**
     * Stop cleanup timer
     */
    stopCleanupTimer(): void;
    /**
     * Clear all active conversations
     */
    clearActiveConversations(): void;
    /**
     * Get statistics
     */
    getStatistics(): {
        activeCount: number;
        totalMessages: number;
        averageMessagesPerConversation: number;
        oldestActivityTime: number | null;
        newestActivityTime: number | null;
    };
    /**
     * Cleanup and destroy
     */
    destroy(): void;
}
//# sourceMappingURL=ConversationManager.d.ts.map