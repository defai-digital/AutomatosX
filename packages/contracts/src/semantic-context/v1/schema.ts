/**
 * Semantic Context Contracts v1
 *
 * Schemas for vector-indexed semantic search over memory with persistence.
 * Enables semantic similarity search for agent context retrieval.
 */

import { z } from 'zod';
import {
  LIMIT_DEFAULT,
  LIMIT_MAX,
  STRING_LENGTH_LONG,
  CONFIDENCE_MIN,
  CONFIDENCE_MAX,
  CONFIDENCE_DEFAULT_MIN,
  EMBEDDING_DIMENSION_DEFAULT,
  EMBEDDING_DIMENSION_MIN,
  EMBEDDING_DIMENSION_MAX,
} from '../../constants.js';

// ============================================================================
// Semantic Item Schemas
// ============================================================================

/**
 * A semantic item stored with vector embedding
 *
 * Invariants:
 * - INV-SEM-001: Embeddings computed on store, cached until content changes
 */
export const SemanticItemSchema = z.object({
  /**
   * Unique key for this item
   */
  key: z.string().min(1).max(500),

  /**
   * Namespace for isolation
   * INV-SEM-004: Namespace isolation
   */
  namespace: z.string().min(1).max(100).default('default'),

  /**
   * The text content to be semantically indexed
   */
  content: z.string().min(1).max(100000),

  /**
   * Vector embedding (computed from content)
   * INV-SEM-001: Cached until content changes
   */
  embedding: z.array(z.number()).optional(),

  /**
   * Embedding dimension (for validation)
   */
  embeddingDimension: z.number().int().min(1).max(4096).optional(),

  /**
   * Embedding model used
   */
  embeddingModel: z.string().max(100).optional(),

  /**
   * Optional metadata
   */
  metadata: z.record(z.string(), z.unknown()).optional(),

  /**
   * Tags for filtering
   */
  tags: z.array(z.string().max(50)).max(20).optional(),

  /**
   * Content hash for change detection
   */
  contentHash: z.string().max(64).optional(),

  /**
   * Creation timestamp
   */
  createdAt: z.string().datetime(),

  /**
   * Last update timestamp
   */
  updatedAt: z.string().datetime().optional(),
});

export type SemanticItem = z.infer<typeof SemanticItemSchema>;

// ============================================================================
// Search Schemas
// ============================================================================

/**
 * Semantic search request
 */
export const SemanticSearchRequestSchema = z.object({
  /**
   * Query text to find similar content
   */
  query: z.string().min(1).max(10000),

  /**
   * Pre-computed query embedding (optional)
   * If provided, store can use this directly for similarity search
   * If not provided, store may need to compute it or return empty results
   */
  queryEmbedding: z.array(z.number()).optional(),

  /**
   * Namespace to search within
   * INV-SEM-004: Namespace isolation
   */
  namespace: z.string().max(100).optional(),

  /**
   * Number of top results to return
   */
  topK: z.number().int().min(1).max(100).default(10),

  /**
   * Minimum similarity score threshold
   * INV-SEM-003: Normalized to 0-1 range
   */
  minSimilarity: z.number().min(CONFIDENCE_MIN).max(CONFIDENCE_MAX).default(CONFIDENCE_DEFAULT_MIN),

  /**
   * Filter by tags (results must have ALL specified tags)
   */
  filterTags: z.array(z.string().max(50)).max(10).optional(),

  /**
   * Include embedding vectors in results
   */
  includeEmbeddings: z.boolean().default(false),

  /**
   * Include metadata in results
   */
  includeMetadata: z.boolean().default(true),
});

export type SemanticSearchRequest = z.infer<typeof SemanticSearchRequestSchema>;

/**
 * A single search result
 */
export const SemanticSearchResultSchema = z.object({
  /**
   * The matched item
   */
  item: SemanticItemSchema.omit({ embedding: true }).extend({
    embedding: z.array(z.number()).optional(),
  }),

  /**
   * Similarity score (0-1)
   * INV-SEM-002: Sorted by similarity descending
   * INV-SEM-003: Normalized to 0-1
   */
  similarity: z.number().min(CONFIDENCE_MIN).max(CONFIDENCE_MAX),

  /**
   * Rank in results (1-based)
   */
  rank: z.number().int().min(1),

  /**
   * Snippet of matching content
   */
  snippet: z.string().max(STRING_LENGTH_LONG).optional(),
});

export type SemanticSearchResult = z.infer<typeof SemanticSearchResultSchema>;

/**
 * Semantic search response
 */
export const SemanticSearchResponseSchema = z.object({
  /**
   * Search results
   * INV-SEM-002: Sorted by similarity descending
   */
  results: z.array(SemanticSearchResultSchema),

  /**
   * Total matching items (before topK limit)
   */
  totalMatches: z.number().int().min(0),

  /**
   * Query that was executed
   */
  query: z.string(),

  /**
   * Namespace searched
   */
  namespace: z.string().optional(),

  /**
   * Search duration in milliseconds
   */
  durationMs: z.number().int().min(0),

  /**
   * Query embedding used (if requested)
   */
  queryEmbedding: z.array(z.number()).optional(),
});

