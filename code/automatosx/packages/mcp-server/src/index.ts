import type { DashboardService } from '@defai.digital/monitoring';
import type { SharedRuntimeService } from '@defai.digital/shared-runtime';
import type { Readable, Writable } from 'node:stream';
import {
  createMcpStdioTransportService,
  type McpStdioServer,
} from './stdio-transport-service.js';
import {
  MCP_BASE_PATH_ENV_VAR,
  createMcpSurfaceServices,
  resolveMcpSurfaceBasePath,
} from './surface-service-factory.js';
import { createMcpToolActivityService } from './tool-activity-service.js';
import type {
  McpPromptDefinition,
  McpPromptResult,
  McpResourceContent,
  McpResourceDefinition,
  McpToolDefinition,
  MpcToolResult,
} from './surface-types.js';
import { validateInput } from './tool-schema.js';

export type {
  McpPromptArgument,
  McpPromptDefinition,
  McpPromptMessage,
  McpPromptResult,
  McpResourceContent,
  McpResourceDefinition,
  McpToolDefinition,
  MpcToolResult,
} from './surface-types.js';
export type { JsonSchema } from './tool-schema.js';
export { MCP_BASE_PATH_ENV_VAR, resolveMcpSurfaceBasePath };

export const STABLE_V15_MCP_TOOL_FAMILIES = [
  'workflow_run',
  'workflow_list',
  'workflow_describe',
  'trace_get',
  'trace_list',
  'trace_analyze',
  'trace_by_session',
  'trace_tree',
  'agent_get',
  'agent_list',
  'agent_run',
  'agent_recommend',
  'discuss_run',
  'discuss_quick',
  'discuss_recursive',
  'session_create',
  'session_get',
  'session_list',
  'session_join',
  'session_leave',
  'session_complete',
  'session_fail',
  'review_analyze',
  'review_list',
  'guard_list',
  'guard_apply',
  'guard_check',
] as const;

export const LEGACY_MCP_TOOL_ALIASES = [
  'ax_workflow_run',
  'ax_agent_list',
  'ax_discuss_run',
  'ax_review_analyze',
] as const;

export const DEFAULT_SETUP_MCP_TOOL_FAMILIES = [...STABLE_V15_MCP_TOOL_FAMILIES] as const;

export interface McpServerSurface {
  listTools(): string[];
  listToolDefinitions(): McpToolDefinition[];
  invokeTool(toolName: string, args?: Record<string, unknown>): Promise<MpcToolResult>;
  listResources(): McpResourceDefinition[];
  readResource(uri: string): Promise<McpResourceContent>;
  listPrompts(): McpPromptDefinition[];
  getPrompt(name: string, args?: Record<string, unknown>): Promise<McpPromptResult>;
}

export function createMcpStdioServer(config: {
  runtimeService?: SharedRuntimeService;
  dashboardService?: DashboardService;
  basePath?: string;
  toolPrefix?: string;
  stdin?: Readable;
  stdout?: Writable;
} = {}): McpStdioServer {
  const surface = createMcpServerSurface({
    runtimeService: config.runtimeService,
    dashboardService: config.dashboardService,
    basePath: config.basePath,
    toolPrefix: config.toolPrefix,
  });

  return createMcpStdioTransportService({
    surface,
    stdin: config.stdin,
    stdout: config.stdout,
  });
}

