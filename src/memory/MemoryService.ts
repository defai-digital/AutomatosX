/**
 * MemoryService - High-level service for memory management
 * Orchestrates ConversationDAO and MessageDAO operations
 */

import type { Database } from 'better-sqlite3';
import { ConversationDAO } from '../database/dao/ConversationDAO.js';
import { MessageDAO } from '../database/dao/MessageDAO.js';
import { MessageEmbeddingDAO, type EmbeddingSearchResult } from '../database/dao/MessageEmbeddingDAO.js';
import { getEmbeddingService } from '../services/EmbeddingService.js';
import {
  type Conversation,
  type Message,
  type MessageRole,
  type CreateConversation,
  type CreateMessage,
  type ConversationWithMessages,
  type MemorySearchOptions,
  type MemorySearchResult,
  type ConversationListOptions,
  type ConversationListResult,
  type MessageListOptions,
  type MessageListResult,
  type MemoryStats,
} from '../types/schemas/memory.schema.js';

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

export class MemoryService {
  private conversationDAO: ConversationDAO;
  private messageDAO: MessageDAO;
  private embeddingDAO: MessageEmbeddingDAO;
  private embeddingService = getEmbeddingService();

  constructor(db: Database) {
    this.conversationDAO = new ConversationDAO(db);
    this.messageDAO = new MessageDAO(db);
    this.embeddingDAO = new MessageEmbeddingDAO(db);
  }

  // ============================================================================
  // Conversation Operations
  // ============================================================================

  /**
   * Create a new conversation
   */
  async createConversation(data: CreateConversation): Promise<Conversation> {
    return this.conversationDAO.create(data);
  }

  /**
   * Get conversation by ID
   */
  async getConversation(id: string): Promise<Conversation | null> {
    return this.conversationDAO.getById(id);
  }

  /**
   * Get conversation with all messages
   */
  async getConversationWithMessages(id: string): Promise<ConversationWithMessages | null> {
    return this.conversationDAO.getWithMessages(id);
  }

  /**
   * Update conversation
   */
  async updateConversation(
    id: string,
    updates: { title?: string; state?: string; metadata?: Record<string, string> }
  ): Promise<Conversation> {
    return this.conversationDAO.update({ id, ...updates });
  }

  /**
   * Archive conversation
   */
  async archiveConversation(id: string): Promise<boolean> {
    return this.conversationDAO.archive(id);
  }

  /**
   * Restore archived conversation
   */
  async restoreConversation(id: string): Promise<boolean> {
    return this.conversationDAO.restore(id);
  }

  /**
   * Delete conversation (soft delete)
   */
  async deleteConversation(id: string): Promise<boolean> {
    return this.conversationDAO.delete(id);
  }

  /**
   * Permanently delete conversation and all messages
   */
  async permanentlyDeleteConversation(id: string): Promise<boolean> {
    return this.conversationDAO.permanentlyDelete(id);
  }

  /**
   * List conversations with filters
   */
  async listConversations(options: ConversationListOptions): Promise<ConversationListResult> {
    return this.conversationDAO.list(options);
  }

  /**
   * Get recent conversations
   */
  async getRecentConversations(
    agentId?: string,
    limit: number = 10
  ): Promise<Conversation[]> {
    if (agentId) {
      return this.conversationDAO.getByAgent(agentId, limit);
    }

    return this.conversationDAO.list({
      limit,
      offset: 0,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    }).conversations;
  }

  /**
   * Search conversations by title
   */
  async searchConversationsByTitle(query: string, limit: number = 10): Promise<Conversation[]> {
    return this.conversationDAO.searchByTitle(query, limit);
  }

  /**
   * Get conversations by agent
   */
  async getConversationsByAgent(agentId: string, limit: number = 10): Promise<Conversation[]> {
    return this.conversationDAO.getByAgent(agentId, limit);
  }

  /**
   * Get conversations by user
   */
  async getConversationsByUser(userId: string, limit: number = 10): Promise<Conversation[]> {
    return this.conversationDAO.getByUser(userId, limit);
  }

  // ============================================================================
  // Message Operations
  // ============================================================================

