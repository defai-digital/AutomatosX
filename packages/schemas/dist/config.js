// src/config.ts
import { z as z3 } from "zod";

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
import { z as z2 } from "zod";
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

// src/constants.ts
var VERSION = "11.0.0-alpha.0";
var MS_PER_SECOND = 1e3;
var MS_PER_MINUTE = 60 * MS_PER_SECOND;
var MS_PER_HOUR = 60 * MS_PER_MINUTE;
var MS_PER_DAY = 24 * MS_PER_HOUR;
var MS_PER_WEEK = 7 * MS_PER_DAY;
var BYTES_PER_KB = 1024;
var BYTES_PER_MB = BYTES_PER_KB * 1024;
var BYTES_PER_GB = BYTES_PER_MB * 1024;
var DIR_AUTOMATOSX = ".automatosx";
var DIR_SESSIONS = "sessions";
var DIR_MEMORY = "memory";
var DIR_CHECKPOINTS = "checkpoints";
var DIR_TRACES = "traces";
var DIR_LOGS = "logs";
var DIR_WORKSPACE_PRD = "automatosx/PRD";
var DIR_WORKSPACE_TMP = "automatosx/tmp";
var FILE_MEMORY_DB = "memories.db";
var PATH_MEMORY_DB = `${DIR_AUTOMATOSX}/${DIR_MEMORY}/${FILE_MEMORY_DB}`;
var PATH_SESSIONS = `${DIR_AUTOMATOSX}/${DIR_SESSIONS}`;
var PATH_CHECKPOINTS = `${DIR_AUTOMATOSX}/${DIR_CHECKPOINTS}`;
var PATH_TRACES = `${DIR_AUTOMATOSX}/${DIR_TRACES}`;
var PATH_LOGS = `${DIR_AUTOMATOSX}/${DIR_LOGS}`;
var LIST_SEARCH_LIMIT = 10;
var TIMEOUT_EXECUTION = 5 * MS_PER_MINUTE;
var TIMEOUT_HEALTH_CHECK = MS_PER_MINUTE;
var TIMEOUT_HEALTH_CHECK_REQUEST = 5 * MS_PER_SECOND;
var TIMEOUT_SESSION = MS_PER_HOUR;
var TIMEOUT_RETRY_INITIAL = MS_PER_SECOND;
var TIMEOUT_RETRY_MAX = 30 * MS_PER_SECOND;
var TIMEOUT_CIRCUIT_FAILURE_WINDOW = 5 * MS_PER_MINUTE;
var TIMEOUT_PROVIDER_COOLDOWN = 30 * MS_PER_SECOND;
var TIMEOUT_AUTO_SAVE = 30 * MS_PER_SECOND;
var TIMEOUT_SAVE_DEBOUNCE = MS_PER_SECOND;
var LIMIT_RETRY_ATTEMPTS = 3;
var LIMIT_CONCURRENCY = 4;
var LIMIT_MEMORY_ENTRIES = 1e4;
var LIMIT_RETENTION_DAYS = 30;
var LIMIT_MAX_SESSIONS = 100;
var LIMIT_CHECKPOINTS_PER_SESSION = 20;
var LIMIT_CHECKPOINT_RETENTION_DAYS = 7;
var LIMIT_MAX_LOG_FILES = 10;
var LIMIT_MAX_LOG_SIZE = 10 * BYTES_PER_MB;
var LIMIT_TMP_RETENTION_DAYS = 7;
var LIMIT_CIRCUIT_BREAKER_THRESHOLD = 3;

