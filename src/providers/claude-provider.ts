/**
 * ClaudeProvider - Anthropic Claude AI Provider
 *
 * Uses Anthropic SDK for Claude models
 */

import { BaseProvider } from './base-provider.js';
import { shouldRetryError } from './retry-errors.js';
import type {
  ProviderConfig,
  ProviderCapabilities,
  ExecutionRequest,
  ExecutionResponse,
  EmbeddingOptions,
  Cost,
  StreamingOptions
} from '../types/provider.js';
import { getProviderSuggestion } from '../utils/environment.js';
import { logger } from '../utils/logger.js';
import { ProviderError } from '../utils/errors.js';
import { getProviderLimitManager } from '../core/provider-limit-manager.js';
import { spawn } from 'child_process';
import { processManager } from '../utils/process-manager.js';
import { platform } from 'os';

export class ClaudeProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

  get version(): string {
    return '1.0.0';
  }

  get capabilities(): ProviderCapabilities {
    return {
      supportsStreaming: false,
      supportsEmbedding: false, // Claude doesn't provide embeddings directly
      supportsVision: true,
      maxContextTokens: 200000,
      supportedModels: [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307'
      ]
    };
  }

  protected async executeRequest(request: ExecutionRequest): Promise<ExecutionResponse> {
    // For Phase 1, we use CLI-based execution (Claude Code CLI)
    // In future phases, we'll use the official Anthropic SDK

    const startTime = Date.now();

    try {
      // Build prompt with system prompt if provided
      let fullPrompt = request.prompt;
      if (request.systemPrompt) {
        fullPrompt = `System: ${request.systemPrompt}\n\nUser: ${request.prompt}`;
      }

      // Execute via CLI - let CLI use its own default model
      const response = await this.executeCLI(fullPrompt, request);

      const latency = Date.now() - startTime;

      // v5.8.6: Cache token counts (performance optimization)
      const promptTokens = this.estimateTokens(fullPrompt);
      const completionTokens = this.estimateTokens(response.content);
      const totalTokens = promptTokens + completionTokens;

      // v5.8.6: Log structured telemetry for observability
      logger.debug('Claude execution telemetry', {
        provider: 'claude',
        model: request.model || 'claude-default',
        latencyMs: latency,
        promptTokens,
        completionTokens,
        totalTokens
      });

      return {
        content: response.content,
        model: request.model || 'claude-default', // CLI decides actual model
        tokensUsed: {
          prompt: promptTokens,
          completion: completionTokens,
          total: totalTokens
        },
        latencyMs: latency,
        finishReason: 'stop'
      };
    } catch (error) {
      // v5.8.6: Use ProviderError for structured error handling
      if (error instanceof ProviderError) {
        throw error;
      }
      throw ProviderError.executionError(
        this.config.name,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  protected async generateEmbeddingInternal(_text: string, _options?: EmbeddingOptions): Promise<number[]> {
    throw new Error('Claude does not support embeddings directly. Use OpenAI or Voyage AI for embeddings.');
  }

  override async estimateCost(request: ExecutionRequest): Promise<Cost> {
    // Claude pricing (as of 2024)
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },  // per 1M tokens
      'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
      'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
      'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 },
      'claude-3-haiku-20240307': { input: 0.25, output: 1.25 }
    };

    // Use sonnet pricing as default estimate when model not specified
    const defaultPricing = { input: 3.00, output: 15.00 };
    const modelPricing = request.model ? (pricing[request.model] ?? defaultPricing) : defaultPricing;

    const inputTokens = this.estimateTokens(request.prompt);
    const outputTokens = request.maxTokens ?? 4096;

    const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
    const outputCost = (outputTokens / 1_000_000) * modelPricing.output;

    return {
      estimatedUsd: inputCost + outputCost,
      tokensUsed: inputTokens + outputTokens
    };
  }

  // CLI execution helper (Phase 1 implementation)
  private async executeCLI(prompt: string, request: ExecutionRequest, streamingOptions?: StreamingOptions): Promise<{ content: string }> {
    // Check if running in production mode (real CLI) or test mode (mock)
    const useMock = process.env.AUTOMATOSX_MOCK_PROVIDERS === 'true';

    if (useMock) {
      // Mock mode for testing
      return Promise.resolve({
        content: `[Mock Response from Claude]\n\nTask received: ${prompt.substring(0, 100)}...\n\nThis is a placeholder response. Set AUTOMATOSX_MOCK_PROVIDERS=false to use real CLI.`
      });
    }

    // Real CLI execution
    return this.executeRealCLI(prompt, request, streamingOptions);
  }

  /**
   * Execute real CLI command via spawn
   *
   * Claude Code CLI syntax: echo "prompt" | claude --print
   * Uses --print flag for non-interactive output
   * Prompt is passed via stdin (not as positional argument)
   * Model selection is delegated to CLI's own defaults
   *
   * v5.8.6: Security improvements - conditional shell, env filtering
   * v5.8.6: Streaming support - progressive stdout parsing
   */
  private async executeRealCLI(prompt: string, request: ExecutionRequest, streamingOptions?: StreamingOptions): Promise<{ content: string }> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let hasTimedOut = false;
      let abortKillTimeout: NodeJS.Timeout | null = null;
      let mainTimeout: NodeJS.Timeout | null = null;
      let nestedKillTimeout: NodeJS.Timeout | null = null;

      // Cleanup function to clear all timeouts
      const cleanup = () => {
        if (abortKillTimeout) {
          clearTimeout(abortKillTimeout);
          abortKillTimeout = null;
        }
        if (mainTimeout) {
          clearTimeout(mainTimeout);
          mainTimeout = null;
        }
        if (nestedKillTimeout) {
          clearTimeout(nestedKillTimeout);
          nestedKillTimeout = null;
        }
      };

      // Build CLI arguments using the new buildCLIArgs method
      const args = this.buildCLIArgs(request);

      // NOTE: Do NOT add prompt as positional argument
      // Claude CLI expects prompt via stdin or --prompt flag
      // We use stdin to avoid command-line length limits

      // v5.8.6: Filter environment variables for security
      const filteredEnv = this.filterEnvironment(process.env);

      // v5.8.6: Determine if shell is needed (only on Windows for .cmd/.bat files)
      const isWindows = platform() === 'win32';
      const needsShell = isWindows && (
        this.config.command.endsWith('.cmd') ||
        this.config.command.endsWith('.bat')
      );

      let child: ReturnType<typeof spawn>;
      try {
        child = spawn(this.config.command, args, {
          stdio: ['pipe', 'pipe', 'pipe'], // Use pipe for stdin
          env: filteredEnv,
          shell: needsShell, // v5.8.6: Only use shell when necessary (Windows .cmd/.bat)
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        reject(ProviderError.executionError(this.config.name, err));
        return;
      }

      // Register child process for cleanup tracking
      processManager.register(child, 'claude-code');

      // Write prompt to stdin and close it
      // This is how Claude CLI expects to receive the prompt
      try {
        child.stdin?.write(prompt);
        child.stdin?.end();
      } catch (error) {
        // Kill child process and wait for it to exit before rejecting
        // Process manager will auto-cleanup on exit event
        child.kill('SIGTERM');

        // Set fallback timeout to force kill if SIGTERM doesn't work
        // v5.6.18: Use configurable forceKillDelay
        const forceKillDelay = this.config.processManagement?.forceKillDelay ?? 1000;
        const cleanupTimeout = setTimeout(() => {
          if (!child.killed && child.exitCode === null) {
            child.kill('SIGKILL');
          }
        }, forceKillDelay);

        // Wait for process to exit, then reject
        child.once('exit', () => {
          clearTimeout(cleanupTimeout);
          const err = error instanceof Error ? error : new Error(String(error));
          reject(ProviderError.executionError(this.config.name, err));
        });
        return;
      }

      // v5.0.7: Handle abort signal for proper timeout cancellation
      // CRITICAL: Track abort handler for cleanup to prevent memory leak
      let abortHandler: (() => void) | undefined;

      if (request.signal) {
        abortHandler = () => {
          hasTimedOut = true;
          cleanup();  // Clear all timeouts
          child.kill('SIGTERM');

          // Force kill after graceful shutdown timeout if SIGTERM doesn't work
          // v5.6.18: Use configurable gracefulShutdownTimeout
          const gracefulTimeout = this.config.processManagement?.gracefulShutdownTimeout ?? 5000;
          abortKillTimeout = setTimeout(() => {
            if (!child.killed) {
              child.kill('SIGKILL');
            }
          }, gracefulTimeout);

          reject(ProviderError.timeout(this.config.name, this.config.timeout));
        };
        request.signal.addEventListener('abort', abortHandler, { once: true });
      }

      // CRITICAL: Helper to cleanup abort listener
      const cleanupAbortListener = () => {
        if (abortHandler && request.signal) {
          request.signal.removeEventListener('abort', abortHandler);
          abortHandler = undefined;
        }
      };

      // Collect stdout and emit streaming updates
      child.stdout?.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;

        // v5.8.6: Progressive streaming support
        if (streamingOptions) {
          // Emit token callback for incremental updates
          if (streamingOptions.onToken) {
            try {
              streamingOptions.onToken(chunk);
            } catch (error) {
              logger.warn('Streaming onToken callback error', {
                provider: 'claude',
                error: error instanceof Error ? error.message : String(error)
              });
            }
          }

          // Emit progress callback if provided
          if (streamingOptions.onProgress) {
            try {
              // Estimate progress based on output length vs expected tokens
              const currentTokens = this.estimateTokens(stdout);
              const expectedTokens = request.maxTokens || 4096;
              const progress = Math.min(currentTokens / expectedTokens, 0.95); // Cap at 95% until complete

              streamingOptions.onProgress(progress);
            } catch (error) {
              logger.warn('Streaming onProgress callback error', {
                provider: 'claude',
                error: error instanceof Error ? error.message : String(error)
              });
            }
          }
        }

        // Real-time output if enabled (v5.6.5: UX improvement)
        if (process.env.AUTOMATOSX_SHOW_PROVIDER_OUTPUT === 'true') {
          process.stdout.write(chunk);
        }
      });

      // Collect stderr
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle process exit
      child.on('close', (code) => {
        try {
          cleanup();  // Clear all timeouts
          cleanupAbortListener();  // CRITICAL: Remove abort listener to prevent memory leak

          if (hasTimedOut) {
            return; // Timeout already handled
          }

          if (code !== 0) {
            const errorMsg = stderr || 'No error message';

            // Parse common error patterns
            if (errorMsg.toLowerCase().includes('network') ||
                errorMsg.toLowerCase().includes('connection') ||
                errorMsg.toLowerCase().includes('econnrefused') ||
                errorMsg.toLowerCase().includes('enotfound')) {
              reject(new Error(
                `Network connection error: Unable to reach Claude API.\n` +
                `Please check your internet connection and try again.\n` +
                `Details: ${errorMsg}`
              ));
            } else if (errorMsg.toLowerCase().includes('authentication') ||
                       errorMsg.toLowerCase().includes('unauthorized') ||
                       errorMsg.toLowerCase().includes('api key')) {
              reject(new Error(
                `Authentication failed: Please check your Claude API credentials.\n` +
                `Details: ${errorMsg}`
              ));
            } else if (this.isRateLimitError(errorMsg)) {
              // v5.7.0: Enhanced rate limit detection with auto-rotation
              reject(this.createRateLimitError(errorMsg));
            } else {
              reject(new Error(`Claude CLI exited with code ${code}: ${errorMsg}`));
            }
          } else {
            if (!stdout.trim()) {
              reject(ProviderError.executionError(
                this.config.name,
                new Error('Claude CLI returned empty response')
              ));
            } else {
              // v5.8.6: Check for soft errors (warnings in stderr with exit code 0)
              if (stderr.trim()) {
                logger.warn('Claude CLI completed with warnings', {
                  provider: 'claude',
                  stderr: stderr.trim()
                });
              }

              // v5.8.6: Emit final progress update for streaming
              if (streamingOptions?.onProgress) {
                try {
                  streamingOptions.onProgress(1.0);
                } catch (error) {
                  logger.warn('Final streaming onProgress callback error', {
                    provider: 'claude',
                    error: error instanceof Error ? error.message : String(error)
                  });
                }
              }

              resolve({ content: stdout.trim() });
            }
          }
        } catch (handlerError) {
          // Event handler threw - this is critical
          const errMsg = handlerError instanceof Error ? handlerError.message : String(handlerError);
          logger.error('Close event handler error', { error: errMsg, provider: 'claude' });
          const err = handlerError instanceof Error ? handlerError : new Error(errMsg);
          reject(ProviderError.executionError(this.config.name, err));
        }
      });

      // Handle process errors
      child.on('error', (error) => {
        cleanupAbortListener();  // CRITICAL: Remove abort listener to prevent memory leak

        if (hasTimedOut) {
          return; // Timeout already handled
        }

        reject(ProviderError.executionError(this.config.name, error));
      });

      // Set timeout
      mainTimeout = setTimeout(() => {
        hasTimedOut = true;
        cleanup();  // Clear other timeouts
        child.kill('SIGTERM');

        // Force kill after graceful shutdown timeout if still running
        // v5.6.18: Use configurable gracefulShutdownTimeout
        const gracefulTimeout = this.config.processManagement?.gracefulShutdownTimeout ?? 5000;
        nestedKillTimeout = setTimeout(() => {
          if (child.killed === false) {
            child.kill('SIGKILL');
          }
        }, gracefulTimeout);

        // v5.8.6: Log partial output if available for debugging
        const partialOutput = stdout.trim();
        if (partialOutput) {
          logger.debug('Partial output available on timeout', {
            provider: 'claude',
            partialLength: partialOutput.length,
            preview: partialOutput.substring(0, 100)
          });
        }

        reject(ProviderError.timeout(this.config.name, this.config.timeout));
      }, this.config.timeout);
    });
  }

  override shouldRetry(error: Error): boolean {
    // Use centralized retry logic for consistency
    return shouldRetryError(error, 'claude');
  }

  /**
   * Build CLI arguments for Claude Code CLI
   * v5.8.6: Now supports configurable tools and directories
   */
  protected buildCLIArgs(request: ExecutionRequest): string[] {
    const args: string[] = [];

    // v5.8.6: Configurable print mode
    // Priority: context override > config default > fallback
    const claudeConfig = (this.config as any).claude;
    const printMode = request.context?.printMode ?? claudeConfig?.printMode ?? true;

    if (printMode) {
      args.push('--print');
    }

    // v5.8.6: Configurable allowed tools
    // Priority: context override > config default > fallback
    const allowedTools = request.context?.allowedTools ??
                         claudeConfig?.allowedTools ??
                         ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'];

    if (Array.isArray(allowedTools) && allowedTools.length > 0) {
      args.push('--allowedTools', allowedTools.join(' '));
    }

    // v5.8.6: Configurable allowed directories
    // Priority: context override > config default > fallback
    const allowedDirs = request.context?.allowedDirs ??
                        claudeConfig?.allowedDirs ??
                        ['.'];

    if (Array.isArray(allowedDirs) && allowedDirs.length > 0) {
      for (const dir of allowedDirs) {
        args.push('--add-dir', dir === '.' ? process.cwd() : dir);
      }
    }

    // Claude Code CLI does not support parameter configuration via CLI flags
    // It uses provider-optimized defaults for best results
    //
    // Future implementation (if Claude adds support):
    // if (request.temperature !== undefined) {
    //   args.push('--temperature', String(request.temperature));
    // }
    // if (request.maxTokens !== undefined) {
    //   args.push('--max-tokens', String(request.maxTokens));
    // }

    return args;
  }

  /**
   * Check if Claude provider supports a specific parameter
   * Currently all parameters are unsupported via CLI
   */
  protected supportsParameter(
    param: 'maxTokens' | 'temperature' | 'topP'
  ): boolean {
    // Claude Code CLI does not support parameter configuration
    // Uses provider-optimized defaults instead
    return false;
  }

  /**
   * Check if provider supports streaming
   * v5.8.6: Claude Code now supports progressive streaming via stdout parsing
   */
  override supportsStreaming(): boolean {
    return true;
  }

  /**
   * Execute with streaming support
   * v5.8.6: Progressive stdout parsing for real-time updates
   */
  override async executeStreaming(
    request: ExecutionRequest,
    options: StreamingOptions
  ): Promise<ExecutionResponse> {
    const startTime = Date.now();

    try {
      // Build prompt with system prompt if provided
      let fullPrompt = request.prompt;
      if (request.systemPrompt) {
        fullPrompt = `System: ${request.systemPrompt}\n\nUser: ${request.prompt}`;
      }

      // Execute via CLI with streaming callbacks
      const response = await this.executeCLI(fullPrompt, request, options);

      const latency = Date.now() - startTime;

      // Cache token counts
      const promptTokens = this.estimateTokens(fullPrompt);
      const completionTokens = this.estimateTokens(response.content);
      const totalTokens = promptTokens + completionTokens;

      // Log telemetry
      logger.debug('Claude streaming execution telemetry', {
        provider: 'claude',
        model: request.model || 'claude-default',
        latencyMs: latency,
        promptTokens,
        completionTokens,
        totalTokens,
        streaming: true
      });

      return {
        content: response.content,
        model: request.model || 'claude-default',
        tokensUsed: {
          prompt: promptTokens,
          completion: completionTokens,
          total: totalTokens
        },
        latencyMs: latency,
        finishReason: 'stop'
      };
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      throw ProviderError.executionError(
        this.config.name,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Check if error message indicates a rate limit / usage limit error
   * v5.7.0: Provider limit detection patterns for Claude
   */
  private isRateLimitError(errorMsg: string): boolean {
    const lowerMsg = errorMsg.toLowerCase();
    return (
      lowerMsg.includes('rate limit') ||
      lowerMsg.includes('quota') ||
      lowerMsg.includes('limit for today') ||
      lowerMsg.includes('limit for this week') ||
      lowerMsg.includes('anthropicusagelimit') ||
      lowerMsg.includes('usage limit') ||
      lowerMsg.includes('exceeded') && (lowerMsg.includes('limit') || lowerMsg.includes('quota'))
    );
  }

  /**
   * Create detailed rate limit error with automatic recording
   * v5.7.0: Provider limit detection and auto-rotation
   */
  private createRateLimitError(errorMsg: string): Error {
    // Determine limit window (Claude Code typically has weekly limits)
    const limitWindow = errorMsg.toLowerCase().includes('week') ? 'weekly' : 'daily';

    // Calculate reset time
    const limitManager = getProviderLimitManager();
    const resetAtMs = limitManager.calculateResetTime(
      this.config.name,
      limitWindow
    );

    // Record limit hit asynchronously (don't block error throwing)
    void limitManager.recordLimitHit(
      this.config.name,
      limitWindow,
      resetAtMs,
      {
        reason: 'usage_limit_exceeded',
        rawMessage: errorMsg
      }
    );

    // Return ProviderError with detailed context
    return ProviderError.rateLimit(
      this.config.name,
      limitWindow,
      resetAtMs,
      errorMsg
    );
  }

  /**
   * Filter environment variables for security
   * v5.8.6: Only pass whitelisted variables to subprocess
   *
   * @param env - Original environment variables
   * @returns Filtered environment variables
   */
  private filterEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const whitelist = [
      'PATH',
      'HOME',
      'USER',
      'SHELL',
      'TMPDIR',
      'TEMP',
      'TMP',
      // Claude/Anthropic-specific variables
      /^CLAUDE_/,
      /^ANTHROPIC_/,
      // AutomatosX variables
      /^AUTOMATOSX_/,
    ];

    const filtered: NodeJS.ProcessEnv = {};

    for (const [key, value] of Object.entries(env)) {
      const isWhitelisted = whitelist.some((pattern) => {
        if (typeof pattern === 'string') {
          return key === pattern;
        } else {
          return pattern.test(key);
        }
      });

      if (isWhitelisted) {
        filtered[key] = value;
      }
    }

    return filtered;
  }
}