  /**
   * Add message to conversation
   * Automatically generates embedding for semantic search
   */
  async addMessage(data: CreateMessage): Promise<Message> {
    const message = this.messageDAO.create(data);

    // Update conversation token count
    this.conversationDAO.incrementMessageCount(data.conversationId, data.tokens || 0);

    // Generate and store embedding (async, non-blocking)
    this._generateEmbeddingAsync(message.id, message.content).catch((err) => {
      console.warn(`Failed to generate embedding for message ${message.id}:`, err);
      // Don't block message creation on embedding failure
    });

    return message;
  }

  /**
   * Get message by ID
   */
  async getMessage(id: string): Promise<Message | null> {
    return this.messageDAO.getById(id);
  }

  /**
   * Update message content
   */
  async updateMessage(id: string, content: string, tokens?: number): Promise<Message> {
    return this.messageDAO.update(id, content, tokens);
  }

  /**
   * Delete message
   */
  async deleteMessage(id: string): Promise<boolean> {
    return this.messageDAO.delete(id);
  }

  /**
   * List messages for conversation
   */
  async listMessages(options: MessageListOptions): Promise<MessageListResult> {
    return this.messageDAO.list(options);
  }

  /**
   * Get messages by conversation
   */
  async getMessagesByConversation(
    conversationId: string,
    limit: number = 100
  ): Promise<Message[]> {
    return this.messageDAO.getByConversation(conversationId, limit);
  }

  /**
   * Get recent messages across all conversations
   */
  async getRecentMessages(limit: number = 10): Promise<Message[]> {
    return this.messageDAO.getRecent(limit);
  }

  // ============================================================================
  // Search Operations
  // ============================================================================

  /**
   * Search messages using FTS5 full-text search
   */
  async searchMessages(options: MemorySearchOptions): Promise<MemorySearchResult> {
    return this.messageDAO.search(options);
  }

  /**
   * Simple search by query string
   */
  async searchMessagesByQuery(
    query: string,
    conversationId?: string,
    limit: number = 10
  ): Promise<Message[]> {
    const result = await this.messageDAO.search({
      query,
      conversationId,
      limit,
      offset: 0,
      sortBy: 'relevance',
      sortOrder: 'desc',
      includeArchived: false,
      includeDeleted: false,
      skipCount: false,
    });

    return result.messages;
  }

  /**
   * Search messages using vector similarity (semantic search)
   * Natural language queries, finds semantically similar messages
   */
  async searchMessagesSemantic(
    query: string,
    options: {
      conversationId?: string;
      agentId?: string;
      userId?: string;
      limit?: number;
      minScore?: number;
    } = {}
  ): Promise<{
    messages: Array<Message & { score: number; distance: number }>;
    total: number;
    hasMore: boolean;
    searchMode: 'semantic';
  }> {
    // Initialize embedding service
    await this.embeddingService.initialize();

    // Generate embedding for query
    const { embedding: queryEmbedding } = await this.embeddingService.embed(query);

    // Vector search
    const searchResults = this.embeddingDAO.searchByVector(queryEmbedding, {
      k: options.limit || 20,
      conversationId: options.conversationId,
      agentId: options.agentId,
      userId: options.userId,
      minScore: options.minScore || 0,
    });

    // Get full message objects
    const messages: Array<Message & { score: number; distance: number }> = [];

    for (const result of searchResults) {
      const message = await this.messageDAO.getById(result.messageId);

      // Skip orphaned embeddings for deleted messages
      if (!message) {
        console.warn(`Skipping orphaned embedding for deleted message: ${result.messageId}`);
        continue;
      }

      messages.push({
        ...message,
        score: result.score,
        distance: result.distance,
      });
    }

    return {
      messages,
      total: messages.length,
      hasMore: false,
      searchMode: 'semantic' as const,
    };
  }

