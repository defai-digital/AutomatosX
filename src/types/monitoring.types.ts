/**
 * monitoring.types.ts
 *
 * Type definitions for monitoring, observability, and alerting
 * Phase 6 Week 1: Advanced Monitoring & Observability
 */

// ============================================================================
// Workflow Monitoring
// ============================================================================

export type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  tenantId: string;
  userId: string;
  status: WorkflowStatus;
  startedAt: number;
  completedAt?: number;
  duration?: number;
  stepsTotal: number;
  stepsCompleted: number;
  stepsFailed: number;
  currentStep?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowStepExecution {
  id: string;
  executionId: string;
  stepKey: string;
  stepName: string;
  status: WorkflowStatus;
  startedAt: number;
  completedAt?: number;
  duration?: number;
  retryCount: number;
  errorMessage?: string;
  inputSize?: number;
  outputSize?: number;
  tokensUsed?: number;
  cost?: number;
}

export interface WorkflowMetrics {
  executionId: string;
  totalDuration: number;
  stepDurations: Map<string, number>;
  totalTokens: number;
  totalCost: number;
  cacheHits: number;
  cacheMisses: number;
  parallelSteps: number;
  retryCount: number;
}

// ============================================================================
// Performance Metrics
// ============================================================================

export interface PerformanceMetric {
  id: string;
  timestamp: number;
  metricType: MetricType;
  value: number;
  unit: string;
  labels: Record<string, string>;
  tenantId?: string;
}

export type MetricType =
  | 'workflow.execution.duration'
  | 'workflow.execution.count'
  | 'workflow.step.duration'
  | 'workflow.step.count'
  | 'workflow.queue.length'
  | 'workflow.queue.wait_time'
  | 'worker.pool.utilization'
  | 'worker.pool.count'
  | 'cache.hit_rate'
  | 'cache.size'
  | 'database.query.duration'
  | 'database.query.count'
  | 'api.request.duration'
  | 'api.request.count'
  | 'quota.usage'
  | 'cpu.usage'
  | 'memory.usage'
  | 'disk.usage';

export interface MetricAggregation {
  metricType: MetricType;
  startTime: number;
  endTime: number;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface TimeSeriesDataPoint {
  timestamp: number;
  value: number;
}

export interface TimeSeries {
  metricType: MetricType;
  labels: Record<string, string>;
  dataPoints: TimeSeriesDataPoint[];
}

// ============================================================================
// Alerting
// ============================================================================

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

export interface Alert {
  id: string;
  timestamp: number;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  description: string;
  source: string;
  labels: Record<string, string>;
  tenantId?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
  resolvedAt?: number;
  metadata?: Record<string, unknown>;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  metricType: MetricType;
  condition: AlertCondition;
  severity: AlertSeverity;
  labels: Record<string, string>;
  cooldownMs: number;
  createdAt: number;
  updatedAt: number;
}

export type AlertConditionOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';

export interface AlertCondition {
  operator: AlertConditionOperator;
  threshold: number;
  windowMs: number;  // Time window for aggregation
  aggregation: 'avg' | 'sum' | 'min' | 'max' | 'count';
}

// ============================================================================
// Health Checks
// ============================================================================

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheck {
  component: string;
  status: HealthStatus;
  timestamp: number;
  responseTime?: number;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface SystemHealth {
  overall: HealthStatus;
  timestamp: number;
  components: HealthCheck[];
  uptime: number;
  version: string;
}

export interface ComponentHealth {
  database: HealthCheck;
  cache: HealthCheck;
  queue: HealthCheck;
  workerPool: HealthCheck;
  providers: HealthCheck;
  disk: HealthCheck;
  memory: HealthCheck;
}

// ============================================================================
// Traces & Spans (Distributed Tracing)
// ============================================================================

export interface Trace {
  traceId: string;
  workflowExecutionId: string;
  startedAt: number;
  completedAt?: number;
  duration?: number;
  spans: Span[];
}

export interface Span {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startedAt: number;
  completedAt?: number;
  duration?: number;
  status: SpanStatus;
  attributes: Record<string, unknown>;
  events: SpanEvent[];
}

export type SpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer';
export type SpanStatus = 'ok' | 'error' | 'unset';

export interface SpanEvent {
  timestamp: number;
  name: string;
  attributes?: Record<string, unknown>;
}

// ============================================================================
// Dashboard & Visualization
// ============================================================================

export interface DashboardData {
  timestamp: number;
  workflowStats: WorkflowStats;
  performanceMetrics: MetricAggregation[];
  activeWorkflows: WorkflowExecution[];
  recentAlerts: Alert[];
  systemHealth: SystemHealth;
  quotaUsage: QuotaUsageStats[];
}

export interface WorkflowStats {
  total: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  avgDuration: number;
  successRate: number;
}

export interface QuotaUsageStats {
  tenantId: string;
  tenantName: string;
  plan: string;
  executionsUsed: number;
  executionsLimit: number;
  executionsPercentage: number;
  workflowsUsed: number;
  workflowsLimit: number;
}

// ============================================================================
// Logs
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  source: string;
  executionId?: string;
  traceId?: string;
  spanId?: string;
  tenantId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  stackTrace?: string;
}

export interface LogQuery {
  level?: LogLevel;
  source?: string;
  executionId?: string;
  tenantId?: string;
  startTime?: number;
  endTime?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Monitoring Configuration
// ============================================================================

export interface MonitoringConfig {
  enabled: boolean;
  metricsRetention: number;  // Days to keep metrics
  logsRetention: number;  // Days to keep logs
  tracesRetention: number;  // Days to keep traces
  samplingRate: number;  // 0.0 to 1.0 (percentage of traces to sample)
  alerting: {
    enabled: boolean;
    cooldownMs: number;
    batchSize: number;
  };
  healthChecks: {
    enabled: boolean;
    intervalMs: number;
  };
}

// ============================================================================
// Real-time Subscriptions
// ============================================================================

export type SubscriptionEvent =
  | 'workflow.started'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'workflow.step.started'
  | 'workflow.step.completed'
  | 'workflow.step.failed'
  | 'alert.triggered'
  | 'health.changed'
  | 'metric.recorded';

export interface Subscription {
  id: string;
  userId: string;
  events: SubscriptionEvent[];
  filters?: {
    tenantId?: string;
    workflowId?: string;
    severity?: AlertSeverity;
  };
  createdAt: number;
}

// ============================================================================
// Errors
// ============================================================================

export class MonitoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MonitoringError';
  }
}

export class AlertRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AlertRuleError';
  }
}
