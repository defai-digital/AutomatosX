/**
 * Codex CLI Integration - Type Definitions
 *
 * Type definitions for Codex CLI integration with AutomatosX.
 *
 * @module integrations/openai-codex
 */

import type { ChildProcess } from 'child_process';

/**
 * Codex CLI Configuration
 */
export interface CodexConfig {
  /** Path to codex CLI binary */
  command: string;
  /** Model to use (default: auto-detect) */
  model?: string;
  /** Temperature (0-2) */
  temperature?: number;
  /** Max tokens */
  maxTokens?: number;
  /** Sandbox mode (workspace-write, full, none) */
  sandboxMode?: 'workspace-write' | 'full' | 'none';
  /** Enable streaming */
  streaming?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Codex MCP Server Configuration
 */
export interface CodexMCPConfig {
  /** Enable MCP server */
  enabled: boolean;
  /** Path to codex binary */
  command: string;
  /** Transport protocol (stdio only for now) */
  transport: 'stdio';
  /** Additional config overrides */
  configOverrides?: Record<string, any>;
}

/**
 * Codex CLI Execution Options
 */
export interface CodexExecutionOptions {
  /** Prompt text */
  prompt: string;
  /** Model override */
  model?: string;
  /** Temperature override */
  temperature?: number;
  /** Max tokens override */
  maxTokens?: number;
  /** Sandbox mode override */
  sandboxMode?: 'workspace-write' | 'full' | 'none';
  /** Enable streaming */
  streaming?: boolean;
  /** Timeout override */
  timeout?: number;
  /** Working directory */
  cwd?: string;
  /** Progress renderer for streaming mode */
  progressRenderer?: any; // CodexProgressRenderer (avoid circular dep)
}

/**
 * Codex CLI Execution Result
 */
export interface CodexExecutionResult {
  /** Output content */
  content: string;
  /** Execution time in ms */
  duration: number;
  /** Token count (if available) */
  tokenCount?: number;
  /** Error if execution failed */
  error?: Error;
  /** Exit code */
  exitCode: number;
}

/**
 * MCP Server Status
 */
export interface MCPServerStatus {
  /** Is server running */
  running: boolean;
  /** Process ID */
  pid?: number;
  /** Start time */
  startTime?: Date;
  /** Error if server failed */
  error?: Error;
}

/**
 * Codex Integration Status
 */
export interface IntegrationStatus {
  /** Is codex CLI available */
  cliAvailable: boolean;
  /** Codex CLI version */
  version?: string;
  /** MCP server status */
  mcpServer?: MCPServerStatus;
  /** Configuration valid */
  configValid: boolean;
  /** Last health check */
  lastHealthCheck?: Date;
}

/**
 * Codex Error Types
 */
export enum CodexErrorType {
  CLI_NOT_FOUND = 'CLI_NOT_FOUND',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  TIMEOUT = 'TIMEOUT',
  MCP_ERROR = 'MCP_ERROR',
  CONFIG_ERROR = 'CONFIG_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

/**
 * Codex Integration Error
 */
export class CodexError extends Error {
  constructor(
    public readonly type: CodexErrorType,
    message: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'CodexError';
  }
}

/**
 * MCP Server Process Wrapper
 */
export interface MCPServerProcess {
  /** Child process */
  process: ChildProcess;
  /** Start time */
  startTime: Date;
  /** Is running */
  running: boolean;
  /** Last error */
  error?: Error;
}

/**
 * Validation Result
 */
export interface ValidationResult {
  /** Is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}