  /**
   * Search messages using hybrid approach (FTS5 + vector similarity)
   * Combines keyword matching with semantic understanding
   */
  async searchMessagesHybrid(
    query: string,
    options: {
      conversationId?: string;
      agentId?: string;
      userId?: string;
      limit?: number;
      ftsWeight?: number;
      vectorWeight?: number;
      minScore?: number;
    } = {}
  ): Promise<{
    messages: Array<Message & { score: number; ftsScore?: number; vectorScore?: number }>;
    total: number;
    hasMore: boolean;
    searchMode: 'hybrid';
  }> {
    const ftsWeight = options.ftsWeight ?? 0.4;
    const vectorWeight = options.vectorWeight ?? 0.6;
    const limit = options.limit || 20;

    // Run both searches in parallel
    const [ftsResults, vectorResults] = await Promise.all([
      // FTS5 keyword search
      this.messageDAO.search({
        query,
        conversationId: options.conversationId,
        agentId: options.agentId,
        userId: options.userId,
        limit: limit * 2,
        offset: 0,
        sortBy: 'relevance',
        sortOrder: 'desc',
        includeArchived: false,
        includeDeleted: false,
        skipCount: false,
      }),

      // Vector semantic search
      (async () => {
        await this.embeddingService.initialize();
        const { embedding: queryEmbedding } = await this.embeddingService.embed(query);

        return this.embeddingDAO.searchByVector(queryEmbedding, {
          k: limit * 2,
          conversationId: options.conversationId,
          agentId: options.agentId,
          userId: options.userId,
          minScore: 0,
        });
      })(),
    ]);

    // Combine results using weighted scoring
    const combinedResults = await this._combineSearchResults(ftsResults.messages, vectorResults, {
      ftsWeight,
      vectorWeight,
      minCombinedScore: options.minScore || 0,
    });

    // Limit to requested number of results
    const messages = combinedResults.slice(0, limit);

    return {
      messages,
      total: messages.length,
      hasMore: combinedResults.length > limit,
      searchMode: 'hybrid' as const,
    };
  }

  /**
   * Combine FTS5 and vector search results using weighted scoring
   */
  private async _combineSearchResults(
    ftsMessages: Message[],
    vectorResults: EmbeddingSearchResult[],
    options: {
      ftsWeight: number;
      vectorWeight: number;
      minCombinedScore: number;
    }
  ): Promise<Array<Message & { score: number; ftsScore?: number; vectorScore?: number }>> {
    // Normalize FTS5 scores to 0-1 range using rank position
    const ftsScoreMap = new Map<string, number>();
    ftsMessages.forEach((msg, index) => {
      const score = 1.0 / (1 + index);
      ftsScoreMap.set(msg.id, score);
    });

    // Vector scores are already 0-1
    const vectorScoreMap = new Map<string, number>();
    vectorResults.forEach((result) => {
      vectorScoreMap.set(result.messageId, result.score);
    });

    // Get all unique message IDs
    const allMessageIds = new Set([
      ...ftsMessages.map((m) => m.id),
      ...vectorResults.map((r) => r.messageId),
    ]);

    // Phase 1: Identify vector-only results (not in FTS)
    const vectorOnlyIds: string[] = [];
    for (const messageId of Array.from(allMessageIds)) {
      const inFTS = ftsMessages.some((m) => m.id === messageId);
      if (!inFTS) {
        vectorOnlyIds.push(messageId);
      }
    }

    // Phase 2: Fetch all vector-only messages in parallel
    const vectorOnlyMessagesMap = new Map<string, Message>();

    if (vectorOnlyIds.length > 0) {
      const fetchPromises = vectorOnlyIds.map(async (messageId) => {
        const vectorResult = vectorResults.find((r) => r.messageId === messageId);
        if (!vectorResult) return null;

        const fullMessage = await this.messageDAO.getById(vectorResult.messageId);

        if (fullMessage) {
          return { messageId, message: fullMessage };
        } else {
          // Fallback for deleted messages
          console.warn(`Vector result for deleted message: ${vectorResult.messageId}`);
          const fallbackMessage: Message = {
            id: vectorResult.messageId,
            conversationId: vectorResult.conversationId,
            // Type assertion safe because DB constraint guarantees valid role
            // TODO(P2): Update EmbeddingSearchResult.role to use MessageRole type
            role: vectorResult.role as MessageRole,
            content: vectorResult.content,
            createdAt: vectorResult.createdAt,
            updatedAt: vectorResult.createdAt,
            tokens: undefined,
            metadata: undefined,
          };
          return { messageId, message: fallbackMessage };
        }
      });

      const fetchedMessages = await Promise.all(fetchPromises);

      fetchedMessages.forEach((result) => {
        if (result) {
          vectorOnlyMessagesMap.set(result.messageId, result.message);
        }
      });
    }

    // Phase 3: Combine scores (now synchronous - no await in loop!)
    const combinedScores = new Map<
      string,
      { combined: number; fts?: number; vector?: number; message: Message }
    >();

    for (const messageId of Array.from(allMessageIds)) {
      const ftsScore = ftsScoreMap.get(messageId) || 0;
      const vectorScore = vectorScoreMap.get(messageId) || 0;
      const combinedScore = ftsScore * options.ftsWeight + vectorScore * options.vectorWeight;

      // Try to get message from FTS results first
      let message = ftsMessages.find((m) => m.id === messageId);

      // If not in FTS, use pre-fetched vector-only message
      if (!message) {
        message = vectorOnlyMessagesMap.get(messageId);
      }

      // Only skip if message truly not found in either result set
      if (!message) continue;

      combinedScores.set(messageId, {
        combined: combinedScore,
        fts: ftsScore > 0 ? ftsScore : undefined,
        vector: vectorScore > 0 ? vectorScore : undefined,
        message,
      });
    }

    // Filter and sort
    const results = Array.from(combinedScores.values())
      .filter((entry) => entry.combined >= options.minCombinedScore)
      .sort((a, b) => b.combined - a.combined)
      .map((entry) => ({
        ...entry.message,
        score: entry.combined,
        ftsScore: entry.fts,
        vectorScore: entry.vector,
      }));

    return results;
  }

