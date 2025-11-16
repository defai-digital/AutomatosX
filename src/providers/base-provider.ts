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

export abstract class BaseProvider implements Provider {
  /**
   * Whitelist of allowed provider names for security
   */
  private static readonly ALLOWED_PROVIDER_NAMES = [
    'claude',
    'gemini',
    'codex',
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

    this.config = config;
    this.health = {
      available: false,
      latencyMs: 0,
      errorRate: 0,
      consecutiveFailures: 0,
      lastCheck: Date.now()
    };
  }

  /**
   * Execute CLI command - must be implemented by subclasses
   * Should invoke the provider's CLI: `provider-name "prompt"`
   */
  protected abstract executeCLI(prompt: string): Promise<string>;

  /**
   * Check if CLI is available - must be implemented by subclasses
   */
  protected abstract checkCLIAvailable(): Promise<boolean>;

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

      return {
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
   */
  protected escapeShellArg(arg: string): string {
    // Replace quotes and backslashes
    return arg.replace(/["'\\]/g, '\\$&');
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
