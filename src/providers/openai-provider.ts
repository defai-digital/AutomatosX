/**
 * OpenAIProvider - Hybrid Codex Provider (v11.1.0)
 *
 * Uses SDK as primary mode with CLI fallback:
 * - "sdk": SDK only
 * - "cli": CLI only
 * - "auto" (default): SDK first, CLI fallback
 *
 * Note: The SDK wraps the CLI binary, so latency is similar.
 * SDK provides better TypeScript types and thread management.
 */

import { BaseProvider } from './base-provider.js';
import type { ProviderConfig, ExecutionRequest, ExecutionResponse } from '../types/provider.js';
import { logger } from '../shared/logging/logger.js';
import {
  HybridCodexAdapter,
  type CodexAdapterMode,
  type HybridCodexAdapterOptions,
} from '../integrations/openai-codex/hybrid-adapter.js';
import type { CodexSdkOptions } from '../integrations/openai-codex/sdk-adapter.js';

export interface OpenAIProviderConfig extends ProviderConfig {
  mode?: CodexAdapterMode;
  codexSdk?: CodexSdkOptions;
}

export class OpenAIProvider extends BaseProvider {
  private hybridAdapter: HybridCodexAdapter | null = null;
  private readonly providerConfig: OpenAIProviderConfig;
  /** BUG FIX: Track pending initialization to prevent race condition where
   * concurrent execute() calls could each trigger initializeHybridAdapter() */
  private initializationPromise: Promise<void> | null = null;
  /** BUG FIX: Track destroyed state to prevent use-after-destroy race condition */
  private isDestroyed = false;

  constructor(config: OpenAIProviderConfig) {
    super(config);
    this.providerConfig = config;
    logger.debug('[OpenAI/Codex] Initialized', { mode: config.mode || 'auto' });
  }

  override async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    // BUG FIX: Check if provider has been destroyed to prevent use-after-destroy
    if (this.isDestroyed) {
      throw new Error('OpenAIProvider has been destroyed and cannot execute requests');
    }

    // Mock mode for tests
    if (process.env.AX_MOCK_PROVIDERS === 'true') {
      return {
        content: this.getMockResponse(),
        model: 'codex',
        tokensUsed: { prompt: 10, completion: 20, total: 30 },
        latencyMs: 100,
        finishReason: 'stop',
      };
    }

    const startTime = Date.now();

    // Initialize hybrid adapter on first use
    // BUG FIX: Use ensureInitialized() to prevent race condition where
    // concurrent execute() calls could each trigger adapter initialization
    await this.ensureInitialized();

    try {
      const result = await this.hybridAdapter!.execute(
        request.prompt,
        this.config.timeout
      );

      return {
        content: result.content,
        model: 'codex',
        tokensUsed: {
          prompt: result.tokenCount ? Math.floor(result.tokenCount * 0.3) : 0,
          completion: result.tokenCount ? Math.floor(result.tokenCount * 0.7) : 0,
          total: result.tokenCount || 0,
        },
        latencyMs: Date.now() - startTime,
        finishReason: 'stop',
      };
    } catch (error) {
      logger.error('[OpenAI/Codex] Execution failed', {
        error: error instanceof Error ? error.message : String(error),
        mode: this.hybridAdapter?.getActiveMode() || 'unknown',
      });
      // BUG FIX: Use handleError() for proper error categorization (rate limit, timeout, etc.)
      // and health status updates. Previously just re-threw the raw error which bypassed
      // error normalization and health tracking.
      throw this.handleError(error);
    }
  }

  /**
   * BUG FIX: Ensure adapter is initialized exactly once, even with concurrent calls.
   * Uses a promise-based lock pattern to prevent race conditions where multiple
   * execute() calls could each trigger initializeHybridAdapter().
   */
  private async ensureInitialized(): Promise<void> {
    // Fast path: already initialized
    if (this.hybridAdapter) {
      return;
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    // Start initialization and track the promise
    this.initializationPromise = this.initializeHybridAdapter();
    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }

  private async initializeHybridAdapter(): Promise<void> {
    // Double-check in case another caller completed initialization
    if (this.hybridAdapter) {
      return;
    }

    const options: HybridCodexAdapterOptions = {
      mode: this.providerConfig.mode || 'auto',
      cli: {
        command: 'codex',
        sandboxMode: 'workspace-write',
        timeout: this.config.timeout || 120000,
      },
      sdk: this.providerConfig.codexSdk,
    };

    this.hybridAdapter = new HybridCodexAdapter(options);
    logger.info('[OpenAI/Codex] Hybrid adapter initialized', { mode: options.mode });
  }

  protected getCLICommand(): string {
    return 'codex';
  }

  protected override getCLIArgs(): string[] {
    return ['--json'];
  }

  protected getMockResponse(): string {
    return '[Mock OpenAI/Codex Response]\n\nThis is a mock response for testing purposes.';
  }

  override get capabilities(): {
    supportsStreaming: boolean;
    supportsEmbedding: boolean;
    supportsVision: boolean;
    maxContextTokens: number;
    supportedModels: string[];
  } {
    return {
      supportsStreaming: true,
      supportsEmbedding: false,
      supportsVision: true,
      maxContextTokens: 128000,
      supportedModels: ['codex'],
    };
  }

  getActiveMode(): 'sdk' | 'cli' | null {
    return this.hybridAdapter?.getActiveMode() || null;
  }

  switchToCliMode(): void {
    this.hybridAdapter?.switchToCliMode();
  }

  async destroy(): Promise<void> {
    // BUG FIX: Set destroyed flag first to prevent race condition with execute()
    this.isDestroyed = true;

    if (this.hybridAdapter) {
      await this.hybridAdapter.destroy();
      this.hybridAdapter = null;
    }
  }
}
