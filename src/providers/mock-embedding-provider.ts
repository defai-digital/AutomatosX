/**
 * Mock Embedding Provider for Testing
 *
 * Provides deterministic embeddings for testing without requiring real API calls.
 * Uses a simple hash-based approach to generate consistent embeddings.
 */

import type {
  IEmbeddingProvider,
  EmbeddingProviderConfig,
  EmbeddingResponse
} from '../types/embedding.js';

/**
 * Simple hash function for generating deterministic embeddings
 */
function simpleHash(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
}

/**
 * Mock Embedding Provider
 *
 * Generates deterministic embeddings based on text content.
 * Embeddings are consistent for the same input text.
 */
export class MockEmbeddingProvider implements IEmbeddingProvider {
  private provider: string;
  private model: string;
  private dimensions: number;

  constructor(config?: Partial<EmbeddingProviderConfig>) {
    this.provider = 'mock';
    this.model = config?.model || 'mock-embedding-model';
    this.dimensions = config?.dimensions || 1536;
  }

  /**
   * Get provider info
   */
  getInfo() {
    return {
      provider: this.provider,
      model: this.model,
      dimensions: this.dimensions
    };
  }

  /**
   * Generate mock embedding from text
   *
   * Uses a deterministic hash-based approach:
   * 1. Hash the text to get a seed value
   * 2. Generate 1536 dimensions using sine waves with the seed
   * 3. Normalize the vector to unit length
   */
  async embed(text: string): Promise<EmbeddingResponse> {
    const hash = simpleHash(text);
    const embedding: number[] = [];

    // Generate embedding using hash as seed
    for (let i = 0; i < this.dimensions; i++) {
      // Use sine waves with different frequencies based on hash and index
      const value = Math.sin((hash + i) * 0.1) * 0.5 +
                    Math.cos((hash + i) * 0.05) * 0.3 +
                    Math.sin((hash * i) * 0.001) * 0.2;
      embedding.push(value);
    }

    // Normalize to unit vector
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );

    // BUG FIX: Prevent division by zero if magnitude is 0 (all values cancelled out)
    // Return the raw embedding values if magnitude is too small to normalize safely
    const normalizedEmbedding = magnitude > Number.EPSILON
      ? embedding.map(val => val / magnitude)
      : embedding;

    return {
      embedding: normalizedEmbedding,
      model: this.model,
      dimensions: this.dimensions,
      usage: {
        promptTokens: text.split(/\s+/).length,
        totalTokens: text.split(/\s+/).length
      }
    };
  }

  /**
   * Batch generate embeddings
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResponse[]> {
    return Promise.all(texts.map(text => this.embed(text)));
  }
}
