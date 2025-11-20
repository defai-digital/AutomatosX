/**
 * AxCliAdapter - Adapter for ax-cli (multi-provider CLI) (v10.0.0)
 *
 * Wraps ax-cli execution with standardized GrokCliAdapter interface.
 * Supports multiple AI providers: GLM, xAI, OpenAI, Anthropic, Ollama.
 *
 * ax-cli v2.5.1+ features:
 * - IDE integration (--json, --vscode)
 * - File context (--file, --selection, --line-range)
 * - Git diff integration (--git-diff)
 *
 * @module integrations/ax-cli/adapter
 */

import type { GrokCliAdapter, GrokOptions } from './interface.js';
import type { ExecutionResponse } from '../../types/provider.js';
import { AxCliCommandBuilder } from './command-builder.js';
import { AxCliResponseParser } from './response-parser.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../utils/logger.js';

const execAsync = promisify(exec);

/**
 * Adapter for ax-cli (multi-provider CLI)
 *
 * Features:
 * - Multi-provider support (GLM, xAI, OpenAI, Anthropic, Ollama)
 * - JSONL response parsing
 * - Configurable timeout and tool rounds
 * - Shell-safe command building
 * - IDE integration (v2.5.1+): JSON output, VSCode optimization
 * - Context enrichment (v2.5.1+): file content, selections, git diff
 */
export class AxCliAdapter implements GrokCliAdapter {
  private readonly command: string = 'ax-cli';
  private readonly commandBuilder: AxCliCommandBuilder;
  private readonly responseParser: AxCliResponseParser;
  private availabilityCache: { available: boolean; timestamp: number } | null = null;
  private readonly CACHE_TTL = 60000; // 60 seconds

  constructor() {
    this.commandBuilder = new AxCliCommandBuilder();
    this.responseParser = new AxCliResponseParser();

    logger.debug('AxCliAdapter initialized');
  }

  /**
   * Execute a prompt using ax-cli
   *
   * @param prompt - User prompt to execute
   * @param options - Execution options
   * @returns Provider response with parsed content
   * @throws Error if execution fails or response is invalid
   */
  async execute(prompt: string, options: GrokOptions): Promise<ExecutionResponse> {
    const startTime = Date.now();  // Track latency
    const { command, args, fullCommand } = this.commandBuilder.build(prompt, options);
    const timeout = options.timeout || 120000; // Default 2 minutes

    logger.debug('Executing ax-cli', {
      command: fullCommand,
      timeout,
      model: options.model
    });

    try {
      // Execute command
      const { stdout, stderr } = await execAsync(`${command} ${args.join(' ')}`, {
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB
        env: {
          ...process.env,
          ...this.commandBuilder.buildEnv(options)
        }
      });

      // Log stderr if present (may contain warnings)
      if (stderr && stderr.trim().length > 0) {
        logger.warn('ax-cli stderr output', {
          stderr: stderr.substring(0, 500)
        });
      }

      // Parse response
      const response = this.responseParser.parse(stdout, options.model);

      // Add latency tracking
      const latencyMs = Date.now() - startTime;

      logger.info('ax-cli execution successful', {
        model: response.model,
        contentLength: response.content.length,
        latencyMs
      });

      return {
        ...response,
        latencyMs
      };
    } catch (error) {
      logger.error('ax-cli execution failed', {
        error: error instanceof Error ? error.message : String(error),
        command: fullCommand
      });

      // Re-throw with context
      if (error instanceof Error) {
        throw new Error(`ax-cli execution failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Check if ax-cli is available in PATH
   *
   * Uses caching to avoid repeated checks (60s TTL)
   * Cross-platform: uses 'which' on Unix/macOS, 'where' on Windows
   *
   * @returns True if ax-cli is installed and accessible
   */
  async isAvailable(): Promise<boolean> {
    // Check cache first
    if (this.availabilityCache) {
      const age = Date.now() - this.availabilityCache.timestamp;
      if (age < this.CACHE_TTL) {
        logger.debug('Using cached availability', {
          available: this.availabilityCache.available
        });
        return this.availabilityCache.available;
      }
    }

    // Check CLI availability (cross-platform)
    try {
      const command = process.platform === 'win32' ? 'where ax-cli' : 'which ax-cli';
      await execAsync(command, { timeout: 5000 });
      logger.debug('ax-cli is available', { platform: process.platform });

      // Update cache
      this.availabilityCache = {
        available: true,
        timestamp: Date.now()
      };

      return true;
    } catch {
      logger.debug('ax-cli is not available', { platform: process.platform });

      // Update cache
      this.availabilityCache = {
        available: false,
        timestamp: Date.now()
      };

      return false;
    }
  }

  /**
   * Get ax-cli version
   *
   * @returns Version string (e.g., "2.3.1") or "unknown" if unavailable
   */
  async getVersion(): Promise<string> {
    try {
      const { stdout } = await execAsync('ax-cli --version', { timeout: 5000 });
      const version = stdout.trim();
      logger.debug('ax-cli version detected', { version });
      return version;
    } catch (error) {
      logger.warn('Failed to get ax-cli version', { error });
      return 'unknown';
    }
  }

  /**
   * Get CLI command name
   *
   * @returns Command name ("ax-cli")
   */
  getCommand(): string {
    return this.command;
  }

  /**
   * Get adapter display name
   *
   * @returns Human-readable adapter name
   */
  getDisplayName(): string {
    return 'ax-cli (multi-provider)';
  }
}
