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
var Result = (dataSchema) => z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    data: dataSchema
  }),
  z.object({
    success: z.literal(false),
    error: ErrorInfo
  })
]);
var ValidationError = class extends Error {
  constructor(message, zodError) {
    super(message);
    this.zodError = zodError;
    this.name = "ValidationError";
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      issues: this.zodError.issues
    };
  }
};
function safeParse(schema, data) {
  return schema.safeParse(data);
}
function parseOrThrow(schema, data, errorMessage) {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(errorMessage, result.error);
  }
  return result.data;
}

// src/agent.ts
import { z as z2 } from "zod";
var CommunicationStyle = z2.enum(["formal", "casual", "technical", "friendly"]);
var DecisionMaking = z2.enum(["data-driven", "intuitive", "collaborative", "analytical"]);
var PersonalitySchema = z2.object({
  /** Character traits that define the agent's behavior (1-5 traits) */
  traits: z2.array(z2.string().min(1).max(50)).min(1).max(5),
  /** Optional catchphrase or signature expression */
  catchphrase: z2.string().max(200).optional(),
  /** How the agent communicates */
  communicationStyle: CommunicationStyle.default("technical"),
  /** How the agent makes decisions */
  decisionMaking: DecisionMaking.default("data-driven")
});
var AbilitySelectionSchema = z2.object({
  /** Core abilities always loaded for this agent */
  core: z2.array(z2.string()).default([]),
  /** Task-based abilities loaded by keyword matching */
  taskBased: z2.record(z2.string(), z2.array(z2.string())).default({})
});
var OrchestrationSchema = z2.object({
  /** Maximum depth of delegation chain (0 = cannot delegate) */
  maxDelegationDepth: z2.number().int().min(0).max(3).default(0),
  /** Workspaces this agent can read from */
  canReadWorkspaces: z2.array(z2.string()).default([]),
  /** Whether agent can write to shared workspace */
  canWriteToShared: z2.boolean().default(false),
  /** Agents this agent can delegate to */
  canDelegateTo: z2.array(z2.string()).default([]),
  /** Priority level for task routing (1 = highest) */
  priority: z2.number().int().min(1).max(10).default(5)
});
var AgentProfileSchema = z2.object({
  /** Unique identifier for the agent (lowercase, alphanumeric with hyphens) */
  name: AgentId,
  /** Human-friendly display name */
  displayName: z2.string().min(1).max(50),
  /** Agent's role description */
  role: z2.string().min(1).max(100),
  /** Team affiliation */
  team: z2.string().default("default"),
  /** Detailed description of agent capabilities */
  description: z2.string().max(500).optional(),
  /** List of ability identifiers */
  abilities: z2.array(z2.string()).default([]),
  /** Smart ability selection configuration */
  abilitySelection: AbilitySelectionSchema.optional(),
  /** Agent personality configuration */
  personality: PersonalitySchema.optional(),
  /** Orchestration settings */
  orchestration: OrchestrationSchema.default({}),
  /** System prompt that defines agent behavior */
  systemPrompt: z2.string().min(10).max(5e4),
  /** Whether agent is enabled */
  enabled: z2.boolean().default(true),
  /** Agent version for tracking changes */
  version: z2.string().default("1.0.0"),
  /** Custom metadata */
  metadata: z2.record(z2.string(), z2.unknown()).optional()
});
var ExecutionContextSchema = z2.object({
  /** The task to execute */
  task: z2.string().min(1),
  /** Session ID if part of a multi-agent session */
  sessionId: z2.string().uuid().optional(),
  /** Parent agent ID if delegated */
  parentAgentId: z2.string().optional(),
  /** Delegation chain for tracking depth */
  delegationChain: z2.array(z2.string()).default([]),
  /** Relevant memory entries */
  memoryContext: z2.array(z2.unknown()).default([]),
  /** Additional context data */
  context: z2.record(z2.string(), z2.unknown()).default({}),
  /** Timeout in milliseconds */
  timeout: z2.number().int().positive().default(3e5),
  /** Whether to stream output */
  stream: z2.boolean().default(false)
});
var AgentResponseSchema = z2.object({
  /** Whether execution was successful */
  success: z2.boolean(),
  /** Agent output/response */
  output: z2.string(),
  /** Agent ID that produced this response */
  agentId: z2.string(),
  /** Execution duration in milliseconds */
  duration: z2.number().int().nonnegative(),
  /** Provider used for execution */
  provider: z2.string().optional(),
  /** Token usage if available */
  tokens: TokenUsage.optional(),
  /** Delegation requests made by agent */
  delegations: z2.array(z2.object({
    toAgent: z2.string(),
    task: z2.string(),
    status: z2.enum(["pending", "completed", "failed"])
  })).default([]),
  /** Error information if failed */
  error: z2.object({
    code: z2.string(),
    message: z2.string(),
    details: z2.unknown().optional()
  }).optional(),
  /** Metadata about execution */
  metadata: z2.record(z2.string(), z2.unknown()).optional()
});
var AgentRegistrationSchema = z2.object({
  /** Agent profile */
  profile: AgentProfileSchema,
  /** Registration timestamp */
  registeredAt: z2.date(),
  /** Last updated timestamp */
  updatedAt: z2.date(),
  /** Source file path */
  sourcePath: z2.string().optional(),
  /** Health score (0-1) based on recent executions */
  healthScore: NormalizedScore.default(1),
  /** Total executions */
  executionCount: z2.number().int().nonnegative().default(0),
  /** Successful executions */
  successCount: z2.number().int().nonnegative().default(0)
});
function validateAgentProfile(data) {
  return AgentProfileSchema.parse(data);
}
function safeValidateAgentProfile(data) {
  return AgentProfileSchema.safeParse(data);
}
var PartialAgentProfileSchema = AgentProfileSchema.partial().extend({
  name: AgentId
  // Name is required for identification
});

