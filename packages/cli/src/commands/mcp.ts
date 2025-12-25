/**
 * MCP Server Command
 *
 * Starts the AutomatosX MCP server for integration with AI coding assistants
 * like Claude Code, Gemini CLI, Codex CLI, etc.
 */

import type { CommandResult, CLIOptions } from '../types.js';

/**
 * MCP subcommands
 */
type MCPSubcommand = 'server' | 'serve';

/**
 * MCP command handler
 *
 * Usage:
 *   ax mcp server    Start the MCP server (stdio transport)
 *   ax mcp serve     Alias for 'server'
 */
export async function mcpCommand(
  args: string[],
  _options: CLIOptions
): Promise<CommandResult> {
  const subcommand = args[0] as MCPSubcommand | undefined;

  switch (subcommand) {
    case 'server':
    case 'serve':
    case undefined:
      return await startMCPServer();

    default:
      return {
        success: false,
        exitCode: 1,
        message: `Unknown MCP subcommand: ${subcommand}\n\nUsage:\n  ax mcp server    Start the MCP server`,
        data: undefined,
      };
  }
}

/**
 * Start the MCP server
 */
async function startMCPServer(): Promise<CommandResult> {
  try {
    // Dynamically import the MCP server to avoid circular dependencies
    const { runStdioServer } = await import('@defai.digital/mcp-server');

    // Run the server (this will block until stdin closes)
    await runStdioServer();

    return {
      success: true,
      exitCode: 0,
      message: undefined,
      data: undefined,
    };
  } catch (error) {
    // Log to stderr to avoid polluting MCP protocol on stdout
    console.error(
      `MCP server error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );

    return {
      success: false,
      exitCode: 1,
      message: `Failed to start MCP server: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: undefined,
    };
  }
}
