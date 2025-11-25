// src/memory.ts
import { z as z2 } from "zod";

// src/common.ts
import { z } from "zod";
var AgentId = z.string().min(1).max(50).regex(/^[a-z][a-z0-9-]*$/, "Agent ID must be lowercase alphanumeric with hyphens").brand();
var SessionId = z.string().uuid().brand();
var MemoryId = z.number().int().positive().brand();
var CheckpointId = z.string().uuid().brand();
var ProviderType = z.enum(["claude", "gemini", "ax-cli", "openai"]);
var IntegrationMode = z.enum(["mcp", "sdk", "bash"]);
var TaskStatus = z.enum(["pending", "running", "completed", "failed", "cancelled"]);
var MemoryType = z.enum(["conversation", "code", "document", "task", "decision"]);
var LogLevel = z.enum(["debug", "info", "warn", "error", "fatal"]);
var ISODateString = z.string().datetime();
var DurationMs = z.number().int().nonnegative();
var Percentage = z.number().min(0).max(100);
var NormalizedScore = z.number().min(0).max(1);
var NonEmptyStringArray = z.array(z.string()).min(1);
var Metadata = z.record(z.string(), z.unknown());
var TokenUsage = z.object({
  input: z.number().int().nonnegative().optional(),
  output: z.number().int().nonnegative().optional(),
  total: z.number().int().nonnegative().optional()
});
var ErrorInfo = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  stack: z.string().optional(),
  cause: z.string().optional()
});

