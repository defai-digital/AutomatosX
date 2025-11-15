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
  Strategy as RetryStrategy,
  FailureAnalysis as FailureType,
  IterateOptions,
  IterateResult,
  SafetyEvaluation,
  IterationResult,
  ProgressSnapshot,
  StrategyConfig
} from './iterate.types.js';
// Note: SafetyLevel is a literal type extracted from IterateOptions
export type SafetyLevel = 'permissive' | 'normal' | 'paranoid';

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
  HealthCheck as HealthCheckResult,
  SystemHealth,
  LogLevel,
  LogEntry,
  Span as TraceSpan,
  Trace as DistributedTrace,
  WorkflowExecution,
  WorkflowStatus,
  WorkflowMetrics,
  WorkflowStats
} from './monitoring.types.js';

// Security types
export type {
  Permission,
  Role,
  User,
  Tenant,
  TenantPlan,
  TenantStatus,
  Secret,
  RateLimit,
  AuditAction,
  AuditEvent as AuditLog,
  AuditOutcome,
  AuditResourceType
} from './security.types.js';

// Security type aliases for backward compatibility
export type SecurityLevel = 'low' | 'medium' | 'high' | 'critical';
export interface AccessControl {
  userId: string;
  permissions: string[];
  roles: string[];
}
export interface EncryptionConfig {
  algorithm: string;
  keySize: number;
  enabled: boolean;
}

// SpecKit types
export type {
  GenerateOptions,
  ADRGenerateOptions,
  PRDGenerateOptions,
  APISpecGenerateOptions,
  TestSpecGenerateOptions,
  MigrationGenerateOptions,
  AnalysisResult as DetectionResult,
  DetectedPattern,
  PatternLocation,
  CodeExample,
  GenerateResult,
  GenerationMetadata,
  GenerationStage,
  ValidationResult as SpecKitValidationResult,
  ValidationError,
  ValidationWarning
} from './speckit.types.js';

// SpecKit type aliases for backward compatibility
export type GeneratorType = 'adr' | 'prd' | 'api' | 'test' | 'migration';
export type PatternType = 'design' | 'architectural' | 'integration';
export type FeatureType = 'auth' | 'api' | 'database' | 'ui' | 'cache' | 'queue';

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

// Language type - represents supported programming languages
export type Language =
  | 'typescript' | 'javascript' | 'python' | 'go' | 'rust'
  | 'java' | 'cpp' | 'c' | 'csharp' | 'swift' | 'kotlin'
  | 'dart' | 'ruby' | 'php' | 'bash' | 'zsh' | 'lua'
  | 'perl' | 'groovy' | 'zig' | 'cuda' | 'assemblyscript'
  | 'sql' | 'json' | 'yaml' | 'toml' | 'csv' | 'markdown'
  | 'xml' | 'hcl' | 'dockerfile' | 'makefile' | 'puppet'
  | 'solidity' | 'verilog' | 'systemverilog' | 'thrift'
  | 'julia' | 'matlab' | 'regex' | 'html' | 'r'
  | 'haskell' | 'ocaml' | 'elm' | 'elixir' | 'gleam' | 'scala';

// Query filter types
export type { QueryFilters } from './QueryFilter.js';