export function createMcpServerSurface(config: {
  runtimeService?: SharedRuntimeService;
  dashboardService?: DashboardService;
  basePath?: string;
  toolPrefix?: string;
} = {}): McpServerSurface {
  const {
    basePath,
    runtimeService,
    metadataService,
    runtimeOrchestrationToolService,
    runtimeBridgeToolService,
    runtimeStateToolService,
    runtimeSupportToolService,
    localSurfaceToolService,
    workspaceSurfaceToolService,
    supplementalSurfaceToolService,
  } = createMcpSurfaceServices(config);
  const activityService = createMcpToolActivityService({
    runtimeService,
    basePath,
  });

  return {
    listTools() {
      return metadataService.listTools();
    },

    listToolDefinitions() {
      return metadataService.listToolDefinitions();
    },

    listResources() {
      return metadataService.listResources();
    },

    async readResource(uri) {
      return metadataService.readResource(uri);
    },

    listPrompts() {
      return metadataService.listPrompts();
    },

    async getPrompt(name, args = {}) {
      return metadataService.getPrompt(name, args);
    },

    async invokeTool(toolName, args = {}) {
      const startedAtMs = Date.now();
      try {
        const canonicalToolName = metadataService.resolveCanonicalToolName(toolName);
        const definition = metadataService.getToolDefinition(canonicalToolName);
        if (definition === undefined) {
          return {
            success: false,
            error: `Unknown tool: ${toolName}`,
          };
        }

        const effectiveArgs = activityService.augmentArgs(canonicalToolName, args);
        const validationError = validateInput(effectiveArgs, definition.inputSchema);
        if (validationError !== undefined) {
          const result = {
            success: false,
            error: validationError,
          };
          await activityService.recordInvocation(canonicalToolName, effectiveArgs, result, startedAtMs);
          return result;
        }

        const runtimeOrchestrationResult = await runtimeOrchestrationToolService.invokeTool(
          canonicalToolName,
          effectiveArgs,
        );
        if (runtimeOrchestrationResult !== undefined) {
          await activityService.recordInvocation(canonicalToolName, effectiveArgs, runtimeOrchestrationResult, startedAtMs);
          return runtimeOrchestrationResult;
        }

        const runtimeBridgeResult = await runtimeBridgeToolService.invokeTool(
          canonicalToolName,
          effectiveArgs,
        );
        if (runtimeBridgeResult !== undefined) {
          await activityService.recordInvocation(canonicalToolName, effectiveArgs, runtimeBridgeResult, startedAtMs);
          return runtimeBridgeResult;
        }

        const runtimeStateResult = await runtimeStateToolService.invokeTool(
          canonicalToolName,
          effectiveArgs,
        );
        if (runtimeStateResult !== undefined) {
          await activityService.recordInvocation(canonicalToolName, effectiveArgs, runtimeStateResult, startedAtMs);
          return runtimeStateResult;
        }

        const runtimeSupportResult = await runtimeSupportToolService.invokeTool(
          canonicalToolName,
          effectiveArgs,
        );
        if (runtimeSupportResult !== undefined) {
          await activityService.recordInvocation(canonicalToolName, effectiveArgs, runtimeSupportResult, startedAtMs);
          return runtimeSupportResult;
        }

        const localSurfaceResult = await localSurfaceToolService.invokeTool(
          canonicalToolName,
          effectiveArgs,
        );
        if (localSurfaceResult !== undefined) {
          await activityService.recordInvocation(canonicalToolName, effectiveArgs, localSurfaceResult, startedAtMs);
          return localSurfaceResult;
        }

        const workspaceSurfaceResult = await workspaceSurfaceToolService.invokeTool(
          canonicalToolName,
          effectiveArgs,
        );
        if (workspaceSurfaceResult !== undefined) {
          await activityService.recordInvocation(canonicalToolName, effectiveArgs, workspaceSurfaceResult, startedAtMs);
          return workspaceSurfaceResult;
        }

        const supplementalSurfaceResult = await supplementalSurfaceToolService.invokeTool(
          canonicalToolName,
          effectiveArgs,
        );
        if (supplementalSurfaceResult !== undefined) {
          await activityService.recordInvocation(canonicalToolName, effectiveArgs, supplementalSurfaceResult, startedAtMs);
          return supplementalSurfaceResult;
        }

        const result = {
          success: false,
          error: `Unknown tool: ${canonicalToolName}`,
        };
        await activityService.recordInvocation(canonicalToolName, effectiveArgs, result, startedAtMs);
        return result;
      } catch (error) {
        const failureResult = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
        const canonicalToolName = metadataService.resolveCanonicalToolName(toolName);
        const effectiveArgs = activityService.augmentArgs(canonicalToolName, args);
        await activityService.recordInvocation(canonicalToolName, effectiveArgs, failureResult, startedAtMs);
        return failureResult;
      }
    },
  };
}
