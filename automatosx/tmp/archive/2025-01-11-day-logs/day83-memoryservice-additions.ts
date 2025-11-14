// ============================================================================
// Phase 2: MemoryService Semantic Search Extensions
// Add these methods to src/memory/MemoryService.ts after searchMessagesByQuery()
// ============================================================================

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
    const messages = await Promise.all(
      searchResults.map(async (result) => {
        const message = await this.messageDAO.getById(result.messageId);
        if (!message) {
          throw new Error(`Message ${result.messageId} not found`);
        }

        return {
          ...message,
          score: result.score,
          distance: result.distance,
        };
      })
    );

    return {
      messages,
      total: messages.length,
      hasMore: false, // vec0 returns exact k results
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
      ftsWeight?: number; // default 0.4
      vectorWeight?: number; // default 0.6
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
        limit: limit * 2, // Get more results for merging
        offset: 0,
        sortBy: 'relevance',
        sortOrder: 'desc',
        includeArchived: false,
        includeDeleted: false,
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
          minScore: 0, // Don't filter here, filter after merging
        });
      })(),
    ]);

    // Combine results using weighted scoring
    const combinedResults = this._combineSearchResults(
      ftsResults.messages,
      vectorResults,
      {
        ftsWeight,
        vectorWeight,
        minCombinedScore: options.minScore || 0,
      }
    );

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
   * Private helper for hybrid search
   */
  private _combineSearchResults(
    ftsMessages: Message[],
    vectorResults: EmbeddingSearchResult[],
    options: {
      ftsWeight: number;
      vectorWeight: number;
      minCombinedScore: number;
    }
  ): Array<Message & { score: number; ftsScore?: number; vectorScore?: number }> {
    // Normalize FTS5 scores to 0-1 range
    // FTS5 doesn't provide scores, so we use rank position
    const ftsScoreMap = new Map<string, number>();
    ftsMessages.forEach((msg, index) => {
      // Score decreases with rank: 1.0 for first result, approaches 0 for last
      const score = 1.0 / (1 + index);
      ftsScoreMap.set(msg.id, score);
    });

    // Vector scores are already 0-1 (from similarity score)
    const vectorScoreMap = new Map<string, number>();
    vectorResults.forEach((result) => {
      vectorScoreMap.set(result.messageId, result.score);
    });

    // Get all unique message IDs
    const allMessageIds = new Set([
      ...ftsMessages.map((m) => m.id),
      ...vectorResults.map((r) => r.messageId),
    ]);

    // Combine scores
    const combinedScores = new Map<
      string,
      { combined: number; fts?: number; vector?: number; message: Message }
    >();

    for (const messageId of allMessageIds) {
      const ftsScore = ftsScoreMap.get(messageId) || 0;
      const vectorScore = vectorScoreMap.get(messageId) || 0;
      const combinedScore = ftsScore * options.ftsWeight + vectorScore * options.vectorWeight;

      // Get message object
      const message =
        ftsMessages.find((m) => m.id === messageId) ||
        vectorResults.find((r) => r.messageId === messageId);

      if (!message) {
        continue; // Skip if message not found (shouldn't happen)
      }

      const messageObj = 'content' in message ? message : null;
      if (!messageObj) {
        continue;
      }

      combinedScores.set(messageId, {
        combined: combinedScore,
        fts: ftsScore > 0 ? ftsScore : undefined,
        vector: vectorScore > 0 ? vectorScore : undefined,
        message: messageObj,
      });
    }

    // Filter by minimum score and sort by combined score
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

  /**
   * Add message and generate embedding
   * Overrides parent method to add embedding generation hook
   */
  async addMessage(data: CreateMessage): Promise<Message> {
    // Create message (existing logic)
    const message = this.messageDAO.create(data);

    // Update conversation token count (existing logic)
    this.conversationDAO.incrementMessageCount(data.conversationId, data.tokens || 0);

    // Generate and store embedding (new logic - async, non-blocking)
    this._generateEmbeddingAsync(message.id, message.content).catch((err) => {
      console.warn(`Failed to generate embedding for message ${message.id}:`, err);
      // Don't block message creation on embedding failure
    });

    return message;
  }

  /**
   * Generate embedding for a message (async helper)
   * Private method, fire-and-forget
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
