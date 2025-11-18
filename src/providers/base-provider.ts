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
  HealthStatus
} from '../types/provider.js';
import { logger } from '../utils/logger.js';
import { ProviderError, ErrorCode } from '../utils/errors.js';
import { exec } from 'child_process';
import { findOnPath } from '../core/cli-provider-detector.js';
import {
  safeValidateExecutionRequest,
  safeValidateExecutionResponse
} from './provider-schemas.js';

/**
 * Execute command with proper process cleanup (BUG #3 FIX)
 * Wraps exec() to ensure child processes are killed on timeout
 *
 * Improvements:
 * 1. Clears timer on both success and error paths
 * 2. Uses SIGTERM → SIGKILL escalation pattern
 * 3. Prevents zombie processes with proper cleanup
 */
function execWithCleanup(
  command: string,
  options: any
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = exec(command, options, (error, stdout, stderr) => {
      // BUG #3 FIX: Clear timer on completion (success or error)
      clearTimeout(killTimer);

      if (error) {
        reject(error);
      } else {
        resolve({
          stdout: stdout.toString(),
          stderr: stderr.toString()
        });
      }
    });

    // BUG #3 FIX: Ensure child process is killed on timeout
    const timeout = options.timeout || 120000;
    const killTimer = setTimeout(() => {
      if (child.pid && !child.killed) {
        logger.warn('Killing child process due to timeout', {
          pid: child.pid,
          command: command.substring(0, 50)
        });
        child.kill('SIGTERM');

        // Force kill after 5 seconds if SIGTERM doesn't work
        setTimeout(() => {
          if (child.pid && !child.killed) {
            logger.warn('Force killing child process', { pid: child.pid });
            child.kill('SIGKILL');
          }
        }, 5000);
      }
    }, timeout);

    // BUG #3 FIX: Also clear timer on exit event (defensive cleanup)
    child.on('exit', () => {
      clearTimeout(killTimer);
    });
  });
}

export abstract class BaseProvider implements Provider {
  /**
   * Whitelist of allowed provider names for security
   * v8.3.0: Support both old (claude-code, gemini-cli) and new (claude, gemini) names for backward compatibility
   * v8.3.1: Added 'grok' for Grok CLI integration
   */
  private static readonly ALLOWED_PROVIDER_NAMES = [
    'claude',
    'claude-code',   // Backward compatibility - maps to claude CLI
    'gemini',
    'gemini-cli',    // Backward compatibility - maps to gemini CLI
    'openai',
    'codex',
    'grok',          // Grok CLI (Z.AI GLM 4.6 or X.AI Grok)
    'test-provider'  // For unit tests
  ] as const;

