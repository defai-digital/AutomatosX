/**
 * BaseProvider - Simplified for v8.3.0 (Pure CLI Wrapper)
 *
 * Provides minimal functionality:
 * - CLI command execution
 * - Basic availability checking
 * - Simple error handling
 *
 * REMOVED in v8.3.0:
 * - API key management
 * - Model selection
 * - Cost tracking
 * - Rate limiting
 * - Circuit breakers
 * - Retry logic
 * - Token bucket algorithms
 * - Usage statistics
 * - Response caching
 */

import type {
  Provider,
  ProviderConfig,
  ExecutionRequest,
  ExecutionResponse,
  HealthStatus,
  ProviderCapabilities
} from '../types/provider.js';
import { logger } from '../shared/logging/logger.js';
import { ProviderError, ErrorCode } from '../shared/errors/errors.js';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { findOnPath } from '../core/cli-provider-detector.js';
import {
  safeValidateExecutionRequest,
  safeValidateExecutionResponse
} from './provider-schemas.js';
import readline from 'readline';
import chalk from 'chalk';
import { StreamingProgressParser } from '../shared/process/streaming-progress-parser.js';
import { VerbosityManager } from '../shared/logging/verbosity-manager.js';
import { isLimitError } from './error-patterns.js';
import { shouldRetryError, type RetryableProvider } from './retry-errors.js';

export abstract class BaseProvider implements Provider {
  /**
   * Whitelist of allowed provider names for security
   * v8.3.0: Support both old (claude-code, gemini-cli) and new (claude, gemini) names for backward compatibility
   * v9.2.0: Added 'ax-cli' (multi-model provider: GLM, xAI, OpenAI, Anthropic, Ollama)
   * v9.2.0: 'glm' is deprecated, use 'ax-cli' instead (kept for backward compatibility)
   */
  private static readonly ALLOWED_PROVIDER_NAMES = [
    'claude',
    'claude-code',   // Backward compatibility - maps to claude CLI
    'gemini',
    'gemini-cli',    // Backward compatibility - maps to gemini CLI
    'openai',
    'codex',
    'ax-cli',        // v9.2.0: Multi-model provider via ax-cli (GLM, xAI, OpenAI, Anthropic, Ollama, DeepSeek, Llama)
    'glm',           // v9.2.0: DEPRECATED - use 'ax-cli' instead (kept for backward compatibility)
    'test-provider'  // For unit tests
  ] as const;

  /** Environment variables to force non-interactive CLI mode */
  private static readonly NON_INTERACTIVE_ENV: Readonly<Record<string, string>> = {
    TERM: 'dumb',
    NO_COLOR: '1',
    FORCE_COLOR: '0',
    CI: 'true',
    NO_UPDATE_NOTIFIER: '1',
    DEBIAN_FRONTEND: 'noninteractive'
  };

  /** Default CLI execution timeout in milliseconds */
  private static readonly DEFAULT_TIMEOUT_MS = 120000;

  /** Time to wait after SIGTERM before escalating to SIGKILL */
  private static readonly SIGKILL_ESCALATION_MS = 5000;

  protected config: ProviderConfig;
  protected logger = logger;
  protected health: {
    available: boolean;
    latencyMs: number;
    errorRate: number;
    consecutiveFailures: number;
    consecutiveSuccesses: number; // BUG FIX: Added tracking for consecutive successes
    lastCheck: number;
  };

  constructor(config: ProviderConfig) {
    // Validate provider name
    const providerName = config.name.toLowerCase();
    if (!BaseProvider.ALLOWED_PROVIDER_NAMES.includes(providerName as any)) {
      throw new ProviderError(
        `Invalid provider name: ${config.name}. Allowed: ${BaseProvider.ALLOWED_PROVIDER_NAMES.join(', ')}`,
        ErrorCode.CONFIG_INVALID
      );
    }

    // Normalize provider name to lowercase for consistency
    this.config = { ...config, name: providerName };
    this.health = {
      available: false,
      latencyMs: 0,
      errorRate: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0, // BUG FIX: Track consecutive successes
      lastCheck: Date.now()
    };
  }

  /**
   * Get the CLI command name for this provider
   * Subclasses return: 'claude', 'gemini', 'codex'
   */
  protected abstract getCLICommand(): string;

