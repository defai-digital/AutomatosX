/**
 * Base SDK-Only Adapter for OpenAI-Compatible Providers
 *
 * Provides a reusable base class for SDK-only adapters using OpenAI-compatible APIs.
 * Used by GLM (Zhipu AI) and Grok (xAI) integrations.
 *
 * v12.4.2: Extracted to eliminate duplication between ax-glm and ax-grok.
 *
 * @module integrations/shared/openai-compatible-sdk-only-adapter
 */

import type { ExecutionRequest, ExecutionResponse } from '../../types/provider.js';
import { logger } from '../../shared/logging/logger.js';
import type { OpenAICompatibleSdkAdapter } from './openai-compatible-sdk-adapter.js';

/**
 * Configuration for OpenAI-compatible SDK-only adapters
 */
export interface OpenAICompatibleSdkOnlyAdapterConfig {
  /** Provider name for logging (e.g., 'GLM', 'Grok') */
  providerName: string;
  /** Model name */
  model: string;
  /** Maximum retries for transient errors */
  maxRetries: number;
  /** Initial retry delay in ms */
  retryDelayMs: number;
  /** The underlying SDK adapter instance */
  sdkAdapter: OpenAICompatibleSdkAdapter;
}

/**
 * Base SDK-Only Adapter for OpenAI-Compatible Providers
 *
 * Provides direct SDK execution without CLI fallback.
 * This is more efficient than hybrid mode since:
 * - No subprocess spawn overhead (50-200ms saved)
 * - Type-safe responses (no string parsing)
 * - Better error handling (exceptions vs exit codes)
 *
 * **Usage:**
 * ```typescript
 * class GLMSdkOnlyAdapter extends OpenAICompatibleSdkOnlyAdapter {
 *   constructor(options) {
 *     super({
 *       providerName: 'GLM',
 *       model: options.model || 'glm-4',
 *       maxRetries: options.maxRetries ?? 2,
 *       retryDelayMs: options.retryDelayMs ?? 1000,
 *       sdkAdapter: new GLMSdkAdapter(options)
 *     });
 *   }
 * }
 * ```
 */
export class OpenAICompatibleSdkOnlyAdapter {
  protected readonly sdkAdapter: OpenAICompatibleSdkAdapter;
  protected initialized = false;
  protected readonly model: string;
  protected readonly maxRetries: number;
  protected readonly retryDelayMs: number;
  private readonly logPrefix: string;
  private readonly providerName: string;

  constructor(config: OpenAICompatibleSdkOnlyAdapterConfig) {
    this.providerName = config.providerName;
    this.model = config.model;
    this.maxRetries = config.maxRetries;
    this.retryDelayMs = config.retryDelayMs;
    this.sdkAdapter = config.sdkAdapter;
    this.logPrefix = `[${config.providerName} SDK-Only]`;

    logger.debug(`${this.logPrefix} Adapter created`, {
      model: this.model,
      maxRetries: this.maxRetries
    });
  }

  /**
   * Check if SDK is available
   */
  async isAvailable(): Promise<boolean> {
    return this.sdkAdapter.isAvailable();
  }

  /**
   * Initialize the adapter
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const available = await this.sdkAdapter.isAvailable();
    if (!available) {
      throw new Error(`${this.providerName} SDK not available - check API key and openai package`);
    }

    await this.sdkAdapter.initialize();
    this.initialized = true;

    logger.debug(`${this.logPrefix} Initialized`, { model: this.model });
  }

  /**
   * Execute a request using SDK
   *
   * Retries transient errors up to maxRetries times with exponential backoff.
   * Does NOT fall back to CLI - throws on persistent failure.
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.sdkAdapter.execute(request);

        logger.debug(`${this.logPrefix} Execution succeeded`, {
          model: this.model,
          attempt: attempt + 1,
          latencyMs: response.latencyMs
        });

        return response;
      } catch (error) {
        lastError = error as Error;

        logger.warn(`${this.logPrefix} Execution failed`, {
          model: this.model,
          attempt: attempt + 1,
          maxRetries: this.maxRetries,
          error: lastError.message
        });

        // Check if error is retryable
        if (attempt < this.maxRetries && this.isRetryableError(lastError)) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          logger.debug(`${this.logPrefix} Retrying after delay`, {
            attempt: attempt + 1,
            delayMs: delay
          });
          await this.sleep(delay);
          continue;
        }

        // Non-retryable or max retries exceeded
        break;
      }
    }

    const totalTime = Date.now() - startTime;
    logger.error(`${this.logPrefix} All retries exhausted`, {
      model: this.model,
      totalAttempts: this.maxRetries + 1,
      totalTimeMs: totalTime,
      lastError: lastError?.message
    });

    throw new Error(
      `${this.providerName} SDK execution failed after ${this.maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Check if error is retryable
   */
  protected isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Rate limit errors - retryable with backoff
    if (message.includes('rate limit') || message.includes('429')) {
      return true;
    }

    // Temporary server errors
    if (message.includes('500') || message.includes('502') ||
        message.includes('503') || message.includes('504')) {
      return true;
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('etimedout')) {
      return true;
    }

    // Connection errors
    if (message.includes('econnreset') || message.includes('econnrefused')) {
      return true;
    }

    return false;
  }

  /**
   * Sleep utility
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get the configured model
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    await this.sdkAdapter.destroy();
    this.initialized = false;
    logger.debug(`${this.logPrefix} Adapter destroyed`);
  }
}
