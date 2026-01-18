/**
 * Embedding Service
 *
 * Provides text embedding computation with a local TF-IDF fallback.
 * Can be extended with external providers (OpenAI, Cohere, etc.)
 *
 * Invariants:
 * - INV-SEM-001: Embeddings computed and cached
 * - INV-SEM-200: Consistent dimension within namespace
 */

import type {
  EmbeddingPort,
  EmbeddingRequest,
  EmbeddingResult,
} from './types.js';
import type { EmbeddingConfig } from '@defai.digital/contracts';
import { normalizeVector } from './similarity.js';

// ============================================================================
// Local TF-IDF Embedding
// ============================================================================

/**
 * Simple tokenizer that splits text into tokens
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/**
 * Compute term frequency for tokens
 */
function computeTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }
  // Normalize by total tokens
  const total = tokens.length;
  for (const [term, count] of tf) {
    tf.set(term, count / total);
  }
  return tf;
}

/**
 * Simple hash function for consistent dimension mapping
 */
function hashString(str: string, maxDim: number): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % maxDim;
}

/**
 * Create TF-IDF based embedding
 *
 * This is a simple local embedding that:
 * 1. Tokenizes text
 * 2. Computes term frequency
 * 3. Hashes terms to fixed dimension
 * 4. Normalizes to unit vector
 */
export function createTFIDFEmbedding(text: string, dimension: number): number[] {
  const tokens = tokenize(text);
  const tf = computeTF(tokens);

  // Create sparse vector and hash to fixed dimension
  const embedding = new Array(dimension).fill(0);

  for (const [term, freq] of tf) {
    // Hash term to dimension index
    const index = hashString(term, dimension);
    // Add frequency (with sign based on secondary hash for better distribution)
    const sign = hashString(term + '_sign', 2) === 0 ? 1 : -1;
    embedding[index] += freq * sign;
  }

  // Normalize to unit vector
  return normalizeVector(embedding);
}

/**
 * Batch create TF-IDF embeddings with IDF computation
 */
export function createTFIDFEmbeddingBatch(texts: string[], dimension: number): number[][] {
  // Compute document frequency for IDF
  const docFreq = new Map<string, number>();
  const allTokens: string[][] = [];

  for (const text of texts) {
    const tokens = tokenize(text);
    const uniqueTokens = new Set(tokens);
    allTokens.push(tokens);

    for (const token of uniqueTokens) {
      docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
    }
  }

  const numDocs = texts.length;
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i++) {
    const tokens = allTokens[i]!;
    const tf = computeTF(tokens);
    const embedding = new Array(dimension).fill(0);

    for (const [term, freq] of tf) {
      // Compute IDF: log(N / df)
      const df = docFreq.get(term) ?? 1;
      const idf = Math.log(numDocs / df);
      const tfidf = freq * idf;

      // Hash to dimension
      const index = hashString(term, dimension);
      const sign = hashString(term + '_sign', 2) === 0 ? 1 : -1;
      embedding[index] += tfidf * sign;
    }

    embeddings.push(normalizeVector(embedding));
  }

  return embeddings;
}

// ============================================================================
// Local Embedding Provider
// ============================================================================

/**
 * Local embedding provider using TF-IDF
 */
export class LocalEmbeddingProvider implements EmbeddingPort {
  private config: EmbeddingConfig;

  constructor(config?: Partial<EmbeddingConfig>) {
    this.config = {
      provider: 'local',
      model: 'tfidf',
      dimension: 384,
      batchSize: 32,
      cacheEnabled: true,
      ...config,
    };
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const startTime = Date.now();

    const embedding = createTFIDFEmbedding(
      request.text,
      this.config.dimension
    );

    return {
      embedding,
      model: request.model ?? this.config.model,
      dimension: this.config.dimension,
      durationMs: Date.now() - startTime,
    };
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    const startTime = Date.now();

    // Process in batches
    const results: EmbeddingResult[] = [];
    for (let i = 0; i < texts.length; i += this.config.batchSize) {
      const batch = texts.slice(i, i + this.config.batchSize);
      const embeddings = createTFIDFEmbeddingBatch(batch, this.config.dimension);

      for (const embedding of embeddings) {
        results.push({
          embedding,
          model: this.config.model,
          dimension: this.config.dimension,
          durationMs: Date.now() - startTime,
        });
      }
    }

    return results;
  }

  getConfig(): EmbeddingConfig {
    return { ...this.config };
  }

  async isAvailable(): Promise<boolean> {
    return true; // Local provider is always available
  }
}

// ============================================================================
// Embedding Service Factory
// ============================================================================

/**
 * Create embedding provider based on configuration
 */
export function createEmbeddingProvider(config?: Partial<EmbeddingConfig>): EmbeddingPort {
  const provider = config?.provider ?? 'local';

  switch (provider) {
    case 'local':
      return new LocalEmbeddingProvider(config);

    // Future: Add OpenAI, Cohere, Voyage providers here
    // case 'openai':
    //   return new OpenAIEmbeddingProvider(config);

    default:
      // Fall back to local
      return new LocalEmbeddingProvider(config);
  }
}

/**
 * Cached embedding provider wrapper
 */
export class CachedEmbeddingProvider implements EmbeddingPort {
  private cache: Map<string, EmbeddingResult> = new Map();
  private delegate: EmbeddingPort;
  private maxCacheSize: number;

  constructor(delegate: EmbeddingPort, maxCacheSize = 10000) {
    this.delegate = delegate;
    this.maxCacheSize = maxCacheSize;
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const cacheKey = `${request.model ?? 'default'}:${request.text}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { ...cached, durationMs: 0 };
    }

    // Compute and cache
    const result = await this.delegate.embed(request);

    // Evict old entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(cacheKey, result);
    return result;
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    // Check which texts need computation
    const model = this.getConfig().model;
    const toCompute: { index: number; text: string }[] = [];
    const results: (EmbeddingResult | null)[] = new Array(texts.length).fill(null);

    for (let i = 0; i < texts.length; i++) {
      const cacheKey = `${model}:${texts[i]}`;
      const cached = this.cache.get(cacheKey);
      if (cached) {
        results[i] = { ...cached, durationMs: 0 };
      } else {
        toCompute.push({ index: i, text: texts[i]! });
      }
    }

    // Compute missing embeddings
    if (toCompute.length > 0) {
      const computed = await this.delegate.embedBatch(toCompute.map((t) => t.text));

      for (let i = 0; i < toCompute.length; i++) {
        const { index, text } = toCompute[i]!;
        const result = computed[i]!;
        results[index] = result;

        // Cache
        const cacheKey = `${model}:${text}`;
        if (this.cache.size < this.maxCacheSize) {
          this.cache.set(cacheKey, result);
        }
      }
    }

    return results as EmbeddingResult[];
  }

  getConfig(): EmbeddingConfig {
    return this.delegate.getConfig();
  }

  async isAvailable(): Promise<boolean> {
    return this.delegate.isAvailable();
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
    };
  }
}
