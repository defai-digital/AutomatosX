/**
 * Qwen Provider - SDK-First with CLI Fallback (v12.7.0)
 *
 * Provides access to Alibaba's Qwen models with SDK-first execution
 * and automatic CLI fallback when SDK is unavailable.
 *
 * **SDK Mode:** Uses OpenAI-compatible API with DashScope endpoint (~5ms overhead)
 * **CLI Mode:** Uses Qwen Code CLI (~50-200ms overhead)
 *
 * Supported models:
 * - qwen3-coder-480b-a35b-instruct: 128K context, flagship coder model
 * - qwen3-coder-30b-a3b-instruct: 64K context, smaller coder model
 * - qwen-turbo: Fast, cost-effective (default)
 * - qwen-plus: Balanced performance
 * - qwen-max: Maximum capability
 *
 * @module providers/qwen-provider
 */

import { BaseProvider } from './base-provider.js';
import type { ProviderConfig, ExecutionRequest, ExecutionResponse, ProviderCapabilities } from '../types/provider.js';
import { logger } from '../shared/logging/logger.js';
import {
  QwenHybridAdapter,
  type QwenHybridAdapterOptions,
  QwenSdkAdapter,
  type QwenModel,
  QWEN_DEFAULT_MODEL,
  normalizeQwenModel,
  isVisionModel,
  getModelContextWindow
} from '../integrations/qwen-code/index.js';
import type { AdapterMode } from './hybrid-adapter-base.js';

/**
 * Qwen provider configuration
 */
export interface QwenProviderConfig extends Omit<ProviderConfig, 'sdk'> {
  /** Model to use (default: qwen-turbo) */
  model?: QwenModel;
  /** Execution mode: 'sdk', 'cli', or 'auto' (default: 'sdk') */
  mode?: AdapterMode;
  /** API key for SDK mode (defaults to DASHSCOPE_API_KEY or QWEN_API_KEY env var) */
  apiKey?: string;
  /** Base URL for SDK mode */
  baseUrl?: string;
}

/**
 * Supported Qwen models
 */
const SUPPORTED_MODELS: QwenModel[] = [
  'qwen3-coder-480b-a35b-instruct',
  'qwen3-coder-30b-a3b-instruct',
  'qwen2.5-coder-32b-instruct',
  'qwen-max',
  'qwen-plus',
  'qwen-turbo'
];

/**
 * Qwen Provider - SDK-First Execution (v12.7.0)
 *
 * Provides access to Alibaba's Qwen models using SDK-first execution.
 * Falls back to CLI when SDK is unavailable (in 'auto' mode).
 *
 * **Setup:**
 * ```bash
 * # Option 1: SDK mode (recommended)
 * export DASHSCOPE_API_KEY=your_api_key
 *
 * # Option 2: CLI mode
 * npm install -g @qwen-code/qwen-code@latest
 * qwen  # First run will prompt for OAuth login
 * ```
 *
 * **Usage:**
 * ```typescript
 * const provider = new QwenProvider({
 *   name: 'qwen',
 *   enabled: true,
 *   priority: 4,
 *   timeout: 120000,
 *   model: 'qwen-turbo',
 *   mode: 'sdk'  // SDK-first (default)
 * });
 * ```
 */
export class QwenProvider extends BaseProvider {
  /** Selected model */
  private readonly model: QwenModel;

  /** SDK adapter for direct execution */
  private sdkAdapter: QwenSdkAdapter | null = null;

  /** Hybrid adapter for 'auto' mode */
  private hybridAdapter: QwenHybridAdapter | null = null;

  /** Provider configuration */
  private readonly qwenConfig: QwenProviderConfig;

  /** Supported models */
  static readonly SUPPORTED_MODELS: QwenModel[] = SUPPORTED_MODELS;

  constructor(config: QwenProviderConfig) {
    // Ensure command is set to qwen
    super({
      ...config,
      command: 'qwen'
    } as ProviderConfig);

    this.qwenConfig = config;

    // Validate model and fallback to default if unknown
    const requestedModel = config.model || QWEN_DEFAULT_MODEL;
    if (!SUPPORTED_MODELS.includes(requestedModel)) {
      logger.warn(`[Qwen] Unknown model: ${requestedModel}. Using ${QWEN_DEFAULT_MODEL}.`);
      this.model = QWEN_DEFAULT_MODEL;
    } else {
      this.model = requestedModel;
    }

    logger.debug('[Qwen Provider] Initialized', {
      model: this.model,
      mode: config.mode || 'sdk'
    });
  }

  /**
   * Get the normalized model name
   */
  private getNormalizedModel(): string {
    return normalizeQwenModel(this.model);
  }

