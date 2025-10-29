/**
 * OpenAI Codex Integration
 *
 * Integration between AutomatosX and OpenAI Codex CLI,
 * enabling CLI command execution and MCP server management.
 *
 * @module integrations/openai-codex
 */

// Core classes
export { CodexCLI, getDefaultCLI } from './cli-wrapper.js';
export { CodexMCPManager, getDefaultMCPManager } from './mcp-manager.js';
export { CodexBridge, getDefaultBridge } from './bridge.js';

// Type definitions
export type {
  CodexConfig,
  CodexMCPConfig,
  CodexExecutionOptions,
  CodexExecutionResult,
  MCPServerStatus,
  MCPServerProcess,
  IntegrationStatus,
  ValidationResult,
} from './types.js';

// Error types
export { CodexError, CodexErrorType } from './types.js';
