/**
 * SymbolDAO.ts
 *
 * Data Access Object for symbols table
 * Provides CRUD operations for code symbols extracted from files
 */
import { getDatabase } from '../connection.js';
/**
 * SymbolDAO - Data Access Object for symbols table
 */
export class SymbolDAO {
    db;
    constructor() {
        this.db = getDatabase();
    }
    /**
     * Insert a new symbol
     *
     * @param symbol - Symbol input data
     * @returns Inserted symbol ID
     */
    insert(symbol) {
        const stmt = this.db.prepare(`
      INSERT INTO symbols (file_id, name, kind, line, column, end_line, end_column)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(symbol.file_id, symbol.name, symbol.kind, symbol.line, symbol.column, symbol.end_line || null, symbol.end_column || null);
        return result.lastInsertRowid;
    }
    /**
     * Insert multiple symbols in a batch
     *
     * @param symbols - Array of symbol inputs
     * @returns Array of inserted IDs
     */
    insertBatch(symbols) {
        const stmt = this.db.prepare(`
      INSERT INTO symbols (file_id, name, kind, line, column, end_line, end_column)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        const ids = [];
        const transaction = this.db.transaction((symbols) => {
            for (const symbol of symbols) {
                const result = stmt.run(symbol.file_id, symbol.name, symbol.kind, symbol.line, symbol.column, symbol.end_line || null, symbol.end_column || null);
                ids.push(result.lastInsertRowid);
            }
        });
        transaction(symbols);
        return ids;
    }
    /**
     * Find symbol by ID
     *
     * @param id - Symbol ID
     * @returns Symbol record or null
     */
    findById(id) {
        const stmt = this.db.prepare('SELECT * FROM symbols WHERE id = ?');
        return stmt.get(id) || null;
    }
    /**
     * Find all symbols in a file
     *
     * @param fileId - File ID
     * @returns Array of symbol records
     */
    findByFileId(fileId) {
        const stmt = this.db.prepare('SELECT * FROM symbols WHERE file_id = ? ORDER BY line, column');
        return stmt.all(fileId);
    }
    /**
     * Find symbols by name
     *
     * @param name - Symbol name
     * @returns Array of symbol records
     */
    findByName(name) {
        const stmt = this.db.prepare('SELECT * FROM symbols WHERE name = ?');
        return stmt.all(name);
    }
    /**
     * Find symbols by kind
     *
     * @param kind - Symbol kind (function, class, etc.)
     * @returns Array of symbol records
     */
    findByKind(kind) {
        const stmt = this.db.prepare('SELECT * FROM symbols WHERE kind = ?');
        return stmt.all(kind);
    }
    /**
     * Find symbols by name and kind
     *
     * @param name - Symbol name
     * @param kind - Symbol kind
     * @returns Array of symbol records
     */
    findByNameAndKind(name, kind) {
        const stmt = this.db.prepare('SELECT * FROM symbols WHERE name = ? AND kind = ?');
        return stmt.all(name, kind);
    }
    /**
     * Search symbols by name pattern (LIKE query)
     *
     * @param pattern - Name pattern (e.g., "get%")
     * @returns Array of symbol records
     */
    searchByName(pattern) {
        const stmt = this.db.prepare('SELECT * FROM symbols WHERE name LIKE ?');
        return stmt.all(pattern);
    }
    /**
     * Find all symbols (compatibility method for LSP)
     *
     * @param limit - Optional limit on results
     * @returns Array of symbol records
     */
    findAll(limit) {
        const query = limit ? 'SELECT * FROM symbols LIMIT ?' : 'SELECT * FROM symbols';
        const stmt = this.db.prepare(query);
        return (limit ? stmt.all(limit) : stmt.all());
    }
    /**
     * Find symbols by file path (compatibility method for LSP)
     *
     * @param filePath - File path
     * @returns Array of symbol records
     */
    findByFile(filePath) {
        // First get the file ID
        const fileStmt = this.db.prepare('SELECT id FROM files WHERE file_path = ?');
        const fileRecord = fileStmt.get(filePath);
        if (!fileRecord)
            return [];
        return this.findByFileId(fileRecord.id);
    }
    /**
     * Delete symbol by ID
     *
     * @param id - Symbol ID
     * @returns True if deleted, false if not found
     */
    delete(id) {
        const stmt = this.db.prepare('DELETE FROM symbols WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
    /**
     * Delete all symbols for a file
     *
     * @param fileId - File ID
     * @returns Number of deleted symbols
     */
    deleteByFileId(fileId) {
        const stmt = this.db.prepare('DELETE FROM symbols WHERE file_id = ?');
        const result = stmt.run(fileId);
        return result.changes;
    }
    /**
     * Count total symbols
     *
     * @returns Total number of symbols
     */
    count() {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM symbols');
        const result = stmt.get();
        return result.count;
    }
    /**
     * Count symbols by kind
     *
     * @returns Object with counts per kind
     */
    countByKind() {
        const stmt = this.db.prepare('SELECT kind, COUNT(*) as count FROM symbols GROUP BY kind');
        const rows = stmt.all();
        const counts = {};
        for (const row of rows) {
            counts[row.kind] = row.count;
        }
        return counts;
    }
    /**
     * Get symbols with file information (JOIN query)
     *
     * @param name - Symbol name
     * @param filters - Optional query filters for language, kind, and file patterns
     * @returns Symbols with file path and language
     */
    findWithFile(name, filters) {
        const whereClauses = ['s.name = ?'];
        const params = [name];
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
            // Kind filters (include)
            if (filters.kinds.length > 0) {
                const placeholders = filters.kinds.map(() => '?').join(', ');
                whereClauses.push(`s.kind IN (${placeholders})`);
                params.push(...filters.kinds);
            }
            // Kind filters (exclude)
            if (filters.excludeKinds.length > 0) {
                const placeholders = filters.excludeKinds.map(() => '?').join(', ');
                whereClauses.push(`s.kind NOT IN (${placeholders})`);
                params.push(...filters.excludeKinds);
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
        }
        const sql = `
      SELECT s.*, f.path as file_path, f.language
      FROM symbols s
      JOIN files f ON s.file_id = f.id
      WHERE ${whereClauses.join(' AND ')}
    `;
        const stmt = this.db.prepare(sql);
        return stmt.all(...params);
    }
    /**
     * Clear all symbols (for testing)
     *
     * @returns Number of deleted symbols
     */
    clear() {
        const stmt = this.db.prepare('DELETE FROM symbols');
        const result = stmt.run();
        return result.changes;
    }
}
//# sourceMappingURL=SymbolDAO.js.map