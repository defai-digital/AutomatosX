/**
 * Embedding Service - Generate vector embeddings for semantic search
 *
 * Uses @xenova/transformers with sentence-transformers/all-MiniLM-L6-v2 model
 * - Model size: 22MB
 * - Embedding dimensions: 384
 * - Inference: ~50-100ms per item on CPU
 * - Memory: ~100MB for loaded model
 *
 * Features:
 * - LRU cache for frequently accessed embeddings
 * - Batch processing for efficiency
 * - Automatic model download and caching
 * - Error handling and retries
 */

import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import { LRUCache } from 'lru-cache';

export interface EmbeddingOptions {
  normalize?: boolean;
  pooling?: 'mean' | 'cls';
  maxLength?: number;
}

export interface EmbeddingResult {
  embedding: Float32Array;
  dimensions: number;
  model: string;
  cached: boolean;
}

export interface BatchEmbeddingResult {
  embeddings: Float32Array[];
  count: number;
  cacheHits: number;
  cacheMisses: number;
  duration: number;
}

export class EmbeddingService {
  private model: FeatureExtractionPipeline | null = null;
  private modelName = 'Xenova/all-MiniLM-L6-v2';
  private dimensions = 384;
  private cache: LRUCache<string, Float32Array>;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(options: { cacheSize?: number } = {}) {
    this.cache = new LRUCache<string, Float32Array>({
      max: options.cacheSize || 1000,
      // Estimate: 384 floats × 4 bytes = 1536 bytes per embedding
      maxSize: (options.cacheSize || 1000) * 1536,
      sizeCalculation: () => 1536,
    });
  }

  /**
   * Initialize the embedding model
   * Downloads model on first run (22MB, cached in ~/.cache/transformers)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Prevent multiple simultaneous initialization
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._doInitialize();
    await this.initializationPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      console.log(`Loading embedding model: ${this.modelName}...`);
      const startTime = Date.now();

      this.model = await pipeline('feature-extraction', this.modelName, {
        quantized: true, // Use quantized model for smaller size and faster inference
      });

      const duration = Date.now() - startTime;
      console.log(`Model loaded in ${duration}ms`);

      this.isInitialized = true;
    } catch (error) {
      this.initializationPromise = null; // Allow retry
      throw new Error(`Failed to initialize embedding model: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Generate embedding for a single text
   *
   * @param text - Text to embed
   * @param options - Embedding options
   * @returns Embedding result with 384-dimensional vector
   */
  async embed(text: string, options: EmbeddingOptions = {}): Promise<EmbeddingResult> {
    await this.initialize();

    if (!this.model) {
      throw new Error('Embedding model not initialized');
    }

    // Check cache first
    const cacheKey = this._getCacheKey(text, options);
    const cached = this.cache.get(cacheKey);

    if (cached) {
      return {
        embedding: cached,
        dimensions: this.dimensions,
        model: this.modelName,
        cached: true,
      };
    }

    // Generate embedding
    const startTime = Date.now();

    const output = await this.model(text, {
      pooling: options.pooling || 'mean',
      normalize: options.normalize !== false, // Default: true
    });

    // Extract Float32Array from tensor
    // output is a Tensor with dims [1, 384] and data as Float32Array
    // Ensure we have a proper Float32Array (not a proxy or cross-realm type)
    let embedding: Float32Array;

    if (output.data instanceof Float32Array) {
      // Direct Float32Array - use as-is
      embedding = output.data;
    } else if (ArrayBuffer.isView(output.data)) {
      // TypedArray from different realm - copy to new Float32Array
      const view = output.data as any; // Use any to avoid type conflicts
      embedding = new Float32Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
    } else if (Array.isArray(output.data)) {
      // Fallback: convert array to Float32Array
      embedding = new Float32Array(output.data);
    } else {
      throw new Error(`Unexpected tensor data type: ${typeof output.data}`);
    }

    // Validate dimensions
    if (embedding.length !== this.dimensions) {
      throw new Error(`Unexpected embedding dimensions: ${embedding.length} (expected ${this.dimensions})`);
    }

    // Cache the result
    this.cache.set(cacheKey, embedding);

    const duration = Date.now() - startTime;
    console.log(`Generated embedding in ${duration}ms (cache miss)`);

    return {
      embedding,
      dimensions: this.dimensions,
      model: this.modelName,
      cached: false,
    };
  }

  /**
   * Generate embeddings for multiple texts in batch
   * More efficient than calling embed() multiple times
   *
   * @param texts - Array of texts to embed
   * @param options - Embedding options
   * @param batchSize - Number of items to process at once (default: 32)
   * @returns Batch embedding result
   */
  async embedBatch(
    texts: string[],
    options: EmbeddingOptions = {},
    batchSize = 32
  ): Promise<BatchEmbeddingResult> {
    await this.initialize();

    if (!this.model) {
      throw new Error('Embedding model not initialized');
    }

    const startTime = Date.now();
    const embeddings: Float32Array[] = [];
    let cacheHits = 0;
    let cacheMisses = 0;

    // Process in batches
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults: Float32Array[] = [];

      // Check cache for each item
      for (const text of batch) {
        const cacheKey = this._getCacheKey(text, options);
        const cached = this.cache.get(cacheKey);

        if (cached) {
          batchResults.push(cached);
          cacheHits++;
        } else {
          // Need to generate this one
          const output = await this.model(text, {
            pooling: options.pooling || 'mean',
            normalize: options.normalize !== false,
          });

          // Extract Float32Array from tensor (already the correct type)
          const embedding = output.data as Float32Array;

          if (embedding.length !== this.dimensions) {
            throw new Error(`Unexpected embedding dimensions: ${embedding.length}`);
          }

          this.cache.set(cacheKey, embedding);
          batchResults.push(embedding);
          cacheMisses++;
        }
      }

      embeddings.push(...batchResults);
    }

    const duration = Date.now() - startTime;

    return {
      embeddings,
      count: embeddings.length,
      cacheHits,
      cacheMisses,
      duration,
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.cache.max,
      hitRate: this._calculateHitRate(),
    };
  }

  /**
   * Clear the embedding cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get embedding model info
   */
  getModelInfo() {
    return {
      name: this.modelName,
      dimensions: this.dimensions,
      initialized: this.isInitialized,
    };
  }

  /**
   * Generate cache key from text and options
   */
  private _getCacheKey(text: string, options: EmbeddingOptions): string {
    const optionsKey = JSON.stringify({
      pooling: options.pooling || 'mean',
      normalize: options.normalize !== false,
    });
    return `${text}:${optionsKey}`;
  }

  /**
   * Calculate cache hit rate (placeholder - would need actual metrics)
   */
  private _calculateHitRate(): number {
    // TODO: Track hits/misses for accurate calculation
    return 0;
  }
}

// Singleton instance for reuse across the application
let embeddingServiceInstance: EmbeddingService | null = null;

/**
 * Get the singleton embedding service instance
 */
export function getEmbeddingService(): EmbeddingService {
  if (!embeddingServiceInstance) {
    embeddingServiceInstance = new EmbeddingService();
  }
  return embeddingServiceInstance;
}
