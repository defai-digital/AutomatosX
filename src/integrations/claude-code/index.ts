/**
 * Claude Code Integration
 *
 * Bidirectional integration between AutomatosX and Claude Code,
 * enabling MCP server sharing and custom slash command management.
 *
 * @module integrations/claude-code
 */

// Core classes
export { MCPManager, defaultMCPManager } from './mcp-manager.js';
export { SettingsManager } from './settings-manager.js';
export { McpProjectConfigGenerator } from './mcp-project-config.js';
export { ManifestGenerator } from './manifest-generator.js';
export type { ManifestGeneratorOptions } from './manifest-generator.js';
export { HooksGenerator } from './hooks-generator.js';
export type {
  HooksGeneratorOptions,
  HooksGenerateResult,
  HooksConfig,
  HookEvent,
  HookType,
} from './hooks-generator.js';
export { ClaudeCodeSetupHelper } from './setup-helper.js';

// Type definitions
export type {
  ClaudeConfig,
  ClaudeMCPServer,
  MCPManifest,
  MCPDiscoveryStats,
  ValidationResult,
  SubagentFrontmatter,
  AgentClaudeCodeConfig,
  SubagentPermissionMode,
  SubagentMemoryScope,
  SubagentEffort,
  McpTransport,
} from './types.js';

export type {
  ClaudeCodeSettings,
  SettingsWriteResult,
} from './settings-manager.js';

export type {
  McpServerEntry,
  McpProjectConfig,
  McpProjectConfigResult,
} from './mcp-project-config.js';

export type {
  ClaudeCodeSetupOptions,
  ClaudeCodeDiagnostics,
} from './setup-helper.js';

// Error types
export { ClaudeCodeError, ClaudeCodeErrorType } from './types.js';

// Utilities
export {
  validateMCPServer,
  validateMCPManifest,
  isValidServerName,
  hasWarnings,
  getValidationSummary,
} from './utils/validation.js';
