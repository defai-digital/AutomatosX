/**
 * Semantic Context Types
 *
 * Port interfaces and type definitions for semantic context storage.
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
import { EMBEDDING_DIMENSION_DEFAULT } from '@defai.digital/contracts';

// ============================================================================
// Embedding Port
// ============================================================================

/**
 * Embedding request
 */
export interface EmbeddingRequest {
  /**
   * Text to embed
   */
  text: string;

  /**
   * Model to use (optional, uses config default)
   */
  model?: string;
}

/**
 * Embedding result
 */
export interface EmbeddingResult {
  /**
   * The embedding vector
   */
  embedding: number[];

  /**
   * Model used
   */
  model: string;

  /**
   * Dimension of embedding
   */
  dimension: number;

  /**
   * Computation duration in ms
   */
  durationMs: number;
}

/**
 * Port interface for embedding computation
 * Implementations inject actual embedding provider at runtime
 */
export interface EmbeddingPort {
  /**
   * Compute embedding for text
   */
  embed(request: EmbeddingRequest): Promise<EmbeddingResult>;

  /**
   * Compute embeddings for multiple texts (batch)
   */
  embedBatch(texts: string[]): Promise<EmbeddingResult[]>;

  /**
   * Get embedding configuration
   */
  getConfig(): EmbeddingConfig;

  /**
   * Check if provider is available
   */
  isAvailable(): Promise<boolean>;
}

// ============================================================================
// Semantic Store Port
// ============================================================================

/**
 * Port interface for semantic storage
 * Implementations provide actual persistence (SQLite, etc.)
 */
export interface SemanticStorePort {
  /**
   * Store item with embedding
   * INV-SEM-001: Embedding cached until content changes
   */
  store(request: SemanticStoreRequest): Promise<SemanticStoreResponse>;

  /**
   * Search by semantic similarity
   * INV-SEM-002: Results sorted by similarity descending
   * INV-SEM-003: Scores normalized to [0, 1]
   * INV-SEM-004: Namespace isolation
   */
  search(request: SemanticSearchRequest): Promise<SemanticSearchResponse>;

  /**
   * Get item by key
   */
  get(key: string, namespace?: string): Promise<SemanticItem | null>;

  /**
   * List items
   */
  list(request: SemanticListRequest): Promise<SemanticListResponse>;

  /**
   * Delete item
   */
  delete(key: string, namespace?: string): Promise<SemanticDeleteResponse>;

  /**
   * Check if item exists
   */
  exists(key: string, namespace?: string): Promise<boolean>;

  /**
   * Get namespace statistics
   */
  getStats(namespace?: string): Promise<SemanticStoreStats>;

  /**
   * Clear namespace
   */
  clear(namespace?: string): Promise<number>;
}

/**
 * Semantic store statistics
 */
export interface SemanticStoreStats {
  /**
   * Total items in namespace
   */
  totalItems: number;

  /**
   * Items with embeddings
   */
  itemsWithEmbeddings: number;

  /**
   * Embedding dimension used
   */
  embeddingDimension: number | null;

  /**
   * Embedding model used
   */
  embeddingModel: string | null;

  /**
   * Namespace queried
   */
  namespace: string | null;

  /**
   * All namespaces (if namespace not specified)
   */
  namespaces?: string[];
}

// ============================================================================
// Semantic Manager Interface
// ============================================================================

/**
 * High-level semantic context manager
 * Combines embedding and storage
 */
export interface SemanticManager {
  /**
   * Store content with automatic embedding
   */
  store(request: SemanticStoreRequest): Promise<SemanticStoreResponse>;

  /**
   * Search by semantic similarity
   */
  search(request: SemanticSearchRequest): Promise<SemanticSearchResponse>;

  /**
   * Get item by key
   */
  get(key: string, namespace?: string): Promise<SemanticItem | null>;

  /**
   * List items
   */
  list(request: SemanticListRequest): Promise<SemanticListResponse>;

  /**
   * Delete item
   */
  delete(key: string, namespace?: string): Promise<SemanticDeleteResponse>;

  /**
   * Get statistics
   */
  getStats(namespace?: string): Promise<SemanticStoreStats>;

  /**
   * Clear namespace
   */
  clear(namespace?: string): Promise<number>;

  /**
   * Get embedding configuration
   */
  getEmbeddingConfig(): EmbeddingConfig;
}

