/**
 * Unified adapter interface for Grok CLI implementations (v10.0.0)
 *
 * Supports both:
 * - ax-cli (multi-provider, JSONL output)
 * - @vibe-kit/grok-cli (xAI only, plain text output)
 *
 * @module integrations/grok-cli/adapter-interface
 */

import type { ExecutionResponse } from '../../types/provider.js';

/**
 * Options for Grok CLI execution
 */
export interface GrokOptions {
  /** AI model to use (e.g., 'grok-2', 'glm-4.6') */
  model?: string;

  /** Provider name (ax-cli only: 'xai', 'glm', 'openai', 'anthropic', 'ollama') */
  provider?: 'xai' | 'glm' | 'openai' | 'anthropic' | 'ollama';

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
}

/**
 * Unified adapter interface for Grok CLI implementations
 *
 * Provides a common interface for both ax-cli and grok-cli,
 * allowing AutomatosX to use either implementation seamlessly.
 */
export interface GrokCliAdapter {
  /**
   * Execute a prompt using the CLI
   *
   * @param prompt - The user prompt to execute
   * @param options - Execution options
   * @returns Provider response with content and metadata
   * @throws Error if execution fails
   */
  execute(prompt: string, options: GrokOptions): Promise<ExecutionResponse>;

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
   * @returns Human-readable adapter name (e.g., "ax-cli (multi-provider)", "grok-cli (xAI)")
   */
  getDisplayName(): string;
}
