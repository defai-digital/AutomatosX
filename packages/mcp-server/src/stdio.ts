import type { MCPRequest, MCPResponse } from './types.js';
import { MCPErrorCodes } from './types.js';
import { createMCPServer } from './server.js';

/**
 * Runs the MCP server over stdio
 * This is the main entry point for the MCP server binary
 */
export async function runStdioServer(): Promise<void> {
  const server = createMCPServer();

  // Read from stdin
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  // Process each line as a JSON-RPC request
  for await (const line of rl) {
    if (line.trim() === '') {
      continue;
    }

    try {
      const request = JSON.parse(line) as MCPRequest;
      const response = await server.handleRequest(request);
      console.log(JSON.stringify(response));
    } catch (error) {
      const errorResponse: MCPResponse = {
        jsonrpc: '2.0',
        id: 0,
        error: {
          code: MCPErrorCodes.PARSE_ERROR,
          message: `Parse error: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
        },
      };
      console.log(JSON.stringify(errorResponse));
    }
  }
}
