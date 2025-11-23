/**
 * AxCliProvider - Provider-Agnostic AI Access via ax-cli (v9.2.0+)
 *
 * Provides access to AI models through ax-cli SDK, which supports multiple providers.
 * The actual provider (GLM, Grok, OpenAI, DeepSeek, etc.) is configured via `ax-cli setup`
 * and stored in ~/.ax-cli/config.json.
 *
 * AutomatosX is provider-agnostic and does not need to know which provider ax-cli uses.
 *
 * @module providers/ax-cli-provider
 */

import { BaseProvider } from './base-provider.js';
import type { ProviderConfig, ExecutionRequest, ExecutionResponse } from '../types/provider.js';
import { HybridAxCliAdapter, type AdapterMode } from '../integrations/ax-cli-sdk/hybrid-adapter.js';
import type { AxCliOptions } from '../integrations/ax-cli/interface.js';
import { logger } from '../utils/logger.js';

/**
 * Extended provider config for ax-cli
 */
export interface AxCliProviderConfig extends ProviderConfig {
  /** Execution mode: "sdk", "cli", or "auto" (default: "auto") */
  mode?: AdapterMode;

  /** ax-cli specific configuration */
  axCli?: {
    /**
     * Provider name (optional, deprecated)
     *
     * @deprecated Configure provider via `ax-cli setup` instead.
     * The provider is stored in ~/.ax-cli/config.json and managed by ax-cli SDK.
     */
    provider?: string;
    /** Model name (optional override) */
    model?: string;
    /** Config file path (default: ~/.ax-cli/config.json) */
    configPath?: string;
    /** Max tool execution rounds */
    maxToolRounds?: number;
    /** API key override (optional) */
    apiKey?: string;
    /** Base URL override (optional) */
    baseUrl?: string;
  };

  /** ax-cli SDK-specific configuration (only used when mode="sdk" or "auto") */
  axCliSdk?: {
    /** Enable streaming events */
    streamingEnabled?: boolean;
    /** Reuse agent instances between calls */
    reuseEnabled?: boolean;
  };
}

/**
 * AxCli Provider - Provider-Agnostic AI Access
 *
 * Provider-agnostic interface to AI models via ax-cli SDK.
 *
 * **Configuration**:
 * The provider and model are configured via `ax-cli setup` command, which stores
 * settings in ~/.ax-cli/config.json. AutomatosX does not need to know which
 * provider ax-cli uses (GLM, Grok, OpenAI, DeepSeek, Llama, etc.).
 *
 * **Setup**:
 * ```bash
 * ax-cli setup  # Configure provider, model, API key, base URL
 * ```
 *
 * **Features**:
 * - Provider-agnostic (ax-cli handles provider routing)
 * - Automatic provider detection from ax-cli setup
 * - Full ax-cli SDK feature support
 * - No hardcoded provider references
 */
export class AxCliProvider extends BaseProvider {
  private adapter: HybridAxCliAdapter;
  protected override config: AxCliProviderConfig;

  constructor(config: AxCliProviderConfig) {
    super(config);
    this.config = config;

    // Initialize hybrid adapter with mode selection
    const mode = config.mode || 'auto';  // Default to auto mode
    this.adapter = new HybridAxCliAdapter({
      mode,
      sdk: config.axCliSdk
    });

    logger.info('AxCliProvider initialized', {
      mode,
      model: config.axCli?.model || '(from ax-cli setup)',
      sdkOptions: config.axCliSdk,
      note: 'Provider configured via ax-cli setup'
    });
  }

  /**
   * Execute a task using ax-cli
   *
   * @param request - Execution request with prompt and options
   * @returns Execution response with content and metadata
   * @throws ProviderError if execution fails
   */
  override async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    const axCliConfig = this.config.axCli || {};

    // Build execution options (provider is configured via ax-cli setup)
    const options: AxCliOptions = {
      model: request.model || axCliConfig.model,  // Optional model override
      maxToolRounds: axCliConfig.maxToolRounds || 400,
      timeout: this.config.timeout,
      // Note: apiKey and baseUrl are ignored by SDK adapter (v3.7.0+)
      // SDK loads credentials from ax-cli setup (~/.ax-cli/config.json)
      apiKey: axCliConfig.apiKey,      // Only used by CLI adapter (deprecated)
      baseUrl: axCliConfig.baseUrl     // Only used by CLI adapter (deprecated)
    };

    logger.debug('Executing task via ax-cli', {
      model: options.model || '(from ax-cli setup)',
      promptLength: request.prompt.length,
      note: 'Provider configured via ax-cli setup'
    });

    try {
      const response = await this.adapter.execute(request.prompt, options);

      logger.info('Task executed successfully', {
        model: response.model,
        contentLength: response.content.length,
        tokensUsed: response.tokensUsed,
        latencyMs: response.latencyMs
      });

      return response;
    } catch (error) {
      logger.error('Task execution failed', {
        error: error instanceof Error ? error.message : String(error),
        model: options.model || '(from ax-cli setup)'
      });

      throw error;
    }
  }

  /**
   * Check if ax-cli is available
   *
   * @returns True if ax-cli is installed and accessible
   */
  override async isAvailable(): Promise<boolean> {
    try {
      const available = await this.adapter.isAvailable();

      if (!available) {
        logger.warn('ax-cli is not available', {
          provider: this.name,
          command: this.adapter.getCommand()
        });
      }

      return available;
    } catch (error) {
      logger.error('Failed to check ax-cli availability', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Get CLI version
   *
   * @returns Version string or "unknown"
   */
  async getVersion(): Promise<string> {
    try {
      return await this.adapter.getVersion();
    } catch (error) {
      logger.warn('Failed to get ax-cli version', {
        error: error instanceof Error ? error.message : String(error)
      });
      return 'unknown';
    }
  }

  /**
   * Get CLI command (or "ax-cli-sdk" if using SDK mode)
   *
   * @returns Command name ("ax-cli" or "ax-cli-sdk")
   */
  public getCLICommand(): string {
    return this.adapter.getCommand();
  }

  /**
   * Get active execution mode
   *
   * @returns Active mode ("sdk" or "cli") or null if not initialized
   */
  public getActiveMode(): 'sdk' | 'cli' | null {
    return this.adapter.getActiveMode();
  }

  /**
   * Force switch to CLI mode (for debugging or fallback)
   */
  public switchToCliMode(): void {
    this.adapter.switchToCliMode();
  }

  /**
   * Get mock response for testing
   *
   * @returns Mock response content
   */
  protected override getMockResponse(): string {
    return 'Mock ax-cli response for testing';
  }
}

/**
 * @deprecated GlmProvider is deprecated. Use AxCliProvider instead.
 * Configure the provider via `ax-cli setup`, not through provider-specific classes.
 * This alias will be removed in a future version.
 */
export const GlmProvider = AxCliProvider;

/**
 * @deprecated GlmProviderConfig is deprecated. Use AxCliProviderConfig instead.
 * This type will be removed in a future version.
 */
export type GlmProviderConfig = AxCliProviderConfig;