  protected config: ProviderConfig;
  protected health: {
    available: boolean;
    latencyMs: number;
    errorRate: number;
    consecutiveFailures: number;
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
      lastCheck: Date.now()
    };
  }

  /**
   * Get the CLI command name for this provider
   * Subclasses return: 'claude', 'gemini', 'codex'
   */
  protected abstract getCLICommand(): string;

  /**
   * Get mock response for testing
   * Subclasses return provider-specific mock response
   */
  protected abstract getMockResponse(): string;

  /**
   * Execute CLI command - Template method pattern
   * Common logic here, provider-specific parts via getCLICommand() and getMockResponse()
   */
  protected async executeCLI(prompt: string): Promise<string> {
    // Mock mode for tests - v8.3.0 Security Fix: Don't leak prompt content
    if (process.env.AUTOMATOSX_MOCK_PROVIDERS === 'true') {
      logger.debug('Mock mode: returning test response');
      return this.getMockResponse();
    }

    try {
      const escapedPrompt = this.escapeShellArg(prompt);
      const cliCommand = this.getCLICommand();

      logger.debug(`Executing ${cliCommand} CLI`, {
        command: cliCommand,
        promptLength: prompt.length
      });

      // BUG #3 FIX: Use execWithCleanup instead of execAsync to ensure process cleanup
      const { stdout, stderr } = await execWithCleanup(
        `${cliCommand} ${escapedPrompt}`,
        {
          timeout: this.config.timeout || 120000,
          maxBuffer: 10 * 1024 * 1024,
          shell: '/bin/bash', // Enable shell to support complex commands
          env: {
            ...process.env,
            // Force non-interactive mode for CLIs
            TERM: 'dumb',
            NO_COLOR: '1',
            // Disable TTY checks for codex and other CLIs
            FORCE_COLOR: '0',
            CI: 'true', // Many CLIs disable TTY checks in CI mode
            NO_UPDATE_NOTIFIER: '1',
            // Disable interactive prompts
            DEBIAN_FRONTEND: 'noninteractive'
          }
        }
      );

      // Log stderr as debug if present (even on success)
      // Many CLIs output informational messages to stderr, which is normal
      if (stderr) {
        logger.debug(`${cliCommand} CLI stderr output`, { stderr: stderr.trim() });
      }

      if (!stdout) {
        throw new Error(`${cliCommand} CLI returned empty output. stderr: ${stderr || 'none'}`);
      }

      logger.debug(`${cliCommand} CLI execution successful`, {
        responseLength: stdout.trim().length
      });

      return stdout.trim();
    } catch (error) {
      logger.error(`${this.getCLICommand()} CLI execution failed`, { error });
      throw this.handleError(error);
    }
  }

  /**
   * Check if CLI is available - Template method pattern
   * Uses getCLICommand() to determine which CLI to check
   */
  protected async checkCLIAvailable(): Promise<boolean> {
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

      const result = await this.executeCLI(fullPrompt);

      // Update health on success
      this.health.consecutiveFailures = 0;
      this.health.available = true;

      const response: ExecutionResponse = {
        content: result,
        model: 'default', // v8.3.0: CLI determines model
        tokensUsed: {
          prompt: 0, // v8.3.0: No token tracking
          completion: 0,
          total: 0
        },
        latencyMs: Date.now() - startTime,
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
        // Still return the response but log the validation issue
      }

      return response;
    } catch (error) {
      this.health.consecutiveFailures++;
      this.health.available = false;
      this.health.errorRate = 1;
      throw this.handleError(error);
    }
  }

  /**
   * Check if provider CLI is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const available = await this.checkCLIAvailable();
      this.health = {
        available,
        latencyMs: 0,
        errorRate: available ? 0 : 1,
        lastCheck: Date.now(),
        consecutiveFailures: available ? 0 : this.health.consecutiveFailures + 1
      };
      return available;
    } catch (error) {
      this.health.available = false;
      this.health.errorRate = 1;
      return false;
    }
  }

  /**
   * Get health status
   */
  async healthCheck(): Promise<HealthStatus> {
    await this.isAvailable();
    return this.health;
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
    } else if (message.includes('rate limit') || message.includes('quota')) {
      errorCode = ErrorCode.PROVIDER_RATE_LIMIT;
    }

    return new ProviderError(
      `${this.config.name} failed: ${message}`,
      errorCode
    );
  }

  /**
   * Escape shell command arguments to prevent injection
   *
   * v8.3.0 Security Fix: Use POSIX shell single-quote escaping
   * Wraps argument in single quotes and escapes any existing single quotes
   * This prevents command injection by ensuring the entire string is treated as a literal.
   *
   * Example: hello'world becomes 'hello'\''world'
   */
  protected escapeShellArg(arg: string): string {
    // POSIX shell escaping: wrap in single quotes, escape existing single quotes
    // Single quotes preserve literal value of all characters except single quote itself
    // To include a single quote: end quote, add escaped quote, start new quote: '\''
    return "'" + arg.replace(/'/g, "'\\''") + "'";
  }

  // v8.3.0: Stub implementations for backward compatibility with Provider interface
  // These will be removed when we update the interface in Phase 4

  get name(): string { return this.config.name; }
  get version(): string { return '1.0.0'; }
  get priority(): number { return this.config.priority; }
  get capabilities(): any {
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
    // v8.3.0: Simple retry logic for CLI failures
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('rate limit') ||
      message.includes('temporarily unavailable') ||
      message.includes('503') ||
      message.includes('502')
    );
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
        consecutiveSuccesses: this.health.consecutiveFailures === 0 ? 1 : 0,
        lastCheckTime: this.health.lastCheck,
        lastCheckDuration: 0,
        uptime: Date.now() - this.health.lastCheck
      }
    };
  }

  clearCaches(): void {
    // v8.3.0: No-op - no caching in CLI-only mode
  }
}
