/**
 * AxCliProvider - Multi-Provider via ax-cli (v9.2.0)
 *
 * Provides access to multiple AI models through ax-cli.
 * Default provider: GLM (Zhipu AI)
 * Default model: glm-4.6
 *
 * Supported providers via ax-cli:
 * - GLM (Zhipu AI) - default
 * - xAI (Grok)
 * - OpenAI
 * - Anthropic
 * - Ollama
 * - DeepSeek (future)
 * - Llama (future)
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
    /** Provider for ax-cli (default: 'glm') */
    provider?: 'glm' | 'xai' | 'openai' | 'anthropic' | 'ollama';
    /** Model name (default: 'glm-4.6') */
    model?: string;
    /** Config file path (default: ~/.ax-cli/config.json) */
    configPath?: string;
    /** Max tool execution rounds */
    maxToolRounds?: number;
    /** API key override */
    apiKey?: string;
    /** Base URL override */
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
 * AxCli Provider - Multi-Model AI Provider
 *
 * Model-agnostic provider supporting multiple AI models through ax-cli.
 *
 * **Default Configuration**:
 * - Provider: glm (Zhipu AI)
 * - Model: glm-4.6
 * - CLI: ax-cli
 *
 * **Supported Models**:
 * Users can configure ax-cli to use different models:
 * - GLM (Zhipu AI) - default
 * - xAI (Grok)
 * - OpenAI (GPT)
 * - Anthropic (Claude)
 * - Ollama (local models)
 * - DeepSeek (future)
 * - Llama (future)
 *
 * **Configuration**:
 * Set `axCli.provider` in configuration or via `~/.ax-cli/config.json`.
 *
 * Features:
 * - Direct ax-cli integration
 * - No fallback complexity
 * - Full ax-cli v2.5.1+ feature support
 * - Multi-model capability
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
      provider: config.axCli?.provider || 'glm',
      model: config.axCli?.model || 'glm-4.6',
      sdkOptions: config.axCliSdk
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

    // Build execution options with GLM defaults
    const options: AxCliOptions = {
      provider: axCliConfig.provider || 'glm',
      model: request.model || axCliConfig.model || 'glm-4.6',
      maxToolRounds: axCliConfig.maxToolRounds || 400,
      timeout: this.config.timeout,
      apiKey: axCliConfig.apiKey,
      baseUrl: axCliConfig.baseUrl
    };

    logger.debug('Executing task via ax-cli', {
      provider: options.provider,
      model: options.model,
      promptLength: request.prompt.length
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
        provider: options.provider,
        model: options.model
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
 * @deprecated Use AxCliProvider instead. Will be removed in v10.0.0.
 */
export const GlmProvider = AxCliProvider;

/**
 * @deprecated Use AxCliProviderConfig instead. Will be removed in v10.0.0.
 */
export type GlmProviderConfig = AxCliProviderConfig;
