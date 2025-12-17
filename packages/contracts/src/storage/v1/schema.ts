/**
 * Storage Contract V1 - Schemas and Port Interfaces
 *
 * Defines storage port interfaces following Ports & Adapters (Hexagonal Architecture).
 * Application layers depend on these interfaces, not concrete implementations.
 *
 * Storage Types:
 * - Key-Value Storage (memory)
 * - Event Storage (event sourcing)
 * - Trace Storage (observability)
 * - FTS Storage (full-text search)
 */

import { z } from 'zod';

// ============================================================================
// Storage Mode Configuration
// ============================================================================

/**
 * Storage mode enum
 */
export const StorageModeSchema = z.enum(['sqlite', 'memory']);
export type StorageMode = z.infer<typeof StorageModeSchema>;

/**
 * Storage configuration
 */
export const StorageConfigSchema = z.object({
  mode: StorageModeSchema.default('sqlite'),
  dbPath: z.string().optional(),
  maxConnections: z.number().int().min(1).max(100).optional(),
  enableWAL: z.boolean().optional(),
});

export type StorageConfig = z.infer<typeof StorageConfigSchema>;

// ============================================================================
// Key-Value Storage Schemas
// ============================================================================

/**
 * Key-value entry schema
 */
export const KVEntrySchema = z.object({
  key: z.string().min(1).max(512),
  value: z.unknown(),
  namespace: z.string().max(128).optional(),
  ttlMs: z.number().int().min(0).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  tags: z.array(z.string().max(64)).max(20).optional(),
});

export type KVEntry = z.infer<typeof KVEntrySchema>;

/**
 * Key-value search result
 */
export const KVSearchResultSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  score: z.number().min(0).max(1).optional(),
  namespace: z.string().optional(),
});

export type KVSearchResult = z.infer<typeof KVSearchResultSchema>;

// ============================================================================
// Trace Storage Schemas
// ============================================================================

/**
 * Trace summary schema (for listing traces)
 */
export const TraceSummarySchema = z.object({
  traceId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  status: z.enum(['pending', 'running', 'success', 'failure', 'skipped']),
  eventCount: z.number().int().min(0),
  errorCount: z.number().int().min(0),
  durationMs: z.number().int().min(0).optional(),
  workflowId: z.string().optional(),
});

export type TraceSummary = z.infer<typeof TraceSummarySchema>;

// ============================================================================
// FTS (Full-Text Search) Storage Schemas
// ============================================================================

/**
 * FTS item schema (document to index)
 */
export const FTSItemSchema = z.object({
  id: z.string().min(1).max(256),
  content: z.string(),
  metadata: z.record(z.unknown()).optional(),
  namespace: z.string().max(128).optional(),
});

export type FTSItem = z.infer<typeof FTSItemSchema>;

/**
 * FTS search result
 */
