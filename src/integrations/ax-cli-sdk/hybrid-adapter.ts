/**
 * HybridAxCliAdapter - Supports both CLI and SDK modes (v9.2.0)
 *
 * Provides transparent mode selection with automatic fallback:
 * - "sdk": Use SDK exclusively (fail if unavailable)
 * - "cli": Use CLI (legacy mode)
 * - "auto": Try SDK first, fallback to CLI
 *
 * @module integrations/ax-cli-sdk/hybrid-adapter
 */

import type { IAxCliAdapter, AxCliOptions } from '../ax-cli/interface.js';
import type { ExecutionResponse } from '../../types/provider.js';
import { AxCliAdapter as AxCliAdapterImpl } from '../ax-cli/adapter.js';
import { AxCliSdkAdapter } from './adapter.js';
import { logger } from '../../utils/logger.js';

/**
 * Execution mode for hybrid adapter
 */
export type AdapterMode = 'sdk' | 'cli' | 'auto';

/**
 * Hybrid adapter configuration
 */
export interface HybridAdapterOptions {
  /** Initial mode (can change at runtime for "auto") */
  mode?: AdapterMode;

  /** SDK-specific options */
  sdk?: {
    reuseEnabled?: boolean;
    streamingEnabled?: boolean;
  };
}

/**
 * Hybrid adapter that supports both CLI and SDK execution modes
 *
 * Mode selection logic:
 * 1. "sdk": Always use SDK (throws if unavailable)
 * 2. "cli": Always use CLI (current behavior)
 * 3. "auto": Try SDK first, fallback to CLI on failure
 *
 * Performance:
 * - SDK mode: ~5ms overhead
 * - CLI mode: ~50-200ms overhead
 * - Auto mode: SDK overhead if available, else CLI overhead
 */
export class HybridAxCliAdapter implements IAxCliAdapter {
  private mode: AdapterMode;
  private activeMode: 'sdk' | 'cli' | null = null;
  private sdkAdapter: AxCliSdkAdapter | null = null;
  private cliAdapter: AxCliAdapterImpl | null = null;
  private readonly sdkOptions: HybridAdapterOptions['sdk'];

  constructor(options: HybridAdapterOptions = {}) {
    this.mode = options.mode || 'auto';
    this.sdkOptions = options.sdk;

    logger.info('HybridAxCliAdapter initialized', {
      mode: this.mode,
      sdkOptions: this.sdkOptions
    });
  }

  /**
   * Execute prompt using selected mode
   *
   * Auto mode behavior:
   * - First execution: Try SDK, fallback to CLI
   * - Subsequent executions: Use successful mode
   * - SDK failure: Permanently switch to CLI
   */
  async execute(prompt: string, options: AxCliOptions): Promise<ExecutionResponse> {
    // Initialize adapters on first use
    await this.ensureAdapters();

    try {
      // Execute with active mode
      if (this.activeMode === 'sdk' && this.sdkAdapter) {
        return await this.executeSdk(prompt, options);
      } else if (this.activeMode === 'cli' && this.cliAdapter) {
        return await this.executeCli(prompt, options);
      }

      // Should not reach here if ensureAdapters() worked correctly
      throw new Error(`No adapter available for mode: ${this.mode}`);
    } catch (error) {
      // Auto mode: fallback to CLI if SDK fails
      if (this.mode === 'auto' && this.activeMode === 'sdk' && this.cliAdapter) {
        logger.warn('SDK execution failed, falling back to CLI', {
          error: error instanceof Error ? error.message : String(error)
        });

        // Permanently switch to CLI mode
        this.activeMode = 'cli';

        return await this.executeCli(prompt, options);
      }

      // No fallback available or not in auto mode - re-throw error
      throw error;
    }
  }

  /**
   * Execute via SDK
   */
  private async executeSdk(prompt: string, options: AxCliOptions): Promise<ExecutionResponse> {
    if (!this.sdkAdapter) {
      throw new Error('SDK adapter not initialized');
    }

    logger.debug('Executing via SDK', {
      model: options.model,
      promptLength: prompt.length
    });

    return await this.sdkAdapter.execute(prompt, options);
  }

  /**
   * Execute via CLI
   */
  private async executeCli(prompt: string, options: AxCliOptions): Promise<ExecutionResponse> {
    if (!this.cliAdapter) {
      throw new Error('CLI adapter not initialized');
    }

    logger.debug('Executing via CLI', {
      model: options.model,
      promptLength: prompt.length
    });

    return await this.cliAdapter.execute(prompt, options);
  }

