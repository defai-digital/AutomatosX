/**
 * Grok Provider - SDK-First with CLI Fallback (v12.0.0)
 *
 * Provides access to xAI's Grok models with SDK-first execution
 * and automatic CLI fallback when SDK is unavailable.
 *
 * **SDK Mode:** Uses OpenAI-compatible API with xAI's endpoint (~5ms overhead)
 * **CLI Mode:** Uses ax-grok CLI (~50-200ms overhead)
 *
 * Supported models (v1.4.0):
 * - grok-3: 131K context, reasoning effort (extended thinking)
 * - grok-3-mini: Fast, cost-effective
 * - grok-2-vision: Image understanding
 * - grok-2: Live web search
 *
 * @module providers/grok-provider
 */

import { BaseProvider } from './base-provider.js';
import type { ProviderConfig, ExecutionRequest, ExecutionResponse, ProviderCapabilities } from '../types/provider.js';
import { logger } from '../shared/logging/logger.js';
import { GrokHybridAdapter, type GrokHybridAdapterOptions } from '../integrations/ax-grok/index.js';
import { isSDKFirstModeEnabled } from '../core/feature-flags/flags.js';
import type { AdapterMode } from './hybrid-adapter-base.js';

/**
 * Supported Grok models
 */
export type GrokModel =
  | 'grok-3'         // 131K context, reasoning effort (extended thinking)
  | 'grok-3-mini'    // Fast, cost-effective
  | 'grok-2-vision'  // Image understanding
  | 'grok-2'         // Live web search
  // Legacy alias
  | 'grok-beta';     // Maps to grok-3

/**
 * Grok provider configuration
 */
export interface GrokProviderConfig extends Omit<ProviderConfig, 'sdk'> {
  /** Model to use (default: grok-3) */
  model?: GrokModel;
  /** Execution mode: 'sdk', 'cli', or 'auto' (default: 'auto') */
  mode?: AdapterMode;
  /** API key for SDK mode (defaults to XAI_API_KEY env var) */
  apiKey?: string;
  /** Base URL for SDK mode */
  baseUrl?: string;
}

/**
 * Model mapping from legacy names to current names
 */
const MODEL_MAPPING: Record<string, string> = {
  'grok-beta': 'grok-3',
};

/**
 * Grok Provider - SDK-First with CLI Fallback
 *
 * Provides access to xAI's Grok models with automatic mode selection.
 *
 * **Setup:**
 * ```bash
 * # For SDK mode (recommended)
 * npm install openai  # Uses OpenAI-compatible API
 * export XAI_API_KEY=your_api_key
 *
 * # For CLI mode (fallback)
 * npm install -g @defai.digital/ax-grok
 * export XAI_API_KEY=your_api_key
 * ```
 *
 * **Usage:**
 * ```typescript
 * const provider = new GrokProvider({
 *   name: 'grok',
 *   enabled: true,
 *   priority: 5,
 *   timeout: 120000,
 *   model: 'grok-3',
 *   mode: 'auto'  // SDK-first with CLI fallback
 * });
 * ```
 */
export class GrokProvider extends BaseProvider {
  /** Selected model */
  private readonly model: GrokModel;

  /** Hybrid adapter for SDK/CLI execution */
  private hybridAdapter: GrokHybridAdapter | null = null;

  /** Provider configuration */
  private readonly grokConfig: GrokProviderConfig;

  /** Supported models */
  static readonly SUPPORTED_MODELS: GrokModel[] = [
    'grok-3',
    'grok-3-mini',
    'grok-2-vision',
    'grok-2',
    // Legacy alias
    'grok-beta'
  ];

  constructor(config: GrokProviderConfig) {
    // Ensure command is set to ax-grok
    super({
      ...config,
      command: 'ax-grok'
    } as ProviderConfig);

    this.grokConfig = config;

    // Validate model and fallback to default if unknown
    const requestedModel = config.model || 'grok-3';
    if (!GrokProvider.SUPPORTED_MODELS.includes(requestedModel)) {
      logger.warn(`[Grok] Unknown model: ${requestedModel}. Using grok-3.`);
      this.model = 'grok-3';
    } else {
      this.model = requestedModel;
    }

    logger.debug('[Grok Provider] Initialized', {
      model: this.model,
      mode: config.mode || 'auto'
    });
  }

  /**
   * Get the normalized model name
   */
  private getNormalizedModel(): string {
    return MODEL_MAPPING[this.model] || this.model;
  }

