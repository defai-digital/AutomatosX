/**
 * FTS5 Full-Text Search Store
 *
 * Provides full-text search capabilities using SQLite FTS5 extension.
 * Used for semantic search over memory items.
 *
 * Invariants:
 * - INV-FTS-001: FTS index updated on every insert/update/delete
 * - INV-FTS-002: Search results ranked by relevance (BM25)
 * - INV-FTS-003: Support for phrase and prefix queries
 */

import type Database from 'better-sqlite3';

/**
 * FTS search result
 */
export interface FTSResult {
  key: string;
  namespace: string;
  value: string;
  snippet: string;
  rank: number;
  createdAt: string;
}

/**
 * FTS search options
 */
export interface FTSSearchOptions {
  /** Namespace to search within */
  namespace?: string | undefined;
  /** Maximum results to return */
  limit?: number | undefined;
  /** Offset for pagination */
  offset?: number | undefined;
  /** Highlight snippets around matches */
  highlight?: boolean | undefined;
  /** Prefix for highlighted text */
  highlightPrefix?: string | undefined;
  /** Suffix for highlighted text */
  highlightSuffix?: string | undefined;
}

/**
 * FTS item to index
 */
export interface FTSItem {
  key: string;
  namespace: string;
  value: string;
  tags?: string[] | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Error thrown by FTS store operations
 */
export class FTSStoreError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'FTSStoreError';
  }
}

/**
 * Error codes for FTS store
 */
export const FTSStoreErrorCodes = {
  INDEX_ERROR: 'FTS_INDEX_ERROR',
  SEARCH_ERROR: 'FTS_SEARCH_ERROR',
  DATABASE_ERROR: 'FTS_DATABASE_ERROR',
} as const;

/**
 * SQLite FTS5 Store implementation
 */
export class SQLiteFTSStore {
  private readonly db: Database.Database;
  private readonly tableName: string;
  private readonly ftsTableName: string;

  constructor(db: Database.Database, tableName = 'memory_items') {
    this.db = db;
    this.tableName = tableName;
    this.ftsTableName = `${tableName}_fts`;
    this.initialize();
  }

