/**
 * Base CLI Wrapper for OpenAI-Compatible Providers
 *
 * Provides a reusable base class for CLI wrappers using OpenAI-compatible APIs.
 * Used by GLM (Zhipu AI) and Grok (xAI) integrations.
 *
 * v12.4.2: Extracted to eliminate duplication between ax-glm and ax-grok.
 *
 * @module integrations/shared/openai-compatible-cli-wrapper
 */

import { spawn } from 'child_process';
import type { ExecutionRequest, ExecutionResponse } from '../../types/provider.js';
import { logger } from '../../shared/logging/logger.js';
import { findOnPath } from '../../core/cli-provider-detector.js';

/**
 * Configuration for OpenAI-compatible CLI wrappers
 */
export interface OpenAICompatibleCLIConfig {
  command: string;
  model: string;
  timeout: number;
  /** Provider name for logging (e.g., 'GLM', 'Grok') */
  providerName: string;
  /** Default model name for comparison */
  defaultModel: string;
  /** Function to normalize model name */
  normalizeModel: (model: string) => string;
}

/**
 * Base CLI Wrapper for OpenAI-Compatible Providers
 *
 * This base class handles the common logic for CLI wrappers that
 * use OpenAI-compatible APIs, reducing code duplication.
 *
 * **Usage:**
 * ```typescript
 * class GLMCliWrapper extends OpenAICompatibleCliWrapper {
 *   constructor(config) {
 *     super({
 *       ...config,
 *       providerName: 'GLM',
 *       defaultModel: 'glm-4',
 *       normalizeModel: normalizeGLMModel
 *     });
 *   }
 * }
 * ```
 */
export class OpenAICompatibleCliWrapper {
  protected readonly config: OpenAICompatibleCLIConfig;
  protected cliPath: string | null = null;
  protected cliVersion: string | null = null;
  private readonly logPrefix: string;

  constructor(config: OpenAICompatibleCLIConfig) {
    this.config = config;
    this.logPrefix = `[${config.providerName} CLI]`;

    logger.debug(`${this.logPrefix} Wrapper created`, {
      command: this.config.command,
      model: this.config.model
    });
  }

  /**
   * Check if CLI is available
   *
   * Uses findOnPath for consistent detection across all CLI wrappers.
   */
  isAvailable(): boolean {
    try {
      const result = findOnPath(this.config.command);

      if (result.found) {
        this.cliPath = result.path ?? null;
        this.cliVersion = 'unknown'; // Version detection can be added by subclasses

        logger.debug(`${this.logPrefix} CLI available`, {
          path: this.cliPath
        });

        return true;
      }

      return false;
    } catch (error) {
      logger.debug(`${this.logPrefix} CLI not available`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Initialize the CLI wrapper
   */
  initialize(): void {
    const available = this.isAvailable();
    if (!available) {
      throw new Error(`${this.config.command} CLI is not installed or not in PATH`);
    }
  }

  /**
   * Execute a request using the CLI
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    const startTime = Date.now();

    try {
      // Build CLI arguments
      const args = this.buildArgs(request);

      logger.debug(`${this.logPrefix} Executing`, {
        command: this.config.command,
        args,
        promptLength: request.prompt.length
      });

      // Execute CLI
      const result = await this.spawnCLI(args, request.prompt);
      const latencyMs = Date.now() - startTime;

      // Parse response
      const response = this.parseResponse(result);

      logger.debug(`${this.logPrefix} Request completed`, {
        latencyMs,
        contentLength: response.content.length
      });

      return {
        ...response,
        latencyMs,
        cached: false
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      logger.error(`${this.logPrefix} Request failed`, {
        error: error instanceof Error ? error.message : String(error),
        latencyMs
      });

      throw error;
    }
  }

  /**
   * Build CLI arguments
   */
  protected buildArgs(request: ExecutionRequest): string[] {
    const args: string[] = ['-p'];  // Headless/pipe mode

    // Add model if not default
    const model = this.config.normalizeModel(this.config.model);
    if (model !== this.config.defaultModel) {
      args.push('--model', model);
    }

    // Add system prompt if provided
    if (request.systemPrompt) {
      args.push('--system', request.systemPrompt);
    }

    // Add max tokens if specified
    if (request.maxTokens) {
      args.push('--max-tokens', String(request.maxTokens));
    }

    // Add temperature if specified
    if (request.temperature !== undefined) {
      args.push('--temperature', String(request.temperature));
    }

    return args;
  }

  /**
   * Spawn CLI process and get output
   *
   * BUG FIX: Properly implement timeout handling with manual setTimeout
   * since Node's spawn() doesn't support timeout option.
   */
  protected spawnCLI(args: string[], prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.config.command, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let hasTimedOut = false;

      // Manual timeout since spawn doesn't support timeout option
      const timer = setTimeout(() => {
        hasTimedOut = true;
        child.kill('SIGTERM');
        reject(new Error(`CLI timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);
      timer.unref(); // Prevent timer from keeping process alive

      // Capture stdout (with null check for safety)
      if (child.stdout) {
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }

      // Capture stderr (with null check for safety)
      if (child.stderr) {
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(new Error(`CLI process error: ${error.message}`));
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (hasTimedOut) return; // Already rejected

        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(
            `CLI exited with code ${code}: ${stderr || 'No error message'}`
          ));
        }
      });

      // Write prompt to stdin (with null check)
      if (child.stdin) {
        try {
          const canContinue = child.stdin.write(prompt);
          if (!canContinue && typeof child.stdin.once === 'function') {
            // Handle backpressure: wait for 'drain' event before ending
            child.stdin.once('drain', () => {
              child.stdin?.end();
            });
          } else {
            child.stdin.end();
          }
        } catch (err) {
          clearTimeout(timer);
          reject(new Error(`Failed to write to stdin: ${err instanceof Error ? err.message : String(err)}`));
        }
      } else {
        clearTimeout(timer);
        reject(new Error('CLI stdin not available'));
      }
    });
  }

  /**
   * Parse CLI response
   */
  protected parseResponse(output: string): Omit<ExecutionResponse, 'latencyMs' | 'cached'> {
    const normalizedModel = this.config.normalizeModel(this.config.model);

    // Try to parse as JSON first (structured output)
    try {
      const parsed = JSON.parse(output.trim());

      if (parsed.content || parsed.message) {
        return {
          content: parsed.content || parsed.message || '',
          model: parsed.model || normalizedModel,
          tokensUsed: parsed.usage ? {
            prompt: parsed.usage.prompt_tokens || 0,
            completion: parsed.usage.completion_tokens || 0,
            total: parsed.usage.total_tokens || 0
          } : { prompt: 0, completion: 0, total: 0 },
          finishReason: parsed.finish_reason || 'stop'
        };
      }
    } catch {
      // Not JSON, treat as raw text
    }

    // Return raw output as content
    return {
      content: output.trim(),
      model: normalizedModel,
      tokensUsed: { prompt: 0, completion: 0, total: 0 },
      finishReason: 'stop'
    };
  }

  /**
   * Get the configured model
   */
  getModel(): string {
    return this.config.model;
  }

  /**
   * Get CLI version
   */
  getVersion(): string | null {
    return this.cliVersion;
  }

  /**
   * Get CLI command
   */
  getCommand(): string {
    return this.config.command;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // No persistent resources to clean up
    logger.debug(`${this.logPrefix} Wrapper destroyed`);
  }
}
