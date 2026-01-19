/**
 * MCP Ecosystem MCP Tools
 *
 * Tools for managing external MCP servers, discovering tools,
 * and invoking external tools.
 *
 * Invariants:
 * - INV-MCP-ECO-001: Tool discovery is idempotent
 * - INV-MCP-ECO-002: Failed servers don't block others
 * - INV-MCP-ECO-003: Tool namespacing prevents collisions
 */

import type { MCPTool, ToolHandler } from '../types.js';
import { LIMIT_DEFAULT, getErrorMessage } from '@defai.digital/contracts';

/**
 * MCP server register tool definition
 */
export const mcpServerRegisterTool: MCPTool = {
  name: 'mcp_server_register',
  description: 'Register an external MCP server. SIDE EFFECTS: Creates/updates server registration.',
  inputSchema: {
    type: 'object',
    properties: {
      serverId: {
        type: 'string',
        description: 'Unique server ID (lowercase alphanumeric with hyphens)',
        pattern: '^[a-z][a-z0-9-]*$',
      },
      name: {
        type: 'string',
        description: 'Human-readable server name',
      },
      command: {
        type: 'string',
        description: 'Command to start the MCP server',
      },
      args: {
        type: 'array',
        description: 'Arguments for the command',
        items: { type: 'string' },
      },
      env: {
        type: 'object',
        description: 'Environment variables for the server',
      },
      enabled: {
        type: 'boolean',
        description: 'Whether the server is enabled',
        default: true,
      },
      connectionTimeoutMs: {
        type: 'number',
        description: 'Connection timeout in milliseconds',
        default: 10000,
      },
      connectNow: {
        type: 'boolean',
        description: 'Connect immediately after registration',
        default: true,
      },
      discoverNow: {
        type: 'boolean',
        description: 'Discover tools immediately after connection',
        default: true,
      },
    },
    required: ['serverId', 'command'],
  },
  idempotent: true,
};

/**
 * MCP server list tool definition
 */
export const mcpServerListTool: MCPTool = {
  name: 'mcp_server_list',
  description: 'List registered MCP servers. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: 'Filter by status',
        enum: ['connected', 'disconnected', 'connecting', 'error', 'disabled'],
      },
      enabled: {
        type: 'boolean',
        description: 'Filter by enabled state',
      },
      limit: {
        type: 'number',
        description: 'Maximum servers to return',
        default: LIMIT_DEFAULT,
      },
      offset: {
        type: 'number',
        description: 'Offset for pagination',
        default: 0,
      },
    },
  },
  idempotent: true,
};

/**
 * MCP server unregister tool definition
 */
export const mcpServerUnregisterTool: MCPTool = {
  name: 'mcp_server_unregister',
  description: 'Unregister an MCP server. SIDE EFFECTS: Removes server and clears its tools.',
  inputSchema: {
    type: 'object',
    properties: {
      serverId: {
        type: 'string',
        description: 'ID of the server to unregister',
      },
    },
    required: ['serverId'],
  },
  idempotent: true,
};

/**
 * MCP tools discover tool definition
 */
export const mcpToolsDiscoverTool: MCPTool = {
  name: 'mcp_tools_discover',
  description: 'Discover tools and resources from registered MCP servers. INV-MCP-ECO-001: Idempotent. INV-MCP-ECO-002: Failed servers do not block others.',
  inputSchema: {
    type: 'object',
    properties: {
      serverIds: {
        type: 'array',
        description: 'Specific server IDs to discover from (optional, discovers from all enabled if not specified)',
        items: { type: 'string' },
      },
      forceRefresh: {
        type: 'boolean',
        description: 'Force refresh even if recently discovered',
        default: false,
      },
      includeDisabled: {
        type: 'boolean',
        description: 'Include disabled servers',
        default: false,
      },
    },
  },
  idempotent: true,
};

/**
 * MCP tool invoke tool definition
 */
