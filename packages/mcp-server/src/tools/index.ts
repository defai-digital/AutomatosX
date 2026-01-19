import type { MCPTool, ToolHandler } from '../types.js';
import { wrapHandlersWithInputValidation } from '../validation.js';
import { INPUT_SCHEMAS } from '../schema-registry.js';

// Workflow tools
export {
  workflowRunTool,
  workflowListTool,
  workflowDescribeTool,
  handleWorkflowRun,
  handleWorkflowList,
  handleWorkflowDescribe,
} from './workflow.js';

// Trace tools (including hierarchical tracing - INV-TR-020 through INV-TR-024)
export {
  traceListTool,
  traceGetTool,
  traceAnalyzeTool,
  traceTreeTool,
  traceBySessionTool,
  traceCloseStuckTool,
  handleTraceList,
  handleTraceGet,
  handleTraceAnalyze,
  handleTraceTree,
  handleTraceBySession,
  handleTraceCloseStuck,
} from './trace.js';

// Memory tools (core only - admin tools removed)
export {
  memoryStoreTool,
  memoryRetrieveTool,
  memorySearchTool,
  memoryListTool,
  memoryDeleteTool,
  handleMemoryStore,
  handleMemoryRetrieve,
  handleMemorySearch,
  handleMemoryList,
  handleMemoryDelete,
} from './memory.js';

// Guard tools
export {
  guardCheckTool,
  guardListTool,
  guardApplyTool,
  handleGuardCheck,
  handleGuardList,
  handleGuardApply,
} from './guard.js';

// Agent tools
export {
  agentListTool,
  agentRunTool,
  agentGetTool,
  agentRegisterTool,
  agentRemoveTool,
  agentRecommendTool,
  agentCapabilitiesTool,
  handleAgentList,
  handleAgentRun,
  handleAgentGet,
  handleAgentRegister,
  handleAgentRemove,
  handleAgentRecommend,
  handleAgentCapabilities,
} from './agent.js';

// Ability tools (core only - admin tools moved to CLI)
export {
  abilityListTool,
  abilityInjectTool,
  handleAbilityList,
  handleAbilityInject,
} from './ability.js';

// Session tools
export {
  sessionCreateTool,
  sessionStatusTool,
  sessionCompleteTool,
  sessionListTool,
  sessionJoinTool,
  sessionLeaveTool,
  sessionFailTool,
  sessionCloseStuckTool,
  handleSessionCreate,
  handleSessionStatus,
  handleSessionComplete,
  handleSessionList,
  handleSessionJoin,
  handleSessionLeave,
  handleSessionFail,
  handleSessionCloseStuck,
} from './session.js';

// Config tools
export {
  configGetTool,
  configSetTool,
  configShowTool,
  handleConfigGet,
  handleConfigSet,
  handleConfigShow,
} from './config.js';

// Review tools (replaces bugfix and refactor)
export {
  reviewAnalyzeTool,
  reviewListTool,
  handleReviewAnalyze,
  handleReviewList,
} from './review.js';

// File System tools
export {
  fileWriteTool,
  directoryCreateTool,
  fileExistsTool,
  handleFileWrite,
  handleDirectoryCreate,
  handleFileExists,
  FILE_SYSTEM_TOOLS,
  FILE_SYSTEM_HANDLERS,
} from './file-system.js';

// Scaffold tools
export {
  scaffoldContractTool,
  scaffoldDomainTool,
  scaffoldGuardTool,
  handleScaffoldContract,
  handleScaffoldDomain,
  handleScaffoldGuard,
  SCAFFOLD_TOOLS,
  SCAFFOLD_HANDLERS,
} from './scaffold.js';

// Discuss tools
export {
  discussTool,
  discussQuickTool,
  discussRecursiveTool,
  handleDiscuss,
  handleDiscussQuick,
  handleDiscussRecursive,
  resetProviderBridge,
  DISCUSS_TOOLS,
  DISCUSS_HANDLERS,
} from './discuss.js';

// Parallel tools
export {
  parallelRunTool,
  parallelPlanTool,
  handleParallelRun,
  handleParallelPlan,
  PARALLEL_TOOLS,
  PARALLEL_HANDLERS,
} from './parallel.js';

// Semantic tools
export {
  semanticStoreTool,
  semanticSearchTool,
  semanticGetTool,
  semanticListTool,
  semanticDeleteTool,
  semanticStatsTool,
  semanticClearTool,
  handleSemanticStore,
  handleSemanticSearch,
  handleSemanticGet,
  handleSemanticList,
  handleSemanticDelete,
  handleSemanticStats,
  handleSemanticClear,
} from './semantic.js';

