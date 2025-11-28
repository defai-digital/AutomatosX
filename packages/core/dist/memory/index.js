// src/memory/manager.ts
import Database from "better-sqlite3";
import {
  MemoryEntrySchema,
  MemoryCleanupConfigSchema
} from "@ax/schemas";
var DB_CACHE_SIZE_KB = -64e3;
var DEFAULT_MAX_ENTRIES = 1e4;
var HYBRID_CLEANUP_AGE_WEIGHT = 0.4;
var HYBRID_CLEANUP_ACCESS_WEIGHT = 0.3;
var HYBRID_CLEANUP_IMPORTANCE_WEIGHT = 0.3;
var DEFAULT_SEARCH_LIMIT = 10;
var DEFAULT_SEARCH_OFFSET = 0;
var DEFAULT_TOP_TAGS_LIMIT = 20;
var DEFAULT_METADATA_TYPE = "document";
var DEFAULT_METADATA_SOURCE = "unknown";
var DEFAULT_METADATA_IMPORTANCE = 0;
var MemoryManager = class _MemoryManager {
  db;
  maxEntries;
  cleanupConfig;
  cleanupInProgress = false;
  // Prevent concurrent cleanup operations
  // Prepared statements for performance
  stmtInsert;
  stmtSearch;
  stmtGetById;
  stmtUpdateAccess;
  stmtDelete;
  stmtCount;
  constructor(options) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.cleanupConfig = MemoryCleanupConfigSchema.parse(options.cleanupConfig ?? {});
    this.db = new Database(options.databasePath);
    this.initialize();
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
  initialize() {
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma(`cache_size = ${DB_CACHE_SIZE_KB}`);
    this.db.pragma("temp_store = MEMORY");
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
  static MAX_METADATA_SIZE = 1e6;
  /** SQL expression for extracting importance from metadata JSON */
  static IMPORTANCE_SQL = "COALESCE(CAST(json_extract(metadata, '$.importance') AS REAL), 0)";
  /**
   * Validate metadata size to prevent database issues
   */
  validateMetadataSize(serialized) {
    if (serialized.length > _MemoryManager.MAX_METADATA_SIZE) {
      throw new Error(
        `Metadata size (${serialized.length} bytes) exceeds maximum allowed (${_MemoryManager.MAX_METADATA_SIZE} bytes)`
      );
    }
  }
  /**
   * Safely convert SQLite rowid (number | bigint) to number
   * Warns if precision could be lost for very large IDs
   */
  safeRowId(rowid) {
    if (typeof rowid === "bigint") {
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
  add(input) {
    const { content, metadata } = input;
    const serializedMetadata = JSON.stringify(metadata);
    this.validateMetadataSize(serializedMetadata);
    const result = this.stmtInsert.run(content, serializedMetadata);
    if (this.cleanupConfig.enabled) {
      this.maybeCleanup();
    }
    return this.safeRowId(result.lastInsertRowid);
  }
  /**
   * Add multiple memory entries in a transaction
   */
  addBatch(inputs) {
    const ids = [];
    const insertMany = this.db.transaction((entries) => {
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
  search(options) {
    const start = performance.now();
    const { query, limit = DEFAULT_SEARCH_LIMIT, offset = DEFAULT_SEARCH_OFFSET, filter } = options;
    const sanitizedQuery = this.sanitizeQuery(query);
    if (!sanitizedQuery) {
      return {
        entries: [],
        total: 0,
        duration: Math.round(performance.now() - start),
        query,
        hasMore: false
      };
    }
    let sql = `
      SELECT m.*, bm25(memories_fts) as rank
      FROM memories m
      JOIN memories_fts ON m.id = memories_fts.rowid
      WHERE memories_fts MATCH ?
    `;
    const params = [sanitizedQuery];
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
    if (filter?.minImportance !== void 0) {
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
    if (filter?.tags && filter.tags.length > 0) {
      sql += ` AND EXISTS (
        SELECT 1 FROM json_each(json_extract(m.metadata, '$.tags'))
        WHERE value IN (${filter.tags.map(() => "?").join(",")})
      )`;
      params.push(...filter.tags);
    }
    if (filter?.tagsAll && filter.tagsAll.length > 0) {
      for (const tag of filter.tagsAll) {
        sql += ` AND EXISTS (
          SELECT 1 FROM json_each(json_extract(m.metadata, '$.tags'))
          WHERE value = ?
        )`;
        params.push(tag);
      }
    }
    if (filter?.minAccessCount !== void 0) {
      sql += ` AND m.access_count >= ?`;
      params.push(filter.minAccessCount);
    }
    const countSql = sql.replaceAll("SELECT m.*, bm25(memories_fts) as rank", "SELECT COUNT(*) as count");
    const countStmt = this.db.prepare(countSql);
    const countResult = countStmt.get(...params);
    const total = countResult?.count ?? 0;
    sql += ` ORDER BY rank LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);
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
      hasMore: offset + limit < total
    };
  }
  /**
   * Get a memory entry by ID
   */
  getById(id) {
    const row = this.stmtGetById.get(id);
    if (!row) return null;
    this.stmtUpdateAccess.run(id);
    return this.rowToEntry(row);
  }
  /**
   * Delete a memory entry
   */
  delete(id) {
    const result = this.stmtDelete.run(id);
    return result.changes > 0;
  }
  /**
   * Delete multiple entries
   */
  deleteBatch(ids) {
    const deleteMany = this.db.transaction((idsToDelete) => {
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
  getCount() {
    const result = this.stmtCount.get();
    return result.count;
  }
  /**
   * Get memory statistics
   */
  getStats() {
    const stats = this.db.prepare(
      `
      SELECT
        COUNT(*) as totalEntries,
        MIN(created_at) as oldestEntry,
        MAX(created_at) as newestEntry,
        AVG(LENGTH(content)) as avgContentLength,
        SUM(access_count) as totalAccessCount
      FROM memories
    `
    ).get();
    const typeStats = this.db.prepare(
      `
      SELECT json_extract(metadata, '$.type') as type, COUNT(*) as count
      FROM memories
      GROUP BY json_extract(metadata, '$.type')
    `
    ).all();
    const entriesByType = {};
    for (const row of typeStats) {
      if (row.type) {
        entriesByType[row.type] = row.count;
      }
    }
    const tagStats = this.db.prepare(
      `
      SELECT value as tag, COUNT(*) as count
      FROM memories, json_each(json_extract(metadata, '$.tags'))
      GROUP BY value
      ORDER BY count DESC
      LIMIT ${DEFAULT_TOP_TAGS_LIMIT}
    `
    ).all();
    const pageCount = this.db.pragma("page_count", { simple: true });
    const pageSize = this.db.pragma("page_size", { simple: true });
    const databaseSizeBytes = pageCount * pageSize;
    return {
      totalEntries: stats.totalEntries,
      entriesByType,
      databaseSizeBytes,
      oldestEntry: stats.oldestEntry ? new Date(stats.oldestEntry) : void 0,
      newestEntry: stats.newestEntry ? new Date(stats.newestEntry) : void 0,
      avgContentLength: stats.avgContentLength ?? 0,
      totalAccessCount: stats.totalAccessCount ?? 0,
      topTags: tagStats
    };
  }
  /**
   * Cleanup old entries based on strategy
   */
  cleanup(strategy) {
    const start = performance.now();
    const effectiveStrategy = strategy ?? this.cleanupConfig.strategy;
    const entriesBefore = this.getCount();
    if (entriesBefore === 0) {
      return {
        deletedCount: 0,
        strategy: effectiveStrategy,
        duration: Math.round(performance.now() - start),
        entriesBefore: 0,
        entriesAfter: 0
      };
    }
    const targetCount = Math.max(1, Math.floor(this.maxEntries * this.cleanupConfig.targetThreshold));
    const entriesToRemove = entriesBefore - targetCount;
    if (entriesToRemove <= 0) {
      return {
        deletedCount: 0,
        strategy: effectiveStrategy,
        duration: Math.round(performance.now() - start),
        entriesBefore,
        entriesAfter: entriesBefore
      };
    }
    const effectiveMinCleanup = entriesToRemove >= this.cleanupConfig.minCleanupCount ? this.cleanupConfig.minCleanupCount : entriesToRemove;
    const toDelete = Math.min(
      Math.max(entriesToRemove, effectiveMinCleanup),
      this.cleanupConfig.maxCleanupCount
    );
    if (toDelete < entriesToRemove) {
      console.warn(
        `[ax/memory] Cleanup limited by maxCleanupCount: need to remove ${entriesToRemove} entries but limited to ${toDelete}. Consider increasing maxCleanupCount.`
      );
    }
    if (toDelete <= 0) {
      return {
        deletedCount: 0,
        strategy: effectiveStrategy,
        duration: Math.round(performance.now() - start),
        entriesBefore,
        entriesAfter: entriesBefore
      };
    }
    const hasPreserveTags = this.cleanupConfig.preserveTags.length > 0;
    const preserveTagsClause = hasPreserveTags ? `
          WHERE NOT EXISTS (
            SELECT 1 FROM json_each(json_extract(metadata, '$.tags'))
            WHERE value IN (${this.cleanupConfig.preserveTags.map(() => "?").join(",")})
          )` : "";
    let selectSql;
    switch (effectiveStrategy) {
      case "oldest":
        selectSql = `
          SELECT id FROM memories
          ${preserveTagsClause}
          ORDER BY created_at ASC
          LIMIT ?
        `;
        break;
      case "least_accessed":
        selectSql = `
          SELECT id FROM memories
          ${preserveTagsClause}
          ORDER BY access_count ASC, last_accessed_at ASC
          LIMIT ?
        `;
        break;
      case "low_importance":
        selectSql = `
          SELECT id FROM memories
          ${preserveTagsClause}
          ORDER BY ${_MemoryManager.IMPORTANCE_SQL} ASC
          LIMIT ?
        `;
        break;
      case "hybrid":
      default:
        selectSql = `
          SELECT id FROM memories
          ${preserveTagsClause}
          ORDER BY (
            ${HYBRID_CLEANUP_AGE_WEIGHT} * (julianday('now') - julianday(created_at)) / ${this.cleanupConfig.retentionDays} +
            ${HYBRID_CLEANUP_ACCESS_WEIGHT} * (1.0 / (1 + access_count)) +
            ${HYBRID_CLEANUP_IMPORTANCE_WEIGHT} * (1.0 - ${_MemoryManager.IMPORTANCE_SQL})
          ) DESC
          LIMIT ?
        `;
        break;
    }
    const params = hasPreserveTags ? [...this.cleanupConfig.preserveTags, toDelete] : [toDelete];
    const placeholderCount = (selectSql.match(/\?/g) || []).length;
    if (placeholderCount !== params.length) {
      throw new Error(
        `SQL parameter mismatch in cleanup: expected ${placeholderCount} parameters, got ${params.length}`
      );
    }
    let idsToDelete;
    try {
      idsToDelete = this.db.prepare(selectSql).all(...params);
    } catch (error) {
      throw new Error(
        `Failed to query entries for cleanup: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
    const deletedCount = this.deleteBatch(idsToDelete.map((r) => r.id));
    const entriesAfter = this.getCount();
    return {
      deletedCount,
      strategy: effectiveStrategy,
      duration: Math.round(performance.now() - start),
      entriesBefore,
      entriesAfter
    };
  }
  /**
   * Check if cleanup is needed and perform it
   * Protected against concurrent cleanup operations
   */
  maybeCleanup() {
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
  updateAccessTracking(ids) {
    if (ids.length === 0) return;
    const updateMany = this.db.transaction((idsToUpdate) => {
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
  sanitizeQuery(query) {
    return query.replace(/"/g, '""').replace(/[*(){}[\]^~\\]/g, " ").replace(/\s+/g, " ").trim();
  }
  /**
   * Convert database row to MemoryEntry
   */
  rowToEntry(row) {
    let metadata;
    try {
      metadata = JSON.parse(row.metadata);
    } catch {
      metadata = {
        type: DEFAULT_METADATA_TYPE,
        source: DEFAULT_METADATA_SOURCE,
        tags: [],
        importance: DEFAULT_METADATA_IMPORTANCE
      };
    }
    return MemoryEntrySchema.parse({
      id: row.id,
      content: row.content,
      metadata,
      createdAt: new Date(row.created_at),
      lastAccessedAt: row.last_accessed_at ? new Date(row.last_accessed_at) : void 0,
      accessCount: row.access_count,
      score: row.rank
    });
  }
  /**
   * Clear memories based on criteria
   *
   * @param options - Clear options
   * @returns Number of deleted entries
   */
  clear(options) {
    if (!options?.before && !options?.agent && !options?.all) {
      throw new Error("Must specify --before, --agent, or --all to clear memories");
    }
    let sql = "DELETE FROM memories WHERE 1=1";
    const params = [];
    if (options.before) {
      sql += " AND created_at < ?";
      params.push(options.before.toISOString());
    }
    if (options.agent) {
      sql += " AND json_extract(metadata, '$.agentId') = ?";
      params.push(options.agent);
    }
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);
    return { deleted: result.changes };
  }
  /**
   * Run VACUUM to reclaim space (use sparingly)
   */
  vacuum() {
    this.db.exec("VACUUM");
  }
  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
};
export {
  MemoryManager
};
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
/**
 * Memory Module
 *
 * FTS5-based persistent memory system for AutomatosX agents.
 *
 * @module @ax/core/memory
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
//# sourceMappingURL=index.js.map