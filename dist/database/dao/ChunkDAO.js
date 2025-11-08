/**
 * ChunkDAO.ts
 *
 * Data Access Object for chunks table
 * Provides CRUD operations and FTS5 full-text search
 */
import { getDatabase } from '../connection.js';
/**
 * ChunkDAO - Data Access Object for chunks table
 */
export class ChunkDAO {
    db;
    constructor(db) {
        this.db = db || getDatabase();
    }
    /**
     * Insert a new chunk
     *
     * @param chunk - Chunk input data
     * @returns Inserted chunk ID
     */
    insert(chunk) {
        const stmt = this.db.prepare(`
      INSERT INTO chunks (file_id, content, start_line, end_line, chunk_type, symbol_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(chunk.file_id, chunk.content, chunk.start_line, chunk.end_line, chunk.chunk_type, chunk.symbol_id || null);
        return result.lastInsertRowid;
    }
    /**
     * Insert multiple chunks in a batch
     *
     * @param chunks - Array of chunk inputs
     * @returns Array of inserted IDs
     */
    insertBatch(chunks) {
        const stmt = this.db.prepare(`
      INSERT INTO chunks (file_id, content, start_line, end_line, chunk_type, symbol_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        const ids = [];
        const transaction = this.db.transaction((chunks) => {
            for (const chunk of chunks) {
                const result = stmt.run(chunk.file_id, chunk.content, chunk.start_line, chunk.end_line, chunk.chunk_type, chunk.symbol_id || null);
                ids.push(result.lastInsertRowid);
            }
        });
        transaction(chunks);
        return ids;
    }
    /**
     * Find chunk by ID
     *
     * @param id - Chunk ID
     * @returns Chunk record or null
     */
    findById(id) {
        const stmt = this.db.prepare('SELECT * FROM chunks WHERE id = ?');
        return stmt.get(id) || null;
    }
    /**
     * Find all chunks in a file
     *
     * @param fileId - File ID
     * @returns Array of chunk records
     */
    findByFileId(fileId) {
        const stmt = this.db.prepare('SELECT * FROM chunks WHERE file_id = ? ORDER BY start_line');
        return stmt.all(fileId);
    }
    /**
     * Find chunks by type
     *
     * @param chunkType - Chunk type (function, class, method, block, file)
     * @returns Array of chunk records
     */
    findByType(chunkType) {
        const stmt = this.db.prepare('SELECT * FROM chunks WHERE chunk_type = ?');
        return stmt.all(chunkType);
    }
    /**
     * Full-text search using FTS5 with BM25 ranking
     *
     * @param query - Search query (supports FTS5 syntax)
     * @param limit - Maximum results (default: 10)
     * @param filters - Optional query filters for language and file patterns
     * @returns Array of chunk search results with ranking
     */
    search(query, limit = 10, filters) {
        const whereClauses = ['fts.content MATCH ?'];
        const params = [query];
        // Apply filters if provided
        if (filters) {
            // Language filters (include)
            if (filters.languages.length > 0) {
                const placeholders = filters.languages.map(() => '?').join(', ');
                whereClauses.push(`f.language IN (${placeholders})`);
                params.push(...filters.languages);
            }
            // Language filters (exclude)
            if (filters.excludeLanguages.length > 0) {
                const placeholders = filters.excludeLanguages.map(() => '?').join(', ');
                whereClauses.push(`(f.language IS NULL OR f.language NOT IN (${placeholders}))`);
                params.push(...filters.excludeLanguages);
            }
            // File pattern filters (include)
            if (filters.filePatterns.length > 0) {
                const fileConditions = filters.filePatterns.map(() => 'f.path GLOB ?').join(' OR ');
                whereClauses.push(`(${fileConditions})`);
                params.push(...filters.filePatterns);
            }
            // File pattern filters (exclude)
            if (filters.excludeFiles.length > 0) {
                const fileConditions = filters.excludeFiles.map(() => 'f.path NOT GLOB ?').join(' AND ');
                whereClauses.push(`(${fileConditions})`);
                params.push(...filters.excludeFiles);
            }
            // Kind filters map to chunk_type
            if (filters.kinds.length > 0) {
                const placeholders = filters.kinds.map(() => '?').join(', ');
                whereClauses.push(`c.chunk_type IN (${placeholders})`);
                params.push(...filters.kinds);
            }
            // Exclude kinds
            if (filters.excludeKinds.length > 0) {
                const placeholders = filters.excludeKinds.map(() => '?').join(', ');
                whereClauses.push(`c.chunk_type NOT IN (${placeholders})`);
                params.push(...filters.excludeKinds);
            }
        }
        const sql = `
      SELECT
        c.*,
        fts.rank,
        f.path as file_path
      FROM chunks_fts fts
      JOIN chunks c ON c.id = fts.rowid
      JOIN files f ON c.file_id = f.id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY fts.rank
      LIMIT ?
    `;
        params.push(limit);
        const stmt = this.db.prepare(sql);
        return stmt.all(...params);
    }
    /**
     * Search with chunk type filter
     *
     * @param query - Search query
     * @param chunkType - Filter by chunk type
     * @param limit - Maximum results
     * @returns Array of chunk search results
     */
    searchByType(query, chunkType, limit = 10) {
        const stmt = this.db.prepare(`
      SELECT
        c.*,
        fts.rank,
        f.path as file_path
      FROM chunks_fts fts
      JOIN chunks c ON c.id = fts.rowid
      JOIN files f ON c.file_id = f.id
      WHERE fts.content MATCH ? AND c.chunk_type = ?
      ORDER BY fts.rank
      LIMIT ?
    `);
        return stmt.all(query, chunkType, limit);
    }
    /**
     * Get chunk with file information
     *
     * @param id - Chunk ID
     * @returns Chunk with file path
     */
    findWithFile(id) {
        const stmt = this.db.prepare(`
      SELECT c.*, f.path as file_path
      FROM chunks c
      JOIN files f ON c.file_id = f.id
      WHERE c.id = ?
    `);
        return stmt.get(id) || null;
    }
    /**
     * Delete chunk by ID
     *
     * @param id - Chunk ID
     * @returns True if deleted, false if not found
     */
    delete(id) {
        const stmt = this.db.prepare('DELETE FROM chunks WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
    /**
     * Delete all chunks for a file
     *
     * @param fileId - File ID
     * @returns Number of deleted chunks
     */
    deleteByFileId(fileId) {
        const stmt = this.db.prepare('DELETE FROM chunks WHERE file_id = ?');
        const result = stmt.run(fileId);
        return result.changes;
    }
    /**
     * Count total chunks
     *
     * @returns Total number of chunks
     */
    count() {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM chunks');
        const result = stmt.get();
        return result.count;
    }
    /**
     * Count chunks by type
     *
     * @returns Object with counts per type
     */
    countByType() {
        const stmt = this.db.prepare('SELECT chunk_type, COUNT(*) as count FROM chunks GROUP BY chunk_type');
        const rows = stmt.all();
        const counts = {};
        for (const row of rows) {
            counts[row.chunk_type] = row.count;
        }
        return counts;
    }
    /**
     * Clear all chunks (for testing)
     *
     * @returns Number of deleted chunks
     */
    clear() {
        const stmt = this.db.prepare('DELETE FROM chunks');
        const result = stmt.run();
        return result.changes;
    }
    /**
     * Optimize FTS5 index (rebuild for better performance)
     * Run this periodically or after bulk inserts
     */
    optimizeFTS() {
        this.db.prepare("INSERT INTO chunks_fts(chunks_fts) VALUES('optimize')").run();
    }
    /**
     * Get FTS5 index statistics
     *
     * @returns Index statistics
     */
    getFTSStats() {
        const stmt = this.db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM chunks_fts) as total_rows,
        (SELECT SUM(LENGTH(content)) FROM chunks) as total_bytes
    `);
        return stmt.get();
    }
}
//# sourceMappingURL=ChunkDAO.js.map