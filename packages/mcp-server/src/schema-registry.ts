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
  AgentRecommendRequestSchema,
  AgentRecommendResultSchema,
  AgentCapabilitiesRequestSchema,
  AgentCapabilitiesResultSchema,
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
  // File System tool schemas
  FileWriteInputSchema,
  FileWriteOutputSchema,
  DirectoryCreateInputSchema,
  DirectoryCreateOutputSchema,
  FileExistsInputSchema,
  FileExistsOutputSchema,
  // Scaffold tool schemas
  ScaffoldContractInputSchema,
  ScaffoldContractOutputSchema,
  ScaffoldDomainInputSchema,
  ScaffoldDomainOutputSchema,
  ScaffoldGuardInputSchema,
  ScaffoldGuardOutputSchema,
  // Review tool schemas
  ReviewRequestSchema,
  ReviewListInputSchema,
  ReviewResultSchema,
  // Discussion tool schemas
  DiscussionRequestSchema,
  DiscussionResultSchema,
} from '@defai.digital/contracts';

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

  // Agent tools (7)
  agent_list: AgentListInputSchema,
  agent_run: AgentRunInputSchema,
  agent_get: AgentGetInputSchema,
  agent_register: AgentRegisterInputSchema,
  agent_remove: AgentRemoveInputSchema,
  agent_recommend: AgentRecommendRequestSchema,
  agent_capabilities: AgentCapabilitiesRequestSchema,

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

  // File System tools (3)
  file_write: FileWriteInputSchema,
  directory_create: DirectoryCreateInputSchema,
  file_exists: FileExistsInputSchema,

  // Scaffold tools (3)
  scaffold_contract: ScaffoldContractInputSchema,
  scaffold_domain: ScaffoldDomainInputSchema,
  scaffold_guard: ScaffoldGuardInputSchema,

  // Review tools (2)
  review_analyze: ReviewRequestSchema,
  review_list: ReviewListInputSchema,

  // Discussion tools (2)
  discuss: DiscussionRequestSchema,
  discuss_quick: DiscussionRequestSchema, // Uses same schema with defaults
};

/**
 * Output schema registry for all MCP tools (54 tools with output schemas)
 * INV-MCP-VAL-001: Output validation (logs but doesn't fail)
 * Note: Not all tools have dedicated output schemas - some use inline formats
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

  // Agent tools (7)
  agent_list: AgentListOutputSchema,
  agent_run: AgentRunOutputSchema,
  agent_get: AgentGetOutputSchema,
  agent_register: AgentRegisterOutputSchema,
  agent_remove: AgentRemoveOutputSchema,
  agent_recommend: AgentRecommendResultSchema,
  agent_capabilities: AgentCapabilitiesResultSchema,

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

  // File System tools (3)
  file_write: FileWriteOutputSchema,
  directory_create: DirectoryCreateOutputSchema,
  file_exists: FileExistsOutputSchema,

  // Scaffold tools (3)
  scaffold_contract: ScaffoldContractOutputSchema,
  scaffold_domain: ScaffoldDomainOutputSchema,
  scaffold_guard: ScaffoldGuardOutputSchema,

  // Review tools (2)
  review_analyze: ReviewResultSchema,
  review_list: ReviewResultSchema,

  // Discussion tools (2)
  discuss: DiscussionResultSchema,
  discuss_quick: DiscussionResultSchema,
};
