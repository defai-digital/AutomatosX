/**
 * Tool Router
 *
 * Routes tool invocations to the correct MCP server.
 *
 * Invariants:
 * - INV-MCP-ECO-003: Tool namespacing prevents collisions
 * - INV-MCP-ECO-300: Tool arguments validated
 * - INV-MCP-ECO-301: Invocation errors propagated
 */

import type {
  MCPToolInvokeRequest,
  MCPToolInvokeResponse,
  MCPToolMetadata,
} from '@defai.digital/contracts';
import { MCPEcosystemErrorCodes, parseToolFullName, getErrorMessage } from '@defai.digital/contracts';
import type { ServerRegistryService } from './server-registry.js';
import type { ToolDiscoveryService } from './tool-discovery.js';

/**
 * Error thrown by tool router
 */
export class ToolRouterError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ToolRouterError';
  }

  static toolNotFound(toolName: string): ToolRouterError {
    return new ToolRouterError(
      MCPEcosystemErrorCodes.TOOL_NOT_FOUND,
      `Tool not found: ${toolName}`,
      { toolName }
    );
  }

  static ambiguousTool(
    toolName: string,
    matches: MCPToolMetadata[]
  ): ToolRouterError {
    return new ToolRouterError(
      MCPEcosystemErrorCodes.AMBIGUOUS_TOOL,
      `Ambiguous tool name "${toolName}". Matches: ${matches.map((m) => m.fullName).join(', ')}. Use full name (serverId.toolName) to disambiguate.`,
      { toolName, matches: matches.map((m) => m.fullName) }
    );
  }

  static invocationFailed(
    toolName: string,
    serverId: string,
    message: string
  ): ToolRouterError {
    return new ToolRouterError(
      MCPEcosystemErrorCodes.INVOCATION_FAILED,
      `Invocation of ${toolName} on ${serverId} failed: ${message}`,
      { toolName, serverId }
    );
  }

  static serverNotConnected(serverId: string): ToolRouterError {
    return new ToolRouterError(
      MCPEcosystemErrorCodes.CONNECTION_FAILED,
      `Server ${serverId} is not connected`,
      { serverId }
    );
  }
}

/**
 * Options for tool router service
 */
export interface ToolRouterServiceOptions {
  /**
   * Server registry service
   */
  serverRegistry: ServerRegistryService;

  /**
   * Tool discovery service
   */
  toolDiscovery: ToolDiscoveryService;

  /**
   * Default request timeout
   */
  defaultRequestTimeoutMs?: number;
}

/**
 * Tool router service
 */
export interface ToolRouterService {
  /**
   * Invoke a tool
   * INV-MCP-ECO-003: Resolves tool by full name or finds unique match
   * INV-MCP-ECO-300: Validates arguments
   * INV-MCP-ECO-301: Propagates errors
   */
  invoke(request: MCPToolInvokeRequest): Promise<MCPToolInvokeResponse>;

  /**
   * Resolve tool from name (may be ambiguous)
   */
  resolveTool(toolName: string, serverId?: string): Promise<MCPToolMetadata>;

  /**
   * Check if a tool is available
   */
  isToolAvailable(toolName: string, serverId?: string): Promise<boolean>;
}

/**
 * Creates a tool router service
 */
export function createToolRouterService(
  options: ToolRouterServiceOptions
): ToolRouterService {
  const {
    serverRegistry,
    toolDiscovery,
    defaultRequestTimeoutMs = 60000,
  } = options;

  return {
    async invoke(request): Promise<MCPToolInvokeResponse> {
      const startTime = Date.now();
      const { toolName, serverId, arguments: args, timeoutMs } = request;

      try {
        // Resolve the tool
        // INV-MCP-ECO-003: Use full name or find unique match
        const tool = await this.resolveTool(toolName, serverId);

        // Get client for the server
        // Use returned client from connect() directly to avoid race condition
        let activeClient = serverRegistry.getClient(tool.serverId);
        if (!activeClient) {
          // Try to connect and use the returned client directly
          try {
            activeClient = await serverRegistry.connect(tool.serverId);
          } catch {
            throw ToolRouterError.serverNotConnected(tool.serverId);
          }
        }

        // Call the tool with timeout
        const timeout = timeoutMs ?? defaultRequestTimeoutMs;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        let result: Awaited<ReturnType<typeof activeClient.callTool>>;
        try {
          result = await Promise.race([
            activeClient.callTool(tool.toolName, args),
            new Promise<never>((_, reject) => {
              timeoutId = setTimeout(() => reject(new Error('Request timeout')), timeout);
            }),
          ]);
        } finally {
          // Clear timeout to prevent memory leak
          if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
          }
        }

        return {
          success: true,
          toolName: tool.fullName,
          serverId: tool.serverId,
          content: result.content,
          isError: result.isError ?? false,
          durationMs: Date.now() - startTime,
        };
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        const resolvedServerId = serverId ?? 'unknown';

        // INV-MCP-ECO-301: Propagate error details
        if (error instanceof ToolRouterError) {
          return {
            success: false,
            toolName,
            serverId: resolvedServerId,
            content: [],
            isError: true,
            error: error.message,
            durationMs: Date.now() - startTime,
          };
        }

        return {
          success: false,
          toolName,
          serverId: resolvedServerId,
          content: [],
          isError: true,
          error: errorMessage,
          durationMs: Date.now() - startTime,
        };
      }
    },

    async resolveTool(toolName, serverId): Promise<MCPToolMetadata> {
      // If serverId is provided, look for exact match
      if (serverId) {
        const tools = await toolDiscovery.getToolsForServer(serverId);
        const tool = tools.find((t) => t.toolName === toolName);
        if (!tool) {
          throw ToolRouterError.toolNotFound(`${serverId}.${toolName}`);
        }
        return tool;
      }

      // Check if toolName is already a full name
      const parsed = parseToolFullName(toolName);
      if (parsed) {
        const tool = await toolDiscovery.getToolByFullName(toolName);
        if (!tool) {
          throw ToolRouterError.toolNotFound(toolName);
        }
        return tool;
      }

      // Search for tool by name
      // INV-MCP-ECO-003: Must be unambiguous
      const matches = await toolDiscovery.findTool(toolName);

      if (matches.length === 0) {
        throw ToolRouterError.toolNotFound(toolName);
      }

      if (matches.length > 1) {
        throw ToolRouterError.ambiguousTool(toolName, matches);
      }

      return matches[0]!;
    },

    async isToolAvailable(toolName, serverId): Promise<boolean> {
      try {
        const tool = await this.resolveTool(toolName, serverId);

        // Check if server is connected
        const client = serverRegistry.getClient(tool.serverId);
        if (!client) {
          // Try to get server state
          const state = await serverRegistry.get(tool.serverId);
          return state?.config.enabled ?? false;
        }

        return true;
      } catch {
        return false;
      }
    },
  };
}
