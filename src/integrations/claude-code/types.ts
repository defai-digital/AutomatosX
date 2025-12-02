/**
 * Claude Code Integration - Type Definitions
 *
 * This module defines TypeScript types for Claude Code configuration,
 * MCP servers, and command structures.
 *
 * @module integrations/claude-code/types
 */

/**
 * Claude Code configuration structure
 * Matches the schema from .claude/config.json (if exists)
 */
export interface ClaudeConfig {
  /** Model settings */
  model?: {
    /** Model name/identifier */
    name?: string;

    /** Temperature setting */
    temperature?: number;

    /** Max tokens */
    maxTokens?: number;
  };

  /** Custom instructions */
  instructions?: {
    /** Global instructions */
    global?: string;

    /** Project-specific instructions */
    project?: string;
  };

  /** Additional configuration options */
  [key: string]: unknown;
}

/**
 * Claude Code MCP server configuration
 */
export interface ClaudeMCPServer {
  /** Command to execute (e.g., "node", "python", "ax") */
  command: string;

  /** Command arguments */
  args?: string[];

  /** Environment variables for the server process */
  env?: Record<string, string>;

  /** Optional description */
  description?: string;
}

/**
 * MCP manifest structure (.claude/mcp/*.json)
 */
export interface MCPManifest {
  /** Manifest version */
  version?: string;

  /** Server name */
  name?: string;

  /** Server description */
  description?: string;

  /** MCP server configuration */
  mcpServers?: Record<string, ClaudeMCPServer>;

  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Claude Code slash command structure
 */
export interface ClaudeCommand {
  /** Command name (e.g., "ax-agent") */
  name: string;

  /** Full path to the .md file */
  path: string;

  /** Command description (extracted from content) */
  description: string;

  /** Command content (markdown) */
  content: string;

  /** File size in bytes */
  size?: number;

  /** Last modified timestamp */
  modified?: Date;
}

/**
 * Command discovery statistics
 */
export interface CommandDiscoveryStats {
  /** Total commands found */
  total: number;

  /** Commands by prefix (e.g., "ax": 5) */
  byPrefix: Record<string, number>;

  /** Commands in project scope */
  projectScope: number;

  /** Commands in global scope */
  globalScope: number;
}

/**
 * MCP discovery statistics
 */
export interface MCPDiscoveryStats {
  /** Total MCP servers found */
  total: number;

  /** MCP servers in project scope */
  projectScope: number;

  /** MCP servers in global scope */
  globalScope: number;

  /** Servers by transport (all stdio for Claude Code) */
  byTransport: Record<string, number>;
}

/**
 * Integration status information
 */
export interface IntegrationStatus {
  /** Whether Claude Code integration is configured */
  configured: boolean;

  /** Commands directory exists */
  hasCommandsDir: boolean;

  /** MCP directory exists */
  hasMCPDir: boolean;

  /** Number of commands installed */
  commandCount: number;

  /** Number of MCP servers configured */
  mcpServerCount: number;

  /** Project directory path */
  projectDir?: string;
}

/**
 * Options for initializing Claude Code integration
 */
export interface InitOptions {
  /** Overwrite existing files */
  force?: boolean;

  /** Source directory for examples */
  sourceDir?: string;

  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Options for command scanning
 */
export interface ScanCommandsOptions {
  /** Base directory to scan */
  basePath?: string;

  /** Include global commands */
  includeGlobal?: boolean;

  /** Filter pattern (e.g., "ax-*") */
  filter?: string;
}

/**
 * Result of validation
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;

  /** Validation error messages */
  errors: string[];

  /** Non-critical warnings */
  warnings: string[];
}

/**
 * Configuration scope for Claude Code settings
 */
export type ConfigScope = 'global' | 'project';

/**
 * Error types for Claude Code integration
 */
export enum ClaudeCodeErrorType {
  /** Configuration file not found */
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',

  /** Invalid configuration format */
  INVALID_CONFIG = 'INVALID_CONFIG',

  /** Command not found */
  COMMAND_NOT_FOUND = 'COMMAND_NOT_FOUND',

  /** MCP server not found */
  MCP_NOT_FOUND = 'MCP_NOT_FOUND',

  /** Invalid path */
  INVALID_PATH = 'INVALID_PATH',

  /** File operation error */
  FILE_ERROR = 'FILE_ERROR',

  /** Validation error */
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  /** MCP configuration error */
  MCP_ERROR = 'MCP_ERROR',
}

/**
 * Custom error class for Claude Code integration
 */
export class ClaudeCodeError extends Error {
  constructor(
    public type: ClaudeCodeErrorType,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ClaudeCodeError';

    // Capture stack trace, excluding constructor call from it
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ClaudeCodeError);
    }
  }
}