// MCP Ecosystem tools
export {
  mcpServerRegisterTool,
  mcpServerListTool,
  mcpServerUnregisterTool,
  mcpToolsDiscoverTool,
  mcpToolInvokeTool,
  mcpToolsListTool,
  handleMCPServerRegister,
  handleMCPServerList,
  handleMCPServerUnregister,
  handleMCPToolsDiscover,
  handleMCPToolInvoke,
  handleMCPToolsList,
  MCP_ECOSYSTEM_TOOLS,
  MCP_ECOSYSTEM_HANDLERS,
} from './mcp-ecosystem.js';

// Research tools
export {
  researchQueryTool,
  researchFetchTool,
  researchSynthesizeTool,
  handleResearchQuery,
  handleResearchFetch,
  handleResearchSynthesize,
  RESEARCH_TOOLS,
  RESEARCH_HANDLERS,
} from './research.js';

// Feedback tools
export {
  feedbackSubmitTool,
  feedbackHistoryTool,
  feedbackStatsTool,
  feedbackOverviewTool,
  feedbackAdjustmentsTool,
  handleFeedbackSubmit,
  handleFeedbackHistory,
  handleFeedbackStats,
  handleFeedbackOverview,
  handleFeedbackAdjustments,
  FEEDBACK_TOOLS,
  FEEDBACK_HANDLERS,
} from './feedback.js';

// Design tools
export {
  designApiTool,
  designComponentTool,
  designSchemaTool,
  designArchitectureTool,
  designListTool,
  handleDesignApi,
  handleDesignComponent,
  handleDesignSchema,
  handleDesignArchitecture,
  handleDesignList,
} from './design.js';

// Re-export for convenience
import {
  workflowRunTool,
  workflowListTool,
  workflowDescribeTool,
  handleWorkflowRun,
  handleWorkflowList,
  handleWorkflowDescribe,
} from './workflow.js';

import {
  traceListTool,
  traceGetTool,
  traceAnalyzeTool,
  traceTreeTool,
  traceBySessionTool,
  traceCloseStuckTool,
  handleTraceList,
  handleTraceGet,
  handleTraceAnalyze,
  handleTraceTree,
  handleTraceBySession,
  handleTraceCloseStuck,
} from './trace.js';

import {
  memoryStoreTool,
  memoryRetrieveTool,
  memorySearchTool,
  memoryListTool,
  memoryDeleteTool,
  handleMemoryStore,
  handleMemoryRetrieve,
  handleMemorySearch,
  handleMemoryList,
  handleMemoryDelete,
} from './memory.js';

import {
  guardCheckTool,
  guardListTool,
  guardApplyTool,
  handleGuardCheck,
  handleGuardList,
  handleGuardApply,
} from './guard.js';

import {
  agentListTool,
  agentRunTool,
  agentGetTool,
  agentRegisterTool,
  agentRemoveTool,
  agentRecommendTool,
  agentCapabilitiesTool,
  handleAgentList,
  handleAgentRun,
  handleAgentGet,
  handleAgentRegister,
  handleAgentRemove,
  handleAgentRecommend,
  handleAgentCapabilities,
} from './agent.js';

import {
  abilityListTool,
  abilityInjectTool,
  handleAbilityList,
  handleAbilityInject,
} from './ability.js';

import {
  sessionCreateTool,
  sessionStatusTool,
  sessionCompleteTool,
  sessionListTool,
  sessionJoinTool,
  sessionLeaveTool,
  sessionFailTool,
  sessionCloseStuckTool,
  handleSessionCreate,
  handleSessionStatus,
  handleSessionComplete,
  handleSessionList,
  handleSessionJoin,
  handleSessionLeave,
  handleSessionFail,
  handleSessionCloseStuck,
} from './session.js';

import {
  configGetTool,
  configSetTool,
  configShowTool,
  handleConfigGet,
  handleConfigSet,
  handleConfigShow,
} from './config.js';

import {
  reviewAnalyzeTool,
  reviewListTool,
  handleReviewAnalyze,
  handleReviewList,
} from './review.js';

import {
  fileWriteTool,
  directoryCreateTool,
  fileExistsTool,
  handleFileWrite,
  handleDirectoryCreate,
  handleFileExists,
} from './file-system.js';

import {
  scaffoldContractTool,
  scaffoldDomainTool,
  scaffoldGuardTool,
  handleScaffoldContract,
  handleScaffoldDomain,
  handleScaffoldGuard,
} from './scaffold.js';

import {
  discussTool,
  discussQuickTool,
  discussRecursiveTool,
  handleDiscuss,
  handleDiscussQuick,
  handleDiscussRecursive,
} from './discuss.js';

import {
  parallelRunTool,
  parallelPlanTool,
  handleParallelRun,
  handleParallelPlan,
} from './parallel.js';

