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

// Trace tools
export {
  traceListTool,
  traceGetTool,
  traceAnalyzeTool,
  handleTraceList,
  handleTraceGet,
  handleTraceAnalyze,
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
  handleSessionCreate,
  handleSessionStatus,
  handleSessionComplete,
  handleSessionList,
  handleSessionJoin,
  handleSessionLeave,
  handleSessionFail,
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
  handleDiscuss,
  handleDiscussQuick,
  DISCUSS_TOOLS,
  DISCUSS_HANDLERS,
} from './discuss.js';

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
  handleTraceList,
  handleTraceGet,
  handleTraceAnalyze,
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
  handleSessionCreate,
  handleSessionStatus,
  handleSessionComplete,
  handleSessionList,
  handleSessionJoin,
  handleSessionLeave,
  handleSessionFail,
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
  handleDiscuss,
  handleDiscussQuick,
} from './discuss.js';

/**
 * All available tools (44 total)
 *
 * Removed tools:
 * - design_* (5): LLM generates OpenAPI/Zod/diagrams natively
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
  // Trace tools (3)
  traceListTool,
  traceGetTool,
  traceAnalyzeTool,
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
  // Session tools (7)
  sessionCreateTool,
  sessionStatusTool,
  sessionCompleteTool,
  sessionListTool,
  sessionJoinTool,
  sessionLeaveTool,
  sessionFailTool,
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
  // Discuss tools (2)
  discussTool,
  discussQuickTool,
];

/**
 * Raw tool handlers by name (44 handlers)
 * These are the unwrapped handlers - use TOOL_HANDLERS for production
 */
const RAW_HANDLERS: Record<string, ToolHandler> = {
  // Workflow handlers (3)
  workflow_run: handleWorkflowRun,
  workflow_list: handleWorkflowList,
  workflow_describe: handleWorkflowDescribe,
  // Trace handlers (3)
  trace_list: handleTraceList,
  trace_get: handleTraceGet,
  trace_analyze: handleTraceAnalyze,
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
  // Session handlers (7)
  session_create: handleSessionCreate,
  session_status: handleSessionStatus,
  session_complete: handleSessionComplete,
  session_list: handleSessionList,
  session_join: handleSessionJoin,
  session_leave: handleSessionLeave,
  session_fail: handleSessionFail,
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
  // Discuss handlers (2)
  discuss: handleDiscuss,
  discuss_quick: handleDiscussQuick,
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
