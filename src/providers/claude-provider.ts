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

      return {
        content: response.content,
        model: request.model || 'claude-default', // CLI decides actual model
        tokensUsed: {
          prompt: this.estimateTokens(fullPrompt),
          completion: this.estimateTokens(response.content),
          total: this.estimateTokens(fullPrompt) + this.estimateTokens(response.content)
        },
        latencyMs: latency,
        finishReason: 'stop'
      };
    } catch (error) {
      throw new Error(`Claude execution failed: ${(error as Error).message}`);
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
  private async executeCLI(prompt: string, request: ExecutionRequest): Promise<{ content: string }> {
    // Check if running in production mode (real CLI) or test mode (mock)
    const useMock = process.env.AUTOMATOSX_MOCK_PROVIDERS === 'true';

    if (useMock) {
      // Mock mode for testing
      return Promise.resolve({
        content: `[Mock Response from Claude]\n\nTask received: ${prompt.substring(0, 100)}...\n\nThis is a placeholder response. Set AUTOMATOSX_MOCK_PROVIDERS=false to use real CLI.`
      });
    }

    // Real CLI execution
    return this.executeRealCLI(prompt, request);
  }

  /**
   * Execute real CLI command via spawn
   *
   * Claude Code CLI syntax: echo "prompt" | claude --print
   * Uses --print flag for non-interactive output
   * Prompt is passed via stdin (not as positional argument)
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

      // Build CLI arguments using the new buildCLIArgs method
      const args = this.buildCLIArgs(request);

      // NOTE: Do NOT add prompt as positional argument
      // Claude CLI expects prompt via stdin or --prompt flag
      // We use stdin to avoid command-line length limits

      let child: ReturnType<typeof spawn>;
      try {
        child = spawn(this.config.command, args, {
          stdio: ['pipe', 'pipe', 'pipe'], // Use pipe for stdin
          env: process.env,
        });
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
          const suggestion = getProviderSuggestion('claude');
          reject(
            new Error(
              `Claude CLI not found: '${this.config.command}'

` +
                `${suggestion}`,
            ),
          );
        } else {
          reject(new Error(`Failed to start Claude CLI: ${err.message}`));
        }
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
        child.kill('SIGTERM');

        // Set fallback timeout to force kill if SIGTERM doesn't work
        const cleanupTimeout = setTimeout(() => {
          if (!child.killed && child.exitCode === null) {
            child.kill('SIGKILL');
          }
        }, 1000);

        // Wait for process to exit, then reject
        child.once('exit', () => {
          clearTimeout(cleanupTimeout);
          reject(new Error(`Failed to write prompt to Claude CLI stdin: ${(error as Error).message}`));
        });
        return;
      }

      // v5.0.7: Handle abort signal for proper timeout cancellation
      if (request.signal) {
        request.signal.addEventListener('abort', () => {
          hasTimedOut = true;
          cleanup();  // Clear all timeouts
          child.kill('SIGTERM');

          // Force kill after 5 seconds if SIGTERM doesn't work
          abortKillTimeout = setTimeout(() => {
            if (!child.killed) {
              child.kill('SIGKILL');
            }
          }, 5000);

          reject(new Error('Execution aborted by timeout'));
        });
      }

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
        cleanup();  // Clear all timeouts

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
          } else if (errorMsg.toLowerCase().includes('rate limit') ||
                     errorMsg.toLowerCase().includes('quota')) {
            reject(new Error(
              `Rate limit exceeded: Please wait a moment and try again.\n` +
              `Details: ${errorMsg}`
            ));
          } else {
            reject(new Error(`Claude CLI exited with code ${code}: ${errorMsg}`));
          }
        } else {
          if (!stdout.trim()) {
            reject(new Error('Claude CLI returned empty response'));
          } else {
            resolve({ content: stdout.trim() });
          }
        }
      });

      // Handle process errors
      child.on('error', (error) => {
        if (hasTimedOut) {
          return; // Timeout already handled
        }

        const err = error as NodeJS.ErrnoException;

        if (err.code === 'ENOENT') {
          const suggestion = getProviderSuggestion('claude');
          reject(new Error(
            `Claude CLI command '${this.config.command}' not found.\n\n` +
            `${suggestion}`
          ));
        } else if (err.code === 'EACCES') {
          reject(new Error(
            `Permission denied: Cannot execute '${this.config.command}'.\n` +
            `Please check file permissions.`
          ));
        } else {
          reject(new Error(`Failed to execute Claude CLI: ${err.message}`));
        }
      });

      // Set timeout
      mainTimeout = setTimeout(() => {
        hasTimedOut = true;
        cleanup();  // Clear other timeouts
        child.kill('SIGTERM');

        // Force kill after 5 seconds if still running
        nestedKillTimeout = setTimeout(() => {
          if (child.killed === false) {
            child.kill('SIGKILL');
          }
        }, 5000);

        reject(new Error(
          `Request timeout after ${this.config.timeout / 1000} seconds.\n` +
          `This may be due to:\n` +
          `- Slow network connection\n` +
          `- Large request requiring more processing time\n` +
          `- Claude API being overloaded\n` +
          `Try again or use --timeout option to increase the limit.`
        ));
      }, this.config.timeout);
    });
  }

  override shouldRetry(error: Error): boolean {
    // Use centralized retry logic for consistency
    return shouldRetryError(error, 'claude');
  }

  /**
   * Build CLI arguments for Claude Code CLI
   * Currently does not support parameter passing via CLI
   * Claude Code uses its own optimal defaults
   */
  protected buildCLIArgs(request: ExecutionRequest): string[] {
    // Claude Code CLI uses --print for non-interactive output
    const args: string[] = ['--print'];

    // Enable file operation tools (v5.0.6 fix)
    // Allow Read, Write, Edit, and Bash tools for agent operations
    args.push('--allowedTools', 'Read Write Edit Bash Glob Grep');

    // Allow access to current working directory and tmp folder
    args.push('--add-dir', process.cwd());

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
   * Claude CLI doesn't support native streaming
   *
   * Note: Real-time output is still available via AUTOMATOSX_SHOW_PROVIDER_OUTPUT
   * environment variable, which displays CLI output as it's generated.
   */
  override supportsStreaming(): boolean {
    return false;
  }
}
