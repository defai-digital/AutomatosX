/**
 * GLM Provider - SDK-First with CLI Fallback (v12.0.0)
 *
 * Provides access to Zhipu AI's GLM models with SDK-first execution
 * and automatic CLI fallback when SDK is unavailable.
 *
 * **SDK Mode:** Uses OpenAI-compatible API with Zhipu's endpoint (~5ms overhead)
 * **CLI Mode:** Uses ax-glm CLI (~50-200ms overhead)
 *
 * Supported models (v1.4.0):
 * - glm-4.6: 200K context, thinking mode
 * - glm-4.5v: 64K context, vision capability
 * - glm-4: 128K context (default)
 * - glm-4-flash: Fast, cost-effective
 *
 * @module providers/glm-provider
 */

import { BaseProvider } from './base-provider.js';
import type { ProviderConfig, ExecutionRequest, ExecutionResponse, ProviderCapabilities } from '../types/provider.js';
import { logger } from '../shared/logging/logger.js';
import { GLMHybridAdapter, type GLMHybridAdapterOptions, GLMSdkOnlyAdapter } from '../integrations/ax-glm/index.js';
import { isSDKFirstModeEnabled } from '../core/feature-flags/flags.js';
import type { AdapterMode } from './hybrid-adapter-base.js';

/**
 * Supported GLM models
 */
export type GLMModel =
  | 'glm-4.6'      // 200K context, thinking mode
  | 'glm-4.5v'     // 64K context, vision capability
  | 'glm-4'        // 128K context (default)
  | 'glm-4-flash'  // Fast, cost-effective
  // Legacy aliases (mapped to new names by ax-glm)
  | 'glm-4-plus'   // Maps to glm-4.6
  | 'glm-4v'       // Maps to glm-4.5v
  | 'glm-4-air'    // Maps to glm-4-flash
  | 'glm-4-airx';  // Maps to glm-4-flash

/**
 * GLM provider configuration
 */
export interface GLMProviderConfig extends Omit<ProviderConfig, 'sdk'> {
  /** Model to use (default: glm-4) */
  model?: GLMModel;
  /** Execution mode: 'sdk', 'cli', or 'auto' (default: 'auto') */
  mode?: AdapterMode;
  /** API key for SDK mode (defaults to ZAI_API_KEY env var) */
  apiKey?: string;
  /** Base URL for SDK mode */
  baseUrl?: string;
}

/**
 * Model mapping from legacy names to current names
 */
const MODEL_MAPPING: Record<string, string> = {
  'glm-4-plus': 'glm-4.6',
  'glm-4v': 'glm-4.5v',
  'glm-4-air': 'glm-4-flash',
  'glm-4-airx': 'glm-4-flash',
};

/**
 * GLM Provider - SDK-Only Execution (v13.0.0)
 *
 * Provides access to Zhipu AI's GLM models using SDK-only execution.
 * CLI fallback has been removed per PRD MCP Architecture Redesign.
 *
 * **Setup:**
 * ```bash
 * npm install openai  # Uses OpenAI-compatible API
 * export ZAI_API_KEY=your_api_key
 * ```
 *
 * **Usage:**
 * ```typescript
 * const provider = new GLMProvider({
 *   name: 'glm',
 *   enabled: true,
 *   priority: 5,
 *   timeout: 120000,
 *   model: 'glm-4.6',
 *   mode: 'sdk'  // SDK-only (default)
 * });
 * ```
 */
export class GLMProvider extends BaseProvider {
  /** Selected model */
  private readonly model: GLMModel;

  /** SDK-only adapter for direct execution (v13.0.0) */
  private sdkOnlyAdapter: GLMSdkOnlyAdapter | null = null;

  /** Legacy hybrid adapter for 'auto' mode (backwards compatibility) */
  private hybridAdapter: GLMHybridAdapter | null = null;

  /** Provider configuration */
  private readonly glmConfig: GLMProviderConfig;

  /** Supported models */
  static readonly SUPPORTED_MODELS: GLMModel[] = [
    'glm-4.6',
    'glm-4.5v',
    'glm-4',
    'glm-4-flash',
    // Legacy aliases
    'glm-4-plus',
    'glm-4v',
    'glm-4-air',
    'glm-4-airx'
  ];

