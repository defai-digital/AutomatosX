/**
 * OpenAI Codex Provider - Bash-based integration
 *
 * Integrates with OpenAI Codex via process spawning (bash mode).
 * Using bash mode because OpenAI's MCP implementation has known bugs.
 *
 * @module @ax/providers/openai
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

// =============================================================================
// Provider Constants
// =============================================================================

/** Default command for OpenAI Codex CLI */
const DEFAULT_COMMAND = 'codex';

/** Default timeout in milliseconds (5 minutes) */
const DEFAULT_TIMEOUT_MS = 300_000;

/** Health check timeout in milliseconds */
const HEALTH_CHECK_TIMEOUT_MS = 5000;

/** Environment variable for non-interactive mode */
const NON_INTERACTIVE_TERM = 'dumb';

/** Prompt argument flag for CLI */
const PROMPT_ARG_FLAG = '-p';

/** Process success exit code */
const PROCESS_SUCCESS_EXIT_CODE = 0;

/** Process termination signal */
const PROCESS_KILL_SIGNAL = 'SIGTERM';

/** Stdio pipe configuration */
const STDIO_PIPE_CONFIG: ['pipe', 'pipe', 'pipe'] = ['pipe', 'pipe', 'pipe'];

/** Health check keywords */
const HEALTH_CHECK_KEYWORD_CODEX = 'codex';
const HEALTH_CHECK_KEYWORD_OPENAI = 'openai';

/** Error code for bash execution failures */
const ERROR_CODE_BASH_ERROR = 'BASH_ERROR';

// =============================================================================
// Imports
// =============================================================================

import { spawn, type ChildProcess } from 'node:child_process';
import { type ExecutionRequest, type ExecutionResponse } from '@ax/schemas';
import { BaseProvider } from './base.js';

// =============================================================================
// OpenAI Provider
// =============================================================================

export class OpenAIProvider extends BaseProvider {
  readonly id = 'openai' as const;
  readonly name = 'OpenAI Codex';
  readonly integrationMode = 'bash' as const;

  private readonly command: string;
  private readonly defaultArgs: string[];
  private activeProcess: ChildProcess | null = null;

  constructor(options?: { command?: string; args?: string[] }) {
    super();
    this.command = options?.command ?? DEFAULT_COMMAND;
    this.defaultArgs = options?.args ?? [];
  }

  /**
   * Execute a task via OpenAI Codex CLI
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    const start = Date.now();

    try {
      const output = await this.runCommand(request.task, request.timeout);
      const duration = Date.now() - start;

      return this.createSuccessResponse(output, duration);
    } catch (error) {
      const duration = Date.now() - start;
      const message = error instanceof Error ? error.message : 'Unknown error';

      return this.createErrorResponse(request, ERROR_CODE_BASH_ERROR, message, true);
    }
  }

  /**
   * Check OpenAI Codex CLI availability
   */
  async checkHealth(): Promise<boolean> {
    try {
      const output = await this.runCommand('--version', HEALTH_CHECK_TIMEOUT_MS);
      return output.includes(HEALTH_CHECK_KEYWORD_CODEX) || output.includes(HEALTH_CHECK_KEYWORD_OPENAI) || output.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Cleanup any active processes
   */
  override async cleanup(): Promise<void> {
    if (this.activeProcess) {
      this.activeProcess.kill();
      this.activeProcess = null;
    }
    // Call base cleanup to clear recovery timeout
    await super.cleanup();
  }

  /**
   * Run a command via subprocess
   */
  private runCommand(input: string, timeout = DEFAULT_TIMEOUT_MS): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [...this.defaultArgs, PROMPT_ARG_FLAG, input];

      const proc = spawn(this.command, args, {
        stdio: STDIO_PIPE_CONFIG,
        timeout,
        env: {
          ...process.env,
          // Ensure non-interactive mode
          TERM: NON_INTERACTIVE_TERM,
        },
      });

      this.activeProcess = proc;

      let stdout = '';
      let stderr = '';
      let settled = false; // Track if promise is already resolved/rejected
      // Declare timeoutId before settle() to avoid Temporal Dead Zone issue
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      // Named handlers for cleanup
      const onStdoutData = (data: Buffer) => {
        stdout += data.toString();
      };
      const onStderrData = (data: Buffer) => {
        stderr += data.toString();
      };
      const onClose = (code: number | null) => {
        settle(() => {
          if (code === PROCESS_SUCCESS_EXIT_CODE) {
            resolve(stdout.trim());
          } else {
            reject(new Error(stderr.trim() || `Process exited with code ${code}`));
          }
        });
      };
      const onError = (error: Error) => {
        settle(() => reject(error));
      };

      const settle = (fn: () => void) => {
        if (!settled) {
          settled = true;
          if (timeoutId) clearTimeout(timeoutId);
          // Remove all listeners to prevent memory leaks
          proc.stdout.removeListener('data', onStdoutData);
          proc.stderr.removeListener('data', onStderrData);
          proc.removeListener('close', onClose);
          proc.removeListener('error', onError);
          this.activeProcess = null;
          fn();
        }
      };

      proc.stdout.on('data', onStdoutData);
      proc.stderr.on('data', onStderrData);
      proc.on('close', onClose);
      proc.on('error', onError);

      // Handle timeout
      timeoutId = setTimeout(() => {
        if (!settled && this.activeProcess === proc) {
          proc.kill(PROCESS_KILL_SIGNAL);
          settle(() => reject(new Error(`Command timed out after ${timeout}ms`)));
        }
      }, timeout);
    });
  }
}
