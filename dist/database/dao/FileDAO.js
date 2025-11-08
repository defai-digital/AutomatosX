/**
 * FileDAO.ts
 *
 * Data Access Object for files table
 * Provides CRUD operations for indexed code files
 */
import { getDatabase } from '../connection.js';
import { hashContent } from '../../utils/hash.js';
/**
 * FileDAO - Data Access Object for files table
 */
export class FileDAO {
    db;
    constructor(db) {
        this.db = db || getDatabase();
    }
    /**
     * Insert a new file
     *
     * @param file - File input data
     * @returns Inserted file ID
     */
    insert(file) {
        const hash = hashContent(file.content);
        const size = Buffer.byteLength(file.content, 'utf8');
        const stmt = this.db.prepare(`
      INSERT INTO files (path, content, hash, size, language)
      VALUES (?, ?, ?, ?, ?)
    `);
        const result = stmt.run(file.path, file.content, hash, size, file.language || null);
        return result.lastInsertRowid;
    }
    /**
     * Batch insert multiple files in a single transaction
     * Much faster than individual inserts for large datasets
     *
     * @param files - Array of file inputs
     * @returns Array of inserted file IDs
     */
    insertBatch(files) {
        const stmt = this.db.prepare(`
      INSERT INTO files (path, content, hash, size, language)
      VALUES (?, ?, ?, ?, ?)
    `);
        const insertMany = this.db.transaction((files) => {
            const ids = [];
            for (const file of files) {
                const hash = hashContent(file.content);
                const size = Buffer.byteLength(file.content, 'utf8');
                const result = stmt.run(file.path, file.content, hash, size, file.language || null);
                ids.push(result.lastInsertRowid);
            }
            return ids;
        });
        return insertMany(files);
    }
    /**
     * Find file by ID
     *
     * @param id - File ID
     * @returns File record or undefined
     */
    findById(id) {
        const stmt = this.db.prepare('SELECT * FROM files WHERE id = ?');
        return stmt.get(id);
    }
    /**
     * Find file by path
     *
     * @param path - File path
     * @returns File record or undefined
     */
    findByPath(path) {
        const stmt = this.db.prepare('SELECT * FROM files WHERE path = ?');
        return stmt.get(path);
    }
    /**
     * Find file by hash
     *
     * @param hash - Content hash
     * @returns File record or undefined
     */
    findByHash(hash) {
        const stmt = this.db.prepare('SELECT * FROM files WHERE hash = ?');
        return stmt.get(hash);
    }
    /**
     * Find files by language
     *
     * @param language - Programming language
     * @returns Array of file records
     */
    findByLanguage(language) {
        const stmt = this.db.prepare('SELECT * FROM files WHERE language = ?');
        return stmt.all(language);
    }
    /**
     * Update file by ID
     *
     * @param id - File ID
     * @param update - Fields to update
     * @returns True if updated, false if not found
     */
    update(id, update) {
        const fields = [];
        const values = [];
        if (update.path !== undefined) {
            fields.push('path = ?');
            values.push(update.path);
        }
        if (update.content !== undefined) {
            fields.push('content = ?', 'hash = ?', 'size = ?');
            values.push(update.content, hashContent(update.content), Buffer.byteLength(update.content, 'utf8'));
        }
        if (update.language !== undefined) {
            fields.push('language = ?');
            values.push(update.language);
        }
        if (fields.length === 0) {
            return false; // Nothing to update
        }
        // Always update updated_at
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id); // WHERE id = ?
        const stmt = this.db.prepare(`
      UPDATE files
      SET ${fields.join(', ')}
      WHERE id = ?
    `);
        const result = stmt.run(...values);
        return result.changes > 0;
    }
    /**
     * Delete file by ID
     *
     * @param id - File ID
     * @returns True if deleted, false if not found
     */
    delete(id) {
        const stmt = this.db.prepare('DELETE FROM files WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
    /**
     * Delete file by path
     *
     * @param path - File path
     * @returns True if deleted, false if not found
     */
    deleteByPath(path) {
        const stmt = this.db.prepare('DELETE FROM files WHERE path = ?');
        const result = stmt.run(path);
        return result.changes > 0;
    }
    /**
     * List all files
     *
     * @param limit - Optional limit
     * @param offset - Optional offset
     * @returns Array of file records
     */
    list(limit, offset) {
        let sql = 'SELECT * FROM files ORDER BY indexed_at DESC';
        if (limit !== undefined) {
            sql += ` LIMIT ${limit}`;
        }
        if (offset !== undefined) {
            sql += ` OFFSET ${offset}`;
        }
        const stmt = this.db.prepare(sql);
        return stmt.all();
    }
    /**
     * Find all files (alias for list with no limit)
     *
     * @returns Array of all file records
     */
    findAll() {
        return this.list();
    }
    /**
     * Count total files
     *
     * @returns Total number of files
     */
    count() {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM files');
        const result = stmt.get();
        return result.count;
    }
    /**
     * Check if file exists by path
     *
     * @param path - File path
     * @returns True if exists
     */
    exists(path) {
        const stmt = this.db.prepare('SELECT 1 FROM files WHERE path = ? LIMIT 1');
        const result = stmt.get(path);
        return result !== undefined;
    }
    /**
     * Clear all files (for testing)
     *
     * @returns Number of deleted files
     */
    clear() {
        const stmt = this.db.prepare('DELETE FROM files');
        const result = stmt.run();
        return result.changes;
    }
}
//# sourceMappingURL=FileDAO.js.map