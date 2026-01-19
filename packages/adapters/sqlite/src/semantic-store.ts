/**
 * SQLite Semantic Store
 *
 * Provides semantic search with vector embeddings using SQLite.
 * Stores embeddings as binary blobs for efficient storage.
 *
 * Invariants:
 * - INV-SEM-001: Embeddings computed on store, cached until content changes
 * - INV-SEM-002: Search returns results sorted by similarity descending
 * - INV-SEM-003: Similarity scores normalized to 0-1 range
 * - INV-SEM-004: Namespace isolation
 */

import type Database from 'better-sqlite3';
import { getErrorMessage } from '@defai.digital/contracts';
import type {
  SemanticItem,
  SemanticSearchRequest,
  SemanticSearchResponse,
  SemanticStoreRequest,
  SemanticStoreResponse,
  SemanticListRequest,
  SemanticListResponse,
  SemanticDeleteResponse,
} from '@defai.digital/contracts';
import type {
  SemanticStorePort,
  SemanticStoreStats,
} from '@defai.digital/semantic-context';
import { isValidTableName, invalidTableNameMessage } from './validation.js';

/**
 * Error thrown by semantic store operations
 */
export class SemanticStoreError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SemanticStoreError';
  }
}

/**
 * Error codes for semantic store
 */
export const SemanticStoreErrorCodes = {
  STORE_ERROR: 'SEMANTIC_STORE_ERROR',
  SEARCH_ERROR: 'SEMANTIC_SEARCH_ERROR',
  DATABASE_ERROR: 'SEMANTIC_DATABASE_ERROR',
  INVALID_TABLE_NAME: 'SEMANTIC_INVALID_TABLE_NAME',
  DIMENSION_MISMATCH: 'SEMANTIC_DIMENSION_MISMATCH',
} as const;

/**
 * Convert embedding array to buffer for storage
 */
function embeddingToBuffer(embedding: number[]): Buffer {
  const buffer = Buffer.alloc(embedding.length * 8);
  for (let i = 0; i < embedding.length; i++) {
    buffer.writeDoubleLE(embedding[i]!, i * 8);
  }
  return buffer;
}

/**
 * Convert buffer back to embedding array
 */
function bufferToEmbedding(buffer: Buffer): number[] {
  const embedding: number[] = [];
  for (let i = 0; i < buffer.length; i += 8) {
    embedding.push(buffer.readDoubleLE(i));
  }
  return embedding;
}

/**
 * Compute cosine similarity between two embeddings
 * INV-SEM-003: Returns normalized score in [0, 1]
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  if (a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;

  // Normalize from [-1, 1] to [0, 1]
  return (dot / denom + 1) / 2;
}

/**
 * Database row types
 */
interface SemanticItemRow {
  id: number;
  key: string;
  namespace: string;
  content: string;
  embedding: Buffer | null;
  embedding_dimension: number | null;
  embedding_model: string | null;
  content_hash: string | null;
  tags: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * SQLite Semantic Store implementation
 */
export class SqliteSemanticStore implements SemanticStorePort {
  private readonly db: Database.Database;
  private readonly tableName: string;

  constructor(db: Database.Database, tableName = 'semantic_items') {
    if (!isValidTableName(tableName)) {
      throw new SemanticStoreError(
        SemanticStoreErrorCodes.INVALID_TABLE_NAME,
        invalidTableNameMessage(tableName)
      );
    }
    this.db = db;
    this.tableName = tableName;
    this.initialize();
  }

