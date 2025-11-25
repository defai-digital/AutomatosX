/**
 * Memory system schemas for AutomatosX
 * @module @ax/schemas/memory
 */

import { z } from 'zod';
import { MemoryId, MemoryType, NormalizedScore, DurationMs } from './common.js';

// =============================================================================
// Memory Entry Schema
// =============================================================================

/**
 * Metadata associated with a memory entry
 */
export const MemoryMetadataSchema = z.object({
  /** Type of memory content */
  type: MemoryType,
  /** Source of the memory (agent, user, system) */
  source: z.string().min(1).max(100),
  /** Agent ID that created this memory */
  agentId: z.string().optional(),
  /** Session ID if part of a session */
  sessionId: z.string().uuid().optional(),
  /** Tags for categorization */
  tags: z.array(z.string().max(50)).max(20).default([]),
  /** Importance score (0-1) */
  importance: NormalizedScore.optional(),
  /** File path if memory relates to a file */
  filePath: z.string().optional(),
  /** Language if code-related */
  language: z.string().optional(),
  /** Custom metadata */
  custom: z.record(z.string(), z.unknown()).optional(),
});
export type MemoryMetadata = z.infer<typeof MemoryMetadataSchema>;

/**
 * Complete memory entry
 */
export const MemoryEntrySchema = z.object({
  /** Unique identifier */
  id: MemoryId,
  /** Memory content */
  content: z.string().min(1).max(100000),
  /** Associated metadata */
  metadata: MemoryMetadataSchema,
  /** Creation timestamp */
  createdAt: z.date(),
  /** Last accessed timestamp */
  lastAccessedAt: z.date().optional(),
  /** Number of times accessed */
  accessCount: z.number().int().nonnegative().default(0),
  /** Relevance score from last search */
  score: z.number().optional(),
});
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;

// =============================================================================
// Memory Search Schema
// =============================================================================

/**
 * Filter options for memory search
 */
export const MemoryFilterSchema = z.object({
  /** Filter by memory type */
  type: MemoryType.optional(),
  /** Filter by agent ID */
  agentId: z.string().optional(),
  /** Filter by session ID */
  sessionId: z.string().uuid().optional(),
  /** Filter by tags (any match) */
  tags: z.array(z.string()).optional(),
  /** Filter by tags (all must match) */
  tagsAll: z.array(z.string()).optional(),
  /** Filter by minimum importance */
  minImportance: NormalizedScore.optional(),
  /** Filter by source */
  source: z.string().optional(),
  /** Filter by date range - after */
  createdAfter: z.date().optional(),
  /** Filter by date range - before */
  createdBefore: z.date().optional(),
  /** Filter by minimum access count */
  minAccessCount: z.number().int().nonnegative().optional(),
});
export type MemoryFilter = z.infer<typeof MemoryFilterSchema>;

/**
 * Search options for memory queries
 */
export const MemorySearchOptionsSchema = z.object({
  /** Search query string */
  query: z.string().min(1).max(1000),
  /** Maximum results to return */
  limit: z.number().int().min(1).max(100).default(10),
  /** Offset for pagination */
  offset: z.number().int().nonnegative().default(0),
  /** Filter options */
  filter: MemoryFilterSchema.optional(),
  /** Sort by field */
  sortBy: z.enum(['relevance', 'created', 'accessed', 'importance']).default('relevance'),
  /** Sort direction */
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
  /** Include content in results */
  includeContent: z.boolean().default(true),
  /** Highlight matches in content */
  highlight: z.boolean().default(false),
});
export type MemorySearchOptions = z.infer<typeof MemorySearchOptionsSchema>;

/**
 * Search result from memory query
 */
export const MemorySearchResultSchema = z.object({
  /** Matching entries */
  entries: z.array(MemoryEntrySchema),
  /** Total count (before pagination) */
  total: z.number().int().nonnegative(),
  /** Search duration in milliseconds */
  duration: DurationMs,
  /** Query that was executed */
  query: z.string(),
  /** Whether more results exist */
  hasMore: z.boolean(),
});
export type MemorySearchResult = z.infer<typeof MemorySearchResultSchema>;

// =============================================================================
// Memory Operations Schema
// =============================================================================

/**
 * Input for adding a new memory entry
 */
export const MemoryAddInputSchema = z.object({
  /** Content to store */
  content: z.string().min(1).max(100000),
  /** Metadata for the entry */
  metadata: MemoryMetadataSchema,
});
export type MemoryAddInput = z.infer<typeof MemoryAddInputSchema>;

/**
 * Input for updating a memory entry
 */
export const MemoryUpdateInputSchema = z.object({
  /** Entry ID to update */
  id: MemoryId,
  /** New content (optional) */
  content: z.string().min(1).max(100000).optional(),
  /** Updated metadata (merged with existing) */
  metadata: MemoryMetadataSchema.partial().optional(),
});
export type MemoryUpdateInput = z.infer<typeof MemoryUpdateInputSchema>;

/**
 * Bulk operation input
 */
