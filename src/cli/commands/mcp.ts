/**
 * MCP Command - Start MCP Server
 *
 * Starts AutomatosX as a stdio JSON-RPC MCP server for
 * integration with Claude Code and other MCP clients.
 */

import type { CommandModule } from 'yargs';
import { McpServer } from '../../mcp/server.js';
import { logger } from '../../utils/logger.js';

interface McpCommandArgs {
  debug?: boolean;
}

export const mcpCommand: CommandModule<object, McpCommandArgs> = {
  command: 'mcp',
  describe: 'Start MCP server for Claude Code integration',

  builder: (yargs) => {
    return yargs
      .option('debug', {
        alias: 'd',
        type: 'boolean',
        description: 'Enable debug logging',
        default: false
      })
      .example('$0 mcp', 'Start MCP server (stdio mode)')
      .example('$0 mcp --debug', 'Start with debug logging');
  },

  handler: async (argv) => {
    try {
      logger.info('Starting AutomatosX MCP Server...');

      const server = new McpServer({
        debug: argv.debug
      });

      await server.start();

      // Server runs until stopped (SIGINT/SIGTERM)
    } catch (error) {
      logger.error('Failed to start MCP server', { error });
      process.exit(1);
    }
  }
};
