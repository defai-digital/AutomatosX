/**
 * ConversationManager - Manages active conversation sessions
 * Tracks in-memory conversation state and provides lifecycle management
 */

import type { MemoryService } from './MemoryService.js';
import type {
  Conversation,
  ConversationWithMessages,
  CreateConversation,
  CreateMessage,
  Message,
} from '../types/schemas/memory.schema.js';

export interface ActiveConversation {
  conversation: Conversation;
  messages: Message[];
  lastActivityAt: number;
}

export interface ConversationManagerOptions {
  maxActiveConversations?: number;
  inactivityTimeoutMs?: number;
}

export class ConversationManager {
  private activeConversations: Map<string, ActiveConversation> = new Map();
  private memoryService: MemoryService;
  private maxActiveConversations: number;
  private inactivityTimeoutMs: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    memoryService: MemoryService,
    options: ConversationManagerOptions = {}
  ) {
    this.memoryService = memoryService;
    this.maxActiveConversations = options.maxActiveConversations || 10;
    this.inactivityTimeoutMs = options.inactivityTimeoutMs || 30 * 60 * 1000; // 30 minutes

    // Start cleanup timer
    this.startCleanupTimer();
  }

  // ============================================================================
  // Conversation Lifecycle
  // ============================================================================

  /**
   * Start a new conversation
   */
  async startConversation(data: CreateConversation): Promise<Conversation> {
    // Check if we need to evict old conversations
    if (this.activeConversations.size >= this.maxActiveConversations) {
      await this.evictOldestConversation();
    }

    // Create conversation in database
    const conversation = await this.memoryService.createConversation(data);

    // Add to active conversations
    this.activeConversations.set(conversation.id, {
      conversation,
      messages: [],
      lastActivityAt: Date.now(),
    });

    return conversation;
  }

  /**
   * End a conversation (remove from active tracking)
   */
  async endConversation(conversationId: string): Promise<void> {
    this.activeConversations.delete(conversationId);
  }

  /**
   * Resume an existing conversation
   */
  async resumeConversation(conversationId: string): Promise<ConversationWithMessages | null> {
    // Check if already active
    if (this.activeConversations.has(conversationId)) {
      const active = this.activeConversations.get(conversationId)!;
      active.lastActivityAt = Date.now();
      return {
        ...active.conversation,
        messages: active.messages,
      };
    }

    // Load from database
    const conversation = await this.memoryService.getConversationWithMessages(conversationId);
    if (!conversation) {
      return null;
    }

    // Check if we need to evict
    if (this.activeConversations.size >= this.maxActiveConversations) {
      await this.evictOldestConversation();
    }

    // Add to active conversations
    this.activeConversations.set(conversationId, {
      conversation,
      messages: conversation.messages || [],
      lastActivityAt: Date.now(),
    });

    return conversation;
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(conversationId: string): Promise<boolean> {
    const success = await this.memoryService.archiveConversation(conversationId);
    if (success) {
      this.activeConversations.delete(conversationId);
    }
    return success;
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string): Promise<boolean> {
    const success = await this.memoryService.deleteConversation(conversationId);
    if (success) {
      this.activeConversations.delete(conversationId);
    }
    return success;
  }

  // ============================================================================
  // Message Operations
  // ============================================================================

  /**
   * Add message to active conversation
   */
  async addMessage(conversationId: string, data: CreateMessage): Promise<Message> {
    // Ensure conversation is active
    if (!this.activeConversations.has(conversationId)) {
      await this.resumeConversation(conversationId);
    }

    // Add message to database
    const message = await this.memoryService.addMessage(data);

    // Update active conversation
    const active = this.activeConversations.get(conversationId);
    if (active) {
      active.messages.push(message);
      active.lastActivityAt = Date.now();
      active.conversation.updatedAt = Date.now();
    }

    return message;
  }

  /**
   * Get messages from active conversation
   */
  async getMessages(conversationId: string, limit?: number): Promise<Message[]> {
    const active = this.activeConversations.get(conversationId);

    if (active) {
      // Return from cache
      active.lastActivityAt = Date.now();
      return limit ? active.messages.slice(-limit) : active.messages;
    }

    // Load from database
    return this.memoryService.getMessagesByConversation(conversationId, limit || 100);
  }

  // ============================================================================
  // Query Operations
  // ============================================================================

  /**
   * Get active conversation
   */
  getActiveConversation(conversationId: string): ActiveConversation | null {
    const active = this.activeConversations.get(conversationId);
    if (active) {
      active.lastActivityAt = Date.now();
      return active;
    }
    return null;
  }

  /**
   * Get all active conversations
   */
  getActiveConversations(): ActiveConversation[] {
    return Array.from(this.activeConversations.values());
  }

  /**
   * Check if conversation is active
   */
  isConversationActive(conversationId: string): boolean {
    return this.activeConversations.has(conversationId);
  }

  /**
   * Get active conversation count
   */
  getActiveConversationCount(): number {
    return this.activeConversations.size;
  }

  /**
   * Get conversation by agent
   */
  getActiveConversationsByAgent(agentId: string): ActiveConversation[] {
    return Array.from(this.activeConversations.values()).filter(
      (active) => active.conversation.agentId === agentId
    );
  }

  /**
   * Get conversation by user
   */
  getActiveConversationsByUser(userId: string): ActiveConversation[] {
    return Array.from(this.activeConversations.values()).filter(
      (active) => active.conversation.userId === userId
    );
  }

  // ============================================================================
  // Maintenance Operations
  // ============================================================================

  /**
   * Evict oldest conversation based on last activity
   */
  private async evictOldestConversation(): Promise<void> {
    let oldestId: string | null = null;
    let oldestTime = Date.now();

    for (const [id, active] of this.activeConversations) {
      if (active.lastActivityAt < oldestTime) {
        oldestTime = active.lastActivityAt;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.activeConversations.delete(oldestId);
    }
  }

  /**
   * Clean up inactive conversations
   */
  private cleanupInactiveConversations(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [id, active] of this.activeConversations) {
      if (now - active.lastActivityAt > this.inactivityTimeoutMs) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.activeConversations.delete(id);
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveConversations();
    }, 5 * 60 * 1000);
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clear all active conversations
   */
  clearActiveConversations(): void {
    this.activeConversations.clear();
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    activeCount: number;
    totalMessages: number;
    averageMessagesPerConversation: number;
    oldestActivityTime: number | null;
    newestActivityTime: number | null;
  } {
    const activeCount = this.activeConversations.size;
    let totalMessages = 0;
    let oldestActivityTime: number | null = null;
    let newestActivityTime: number | null = null;

    for (const active of this.activeConversations.values()) {
      totalMessages += active.messages.length;

      if (!oldestActivityTime || active.lastActivityAt < oldestActivityTime) {
        oldestActivityTime = active.lastActivityAt;
      }

      if (!newestActivityTime || active.lastActivityAt > newestActivityTime) {
        newestActivityTime = active.lastActivityAt;
      }
    }

    const averageMessagesPerConversation =
      activeCount > 0 ? totalMessages / activeCount : 0;

    return {
      activeCount,
      totalMessages,
      averageMessagesPerConversation,
      oldestActivityTime,
      newestActivityTime,
    };
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    this.stopCleanupTimer();
    this.clearActiveConversations();
  }
}
