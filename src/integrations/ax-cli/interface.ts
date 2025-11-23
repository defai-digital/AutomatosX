/**
 * Unified adapter interface for ax-cli (v9.2.0+)
 *
 * Supports ax-cli (provider-agnostic, JSONL output).
 * The actual provider is configured via `ax-cli setup` and stored in ~/.ax-cli/config.json.
 *
 * Supported providers are determined by ax-cli, not by AutomatosX.
 *
 * @module integrations/ax-cli/interface
 */

import type { ExecutionResponse } from '../../types/provider.js';

/**
 * Streaming chunk types from SDK
 */
export interface StreamChunk {
  type: 'content' | 'thinking' | 'tool';
  content?: string;
  tool?: string;
  timestamp: string;
}

/**
 * Tool invocation data from SDK
 */
export interface ToolInvocation {
  name: string;
  args?: any;
}

/**
 * Options for ax-cli execution (multi-provider)
 */
export interface AxCliOptions {
  /** AI model to use (e.g., 'grok-2', 'glm-4.6') */
  model?: string;

  /**
   * Provider name (optional)
   *
   * Note: Provider is configured via `ax-cli setup` and stored in ~/.ax-cli/config.json.
   * This parameter is deprecated and will be removed in future versions.
   *
   * @deprecated Configure provider via `ax-cli setup` instead
   */
  provider?: string;

  /** Maximum tokens in response */
  maxTokens?: number;

  /** Temperature for response generation (0.0-1.0) */
  temperature?: number;

  /** Execution timeout in milliseconds */
  timeout?: number;

  /** Working directory for CLI execution */
  directory?: string;

  /** Maximum tool execution rounds (ax-cli only) */
  maxToolRounds?: number;

  /** API key override */
  apiKey?: string;

  /** Base URL override */
  baseUrl?: string;

  // New ax-cli v2.5.1+ IDE integration features
  /** Output responses in JSON format (IDE integration) (ax-cli v2.5.1+) */
  json?: boolean;

  /** Include file context from specified path (ax-cli v2.5.1+) */
  file?: string;

  /** Include selected text as context (ax-cli v2.5.1+) */
  selection?: string;

  /** Include specific line range (e.g., '10-20') (ax-cli v2.5.1+) */
  lineRange?: string;

  /** Include git diff as context (ax-cli v2.5.1+) */
  gitDiff?: boolean;

  /** Optimize output for VSCode integration (ax-cli v2.5.1+) */
  vscode?: boolean;

  // Streaming callbacks (SDK mode only)
  /** Callback for streaming content chunks */
  onStream?: (chunk: StreamChunk) => void;

  /** Callback for tool invocations */
  onTool?: (tool: ToolInvocation) => void;
}

/**
 * Adapter interface for ax-cli (multi-provider)
 *
 * Provides a common interface for the ax-cli multi-provider CLI,
 * allowing AutomatosX to use it seamlessly for AI orchestration.
 */
export interface IAxCliAdapter {
  /**
   * Execute a prompt using the CLI
   *
   * @param prompt - The user prompt to execute
   * @param options - Execution options
   * @returns Provider response with content and metadata
   * @throws Error if execution fails
   */
  execute(prompt: string, options: AxCliOptions): Promise<ExecutionResponse>;

  /**
   * Check if the CLI is available in PATH
   *
   * @returns True if CLI is installed and accessible
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get CLI version string
   *
   * @returns Version string (e.g., "2.3.1") or "unknown" if unavailable
   */
  getVersion(): Promise<string>;

  /**
   * Get CLI command name
   *
   * @returns Command name (e.g., "ax-cli", "grok")
   */
  getCommand(): string;

  /**
   * Get adapter display name
   *
   * @returns Human-readable adapter name (e.g., "ax-cli (multi-provider)")
   */
  getDisplayName(): string;
}

/**
 * @deprecated Use AxCliOptions instead. Provider-specific types are deprecated.
 * Configure provider via `ax-cli setup`.
 */
export type GrokOptions = AxCliOptions;

/**
 * @deprecated Use IAxCliAdapter instead.
 */
export type AxCliAdapter = IAxCliAdapter;

/**
 * @deprecated Use IAxCliAdapter instead. Provider-specific types are deprecated.
 * Configure provider via `ax-cli setup`.
 */
export type GrokCliAdapter = IAxCliAdapter;
