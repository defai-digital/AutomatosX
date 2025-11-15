export type { AgentType, TaskPriority, TaskStatus, AgentCapability, AgentMetadata, AgentContext, AgentExecutionOptions, DelegationRequest, CollaborationRequest } from './agents.types.js';
export type { Task as AgentTask, TaskResult as AgentTaskResult, TaskArtifact } from './agents.types.js';
export { TaskSchema, AgentMetadataSchema, TaskResultSchema } from './agents.types.js';
export type { Strategy as RetryStrategy, FailureAnalysis as FailureType, IterateOptions, IterateResult, SafetyEvaluation, IterationResult, ProgressSnapshot, StrategyConfig } from './iterate.types.js';
export type SafetyLevel = 'permissive' | 'normal' | 'paranoid';
export type { MetricType, PerformanceMetric, MetricAggregation, TimeSeries, TimeSeriesDataPoint, Alert, AlertStatus, AlertSeverity, HealthStatus, HealthCheck as HealthCheckResult, SystemHealth, LogLevel, LogEntry, Span as TraceSpan, Trace as DistributedTrace, WorkflowExecution, WorkflowStatus, WorkflowMetrics, WorkflowStats } from './monitoring.types.js';
export type { Permission, Role, User, Tenant, TenantPlan, TenantStatus, Secret, RateLimit, AuditAction, AuditEvent as AuditLog, AuditOutcome, AuditResourceType } from './security.types.js';
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
export type { GenerateOptions, ADRGenerateOptions, PRDGenerateOptions, APISpecGenerateOptions, TestSpecGenerateOptions, MigrationGenerateOptions, AnalysisResult as DetectionResult, DetectedPattern, PatternLocation, CodeExample, GenerateResult, GenerationMetadata, GenerationStage, ValidationResult as SpecKitValidationResult, ValidationError, ValidationWarning } from './speckit.types.js';
export type GeneratorType = 'adr' | 'prd' | 'api' | 'test' | 'migration';
export type PatternType = 'design' | 'architectural' | 'integration';
export type FeatureType = 'auth' | 'api' | 'database' | 'ui' | 'cache' | 'queue';
export type { AutomatosXConfig, LanguageConfig, SearchConfig, DatabaseConfig, IndexingConfig, PerformanceConfig, LoggingConfig, PartialConfig, ConfigWithMetadata } from './Config.js';
export { ConfigSource } from './Config.js';
export type Language = 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'java' | 'cpp' | 'c' | 'csharp' | 'swift' | 'kotlin' | 'dart' | 'ruby' | 'php' | 'bash' | 'zsh' | 'lua' | 'perl' | 'groovy' | 'zig' | 'cuda' | 'assemblyscript' | 'sql' | 'json' | 'yaml' | 'toml' | 'csv' | 'markdown' | 'xml' | 'hcl' | 'dockerfile' | 'makefile' | 'puppet' | 'solidity' | 'verilog' | 'systemverilog' | 'thrift' | 'julia' | 'matlab' | 'regex' | 'html' | 'r' | 'haskell' | 'ocaml' | 'elm' | 'elixir' | 'gleam' | 'scala';
export type { QueryFilters } from './QueryFilter.js';
//# sourceMappingURL=index.d.ts.map