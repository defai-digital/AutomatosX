/**
 * AutomatosX v8.0.0 - Conversation Context Manager
 *
 * Manages conversation state, messages, and context variables
 * Day 3: In-memory implementation
 * Day 4: Will add SQLite persistence
 */

import type { Database } from 'better-sqlite3';
import type { Message, ContextSnapshot } from './types.js';
import { randomUUID } from 'crypto';

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
export class ConversationContext {
  private conversationId: string;
  private userId: string;
  private messages: Message[] = [];
  private activeAgent?: string;
  private activeWorkflow?: string;
  private variables: Record<string, unknown> = {};
  private createdAt: Date;
  private updatedAt: Date;

  constructor(
    private db: Database,
    userId: string,
    conversationId?: string
  ) {
    this.userId = userId;
    this.conversationId = conversationId || randomUUID();
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Get conversation ID
   */
  getConversationId(): string {
    return this.conversationId;
  }

  /**
   * Get user ID
   */
  getUserId(): string {
    return this.userId;
  }

  /**
   * Add message to conversation
   */
  addMessage(role: 'user' | 'assistant' | 'system', content: string, metadata?: Record<string, unknown>): Message {
    const message: Message = {
      id: randomUUID(),
      conversationId: this.conversationId,
      role,
      content,
      timestamp: new Date(),
      metadata: metadata || {}
    };

    this.messages.push(message);
    this.updatedAt = new Date();

    return message;
  }

  /**
   * Get all messages in conversation
   */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * Get recent messages (last N)
   */
  getRecentMessages(limit: number = 10): Message[] {
    return this.messages.slice(-limit);
  }

  /**
   * Get message count
   */
  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * Set active agent
   */
  setActiveAgent(agentName: string | undefined): void {
    this.activeAgent = agentName;
    this.updatedAt = new Date();
  }

  /**
   * Get active agent
   */
  getActiveAgent(): string | undefined {
    return this.activeAgent;
  }

  /**
   * Set active workflow
   */
  setActiveWorkflow(workflowPath: string | undefined): void {
    this.activeWorkflow = workflowPath;
    this.updatedAt = new Date();
  }

  /**
   * Get active workflow
   */
  getActiveWorkflow(): string | undefined {
    return this.activeWorkflow;
  }

  /**
   * Set context variable
   */
  setVariable(key: string, value: unknown): void {
    this.variables[key] = value;
    this.updatedAt = new Date();
  }

  /**
   * Get context variable
   */
  getVariable(key: string): unknown {
    return this.variables[key];
  }

  /**
   * Get all variables
   */
  getVariables(): Record<string, unknown> {
    return { ...this.variables };
  }

  /**
   * Delete context variable
   */
  deleteVariable(key: string): boolean {
    if (key in this.variables) {
      delete this.variables[key];
      this.updatedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * Clear all variables
   */
  clearVariables(): void {
    this.variables = {};
    this.updatedAt = new Date();
  }

  /**
   * Get context snapshot for save/load
   */
  getSnapshot(): ContextSnapshot {
    return {
      conversationId: this.conversationId,
      userId: this.userId,
      messages: this.getMessages(),
      activeAgent: this.activeAgent,
      activeWorkflow: this.activeWorkflow,
      variables: this.getVariables(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Restore from snapshot
   */
  restoreFromSnapshot(snapshot: ContextSnapshot): void {
    this.conversationId = snapshot.conversationId;
    this.userId = snapshot.userId;
    this.messages = [...snapshot.messages];
    this.activeAgent = snapshot.activeAgent;
    this.activeWorkflow = snapshot.activeWorkflow;
    this.variables = { ...snapshot.variables };
    this.createdAt = new Date(snapshot.createdAt);
    this.updatedAt = new Date(snapshot.updatedAt);
  }

  /**
   * Clear conversation (reset to initial state)
   */
  clear(): void {
    this.messages = [];
    this.activeAgent = undefined;
    this.activeWorkflow = undefined;
    this.variables = {};
    this.conversationId = randomUUID();
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

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
  } {
    return {
      conversationId: this.conversationId,
      messageCount: this.messages.length,
      activeAgent: this.activeAgent,
      activeWorkflow: this.activeWorkflow,
      variableCount: Object.keys(this.variables).length,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // ============================================
  // SQLite Persistence (Day 4 Implementation)
  // ============================================

  /**
   * Save context to SQLite
   * Persists conversation metadata and all messages to database
   */
  async saveToDB(): Promise<void> {
    try {
      const { ConversationDAO } = await import('../../database/dao/ConversationDAO.js');
      const { MessageDAO } = await import('../../database/dao/MessageDAO.js');

      const conversationDAO = new ConversationDAO(this.db);
      const messageDAO = new MessageDAO(this.db);

      // Check if conversation exists
      const existing = conversationDAO.getById(this.conversationId);

      if (existing) {
        // Update existing conversation
        conversationDAO.update({
          id: this.conversationId,
          metadata: {
            activeAgent: this.activeAgent,
            activeWorkflow: this.activeWorkflow,
            variables: this.variables
          }
        });
      } else {
        // Create new conversation
        conversationDAO.create({
          agentId: this.activeAgent || 'system', // Required field, use system if no active agent
          userId: this.userId,
          title: `Conversation ${this.conversationId.slice(0, 8)}`,
          metadata: {
            activeAgent: this.activeAgent,
            activeWorkflow: this.activeWorkflow,
            variables: this.variables
          }
        });
      }

      // Save all messages
      for (const message of this.messages) {
        // Check if message exists
        const existingMessage = messageDAO.getById(message.id);

        if (!existingMessage) {
          // Create new message
          messageDAO.create({
            conversationId: this.conversationId,
            role: message.role,
            content: message.content,
            tokens: message.tokensUsed,
            metadata: message.metadata
          });
        }
        // Note: We don't update existing messages as they are immutable
      }

    } catch (error) {
      console.error('[ConversationContext] Failed to save to DB:', (error as Error).message);
      // Don't throw - allow REPL to continue even if save fails
    }
  }

  /**
   * Load context from SQLite
   * Reconstructs ConversationContext from database records
   */
  static async loadFromDB(db: Database, conversationId: string): Promise<ConversationContext | null> {
    try {
      const { ConversationDAO } = await import('../../database/dao/ConversationDAO.js');
      const { MessageDAO } = await import('../../database/dao/MessageDAO.js');

      const conversationDAO = new ConversationDAO(db);
      const messageDAO = new MessageDAO(db);

      // Load conversation record
      const conversation = conversationDAO.getById(conversationId);

      if (!conversation) {
        return null;
      }

      // Load all messages for this conversation
      const dbMessages = messageDAO.getByConversation(conversationId);

      // Create new ConversationContext
      const context = new ConversationContext(db, conversation.userId || 'unknown', conversationId);

      // Restore state from snapshot
      const messages: Message[] = dbMessages.map((m: any) => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        timestamp: new Date(m.createdAt * 1000), // Convert UNIX seconds to Date
        tokensUsed: m.tokens,
        metadata: m.metadata || {}
      }));

      const snapshot: ContextSnapshot = {
        conversationId: conversation.id,
        userId: conversation.userId || 'unknown',
        messages,
        activeAgent: conversation.metadata?.activeAgent,
        activeWorkflow: conversation.metadata?.activeWorkflow,
        variables: conversation.metadata?.variables || {},
        createdAt: new Date(conversation.createdAt * 1000), // Convert UNIX seconds to Date
        updatedAt: new Date(conversation.updatedAt * 1000)
      };

      context.restoreFromSnapshot(snapshot);

      return context;

    } catch (error) {
      console.error('[ConversationContext] Failed to load from DB:', (error as Error).message);
      return null;
    }
  }

  /**
   * Get conversation metadata
   */
  getMetadata(): {
    conversationId: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      conversationId: this.conversationId,
      userId: this.userId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