  /**
   * Get CLI arguments (optional, for providers that need special flags)
   * Subclasses can override to add provider-specific arguments
   */
  protected getCLIArgs(): string[] | Promise<string[]> {
    return [];  // No args by default
  }

  /**
   * Get mock response for testing
   * Subclasses return provider-specific mock response
   */
  protected abstract getMockResponse(): string;

  /**
   * Execute CLI command with streaming support (v8.4.18)
   *
   * Uses spawn() + readline for line-by-line streaming when verbose/streaming mode enabled.
   * Falls back to silent buffering by default (backward compatible).
   *
   * Template method pattern: Common logic here, provider-specific parts via getCLICommand() and getMockResponse()
   */
  protected async executeCLI(prompt: string): Promise<string> {
    // Mock mode for tests - v8.3.0 Security Fix: Don't leak prompt content
    if (process.env.AX_MOCK_PROVIDERS === 'true') {
      logger.debug('Mock mode: returning test response');
      return this.getMockResponse();
    }

    try {
      const cliCommand = this.getCLICommand();
      const cliArgs = await this.getCLIArgs();

      // SECURITY: Escape each CLI arg to prevent command injection
      // Defense-in-depth: Even though current providers return hardcoded safe values,
      // future providers might override getCLIArgs() with untrusted data.
      const escapedArgs = cliArgs.map(arg => this.escapeShellArg(arg));
      const argsString = escapedArgs.length > 0 ? escapedArgs.join(' ') + ' ' : '';

      // v9.0.3 Windows Fix: Check if command would exceed Windows limit (8191 chars)
      // Use stdin for long prompts instead of command-line arguments
      const escapedPrompt = this.escapeShellArg(prompt);
      const fullCommand = `${cliCommand} ${argsString}${escapedPrompt}`;
      const commandLength = fullCommand.length;

      // Windows cmd.exe limit: 8191 characters
      // Use stdin if command exceeds 7000 chars (safety buffer for shell overhead)
      const isWindows = process.platform === 'win32';
      const useStdin = isWindows && commandLength > 7000;

      logger.debug(`Executing ${cliCommand} CLI with streaming support`, {
        command: cliCommand,
        promptLength: prompt.length,
        commandLength,
        useStdin,
        streaming: process.env.AUTOMATOSX_SHOW_PROVIDER_OUTPUT === 'true'
      });

      // v9.0.3 Windows Fix: Use stdin for long prompts on Windows
      const result = useStdin
        ? await this.executeWithStdin(cliCommand, cliArgs, prompt)
        : await this.executeWithSpawn(fullCommand, cliCommand);

      if (!result.stdout) {
        throw new Error(`${cliCommand} CLI returned empty output. stderr: ${result.stderr || 'none'}`);
      }

      logger.debug(`${cliCommand} CLI execution successful`, {
        responseLength: result.stdout.trim().length
      });

      return result.stdout.trim();
    } catch (error) {
      const cliCommandName = this.getCLICommand();
      logger.error(`${cliCommandName} CLI execution failed`, {
        error: error instanceof Error ? error.message : String(error),
        command: cliCommandName,
        promptLength: prompt.length,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw this.handleError(error);
    }
  }

  /**
   * Execute command using spawn() with streaming support (v8.4.18)
   *
   * Supports real-time line-by-line output streaming with proper timeout
   * and cleanup behaviors (SIGTERM → SIGKILL escalation pattern).
   *
   * @param command - Full command string to execute
   * @param cliCommand - CLI command name (for logging)
   * @returns Promise resolving to stdout and stderr
   */
  private async executeWithSpawn(
    command: string,
    cliCommand: string
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      // Spawn with shell enabled (maintains compatibility with current escaping)
      // CRITICAL: spawn() signature is spawn(command, args[], options)
      // We pass empty args array and use shell option to execute the full command string
      // v9.0.3 Windows Fix: Use auto-detected shell instead of hardcoded /bin/bash
      const child = spawn(command, [], {
        shell: true,  // Auto-detects: cmd.exe on Windows, /bin/sh on Unix
        timeout: this.config.timeout || BaseProvider.DEFAULT_TIMEOUT_MS,
        env: { ...process.env, ...BaseProvider.NON_INTERACTIVE_ENV }
      });

      let stdout = '';
      let stderr = '';
      let timeoutId: NodeJS.Timeout | null = null;
      let forceKillTimer: NodeJS.Timeout | null = null;
      let readlineInterface: readline.Interface | null = null;

      const streamingEnabled = process.env.AUTOMATOSX_SHOW_PROVIDER_OUTPUT === 'true';
      const debugMode = process.env.AUTOMATOSX_DEBUG === 'true';

      // v8.5.8: Check verbosity to determine quiet mode
      const verbosity = VerbosityManager.getInstance();
      const quietMode = verbosity.isQuiet();

      // Create progress parser for user-friendly streaming (v8.5.1)
      let progressParser: StreamingProgressParser | null = null;
      if (streamingEnabled) {
        progressParser = new StreamingProgressParser(debugMode, quietMode);
        progressParser.start(`Executing ${cliCommand}...`);
      }

      // Create readline interface for line-by-line streaming
      if (child.stdout) {
        readlineInterface = readline.createInterface({
          input: child.stdout,
          crlfDelay: Infinity
        });

        readlineInterface.on('line', (line) => {
          stdout += line + '\n';

          // Stream to console if enabled (v8.5.1: user-friendly progress)
          if (streamingEnabled && progressParser) {
            const progress = progressParser.parseLine(line);
            if (progress) {
              progressParser.update(progress);
            }
          }
        });

        // Handle readline errors to prevent uncaught exceptions
        readlineInterface.on('error', (error) => {
          logger.error('Readline interface error', { error });
          if (progressParser) {
            progressParser.update({
              type: 'error',
              message: 'Stream error occurred'
            });
          }
        });
      }

      // Capture stderr (for error messages)
      if (child.stderr) {
        child.stderr.on('data', (data) => {
          const stderrChunk = data.toString();
          stderr += stderrChunk;

          // Stream stderr if enabled (usually warnings/errors)
          if (streamingEnabled && progressParser) {
            // Split by lines and display each as error/warning
            stderrChunk.split('\n').forEach((line: string) => {
              if (line.trim()) {
                // Show stderr in debug mode or as warnings
                if (debugMode) {
                  progressParser!.update({
                    type: 'raw',
                    message: chalk.yellow('[stderr] ') + line
                  });
                }
              }
            });
          }
        });
      }

      // Cleanup helper - ensures all resources are released
      const cleanup = () => {
        // Clear timers first to prevent further execution
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (forceKillTimer) {
          clearTimeout(forceKillTimer);
          forceKillTimer = null;
        }
        // Close readline interface to prevent memory leaks
        if (readlineInterface) {
          try {
            readlineInterface.close();
          } catch (error) {
            logger.debug('Error closing readline interface', { error });
          } finally {
            readlineInterface = null;
          }
        }
      };

      // Handle process completion
      child.on('close', (code, signal) => {
        cleanup();

        // Log stderr as debug if present (even on success)
        // Many CLIs output informational messages to stderr, which is normal
        if (stderr) {
          logger.debug(`${cliCommand} CLI stderr output`, { stderr: stderr.trim() });
        }

        // BUG FIX: Check signal as well as code
        // If process was killed by signal (timeout, SIGTERM), treat as error
        // Previously: code=null with signal set was treated as success
        if ((code === 0 || code === null) && !signal) {
          // Mark progress as complete (v8.5.1)
          if (progressParser) {
            progressParser.succeed(`${cliCommand} completed successfully`);
          }
          resolve({ stdout, stderr });
        } else if (signal) {
          // Process was killed by signal (timeout, SIGTERM, SIGKILL, etc.)
          if (progressParser) {
            progressParser.fail(`${cliCommand} killed by signal ${signal}`);
          }
          reject(new Error(`${cliCommand} CLI killed by signal ${signal}. stderr: ${stderr || 'none'}`));
        } else {
          // Mark progress as failed (v8.5.1)
          if (progressParser) {
            progressParser.fail(`${cliCommand} failed with code ${code}`);
          }
          reject(new Error(`${cliCommand} CLI exited with code ${code}${signal ? ` (signal: ${signal})` : ''}. stderr: ${stderr || 'none'}`));
        }
      });

      // Handle process errors (spawn failures)
      child.on('error', (error) => {
        cleanup();

        // Mark progress as failed (v8.5.1)
        if (progressParser) {
          progressParser.fail(`Failed to spawn ${cliCommand}`);
        }

        logger.error('CLI process spawn error', {
          command: cliCommand,
          error: error.message
        });
        reject(new Error(`Failed to spawn ${cliCommand} CLI: ${error.message}`));
      });

      // Timeout handling with SIGTERM → SIGKILL escalation
      const timeout = this.config.timeout || BaseProvider.DEFAULT_TIMEOUT_MS;
      timeoutId = setTimeout(() => {
        if (child.pid && !child.killed) {
          logger.warn('Killing child process due to timeout', {
            pid: child.pid,
            command: cliCommand,
            timeout
          });

          child.kill('SIGTERM');

          // Escalate to SIGKILL after timeout if SIGTERM fails
          forceKillTimer = setTimeout(() => {
            if (child.pid && !child.killed) {
              logger.warn('Force killing child process', { pid: child.pid });
              child.kill('SIGKILL');
            }
          }, BaseProvider.SIGKILL_ESCALATION_MS);
        }
      }, timeout);
    });
  }