  /**
   * Get or create hybrid adapter
   */
  private getHybridAdapter(): GrokHybridAdapter {
    if (!this.hybridAdapter) {
      const options: GrokHybridAdapterOptions = {
        mode: this.grokConfig.mode || 'auto',
        model: this.model,
        apiKey: this.grokConfig.apiKey,
        baseUrl: this.grokConfig.baseUrl,
        command: 'ax-grok',
        timeout: this.grokConfig.timeout
      };

      this.hybridAdapter = new GrokHybridAdapter(options);
    }

    return this.hybridAdapter;
  }

  /**
   * Execute a task using Grok
   *
   * Execution flow:
   * 1. Mock mode → return mock response
   * 2. SDK-first disabled → use CLI via BaseProvider
   * 3. SDK-first enabled → use hybrid adapter (SDK with CLI fallback)
   */
  override async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    // Mock mode handling
    if (process.env.AX_MOCK_PROVIDERS === 'true') {
      return this.createMockResponse(request.prompt);
    }

    // Check if SDK-first mode is enabled
    if (!isSDKFirstModeEnabled() && this.grokConfig.mode !== 'sdk') {
      logger.debug('[Grok Provider] SDK-first disabled, using CLI', {
        model: this.model
      });
      return super.execute(request);
    }

    logger.debug('[Grok Provider] Executing via hybrid adapter', {
      promptLength: request.prompt.length,
      model: this.model,
      mode: this.grokConfig.mode || 'auto'
    });

    // Use hybrid adapter for SDK-first execution
    const adapter = this.getHybridAdapter();
    return adapter.execute(request);
  }

  /**
   * Get CLI command
   */
  override getCLICommand(): string {
    const adapter = this.hybridAdapter;
    if (adapter) {
      const activeMode = adapter.getActiveMode();
      if (activeMode === 'sdk') {
        return 'grok-sdk';  // Indicate SDK mode
      }
    }
    return 'ax-grok';
  }

  /**
   * Get CLI arguments for ax-grok headless mode
   */
  protected override getCLIArgs(): string[] {
    const args: string[] = ['-p'];  // Headless mode with -p flag

    // Add model selection if not default
    const normalizedModel = this.getNormalizedModel();
    if (normalizedModel !== 'grok-3') {
      args.push('--model', normalizedModel);
    }

    return args;
  }

  /**
   * Create mock response for testing
   */
  private createMockResponse(prompt: string): ExecutionResponse {
    return {
      content: this.getMockResponse(),
      model: this.getNormalizedModel(),
      tokensUsed: {
        prompt: this.estimateTokens(prompt),
        completion: 50,
        total: this.estimateTokens(prompt) + 50
      },
      latencyMs: 10,
      finishReason: 'stop',
      cached: false
    };
  }

  /**
   * Estimate token count
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Get mock response for testing
   */
  protected getMockResponse(): string {
    return `[Mock Grok Response]

This is a mock response from the Grok provider (${this.getNormalizedModel()}).
In production, this would be a response from ${this.grokConfig.mode === 'sdk' ? 'Grok SDK' : 'ax-grok CLI'}.

Model: ${this.getNormalizedModel()}
Provider: Grok (xAI)
Mode: ${this.grokConfig.mode || 'auto'}`;
  }

  /**
   * Get provider capabilities
   */
  override get capabilities(): ProviderCapabilities {
    const model = this.getNormalizedModel();
    const isVision = model.includes('vision') || model === 'grok-2-vision';

    // Context window (131K for grok-3)
    const maxContextTokens = 131072;

    // Determine integration mode
    const activeMode = this.hybridAdapter?.getActiveMode();
    const integrationMode = activeMode === 'sdk' ? 'sdk' : 'cli';

    return {
      ...super.capabilities,
      supportsStreaming: true,
      supportsVision: isVision,
      maxContextTokens,
      supportedModels: GrokProvider.SUPPORTED_MODELS,
      integrationMode,
    };
  }

  /**
   * Get the active execution mode
   */
  getActiveMode(): 'sdk' | 'cli' | null {
    return this.hybridAdapter?.getActiveMode() || null;
  }

  /**
   * Reset circuit breakers
   */
  resetCircuitBreakers(): void {
    this.hybridAdapter?.resetCircuitBreakers();
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    if (this.hybridAdapter) {
      await this.hybridAdapter.destroy();
      this.hybridAdapter = null;
    }
  }

  /**
   * Get the list of supported models
   */
  static getSupportedModels(): GrokModel[] {
    return [...GrokProvider.SUPPORTED_MODELS];
  }
}

// Export for convenience
export { GrokProvider as default };
