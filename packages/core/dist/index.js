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
    try {
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
    } catch (error) {
      this.db.close();
      throw error;
    }
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
    const SQLITE_PARAM_LIMIT = 999;
    if (filter?.tags && filter.tags.length > 0) {
      const remainingBudget = SQLITE_PARAM_LIMIT - params.length;
      const reserveForTagsAll = filter.tagsAll?.length ? Math.min(filter.tagsAll.length, 100) : 0;
      const tagBudget = Math.max(1, remainingBudget - reserveForTagsAll - 10);
      const maxTags = Math.min(filter.tags.length, tagBudget);
      const validTags = filter.tags.slice(0, maxTags);
      sql += ` AND EXISTS (
        SELECT 1 FROM json_each(json_extract(m.metadata, '$.tags'))
        WHERE value IN (${validTags.map(() => "?").join(",")})
      )`;
      params.push(...validTags);
    }
    if (filter?.tagsAll && filter.tagsAll.length > 0) {
      const remainingBudget = SQLITE_PARAM_LIMIT - params.length;
      const maxTagsAll = Math.min(filter.tagsAll.length, remainingBudget - 5);
      const validTagsAll = filter.tagsAll.slice(0, Math.max(1, maxTagsAll));
      for (const tag of validTagsAll) {
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
      WHERE value IS NOT NULL AND typeof(value) = 'text'
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
   * Protected against concurrent cleanup operations.
   *
   * Note: This is intentionally synchronous because SQLite uses a single-writer model.
   * The `cleanupInProgress` flag prevents re-entrant calls which could occur if
   * add() is called during cleanup (e.g., in a batch operation).
   * Async cleanup would not provide benefits with SQLite's locking model.
   */
  maybeCleanup() {
    if (this.cleanupInProgress) {
      return;
    }
    const count = this.getCount();
    const threshold = Math.floor(this.maxEntries * this.cleanupConfig.triggerThreshold);
    if (count < threshold) {
      return;
    }
    this.cleanupInProgress = true;
    try {
      this.cleanup();
    } finally {
      this.cleanupInProgress = false;
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
    return query.replace(/"/g, '""').replace(/[*(){}[\]^~\\:]/g, " ").replace(/(^|\s)-/g, "$1").replace(/\s+/g, " ").trim();
  }
  /**
   * Convert database row to MemoryEntry
   */
  rowToEntry(row) {
    let metadata;
    try {
      metadata = JSON.parse(row.metadata);
    } catch (error) {
      console.warn(
        `[ax/memory] Corrupted metadata for entry ${row.id}, using defaults: ${error instanceof Error ? error.message : "Parse error"}`
      );
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
   * Safe to call multiple times - subsequent calls are no-ops.
   */
  close() {
    if (this.db.open) {
      this.db.close();
    }
  }
};

// src/config/loader.ts
import { readFile, stat } from "fs/promises";
import { join, resolve } from "path";
import { parse as parseYaml } from "yaml";
import {
  ConfigSchema,
  DEFAULT_CONFIG,
  validateConfig
} from "@ax/schemas";
var CONFIG_FILE_NAMES = ["ax.config.json", "ax.config.yaml", "ax.config.yml"];
var MAX_PARENT_SEARCH = 10;
var MAX_TIMEOUT_MS = 36e5;
var DEBUG_TRUE_VALUES = ["true", "1"];
async function findConfigFile(startDir, searchParents = true) {
  let currentDir = resolve(startDir);
  let searchCount = 0;
  while (searchCount < MAX_PARENT_SEARCH) {
    for (const fileName of CONFIG_FILE_NAMES) {
      const configPath = join(currentDir, fileName);
      try {
        const stats = await stat(configPath);
        if (stats.isFile()) {
          return configPath;
        }
      } catch {
      }
    }
    if (!searchParents) {
      break;
    }
    const parentDir = resolve(currentDir, "..");
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
    searchCount++;
  }
  return null;
}
async function parseConfigFile(configPath) {
  const content = await readFile(configPath, "utf-8");
  if (configPath.endsWith(".json")) {
    return JSON.parse(content);
  } else if (configPath.endsWith(".yaml") || configPath.endsWith(".yml")) {
    return parseYaml(content);
  }
  throw new Error(`Unsupported config file format: ${configPath}`);
}
function getEnvOverrides(prefix = "AX") {
  const overrides = {};
  const provider = process.env[`${prefix}_PROVIDER`];
  if (provider) {
    overrides["providers"] = { default: provider };
  }
  const debug = process.env[`${prefix}_DEBUG`];
  if (debug && DEBUG_TRUE_VALUES.includes(debug)) {
    overrides["logging"] = { level: "debug" };
  }
  const timeout = process.env[`${prefix}_TIMEOUT`];
  if (timeout) {
    if (!/^\d+$/.test(timeout.trim())) {
      console.warn(
        `[ax/config] Invalid ${prefix}_TIMEOUT format "${timeout}". Expected numeric value only. Using default.`
      );
    } else {
      const timeoutMs = parseInt(timeout, 10);
      if (!isNaN(timeoutMs) && timeoutMs > 0 && timeoutMs <= MAX_TIMEOUT_MS) {
        overrides["execution"] = { timeout: timeoutMs };
      } else {
        console.warn(
          `[ax/config] Invalid ${prefix}_TIMEOUT value "${timeout}". Expected positive integer between 1 and ${MAX_TIMEOUT_MS} (ms). Using default.`
        );
      }
    }
  }
  return overrides;
}
async function loadConfig(options = {}) {
  const {
    baseDir = process.cwd(),
    fileName,
    envPrefix = "AX",
    searchParents = true
  } = options;
  let configPath = null;
  let fileConfig = {};
  if (fileName) {
    configPath = join(baseDir, fileName);
    try {
      const stats = await stat(configPath);
      if (!stats.isFile()) {
        console.warn(
          `[ax/config] Specified config path "${configPath}" is not a file. Using defaults.`
        );
        configPath = null;
      } else {
        fileConfig = await parseConfigFile(configPath);
      }
    } catch (error) {
      const errno = error;
      if (errno.code === "ENOENT") {
        console.warn(
          `[ax/config] Specified config file "${configPath}" not found. Using defaults.`
        );
        configPath = null;
      } else {
        throw new Error(
          `Failed to parse config file ${configPath}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }
  } else {
    configPath = await findConfigFile(baseDir, searchParents);
    if (configPath) {
      try {
        fileConfig = await parseConfigFile(configPath);
      } catch (error) {
        throw new Error(
          `Failed to parse config file ${configPath}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }
  }
  const envOverrides = getEnvOverrides(envPrefix);
  const mergeSection = (key) => ({
    ...DEFAULT_CONFIG[key],
    ...fileConfig[key] ?? {},
    ...envOverrides[key] ?? {}
  });
  const mergedConfig = {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...envOverrides,
    // Deep merge for all nested objects using helper
    providers: mergeSection("providers"),
    execution: mergeSection("execution"),
    memory: mergeSection("memory"),
    session: mergeSection("session"),
    checkpoint: mergeSection("checkpoint"),
    router: mergeSection("router"),
    workspace: mergeSection("workspace"),
    logging: mergeSection("logging")
  };
  const config = validateConfig(mergedConfig);
  let source = "default";
  if (Object.keys(envOverrides).length > 0) {
    source = "env";
  } else if (configPath) {
    source = "file";
  }
  return {
    config,
    configPath,
    source
  };
}
function loadConfigSync() {
  const envOverrides = getEnvOverrides("AX");
  const mergeSection = (key) => ({
    ...DEFAULT_CONFIG[key],
    ...envOverrides[key] ?? {}
  });
  const mergedConfig = {
    ...DEFAULT_CONFIG,
    ...envOverrides,
    providers: mergeSection("providers"),
    execution: mergeSection("execution"),
    memory: mergeSection("memory"),
    session: mergeSection("session"),
    checkpoint: mergeSection("checkpoint"),
    router: mergeSection("router"),
    workspace: mergeSection("workspace"),
    logging: mergeSection("logging")
  };
  return validateConfig(mergedConfig);
}
function getDefaultConfig() {
  return { ...DEFAULT_CONFIG };
}
function isValidConfig(config) {
  try {
    ConfigSchema.parse(config);
    return true;
  } catch {
    return false;
  }
}

// src/router/provider-router.ts
import "@ax/schemas";
import {
  selectProvider,
  getFallbackOrder,
  defaultRoutingContext
} from "@ax/algorithms";
import {
  createProvider
} from "@ax/providers";
var DEFAULT_PROVIDER_PRIORITY = 99;
var DEFAULT_ROUTING_COMPLEXITY = 5;
var DEFAULT_HEALTH_CHECK_INTERVAL_MS = 6e4;
var MAX_ROUTING_RETRIES = 3;
function safeInvokeEvent(eventName, callback, ...args) {
  if (!callback) return;
  try {
    callback(...args);
  } catch (error) {
    console.error(
      `[ax/router] Event callback "${eventName}" threw an error:`,
      error instanceof Error ? error.message : error
    );
  }
}
var ProviderRouter = class {
  config;
  providers = /* @__PURE__ */ new Map();
  metrics;
  events = {};
  healthCheckIntervalId = null;
  initialized = false;
  constructor(options) {
    this.config = options.config;
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      fallbackAttempts: 0,
      requestsByProvider: /* @__PURE__ */ new Map(),
      avgLatencyByProvider: /* @__PURE__ */ new Map()
    };
    this.initializeProviders(options.providerOptions);
    if (options.autoHealthCheck !== false) {
      const interval = options.healthCheckInterval ?? DEFAULT_HEALTH_CHECK_INTERVAL_MS;
      this.startHealthChecks(interval);
    }
    this.initialized = true;
  }
  // =============================================================================
  // Public Methods
  // =============================================================================
  /**
   * Route a task to the best available provider
   */
  async route(request, options = {}) {
    this.metrics.totalRequests++;
    const context = this.buildRoutingContext(request, options);
    const result = this.selectBestProvider(context, options);
    if (!result.provider) {
      this.metrics.failedRequests++;
      throw new Error(`No providers available: ${result.reason}`);
    }
    const provider = this.providers.get(result.provider.id);
    if (!provider) {
      throw new Error(`Provider ${result.provider.id} not found in registry`);
    }
    safeInvokeEvent("onProviderSelected", this.events.onProviderSelected, provider.id, result.reason);
    this.incrementProviderMetrics(provider.id);
    const maxRetries = options.maxRetries ?? MAX_ROUTING_RETRIES;
    const enableFallback = options.enableFallback ?? true;
    const triedProviders = [provider.id];
    let response = await this.executeWithProvider(provider, request);
    if (response.success) {
      this.metrics.successfulRequests++;
      this.updateLatencyMetrics(provider.id, response.metadata.duration);
      return response;
    }
    if (enableFallback && result.alternatives.length > 0) {
      for (const alt of result.alternatives) {
        if (triedProviders.length >= maxRetries) break;
        const altProvider = this.providers.get(alt.provider.id);
        if (!altProvider) continue;
        this.metrics.fallbackAttempts++;
        triedProviders.push(altProvider.id);
        safeInvokeEvent("onFallback", this.events.onFallback, provider.id, altProvider.id, response.error ?? "Unknown error");
        response = await this.executeWithProvider(altProvider, request);
        if (response.success) {
          this.metrics.successfulRequests++;
          this.updateLatencyMetrics(altProvider.id, response.metadata.duration);
          return response;
        }
      }
    }
    this.metrics.failedRequests++;
    const lastError = new Error(response.error ?? "All providers failed");
    safeInvokeEvent("onAllProvidersFailed", this.events.onAllProvidersFailed, triedProviders, lastError);
    return response;
  }
  /**
   * Execute directly with a specific provider (bypass routing)
   */
  async executeWithProvider(providerOrId, request) {
    const provider = typeof providerOrId === "string" ? this.providers.get(providerOrId) : providerOrId;
    if (!provider) {
      throw new Error(`Provider not found: ${providerOrId}`);
    }
    return provider.executeWithTracking(request);
  }
  /**
   * Get provider by type
   */
  getProvider(type) {
    return this.providers.get(type);
  }
  /**
   * Get all providers
   */
  getAllProviders() {
    return new Map(this.providers);
  }
  /**
   * Get enabled provider types
   */
  getEnabledProviders() {
    return Array.from(this.providers.keys());
  }
  /**
   * Check if a provider is available and healthy
   */
  isProviderAvailable(type) {
    const provider = this.providers.get(type);
    return provider !== void 0 && provider.isHealthy();
  }
  /**
   * Get fallback order for providers
   */
  getFallbackChain(context) {
    const routingContext = {
      ...defaultRoutingContext,
      ...context
    };
    const providerStates = this.getProviderStates();
    const ordered = getFallbackOrder(providerStates, routingContext);
    return ordered.map((p) => p.id);
  }
  /**
   * Get routing metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      requestsByProvider: new Map(this.metrics.requestsByProvider),
      avgLatencyByProvider: new Map(this.metrics.avgLatencyByProvider)
    };
  }
  /**
   * Reset routing metrics
   */
  resetMetrics() {
    this.metrics.totalRequests = 0;
    this.metrics.successfulRequests = 0;
    this.metrics.failedRequests = 0;
    this.metrics.fallbackAttempts = 0;
    this.metrics.requestsByProvider.clear();
    this.metrics.avgLatencyByProvider.clear();
  }
  /**
   * Set event handlers
   */
  setEvents(events) {
    Object.assign(this.events, events);
  }
  /**
   * Run health checks on all providers
   */
  async checkAllHealth() {
    const results = /* @__PURE__ */ new Map();
    const checks = Array.from(this.providers.entries()).map(async ([type, provider]) => {
      try {
        const healthy = await provider.checkHealth();
        results.set(type, healthy);
        safeInvokeEvent("onHealthUpdate", this.events.onHealthUpdate, type, healthy);
      } catch (error) {
        console.warn(
          `[ax/router] Health check failed for ${type}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        results.set(type, false);
        safeInvokeEvent("onHealthUpdate", this.events.onHealthUpdate, type, false);
      }
    });
    await Promise.allSettled(checks);
    return results;
  }
  /**
   * Cleanup and stop health checks
   */
  async cleanup() {
    this.stopHealthChecks();
    const cleanups = Array.from(this.providers.values()).map((p) => p.cleanup());
    await Promise.all(cleanups);
    this.providers.clear();
    this.initialized = false;
  }
  // =============================================================================
  // Private Methods
  // =============================================================================
  /**
   * Initialize providers based on configuration
   */
  initializeProviders(factoryOptions) {
    const enabledTypes = this.config.providers.enabled;
    for (const type of enabledTypes) {
      try {
        const provider = createProvider(type, factoryOptions);
        provider.setEvents({
          onHealthChange: (health) => {
            safeInvokeEvent("onHealthUpdate", this.events.onHealthUpdate, type, health.healthy);
          }
        });
        this.providers.set(type, provider);
      } catch (error) {
        console.warn(
          `[ax/router] Failed to initialize provider ${type}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }
    if (this.providers.size === 0) {
      throw new Error("No providers could be initialized");
    }
  }
  /**
   * Build routing context from request and options
   *
   * The context now includes:
   * - taskType: Inferred from task description
   * - agentId: For agent-specific provider affinity
   * - taskDescription: For keyword-based routing analysis
   */
  buildRoutingContext(request, options) {
    const context = {
      taskType: this.inferTaskType(request.task),
      complexity: options.context?.complexity ?? DEFAULT_ROUTING_COMPLEXITY,
      preferMcp: options.context?.preferMcp ?? true,
      excludeProviders: options.excludeProviders ?? [],
      // Pass full task description for keyword analysis
      taskDescription: request.task
    };
    if (request.agent) {
      context.agentId = request.agent;
    }
    if (options.forceProvider) {
      context.forceProvider = options.forceProvider;
    }
    return context;
  }
  /**
   * Select best provider using routing algorithm
   */
  selectBestProvider(context, options) {
    const providerStates = this.getProviderStates();
    if (options.forceProvider) {
      context = { ...context, forceProvider: options.forceProvider };
    }
    return selectProvider(providerStates, context);
  }
  /**
   * Get current state of all providers for routing
   */
  getProviderStates() {
    const fallbackOrder = this.config.providers.fallbackOrder ?? this.config.providers.enabled;
    const getPriority = (type) => {
      const index = fallbackOrder.indexOf(type);
      return index >= 0 ? index + 1 : DEFAULT_PROVIDER_PRIORITY;
    };
    return Array.from(this.providers.entries()).map(([type, provider]) => {
      const health = provider.getHealth();
      return {
        id: type,
        priority: getPriority(type),
        healthy: provider.isHealthy(),
        rateLimit: 0,
        // TODO: implement rate limit tracking
        latencyMs: health.latencyMs,
        successRate: health.successRate,
        integrationMode: provider.integrationMode
      };
    });
  }
  /**
   * Infer task type from task description
   *
   * Three task classes with provider assignments:
   *
   * CLASS 1: PLANNING/STRATEGY → OpenAI primary
   *   planning, architecture, strategy, research, requirements, roadmap, analysis
   *
   * CLASS 2: FRONTEND/CREATIVE → Gemini primary
   *   frontend, ui, ux, creative, styling, animation, visual, design, branding, marketing
   *
   * CLASS 3: CODING/TECHNICAL → Claude primary
   *   coding, debugging, implementation, refactoring, testing, review, security,
   *   devops, infrastructure, backend, api, database, documentation
   *
   * ax-cli is always the last fallback for all task types.
   */
  inferTaskType(task) {
    const lowerTask = task.toLowerCase();
    if (/\b(plan|roadmap|requirements|prd|specification|propose)\b/.test(lowerTask)) {
      return "planning";
    }
    if (/\b(architect|system design|design system|scalab|microservice|monolith)\b/.test(lowerTask)) {
      return "architecture";
    }
    if (/\b(strategy|strategic|decision|trade-?off|evaluate options)\b/.test(lowerTask)) {
      return "strategy";
    }
    if (/\b(research|investigate|explore|compare|benchmark|study)\b/.test(lowerTask)) {
      return "research";
    }
    if (/\b(frontend|front-end|react|vue|angular|svelte|nextjs|nuxt)\b/.test(lowerTask)) {
      return "frontend";
    }
    if (/\b(ui|ux|user interface|user experience|component|widget)\b/.test(lowerTask)) {
      return "ui";
    }
    if (/\b(css|tailwind|styled|styling|sass|scss|responsive|layout)\b/.test(lowerTask)) {
      return "styling";
    }
    if (/\b(animation|animate|motion|transition|framer)\b/.test(lowerTask)) {
      return "animation";
    }
    if (/\b(creative|visual|graphic|illustration|artwork)\b/.test(lowerTask)) {
      return "creative";
    }
    if (/\b(design|wireframe|mockup|prototype|figma)\b/.test(lowerTask)) {
      return "design";
    }
    if (/\b(brand|branding|marketing|campaign|content|copy)\b/.test(lowerTask)) {
      return "marketing";
    }
    if (/\b(debug|fix|bug|error|issue|problem|troubleshoot|resolve)\b/.test(lowerTask)) {
      return "debugging";
    }
    if (/\b(implement|code|write|create function|build|develop)\b/.test(lowerTask)) {
      return "coding";
    }
    if (/\b(refactor|restructure|reorganize|clean up|optimize code)\b/.test(lowerTask)) {
      return "refactoring";
    }
    if (/\b(test|spec|coverage|unit|e2e|integration|verify|validate)\b/.test(lowerTask)) {
      return "testing";
    }
    if (/\b(review|code review|pull request|pr|audit code)\b/.test(lowerTask)) {
      return "review";
    }
    if (/\b(security|vulnerab|threat|owasp|penetration|xss|injection)\b/.test(lowerTask)) {
      return "security";
    }
    if (/\b(devops|deploy|ci|cd|pipeline|docker|kubernetes|terraform)\b/.test(lowerTask)) {
      return "devops";
    }
    if (/\b(backend|back-end|api|endpoint|rest|graphql|server)\b/.test(lowerTask)) {
      return "backend";
    }
    if (/\b(database|db|sql|query|migration|schema|postgres|mysql|mongo)\b/.test(lowerTask)) {
      return "database";
    }
    if (/\b(document|docs|readme|explain|describe|guide|tutorial)\b/.test(lowerTask)) {
      return "documentation";
    }
    if (/\b(data|etl|ml|machine learning|model|training|prediction)\b/.test(lowerTask)) {
      return "data";
    }
    return "general";
  }
  /**
   * Increment request count for provider
   */
  incrementProviderMetrics(type) {
    const current = this.metrics.requestsByProvider.get(type) ?? 0;
    this.metrics.requestsByProvider.set(type, current + 1);
  }
  /**
   * Update latency metrics for provider using cumulative moving average
   */
  updateLatencyMetrics(type, latency) {
    const currentAvg = this.metrics.avgLatencyByProvider.get(type) ?? 0;
    const requestCount = this.metrics.requestsByProvider.get(type) ?? 1;
    const newAvg = currentAvg + (latency - currentAvg) / requestCount;
    this.metrics.avgLatencyByProvider.set(type, newAvg);
  }
  /**
   * Start periodic health checks
   */
  startHealthChecks(intervalMs) {
    this.healthCheckIntervalId = setInterval(() => {
      this.checkAllHealth().catch((error) => {
        console.warn(
          `[ax/router] Health check failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      });
    }, intervalMs);
    if (this.healthCheckIntervalId.unref) {
      this.healthCheckIntervalId.unref();
    }
  }
  /**
   * Stop periodic health checks
   */
  stopHealthChecks() {
    if (this.healthCheckIntervalId) {
      clearInterval(this.healthCheckIntervalId);
      this.healthCheckIntervalId = null;
    }
  }
};
function createProviderRouter(options) {
  return new ProviderRouter(options);
}

// src/session/manager.ts
import { randomUUID } from "crypto";
import { readFile as readFile2, writeFile, readdir, mkdir, unlink, stat as stat2 } from "fs/promises";
import { join as join2, basename } from "path";
import {
  SessionSchema,
  SessionTaskSchema,
  CreateSessionInputSchema,
  AddTaskInputSchema,
  UpdateTaskInputSchema,
  createSessionSummary,
  SessionId
} from "@ax/schemas";
var DEFAULT_SESSION_NAME = "Untitled Session";
var MAX_IN_MEMORY_SESSIONS = 100;
var SESSION_FILE_EXT = ".json";
var SESSIONS_DIR = "sessions";
var VALID_STATE_TRANSITIONS = {
  active: ["paused", "completed", "failed", "cancelled"],
  paused: ["active", "cancelled"],
  completed: [],
  // Terminal state - no transitions allowed
  failed: [],
  // Terminal state - no transitions allowed
  cancelled: []
  // Terminal state - no transitions allowed
};
function isValidTransition(fromState, toState) {
  const validTargets = VALID_STATE_TRANSITIONS[fromState];
  return validTargets?.includes(toState) ?? false;
}
function parseSessionId(sessionId) {
  return SessionId.parse(sessionId);
}
function safeInvokeEvent2(eventName, callback, ...args) {
  if (!callback) return;
  try {
    callback(...args);
  } catch (error) {
    console.error(
      `[ax/session] Event callback "${eventName}" threw an error:`,
      error instanceof Error ? error.message : error
    );
  }
}
var SessionManager = class {
  sessionsPath;
  maxInMemorySessions;
  autoPersist;
  sessions = /* @__PURE__ */ new Map();
  events = {};
  sessionLocks = /* @__PURE__ */ new Map();
  initialized = false;
  constructor(options) {
    this.sessionsPath = join2(options.storagePath, SESSIONS_DIR);
    this.maxInMemorySessions = options.maxInMemorySessions ?? MAX_IN_MEMORY_SESSIONS;
    this.autoPersist = options.autoPersist ?? true;
  }
  // =============================================================================
  // Lifecycle Methods
  // =============================================================================
  /**
   * Initialize session manager and load existing sessions
   */
  async initialize() {
    if (this.initialized) return;
    await mkdir(this.sessionsPath, { recursive: true });
    await this.loadRecentSessions();
    this.initialized = true;
  }
  /**
   * Cleanup and persist all sessions
   */
  async cleanup() {
    if (this.autoPersist) {
      await this.persistAll();
    }
    this.sessions.clear();
    this.initialized = false;
  }
  // =============================================================================
  // Session CRUD Operations
  // =============================================================================
  /**
   * Ensure the manager is initialized before performing operations
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error(
        "SessionManager not initialized. Call initialize() before performing operations."
      );
    }
  }
  /**
   * Create a new session
   */
  async create(input) {
    this.ensureInitialized();
    const validated = CreateSessionInputSchema.parse(input);
    const now = /* @__PURE__ */ new Date();
    const sessionId = this.generateSessionId();
    const tasks = (validated.tasks ?? []).map(
      (t) => SessionTaskSchema.parse({
        id: randomUUID(),
        description: t.description,
        agentId: t.agentId,
        status: "pending",
        createdAt: now
      })
    );
    const session = SessionSchema.parse({
      id: sessionId,
      name: validated.name || DEFAULT_SESSION_NAME,
      description: validated.description,
      state: "active",
      agents: validated.agents,
      tasks,
      createdAt: now,
      updatedAt: now,
      goal: validated.goal,
      tags: validated.tags ?? [],
      metadata: validated.metadata
    });
    this.sessions.set(session.id, session);
    this.evictOldSessions();
    if (this.autoPersist) {
      await this.persistSession(session);
    }
    safeInvokeEvent2("onSessionCreated", this.events.onSessionCreated, session);
    return session;
  }
  /**
   * Get session by ID
   */
  async get(sessionId) {
    this.ensureInitialized();
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = await this.loadSession(sessionId);
      if (session) {
        this.sessions.set(session.id, session);
        this.evictOldSessions();
      }
    }
    return session ?? null;
  }
  /**
   * Get session (throws if not found)
   */
  async getOrThrow(sessionId) {
    const session = await this.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }
  /**
   * List sessions with optional filtering
   */
  async list(filter) {
    this.ensureInitialized();
    await this.loadAllSessions();
    let sessions = Array.from(this.sessions.values());
    if (filter) {
      if (filter.state) {
        sessions = sessions.filter((s) => s.state === filter.state);
      }
      if (filter.agent) {
        sessions = sessions.filter((s) => s.agents.includes(filter.agent));
      }
      if (filter.tags && filter.tags.length > 0) {
        sessions = sessions.filter(
          (s) => filter.tags.some((tag) => s.tags.includes(tag))
        );
      }
      if (filter.createdAfter) {
        sessions = sessions.filter((s) => s.createdAt >= filter.createdAfter);
      }
      if (filter.createdBefore) {
        sessions = sessions.filter((s) => s.createdAt <= filter.createdBefore);
      }
    }
    sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return sessions.map(createSessionSummary);
  }
  /**
   * Update session state
   */
  async updateState(sessionId, state) {
    return this.withSessionLock(sessionId, async () => {
      const session = await this.getOrThrow(sessionId);
      if (!isValidTransition(session.state, state)) {
        throw new Error(
          `Invalid state transition: cannot transition from '${session.state}' to '${state}'`
        );
      }
      session.state = state;
      session.updatedAt = /* @__PURE__ */ new Date();
      if (state === "completed" || state === "failed" || state === "cancelled") {
        session.completedAt = /* @__PURE__ */ new Date();
        const rawDuration = session.completedAt.getTime() - session.createdAt.getTime();
        session.duration = Math.max(0, rawDuration);
      }
      if (this.autoPersist) {
        await this.persistSession(session);
      }
      safeInvokeEvent2("onSessionUpdated", this.events.onSessionUpdated, session);
      if (state === "completed") {
        safeInvokeEvent2("onSessionCompleted", this.events.onSessionCompleted, session);
      }
      return session;
    });
  }
  /**
   * Complete a session
   */
  async complete(sessionId) {
    return this.updateState(sessionId, "completed");
  }
  /**
   * Pause a session
   */
  async pause(sessionId) {
    return this.updateState(sessionId, "paused");
  }
  /**
   * Resume a paused session
   */
  async resume(sessionId) {
    return this.withSessionLock(sessionId, async () => {
      const session = await this.getOrThrow(sessionId);
      if (session.state !== "paused") {
        throw new Error(`Cannot resume session in state: ${session.state}`);
      }
      if (!isValidTransition(session.state, "active")) {
        throw new Error(
          `Invalid state transition: cannot transition from '${session.state}' to 'active'`
        );
      }
      session.state = "active";
      session.updatedAt = /* @__PURE__ */ new Date();
      if (this.autoPersist) {
        await this.persistSession(session);
      }
      safeInvokeEvent2("onSessionUpdated", this.events.onSessionUpdated, session);
      return session;
    });
  }
  /**
   * Cancel a session
   */
  async cancel(sessionId) {
    return this.updateState(sessionId, "cancelled");
  }
  /**
   * Fail a session with an optional error message
   */
  async fail(sessionId, error) {
    return this.withSessionLock(sessionId, async () => {
      const session = await this.getOrThrow(sessionId);
      if (!isValidTransition(session.state, "failed")) {
        throw new Error(
          `Invalid state transition: cannot transition from '${session.state}' to 'failed'`
        );
      }
      if (error) {
        session.metadata = {
          ...session.metadata,
          failureReason: error
        };
      }
      session.state = "failed";
      session.updatedAt = /* @__PURE__ */ new Date();
      session.completedAt = /* @__PURE__ */ new Date();
      const rawDuration = session.completedAt.getTime() - session.createdAt.getTime();
      session.duration = Math.max(0, rawDuration);
      if (this.autoPersist) {
        await this.persistSession(session);
      }
      safeInvokeEvent2("onSessionUpdated", this.events.onSessionUpdated, session);
      return session;
    });
  }
  /**
   * Delete a session
   */
  async delete(sessionId) {
    this.sessions.delete(sessionId);
    try {
      const filePath = this.getSessionFilePath(sessionId);
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }
  // =============================================================================
  // Task Operations
  // =============================================================================
  /**
   * Add a task to a session
   */
  async addTask(input) {
    const validated = AddTaskInputSchema.parse(input);
    return this.withSessionLock(validated.sessionId, async () => {
      const session = await this.getOrThrow(validated.sessionId);
      const task = SessionTaskSchema.parse({
        id: randomUUID(),
        description: validated.description,
        agentId: validated.agentId,
        status: "pending",
        createdAt: /* @__PURE__ */ new Date(),
        parentTaskId: validated.parentTaskId,
        metadata: validated.metadata
      });
      session.tasks.push(task);
      session.updatedAt = /* @__PURE__ */ new Date();
      if (!session.agents.includes(validated.agentId)) {
        session.agents.push(validated.agentId);
      }
      if (this.autoPersist) {
        await this.persistSession(session);
      }
      safeInvokeEvent2("onTaskAdded", this.events.onTaskAdded, session, task);
      return task;
    });
  }
  /**
   * Update task status and result
   */
  async updateTask(input) {
    const validated = UpdateTaskInputSchema.parse(input);
    return this.withSessionLock(validated.sessionId, async () => {
      const session = await this.getOrThrow(validated.sessionId);
      const task = session.tasks.find((t) => t.id === validated.taskId);
      if (!task) {
        throw new Error(`Task not found: ${validated.taskId}`);
      }
      const previousStatus = task.status;
      task.status = validated.status;
      if (validated.result !== void 0) {
        task.result = validated.result;
      }
      if (validated.error !== void 0) {
        task.error = validated.error;
      }
      if (validated.status === "running" && previousStatus === "pending") {
        task.startedAt = /* @__PURE__ */ new Date();
      }
      if (validated.status === "completed" || validated.status === "failed") {
        task.completedAt = /* @__PURE__ */ new Date();
        const startTime = task.startedAt?.getTime() ?? new Date(task.createdAt ?? Date.now()).getTime();
        const rawDuration = task.completedAt.getTime() - startTime;
        task.duration = Math.max(0, rawDuration);
      }
      session.updatedAt = /* @__PURE__ */ new Date();
      if (this.autoPersist) {
        await this.persistSession(session);
      }
      safeInvokeEvent2("onTaskUpdated", this.events.onTaskUpdated, session, task);
      return task;
    });
  }
  /**
   * Start a task
   */
  async startTask(sessionId, taskId) {
    return this.updateTask({
      sessionId: parseSessionId(sessionId),
      taskId,
      status: "running"
    });
  }
  /**
   * Complete a task
   */
  async completeTask(sessionId, taskId, result) {
    return this.updateTask({
      sessionId: parseSessionId(sessionId),
      taskId,
      status: "completed",
      result
    });
  }
  /**
   * Fail a task
   */
  async failTask(sessionId, taskId, error) {
    return this.updateTask({
      sessionId: parseSessionId(sessionId),
      taskId,
      status: "failed",
      error
    });
  }
  /**
   * Get pending tasks for a session
   */
  async getPendingTasks(sessionId) {
    const session = await this.getOrThrow(sessionId);
    return session.tasks.filter((t) => t.status === "pending");
  }
  /**
   * Get tasks by agent
   */
  async getTasksByAgent(sessionId, agentId) {
    const session = await this.getOrThrow(sessionId);
    return session.tasks.filter((t) => t.agentId === agentId);
  }
  // =============================================================================
  // Event Management
  // =============================================================================
  /**
   * Set event handlers
   */
  setEvents(events) {
    Object.assign(this.events, events);
  }
  // =============================================================================
  // Private Methods
  // =============================================================================
  /**
   * Execute an operation with a session lock to prevent race conditions.
   * Only one operation can modify a session at a time.
   */
  async withSessionLock(sessionId, operation) {
    const existingLock = this.sessionLocks.get(sessionId);
    if (existingLock) {
      await existingLock.catch(() => {
      });
    }
    let releaseLock;
    const lockPromise = new Promise((resolve2) => {
      releaseLock = resolve2;
    });
    this.sessionLocks.set(sessionId, lockPromise);
    try {
      return await operation();
    } finally {
      releaseLock();
      if (this.sessionLocks.get(sessionId) === lockPromise) {
        this.sessionLocks.delete(sessionId);
      }
    }
  }
  /**
   * Generate a unique session ID (UUID format)
   */
  generateSessionId() {
    return randomUUID();
  }
  /**
   * Get file path for session storage
   */
  getSessionFilePath(sessionId) {
    return join2(this.sessionsPath, `${sessionId}${SESSION_FILE_EXT}`);
  }
  /**
   * Persist session to disk
   */
  async persistSession(session) {
    const filePath = this.getSessionFilePath(session.id);
    const data = JSON.stringify(session, null, 2);
    await writeFile(filePath, data, "utf-8");
  }
  /**
   * Persist all in-memory sessions
   */
  async persistAll() {
    const promises = Array.from(this.sessions.values()).map(
      (s) => this.persistSession(s)
    );
    await Promise.all(promises);
  }
  /**
   * Load session from disk
   */
  async loadSession(sessionId) {
    const filePath = this.getSessionFilePath(sessionId);
    try {
      const data = await readFile2(filePath, "utf-8");
      const parsed = JSON.parse(data);
      parsed.createdAt = new Date(parsed.createdAt);
      parsed.updatedAt = new Date(parsed.updatedAt);
      if (parsed.completedAt) {
        parsed.completedAt = new Date(parsed.completedAt);
      }
      if (Array.isArray(parsed.tasks)) {
        for (const task of parsed.tasks) {
          if (task.createdAt) task.createdAt = new Date(task.createdAt);
          if (task.startedAt) task.startedAt = new Date(task.startedAt);
          if (task.completedAt) task.completedAt = new Date(task.completedAt);
        }
      }
      return SessionSchema.parse(parsed);
    } catch (error) {
      const errno = error;
      if (errno.code !== "ENOENT") {
        console.warn(
          `[ax/session] Failed to load session ${sessionId}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
      return null;
    }
  }
  /**
   * Load recent sessions from disk
   */
  async loadRecentSessions() {
    try {
      const files = await readdir(this.sessionsPath);
      const sessionFiles = files.filter((f) => f.endsWith(SESSION_FILE_EXT)).map((f) => basename(f, SESSION_FILE_EXT));
      const fileStats = await Promise.all(
        sessionFiles.map(async (id) => {
          const filePath = this.getSessionFilePath(id);
          try {
            const stats = await stat2(filePath);
            return { id, mtime: stats.mtime };
          } catch {
            return { id, mtime: /* @__PURE__ */ new Date(0) };
          }
        })
      );
      fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      const toLoad = fileStats.slice(0, this.maxInMemorySessions);
      for (const { id } of toLoad) {
        const session = await this.loadSession(id);
        if (session) {
          this.sessions.set(session.id, session);
        }
      }
    } catch {
    }
  }
  /**
   * Load all sessions from disk
   */
  async loadAllSessions() {
    try {
      const files = await readdir(this.sessionsPath);
      const sessionFiles = files.filter((f) => f.endsWith(SESSION_FILE_EXT)).map((f) => basename(f, SESSION_FILE_EXT));
      for (const id of sessionFiles) {
        if (!this.sessions.has(id)) {
          const session = await this.loadSession(id);
          if (session) {
            this.sessions.set(session.id, session);
          }
        }
      }
    } catch {
    }
  }
  /**
   * Evict oldest sessions from memory when limit exceeded
   */
  evictOldSessions() {
    if (this.sessions.size <= this.maxInMemorySessions) return;
    const sessions = Array.from(this.sessions.entries()).sort((a, b) => b[1].updatedAt.getTime() - a[1].updatedAt.getTime());
    const toEvict = sessions.slice(this.maxInMemorySessions);
    for (const [id] of toEvict) {
      this.sessions.delete(id);
    }
  }
};
function createSessionManager(options) {
  return new SessionManager(options);
}

// src/agent/loader.ts
import { readFile as readFile3, readdir as readdir2, stat as stat3 } from "fs/promises";
import { join as join3, extname, basename as basename2 } from "path";
import { parse as parseYaml2 } from "yaml";
import {
  validateAgentProfile
} from "@ax/schemas";
var AGENTS_DIR = "agents";
var AGENT_FILE_EXTENSIONS = [".yaml", ".yml"];
var AgentLoader = class {
  basePath;
  agentsPath;
  loadedAgents = /* @__PURE__ */ new Map();
  loadErrors = [];
  constructor(options) {
    this.basePath = options.basePath;
    this.agentsPath = join3(options.basePath, AGENTS_DIR);
  }
  // =============================================================================
  // Public Methods
  // =============================================================================
  /**
   * Load all agent profiles from the agents directory
   */
  async loadAll() {
    this.loadedAgents.clear();
    this.loadErrors.length = 0;
    try {
      const files = await readdir2(this.agentsPath);
      const agentFiles = files.filter(
        (f) => AGENT_FILE_EXTENSIONS.includes(extname(f).toLowerCase())
      );
      if (agentFiles.length === 0) {
        console.info(
          `[ax/loader] No agent files found in ${this.agentsPath}. Using defaults. Supported extensions: ${AGENT_FILE_EXTENSIONS.join(", ")}`
        );
      }
      for (const file of agentFiles) {
        await this.loadAgentFile(file);
      }
    } catch (error) {
      const errno = error;
      if (errno.code === "ENOENT") {
        console.debug?.(
          `[ax/loader] Agents directory not found at ${this.agentsPath}. Using defaults.`
        );
      } else if (errno.code === "EACCES" || errno.code === "EPERM") {
        console.warn(
          `[ax/loader] Cannot access agents directory ${this.agentsPath}: ${errno.message}. Check permissions. Using defaults.`
        );
      } else {
        throw error;
      }
    }
    return {
      agents: Array.from(this.loadedAgents.values()),
      errors: [...this.loadErrors]
    };
  }
  /**
   * Load a specific agent by ID
   */
  async loadAgent(agentId) {
    for (const ext of AGENT_FILE_EXTENSIONS) {
      const filePath = join3(this.agentsPath, `${agentId}${ext}`);
      try {
        const stats = await stat3(filePath);
        if (stats.isFile()) {
          return this.loadAgentFromPath(filePath);
        }
      } catch {
      }
    }
    return null;
  }
  /**
   * Load agent from a specific file path
   */
  async loadAgentFromPath(filePath) {
    const agentId = basename2(filePath, extname(filePath));
    try {
      const content = await readFile3(filePath, "utf-8");
      const parsed = parseYaml2(content);
      const profile = validateAgentProfile(parsed);
      if (profile.name !== agentId) {
        console.warn(
          `[ax/loader] Agent filename "${agentId}" doesn't match profile name "${profile.name}". Using filename as the canonical ID. Consider renaming the file or updating the profile.`
        );
      }
      const loaded = {
        profile,
        filePath,
        loadedAt: /* @__PURE__ */ new Date()
      };
      this.loadedAgents.set(agentId, loaded);
      return loaded;
    } catch (error) {
      this.loadErrors.push({
        agentId,
        filePath,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      return null;
    }
  }
  /**
   * Get a loaded agent by ID
   */
  get(agentId) {
    return this.loadedAgents.get(agentId);
  }
  /**
   * Get all loaded agents
   */
  getAll() {
    return Array.from(this.loadedAgents.values());
  }
  /**
   * Get all agent IDs
   */
  getIds() {
    return Array.from(this.loadedAgents.keys());
  }
  /**
   * Check if an agent exists
   */
  has(agentId) {
    return this.loadedAgents.has(agentId);
  }
  /**
   * Get load errors
   */
  getErrors() {
    return [...this.loadErrors];
  }
  /**
   * Reload all agents
   */
  async reload() {
    return this.loadAll();
  }
  /**
   * Reload a specific agent
   */
  async reloadAgent(agentId) {
    return this.loadAgent(agentId);
  }
  // =============================================================================
  // Private Methods
  // =============================================================================
  /**
   * Load an agent from a file in the agents directory
   */
  async loadAgentFile(fileName) {
    const filePath = join3(this.agentsPath, fileName);
    await this.loadAgentFromPath(filePath);
  }
};
function createAgentLoader(options) {
  return new AgentLoader(options);
}

// src/agent/registry.ts
import "@ax/schemas";

// src/errors.ts
var AutomatosXError = class extends Error {
  /** Error code for programmatic handling */
  code;
  /** Suggestion for how to fix the error */
  suggestion;
  /** Additional context data */
  context;
  constructor(message, code, options) {
    super(message, options?.cause ? { cause: options.cause } : void 0);
    this.name = "AutomatosXError";
    this.code = code;
    this.suggestion = options?.suggestion;
    this.context = options?.context;
  }
  /**
   * Get formatted error message with suggestion
   */
  toUserMessage() {
    let msg = `${this.message}`;
    if (this.suggestion) {
      msg += `
  Suggestion: ${this.suggestion}`;
    }
    return msg;
  }
};
var AgentNotFoundError = class extends AutomatosXError {
  constructor(agentId, options) {
    const message = `Agent "${agentId}" not found`;
    let suggestion;
    if (options?.similarAgents && options.similarAgents.length > 0) {
      suggestion = `Did you mean: ${options.similarAgents.join(", ")}?`;
    } else if (options?.availableAgents && options.availableAgents.length > 0) {
      const preview = options.availableAgents.slice(0, 5).join(", ");
      const more = options.availableAgents.length > 5 ? ` (and ${options.availableAgents.length - 5} more)` : "";
      suggestion = `Available agents: ${preview}${more}. Run "ax agent list" to see all.`;
    } else {
      suggestion = 'Run "ax agent list" to see available agents.';
    }
    super(message, "AGENT_NOT_FOUND", {
      suggestion,
      context: {
        requestedAgent: agentId,
        availableAgents: options?.availableAgents,
        similarAgents: options?.similarAgents
      }
    });
    this.name = "AgentNotFoundError";
  }
};
var AgentExecutionError = class extends AutomatosXError {
  constructor(agentId, reason, options) {
    let suggestion = "Try running the task again.";
    if (options?.timeout) {
      suggestion = "The task timed out. Try a simpler task or increase the timeout in ax.config.json.";
    } else if (options?.provider) {
      suggestion = `Check if provider "${options.provider}" is available with "ax provider status".`;
    }
    const context = {
      agentId,
      reason
    };
    if (options?.timeout !== void 0) {
      context["timeout"] = options.timeout;
    }
    if (options?.provider !== void 0) {
      context["provider"] = options.provider;
    }
    super(`Agent "${agentId}" execution failed: ${reason}`, "AGENT_EXECUTION_ERROR", {
      suggestion,
      context,
      ...options?.cause ? { cause: options.cause } : {}
    });
    this.name = "AgentExecutionError";
  }
};
var ProviderUnavailableError = class extends AutomatosXError {
  constructor(provider) {
    const message = provider ? `Provider "${provider}" is not available` : "No AI providers are available";
    super(message, "PROVIDER_UNAVAILABLE", {
      suggestion: 'Check provider status with "ax provider status" and verify your API keys.',
      context: { provider }
    });
    this.name = "ProviderUnavailableError";
  }
};
var ProviderAuthError = class extends AutomatosXError {
  constructor(provider, reason) {
    super(
      `Authentication failed for provider "${provider}"${reason ? `: ${reason}` : ""}`,
      "PROVIDER_AUTH_ERROR",
      {
        suggestion: "Verify your API key is correct and has sufficient permissions.",
        context: { provider, reason }
      }
    );
    this.name = "ProviderAuthError";
  }
};
var MemoryError = class extends AutomatosXError {
  constructor(message, operation) {
    super(message, "MEMORY_ERROR", {
      suggestion: 'Check memory status with "ax memory stats". Database may need maintenance.',
      context: { operation }
    });
    this.name = "MemoryError";
  }
};
var ConfigurationError = class extends AutomatosXError {
  constructor(message, field) {
    super(message, "CONFIGURATION_ERROR", {
      suggestion: field ? `Check the "${field}" field in ax.config.json.` : "Validate your ax.config.json configuration.",
      context: { field }
    });
    this.name = "ConfigurationError";
  }
};
var NotInitializedError = class extends AutomatosXError {
  constructor(what = "AutomatosX") {
    super(`${what} has not been initialized`, "NOT_INITIALIZED", {
      suggestion: 'Run "ax setup" to initialize AutomatosX in your project.',
      context: { component: what }
    });
    this.name = "NotInitializedError";
  }
};
var SessionNotFoundError = class extends AutomatosXError {
  constructor(sessionId) {
    super(`Session "${sessionId}" not found`, "SESSION_NOT_FOUND", {
      suggestion: 'Run "ax session list" to see available sessions.',
      context: { sessionId }
    });
    this.name = "SessionNotFoundError";
  }
};
function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          // substitution
          matrix[i][j - 1] + 1,
          // insertion
          matrix[i - 1][j] + 1
          // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}
function findSimilar(input, options, maxDistance = 2) {
  const inputLower = input.toLowerCase();
  return options.filter((opt) => {
    const optLower = opt.toLowerCase();
    return optLower.includes(inputLower) || inputLower.includes(optLower) || levenshteinDistance(inputLower, optLower) <= maxDistance;
  }).slice(0, 3);
}

// src/agent/registry.ts
function safeInvokeEvent3(eventName, callback, ...args) {
  if (!callback) return;
  try {
    callback(...args);
  } catch (error) {
    console.error(
      `[ax/registry] Event callback "${eventName}" threw an error:`,
      error instanceof Error ? error.message : error
    );
  }
}
var AgentRegistry = class {
  loader;
  agents = /* @__PURE__ */ new Map();
  byTeam = /* @__PURE__ */ new Map();
  byAbility = /* @__PURE__ */ new Map();
  events = {};
  initialized = false;
  constructor(options) {
    this.loader = options.loader;
  }
  // =============================================================================
  // Lifecycle Methods
  // =============================================================================
  /**
   * Initialize registry by loading all agents
   */
  async initialize() {
    if (this.initialized) {
      return { loaded: this.agents.size, errors: [] };
    }
    const { agents, errors } = await this.loader.loadAll();
    for (const loaded of agents) {
      this.registerAgent(loaded.profile);
    }
    this.initialized = true;
    return {
      loaded: agents.length,
      errors
    };
  }
  /**
   * Reload all agents from disk
   */
  async reload() {
    this.agents.clear();
    this.byTeam.clear();
    this.byAbility.clear();
    const { agents, errors } = await this.loader.reload();
    for (const loaded of agents) {
      this.registerAgent(loaded.profile);
    }
    safeInvokeEvent3("onReloaded", this.events.onReloaded, Array.from(this.agents.values()));
    return {
      loaded: agents.length,
      errors
    };
  }
  // =============================================================================
  // Agent Operations
  // =============================================================================
  /**
   * Register an agent profile
   */
  registerAgent(profile) {
    const id = profile.name;
    this.agents.set(id, profile);
    const team = profile.team ?? "default";
    if (!this.byTeam.has(team)) {
      this.byTeam.set(team, /* @__PURE__ */ new Set());
    }
    this.byTeam.get(team).add(id);
    for (const ability of profile.abilities) {
      if (!this.byAbility.has(ability)) {
        this.byAbility.set(ability, /* @__PURE__ */ new Set());
      }
      this.byAbility.get(ability).add(id);
    }
    safeInvokeEvent3("onAgentRegistered", this.events.onAgentRegistered, profile);
  }
  /**
   * Remove an agent from registry
   */
  removeAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    this.agents.delete(agentId);
    const team = agent.team ?? "default";
    this.byTeam.get(team)?.delete(agentId);
    if (this.byTeam.get(team)?.size === 0) {
      this.byTeam.delete(team);
    }
    for (const ability of agent.abilities) {
      this.byAbility.get(ability)?.delete(agentId);
      if (this.byAbility.get(ability)?.size === 0) {
        this.byAbility.delete(ability);
      }
    }
    safeInvokeEvent3("onAgentRemoved", this.events.onAgentRemoved, agentId);
    return true;
  }
  /**
   * Get agent by ID
   */
  get(agentId) {
    return this.agents.get(agentId);
  }
  /**
   * Get agent by ID (throws if not found)
   */
  getOrThrow(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      const availableAgents = Array.from(this.agents.keys());
      const similarAgents = findSimilar(agentId, availableAgents);
      throw new AgentNotFoundError(agentId, {
        availableAgents,
        similarAgents
      });
    }
    return agent;
  }
  /**
   * Check if agent exists
   */
  has(agentId) {
    return this.agents.has(agentId);
  }
  /**
   * Get all agents
   */
  getAll() {
    return Array.from(this.agents.values());
  }
  /**
   * Get all agent IDs
   */
  getIds() {
    return Array.from(this.agents.keys());
  }
  /**
   * Get agent count
   */
  get size() {
    return this.agents.size;
  }
  // =============================================================================
  // Query Methods
  // =============================================================================
  /**
   * Find agents matching filter criteria
   */
  find(filter) {
    let results = Array.from(this.agents.values());
    if (filter.team) {
      const teamAgents = this.byTeam.get(filter.team);
      if (!teamAgents) return [];
      results = results.filter((a) => teamAgents.has(a.name));
    }
    if (filter.ability) {
      const abilityAgents = this.byAbility.get(filter.ability);
      if (!abilityAgents) return [];
      results = results.filter((a) => abilityAgents.has(a.name));
    }
    if (filter.abilities && filter.abilities.length > 0) {
      results = results.filter(
        (a) => filter.abilities.some((ability) => a.abilities.includes(ability))
      );
    }
    if (filter.communicationStyle) {
      results = results.filter(
        (a) => a.personality?.communicationStyle === filter.communicationStyle
      );
    }
    if (filter.canDelegate !== void 0) {
      if (filter.canDelegate) {
        results = results.filter(
          (a) => a.orchestration && a.orchestration.maxDelegationDepth > 0
        );
      } else {
        results = results.filter(
          (a) => !a.orchestration || a.orchestration.maxDelegationDepth === 0
        );
      }
    }
    return results;
  }
  /**
   * Get agents by team
   */
  getByTeam(team) {
    const agentIds = this.byTeam.get(team);
    if (!agentIds) return [];
    const results = [];
    for (const id of agentIds) {
      const agent = this.agents.get(id);
      if (agent) {
        results.push(agent);
      }
    }
    return results;
  }
  /**
   * Get all team names
   */
  getTeams() {
    return Array.from(this.byTeam.keys());
  }
  /**
   * Get agents by ability
   */
  getByAbility(ability) {
    const agentIds = this.byAbility.get(ability);
    if (!agentIds) return [];
    const results = [];
    for (const id of agentIds) {
      const agent = this.agents.get(id);
      if (agent) {
        results.push(agent);
      }
    }
    return results;
  }
  /**
   * Get all available abilities
   */
  getAbilities() {
    return Array.from(this.byAbility.keys());
  }
  /**
   * Find agents that can perform a specific task type
   */
  findForTask(taskType) {
    const taskAbilityMap = {
      coding: ["code-generation", "implementation", "development"],
      testing: ["testing", "quality-assurance", "test-writing"],
      review: ["code-review", "analysis", "audit"],
      design: ["architecture", "design", "planning"],
      documentation: ["technical-writing", "documentation"],
      debugging: ["debugging", "troubleshooting"],
      security: ["security-audit", "threat-modeling"],
      data: ["data-engineering", "data-analysis"]
    };
    const requiredAbilities = taskAbilityMap[taskType.toLowerCase()] ?? [];
    if (requiredAbilities.length === 0) {
      return this.getAll();
    }
    return this.find({ abilities: requiredAbilities });
  }
  // =============================================================================
  // Event Management
  // =============================================================================
  /**
   * Set event handlers
   */
  setEvents(events) {
    Object.assign(this.events, events);
  }
};
function createAgentRegistry(options) {
  return new AgentRegistry(options);
}

// src/agent/executor.ts
import {
  DelegationRequestSchema,
  DelegationResultSchema,
  SessionId as SessionId2
} from "@ax/schemas";
var DEFAULT_EXECUTION_TIMEOUT_MS = 3e5;
var MAX_DELEGATION_DEPTH = 3;
var DEFAULT_AGENT_ID = "standard";
function parseSessionId2(sessionId) {
  return SessionId2.parse(sessionId);
}
function safeInvokeEvent4(eventName, callback, ...args) {
  if (!callback) return;
  try {
    callback(...args);
  } catch (error) {
    console.error(
      `[ax/executor] Event callback "${eventName}" threw an error:`,
      error instanceof Error ? error.message : error
    );
  }
}
var AgentExecutor = class {
  router;
  sessionManager;
  agentRegistry;
  memoryManager;
  defaultTimeout;
  events = {};
  constructor(options) {
    this.router = options.router;
    this.sessionManager = options.sessionManager;
    this.agentRegistry = options.agentRegistry;
    this.memoryManager = options.memoryManager ?? null;
    this.defaultTimeout = options.defaultTimeout ?? DEFAULT_EXECUTION_TIMEOUT_MS;
  }
  // =============================================================================
  // Public Methods
  // =============================================================================
  /**
   * Execute a task with a specific agent
   */
  async execute(agentId, task, options = {}) {
    if (!task || task.trim() === "") {
      throw new Error("Task description cannot be empty");
    }
    const session = options.sessionId ? await this.sessionManager.getOrThrow(options.sessionId) : await this.sessionManager.create({
      name: `Task: ${task.slice(0, 50)}${task.length > 50 ? "..." : ""}`,
      agents: [agentId]
    });
    const agent = this.agentRegistry.get(agentId);
    if (!agent) {
      const defaultAgent = this.agentRegistry.get(DEFAULT_AGENT_ID);
      if (!defaultAgent) {
        throw new Error(
          `Agent "${agentId}" not found and fallback agent "${DEFAULT_AGENT_ID}" is also unavailable. Available agents: ${this.agentRegistry.getAll().map((a) => a.name).join(", ") || "none"}`
        );
      }
      console.warn(`[ax/executor] Agent "${agentId}" not found, using "${DEFAULT_AGENT_ID}"`);
      return this.executeWithAgent(defaultAgent, task, session, options);
    }
    return this.executeWithAgent(agent, task, session, options);
  }
  /**
   * Execute a task with automatic agent selection
   */
  async executeAuto(task, options = {}) {
    if (!task || task.trim() === "") {
      throw new Error("Task description cannot be empty");
    }
    const taskType = this.inferTaskType(task);
    const candidates = this.agentRegistry.findForTask(taskType);
    if (candidates.length === 0) {
      return this.execute(DEFAULT_AGENT_ID, task, options);
    }
    const selectedAgent = candidates[0];
    return this.execute(selectedAgent.name, task, options);
  }
  /**
   * Delegate a task from one agent to another
   */
  async delegate(request) {
    const validated = DelegationRequestSchema.parse(request);
    const startTime = Date.now();
    const currentDepth = validated.context.delegationChain.length;
    if (currentDepth >= MAX_DELEGATION_DEPTH) {
      return DelegationResultSchema.parse({
        success: false,
        request: validated,
        error: `Maximum delegation depth (${MAX_DELEGATION_DEPTH}) exceeded`,
        duration: Date.now() - startTime,
        completedBy: validated.fromAgent
      });
    }
    if (validated.context.delegationChain.includes(validated.toAgent) || validated.toAgent === validated.fromAgent) {
      return DelegationResultSchema.parse({
        success: false,
        request: validated,
        error: `Circular delegation detected: "${validated.toAgent}" is already in the delegation chain`,
        duration: Date.now() - startTime,
        completedBy: validated.fromAgent
      });
    }
    const targetAgent = this.agentRegistry.get(validated.toAgent);
    if (!targetAgent) {
      return DelegationResultSchema.parse({
        success: false,
        request: validated,
        error: `Target agent not found: ${validated.toAgent}`,
        duration: Date.now() - startTime,
        completedBy: validated.fromAgent
      });
    }
    const sourceAgent = this.agentRegistry.get(validated.fromAgent);
    if (sourceAgent) {
      const maxDepth = sourceAgent.orchestration?.maxDelegationDepth ?? 0;
      if (maxDepth === 0) {
        return DelegationResultSchema.parse({
          success: false,
          request: validated,
          error: `Agent "${validated.fromAgent}" is not allowed to delegate`,
          duration: Date.now() - startTime,
          completedBy: validated.fromAgent
        });
      }
    }
    safeInvokeEvent4("onDelegation", this.events.onDelegation, validated.fromAgent, validated.toAgent, validated.task);
    try {
      const executeOptions = {
        timeout: validated.options.timeout,
        context: validated.context.sharedData,
        delegationChain: [...validated.context.delegationChain, validated.fromAgent]
      };
      if (validated.context.sessionId) {
        executeOptions.sessionId = validated.context.sessionId;
      }
      const result = await this.execute(validated.toAgent, validated.task, executeOptions);
      return DelegationResultSchema.parse({
        success: result.response.success,
        request: validated,
        result: result.response.output,
        error: result.response.error,
        duration: Date.now() - startTime,
        completedBy: validated.toAgent
      });
    } catch (error) {
      return DelegationResultSchema.parse({
        success: false,
        request: validated,
        error: error instanceof Error ? error.message : "Unknown error",
        duration: Date.now() - startTime,
        completedBy: validated.fromAgent
      });
    }
  }
  /**
   * Set event handlers
   */
  setEvents(events) {
    Object.assign(this.events, events);
  }
  // =============================================================================
  // Private Methods
  // =============================================================================
  /**
   * Execute task with a specific agent profile
   */
  async executeWithAgent(agent, task, session, options) {
    const agentId = agent.name;
    safeInvokeEvent4("onExecutionStart", this.events.onExecutionStart, agentId, task);
    const sessionTask = await this.sessionManager.addTask({
      sessionId: parseSessionId2(session.id),
      description: task,
      agentId,
      metadata: {
        delegationChain: options.delegationChain ?? []
      }
    });
    await this.sessionManager.startTask(session.id, sessionTask.id);
    const request = {
      task: this.buildPrompt(agent, task, options.context),
      agent: agentId,
      context: {
        systemPrompt: agent.systemPrompt,
        abilities: agent.abilities,
        personality: agent.personality,
        delegationChain: options.delegationChain ?? [],
        ...options.context
      },
      timeout: options.timeout ?? this.defaultTimeout,
      stream: options.stream ?? false,
      priority: "normal"
    };
    try {
      const response = await this.router.route(request);
      if (response.success) {
        await this.sessionManager.completeTask(session.id, sessionTask.id, response.output);
      } else {
        await this.sessionManager.failTask(session.id, sessionTask.id, response.error ?? "Unknown error");
      }
      if (options.saveToMemory !== false && this.memoryManager && response.success) {
        this.saveToMemory(agentId, task, response.output, session.id);
      }
      const updatedSession = await this.sessionManager.getOrThrow(session.id);
      const updatedTask = updatedSession.tasks.find((t) => t.id === sessionTask.id);
      if (!updatedTask) {
        throw new Error(`Task ${sessionTask.id} not found in session ${session.id} after execution`);
      }
      const result = {
        response,
        session: updatedSession,
        task: updatedTask,
        agentId,
        delegated: (options.delegationChain?.length ?? 0) > 0
      };
      safeInvokeEvent4("onExecutionEnd", this.events.onExecutionEnd, result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await this.sessionManager.failTask(session.id, sessionTask.id, errorMessage);
      safeInvokeEvent4("onError", this.events.onError, agentId, error instanceof Error ? error : new Error(errorMessage));
      throw error;
    }
  }
  /**
   * Build prompt with agent context
   */
  buildPrompt(agent, task, additionalContext) {
    const parts = [];
    if (agent.systemPrompt) {
      parts.push(`[Agent Context]
${agent.systemPrompt}
`);
    }
    if (agent.personality) {
      const { traits, communicationStyle, catchphrase } = agent.personality;
      parts.push(`[Communication]
Style: ${communicationStyle}
Traits: ${traits.join(", ")}`);
      if (catchphrase) {
        parts.push(`Catchphrase: "${catchphrase}"`);
      }
      parts.push("");
    }
    if (agent.abilities.length > 0) {
      parts.push(`[Abilities]
${agent.abilities.join(", ")}
`);
    }
    if (additionalContext && Object.keys(additionalContext).length > 0) {
      try {
        const seen = /* @__PURE__ */ new WeakSet();
        const json = JSON.stringify(additionalContext, (key, value) => {
          if (typeof value === "object" && value !== null) {
            if (seen.has(value)) return "[Circular]";
            seen.add(value);
          }
          return value;
        }, 2);
        parts.push(`[Additional Context]
${json}
`);
      } catch (error) {
        parts.push(`[Additional Context]
[Failed to serialize: ${error instanceof Error ? error.message : "Unknown error"}]
`);
      }
    }
    parts.push(`[Task]
${task}`);
    return parts.join("\n");
  }
  /**
   * Infer task type from description
   */
  inferTaskType(task) {
    const lowerTask = task.toLowerCase();
    if (lowerTask.includes("code") || lowerTask.includes("implement") || lowerTask.includes("write function")) {
      return "coding";
    }
    if (lowerTask.includes("test") || lowerTask.includes("verify") || lowerTask.includes("validate")) {
      return "testing";
    }
    if (lowerTask.includes("review") || lowerTask.includes("analyze") || lowerTask.includes("audit")) {
      return "review";
    }
    if (lowerTask.includes("design") || lowerTask.includes("architect") || lowerTask.includes("plan")) {
      return "design";
    }
    if (lowerTask.includes("document") || lowerTask.includes("explain") || lowerTask.includes("describe")) {
      return "documentation";
    }
    if (lowerTask.includes("fix") || lowerTask.includes("debug") || lowerTask.includes("resolve")) {
      return "debugging";
    }
    if (lowerTask.includes("security") || lowerTask.includes("vulnerabilit") || lowerTask.includes("threat")) {
      return "security";
    }
    return "general";
  }
  /**
   * Save execution result to memory
   */
  saveToMemory(agentId, task, result, sessionId) {
    if (!this.memoryManager) return;
    try {
      this.memoryManager.add({
        content: `Task: ${task}

Result: ${result}`,
        metadata: {
          type: "task",
          source: "agent-execution",
          agentId,
          sessionId,
          tags: ["execution", agentId],
          importance: 0.5
        }
      });
    } catch (error) {
      console.warn(
        `[ax/executor] Failed to save to memory: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
};
function createAgentExecutor(options) {
  return new AgentExecutor(options);
}

// src/agent/router.ts
import "@ax/schemas";
var AGENT_KEYWORDS = {
  backend: [
    "api",
    "database",
    "server",
    "rest",
    "graphql",
    "sql",
    "endpoint",
    "auth",
    "crud",
    "backend",
    "postgres",
    "mysql",
    "mongodb",
    "redis",
    "cache",
    "microservice",
    "service",
    "controller",
    "middleware",
    "route",
    "go",
    "rust",
    "python",
    "java"
  ],
  frontend: [
    "ui",
    "component",
    "react",
    "vue",
    "angular",
    "css",
    "button",
    "form",
    "page",
    "frontend",
    "html",
    "javascript",
    "typescript",
    "tailwind",
    "styled",
    "layout",
    "responsive",
    "animation",
    "state",
    "redux",
    "nextjs",
    "svelte"
  ],
  devops: [
    "deploy",
    "ci",
    "cd",
    "docker",
    "kubernetes",
    "aws",
    "pipeline",
    "infrastructure",
    "terraform",
    "ansible",
    "helm",
    "github actions",
    "jenkins",
    "monitoring",
    "logging",
    "container",
    "cloud",
    "gcp",
    "azure",
    "nginx",
    "load balancer"
  ],
  security: [
    "vulnerability",
    "audit",
    "security",
    "penetration",
    "xss",
    "injection",
    "owasp",
    "encryption",
    "authentication",
    "authorization",
    "threat",
    "risk",
    "compliance",
    "ssl",
    "tls",
    "firewall",
    "breach",
    "cve"
  ],
  quality: [
    "test",
    "qa",
    "coverage",
    "bug",
    "e2e",
    "unit test",
    "integration test",
    "testing",
    "jest",
    "vitest",
    "cypress",
    "playwright",
    "assertion",
    "mock",
    "fixture",
    "spec"
  ],
  design: [
    "ux",
    "ui design",
    "wireframe",
    "mockup",
    "figma",
    "prototype",
    "accessibility",
    "a11y",
    "user experience",
    "user interface",
    "design system",
    "typography",
    "color",
    "visual"
  ],
  product: [
    "requirements",
    "user story",
    "roadmap",
    "feature",
    "prd",
    "product",
    "stakeholder",
    "priority",
    "backlog",
    "epic",
    "acceptance criteria",
    "mvp",
    "specification"
  ],
  data: [
    "etl",
    "analytics",
    "warehouse",
    "data model",
    "bigquery",
    "data",
    "spark",
    "airflow",
    "transformation",
    "schema",
    "migration",
    "batch",
    "streaming",
    "kafka"
  ],
  architecture: [
    "architecture",
    "system design",
    "adr",
    "scalability",
    "microservices",
    "monolith",
    "distributed",
    "event-driven",
    "saga",
    "cqrs",
    "ddd",
    "domain",
    "boundary",
    "technical debt"
  ],
  writer: [
    "documentation",
    "docs",
    "readme",
    "technical writing",
    "guide",
    "tutorial",
    "changelog",
    "api docs",
    "wiki",
    "manual",
    "instructions"
  ],
  mobile: [
    "ios",
    "android",
    "swift",
    "kotlin",
    "flutter",
    "mobile",
    "app",
    "react native",
    "expo",
    "xcode",
    "gradle",
    "cocoapods",
    "app store",
    "play store"
  ],
  fullstack: [
    "fullstack",
    "full-stack",
    "node",
    "express",
    "nest",
    "prisma",
    "trpc",
    "t3",
    "remix",
    "astro"
  ],
  researcher: [
    "research",
    "analyze",
    "investigate",
    "compare",
    "evaluate",
    "benchmark",
    "study",
    "explore",
    "survey",
    "assessment"
  ],
  "data-scientist": [
    "machine learning",
    "ml",
    "ai",
    "model",
    "training",
    "prediction",
    "classification",
    "regression",
    "neural network",
    "deep learning",
    "nlp",
    "computer vision",
    "tensorflow",
    "pytorch"
  ]
};
function selectAgent(task, registry, options = {}) {
  const result = selectAgentWithReason(task, registry, options);
  return result.agent;
}
function selectAgentWithReason(task, registry, options = {}) {
  const { defaultAgent = "standard", minMatches = 1 } = options;
  const taskLower = task.toLowerCase();
  const scores = [];
  for (const [agentId, keywords] of Object.entries(AGENT_KEYWORDS)) {
    const matched = keywords.filter((kw) => taskLower.includes(kw));
    if (matched.length >= minMatches) {
      scores.push({
        agentId,
        score: matched.length,
        keywords: matched
      });
    }
  }
  scores.sort((a, b) => b.score - a.score);
  const alternatives = scores.slice(1, 4).map((s) => s.agentId);
  if (scores.length > 0) {
    const best = scores[0];
    const agent = registry.get(best.agentId);
    if (agent) {
      const maxPossibleMatches = AGENT_KEYWORDS[best.agentId]?.length ?? 1;
      const confidence = Math.min(best.score / Math.max(maxPossibleMatches, 5), 1);
      return {
        agent,
        reason: `Selected ${best.agentId} agent based on keywords: ${best.keywords.join(", ")}`,
        matchedKeywords: best.keywords,
        confidence,
        alternatives
      };
    }
  }
  const fallbackAgent = registry.get(defaultAgent);
  if (fallbackAgent) {
    return {
      agent: fallbackAgent,
      reason: "No keyword matches, using default agent",
      matchedKeywords: [],
      confidence: 0.5,
      alternatives: []
    };
  }
  const allAgents = registry.getAll();
  if (allAgents.length > 0) {
    return {
      agent: allAgents[0],
      reason: "Using first available agent (no default found)",
      matchedKeywords: [],
      confidence: 0.1,
      alternatives: allAgents.slice(1, 4).map((a) => a.name)
    };
  }
  throw new Error(
    "No agents available in registry. Ensure at least one agent is registered before routing tasks. Check that agent configuration files exist and are valid."
  );
}
function getAgentKeywords(agentId) {
  return AGENT_KEYWORDS[agentId] ?? [];
}
function getAllKeywords() {
  return { ...AGENT_KEYWORDS };
}
function findAgentsByKeyword(keyword) {
  const lowerKeyword = keyword.toLowerCase();
  return Object.entries(AGENT_KEYWORDS).filter(([, keywords]) => keywords.some((k) => k.includes(lowerKeyword))).map(([agentId]) => agentId);
}

// src/index.ts
import {
  DEFAULT_CONFIG as DEFAULT_CONFIG2,
  VERSION,
  DIR_AUTOMATOSX,
  DIR_AGENTS,
  DIR_SESSIONS,
  DIR_MEMORY,
  DIR_CHECKPOINTS,
  FILE_MEMORY_DB,
  FILE_CONFIG,
  DISPLAY_ID_LENGTH,
  DISPLAY_PREVIEW_LONG,
  LIST_PREVIEW_LIMIT,
  LIST_SEARCH_LIMIT,
  LIST_TOP_TAGS,
  BYTES_PER_KB,
  BYTES_PER_MB,
  BYTES_PER_GB,
  MS_PER_SECOND,
  MS_PER_MINUTE,
  MS_PER_HOUR,
  MS_PER_DAY
} from "@ax/schemas";
export {
  AGENT_KEYWORDS,
  AgentExecutionError,
  AgentExecutor,
  AgentLoader,
  AgentNotFoundError,
  AgentRegistry,
  AutomatosXError,
  BYTES_PER_GB,
  BYTES_PER_KB,
  BYTES_PER_MB,
  ConfigurationError,
  DEFAULT_CONFIG2 as DEFAULT_CONFIG,
  DIR_AGENTS,
  DIR_AUTOMATOSX,
  DIR_CHECKPOINTS,
  DIR_MEMORY,
  DIR_SESSIONS,
  DISPLAY_ID_LENGTH,
  DISPLAY_PREVIEW_LONG,
  FILE_CONFIG,
  FILE_MEMORY_DB,
  LIST_PREVIEW_LIMIT,
  LIST_SEARCH_LIMIT,
  LIST_TOP_TAGS,
  MS_PER_DAY,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  MS_PER_SECOND,
  MemoryError,
  MemoryManager,
  NotInitializedError,
  ProviderAuthError,
  ProviderRouter,
  ProviderUnavailableError,
  SessionManager,
  SessionNotFoundError,
  VERSION,
  createAgentExecutor,
  createAgentLoader,
  createAgentRegistry,
  createProviderRouter,
  createSessionManager,
  findAgentsByKeyword,
  findSimilar,
  getAgentKeywords,
  getAllKeywords,
  getDefaultConfig,
  isValidConfig,
  levenshteinDistance,
  loadConfig,
  loadConfigSync,
  selectAgent,
  selectAgentWithReason
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
/**
 * Configuration Loader
 *
 * Loads and validates AutomatosX configuration from ax.config.json
 *
 * @module @ax/core/config
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Configuration Module
 *
 * Loads and validates AutomatosX configuration from files and environment.
 *
 * @module @ax/core/config
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Provider Router - Intelligent provider selection and routing
 *
 * Uses ReScript routing algorithms for multi-factor provider selection
 * with health monitoring and fallback chain support.
 *
 * @module @ax/core/router
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Router exports
 *
 * @module @ax/core/router
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Session Manager - Session lifecycle and state management
 *
 * Manages multi-agent sessions with task tracking, state persistence,
 * and checkpoint support for resumable workflows.
 *
 * @module @ax/core/session
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Session exports
 *
 * @module @ax/core/session
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Agent Loader - Load agent profiles from YAML files
 *
 * Loads and validates agent profiles from the .automatosx/agents directory.
 *
 * @module @ax/core/agent
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * AutomatosX Error Classes
 *
 * Provides structured error types with helpful suggestions for users.
 *
 * @module @ax/core/errors
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Agent Registry - Central registry for agent profiles
 *
 * Provides fast lookup and querying of agent profiles with
 * support for teams, abilities, and filtering.
 *
 * @module @ax/core/agent
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Agent Executor - Task execution engine for agents
 *
 * Executes tasks using agent profiles with support for
 * delegation, session tracking, and memory integration.
 *
 * @module @ax/core/agent
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Simple Agent Router - Keyword-based agent selection
 *
 * Provides fast, simple agent selection based on keyword matching.
 * This is intentionally simple - complex ML-based routing was deemed
 * over-engineering. Simple keyword matching works just as well.
 *
 * @module @ax/core/agent
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Agent exports
 *
 * @module @ax/core/agent
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * AutomatosX Core
 *
 * Core orchestration engine for the AutomatosX AI agent platform.
 * Provides memory management, configuration loading, provider routing,
 * session management, and agent execution.
 *
 * @packageDocumentation
 * @module @ax/core
 *
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
//# sourceMappingURL=index.js.map