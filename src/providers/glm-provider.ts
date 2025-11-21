/**
 * GlmProvider - Zhipu AI GLM Provider via ax-cli (v9.1.0)
 *
 * Provides access to Zhipu AI GLM models through ax-cli.
 * Default model: glm-4.6
 *
 * ax-cli supports multiple providers:
 * - GLM (Zhipu AI) - default
 * - xAI (Grok)
 * - OpenAI
 * - Anthropic
 * - Ollama
 *
 * @module providers/glm-provider
 */

import { BaseProvider } from './base-provider.js';
import type { ProviderConfig, ExecutionRequest, ExecutionResponse } from '../types/provider.js';
import { AxCliAdapter } from '../integrations/ax-cli/adapter.js';
import type { GrokOptions } from '../integrations/ax-cli/interface.js';
import { logger } from '../utils/logger.js';

/**
 * Extended provider config for GLM
 */
export interface GlmProviderConfig extends ProviderConfig {
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
}

/**
 * GLM Provider using ax-cli
 *
 * Simple, single-CLI provider for Zhipu AI GLM models.
 *
 * **Default Configuration**:
 * - Provider: glm (Zhipu AI)
 * - Model: glm-4.6
 * - CLI: ax-cli
 *
 * **User Flexibility**:
 * Users can configure ax-cli to use other providers (Grok, OpenAI, etc.)
 * by setting `axCli.provider` in configuration or via `~/.ax-cli/config.json`.
 *
 * Features:
 * - Direct ax-cli integration
 * - No fallback complexity
 * - Full ax-cli v2.5.1+ feature support
 * - Multi-provider capability
 */
export class GlmProvider extends BaseProvider {
  private adapter: AxCliAdapter;
  protected override config: GlmProviderConfig;

  constructor(config: GlmProviderConfig) {
    super(config);
    this.config = config;
    this.adapter = new AxCliAdapter();

    logger.info('GlmProvider initialized', {
      provider: config.axCli?.provider || 'glm',
      model: config.axCli?.model || 'glm-4.6',
      command: this.adapter.getCommand()
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
    const options: GrokOptions = {
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
   * Get CLI command
   *
   * @returns CLI command name ("ax-cli")
   */
  public getCLICommand(): string {
    return this.adapter.getCommand();
  }

  /**
   * Get mock response for testing
   *
   * @returns Mock response content
   */
  protected override getMockResponse(): string {
    return 'Mock GLM response for testing';
  }
}
