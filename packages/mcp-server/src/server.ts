import type {
  MCPRequest,
  MCPResponse,
  MCPServerConfig,
  MCPToolResult,
} from './types.js';
import { MCPErrorCodes } from './types.js';
import { ALL_TOOLS, TOOL_HANDLERS } from './tools/index.js';

/**
 * MCP Server implementation
 * Handles JSON-RPC 2.0 protocol for MCP communication
 */
export class MCPServer {
  private readonly config: MCPServerConfig;
  private initialized = false;

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  /**
   * Handles an incoming MCP request
   */
  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      switch (request.method) {
        case 'initialize':
          return this.handleInitialize(request);

        case 'tools/list':
          return this.handleToolsList(request);

        case 'tools/call':
          return await this.handleToolsCall(request);

        case 'shutdown':
          return this.handleShutdown(request);

        default:
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: MCPErrorCodes.METHOD_NOT_FOUND,
              message: `Method not found: ${request.method}`,
            },
          };
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: MCPErrorCodes.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      };
    }
  }

  /**
   * Handles initialize request
   */
  private handleInitialize(request: MCPRequest): MCPResponse {
    this.initialized = true;

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: this.config.name,
          version: this.config.version,
        },
      },
    };
  }

  /**
   * Handles tools/list request
   */
  private handleToolsList(request: MCPRequest): MCPResponse {
    if (!this.initialized) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: MCPErrorCodes.INVALID_REQUEST,
          message: 'Server not initialized',
        },
      };
    }

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        tools: ALL_TOOLS,
      },
    };
  }

  /**
   * Handles tools/call request
   */
  private async handleToolsCall(request: MCPRequest): Promise<MCPResponse> {
    if (!this.initialized) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: MCPErrorCodes.INVALID_REQUEST,
          message: 'Server not initialized',
        },
      };
    }

    const params = request.params as
      | { name: string; arguments: Record<string, unknown> }
      | undefined;

    if (params?.name === undefined) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: MCPErrorCodes.INVALID_PARAMS,
          message: 'Tool name is required',
        },
      };
    }

    const handler = TOOL_HANDLERS[params.name];

    if (handler === undefined) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: MCPErrorCodes.INVALID_PARAMS,
          message: `Unknown tool: ${params.name}`,
        },
      };
    }

    try {
      const result = await handler(params.arguments);

      return {
        jsonrpc: '2.0',
        id: request.id,
        result,
      };
    } catch (error) {
      const errorResult: MCPToolResult = {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: errorResult,
      };
    }
  }

  /**
   * Handles shutdown request
   */
  private handleShutdown(request: MCPRequest): MCPResponse {
    this.initialized = false;

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: null,
    };
  }

  /**
   * Gets server info
   */
  getInfo(): MCPServerConfig {
    return { ...this.config };
  }

  /**
   * Checks if server is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * Creates an MCP server instance
 */
export function createMCPServer(config?: Partial<MCPServerConfig>): MCPServer {
  return new MCPServer({
    name: config?.name ?? 'automatosx-mcp',
    version: config?.version ?? '1.0.0',
    description: config?.description ?? 'AutomatosX MCP Server',
  });
}
