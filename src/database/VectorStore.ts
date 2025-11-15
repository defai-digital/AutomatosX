/**
 * Vector Store - SQLite-vec based vector similarity search
 *
 * Uses sqlite-vec extension with better-sqlite3 for fast vector search
 * - Storage: SQLite vec0 virtual table (vectors) + regular table (metadata)
 * - Distance metric: L2 distance (lower = more similar)
 * - Dimensions: 384 (matching all-MiniLM-L6-v2 embeddings)
 *
 * Architecture:
 * - vec0 virtual table: rowid + embedding (384 floats)
 * - metadata table: rowid + id + type + timestamp
 * - Linked by rowid for fast JOINs
 *
 * Features:
 * - Add/remove vectors with metadata
 * - K-nearest neighbor search
 * - Integrated with existing SQLite database
 * - Cross-platform (no C++ compilation)
 * - Simple SQL-based interface
 */

import Database from 'better-sqlite3';
import * as sqlite_vec from 'sqlite-vec';

export interface VectorMetadata {
  id: string; // Memory ID
  type: string; // Type of content (e.g., 'memory', 'chunk')
  timestamp: number;
}

export interface SearchResult {
  id: string;
  score: number; // Similarity score (0-1, higher is better)
  distance: number; // L2 distance (lower is better)
  metadata: VectorMetadata;
}

export interface VectorStoreOptions {
  dimensions?: number;
  db?: Database.Database; // Existing database connection
  tableName?: string; // Table name for vectors (default: 'memory_vectors')
}

export class VectorStore {
  private db: Database.Database;
  private dimensions: number;
  private tableName: string;
  private metadataTableName: string;
  private ownDb: boolean; // Track if we created the DB connection

  constructor(options: VectorStoreOptions = {}) {
    this.dimensions = options.dimensions || 384;

    // Fixed: Validate table name to prevent SQL injection
    const tableName = options.tableName || 'memory_vectors';
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error(`Invalid table name: ${tableName}. Must match pattern: ^[a-zA-Z_][a-zA-Z0-9_]*$`);
    }
    this.tableName = tableName;
    this.metadataTableName = `${this.tableName}_metadata`;
    this.ownDb = !options.db;

    // Use provided DB or create new one
    if (options.db) {
      this.db = options.db;
    } else {
      // Create in-memory database for testing
      this.db = new Database(':memory:');
    }

    // Load sqlite-vec extension
    sqlite_vec.load(this.db);

    // Initialize tables
    this._initializeTables();

