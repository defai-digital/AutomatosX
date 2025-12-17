/**
 * MCP Tool Schema Registry
 *
 * Maps tool names to their input/output validation schemas from contracts.
 * This enables INV-MCP-001 (input validation before execution).
 *
 * Invariants:
 * - INV-MCP-001: Input validation MUST occur before tool execution
 * - INV-MCP-VAL-002: All schemas defined in contracts package
 */

import {
  // Memory tool schemas
  MemoryStoreInputSchema,
  MemoryStoreOutputSchema,
  MemoryRetrieveInputSchema,
  MemoryRetrieveOutputSchema,
  MemorySearchInputSchema,
  MemorySearchOutputSchema,
  MemoryListInputSchema,
  MemoryListOutputSchema,
  MemoryDeleteInputSchema,
  MemoryDeleteOutputSchema,
  MemoryExportInputSchema,
  MemoryExportOutputSchema,
  MemoryImportInputSchema,
  MemoryImportOutputSchema,
  MemoryStatsInputSchema,
  MemoryStatsOutputSchema,
  MemoryBulkDeleteInputSchema,
  MemoryBulkDeleteOutputSchema,
  MemoryClearInputSchema,
  MemoryClearOutputSchema,
  // Agent tool schemas
  AgentListInputSchema,
  AgentListOutputSchema,
  AgentRunInputSchema,
  AgentRunOutputSchema,
  AgentGetInputSchema,
  AgentGetOutputSchema,
  AgentRegisterInputSchema,
  AgentRegisterOutputSchema,
  AgentRemoveInputSchema,
  AgentRemoveOutputSchema,
  // Session tool schemas
  SessionCreateInputSchema,
  SessionCreateOutputSchema,
  SessionStatusInputSchema,
  SessionStatusOutputSchema,
  SessionCompleteInputSchema,
  SessionCompleteOutputSchema,
  SessionListInputSchema,
  SessionListOutputSchema,
  SessionJoinInputSchema,
  SessionJoinOutputSchema,
  SessionLeaveInputSchema,
  SessionLeaveOutputSchema,
  SessionFailInputSchema,
  SessionFailOutputSchema,
  // Guard tool schemas
  GuardCheckInputSchema,
  GuardCheckOutputSchema,
  GuardListInputSchema,
  GuardListOutputSchema,
  GuardApplyInputSchema,
  GuardApplyOutputSchema,
  // Config tool schemas (from config domain)
  ConfigGetInputSchema,
  ConfigGetOutputSchema,
  ConfigSetInputSchema,
  ConfigSetOutputSchema,
  ConfigShowInputSchema,
  ConfigShowOutputSchema,
  // Trace tool schemas
  TraceListInputSchema,
  TraceListOutputSchema,
  TraceGetInputSchema,
  TraceGetOutputSchema,
  TraceAnalyzeInputSchema,
  TraceAnalyzeOutputSchema,
  // Workflow tool schemas
  WorkflowRunInputSchema,
  WorkflowRunOutputSchema,
  WorkflowListInputSchema,
  WorkflowListOutputSchema,
  WorkflowDescribeInputSchema,
  WorkflowDescribeOutputSchema,
  // Bugfix domain schemas
  BugScanRequestSchema,
  BugScanResultSchema,
  BugFixRequestSchema,
  BugFixResultSchema,
  // Refactor domain schemas
  RefactorScanRequestSchema,
  RefactorScanResultSchema,
  RefactorApplyRequestSchema,
  RefactorApplyResultSchema,
  // Design domain schemas
  ApiDesignRequestSchema,
  ApiDesignResultSchema,
  ComponentDesignRequestSchema,
  ComponentDesignResultSchema,
  SchemaDesignRequestSchema,
  SchemaDesignResultSchema,
  ArchitectureDesignRequestSchema,
  ArchitectureDesignResultSchema,
  // Orchestration domain schemas
  TaskSubmitRequestSchema,
  TaskSubmitResultSchema,
  TaskQueryRequestSchema,
  TaskQueryResultSchema,
  TaskCancelRequestSchema,
  TaskRetryRequestSchema,
  QueueCreateRequestSchema,
  QueueStateSchema,
  // Telemetry domain schemas
  RecordMetricRequestSchema,
  IncrementCounterRequestSchema,
  StartTimerRequestSchema,
  QueryMetricsRequestSchema,
  QueryMetricsResultSchema,
  TelemetrySummaryRequestSchema,
  TelemetrySummaryResultSchema,
  // MCP tool list/filter schemas (INV-MCP-VAL-002: defined in contracts)
  BugfixListInputSchema,
  RefactorListInputSchema,
  DesignListInputSchema,
  TaskStatusInputSchema,
  QueueListInputSchema,
  MetricsListInputSchema,
  TimerStopInputSchema,
  // Ability tool schemas (INV-MCP-VAL-002: defined in contracts)
  AbilityListInputSchema,
  AbilityListOutputSchema,
  AbilityGetInputSchema,
  AbilityGetOutputSchema,
  AbilityInjectInputSchema,
  AbilityInjectOutputSchema,
  AbilityRegisterInputSchema,
  AbilityRegisterOutputSchema,
  AbilityRemoveInputSchema,
  AbilityRemoveOutputSchema,
} from '@automatosx/contracts';

