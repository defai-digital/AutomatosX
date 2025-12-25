import type {
  MCPRequest,
  MCPResponse,
  MCPServerConfig,
  MCPToolResult,
  MCPTool,
} from './types.js';
import { MCPErrorCodes } from './types.js';
import { MCP_SERVER_NAME, MCP_PROTOCOL_VERSION, DEFAULT_SCHEMA_VERSION } from '@defai.digital/contracts';
import { ALL_TOOLS, TOOL_HANDLERS } from './tools/index.js';
import { ALL_RESOURCES, readResource } from './resources/index.js';
import { ALL_PROMPTS, executePrompt, getPrompt } from './prompts/index.js';
import { getToolPrefix, namespaceTools, resolveToolName } from './tool-namespacing.js';
import { getRateLimiter } from './middleware/rate-limiter.js';

/**
 * MCP Server implementation
 * Handles JSON-RPC 2.0 protocol for MCP communication
 */
export class MCPServer {
  private readonly config: MCPServerConfig;
  private initialized = false;
  private readonly toolPrefix: string;
  private readonly listableTools: MCPTool[];

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.toolPrefix = getToolPrefix();
    this.listableTools = namespaceTools(ALL_TOOLS, this.toolPrefix);
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

        case 'resources/list':
          return this.handleResourcesList(request);

        case 'resources/read':
          return await this.handleResourcesRead(request);

        case 'prompts/list':
          return this.handlePromptsList(request);

        case 'prompts/get':
          return await this.handlePromptsGet(request);

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
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
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
        tools: this.listableTools,
      },
    };
  }

  /**
   * Handles tools/call request
   * INV-MCP-006: Rate limits enforced per tool
   * INV-MCP-007: RATE_LIMITED errors include retryAfter
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

    const toolName = resolveToolName(params.name, this.toolPrefix);
    const handler = TOOL_HANDLERS[toolName];

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

    // Check rate limits before executing tool
    // INV-MCP-006: Rate limits enforced per tool
    const rateLimiter = getRateLimiter();
    const rateLimitResult = rateLimiter.checkAndConsume(toolName);

    if (!rateLimitResult.allowed) {
      // INV-MCP-007: RATE_LIMITED errors include retryAfter
      const error = rateLimiter.createError(toolName, rateLimitResult);
      const errorResult: MCPToolResult = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error.code,
              message: error.message,
              toolName: error.toolName,
              retryAfter: error.retryAfter,
              limit: error.limit,
              windowSeconds: error.windowSeconds,
            }),
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
   * Handles resources/list request
   */
  private handleResourcesList(request: MCPRequest): MCPResponse {
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
        resources: ALL_RESOURCES,
      },
    };
  }

  /**
   * Handles resources/read request
   */
  private async handleResourcesRead(request: MCPRequest): Promise<MCPResponse> {
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

    const params = request.params as { uri: string } | undefined;

    if (params?.uri === undefined) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: MCPErrorCodes.INVALID_PARAMS,
          message: 'Resource URI is required',
        },
      };
    }

    try {
      const content = await readResource(params.uri);

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          contents: [content],
        },
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: MCPErrorCodes.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Failed to read resource',
        },
      };
    }
  }

  /**
   * Handles prompts/list request
   */
  private handlePromptsList(request: MCPRequest): MCPResponse {
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
        prompts: ALL_PROMPTS,
      },
    };
  }

  /**
   * Handles prompts/get request
   */
  private async handlePromptsGet(request: MCPRequest): Promise<MCPResponse> {
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
      | { name: string; arguments?: Record<string, string> }
      | undefined;

    if (params?.name === undefined) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: MCPErrorCodes.INVALID_PARAMS,
          message: 'Prompt name is required',
        },
      };
    }

    const prompt = getPrompt(params.name);
    if (prompt === undefined) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: MCPErrorCodes.INVALID_PARAMS,
          message: `Unknown prompt: ${params.name}`,
        },
      };
    }

    try {
      const result = await executePrompt(params.name, params.arguments ?? {});

      // Check if result is an error
      if ('error' in result) {
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: MCPErrorCodes.INVALID_PARAMS,
            message: result.message,
          },
        };
      }

      return {
        jsonrpc: '2.0',
        id: request.id,
        result,
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: MCPErrorCodes.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Failed to execute prompt',
        },
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
    name: config?.name ?? MCP_SERVER_NAME,
    version: config?.version ?? DEFAULT_SCHEMA_VERSION, // Server software version
    description: config?.description ?? 'AutomatosX MCP Server',
  });
}
