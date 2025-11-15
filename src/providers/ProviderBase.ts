/**
 * Base provider interface and types for AI provider integrations
 *
 * All providers (Claude, Gemini, OpenAI) implement this interface for consistent
 * interaction with the ProviderRouter.
 */

import { z } from 'zod'

/**
 * Provider request schema
 */
export const ProviderRequestSchema = z.object({
  model: z.string().optional(),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })),
  maxTokens: z.number().int().positive().optional().default(4096),
  temperature: z.number().min(0).max(2).optional().default(1.0),
  streaming: z.boolean().optional().default(false),
  timeout: z.number().int().positive().optional().default(60000),
})

export type ProviderRequest = z.infer<typeof ProviderRequestSchema>

/**
 * Provider response schema
 */
export const ProviderResponseSchema = z.object({
  content: z.string(),
  model: z.string(),
  usage: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
  }),
  finishReason: z.enum(['stop', 'length', 'tool_use', 'error']).optional(),
  latency: z.number().nonnegative(),
  provider: z.string(),
})

export type ProviderResponse = z.infer<typeof ProviderResponseSchema>

/**
 * Streaming chunk schema
 */
export const StreamingChunkSchema = z.object({
  delta: z.string(),
  model: z.string().optional(),
  finishReason: z.enum(['stop', 'length', 'tool_use', 'error']).optional(),
})

export type StreamingChunk = z.infer<typeof StreamingChunkSchema>

/**
 * Provider configuration schema
 */
export const ProviderConfigSchema = z.object({
  enabled: z.boolean().default(true),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  defaultModel: z.string().optional(),
  maxRetries: z.number().int().nonnegative().default(3),
  timeout: z.number().int().positive().default(60000),
  priority: z.number().int().positive().default(1),
}).passthrough()

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>

/**
 * Provider health status
 */
export interface ProviderHealth {
  available: boolean
  latency: number
  errorRate: number
  lastError?: string
  lastCheckedAt: number
}

/**
 * Provider error types
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider: string,
    public retryable: boolean = false,
    public statusCode?: number
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

export class ProviderAuthError extends ProviderError {
  constructor(provider: string, message: string = 'Authentication failed') {
    super(message, 'AUTH_ERROR', provider, false, 401)
    this.name = 'ProviderAuthError'
  }
}

export class ProviderRateLimitError extends ProviderError {
  constructor(provider: string, retryAfter?: number) {
    super('Rate limit exceeded', 'RATE_LIMIT', provider, true, 429)
    this.name = 'ProviderRateLimitError'
    this.retryAfter = retryAfter
  }
  retryAfter?: number
}

export class ProviderTimeoutError extends ProviderError {
  constructor(provider: string, timeout: number) {
    super(`Request timeout after ${timeout}ms`, 'TIMEOUT', provider, true, 408)
    this.name = 'ProviderTimeoutError'
  }
}

export class ProviderNetworkError extends ProviderError {
  constructor(provider: string, message: string) {
    super(message, 'NETWORK_ERROR', provider, true)
    this.name = 'ProviderNetworkError'
  }
}

/**
 * Base provider interface
 *
 * All providers must implement this interface to be compatible with ProviderRouter
 */
export interface IProvider {
  /**
   * Provider name (e.g., 'claude', 'gemini', 'openai')
   */
  readonly name: string

  /**
   * Provider configuration
   */
  readonly config: ProviderConfig

  /**
   * Make a request to the provider
   */
  request(request: ProviderRequest): Promise<ProviderResponse>

  /**
   * Make a streaming request to the provider
   */
  streamRequest(
    request: ProviderRequest,
    onChunk: (chunk: StreamingChunk) => void
  ): Promise<ProviderResponse>

  /**
   * Check provider health/availability
   */
  healthCheck(): Promise<ProviderHealth>

  /**
   * Get available models
   */
  getAvailableModels(): Promise<string[]>

  /**
   * Validate configuration
   */
  validateConfig(): Promise<boolean>
}

/**
 * Abstract base provider class
 *
 * Provides common functionality for all providers
 */
export abstract class BaseProvider implements IProvider {
  abstract readonly name: string
  readonly config: ProviderConfig

  constructor(config: ProviderConfig) {
    this.config = ProviderConfigSchema.parse(config)
  }

  abstract request(request: ProviderRequest): Promise<ProviderResponse>

  abstract streamRequest(
    request: ProviderRequest,
    onChunk: (chunk: StreamingChunk) => void
  ): Promise<ProviderResponse>

  abstract healthCheck(): Promise<ProviderHealth>

  abstract getAvailableModels(): Promise<string[]>

  async validateConfig(): Promise<boolean> {
    if (!this.config.enabled) {
      return false
    }

    if (!this.config.apiKey) {
      throw new ProviderAuthError(this.name, 'API key is required')
    }

    return true
  }

  /**
   * Helper method to measure request latency
   */
  protected async measureLatency<T>(fn: () => Promise<T>): Promise<[T, number]> {
    const start = Date.now()
    const result = await fn()
    const latency = Date.now() - start
    return [result, latency]
  }

  /**
   * Helper method to handle retries with exponential backoff
   */
  protected async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = this.config.maxRetries!
  ): Promise<T> {
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error

        // Don't retry on non-retryable errors
        if (error instanceof ProviderError && !error.retryable) {
          throw error
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          throw error
        }

        // Exponential backoff: 1s, 2s, 4s, 8s, etc.
        // Fixed: Cap delay at 60 seconds to prevent excessive wait times
        const delay = Math.min(Math.pow(2, attempt) * 1000, 60000)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError
  }

  /**
   * Helper method to apply timeout to a promise
   */
  protected async withTimeout<T>(
    promise: Promise<T>,
    timeout: number = this.config.timeout!
  ): Promise<T> {
    // Fixed: Clear timeout to prevent memory leak
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new ProviderTimeoutError(this.name, timeout)), timeout);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId!);
    }
  }
}