  /**
   * Initializes the database schema with FTS5 support
   */
  private initialize(): void {
    // Main table for memory items
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL,
        namespace TEXT NOT NULL DEFAULT 'default',
        value TEXT NOT NULL,
        tags TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(key, namespace)
      );

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_namespace
        ON ${this.tableName}(namespace);

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_created_at
        ON ${this.tableName}(created_at);
    `);

    // FTS5 virtual table for full-text search
    // INV-FTS-002: Using BM25 ranking algorithm
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS ${this.ftsTableName} USING fts5(
        key,
        namespace,
        value,
        tags,
        content='${this.tableName}',
        content_rowid='id',
        tokenize='porter unicode61'
      );
    `);

    // Triggers to keep FTS index in sync (INV-FTS-001)
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS ${this.tableName}_ai AFTER INSERT ON ${this.tableName} BEGIN
        INSERT INTO ${this.ftsTableName}(rowid, key, namespace, value, tags)
        VALUES (new.id, new.key, new.namespace, new.value, new.tags);
      END;

      CREATE TRIGGER IF NOT EXISTS ${this.tableName}_ad AFTER DELETE ON ${this.tableName} BEGIN
        INSERT INTO ${this.ftsTableName}(${this.ftsTableName}, rowid, key, namespace, value, tags)
        VALUES ('delete', old.id, old.key, old.namespace, old.value, old.tags);
      END;

      CREATE TRIGGER IF NOT EXISTS ${this.tableName}_au AFTER UPDATE ON ${this.tableName} BEGIN
        INSERT INTO ${this.ftsTableName}(${this.ftsTableName}, rowid, key, namespace, value, tags)
        VALUES ('delete', old.id, old.key, old.namespace, old.value, old.tags);
        INSERT INTO ${this.ftsTableName}(rowid, key, namespace, value, tags)
        VALUES (new.id, new.key, new.namespace, new.value, new.tags);
      END;
    `);
  }

  /**
   * Stores an item with full-text indexing
   */
  store(item: FTSItem): void {
    const tagsStr = item.tags?.join(' ') ?? null;
    const metadataStr = item.metadata ? JSON.stringify(item.metadata) : null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO ${this.tableName} (key, namespace, value, tags, metadata)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(key, namespace) DO UPDATE SET
          value = excluded.value,
          tags = excluded.tags,
          metadata = excluded.metadata,
          updated_at = datetime('now')
      `);

      stmt.run(item.key, item.namespace, item.value, tagsStr, metadataStr);
    } catch (error) {
      throw new FTSStoreError(
        FTSStoreErrorCodes.INDEX_ERROR,
        `Failed to store item: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Retrieves an item by key and namespace
   */
  get(key: string, namespace = 'default'): FTSItem | null {
    const stmt = this.db.prepare(`
      SELECT key, namespace, value, tags, metadata
      FROM ${this.tableName}
      WHERE key = ? AND namespace = ?
    `);

    const row = stmt.get(key, namespace) as ItemRow | undefined;

    if (!row) {
      return null;
    }

    return rowToItem(row);
  }

  /**
   * Deletes an item by key and namespace
   */
  delete(key: string, namespace = 'default'): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM ${this.tableName}
      WHERE key = ? AND namespace = ?
    `);

    const result = stmt.run(key, namespace);
    return result.changes > 0;
  }

  /**
   * Full-text search with BM25 ranking
   * INV-FTS-002: Results ranked by relevance
   * INV-FTS-003: Supports phrase and prefix queries
   *
   * @param query - FTS5 query string (supports AND, OR, NOT, phrases, prefixes)
   * @param options - Search options
   */
  search(query: string, options: FTSSearchOptions = {}): FTSResult[] {
    const {
      namespace,
      limit = 50,
      offset = 0,
      highlight = true,
      highlightPrefix = '**',
      highlightSuffix = '**',
    } = options;

    try {
      // Escape special FTS5 characters in query
      const escapedQuery = this.escapeQuery(query);

      // Escape SQL string literals to prevent SQL injection
      const escapedHighlightPrefix = highlightPrefix.replace(/'/g, "''");
      const escapedHighlightSuffix = highlightSuffix.replace(/'/g, "''");

      let sql = `
        SELECT
          m.key,
          m.namespace,
          m.value,
          ${highlight ? `highlight(${this.ftsTableName}, 2, '${escapedHighlightPrefix}', '${escapedHighlightSuffix}')` : 'm.value'} as snippet,
          bm25(${this.ftsTableName}) as rank,
          m.created_at
        FROM ${this.ftsTableName} fts
        JOIN ${this.tableName} m ON fts.rowid = m.id
        WHERE ${this.ftsTableName} MATCH ?
      `;

      const params: (string | number)[] = [escapedQuery];

      if (namespace !== undefined) {
        sql += ` AND m.namespace = ?`;
        params.push(namespace);
      }

      sql += `
        ORDER BY rank
        LIMIT ? OFFSET ?
      `;

      params.push(limit, offset);

      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params) as SearchRow[];

      return rows.map((row) => ({
        key: row.key,
        namespace: row.namespace,
        value: row.value,
        snippet: row.snippet,
        rank: row.rank,
        createdAt: row.created_at,
      }));
    } catch (error) {
      throw new FTSStoreError(
        FTSStoreErrorCodes.SEARCH_ERROR,
        `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { query }
      );
    }
  }

  /**
   * Lists all items in a namespace
   */
  list(namespace = 'default', limit = 100, offset = 0): FTSItem[] {
    const stmt = this.db.prepare(`
      SELECT key, namespace, value, tags, metadata
      FROM ${this.tableName}
      WHERE namespace = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(namespace, limit, offset) as ItemRow[];
    return rows.map(rowToItem);
  }

  /**
   * Counts items in a namespace
   */
  count(namespace?: string): number {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const params: string[] = [];

    if (namespace !== undefined) {
      sql += ` WHERE namespace = ?`;
      params.push(namespace);
    }

    const stmt = this.db.prepare(sql);
    const row = stmt.get(...params) as { count: number };
    return row.count;
  }

  /**
   * Clears all items in a namespace
   */
  clear(namespace?: string): number {
    let sql = `DELETE FROM ${this.tableName}`;
    const params: string[] = [];

    if (namespace !== undefined) {
      sql += ` WHERE namespace = ?`;
      params.push(namespace);
    }

    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);
    return result.changes;
  }

  /**
   * Rebuilds the FTS index
   */
  rebuildIndex(): void {
    this.db.exec(`INSERT INTO ${this.ftsTableName}(${this.ftsTableName}) VALUES('rebuild')`);
  }

  /**
   * Optimizes the FTS index
   */
  optimizeIndex(): void {
    this.db.exec(`INSERT INTO ${this.ftsTableName}(${this.ftsTableName}) VALUES('optimize')`);
  }

  /**
   * Gets index statistics
   */
  getStats(): { totalItems: number; namespaces: string[]; indexSize: number } {
    const countStmt = this.db.prepare(
      `SELECT COUNT(*) as count FROM ${this.tableName}`
    );
    const countRow = countStmt.get() as { count: number };

    const nsStmt = this.db.prepare(
      `SELECT DISTINCT namespace FROM ${this.tableName}`
    );
    const nsRows = nsStmt.all() as { namespace: string }[];

    // Approximate index size from page count
    const sizeStmt = this.db.prepare(`
      SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()
    `);
    const sizeRow = sizeStmt.get() as { size: number } | undefined;

    return {
      totalItems: countRow.count,
      namespaces: nsRows.map((r) => r.namespace),
      indexSize: sizeRow?.size ?? 0,
    };
  }

  /**
   * Escapes special characters in FTS5 query
   */
  private escapeQuery(query: string): string {
    // Handle common query patterns
    // Allow: AND, OR, NOT, quotes for phrases, * for prefix
    // Escape: - at start, special chars

    // If query looks like natural language, wrap in quotes for phrase search
    if (!query.includes('"') && !query.includes('*') && !(/\b(AND|OR|NOT)\b/i.exec(query))) {
      // Simple query - treat as phrase
      return `"${query.replace(/"/g, '""')}"`;
    }

    return query;
  }
}

/**
 * Row type from main table
 */
interface ItemRow {
  key: string;
  namespace: string;
  value: string;
  tags: string | null;
  metadata: string | null;
}

/**
 * Row type from search results
 */
interface SearchRow {
  key: string;
  namespace: string;
  value: string;
  snippet: string;
  rank: number;
  created_at: string;
}

/**
 * Safely parses JSON metadata with error handling
 * Returns undefined if parsing fails (corrupted data)
 */
function safeParseMetadata(json: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    // Log corrupted metadata but don't crash - return undefined
    return undefined;
  }
}

/**
 * Converts a database row to an FTSItem
 */
function rowToItem(row: ItemRow): FTSItem {
  const item: FTSItem = {
    key: row.key,
    namespace: row.namespace,
    value: row.value,
  };

  if (row.tags !== null) {
    item.tags = row.tags.split(' ').filter((t) => t.length > 0);
  }

  if (row.metadata !== null) {
    const parsed = safeParseMetadata(row.metadata);
    if (parsed !== undefined) {
      item.metadata = parsed;
    }
  }

  return item;
}

/**
 * Creates a SQLite FTS store
 */
export function createSQLiteFTSStore(
  db: Database.Database,
  tableName?: string
): SQLiteFTSStore {
  return new SQLiteFTSStore(db, tableName);
}
