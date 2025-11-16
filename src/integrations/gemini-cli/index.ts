/**
 * Gemini CLI Integration
 *
 * Bidirectional integration between AutomatosX and Google's Gemini CLI,
 * enabling MCP server sharing and custom command translation.
 *
 * @module integrations/gemini-cli
 */

// Core classes
export { GeminiCLIBridge, defaultBridge } from './bridge.js';
export { ConfigManager, defaultConfigManager } from './config-manager.js';
export {
  CommandTranslator,
  defaultTranslator,
} from './command-translator.js';

// Type definitions
export type {
  GeminiConfig,
  GeminiMCPServer,
  MCPServerConfig,
  CommandInfo,
  TomlCommand,
  ValidationResult,
  ConfigScope,
  RegisterMCPOptions,
  ScanCommandsOptions,
  ImportCommandOptions,
  TranslationOptions,
  MCPDiscoveryStats,
  CommandDiscoveryStats,
} from './types.js';

// Error types
export { GeminiCLIError, GeminiCLIErrorType } from './types.js';

// Utilities
export {
  validateGeminiConfig,
  validateMCPServer,
  validateTomlCommand,
  isValidCommandName,
  isValidServerName,
  sanitizeEnv,
  hasWarnings,
  getValidationSummary,
} from './utils/validation.js';

export {
  getUserConfigPath,
  getProjectConfigPath,
  getUserCommandsPath,
  getProjectCommandsPath,
  fileExists,
  readJsonFile,
  writeJsonFile,
} from './utils/file-reader.js';
