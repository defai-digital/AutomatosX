/**
 * Memory MCP Tool Contracts
 *
 * Zod schemas for memory tool inputs and outputs.
 */

import { z } from 'zod';

// ============================================================================
// memory_store Tool
// ============================================================================

/**
 * Input schema for memory_store tool
 */
export const MemoryStoreInputSchema = z.object({
  key: z.string().min(1).max(500),
  value: z.record(z.unknown()),
  namespace: z.string().max(100).optional(),
});

export type MemoryStoreInput = z.infer<typeof MemoryStoreInputSchema>;

/**
 * Output schema for memory_store tool
 */
export const MemoryStoreOutputSchema = z.object({
  success: z.boolean(),
  key: z.string(),
  namespace: z.string(),
  message: z.string(),
});

export type MemoryStoreOutput = z.infer<typeof MemoryStoreOutputSchema>;

// ============================================================================
// memory_retrieve Tool
// ============================================================================

/**
 * Input schema for memory_retrieve tool
 */
export const MemoryRetrieveInputSchema = z.object({
  key: z.string().min(1).max(500),
  namespace: z.string().max(100).optional(),
});

export type MemoryRetrieveInput = z.infer<typeof MemoryRetrieveInputSchema>;

/**
 * Output schema for memory_retrieve tool
 */
export const MemoryRetrieveOutputSchema = z.object({
  found: z.boolean(),
  key: z.string(),
  namespace: z.string(),
  value: z.unknown().optional(),
  storedAt: z.string().datetime().optional(),
  message: z.string().optional(),
});

export type MemoryRetrieveOutput = z.infer<typeof MemoryRetrieveOutputSchema>;

// ============================================================================
// memory_search Tool
// ============================================================================

/**
 * Input schema for memory_search tool
 */
export const MemorySearchInputSchema = z.object({
  query: z.string().min(1).max(500),
  namespace: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(100).optional().default(10),
});

export type MemorySearchInput = z.infer<typeof MemorySearchInputSchema>;

/**
 * Search result item
 */
export const MemorySearchResultSchema = z.object({
  key: z.string(),
  namespace: z.string(),
  value: z.unknown(),
  storedAt: z.string().datetime(),
});

export type MemorySearchResult = z.infer<typeof MemorySearchResultSchema>;

/**
 * Output schema for memory_search tool
 */
export const MemorySearchOutputSchema = z.object({
  query: z.string(),
  namespace: z.string(),
  count: z.number().int().min(0),
  results: z.array(MemorySearchResultSchema),
});

export type MemorySearchOutput = z.infer<typeof MemorySearchOutputSchema>;

// ============================================================================
// memory_list Tool
// ============================================================================

/**
 * Input schema for memory_list tool
 */
export const MemoryListInputSchema = z.object({
  namespace: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(1000).optional().default(100),
  prefix: z.string().max(200).optional(),
});

export type MemoryListInput = z.infer<typeof MemoryListInputSchema>;

/**
 * Key info in list output
 */
export const MemoryKeyInfoSchema = z.object({
  key: z.string(),
  namespace: z.string(),
  storedAt: z.string().datetime(),
});

export type MemoryKeyInfo = z.infer<typeof MemoryKeyInfoSchema>;

/**
 * Output schema for memory_list tool
 */
export const MemoryListOutputSchema = z.object({
  keys: z.array(MemoryKeyInfoSchema),
  total: z.number().int().min(0),
  hasMore: z.boolean(),
});

export type MemoryListOutput = z.infer<typeof MemoryListOutputSchema>;

// ============================================================================
// memory_delete Tool
// ============================================================================

/**
 * Input schema for memory_delete tool
 */
export const MemoryDeleteInputSchema = z.object({
  key: z.string().min(1).max(500),
  namespace: z.string().max(100).optional(),
});

export type MemoryDeleteInput = z.infer<typeof MemoryDeleteInputSchema>;

/**
 * Output schema for memory_delete tool
 */
export const MemoryDeleteOutputSchema = z.object({
  deleted: z.boolean(),
  key: z.string(),
  namespace: z.string(),
  message: z.string(),
});

export type MemoryDeleteOutput = z.infer<typeof MemoryDeleteOutputSchema>;

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Memory tool error codes
 */
export const MemoryToolErrorCode = {
  KEY_NOT_FOUND: 'KEY_NOT_FOUND',
  STORE_FAILED: 'STORE_FAILED',
  DELETE_FAILED: 'DELETE_FAILED',
  SEARCH_FAILED: 'SEARCH_FAILED',
  NAMESPACE_NOT_FOUND: 'NAMESPACE_NOT_FOUND',
  INVALID_KEY: 'INVALID_KEY',
} as const;

export type MemoryToolErrorCode =
  (typeof MemoryToolErrorCode)[keyof typeof MemoryToolErrorCode];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates memory_store input
 */
export function validateMemoryStoreInput(data: unknown): MemoryStoreInput {
  return MemoryStoreInputSchema.parse(data);
}

/**
 * Safely validates memory_store input
 */
