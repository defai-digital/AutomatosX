/**
 * MCP Server Implementation
 *
 * The core MCP server that handles tool registration and execution.
 *
 * @module @ax/mcp/mcp-server
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import type { ToolHandler, ServerConfig, ServerCapabilities } from './types.js';
import {
  getContext,
  cleanupContext,
  createRunTool,
  createListAgentsTool,
  createAgentInfoTool,
  createMemorySearchTool,
  createMemorySaveTool,
  createMemoryStatsTool,
  createSessionCreateTool,
  createSessionListTool,
  createSessionInfoTool,
  createStatusTool,
  createProviderStatusTool,
  createConfigTool,
} from './tools/index.js';

// =============================================================================
// MCP Server Class
// =============================================================================

export class AutomatosXServer {
  private server: Server;
  private tools: Map<string, ToolHandler> = new Map();
  private config: ServerConfig;

  constructor(config?: Partial<ServerConfig>) {
    this.config = {
      name: config?.name ?? 'automatosx',
      version: config?.version ?? '11.0.0-alpha.0',
      basePath: config?.basePath,
    };

    this.server = new Server(
      {
        name: this.config.name,
        version: this.config.version,
      },
      {
        capabilities: this.getCapabilities(),
      }
    );

    this.registerTools();
    this.setupHandlers();
  }

  // ---------------------------------------------------------------------------
  // Capabilities
  // ---------------------------------------------------------------------------

  private getCapabilities(): ServerCapabilities {
    return {
      tools: {
        listChanged: false,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Tool Registration
  // ---------------------------------------------------------------------------

  private registerTools(): void {
    // Agent tools
    this.addTool(createRunTool(getContext));
    this.addTool(createListAgentsTool(getContext));
    this.addTool(createAgentInfoTool(getContext));

    // Memory tools
    this.addTool(createMemorySearchTool(getContext));
    this.addTool(createMemorySaveTool(getContext));
    this.addTool(createMemoryStatsTool(getContext));

    // Session tools
    this.addTool(createSessionCreateTool(getContext));
    this.addTool(createSessionListTool(getContext));
    this.addTool(createSessionInfoTool(getContext));

    // System tools
    this.addTool(createStatusTool(getContext));
    this.addTool(createProviderStatusTool(getContext));
    this.addTool(createConfigTool(getContext));
  }

  private addTool(handler: ToolHandler): void {
    this.tools.set(handler.definition.name, handler);
  }

  // ---------------------------------------------------------------------------
  // Request Handlers
  // ---------------------------------------------------------------------------

  private setupHandlers(): void {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this.tools.values()).map((handler) => handler.definition);
      return { tools };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      const handler = this.tools.get(name);
      if (!handler) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
      }

      try {
        const result = await handler.execute(args ?? {});
        return {
          content: result.content.map((item) => ({
            type: item.type as 'text' | 'image' | 'resource',
            text: item.text,
            data: item.data,
            mimeType: item.mimeType,
          })),
          isError: result.isError,
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Server Lifecycle
  // ---------------------------------------------------------------------------

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    // Log to stderr (stdout is used for MCP protocol)
    console.error(`AutomatosX MCP Server v${this.config.version} started`);
    console.error(`Registered ${this.tools.size} tools`);
  }

  async stop(): Promise<void> {
    await cleanupContext();
    await this.server.close();
    console.error('AutomatosX MCP Server stopped');
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  getToolCount(): number {
    return this.tools.size;
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createServer(config?: Partial<ServerConfig>): AutomatosXServer {
  return new AutomatosXServer(config);
}
