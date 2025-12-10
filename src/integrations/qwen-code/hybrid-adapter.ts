/**
 * Qwen Hybrid Adapter
 *
 * Provides SDK-first execution with CLI fallback for Qwen models.
 * Automatically selects the best execution mode based on availability.
 *
 * v12.7.0: Added as part of Qwen Code provider integration.
 *
 * @module integrations/qwen-code/hybrid-adapter
 */

import type { ExecutionRequest, ExecutionResponse } from '../../types/provider.js';
import { logger } from '../../shared/logging/logger.js';
import { QwenSdkAdapter } from './sdk-adapter.js';
import { QwenCliWrapper } from './cli-wrapper.js';
import type { QwenModel, QwenSDKConfig, QwenCLIConfig } from './types.js';
import type { AdapterMode } from '../../providers/hybrid-adapter-base.js';

/**
 * Hybrid adapter options
 */
export interface QwenHybridAdapterOptions {
  /** Execution mode: 'sdk', 'cli', or 'auto' (default: 'auto') */
  mode?: AdapterMode;
  /** Model to use */
  model?: QwenModel;
  /** API key for SDK mode */
  apiKey?: string;
  /** Base URL for SDK mode */
  baseUrl?: string;
  /** CLI command name */
  command?: string;
  /** Request timeout in ms */
  timeout?: number;
}

/**
 * Circuit breaker state
 */
interface CircuitBreaker {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

/**
 * Qwen Hybrid Adapter
 *
 * Provides flexible execution with automatic mode selection:
 * - SDK mode: Direct API access via OpenAI-compatible endpoint
 * - CLI mode: Execute via Qwen Code CLI
 * - Auto mode: Try SDK first, fall back to CLI
 *
 * **Usage:**
 * ```typescript
 * const adapter = new QwenHybridAdapter({
 *   mode: 'auto',
 *   model: 'qwen-turbo'
 * });
 * const response = await adapter.execute({ prompt: 'Hello' });
 * ```
 */
export class QwenHybridAdapter {
  private sdkAdapter: QwenSdkAdapter | null = null;
  private cliWrapper: QwenCliWrapper | null = null;
  private readonly options: QwenHybridAdapterOptions;
  private activeMode: 'sdk' | 'cli' | null = null;

  // Circuit breakers for each mode
  private sdkCircuitBreaker: CircuitBreaker = {
    failures: 0,
    lastFailure: 0,
    isOpen: false
  };
  private cliCircuitBreaker: CircuitBreaker = {
    failures: 0,
    lastFailure: 0,
    isOpen: false
  };

  // Circuit breaker configuration
  private readonly FAILURE_THRESHOLD = 3;
  private readonly RECOVERY_TIMEOUT_MS = 60000; // 1 minute

  constructor(options: QwenHybridAdapterOptions = {}) {
    this.options = {
      mode: options.mode || 'auto',
      model: options.model || 'qwen-turbo',
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      command: options.command || 'qwen',
      timeout: options.timeout
    };

    logger.debug('[Qwen Hybrid] Adapter created', {
      mode: this.options.mode,
      model: this.options.model
    });
  }

  /**
   * Get or create SDK adapter
   */
  private getSdkAdapter(): QwenSdkAdapter {
    if (!this.sdkAdapter) {
      const config: QwenSDKConfig = {
        apiKey: this.options.apiKey,
        baseUrl: this.options.baseUrl,
        model: this.options.model,
        timeout: this.options.timeout
      };
      this.sdkAdapter = new QwenSdkAdapter(config);
    }
    return this.sdkAdapter;
  }

  /**
   * Get or create CLI wrapper
   */
  private getCliWrapper(): QwenCliWrapper {
    if (!this.cliWrapper) {
      const config: QwenCLIConfig = {
        command: this.options.command,
        timeout: this.options.timeout
      };
      this.cliWrapper = new QwenCliWrapper(config);
    }
    return this.cliWrapper;
  }

  /**
   * Check if a circuit breaker should allow requests
   */
  private isCircuitClosed(breaker: CircuitBreaker): boolean {
    if (!breaker.isOpen) {
      return true;
    }

    // Check if recovery timeout has passed
    if (Date.now() - breaker.lastFailure > this.RECOVERY_TIMEOUT_MS) {
      breaker.isOpen = false;
      breaker.failures = 0;
      return true;
    }

    return false;
  }