  /**
   * Ensure adapters are initialized based on mode
   */
  private async ensureAdapters(): Promise<void> {
    // Already initialized
    if (this.activeMode !== null) {
      return;
    }

    // SDK mode: Initialize SDK only
    if (this.mode === 'sdk') {
      await this.initializeSdk(true);  // required=true
      this.activeMode = 'sdk';
      return;
    }

    // CLI mode: Initialize CLI only
    if (this.mode === 'cli') {
      this.initializeCli();
      this.activeMode = 'cli';
      return;
    }

    // Auto mode: Try SDK first, fallback to CLI
    if (this.mode === 'auto') {
      const sdkAvailable = await this.initializeSdk(false);  // required=false

      if (sdkAvailable) {
        this.activeMode = 'sdk';
        logger.info('Auto mode: Using SDK (10-40x faster)');
      } else {
        // SDK not available, use CLI
        this.initializeCli();
        this.activeMode = 'cli';
        logger.info('Auto mode: Using CLI (SDK not available)');
      }

      return;
    }

    throw new Error(`Invalid mode: ${this.mode}`);
  }

  /**
   * Initialize SDK adapter
   *
   * @param required - If true, throws if SDK unavailable
   * @returns true if SDK is available, false otherwise
   */
  private async initializeSdk(required: boolean): Promise<boolean> {
    if (this.sdkAdapter) {
      return true;  // Already initialized
    }

    try {
      this.sdkAdapter = new AxCliSdkAdapter(this.sdkOptions);

      const available = await this.sdkAdapter.isAvailable();

      if (!available) {
        if (required) {
          throw new Error(
            'ax-cli SDK not available. Install with: npm install @defai.digital/ax-cli'
          );
        }

        logger.warn('SDK not available', {
          hint: 'Install with: npm install @defai.digital/ax-cli'
        });

        this.sdkAdapter = null;
        return false;
      }

      logger.info('SDK adapter initialized', {
        version: await this.sdkAdapter.getVersion()
      });

      return true;
    } catch (error) {
      logger.error('Failed to initialize SDK adapter', {
        error: error instanceof Error ? error.message : String(error)
      });

      this.sdkAdapter = null;

      if (required) {
        throw error;
      }

      return false;
    }
  }

  /**
   * Initialize CLI adapter
   */
  private initializeCli(): void {
    if (this.cliAdapter) {
      return;  // Already initialized
    }

    this.cliAdapter = new AxCliAdapterImpl();

    logger.info('CLI adapter initialized', {
      command: this.cliAdapter.getCommand()
    });
  }

  /**
   * Check if adapter is available
   */
  async isAvailable(): Promise<boolean> {
    await this.ensureAdapters();

    if (this.activeMode === 'sdk' && this.sdkAdapter) {
      return await this.sdkAdapter.isAvailable();
    } else if (this.activeMode === 'cli' && this.cliAdapter) {
      return await this.cliAdapter.isAvailable();
    }

    return false;
  }

  /**
   * Get adapter version
   */
  async getVersion(): Promise<string> {
    await this.ensureAdapters();

    if (this.activeMode === 'sdk' && this.sdkAdapter) {
      return await this.sdkAdapter.getVersion();
    } else if (this.activeMode === 'cli' && this.cliAdapter) {
      return await this.cliAdapter.getVersion();
    }

    return 'unknown';
  }

  /**
   * Get command name
   */
  getCommand(): string {
    if (this.activeMode === 'sdk') {
      return 'ax-cli-sdk';
    } else if (this.activeMode === 'cli') {
      return 'ax-cli';
    }

    // Not initialized yet, return based on mode
    return this.mode === 'sdk' ? 'ax-cli-sdk' : 'ax-cli';
  }

  /**
   * Get display name
   */
  getDisplayName(): string {
    if (this.activeMode === 'sdk') {
      return 'ax-cli (SDK)';
    } else if (this.activeMode === 'cli') {
      return 'ax-cli (CLI)';
    }

    // Not initialized yet
    return `ax-cli (${this.mode})`;
  }

  /**
   * Get current active mode
   */
  getActiveMode(): 'sdk' | 'cli' | null {
    return this.activeMode;
  }

  /**
   * Force switch to CLI mode (for debugging or fallback)
   */
  switchToCliMode(): void {
    logger.info('Forcing switch to CLI mode');
    this.initializeCli();
    this.activeMode = 'cli';
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    const destroyPromises: Promise<void>[] = [];

    if (this.sdkAdapter) {
      destroyPromises.push(this.sdkAdapter.destroy());
    }

    // CLI adapter doesn't have cleanup (no persistent state)

    await Promise.all(destroyPromises);

    this.sdkAdapter = null;
    this.cliAdapter = null;
    this.activeMode = null;

    logger.info('Hybrid adapter destroyed');
  }
}
