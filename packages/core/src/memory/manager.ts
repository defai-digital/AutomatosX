/**
 * Memory Manager - FTS5-based persistent memory system
 *
 * Provides fast full-text search using SQLite FTS5 for agent memory.
 * All data is stored locally for privacy.
 *
 * @module @ax/core/memory
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

// =============================================================================
// Database Constants
// =============================================================================

/** SQLite cache size in KB (negative = KB, so -64000 = 64MB) */
const DB_CACHE_SIZE_KB = -64000;

/** Default maximum memory entries before cleanup */
const DEFAULT_MAX_ENTRIES = 10000;

/** Hybrid cleanup strategy weights (must sum to 1.0) */
const HYBRID_CLEANUP_AGE_WEIGHT = 0.4;
const HYBRID_CLEANUP_ACCESS_WEIGHT = 0.3;
const HYBRID_CLEANUP_IMPORTANCE_WEIGHT = 0.3;

/** Default search parameters */
const DEFAULT_SEARCH_LIMIT = 10;
const DEFAULT_SEARCH_OFFSET = 0;

/** Default limit for top tags in stats */
const DEFAULT_TOP_TAGS_LIMIT = 20;

/** Default metadata fallback values for corrupted entries */
const DEFAULT_METADATA_TYPE = 'document';
const DEFAULT_METADATA_SOURCE = 'unknown';
const DEFAULT_METADATA_IMPORTANCE = 0;

// =============================================================================
// Imports
// =============================================================================

import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import {
  type MemoryEntry,
  type MemoryMetadata,
  type MemorySearchOptions,
  type MemorySearchResult,
  type MemoryAddInput,
  type MemoryCleanupConfig,
  type MemoryCleanupResult,
  type MemoryStats,
  type CleanupStrategy,
  MemoryEntrySchema,
  MemoryCleanupConfigSchema,
} from '@ax/schemas';

// =============================================================================
// Types
// =============================================================================

export interface MemoryManagerOptions {
  /** Path to SQLite database file */
  databasePath: string;
  /** Maximum entries before triggering cleanup */
  maxEntries?: number;
  /** Cleanup configuration */
  cleanupConfig?: Partial<MemoryCleanupConfig>;
}

interface RawMemoryRow {
  id: number;
  content: string;
  metadata: string;
  created_at: string;
  last_accessed_at: string | null;
  access_count: number;
  rank?: number;
}

// =============================================================================
// Memory Manager Class
// =============================================================================

export class MemoryManager {
  private readonly db: DatabaseType;
  private readonly maxEntries: number;
  private readonly cleanupConfig: MemoryCleanupConfig;
  private cleanupInProgress = false; // Prevent concurrent cleanup operations

  // Prepared statements for performance
  private readonly stmtInsert: Database.Statement;
  private readonly stmtSearch: Database.Statement;
  private readonly stmtGetById: Database.Statement;
  private readonly stmtUpdateAccess: Database.Statement;
  private readonly stmtDelete: Database.Statement;
  private readonly stmtCount: Database.Statement;

  constructor(options: MemoryManagerOptions) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.cleanupConfig = MemoryCleanupConfigSchema.parse(options.cleanupConfig ?? {});

    // Initialize database
    this.db = new Database(options.databasePath);
    this.initialize();

    // Prepare statements
    this.stmtInsert = this.db.prepare(`
      INSERT INTO memories (content, metadata)
      VALUES (?, ?)
    `);

    this.stmtSearch = this.db.prepare(`
      SELECT m.*, bm25(memories_fts) as rank
      FROM memories m
      JOIN memories_fts ON m.id = memories_fts.rowid
      WHERE memories_fts MATCH ?
      ORDER BY rank
      LIMIT ? OFFSET ?
    `);

    this.stmtGetById = this.db.prepare(`
      SELECT * FROM memories WHERE id = ?
    `);

    this.stmtUpdateAccess = this.db.prepare(`
      UPDATE memories
      SET access_count = access_count + 1,
          last_accessed_at = datetime('now')
      WHERE id = ?
    `);

    this.stmtDelete = this.db.prepare(`
      DELETE FROM memories WHERE id = ?
    `);

