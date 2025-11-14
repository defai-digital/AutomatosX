/**
 * BaseProvider.ts
 *
 * Abstract base class for all AI provider implementations.
 * Provides common functionality for request handling, streaming, and error management.
 *
 * Phase 2 Week 2 Day 6: Provider Infrastructure
 */

import type {
  ProviderRequest,
  ProviderResponse,
  StreamChunk,
  ProviderError,
  ProviderType,
} from '../../../../src/types/schemas/provider.schema.js';

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  defaultModel?: string;
}

export interface StreamOptions {
  onChunk?: (chunk: StreamChunk) => void;
  onComplete?: () => void;
  onError?: (error: ProviderError) => void;
}

/**
 * Abstract base class for AI provider implementations.
 * All provider implementations (ClaudeProvider, GeminiProvider, OpenAIProvider)
 * must extend this class and implement the abstract methods.
 */
export abstract class BaseProvider {
  protected config: ProviderConfig;
  protected providerType: ProviderType;

  constructor(config: ProviderConfig, providerType: ProviderType) {
    this.config = config;
    this.providerType = providerType;
  }

  /**
   * Get the provider type (claude, gemini, openai)
   */
  getProviderType(): ProviderType {
    return this.providerType;
  }

  /**
   * Get the default model for this provider
   */
  getDefaultModel(): string {
    return this.config.defaultModel || this.getProviderDefaultModel();
  }

  /**
   * Validate the provider configuration
   */
  validateConfig(): void {
    if (!this.config.apiKey) {
      throw new Error(`API key is required for ${this.providerType} provider`);
    }
  }

  /**
   * Send a non-streaming request to the provider
   * @param request - The provider request
   * @returns Promise<ProviderResponse> - The provider response
   */
  abstract sendRequest(request: ProviderRequest): Promise<ProviderResponse>;

  /**
   * Send a streaming request to the provider
   * @param request - The provider request (with stream: true)
   * @param options - Streaming options with callbacks
   * @returns Promise<ProviderResponse> - The final aggregated response
   */
  abstract sendStreamingRequest(
    request: ProviderRequest,
    options: StreamOptions
  ): Promise<ProviderResponse>;

  /**
   * Check if the provider is available and healthy
   * @returns Promise<boolean> - True if provider is healthy
   */
  abstract isHealthy(): Promise<boolean>;

  /**
   * Get the provider-specific default model
   * @returns string - The default model name
   */
  protected abstract getProviderDefaultModel(): string;

  /**
   * Transform a generic ProviderRequest into provider-specific format
   * @param request - The generic provider request
   * @returns unknown - The provider-specific request format
   */
  protected abstract transformRequest(request: ProviderRequest): unknown;

  /**
   * Transform provider-specific response into generic ProviderResponse
   * @param response - The provider-specific response
   * @returns ProviderResponse - The generic provider response
   */
  protected abstract transformResponse(response: unknown): ProviderResponse;

  /**
   * Transform provider-specific error into generic ProviderError
   * @param error - The provider-specific error
   * @returns ProviderError - The generic provider error
   */
  protected abstract transformError(error: unknown): ProviderError;

  /**
   * Get the timeout value in milliseconds
   */
  protected getTimeout(): number {
    return this.config.timeout || 30000; // Default 30 seconds
  }

  /**
   * Get the max retry attempts
   */
  protected getMaxRetries(): number {
    return this.config.maxRetries || 3;
  }

  /**
   * Calculate exponential backoff delay for retries
   * @param attempt - The retry attempt number (0-indexed)
   * @returns number - The delay in milliseconds
   */
  protected calculateBackoffDelay(attempt: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    return Math.min(exponentialDelay, maxDelay);
  }

  /**
   * Determine if an error is retryable
   * @param error - The provider error
   * @returns boolean - True if the error is retryable
   */
  protected isRetryableError(error: ProviderError): boolean {
    return error.retryable === true;
  }

  /**
   * Log provider activity for debugging and analytics
   * @param level - Log level (info, warn, error)
   * @param message - Log message
   * @param data - Additional data to log
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: unknown): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      provider: this.providerType,
      level,
      message,
      data,
    };

    // TODO: Integrate with proper logging system
    if (level === 'error') {
      console.error(`[${timestamp}] [${this.providerType}] ERROR:`, message, data);
    } else if (level === 'warn') {
      console.warn(`[${timestamp}] [${this.providerType}] WARN:`, message, data);
    } else {
      console.log(`[${timestamp}] [${this.providerType}] INFO:`, message, data);
    }
  }

  /**
   * Create a standardized ProviderError
   * @param message - Error message
   * @param code - Error code
   * @param statusCode - HTTP status code
   * @param retryable - Whether the error is retryable
   * @returns ProviderError
   */
  protected createError(
    message: string,
    code?: string,
    statusCode?: number,
    retryable = false
  ): ProviderError {
    return {
      error: message,
      code: code as any,
      provider: this.providerType,
      statusCode,
      retryable,
    };
  }

  /**
   * Validate that a request is properly formatted
   * @param request - The provider request
   * @throws Error if request is invalid
   */
  protected validateRequest(request: ProviderRequest): void {
    if (!request.messages || request.messages.length === 0) {
      throw this.createError('Messages array cannot be empty', 'invalid_request');
    }

    if (!request.model) {
      throw this.createError('Model is required', 'invalid_request');
    }

    if (request.maxTokens !== undefined && request.maxTokens <= 0) {
      throw this.createError('maxTokens must be positive', 'invalid_request');
    }

    if (request.temperature !== undefined && (request.temperature < 0 || request.temperature > 2)) {
      throw this.createError('temperature must be between 0 and 2', 'invalid_request');
    }
  }
}
