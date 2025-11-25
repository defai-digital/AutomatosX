/**
 * Configuration schemas for AutomatosX
 * @module @ax/schemas/config
 */

import { z } from 'zod';
import { ProviderType, DurationMs } from './common.js';
import { CleanupStrategy } from './memory.js';
import {
  VERSION,
  PATH_MEMORY_DB,
  PATH_SESSIONS,
  PATH_CHECKPOINTS,
  PATH_TRACES,
  PATH_LOGS,
  DIR_WORKSPACE_PRD,
  DIR_WORKSPACE_TMP,
  TIMEOUT_EXECUTION,
  TIMEOUT_HEALTH_CHECK,
  TIMEOUT_SESSION,
  TIMEOUT_RETRY_INITIAL,
  TIMEOUT_RETRY_MAX,
  TIMEOUT_PROVIDER_COOLDOWN,
  TIMEOUT_AUTO_SAVE,
  TIMEOUT_SAVE_DEBOUNCE,
  LIMIT_RETRY_ATTEMPTS,
  LIMIT_CONCURRENCY,
  LIMIT_MEMORY_ENTRIES,
  LIMIT_RETENTION_DAYS,
  LIMIT_MAX_SESSIONS,
  LIMIT_CHECKPOINTS_PER_SESSION,
  LIMIT_CHECKPOINT_RETENTION_DAYS,
  LIMIT_MAX_LOG_FILES,
  LIMIT_MAX_LOG_SIZE,
  LIMIT_TMP_RETENTION_DAYS,
  LIMIT_CIRCUIT_BREAKER_THRESHOLD,
  LIST_SEARCH_LIMIT,
} from './constants.js';

// =============================================================================
// Provider Configuration
// =============================================================================

/**
 * Providers configuration section
 */
export const ProvidersConfigSchema = z.object({
  /** Default provider to use */
  default: ProviderType.default('claude'),
  /** Enabled providers */
  enabled: z.array(ProviderType).default(['claude']),
  /** Fallback order when default fails */
  fallbackOrder: z.array(ProviderType).optional(),
});
export type ProvidersConfig = z.infer<typeof ProvidersConfigSchema>;

// =============================================================================
// Execution Configuration
// =============================================================================

/**
 * Retry configuration
 */
export const RetryConfigSchema = z.object({
  /** Maximum retry attempts */
  maxAttempts: z.number().int().min(0).max(10).default(LIMIT_RETRY_ATTEMPTS),
  /** Initial delay between retries (ms) */
  initialDelay: DurationMs.default(TIMEOUT_RETRY_INITIAL),
  /** Maximum delay between retries (ms) */
  maxDelay: DurationMs.default(TIMEOUT_RETRY_MAX),
  /** Backoff multiplier */
  backoffFactor: z.number().min(1).max(5).default(2),
  /** Jitter factor (0-1) to add randomness */
  jitterFactor: z.number().min(0).max(1).default(0.1),
}).refine(
  (data) => data.maxDelay >= data.initialDelay,
  {
    message: 'maxDelay must be greater than or equal to initialDelay',
    path: ['maxDelay'],
  }
);
export type RetryConfig = z.infer<typeof RetryConfigSchema>;

/**
 * Execution configuration section
 */
export const ExecutionConfigSchema = z.object({
  /** Default timeout for agent execution (ms), 1ms to 1 hour */
  timeout: z.number().int().min(1).max(3600000).default(TIMEOUT_EXECUTION),
  /** Maximum concurrent agent executions */
  concurrency: z.number().int().min(1).max(16).default(LIMIT_CONCURRENCY),
  /** Retry configuration */
  retry: RetryConfigSchema.default({}),
  /** Enable execution tracing */
  tracing: z.boolean().default(false),
  /** Trace output directory */
  traceDir: z.string().default(PATH_TRACES),
});
export type ExecutionConfig = z.infer<typeof ExecutionConfigSchema>;

// =============================================================================
// Memory Configuration
// =============================================================================

/**
 * Memory configuration section
 */
export const MemoryConfigSchema = z.object({
  /** Whether memory system is enabled */
  enabled: z.boolean().default(true),
  /** Maximum number of entries */
  maxEntries: z.number().int().min(100).max(1000000).default(LIMIT_MEMORY_ENTRIES),
  /** Database path */
  databasePath: z.string().default(PATH_MEMORY_DB),
  /** Retention period in days */
  retentionDays: z.number().int().min(1).max(365).default(LIMIT_RETENTION_DAYS),
  /** Cleanup strategy */
  cleanupStrategy: CleanupStrategy.default('hybrid'),
  /** Auto cleanup enabled */
  autoCleanup: z.boolean().default(true),
  /** Search result limit */
  searchLimit: z.number().int().min(1).max(100).default(LIST_SEARCH_LIMIT),
});
export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;

// =============================================================================
// Session Configuration
// =============================================================================

/**
 * Session configuration section
 */
