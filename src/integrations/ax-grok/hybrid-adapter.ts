/**
 * Grok Hybrid Adapter
 *
 * SDK-first adapter for Grok with CLI fallback.
 * Extends HybridAdapterBase to provide Grok-specific implementation.
 *
 * v12.0.0: Added as part of PRD-012 provider architecture refactoring.
 *
 * @module integrations/ax-grok/hybrid-adapter
 */

import {
  HybridAdapterBase,
  type AdapterMode,
  type HybridAdapterBaseOptions,
  type ExecutionRequest,
  type ExecutionResponse
} from '../../providers/hybrid-adapter-base.js';
import { GrokSdkAdapter } from './sdk-adapter.js';
import { GrokCliWrapper } from './cli-wrapper.js';
import { type GrokModel, GROK_DEFAULT_MODEL } from './types.js';
import { logger } from '../../shared/logging/logger.js';

/**
 * Grok hybrid adapter options
 */
export interface GrokHybridAdapterOptions {
  /** Execution mode: 'sdk', 'cli', or 'auto' (default) */
  mode?: AdapterMode;
  /** Model to use */
  model?: GrokModel;
  /** API key for SDK mode */
  apiKey?: string;
  /** Base URL for SDK mode */
  baseUrl?: string;
  /** CLI command (default: ax-grok) */
  command?: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Maximum retries before fallback */
  maxRetries?: number;
}

/**
 * Grok Hybrid Adapter
 *
 * Provides SDK-first access to Grok models with CLI fallback.
 *
 * **Execution Flow:**
 * 1. Check if SDK-first mode is enabled (feature flag)
 * 2. If SDK circuit breaker is open, use CLI
 * 3. Try SDK execution
 * 4. On failure, classify error and decide:
 *    - RETRY_SDK: Retry with backoff
 *    - USE_CLI: Fallback to CLI
 *    - PROPAGATE: Throw error
 *
 * **Usage:**
 * ```typescript
 * const adapter = new GrokHybridAdapter({
 *   mode: 'auto',
 *   model: 'grok-3'
 * });
 *
 * const response = await adapter.execute({
 *   prompt: 'Hello, world!'
 * });
 * ```
 */
export class GrokHybridAdapter extends HybridAdapterBase {
  private sdkAdapter: GrokSdkAdapter | null = null;
  private cliWrapper: GrokCliWrapper | null = null;
  private readonly model: GrokModel;
  private readonly sdkConfig: {
    apiKey?: string;
    baseUrl?: string;
    timeout?: number;
  };
  private readonly cliConfig: {
    command?: string;
    timeout?: number;
  };

  constructor(options: GrokHybridAdapterOptions = {}) {
    const baseOptions: HybridAdapterBaseOptions = {
      mode: options.mode || 'auto',
      providerName: 'grok',
      maxRetries: options.maxRetries ?? 1
    };

    super(baseOptions);

    this.model = options.model || GROK_DEFAULT_MODEL;
    this.sdkConfig = {
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      timeout: options.timeout
    };
    this.cliConfig = {
      command: options.command,
      timeout: options.timeout
    };

    logger.debug('[Grok Hybrid] Adapter created', {
      mode: this.mode,
      model: this.model
    });
  }

  /**
   * Execute request via SDK
   */
  protected async executeViaSDK(request: ExecutionRequest): Promise<ExecutionResponse> {
    if (!this.sdkAdapter) {
      throw new Error('Grok SDK adapter not initialized');
    }

    return this.sdkAdapter.execute(request);
  }

  /**
   * Execute request via CLI
   */
  protected async executeViaCLI(request: ExecutionRequest): Promise<ExecutionResponse> {
    if (!this.cliWrapper) {
      throw new Error('Grok CLI wrapper not initialized');
    }

    return this.cliWrapper.execute(request);
  }

  /**
   * Check if SDK is available
   */
  protected async isSDKAvailable(): Promise<boolean> {
    try {
      const adapter = new GrokSdkAdapter({
        ...this.sdkConfig,
        model: this.model
      });

      const available = await adapter.isAvailable();

      if (!available) {
        return false;
      }

      // Store adapter for later use
      this.sdkAdapter = adapter;
      return true;
    } catch (error) {
      logger.debug('[Grok Hybrid] SDK availability check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Check if CLI is available
   */
  protected async isCLIAvailable(): Promise<boolean> {
    try {
      const wrapper = new GrokCliWrapper({
        ...this.cliConfig,
        model: this.model
      });

      const available = await wrapper.isAvailable();

      if (!available) {
        return false;
      }

      // Store wrapper for later use
      this.cliWrapper = wrapper;
      return true;
    } catch (error) {
      logger.debug('[Grok Hybrid] CLI availability check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Initialize SDK adapter
   */
  protected async initializeSDK(): Promise<void> {
    if (!this.sdkAdapter) {
      this.sdkAdapter = new GrokSdkAdapter({
        ...this.sdkConfig,
        model: this.model
      });
    }

    await this.sdkAdapter.initialize();

    logger.debug('[Grok Hybrid] SDK initialized', {
      model: this.model
    });
  }

  /**
   * Initialize CLI wrapper
   */
  protected async initializeCLI(): Promise<void> {
    if (!this.cliWrapper) {
      this.cliWrapper = new GrokCliWrapper({
        ...this.cliConfig,
        model: this.model
      });
    }

    await this.cliWrapper.initialize();

    logger.debug('[Grok Hybrid] CLI initialized', {
      model: this.model,
      version: this.cliWrapper.getVersion()
    });
  }

  /**
   * Clean up SDK resources
   */
  protected async destroySDK(): Promise<void> {
    if (this.sdkAdapter) {
      await this.sdkAdapter.destroy();
      this.sdkAdapter = null;
    }
  }

  /**
   * Clean up CLI resources
   */
  protected async destroyCLI(): Promise<void> {
    if (this.cliWrapper) {
      await this.cliWrapper.destroy();
      this.cliWrapper = null;
    }
  }

  /**
   * Get the configured model
   */
  getModel(): GrokModel {
    return this.model;
  }

  /**
   * Get the CLI command being used
   */
  getCommand(): string {
    return this.cliWrapper?.getCommand() || this.cliConfig.command || 'ax-grok';
  }

  /**
   * Get CLI version
   */
  getCLIVersion(): string | null {
    return this.cliWrapper?.getVersion() || null;
  }
}
