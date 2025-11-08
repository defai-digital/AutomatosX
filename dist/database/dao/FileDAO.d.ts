/**
 * FileDAO.ts
 *
 * Data Access Object for files table
 * Provides CRUD operations for indexed code files
 */
import Database from 'better-sqlite3';
/**
 * File record from database
 */
export interface FileRecord {
    id: number;
    path: string;
    content: string;
    hash: string;
    size: number;
    language: string | null;
    indexed_at: string;
    updated_at: string;
}
/**
 * File input for insertion (auto-generates id, hash, size, timestamps)
 */
export interface FileInput {
    path: string;
    content: string;
    language?: string;
}
/**
 * File update input (partial updates)
 */
export interface FileUpdate {
    content?: string;
    language?: string;
}
/**
 * FileDAO - Data Access Object for files table
 */
export declare class FileDAO {
    private db;
    constructor(db?: Database.Database);
    /**
     * Insert a new file
     *
     * @param file - File input data
     * @returns Inserted file ID
     */
    insert(file: FileInput): number;
    /**
     * Batch insert multiple files in a single transaction
     * Much faster than individual inserts for large datasets
     *
     * @param files - Array of file inputs
     * @returns Array of inserted file IDs
     */
    insertBatch(files: FileInput[]): number[];
    /**
     * Find file by ID
     *
     * @param id - File ID
     * @returns File record or undefined
     */
    findById(id: number): FileRecord | undefined;
    /**
     * Find file by path
     *
     * @param path - File path
     * @returns File record or undefined
     */
    findByPath(path: string): FileRecord | undefined;
    /**
     * Find file by hash
     *
     * @param hash - Content hash
     * @returns File record or undefined
     */
    findByHash(hash: string): FileRecord | undefined;
    /**
     * Find files by language
     *
     * @param language - Programming language
     * @returns Array of file records
     */
    findByLanguage(language: string): FileRecord[];
    /**
     * Update file by ID
     *
     * @param id - File ID
     * @param update - Fields to update
     * @returns True if updated, false if not found
     */
    update(id: number, update: FileUpdate & {
        path?: string;
    }): boolean;
    /**
     * Delete file by ID
     *
     * @param id - File ID
     * @returns True if deleted, false if not found
     */
    delete(id: number): boolean;
    /**
     * Delete file by path
     *
     * @param path - File path
     * @returns True if deleted, false if not found
     */
    deleteByPath(path: string): boolean;
    /**
     * List all files
     *
     * @param limit - Optional limit
     * @param offset - Optional offset
     * @returns Array of file records
     */
    list(limit?: number, offset?: number): FileRecord[];
    /**
     * Find all files (alias for list with no limit)
     *
     * @returns Array of all file records
     */
    findAll(): FileRecord[];
    /**
     * Count total files
     *
     * @returns Total number of files
     */
    count(): number;
    /**
     * Check if file exists by path
     *
     * @param path - File path
     * @returns True if exists
     */
    exists(path: string): boolean;
    /**
     * Clear all files (for testing)
     *
     * @returns Number of deleted files
     */
    clear(): number;
}
//# sourceMappingURL=FileDAO.d.ts.map