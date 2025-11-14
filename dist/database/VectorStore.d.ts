/**
 * Vector Store - SQLite-vec based vector similarity search
 *
 * Uses sqlite-vec extension with better-sqlite3 for fast vector search
 * - Storage: SQLite vec0 virtual table (vectors) + regular table (metadata)
 * - Distance metric: L2 distance (lower = more similar)
 * - Dimensions: 384 (matching all-MiniLM-L6-v2 embeddings)
 *
 * Architecture:
 * - vec0 virtual table: rowid + embedding (384 floats)
 * - metadata table: rowid + id + type + timestamp
 * - Linked by rowid for fast JOINs
 *
 * Features:
 * - Add/remove vectors with metadata
 * - K-nearest neighbor search
 * - Integrated with existing SQLite database
 * - Cross-platform (no C++ compilation)
 * - Simple SQL-based interface
 */
import Database from 'better-sqlite3';
export interface VectorMetadata {
    id: string;
    type: string;
    timestamp: number;
}
export interface SearchResult {
    id: string;
    score: number;
    distance: number;
    metadata: VectorMetadata;
}
export interface VectorStoreOptions {
    dimensions?: number;
    db?: Database.Database;
    tableName?: string;
}
export declare class VectorStore {
    private db;
    private dimensions;
    private tableName;
    private metadataTableName;
    private ownDb;
    constructor(options?: VectorStoreOptions);
    /**
     * Initialize vec0 virtual table and metadata table
     */
    private _initializeTables;
    /**
     * Add a vector to the store
     *
     * @param id - Unique identifier (e.g., memory ID)
     * @param embedding - 384-dimensional embedding vector
     * @param metadata - Additional metadata
     */
    add(id: string, embedding: Float32Array, metadata?: Partial<VectorMetadata>): Promise<void>;
    /**
     * Add multiple vectors in batch
     * More efficient than calling add() multiple times
     *
     * @param vectors - Array of {id, embedding, metadata}
     */
    addBatch(vectors: Array<{
        id: string;
        embedding: Float32Array;
        metadata?: Partial<VectorMetadata>;
    }>): Promise<void>;
    /**
     * Remove a vector from the store
     *
     * @param id - Identifier to remove
     */
    remove(id: string): Promise<boolean>;
    /**
     * Search for k-nearest neighbors
     *
     * @param query - Query embedding vector (384 dimensions)
     * @param k - Number of results to return
     * @returns Array of search results sorted by distance (ascending)
     */
    search(query: Float32Array, k?: number): Promise<SearchResult[]>;
    /**
     * Get vector metadata by ID
     *
     * @param id - Vector ID
     * @returns Vector metadata or undefined
     */
    get(id: string): VectorMetadata | undefined;
    /**
     * Check if vector exists
     *
     * @param id - Vector ID
     */
    has(id: string): boolean;
    /**
     * Get number of vectors in store
     */
    size(): number;
    /**
     * Get store statistics
     */
    getStats(): {
        totalVectors: number;
        dimensions: number;
        tableName: string;
        backend: string;
    };
    /**
     * Clear all vectors from the store
     */
    clear(): void;
    /**
     * Close the database connection (only if we own it)
     */
    close(): void;
}
/**
 * Get the singleton vector store instance
 */
export declare function getVectorStore(options?: VectorStoreOptions): VectorStore;
//# sourceMappingURL=VectorStore.d.ts.map