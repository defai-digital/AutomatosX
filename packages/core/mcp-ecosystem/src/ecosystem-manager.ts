/**
 * MCP Ecosystem Manager
 *
 * High-level manager for MCP ecosystem operations.
 * Combines server registry, tool discovery, and tool routing.
 *
 * Invariants:
 * - INV-MCP-ECO-001: Tool discovery is idempotent
 * - INV-MCP-ECO-002: Failed servers don't block others
 * - INV-MCP-ECO-003: Tool namespacing prevents collisions
 */

import type {
  MCPServerState,
  MCPToolMetadata,
  MCPResourceMetadata,
  MCPDiscoveryResponse,
  MCPToolInvokeResponse,
  MCPServerRegisterResponse,
  MCPServerListResponse,
} from '@defai.digital/contracts';
import { MCPEcosystemErrorCodes, LIMIT_DEFAULT } from '@defai.digital/contracts';
import type {
  MCPEcosystemManager,
  MCPEcosystemManagerOptions,
} from './types.js';
import { createServerRegistryService } from './server-registry.js';
import { createToolDiscoveryService } from './tool-discovery.js';
import { createToolRouterService, ToolRouterError } from './tool-router.js';

/**
 * Error thrown by ecosystem manager
 */
export class MCPEcosystemError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MCPEcosystemError';
  }

  static serverNotFound(serverId: string): MCPEcosystemError {
    return new MCPEcosystemError(
      MCPEcosystemErrorCodes.SERVER_NOT_FOUND,
      `Server not found: ${serverId}`,
      { serverId }
    );
  }

  static toolNotFound(toolName: string): MCPEcosystemError {
    return new MCPEcosystemError(
      MCPEcosystemErrorCodes.TOOL_NOT_FOUND,
      `Tool not found: ${toolName}`,
      { toolName }
    );
  }

  static ambiguousTool(
    toolName: string,
    matches: string[]
  ): MCPEcosystemError {
    return new MCPEcosystemError(
      MCPEcosystemErrorCodes.AMBIGUOUS_TOOL,
      `Ambiguous tool name "${toolName}". Matches: ${matches.join(', ')}`,
      { toolName, matches }
    );
  }
}

/**
 * Creates an MCP ecosystem manager
 */
export function createMCPEcosystemManager(
  options: MCPEcosystemManagerOptions
): MCPEcosystemManager {
  const {
    serverRegistry: serverStorage,
    toolRegistry,
    resourceRegistry,
    clientFactory,
    defaultConnectionTimeoutMs = 10000,
    defaultRequestTimeoutMs = 60000,
  } = options;

  // Create server registry service
  const serverRegistryService = createServerRegistryService({
    storage: serverStorage,
    clientFactory,
    defaultConnectionTimeoutMs,
  });

  // Create tool discovery service
  const toolDiscoveryService = createToolDiscoveryService({
    serverRegistry: serverRegistryService,
    toolRegistry,
    resourceRegistry,
    serverStorage,
  });

  // Create tool router service
  const toolRouterService = createToolRouterService({
    serverRegistry: serverRegistryService,
    toolDiscovery: toolDiscoveryService,
    defaultRequestTimeoutMs,
  });

  return {
    async registerServer(request): Promise<MCPServerRegisterResponse> {
      const response = await serverRegistryService.register(request);

      // Discover tools if requested and connected
      if (
        response.success &&
        request.discoverNow !== false &&
        response.server?.status === 'connected'
      ) {
        try {
          const discoveryResult = await toolDiscoveryService.discoverServer(
            request.serverId
          );
          if (discoveryResult.status === 'success') {
            response.tools = await toolDiscoveryService.getToolsForServer(
              request.serverId
            );
          }
        } catch {
          // Ignore discovery errors during registration
        }
      }

      return response;
    },

    async unregisterServer(serverId): Promise<boolean> {
      // Clear tools and resources
      await toolRegistry.clearTools(serverId);
      await resourceRegistry.clearResources(serverId);

      return serverRegistryService.unregister(serverId);
    },

    async getServer(serverId): Promise<MCPServerState | null> {
      return serverRegistryService.get(serverId);
    },

    async listServers(request: Partial<Parameters<typeof serverRegistryService.list>[0]> = {}): Promise<MCPServerListResponse> {
      return serverRegistryService.list({
        limit: request.limit ?? LIMIT_DEFAULT,
        offset: request.offset ?? 0,
        status: request.status,
        enabled: request.enabled,
        capability: request.capability,
      });
    },

    async connectServer(serverId): Promise<boolean> {
      try {
        await serverRegistryService.connect(serverId);
        return true;
      } catch {
        return false;
      }
    },

    async disconnectServer(serverId): Promise<boolean> {
      try {
        await serverRegistryService.disconnect(serverId);
        return true;
      } catch {
        return false;
      }
    },

    async discover(request: Partial<Parameters<typeof toolDiscoveryService.discover>[0]> = {}): Promise<MCPDiscoveryResponse> {
      return toolDiscoveryService.discover({
        forceRefresh: request.forceRefresh ?? false,
        includeDisabled: request.includeDisabled ?? false,
        serverIds: request.serverIds,
        filterCapability: request.filterCapability,
        filterCategory: request.filterCategory,
      });
    },

    async invokeTool(request): Promise<MCPToolInvokeResponse> {
      return toolRouterService.invoke(request);
    },

    async getTools(serverId?): Promise<MCPToolMetadata[]> {
      if (serverId) {
        return toolDiscoveryService.getToolsForServer(serverId);
      }
      return toolDiscoveryService.getAllTools();
    },

    async getResources(serverId?): Promise<MCPResourceMetadata[]> {
      if (serverId) {
        return toolDiscoveryService.getResourcesForServer(serverId);
      }
      return toolDiscoveryService.getAllResources();
    },

    async findTool(toolName): Promise<MCPToolMetadata | null> {
      try {
        const tool = await toolRouterService.resolveTool(toolName);
        return tool;
      } catch (error) {
        if (
          error instanceof ToolRouterError &&
          error.code === MCPEcosystemErrorCodes.AMBIGUOUS_TOOL
        ) {
          throw MCPEcosystemError.ambiguousTool(
            toolName,
            (error.details?.matches as string[]) ?? []
          );
        }
        return null;
      }
    },
  };
}

// Re-export services and errors
export {
  createServerRegistryService,
  ServerRegistryError,
  type ServerRegistryService,
  type ServerRegistryServiceOptions,
} from './server-registry.js';

export {
  createToolDiscoveryService,
  type ToolDiscoveryService,
  type ToolDiscoveryServiceOptions,
  type ServerDiscoveryResult,
} from './tool-discovery.js';

export {
  createToolRouterService,
  ToolRouterError,
  type ToolRouterService,
  type ToolRouterServiceOptions,
} from './tool-router.js';