export const FTSResultSchema = z.object({
  id: z.string(),
  content: z.string(),
  score: z.number().min(0),
  highlights: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type FTSResult = z.infer<typeof FTSResultSchema>;

/**
 * FTS search options
 */
export const FTSSearchOptionsSchema = z.object({
  limit: z.number().int().min(1).max(1000).default(10),
  offset: z.number().int().min(0).default(0),
  namespace: z.string().optional(),
  minScore: z.number().min(0).max(1).optional(),
});

export type FTSSearchOptions = z.infer<typeof FTSSearchOptionsSchema>;

// ============================================================================
// Storage Port Interfaces
// ============================================================================

/**
 * Key-Value Storage Port Interface
 *
 * Generic key-value storage for memory and configuration.
 *
 * INV-KV-001: Keys must be unique within namespace
 * INV-KV-002: TTL expiration is best-effort (may lag)
 * INV-KV-003: Namespace isolation - keys in different namespaces are independent
 */
export interface KVStoragePort {
  /**
   * Store a value
   * INV-KV-001: Overwrites existing key in same namespace
   */
  store(key: string, value: unknown, options?: {
    namespace?: string;
    ttlMs?: number;
    tags?: string[];
  }): Promise<void>;

  /**
   * Retrieve a value
   * Returns undefined if key doesn't exist or is expired
   */
  retrieve(key: string, namespace?: string): Promise<unknown | undefined>;

  /**
   * Delete a key
   * @returns true if key existed and was deleted
   */
  delete(key: string, namespace?: string): Promise<boolean>;

  /**
   * List keys
   */
  list(options?: {
    namespace?: string;
    prefix?: string;
    limit?: number;
  }): Promise<string[]>;

  /**
   * Search by value content or tags
   */
  search(query: string, options?: {
    namespace?: string;
    limit?: number;
  }): Promise<KVSearchResult[]>;
}

/**
 * Event Storage Port Interface
 *
 * Append-only event store for event sourcing.
 *
 * INV-EVT-001: Events are immutable after storage
 * INV-EVT-002: Events within aggregate are strictly ordered
 * INV-EVT-003: Event IDs are globally unique
 */
export interface EventStoragePort {
  /**
   * Append an event
   * INV-EVT-001: Event cannot be modified after append
   */
  append(event: {
    eventId: string;
    aggregateId: string;
    type: string;
    timestamp: string;
    payload: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<void>;

  /**
   * Get events for an aggregate
   * INV-EVT-002: Returns in order (by version/sequence)
   */
  getEvents(aggregateId: string, options?: {
    fromVersion?: number;
    toVersion?: number;
    limit?: number;
  }): Promise<Array<{
    eventId: string;
    aggregateId: string;
    type: string;
    timestamp: string;
    version: number;
    payload: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }>>;

  /**
   * Get events by type
   */
  getEventsByType(type: string, options?: {
    fromTime?: string;
    toTime?: string;
    limit?: number;
  }): Promise<Array<{
    eventId: string;
    aggregateId: string;
    type: string;
    timestamp: string;
    payload: Record<string, unknown>;
  }>>;
}

/**
 * Trace Storage Port Interface
 *
 * Storage for execution traces and observability.
 *
 * INV-TR-STORE-001: Traces are append-only during execution
 * INV-TR-STORE-002: Events within trace maintain sequence order
 * INV-TR-STORE-003: Trace deletion removes all associated events
 */
export interface TraceStoragePort {
  /**
   * Write a trace event
   * INV-TR-STORE-001: Appends to existing trace
   */
  write(event: {
    traceId: string;
    eventId: string;
    type: string;
    timestamp: string;
    sequence?: number;
    parentEventId?: string;
    payload?: Record<string, unknown>;
    status?: string;
    durationMs?: number;
  }): Promise<void>;

  /**
   * Flush pending writes
   */
  flush(): Promise<void>;

  /**
   * Get all events for a trace
   * INV-TR-STORE-002: Returns in sequence order
   */
  getTrace(traceId: string): Promise<Array<{
    traceId: string;
    eventId: string;
    type: string;
    timestamp: string;
    sequence?: number;
    parentEventId?: string;
    payload?: Record<string, unknown>;
    status?: string;
    durationMs?: number;
  }>>;

  /**
   * Get a specific event
   */
  getEvent(traceId: string, eventId: string): Promise<{
    traceId: string;
    eventId: string;
    type: string;
    timestamp: string;
    payload?: Record<string, unknown>;
  } | undefined>;

  /**
   * List trace summaries
   */
  listTraces(limit?: number): Promise<TraceSummary[]>;

  /**
   * Delete a trace
   * INV-TR-STORE-003: Removes all events
   * @returns true if trace existed
   */
  deleteTrace(traceId: string): Promise<boolean>;
}

/**
 * FTS (Full-Text Search) Storage Port Interface
 *
 * Full-text search for content discovery.
 *
 * INV-FTS-001: Index updates are eventually consistent
 * INV-FTS-002: Search results are ranked by relevance score
 * INV-FTS-003: Namespace isolation for multi-tenant search
 */
export interface FTSStoragePort {
  /**
   * Index a document
   */
  index(item: FTSItem): Promise<void>;

  /**
   * Search indexed documents
   * INV-FTS-002: Results ordered by score (descending)
   */
  search(query: string, options?: FTSSearchOptions): Promise<FTSResult[]>;

  /**
   * Delete a document from index
   * @returns true if document existed
   */
  delete(id: string, namespace?: string): Promise<boolean>;

  /**
   * Clear all documents in a namespace
   */
  clear(namespace?: string): Promise<number>;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate storage configuration
 */
export function validateStorageConfig(data: unknown): StorageConfig {
  return StorageConfigSchema.parse(data);
}

/**
 * Safe validate storage configuration
 */
export function safeValidateStorageConfig(
  data: unknown
): z.SafeParseReturnType<unknown, StorageConfig> {
  return StorageConfigSchema.safeParse(data);
}

/**
 * Validate KV entry
 */
export function validateKVEntry(data: unknown): KVEntry {
  return KVEntrySchema.parse(data);
}

/**
 * Validate FTS item
 */
export function validateFTSItem(data: unknown): FTSItem {
  return FTSItemSchema.parse(data);
}

/**
 * Validate trace summary
 */
export function validateTraceSummary(data: unknown): TraceSummary {
  return TraceSummarySchema.parse(data);
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create default storage configuration
 */
export function createDefaultStorageConfig(): StorageConfig {
  return {
    mode: 'sqlite',
    dbPath: undefined,
    maxConnections: undefined,
    enableWAL: undefined,
  };
}

/**
 * Create a KV entry
 */
export function createKVEntry(
  key: string,
  value: unknown,
  options?: {
    namespace?: string;
    ttlMs?: number;
    tags?: string[];
  }
): KVEntry {
  const now = new Date().toISOString();
  return {
    key,
    value,
    namespace: options?.namespace,
    ttlMs: options?.ttlMs,
    createdAt: now,
    updatedAt: now,
    expiresAt: options?.ttlMs
      ? new Date(Date.now() + options.ttlMs).toISOString()
      : undefined,
    tags: options?.tags,
  };
}