  /**
   * Execute command with prompt passed via stdin (v9.0.3)
   *
   * Solves Windows command-line length limit (8191 chars) by passing
   * the prompt via stdin instead of as a command-line argument.
   *
   * @param cliCommand - CLI command name (e.g., 'gemini')
   * @param cliArgs - CLI arguments (e.g., '--approval-mode auto_edit')
   * @param prompt - Prompt to send via stdin
   * @returns Promise resolving to stdout and stderr
   */
  private async executeWithStdin(
    cliCommand: string,
    cliArgs: string[],
    prompt: string
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      logger.debug(`Executing ${cliCommand} CLI with stdin`, {
        command: cliCommand,
        args: cliArgs,
        promptLength: prompt.length
      });

      // Spawn process (no shell needed - direct command execution)
      const child = spawn(cliCommand, cliArgs, {
        timeout: this.config.timeout || BaseProvider.DEFAULT_TIMEOUT_MS,
        env: { ...process.env, ...BaseProvider.NON_INTERACTIVE_ENV }
      });

      let stdout = '';
      let stderr = '';
      let timeoutId: NodeJS.Timeout | null = null;
      let forceKillTimer: NodeJS.Timeout | null = null;
      let readlineInterface: readline.Interface | null = null;
      let stderrInterface: readline.Interface | null = null;

      const streamingEnabled = process.env.AUTOMATOSX_SHOW_PROVIDER_OUTPUT === 'true';
      const debugMode = process.env.AUTOMATOSX_DEBUG === 'true';
      const verbosity = VerbosityManager.getInstance();
      const quietMode = verbosity.isQuiet();

      // Create progress parser for user-friendly streaming
      let progressParser: StreamingProgressParser | null = null;
      if (streamingEnabled) {
        progressParser = new StreamingProgressParser(debugMode, quietMode);
        progressParser.start(`Executing ${cliCommand}...`);
      }

      // Write prompt to stdin
      // BUG FIX: Previously swallowed write errors which caused the child process
      // to hang indefinitely without input. Now properly rejects on write failure.
      if (child.stdin) {
        try {
          child.stdin.write(prompt);
          child.stdin.end(); // Signal EOF
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Failed to write to stdin', {
            command: cliCommand,
            error: errorMessage
          });
          // BUG FIX: Reject immediately instead of swallowing the error
          // Without input, the child process will hang until timeout
          child.kill('SIGTERM');
          reject(new Error(`Failed to write prompt to ${cliCommand} stdin: ${errorMessage}`));
          return;
        }
      } else {
        // BUG FIX: Handle case where stdin is not available
        logger.error('stdin not available for child process', { command: cliCommand });
        child.kill('SIGTERM');
        reject(new Error(`${cliCommand} stdin not available - cannot send prompt`));
        return;
      }

      // Create readline interface for line-by-line streaming (stdout)
      if (child.stdout) {
        readlineInterface = readline.createInterface({
          input: child.stdout,
          crlfDelay: Infinity
        });

        readlineInterface.on('line', (line) => {
          stdout += line + '\n';

          // Stream to console if enabled
          if (streamingEnabled && progressParser) {
            const progress = progressParser.parseLine(line);
            if (progress) {
              progressParser.update(progress);
            }
          }
        });

        // Handle readline errors
        readlineInterface.on('error', (error) => {
          if (error.message !== 'Readable stream already read') {
            logger.debug('Readline error (non-fatal)', {
              error: error.message,
              message: 'Stream error occurred'
            });
          }
        });
      }

      // Capture stderr output
      if (child.stderr) {
        // Add readline interface for stderr streaming
        stderrInterface = readline.createInterface({
          input: child.stderr,
          crlfDelay: Infinity
        });

        stderrInterface.on('line', (line) => {
          stderr += line + '\n';

          // Stream stderr to console if streaming enabled and debug mode
          if (streamingEnabled && debugMode) {
            if (!quietMode) {
              console.log(chalk.yellow('[stderr] ') + line);
            } else {
              logger.debug('Provider stderr', {
                message: chalk.yellow('[stderr] ') + line
              });
            }
          }
        });

        // Handle stderr readline errors
        stderrInterface.on('error', (error) => {
          if (error.message !== 'Readable stream already read') {
            logger.debug('Stderr readline error (non-fatal)', {
              error: error.message
            });
          }
        });
      }

      // Cleanup function
      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (forceKillTimer) {
          clearTimeout(forceKillTimer);
          forceKillTimer = null;
        }
        // Close readline interfaces to prevent memory leaks
        if (readlineInterface) {
          try {
            readlineInterface.close();
          } catch (error) {
            // Ignore cleanup errors
          } finally {
            readlineInterface = null;
          }
        }
        if (stderrInterface) {
          try {
            stderrInterface.close();
          } catch (error) {
            // Ignore cleanup errors
          } finally {
            stderrInterface = null;
          }
        }
      };

      // Handle process exit
      child.on('close', (code, signal) => {
        cleanup();

        if (stderr) {
          logger.debug(`${cliCommand} CLI stderr output`, { stderr: stderr.trim() });
        }

        // Bug fix: Check both exit code AND signal for proper exit handling
        // Process killed by signal (SIGTERM, SIGKILL) should be treated as failure
        if ((code === 0 || code === null) && !signal) {
          if (progressParser) {
            progressParser.succeed(`${cliCommand} completed successfully`);
          }
          resolve({ stdout, stderr });
        } else if (signal) {
          if (progressParser) {
            progressParser.fail(`${cliCommand} killed by signal ${signal}`);
          }
          reject(new Error(`${cliCommand} CLI killed by signal ${signal}. stderr: ${stderr || 'none'}`));
        } else {
          if (progressParser) {
            progressParser.fail(`${cliCommand} failed with code ${code}`);
          }
          reject(new Error(`${cliCommand} CLI exited with code ${code}. stderr: ${stderr || 'none'}`));
        }
      });

      // Handle process errors (spawn failures)
      child.on('error', (error) => {
        cleanup();

        if (progressParser) {
          progressParser.fail(`Failed to spawn ${cliCommand}`);
        }

        logger.error('CLI process spawn error', {
          command: cliCommand,
          error: error.message
        });
        reject(new Error(`Failed to spawn ${cliCommand} CLI: ${error.message}`));
      });

      // Timeout handling
      const timeout = this.config.timeout || BaseProvider.DEFAULT_TIMEOUT_MS;
      timeoutId = setTimeout(() => {
        if (child.pid && !child.killed) {
          logger.warn('Killing child process due to timeout', {
            pid: child.pid,
            command: cliCommand,
            timeout
          });

          child.kill('SIGTERM');
          // Force kill after timeout if SIGTERM doesn't work
          forceKillTimer = setTimeout(() => {
            if (child.pid && !child.killed) {
              logger.warn('Force killing child process', { pid: child.pid });
              child.kill('SIGKILL');
            }
          }, BaseProvider.SIGKILL_ESCALATION_MS);
        }
      }, timeout);
    });
  }

  /**
   * Check if CLI is available - Template method pattern
   * Uses getCLICommand() to determine which CLI to check
   *
   * v11.2.9 Fix: Always return true in mock mode (AX_MOCK_PROVIDERS=true)
   * This allows integration tests in CI to run without installing actual provider CLIs
   */
  protected async checkCLIAvailable(): Promise<boolean> {
    // v11.2.9 Fix: Mock mode bypasses CLI availability check
    // This is essential for CI integration tests where no provider CLIs are installed
    if (process.env.AX_MOCK_PROVIDERS === 'true') {
      logger.debug(`${this.getCLICommand()} CLI availability check (mock mode)`, {
        available: true,
        mockMode: true
      });
      return true;
    }

    try {
      const cliCommand = this.getCLICommand();
      const result = findOnPath(cliCommand);
      const available = result.found;

      logger.debug(`${cliCommand} CLI availability check`, {
        available,
        path: result.path || 'not found'
      });

      return available;
    } catch (error) {
      logger.debug(`${this.getCLICommand()} CLI availability check failed`, { error });
      return false;
    }
  }

  /**
   * Get provider name
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Execute a request via CLI
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    const startTime = Date.now();

    try {
      // Validate request with Zod
      const requestValidation = safeValidateExecutionRequest(request);
      if (!requestValidation.success) {
        // Note: Zod v3.x uses 'issues' instead of 'errors'
        const validationErrors = requestValidation.error.issues.map(e =>
          `${e.path.join('.')}: ${e.message}`
        ).join('; ');
        throw new ProviderError(
          `Invalid execution request: ${validationErrors}`,
          ErrorCode.PROVIDER_EXEC_ERROR
        );
      }

      logger.debug(`Executing request with ${this.config.name}`, {
        prompt: request.prompt.substring(0, 100) + '...'
      });

      // Build full prompt with system prompt if provided
      let fullPrompt = request.prompt;
      if (request.systemPrompt) {
        fullPrompt = `${request.systemPrompt}\n\n${request.prompt}`;
      }

      // DEBUG: Log the full prompt being sent (v8.4.16 debugging)
      if (process.env.AUTOMATOSX_DEBUG_PROMPT === 'true') {
        const debugPath = path.join(process.cwd(), 'automatosx/tmp/debug-prompt.txt');
        fs.writeFileSync(debugPath, `=== FULL PROMPT SENT TO ${this.getCLICommand()} ===\n\n${fullPrompt}\n\n=== END PROMPT ===\n`);
        logger.debug(`Full prompt saved to ${debugPath}`);
      }

      const result = await this.executeCLI(fullPrompt);
      const latencyMs = Date.now() - startTime;

      // Update health on success
      this.health.consecutiveFailures = 0;
      this.health.consecutiveSuccesses++; // BUG FIX: Track consecutive successes
      this.health.available = true;
      this.health.errorRate = 0;
      this.health.latencyMs = latencyMs;
      this.health.lastCheck = Date.now();

      const response: ExecutionResponse = {
        content: result,
        model: 'default', // v8.3.0: CLI determines model
        tokensUsed: {
          prompt: 0, // v8.3.0: No token tracking
          completion: 0,
          total: 0
        },
        latencyMs,
        finishReason: 'stop',
        cached: false
      };

      // Validate response with Zod (ensure we're returning valid data)
      const responseValidation = safeValidateExecutionResponse(response);
      if (!responseValidation.success) {
        logger.error('Invalid execution response generated', {
          errors: responseValidation.error.issues,
          response
        });
        // SECURITY: Don't return invalid data - throw error to prevent downstream issues
        throw new ProviderError(
          `Provider returned invalid response structure: ${responseValidation.error.issues.map(i => i.message).join(', ')}`,
          ErrorCode.PROVIDER_EXEC_ERROR
        );
      }

      return response;
    } catch (error) {
      this.health.consecutiveFailures++;
      this.health.consecutiveSuccesses = 0; // BUG FIX: Reset on failure
      this.health.available = false;
      this.health.errorRate = 1;
      this.health.latencyMs = Date.now() - startTime;
      this.health.lastCheck = Date.now();
      throw this.handleError(error);
    }
  }

  /**
   * Check if provider CLI is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const available = await this.checkCLIAvailable();
      // BUG FIX: Use selective property updates instead of full object replacement
      // Previously overwrote entire health object which reset latencyMs to 0,
      // losing valuable latency information from previous execute() calls.
      this.health.available = available;
      this.health.errorRate = available ? 0 : 1;
      this.health.lastCheck = Date.now();
      if (available) {
        this.health.consecutiveFailures = 0;
        this.health.consecutiveSuccesses++; // BUG FIX: Track consecutive successes
      } else {
        this.health.consecutiveFailures++;
        this.health.consecutiveSuccesses = 0; // Reset on failure
      }
      // Note: latencyMs is preserved from previous execute() calls
      return available;
    } catch (error) {
      this.health.available = false;
      this.health.errorRate = 1;
      this.health.lastCheck = Date.now();
      this.health.consecutiveFailures++;
      this.health.consecutiveSuccesses = 0; // BUG FIX: Reset on failure
      return false;
    }
  }

  /**
   * Get health status
   */
  async healthCheck(): Promise<HealthStatus> {
    await this.isAvailable();
    // Return current health without double-counting failures
    return {
      available: this.health.available,
      latencyMs: this.health.latencyMs,
      errorRate: this.health.errorRate,
      consecutiveFailures: this.health.consecutiveFailures,
      lastCheckTime: this.health.lastCheck
    };
  }

  /**
   * Handle and normalize errors
   */
  protected handleError(error: unknown): ProviderError {
    if (error instanceof ProviderError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);

    // Categorize common CLI errors
    let errorCode = ErrorCode.PROVIDER_EXEC_ERROR;
    if (message.includes('command not found') || message.includes('ENOENT')) {
      errorCode = ErrorCode.PROVIDER_NOT_FOUND;
    } else if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
      errorCode = ErrorCode.PROVIDER_TIMEOUT;
    } else if (this.detectRateLimitError(error)) {
      // Bug #2 Fix: Use provider-specific error detection instead of simple string matching
      errorCode = ErrorCode.PROVIDER_RATE_LIMIT;
    }

    return new ProviderError(
      `${this.config.name} failed: ${message}`,
      errorCode
    );
  }

  /**
   * Detect rate limit or quota exhaustion errors using provider-specific patterns
   *
   * Bug #2 Fix: Provider-specific error pattern matching
   * Previously used simple string matching ("rate limit" or "quota") which missed
   * provider-specific error formats like Gemini's "RESOURCE_EXHAUSTED".
   *
   * This method checks:
   * - Error message against provider-specific patterns
   * - HTTP status codes (429, 529)
   * - Error codes from provider APIs
   * - Generic fallback patterns
   *
   * @param error - The error to check
   * @returns true if this is a rate limit or quota error
   */
  private detectRateLimitError(error: any): boolean {
    // Use provider-specific detection from error-patterns.ts (static import)
    const isLimited = isLimitError(error, this.config.name);

    // Log detection for debugging
    if (isLimited) {
      this.logger.debug('Rate limit error detected', {
        provider: this.config.name,
        message: error?.message,
        code: error?.code,
        status: error?.status || error?.statusCode
      });
    }

    return isLimited;
  }

  /**
   * Escape shell command arguments to prevent injection
   *
   * v8.3.0 Security Fix: Use POSIX shell single-quote escaping
   * v9.0.3 Windows Fix: Platform-aware escaping
   *
   * Windows (cmd.exe):
   * - Uses double quotes instead of single quotes
   * - Escapes double quotes with backslash
   * - Escapes percent signs (cmd variable expansion)
   *
   * Unix (bash/sh):
   * - Uses single quotes
   * - Escapes single quotes with '\''
   *
   * This prevents command injection by ensuring the entire string is treated as a literal.
   *
   * Examples:
   * - Unix: hello'world → 'hello'\''world'
   * - Windows: hello"world → "hello\"world"
   */
  protected escapeShellArg(arg: string): string {
    const isWindows = process.platform === 'win32';

    if (isWindows) {
      // Windows cmd.exe escaping
      // 1. Escape double quotes with backslash
      // 2. Escape percent signs (prevent variable expansion)
      // 3. Wrap in double quotes
      return '"' + arg
        .replace(/"/g, '\\"')      // Escape double quotes
        .replace(/%/g, '%%')        // Escape percent signs
        + '"';
    } else {
      // POSIX shell escaping: wrap in single quotes, escape existing single quotes
      // Single quotes preserve literal value of all characters except single quote itself
      // To include a single quote: end quote, add escaped quote, start new quote: '\''
      return "'" + arg.replace(/'/g, "'\\''") + "'";
    }
  }

  // v8.3.0: Stub implementations for backward compatibility with Provider interface
  // These will be removed when we update the interface in Phase 4

  get name(): string { return this.config.name; }
  get version(): string { return '1.0.0'; }
  get priority(): number { return this.config.priority; }
  get capabilities(): ProviderCapabilities {
    return {
      supportsStreaming: false,
      supportsEmbedding: false,
      supportsVision: false,
      maxContextTokens: 128000,
      supportedModels: ['default']
    };
  }

  async getHealth(): Promise<HealthStatus> {
    await this.isAvailable();
    return {
      available: this.health.available,
      latencyMs: this.health.latencyMs,
      errorRate: this.health.errorRate,
      consecutiveFailures: this.health.consecutiveFailures,
      lastCheckTime: this.health.lastCheck
    };
  }

  supportsStreaming(): boolean { return false; }

  async generateEmbedding(_text: string, _options?: any): Promise<number[]> {
    throw new Error('Embedding not supported in v8.3.0 CLI-only mode');
  }

  async checkRateLimit(): Promise<any> {
    return {
      hasCapacity: true,
      requestsRemaining: 1000,
      tokensRemaining: 1000000,
      resetAtMs: Date.now() + 60000
    };
  }

  async waitForCapacity(): Promise<void> {
    // No-op in v8.3.0
  }

  async estimateCost(_request: ExecutionRequest): Promise<any> {
    return {
      amount: 0,
      currency: 'USD',
      breakdown: { prompt: 0, completion: 0 }
    };
  }

  async getUsageStats(): Promise<any> {
    return {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      successRate: 1.0
    };
  }

  shouldRetry(error: Error): boolean {
    // BUG FIX: Use centralized shouldRetryError() from retry-errors.ts
    // Previously used simple string matching which:
    // 1. Missed provider-specific retry patterns (e.g., RESOURCE_EXHAUSTED for Gemini)
    // 2. Didn't check non-retryable errors (could retry auth errors)
    // 3. Had duplicate logic that could diverge from centralized patterns

    // Map provider name to RetryableProvider type
    const providerName = this.config.name.toLowerCase();
    let retryableProvider: RetryableProvider = 'base';

    // Map known provider names to their retry profiles
    if (providerName === 'claude' || providerName === 'claude-code') {
      retryableProvider = 'claude';
    } else if (providerName === 'gemini' || providerName === 'gemini-cli') {
      retryableProvider = 'gemini';
    } else if (providerName === 'openai') {
      retryableProvider = 'openai';
    } else if (providerName === 'codex') {
      retryableProvider = 'codex';
    } else if (providerName === 'ax-cli' || providerName === 'glm') {
      retryableProvider = 'ax-cli';
    }

    return shouldRetryError(error, retryableProvider);
  }

  getRetryDelay(attempt: number): number {
    // v8.3.0: Exponential backoff: 1s, 2s, 4s, 8s, ...
    return Math.min(1000 * Math.pow(2, attempt - 1), 30000);
  }

  getCacheMetrics(): {
    availability: {
      hits: number;
      misses: number;
      hitRate: number;
      avgAge: number;
      maxAge: number;
      lastHit?: number;
      lastMiss?: number;
    };
    version: {
      hits: number;
      misses: number;
      hitRate: number;
      size: number;
      avgAge: number;
      maxAge: number;
    };
    health: {
      consecutiveFailures: number;
      consecutiveSuccesses: number;
      lastCheckTime?: number;
      lastCheckDuration: number;
      uptime: number;
    };
  } {
    // v8.3.0: Return zero metrics - caching removed
    return {
      availability: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        avgAge: 0,
        maxAge: 0
      },
      version: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        size: 0,
        avgAge: 0,
        maxAge: 0
      },
      health: {
        consecutiveFailures: this.health.consecutiveFailures,
        // BUG FIX: Use actual tracked value instead of incorrect derivation
        // Previously: `consecutiveFailures === 0 ? 1 : 0` which was wrong
        consecutiveSuccesses: this.health.consecutiveSuccesses,
        lastCheckTime: this.health.lastCheck,
        lastCheckDuration: 0,
        uptime: this.health.lastCheck > 0 ? Date.now() - this.health.lastCheck : 0
      }
    };
  }

  clearCaches(): void {
    // v8.3.0: No-op - no caching in CLI-only mode
  }
}
