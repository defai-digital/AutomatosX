/**
 * ax-cli Command Builder (v10.0.0)
 *
 * Builds command-line arguments for ax-cli execution
 *
 * Supports ax-cli v2.5.1+ features:
 * - IDE integration: --json, --vscode
 * - Context enrichment: --file, --selection, --line-range, --git-diff
 *
 * @module integrations/ax-cli/command-builder
 */

import type { AxCliOptions } from './interface.js';
import type { AxCliCommand } from './types.js';
import { logger } from '../../shared/logging/logger.js';

/**
 * Build ax-cli command with arguments
 *
 * Constructs CLI command from prompt and options:
 * ```bash
 * ax-cli -p "prompt text" --model glm-4.6 --max-tool-rounds 400 --json --file src/app.ts
 * ```
 *
 * Features:
 * - Shell-safe escaping
 * - Option validation
 * - Conditional argument building
 * - IDE integration support (v2.5.1+)
 */
export class AxCliCommandBuilder {
  /** Maximum prompt length to prevent shell command length limit errors */
  private static readonly MAX_PROMPT_LENGTH = 1024 * 1024; // 1MB (conservative for cross-platform)

  /**
   * Build command for ax-cli execution
   *
   * @param prompt - User prompt to execute
   * @param options - Execution options
   * @returns Command object with args and full command string
   * @throws Error if prompt exceeds maximum length
   */
  build(prompt: string, options: AxCliOptions): AxCliCommand {
    // Validate prompt length (Bug #11 fix)
    if (prompt.length > AxCliCommandBuilder.MAX_PROMPT_LENGTH) {
      throw new Error(
        `Prompt too long: ${prompt.length} chars (max ${AxCliCommandBuilder.MAX_PROMPT_LENGTH})`
      );
    }

    const args: string[] = [];

    // Headless mode flag (required)
    args.push('-p', this.escape(prompt));

    // Provider selection (xai, glm, openai, anthropic, ollama)
    // BUG FIX: Escape all user-supplied strings to prevent shell injection
    if (options.provider) {
      args.push('--provider', this.escape(options.provider));
    }

    // Model selection
    if (options.model) {
      args.push('--model', this.escape(options.model));
    }

    // API key override
    if (options.apiKey) {
      args.push('--api-key', this.escape(options.apiKey));
    }

    // Base URL override
    if (options.baseUrl) {
      args.push('--base-url', this.escape(options.baseUrl));
    }

    // Working directory
    if (options.directory) {
      args.push('--directory', this.escape(options.directory));
    }

    // Max tool rounds
    if (options.maxToolRounds !== undefined) {
      args.push('--max-tool-rounds', options.maxToolRounds.toString());
    }

    // v2.5.1+ IDE integration features
    if (options.json) {
      args.push('--json');
    }

    if (options.file) {
      args.push('--file', this.escape(options.file));
    }

    if (options.selection) {
      args.push('--selection', this.escape(options.selection));
    }

    if (options.lineRange) {
      // BUG FIX: Escape lineRange to prevent shell injection
      args.push('--line-range', this.escape(options.lineRange));
    }

    if (options.gitDiff) {
      args.push('--git-diff');
    }

    if (options.vscode) {
      args.push('--vscode');
    }

    const fullCommand = `ax-cli ${args.join(' ')}`;

    logger.debug('Built ax-cli command', {
      args,
      promptLength: prompt.length,
      model: options.model,
      ideFeatures: {
        json: options.json,
        file: options.file,
        selection: !!options.selection,
        lineRange: options.lineRange,
        gitDiff: options.gitDiff,
        vscode: options.vscode
      }
    });

    return {
      command: 'ax-cli',
      args,
      fullCommand
    };
  }

  /**
   * Escape string for shell execution
   *
   * Wraps in double quotes and escapes:
   * - Double quotes: " → \"
   * - Backslashes: \ → \\
   * - Dollar signs: $ → \$
   * - Backticks: ` → \`
   *
   * @param input - String to escape
   * @returns Shell-safe escaped string
   */
  private escape(input: string): string {
    return `"${input
      .replace(/\\/g, '\\\\')    // Backslashes first
      .replace(/"/g, '\\"')      // Double quotes
      .replace(/\$/g, '\\$')     // Dollar signs
      .replace(/`/g, '\\`')      // Backticks
    }"`;
  }

  /**
   * Build environment variables for CLI execution
   *
   * ax-cli supports environment variables:
   * - YOUR_API_KEY: API key
   * - AI_BASE_URL: Base URL
   * - AI_MODEL: Model name
   *
   * @param options - Execution options
   * @returns Environment variable object
   */
  buildEnv(options: AxCliOptions): Record<string, string> {
    const env: Record<string, string> = {};

    if (options.apiKey) {
      env.YOUR_API_KEY = options.apiKey;
    }

    if (options.baseUrl) {
      env.AI_BASE_URL = options.baseUrl;
    }

    if (options.model) {
      env.AI_MODEL = options.model;
    }

    return env;
  }
}