export const mcpToolInvokeTool: MCPTool = {
  name: 'mcp_tool_invoke',
  description: 'Invoke a tool on an external MCP server. INV-MCP-ECO-003: Use serverId.toolName for disambiguation.',
  inputSchema: {
    type: 'object',
    properties: {
      toolName: {
        type: 'string',
        description: 'Tool name (use serverId.toolName for disambiguation if tool name is ambiguous)',
      },
      serverId: {
        type: 'string',
        description: 'Optional server ID (required if tool name is ambiguous)',
      },
      arguments: {
        type: 'object',
        description: 'Arguments to pass to the tool',
      },
      timeoutMs: {
        type: 'number',
        description: 'Request timeout in milliseconds',
      },
    },
    required: ['toolName'],
  },
  idempotent: false,
};

/**
 * MCP tools list tool definition
 */
export const mcpToolsListTool: MCPTool = {
  name: 'mcp_tools_list',
  description: 'List discovered tools from MCP servers. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      serverId: {
        type: 'string',
        description: 'Filter by server ID',
      },
      category: {
        type: 'string',
        description: 'Filter by category',
      },
    },
  },
  idempotent: true,
};

// ============================================================================
// In-Memory Implementation
// ============================================================================

import {
  createMCPEcosystemManager,
  InMemoryServerRegistry,
  InMemoryToolRegistry,
  InMemoryResourceRegistry,
  StubMCPClientFactory,
} from '@defai.digital/mcp-ecosystem';
import type { MCPServerStatus } from '@defai.digital/contracts';

// Create in-memory ecosystem manager for MCP tools
const serverRegistry = new InMemoryServerRegistry();
const toolRegistry = new InMemoryToolRegistry();
const resourceRegistry = new InMemoryResourceRegistry();
const clientFactory = new StubMCPClientFactory();

const ecosystemManager = createMCPEcosystemManager({
  serverRegistry,
  toolRegistry,
  resourceRegistry,
  clientFactory,
});

/**
 * Handler for mcp_server_register tool
 */
