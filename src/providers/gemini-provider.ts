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

      return {
        content: response.content,
        model: request.model || 'gemini-default', // CLI decides actual model
        tokensUsed: {
          prompt: this.estimateTokens(fullPrompt),
          completion: this.estimateTokens(response.content),
          total: this.estimateTokens(fullPrompt) + this.estimateTokens(response.content)
        },
        latencyMs: latency,
        finishReason: 'stop'
      };
    } catch (error) {
      throw new Error(`Gemini execution failed: ${(error as Error).message}`);
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
  private async executeCLI(prompt: string, request: ExecutionRequest): Promise<{ content: string }> {
    // Check if running in production mode (real CLI) or test mode (mock)
    const useMock = process.env.AUTOMATOSX_MOCK_PROVIDERS === 'true';

    if (useMock) {
      // Mock mode for testing
      return Promise.resolve({
        content: `[Mock Response from Gemini]\n\nTask received: ${prompt.substring(0, 100)}...\n\nThis is a placeholder response. Set AUTOMATOSX_MOCK_PROVIDERS=false to use real CLI.`
      });
    }

    // Real CLI execution
    return this.executeRealCLI(prompt, request);
  }

  /**
   * Execute real CLI command via spawn
   *
   * Gemini CLI syntax: gemini "prompt"
   * Model selection is delegated to CLI's own defaults
   */
  private async executeRealCLI(prompt: string, request: ExecutionRequest): Promise<{ content: string }> {
      const { spawn } = await import('child_process');
      const { processManager } = await import('../utils/process-manager.js');

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

        // Build CLI arguments for Gemini CLI
        // Note: We pass prompt via stdin to avoid shell parsing issues with special characters
        // Do NOT pass --model - let CLI use its own default
        const args: string[] = [];

        // Enable file operation tools (v5.0.6 fix)
        // This allows agents to create, modify, and delete files
        args.push('--approval-mode', 'auto_edit');

        // NOTE: Prompt is now passed via stdin instead of positional argument
        // This avoids shell parsing errors when prompt contains special characters,
        // quotes, newlines, or code examples

        // Note: Gemini CLI doesn't support temperature and maxTokens via CLI flags
        // These parameters are configured in the Gemini settings.json instead

        let child: ReturnType<typeof spawn>;
        try {
          // Spawn the CLI process with stdin pipe enabled
          child = spawn(this.config.command, args, {
            stdio: ['pipe', 'pipe', 'pipe'], // Enable stdin for prompt input
            env: process.env,
            shell: true, // Required for Windows .cmd/.bat files
          });
        } catch (error) {
          reject(new Error(`Failed to spawn Gemini CLI: ${(error as Error).message}`));
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
          reject(new Error(`Failed to write prompt to Gemini CLI stdin: ${(error as Error).message}`));
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

          reject(new Error('Execution aborted by timeout'));
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

      // Collect stdout
      child.stdout?.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;

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
            reject(new Error(`Gemini CLI exited with code ${code}: ${stderr}`));
          } else {
            resolve({ content: stdout.trim() });
          }
        } catch (handlerError) {
          // Event handler threw - this is critical
          const errMsg = handlerError instanceof Error ? handlerError.message : String(handlerError);
          logger.error('Close event handler error', { error: errMsg, provider: 'gemini' });
          reject(new Error(`Internal error handling process exit: ${errMsg}`));
        }
      });

      // Handle process errors
      child.on('error', (error) => {
        cleanupAbortListener();  // CRITICAL: Remove abort listener to prevent memory leak
        if (!hasTimedOut) {
          reject(new Error(`Failed to spawn Gemini CLI: ${error.message}`));
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

        reject(new Error(`Gemini CLI execution timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);
    });
  }

  override shouldRetry(error: Error): boolean {
    // Use centralized retry logic for consistency
    return shouldRetryError(error, 'gemini');
  }

  /**
   * Build CLI arguments for Gemini CLI
   * Currently does not support parameter passing via CLI
   *
   * @see https://github.com/google-gemini/gemini-cli/issues/5280
   * Blocked: Waiting for Gemini CLI to add support for maxTokens and temperature parameters
   * When implemented, this method will be updated to support parameter passing
   */
  protected buildCLIArgs(_request: ExecutionRequest): string[] {
    const args: string[] = [];

    // Enable auto-edit mode for file operations (v5.6.5: Fix read-only sandbox issue)
    // auto_edit mode automatically approves edit tools while maintaining safety
    args.push('--approval-mode', 'auto_edit');

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
   * Gemini CLI doesn't support native streaming
   *
   * Note: Real-time output is still available via AUTOMATOSX_SHOW_PROVIDER_OUTPUT
   * environment variable, which displays CLI output as it's generated.
   */
  override supportsStreaming(): boolean {
    return false;
  }
}