// ============================================================================
// Manager Options
// ============================================================================

/**
 * Options for creating semantic manager
 */
export interface SemanticManagerOptions {
  /**
   * Embedding provider port
   */
  embeddingPort: EmbeddingPort;

  /**
   * Storage port
   */
  storePort: SemanticStorePort;

  /**
   * Default namespace
   */
  defaultNamespace?: string;

  /**
   * Whether to auto-compute embeddings on store
   */
  autoEmbed?: boolean;
}

// ============================================================================
// Similarity Types
// ============================================================================

/**
 * Similarity computation method
 */
export type SimilarityMethod = 'cosine' | 'dot' | 'euclidean';

/**
 * Similarity computation options
 */
export interface SimilarityOptions {
  method: SimilarityMethod;
  normalize: boolean;
}

// ============================================================================
// Stub Implementations (for testing)
// ============================================================================

/**
 * Stub embedding port for testing
 */
export class StubEmbeddingPort implements EmbeddingPort {
  private dimension: number;
  private model: string;

  constructor(dimension = EMBEDDING_DIMENSION_DEFAULT, model = 'stub') {
    this.dimension = dimension;
    this.model = model;
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    // Generate deterministic embedding based on text hash
    const embedding = this.generateEmbedding(request.text);
    return {
      embedding,
      model: request.model ?? this.model,
      dimension: this.dimension,
      durationMs: 10,
    };
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    return Promise.all(texts.map((text) => this.embed({ text })));
  }

  getConfig(): EmbeddingConfig {
    return {
      provider: 'local',
      model: this.model,
      dimension: this.dimension,
      batchSize: 32,
      cacheEnabled: true,
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  private generateEmbedding(text: string): number[] {
    // Simple hash-based embedding for testing
    const embedding: number[] = [];
    for (let i = 0; i < this.dimension; i++) {
      const charCode = text.charCodeAt(i % text.length) || 0;
      embedding.push(Math.sin(charCode * (i + 1) * 0.1));
    }
    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map((v) => v / (norm || 1));
  }
}

/**
 * In-memory semantic store for testing
 */
export class InMemorySemanticStore implements SemanticStorePort {
  private items: Map<string, SemanticItem> = new Map();
  private embeddingPort: EmbeddingPort;

  constructor(embeddingPort?: EmbeddingPort) {
    this.embeddingPort = embeddingPort ?? new StubEmbeddingPort();
  }

  private makeKey(key: string, namespace: string): string {
    return `${namespace}:${key}`;
  }

  async store(request: SemanticStoreRequest): Promise<SemanticStoreResponse> {
    const namespace = request.namespace ?? 'default';
    const storageKey = this.makeKey(request.key, namespace);
    const existing = this.items.get(storageKey);

    // Compute content hash
    const contentHash = await this.hashContent(request.content);
    const needsEmbedding = !existing ||
      existing.contentHash !== contentHash ||
      request.forceRecompute;

    let embedding = request.embedding;
    let embeddingComputed = false;

    if (needsEmbedding && !embedding) {
      const result = await this.embeddingPort.embed({ text: request.content });
      embedding = result.embedding;
      embeddingComputed = true;
    }

    const item: SemanticItem = {
      key: request.key,
      namespace,
      content: request.content,
      embedding,
      embeddingDimension: embedding?.length,
      embeddingModel: this.embeddingPort.getConfig().model,
      metadata: request.metadata,
      tags: request.tags,
      contentHash,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.items.set(storageKey, item);

    // Omit embedding from the response item
    const { embedding: _, ...itemWithoutEmbedding } = item;
    return {
      success: true,
      item: itemWithoutEmbedding,
      created: !existing,
      embeddingComputed,
    };
  }

  async search(request: SemanticSearchRequest): Promise<SemanticSearchResponse> {
    const startTime = Date.now();
    const namespace = request.namespace;

    // Use provided query embedding if available, otherwise compute it
    let queryEmbedding = request.queryEmbedding;
    if (!queryEmbedding || queryEmbedding.length === 0) {
      const queryResult = await this.embeddingPort.embed({ text: request.query });
      queryEmbedding = queryResult.embedding;
    }

    // Filter items
    const candidates = Array.from(this.items.values()).filter((item) => {
      if (namespace && item.namespace !== namespace) return false;
      if (!item.embedding) return false;
      if (request.filterTags) {
        const itemTags = new Set(item.tags ?? []);
        if (!request.filterTags.every((t) => itemTags.has(t))) return false;
      }
      return true;
    });

    // Compute similarities
    const scored = candidates.map((item) => ({
      item,
      similarity: this.cosineSimilarity(queryEmbedding, item.embedding!),
    }));

    // Filter by minSimilarity and sort (INV-SEM-002, INV-SEM-003)
    const filtered = scored
      .filter((s) => s.similarity >= (request.minSimilarity ?? 0.7))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, request.topK ?? 10);

    const results = filtered.map((s, index) => ({
      item: request.includeEmbeddings
        ? s.item
        : { ...s.item, embedding: undefined },
      similarity: s.similarity,
      rank: index + 1,
      snippet: s.item.content.slice(0, 200),
    }));

    return {
      results,
      totalMatches: filtered.length,
      query: request.query,
      namespace,
      durationMs: Date.now() - startTime,
      queryEmbedding: request.includeEmbeddings ? queryEmbedding : undefined,
    };
  }

  async get(key: string, namespace = 'default'): Promise<SemanticItem | null> {
    return this.items.get(this.makeKey(key, namespace)) ?? null;
  }

  async list(request: SemanticListRequest): Promise<SemanticListResponse> {
    let items = Array.from(this.items.values());

    // Filter by namespace
    if (request.namespace) {
      items = items.filter((i) => i.namespace === request.namespace);
    }

    // Filter by tags
    if (request.filterTags) {
      items = items.filter((item) => {
        const itemTags = new Set(item.tags ?? []);
        return request.filterTags!.every((t) => itemTags.has(t));
      });
    }

    // Filter by key prefix
    if (request.keyPrefix) {
      items = items.filter((i) => i.key.startsWith(request.keyPrefix!));
    }

    // Sort
    const sortDir = request.orderDir === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      const aVal = a[request.orderBy ?? 'createdAt'] ?? '';
      const bVal = b[request.orderBy ?? 'createdAt'] ?? '';
      return aVal < bVal ? -sortDir : sortDir;
    });

    // Paginate
    const offset = request.offset ?? 0;
    const limit = request.limit ?? 10;
    const paginated = items.slice(offset, offset + limit);

    return {
      items: paginated.map((i) => ({ ...i, embedding: undefined })),
      total: items.length,
      hasMore: offset + limit < items.length,
      namespace: request.namespace,
    };
  }

