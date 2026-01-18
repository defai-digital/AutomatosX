/**
 * Semantic Context Domain
 *
 * Provides semantic search and vector-indexed storage.
 *
 * @packageDocumentation
 */

// Types and interfaces
export type {
  EmbeddingPort,
  EmbeddingRequest,
  EmbeddingResult,
  SemanticStorePort,
  SemanticStoreStats,
  SemanticManager,
  SemanticManagerOptions,
  SimilarityMethod,
  SimilarityOptions,
} from './types.js';

// Stub implementations for testing
export { StubEmbeddingPort, InMemorySemanticStore } from './types.js';

// Similarity utilities
export {
  cosineSimilarity,
  dotProductSimilarity,
  euclideanDistance,
  manhattanDistance,
  computeSimilarity,
  normalizeVector,
  vectorNorm,
  addVectors,
  subtractVectors,
  scaleVector,
  computeCentroid,
  findKNearest,
  filterByThreshold,
  DEFAULT_SIMILARITY_OPTIONS,
} from './similarity.js';

// Embedding service
export {
  LocalEmbeddingProvider,
  CachedEmbeddingProvider,
  createEmbeddingProvider,
  createTFIDFEmbedding,
  createTFIDFEmbeddingBatch,
} from './embedding-service.js';

// Semantic manager
export {
  createSemanticManager,
  SemanticManagerError,
} from './semantic-manager.js';
