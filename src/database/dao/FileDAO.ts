/**
 * FileDAO.ts
 *
 * Data Access Object for files table
 * Provides CRUD operations for indexed code files
 */

import { getDatabase } from '../connection.js';
import { hashContent } from '../../utils/hash.js';
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
export class FileDAO {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db || getDatabase();
  }

  /**
   * Insert a new file
   *
   * @param file - File input data
   * @returns Inserted file ID
   */
  insert(file: FileInput): number {
    const hash = hashContent(file.content);
    const size = Buffer.byteLength(file.content, 'utf8');

    const stmt = this.db.prepare(`
      INSERT INTO files (path, content, hash, size, language)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      file.path,
      file.content,
      hash,
      size,
      file.language || null
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Batch insert multiple files in a single transaction
   * Much faster than individual inserts for large datasets
   *
   * @param files - Array of file inputs
   * @returns Array of inserted file IDs
   */
  insertBatch(files: FileInput[]): number[] {
    const stmt = this.db.prepare(`
      INSERT INTO files (path, content, hash, size, language)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((files: FileInput[]) => {
      const ids: number[] = [];
      for (const file of files) {
        const hash = hashContent(file.content);
        const size = Buffer.byteLength(file.content, 'utf8');

        const result = stmt.run(
          file.path,
          file.content,
          hash,
          size,
          file.language || null
        );

        ids.push(result.lastInsertRowid as number);
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
  findById(id: number): FileRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM files WHERE id = ?');
    return stmt.get(id) as FileRecord | undefined;
  }

  /**
   * Find file by path
   *
   * @param path - File path
   * @returns File record or undefined
   */
  findByPath(path: string): FileRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM files WHERE path = ?');
    return stmt.get(path) as FileRecord | undefined;
  }

  /**
   * Find file by hash
   *
   * @param hash - Content hash
   * @returns File record or undefined
   */
  findByHash(hash: string): FileRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM files WHERE hash = ?');
    return stmt.get(hash) as FileRecord | undefined;
  }

  /**
   * Find files by language
   *
   * @param language - Programming language
   * @returns Array of file records
   */
  findByLanguage(language: string): FileRecord[] {
    const stmt = this.db.prepare('SELECT * FROM files WHERE language = ?');
    return stmt.all(language) as FileRecord[];
  }

  /**
   * Update file by ID
   *
   * @param id - File ID
   * @param update - Fields to update
   * @returns True if updated, false if not found
   */
  update(id: number, update: FileUpdate & { path?: string }): boolean {
    const fields: string[] = [];
    const values: any[] = [];

    if (update.path !== undefined) {
      fields.push('path = ?');
      values.push(update.path);
    }

    if (update.content !== undefined) {
      fields.push('content = ?', 'hash = ?', 'size = ?');
      values.push(
        update.content,
        hashContent(update.content),
        Buffer.byteLength(update.content, 'utf8')
      );
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
  delete(id: number): boolean {
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
  deleteByPath(path: string): boolean {
    const stmt = this.db.prepare('DELETE FROM files WHERE path = ?');
    const result = stmt.run(path);
    return result.changes > 0;
  }

  /**
   * List all files with optional pagination
   * Uses parameterized queries for safety and performance
   *
   * @param limit - Optional limit (default: no limit)
   * @param offset - Optional offset (default: 0)
   * @returns Array of file records
   */
  list(limit?: number, offset?: number): FileRecord[] {
    // Use parameterized query for safety
    if (limit !== undefined && offset !== undefined) {
      const stmt = this.db.prepare('SELECT * FROM files ORDER BY indexed_at DESC LIMIT ? OFFSET ?');
      return stmt.all(limit, offset) as FileRecord[];
    } else if (limit !== undefined) {
      const stmt = this.db.prepare('SELECT * FROM files ORDER BY indexed_at DESC LIMIT ?');
      return stmt.all(limit) as FileRecord[];
    } else {
      const stmt = this.db.prepare('SELECT * FROM files ORDER BY indexed_at DESC');
      return stmt.all() as FileRecord[];
    }
  }

  /**
   * Find all files (alias for list with no limit)
   *
   * @returns Array of all file records
   */
  findAll(): FileRecord[] {
    return this.list();
  }

  /**
   * Count total files
   *
   * @returns Total number of files
   */
  count(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM files');
    const result = stmt.get() as { count: number };
    return result.count;
  }

  /**
   * Check if file exists by path
   *
   * @param path - File path
   * @returns True if exists
   */
  exists(path: string): boolean {
    const stmt = this.db.prepare('SELECT 1 FROM files WHERE path = ? LIMIT 1');
    const result = stmt.get(path);
    return result !== undefined;
  }

  /**
   * Clear all files (for testing)
   *
   * @returns Number of deleted files
   */
  clear(): number {
    const stmt = this.db.prepare('DELETE FROM files');
    const result = stmt.run();
    return result.changes;
  }
}