export type SemanticSearchResponse = z.infer<typeof SemanticSearchResponseSchema>;

// ============================================================================
// Store Operation Schemas
// ============================================================================

/**
 * Request to store a semantic item
 */
export const SemanticStoreRequestSchema = z.object({
  /**
   * Key for the item
   */
  key: z.string().min(1).max(500),

  /**
   * Namespace for isolation
   */
  namespace: z.string().max(100).default('default'),

  /**
   * Content to store and index
   */
  content: z.string().min(1).max(100000),

  /**
   * Optional metadata
   */
  metadata: z.record(z.string(), z.unknown()).optional(),

  /**
   * Tags for filtering
   */
  tags: z.array(z.string().max(50)).max(20).optional(),

  /**
   * Pre-computed embedding (if available)
   */
  embedding: z.array(z.number()).optional(),

  /**
   * Whether to force re-compute embedding even if content unchanged
   */
  forceRecompute: z.boolean().default(false),
});

export type SemanticStoreRequest = z.infer<typeof SemanticStoreRequestSchema>;

/**
 * Response from store operation
 */
export const SemanticStoreResponseSchema = z.object({
  /**
   * Whether operation succeeded
   */
  success: z.boolean(),

  /**
   * Stored item
   */
  item: SemanticItemSchema.omit({ embedding: true }).optional(),

  /**
   * Whether item was created (vs updated)
   */
  created: z.boolean(),

  /**
   * Whether embedding was (re)computed
   */
  embeddingComputed: z.boolean(),

  /**
   * Error message if failed
   */
  error: z.string().optional(),
});

export type SemanticStoreResponse = z.infer<typeof SemanticStoreResponseSchema>;

// ============================================================================
// Get Schema
// ============================================================================

/**
 * Request to get a specific semantic item
 */
export const SemanticGetRequestSchema = z.object({
  /**
   * Key to retrieve
   */
  key: z.string().min(1).max(500),

  /**
   * Namespace
   */
  namespace: z.string().max(100).default('default'),

  /**
   * Include embedding vector in result
   */
  includeEmbedding: z.boolean().default(false),
});

export type SemanticGetRequest = z.infer<typeof SemanticGetRequestSchema>;

/**
 * Response from get operation
 */
export const SemanticGetResponseSchema = z.object({
  /**
   * Whether item was found
   */
  found: z.boolean(),

  /**
   * The retrieved item (if found)
   */
  item: SemanticItemSchema.optional(),
});

export type SemanticGetResponse = z.infer<typeof SemanticGetResponseSchema>;

// ============================================================================
// Stats Schema
// ============================================================================

/**
 * Request for semantic storage statistics
 */
export const SemanticStatsRequestSchema = z.object({
  /**
   * Get stats for specific namespace (optional)
   */
  namespace: z.string().max(100).optional(),
});

export type SemanticStatsRequest = z.infer<typeof SemanticStatsRequestSchema>;

/**
 * Response from stats operation
 */
export const SemanticStatsResponseSchema = z.object({
  /**
   * Total items
   */
  totalItems: z.number().int().min(0),

  /**
   * Total namespaces
   */
  totalNamespaces: z.number().int().min(0),

  /**
   * Storage size in bytes
   */
  storageSizeBytes: z.number().int().min(0),

  /**
   * Namespace being queried (if specified)
   */
  namespace: z.string().optional(),
});

export type SemanticStatsResponse = z.infer<typeof SemanticStatsResponseSchema>;

// ============================================================================
// List & Delete Schemas
// ============================================================================

/**
 * Request to list semantic items
 */
export const SemanticListRequestSchema = z.object({
  /**
   * Namespace to list
   */
  namespace: z.string().max(100).optional(),

  /**
   * Maximum items to return
   */
  limit: z.number().int().min(1).max(LIMIT_MAX).default(LIMIT_DEFAULT),

  /**
   * Offset for pagination
   */
  offset: z.number().int().min(0).default(0),

  /**
   * Filter by tags
   */
  filterTags: z.array(z.string().max(50)).max(10).optional(),

  /**
   * Key prefix filter
   */
  keyPrefix: z.string().max(100).optional(),

  /**
   * Order by field
   */
  orderBy: z.enum(['createdAt', 'updatedAt', 'key']).default('createdAt'),

  /**
   * Order direction
   */
  orderDir: z.enum(['asc', 'desc']).default('desc'),
});

export type SemanticListRequest = z.infer<typeof SemanticListRequestSchema>;

/**
 * Response from list operation
 */
export const SemanticListResponseSchema = z.object({
  /**
   * Items (without embeddings)
   */
  items: z.array(SemanticItemSchema.omit({ embedding: true })),

  /**
   * Total count in namespace
   */
  total: z.number().int().min(0),

  /**
   * Whether more items exist
   */
  hasMore: z.boolean(),

  /**
   * Namespace listed
   */
  namespace: z.string().optional(),
});

