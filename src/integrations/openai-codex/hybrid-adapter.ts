/**
 * HybridCodexAdapter - SDK-first with CLI fallback
 *
 * Modes:
 * - "sdk": SDK only (throws if unavailable)
 * - "cli": CLI only
 * - "auto": SDK first, fallback to CLI
 *
 * @module integrations/openai-codex/hybrid-adapter
 */

import { logger } from '../../shared/logging/logger.js';
import type { CodexConfig, CodexExecutionResult } from './types.js';
import { CodexCLI } from './cli-wrapper.js';
import { CodexSdkAdapter, type CodexSdkOptions } from './sdk-adapter.js';

export type CodexAdapterMode = 'sdk' | 'cli' | 'auto';

export interface HybridCodexAdapterOptions {
  mode?: CodexAdapterMode;
  cli?: CodexConfig;
  sdk?: CodexSdkOptions;
}

export class HybridCodexAdapter {
  private mode: CodexAdapterMode;
  private activeMode: 'sdk' | 'cli' | null = null;
  private sdkAdapter: CodexSdkAdapter | null = null;
  private cliAdapter: CodexCLI | null = null;
  private readonly cliConfig: CodexConfig;
  private readonly sdkOptions: CodexSdkOptions;

  constructor(options: HybridCodexAdapterOptions = {}) {
    this.mode = options.mode || 'auto';
    this.cliConfig = options.cli || {
      command: 'codex',
      sandboxMode: 'workspace-write',
      timeout: 120000,
    };
    this.sdkOptions = options.sdk || {};

    logger.debug('HybridCodexAdapter initialized', { mode: this.mode });
  }

  async execute(prompt: string, timeout?: number): Promise<CodexExecutionResult> {
    await this.ensureAdapters();

    try {
      if (this.activeMode === 'sdk' && this.sdkAdapter) {
        return await this.sdkAdapter.execute(prompt, timeout);
      } else if (this.activeMode === 'cli' && this.cliAdapter) {
        return await this.cliAdapter.execute({ prompt, timeout });
      }
      throw new Error(`No adapter available for mode: ${this.mode}`);
    } catch (error) {
      // Auto mode: fallback to CLI if SDK fails
      if (this.mode === 'auto' && this.activeMode === 'sdk') {
        logger.warn('SDK failed, falling back to CLI', {
          error: error instanceof Error ? error.message : String(error),
        });

        if (!this.cliAdapter) {
          this.cliAdapter = new CodexCLI(this.cliConfig);
        }
        this.activeMode = 'cli';

        return await this.cliAdapter.execute({ prompt, timeout });
      }
      throw error;
    }
  }

  private async ensureAdapters(): Promise<void> {
    if (this.activeMode !== null) return;

    if (this.mode === 'sdk') {
      await this.initializeSdk(true);
      this.activeMode = 'sdk';
      return;
    }

    if (this.mode === 'cli') {
      this.cliAdapter = new CodexCLI(this.cliConfig);
      this.activeMode = 'cli';
      return;
    }

    // Auto mode: try SDK first
    const sdkAvailable = await this.initializeSdk(false);
    if (sdkAvailable) {
      this.activeMode = 'sdk';
      logger.info('Using Codex SDK mode');
    } else {
      this.cliAdapter = new CodexCLI(this.cliConfig);
      this.activeMode = 'cli';
      logger.info('Using Codex CLI mode (SDK not available)');
    }
  }

  private async initializeSdk(required: boolean): Promise<boolean> {
    try {
      this.sdkAdapter = new CodexSdkAdapter(this.sdkOptions);
      const available = await this.sdkAdapter.isAvailable();

      if (!available) {
        this.sdkAdapter = null;
        if (required) {
          throw new Error('Codex SDK not available');
        }
        return false;
      }
      return true;
    } catch (error) {
      this.sdkAdapter = null;
      if (required) throw error;
      return false;
    }
  }

  async isAvailable(): Promise<boolean> {
    await this.ensureAdapters();
    if (this.activeMode === 'sdk' && this.sdkAdapter) {
      return await this.sdkAdapter.isAvailable();
    } else if (this.activeMode === 'cli' && this.cliAdapter) {
      return await this.cliAdapter.isAvailable();
    }
    return false;
  }

  async getVersion(): Promise<string> {
    await this.ensureAdapters();
    if (this.activeMode === 'sdk' && this.sdkAdapter) {
      return await this.sdkAdapter.getVersion();
    } else if (this.activeMode === 'cli' && this.cliAdapter) {
      return await this.cliAdapter.getVersion();
    }
    return 'unknown';
  }

  getActiveMode(): 'sdk' | 'cli' | null {
    return this.activeMode;
  }

  switchToCliMode(): void {
    if (!this.cliAdapter) {
      this.cliAdapter = new CodexCLI(this.cliConfig);
    }
    this.activeMode = 'cli';
  }

  /**
   * Cleanup resources
   *
   * BUG FIX: Use Promise.allSettled to ensure cleanup continues even if one
   * adapter fails, and properly log any cleanup errors. Previously, a failure
   * in SDK destroy would prevent CLI cleanup from running.
   */
  async destroy(): Promise<void> {
    const cleanupPromises: Promise<void>[] = [];

    if (this.sdkAdapter) {
      cleanupPromises.push(
        this.sdkAdapter.destroy().catch(err => {
          logger.warn('Error destroying SDK adapter', {
            error: err instanceof Error ? err.message : String(err)
          });
        })
      );
    }

    if (this.cliAdapter) {
      cleanupPromises.push(
        this.cliAdapter.cleanup().catch(err => {
          logger.warn('Error cleaning up CLI adapter', {
            error: err instanceof Error ? err.message : String(err)
          });
        })
      );
    }

    // Wait for all cleanup to complete
    await Promise.allSettled(cleanupPromises);

    this.sdkAdapter = null;
    this.cliAdapter = null;
    this.activeMode = null;

    logger.debug('HybridCodexAdapter destroyed');
  }
}
