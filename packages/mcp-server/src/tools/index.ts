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
  handleAgentList,
  handleAgentRun,
  handleAgentGet,
  handleAgentRegister,
  handleAgentRemove,
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

// Bugfix tools
export {
  bugfixScanTool,
  bugfixRunTool,
  bugfixListTool,
  handleBugfixScan,
  handleBugfixRun,
  handleBugfixList,
} from './bugfix.js';

// Refactor tools
export {
  refactorScanTool,
  refactorApplyTool,
  refactorListTool,
  handleRefactorScan,
  handleRefactorApply,
  handleRefactorList,
} from './refactor.js';

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
  handleAgentList,
  handleAgentRun,
  handleAgentGet,
  handleAgentRegister,
  handleAgentRemove,
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
  bugfixScanTool,
  bugfixRunTool,
  bugfixListTool,
  handleBugfixScan,
  handleBugfixRun,
  handleBugfixList,
} from './bugfix.js';

import {
  refactorScanTool,
  refactorApplyTool,
  refactorListTool,
  handleRefactorScan,
  handleRefactorApply,
  handleRefactorList,
} from './refactor.js';

/**
 * All available tools (37 total)
 *
 * Removed tools (27):
 * - design_* (5): LLM generates OpenAPI/Zod/diagrams natively
 * - task_*, queue_* (7): Advanced orchestration, most users don't need
 * - metrics_*, timer_*, telemetry_* (7): Observability, not core function
 * - memory_export, memory_import, memory_stats, memory_bulk_delete, memory_clear (5): Rare admin ops
 * - ability_get, ability_register, ability_remove (3): Use CLI for setup, not runtime
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
  // Agent tools (5)
  agentListTool,
  agentRunTool,
  agentGetTool,
  agentRegisterTool,
  agentRemoveTool,
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
  // Bugfix tools (3)
  bugfixScanTool,
  bugfixRunTool,
  bugfixListTool,
  // Refactor tools (3)
  refactorScanTool,
  refactorApplyTool,
  refactorListTool,
];

/**
 * Raw tool handlers by name (37 handlers)
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
  // Agent handlers (5)
  agent_list: handleAgentList,
  agent_run: handleAgentRun,
  agent_get: handleAgentGet,
  agent_register: handleAgentRegister,
  agent_remove: handleAgentRemove,
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
  // Bugfix handlers (3)
  bugfix_scan: handleBugfixScan,
  bugfix_run: handleBugfixRun,
  bugfix_list: handleBugfixList,
  // Refactor handlers (3)
  refactor_scan: handleRefactorScan,
  refactor_apply: handleRefactorApply,
  refactor_list: handleRefactorList,
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
