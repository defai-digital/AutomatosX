/**
 * Codex CLI Integration - CLI Wrapper
 *
 * Wrapper for executing Codex CLI commands.
 *
 * @module integrations/openai-codex/cli-wrapper
 */

import { spawn } from 'child_process';
import { logger } from '../../shared/logging/logger.js';
import * as readline from 'readline';
import type {
  CodexConfig,
  CodexExecutionOptions,
  CodexExecutionResult,
  IProgressRenderer,
} from './types.js';
import { CodexError, CodexErrorType } from './types.js';
import { getDefaultInjector } from './prompt-injector.js';

/**
 * Maximum buffer size for stdout/stderr (10MB)
 * Prevents memory exhaustion from very large process output
 */
const MAX_BUFFER_SIZE = 10 * 1024 * 1024;

/**
 * Codex CLI Wrapper
 *
 * Provides methods for executing codex CLI commands with proper
 * process management, timeout handling, and error recovery.
 */
export class CodexCLI {
  private activeProcesses: Set<ReturnType<typeof spawn>> = new Set();

  constructor(private config: CodexConfig) {}

  /**
   * Execute codex CLI command
   *
   * @param options - Execution options
   * @returns Execution result
   */
  async execute(options: CodexExecutionOptions): Promise<CodexExecutionResult> {
    const startTime = Date.now();
    const streaming = options.streaming ?? this.config.streaming;

    try {
      // Inject AGENTS.md content if available
      const injector = getDefaultInjector({ projectRoot: options.cwd });
      const enhancedPrompt = await injector.inject(options.prompt);

      logger.debug('CodexCLI.execute', {
        promptLength: options.prompt.length,
        enhancedPromptLength: enhancedPrompt.length,
        agentsMdInjected: enhancedPrompt.length > options.prompt.length,
        model: options.model || this.config.model,
        streaming,
      });

      const args = this.buildArgs(options);

      // Use streaming mode if enabled
      if (streaming) {
        const result = await this.spawnProcessWithStreaming(
          args,
          enhancedPrompt,
          options.timeout,
          options.progressRenderer
        );

        const duration = Date.now() - startTime;

        return {
          content: result.stdout,
          duration,
          exitCode: result.exitCode,
          tokenCount: this.extractTokenCount(result.stdout),
        };
      } else {
        // Standard non-streaming execution
        const result = await this.spawnProcess(args, enhancedPrompt, options.timeout);

        const duration = Date.now() - startTime;

        return {
          content: result.stdout,
          duration,
          exitCode: result.exitCode,
          tokenCount: this.extractTokenCount(result.stdout),
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('CodexCLI.execute failed', {
        error: (error as Error).message,
        duration,
      });

      // Re-throw CodexError directly to preserve error type and context
      if (error instanceof CodexError) {
        throw error;
      }

      throw new CodexError(
        CodexErrorType.EXECUTION_FAILED,
        `Codex execution failed: ${(error as Error).message}`,
        { duration, options }
      );
    }
  }

  /**
   * Check if codex CLI is available
   *
   * @returns True if available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.spawnProcess(['--version'], '', 5000);
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Get codex CLI version
   *
   * @returns Version string
   */
  async getVersion(): Promise<string> {
    try {
      const result = await this.spawnProcess(['--version'], '', 5000);
      return result.stdout.trim();
    } catch (error) {
      throw new CodexError(
        CodexErrorType.CLI_NOT_FOUND,
        'Failed to get codex version',
        { error }
      );
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    logger.debug('CodexCLI.cleanup', {
      activeProcesses: this.activeProcesses.size,
    });

    for (const process of this.activeProcesses) {
      if (!process.killed) {
        process.kill('SIGTERM');
      }
    }
    this.activeProcesses.clear();
  }

  /**
   * Build CLI arguments
   */
  private buildArgs(options: CodexExecutionOptions): string[] {
    const args: string[] = ['exec'];

    // Sandbox mode
    const sandbox = options.sandboxMode || this.config.sandboxMode || 'workspace-write';
    args.push('--sandbox', sandbox);

    // Model (if specified)
    if (options.model || this.config.model) {
      args.push('-c', `model="${options.model || this.config.model}"`);
    }

    // Temperature
    if (options.temperature !== undefined || this.config.temperature !== undefined) {
      const temp = options.temperature ?? this.config.temperature;
      args.push('-c', `temperature=${temp}`);
    }

    // Max tokens
    if (options.maxTokens !== undefined || this.config.maxTokens !== undefined) {
      const maxTokens = options.maxTokens ?? this.config.maxTokens;
      args.push('-c', `max_tokens=${maxTokens}`);
    }

    // Streaming
    if (options.streaming ?? this.config.streaming) {
      args.push('--stream');
    }

    return args;
  }

  /**
   * Spawn codex process
   */
  private async spawnProcess(
    args: string[],
    prompt: string,
    timeout?: number
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let hasTimedOut = false;
      let timeoutHandle: NodeJS.Timeout | null = null;

      const child = spawn(this.config.command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        env: {
          ...process.env,
          // Force non-interactive mode to avoid TTY checks
          TERM: 'dumb',
          NO_COLOR: '1',
          FORCE_COLOR: '0',
          CI: 'true', // Many CLIs disable TTY checks in CI mode
          NO_UPDATE_NOTIFIER: '1',
          DEBIAN_FRONTEND: 'noninteractive'
        }
      });

      this.activeProcesses.add(child);

      // Setup timeout - use unref() to prevent keeping process alive
      const effectiveTimeout = timeout || this.config.timeout || 60000;
      const timer = setTimeout(() => {
        hasTimedOut = true;
        child.kill('SIGTERM');

        reject(
          new CodexError(
            CodexErrorType.TIMEOUT,
            `Codex execution timeout after ${effectiveTimeout}ms`,
            { timeout: effectiveTimeout }
          )
        );
      }, effectiveTimeout);
      timer.unref();
      timeoutHandle = timer;

      // Write prompt to stdin (with error handling)
      if (prompt && child.stdin) {
        try {
          child.stdin.write(prompt);
          child.stdin.end();
        } catch (stdinError) {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
            timeoutHandle = null;
          }
          this.activeProcesses.delete(child);
          reject(
            new CodexError(
              CodexErrorType.EXECUTION_FAILED,
              `Failed to write to stdin: ${stdinError instanceof Error ? stdinError.message : String(stdinError)}`,
              { error: stdinError }
            )
          );
          return;
        }
      }

      // Capture stdout (with buffer size limit)
      if (child.stdout) {
        child.stdout.on('data', (data: Buffer) => {
          if (stdout.length < MAX_BUFFER_SIZE) {
            stdout += data.toString();
            // Truncate if we exceed the limit
            if (stdout.length > MAX_BUFFER_SIZE) {
              stdout = stdout.slice(0, MAX_BUFFER_SIZE);
              logger.warn('Codex stdout truncated due to size limit', { limit: MAX_BUFFER_SIZE });
            }
          }
        });
      }

      // Capture stderr (with buffer size limit)
      if (child.stderr) {
        child.stderr.on('data', (data: Buffer) => {
          if (stderr.length < MAX_BUFFER_SIZE) {
            stderr += data.toString();
            // Truncate if we exceed the limit
            if (stderr.length > MAX_BUFFER_SIZE) {
              stderr = stderr.slice(0, MAX_BUFFER_SIZE);
              logger.warn('Codex stderr truncated due to size limit', { limit: MAX_BUFFER_SIZE });
            }
          }
        });
      }

      // Handle process exit
      child.on('close', (code: number | null) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }

        this.activeProcesses.delete(child);

        if (hasTimedOut) {
          return; // Already rejected
        }

        // Handle null exit code (process killed without exit code)
        const exitCode = code ?? 1;

        if (exitCode === 0) {
          resolve({ stdout, stderr, exitCode });
        } else {
          reject(
            new CodexError(
              CodexErrorType.EXECUTION_FAILED,
              `Codex process exited with code ${exitCode}`,
              { code: exitCode, stderr }
            )
          );
        }
      });