// src/memory.ts
var MemoryMetadataSchema = z2.object({
  /** Type of memory content */
  type: MemoryType,
  /** Source of the memory (agent, user, system) */
  source: z2.string().min(1).max(100),
  /** Agent ID that created this memory */
  agentId: z2.string().optional(),
  /** Session ID if part of a session */
  sessionId: z2.string().uuid().optional(),
  /** Tags for categorization */
  tags: z2.array(z2.string().max(50)).max(20).default([]),
  /** Importance score (0-1) */
  importance: NormalizedScore.optional(),
  /** File path if memory relates to a file */
  filePath: z2.string().optional(),
  /** Language if code-related */
  language: z2.string().optional(),
  /** Custom metadata */
  custom: z2.record(z2.string(), z2.unknown()).optional()
});
var MemoryEntrySchema = z2.object({
  /** Unique identifier */
  id: MemoryId,
  /** Memory content */
  content: z2.string().min(1).max(1e5),
  /** Associated metadata */
  metadata: MemoryMetadataSchema,
  /** Creation timestamp */
  createdAt: z2.date(),
  /** Last accessed timestamp */
  lastAccessedAt: z2.date().optional(),
  /** Number of times accessed */
  accessCount: z2.number().int().nonnegative().default(0),
  /** Relevance score from last search */
  score: z2.number().optional()
});
var MemoryFilterSchema = z2.object({
  /** Filter by memory type */
  type: MemoryType.optional(),
  /** Filter by agent ID */
  agentId: z2.string().optional(),
  /** Filter by session ID */
  sessionId: z2.string().uuid().optional(),
  /** Filter by tags (any match) */
  tags: z2.array(z2.string()).optional(),
  /** Filter by tags (all must match) */
  tagsAll: z2.array(z2.string()).optional(),
  /** Filter by minimum importance */
  minImportance: NormalizedScore.optional(),
  /** Filter by source */
  source: z2.string().optional(),
  /** Filter by date range - after */
  createdAfter: z2.date().optional(),
  /** Filter by date range - before */
  createdBefore: z2.date().optional(),
  /** Filter by minimum access count */
  minAccessCount: z2.number().int().nonnegative().optional()
});
var MemorySearchOptionsSchema = z2.object({
  /** Search query string */
  query: z2.string().min(1).max(1e3),
  /** Maximum results to return */
  limit: z2.number().int().min(1).max(100).default(10),
  /** Offset for pagination */
  offset: z2.number().int().nonnegative().default(0),
  /** Filter options */
  filter: MemoryFilterSchema.optional(),
  /** Sort by field */
  sortBy: z2.enum(["relevance", "created", "accessed", "importance"]).default("relevance"),
  /** Sort direction */
  sortDirection: z2.enum(["asc", "desc"]).default("desc"),
  /** Include content in results */
  includeContent: z2.boolean().default(true),
  /** Highlight matches in content */
  highlight: z2.boolean().default(false)
});
var MemorySearchResultSchema = z2.object({
  /** Matching entries */
  entries: z2.array(MemoryEntrySchema),
  /** Total count (before pagination) */
  total: z2.number().int().nonnegative(),
  /** Search duration in milliseconds */
  duration: DurationMs,
  /** Query that was executed */
  query: z2.string(),
  /** Whether more results exist */
  hasMore: z2.boolean()
});
var MemoryAddInputSchema = z2.object({
  /** Content to store */
  content: z2.string().min(1).max(1e5),
  /** Metadata for the entry */
  metadata: MemoryMetadataSchema
});
var MemoryUpdateInputSchema = z2.object({
  /** Entry ID to update */
  id: MemoryId,
  /** New content (optional) */
  content: z2.string().min(1).max(1e5).optional(),
  /** Updated metadata (merged with existing) */
  metadata: MemoryMetadataSchema.partial().optional()
});
var MemoryBulkAddInputSchema = z2.object({
  /** Entries to add */
  entries: z2.array(MemoryAddInputSchema).min(1).max(100)
});
var CleanupStrategy = z2.enum(["oldest", "least_accessed", "hybrid", "low_importance"]);
var MemoryCleanupConfigSchema = z2.object({
  /** Whether automatic cleanup is enabled */
  enabled: z2.boolean().default(true),
  /** Strategy for selecting entries to delete */
  strategy: CleanupStrategy.default("hybrid"),
  /** Trigger cleanup when reaching this percentage of max entries */
  triggerThreshold: z2.number().min(0.5).max(1).default(0.9),
  /** Target percentage after cleanup */
  targetThreshold: z2.number().min(0.3).max(0.9).default(0.7),
  /** Minimum entries to delete per cleanup */
  minCleanupCount: z2.number().int().min(1).default(10),
  /** Maximum entries to delete per cleanup */
  maxCleanupCount: z2.number().int().min(10).default(1e3),
  /** Retention period in days */
  retentionDays: z2.number().int().min(1).default(30),
  /** Entries to always preserve (by tag) */
  preserveTags: z2.array(z2.string()).default(["important", "pinned"])
}).refine(
  (data) => data.maxCleanupCount >= data.minCleanupCount,
  {
    message: "maxCleanupCount must be greater than or equal to minCleanupCount",
    path: ["maxCleanupCount"]
  }
).refine(
  (data) => data.targetThreshold < data.triggerThreshold,
  {
    message: "targetThreshold must be less than triggerThreshold",
    path: ["targetThreshold"]
  }
);
var MemoryCleanupResultSchema = z2.object({
  /** Number of entries deleted */
  deletedCount: z2.number().int().nonnegative(),
  /** Strategy used */
  strategy: CleanupStrategy,
  /** Duration in milliseconds */
  duration: DurationMs,
  /** Entries before cleanup */
  entriesBefore: z2.number().int().nonnegative(),
  /** Entries after cleanup */
  entriesAfter: z2.number().int().nonnegative()
});
var MemoryStatsSchema = z2.object({
  /** Total number of entries */
  totalEntries: z2.number().int().nonnegative(),
  /** Entries by type */
  entriesByType: z2.record(MemoryType, z2.number().int().nonnegative()),
  /** Database size in bytes */
  databaseSizeBytes: z2.number().int().nonnegative(),
  /** Oldest entry date */
  oldestEntry: z2.date().optional(),
  /** Newest entry date */
  newestEntry: z2.date().optional(),
  /** Average content length */
  avgContentLength: z2.number().nonnegative(),
  /** Total access count */
  totalAccessCount: z2.number().int().nonnegative(),
  /** Top tags */
  topTags: z2.array(z2.object({
    tag: z2.string(),
    count: z2.number().int().nonnegative()
  })).max(20)
});
var ExportFormat = z2.enum(["json", "jsonl", "csv"]);
var MemoryExportOptionsSchema = z2.object({
  /** Export format */
  format: ExportFormat.default("json"),
  /** Filter to apply */
  filter: MemoryFilterSchema.optional(),
  /** Include metadata */
  includeMetadata: z2.boolean().default(true),
  /** Compress output */
  compress: z2.boolean().default(false)
});
var MemoryImportOptionsSchema = z2.object({
  /** How to handle duplicates */
  duplicateHandling: z2.enum(["skip", "replace", "merge"]).default("skip"),
  /** Validate entries before import */
  validate: z2.boolean().default(true),
  /** Batch size for import */
  batchSize: z2.number().int().min(1).max(1e3).default(100)
});
function validateMemoryEntry(data) {
  return MemoryEntrySchema.parse(data);
}
function validateMemoryAddInput(data) {
  return MemoryAddInputSchema.parse(data);
}
function validateSearchOptions(data) {
  return MemorySearchOptionsSchema.parse(data);
}
export {
  CleanupStrategy,
  ExportFormat,
  MemoryAddInputSchema,
  MemoryBulkAddInputSchema,
  MemoryCleanupConfigSchema,
  MemoryCleanupResultSchema,
  MemoryEntrySchema,
  MemoryExportOptionsSchema,
  MemoryFilterSchema,
  MemoryImportOptionsSchema,
  MemoryMetadataSchema,
  MemorySearchOptionsSchema,
  MemorySearchResultSchema,
  MemoryStatsSchema,
  MemoryUpdateInputSchema,
  validateMemoryAddInput,
  validateMemoryEntry,
  validateSearchOptions
};
//# sourceMappingURL=memory.js.map