export const MemoryBulkAddInputSchema = z.object({
  /** Entries to add */
  entries: z.array(MemoryAddInputSchema).min(1).max(100),
});
export type MemoryBulkAddInput = z.infer<typeof MemoryBulkAddInputSchema>;

// =============================================================================
// Memory Cleanup Schema
// =============================================================================

/**
 * Cleanup strategy options
 */
export const CleanupStrategy = z.enum(['oldest', 'least_accessed', 'hybrid', 'low_importance']);
export type CleanupStrategy = z.infer<typeof CleanupStrategy>;

/**
 * Cleanup configuration
 */
export const MemoryCleanupConfigSchema = z.object({
  /** Whether automatic cleanup is enabled */
  enabled: z.boolean().default(true),
  /** Strategy for selecting entries to delete */
  strategy: CleanupStrategy.default('hybrid'),
  /** Trigger cleanup when reaching this percentage of max entries */
  triggerThreshold: z.number().min(0.5).max(1).default(0.9),
  /** Target percentage after cleanup */
  targetThreshold: z.number().min(0.3).max(0.9).default(0.7),
  /** Minimum entries to delete per cleanup */
  minCleanupCount: z.number().int().min(1).default(10),
  /** Maximum entries to delete per cleanup */
  maxCleanupCount: z.number().int().min(10).default(1000),
  /** Retention period in days */
  retentionDays: z.number().int().min(1).default(30),
  /** Entries to always preserve (by tag) */
  preserveTags: z.array(z.string()).default(['important', 'pinned']),
}).refine(
  (data) => data.maxCleanupCount >= data.minCleanupCount,
  {
    message: 'maxCleanupCount must be greater than or equal to minCleanupCount',
    path: ['maxCleanupCount'],
  }
).refine(
  (data) => data.targetThreshold < data.triggerThreshold,
  {
    message: 'targetThreshold must be less than triggerThreshold',
    path: ['targetThreshold'],
  }
);
export type MemoryCleanupConfig = z.infer<typeof MemoryCleanupConfigSchema>;

/**
 * Cleanup result
 */
export const MemoryCleanupResultSchema = z.object({
  /** Number of entries deleted */
  deletedCount: z.number().int().nonnegative(),
  /** Strategy used */
  strategy: CleanupStrategy,
  /** Duration in milliseconds */
  duration: DurationMs,
  /** Entries before cleanup */
  entriesBefore: z.number().int().nonnegative(),
  /** Entries after cleanup */
  entriesAfter: z.number().int().nonnegative(),
});
export type MemoryCleanupResult = z.infer<typeof MemoryCleanupResultSchema>;

// =============================================================================
// Memory Statistics Schema
// =============================================================================

/**
 * Memory system statistics
 */
export const MemoryStatsSchema = z.object({
  /** Total number of entries */
  totalEntries: z.number().int().nonnegative(),
  /** Entries by type */
  entriesByType: z.record(MemoryType, z.number().int().nonnegative()),
  /** Database size in bytes */
  databaseSizeBytes: z.number().int().nonnegative(),
  /** Oldest entry date */
  oldestEntry: z.date().optional(),
  /** Newest entry date */
  newestEntry: z.date().optional(),
  /** Average content length */
  avgContentLength: z.number().nonnegative(),
  /** Total access count */
  totalAccessCount: z.number().int().nonnegative(),
  /** Top tags */
  topTags: z.array(z.object({
    tag: z.string(),
    count: z.number().int().nonnegative(),
  })).max(20),
});
export type MemoryStats = z.infer<typeof MemoryStatsSchema>;

// =============================================================================
// Memory Export/Import Schema
// =============================================================================

/**
 * Export format options
 */
export const ExportFormat = z.enum(['json', 'jsonl', 'csv']);
export type ExportFormat = z.infer<typeof ExportFormat>;

/**
 * Export options
 */
export const MemoryExportOptionsSchema = z.object({
  /** Export format */
  format: ExportFormat.default('json'),
  /** Filter to apply */
  filter: MemoryFilterSchema.optional(),
  /** Include metadata */
  includeMetadata: z.boolean().default(true),
  /** Compress output */
  compress: z.boolean().default(false),
});
export type MemoryExportOptions = z.infer<typeof MemoryExportOptionsSchema>;

/**
 * Import options
 */
export const MemoryImportOptionsSchema = z.object({
  /** How to handle duplicates */
  duplicateHandling: z.enum(['skip', 'replace', 'merge']).default('skip'),
  /** Validate entries before import */
  validate: z.boolean().default(true),
  /** Batch size for import */
  batchSize: z.number().int().min(1).max(1000).default(100),
});
export type MemoryImportOptions = z.infer<typeof MemoryImportOptionsSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate memory entry
 */
export function validateMemoryEntry(data: unknown): MemoryEntry {
  return MemoryEntrySchema.parse(data);
}

/**
 * Validate memory add input
 */
export function validateMemoryAddInput(data: unknown): MemoryAddInput {
  return MemoryAddInputSchema.parse(data);
}

/**
 * Validate search options
 */
export function validateSearchOptions(data: unknown): MemorySearchOptions {
  return MemorySearchOptionsSchema.parse(data);
}
