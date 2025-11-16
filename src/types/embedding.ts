/**
 * Embedding Provider Types - Text-to-Vector Conversion
 */

/**
 * Embedding provider configuration
 */
export interface EmbeddingProviderConfig {
  provider: 'openai' | 'anthropic' | 'custom';
  apiKey?: string;
  model?: string;
  dimensions?: number;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Embedding request
 */
export interface EmbeddingRequest {
  text: string;
  model?: string;
}

/**
 * Embedding response
 */
export interface EmbeddingResponse {
  embedding: number[];
  model: string;
  dimensions: number;
  usage?: {
    promptTokens: number;
    totalTokens: number;
  };
}

/**
 * Embedding cache entry
 */
export interface EmbeddingCacheEntry {
  text: string;
  embedding: number[];
  model: string;
  createdAt: Date;
  accessCount: number;
}

/**
 * Embedding cache configuration
 */
export interface EmbeddingCacheConfig {
  enabled: boolean;
  maxEntries?: number;
  ttlMs?: number;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  enabled: boolean;
  requestsPerMinute?: number;
  requestsPerHour?: number;
}

/**
 * Embedding provider interface
 */
export interface IEmbeddingProvider {
  /**
   * Generate embedding for text
   */
  embed(text: string): Promise<EmbeddingResponse>;

  /**
   * Generate embeddings for multiple texts (batch)
   */
  embedBatch(texts: string[]): Promise<EmbeddingResponse[]>;

  /**
   * Get provider info
   */
  getInfo(): {
    provider: string;
    model: string;
    dimensions: number;
  };
}

/**
 * Embedding service configuration
 */
export interface EmbeddingServiceConfig {
  provider: EmbeddingProviderConfig;
  cache?: EmbeddingCacheConfig;
  rateLimit?: RateLimitConfig;
}

/**
 * Embedding error codes
 */
export type EmbeddingErrorCode =
  | 'PROVIDER_ERROR'
  | 'INVALID_TEXT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'API_KEY_MISSING'
  | 'CACHE_ERROR'
  | 'BATCH_ERROR';

/**
 * Embedding error class
 */
export class EmbeddingError extends Error {
  constructor(
    message: string,
    public code: EmbeddingErrorCode,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'EmbeddingError';
  }
}