  /**
   * Initialize database schema
   */
  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL,
        namespace TEXT NOT NULL DEFAULT 'default',
        content TEXT NOT NULL,
        embedding BLOB,
        embedding_dimension INTEGER,
        embedding_model TEXT,
        content_hash TEXT,
        tags TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(key, namespace)
      );

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_namespace
        ON ${this.tableName}(namespace);

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_content_hash
        ON ${this.tableName}(content_hash);

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_created_at
        ON ${this.tableName}(created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_dimension
        ON ${this.tableName}(embedding_dimension);
    `);
  }

  /**
   * Store item with embedding
   * INV-SEM-001: Caches embedding until content changes
   */
  async store(request: SemanticStoreRequest): Promise<SemanticStoreResponse> {
    const namespace = request.namespace ?? 'default';
    const tagsStr = request.tags?.join(',') ?? null;
    const metadataStr = request.metadata ? JSON.stringify(request.metadata) : null;
    const embeddingBuffer = request.embedding ? embeddingToBuffer(request.embedding) : null;
    const embeddingDimension = request.embedding?.length ?? null;

    try {
      // Check if item exists
      const existingStmt = this.db.prepare(`
        SELECT id, created_at FROM ${this.tableName}
        WHERE key = ? AND namespace = ?
      `);
      const existing = existingStmt.get(request.key, namespace) as { id: number; created_at: string } | undefined;

      const stmt = this.db.prepare(`
        INSERT INTO ${this.tableName} (
          key, namespace, content, embedding, embedding_dimension,
          embedding_model, content_hash, tags, metadata
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(key, namespace) DO UPDATE SET
          content = excluded.content,
          embedding = excluded.embedding,
          embedding_dimension = excluded.embedding_dimension,
          embedding_model = excluded.embedding_model,
          content_hash = excluded.content_hash,
          tags = excluded.tags,
          metadata = excluded.metadata,
          updated_at = datetime('now')
      `);

      stmt.run(
        request.key,
        namespace,
        request.content,
        embeddingBuffer,
        embeddingDimension,
        null, // embedding model not tracked in request
        null, // content hash computed elsewhere
        tagsStr,
        metadataStr
      );

      // Get the stored item
      const itemStmt = this.db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE key = ? AND namespace = ?
      `);
      const row = itemStmt.get(request.key, namespace) as SemanticItemRow;

      const item = this.rowToItem(row, false);

      return {
        success: true,
        item,
        created: !existing,
        embeddingComputed: false, // SQLite adapter doesn't compute embeddings
      };
    } catch (error) {
      throw new SemanticStoreError(
        SemanticStoreErrorCodes.STORE_ERROR,
        `Failed to store item: ${getErrorMessage(error)}`
      );
    }
  }

  /**
   * Search by semantic similarity
   * INV-SEM-002: Results sorted by similarity descending
   * INV-SEM-003: Scores normalized to [0, 1]
   * INV-SEM-004: Namespace isolation
   */
  async search(request: SemanticSearchRequest): Promise<SemanticSearchResponse> {
    const startTime = Date.now();

    try {
      // Build query
      let sql = `SELECT * FROM ${this.tableName} WHERE embedding IS NOT NULL`;
      const params: (string | number)[] = [];

      // INV-SEM-004: Namespace isolation
      if (request.namespace) {
        sql += ` AND namespace = ?`;
        params.push(request.namespace);
      }

      // Tag filtering
      if (request.filterTags && request.filterTags.length > 0) {
        for (const tag of request.filterTags) {
          sql += ` AND tags LIKE ?`;
          params.push(`%${tag}%`);
        }
      }

      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params) as SemanticItemRow[];

      // Check if query embedding is provided (from semantic manager)
      const queryEmbedding = request.queryEmbedding;
      const minSimilarity = request.minSimilarity ?? 0.7;
      const topK = request.topK ?? 10;

      // If no query embedding is provided, return empty results
      // The semantic manager should compute and pass the query embedding
      if (!queryEmbedding || queryEmbedding.length === 0) {
        return {
          results: [],
          totalMatches: 0,
          query: request.query,
          namespace: request.namespace,
          durationMs: Date.now() - startTime,
        };
      }

      const scored = rows
        .map((row) => {
          const embedding = row.embedding ? bufferToEmbedding(row.embedding) : null;
          if (!embedding) return null;

          const similarity = cosineSimilarity(queryEmbedding, embedding);
          return { row, similarity };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null && s.similarity >= minSimilarity);

      // INV-SEM-002: Sort by similarity descending
      scored.sort((a, b) => b.similarity - a.similarity);

      // Take top K
      const topResults = scored.slice(0, topK);

      const results = topResults.map((s, index) => ({
        item: this.rowToItem(s.row, request.includeEmbeddings ?? false),
        similarity: s.similarity,
        rank: index + 1,
        snippet: s.row.content.slice(0, 200),
      }));

      return {
        results,
        totalMatches: scored.length,
        query: request.query,
        namespace: request.namespace,
        durationMs: Date.now() - startTime,
        queryEmbedding: request.includeEmbeddings ? queryEmbedding : undefined,
      };
    } catch (error) {
      throw new SemanticStoreError(
        SemanticStoreErrorCodes.SEARCH_ERROR,
        `Search failed: ${getErrorMessage(error)}`,
        { query: request.query }
      );
    }
  }

  /**
   * Get item by key
   */
  async get(key: string, namespace = 'default'): Promise<SemanticItem | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM ${this.tableName}
      WHERE key = ? AND namespace = ?
    `);

    const row = stmt.get(key, namespace) as SemanticItemRow | undefined;
    if (!row) return null;

    return this.rowToItem(row, true);
  }

  /**
   * List items
   */
  async list(request: SemanticListRequest): Promise<SemanticListResponse> {
    const namespace = request.namespace ?? 'default';
    const limit = request.limit ?? 10;
    const offset = request.offset ?? 0;
    const orderBy = request.orderBy ?? 'createdAt';
    const orderDir = request.orderDir ?? 'desc';

    // Map orderBy to column name
    const columnMap: Record<string, string> = {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      key: 'key',
    };
    const column = columnMap[orderBy] ?? 'created_at';
    const direction = orderDir === 'asc' ? 'ASC' : 'DESC';

    let sql = `SELECT * FROM ${this.tableName} WHERE namespace = ?`;
    const params: (string | number)[] = [namespace];

    // Key prefix filter
    if (request.keyPrefix) {
      sql += ` AND key LIKE ?`;
      params.push(`${request.keyPrefix}%`);
    }

    // Tag filter
    if (request.filterTags && request.filterTags.length > 0) {
      for (const tag of request.filterTags) {
        sql += ` AND tags LIKE ?`;
        params.push(`%${tag}%`);
      }
    }

    // Get total count
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countStmt = this.db.prepare(countSql);
    const countRow = countStmt.get(...params) as { count: number };
    const total = countRow.count;

    // Add ordering and pagination
    sql += ` ORDER BY ${column} ${direction} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as SemanticItemRow[];

    const items = rows.map((row) => this.rowToItem(row, false));

    return {
      items,
      total,
      hasMore: offset + limit < total,
      namespace,
    };
  }

  /**
   * Delete item
   */
  async delete(key: string, namespace = 'default'): Promise<SemanticDeleteResponse> {
    const stmt = this.db.prepare(`
      DELETE FROM ${this.tableName}
      WHERE key = ? AND namespace = ?
    `);

    const result = stmt.run(key, namespace);

    return {
      deleted: result.changes > 0,
      key,
      namespace,
    };
  }

  /**
   * Check if item exists
   */
  async exists(key: string, namespace = 'default'): Promise<boolean> {
    const stmt = this.db.prepare(`
      SELECT 1 FROM ${this.tableName}
      WHERE key = ? AND namespace = ?
    `);

    const row = stmt.get(key, namespace);
    return row !== undefined;
  }

  /**
   * Get statistics
   */
  async getStats(namespace?: string): Promise<SemanticStoreStats> {
    let sql = `
      SELECT
        COUNT(*) as total_items,
        COUNT(embedding) as items_with_embeddings,
        MIN(embedding_dimension) as min_dim,
        MAX(embedding_dimension) as max_dim
      FROM ${this.tableName}
    `;
    const params: string[] = [];

    if (namespace) {
      sql += ` WHERE namespace = ?`;
      params.push(namespace);
    }

    const stmt = this.db.prepare(sql);
    const row = stmt.get(...params) as {
      total_items: number;
      items_with_embeddings: number;
      min_dim: number | null;
      max_dim: number | null;
    };

    // Get embedding model
    const modelStmt = this.db.prepare(`
      SELECT DISTINCT embedding_model FROM ${this.tableName}
      WHERE embedding_model IS NOT NULL
      ${namespace ? 'AND namespace = ?' : ''}
      LIMIT 1
    `);
    const modelRow = modelStmt.get(...params) as { embedding_model: string } | undefined;

    // Get namespaces if not filtering
    let namespaces: string[] | undefined;
    if (!namespace) {
      const nsStmt = this.db.prepare(`
        SELECT DISTINCT namespace FROM ${this.tableName}
      `);
      const nsRows = nsStmt.all() as { namespace: string }[];
      namespaces = nsRows.map((r) => r.namespace);
    }

    const result: SemanticStoreStats = {
      totalItems: row.total_items,
      itemsWithEmbeddings: row.items_with_embeddings,
      embeddingDimension: row.min_dim ?? null,
      embeddingModel: modelRow?.embedding_model ?? null,
      namespace: namespace ?? null,
    };

    // Only include namespaces if not filtering by specific namespace
    if (!namespace && namespaces) {
      result.namespaces = namespaces;
    }

    return result;
  }

  /**
   * Clear namespace
   */
  async clear(namespace?: string): Promise<number> {
    let sql = `DELETE FROM ${this.tableName}`;
    const params: string[] = [];

    if (namespace) {
      sql += ` WHERE namespace = ?`;
      params.push(namespace);
    }

    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);

    return result.changes;
  }

  /**
   * Convert database row to SemanticItem
   */
  private rowToItem(row: SemanticItemRow, includeEmbedding: boolean): SemanticItem {
    const item: SemanticItem = {
      key: row.key,
      namespace: row.namespace,
      content: row.content,
      embeddingDimension: row.embedding_dimension ?? undefined,
      embeddingModel: row.embedding_model ?? undefined,
      contentHash: row.content_hash ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    if (includeEmbedding && row.embedding) {
      item.embedding = bufferToEmbedding(row.embedding);
    }

    if (row.tags) {
      item.tags = row.tags.split(',').filter((t) => t.length > 0);
    }

    if (row.metadata) {
      try {
        item.metadata = JSON.parse(row.metadata) as Record<string, unknown>;
      } catch (error) {
        // Log corrupted metadata but don't crash
        console.warn(`[SemanticStore] Failed to parse metadata for key '${row.key}':`, getErrorMessage(error));
      }
    }

    return item;
  }
}

/**
 * Creates a SQLite semantic store
 */
export function createSqliteSemanticStore(
  db: Database.Database,
  tableName?: string
): SqliteSemanticStore {
  return new SqliteSemanticStore(db, tableName);
}