      // Handle spawn errors
      child.on('error', (error: Error) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }

        this.activeProcesses.delete(child);

        if (!hasTimedOut) {
          reject(
            new CodexError(
              CodexErrorType.CLI_NOT_FOUND,
              `Failed to spawn codex: ${error.message}`,
              { error }
            )
          );
        }
      });
    });
  }

  /**
   * Spawn codex process with streaming support
   */
  private async spawnProcessWithStreaming(
    args: string[],
    prompt: string,
    timeout?: number,
    renderer?: IProgressRenderer
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let hasTimedOut = false;
      let timeoutHandle: NodeJS.Timeout | null = null;

      const child = spawn(this.config.command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        env: {
          ...process.env,
          TERM: 'dumb',
          NO_COLOR: '1',
          FORCE_COLOR: '0',
          CI: 'true',
          NO_UPDATE_NOTIFIER: '1',
          DEBIAN_FRONTEND: 'noninteractive'
        }
      });

      this.activeProcesses.add(child);

      // Setup timeout - use unref() to prevent keeping process alive
      const effectiveTimeout = timeout || this.config.timeout || 60000;
      const timer = setTimeout(() => {
        hasTimedOut = true;
        child.kill('SIGTERM');

        if (renderer) {
          renderer.fail(`Timeout after ${effectiveTimeout}ms`);
        }

        reject(
          new CodexError(
            CodexErrorType.TIMEOUT,
            `Codex execution timeout after ${effectiveTimeout}ms`,
            { timeout: effectiveTimeout }
          )
        );
      }, effectiveTimeout);
      timer.unref();
      timeoutHandle = timer;

      // Write prompt to stdin (with error handling)
      if (prompt && child.stdin) {
        try {
          child.stdin.write(prompt);
          child.stdin.end();
        } catch (stdinError) {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
            timeoutHandle = null;
          }
          this.activeProcesses.delete(child);
          if (renderer) {
            renderer.fail('Failed to write to stdin');
          }
          reject(
            new CodexError(
              CodexErrorType.EXECUTION_FAILED,
              `Failed to write to stdin: ${stdinError instanceof Error ? stdinError.message : String(stdinError)}`,
              { error: stdinError }
            )
          );
          return;
        }
      }

      // Process stdout line-by-line for streaming
      // BUG FIX: Track readline interface to ensure proper cleanup
      let rl: readline.Interface | null = null;

      if (child.stdout && renderer) {
        rl = readline.createInterface({
          input: child.stdout,
          crlfDelay: Infinity
        });

        rl.on('line', (line: string) => {
          // Buffer size limit check
          if (stdout.length < MAX_BUFFER_SIZE) {
            stdout += line + '\n';
            if (stdout.length > MAX_BUFFER_SIZE) {
              stdout = stdout.slice(0, MAX_BUFFER_SIZE);
              logger.warn('Codex stdout truncated due to size limit', { limit: MAX_BUFFER_SIZE });
            }
          }
          // Feed line to progress renderer (it will parse JSONL events)
          renderer.processLine(line);
        });

        // BUG FIX: Handle readline errors to prevent unhandled exceptions
        rl.on('error', (error: Error) => {
          logger.warn('Readline error during streaming', {
            error: error.message
          });
          // Close readline interface to prevent resource leak
          if (rl) {
            rl.close();
            rl = null;
          }
        });
      } else if (child.stdout) {
        // No renderer - just capture output (with buffer size limit)
        child.stdout.on('data', (data: Buffer) => {
          if (stdout.length < MAX_BUFFER_SIZE) {
            stdout += data.toString();
            if (stdout.length > MAX_BUFFER_SIZE) {
              stdout = stdout.slice(0, MAX_BUFFER_SIZE);
              logger.warn('Codex stdout truncated due to size limit', { limit: MAX_BUFFER_SIZE });
            }
          }
        });
      }

      // Capture stderr (with buffer size limit)
      if (child.stderr) {
        child.stderr.on('data', (data: Buffer) => {
          if (stderr.length < MAX_BUFFER_SIZE) {
            stderr += data.toString();
            if (stderr.length > MAX_BUFFER_SIZE) {
              stderr = stderr.slice(0, MAX_BUFFER_SIZE);
              logger.warn('Codex stderr truncated due to size limit', { limit: MAX_BUFFER_SIZE });
            }
          }
        });
      }

      // Handle process exit
      child.on('close', (code: number | null) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }

        // BUG FIX: Close readline interface to prevent resource leak
        if (rl) {
          rl.close();
          rl = null;
        }

        this.activeProcesses.delete(child);

        if (hasTimedOut) {
          return; // Already rejected
        }

        // Handle null exit code (process killed without exit code)
        const exitCode = code ?? 1;

        if (exitCode === 0) {
          if (renderer) {
            renderer.succeed('Execution complete');
          }
          resolve({ stdout, stderr, exitCode });
        } else {
          if (renderer) {
            renderer.fail(`Process exited with code ${exitCode}`);
          }
          reject(
            new CodexError(
              CodexErrorType.EXECUTION_FAILED,
              `Codex process exited with code ${exitCode}`,
              { code: exitCode, stderr }
            )
          );
        }
      });

      // Handle spawn errors
      child.on('error', (error: Error) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }

        // BUG FIX: Close readline interface on error
        if (rl) {
          rl.close();
          rl = null;
        }

        this.activeProcesses.delete(child);

        if (!hasTimedOut) {
          if (renderer) {
            renderer.fail(`Failed to spawn: ${error.message}`);
          }
          reject(
            new CodexError(
              CodexErrorType.CLI_NOT_FOUND,
              `Failed to spawn codex: ${error.message}`,
              { error }
            )
          );
        }
      });
    });
  }

  /**
   * Extract token count from output (if available)
   */
  private extractTokenCount(output: string): number | undefined {
    // Codex CLI may include token usage in output
    // This is a placeholder - actual implementation depends on CLI output format
    const match = output.match(/tokens:\s*(\d+)/i);
    return match && match[1] ? parseInt(match[1], 10) : undefined;
  }
}

/**
 * Default codex CLI instance
 */
let defaultCLI: CodexCLI | null = null;

/**
 * Get default codex CLI instance
 *
 * @param config - Configuration (optional)
 * @returns Default CLI instance
 */
export function getDefaultCLI(config?: CodexConfig): CodexCLI {
  if (!defaultCLI || config) {
    defaultCLI = new CodexCLI(
      config || {
        command: 'codex',
        sandboxMode: 'workspace-write',
        timeout: 60000,
      }
    );
  }
  return defaultCLI;
}