  // ============================================================================
  // Statistics Operations
  // ============================================================================

  /**
   * Get message count by conversation
   */
  async getMessageCount(conversationId: string): Promise<number> {
    return this.messageDAO.getCountByConversation(conversationId);
  }

  /**
   * Get total tokens by conversation
   */
  async getTotalTokens(conversationId: string): Promise<number> {
    return this.messageDAO.getTotalTokensByConversation(conversationId);
  }

  /**
   * Get conversation count by state
   */
  async getConversationCountByState(state: string): Promise<number> {
    return this.conversationDAO.getCountByState(state);
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(): Promise<MemoryStats> {
    // Get conversation counts (fast, no pagination issues)
    const conversations = await this.conversationDAO.list({
      limit: 1,  // Only need count, not actual data
      offset: 0,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      includeArchived: true,
      includeDeleted: true,
    });

    const totalConversations = conversations.total;
    const activeConversations = await this.getConversationCountByState('active');
    const archivedConversations = await this.getConversationCountByState('archived');
    const deletedConversations = await this.getConversationCountByState('deleted');

    // Get global message statistics using SQL aggregation (fixes BUG #13)
    // This correctly counts ALL messages, not just first 100 conversations
    const { totalMessages, totalTokens } = this.messageDAO.getGlobalStats();

    const averageMessagesPerConversation =
      totalConversations > 0 ? totalMessages / totalConversations : 0;
    const averageTokensPerMessage = totalMessages > 0 ? totalTokens / totalMessages : 0;

    // Get oldest and newest conversation timestamps (need at least 1 conversation)
    const allConversations = await this.conversationDAO.list({
      limit: totalConversations,  // Fetch all for timestamp calculation
      offset: 0,
      sortBy: 'createdAt',
      sortOrder: 'asc',  // Oldest first
      includeArchived: true,
      includeDeleted: true,
    });

    const oldestConversation =
      allConversations.conversations.length > 0
        ? allConversations.conversations[0].createdAt
        : undefined;
    const newestConversation =
      allConversations.conversations.length > 0
        ? allConversations.conversations[allConversations.conversations.length - 1].createdAt
        : undefined;

    return {
      totalConversations,
      activeConversations,
      archivedConversations,
      deletedConversations,
      totalMessages,
      totalTokens,
      averageMessagesPerConversation,
      averageTokensPerMessage,
      oldestConversation,
      newestConversation,
    };
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /**
   * Delete all messages in a conversation
   */
  async deleteConversationMessages(conversationId: string): Promise<number> {
    return this.messageDAO.deleteByConversation(conversationId);
  }

  /**
   * Export conversation with messages
   */
  async exportConversation(conversationId: string): Promise<ConversationWithMessages | null> {
    return this.getConversationWithMessages(conversationId);
  }

  /**
   * Export all conversations for an agent
   */
  async exportAgentConversations(
    agentId: string,
    includeMessages: boolean = true
  ): Promise<Array<Conversation | ConversationWithMessages>> {
    const conversations = await this.getConversationsByAgent(agentId, 10000);

    if (!includeMessages) {
      return conversations;
    }

    const conversationsWithMessages: ConversationWithMessages[] = [];
    for (const conv of conversations) {
      const full = await this.getConversationWithMessages(conv.id);
      if (full) {
        conversationsWithMessages.push(full);
      }
    }

    return conversationsWithMessages;
  }

  // ============================================================================
  // Embedding Operations (Semantic Search Support)
  // ============================================================================

  /**
   * Generate embedding for a message (async helper)
   * Private method, fire-and-forget for addMessage()
   */
  private async _generateEmbeddingAsync(messageId: string, content: string): Promise<void> {
    try {
      await this.embeddingService.initialize();
      const { embedding } = await this.embeddingService.embed(content);
      this.embeddingDAO.addEmbedding(messageId, embedding);
    } catch (error) {
      // Log error but don't throw (this is fire-and-forget)
      console.error(`Embedding generation failed for message ${messageId}:`, error);
    }
  }

  /**
   * Index existing messages (backfill embeddings)
   * Useful for migrating existing conversations to semantic search
   */
  async indexExistingMessages(
    conversationId?: string,
    options: {
      batchSize?: number;
      force?: boolean; // Re-index messages that already have embeddings
      onProgress?: (indexed: number, total: number) => void;
    } = {}
  ): Promise<{
    indexed: number;
    skipped: number;
    failed: number;
    duration: number;
  }> {
    const startTime = Date.now();
    const batchSize = options.batchSize || 100;

    // Get messages to index
    const messagesToIndex = conversationId
      ? await this.messageDAO.getByConversation(conversationId, 100000) // Large limit
      : await this.messageDAO.getRecent(100000);

    let indexed = 0;
    let skipped = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < messagesToIndex.length; i += batchSize) {
      const batch = messagesToIndex.slice(i, i + batchSize);
      const embeddings: Array<{
        messageId: string;
        embedding: Float32Array;
      }> = [];

      for (const message of batch) {
        try {
          // Skip if already has embedding (unless force=true)
          if (!options.force && this.embeddingDAO.hasEmbedding(message.id)) {
            skipped++;
            continue;
          }

          // Generate embedding
          await this.embeddingService.initialize();
          const { embedding } = await this.embeddingService.embed(message.content);
          embeddings.push({ messageId: message.id, embedding });
        } catch (error) {
          console.error(`Failed to generate embedding for message ${message.id}:`, error);
          failed++;
        }
      }

      // Batch add embeddings
      if (embeddings.length > 0) {
        const result = this.embeddingDAO.addBatch(embeddings);
        indexed += result.added;
        failed += result.failed;
        skipped += result.skipped;
      }

      // Progress callback
      if (options.onProgress) {
        options.onProgress(i + batch.length, messagesToIndex.length);
      }
    }

    const duration = Date.now() - startTime;

    return {
      indexed,
      skipped,
      failed,
      duration,
    };
  }

  /**
   * Get embedding statistics
   * Useful for monitoring embedding coverage
   */
  async getEmbeddingStats(): Promise<{
    totalEmbeddings: number;
    totalMessages: number;
    coveragePercent: number;
    currentModelVersion: string | null;
  }> {
    return this.embeddingDAO.getStats();
  }

  // ============================================================================
  // Compatibility Methods (for Agent System)
  // ============================================================================

  /**
   * Search memory - simplified interface for agent system
   * Delegates to searchMessages with hybrid search
   */
  async search(query: string): Promise<any[]> {
    const result = await this.searchMessages({
      query,
      limit: 10,
      mode: 'hybrid',
    });
    return result.messages;
  }

  /**
   * Create memory entry - simplified interface for agent system
   * Delegates to addMessage
   */
  async createEntry(data: { content: string; conversationId: string; role?: MessageRole }): Promise<void> {
    await this.addMessage({
      conversationId: data.conversationId,
      role: data.role || 'user',
      content: data.content,
    });
  }
}