  /**
   * Get or create SDK adapter
   */
  private getSdkAdapter(): QwenSdkAdapter {
    if (!this.sdkAdapter) {
      this.sdkAdapter = new QwenSdkAdapter({
        model: this.model,
        apiKey: this.qwenConfig.apiKey,
        baseUrl: this.qwenConfig.baseUrl,
        timeout: this.qwenConfig.timeout
      });
    }
    return this.sdkAdapter;
  }

  /**
   * Get or create hybrid adapter
   */
  private getHybridAdapter(): QwenHybridAdapter {
    if (!this.hybridAdapter) {
      const options: QwenHybridAdapterOptions = {
        mode: this.qwenConfig.mode || 'auto',
        model: this.model,
        apiKey: this.qwenConfig.apiKey,
        baseUrl: this.qwenConfig.baseUrl,
        command: 'qwen',
        timeout: this.qwenConfig.timeout
      };
      this.hybridAdapter = new QwenHybridAdapter(options);
    }
    return this.hybridAdapter;
  }

  /**
   * Execute a task using Qwen
   *
   * Execution flow:
   * 1. Mock mode → return mock response
   * 2. mode='sdk' (default) → use SDK adapter
   * 3. mode='auto' → use hybrid adapter (SDK with CLI fallback)
   * 4. mode='cli' → use CLI via BaseProvider
   */
  override async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    // Mock mode handling
    if (process.env.AX_MOCK_PROVIDERS === 'true') {
      return this.createMockResponse(request.prompt);
    }

    const effectiveMode = this.qwenConfig.mode || 'sdk'; // Default to SDK

    // CLI mode (deprecated but supported)
    if (effectiveMode === 'cli') {
      logger.debug('[Qwen Provider] Executing via CLI', {
        model: this.model
      });
      return super.execute(request);
    }

    // Auto mode (hybrid with fallback)
    if (effectiveMode === 'auto') {
      logger.debug('[Qwen Provider] Executing via hybrid adapter', {
        promptLength: request.prompt.length,
        model: this.model
      });
      const adapter = this.getHybridAdapter();
      return adapter.execute(request);
    }

    // SDK mode (default)
    logger.debug('[Qwen Provider] Executing via SDK adapter', {
      promptLength: request.prompt.length,
      model: this.model
    });

    const adapter = this.getSdkAdapter();

    // Check availability
    if (!await adapter.isAvailable()) {
      throw new Error(
        'Qwen SDK is not available. Set DASHSCOPE_API_KEY or QWEN_API_KEY environment variable, ' +
        'or use mode: "cli" to use Qwen Code CLI.'
      );
    }

    return adapter.execute(request);
  }

  /**
   * Get CLI command
   */
  protected override getCLICommand(): string {
    const activeMode = this.hybridAdapter?.getActiveMode();
    if (activeMode === 'sdk') {
      return 'qwen-sdk';  // Indicate SDK mode
    }
    return 'qwen';
  }

  /**
   * Get CLI arguments for Qwen Code CLI
   *
   * Note: Qwen Code CLI is interactive by default.
   * We pass the prompt via stdin instead of command-line args.
   */
  protected override getCLIArgs(): string[] {
    // Qwen CLI doesn't have a non-interactive print mode like Claude
    // We handle this in the CLI wrapper by writing to stdin
    return [];
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
    return `[Mock Qwen Response]

This is a mock response from the Qwen provider (${this.getNormalizedModel()}).
In production, this would be a response from ${this.qwenConfig.mode === 'sdk' ? 'Qwen SDK' : 'Qwen Code CLI'}.

Model: ${this.getNormalizedModel()}
Provider: Qwen (Alibaba Cloud)
Mode: ${this.qwenConfig.mode || 'sdk'}`;
  }

  /**
   * Get provider capabilities
   */
  override get capabilities(): ProviderCapabilities {
    const model = this.getNormalizedModel();
    const hasVision = isVisionModel(model);
    const maxContextTokens = getModelContextWindow(model);

    // Determine integration mode
    const activeMode = this.hybridAdapter?.getActiveMode();
    const integrationMode = activeMode === 'sdk' ? 'sdk' : 'cli';

    return {
      ...super.capabilities,
      supportsStreaming: true,
      supportsVision: hasVision,
      maxContextTokens,
      supportedModels: SUPPORTED_MODELS,
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
    if (this.sdkAdapter) {
      await this.sdkAdapter.destroy();
      this.sdkAdapter = null;
    }
    if (this.hybridAdapter) {
      await this.hybridAdapter.destroy();
      this.hybridAdapter = null;
    }
  }

  /**
   * Get the list of supported models
   */
  static getSupportedModels(): QwenModel[] {
    return [...SUPPORTED_MODELS];
  }
}

// Export for convenience
export { QwenProvider as default };
