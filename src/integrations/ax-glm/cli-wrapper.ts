/**
 * GLM CLI Wrapper
 *
 * Wraps the ax-glm CLI for fallback execution when SDK is unavailable.
 *
 * v12.0.0: Added as part of PRD-012 provider architecture refactoring.
 *
 * @module integrations/ax-glm/cli-wrapper
 */

import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import type { ExecutionRequest, ExecutionResponse } from '../../types/provider.js';
import { logger } from '../../shared/logging/logger.js';
import { TIMEOUTS } from '../../core/validation-limits.js';
import {
  type GLMCLIConfig,
  type GLMModel,
  GLM_DEFAULT_COMMAND,
  GLM_DEFAULT_MODEL,
  normalizeGLMModel
} from './types.js';

const execAsync = promisify(exec);

/**
 * GLM CLI Wrapper
 *
 * Executes prompts via the ax-glm CLI tool.
 *
 * **Setup:**
 * ```bash
 * npm install -g @defai.digital/ax-glm
 * export ZAI_API_KEY=your_api_key
 * ```
 *
 * **Usage:**
 * ```typescript
 * const cli = new GLMCliWrapper({ model: 'glm-4.6' });
 * const response = await cli.execute({ prompt: 'Hello' });
 * ```
 */
export class GLMCliWrapper {
  private readonly config: Required<GLMCLIConfig>;
  private cliPath: string | null = null;
  private cliVersion: string | null = null;

  constructor(config: GLMCLIConfig = {}) {
    this.config = {
      command: config.command || GLM_DEFAULT_COMMAND,
      model: config.model || GLM_DEFAULT_MODEL,
      timeout: config.timeout || TIMEOUTS.PROVIDER_DEFAULT
    };

    logger.debug('[GLM CLI] Wrapper created', {
      command: this.config.command,
      model: this.config.model
    });
  }

  /**
   * Check if CLI is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`which ${this.config.command}`, {
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

        logger.debug('[GLM CLI] CLI available', {
          path: this.cliPath,
          version: this.cliVersion
        });

        return true;
      }

      return false;
    } catch (error) {
      logger.debug('[GLM CLI] CLI not available', {
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

      logger.debug('[GLM CLI] Executing', {
        command: this.config.command,
        args,
        promptLength: request.prompt.length
      });

      // Execute CLI
      const result = await this.spawnCLI(args, request.prompt);
      const latencyMs = Date.now() - startTime;

      // Parse response
      const response = this.parseResponse(result);

      logger.debug('[GLM CLI] Request completed', {
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

      logger.error('[GLM CLI] Request failed', {
        error: error instanceof Error ? error.message : String(error),
        latencyMs
      });

      throw error;
    }
  }

  /**
   * Build CLI arguments
   */
  private buildArgs(request: ExecutionRequest): string[] {
    const args: string[] = ['-p'];  // Headless/pipe mode

    // Add model if not default
    const model = normalizeGLMModel(this.config.model);
    if (model !== 'glm-4') {
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
  private spawnCLI(args: string[], prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(this.config.command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.config.timeout
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('error', (error) => {
        reject(new Error(`CLI process error: ${error.message}`));
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(
            `CLI exited with code ${code}: ${stderr || 'No error message'}`
          ));
        }
      });

      // Write prompt to stdin
      process.stdin.write(prompt);
      process.stdin.end();
    });
  }

  /**
   * Parse CLI response
   */
  private parseResponse(output: string): Omit<ExecutionResponse, 'latencyMs' | 'cached'> {
    // Try to parse as JSON first (structured output)
    try {
      const parsed = JSON.parse(output.trim());

      if (parsed.content || parsed.message) {
        return {
          content: parsed.content || parsed.message || '',
          model: parsed.model || normalizeGLMModel(this.config.model),
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
      model: normalizeGLMModel(this.config.model),
      tokensUsed: { prompt: 0, completion: 0, total: 0 },
      finishReason: 'stop'
    };
  }

  /**
   * Get the configured model
   */
  getModel(): GLMModel {
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
    logger.debug('[GLM CLI] Wrapper destroyed');
  }
}
