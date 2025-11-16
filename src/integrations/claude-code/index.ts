/**
 * Claude Code Integration
 *
 * Bidirectional integration between AutomatosX and Claude Code,
 * enabling MCP server sharing and custom slash command management.
 *
 * @module integrations/claude-code
 */

// Core classes
export { ClaudeCodeBridge, defaultBridge } from './bridge.js';
export { ConfigManager, defaultConfigManager } from './config-manager.js';
export { CommandManager, defaultCommandManager } from './command-manager.js';
export { MCPManager, defaultMCPManager } from './mcp-manager.js';

// Type definitions
export type {
  ClaudeConfig,
  ClaudeMCPServer,
  MCPManifest,
  ClaudeCommand,
  CommandDiscoveryStats,
  MCPDiscoveryStats,
  IntegrationStatus,
  InitOptions,
  ScanCommandsOptions,
  ValidationResult,
  ConfigScope,
} from './types.js';

// Error types
export { ClaudeCodeError, ClaudeCodeErrorType } from './types.js';

// Utilities
export {
  validateClaudeConfig,
  validateMCPServer,
  validateMCPManifest,
  validateCommand,
  isValidCommandName,
  isValidServerName,
  hasWarnings,
  getValidationSummary,
} from './utils/validation.js';

export {
  getGlobalConfigPath,
  getProjectConfigPath,
  getGlobalCommandsPath,
  getProjectCommandsPath,
  getProjectMCPPath,
  fileExists,
  readJsonFile,
  writeJsonFile,
  readMarkdownFile,
  extractMarkdownDescription,
} from './utils/file-reader.js';
