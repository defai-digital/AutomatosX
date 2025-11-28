/**
 * MCP Server Entry Point
 *
 * Standalone executable for running the AutomatosX MCP server.
 *
 * Usage:
 *   ax-mcp              # Start MCP server
 *   node dist/server.js # Start MCP server
 *
 * @module @ax/mcp/server
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import { createServer } from './mcp-server.js';

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const server = createServer();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.error('\nReceived SIGINT, shutting down...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('\nReceived SIGTERM, shutting down...');
    await server.stop();
    process.exit(0);
  });

  // Handle uncaught errors
  process.on('uncaughtException', async (error) => {
    console.error('Uncaught exception:', error);
    await server.stop();
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason) => {
    console.error('Unhandled rejection:', reason);
    await server.stop();
    process.exit(1);
  });

  // Start the server
  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error starting MCP server:', error);
  process.exit(1);
});
