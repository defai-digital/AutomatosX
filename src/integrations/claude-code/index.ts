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

// Type definitions
export type {
  ClaudeConfig,
  ClaudeMCPServer,
  MCPManifest,
  MCPDiscoveryStats,
  ValidationResult,
} from './types.js';

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