    this.stmtCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM memories
    `);
  }

  /**
   * Initialize database schema
   */
  private initialize(): void {
    // Enable WAL mode for better concurrent access
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma(`cache_size = ${DB_CACHE_SIZE_KB}`); // 64MB cache
    this.db.pragma('temp_store = MEMORY');

    // Create tables
    this.db.exec(`
      -- Main memories table
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        metadata TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        last_accessed_at TEXT,
        access_count INTEGER DEFAULT 0
      );

      -- FTS5 virtual table for full-text search
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts
        USING fts5(
          content,
          metadata,
          content=memories,
          content_rowid=id,
          tokenize='porter unicode61'
        );

      -- Triggers to keep FTS in sync
      CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, content, metadata)
        VALUES (new.id, new.content, new.metadata);
      END;

      CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, content, metadata)
        VALUES ('delete', old.id, old.content, old.metadata);
      END;

      CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, content, metadata)
        VALUES ('delete', old.id, old.content, old.metadata);
        INSERT INTO memories_fts(rowid, content, metadata)
        VALUES (new.id, new.content, new.metadata);
      END;

      -- Indexes for common queries
      CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);
      CREATE INDEX IF NOT EXISTS idx_memories_accessed ON memories(last_accessed_at);
      CREATE INDEX IF NOT EXISTS idx_memories_access_count ON memories(access_count);
    `);
  }

  /** Maximum allowed metadata size in bytes (1MB) */
  private static readonly MAX_METADATA_SIZE = 1_000_000;

  /** SQL expression for extracting importance from metadata JSON */
  private static readonly IMPORTANCE_SQL =
    "COALESCE(CAST(json_extract(metadata, '$.importance') AS REAL), 0)";

  /**
   * Validate metadata size to prevent database issues
   */
  private validateMetadataSize(serialized: string): void {
    if (serialized.length > MemoryManager.MAX_METADATA_SIZE) {
      throw new Error(
        `Metadata size (${serialized.length} bytes) exceeds maximum allowed (${MemoryManager.MAX_METADATA_SIZE} bytes)`
      );
    }
  }

  /**
   * Safely convert SQLite rowid (number | bigint) to number
   * Warns if precision could be lost for very large IDs
   */
  private safeRowId(rowid: number | bigint): number {
    if (typeof rowid === 'bigint') {
      if (rowid > BigInt(Number.MAX_SAFE_INTEGER)) {
        console.warn(
          `[ax/memory] Row ID ${rowid} exceeds MAX_SAFE_INTEGER, precision may be lost`
        );
      }
      return Number(rowid);
    }
    return rowid;
  }

  /**
   * Add a new memory entry
   */
  add(input: MemoryAddInput): number {
    const { content, metadata } = input;
    const serializedMetadata = JSON.stringify(metadata);
    this.validateMetadataSize(serializedMetadata);

    const result = this.stmtInsert.run(content, serializedMetadata);

    // Check if cleanup is needed
    if (this.cleanupConfig.enabled) {
      this.maybeCleanup();
    }

    return this.safeRowId(result.lastInsertRowid);
  }

  /**
   * Add multiple memory entries in a transaction
   */
  addBatch(inputs: MemoryAddInput[]): number[] {
    const ids: number[] = [];

    const insertMany = this.db.transaction((entries: MemoryAddInput[]) => {
      for (const entry of entries) {
        const serializedMetadata = JSON.stringify(entry.metadata);
        this.validateMetadataSize(serializedMetadata);

        const result = this.stmtInsert.run(entry.content, serializedMetadata);
        ids.push(this.safeRowId(result.lastInsertRowid));
      }
    });

    insertMany(inputs);

    if (this.cleanupConfig.enabled) {
      this.maybeCleanup();
    }

    return ids;
  }

  /**
   * Search memories using FTS5
   */
  search(options: MemorySearchOptions): MemorySearchResult {
    const start = performance.now();
    const { query, limit = DEFAULT_SEARCH_LIMIT, offset = DEFAULT_SEARCH_OFFSET, filter } = options;

    // Sanitize query for FTS5
    const sanitizedQuery = this.sanitizeQuery(query);

    if (!sanitizedQuery) {
      return {
        entries: [],
        total: 0,
        duration: Math.round(performance.now() - start),
        query,
        hasMore: false,
      };
    }

    // Build dynamic query with filters
    let sql = `
      SELECT m.*, bm25(memories_fts) as rank
      FROM memories m
      JOIN memories_fts ON m.id = memories_fts.rowid
      WHERE memories_fts MATCH ?
    `;
    const params: (string | number)[] = [sanitizedQuery];

    // Apply filters
    if (filter?.type) {
      sql += ` AND json_extract(m.metadata, '$.type') = ?`;
      params.push(filter.type);
    }

    if (filter?.agentId) {
      sql += ` AND json_extract(m.metadata, '$.agentId') = ?`;
      params.push(filter.agentId);
    }

    if (filter?.sessionId) {
      sql += ` AND json_extract(m.metadata, '$.sessionId') = ?`;
      params.push(filter.sessionId);
    }

    if (filter?.source) {
      sql += ` AND json_extract(m.metadata, '$.source') = ?`;
      params.push(filter.source);
    }

    if (filter?.minImportance !== undefined) {
      sql += ` AND CAST(json_extract(m.metadata, '$.importance') AS REAL) >= ?`;
      params.push(filter.minImportance);
    }

    if (filter?.createdAfter) {
      sql += ` AND m.created_at >= ?`;
      params.push(filter.createdAfter.toISOString());
    }

    if (filter?.createdBefore) {
      sql += ` AND m.created_at <= ?`;
      params.push(filter.createdBefore.toISOString());
    }

    // Filter by tags (match ANY of the specified tags)
    if (filter?.tags && filter.tags.length > 0) {
      sql += ` AND EXISTS (
        SELECT 1 FROM json_each(json_extract(m.metadata, '$.tags'))
        WHERE value IN (${filter.tags.map(() => '?').join(',')})
      )`;
      params.push(...filter.tags);
    }

    // Filter by tagsAll (match ALL of the specified tags)
    if (filter?.tagsAll && filter.tagsAll.length > 0) {
      for (const tag of filter.tagsAll) {
        sql += ` AND EXISTS (
          SELECT 1 FROM json_each(json_extract(m.metadata, '$.tags'))
          WHERE value = ?
        )`;
        params.push(tag);
      }
    }

    // Filter by minimum access count
    if (filter?.minAccessCount !== undefined) {
      sql += ` AND m.access_count >= ?`;
      params.push(filter.minAccessCount);
    }

    // Get total count
    // Use replaceAll() to ensure all occurrences are replaced (replace() only replaces first)
    const countSql = sql.replaceAll('SELECT m.*, bm25(memories_fts) as rank', 'SELECT COUNT(*) as count');
    const countStmt = this.db.prepare(countSql);
    const countResult = countStmt.get(...params) as { count: number } | undefined;
    // Handle case where query returns no result (defensive)
    const total = countResult?.count ?? 0;

    // Add ordering and pagination
    sql += ` ORDER BY rank LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as RawMemoryRow[];

    // Update access tracking
    if (rows.length > 0) {
      this.updateAccessTracking(rows.map((r) => r.id));
    }

    const entries = rows.map((row) => this.rowToEntry(row));
    const duration = Math.round(performance.now() - start);

    return {
      entries,
      total,
      duration,
      query,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Get a memory entry by ID
   */
  getById(id: number): MemoryEntry | null {
    const row = this.stmtGetById.get(id) as RawMemoryRow | undefined;
    if (!row) return null;

    this.stmtUpdateAccess.run(id);
    return this.rowToEntry(row);
  }

  /**
   * Delete a memory entry
   */
  delete(id: number): boolean {
    const result = this.stmtDelete.run(id);
    return result.changes > 0;
  }

  /**
   * Delete multiple entries
   */
  deleteBatch(ids: number[]): number {
    const deleteMany = this.db.transaction((idsToDelete: number[]) => {
      let deleted = 0;
      for (const id of idsToDelete) {
        const result = this.stmtDelete.run(id);
        deleted += result.changes;
      }
      return deleted;
    });

    return deleteMany(ids);
  }

  /**
   * Get entry count
   */
  getCount(): number {
    const result = this.stmtCount.get() as { count: number };
    return result.count;
  }

  /**
   * Get memory statistics
   */
  getStats(): MemoryStats {
    const stats = this.db
      .prepare(
        `
      SELECT
        COUNT(*) as totalEntries,
        MIN(created_at) as oldestEntry,
        MAX(created_at) as newestEntry,
        AVG(LENGTH(content)) as avgContentLength,
        SUM(access_count) as totalAccessCount
      FROM memories
    `
      )
      .get() as {
      totalEntries: number;
      oldestEntry: string | null;
      newestEntry: string | null;
      avgContentLength: number | null; // NULL when database is empty
      totalAccessCount: number | null; // NULL when database is empty
    };

    // Get entries by type
    const typeStats = this.db
      .prepare(
        `
      SELECT json_extract(metadata, '$.type') as type, COUNT(*) as count
      FROM memories
      GROUP BY json_extract(metadata, '$.type')
    `
      )
      .all() as Array<{ type: string; count: number }>;

    const entriesByType: Record<string, number> = {};
    for (const row of typeStats) {
      if (row.type) {
        entriesByType[row.type] = row.count;
      }
    }

    // Get top tags
    const tagStats = this.db
      .prepare(
        `
      SELECT value as tag, COUNT(*) as count
      FROM memories, json_each(json_extract(metadata, '$.tags'))
      GROUP BY value
      ORDER BY count DESC
      LIMIT ${DEFAULT_TOP_TAGS_LIMIT}
    `
      )
      .all() as Array<{ tag: string; count: number }>;

    // Get database size
    const pageCount = this.db.pragma('page_count', { simple: true }) as number;
    const pageSize = this.db.pragma('page_size', { simple: true }) as number;
    const databaseSizeBytes = pageCount * pageSize;

    return {
      totalEntries: stats.totalEntries,
      entriesByType: entriesByType as MemoryStats['entriesByType'],
      databaseSizeBytes,
      oldestEntry: stats.oldestEntry ? new Date(stats.oldestEntry) : undefined,
      newestEntry: stats.newestEntry ? new Date(stats.newestEntry) : undefined,
      avgContentLength: stats.avgContentLength ?? 0,
      totalAccessCount: stats.totalAccessCount ?? 0,
      topTags: tagStats,
    };
  }

  /**
   * Cleanup old entries based on strategy
   */
  cleanup(strategy?: CleanupStrategy): MemoryCleanupResult {
    const start = performance.now();
    const effectiveStrategy = strategy ?? this.cleanupConfig.strategy;
    const entriesBefore = this.getCount();

    if (entriesBefore === 0) {
      return {
        deletedCount: 0,
        strategy: effectiveStrategy,
        duration: Math.round(performance.now() - start),
        entriesBefore: 0,
        entriesAfter: 0,
      };
    }

    // Ensure minimum target count of 1 to avoid edge case where targetCount = 0
    const targetCount = Math.max(1, Math.floor(this.maxEntries * this.cleanupConfig.targetThreshold));
    // Calculate how many entries need to be removed to reach target
    // If we're already below target (entriesToRemove <= 0), skip cleanup
    const entriesToRemove = entriesBefore - targetCount;
    if (entriesToRemove <= 0) {
      return {
        deletedCount: 0,
        strategy: effectiveStrategy,
        duration: Math.round(performance.now() - start),
        entriesBefore,
        entriesAfter: entriesBefore,
      };
    }

    // Apply min/max constraints
    // Only enforce minCleanupCount when entriesToRemove >= minCleanupCount to avoid over-deleting
    // This prevents the case where we need to delete 5 entries but minCleanupCount=10 forces us to delete 10
    const effectiveMinCleanup = entriesToRemove >= this.cleanupConfig.minCleanupCount
      ? this.cleanupConfig.minCleanupCount
      : entriesToRemove;
    const toDelete = Math.min(
      Math.max(entriesToRemove, effectiveMinCleanup),
      this.cleanupConfig.maxCleanupCount
    );

    // Warn if cleanup is limited by maxCleanupCount and won't reach target threshold
    if (toDelete < entriesToRemove) {
      console.warn(
        `[ax/memory] Cleanup limited by maxCleanupCount: need to remove ${entriesToRemove} ` +
          `entries but limited to ${toDelete}. Consider increasing maxCleanupCount.`
      );
    }

    if (toDelete <= 0) {
      return {
        deletedCount: 0,
        strategy: effectiveStrategy,
        duration: Math.round(performance.now() - start),
        entriesBefore,
        entriesAfter: entriesBefore,
      };
    }

    // Build WHERE clause for preserving tagged entries
    // If preserveTags is empty, don't add the NOT EXISTS clause (all entries eligible)
    const hasPreserveTags = this.cleanupConfig.preserveTags.length > 0;
    const preserveTagsClause = hasPreserveTags
      ? `
          WHERE NOT EXISTS (
            SELECT 1 FROM json_each(json_extract(metadata, '$.tags'))
            WHERE value IN (${this.cleanupConfig.preserveTags.map(() => '?').join(',')})
          )`
      : '';

    // Get IDs to delete based on strategy
    let selectSql: string;

    switch (effectiveStrategy) {
      case 'oldest':
        selectSql = `
          SELECT id FROM memories
          ${preserveTagsClause}
          ORDER BY created_at ASC
          LIMIT ?
        `;
        break;

      case 'least_accessed':
        // SQLite doesn't support NULLS FIRST syntax - NULLs sort first in ASC by default
        selectSql = `
          SELECT id FROM memories
          ${preserveTagsClause}
          ORDER BY access_count ASC, last_accessed_at ASC
          LIMIT ?
        `;
        break;

      case 'low_importance':
        // Default importance to 0 for missing values (consistent with metadata fallback)
        selectSql = `
          SELECT id FROM memories
          ${preserveTagsClause}
          ORDER BY ${MemoryManager.IMPORTANCE_SQL} ASC
          LIMIT ?
        `;
        break;

      case 'hybrid':
      default:
        // Hybrid: combine age, access count, and importance
        // Default importance to 0 for missing values (consistent with low_importance strategy)
        selectSql = `
          SELECT id FROM memories
          ${preserveTagsClause}
          ORDER BY (
            ${HYBRID_CLEANUP_AGE_WEIGHT} * (julianday('now') - julianday(created_at)) / ${this.cleanupConfig.retentionDays} +
            ${HYBRID_CLEANUP_ACCESS_WEIGHT} * (1.0 / (1 + access_count)) +
            ${HYBRID_CLEANUP_IMPORTANCE_WEIGHT} * (1.0 - ${MemoryManager.IMPORTANCE_SQL})
          ) DESC
          LIMIT ?
        `;
        break;
    }

    // Build params: preserveTags (if any) + limit
    const params = hasPreserveTags
      ? [...this.cleanupConfig.preserveTags, toDelete]
      : [toDelete];

    // Validate parameter count matches placeholder count to prevent silent failures
    const placeholderCount = (selectSql.match(/\?/g) || []).length;
    if (placeholderCount !== params.length) {
      throw new Error(
        `SQL parameter mismatch in cleanup: expected ${placeholderCount} parameters, got ${params.length}`
      );
    }

    let idsToDelete: Array<{ id: number }>;
    try {
      idsToDelete = this.db.prepare(selectSql).all(...params) as Array<{ id: number }>;
    } catch (error) {
      throw new Error(
        `Failed to query entries for cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // Delete in transaction
    const deletedCount = this.deleteBatch(idsToDelete.map((r) => r.id));
    const entriesAfter = this.getCount();

    return {
      deletedCount,
      strategy: effectiveStrategy,
      duration: Math.round(performance.now() - start),
      entriesBefore,
      entriesAfter,
    };
  }

  /**
   * Check if cleanup is needed and perform it
   * Protected against concurrent cleanup operations
   */
  private maybeCleanup(): void {
    // Skip if cleanup is already in progress (prevent race condition)
    if (this.cleanupInProgress) {
      return;
    }

    const count = this.getCount();
    const threshold = Math.floor(this.maxEntries * this.cleanupConfig.triggerThreshold);

    if (count >= threshold) {
      this.cleanupInProgress = true;
      try {
        this.cleanup();
      } finally {
        this.cleanupInProgress = false;
      }
    }
  }

  /**
   * Update access tracking for entries
   */
  private updateAccessTracking(ids: number[]): void {
    if (ids.length === 0) return;

    const updateMany = this.db.transaction((idsToUpdate: number[]) => {
      for (const id of idsToUpdate) {
        this.stmtUpdateAccess.run(id);
      }
    });

    updateMany(ids);
  }

  /**
   * Sanitize query string for FTS5
   * Escapes special characters rather than removing them to preserve query intent
   */
  private sanitizeQuery(query: string): string {
    // Escape double quotes for FTS5 (double them) rather than removing
    // This preserves phrase search semantics ("hello world" stays as phrase)
    // Remove only truly problematic operators that can't be escaped
    return query
      .replace(/"/g, '""') // Escape quotes by doubling
      .replace(/[*(){}[\]^~\\]/g, ' ') // Remove operators that can't be escaped
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Convert database row to MemoryEntry
   */
  private rowToEntry(row: RawMemoryRow): MemoryEntry {
    // Parse metadata with error handling for corrupted entries
    let metadata: MemoryMetadata;
    try {
      metadata = JSON.parse(row.metadata) as MemoryMetadata;
    } catch {
      // Fallback for corrupted metadata - use complete valid defaults
      metadata = {
        type: DEFAULT_METADATA_TYPE,
        source: DEFAULT_METADATA_SOURCE,
        tags: [],
        importance: DEFAULT_METADATA_IMPORTANCE,
      };
    }

    return MemoryEntrySchema.parse({
      id: row.id,
      content: row.content,
      metadata,
      createdAt: new Date(row.created_at),
      lastAccessedAt: row.last_accessed_at ? new Date(row.last_accessed_at) : undefined,
      accessCount: row.access_count,
      score: row.rank,
    });
  }

  /**
   * Run VACUUM to reclaim space (use sparingly)
   */
  vacuum(): void {
    this.db.exec('VACUUM');
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
