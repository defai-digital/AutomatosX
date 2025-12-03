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
import { logger } from '../utils/logger.js';
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

  constructor(config: OpenAIProviderConfig) {
    super(config);
    this.providerConfig = config;
    logger.debug('[OpenAI/Codex] Initialized', { mode: config.mode || 'auto' });
  }

  override async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
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
    if (!this.hybridAdapter) {
      this.initializeHybridAdapter();
    }

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
      throw error;
    }
  }

  private initializeHybridAdapter(): void {
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
    if (this.hybridAdapter) {
      await this.hybridAdapter.destroy();
      this.hybridAdapter = null;
    }
  }
}