import type { InputSchemaRegistry, OutputSchemaRegistry } from './validation.js';

/**
 * Input schema registry for all MCP tools (64 tools total)
 * INV-MCP-001: All tools MUST have input validation
 */
export const INPUT_SCHEMAS: InputSchemaRegistry = {
  // Memory tools (10)
  memory_store: MemoryStoreInputSchema,
  memory_retrieve: MemoryRetrieveInputSchema,
  memory_search: MemorySearchInputSchema,
  memory_list: MemoryListInputSchema,
  memory_delete: MemoryDeleteInputSchema,
  memory_export: MemoryExportInputSchema,
  memory_import: MemoryImportInputSchema,
  memory_stats: MemoryStatsInputSchema,
  memory_bulk_delete: MemoryBulkDeleteInputSchema,
  memory_clear: MemoryClearInputSchema,

  // Agent tools (5)
  agent_list: AgentListInputSchema,
  agent_run: AgentRunInputSchema,
  agent_get: AgentGetInputSchema,
  agent_register: AgentRegisterInputSchema,
  agent_remove: AgentRemoveInputSchema,

  // Session tools (7)
  session_create: SessionCreateInputSchema,
  session_status: SessionStatusInputSchema,
  session_complete: SessionCompleteInputSchema,
  session_list: SessionListInputSchema,
  session_join: SessionJoinInputSchema,
  session_leave: SessionLeaveInputSchema,
  session_fail: SessionFailInputSchema,

  // Guard tools (3)
  guard_check: GuardCheckInputSchema,
  guard_list: GuardListInputSchema,
  guard_apply: GuardApplyInputSchema,

  // Config tools (3)
  config_get: ConfigGetInputSchema,
  config_set: ConfigSetInputSchema,
  config_show: ConfigShowInputSchema,

  // Trace tools (3)
  trace_list: TraceListInputSchema,
  trace_get: TraceGetInputSchema,
  trace_analyze: TraceAnalyzeInputSchema,

  // Workflow tools (3)
  workflow_run: WorkflowRunInputSchema,
  workflow_list: WorkflowListInputSchema,
  workflow_describe: WorkflowDescribeInputSchema,

  // Bugfix tools (3)
  bugfix_scan: BugScanRequestSchema,
  bugfix_run: BugFixRequestSchema,
  bugfix_list: BugfixListInputSchema,

  // Refactor tools (3)
  refactor_scan: RefactorScanRequestSchema,
  refactor_apply: RefactorApplyRequestSchema,
  refactor_list: RefactorListInputSchema,

  // Design tools (5)
  design_api: ApiDesignRequestSchema,
  design_component: ComponentDesignRequestSchema,
  design_schema: SchemaDesignRequestSchema,
  design_architecture: ArchitectureDesignRequestSchema,
  design_list: DesignListInputSchema,

  // Orchestration tools (7)
  task_submit: TaskSubmitRequestSchema,
  task_status: TaskStatusInputSchema,
  task_list: TaskQueryRequestSchema,
  task_cancel: TaskCancelRequestSchema,
  task_retry: TaskRetryRequestSchema,
  queue_create: QueueCreateRequestSchema,
  queue_list: QueueListInputSchema,

  // Telemetry tools (7)
  metrics_record: RecordMetricRequestSchema,
  metrics_increment: IncrementCounterRequestSchema,
  metrics_query: QueryMetricsRequestSchema,
  metrics_list: MetricsListInputSchema,
  telemetry_summary: TelemetrySummaryRequestSchema,
  timer_start: StartTimerRequestSchema,
  timer_stop: TimerStopInputSchema,

  // Ability tools (5)
  ability_list: AbilityListInputSchema,
  ability_get: AbilityGetInputSchema,
  ability_inject: AbilityInjectInputSchema,
  ability_register: AbilityRegisterInputSchema,
  ability_remove: AbilityRemoveInputSchema,
};

