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
import { promisify } from 'util';
import { exec } from 'child_process';
import type { ExecutionRequest, ExecutionResponse } from '../../types/provider.js';
import { logger } from '../../shared/logging/logger.js';
import { TIMEOUTS } from '../../core/validation-limits.js';

const execAsync = promisify(exec);

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
   */
  async isAvailable(): Promise<boolean> {
    try {
      const whichCommand = process.platform === 'win32' ? 'where' : 'which';
      const { stdout } = await execAsync(`${whichCommand} ${this.config.command}`, {
        timeout: TIMEOUTS.PROVIDER_DETECTION
      });

      this.cliPath = stdout.trim();

      if (this.cliPath) {
        // Try to get version
        try {
          const { stdout: versionOutput } = await execAsync(
            `${this.config.command} --version`,
            { timeout: TIMEOUTS.PROVIDER_DETECTION }
          );
          this.cliVersion = versionOutput.trim();
        } catch {
          this.cliVersion = 'unknown';
        }

        logger.debug(`${this.logPrefix} CLI available`, {
          path: this.cliPath,
          version: this.cliVersion
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
  async initialize(): Promise<void> {
    const available = await this.isAvailable();
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
   */
  protected spawnCLI(args: string[], prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.config.command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.config.timeout
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('error', (error) => {
        reject(new Error(`CLI process error: ${error.message}`));
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(
            `CLI exited with code ${code}: ${stderr || 'No error message'}`
          ));
        }
      });

      // Write prompt to stdin
      proc.stdin.write(prompt);
      proc.stdin.end();
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
  async destroy(): Promise<void> {
    // No persistent resources to clean up
    logger.debug(`${this.logPrefix} Wrapper destroyed`);
  }
}
