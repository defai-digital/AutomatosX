/**
 * OpenAIProvider.ts
 *
 * OpenAI GPT provider implementation with streaming support.
 * Integrates with openai SDK for OpenAI API access.
 *
 * Phase 2 Week 2 Day 9: OpenAIProvider Implementation
 */

import OpenAI from 'openai';
import { BaseProvider, type ProviderConfig, type StreamOptions } from './BaseProvider.js';
import type {
  ProviderRequest,
  ProviderResponse,
  ProviderError,
} from '../../../../src/types/schemas/provider.schema.js';

export interface OpenAIProviderConfig extends ProviderConfig {
  defaultModel?: string;
  maxTokens?: number;
  organization?: string;
}

/**
 * OpenAIProvider implements BaseProvider for OpenAI API.
 * Supports both streaming and non-streaming requests with comprehensive error handling.
 */
export class OpenAIProvider extends BaseProvider {
  private client: OpenAI;
  private defaultMaxTokens: number = 4096;

  constructor(config: OpenAIProviderConfig) {
    super(config, 'openai');

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout || 30000,
      maxRetries: 0, // We handle retries in ProviderRouter
      organization: config.organization,
    });

    if (config.maxTokens) {
      this.defaultMaxTokens = config.maxTokens;
    }

    this.validateConfig();
  }

  /**
   * Send a non-streaming request to OpenAI
   */
  async sendRequest(request: ProviderRequest): Promise<ProviderResponse> {
    this.validateRequest(request);

    const startTime = Date.now();

    try {
      const openaiRequest = this.transformRequest(request);

      this.log('info', 'Sending request to OpenAI', {
        model: request.model,
        messageCount: request.messages.length,
      });

      const response = await this.client.chat.completions.create(openaiRequest as any);

      const endTime = Date.now();
      const duration = endTime - startTime;

      return this.transformResponse({
        response,
        duration,
        model: request.model,
      });
    } catch (error) {
      this.log('error', 'OpenAI request failed', { error });
      throw this.transformError(error);
    }
  }

  /**
   * Send a streaming request to OpenAI
   */
  async sendStreamingRequest(
    request: ProviderRequest,
    options: StreamOptions
  ): Promise<ProviderResponse> {
    this.validateRequest(request);

    const startTime = Date.now();
    let firstTokenTime: number | undefined;
    let chunkIndex = 0;
    let accumulatedContent = '';

    try {
      const openaiRequest = {
        ...this.transformRequest(request),
        stream: true,
      };

      this.log('info', 'Starting streaming request to OpenAI', {
        model: request.model,
      });

      const stream = await this.client.chat.completions.create(openaiRequest as any);

      // Track token usage (available in final chunk)
      let inputTokens = 0;
      let outputTokens = 0;
      let finishReason: string | null = null;

      for await (const chunk of stream) {
        // Record first token latency
        if (firstTokenTime === undefined) {
          firstTokenTime = Date.now();
        }

        const choice = chunk.choices[0];
        if (choice?.delta?.content) {
          const delta = choice.delta.content;
          accumulatedContent += delta;

          if (options.onChunk) {
            options.onChunk({
              chunk: accumulatedContent,
              index: chunkIndex++,
              delta,
            });
          }
        }

        // Capture finish reason
        if (choice?.finish_reason) {
          finishReason = choice.finish_reason;
        }

        // Some models include usage in streaming
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens || 0;
          outputTokens = chunk.usage.completion_tokens || 0;
        }
      }

      if (options.onComplete) {
        options.onComplete();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Map finish reason
      let mappedFinishReason: 'stop' | 'length' | 'content_filter' | 'error' = 'stop';
      if (finishReason === 'length') {
        mappedFinishReason = 'length';
      } else if (finishReason === 'content_filter') {
        mappedFinishReason = 'content_filter';
      }

      // Build final response
      return {
        content: accumulatedContent,
        tokens: {
          input: inputTokens,
          output: outputTokens,
          total: inputTokens + outputTokens,
        },
        duration,
        model: request.model || this.getProviderDefaultModel(),
        provider: 'openai',
        finishReason: mappedFinishReason,
      };
    } catch (error) {
      this.log('error', 'OpenAI streaming request failed', { error });
      if (options.onError) {
        options.onError(this.transformError(error));
      }
      throw this.transformError(error);
    }
  }

  /**
   * Check if OpenAI API is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Simple health check: try to create a minimal completion
      await this.client.chat.completions.create({
        model: this.getProviderDefaultModel(),
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return true;
    } catch (error) {
      this.log('warn', 'OpenAI health check failed', { error });
      return false;
    }
  }

  /**
   * Get the default OpenAI model
   */
  protected getProviderDefaultModel(): string {
    return this.config.defaultModel || 'gpt-4o';
  }

  /**
   * Transform generic ProviderRequest to OpenAI API format
   */
  protected transformRequest(request: ProviderRequest): unknown {
    // OpenAI uses messages array directly
    const messages = request.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const openaiRequest: any = {
      model: request.model || this.getProviderDefaultModel(),
      messages,
      max_tokens: request.maxTokens || this.defaultMaxTokens,
    };

    // Add optional parameters
    if (request.temperature !== undefined) {
      openaiRequest.temperature = request.temperature;
    }

    if (request.topP !== undefined) {
      openaiRequest.top_p = request.topP;
    }

    if (request.stopSequences && request.stopSequences.length > 0) {
      openaiRequest.stop = request.stopSequences;
    }

    return openaiRequest;
  }

  /**
   * Transform OpenAI API response to generic ProviderResponse
   */
  protected transformResponse(data: any): ProviderResponse {
    const { response, duration, model } = data;

    // Extract content from first choice
    let content = '';
    if (response.choices && response.choices.length > 0) {
      content = response.choices[0].message?.content || '';
    }

    // Map finish reason
    let finishReason: 'stop' | 'length' | 'content_filter' | 'error' = 'stop';
    if (response.choices && response.choices[0]) {
      const stopReason = response.choices[0].finish_reason;
      if (stopReason === 'length') {
        finishReason = 'length';
      } else if (stopReason === 'content_filter') {
        finishReason = 'content_filter';
      } else if (stopReason === 'stop') {
        finishReason = 'stop';
      }
    }

    return {
      content,
      tokens: {
        input: response.usage?.prompt_tokens || 0,
        output: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0,
      },
      duration,
      model: model || response.model,
      provider: 'openai',
      finishReason,
    };
  }

  /**
   * Transform OpenAI API error to generic ProviderError
   */
  protected transformError(error: unknown): ProviderError {
    if (error instanceof OpenAI.APIError) {
      const statusCode = error.status;
      let code: string = 'unknown_error';
      let retryable = false;

      // Map OpenAI error types to our error codes
      if (statusCode === 401) {
        code = 'authentication_error';
        retryable = false;
      } else if (statusCode === 400) {
        code = 'invalid_request';
        retryable = false;
      } else if (statusCode === 429) {
        code = 'rate_limit_exceeded';
        retryable = true;
      } else if (statusCode === 500 || statusCode === 503) {
        code = 'server_error';
        retryable = true;
      } else if (statusCode === 404) {
        code = 'model_not_found';
        retryable = false;
      } else if (error.message.includes('timeout')) {
        code = 'timeout';
        retryable = true;
      } else if (error.message.includes('network')) {
        code = 'network_error';
        retryable = true;
      } else if (error.message.includes('quota')) {
        code = 'quota_exceeded';
        retryable = false;
      }

      return {
        error: error.message,
        code: code as any,
        provider: 'openai',
        statusCode,
        retryable,
      };
    }

    if (error instanceof Error) {
      return {
        error: error.message,
        code: 'unknown_error',
        provider: 'openai',
        retryable: false,
      };
    }

    return {
      error: String(error),
      code: 'unknown_error',
      provider: 'openai',
      retryable: false,
    };
  }
}