/**
 * Output schema registry for all MCP tools (64 tools total)
 * INV-MCP-VAL-001: Output validation (logs but doesn't fail)
 */
export const OUTPUT_SCHEMAS: OutputSchemaRegistry = {
  // Memory tools (10)
  memory_store: MemoryStoreOutputSchema,
  memory_retrieve: MemoryRetrieveOutputSchema,
  memory_search: MemorySearchOutputSchema,
  memory_list: MemoryListOutputSchema,
  memory_delete: MemoryDeleteOutputSchema,
  memory_export: MemoryExportOutputSchema,
  memory_import: MemoryImportOutputSchema,
  memory_stats: MemoryStatsOutputSchema,
  memory_bulk_delete: MemoryBulkDeleteOutputSchema,
  memory_clear: MemoryClearOutputSchema,

  // Agent tools (5)
  agent_list: AgentListOutputSchema,
  agent_run: AgentRunOutputSchema,
  agent_get: AgentGetOutputSchema,
  agent_register: AgentRegisterOutputSchema,
  agent_remove: AgentRemoveOutputSchema,

  // Session tools (7)
  session_create: SessionCreateOutputSchema,
  session_status: SessionStatusOutputSchema,
  session_complete: SessionCompleteOutputSchema,
  session_list: SessionListOutputSchema,
  session_join: SessionJoinOutputSchema,
  session_leave: SessionLeaveOutputSchema,
  session_fail: SessionFailOutputSchema,

  // Guard tools (3)
  guard_check: GuardCheckOutputSchema,
  guard_list: GuardListOutputSchema,
  guard_apply: GuardApplyOutputSchema,

  // Config tools (3)
  config_get: ConfigGetOutputSchema,
  config_set: ConfigSetOutputSchema,
  config_show: ConfigShowOutputSchema,

  // Trace tools (3)
  trace_list: TraceListOutputSchema,
  trace_get: TraceGetOutputSchema,
  trace_analyze: TraceAnalyzeOutputSchema,

  // Workflow tools (3)
  workflow_run: WorkflowRunOutputSchema,
  workflow_list: WorkflowListOutputSchema,
  workflow_describe: WorkflowDescribeOutputSchema,

  // Bugfix tools (3)
  bugfix_scan: BugScanResultSchema,
  bugfix_run: BugFixResultSchema,
  // bugfix_list: No dedicated output schema (uses inline format)

  // Refactor tools (3)
  refactor_scan: RefactorScanResultSchema,
  refactor_apply: RefactorApplyResultSchema,
  // refactor_list: No dedicated output schema (uses inline format)

  // Design tools (5)
  design_api: ApiDesignResultSchema,
  design_component: ComponentDesignResultSchema,
  design_schema: SchemaDesignResultSchema,
  design_architecture: ArchitectureDesignResultSchema,
  // design_list: No dedicated output schema (uses inline format)

  // Orchestration tools (7)
  task_submit: TaskSubmitResultSchema,
  // task_status: Output varies by task state
  task_list: TaskQueryResultSchema,
  // task_cancel, task_retry: Simple success/error responses
  // queue_create: Returns QueueStateSchema
  queue_create: QueueStateSchema,
  // queue_list: No dedicated output schema (uses inline format)

  // Telemetry tools (7)
  // metrics_record, metrics_increment: Simple acknowledgment
  metrics_query: QueryMetricsResultSchema,
  // metrics_list: No dedicated output schema (uses inline format)
  telemetry_summary: TelemetrySummaryResultSchema,
  // timer_start, timer_stop: Simple handles/durations

  // Ability tools (5)
  ability_list: AbilityListOutputSchema,
  ability_get: AbilityGetOutputSchema,
  ability_inject: AbilityInjectOutputSchema,
  ability_register: AbilityRegisterOutputSchema,
  ability_remove: AbilityRemoveOutputSchema,
};
