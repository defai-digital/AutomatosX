/**
 * Tool Discovery
 *
 * Discovers tools and resources from MCP servers.
 *
 * Invariants:
 * - INV-MCP-ECO-001: Tool discovery is idempotent
 * - INV-MCP-ECO-002: Failed servers don't block others
 * - INV-MCP-ECO-003: Tool namespacing prevents collisions
 */

import type {
  MCPToolMetadata,
  MCPResourceMetadata,
  MCPDiscoveryRequest,
  MCPDiscoveryResponse,
} from '@defai.digital/contracts';
import { createToolFullName, createResourceFullUri, getErrorMessage } from '@defai.digital/contracts';
import type {
  ToolRegistryPort,
  ResourceRegistryPort,
  ServerRegistryPort,
  MCPToolInfo,
  MCPResourceInfo,
} from './types.js';
import type { ServerRegistryService } from './server-registry.js';

/**
 * Discovery result for a single server
 */
export interface ServerDiscoveryResult {
  serverId: string;
  status: 'success' | 'error' | 'skipped';
  toolCount: number;
  resourceCount: number;
  error?: string;
  durationMs: number;
}

/**
 * Options for tool discovery service
 */
export interface ToolDiscoveryServiceOptions {
  /**
   * Server registry service
   */
  serverRegistry: ServerRegistryService;

  /**
   * Tool registry storage
   */
  toolRegistry: ToolRegistryPort;

  /**
   * Resource registry storage
   */
  resourceRegistry: ResourceRegistryPort;

  /**
   * Storage port for server state
   */
  serverStorage: ServerRegistryPort;

  /**
   * Minimum interval between discoveries (ms)
   */
  discoveryIntervalMs?: number;
}

/**
 * Tool discovery service
 */
export interface ToolDiscoveryService {
  /**
   * Discover tools and resources from servers
   * INV-MCP-ECO-001: Idempotent
   * INV-MCP-ECO-002: Failed servers don't block others
   */
  discover(request?: MCPDiscoveryRequest): Promise<MCPDiscoveryResponse>;

  /**
   * Discover from a single server
   */
  discoverServer(serverId: string): Promise<ServerDiscoveryResult>;

  /**
   * Get all discovered tools
   */
  getAllTools(): Promise<MCPToolMetadata[]>;

  /**
   * Get tools for a specific server
   */
  getToolsForServer(serverId: string): Promise<MCPToolMetadata[]>;

  /**
   * Get all discovered resources
   */
  getAllResources(): Promise<MCPResourceMetadata[]>;

  /**
   * Get resources for a specific server
   */
  getResourcesForServer(serverId: string): Promise<MCPResourceMetadata[]>;

  /**
   * Find tool by name
   * INV-MCP-ECO-003: Namespacing
   */
  findTool(toolName: string): Promise<MCPToolMetadata[]>;

  /**
   * Get tool by full name
   */
  getToolByFullName(fullName: string): Promise<MCPToolMetadata | null>;
}

/**
 * Creates a tool discovery service
 */
