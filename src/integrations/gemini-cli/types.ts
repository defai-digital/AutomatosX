/**
 * Gemini CLI Integration - Type Definitions
 *
 * This module defines TypeScript types for Gemini CLI configuration,
 * MCP servers, and command structures.
 *
 * @module integrations/gemini-cli/types
 */

/**
 * Gemini CLI configuration structure
 * Matches the schema from ~/.gemini/settings.json and .gemini/settings.json
 */
export interface GeminiConfig {
  /** Model identifier (e.g., "gemini-2.5-pro") */
  model?: string;

  /** MCP server configurations */
  mcpServers?: Record<string, GeminiMCPServer>;

  /** MCP-related settings */
  mcp?: {
    discovery?: {
      /** Enable automatic MCP server discovery */
      enabled?: boolean;
    };
  };

  /** Additional configuration options */
  [key: string]: unknown;
}

/**
 * MCP server configuration in Gemini CLI format
 */
export interface GeminiMCPServer {
  /** Command to execute (e.g., "node", "python", "ax") */
  command: string;

  /** Command arguments */
  args?: string[];

  /** Transport mechanism */
  transport?: 'stdio' | 'sse' | 'http';

  /** Environment variables for the server process */
  env?: Record<string, string>;

  /** URL for SSE/HTTP transport */
  url?: string;

  /** Authentication configuration */
  auth?: {
    /** Authentication type */
    type?: 'oauth2';

    /** OAuth2 client ID */
    clientId?: string;

    /** OAuth2 client secret */
    clientSecret?: string;

    /** Token endpoint URL */
    tokenUrl?: string;
  };
}

/**
 * Normalized MCP server configuration for AutomatosX
 */
export interface MCPServerConfig {
  /** Server name/identifier */
  name: string;

  /** Command to execute */
  command: string;

  /** Command arguments */
  args?: string[];

  /** Transport mechanism */
  transport: 'stdio' | 'sse' | 'http';

  /** Environment variables */
  env?: Record<string, string>;

  /** Human-readable description */
  description?: string;

  /** Source of the configuration */
  source?: 'user' | 'project' | 'automatosx';

  /** URL for SSE/HTTP transport */
  url?: string;

  /** Authentication configuration */
  auth?: {
    /** Authentication type */
    type?: 'oauth2';

    /** OAuth2 client ID */
    clientId?: string;

    /** OAuth2 client secret */
    clientSecret?: string;

    /** Token endpoint URL */
    tokenUrl?: string;
  };
}

/**
 * Information about a Gemini CLI custom command
 */
export interface CommandInfo {
  /** Command name (e.g., "plan" or "git:commit") */
  name: string;

  /** Full path to the .toml file */
  path: string;

  /** Command description */
  description: string;

  /** Optional namespace (e.g., "git" for "git:commit") */
  namespace?: string;
}

/**
 * Parsed TOML command structure
 */
export interface TomlCommand {
  /** Command description */
  description: string;

  /** Command prompt template (may contain {{args}} placeholder) */
  prompt: string;
}

/**
 * Result of configuration validation
 */
export interface ValidationResult {
  /** Whether the configuration is valid */
  valid: boolean;

  /** Validation error messages */
  errors: string[];

  /** Non-critical warnings */
  warnings: string[];
}

/**
 * Configuration scope for Gemini CLI settings
 */
export type ConfigScope = 'user' | 'project';

/**
 * Options for MCP server registration
 */
export interface RegisterMCPOptions {
  /** Configuration scope */
  scope?: ConfigScope;

  /** Overwrite if server already exists */
  overwrite?: boolean;

  /** Validate configuration before writing */
  validate?: boolean;
}

/**
 * Options for command scanning
 */
export interface ScanCommandsOptions {
  /** Base directory to scan */
  basePath?: string;

  /** Include subdirectories (namespaces) */
  recursive?: boolean;

  /** Filter pattern (e.g., "git:*") */
  filter?: string;
}

/**
 * Options for command import
 */
export interface ImportCommandOptions {
  /** Output directory for generated ability */
  outputDir?: string;

  /** Overwrite existing ability */
  overwrite?: boolean;

  /** Custom ability name (defaults to "gemini-{commandName}") */
  abilityName?: string;
}

/**
 * Options for command translation
 */
export interface TranslationOptions {
  /** Validate command before translation */
  validate?: boolean;

  /** Overwrite existing output file */
  overwrite?: boolean;

  /** Include timestamp in generated markdown (default: true) */
  includeTimestamp?: boolean;
}

/**
 * Statistics about discovered MCP servers
 */
export interface MCPDiscoveryStats {
  /** Total servers found */
  total: number;

  /** Servers from user config */
  userScope: number;

  /** Servers from project config */
  projectScope: number;

  /** Servers by transport type */
  byTransport: Record<'stdio' | 'sse' | 'http', number>;
}

/**
 * Statistics about discovered commands
 */
export interface CommandDiscoveryStats {
  /** Total commands found */
  total: number;

  /** Commands from user scope */
  userScope: number;

  /** Commands from project scope */
  projectScope: number;

  /** Commands by namespace */
  byNamespace: Record<string, number>;
}

/**
 * Error types for Gemini CLI integration
 */
export enum GeminiCLIErrorType {
  /** Configuration file not found */
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',

  /** Invalid configuration format */
  INVALID_CONFIG = 'INVALID_CONFIG',

  /** MCP server not found */
  SERVER_NOT_FOUND = 'SERVER_NOT_FOUND',

  /** Command not found */
  COMMAND_NOT_FOUND = 'COMMAND_NOT_FOUND',

  /** Invalid path */
  INVALID_PATH = 'INVALID_PATH',

  /** File operation error */
  FILE_ERROR = 'FILE_ERROR',

  /** Validation error */
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  /** Command translation/conversion error */
  CONVERSION_ERROR = 'CONVERSION_ERROR',
}

/**
 * Custom error class for Gemini CLI integration
 */
export class GeminiCLIError extends Error {
  constructor(
    public type: GeminiCLIErrorType,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'GeminiCLIError';

    // Capture stack trace, excluding constructor call from it
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GeminiCLIError);
    }
  }
}
