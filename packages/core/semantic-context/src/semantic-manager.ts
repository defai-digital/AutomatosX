/**
 * Semantic Manager
 *
 * High-level manager for semantic context storage and search.
 * Combines embedding computation with storage.
 *
 * Invariants:
 * - INV-SEM-001: Embeddings computed on store, cached until content changes
 * - INV-SEM-002: Search results sorted by similarity descending
 * - INV-SEM-003: Similarity scores normalized to [0, 1]
 * - INV-SEM-004: Namespace isolation
 */

import type {
  SemanticItem,
  SemanticSearchRequest,
  SemanticSearchResponse,
  SemanticStoreRequest,
  SemanticStoreResponse,
  SemanticListRequest,
  SemanticListResponse,
  SemanticDeleteResponse,
  EmbeddingConfig,
} from '@defai.digital/contracts';
import { SemanticContextErrorCodes, computeContentHash } from '@defai.digital/contracts';
import type {
  SemanticManager,
  SemanticManagerOptions,
  SemanticStoreStats,
} from './types.js';

/**
 * Error thrown by semantic manager
 */
export class SemanticManagerError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SemanticManagerError';
  }

  static notFound(key: string, namespace: string): SemanticManagerError {
    return new SemanticManagerError(
      SemanticContextErrorCodes.NOT_FOUND,
      `Item not found: ${namespace}:${key}`,
      { key, namespace }
    );
  }

  static embeddingFailed(message: string): SemanticManagerError {
    return new SemanticManagerError(
      SemanticContextErrorCodes.EMBEDDING_FAILED,
      `Embedding computation failed: ${message}`
    );
  }

  static searchFailed(message: string): SemanticManagerError {
    return new SemanticManagerError(
      SemanticContextErrorCodes.SEARCH_FAILED,
      `Search failed: ${message}`
    );
  }

  static dimensionMismatch(expected: number, actual: number): SemanticManagerError {
    return new SemanticManagerError(
      SemanticContextErrorCodes.DIMENSION_MISMATCH,
      `Embedding dimension mismatch: expected ${expected}, got ${actual}`,
      { expected, actual }
    );
  }
}

/**
 * Creates a semantic manager
 */
export function createSemanticManager(options: SemanticManagerOptions): SemanticManager {
  const {
    embeddingPort,
    storePort,
    defaultNamespace = 'default',
    autoEmbed = true,
  } = options;

  // Track namespace embedding dimensions for consistency (INV-SEM-200)
  const namespaceDimensions = new Map<string, number>();

  /**
   * Validate embedding dimension for namespace
   */
  function validateDimension(namespace: string, dimension: number): void {
    const expected = namespaceDimensions.get(namespace);
    if (expected !== undefined && expected !== dimension) {
      throw SemanticManagerError.dimensionMismatch(expected, dimension);
    }
    if (expected === undefined) {
      namespaceDimensions.set(namespace, dimension);
    }
  }

  return {
    /**
     * Store content with automatic embedding
     * INV-SEM-001: Embeddings computed and cached
     */
    async store(request: SemanticStoreRequest): Promise<SemanticStoreResponse> {
      const namespace = request.namespace ?? defaultNamespace;

      try {
        // Check if content changed (for caching)
        const contentHash = await computeContentHash(request.content);
        const existing = await storePort.get(request.key, namespace);

        // Determine if embedding needs computation
        let embedding = request.embedding;
        let embeddingComputed = false;

        if (autoEmbed && !embedding) {
          const needsEmbedding =
            !existing ||
            existing.contentHash !== contentHash ||
            request.forceRecompute;

          if (needsEmbedding) {
            const result = await embeddingPort.embed({ text: request.content });
            embedding = result.embedding;
            embeddingComputed = true;

            // Validate dimension consistency (INV-SEM-200)
            validateDimension(namespace, result.dimension);
          } else if (existing?.embedding) {
            // Reuse existing embedding
            embedding = existing.embedding;
          }
        }

        // Validate provided embedding dimension
        if (embedding) {
          const config = embeddingPort.getConfig();
          if (embedding.length !== config.dimension) {
            throw SemanticManagerError.dimensionMismatch(config.dimension, embedding.length);
          }
          validateDimension(namespace, embedding.length);
        }

        // Store with embedding
        const result = await storePort.store({
          ...request,
          namespace,
          embedding,
        });

        return {
          ...result,
          embeddingComputed,
        };
      } catch (error) {
        if (error instanceof SemanticManagerError) throw error;

        const message = error instanceof Error ? error.message : 'Unknown error';
        throw SemanticManagerError.embeddingFailed(message);
      }
    },

    /**
     * Search by semantic similarity
     * INV-SEM-002: Results sorted by similarity descending
     * INV-SEM-003: Scores normalized to [0, 1]
     * INV-SEM-004: Namespace isolation
     */
    async search(request: SemanticSearchRequest): Promise<SemanticSearchResponse> {
      const namespace = request.namespace;

      try {
        // Compute query embedding
        const queryResult = await embeddingPort.embed({ text: request.query });

        // Validate dimension if namespace has items
        if (namespace) {
          const stats = await storePort.getStats(namespace);
          if (stats.embeddingDimension !== null) {
            validateDimension(namespace, queryResult.dimension);
          }
        }

        // Delegate search to store
        return await storePort.search(request);
      } catch (error) {
        if (error instanceof SemanticManagerError) throw error;

        const message = error instanceof Error ? error.message : 'Unknown error';
        throw SemanticManagerError.searchFailed(message);
      }
    },

    /**
     * Get item by key
     */
    async get(key: string, namespace?: string): Promise<SemanticItem | null> {
      return storePort.get(key, namespace ?? defaultNamespace);
    },

    /**
     * List items
     */
    async list(request: SemanticListRequest): Promise<SemanticListResponse> {
      return storePort.list({
        ...request,
        namespace: request.namespace ?? defaultNamespace,
      });
    },

    /**
     * Delete item
     */
    async delete(key: string, namespace?: string): Promise<SemanticDeleteResponse> {
      return storePort.delete(key, namespace ?? defaultNamespace);
    },

    /**
     * Get statistics
     */
    async getStats(namespace?: string): Promise<SemanticStoreStats> {
      return storePort.getStats(namespace);
    },

    /**
     * Clear namespace
     */
    async clear(namespace?: string): Promise<number> {
      const ns = namespace ?? defaultNamespace;
      // Reset dimension tracking for cleared namespace
      namespaceDimensions.delete(ns);
      return storePort.clear(ns);
    },

    /**
     * Get embedding configuration
     */
    getEmbeddingConfig(): EmbeddingConfig {
      return embeddingPort.getConfig();
    },
  };
}
