/**
 * MessageEmbeddingDAO - Data Access Object for message embeddings
 *
 * Manages message embeddings stored in sqlite-vec vec0 virtual tables
 * Architecture: Two-table design (vec0 + metadata) linked by rowid
 *
 * Tables:
 * - message_embeddings (vec0): Stores 384-dim Float32Array embeddings
 * - message_embeddings_metadata: Stores message_id, model_version, timestamps
 *
 * Key Operations:
 * - Add/get/delete embeddings
 * - Vector similarity search with filters
 * - JOIN with messages table for rich results
 */
export class MessageEmbeddingDAO {
    db;
    static DIMENSIONS = 384;
    static DEFAULT_MODEL_VERSION = 'all-MiniLM-L6-v2';
    constructor(db) {
        this.db = db;
    }
    /**
     * Add embedding for a message
     * Uses two-step insert: vec0 table (gets rowid) -> metadata table (same rowid)
     */
    addEmbedding(messageId, embedding, options = {}) {
        // Validate dimensions
        if (embedding.length !== MessageEmbeddingDAO.DIMENSIONS) {
            throw new Error(`Embedding dimensions mismatch: got ${embedding.length}, expected ${MessageEmbeddingDAO.DIMENSIONS}`);
        }
        // Check if message exists
        const messageExists = this.db
            .prepare('SELECT 1 FROM messages WHERE id = ?')
            .get(messageId);
        if (!messageExists) {
            throw new Error(`Message ${messageId} not found`);
        }
        // Check if embedding already exists
        const existing = this.db
            .prepare('SELECT rowid FROM message_embeddings_metadata WHERE message_id = ?')
            .get(messageId);
        if (existing) {
            // Update existing embedding
            this.deleteEmbedding(messageId);
        }
        // Convert Float32Array to JSON array for sqlite-vec
        const embeddingJSON = JSON.stringify(Array.from(embedding));
        // Insert into vec0 table (gets auto rowid)
        const insertVector = this.db.prepare(`
      INSERT INTO message_embeddings(embedding)
      VALUES (?)
    `);
        const result = insertVector.run(embeddingJSON);
        const rowid = Number(result.lastInsertRowid);
        // Insert metadata with same rowid
        const insertMetadata = this.db.prepare(`
      INSERT INTO message_embeddings_metadata(rowid, message_id, model_version, chunk_index, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        const now = Math.floor(Date.now() / 1000); // Convert to UNIX seconds
        insertMetadata.run(rowid, messageId, options.modelVersion || MessageEmbeddingDAO.DEFAULT_MODEL_VERSION, options.chunkIndex || 0, now, now);
    }
    /**
     * Get embedding metadata for a message
     * Note: Does not return the actual embedding vector (use searchByVector for that)
     * Returns null if not found
     */
    getEmbedding(messageId) {
        const stmt = this.db.prepare(`
      SELECT
        mem.message_id,
        mem.model_version,
        mem.chunk_index,
        mem.created_at,
        mem.updated_at
      FROM message_embeddings_metadata mem
      WHERE mem.message_id = ?
    `);
        const row = stmt.get(messageId);
        if (!row) {
            return null;
        }
        return {
            messageId: row.message_id,
            modelVersion: row.model_version,
            chunkIndex: row.chunk_index,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    /**
     * Check if message has embedding
     */
    hasEmbedding(messageId) {
        const stmt = this.db.prepare(`
      SELECT 1 FROM message_embeddings_metadata WHERE message_id = ? LIMIT 1
    `);
        return stmt.get(messageId) !== undefined;
    }
    /**
     * Delete embedding for a message
     * Returns true if deleted, false if not found
     */
    deleteEmbedding(messageId) {
        // Get rowid from metadata
        const row = this.db
            .prepare('SELECT rowid FROM message_embeddings_metadata WHERE message_id = ?')
            .get(messageId);
        if (!row) {
            return false;
        }
        // Delete from both tables
        this.db.prepare('DELETE FROM message_embeddings WHERE rowid = ?').run(row.rowid);
        this.db.prepare('DELETE FROM message_embeddings_metadata WHERE rowid = ?').run(row.rowid);
        return true;
    }
    /**
     * Search messages by vector similarity
     * Supports filters, pagination, and minimum score threshold
     *
     * Uses sqlite-vec JOIN query:
     * 1. vec0 knn search with MATCH and k=?
     * 2. JOIN with metadata for message_id
     * 3. JOIN with messages for content and filters
     * 4. JOIN with conversations for agent_id, user_id filters
     */
    searchByVector(queryEmbedding, options = {}) {
        // Validate dimensions
        if (queryEmbedding.length !== MessageEmbeddingDAO.DIMENSIONS) {
            throw new Error(`Query embedding dimensions mismatch: got ${queryEmbedding.length}, expected ${MessageEmbeddingDAO.DIMENSIONS}`);
        }
        const k = Math.min(options.k || 20, 100); // Cap at 100
        const minScore = options.minScore || 0;
        // Convert query to JSON array
        const queryJSON = JSON.stringify(Array.from(queryEmbedding));
        // Build query with filters
        let sql = `
      SELECT
        mem.message_id,
        m.conversation_id,
        m.role,
        m.content,
        m.created_at,
        me.distance
    `;
        if (options.includeEmbedding) {
            sql += `,
        me.embedding
      `;
        }
        sql += `
      FROM message_embeddings me
      INNER JOIN message_embeddings_metadata mem ON me.rowid = mem.rowid
      INNER JOIN messages m ON mem.message_id = m.id
    `;
        // Add conversation JOIN if filtering by agent or user
        if (options.agentId || options.userId) {
            sql += `
      INNER JOIN conversations c ON m.conversation_id = c.id
      `;
        }
        // vec0 knn search with k= syntax
        sql += `
      WHERE me.embedding MATCH ?
        AND k = ?
    `;
        const params = [queryJSON, k];
        // Add filters
        if (options.conversationId) {
            sql += ` AND m.conversation_id = ?`;
            params.push(options.conversationId);
        }
        if (options.agentId) {
            sql += ` AND c.agent_id = ?`;
            params.push(options.agentId);
        }
        if (options.userId) {
            sql += ` AND c.user_id = ?`;
            params.push(options.userId);
        }
        // Order by distance (ascending - lower is better)
        sql += `
      ORDER BY me.distance ASC
    `;
        const stmt = this.db.prepare(sql);
        const rows = stmt.all(...params);
        // Convert results and filter by minimum score
        const results = [];
        for (const row of rows) {
            // Convert L2 distance to similarity score (0-1, higher is better)
            const score = 1 / (1 + row.distance);
            // Filter by minimum score
            if (score < minScore) {
                continue;
            }
            const result = {
                messageId: row.message_id,
                conversationId: row.conversation_id,
                role: row.role,
                content: row.content,
                distance: row.distance,
                score,
                createdAt: row.created_at,
            };
            // Add embedding if requested
            if (options.includeEmbedding && row.embedding) {
                const embeddingArray = JSON.parse(row.embedding);
                result.embedding = new Float32Array(embeddingArray);
            }
            results.push(result);
        }
        return results;
    }
    /**
     * Get embedding count
     */
    getEmbeddingCount() {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM message_embeddings_metadata');
        const result = stmt.get();
        return result.count;
    }
    /**
     * Get embedding metadata by conversation
     * Returns metadata only (not actual embedding vectors)
     * Useful for bulk operations and analytics
     */
    getByConversation(conversationId) {
        const stmt = this.db.prepare(`
      SELECT
        mem.message_id,
        mem.model_version,
        mem.chunk_index,
        mem.created_at,
        mem.updated_at
      FROM message_embeddings_metadata mem
      INNER JOIN messages m ON mem.message_id = m.id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at ASC
    `);
        const rows = stmt.all(conversationId);
        return rows.map((row) => ({
            messageId: row.message_id,
            modelVersion: row.model_version,
            chunkIndex: row.chunk_index,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));
    }
    /**
     * Get embedding statistics
     * Uses the message_embedding_stats view from migration 009
     */
    getStats() {
        const stmt = this.db.prepare('SELECT * FROM message_embedding_stats');
        const row = stmt.get();
        return {
            totalEmbeddings: row.total_embeddings,
            totalMessages: row.total_messages,
            coveragePercent: row.coverage_percent,
            currentModelVersion: row.current_model_version,
            oldestEmbedding: row.oldest_embedding,
            newestEmbedding: row.newest_embedding,
            uniqueMessages: row.unique_messages,
            chunkedEmbeddings: row.chunked_embeddings,
        };
    }
    /**
     * Delete embeddings by conversation
     * Useful for cleanup operations
     */
    deleteByConversation(conversationId) {
        // Get message IDs for this conversation
        const messageIds = this.db
            .prepare('SELECT id FROM messages WHERE conversation_id = ?')
            .all(conversationId);
        let deletedCount = 0;
        for (const { id } of messageIds) {
            if (this.deleteEmbedding(id)) {
                deletedCount++;
            }
        }
        return deletedCount;
    }
    /**
     * Batch add embeddings
     * More efficient than calling addEmbedding() multiple times
     */
    addBatch(embeddings) {
        const insertVector = this.db.prepare(`
      INSERT INTO message_embeddings(embedding) VALUES (?)
    `);
        const insertMetadata = this.db.prepare(`
      INSERT INTO message_embeddings_metadata(rowid, message_id, model_version, chunk_index, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        const addMany = this.db.transaction((embeddings) => {
            let added = 0;
            let skipped = 0;
            let failed = 0;
            for (const item of embeddings) {
                try {
                    // Validate dimensions
                    if (item.embedding.length !== MessageEmbeddingDAO.DIMENSIONS) {
                        failed++;
                        continue;
                    }
                    // Check if exists
                    const existing = this.db
                        .prepare('SELECT 1 FROM message_embeddings_metadata WHERE message_id = ?')
                        .get(item.messageId);
                    if (existing) {
                        skipped++;
                        continue;
                    }
                    // Insert vector
                    const embeddingJSON = JSON.stringify(Array.from(item.embedding));
                    const result = insertVector.run(embeddingJSON);
                    const rowid = Number(result.lastInsertRowid);
                    // Insert metadata
                    const now = Math.floor(Date.now() / 1000); // Convert to UNIX seconds
                    insertMetadata.run(rowid, item.messageId, item.modelVersion || MessageEmbeddingDAO.DEFAULT_MODEL_VERSION, item.chunkIndex || 0, now, now);
                    added++;
                }
                catch (error) {
                    failed++;
                    console.error(`Failed to add embedding for ${item.messageId}:`, error);
                }
            }
            return { added, skipped, failed };
        });
        return addMany(embeddings);
    }
}
//# sourceMappingURL=MessageEmbeddingDAO.js.map