import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Readable, Writable } from 'node:stream';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type {
  McpToolDefinition,
  MpcToolResult,
  McpResourceDefinition,
  McpResourceContent,
  McpPromptDefinition,
  McpPromptResult,
} from './surface-types.js';

const SERVER_NAME = 'automatosx';
const SERVER_VERSION = '14.0.1';

export interface McpStdioServer {
  serve(): Promise<void>;
}

interface StdioSurface {
  listToolDefinitions(): McpToolDefinition[];
  invokeTool(toolName: string, args?: Record<string, unknown>): Promise<MpcToolResult>;
  listResources(): McpResourceDefinition[];
  readResource(uri: string): Promise<McpResourceContent>;
  listPrompts(): McpPromptDefinition[];
  getPrompt(name: string, args?: Record<string, unknown>): Promise<McpPromptResult>;
}

export function createMcpStdioTransportService(config: {
  surface: StdioSurface;
  stdin?: Readable;
  stdout?: Writable;
}): McpStdioServer {
  return {
    async serve(): Promise<void> {
      const server = new Server(
        { name: SERVER_NAME, version: SERVER_VERSION },
        {
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
          },
        },
      );

      server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: config.surface.listToolDefinitions().map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      }));

      server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        const result = await config.surface.invokeTool(name, (args ?? {}) as Record<string, unknown>);
        if (result.success) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
          };
        }
        return {
          content: [{ type: 'text' as const, text: result.error ?? 'Tool failed' }],
          isError: true,
        };
      });

      server.setRequestHandler(ListResourcesRequestSchema, async () => ({
        resources: config.surface.listResources(),
      }));

      server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        const content = await config.surface.readResource(request.params.uri);
        return { contents: [content] };
      });

      server.setRequestHandler(ListPromptsRequestSchema, async () => ({
        prompts: config.surface.listPrompts(),
      }));

      server.setRequestHandler(GetPromptRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        const result = await config.surface.getPrompt(name, (args ?? {}) as Record<string, unknown>);
        return result as unknown as Parameters<Parameters<typeof server.setRequestHandler>[1]>[0];
      });

      const transport = new StdioServerTransport(config.stdin, config.stdout);
      await server.connect(transport);
      console.error('AutomatosX MCP server started');

      await new Promise<void>((resolve) => {
        const stdin = config.stdin ?? process.stdin;

        let settled = false;
        const settle = (): void => {
          if (!settled) {
            settled = true;
            resolve();
          }
        };

        // Resolve when the SDK server closes (e.g. client sent shutdown)
        server.onclose = settle;

        // Also resolve when stdin ends (stream exhausted — used in tests and process EOF)
        if (stdin.readableEnded) {
          settle();
          return;
        }
        stdin.once('end', settle);
        stdin.once('close', settle);
      });
    },
  };
}
