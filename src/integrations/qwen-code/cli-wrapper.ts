/**
 * Qwen Code CLI Wrapper
 *
 * Wraps the Qwen Code CLI for execution within AutomatosX.
 * Qwen Code CLI is interactive by default, so we use stdin to send prompts.
 *
 * v12.7.0: Added as part of Qwen Code provider integration.
 *
 * @module integrations/qwen-code/cli-wrapper
 */

import { spawn } from 'child_process';
import * as readline from 'readline';
import { logger } from '../../shared/logging/logger.js';
import { TIMEOUTS } from '../../core/validation-limits.js';
import { findOnPath } from '../../core/cli-provider-detector.js';
import type { ExecutionRequest, ExecutionResponse } from '../../types/provider.js';
import {
  type QwenCLIConfig,
  QWEN_DEFAULT_COMMAND,
} from './types.js';

/**
 * Environment variables to force non-interactive CLI mode
 */
const NON_INTERACTIVE_ENV: Readonly<Record<string, string>> = {
  TERM: 'dumb',
  NO_COLOR: '1',
  FORCE_COLOR: '0',
  CI: 'true',
  NO_UPDATE_NOTIFIER: '1',
  DEBIAN_FRONTEND: 'noninteractive'
};

/**
 * Time to wait after SIGTERM before escalating to SIGKILL
 */
const SIGKILL_ESCALATION_MS = 5000;

/**
 * Maximum buffer size for stdout/stderr (10MB)
 * Prevents memory exhaustion from very large process output
 */
const MAX_BUFFER_SIZE = 10 * 1024 * 1024;

/**
 * Qwen Code CLI Wrapper
 *
 * Executes prompts via the Qwen Code CLI.
 *
 * **Setup:**
 * ```bash
 * npm install -g @qwen-code/qwen-code@latest
 * qwen  # First run will prompt for OAuth login
 * ```
 *
 * **Usage:**
 * ```typescript
 * const wrapper = new QwenCliWrapper();
 * const response = await wrapper.execute({ prompt: 'Hello' });
 * ```
 */
export class QwenCliWrapper {
  private readonly config: Required<QwenCLIConfig>;

  constructor(config: QwenCLIConfig = {}) {
    this.config = {
      command: config.command || QWEN_DEFAULT_COMMAND,
      vlmSwitchMode: config.vlmSwitchMode || 'once',
      yolo: config.yolo || false,
      timeout: config.timeout || TIMEOUTS.PROVIDER_DEFAULT
    };

    logger.debug('[Qwen CLI] Wrapper created', {
      command: this.config.command,
      timeout: this.config.timeout
    });
  }