  /**
   * Record a failure on a circuit breaker
   */
  private recordFailure(breaker: CircuitBreaker): void {
    breaker.failures++;
    breaker.lastFailure = Date.now();

    if (breaker.failures >= this.FAILURE_THRESHOLD) {
      breaker.isOpen = true;
      logger.warn('[Qwen Hybrid] Circuit breaker opened', {
        failures: breaker.failures
      });
    }
  }

  /**
   * Record a success on a circuit breaker
   */
  private recordSuccess(breaker: CircuitBreaker): void {
    breaker.failures = 0;
    breaker.isOpen = false;
  }

  /**
   * Execute a request using the appropriate mode
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    const mode = this.options.mode;

    // Direct mode selection
    if (mode === 'sdk') {
      return this.executeWithSdk(request);
    }

    if (mode === 'cli') {
      return this.executeWithCli(request);
    }

    // Auto mode: Try SDK first, fall back to CLI
    return this.executeWithAuto(request);
  }

  /**
   * Execute with SDK only
   */
  private async executeWithSdk(request: ExecutionRequest): Promise<ExecutionResponse> {
    const adapter = this.getSdkAdapter();

    if (!await adapter.isAvailable()) {
      throw new Error('Qwen SDK is not available. Check DASHSCOPE_API_KEY or QWEN_API_KEY.');
    }

    this.activeMode = 'sdk';
    return adapter.execute(request);
  }

  /**
   * Execute with CLI only
   */
  private async executeWithCli(request: ExecutionRequest): Promise<ExecutionResponse> {
    const wrapper = this.getCliWrapper();

    if (!await wrapper.isAvailable()) {
      throw new Error('Qwen CLI is not available. Run: npm install -g @qwen-code/qwen-code@latest');
    }

    this.activeMode = 'cli';
    return wrapper.execute(request);
  }

  /**
   * Execute with automatic mode selection
   */
  private async executeWithAuto(request: ExecutionRequest): Promise<ExecutionResponse> {
    // Try SDK first (if circuit is closed)
    if (this.isCircuitClosed(this.sdkCircuitBreaker)) {
      const adapter = this.getSdkAdapter();

      try {
        if (await adapter.isAvailable()) {
          logger.debug('[Qwen Hybrid] Using SDK mode');
          this.activeMode = 'sdk';
          const response = await adapter.execute(request);
          this.recordSuccess(this.sdkCircuitBreaker);
          return response;
        }
      } catch (error) {
        logger.warn('[Qwen Hybrid] SDK execution failed, trying CLI', {
          error: error instanceof Error ? error.message : String(error)
        });
        this.recordFailure(this.sdkCircuitBreaker);
      }
    }

    // Fall back to CLI (if circuit is closed)
    if (this.isCircuitClosed(this.cliCircuitBreaker)) {
      const wrapper = this.getCliWrapper();

      try {
        if (await wrapper.isAvailable()) {
          logger.debug('[Qwen Hybrid] Using CLI mode (fallback)');
          this.activeMode = 'cli';
          const response = await wrapper.execute(request);
          this.recordSuccess(this.cliCircuitBreaker);
          return response;
        }
      } catch (error) {
        logger.error('[Qwen Hybrid] CLI execution also failed', {
          error: error instanceof Error ? error.message : String(error)
        });
        this.recordFailure(this.cliCircuitBreaker);
        throw error;
      }
    }

    // Both modes unavailable or circuit breakers open
    throw new Error(
      'Qwen execution failed: Both SDK and CLI modes are unavailable or have failed too many times. ' +
      'Ensure DASHSCOPE_API_KEY is set or Qwen CLI is installed.'
    );
  }

  /**
   * Get the currently active execution mode
   */
  getActiveMode(): 'sdk' | 'cli' | null {
    return this.activeMode;
  }

  /**
   * Reset circuit breakers
   */
  resetCircuitBreakers(): void {
    this.sdkCircuitBreaker = { failures: 0, lastFailure: 0, isOpen: false };
    this.cliCircuitBreaker = { failures: 0, lastFailure: 0, isOpen: false };
    logger.debug('[Qwen Hybrid] Circuit breakers reset');
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    if (this.sdkAdapter) {
      await this.sdkAdapter.destroy();
      this.sdkAdapter = null;
    }
    this.cliWrapper = null;
    this.activeMode = null;
    logger.debug('[Qwen Hybrid] Adapter destroyed');
  }
}