import {
  semanticStoreTool,
  semanticSearchTool,
  semanticGetTool,
  semanticListTool,
  semanticDeleteTool,
  semanticStatsTool,
  semanticClearTool,
  handleSemanticStore,
  handleSemanticSearch,
  handleSemanticGet,
  handleSemanticList,
  handleSemanticDelete,
  handleSemanticStats,
  handleSemanticClear,
} from './semantic.js';

import {
  mcpServerRegisterTool,
  mcpServerListTool,
  mcpServerUnregisterTool,
  mcpToolsDiscoverTool,
  mcpToolInvokeTool,
  mcpToolsListTool,
  handleMCPServerRegister,
  handleMCPServerList,
  handleMCPServerUnregister,
  handleMCPToolsDiscover,
  handleMCPToolInvoke,
  handleMCPToolsList,
} from './mcp-ecosystem.js';

import {
  researchQueryTool,
  researchFetchTool,
  researchSynthesizeTool,
  handleResearchQuery,
  handleResearchFetch,
  handleResearchSynthesize,
} from './research.js';

import {
  feedbackSubmitTool,
  feedbackHistoryTool,
  feedbackStatsTool,
  feedbackOverviewTool,
  feedbackAdjustmentsTool,
  handleFeedbackSubmit,
  handleFeedbackHistory,
  handleFeedbackStats,
  handleFeedbackOverview,
  handleFeedbackAdjustments,
} from './feedback.js';

import {
  designApiTool,
  designComponentTool,
  designSchemaTool,
  designArchitectureTool,
  designListTool,
  handleDesignApi,
  handleDesignComponent,
  handleDesignSchema,
  handleDesignArchitecture,
  handleDesignList,
} from './design.js';

/**
 * All available tools (81 total)
 *
 * Removed tools:
 * - task_*, queue_* (7): Advanced orchestration, most users don't need
 * - metrics_*, timer_*, telemetry_* (7): Observability, not core function
 * - memory_export, memory_import, memory_stats, memory_bulk_delete, memory_clear (5): Rare admin ops
 * - ability_get, ability_register, ability_remove (3): Use CLI for setup, not runtime
 * - bugfix_* (3): Replaced by review_analyze --focus correctness
 * - refactor_* (3): Replaced by review_analyze --focus maintainability
 */
export const ALL_TOOLS: MCPTool[] = [
  // Workflow tools (3)
  workflowRunTool,
  workflowListTool,
  workflowDescribeTool,
  // Trace tools (6) - includes hierarchical tracing
  traceListTool,
  traceGetTool,
  traceAnalyzeTool,
  traceTreeTool,
  traceBySessionTool,
  traceCloseStuckTool,
  // Memory tools (5) - core only
  memoryStoreTool,
  memoryRetrieveTool,
  memorySearchTool,
  memoryListTool,
  memoryDeleteTool,
  // Guard tools (3)
  guardCheckTool,
  guardListTool,
  guardApplyTool,
  // Agent tools (7) - includes recommend and capabilities
  agentListTool,
  agentRunTool,
  agentGetTool,
  agentRegisterTool,
  agentRemoveTool,
  agentRecommendTool,
  agentCapabilitiesTool,
  // Ability tools (2) - core only
  abilityListTool,
  abilityInjectTool,
  // Session tools (8)
  sessionCreateTool,
  sessionStatusTool,
  sessionCompleteTool,
  sessionListTool,
  sessionJoinTool,
  sessionLeaveTool,
  sessionFailTool,
  sessionCloseStuckTool,
  // Config tools (3)
  configGetTool,
  configSetTool,
  configShowTool,
  // Review tools (2) - replaces bugfix and refactor
  reviewAnalyzeTool,
  reviewListTool,
  // File System tools (3)
  fileWriteTool,
  directoryCreateTool,
  fileExistsTool,
  // Scaffold tools (3)
  scaffoldContractTool,
  scaffoldDomainTool,
  scaffoldGuardTool,
  // Discuss tools (3)
  discussTool,
  discussQuickTool,
  discussRecursiveTool,
  // Parallel tools (2)
  parallelRunTool,
  parallelPlanTool,
  // Semantic tools (7)
  semanticStoreTool,
  semanticSearchTool,
  semanticGetTool,
  semanticListTool,
  semanticDeleteTool,
  semanticStatsTool,
  semanticClearTool,
  // MCP Ecosystem tools (6)
  mcpServerRegisterTool,
  mcpServerListTool,
  mcpServerUnregisterTool,
  mcpToolsDiscoverTool,
  mcpToolInvokeTool,
  mcpToolsListTool,
  // Research tools (3)
  researchQueryTool,
  researchFetchTool,
  researchSynthesizeTool,
  // Feedback tools (5)
  feedbackSubmitTool,
  feedbackHistoryTool,
  feedbackStatsTool,
  feedbackOverviewTool,
  feedbackAdjustmentsTool,
  // Design tools (5)
  designApiTool,
  designComponentTool,
  designSchemaTool,
  designArchitectureTool,
  designListTool,
];