  /**
   * Check if Qwen CLI is available on PATH
   */
  isAvailable(): boolean {
    // Mock mode bypass
    if (process.env.AX_MOCK_PROVIDERS === 'true') {
      return true;
    }

    try {
      const result = findOnPath(this.config.command);
      logger.debug('[Qwen CLI] Availability check', {
        available: result.found,
        path: result.path
      });
      return result.found;
    } catch (error) {
      logger.debug('[Qwen CLI] Availability check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Execute a prompt using the Qwen CLI
   *
   * Since Qwen CLI is interactive, we:
   * 1. Spawn the process
   * 2. Send the prompt via stdin
   * 3. Capture output until we detect completion
   * 4. Return the response
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    // Mock mode for tests
    if (process.env.AX_MOCK_PROVIDERS === 'true') {
      return this.createMockResponse(request.prompt);
    }

    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const args: string[] = [];

      // Add VLM switch mode if configured
      if (this.config.vlmSwitchMode !== 'once') {
        args.push('--vlm-switch-mode', this.config.vlmSwitchMode);
      }

      // Add yolo mode if enabled
      if (this.config.yolo) {
        args.push('--yolo');
      }

      logger.debug('[Qwen CLI] Spawning process', {
        command: this.config.command,
        args,
        promptLength: request.prompt.length
      });

      // Spawn Qwen CLI process
      const child = spawn(this.config.command, args, {
        env: { ...process.env, ...NON_INTERACTIVE_ENV }
      });

      let stdout = '';
      let stderr = '';
      let timeoutId: NodeJS.Timeout | null = null;
      let forceKillTimer: NodeJS.Timeout | null = null;
      let readlineInterface: readline.Interface | null = null;
      let responseStarted = false;
      let settled = false; // BUG FIX: Track if promise is already settled

      // Cleanup helper
      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (forceKillTimer) {
          clearTimeout(forceKillTimer);
          forceKillTimer = null;
        }
        if (readlineInterface) {
          try {
            readlineInterface.close();
          } catch {
            // Ignore cleanup errors
          }
          readlineInterface = null;
        }
      };

      // Create readline interface for line-by-line output
      if (child.stdout) {
        readlineInterface = readline.createInterface({
          input: child.stdout,
          crlfDelay: Infinity
        });

        readlineInterface.on('line', (line) => {
          // Detect response start (Qwen outputs ">" for prompts)
          if (line.startsWith('>') && !responseStarted) {
            responseStarted = true;
            return; // Skip the prompt echo
          }

          if (responseStarted && stdout.length < MAX_BUFFER_SIZE) {
            stdout += line + '\n';
            // Truncate if we exceed the limit
            if (stdout.length > MAX_BUFFER_SIZE) {
              stdout = stdout.slice(0, MAX_BUFFER_SIZE);
              logger.warn('[Qwen CLI] stdout truncated due to size limit', { limit: MAX_BUFFER_SIZE });
            }
          }
        });

        readlineInterface.on('error', (error) => {
          logger.debug('[Qwen CLI] Readline error', {
            error: error.message
          });
        });
      }

      // Capture stderr (with buffer size limit)
      if (child.stderr) {
        child.stderr.on('data', (data) => {
          if (stderr.length < MAX_BUFFER_SIZE) {
            stderr += data.toString();
            // Truncate if we exceed the limit
            if (stderr.length > MAX_BUFFER_SIZE) {
              stderr = stderr.slice(0, MAX_BUFFER_SIZE);
              logger.warn('[Qwen CLI] stderr truncated due to size limit', { limit: MAX_BUFFER_SIZE });
            }
          }
        });
      }

      // Send prompt to stdin
      if (child.stdin) {
        try {
          // Build full prompt
          let fullPrompt = request.prompt;
          if (request.systemPrompt) {
            fullPrompt = `${request.systemPrompt}\n\n${request.prompt}`;
          }

          // Send prompt and exit command
          child.stdin.write(fullPrompt);
          child.stdin.write('\n');
          child.stdin.end();
        } catch (error) {
          settled = true; // BUG FIX: Mark as settled to prevent double resolution
          cleanup();
          child.kill('SIGTERM');
          reject(new Error(`Failed to write to Qwen stdin: ${error instanceof Error ? error.message : String(error)}`));
          return;
        }
      } else {
        settled = true; // BUG FIX: Mark as settled to prevent double resolution
        cleanup();
        reject(new Error('Qwen CLI stdin not available'));
        return;
      }

      // Handle process completion (use once() to prevent listener leaks)
      child.once('close', (code, signal) => {
        cleanup();

        // BUG FIX: Skip if promise already settled (e.g., stdin write failed)
        if (settled) return;
        settled = true;

        const latencyMs = Date.now() - startTime;

        if (stderr) {
          logger.debug('[Qwen CLI] stderr output', { stderr: stderr.trim() });
        }

        if ((code === 0 || code === null) && !signal) {
          // Success - parse response
          const content = this.parseResponse(stdout);

          resolve({
            content: content.trim(),
            model: 'qwen-code-cli',
            tokensUsed: {
              prompt: this.estimateTokens(request.prompt),
              completion: this.estimateTokens(content),
              total: this.estimateTokens(request.prompt) + this.estimateTokens(content)
            },
            latencyMs,
            finishReason: 'stop',
            cached: false
          });
        } else if (signal) {
          reject(new Error(`Qwen CLI killed by signal ${signal}. stderr: ${stderr || 'none'}`));
        } else {
          reject(new Error(`Qwen CLI exited with code ${code}. stderr: ${stderr || 'none'}`));
        }
      });

      // Handle process errors (use once() to prevent listener leaks)
      child.once('error', (error) => {
        cleanup();

        // BUG FIX: Skip if promise already settled
        if (settled) return;
        settled = true;

        logger.error('[Qwen CLI] Process error', {
          error: error.message
        });
        reject(new Error(`Failed to spawn Qwen CLI: ${error.message}`));
      });

      // Timeout handling - use unref() to prevent keeping process alive
      const timer = setTimeout(() => {
        if (child.pid && !child.killed) {
          logger.warn('[Qwen CLI] Killing process due to timeout', {
            pid: child.pid,
            timeout: this.config.timeout
          });

          child.kill('SIGTERM');

          // Escalate to SIGKILL if needed
          const killTimer = setTimeout(() => {
            if (child.pid) {
              try {
                process.kill(child.pid, 0);
                logger.warn('[Qwen CLI] Force killing process', { pid: child.pid });
                child.kill('SIGKILL');
              } catch {
                // Process already exited
              }
            }
          }, SIGKILL_ESCALATION_MS);
          killTimer.unref();
          forceKillTimer = killTimer;
        }
      }, this.config.timeout);
      timer.unref();
      timeoutId = timer;
    });
  }

  /**
   * Parse response from CLI output
   *
   * Qwen CLI outputs include prompts and formatting that we need to strip.
   */
  private parseResponse(output: string): string {
    // Remove any leading/trailing whitespace
    let content = output.trim();

    // Remove ANSI escape codes
    content = content.replace(/\x1B\[[0-9;]*[mGKH]/g, '');

    // Remove common CLI artifacts
    content = content
      .replace(/^>\s*/gm, '')           // Remove prompt markers
      .replace(/\n{3,}/g, '\n\n')       // Normalize multiple newlines
      .trim();

    return content;
  }

  /**
   * Estimate token count
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Create mock response for testing
   */
  private createMockResponse(prompt: string): ExecutionResponse {
    return {
      content: `[Mock Qwen Response]\n\nThis is a mock response from Qwen Code CLI.\nPrompt length: ${prompt.length} characters.`,
      model: 'qwen-code-cli-mock',
      tokensUsed: {
        prompt: this.estimateTokens(prompt),
        completion: 50,
        total: this.estimateTokens(prompt) + 50
      },
      latencyMs: 10,
      finishReason: 'stop',
      cached: false
    };
  }

  /**
   * Get CLI command
   */
  getCommand(): string {
    return this.config.command;
  }
}
