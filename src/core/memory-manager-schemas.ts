/**
 * Memory Manager Zod Schemas
 *
 * Runtime validation for memory manager operations
 * v8.5.7: Phase 2 Zod refactoring
 */

import { z } from 'zod';

/**
 * Memory Metadata Schema
 * Validates metadata attached to memory entries
 */
export const MemoryMetadataSchema = z.object({
  type: z.string().min(1).max(100),
  source: z.string().min(1).max(200),
  agentId: z.string().min(1).max(100).optional(),
  sessionId: z.string().uuid().optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  importance: z.number().min(0).max(1).optional(),
  description: z.string().max(500).optional()
  // Allow additional custom fields
}).passthrough();

/**
 * Memory Entry Schema (for database operations)
 */
export const MemoryEntrySchema = z.object({
  id: z.number().int().positive(),
  content: z.string().min(1).max(100000), // 100KB max content
  embedding: z.array(z.number()).optional(), // Deprecated in v4.11.0 (FTS5 only)
  metadata: MemoryMetadataSchema,
  createdAt: z.date(),
  lastAccessedAt: z.date().optional(),
  accessCount: z.number().int().nonnegative()
}).strict();

/**
 * Memory Search Filters Schema
 */
export const MemorySearchFiltersSchema = z.object({
  type: z.union([
    z.string().min(1),
    z.array(z.string().min(1))
  ]).optional(),
  source: z.union([
    z.string().min(1),
    z.array(z.string().min(1))
  ]).optional(),
  agentId: z.string().min(1).max(100).optional(),
  sessionId: z.string().uuid().optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  dateRange: z.object({
    from: z.date().optional(),
    to: z.date().optional()
  }).optional(),
  minImportance: z.number().min(0).max(1).optional()
}).strict();

/**
 * Memory Search Query Schema
 */
export const MemorySearchQuerySchema = z.object({
  text: z.string().min(1).max(1000).optional(),
  embedding: z.array(z.number()).optional(), // Deprecated in v4.11.0
  filters: MemorySearchFiltersSchema.optional(),
  limit: z.number().int().positive().max(1000).optional(),
  threshold: z.number().min(0).max(1).optional()
}).strict()
  .refine(
    (data) => {
      // At least one search criterion must be provided
      return data.text !== undefined || data.embedding !== undefined;
    },
    {
      message: 'Either text or embedding must be provided for search',
      path: ['text']
    }
  );

/**
 * Get All Options Schema
 */
export const GetAllOptionsSchema = z.object({
  type: z.string().min(1).max(100).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  limit: z.number().int().positive().max(10000).optional(),
  offset: z.number().int().nonnegative().optional(),
  orderBy: z.enum(['created', 'accessed', 'count']).optional(),
  order: z.enum(['asc', 'desc']).optional()
}).strict();

/**
 * Export Options Schema
 */
export const ExportOptionsSchema = z.object({
  includeEmbeddings: z.boolean().optional(),
  filters: MemorySearchFiltersSchema.optional(),
  batchSize: z.number().int().positive().max(10000).optional(),
  pretty: z.boolean().optional()
}).strict();

/**
 * Import Options Schema
 */
export const ImportOptionsSchema = z.object({
  skipDuplicates: z.boolean().optional(),
  batchSize: z.number().int().positive().max(1000).optional(),
  validate: z.boolean().optional(),
  clearExisting: z.boolean().optional()
}).strict();

/**
 * Memory Manager Config Schema
 */
export const MemoryManagerConfigSchema = z.object({
  dbPath: z.string().min(1).max(500),
  maxEntries: z.number().int().positive().max(1000000).optional(),
  autoCleanup: z.boolean().optional(),
  cleanupDays: z.number().int().positive().max(365).optional(),
  trackAccess: z.boolean().optional(),
  busyTimeout: z.number().int().positive().max(60000).optional(), // Max 60s
  embeddingProvider: z.unknown().optional(), // Deprecated
  cleanup: z.object({
    enabled: z.boolean().optional(),
    strategy: z.enum(['oldest', 'least_accessed', 'hybrid']).optional(),
    triggerThreshold: z.number().min(0.5).max(1.0).optional(),
    targetThreshold: z.number().min(0.1).max(0.9).optional(),
    minCleanupCount: z.number().int().positive().optional(),
    maxCleanupCount: z.number().int().positive().optional(),
    retentionDays: z.number().int().positive().max(365).optional()
  }).strict().optional()
}).strict();

// Type exports for convenience
export type MemoryMetadata = z.infer<typeof MemoryMetadataSchema>;
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;
export type MemorySearchFilters = z.infer<typeof MemorySearchFiltersSchema>;
export type MemorySearchQuery = z.infer<typeof MemorySearchQuerySchema>;
export type GetAllOptions = z.infer<typeof GetAllOptionsSchema>;
export type ExportOptions = z.infer<typeof ExportOptionsSchema>;
export type ImportOptions = z.infer<typeof ImportOptionsSchema>;
export type MemoryManagerConfig = z.infer<typeof MemoryManagerConfigSchema>;
