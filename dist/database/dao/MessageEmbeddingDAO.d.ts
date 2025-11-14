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
import type { Database } from 'better-sqlite3';
export interface MessageEmbedding {
    messageId: string;
    embedding: Float32Array;
    modelVersion: string;
    chunkIndex: number;
    createdAt: number;
    updatedAt: number;
}
export interface EmbeddingSearchOptions {
    k?: number;
    conversationId?: string;
    agentId?: string;
    userId?: string;
    minScore?: number;
    includeEmbedding?: boolean;
}
export interface EmbeddingSearchResult {
    messageId: string;
    conversationId: string;
    role: string;
    content: string;
    distance: number;
    score: number;
    createdAt: number;
    embedding?: Float32Array;
}
export interface EmbeddingStats {
    totalEmbeddings: number;
    totalMessages: number;
    coveragePercent: number;
    currentModelVersion: string | null;
    oldestEmbedding: number | null;
    newestEmbedding: number | null;
    uniqueMessages: number;
    chunkedEmbeddings: number;
}
export declare class MessageEmbeddingDAO {
    private db;
    private static readonly DIMENSIONS;
    private static readonly DEFAULT_MODEL_VERSION;
    constructor(db: Database);
    /**
     * Add embedding for a message
     * Uses two-step insert: vec0 table (gets rowid) -> metadata table (same rowid)
     */
    addEmbedding(messageId: string, embedding: Float32Array, options?: {
        modelVersion?: string;
        chunkIndex?: number;
    }): void;
    /**
     * Get embedding metadata for a message
     * Note: Does not return the actual embedding vector (use searchByVector for that)
     * Returns null if not found
     */
    getEmbedding(messageId: string): Omit<MessageEmbedding, 'embedding'> | null;
    /**
     * Check if message has embedding
     */
    hasEmbedding(messageId: string): boolean;
    /**
     * Delete embedding for a message
     * Returns true if deleted, false if not found
     */
    deleteEmbedding(messageId: string): boolean;
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
    searchByVector(queryEmbedding: Float32Array, options?: EmbeddingSearchOptions): EmbeddingSearchResult[];
    /**
     * Get embedding count
     */
    getEmbeddingCount(): number;
    /**
     * Get embedding metadata by conversation
     * Returns metadata only (not actual embedding vectors)
     * Useful for bulk operations and analytics
     */
    getByConversation(conversationId: string): Array<Omit<MessageEmbedding, 'embedding'>>;
    /**
     * Get embedding statistics
     * Uses the message_embedding_stats view from migration 009
     */
    getStats(): EmbeddingStats;
    /**
     * Delete embeddings by conversation
     * Useful for cleanup operations
     */
    deleteByConversation(conversationId: string): number;
    /**
     * Batch add embeddings
     * More efficient than calling addEmbedding() multiple times
     */
    addBatch(embeddings: Array<{
        messageId: string;
        embedding: Float32Array;
        modelVersion?: string;
        chunkIndex?: number;
    }>): {
        added: number;
        skipped: number;
        failed: number;
    };
}
//# sourceMappingURL=MessageEmbeddingDAO.d.ts.map