/**
 * Raw tool handlers by name (68 handlers)
 * These are the unwrapped handlers - use TOOL_HANDLERS for production
 */
const RAW_HANDLERS: Record<string, ToolHandler> = {
  // Workflow handlers (3)
  workflow_run: handleWorkflowRun,
  workflow_list: handleWorkflowList,
  workflow_describe: handleWorkflowDescribe,
  // Trace handlers (6) - includes hierarchical tracing
  trace_list: handleTraceList,
  trace_get: handleTraceGet,
  trace_analyze: handleTraceAnalyze,
  trace_tree: handleTraceTree,
  trace_by_session: handleTraceBySession,
  trace_close_stuck: handleTraceCloseStuck,
  // Memory handlers (5) - core only
  memory_store: handleMemoryStore,
  memory_retrieve: handleMemoryRetrieve,
  memory_search: handleMemorySearch,
  memory_list: handleMemoryList,
  memory_delete: handleMemoryDelete,
  // Guard handlers (3)
  guard_check: handleGuardCheck,
  guard_list: handleGuardList,
  guard_apply: handleGuardApply,
  // Agent handlers (7) - includes recommend and capabilities
  agent_list: handleAgentList,
  agent_run: handleAgentRun,
  agent_get: handleAgentGet,
  agent_register: handleAgentRegister,
  agent_remove: handleAgentRemove,
  agent_recommend: handleAgentRecommend,
  agent_capabilities: handleAgentCapabilities,
  // Ability handlers (2) - core only
  ability_list: handleAbilityList,
  ability_inject: handleAbilityInject,
  // Session handlers (8)
  session_create: handleSessionCreate,
  session_status: handleSessionStatus,
  session_complete: handleSessionComplete,
  session_list: handleSessionList,
  session_join: handleSessionJoin,
  session_leave: handleSessionLeave,
  session_fail: handleSessionFail,
  session_close_stuck: handleSessionCloseStuck,
  // Config handlers (3)
  config_get: handleConfigGet,
  config_set: handleConfigSet,
  config_show: handleConfigShow,
  // Review handlers (2) - replaces bugfix and refactor
  review_analyze: handleReviewAnalyze,
  review_list: handleReviewList,
  // File System handlers (3)
  file_write: handleFileWrite,
  directory_create: handleDirectoryCreate,
  file_exists: handleFileExists,
  // Scaffold handlers (3)
  scaffold_contract: handleScaffoldContract,
  scaffold_domain: handleScaffoldDomain,
  scaffold_guard: handleScaffoldGuard,
  // Discuss handlers (3)
  discuss: handleDiscuss,
  discuss_quick: handleDiscussQuick,
  discuss_recursive: handleDiscussRecursive,
  // Parallel handlers (2)
  parallel_run: handleParallelRun,
  parallel_plan: handleParallelPlan,
  // Semantic handlers (7)
  semantic_store: handleSemanticStore,
  semantic_search: handleSemanticSearch,
  semantic_get: handleSemanticGet,
  semantic_list: handleSemanticList,
  semantic_delete: handleSemanticDelete,
  semantic_stats: handleSemanticStats,
  semantic_clear: handleSemanticClear,
  // MCP Ecosystem handlers (6)
  mcp_server_register: handleMCPServerRegister,
  mcp_server_list: handleMCPServerList,
  mcp_server_unregister: handleMCPServerUnregister,
  mcp_tools_discover: handleMCPToolsDiscover,
  mcp_tool_invoke: handleMCPToolInvoke,
  mcp_tools_list: handleMCPToolsList,
  // Research handlers (3)
  research_query: handleResearchQuery,
  research_fetch: handleResearchFetch,
  research_synthesize: handleResearchSynthesize,
  // Feedback handlers (5)
  feedback_submit: handleFeedbackSubmit,
  feedback_history: handleFeedbackHistory,
  feedback_stats: handleFeedbackStats,
  feedback_overview: handleFeedbackOverview,
  feedback_adjustments: handleFeedbackAdjustments,
  // Design handlers (5)
  design_api: handleDesignApi,
  design_component: handleDesignComponent,
  design_schema: handleDesignSchema,
  design_architecture: handleDesignArchitecture,
  design_list: handleDesignList,
};

/**
 * Tool handlers wrapped with input validation (INV-MCP-001)
 *
 * All handlers are wrapped to enforce input validation BEFORE execution.
 * Handlers with schemas in INPUT_SCHEMAS get Zod validation.
 * Handlers without schemas pass through unchanged (with a warning logged).
 */
export const TOOL_HANDLERS: Record<string, ToolHandler> = wrapHandlersWithInputValidation(
  RAW_HANDLERS,
  INPUT_SCHEMAS
);
