/**
 * Base SDK Adapter for OpenAI-Compatible APIs
 *
 * Provides a reusable base class for providers using OpenAI-compatible APIs.
 * Used by GLM (Zhipu AI) and Grok (xAI) integrations.
 *
 * v12.4.2: Extracted to eliminate duplication between ax-glm and ax-grok.
 *
 * @module integrations/shared/openai-compatible-sdk-adapter
 */

import type { ExecutionRequest, ExecutionResponse } from '../../types/provider.js';
import { logger } from '../../shared/logging/logger.js';
import { TIMEOUTS } from '../../core/validation-limits.js';

/**
 * OpenAI SDK types (using dynamic import)
 */
export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

/**
 * Configuration for OpenAI-compatible SDK adapters
 */
export interface OpenAICompatibleSDKConfig {
  apiKey?: string;
  baseUrl: string;
  model: string;
  timeout?: number;
  /** Provider name for logging (e.g., 'GLM', 'Grok') */
  providerName: string;
  /** Environment variable name for API key (e.g., 'ZAI_API_KEY') */
  apiKeyEnvVar: string;
  /** Function to normalize model name */
  normalizeModel: (model: string) => string;
}

/**
 * Base SDK Adapter for OpenAI-Compatible APIs
 *
 * This abstract base class handles the common logic for SDK adapters that
 * use OpenAI-compatible APIs, reducing code duplication.
 *
 * **Usage:**
 * ```typescript
 * class GLMSdkAdapter extends OpenAICompatibleSdkAdapter {
 *   constructor(config) {
 *     super({
 *       ...config,
 *       providerName: 'GLM',
 *       apiKeyEnvVar: 'ZAI_API_KEY',
 *       normalizeModel: normalizeGLMModel
 *     });
 *   }
 * }
 * ```
 */
export class OpenAICompatibleSdkAdapter {
  protected client: unknown = null;
  protected readonly config: OpenAICompatibleSDKConfig;
  protected initialized = false;
  private readonly logPrefix: string;

  constructor(config: OpenAICompatibleSDKConfig) {
    this.config = {
      apiKey: config.apiKey || process.env[config.apiKeyEnvVar] || '',
      baseUrl: config.baseUrl,
      model: config.model,
      timeout: config.timeout || TIMEOUTS.PROVIDER_DEFAULT,
      providerName: config.providerName,
      apiKeyEnvVar: config.apiKeyEnvVar,
      normalizeModel: config.normalizeModel
    };

    this.logPrefix = `[${config.providerName} SDK]`;

    logger.debug(`${this.logPrefix} Adapter created`, {
      model: this.config.model,
      baseUrl: this.config.baseUrl,
      hasApiKey: !!this.config.apiKey
    });
  }

  /**
   * Check if SDK is available (OpenAI package installed and API key present)
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (!this.config.apiKey) {
        logger.debug(`${this.logPrefix} No API key configured`);
        return false;
      }

      await import('openai');
      return true;
    } catch (error) {
      logger.debug(`${this.logPrefix} OpenAI SDK not available`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Initialize the SDK client
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const OpenAI = (await import('openai')).default;

      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseUrl,
        timeout: this.config.timeout
      });

      this.initialized = true;

      logger.debug(`${this.logPrefix} Client initialized`, {
        model: this.config.model
      });
    } catch (error) {
      throw new Error(
        `Failed to initialize ${this.config.providerName} SDK: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Execute a request using the SDK
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      const messages: ChatCompletionMessage[] = [];

      if (request.systemPrompt) {
        messages.push({
          role: 'system',
          content: request.systemPrompt
        });
      }

      messages.push({
        role: 'user',
        content: request.prompt
      });

      const model = this.config.normalizeModel(this.config.model);

      logger.debug(`${this.logPrefix} Executing request`, {
        model,
        messageCount: messages.length,
        promptLength: request.prompt.length
      });

      const openaiClient = this.client as {
        chat: {
          completions: {
            create: (params: unknown) => Promise<ChatCompletionResponse>;
          };
        };
      };

      const response = await openaiClient.chat.completions.create({
        model,
        messages,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        stream: false
      });

      const latencyMs = Date.now() - startTime;

      if (!response.choices || response.choices.length === 0) {
        throw new Error(`${this.config.providerName} API returned empty choices array`);
      }

      const choice = response.choices[0];
      const content = choice?.message?.content || '';
      const finishReason = choice?.finish_reason || 'unknown';

      logger.debug(`${this.logPrefix} Request completed`, {
        model: response.model,
        latencyMs,
        tokensUsed: response.usage?.total_tokens
      });

      return {
        content,
        model: response.model,
        tokensUsed: response.usage ? {
          prompt: response.usage.prompt_tokens,
          completion: response.usage.completion_tokens,
          total: response.usage.total_tokens
        } : { prompt: 0, completion: 0, total: 0 },
        latencyMs,
        finishReason: finishReason as 'stop' | 'length' | 'error',
        cached: false
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      logger.error(`${this.logPrefix} Request failed`, {
        error: error instanceof Error ? error.message : String(error),
        latencyMs
      });

      throw error;
    }
  }

  /**
   * Get the configured model
   */
  getModel(): string {
    return this.config.model;
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    this.client = null;
    this.initialized = false;
    logger.debug(`${this.logPrefix} Adapter destroyed`);
  }
}
