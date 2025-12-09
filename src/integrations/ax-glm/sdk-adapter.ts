/**
 * GLM SDK Adapter
 *
 * Provides direct SDK access to Zhipu AI's GLM models using OpenAI-compatible API.
 * Since there's no official @zhipuai/sdk package, we use the OpenAI SDK with
 * Zhipu's OpenAI-compatible endpoint.
 *
 * v12.0.0: Added as part of PRD-012 provider architecture refactoring.
 *
 * @module integrations/ax-glm/sdk-adapter
 */

import type { ExecutionRequest, ExecutionResponse } from '../../types/provider.js';
import { logger } from '../../shared/logging/logger.js';
import { TIMEOUTS } from '../../core/validation-limits.js';
import {
  type GLMSDKConfig,
  type GLMModel,
  GLM_DEFAULT_BASE_URL,
  GLM_DEFAULT_MODEL,
  normalizeGLMModel
} from './types.js';

/**
 * OpenAI SDK types (using dynamic import)
 */
interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResponse {
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
 * GLM SDK Adapter
 *
 * Uses OpenAI SDK with Zhipu's OpenAI-compatible endpoint for GLM access.
 *
 * **Setup:**
 * ```bash
 * export ZAI_API_KEY=your_api_key
 * ```
 *
 * **Usage:**
 * ```typescript
 * const adapter = new GLMSdkAdapter({ model: 'glm-4.6' });
 * const response = await adapter.execute({ prompt: 'Hello' });
 * ```
 */
export class GLMSdkAdapter {
  private client: unknown = null;
  private readonly config: Required<GLMSDKConfig>;
  private initialized = false;

  constructor(config: GLMSDKConfig = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.ZAI_API_KEY || '',
      baseUrl: config.baseUrl || GLM_DEFAULT_BASE_URL,
      model: config.model || GLM_DEFAULT_MODEL,
      timeout: config.timeout || TIMEOUTS.PROVIDER_DEFAULT
    };

    logger.debug('[GLM SDK] Adapter created', {
      model: this.config.model,
      baseUrl: this.config.baseUrl,
      hasApiKey: !!this.config.apiKey
    });
  }

  /**
   * Check if SDK is available (OpenAI package installed)
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Check for API key
      if (!this.config.apiKey) {
        logger.debug('[GLM SDK] No API key configured');
        return false;
      }

      // Check if OpenAI SDK is available
      await import('openai');
      return true;
    } catch (error) {
      logger.debug('[GLM SDK] OpenAI SDK not available', {
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

      logger.debug('[GLM SDK] Client initialized', {
        model: this.config.model
      });
    } catch (error) {
      throw new Error(
        `Failed to initialize GLM SDK: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Execute a request using the GLM SDK
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      // Build messages array
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

      // Get normalized model name
      const model = normalizeGLMModel(this.config.model);

      logger.debug('[GLM SDK] Executing request', {
        model,
        messageCount: messages.length,
        promptLength: request.prompt.length
      });

      // Make API call using OpenAI SDK
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

      // Extract response - validate choices array
      if (!response.choices || response.choices.length === 0) {
        throw new Error('GLM API returned empty choices array');
      }
      const choice = response.choices[0];
      const content = choice?.message?.content || '';
      const finishReason = choice?.finish_reason || 'unknown';

      logger.debug('[GLM SDK] Request completed', {
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

      logger.error('[GLM SDK] Request failed', {
        error: error instanceof Error ? error.message : String(error),
        latencyMs
      });

      throw error;
    }
  }

  /**
   * Get the configured model
   */
  getModel(): GLMModel {
    return this.config.model;
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    this.client = null;
    this.initialized = false;
    logger.debug('[GLM SDK] Adapter destroyed');
  }
}