  async delete(key: string, namespace = 'default'): Promise<SemanticDeleteResponse> {
    const storageKey = this.makeKey(key, namespace);
    const deleted = this.items.delete(storageKey);
    return { deleted, key, namespace };
  }

  async exists(key: string, namespace = 'default'): Promise<boolean> {
    return this.items.has(this.makeKey(key, namespace));
  }

  async getStats(namespace?: string): Promise<SemanticStoreStats> {
    let items = Array.from(this.items.values());
    if (namespace) {
      items = items.filter((i) => i.namespace === namespace);
    }

    const withEmbeddings = items.filter((i) => i.embedding);
    const allNamespaces = [...new Set(Array.from(this.items.values()).map((i) => i.namespace))];

    const result: SemanticStoreStats = {
      totalItems: items.length,
      itemsWithEmbeddings: withEmbeddings.length,
      embeddingDimension: withEmbeddings[0]?.embeddingDimension ?? null,
      embeddingModel: withEmbeddings[0]?.embeddingModel ?? null,
      namespace: namespace ?? null,
    };

    // Only include namespaces if no specific namespace was queried
    if (!namespace) {
      result.namespaces = allNamespaces;
    }

    return result;
  }

  async clear(namespace?: string): Promise<number> {
    if (namespace) {
      const keysToDelete = Array.from(this.items.entries())
        .filter(([_, item]) => item.namespace === namespace)
        .map(([key]) => key);
      keysToDelete.forEach((k) => this.items.delete(k));
      return keysToDelete.length;
    } else {
      const count = this.items.size;
      this.items.clear();
      return count;
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i]! * b[i]!;
      normA += a[i]! * a[i]!;
      normB += b[i]! * b[i]!;
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (denom === 0) return 0;
    // Cosine similarity is in [-1, 1], normalize to [0, 1]
    return (dot / denom + 1) / 2;
  }

  private async hashContent(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}
