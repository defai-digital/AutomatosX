/**
 * GLM SDK-Only Adapter
 *
 * Direct SDK access to GLM without CLI fallback.
 * Used when AutomatosX executes GLM directly (not via subprocess).
 *
 * v13.0.0: Added as part of PRD MCP Architecture Redesign.
 *          Replaces hybrid adapter for outbound execution.
 *
 * @module integrations/ax-glm/sdk-only-adapter
 */

import type { ExecutionRequest, ExecutionResponse } from '../../types/provider.js';
import { logger } from '../../shared/logging/logger.js';
import { GLMSdkAdapter } from './sdk-adapter.js';
import { type GLMModel, GLM_DEFAULT_MODEL } from './types.js';

/**
 * Configuration for GLM SDK-only adapter
 */
export interface GLMSdkOnlyAdapterOptions {
  /** Model to use (default: glm-4) */
  model?: GLMModel;
  /** API key (defaults to ZAI_API_KEY env var) */
  apiKey?: string;
  /** Base URL for API */
  baseUrl?: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Maximum retries for transient errors */
  maxRetries?: number;
  /** Initial retry delay in ms */
  retryDelayMs?: number;
}

/**
 * GLM SDK-Only Adapter
 *
 * Provides direct SDK execution for GLM without CLI fallback.
 * This is more efficient than hybrid mode since:
 * - No subprocess spawn overhead (50-200ms saved)
 * - Type-safe responses (no string parsing)
 * - Better error handling (exceptions vs exit codes)
 *
 * **Usage:**
 * ```typescript
 * const adapter = new GLMSdkOnlyAdapter({
 *   model: 'glm-4.6',
 *   maxRetries: 2
 * });
 *
 * const response = await adapter.execute({
 *   prompt: 'Hello, world!',
 *   systemPrompt: 'You are a helpful assistant.'
 * });
 * ```
 */
export class GLMSdkOnlyAdapter {
  private sdkAdapter: GLMSdkAdapter;
  private initialized = false;
  private readonly model: GLMModel;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(options: GLMSdkOnlyAdapterOptions = {}) {
    this.model = options.model || GLM_DEFAULT_MODEL;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 1000;

    this.sdkAdapter = new GLMSdkAdapter({
      model: this.model,
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      timeout: options.timeout
    });

    logger.debug('[GLM SDK-Only] Adapter created', {
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
      throw new Error('GLM SDK not available - check API key and openai package');
    }

    await this.sdkAdapter.initialize();
    this.initialized = true;

    logger.debug('[GLM SDK-Only] Initialized', { model: this.model });
  }

  /**
   * Execute a request using GLM SDK
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

        logger.debug('[GLM SDK-Only] Execution succeeded', {
          model: this.model,
          attempt: attempt + 1,
          latencyMs: response.latencyMs
        });

        return response;
      } catch (error) {
        lastError = error as Error;

        logger.warn('[GLM SDK-Only] Execution failed', {
          model: this.model,
          attempt: attempt + 1,
          maxRetries: this.maxRetries,
          error: lastError.message
        });

        // Check if error is retryable
        if (attempt < this.maxRetries && this.isRetryableError(lastError)) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          logger.debug('[GLM SDK-Only] Retrying after delay', {
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
    logger.error('[GLM SDK-Only] All retries exhausted', {
      model: this.model,
      totalAttempts: this.maxRetries + 1,
      totalTimeMs: totalTime,
      lastError: lastError?.message
    });

    throw new Error(
      `GLM SDK execution failed after ${this.maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
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
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get the configured model
   */
  getModel(): GLMModel {
    return this.model;
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    await this.sdkAdapter.destroy();
    this.initialized = false;
    logger.debug('[GLM SDK-Only] Adapter destroyed');
  }
}
