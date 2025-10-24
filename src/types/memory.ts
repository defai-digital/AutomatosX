/**
 * Memory System Types
 *
 * Defines types for the AutomatosX memory system using SQLite + HNSW
 */

/**
 * Memory entry stored in the system
 */
export interface MemoryEntry {
  /** Unique identifier */
  id: number;

  /** Content/text of the memory */
  content: string;

  /** Vector embedding (1536 dimensions for OpenAI/Claude) */
  embedding: number[];

  /** Additional metadata */
  metadata: MemoryMetadata;

  /** Creation timestamp */
  createdAt: Date;

  /** Last access timestamp */
  lastAccessedAt?: Date;

  /** Access count */
  accessCount: number;

  /** Relevance score (optional, set during search) */
  score?: number;
}

/**
 * Metadata associated with memory entries
 */
export interface MemoryMetadata {
  /** Type of memory entry */
  type: 'conversation' | 'code' | 'document' | 'task' | 'other';

  /** Source of the memory */
  source: string;

  /** Associated agent ID */
  agentId?: string;

  /** Associated session ID */
  sessionId?: string;

  /** Tags for categorization */
  tags?: string[];

  /** Importance score (0-1) */
  importance?: number;

  /** Custom metadata */
  [key: string]: unknown;
}

/**
 * Search query for finding memories
 */
export interface MemorySearchQuery {
  /** Query vector for similarity search */
  vector?: number[];

  /** Text query (will be converted to vector) */
  text?: string;

  /** Metadata filters */
  filters?: MemoryFilter;

  /** Number of results to return */
  limit?: number;

  /** Minimum similarity threshold (0-1) */
  threshold?: number;

  /** Include embeddings in results */
  includeEmbeddings?: boolean;
}

/**
 * Metadata filters for memory search
 */
export interface MemoryFilter {
  /** Filter by type */
  type?: MemoryMetadata['type'] | MemoryMetadata['type'][];

  /** Filter by source */
  source?: string | string[];

  /** Filter by agent ID */
  agentId?: string;

  /** Filter by session ID */
  sessionId?: string;

  /** Filter by tags (AND logic) */
  tags?: string[];

  /** Filter by date range */
  dateRange?: {
    from?: Date;
    to?: Date;
  };

  /** Filter by importance */
  minImportance?: number;
}

/**
 * Search result with similarity score
 */
export interface MemorySearchResult {
  /** Memory entry */
  entry: MemoryEntry;

  /** Similarity score (0-1, higher is more similar) */
  similarity: number;

  /** Distance metric (for HNSW, lower is more similar) */
  distance: number;
}

/**
 * Memory manager configuration
 */
export interface MemoryManagerConfig {
  /** Database file path */
  dbPath: string;

  /** HNSW index parameters */
  hnsw?: {
    /** Number of connections per layer (default: 16) */
    M?: number;

    /** Size of dynamic candidate list (default: 200) */
    efConstruction?: number;

    /** Size of dynamic candidate list for search (default: 50) */
    efSearch?: number;
  };

  /** Maximum number of entries (default: 10000) */
  maxEntries?: number;

  /**
   * Smart cleanup configuration (v5.0.10 Phase 2)
   */
  cleanup?: {
    /** Enable automatic cleanup (default: true) */
    enabled?: boolean;

    /** Cleanup strategy (default: 'oldest') */
    strategy?: 'oldest' | 'least_accessed' | 'hybrid';

    /** Trigger cleanup when usage reaches this threshold (default: 0.9 = 90%) */
    triggerThreshold?: number;

    /** Clean until usage reaches this target (default: 0.7 = 70%) */
    targetThreshold?: number;

    /** Minimum number of entries to remove per cleanup (default: 10) */
    minCleanupCount?: number;

    /** Maximum number of entries to remove per cleanup (default: 1000) */
    maxCleanupCount?: number;

    /** Days to keep entries for time-based cleanup (default: 30) */
    retentionDays?: number;
  };

  /**
   * @deprecated Use cleanup.enabled instead (backward compatibility)
   * Auto-cleanup old entries
   */
  autoCleanup?: boolean;

  /**
   * @deprecated Use cleanup.retentionDays instead (backward compatibility)
   * Days to keep entries (default: 30)
   */
  cleanupDays?: number;

  /** Enable access tracking */
  trackAccess?: boolean;

  /** SQLite busy timeout in milliseconds (default: 5000) - v5.6.18 */
  busyTimeout?: number;

  /** Embedding provider for text-to-vector conversion (required for text queries) */
  embeddingProvider?: unknown; // IEmbeddingProvider - use unknown to avoid circular dependency
}

/**
 * Memory statistics
 */
export interface MemoryStats {
  /** Total number of entries */
  totalEntries: number;

