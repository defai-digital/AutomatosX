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
export declare class EmbeddingService {
    private model;
    private modelName;
    private dimensions;
    private cache;
    private isInitialized;
    private initializationPromise;
    constructor(options?: {
        cacheSize?: number;
    });
    /**
     * Initialize the embedding model
     * Downloads model on first run (22MB, cached in ~/.cache/transformers)
     */
    initialize(): Promise<void>;
    private _doInitialize;
    /**
     * Generate embedding for a single text
     *
     * @param text - Text to embed
     * @param options - Embedding options
     * @returns Embedding result with 384-dimensional vector
     */
    embed(text: string, options?: EmbeddingOptions): Promise<EmbeddingResult>;
    /**
     * Generate embeddings for multiple texts in batch
     * More efficient than calling embed() multiple times
     *
     * @param texts - Array of texts to embed
     * @param options - Embedding options
     * @param batchSize - Number of items to process at once (default: 32)
     * @returns Batch embedding result
     */
    embedBatch(texts: string[], options?: EmbeddingOptions, batchSize?: number): Promise<BatchEmbeddingResult>;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        maxSize: number;
        hitRate: number;
    };
    /**
     * Clear the embedding cache
     */
    clearCache(): void;
    /**
     * Get embedding model info
     */
    getModelInfo(): {
        name: string;
        dimensions: number;
        initialized: boolean;
    };
    /**
     * Generate cache key from text and options
     */
    private _getCacheKey;
    /**
     * Calculate cache hit rate (placeholder - would need actual metrics)
     */
    private _calculateHitRate;
}
/**
 * Get the singleton embedding service instance
 */
export declare function getEmbeddingService(): EmbeddingService;
//# sourceMappingURL=EmbeddingService.d.ts.map