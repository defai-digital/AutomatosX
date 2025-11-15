/**
 * ChunkDAO.ts
 *
 * Data Access Object for chunks table
 * Provides CRUD operations and FTS5 full-text search
 */
import Database from 'better-sqlite3';
import type { QueryFilters } from '../../types/QueryFilter.js';
/**
 * Chunk record from database
 */
export interface ChunkRecord {
    id: number;
    file_id: number;
    content: string;
    start_line: number;
    end_line: number;
    chunk_type: string;
    symbol_id: number | null;
    created_at: string;
}
/**
 * Chunk input for insertion
 */
export interface ChunkInput {
    file_id: number;
    content: string;
    start_line: number;
    end_line: number;
    chunk_type: string;
    symbol_id?: number;
}
/**
 * Search result with ranking
 */
export interface ChunkSearchResult extends ChunkRecord {
    rank: number;
    file_path: string;
}
/**
 * ChunkDAO - Data Access Object for chunks table
 */
export declare class ChunkDAO {
    private db;
    constructor(db?: Database.Database);
    /**
     * Insert a new chunk
     *
     * @param chunk - Chunk input data
     * @returns Inserted chunk ID
     */
    insert(chunk: ChunkInput): number;
    /**
     * Insert multiple chunks in a batch
     *
     * @param chunks - Array of chunk inputs
     * @returns Array of inserted IDs
     */
    insertBatch(chunks: ChunkInput[]): number[];
    /**
     * Find chunk by ID
     *
     * @param id - Chunk ID
     * @returns Chunk record or null
     */
    findById(id: number): ChunkRecord | null;
    /**
     * Find all chunks in a file
     *
     * @param fileId - File ID
     * @returns Array of chunk records
     */
    findByFileId(fileId: number): ChunkRecord[];
    /**
     * Find chunks by type
     *
     * @param chunkType - Chunk type (function, class, method, block, file)
     * @returns Array of chunk records
     */
    findByType(chunkType: string): ChunkRecord[];
    /**
     * Full-text search using FTS5 with BM25 ranking
     *
     * @param query - Search query (supports FTS5 syntax)
     * @param limit - Maximum results (default: 10)
     * @param filters - Optional query filters for language and file patterns
     * @returns Array of chunk search results with ranking
     */
    search(query: string, limit?: number, filters?: QueryFilters): ChunkSearchResult[];
    /**
     * Search with chunk type filter
     *
     * @param query - Search query
     * @param chunkType - Filter by chunk type
     * @param limit - Maximum results
     * @returns Array of chunk search results
     */
    searchByType(query: string, chunkType: string, limit?: number): ChunkSearchResult[];
    /**
     * Get chunk with file information
     *
     * @param id - Chunk ID
     * @returns Chunk with file path
     */
    findWithFile(id: number): (ChunkRecord & {
        file_path: string;
    }) | null;
    /**
     * Delete chunk by ID
     *
     * @param id - Chunk ID
     * @returns True if deleted, false if not found
     */
    delete(id: number): boolean;
    /**
     * Delete all chunks for a file
     *
     * @param fileId - File ID
     * @returns Number of deleted chunks
     */
    deleteByFileId(fileId: number): number;
    /**
     * Count total chunks
     *
     * @returns Total number of chunks
     */
    count(): number;
    /**
     * Count chunks by type
     *
     * @returns Object with counts per type
     */
    countByType(): Record<string, number>;
    /**
     * Clear all chunks (for testing)
     *
     * @returns Number of deleted chunks
     */
    clear(): number;
    /**
     * Optimize FTS5 index (rebuild for better performance)
     * Run this periodically or after bulk inserts
     */
    optimizeFTS(): void;
    /**
     * Get FTS5 index statistics
     *
     * @returns Index statistics
     */
    getFTSStats(): {
        total_rows: number;
        total_bytes: number;
    };
}
//# sourceMappingURL=ChunkDAO.d.ts.map