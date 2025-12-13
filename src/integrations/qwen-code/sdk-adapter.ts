/**
 * Qwen SDK Adapter
 *
 * Provides direct SDK access to Qwen models using OpenAI-compatible API.
 * Uses Alibaba Cloud DashScope endpoint for Qwen model access.
 *
 * v12.7.0: Added as part of Qwen Code provider integration.
 *
 * @module integrations/qwen-code/sdk-adapter
 */

import type { ExecutionRequest, ExecutionResponse } from '../../types/provider.js';
import { logger } from '../../shared/logging/logger.js';
import { TIMEOUTS } from '../../core/validation-limits.js';
import {
  type QwenSDKConfig,
  type QwenModel,
  QWEN_DEFAULT_BASE_URL,
  QWEN_DEFAULT_MODEL,
  normalizeQwenModel
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
 * Qwen SDK Adapter
 *
 * Uses OpenAI SDK with Alibaba Cloud DashScope's OpenAI-compatible endpoint.
 *
 * **Setup:**
 * ```bash
 * export DASHSCOPE_API_KEY=your_api_key
 * # or
 * export QWEN_API_KEY=your_api_key
 * ```
 *
 * **Usage:**
 * ```typescript
 * const adapter = new QwenSdkAdapter({ model: 'qwen-turbo' });
 * const response = await adapter.execute({ prompt: 'Hello' });
 * ```
 */
export class QwenSdkAdapter {
  private client: unknown = null;
  private readonly config: Required<QwenSDKConfig>;
  private initialized = false;

  constructor(config: QwenSDKConfig = {}) {
    // Support multiple env var names for API key
    const apiKey = config.apiKey
      || process.env.DASHSCOPE_API_KEY
      || process.env.QWEN_API_KEY
      || '';

    this.config = {
      apiKey,
      baseUrl: config.baseUrl || QWEN_DEFAULT_BASE_URL,
      model: config.model || QWEN_DEFAULT_MODEL,
      timeout: config.timeout || TIMEOUTS.PROVIDER_DEFAULT
    };

    logger.debug('[Qwen SDK] Adapter created', {
      model: this.config.model,
      baseUrl: this.config.baseUrl,
      hasApiKey: !!this.config.apiKey
    });
  }

  /**
   * Check if SDK is available (OpenAI package installed and API key configured)
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Check for API key
      if (!this.config.apiKey) {
        logger.debug('[Qwen SDK] No API key configured (set DASHSCOPE_API_KEY or QWEN_API_KEY)');
        return false;
      }

      // Check if OpenAI SDK is available
      await import('openai');
      return true;
    } catch (error) {
      logger.debug('[Qwen SDK] OpenAI SDK not available', {
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

      logger.debug('[Qwen SDK] Client initialized', {
        model: this.config.model
      });
    } catch (error) {
      throw new Error(
        `Failed to initialize Qwen SDK: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Execute a request using the Qwen SDK
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
      const model = normalizeQwenModel(request.model || this.config.model);

      logger.debug('[Qwen SDK] Executing request', {
        model,
        messageCount: messages.length,
        promptLength: request.prompt.length
      });

      // Verify client was initialized successfully
      if (!this.client) {
        throw new Error(
          'Qwen SDK client not initialized. ' +
          'Ensure API key is set via DASHSCOPE_API_KEY or QWEN_API_KEY environment variable.'
        );
      }

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
        throw new Error('Qwen API returned empty choices array');
      }
      const choice = response.choices[0];
      // Validate content is actually a string (API could return null/undefined/other types)
      const rawContent = choice?.message?.content;
      const content = typeof rawContent === 'string' ? rawContent : '';
      const finishReason = choice?.finish_reason || 'unknown';

      logger.debug('[Qwen SDK] Request completed', {
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

      logger.error('[Qwen SDK] Request failed', {
        error: error instanceof Error ? error.message : String(error),
        latencyMs
      });

      throw error;
    }
  }

  /**
   * Get the configured model
   */
  getModel(): QwenModel {
    return this.config.model;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.client = null;
    this.initialized = false;
    logger.debug('[Qwen SDK] Adapter destroyed');
  }
}
