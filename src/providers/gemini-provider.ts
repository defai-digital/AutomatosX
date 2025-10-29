/**
 * GeminiProvider - Google Gemini AI Provider
 *
 * Uses Google Generative AI SDK for Gemini models
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
import { logger } from '../utils/logger.js';
import { ProviderError } from '../utils/errors.js';
import { getProviderLimitManager } from '../core/provider-limit-manager.js';
import { spawn } from 'child_process';
import { processManager } from '../utils/process-manager.js';
import { platform } from 'os';

export class GeminiProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

  get version(): string {
    return '1.0.0';
  }

  get capabilities(): ProviderCapabilities {
    return {
      supportsStreaming: false,
      supportsEmbedding: true,
      supportsVision: true,
      maxContextTokens: 1000000, // Gemini 1.5 Pro has 1M context window
      supportedModels: [
        'gemini-2.0-flash-exp',
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-1.0-pro'
      ]
    };
  }

  protected async executeRequest(request: ExecutionRequest): Promise<ExecutionResponse> {
    const startTime = Date.now();

    try {
      // Build prompt with system prompt if provided
      let fullPrompt = request.prompt;
      if (request.systemPrompt) {
        fullPrompt = `${request.systemPrompt}\n\n${request.prompt}`;
      }

      // Execute via CLI - let CLI use its own default model
      const response = await this.executeCLI(fullPrompt, request);

      const latency = Date.now() - startTime;

      // Cache token counts (performance optimization - avoid recalculation)
      const promptTokens = this.estimateTokens(fullPrompt);
      const completionTokens = this.estimateTokens(response.content);
      const totalTokens = promptTokens + completionTokens;

      // Log telemetry for observability
      logger.debug('Gemini execution telemetry', {
        provider: 'gemini',
        model: request.model || 'gemini-default',
        latencyMs: latency,
        promptTokens,
        completionTokens,
        totalTokens
      });

      return {
        content: response.content,
        model: request.model || 'gemini-default', // CLI decides actual model
        tokensUsed: {
          prompt: promptTokens,
          completion: completionTokens,
          total: totalTokens
        },
        latencyMs: latency,
        finishReason: 'stop'
      };
    } catch (error) {
      // Use ProviderError for structured error handling
      if (error instanceof ProviderError) {
        throw error;
      }
      throw ProviderError.executionError(
        this.config.name,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  protected async generateEmbeddingInternal(_text: string, options?: EmbeddingOptions): Promise<number[]> {
    try {
      // NOTE: Legacy mock implementation for testing purposes only
      // Vector search was removed in v4.11.0 (switched to SQLite FTS5)
      // This method is retained for interface compatibility and test coverage
      // Gemini supports embeddings via embedding-001 model (not implemented in mock)
      const dimensions = options?.dimensions || 768;
      return Array(dimensions).fill(0).map(() => Math.random());
    } catch (error) {
      throw new Error(`Gemini embedding generation failed: ${(error as Error).message}`);
    }
  }

  override async estimateCost(request: ExecutionRequest): Promise<Cost> {
    // Gemini pricing (as of 2024)
    const pricing: Record<string, { input: number; output: number }> = {
      'gemini-2.0-flash-exp': { input: 0, output: 0 },  // Free during preview
      'gemini-1.5-pro': { input: 3.50, output: 10.50 },  // per 1M tokens
      'gemini-1.5-flash': { input: 0.35, output: 1.05 },
      'gemini-1.0-pro': { input: 0.50, output: 1.50 }
    };

    // Use gemini-2.0-flash-exp pricing as default estimate when model not specified
    const defaultPricing = { input: 0, output: 0 };
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
        content: `[Mock Response from Gemini]\n\nTask received: ${prompt.substring(0, 100)}...\n\nThis is a placeholder response. Set AUTOMATOSX_MOCK_PROVIDERS=false to use real CLI.`
      });
    }

    // Real CLI execution
    return this.executeRealCLI(prompt, request, streamingOptions);
  }

  /**
   * Execute real CLI command via spawn
   *
   * Gemini CLI syntax: gemini "prompt"
   * Model selection is delegated to CLI's own defaults
   *
   * v5.8.6: Added streaming support via optional StreamingOptions parameter
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

        // Use buildCLIArgs() for consistency (DRY principle)
        const args = this.buildCLIArgs(request);

        // NOTE: Prompt is now passed via stdin instead of positional argument
        // This avoids shell parsing errors when prompt contains special characters,
        // quotes, newlines, or code examples

        // Filter environment variables for security
        // Only allow whitelisted variables to reach subprocess
        const filteredEnv = this.filterEnvironment(process.env);

        // Determine if shell is needed (only on Windows for .cmd/.bat files)
        const isWindows = platform() === 'win32';
        const needsShell = isWindows && (
          this.config.command.endsWith('.cmd') ||
          this.config.command.endsWith('.bat')
        );

        let child: ReturnType<typeof spawn>;
        try {
          // Spawn the CLI process with stdin pipe enabled
          // Security: Only use shell on Windows when necessary
          child = spawn(this.config.command, args, {
            stdio: ['pipe', 'pipe', 'pipe'], // Enable stdin for prompt input
            env: filteredEnv,
            shell: needsShell, // Only use shell when necessary (Windows .cmd/.bat)
          });
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          reject(ProviderError.executionError(this.config.name, err));
          return;
        }

        // Register child process for cleanup tracking
        processManager.register(child, 'gemini-cli');

      // Write prompt to stdin (safer than command-line argument)
      // This prevents shell parsing issues with special characters
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

          reject(ProviderError.timeout(
            this.config.name,
            this.config.timeout
          ));
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
                provider: 'gemini',
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
                provider: 'gemini',
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

            // v5.7.0: Enhanced error handling with rate limit detection
            if (this.isRateLimitError(errorMsg)) {
              reject(this.createRateLimitError(errorMsg));
            } else {
              reject(ProviderError.executionError(
                this.config.name,
                new Error(`Gemini CLI exited with code ${code}: ${errorMsg}`)
              ));
            }
          } else {
            // Check for soft errors: non-empty stderr with exit code 0
            if (stderr.trim()) {
              logger.warn('Gemini CLI completed with warnings', {
                provider: 'gemini',
                stderr: stderr.trim()
              });
            }

            // v5.8.6: Emit final progress update for streaming
            if (streamingOptions?.onProgress) {
              try {
                streamingOptions.onProgress(1.0);
              } catch (error) {
                logger.warn('Final streaming onProgress callback error', {
                  provider: 'gemini',
                  error: error instanceof Error ? error.message : String(error)
                });
              }
            }

            resolve({ content: stdout.trim() });
          }
        } catch (handlerError) {
          // Event handler threw - this is critical
          const errMsg = handlerError instanceof Error ? handlerError.message : String(handlerError);
          logger.error('Close event handler error', { error: errMsg, provider: 'gemini' });
          const err = handlerError instanceof Error ? handlerError : new Error(errMsg);
          reject(ProviderError.executionError(this.config.name, err));
        }
      });

      // Handle process errors
      child.on('error', (error) => {
        cleanupAbortListener();  // CRITICAL: Remove abort listener to prevent memory leak
        if (!hasTimedOut) {
          reject(ProviderError.executionError(this.config.name, error));
        }
      });

      // Set timeout
      mainTimeout = setTimeout(() => {
        hasTimedOut = true;
        cleanup();  // Clear other timeouts
        child.kill('SIGTERM');

        // Give it a moment to terminate gracefully
        // v5.6.18: Use configurable forceKillDelay
        const forceKillDelay = this.config.processManagement?.forceKillDelay ?? 1000;
        nestedKillTimeout = setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, forceKillDelay);

        // Log partial output if available for debugging
        const partialOutput = stdout.trim();
        if (partialOutput) {
          logger.debug('Partial output available on timeout', {
            provider: 'gemini',
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
    return shouldRetryError(error, 'gemini');
  }

  /**
   * Build CLI arguments for Gemini CLI
   *
   * v5.8.6: Now supports configurable approval mode
   *
   * @see https://github.com/google-gemini/gemini-cli/issues/5280
   * Blocked: Waiting for Gemini CLI to add support for maxTokens and temperature parameters
   * When implemented, this method will be updated to support parameter passing
   */
  protected buildCLIArgs(_request: ExecutionRequest): string[] {
    const args: string[] = [];

    // v5.8.6: Configurable approval mode
    // Priority: context override > config default > fallback
    const geminiConfig = (this.config as any).gemini;
    const approvalMode =
      _request.context?.approvalMode ||
      geminiConfig?.approvalMode ||
      'auto_edit';

    args.push('--approval-mode', approvalMode);

    // Gemini CLI currently does not support parameter passing
    // Parameters would need to be configured in ~/.gemini/settings.json
    //
    // Future implementation (when Gemini CLI adds support):
    // if (_request.temperature !== undefined) {
    //   args.push('--temperature', String(_request.temperature));
    // }
    // if (_request.maxTokens !== undefined) {
    //   args.push('--max-tokens', String(_request.maxTokens));
    // }
    // if (_request.topP !== undefined) {
    //   args.push('--top-p', String(_request.topP));
    // }

    return args;
  }

  /**
   * Check if Gemini provider supports a specific parameter
   * Currently all parameters are unsupported
   * See: https://github.com/google-gemini/gemini-cli/issues/5280
   */
  protected supportsParameter(
    _param: 'maxTokens' | 'temperature' | 'topP'
  ): boolean {
    // Gemini CLI does not support any parameters yet
    // This will return true once Issue #5280 is resolved
    return false;
  }

  /**
   * Check if provider supports streaming
   *
   * v5.8.6: Gemini CLI now supports progressive streaming via stdout parsing
   * Parses CLI output line-by-line and emits tokens incrementally
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
        fullPrompt = `${request.systemPrompt}\n\n${request.prompt}`;
      }

      // Execute via CLI with streaming callbacks
      const response = await this.executeCLI(fullPrompt, request, options);

      const latency = Date.now() - startTime;

      // Cache token counts
      const promptTokens = this.estimateTokens(fullPrompt);
      const completionTokens = this.estimateTokens(response.content);
      const totalTokens = promptTokens + completionTokens;

      // Log telemetry
      logger.debug('Gemini streaming execution telemetry', {
        provider: 'gemini',
        model: request.model || 'gemini-default',
        latencyMs: latency,
        promptTokens,
        completionTokens,
        totalTokens,
        streaming: true
      });

      return {
        content: response.content,
        model: request.model || 'gemini-default',
        tokensUsed: {
          prompt: promptTokens,
          completion: completionTokens,
          total: totalTokens
        },
        latencyMs: latency,
        finishReason: 'stop'
      };
    } catch (error) {
      // Use ProviderError for structured error handling
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
   * Filter environment variables for security
   * Only pass whitelisted variables to subprocess
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
      // Gemini-specific variables
      /^GEMINI_/,
      /^GOOGLE_/,
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

  /**
   * Check if error message indicates a rate limit / usage limit error
   * v5.7.0: Provider limit detection patterns for Gemini
   */
  private isRateLimitError(errorMsg: string): boolean {
    const lowerMsg = errorMsg.toLowerCase();
    return (
      lowerMsg.includes('resource_exhausted') ||  // gRPC error code
      lowerMsg.includes('429') ||                 // HTTP status
      lowerMsg.includes('ratelimitexceeded') ||   // Gemini API error
      lowerMsg.includes('quota exceeded') ||
      lowerMsg.includes('quota') ||
      lowerMsg.includes('rate limit') ||
      lowerMsg.includes('too many requests')
    );
  }

  /**
   * Create detailed rate limit error with automatic recording
   * v5.7.0: Provider limit detection and auto-rotation
   */
  private createRateLimitError(errorMsg: string): Error {
    // Gemini typically has daily limits
    const limitWindow = 'daily';

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
        reason: 'quota_exceeded',
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
}