export type SemanticListResponse = z.infer<typeof SemanticListResponseSchema>;

/**
 * Request to delete semantic item
 */
export const SemanticDeleteRequestSchema = z.object({
  /**
   * Key to delete
   */
  key: z.string().min(1).max(500),

  /**
   * Namespace
   */
  namespace: z.string().max(100).default('default'),
});

export type SemanticDeleteRequest = z.infer<typeof SemanticDeleteRequestSchema>;

/**
 * Response from delete operation
 */
export const SemanticDeleteResponseSchema = z.object({
  /**
   * Whether item was deleted
   */
  deleted: z.boolean(),

  /**
   * Key that was deleted
   */
  key: z.string(),

  /**
   * Namespace
   */
  namespace: z.string(),
});

export type SemanticDeleteResponse = z.infer<typeof SemanticDeleteResponseSchema>;

/**
 * Request to clear all items in a namespace
 */
export const SemanticClearRequestSchema = z.object({
  /**
   * Namespace to clear
   */
  namespace: z.string().max(100),

  /**
   * Confirmation flag (must be true to proceed)
   */
  confirm: z.boolean(),
});

export type SemanticClearRequest = z.infer<typeof SemanticClearRequestSchema>;

/**
 * Response from clear operation
 */
export const SemanticClearResponseSchema = z.object({
  /**
   * Whether clear was successful
   */
  cleared: z.boolean(),

  /**
   * Number of items removed
   */
  itemsRemoved: z.number().int().min(0),

  /**
   * Namespace that was cleared
   */
  namespace: z.string(),
});

export type SemanticClearResponse = z.infer<typeof SemanticClearResponseSchema>;

// ============================================================================
// Embedding Configuration
// ============================================================================

/**
 * Embedding provider configuration
 */
export const EmbeddingConfigSchema = z.object({
  /**
   * Embedding provider type
   */
  provider: z.enum(['local', 'openai', 'cohere', 'voyage']).default('local'),

  /**
   * Model name for embedding
   */
  model: z.string().max(100).default('tfidf'),

  /**
   * Embedding dimension
   */
  dimension: z.number().int().min(EMBEDDING_DIMENSION_MIN).max(EMBEDDING_DIMENSION_MAX).default(EMBEDDING_DIMENSION_DEFAULT),

  /**
   * Batch size for bulk operations
   */
  batchSize: z.number().int().min(1).max(100).default(32),

  /**
   * Cache embeddings locally
   */
  cacheEnabled: z.boolean().default(true),
});

export type EmbeddingConfig = z.infer<typeof EmbeddingConfigSchema>;

// ============================================================================
// Error Codes
// ============================================================================

export const SemanticContextErrorCodes = {
  /** Item not found */
  NOT_FOUND: 'SEMANTIC_NOT_FOUND',
  /** Embedding computation failed */
  EMBEDDING_FAILED: 'SEMANTIC_EMBEDDING_FAILED',
  /** Search failed */
  SEARCH_FAILED: 'SEMANTIC_SEARCH_FAILED',
  /** Invalid embedding dimension */
  DIMENSION_MISMATCH: 'SEMANTIC_DIMENSION_MISMATCH',
  /** Storage error */
  STORAGE_ERROR: 'SEMANTIC_STORAGE_ERROR',
  /** Invalid namespace */
  INVALID_NAMESPACE: 'SEMANTIC_INVALID_NAMESPACE',
  /** Content too large */
  CONTENT_TOO_LARGE: 'SEMANTIC_CONTENT_TOO_LARGE',
} as const;

export type SemanticContextErrorCode =
  (typeof SemanticContextErrorCodes)[keyof typeof SemanticContextErrorCodes];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates semantic item
 */
export function validateSemanticItem(data: unknown): SemanticItem {
  return SemanticItemSchema.parse(data);
}

/**
 * Validates semantic search request
 */
export function validateSemanticSearchRequest(data: unknown): SemanticSearchRequest {
  return SemanticSearchRequestSchema.parse(data);
}

/**
 * Validates semantic store request
 */
export function validateSemanticStoreRequest(data: unknown): SemanticStoreRequest {
  return SemanticStoreRequestSchema.parse(data);
}

/**
 * Safely validates semantic search request
 */
export function safeValidateSemanticSearchRequest(
  data: unknown
): { success: true; data: SemanticSearchRequest } | { success: false; error: z.ZodError } {
  const result = SemanticSearchRequestSchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a semantic item with defaults
 */
export function createSemanticItem(
  key: string,
  content: string,
  options?: Partial<Omit<SemanticItem, 'key' | 'content' | 'createdAt'>>
): SemanticItem {
  return SemanticItemSchema.parse({
    key,
    content,
    createdAt: new Date().toISOString(),
    ...options,
  });
}

/**
 * Creates default embedding configuration
 */
export function createDefaultEmbeddingConfig(): EmbeddingConfig {
  return EmbeddingConfigSchema.parse({});
}

/**
 * Computes content hash for change detection
 */
export async function computeContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
