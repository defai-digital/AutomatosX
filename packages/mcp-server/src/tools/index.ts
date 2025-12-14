import type { MCPTool, ToolHandler } from '../types.js';

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

// Memory tools
export {
  memoryStoreTool,
  memoryRetrieveTool,
  memorySearchTool,
  handleMemoryStore,
  handleMemoryRetrieve,
  handleMemorySearch,
} from './memory.js';

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
  handleMemoryStore,
  handleMemoryRetrieve,
  handleMemorySearch,
} from './memory.js';

/**
 * All available tools
 */
export const ALL_TOOLS: MCPTool[] = [
  workflowRunTool,
  workflowListTool,
  workflowDescribeTool,
  traceListTool,
  traceGetTool,
  traceAnalyzeTool,
  memoryStoreTool,
  memoryRetrieveTool,
  memorySearchTool,
];

/**
 * Tool handlers by name
 */
export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  workflow_run: handleWorkflowRun,
  workflow_list: handleWorkflowList,
  workflow_describe: handleWorkflowDescribe,
  trace_list: handleTraceList,
  trace_get: handleTraceGet,
  trace_analyze: handleTraceAnalyze,
  memory_store: handleMemoryStore,
  memory_retrieve: handleMemoryRetrieve,
  memory_search: handleMemorySearch,
};