export const handleMCPServerRegister: ToolHandler = async (args) => {
  const serverId = args.serverId as string;
  const command = args.command as string;
  const name = (args.name as string) ?? serverId;
  const cmdArgs = args.args as string[] | undefined;
  const env = args.env as Record<string, string> | undefined;
  const enabled = (args.enabled as boolean) ?? true;
  const connectionTimeoutMs = args.connectionTimeoutMs as number | undefined;
  const connectNow = (args.connectNow as boolean) ?? true;
  const discoverNow = (args.discoverNow as boolean) ?? true;

  try {
    const registerRequest: Parameters<typeof ecosystemManager.registerServer>[0] = {
      serverId,
      name,
      command,
      enabled,
      connectNow,
      discoverNow,
      connectionTimeoutMs: connectionTimeoutMs ?? 10000,
      requestTimeoutMs: 60000,
      maxRetries: 3,
    };
    if (cmdArgs) registerRequest.args = cmdArgs;
    if (env) registerRequest.env = env;
    const result = await ecosystemManager.registerServer(registerRequest);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: result.success,
            created: result.created,
            serverId,
            status: result.server?.status,
            toolCount: result.tools?.length ?? 0,
            error: result.error,
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error registering server: ${getErrorMessage(error)}`,
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for mcp_server_list tool
 */
export const handleMCPServerList: ToolHandler = async (args) => {
  const status = args.status as MCPServerStatus | undefined;
  const enabled = args.enabled as boolean | undefined;
  const limit = (args.limit as number) ?? 10;
  const offset = (args.offset as number) ?? 0;

  try {
    const result = await ecosystemManager.listServers({
      status,
      enabled,
      limit,
      offset,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            total: result.total,
            hasMore: result.hasMore,
            servers: result.servers.map((s) => ({
              serverId: s.config.serverId,
              name: s.config.name,
              status: s.status,
              enabled: s.config.enabled,
              toolCount: s.toolCount,
              resourceCount: s.resourceCount,
              lastConnectedAt: s.lastConnectedAt,
              lastError: s.lastError,
            })),
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error listing servers: ${getErrorMessage(error)}`,
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for mcp_server_unregister tool
 */
export const handleMCPServerUnregister: ToolHandler = async (args) => {
  const serverId = args.serverId as string;

  try {
    const result = await ecosystemManager.unregisterServer(serverId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            unregistered: result,
            serverId,
            message: result
              ? `Server "${serverId}" unregistered successfully`
              : `Server "${serverId}" not found`,
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error unregistering server: ${getErrorMessage(error)}`,
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for mcp_tools_discover tool
 */
export const handleMCPToolsDiscover: ToolHandler = async (args) => {
  const serverIds = args.serverIds as string[] | undefined;
  const forceRefresh = (args.forceRefresh as boolean) ?? false;
  const includeDisabled = (args.includeDisabled as boolean) ?? false;

  try {
    const result = await ecosystemManager.discover({
      serverIds,
      forceRefresh,
      includeDisabled,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            totalTools: result.tools.length,
            totalResources: result.resources.length,
            totalDurationMs: result.totalDurationMs,
            discoveredAt: result.discoveredAt,
            serverResults: result.serverResults.map((r) => ({
              serverId: r.serverId,
              status: r.status,
              toolCount: r.toolCount,
              resourceCount: r.resourceCount,
              error: r.error,
              durationMs: r.durationMs,
            })),
            tools: result.tools.map((t) => ({
              fullName: t.fullName,
              toolName: t.toolName,
              serverId: t.serverId,
              description: t.description,
            })),
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error discovering tools: ${getErrorMessage(error)}`,
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for mcp_tool_invoke tool
 */
export const handleMCPToolInvoke: ToolHandler = async (args) => {
  const toolName = args.toolName as string;
  const serverId = args.serverId as string | undefined;
  const toolArgs = args.arguments as Record<string, unknown> | undefined;
  const timeoutMs = args.timeoutMs as number | undefined;

  try {
    const result = await ecosystemManager.invokeTool({
      toolName,
      serverId,
      arguments: toolArgs,
      timeoutMs,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: result.success,
            toolName: result.toolName,
            serverId: result.serverId,
            durationMs: result.durationMs,
            isError: result.isError,
            error: result.error,
            content: result.content,
          }, null, 2),
        },
      ],
      isError: result.isError,
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error invoking tool: ${getErrorMessage(error)}`,
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for mcp_tools_list tool
 */
export const handleMCPToolsList: ToolHandler = async (args) => {
  const serverId = args.serverId as string | undefined;
  const category = args.category as string | undefined;

  try {
    let tools = await ecosystemManager.getTools(serverId);

    // Filter by category if specified
    if (category) {
      tools = tools.filter((t) => t.category === category);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            total: tools.length,
            tools: tools.map((t) => ({
              fullName: t.fullName,
              toolName: t.toolName,
              serverId: t.serverId,
              description: t.description,
              category: t.category,
              available: t.available,
              inputSchema: t.inputSchema,
            })),
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error listing tools: ${getErrorMessage(error)}`,
        },
      ],
      isError: true,
    };
  }
};

/**
 * All MCP ecosystem tools
 */
export const MCP_ECOSYSTEM_TOOLS: MCPTool[] = [
  mcpServerRegisterTool,
  mcpServerListTool,
  mcpServerUnregisterTool,
  mcpToolsDiscoverTool,
  mcpToolInvokeTool,
  mcpToolsListTool,
];

/**
 * All MCP ecosystem handlers
 */
export const MCP_ECOSYSTEM_HANDLERS: Record<string, ToolHandler> = {
  mcp_server_register: handleMCPServerRegister,
  mcp_server_list: handleMCPServerList,
  mcp_server_unregister: handleMCPServerUnregister,
  mcp_tools_discover: handleMCPToolsDiscover,
  mcp_tool_invoke: handleMCPToolInvoke,
  mcp_tools_list: handleMCPToolsList,
};
