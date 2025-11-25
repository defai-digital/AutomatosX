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

// =============================================================================
// Common Types & Utilities
// =============================================================================

export {
  // Branded Types
  AgentId,
  SessionId,
  MemoryId,
  CheckpointId,
  // Enums
  ProviderType,
  IntegrationMode,
  TaskStatus,
  MemoryType,
  LogLevel,
  // Utility Types
  ISODateString,
  DurationMs,
  Percentage,
  NormalizedScore,
  NonEmptyStringArray,
  Metadata,
  TokenUsage,
  // Error Types
  ErrorInfo,
  Result,
  ValidationError,
  // Helpers
  safeParse,
  parseOrThrow,
} from './common.js';

export type {
  AgentId as AgentIdType,
  SessionId as SessionIdType,
  MemoryId as MemoryIdType,
  CheckpointId as CheckpointIdType,
  ProviderType as ProviderTypeEnum,
  IntegrationMode as IntegrationModeEnum,
  TaskStatus as TaskStatusEnum,
  MemoryType as MemoryTypeEnum,
  LogLevel as LogLevelEnum,
  TokenUsage as TokenUsageType,
} from './common.js';

// =============================================================================
// Agent Schemas
// =============================================================================

export {
  // Schemas
  CommunicationStyle,
  DecisionMaking,
  PersonalitySchema,
  AbilitySelectionSchema,
  OrchestrationSchema,
  AgentProfileSchema,
  ExecutionContextSchema,
  AgentResponseSchema,
  AgentRegistrationSchema,
  PartialAgentProfileSchema,
  // Validators
  validateAgentProfile,
  safeValidateAgentProfile,
} from './agent.js';

export type {
  CommunicationStyle as CommunicationStyleType,
  DecisionMaking as DecisionMakingType,
  Personality,
  AbilitySelection,
  Orchestration,
  AgentProfile,
  ExecutionContext,
  AgentResponse,
  AgentRegistration,
  PartialAgentProfile,
} from './agent.js';

// =============================================================================
// Provider Schemas
// =============================================================================

export {
  // Schemas
  CircuitBreakerConfigSchema,
  HealthCheckConfigSchema,
  ProviderConfigSchema,
  ProviderHealthSchema,
  ExecutionRequestSchema,
  ExecutionMetadataSchema,
  ExecutionResponseSchema,
  ProviderRegistrationSchema,
  RoutingContextSchema,
  RoutingDecisionSchema,
  // Constants
  DEFAULT_HEALTH_VALUES,
  // Validators
  validateExecutionRequest,
  validateProviderConfig,
  createDefaultHealth,
} from './provider.js';

export type {
  CircuitBreakerConfig,
  HealthCheckConfig,
  ProviderConfig,
  ProviderHealth,
  ExecutionRequest,
  ExecutionMetadata,
  ExecutionResponse,
  ProviderRegistration,
  RoutingContext,
  RoutingDecision,
} from './provider.js';

// =============================================================================
// Memory Schemas
// =============================================================================

export {
  // Schemas
  MemoryMetadataSchema,
  MemoryEntrySchema,
  MemoryFilterSchema,
  MemorySearchOptionsSchema,
  MemorySearchResultSchema,
  MemoryAddInputSchema,
  MemoryUpdateInputSchema,
  MemoryBulkAddInputSchema,
  CleanupStrategy,
  MemoryCleanupConfigSchema,
  MemoryCleanupResultSchema,
  MemoryStatsSchema,
  ExportFormat,
  MemoryExportOptionsSchema,
  MemoryImportOptionsSchema,
  // Validators
  validateMemoryEntry,
  validateMemoryAddInput,
  validateSearchOptions,
} from './memory.js';

export type {
  MemoryMetadata,
  MemoryEntry,
  MemoryFilter,
  MemorySearchOptions,
  MemorySearchResult,
  MemoryAddInput,
  MemoryUpdateInput,
  MemoryBulkAddInput,
  CleanupStrategy as CleanupStrategyType,
  MemoryCleanupConfig,
  MemoryCleanupResult,
  MemoryStats,
  ExportFormat as ExportFormatType,
  MemoryExportOptions,
  MemoryImportOptions,
} from './memory.js';

// =============================================================================
// Config Schemas
// =============================================================================

export {
  // Schemas
  ProvidersConfigSchema,
  RetryConfigSchema,
  ExecutionConfigSchema,
  MemoryConfigSchema,
  SessionConfigSchema,
  CheckpointConfigSchema,
  RouterConfigSchema,
  WorkspaceConfigSchema,
  LoggingConfigSchema,
  ConfigSchema,
  MinimalConfigSchema,
  // Constants
  DEFAULT_CONFIG,
  // Validators
  validateConfig,
  safeValidateConfig,
  mergeConfig,
  expandMinimalConfig,
} from './config.js';