// src/provider.ts
import { z as z3 } from "zod";
var CircuitBreakerConfigSchema = z3.object({
  /** Whether circuit breaker is enabled */
  enabled: z3.boolean().default(true),
  /** Number of failures before opening circuit */
  failureThreshold: z3.number().int().min(1).max(10).default(3),
  /** Time to wait before attempting recovery (ms) */
  recoveryTimeout: DurationMs.default(6e4),
  /** Time window for counting failures (ms) */
  failureWindow: DurationMs.default(3e5)
});
var HealthCheckConfigSchema = z3.object({
  /** Whether health checks are enabled */
  enabled: z3.boolean().default(true),
  /** Interval between health checks (ms) */
  interval: DurationMs.default(6e4),
  /** Timeout for health check (ms) */
  timeout: DurationMs.default(5e3),
  /** Number of retries before marking unhealthy */
  retries: z3.number().int().min(0).max(5).default(2)
});
var ProviderConfigSchema = z3.object({
  /** Provider type identifier */
  type: ProviderType,
  /** Whether this provider is enabled */
  enabled: z3.boolean().default(true),
  /** Priority for routing (lower = higher priority) */
  priority: z3.number().int().min(1).max(100).default(10),
  /** Integration mode (mcp, sdk, bash) */
  integrationMode: IntegrationMode,
  /** Default timeout for requests (ms) */
  timeout: DurationMs.default(3e5),
  /** Maximum concurrent requests */
  maxConcurrency: z3.number().int().min(1).max(100).default(4),
  /** Circuit breaker configuration */
  circuitBreaker: CircuitBreakerConfigSchema.default({}),
  /** Health check configuration */
  healthCheck: HealthCheckConfigSchema.default({}),
  /** Command to execute (for bash mode) */
  command: z3.string().optional(),
  /** Arguments for command */
  args: z3.array(z3.string()).default([]),
  /** Environment variables */
  env: z3.record(z3.string(), z3.string()).optional(),
  /** Custom metadata */
  metadata: z3.record(z3.string(), z3.unknown()).optional()
});
var ProviderHealthSchema = z3.object({
  /** Whether provider is healthy */
  healthy: z3.boolean(),
  /** Last health check timestamp */
  lastCheck: z3.date(),
  /** Number of consecutive failures */
  consecutiveFailures: z3.number().int().nonnegative(),
  /** Average latency in milliseconds */
  latencyMs: DurationMs,
  /** Success rate (0-1) */
  successRate: NormalizedScore,
  /** Circuit breaker state */
  circuitState: z3.enum(["closed", "open", "half-open"]).default("closed"),
  /** Error message if unhealthy */
  errorMessage: z3.string().optional()
});
var ExecutionRequestSchema = z3.object({
  /** Task description/prompt */
  task: z3.string().min(1),
  /** Optional agent identifier */
  agent: z3.string().optional(),
  /** Additional context for execution */
  context: z3.record(z3.string(), z3.unknown()).optional(),
  /** Timeout in milliseconds */
  timeout: DurationMs.default(3e5),
  /** Whether to stream output */
  stream: z3.boolean().default(false),
  /** Session ID for context continuity */
  sessionId: z3.string().uuid().optional(),
  /** Request priority */
  priority: z3.enum(["low", "normal", "high"]).default("normal")
});
var ExecutionMetadataSchema = z3.object({
  /** Provider that handled the request */
  provider: ProviderType,
  /** Integration mode used */
  integrationMode: IntegrationMode,
  /** Execution duration in milliseconds */
  duration: DurationMs,
  /** Token usage if available */
  tokens: TokenUsage.optional(),
  /** Request ID for tracing */
  requestId: z3.string().uuid().optional(),
  /** Model used if applicable */
  model: z3.string().optional()
});
var ExecutionResponseSchema = z3.object({
  /** Whether execution was successful */
  success: z3.boolean(),
  /** Output from execution */
  output: z3.string(),
  /** Execution metadata */
  metadata: ExecutionMetadataSchema,
  /** Error message if failed */
  error: z3.string().optional(),
  /** Detailed error info */
  errorDetails: z3.object({
    code: z3.string(),
    message: z3.string(),
    retryable: z3.boolean().default(false),
    details: z3.unknown().optional()
  }).optional()
});
var ProviderRegistrationSchema = z3.object({
  /** Provider configuration */
  config: ProviderConfigSchema,
  /** Current health status */
  health: ProviderHealthSchema,
  /** Registration timestamp */
  registeredAt: z3.date(),
  /** Total requests handled */
  requestCount: z3.number().int().nonnegative().default(0),
  /** Successful requests */
  successCount: z3.number().int().nonnegative().default(0),
  /** Total tokens used */
  totalTokens: z3.number().int().nonnegative().default(0)
});
var RoutingContextSchema = z3.object({
  /** Type of task being routed */
  taskType: z3.string().default("general"),
  /** Estimated complexity (1-10) */
  complexity: z3.number().int().min(1).max(10).default(5),
  /** Prefer MCP providers */
  preferMcp: z3.boolean().default(true),
  /** Required capabilities */
  requiredCapabilities: z3.array(z3.string()).default([]),
  /** Excluded providers */
  excludeProviders: z3.array(ProviderType).default([]),
  /** Force specific provider */
  forceProvider: ProviderType.optional()
});
var RoutingDecisionSchema = z3.object({
  /** Selected provider */
  provider: ProviderType,
  /** Score that led to selection */
  score: z3.number(),
  /** Reason for selection */
  reason: z3.string(),
  /** Alternative providers considered */
  alternatives: z3.array(z3.object({
    provider: ProviderType,
    score: z3.number(),
    reason: z3.string()
  })).default([])
});
function validateExecutionRequest(data) {
  return ExecutionRequestSchema.parse(data);
}
function validateProviderConfig(data) {
  return ProviderConfigSchema.parse(data);
}
var DEFAULT_HEALTH_VALUES = {
  healthy: true,
  consecutiveFailures: 0,
  latencyMs: 0,
  successRate: 1,
  circuitState: "closed"
};
function createDefaultHealth() {
  return {
    ...DEFAULT_HEALTH_VALUES,
    lastCheck: /* @__PURE__ */ new Date()
  };
}