// src/config.ts
var ProvidersConfigSchema = z3.object({
  /** Default provider to use */
  default: ProviderType.default("claude"),
  /** Enabled providers */
  enabled: z3.array(ProviderType).default(["claude"]),
  /** Fallback order when default fails */
  fallbackOrder: z3.array(ProviderType).optional()
});
var RetryConfigSchema = z3.object({
  /** Maximum retry attempts */
  maxAttempts: z3.number().int().min(0).max(10).default(LIMIT_RETRY_ATTEMPTS),
  /** Initial delay between retries (ms) */
  initialDelay: DurationMs.default(TIMEOUT_RETRY_INITIAL),
  /** Maximum delay between retries (ms) */
  maxDelay: DurationMs.default(TIMEOUT_RETRY_MAX),
  /** Backoff multiplier */
  backoffFactor: z3.number().min(1).max(5).default(2),
  /** Jitter factor (0-1) to add randomness */
  jitterFactor: z3.number().min(0).max(1).default(0.1)
}).refine(
  (data) => data.maxDelay >= data.initialDelay,
  {
    message: "maxDelay must be greater than or equal to initialDelay",
    path: ["maxDelay"]
  }
);
var ExecutionConfigSchema = z3.object({
  /** Default timeout for agent execution (ms), 1ms to 1 hour */
  timeout: z3.number().int().min(1).max(36e5).default(TIMEOUT_EXECUTION),
  /** Maximum concurrent agent executions */
  concurrency: z3.number().int().min(1).max(16).default(LIMIT_CONCURRENCY),
  /** Retry configuration */
  retry: RetryConfigSchema.default({}),
  /** Enable execution tracing */
  tracing: z3.boolean().default(false),
  /** Trace output directory */
  traceDir: z3.string().default(PATH_TRACES)
});
var MemoryConfigSchema = z3.object({
  /** Whether memory system is enabled */
  enabled: z3.boolean().default(true),
  /** Maximum number of entries */
  maxEntries: z3.number().int().min(100).max(1e6).default(LIMIT_MEMORY_ENTRIES),
  /** Database path */
  databasePath: z3.string().default(PATH_MEMORY_DB),
  /** Retention period in days */
  retentionDays: z3.number().int().min(1).max(365).default(LIMIT_RETENTION_DAYS),
  /** Cleanup strategy */
  cleanupStrategy: CleanupStrategy.default("hybrid"),
  /** Auto cleanup enabled */
  autoCleanup: z3.boolean().default(true),
  /** Search result limit */
  searchLimit: z3.number().int().min(1).max(100).default(LIST_SEARCH_LIMIT)
});
var SessionConfigSchema = z3.object({
  /** Maximum active sessions */
  maxSessions: z3.number().int().min(1).max(1e3).default(LIMIT_MAX_SESSIONS),
  /** Session timeout (ms) */
  timeout: DurationMs.default(TIMEOUT_SESSION),
  /** Session data directory */
  dataDir: z3.string().default(PATH_SESSIONS),
  /** Auto-save interval (ms) */
  autoSaveInterval: DurationMs.default(TIMEOUT_AUTO_SAVE),
  /** Debounce time for saves (ms) */
  saveDebounce: DurationMs.default(TIMEOUT_SAVE_DEBOUNCE)
});
var CheckpointConfigSchema = z3.object({
  /** Whether checkpoints are enabled */
  enabled: z3.boolean().default(true),
  /** Checkpoint storage directory */
  storageDir: z3.string().default(PATH_CHECKPOINTS),
  /** Auto-save checkpoints */
  autoSave: z3.boolean().default(true),
  /** Checkpoint retention in days */
  retentionDays: z3.number().int().min(1).max(90).default(LIMIT_CHECKPOINT_RETENTION_DAYS),
  /** Maximum checkpoints per session */
  maxPerSession: z3.number().int().min(1).max(100).default(LIMIT_CHECKPOINTS_PER_SESSION)
});
var RouterConfigSchema = z3.object({
  /** Health check interval (ms) */
  healthCheckInterval: DurationMs.default(TIMEOUT_HEALTH_CHECK),
  /** Circuit breaker failure threshold */
  circuitBreakerThreshold: z3.number().int().min(1).max(10).default(LIMIT_CIRCUIT_BREAKER_THRESHOLD),
  /** Provider cooldown after failure (ms) */
  cooldownMs: DurationMs.default(TIMEOUT_PROVIDER_COOLDOWN),
  /** Enable workload-aware routing */
  workloadAwareRouting: z3.boolean().default(true),
  /** Prefer MCP providers */
  preferMcp: z3.boolean().default(true)
});
var WorkspaceConfigSchema = z3.object({
  /** PRD documents path */
  prdPath: z3.string().default(DIR_WORKSPACE_PRD),
  /** Temporary files path */
  tmpPath: z3.string().default(DIR_WORKSPACE_TMP),
  /** Auto-cleanup temporary files */
  autoCleanupTmp: z3.boolean().default(true),
  /** Temporary file retention in days */
  tmpRetentionDays: z3.number().int().min(1).max(30).default(LIMIT_TMP_RETENTION_DAYS)
});
var LoggingConfigSchema = z3.object({
  /** Log level */
  level: z3.enum(["debug", "info", "warn", "error"]).default("info"),
  /** Log directory */
  dir: z3.string().default(PATH_LOGS),
  /** Enable file logging */
  fileEnabled: z3.boolean().default(true),
  /** Enable console logging */
  consoleEnabled: z3.boolean().default(true),
  /** Maximum log file size in bytes */
  maxFileSize: z3.number().int().positive().default(LIMIT_MAX_LOG_SIZE),
  /** Maximum log files to keep */
  maxFiles: z3.number().int().min(1).max(100).default(LIMIT_MAX_LOG_FILES),
  /** Enable structured JSON logs */
  jsonFormat: z3.boolean().default(false)
});
var ConfigSchema = z3.object({
  /** Configuration schema version */
  $schema: z3.string().optional(),
  /** Configuration version */
  version: z3.string().default(VERSION),
  /** Providers configuration */
  providers: ProvidersConfigSchema.default({}),
  /** Execution configuration */
  execution: ExecutionConfigSchema.default({}),
  /** Memory configuration */
  memory: MemoryConfigSchema.default({}),
  /** Session configuration */
  session: SessionConfigSchema.default({}),
  /** Checkpoint configuration */
  checkpoint: CheckpointConfigSchema.default({}),
  /** Router configuration */
  router: RouterConfigSchema.default({}),
  /** Workspace configuration */
  workspace: WorkspaceConfigSchema.default({}),
  /** Logging configuration */
  logging: LoggingConfigSchema.default({})
});
var MinimalConfigSchema = z3.object({
  /** Default provider */
  provider: ProviderType.default("claude")
});
var DEFAULT_CONFIG = ConfigSchema.parse({});
function validateConfig(data) {
  return ConfigSchema.parse(data);
}
function safeValidateConfig(data) {
  return ConfigSchema.safeParse(data);
}
function mergeConfig(partial) {
  return ConfigSchema.parse({
    ...DEFAULT_CONFIG,
    ...partial
  });
}
function expandMinimalConfig(minimal) {
  return ConfigSchema.parse({
    providers: {
      default: minimal.provider,
      enabled: [minimal.provider]
    }
  });
}
export {
  CheckpointConfigSchema,
  ConfigSchema,
  DEFAULT_CONFIG,
  ExecutionConfigSchema,
  LoggingConfigSchema,
  MemoryConfigSchema,
  MinimalConfigSchema,
  ProvidersConfigSchema,
  RetryConfigSchema,
  RouterConfigSchema,
  SessionConfigSchema,
  WorkspaceConfigSchema,
  expandMinimalConfig,
  mergeConfig,
  safeValidateConfig,
  validateConfig
};
/**
 * Shared Constants
 *
 * Centralized constants for the AutomatosX platform.
 * Import these instead of using magic numbers or hardcoded strings.
 *
 * @module @ax/schemas/constants
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
//# sourceMappingURL=config.js.map