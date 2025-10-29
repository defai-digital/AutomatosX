/**
 * OpenAIProvider - OpenAI AI Provider
 *
 * Uses OpenAI API for GPT models
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
import type { ChildProcess } from 'child_process';

export class OpenAIProvider extends BaseProvider {
  // BUG FIX (v5.12.2): Track child processes to prevent leaks
  private activeChildren: Set<ChildProcess> = new Set();

  constructor(config: ProviderConfig) {
    super(config);
  }

  get version(): string {
    return '1.0.0';
  }

  get capabilities(): ProviderCapabilities {
    return {
      supportsStreaming: true, // v5.3.0: Native streaming support
      supportsEmbedding: true,
      supportsVision: true,
      maxContextTokens: 128000, // GPT-4 Turbo/GPT-4o has 128k context
      supportedModels: [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo',
        'o1-preview',
        'o1-mini'
      ]
    };
  }

  protected async executeRequest(request: ExecutionRequest): Promise<ExecutionResponse> {
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

      return {
        content: response.content,
        model: request.model || 'openai-default', // CLI decides actual model
        tokensUsed: {
          prompt: this.estimateTokens(fullPrompt),
          completion: this.estimateTokens(response.content),
          total: this.estimateTokens(fullPrompt) + this.estimateTokens(response.content)
        },
        latencyMs: latency,
        finishReason: 'stop'
      };
    } catch (error) {
      throw new Error(`OpenAI execution failed: ${(error as Error).message}`);
    }
  }

  protected async generateEmbeddingInternal(_text: string, options?: EmbeddingOptions): Promise<number[]> {
    try {
      // NOTE: Legacy mock implementation for testing purposes only
      // Vector search was removed in v4.11.0 (switched to SQLite FTS5)
      // This method is retained for interface compatibility and test coverage
      // OpenAI supports embeddings via text-embedding models (not implemented in mock)
      const dimensions = options?.dimensions || 1536;
      return Array(dimensions).fill(0).map(() => Math.random());
    } catch (error) {
      throw new Error(`OpenAI embedding generation failed: ${(error as Error).message}`);
    }
  }

  override async estimateCost(request: ExecutionRequest): Promise<Cost> {
    // OpenAI pricing (as of 2024)
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 2.50, output: 10.00 },  // per 1M tokens
      'gpt-4o-mini': { input: 0.15, output: 0.60 },
      'gpt-4-turbo': { input: 10.00, output: 30.00 },
      'gpt-4': { input: 30.00, output: 60.00 },
      'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
      'o1-preview': { input: 15.00, output: 60.00 },
      'o1-mini': { input: 3.00, output: 12.00 }
    };

    // Use gpt-4o pricing as default estimate when model not specified
    const defaultPricing = { input: 2.50, output: 10.00 };
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
    // Enhanced: Check multiple environment variables to ensure mock mode in test environments
    const useMock =
      process.env.AUTOMATOSX_MOCK_PROVIDERS === 'true' ||
      process.env.NODE_ENV === 'test' ||
      process.env.VITEST === 'true';

    if (useMock) {
      // Mock mode for testing
      return Promise.resolve({
        content: `[Mock Response from OpenAI]\n\nTask received: ${prompt.substring(0, 100)}...\n\nThis is a placeholder response. Set AUTOMATOSX_MOCK_PROVIDERS=false to use real CLI.`
      });
    }

    // Real CLI execution
    return this.executeRealCLI(prompt, request);
  }

  /**
   * Execute real CLI command via spawn
   *
   * Codex CLI syntax: codex exec [OPTIONS] [PROMPT]
   * Model and other parameters are passed via -c (config override) or specific flags
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

      // Build CLI arguments using the new buildCLIArgs method
      const args = this.buildCLIArgs(request);

      // NOTE: Prompt is now passed via stdin instead of command-line argument
      // This avoids shell parsing errors when prompt contains special characters,
      // quotes, newlines, or code examples

      let child: ReturnType<typeof spawn>;
      try {
        // BUG FIX (v5.12.2): Use shell:false to prevent command injection and tokenization issues
        child = spawn(this.config.command, args, {
          stdio: ['pipe', 'pipe', 'pipe'], // Enable stdin for prompt input
          env: process.env,
          shell: false, // FIX: Prevents shell parsing issues and security vulnerabilities
        });
      } catch (error) {
        reject(new Error(`Failed to spawn OpenAI CLI: ${(error as Error).message}`));
        return;
      }

      // BUG FIX (v5.12.2): Track child process for cleanup
      this.activeChildren.add(child);

      // Register child process for cleanup tracking
      processManager.register(child, 'openai-codex');

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
          reject(new Error(`Failed to write prompt to Codex CLI stdin: ${(error as Error).message}`));
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

          // BUG FIX (v5.12.2): Remove from tracking when process exits
          this.activeChildren.delete(child);

          if (hasTimedOut) {
            return; // Already rejected by timeout
          }

          if (code !== 0) {
            const errorMsg = stderr || 'No error message';

            // v5.7.0: Enhanced error handling with rate limit detection
            if (this.isRateLimitError(errorMsg)) {
              reject(this.createRateLimitError(errorMsg));
            } else {
              reject(new Error(`OpenAI CLI exited with code ${code}: ${errorMsg}`));
            }
          } else {
            resolve({ content: stdout.trim() });
          }
        } catch (handlerError) {
          // Event handler threw - this is critical
          const errMsg = handlerError instanceof Error ? handlerError.message : String(handlerError);
          logger.error('Close event handler error', { error: errMsg, provider: 'openai' });
          reject(new Error(`Internal error handling process exit: ${errMsg}`));
        }
      });

      // Handle process errors
      child.on('error', (error) => {
        cleanupAbortListener();  // CRITICAL: Remove abort listener to prevent memory leak
        if (!hasTimedOut) {
          reject(new Error(`Failed to spawn OpenAI CLI: ${error.message}`));
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

        reject(new Error(`OpenAI CLI execution timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);
    });
  }

  override shouldRetry(error: Error): boolean {
    // Use centralized retry logic for consistency
    return shouldRetryError(error, 'openai');
  }

  /**
   * Build CLI arguments for OpenAI Codex CLI
   * Supports: maxTokens, temperature, sandbox mode
   */
  protected buildCLIArgs(request: ExecutionRequest): string[] {
    const args: string[] = ['exec'];

    // Add sandbox mode for write access (v5.6.5: Fix read-only sandbox issue)
    // workspace-write allows writing to the workspace while maintaining security
    args.push('--sandbox', 'workspace-write');

    // NOTE: Do NOT pass --model / -m flag - let OpenAI Codex CLI use its own default model
    // The CLI is configured to use the best available model automatically
    // Specifying a model manually can cause version conflicts

    // Add temperature via config override if specified
    if (request.temperature !== undefined) {
      args.push('-c', `temperature=${request.temperature}`);
    }

    // Add max tokens via config override if specified
    if (request.maxTokens !== undefined) {
      args.push('-c', `max_tokens=${request.maxTokens}`);
    }

    return args;
  }

  /**
   * Check if OpenAI provider supports a specific parameter
   * OpenAI Codex CLI supports maxTokens and temperature via -c flags
   */
  protected supportsParameter(
    param: 'maxTokens' | 'temperature' | 'topP'
  ): boolean {
    // OpenAI Codex CLI supports maxTokens and temperature
    return param === 'maxTokens' || param === 'temperature';
  }

  /**
   * Check if provider supports streaming
   * OpenAI CLI supports native streaming
   */
  override supportsStreaming(): boolean {
    return true;
  }

  /**
   * Execute with streaming (native streaming support)
   *
   * OpenAI CLI supports --stream flag for real-time token streaming.
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

      // Check if running in mock mode
      // Enhanced: Check multiple environment variables to ensure mock mode in test environments
      const useMock =
        process.env.AUTOMATOSX_MOCK_PROVIDERS === 'true' ||
        process.env.NODE_ENV === 'test' ||
        process.env.VITEST === 'true';

      if (useMock) {
        // Mock streaming simulation
        return this.mockStreamingExecution(fullPrompt, request, options);
      }

      // Real streaming execution
      return this.executeStreamingCLI(fullPrompt, request, options);

    } catch (error) {
      throw new Error(`OpenAI streaming execution failed: ${(error as Error).message}`);
    }
  }

  /**
   * Mock streaming simulation for testing
   */
  private async mockStreamingExecution(
    prompt: string,
    request: ExecutionRequest,
    options: StreamingOptions
  ): Promise<ExecutionResponse> {
    const startTime = Date.now();
    const mockResponse = `[Mock Streaming Response from OpenAI]\n\nTask received: ${prompt.substring(0, 100)}...\n\nThis is a placeholder streaming response.`;
    const tokens = mockResponse.split(' ');
    let fullOutput = '';

    // Simulate token streaming
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i] + (i < tokens.length - 1 ? ' ' : '');
      fullOutput += token;

      if (options.onToken) {
        options.onToken(token);
      }

      if (options.onProgress) {
        const progress = Math.min(100, ((i + 1) / tokens.length) * 100);
        options.onProgress(progress);
      }

      // Small delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    return {
      content: fullOutput,
      model: request.model || 'openai-default',
      tokensUsed: {
        prompt: this.estimateTokens(prompt),
        completion: this.estimateTokens(fullOutput),
        total: this.estimateTokens(prompt) + this.estimateTokens(fullOutput)
      },
      latencyMs: Date.now() - startTime,
      finishReason: 'stop'
    };
  }

  /**
   * Execute real streaming CLI
   */
  private async executeStreamingCLI(
    prompt: string,
    request: ExecutionRequest,
    options: StreamingOptions
  ): Promise<ExecutionResponse> {
    const { spawn } = await import('child_process');
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      let fullOutput = '';
      let tokenCount = 0;
      let stderr = '';
      let hasTimedOut = false;

      // Build CLI args with streaming enabled
      const args = this.buildCLIArgs(request);
      args.push('--stream'); // Enable streaming in OpenAI CLI

      // NOTE: Prompt is now passed via stdin instead of command-line argument
      // This avoids shell parsing errors when prompt contains special characters

      let child: ReturnType<typeof spawn>;
      try {
        // BUG FIX (v5.12.2): Use shell:false to prevent command injection and tokenization issues
        child = spawn(this.config.command, args, {
          stdio: ['pipe', 'pipe', 'pipe'], // Enable stdin for prompt input
          env: process.env,
          shell: false, // FIX: Prevents shell parsing issues and security vulnerabilities
        });
      } catch (error) {
        reject(new Error(`Failed to spawn OpenAI CLI: ${(error as Error).message}`));
        return;
      }

      // BUG FIX (v5.12.2): Track child process for cleanup
      this.activeChildren.add(child);

      // Write prompt to stdin (safer than command-line argument)
      try {
        child.stdin?.write(prompt);
        child.stdin?.end();
      } catch (error) {
        // BUG FIX (v5.12.2): Remove from tracking before killing
        this.activeChildren.delete(child);
        // Kill child process before rejecting to prevent orphan process
        child.kill('SIGTERM');
        reject(new Error(`Failed to write prompt to Codex CLI stdin: ${(error as Error).message}`));
        return;
      }

      // MEDIUM FIX (v5.6.17): Track abort kill timeout to prevent leak
      let abortKillTimeout: NodeJS.Timeout | null = null;

      // CRITICAL: Track abort handler for cleanup to prevent memory leak
      let abortHandler: (() => void) | undefined;

      // Handle abort signal
      if (request.signal) {
        abortHandler = () => {
          hasTimedOut = true;
          child.kill('SIGTERM');
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

      // Collect stdout with token streaming
      child.stdout?.on('data', (chunk) => {
        const token = chunk.toString();
        fullOutput += token;
        tokenCount++;

        // Real-time output if enabled (v5.6.5: UX improvement)
        if (process.env.AUTOMATOSX_SHOW_PROVIDER_OUTPUT === 'true') {
          process.stdout.write(token);
        }

        // Emit token event
        if (options.onToken) {
          options.onToken(token);
        }

        // Dynamic progress estimation based on prompt length
        // Typical completion is 0.5-2x the prompt length
        // Use adaptive estimation that gets more accurate as tokens are received
        const promptTokens = this.estimateTokens(prompt);
        let estimatedTotal: number;

        if (tokenCount < 50) {
          // Early stage: conservative estimate (1.5x prompt)
          estimatedTotal = Math.max(100, Math.floor(promptTokens * 1.5));
        } else if (tokenCount < 200) {
          // Mid stage: adjust based on current rate
          // If we've already exceeded initial estimate, extend it
          const initialEstimate = Math.floor(promptTokens * 1.5);
          estimatedTotal = Math.max(initialEstimate, Math.floor(tokenCount * 1.2));
        } else {
          // Late stage: use current count + 20% buffer
          estimatedTotal = Math.floor(tokenCount * 1.2);
        }

        const progress = Math.min(95, (tokenCount / estimatedTotal) * 100);
        if (options.onProgress) {
          options.onProgress(progress);
        }
      });

      // Collect stderr
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle process exit
      child.on('close', (code) => {
        try {
          cleanupAbortListener();  // CRITICAL: Remove abort listener to prevent memory leak

          // BUG FIX (v5.12.2): Remove from tracking when process exits
          this.activeChildren.delete(child);

          if (hasTimedOut) {
            return; // Already rejected by timeout
          }

          if (code !== 0) {
            reject(new Error(`OpenAI CLI exited with code ${code}: ${stderr}`));
          } else {
            // Emit final progress
            if (options.onProgress) {
              options.onProgress(100);
            }

            resolve({
              content: fullOutput.trim(),
              model: request.model || 'openai-default',
              tokensUsed: {
                prompt: this.estimateTokens(prompt),
                completion: this.estimateTokens(fullOutput),
                total: this.estimateTokens(prompt) + this.estimateTokens(fullOutput)
              },
              latencyMs: Date.now() - startTime,
              finishReason: 'stop'
            });
          }
        } catch (handlerError) {
          // Event handler threw - this is critical
          const errMsg = handlerError instanceof Error ? handlerError.message : String(handlerError);
          logger.error('Close event handler error (streaming)', { error: errMsg, provider: 'openai' });
          reject(new Error(`Internal error handling process exit: ${errMsg}`));
        }
      });

      // Handle process errors
      child.on('error', (error) => {
        cleanupAbortListener();  // CRITICAL: Remove abort listener to prevent memory leak
        if (!hasTimedOut) {
          reject(new Error(`Failed to spawn OpenAI CLI: ${error.message}`));
        }
      });

      // MEDIUM FIX (v5.6.17): Track all timeouts and create cleanup function
      let mainTimeout: NodeJS.Timeout | null = null;
      let nestedKillTimeout: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (mainTimeout) {
          clearTimeout(mainTimeout);
          mainTimeout = null;
        }
        if (nestedKillTimeout) {
          clearTimeout(nestedKillTimeout);
          nestedKillTimeout = null;
        }
        if (abortKillTimeout) {
          clearTimeout(abortKillTimeout);
          abortKillTimeout = null;
        }
      };

      // Set timeout
      mainTimeout = setTimeout(() => {
        hasTimedOut = true;
        cleanup(); // Clear other timeouts before creating new one
        child.kill('SIGTERM');

        // v5.6.18: Use configurable forceKillDelay
        const forceKillDelay = this.config.processManagement?.forceKillDelay ?? 1000;
        nestedKillTimeout = setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, forceKillDelay);

        reject(new Error(`OpenAI CLI streaming timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

      child.on('close', () => {
        try {
          cleanup(); // Clean up all timeouts
        } catch (handlerError) {
          // Event handler threw - this is critical
          const errMsg = handlerError instanceof Error ? handlerError.message : String(handlerError);
          logger.error('Close event handler error (cleanup)', { error: errMsg, provider: 'openai' });
        }
      });
    });
  }

  /**
   * Check if error message indicates a rate limit / usage limit error
   * v5.7.0: Provider limit detection patterns for OpenAI
   */
  private isRateLimitError(errorMsg: string): boolean {
    const lowerMsg = errorMsg.toLowerCase();
    return (
      lowerMsg.includes('rate_limit_exceeded') ||  // OpenAI API error type
      lowerMsg.includes('429') ||                   // HTTP status
      lowerMsg.includes('quota exceeded') ||
      lowerMsg.includes('insufficient_quota') ||
      lowerMsg.includes('rate limit') ||
      lowerMsg.includes('too many requests')
    );
  }

  /**
   * Create detailed rate limit error with automatic recording
   * v5.7.0: Provider limit detection and auto-rotation
   */
  private createRateLimitError(errorMsg: string): Error {
    // OpenAI typically has daily limits
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
        reason: 'rate_limit_exceeded',
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
   * Cleanup resources
   * BUG FIX (v5.12.2): Kill tracked child processes to prevent leaks
   */
  async cleanup(): Promise<void> {
    logger.debug('OpenAIProvider.cleanup', {
      activeChildren: this.activeChildren.size
    });

    // BUG FIX (v5.12.2): Kill all tracked child processes
    for (const child of this.activeChildren) {
      if (!child.killed) {
        logger.debug('Killing active child process', { pid: child.pid, provider: 'openai' });
        child.kill('SIGTERM');
      }
    }
    this.activeChildren.clear();
  }
}