// src/memory.ts
import { z as z4 } from "zod";
var MemoryMetadataSchema = z4.object({
  /** Type of memory content */
  type: MemoryType,
  /** Source of the memory (agent, user, system) */
  source: z4.string().min(1).max(100),
  /** Agent ID that created this memory */
  agentId: z4.string().optional(),
  /** Session ID if part of a session */
  sessionId: z4.string().uuid().optional(),
  /** Tags for categorization */
  tags: z4.array(z4.string().max(50)).max(20).default([]),
  /** Importance score (0-1) */
  importance: NormalizedScore.optional(),
  /** File path if memory relates to a file */
  filePath: z4.string().optional(),
  /** Language if code-related */
  language: z4.string().optional(),
  /** Custom metadata */
  custom: z4.record(z4.string(), z4.unknown()).optional()
});
var MemoryEntrySchema = z4.object({
  /** Unique identifier */
  id: MemoryId,
  /** Memory content */
  content: z4.string().min(1).max(1e5),
  /** Associated metadata */
  metadata: MemoryMetadataSchema,
  /** Creation timestamp */
  createdAt: z4.date(),
  /** Last accessed timestamp */
  lastAccessedAt: z4.date().optional(),
  /** Number of times accessed */
  accessCount: z4.number().int().nonnegative().default(0),
  /** Relevance score from last search */
  score: z4.number().optional()
});
var MemoryFilterSchema = z4.object({
  /** Filter by memory type */
  type: MemoryType.optional(),
  /** Filter by agent ID */
  agentId: z4.string().optional(),
  /** Filter by session ID */
  sessionId: z4.string().uuid().optional(),
  /** Filter by tags (any match) */
  tags: z4.array(z4.string()).optional(),
  /** Filter by tags (all must match) */
  tagsAll: z4.array(z4.string()).optional(),
  /** Filter by minimum importance */
  minImportance: NormalizedScore.optional(),
  /** Filter by source */
  source: z4.string().optional(),
  /** Filter by date range - after */
  createdAfter: z4.date().optional(),
  /** Filter by date range - before */
  createdBefore: z4.date().optional(),
  /** Filter by minimum access count */
  minAccessCount: z4.number().int().nonnegative().optional()
});
var MemorySearchOptionsSchema = z4.object({
  /** Search query string */
  query: z4.string().min(1).max(1e3),
  /** Maximum results to return */
  limit: z4.number().int().min(1).max(100).default(10),
  /** Offset for pagination */
  offset: z4.number().int().nonnegative().default(0),
  /** Filter options */
  filter: MemoryFilterSchema.optional(),
  /** Sort by field */
  sortBy: z4.enum(["relevance", "created", "accessed", "importance"]).default("relevance"),
  /** Sort direction */
  sortDirection: z4.enum(["asc", "desc"]).default("desc"),
  /** Include content in results */
  includeContent: z4.boolean().default(true),
  /** Highlight matches in content */
  highlight: z4.boolean().default(false)
});
var MemorySearchResultSchema = z4.object({
  /** Matching entries */
  entries: z4.array(MemoryEntrySchema),
  /** Total count (before pagination) */
  total: z4.number().int().nonnegative(),
  /** Search duration in milliseconds */
  duration: DurationMs,
  /** Query that was executed */
  query: z4.string(),
  /** Whether more results exist */
  hasMore: z4.boolean()
});
var MemoryAddInputSchema = z4.object({
  /** Content to store */
  content: z4.string().min(1).max(1e5),
  /** Metadata for the entry */
  metadata: MemoryMetadataSchema
});
var MemoryUpdateInputSchema = z4.object({
  /** Entry ID to update */
  id: MemoryId,
  /** New content (optional) */
  content: z4.string().min(1).max(1e5).optional(),
  /** Updated metadata (merged with existing) */
  metadata: MemoryMetadataSchema.partial().optional()
});
var MemoryBulkAddInputSchema = z4.object({
  /** Entries to add */
  entries: z4.array(MemoryAddInputSchema).min(1).max(100)
});
var CleanupStrategy = z4.enum(["oldest", "least_accessed", "hybrid", "low_importance"]);
var MemoryCleanupConfigSchema = z4.object({
  /** Whether automatic cleanup is enabled */
  enabled: z4.boolean().default(true),
  /** Strategy for selecting entries to delete */
  strategy: CleanupStrategy.default("hybrid"),
  /** Trigger cleanup when reaching this percentage of max entries */
  triggerThreshold: z4.number().min(0.5).max(1).default(0.9),
  /** Target percentage after cleanup */
  targetThreshold: z4.number().min(0.3).max(0.9).default(0.7),
  /** Minimum entries to delete per cleanup */
  minCleanupCount: z4.number().int().min(1).default(10),
  /** Maximum entries to delete per cleanup */
  maxCleanupCount: z4.number().int().min(10).default(1e3),
  /** Retention period in days */
  retentionDays: z4.number().int().min(1).default(30),
  /** Entries to always preserve (by tag) */
  preserveTags: z4.array(z4.string()).default(["important", "pinned"])
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
var MemoryCleanupResultSchema = z4.object({
  /** Number of entries deleted */
  deletedCount: z4.number().int().nonnegative(),
  /** Strategy used */
  strategy: CleanupStrategy,
  /** Duration in milliseconds */
  duration: DurationMs,
  /** Entries before cleanup */
  entriesBefore: z4.number().int().nonnegative(),
  /** Entries after cleanup */
  entriesAfter: z4.number().int().nonnegative()
});
var MemoryStatsSchema = z4.object({
  /** Total number of entries */
  totalEntries: z4.number().int().nonnegative(),
  /** Entries by type */
  entriesByType: z4.record(MemoryType, z4.number().int().nonnegative()),
  /** Database size in bytes */
  databaseSizeBytes: z4.number().int().nonnegative(),
  /** Oldest entry date */
  oldestEntry: z4.date().optional(),
  /** Newest entry date */
  newestEntry: z4.date().optional(),
  /** Average content length */
  avgContentLength: z4.number().nonnegative(),
  /** Total access count */
  totalAccessCount: z4.number().int().nonnegative(),
  /** Top tags */
  topTags: z4.array(z4.object({
    tag: z4.string(),
    count: z4.number().int().nonnegative()
  })).max(20)
});
var ExportFormat = z4.enum(["json", "jsonl", "csv"]);
var MemoryExportOptionsSchema = z4.object({
  /** Export format */
  format: ExportFormat.default("json"),
  /** Filter to apply */
  filter: MemoryFilterSchema.optional(),
  /** Include metadata */
  includeMetadata: z4.boolean().default(true),
  /** Compress output */
  compress: z4.boolean().default(false)
});
var MemoryImportOptionsSchema = z4.object({
  /** How to handle duplicates */
  duplicateHandling: z4.enum(["skip", "replace", "merge"]).default("skip"),
  /** Validate entries before import */
  validate: z4.boolean().default(true),
  /** Batch size for import */
  batchSize: z4.number().int().min(1).max(1e3).default(100)
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

// src/config.ts
import { z as z5 } from "zod";

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
var DIR_AGENTS = "agents";
var DIR_SESSIONS = "sessions";
var DIR_MEMORY = "memory";
var DIR_CHECKPOINTS = "checkpoints";
var DIR_TRACES = "traces";
var DIR_LOGS = "logs";
var DIR_WORKSPACE_PRD = "automatosx/PRD";
var DIR_WORKSPACE_TMP = "automatosx/tmp";
var FILE_MEMORY_DB = "memories.db";
var FILE_CONFIG = "ax.config.json";
var PATH_MEMORY_DB = `${DIR_AUTOMATOSX}/${DIR_MEMORY}/${FILE_MEMORY_DB}`;
var PATH_SESSIONS = `${DIR_AUTOMATOSX}/${DIR_SESSIONS}`;
var PATH_CHECKPOINTS = `${DIR_AUTOMATOSX}/${DIR_CHECKPOINTS}`;
var PATH_TRACES = `${DIR_AUTOMATOSX}/${DIR_TRACES}`;
var PATH_LOGS = `${DIR_AUTOMATOSX}/${DIR_LOGS}`;
var DISPLAY_ID_LENGTH = 8;
var DISPLAY_PREVIEW_SHORT = 40;
var DISPLAY_PREVIEW_MEDIUM = 100;
var DISPLAY_PREVIEW_LONG = 200;
var DISPLAY_PREVIEW_XLARGE = 300;
var DISPLAY_NAME_LENGTH = 20;
var DISPLAY_ROLE_LENGTH = 30;
var DISPLAY_TASK_LENGTH = 50;
var LIST_PREVIEW_LIMIT = 10;
var LIST_SEARCH_LIMIT = 10;
var LIST_TOP_TAGS = 5;
var TIMEOUT_EXECUTION = 5 * MS_PER_MINUTE;
var TIMEOUT_HEALTH_CHECK = MS_PER_MINUTE;
var TIMEOUT_HEALTH_CHECK_REQUEST = 5 * MS_PER_SECOND;
var TIMEOUT_SESSION = MS_PER_HOUR;
var TIMEOUT_RETRY_INITIAL = MS_PER_SECOND;
var TIMEOUT_RETRY_MAX = 30 * MS_PER_SECOND;
var TIMEOUT_CIRCUIT_RECOVERY = MS_PER_MINUTE;
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
var LIMIT_DEFAULT_PROVIDER_PRIORITY = 99;
var DB_CACHE_SIZE_KB = 8192;
var DB_REQUEST_HISTORY_SIZE = 100;
var DB_DEFAULT_SUCCESS_RATE = 1;
var CLEANUP_AGE_WEIGHT = 0.4;
var CLEANUP_ACCESS_WEIGHT = 0.3;
var CLEANUP_IMPORTANCE_WEIGHT = 0.3;
var DEFAULT_MEMORY_TYPE = "document";
var DEFAULT_MEMORY_SOURCE = "unknown";
var DEFAULT_MEMORY_IMPORTANCE = 0.5;
var CIRCUIT_CLOSED = "closed";
var CIRCUIT_OPEN = "open";
var CIRCUIT_HALF_OPEN = "half-open";

// src/config.ts
var ProvidersConfigSchema = z5.object({
  /** Default provider to use */
  default: ProviderType.default("claude"),
  /** Enabled providers */
  enabled: z5.array(ProviderType).default(["claude"]),
  /** Fallback order when default fails */
  fallbackOrder: z5.array(ProviderType).optional()
});
var RetryConfigSchema = z5.object({
  /** Maximum retry attempts */
  maxAttempts: z5.number().int().min(0).max(10).default(LIMIT_RETRY_ATTEMPTS),
  /** Initial delay between retries (ms) */
  initialDelay: DurationMs.default(TIMEOUT_RETRY_INITIAL),
  /** Maximum delay between retries (ms) */
  maxDelay: DurationMs.default(TIMEOUT_RETRY_MAX),
  /** Backoff multiplier */
  backoffFactor: z5.number().min(1).max(5).default(2),
  /** Jitter factor (0-1) to add randomness */
  jitterFactor: z5.number().min(0).max(1).default(0.1)
}).refine(
  (data) => data.maxDelay >= data.initialDelay,
  {
    message: "maxDelay must be greater than or equal to initialDelay",
    path: ["maxDelay"]
  }
);
var ExecutionConfigSchema = z5.object({
  /** Default timeout for agent execution (ms), 1ms to 1 hour */
  timeout: z5.number().int().min(1).max(36e5).default(TIMEOUT_EXECUTION),
  /** Maximum concurrent agent executions */
  concurrency: z5.number().int().min(1).max(16).default(LIMIT_CONCURRENCY),
  /** Retry configuration */
  retry: RetryConfigSchema.default({}),
  /** Enable execution tracing */
  tracing: z5.boolean().default(false),
  /** Trace output directory */
  traceDir: z5.string().default(PATH_TRACES)
});
var MemoryConfigSchema = z5.object({
  /** Whether memory system is enabled */
  enabled: z5.boolean().default(true),
  /** Maximum number of entries */
  maxEntries: z5.number().int().min(100).max(1e6).default(LIMIT_MEMORY_ENTRIES),
  /** Database path */
  databasePath: z5.string().default(PATH_MEMORY_DB),
  /** Retention period in days */
  retentionDays: z5.number().int().min(1).max(365).default(LIMIT_RETENTION_DAYS),
  /** Cleanup strategy */
  cleanupStrategy: CleanupStrategy.default("hybrid"),
  /** Auto cleanup enabled */
  autoCleanup: z5.boolean().default(true),
  /** Search result limit */
  searchLimit: z5.number().int().min(1).max(100).default(LIST_SEARCH_LIMIT)
});
var SessionConfigSchema = z5.object({
  /** Maximum active sessions */
  maxSessions: z5.number().int().min(1).max(1e3).default(LIMIT_MAX_SESSIONS),
  /** Session timeout (ms) */
  timeout: DurationMs.default(TIMEOUT_SESSION),
  /** Session data directory */
  dataDir: z5.string().default(PATH_SESSIONS),
  /** Auto-save interval (ms) */
  autoSaveInterval: DurationMs.default(TIMEOUT_AUTO_SAVE),
  /** Debounce time for saves (ms) */
  saveDebounce: DurationMs.default(TIMEOUT_SAVE_DEBOUNCE)
});
var CheckpointConfigSchema = z5.object({
  /** Whether checkpoints are enabled */
  enabled: z5.boolean().default(true),
  /** Checkpoint storage directory */
  storageDir: z5.string().default(PATH_CHECKPOINTS),
  /** Auto-save checkpoints */
  autoSave: z5.boolean().default(true),
  /** Checkpoint retention in days */
  retentionDays: z5.number().int().min(1).max(90).default(LIMIT_CHECKPOINT_RETENTION_DAYS),
  /** Maximum checkpoints per session */
  maxPerSession: z5.number().int().min(1).max(100).default(LIMIT_CHECKPOINTS_PER_SESSION)
});
var RouterConfigSchema = z5.object({
  /** Health check interval (ms) */
  healthCheckInterval: DurationMs.default(TIMEOUT_HEALTH_CHECK),
  /** Circuit breaker failure threshold */
  circuitBreakerThreshold: z5.number().int().min(1).max(10).default(LIMIT_CIRCUIT_BREAKER_THRESHOLD),
  /** Provider cooldown after failure (ms) */
  cooldownMs: DurationMs.default(TIMEOUT_PROVIDER_COOLDOWN),
  /** Enable workload-aware routing */
  workloadAwareRouting: z5.boolean().default(true),
  /** Prefer MCP providers */
  preferMcp: z5.boolean().default(true)
});
var WorkspaceConfigSchema = z5.object({
  /** PRD documents path */
  prdPath: z5.string().default(DIR_WORKSPACE_PRD),
  /** Temporary files path */
  tmpPath: z5.string().default(DIR_WORKSPACE_TMP),
  /** Auto-cleanup temporary files */
  autoCleanupTmp: z5.boolean().default(true),
  /** Temporary file retention in days */
  tmpRetentionDays: z5.number().int().min(1).max(30).default(LIMIT_TMP_RETENTION_DAYS)
});
var LoggingConfigSchema = z5.object({
  /** Log level */
  level: z5.enum(["debug", "info", "warn", "error"]).default("info"),
  /** Log directory */
  dir: z5.string().default(PATH_LOGS),
  /** Enable file logging */
  fileEnabled: z5.boolean().default(true),
  /** Enable console logging */
  consoleEnabled: z5.boolean().default(true),
  /** Maximum log file size in bytes */
  maxFileSize: z5.number().int().positive().default(LIMIT_MAX_LOG_SIZE),
  /** Maximum log files to keep */
  maxFiles: z5.number().int().min(1).max(100).default(LIMIT_MAX_LOG_FILES),
  /** Enable structured JSON logs */
  jsonFormat: z5.boolean().default(false)
});
var ConfigSchema = z5.object({
  /** Configuration schema version */
  $schema: z5.string().optional(),
  /** Configuration version */
  version: z5.string().default(VERSION),
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
var MinimalConfigSchema = z5.object({
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

// src/session.ts
import { z as z6 } from "zod";
var SessionTaskSchema = z6.object({
  /** Unique task identifier */
  id: z6.string().uuid(),
  /** Task description */
  description: z6.string().min(1),
  /** Agent assigned to this task */
  agentId: z6.string(),
  /** Current status */
  status: TaskStatus,
  /** Task result/output */
  result: z6.string().optional(),
  /** Error if failed */
  error: z6.string().optional(),
  /** Start timestamp */
  startedAt: z6.date().optional(),
  /** Completion timestamp */
  completedAt: z6.date().optional(),
  /** Duration in milliseconds */
  duration: DurationMs.optional(),
  /** Parent task ID (for subtasks) */
  parentTaskId: z6.string().uuid().optional(),
  /** Delegated from agent */
  delegatedFrom: z6.string().optional(),
  /** Task metadata */
  metadata: z6.record(z6.string(), z6.unknown()).optional()
});
var SessionState = z6.enum(["active", "paused", "completed", "failed", "cancelled"]);
var SessionSchema = z6.object({
  /** Unique session identifier */
  id: SessionId,
  /** Session name/title */
  name: z6.string().min(1).max(200),
  /** Session description */
  description: z6.string().max(1e3).optional(),
  /** Current state */
  state: SessionState.default("active"),
  /** Agents participating in this session */
  agents: z6.array(z6.string()).min(1),
  /** Tasks in this session */
  tasks: z6.array(SessionTaskSchema).default([]),
  /** Creation timestamp */
  createdAt: z6.date(),
  /** Last update timestamp */
  updatedAt: z6.date(),
  /** Completion timestamp */
  completedAt: z6.date().optional(),
  /** Total duration in milliseconds */
  duration: DurationMs.optional(),
  /** Session goal/objective */
  goal: z6.string().optional(),
  /** Session tags */
  tags: z6.array(z6.string()).default([]),
  /** Session metadata */
  metadata: z6.record(z6.string(), z6.unknown()).optional()
});
var CheckpointSchema = z6.object({
  /** Unique checkpoint identifier */
  id: CheckpointId,
  /** Session ID this checkpoint belongs to */
  sessionId: SessionId,
  /** Checkpoint name */
  name: z6.string().default("auto"),
  /** Checkpoint creation timestamp */
  createdAt: z6.date(),
  /** Session state at checkpoint */
  sessionState: SessionSchema,
  /** Current task index */
  currentTaskIndex: z6.number().int().nonnegative(),
  /** Completed task IDs */
  completedTaskIds: z6.array(z6.string().uuid()).default([]),
  /** Execution context snapshot */
  contextSnapshot: z6.record(z6.string(), z6.unknown()).optional(),
  /** Memory entries created since session start */
  memoryEntryIds: z6.array(z6.number().int().positive()).default([]),
  /** Is this an auto-save checkpoint */
  isAutoSave: z6.boolean().default(true),
  /** Checkpoint metadata */
  metadata: z6.record(z6.string(), z6.unknown()).optional()
});
var CreateSessionInputSchema = z6.object({
  /** Session name (optional, defaults to 'Untitled Session') */
  name: z6.string().min(1).max(200).optional(),
  /** Session description */
  description: z6.string().max(1e3).optional(),
  /** Initial agents */
  agents: z6.array(z6.string()).min(1),
  /** Session goal */
  goal: z6.string().optional(),
  /** Initial tasks */
  tasks: z6.array(z6.object({
    description: z6.string().min(1),
    agentId: z6.string()
  })).optional(),
  /** Session tags */
  tags: z6.array(z6.string()).optional(),
  /** Session metadata */
  metadata: z6.record(z6.string(), z6.unknown()).optional()
});
var AddTaskInputSchema = z6.object({
  /** Session ID */
  sessionId: SessionId,
  /** Task description */
  description: z6.string().min(1),
  /** Agent to assign */
  agentId: z6.string(),
  /** Parent task ID */
  parentTaskId: z6.string().uuid().optional(),
  /** Task metadata */
  metadata: z6.record(z6.string(), z6.unknown()).optional()
});
var UpdateTaskInputSchema = z6.object({
  /** Session ID */
  sessionId: SessionId,
  /** Task ID */
  taskId: z6.string().uuid(),
  /** New status */
  status: TaskStatus,
  /** Result if completed */
  result: z6.string().optional(),
  /** Error if failed */
  error: z6.string().optional()
});
var SessionSummarySchema = z6.object({
  /** Session ID */
  id: SessionId,
  /** Session name */
  name: z6.string(),
  /** Current state */
  state: SessionState,
  /** Number of agents */
  agentCount: z6.number().int().nonnegative(),
  /** Total tasks */
  totalTasks: z6.number().int().nonnegative(),
  /** Completed tasks */
  completedTasks: z6.number().int().nonnegative(),
  /** Failed tasks */
  failedTasks: z6.number().int().nonnegative(),
  /** Creation timestamp */
  createdAt: z6.date(),
  /** Last update timestamp */
  updatedAt: z6.date(),
  /** Duration so far */
  duration: DurationMs.optional()
});
function createSessionSummary(session) {
  return {
    id: session.id,
    name: session.name,
    state: session.state,
    agentCount: session.agents.length,
    totalTasks: session.tasks.length,
    completedTasks: session.tasks.filter((t) => t.status === "completed").length,
    failedTasks: session.tasks.filter((t) => t.status === "failed").length,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    duration: session.duration
  };
}
var DelegationRequestSchema = z6.object({
  /** Source agent */
  fromAgent: z6.string(),
  /** Target agent */
  toAgent: z6.string(),
  /** Task to delegate */
  task: z6.string().min(1),
  /** Delegation context */
  context: z6.object({
    /** Shared data between agents */
    sharedData: z6.record(z6.string(), z6.unknown()).optional(),
    /** Requirements for the delegated task */
    requirements: z6.array(z6.string()).optional(),
    /** Expected outputs */
    expectedOutputs: z6.array(z6.string()).optional(),
    /** Session ID */
    sessionId: SessionId.optional(),
    /** Delegation chain for tracking depth */
    delegationChain: z6.array(z6.string()).default([])
  }).default({}),
  /** Delegation options */
  options: z6.object({
    /** Timeout for delegated task */
    timeout: DurationMs.optional(),
    /** Priority level */
    priority: z6.enum(["low", "normal", "high"]).default("normal"),
    /** Whether to wait for result */
    waitForResult: z6.boolean().default(true)
  }).default({})
});
var DelegationResultSchema = z6.object({
  /** Whether delegation was successful */
  success: z6.boolean(),
  /** Delegation request */
  request: DelegationRequestSchema,
  /** Result from delegated agent */
  result: z6.string().optional(),
  /** Error if failed */
  error: z6.string().optional(),
  /** Execution duration */
  duration: DurationMs,
  /** Agent that completed the task */
  completedBy: z6.string()
});
function validateSession(data) {
  return SessionSchema.parse(data);
}
function validateCheckpoint(data) {
  return CheckpointSchema.parse(data);
}
function validateCreateSessionInput(data) {
  return CreateSessionInputSchema.parse(data);
}

// src/format.ts
function formatBytes(bytes) {
  if (bytes < BYTES_PER_KB) return `${bytes} B`;
  if (bytes < BYTES_PER_MB) return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;
  if (bytes < BYTES_PER_GB) return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
  return `${(bytes / BYTES_PER_GB).toFixed(2)} GB`;
}
function formatDuration(ms) {
  if (ms < MS_PER_SECOND) return `${ms}ms`;
  if (ms < MS_PER_MINUTE) return `${(ms / MS_PER_SECOND).toFixed(1)}s`;
  if (ms < MS_PER_HOUR) return `${Math.floor(ms / MS_PER_MINUTE)}m`;
  return `${Math.floor(ms / MS_PER_HOUR)}h`;
}
function formatDurationLong(ms) {
  if (ms < MS_PER_SECOND) return `${ms}ms`;
  if (ms < MS_PER_MINUTE) return `${(ms / MS_PER_SECOND).toFixed(1)}s`;
  if (ms < MS_PER_HOUR) return `${Math.floor(ms / MS_PER_MINUTE)}m ${Math.floor(ms % MS_PER_MINUTE / MS_PER_SECOND)}s`;
  if (ms < MS_PER_DAY) return `${Math.floor(ms / MS_PER_HOUR)}h ${Math.floor(ms % MS_PER_HOUR / MS_PER_MINUTE)}m`;
  if (ms < MS_PER_WEEK) return `${Math.floor(ms / MS_PER_DAY)}d ${Math.floor(ms % MS_PER_DAY / MS_PER_HOUR)}h`;
  return `${Math.floor(ms / MS_PER_WEEK)}w ${Math.floor(ms % MS_PER_WEEK / MS_PER_DAY)}d`;
}
function formatRelativeTime(date) {
  const now = Date.now();
  const diffMs = now - date.getTime();
  if (diffMs < 0) {
    return "in the future";
  }
  if (diffMs < MS_PER_MINUTE) {
    return "just now";
  }
  if (diffMs < MS_PER_HOUR) {
    const mins = Math.floor(diffMs / MS_PER_MINUTE);
    return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  }
  if (diffMs < MS_PER_DAY) {
    const hours = Math.floor(diffMs / MS_PER_HOUR);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  if (diffMs < MS_PER_WEEK) {
    const days = Math.floor(diffMs / MS_PER_DAY);
    if (days === 1) return "yesterday";
    return `${days} days ago`;
  }
  const weeks = Math.floor(diffMs / MS_PER_WEEK);
  if (weeks === 1) return "last week";
  if (weeks < 4) return `${weeks} weeks ago`;
  return date.toLocaleDateString();
}
function truncate(str, maxLength) {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}
function truncateId(id, length = 8) {
  return id.slice(0, length);
}
export {
  AbilitySelectionSchema,
  AddTaskInputSchema,
  AgentId,
  AgentProfileSchema,
  AgentRegistrationSchema,
  AgentResponseSchema,
  BYTES_PER_GB,
  BYTES_PER_KB,
  BYTES_PER_MB,
  CIRCUIT_CLOSED,
  CIRCUIT_HALF_OPEN,
  CIRCUIT_OPEN,
  CLEANUP_ACCESS_WEIGHT,
  CLEANUP_AGE_WEIGHT,
  CLEANUP_IMPORTANCE_WEIGHT,
  CheckpointConfigSchema,
  CheckpointId,
  CheckpointSchema,
  CircuitBreakerConfigSchema,
  CleanupStrategy,
  CommunicationStyle,
  ConfigSchema,
  CreateSessionInputSchema,
  DB_CACHE_SIZE_KB,
  DB_DEFAULT_SUCCESS_RATE,
  DB_REQUEST_HISTORY_SIZE,
  DEFAULT_CONFIG,
  DEFAULT_HEALTH_VALUES,
  DEFAULT_MEMORY_IMPORTANCE,
  DEFAULT_MEMORY_SOURCE,
  DEFAULT_MEMORY_TYPE,
  DIR_AGENTS,
  DIR_AUTOMATOSX,
  DIR_CHECKPOINTS,
  DIR_LOGS,
  DIR_MEMORY,
  DIR_SESSIONS,
  DIR_TRACES,
  DIR_WORKSPACE_PRD,
  DIR_WORKSPACE_TMP,
  DISPLAY_ID_LENGTH,
  DISPLAY_NAME_LENGTH,
  DISPLAY_PREVIEW_LONG,
  DISPLAY_PREVIEW_MEDIUM,
  DISPLAY_PREVIEW_SHORT,
  DISPLAY_PREVIEW_XLARGE,
  DISPLAY_ROLE_LENGTH,
  DISPLAY_TASK_LENGTH,
  DecisionMaking,
  DelegationRequestSchema,
  DelegationResultSchema,
  DurationMs,
  ErrorInfo,
  ExecutionConfigSchema,
  ExecutionContextSchema,
  ExecutionMetadataSchema,
  ExecutionRequestSchema,
  ExecutionResponseSchema,
  ExportFormat,
  FILE_CONFIG,
  FILE_MEMORY_DB,
  HealthCheckConfigSchema,
  ISODateString,
  IntegrationMode,
  LIMIT_CHECKPOINTS_PER_SESSION,
  LIMIT_CHECKPOINT_RETENTION_DAYS,
  LIMIT_CIRCUIT_BREAKER_THRESHOLD,
  LIMIT_CONCURRENCY,
  LIMIT_DEFAULT_PROVIDER_PRIORITY,
  LIMIT_MAX_LOG_FILES,
  LIMIT_MAX_LOG_SIZE,
  LIMIT_MAX_SESSIONS,
  LIMIT_MEMORY_ENTRIES,
  LIMIT_RETENTION_DAYS,
  LIMIT_RETRY_ATTEMPTS,
  LIMIT_TMP_RETENTION_DAYS,
  LIST_PREVIEW_LIMIT,
  LIST_SEARCH_LIMIT,
  LIST_TOP_TAGS,
  LogLevel,
  LoggingConfigSchema,
  MS_PER_DAY,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  MS_PER_SECOND,
  MS_PER_WEEK,
  MemoryAddInputSchema,
  MemoryBulkAddInputSchema,
  MemoryCleanupConfigSchema,
  MemoryCleanupResultSchema,
  MemoryConfigSchema,
  MemoryEntrySchema,
  MemoryExportOptionsSchema,
  MemoryFilterSchema,
  MemoryId,
  MemoryImportOptionsSchema,
  MemoryMetadataSchema,
  MemorySearchOptionsSchema,
  MemorySearchResultSchema,
  MemoryStatsSchema,
  MemoryType,
  MemoryUpdateInputSchema,
  Metadata,
  MinimalConfigSchema,
  NonEmptyStringArray,
  NormalizedScore,
  OrchestrationSchema,
  PATH_CHECKPOINTS,
  PATH_LOGS,
  PATH_MEMORY_DB,
  PATH_SESSIONS,
  PATH_TRACES,
  PartialAgentProfileSchema,
  Percentage,
  PersonalitySchema,
  ProviderConfigSchema,
  ProviderHealthSchema,
  ProviderRegistrationSchema,
  ProviderType,
  ProvidersConfigSchema,
  Result,
  RetryConfigSchema,
  RouterConfigSchema,
  RoutingContextSchema,
  RoutingDecisionSchema,
  SessionConfigSchema,
  SessionId,
  SessionSchema,
  SessionState,
  SessionSummarySchema,
  SessionTaskSchema,
  TIMEOUT_AUTO_SAVE,
  TIMEOUT_CIRCUIT_FAILURE_WINDOW,
  TIMEOUT_CIRCUIT_RECOVERY,
  TIMEOUT_EXECUTION,
  TIMEOUT_HEALTH_CHECK,
  TIMEOUT_HEALTH_CHECK_REQUEST,
  TIMEOUT_PROVIDER_COOLDOWN,
  TIMEOUT_RETRY_INITIAL,
  TIMEOUT_RETRY_MAX,
  TIMEOUT_SAVE_DEBOUNCE,
  TIMEOUT_SESSION,
  TaskStatus,
  TokenUsage,
  UpdateTaskInputSchema,
  VERSION,
  ValidationError,
  WorkspaceConfigSchema,
  createDefaultHealth,
  createSessionSummary,
  expandMinimalConfig,
  formatBytes,
  formatDuration,
  formatDurationLong,
  formatRelativeTime,
  mergeConfig,
  parseOrThrow,
  safeParse,
  safeValidateAgentProfile,
  safeValidateConfig,
  truncate,
  truncateId,
  validateAgentProfile,
  validateCheckpoint,
  validateConfig,
  validateCreateSessionInput,
  validateExecutionRequest,
  validateMemoryAddInput,
  validateMemoryEntry,
  validateProviderConfig,
  validateSearchOptions,
  validateSession
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
/**
 * Formatting Utilities
 *
 * Shared formatting functions for consistent display across the platform.
 *
 * @module @ax/schemas/format
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * AutomatosX Schemas
 *
 * Zod-based validation schemas for the AutomatosX platform.
 * This package provides type-safe schemas for all core data structures.
 *
 * @packageDocumentation
 * @module @ax/schemas
 *
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
//# sourceMappingURL=index.js.map