export type {
  ProvidersConfig,
  RetryConfig,
  ExecutionConfig,
  MemoryConfig,
  SessionConfig as SessionConfigType,
  CheckpointConfig,
  RouterConfig,
  WorkspaceConfig,
  LoggingConfig,
  Config,
  MinimalConfig,
} from './config.js';

// =============================================================================
// Session Schemas
// =============================================================================

export {
  // Schemas
  SessionTaskSchema,
  SessionState,
  SessionSchema,
  CheckpointSchema,
  CreateSessionInputSchema,
  AddTaskInputSchema,
  UpdateTaskInputSchema,
  SessionSummarySchema,
  DelegationRequestSchema,
  DelegationResultSchema,
  // Helpers
  createSessionSummary,
  // Validators
  validateSession,
  validateCheckpoint,
  validateCreateSessionInput,
} from './session.js';

export type {
  SessionTask,
  SessionState as SessionStateType,
  Session,
  Checkpoint,
  CreateSessionInput,
  AddTaskInput,
  UpdateTaskInput,
  SessionSummary,
  DelegationRequest,
  DelegationResult,
} from './session.js';

// =============================================================================
// Shared Constants
// =============================================================================

export {
  // Version
  VERSION,
  // Time Constants
  MS_PER_SECOND,
  MS_PER_MINUTE,
  MS_PER_HOUR,
  MS_PER_DAY,
  MS_PER_WEEK,
  // Byte Constants
  BYTES_PER_KB,
  BYTES_PER_MB,
  BYTES_PER_GB,
  // Directory Names
  DIR_AUTOMATOSX,
  DIR_AGENTS,
  DIR_SESSIONS,
  DIR_MEMORY,
  DIR_CHECKPOINTS,
  DIR_TRACES,
  DIR_LOGS,
  DIR_WORKSPACE_PRD,
  DIR_WORKSPACE_TMP,
  // File Names
  FILE_MEMORY_DB,
  FILE_CONFIG,
  // Default Paths
  PATH_MEMORY_DB,
  PATH_SESSIONS,
  PATH_CHECKPOINTS,
  PATH_TRACES,
  PATH_LOGS,
  // Display Constants
  DISPLAY_ID_LENGTH,
  DISPLAY_PREVIEW_SHORT,
  DISPLAY_PREVIEW_MEDIUM,
  DISPLAY_PREVIEW_LONG,
  DISPLAY_PREVIEW_XLARGE,
  DISPLAY_NAME_LENGTH,
  DISPLAY_ROLE_LENGTH,
  DISPLAY_TASK_LENGTH,
  // List Limits
  LIST_PREVIEW_LIMIT,
  LIST_SEARCH_LIMIT,
  LIST_TOP_TAGS,
  // Timeout Values
  TIMEOUT_EXECUTION,
  TIMEOUT_HEALTH_CHECK,
  TIMEOUT_HEALTH_CHECK_REQUEST,
  TIMEOUT_SESSION,
  TIMEOUT_RETRY_INITIAL,
  TIMEOUT_RETRY_MAX,
  TIMEOUT_CIRCUIT_RECOVERY,
  TIMEOUT_CIRCUIT_FAILURE_WINDOW,
  TIMEOUT_PROVIDER_COOLDOWN,
  TIMEOUT_AUTO_SAVE,
  TIMEOUT_SAVE_DEBOUNCE,
  // Limits
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
  LIMIT_DEFAULT_PROVIDER_PRIORITY,
  // Database
  DB_CACHE_SIZE_KB,
  DB_REQUEST_HISTORY_SIZE,
  DB_DEFAULT_SUCCESS_RATE,
  // Cleanup Weights
  CLEANUP_AGE_WEIGHT,
  CLEANUP_ACCESS_WEIGHT,
  CLEANUP_IMPORTANCE_WEIGHT,
  // Default Metadata
  DEFAULT_MEMORY_TYPE,
  DEFAULT_MEMORY_SOURCE,
  DEFAULT_MEMORY_IMPORTANCE,
  // Circuit Breaker
  CIRCUIT_CLOSED,
  CIRCUIT_OPEN,
  CIRCUIT_HALF_OPEN,
} from './constants.js';

export type { CircuitState } from './constants.js';

// =============================================================================
// Formatting Utilities
// =============================================================================

export {
  formatBytes,
  formatDuration,
  formatDurationLong,
  formatRelativeTime,
  truncate,
  truncateId,
} from './format.js';
