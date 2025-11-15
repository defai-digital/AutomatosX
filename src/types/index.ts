// ============================================================================
// Type Exports - Central export for all type definitions
// ============================================================================
// NOTE: Some types have naming conflicts, so we use named exports to avoid ambiguity

// Agent types
export type {
  AgentType,
  TaskPriority,
  TaskStatus,
  AgentCapability,
  AgentMetadata,
  AgentContext,
  AgentExecutionOptions,
  DelegationRequest,
  CollaborationRequest
} from './agents.types.js';
export type { Task as AgentTask, TaskResult as AgentTaskResult, TaskArtifact } from './agents.types.js';
export { TaskSchema, AgentMetadataSchema, TaskResultSchema } from './agents.types.js';

// Iterate mode types
export type {
  RetryStrategy,
  FailureType,
  IterateOptions,
  IterateResult,
  SafetyLevel
} from './iterate.types.js';
export type { Task as IterateTask } from './iterate.types.js';

// Monitoring types
export type {
  MetricType,
  PerformanceMetric,
  MetricAggregation,
  TimeSeries,
  TimeSeriesDataPoint,
  Alert,
  AlertStatus,
  AlertSeverity,
  HealthStatus,
  HealthCheckResult,
  LogLevel,
  LogEntry,
  TraceSpan,
  DistributedTrace
} from './monitoring.types.js';

// Security types
export type {
  SecurityLevel,
  AccessControl,
  AuditLog,
  EncryptionConfig
} from './security.types.js';

// SpecKit types
export type {
  GeneratorType,
  GenerateOptions,
  DetectionResult,
  PatternType,
  FeatureType
} from './speckit.types.js';
export type { ValidationResult as SpecKitValidationResult } from './speckit.types.js';

// Config types
export type {
  AutomatosXConfig,
  LanguageConfig,
  SearchConfig,
  DatabaseConfig,
  IndexingConfig,
  PerformanceConfig,
  LoggingConfig,
  PartialConfig,
  ConfigWithMetadata
} from './Config.js';
export { ConfigSource } from './Config.js';

// Query filter types
export type { QueryFilters } from './QueryFilter.js';