export function safeValidateMemoryStoreInput(
  data: unknown
): { success: true; data: MemoryStoreInput } | { success: false; error: z.ZodError } {
  const result = MemoryStoreInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validates memory_retrieve input
 */
export function validateMemoryRetrieveInput(data: unknown): MemoryRetrieveInput {
  return MemoryRetrieveInputSchema.parse(data);
}

/**
 * Validates memory_search input
 */
export function validateMemorySearchInput(data: unknown): MemorySearchInput {
  return MemorySearchInputSchema.parse(data);
}

/**
 * Validates memory_list input
 */
export function validateMemoryListInput(data: unknown): MemoryListInput {
  return MemoryListInputSchema.parse(data);
}

/**
 * Validates memory_delete input
 */
export function validateMemoryDeleteInput(data: unknown): MemoryDeleteInput {
  return MemoryDeleteInputSchema.parse(data);
}

// ============================================================================
// memory_export Tool
// ============================================================================

/**
 * Input schema for memory_export tool
 */
export const MemoryExportInputSchema = z.object({
  namespace: z.string().max(100).optional(),
  prefix: z.string().max(200).optional(),
  includeMetadata: z.boolean().optional().default(true),
});

export type MemoryExportInput = z.infer<typeof MemoryExportInputSchema>;

/**
 * Output schema for memory_export tool
 */
export const MemoryExportOutputSchema = z.object({
  count: z.number().int().min(0),
  exportedAt: z.string().datetime(),
  data: z.array(z.object({
    key: z.string(),
    value: z.unknown(),
    namespace: z.string(),
    storedAt: z.string().datetime().optional(),
  })),
});

export type MemoryExportOutput = z.infer<typeof MemoryExportOutputSchema>;

// ============================================================================
// memory_import Tool
// ============================================================================

/**
 * Input schema for memory_import tool
 */
export const MemoryImportInputSchema = z.object({
  data: z.array(z.object({
    key: z.string().min(1),
    value: z.unknown(),
    namespace: z.string().optional(),
  })),
  overwrite: z.boolean().optional().default(false),
  namespace: z.string().max(100).optional(),
});

export type MemoryImportInput = z.infer<typeof MemoryImportInputSchema>;

/**
 * Output schema for memory_import tool
 */
export const MemoryImportOutputSchema = z.object({
  imported: z.number().int().min(0),
  skipped: z.number().int().min(0),
  errors: z.array(z.string()).optional(),
  importedAt: z.string().datetime(),
});

export type MemoryImportOutput = z.infer<typeof MemoryImportOutputSchema>;

// ============================================================================
// memory_stats Tool
// ============================================================================

/**
 * Input schema for memory_stats tool
 */
export const MemoryStatsInputSchema = z.object({
  namespace: z.string().max(100).optional(),
  detailed: z.boolean().optional().default(false),
});

export type MemoryStatsInput = z.infer<typeof MemoryStatsInputSchema>;

/**
 * Output schema for memory_stats tool
 */
export const MemoryStatsOutputSchema = z.object({
  totalEntries: z.number().int().min(0),
  namespaceCount: z.number().int().min(0),
  byNamespace: z.record(z.object({
    count: z.number().int().min(0),
    keys: z.array(z.string()).optional(),
  })),
  generatedAt: z.string().datetime(),
});

export type MemoryStatsOutput = z.infer<typeof MemoryStatsOutputSchema>;

// ============================================================================
// memory_bulk_delete Tool
// ============================================================================

/**
 * Input schema for memory_bulk_delete tool
 */
export const MemoryBulkDeleteInputSchema = z.object({
  keys: z.array(z.string()).optional(),
  namespace: z.string().max(100).optional(),
  prefix: z.string().max(200).optional(),
});

export type MemoryBulkDeleteInput = z.infer<typeof MemoryBulkDeleteInputSchema>;

/**
 * Output schema for memory_bulk_delete tool
 */
export const MemoryBulkDeleteOutputSchema = z.object({
  deleted: z.number().int().min(0),
  notFound: z.number().int().min(0),
  deletedKeys: z.array(z.string()),
  namespace: z.string(),
  deletedAt: z.string().datetime(),
});

export type MemoryBulkDeleteOutput = z.infer<typeof MemoryBulkDeleteOutputSchema>;

// ============================================================================
// memory_clear Tool
// ============================================================================

/**
 * Input schema for memory_clear tool
 */
export const MemoryClearInputSchema = z.object({
  namespace: z.string().min(1).max(100),
  confirm: z.boolean(),
});

export type MemoryClearInput = z.infer<typeof MemoryClearInputSchema>;

/**
 * Output schema for memory_clear tool
 */
export const MemoryClearOutputSchema = z.object({
  cleared: z.number().int().min(0),
  namespace: z.string(),
  clearedAt: z.string().datetime(),
});

export type MemoryClearOutput = z.infer<typeof MemoryClearOutputSchema>;

/**
 * Validates memory_export input
 */
export function validateMemoryExportInput(data: unknown): MemoryExportInput {
  return MemoryExportInputSchema.parse(data);
}

/**
 * Validates memory_import input
 */
export function validateMemoryImportInput(data: unknown): MemoryImportInput {
  return MemoryImportInputSchema.parse(data);
}

/**
 * Validates memory_stats input
 */
export function validateMemoryStatsInput(data: unknown): MemoryStatsInput {
  return MemoryStatsInputSchema.parse(data);
}

/**
 * Validates memory_bulk_delete input
 */
export function validateMemoryBulkDeleteInput(data: unknown): MemoryBulkDeleteInput {
  return MemoryBulkDeleteInputSchema.parse(data);
}

/**
 * Validates memory_clear input
 */
export function validateMemoryClearInput(data: unknown): MemoryClearInput {
  return MemoryClearInputSchema.parse(data);
}
