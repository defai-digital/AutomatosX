/**
 * AutomatosX MCP Server
 *
 * Model Context Protocol server for AI agent integration.
 * Provides tools for Claude Code, Gemini CLI, and other MCP-compatible clients.
 *
 * Available tools:
 * - ax_run: Execute a task with an agent
 * - ax_list_agents: List available agents
 * - ax_agent_info: Get agent details
 * - ax_memory_search: Search memory
 * - ax_memory_save: Save to memory
 * - ax_memory_stats: Memory statistics
 * - ax_session_create: Create a session
 * - ax_session_list: List sessions
 * - ax_session_info: Session details
 * - ax_status: System status
 * - ax_provider_status: Provider health
 * - ax_config: Configuration info
 *
 * @module @ax/mcp
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

// Server
export { AutomatosXServer, createServer } from './mcp-server.js';

// Types
export type {
  ToolDefinition,
  ToolHandler,
  ToolResult,
  ServerConfig,
  ServerCapabilities,
  ListToolsResponse,
  CallToolRequest,
  CallToolResponse,
} from './types.js';

// Tools (for custom extensions)
export {
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