export function createToolDiscoveryService(
  options: ToolDiscoveryServiceOptions
): ToolDiscoveryService {
  const {
    serverRegistry,
    toolRegistry,
    resourceRegistry,
    serverStorage,
    discoveryIntervalMs = 60000, // 1 minute default
  } = options;

  // Track last discovery time per server
  const lastDiscoveryTime = new Map<string, number>();

  /**
   * Convert tool info to metadata with namespacing
   * INV-MCP-ECO-003: Adds server prefix to tool name
   */
  function toolInfoToMetadata(
    serverId: string,
    info: MCPToolInfo
  ): MCPToolMetadata {
    return {
      toolName: info.name,
      fullName: createToolFullName(serverId, info.name),
      serverId,
      description: info.description ?? '',
      inputSchema: info.inputSchema,
      available: true,
      discoveredAt: new Date().toISOString(),
    };
  }

  /**
   * Convert resource info to metadata with namespacing
   * INV-MCP-ECO-003: Adds server prefix to URI
   */
  function resourceInfoToMetadata(
    serverId: string,
    info: MCPResourceInfo
  ): MCPResourceMetadata {
    return {
      uri: info.uri,
      fullUri: createResourceFullUri(serverId, info.uri),
      serverId,
      name: info.name,
      description: info.description,
      mimeType: info.mimeType,
      discoveredAt: new Date().toISOString(),
    };
  }

  return {
    async discover(request: Partial<MCPDiscoveryRequest> = {}): Promise<MCPDiscoveryResponse> {
      const startTime = Date.now();
      const serverIds = request.serverIds;
      const forceRefresh = request.forceRefresh ?? false;
      const includeDisabled = request.includeDisabled ?? false;

      // Get list of servers to discover from
      let targetServerIds: string[];
      if (serverIds && serverIds.length > 0) {
        targetServerIds = serverIds;
      } else {
        // Get all enabled servers
        targetServerIds = await serverRegistry.getEnabledServerIds();
        if (includeDisabled) {
          const allIds = await serverStorage.getAllIds();
          targetServerIds = [...new Set([...targetServerIds, ...allIds])];
        }
      }

      // INV-MCP-ECO-002: Run discovery in parallel, collect results independently
      const serverResults: ServerDiscoveryResult[] = [];
      const allTools: MCPToolMetadata[] = [];
      const allResources: MCPResourceMetadata[] = [];

      // Process servers in parallel
      const discoveryPromises = targetServerIds.map(async (serverId) => {
        // Check if recently discovered and not forcing refresh
        // INV-MCP-ECO-001: Idempotent - return cached results if recent
        if (!forceRefresh) {
          const lastTime = lastDiscoveryTime.get(serverId);
          if (lastTime && Date.now() - lastTime < discoveryIntervalMs) {
            // Get cached tools and resources
            const cachedTools = await toolRegistry.getTools(serverId);
            const cachedResources = await resourceRegistry.getResources(serverId);

            return {
              serverId,
              status: 'success' as const,
              toolCount: cachedTools.length,
              resourceCount: cachedResources.length,
              durationMs: 0,
              tools: cachedTools,
              resources: cachedResources,
              skipped: true,
            };
          }
        }

        const result = await this.discoverServer(serverId);
        const tools = await toolRegistry.getTools(serverId);
        const resources = await resourceRegistry.getResources(serverId);

        return {
          ...result,
          tools,
          resources,
          skipped: false,
        };
      });

      // Wait for all discoveries (INV-MCP-ECO-002: failures don't block)
      const results = await Promise.allSettled(discoveryPromises);

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { tools, resources, skipped: _skipped, ...serverResult } = result.value;
          serverResults.push(serverResult);
          allTools.push(...tools);
          allResources.push(...resources);
        } else {
          // Shouldn't happen since discoverServer catches errors
          serverResults.push({
            serverId: 'unknown',
            status: 'error',
            toolCount: 0,
            resourceCount: 0,
            error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
            durationMs: 0,
          });
        }
      }

      return {
        tools: allTools,
        resources: allResources,
        serverResults,
        totalDurationMs: Date.now() - startTime,
        discoveredAt: new Date().toISOString(),
      };
    },

    async discoverServer(serverId): Promise<ServerDiscoveryResult> {
      const startTime = Date.now();

      try {
        // Check if server exists and is enabled
        const serverState = await serverRegistry.get(serverId);
        if (!serverState) {
          return {
            serverId,
            status: 'error',
            toolCount: 0,
            resourceCount: 0,
            error: 'Server not found',
            durationMs: Date.now() - startTime,
          };
        }

        if (!serverState.config.enabled) {
          return {
            serverId,
            status: 'skipped',
            toolCount: 0,
            resourceCount: 0,
            durationMs: Date.now() - startTime,
          };
        }

        // Get or establish connection
        let client = serverRegistry.getClient(serverId);
        if (!client) {
          client = await serverRegistry.connect(serverId);
        }

        // Discover tools
        const toolInfos = await client.listTools();
        const tools = toolInfos.map((info) => toolInfoToMetadata(serverId, info));
        await toolRegistry.setTools(serverId, tools);

        // Discover resources
        const resourceInfos = await client.listResources();
        const resources = resourceInfos.map((info) =>
          resourceInfoToMetadata(serverId, info)
        );
        await resourceRegistry.setResources(serverId, resources);

        // Update discovery timestamp
        lastDiscoveryTime.set(serverId, Date.now());

        // Update server state with counts
        const updatedState = await serverRegistry.get(serverId);
        if (updatedState) {
          await serverStorage.set(serverId, {
            ...updatedState,
            toolCount: tools.length,
            resourceCount: resources.length,
            lastDiscoveredAt: new Date().toISOString(),
          });
        }

        return {
          serverId,
          status: 'success',
          toolCount: tools.length,
          resourceCount: resources.length,
          durationMs: Date.now() - startTime,
        };
      } catch (error) {
        const errorMessage = getErrorMessage(error);

        // Clear cached tools/resources on error
        await toolRegistry.clearTools(serverId);
        await resourceRegistry.clearResources(serverId);

        return {
          serverId,
          status: 'error',
          toolCount: 0,
          resourceCount: 0,
          error: errorMessage,
          durationMs: Date.now() - startTime,
        };
      }
    },

    async getAllTools(): Promise<MCPToolMetadata[]> {
      return toolRegistry.getAllTools();
    },

    async getToolsForServer(serverId): Promise<MCPToolMetadata[]> {
      return toolRegistry.getTools(serverId);
    },

    async getAllResources(): Promise<MCPResourceMetadata[]> {
      return resourceRegistry.getAllResources();
    },

    async getResourcesForServer(serverId): Promise<MCPResourceMetadata[]> {
      return resourceRegistry.getResources(serverId);
    },

    async findTool(toolName): Promise<MCPToolMetadata[]> {
      return toolRegistry.findTool(toolName);
    },

    async getToolByFullName(fullName): Promise<MCPToolMetadata | null> {
      return toolRegistry.getToolByFullName(fullName);
    },
  };
}