  constructor(config: GLMProviderConfig) {
    // Ensure command is set to ax-glm
    super({
      ...config,
      command: 'ax-glm'
    } as ProviderConfig);

    this.glmConfig = config;

    // Validate model and fallback to default if unknown
    const requestedModel = config.model || 'glm-4';
    if (!GLMProvider.SUPPORTED_MODELS.includes(requestedModel)) {
      logger.warn(`[GLM] Unknown model: ${requestedModel}. Using glm-4.`);
      this.model = 'glm-4';
    } else {
      this.model = requestedModel;
    }

    logger.debug('[GLM Provider] Initialized', {
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
   * Get or create SDK-only adapter (v13.0.0 default)
   */
  private getSdkOnlyAdapter(): GLMSdkOnlyAdapter {
    if (!this.sdkOnlyAdapter) {
      this.sdkOnlyAdapter = new GLMSdkOnlyAdapter({
        model: this.model,
        apiKey: this.glmConfig.apiKey,
        baseUrl: this.glmConfig.baseUrl,
        timeout: this.glmConfig.timeout
      });
    }

    return this.sdkOnlyAdapter;
  }

  /**
   * Get or create hybrid adapter (legacy, for 'auto' mode only)
   */
  private getHybridAdapter(): GLMHybridAdapter {
    if (!this.hybridAdapter) {
      const options: GLMHybridAdapterOptions = {
        mode: this.glmConfig.mode || 'auto',
        model: this.model,
        apiKey: this.glmConfig.apiKey,
        baseUrl: this.glmConfig.baseUrl,
        command: 'ax-glm',
        timeout: this.glmConfig.timeout
      };

      this.hybridAdapter = new GLMHybridAdapter(options);
    }

    return this.hybridAdapter;
  }

  /**
   * Execute a task using GLM
   *
   * Execution flow (v13.0.0):
   * 1. Mock mode → return mock response
   * 2. mode='sdk' (default) → use SDK-only adapter (NO CLI fallback)
   * 3. mode='auto' (legacy) → use hybrid adapter (SDK with CLI fallback)
   * 4. mode='cli' → use CLI via BaseProvider (deprecated for GLM)
   */
  override async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    // Mock mode handling
    if (process.env.AX_MOCK_PROVIDERS === 'true') {
      return this.createMockResponse(request.prompt);
    }

    const effectiveMode = this.glmConfig.mode || 'sdk'; // Default to SDK-only

    // CLI mode (deprecated but supported for backwards compatibility)
    if (effectiveMode === 'cli') {
      logger.warn('[GLM Provider] CLI mode is deprecated for GLM. Consider using SDK mode.', {
        model: this.model
      });
      return super.execute(request);
    }

    // Auto mode (legacy hybrid with fallback)
    if (effectiveMode === 'auto') {
      logger.debug('[GLM Provider] Executing via hybrid adapter (legacy auto mode)', {
        promptLength: request.prompt.length,
        model: this.model
      });
      const adapter = this.getHybridAdapter();
      return adapter.execute(request);
    }

    // SDK mode (default - no CLI fallback)
    logger.debug('[GLM Provider] Executing via SDK-only adapter', {
      promptLength: request.prompt.length,
      model: this.model
    });

    const adapter = this.getSdkOnlyAdapter();
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
        return 'glm-sdk';  // Indicate SDK mode
      }
    }
    return 'ax-glm';
  }

  /**
   * Get CLI arguments for ax-glm headless mode
   */
  protected override getCLIArgs(): string[] {
    const args: string[] = ['-p'];  // Headless mode with -p flag

    // Add model selection if not default
    const normalizedModel = this.getNormalizedModel();
    if (normalizedModel !== 'glm-4') {
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
    return `[Mock GLM Response]

This is a mock response from the GLM provider (${this.getNormalizedModel()}).
In production, this would be a response from ${this.glmConfig.mode === 'sdk' ? 'GLM SDK' : 'ax-glm CLI'}.

Model: ${this.getNormalizedModel()}
Provider: GLM (Zhipu AI)
Mode: ${this.glmConfig.mode || 'auto'}`;
  }

  /**
   * Get provider capabilities
   */
  override get capabilities(): ProviderCapabilities {
    const model = this.getNormalizedModel();
    const isVision = model.includes('v') || model === 'glm-4.5v';

    // Context window varies by model
    let maxContextTokens = 128000;
    if (model === 'glm-4.6') maxContextTokens = 200000;
    if (model === 'glm-4.5v') maxContextTokens = 64000;

    // Determine integration mode
    const activeMode = this.hybridAdapter?.getActiveMode();
    const integrationMode = activeMode === 'sdk' ? 'sdk' : 'cli';

    return {
      ...super.capabilities,
      supportsStreaming: true,
      supportsVision: isVision,
      maxContextTokens,
      supportedModels: GLMProvider.SUPPORTED_MODELS,
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
    if (this.sdkOnlyAdapter) {
      await this.sdkOnlyAdapter.destroy();
      this.sdkOnlyAdapter = null;
    }
    if (this.hybridAdapter) {
      await this.hybridAdapter.destroy();
      this.hybridAdapter = null;
    }
  }

  /**
   * Get the list of supported models
   */
  static getSupportedModels(): GLMModel[] {
    return [...GLMProvider.SUPPORTED_MODELS];
  }
}

// Export for convenience
export { GLMProvider as default };
