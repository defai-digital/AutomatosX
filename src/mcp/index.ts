/**
 * AutomatosX MCP Server Entry Point
 *
 * This is the main entry point for the AutomatosX MCP (Model Context Protocol) server.
 * It exposes AutomatosX capabilities as MCP tools for Claude Code and other MCP clients.
 *
 * Usage:
 *   automatosx-mcp                  # Start MCP server on stdio
 *   automatosx-mcp --debug          # Start with debug logging
 *
 * Integration with Claude Code:
 *   claude mcp add --transport stdio automatosx -- automatosx-mcp
 */

import { McpServer } from './server.js';
import { logger } from '../shared/logging/logger.js';

// Parse command-line arguments
const args = process.argv.slice(2);
const debug = args.includes('--debug') || args.includes('-d');

// Create and start MCP server
const server = new McpServer({ debug });

server.start().catch((error) => {
  logger.error('[MCP Entry Point] Failed to start MCP server', { error });
  process.exit(1);
});

// Graceful shutdown handler
function gracefulShutdown(signal: string): void {
  logger.info(`[MCP Entry Point] Received ${signal}, shutting down gracefully...`);

  // MCP server cleanup is handled automatically by process exit
  // The cleanup() method is private and called internally
  logger.info('[MCP Entry Point] Shutdown complete');
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('[MCP Entry Point] Uncaught exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('[MCP Entry Point] Unhandled rejection', { reason });
  process.exit(1);
});