    console.log(`VectorStore initialized with ${this.dimensions} dimensions (sqlite-vec)`);
  }

  /**
   * Initialize vec0 virtual table and metadata table
   */
  private _initializeTables(): void {
    // Create vec0 virtual table for embeddings
    // Only stores rowid (auto) + embedding vector
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS ${this.tableName}
      USING vec0(
        embedding float[${this.dimensions}]
      );
    `);

    // Create regular table for metadata
    // rowid links to vec0 rowid
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.metadataTableName} (
        rowid INTEGER PRIMARY KEY,
        id TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);

    // Create index on id for fast lookups
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${this.metadataTableName}_id
      ON ${this.metadataTableName}(id);
    `);
  }

  /**
   * Add a vector to the store
   *
   * @param id - Unique identifier (e.g., memory ID)
   * @param embedding - 384-dimensional embedding vector
   * @param metadata - Additional metadata
   */
  async add(id: string, embedding: Float32Array, metadata: Partial<VectorMetadata> = {}): Promise<void> {
    if (embedding.length !== this.dimensions) {
      throw new Error(`Embedding dimensions mismatch: got ${embedding.length}, expected ${this.dimensions}`);
    }

    // Check if ID already exists
    const existing = this.db.prepare(`
      SELECT rowid FROM ${this.metadataTableName} WHERE id = ?
    `).get(id) as { rowid: number } | undefined;

    if (existing) {
      // Update existing vector
      await this.remove(id);
    }

    // Convert Float32Array to JSON array for sqlite-vec
    const embeddingJSON = JSON.stringify(Array.from(embedding));

    // Insert into vec0 table (gets auto rowid)
    const insertVector = this.db.prepare(`
      INSERT INTO ${this.tableName}(embedding)
      VALUES (?)
    `);
    const result = insertVector.run(embeddingJSON);
    const rowid = Number(result.lastInsertRowid);

    // Insert metadata with same rowid
    const insertMetadata = this.db.prepare(`
      INSERT INTO ${this.metadataTableName}(rowid, id, type, timestamp)
      VALUES (?, ?, ?, ?)
    `);
    insertMetadata.run(
      rowid,
      id,
      metadata.type || 'memory',
      Math.floor(metadata.timestamp || Date.now())
    );
  }

  /**
   * Add multiple vectors in batch
   * More efficient than calling add() multiple times
   *
   * @param vectors - Array of {id, embedding, metadata}
   */
  async addBatch(
    vectors: Array<{ id: string; embedding: Float32Array; metadata?: Partial<VectorMetadata> }>
  ): Promise<void> {
    const insertVector = this.db.prepare(`
      INSERT INTO ${this.tableName}(embedding) VALUES (?)
    `);
    const insertMetadata = this.db.prepare(`
      INSERT INTO ${this.metadataTableName}(rowid, id, type, timestamp) VALUES (?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((vectors: Array<{
      id: string;
      embedding: Float32Array;
      metadata?: Record<string, any>;
    }>) => {
      for (const { id, embedding, metadata = {} } of vectors) {
        if (embedding.length !== this.dimensions) {
          throw new Error(`Embedding dimensions mismatch: got ${embedding.length}, expected ${this.dimensions}`);
        }

        // Check if exists
        const existing = this.db.prepare(`
          SELECT rowid FROM ${this.metadataTableName} WHERE id = ?
        `).get(id) as { rowid: number } | undefined;

        if (existing) {
          // Skip duplicates in batch (or could update)
          continue;
        }

        const embeddingJSON = JSON.stringify(Array.from(embedding));
        const result = insertVector.run(embeddingJSON);
        const rowid = Number(result.lastInsertRowid);

        insertMetadata.run(
          rowid,
          id,
          metadata.type || 'memory',
          Math.floor(metadata.timestamp || Date.now())
        );
      }
    });

    insertMany(vectors);
  }

  /**
   * Remove a vector from the store
   *
   * @param id - Identifier to remove
   */
  async remove(id: string): Promise<boolean> {
    // Get rowid from metadata
    const row = this.db.prepare(`
      SELECT rowid FROM ${this.metadataTableName} WHERE id = ?
    `).get(id) as { rowid: number } | undefined;

    if (!row) {
      return false;
    }

    // Delete from both tables
    this.db.prepare(`DELETE FROM ${this.tableName} WHERE rowid = ?`).run(row.rowid);
    this.db.prepare(`DELETE FROM ${this.metadataTableName} WHERE rowid = ?`).run(row.rowid);

    return true;
  }

  /**
   * Search for k-nearest neighbors
   *
   * @param query - Query embedding vector (384 dimensions)
   * @param k - Number of results to return
   * @returns Array of search results sorted by distance (ascending)
   */
  async search(query: Float32Array, k = 20): Promise<SearchResult[]> {
    if (query.length !== this.dimensions) {
      throw new Error(`Query dimensions mismatch: got ${query.length}, expected ${this.dimensions}`);
    }

    // Convert query to JSON array
    const queryJSON = JSON.stringify(Array.from(query));

    // Search vec0 table and JOIN with metadata
    // Note: sqlite-vec requires 'k = ?' syntax, not 'LIMIT ?'
    const stmt = this.db.prepare(`
      SELECT
        v.rowid,
        v.distance,
        m.id,
        m.type,
        m.timestamp
      FROM ${this.tableName} v
      INNER JOIN ${this.metadataTableName} m ON v.rowid = m.rowid
      WHERE v.embedding MATCH ?
        AND k = ?
      ORDER BY v.distance
    `);

    const rows = stmt.all(queryJSON, k) as Array<{
      rowid: number;
      distance: number;
      id: string;
      type: string;
      timestamp: number;
    }>;

    // Convert L2 distance to similarity score (0-1, higher is better)
    // For normalized vectors: similarity ≈ 1 / (1 + distance)
    const results: SearchResult[] = rows.map(row => ({
      id: row.id,
      distance: row.distance,
      score: 1 / (1 + row.distance), // Simple conversion
      metadata: {
        id: row.id,
        type: row.type,
        timestamp: row.timestamp,
      },
    }));

    return results;
  }

  /**
   * Get vector metadata by ID
   *
   * @param id - Vector ID
   * @returns Vector metadata or undefined
   */
  get(id: string): VectorMetadata | undefined {
    const stmt = this.db.prepare(`
      SELECT id, type, timestamp
      FROM ${this.metadataTableName}
      WHERE id = ?
    `);

    const row = stmt.get(id) as { id: string; type: string; timestamp: number } | undefined;

    if (!row) {
      return undefined;
    }

    return {
      id: row.id,
      type: row.type,
      timestamp: row.timestamp,
    };
  }

  /**
   * Check if vector exists
   *
   * @param id - Vector ID
   */
  has(id: string): boolean {
    const stmt = this.db.prepare(`
      SELECT 1 FROM ${this.metadataTableName} WHERE id = ? LIMIT 1
    `);

    return stmt.get(id) !== undefined;
  }

  /**
   * Get number of vectors in store
   */
  size(): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM ${this.metadataTableName}
    `);

    const result = stmt.get() as { count: number };
    return result.count;
  }

  /**
   * Get store statistics
   */
  getStats() {
    const totalVectors = this.size();

    return {
      totalVectors,
      dimensions: this.dimensions,
      tableName: this.tableName,
      backend: 'sqlite-vec',
    };
  }

  /**
   * Clear all vectors from the store
   */
  clear(): void {
    this.db.exec(`DELETE FROM ${this.tableName}`);
    this.db.exec(`DELETE FROM ${this.metadataTableName}`);
  }

  /**
   * Close the database connection (only if we own it)
   */
  close(): void {
    if (this.ownDb) {
      this.db.close();
    }
  }
}

// Singleton instance for reuse across the application
let vectorStoreInstance: VectorStore | null = null;

/**
 * Get the singleton vector store instance
 */
export function getVectorStore(options?: VectorStoreOptions): VectorStore {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new VectorStore(options);
  }
  return vectorStoreInstance;
}