  /** Database size in bytes */
  dbSize: number;

  /** Index size in bytes (estimated) */
  indexSize: number;

  /** Memory usage in bytes */
  memoryUsage: number;

  /** Average search time (ms) */
  avgSearchTime?: number;

  /** Last cleanup timestamp */
  lastCleanup?: Date;
}

/**
 * Export options for JSON export
 */
export interface ExportOptions {
  /** Include embeddings in export (default: false) */
  includeEmbeddings?: boolean;

  /** Filters for selective export */
  filters?: MemoryFilter;

  /** Batch size for streaming large datasets (default: 1000) */
  batchSize?: number;

  /** Pretty print JSON (default: false) */
  pretty?: boolean;
}

/**
 * Export result
 */
export interface ExportResult {
  /** Number of entries exported */
  entriesExported: number;

  /** Total size in bytes */
  sizeBytes: number;

  /** Export file path */
  filePath: string;

  /** Export timestamp */
  exportedAt: Date;
}

/**
 * Import options for JSON import
 */
export interface ImportOptions {
  /** Skip duplicate entries (by content hash) */
  skipDuplicates?: boolean;

  /** Batch size for processing (default: 100) */
  batchSize?: number;

  /** Validate entries before import */
  validate?: boolean;

  /** Clear existing data before import */
  clearExisting?: boolean;
}

/**
 * Import result
 */
export interface ImportResult {
  /** Number of entries imported */
  entriesImported: number;

  /** Number of entries skipped (duplicates) */
  entriesSkipped: number;

  /** Number of entries failed */
  entriesFailed: number;

  /** Import errors */
  errors: Array<{ entry: unknown; error: string }>;

  /** Import timestamp */
  importedAt: Date;
}

/**
 * JSON export format
 */
export interface MemoryExport {
  /** Format version */
  version: string;

  /** Export metadata */
  metadata: {
    exportedAt: string;
    totalEntries: number;
    includesEmbeddings: boolean;
  };

  /** Memory entries */
  entries: Array<{
    id: number;
    content: string;
    embedding?: number[];
    metadata: MemoryMetadata;
    createdAt: string;
    lastAccessedAt?: string;
    accessCount: number;
  }>;
}

/**
 * Memory manager interface
 */
export interface IMemoryManager {
  /**
   * Add a new memory entry
   *
   * v4.11.0: Embedding is now optional (null allowed for FTS5-only mode)
   */
  add(content: string, embedding: number[] | null, metadata: MemoryMetadata): Promise<MemoryEntry>;

  /**
   * Search for similar memories
   */
  search(query: MemorySearchQuery): Promise<MemorySearchResult[]>;

  /**
   * Get memory by ID
   */
  get(id: number): Promise<MemoryEntry | null>;

  /**
   * Update memory metadata
   */
  update(id: number, metadata: Partial<MemoryMetadata>): Promise<void>;

  /**
   * Delete memory by ID
   */
  delete(id: number): Promise<void>;

  /**
   * Clear all memories
   */
  clear(): Promise<void>;

  /**
   * Get memory statistics
   */
  getStats(): Promise<MemoryStats>;

  /**
   * Cleanup old entries
   */
  cleanup(olderThanDays?: number): Promise<number>;

  /**
   * Save index to disk
   */
  saveIndex(): Promise<void>;

  /**
   * Load index from disk
   */
  loadIndex(): Promise<void>;

  /**
   * Close database and save index
   */
  close(): Promise<void>;

  /**
   * Backup database to destination path
   */
  backup(destPath: string, onProgress?: (progress: number) => void): Promise<void>;

  /**
   * Restore database from backup
   */
  restore(srcPath: string): Promise<void>;

  /**
   * Export memories to JSON
   */
  exportToJSON(filePath: string, options?: ExportOptions): Promise<ExportResult>;

  /**
   * Import memories from JSON
   */
  importFromJSON(filePath: string, options?: ImportOptions): Promise<ImportResult>;
}

/**
 * Memory error types
 */
export class MemoryError extends Error {
  constructor(
    message: string,
    public readonly code: MemoryErrorCode,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MemoryError';
  }
}

export type MemoryErrorCode =
  | 'ENTRY_NOT_FOUND'
  | 'INVALID_VECTOR'
  | 'DATABASE_ERROR'
  | 'INDEX_ERROR'
  | 'QUERY_ERROR'
  | 'CAPACITY_EXCEEDED'
  | 'PROVIDER_MISSING'
  | 'EMBEDDING_GENERATION_FAILED'
  | 'MEMORY_LIMIT'   // v5.0.8: Memory limit reached
  | 'CONFIG_ERROR';  // v5.0.10 Phase 2: Invalid configuration