export const SessionConfigSchema = z.object({
  /** Maximum active sessions */
  maxSessions: z.number().int().min(1).max(1000).default(LIMIT_MAX_SESSIONS),
  /** Session timeout (ms) */
  timeout: DurationMs.default(TIMEOUT_SESSION),
  /** Session data directory */
  dataDir: z.string().default(PATH_SESSIONS),
  /** Auto-save interval (ms) */
  autoSaveInterval: DurationMs.default(TIMEOUT_AUTO_SAVE),
  /** Debounce time for saves (ms) */
  saveDebounce: DurationMs.default(TIMEOUT_SAVE_DEBOUNCE),
});
export type SessionConfig = z.infer<typeof SessionConfigSchema>;

// =============================================================================
// Checkpoint Configuration
// =============================================================================

/**
 * Checkpoint configuration section
 */
export const CheckpointConfigSchema = z.object({
  /** Whether checkpoints are enabled */
  enabled: z.boolean().default(true),
  /** Checkpoint storage directory */
  storageDir: z.string().default(PATH_CHECKPOINTS),
  /** Auto-save checkpoints */
  autoSave: z.boolean().default(true),
  /** Checkpoint retention in days */
  retentionDays: z.number().int().min(1).max(90).default(LIMIT_CHECKPOINT_RETENTION_DAYS),
  /** Maximum checkpoints per session */
  maxPerSession: z.number().int().min(1).max(100).default(LIMIT_CHECKPOINTS_PER_SESSION),
});
export type CheckpointConfig = z.infer<typeof CheckpointConfigSchema>;

// =============================================================================
// Router Configuration
// =============================================================================

/**
 * Router configuration section
 */
export const RouterConfigSchema = z.object({
  /** Health check interval (ms) */
  healthCheckInterval: DurationMs.default(TIMEOUT_HEALTH_CHECK),
  /** Circuit breaker failure threshold */
  circuitBreakerThreshold: z.number().int().min(1).max(10).default(LIMIT_CIRCUIT_BREAKER_THRESHOLD),
  /** Provider cooldown after failure (ms) */
  cooldownMs: DurationMs.default(TIMEOUT_PROVIDER_COOLDOWN),
  /** Enable workload-aware routing */
  workloadAwareRouting: z.boolean().default(true),
  /** Prefer MCP providers */
  preferMcp: z.boolean().default(true),
});
export type RouterConfig = z.infer<typeof RouterConfigSchema>;

// =============================================================================
// Workspace Configuration
// =============================================================================

/**
 * Workspace configuration section
 */
export const WorkspaceConfigSchema = z.object({
  /** PRD documents path */
  prdPath: z.string().default(DIR_WORKSPACE_PRD),
  /** Temporary files path */
  tmpPath: z.string().default(DIR_WORKSPACE_TMP),
  /** Auto-cleanup temporary files */
  autoCleanupTmp: z.boolean().default(true),
  /** Temporary file retention in days */
  tmpRetentionDays: z.number().int().min(1).max(30).default(LIMIT_TMP_RETENTION_DAYS),
});
export type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>;

// =============================================================================
// Logging Configuration
// =============================================================================

/**
 * Logging configuration section
 */
export const LoggingConfigSchema = z.object({
  /** Log level */
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  /** Log directory */
  dir: z.string().default(PATH_LOGS),
  /** Enable file logging */
  fileEnabled: z.boolean().default(true),
  /** Enable console logging */
  consoleEnabled: z.boolean().default(true),
  /** Maximum log file size in bytes */
  maxFileSize: z.number().int().positive().default(LIMIT_MAX_LOG_SIZE),
  /** Maximum log files to keep */
  maxFiles: z.number().int().min(1).max(100).default(LIMIT_MAX_LOG_FILES),
  /** Enable structured JSON logs */
  jsonFormat: z.boolean().default(false),
});
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;

// =============================================================================
// Main Configuration Schema
// =============================================================================

/**
 * Complete AutomatosX configuration
 * This is the main configuration schema for ax.config.json
 */
export const ConfigSchema = z.object({
  /** Configuration schema version */
  $schema: z.string().optional(),
  /** Configuration version */
  version: z.string().default(VERSION),
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
  logging: LoggingConfigSchema.default({}),
});
export type Config = z.infer<typeof ConfigSchema>;

// =============================================================================
// Minimal Configuration
// =============================================================================

/**
 * Minimal configuration for quick start
 * Only requires essential settings
 */
export const MinimalConfigSchema = z.object({
  /** Default provider */
  provider: ProviderType.default('claude'),
});
export type MinimalConfig = z.infer<typeof MinimalConfigSchema>;

// =============================================================================
// Configuration Loading Helpers
// =============================================================================

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Config = ConfigSchema.parse({});

/**
 * Validate configuration data
 */
export function validateConfig(data: unknown): Config {
  return ConfigSchema.parse(data);
}

/**
 * Safe validate configuration
 */
export function safeValidateConfig(data: unknown): z.SafeParseReturnType<unknown, Config> {
  return ConfigSchema.safeParse(data);
}

/**
 * Merge partial config with defaults
 */
export function mergeConfig(partial: Partial<Config>): Config {
  return ConfigSchema.parse({
    ...DEFAULT_CONFIG,
    ...partial,
  });
}

/**
 * Expand minimal config to full config
 */
export function expandMinimalConfig(minimal: MinimalConfig): Config {
  return ConfigSchema.parse({
    providers: {
      default: minimal.provider,
      enabled: [minimal.provider],
    },
  });
}
