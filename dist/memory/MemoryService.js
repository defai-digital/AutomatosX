/**
 * MemoryService - High-level service for memory management
 * Orchestrates ConversationDAO and MessageDAO operations
 */
import { ConversationDAO } from '../database/dao/ConversationDAO.js';
import { MessageDAO } from '../database/dao/MessageDAO.js';
import { MessageEmbeddingDAO } from '../database/dao/MessageEmbeddingDAO.js';
import { getEmbeddingService } from '../services/EmbeddingService.js';
export class MemoryService {
    conversationDAO;
    messageDAO;
    embeddingDAO;
    embeddingService = getEmbeddingService();
    constructor(db) {
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
    async createConversation(data) {
        return this.conversationDAO.create(data);
    }
    /**
     * Get conversation by ID
     */
    async getConversation(id) {
        return this.conversationDAO.getById(id);
    }
    /**
     * Get conversation with all messages
     */
    async getConversationWithMessages(id) {
        return this.conversationDAO.getWithMessages(id);
    }
    /**
     * Update conversation
     */
    async updateConversation(id, updates) {
        return this.conversationDAO.update({ id, ...updates });
    }
    /**
     * Archive conversation
     */
    async archiveConversation(id) {
        return this.conversationDAO.archive(id);
    }
    /**
     * Restore archived conversation
     */
    async restoreConversation(id) {
        return this.conversationDAO.restore(id);
    }
    /**
     * Delete conversation (soft delete)
     */
    async deleteConversation(id) {
        return this.conversationDAO.delete(id);
    }
    /**
     * Permanently delete conversation and all messages
     */
    async permanentlyDeleteConversation(id) {
        return this.conversationDAO.permanentlyDelete(id);
    }
    /**
     * List conversations with filters
     */
    async listConversations(options) {
        return this.conversationDAO.list(options);
    }
    /**
     * Get recent conversations
     */
    async getRecentConversations(agentId, limit = 10) {
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
    async searchConversationsByTitle(query, limit = 10) {
        return this.conversationDAO.searchByTitle(query, limit);
    }
    /**
     * Get conversations by agent
     */
    async getConversationsByAgent(agentId, limit = 10) {
        return this.conversationDAO.getByAgent(agentId, limit);
    }
    /**
     * Get conversations by user
     */
    async getConversationsByUser(userId, limit = 10) {
        return this.conversationDAO.getByUser(userId, limit);
    }
    // ============================================================================
    // Message Operations
    // ============================================================================
    /**
     * Add message to conversation
     * Automatically generates embedding for semantic search
     */
    async addMessage(data) {
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
    async getMessage(id) {
        return this.messageDAO.getById(id);
    }
    /**
     * Update message content
     */
    async updateMessage(id, content, tokens) {
        return this.messageDAO.update(id, content, tokens);
    }
    /**
     * Delete message
     */
    async deleteMessage(id) {
        return this.messageDAO.delete(id);
    }
    /**
     * List messages for conversation
     */
    async listMessages(options) {
        return this.messageDAO.list(options);
    }
    /**
     * Get messages by conversation
     */
    async getMessagesByConversation(conversationId, limit = 100) {
        return this.messageDAO.getByConversation(conversationId, limit);
    }
    /**
     * Get recent messages across all conversations
     */
    async getRecentMessages(limit = 10) {
        return this.messageDAO.getRecent(limit);
    }
    // ============================================================================
    // Search Operations
    // ============================================================================
    /**
     * Search messages using FTS5 full-text search
     */
    async searchMessages(options) {
        return this.messageDAO.search(options);
    }
    /**
     * Simple search by query string
     */
    async searchMessagesByQuery(query, conversationId, limit = 10) {
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
    async searchMessagesSemantic(query, options = {}) {
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
        const messages = [];
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
            searchMode: 'semantic',
        };
    }
    /**
     * Search messages using hybrid approach (FTS5 + vector similarity)
     * Combines keyword matching with semantic understanding
     */
    async searchMessagesHybrid(query, options = {}) {
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
            searchMode: 'hybrid',
        };
    }
    /**
     * Combine FTS5 and vector search results using weighted scoring
     */
    async _combineSearchResults(ftsMessages, vectorResults, options) {
        // Normalize FTS5 scores to 0-1 range using rank position
        const ftsScoreMap = new Map();
        ftsMessages.forEach((msg, index) => {
            const score = 1.0 / (1 + index);
            ftsScoreMap.set(msg.id, score);
        });
        // Vector scores are already 0-1
        const vectorScoreMap = new Map();
        vectorResults.forEach((result) => {
            vectorScoreMap.set(result.messageId, result.score);
        });
        // Get all unique message IDs
        const allMessageIds = new Set([
            ...ftsMessages.map((m) => m.id),
            ...vectorResults.map((r) => r.messageId),
        ]);
        // Phase 1: Identify vector-only results (not in FTS)
        const vectorOnlyIds = [];
        for (const messageId of Array.from(allMessageIds)) {
            const inFTS = ftsMessages.some((m) => m.id === messageId);
            if (!inFTS) {
                vectorOnlyIds.push(messageId);
            }
        }
        // Phase 2: Fetch all vector-only messages in parallel
        const vectorOnlyMessagesMap = new Map();
        if (vectorOnlyIds.length > 0) {
            const fetchPromises = vectorOnlyIds.map(async (messageId) => {
                const vectorResult = vectorResults.find((r) => r.messageId === messageId);
                if (!vectorResult)
                    return null;
                const fullMessage = await this.messageDAO.getById(vectorResult.messageId);
                if (fullMessage) {
                    return { messageId, message: fullMessage };
                }
                else {
                    // Fallback for deleted messages
                    console.warn(`Vector result for deleted message: ${vectorResult.messageId}`);
                    const fallbackMessage = {
                        id: vectorResult.messageId,
                        conversationId: vectorResult.conversationId,
                        // Type assertion safe because DB constraint guarantees valid role
                        // TODO(P2): Update EmbeddingSearchResult.role to use MessageRole type
                        role: vectorResult.role,
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
        const combinedScores = new Map();
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
            if (!message)
                continue;
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
    async getMessageCount(conversationId) {
        return this.messageDAO.getCountByConversation(conversationId);
    }
    /**
     * Get total tokens by conversation
     */
    async getTotalTokens(conversationId) {
        return this.messageDAO.getTotalTokensByConversation(conversationId);
    }
    /**
     * Get conversation count by state
     */
    async getConversationCountByState(state) {
        return this.conversationDAO.getCountByState(state);
    }
    /**
     * Get memory statistics
     */
    async getMemoryStats() {
        // Get conversation counts (fast, no pagination issues)
        const conversations = await this.conversationDAO.list({
            limit: 1, // Only need count, not actual data
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
        const averageMessagesPerConversation = totalConversations > 0 ? totalMessages / totalConversations : 0;
        const averageTokensPerMessage = totalMessages > 0 ? totalTokens / totalMessages : 0;
        // Get oldest and newest conversation timestamps (need at least 1 conversation)
        const allConversations = await this.conversationDAO.list({
            limit: totalConversations, // Fetch all for timestamp calculation
            offset: 0,
            sortBy: 'createdAt',
            sortOrder: 'asc', // Oldest first
            includeArchived: true,
            includeDeleted: true,
        });
        const oldestConversation = allConversations.conversations.length > 0
            ? allConversations.conversations[0].createdAt
            : undefined;
        const newestConversation = allConversations.conversations.length > 0
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
    async deleteConversationMessages(conversationId) {
        return this.messageDAO.deleteByConversation(conversationId);
    }
    /**
     * Export conversation with messages
     */
    async exportConversation(conversationId) {
        return this.getConversationWithMessages(conversationId);
    }
    /**
     * Export all conversations for an agent
     */
    async exportAgentConversations(agentId, includeMessages = true) {
        const conversations = await this.getConversationsByAgent(agentId, 10000);
        if (!includeMessages) {
            return conversations;
        }
        const conversationsWithMessages = [];
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
    async _generateEmbeddingAsync(messageId, content) {
        try {
            await this.embeddingService.initialize();
            const { embedding } = await this.embeddingService.embed(content);
            this.embeddingDAO.addEmbedding(messageId, embedding);
        }
        catch (error) {
            // Log error but don't throw (this is fire-and-forget)
            console.error(`Embedding generation failed for message ${messageId}:`, error);
        }
    }
    /**
     * Index existing messages (backfill embeddings)
     * Useful for migrating existing conversations to semantic search
     */
    async indexExistingMessages(conversationId, options = {}) {
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
            const embeddings = [];
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
                }
                catch (error) {
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
    async getEmbeddingStats() {
        return this.embeddingDAO.getStats();
    }
    // ============================================================================
    // Compatibility Methods (for Agent System)
    // ============================================================================
    /**
     * Search memory - simplified interface for agent system
     * Delegates to searchMessages with hybrid search
     */
    async search(query) {
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
    async createEntry(data) {
        await this.addMessage({
            conversationId: data.conversationId,
            role: data.role || 'user',
            content: data.content,
        });
    }
}
//# sourceMappingURL=MemoryService.js.map