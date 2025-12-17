import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { ALL_TOOLS, TOOL_HANDLERS } from './tools/index.js';
import { ALL_RESOURCES, readResource } from './resources/index.js';
import { ALL_PROMPTS, executePrompt, getPrompt } from './prompts/index.js';
import { getToolPrefix, namespaceTools, resolveToolName } from './tool-namespacing.js';

/**
 * Runs the MCP server over stdio using the official MCP SDK
 * This is the main entry point for the MCP server binary
 */
export async function runStdioServer(): Promise<void> {
  const toolPrefix = getToolPrefix();
  const listableTools = namespaceTools(ALL_TOOLS, toolPrefix);

  // Create MCP server with official SDK
  const server = new Server(
    {
      name: 'automatosx-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  // Handle tools/list
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: listableTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  // Handle tools/call
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const internalName = resolveToolName(name, toolPrefix);
    const handler = TOOL_HANDLERS[internalName];
    if (!handler) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Unknown tool: ${name}`,
          },
        ],
        isError: true,
      } as const;
    }

    try {
      const result = await handler(args ?? {});
      // Map our MCPToolResult to SDK's CallToolResult format
      return {
        content: result.content.map((c) => ({
          type: c.type as 'text' | 'image' | 'resource',
          text: c.text,
          data: c.data,
          mimeType: c.mimeType,
        })),
        isError: result.isError,
      } as const;
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      } as const;
    }
  });

  // Handle resources/list
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: ALL_RESOURCES,
    };
  });

  // Handle resources/read
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    try {
      const content = await readResource(uri);
      return {
        contents: [content],
      };
    } catch (error) {
      throw new Error(
        `Failed to read resource: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  });

  // Handle prompts/list
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: ALL_PROMPTS,
    };
  });

  // Handle prompts/get
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const prompt = getPrompt(name);
    if (!prompt) {
      throw new Error(`Unknown prompt: ${name}`);
    }

    try {
      const result = await executePrompt(name, args ?? {});

      // Check if result is an error
      if ('error' in result) {
        throw new Error(result.message);
      }

      return result;
    } catch (error) {
      throw new Error(
        `Failed to execute prompt: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  });

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log startup to stderr (not stdout, to avoid polluting MCP protocol)
  console.error('AutomatosX MCP server started');

  // Keep the server running until stdin closes
  // This is necessary when running through CLI wrappers
  await new Promise<void>((resolve) => {
    process.stdin.on('end', () => {
      resolve();
    });
    process.stdin.on('close', () => {
      resolve();
    });
    // Handle case where stdin is already closed
    if (process.stdin.readableEnded) {
      resolve();
    }
  });
}
