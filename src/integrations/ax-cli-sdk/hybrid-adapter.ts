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
import { logger } from '../../shared/logging/logger.js';

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
      if (this.mode === 'auto' && this.activeMode === 'sdk') {
        logger.warn('SDK execution failed, falling back to CLI', {
          error: error instanceof Error ? error.message : String(error)
        });

        // BUG FIX (v11.3.3): Clean up SDK adapter to prevent resource leaks
        // when falling back to CLI. Use fire-and-forget pattern since we need
        // to return quickly and CLI is the fallback anyway.
        if (this.sdkAdapter) {
          const sdkAdapterToClean = this.sdkAdapter;
          this.sdkAdapter = null;
          // Fire-and-forget cleanup - don't await to keep fallback fast
          sdkAdapterToClean.destroy().catch((cleanupError) => {
            logger.warn('Error during SDK adapter cleanup on fallback', {
              error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
            });
          });
        }

        // Ensure CLI adapter exists for fallback
        if (!this.cliAdapter) {
          this.initializeCli();
        }

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
      promptLength: prompt.length,
      note: 'Model configured via ax-cli setup'
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
      model: options.model || '(from ax-cli setup)',
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
   *
   * BUG FIX (v11.3.3): Clean up SDK adapter if isAvailable() returns false.
   * Previously the adapter was just set to null without calling destroy(),
   * which could leak resources initialized in the constructor.
   */
  private async initializeSdk(required: boolean): Promise<boolean> {
    if (this.sdkAdapter) {
      return true;  // Already initialized
    }

    let adapter: AxCliSdkAdapter | null = null;

    try {
      adapter = new AxCliSdkAdapter(this.sdkOptions);

      const available = await adapter.isAvailable();

      if (!available) {
        // BUG FIX: Clean up adapter before discarding
        await adapter.destroy().catch((cleanupError) => {
          logger.warn('Error cleaning up unavailable SDK adapter', {
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
          });
        });

        if (required) {
          throw new Error(
            'ax-cli SDK not available. Install with: npm install @defai.digital/ax-cli'
          );
        }

        logger.warn('SDK not available', {
          hint: 'Install with: npm install @defai.digital/ax-cli'
        });

        return false;
      }

      // Success - assign to instance variable
      this.sdkAdapter = adapter;

      logger.info('SDK adapter initialized', {
        version: await this.sdkAdapter.getVersion()
      });

      return true;
    } catch (error) {
      // BUG FIX: Clean up adapter on any error
      if (adapter) {
        await adapter.destroy().catch((cleanupError) => {
          logger.warn('Error cleaning up SDK adapter after error', {
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
          });
        });
      }

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
   *
   * BUG FIX: Handle 'auto' mode correctly - return 'ax-cli-auto' to indicate
   * the actual command hasn't been determined yet (will be sdk or cli after initialization)
   */
  getCommand(): string {
    if (this.activeMode === 'sdk') {
      return 'ax-cli-sdk';
    } else if (this.activeMode === 'cli') {
      return 'ax-cli';
    }

    // Not initialized yet, return based on configured mode
    // BUG FIX: Return mode-specific command name for accurate logging/debugging
    if (this.mode === 'sdk') {
      return 'ax-cli-sdk';
    } else if (this.mode === 'cli') {
      return 'ax-cli';
    } else {
      // Auto mode: indicate pending selection
      return 'ax-cli-auto';
    }
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
   *
   * BUG FIX: Destroy SDK adapter when switching to CLI to prevent resource leaks
   * (memory, event listeners) from the unused SDK adapter.
   */
  async switchToCliMode(): Promise<void> {
    logger.info('Forcing switch to CLI mode');

    // BUG FIX: Clean up SDK adapter to free resources
    if (this.sdkAdapter) {
      try {
        await this.sdkAdapter.destroy();
      } catch (error) {
        logger.warn('Error destroying SDK adapter during mode switch', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
      this.sdkAdapter = null;
    }

    this.initializeCli();
    this.activeMode = 'cli';
  }

  /**
   * Get SDK adapter for advanced features (v10.4.0)
   *
   * Returns the underlying SDK adapter if available, otherwise null.
   * This allows access to SDK-specific features like:
   * - SubagentAdapter for parallel execution
   * - CheckpointAdapter for resumable workflows
   * - InstructionsBridge for unified instructions
   *
   * @returns SDK adapter or null if not available
   */
  getSdkAdapter(): AxCliSdkAdapter | null {
    return this.sdkAdapter;
  }

  /**
   * Cleanup resources
   * BUG FIX: Use Promise.allSettled to ensure cleanup completes even if SDK destroy fails
   */
  async destroy(): Promise<void> {
    const destroyPromises: Promise<void>[] = [];

    if (this.sdkAdapter) {
      destroyPromises.push(this.sdkAdapter.destroy());
    }

    // CLI adapter doesn't have cleanup (no persistent state)

    // BUG FIX: Use allSettled instead of all to ensure we always clean up references
    // even if SDK destroy fails
    const results = await Promise.allSettled(destroyPromises);

    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.warn('Adapter cleanup failed', {
          index,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason)
        });
      }
    });

    this.sdkAdapter = null;
    this.cliAdapter = null;
    this.activeMode = null;

    logger.info('Hybrid adapter destroyed');
  }
}
