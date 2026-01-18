/**
 * Semantic Context Domain Tests
 *
 * Tests for the semantic-context domain including:
 * - Embedding service
 * - Similarity computation
 * - Semantic manager
 * - In-memory store
 *
 * Invariants tested:
 * - INV-SEM-001: Embeddings computed on store, cached until content changes
 * - INV-SEM-002: Search results sorted by similarity descending
 * - INV-SEM-003: Similarity scores normalized to [0, 1]
 * - INV-SEM-004: Namespace isolation
 * - INV-SEM-200: Consistent dimension within namespace
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { 
// Similarity utilities
cosineSimilarity, dotProductSimilarity, euclideanDistance, normalizeVector, vectorNorm, computeCentroid, findKNearest, filterByThreshold, 
// Embedding service
LocalEmbeddingProvider, CachedEmbeddingProvider, createEmbeddingProvider, createTFIDFEmbedding, createTFIDFEmbeddingBatch, 
// Semantic manager
createSemanticManager, SemanticManagerError, 
// Stub implementations
StubEmbeddingPort, InMemorySemanticStore, } from '@defai.digital/semantic-context';
describe('Similarity Utilities', () => {
    describe('cosineSimilarity', () => {
        it('should return 1 for identical normalized vectors', () => {
            const v = normalizeVector([1, 2, 3]);
            const similarity = cosineSimilarity(v, v);
            // Normalized to [0, 1], so 1 (cosine) becomes 1 (normalized)
            expect(similarity).toBeCloseTo(1, 5);
        });
        it('should return 0.5 for orthogonal vectors (INV-SEM-003)', () => {
            // Orthogonal vectors have cosine of 0, which normalizes to 0.5
            const v1 = [1, 0, 0];
            const v2 = [0, 1, 0];
            const similarity = cosineSimilarity(v1, v2);
            expect(similarity).toBeCloseTo(0.5, 5);
        });
        it('should return 0 for opposite vectors', () => {
            const v1 = [1, 0, 0];
            const v2 = [-1, 0, 0];
            const similarity = cosineSimilarity(v1, v2);
            // Cosine of -1 normalizes to 0
            expect(similarity).toBeCloseTo(0, 5);
        });
        it('should normalize to [0, 1] (INV-SEM-003)', () => {
            const v1 = [Math.random(), Math.random(), Math.random()];
            const v2 = [Math.random(), Math.random(), Math.random()];
            const similarity = cosineSimilarity(v1, v2);
            expect(similarity).toBeGreaterThanOrEqual(0);
            expect(similarity).toBeLessThanOrEqual(1);
        });
        it('should return raw cosine when normalize=false', () => {
            const v1 = [1, 0];
            const v2 = [0, 1];
            const similarity = cosineSimilarity(v1, v2, false);
            expect(similarity).toBeCloseTo(0, 5);
        });
        it('should throw for mismatched dimensions', () => {
            expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow();
        });
    });
    describe('dotProductSimilarity', () => {
        it('should compute dot product', () => {
            const v1 = [1, 2, 3];
            const v2 = [4, 5, 6];
            const raw = dotProductSimilarity(v1, v2, false);
            expect(raw).toBe(32); // 1*4 + 2*5 + 3*6
        });
        it('should normalize to [0, 1]', () => {
            const v1 = normalizeVector([1, 2, 3]);
            const v2 = normalizeVector([4, 5, 6]);
            const normalized = dotProductSimilarity(v1, v2, true);
            expect(normalized).toBeGreaterThanOrEqual(0);
            expect(normalized).toBeLessThanOrEqual(1);
        });
    });
    describe('euclideanDistance', () => {
        it('should return 0 distance for identical vectors', () => {
            const v = [1, 2, 3];
            const distance = euclideanDistance(v, v, false);
            expect(distance).toBe(0);
        });
        it('should convert to similarity when normalize=true', () => {
            const v1 = [0, 0];
            const v2 = [3, 4]; // Distance = 5
            const similarity = euclideanDistance(v1, v2, true);
            expect(similarity).toBeCloseTo(1 / 6, 5); // 1 / (1 + 5)
        });
    });
    describe('normalizeVector', () => {
        it('should normalize to unit length', () => {
            const v = normalizeVector([3, 4]);
            expect(vectorNorm(v)).toBeCloseTo(1, 5);
        });
        it('should handle zero vector', () => {
            const v = normalizeVector([0, 0, 0]);
            expect(v).toEqual([0, 0, 0]);
        });
    });
    describe('computeCentroid', () => {
        it('should compute average of vectors', () => {
            const vectors = [
                [0, 0],
                [2, 4],
                [4, 2],
            ];
            const centroid = computeCentroid(vectors);
            expect(centroid).toEqual([2, 2]);
        });
        it('should return empty for no vectors', () => {
            expect(computeCentroid([])).toEqual([]);
        });
    });
    describe('findKNearest (INV-SEM-002)', () => {
        it('should return results sorted by similarity descending', () => {
            const query = [1, 0];
            const candidates = [
                { id: 'a', embedding: [0.1, 0.9] },
                { id: 'b', embedding: [0.9, 0.1] },
                { id: 'c', embedding: [0.5, 0.5] },
            ];
            const results = findKNearest(query, candidates, 3);
            // Results should be sorted by similarity descending
            expect(results[0].id).toBe('b'); // Most similar to [1, 0]
            expect(results.length).toBe(3);
            for (let i = 1; i < results.length; i++) {
                expect(results[i].similarity).toBeLessThanOrEqual(results[i - 1].similarity);
            }
        });
        it('should respect k limit', () => {
            const query = [1, 0];
            const candidates = [
                { id: 'a', embedding: [1, 0] },
                { id: 'b', embedding: [0.9, 0.1] },
                { id: 'c', embedding: [0.8, 0.2] },
                { id: 'd', embedding: [0.7, 0.3] },
            ];
            const results = findKNearest(query, candidates, 2);
            expect(results.length).toBe(2);
        });
    });
    describe('filterByThreshold (INV-SEM-003)', () => {
        it('should filter by minimum similarity', () => {
            const query = [1, 0];
            const candidates = [
                { id: 'high', embedding: [0.99, 0.1] },
                { id: 'medium', embedding: [0.7, 0.7] },
                { id: 'low', embedding: [0.1, 0.99] },
            ];
            const results = filterByThreshold(query, candidates, 0.8);
            // Only high similarity should pass (cosine normalized)
            expect(results.length).toBeGreaterThanOrEqual(1);
            results.forEach((r) => {
                expect(r.similarity).toBeGreaterThanOrEqual(0.8);
            });
        });
    });
});
describe('Embedding Service', () => {
    describe('createTFIDFEmbedding', () => {
        it('should create embedding of specified dimension', () => {
            const embedding = createTFIDFEmbedding('Hello world', 384);
            expect(embedding.length).toBe(384);
        });
        it('should create normalized embedding', () => {
            const embedding = createTFIDFEmbedding('Test content', 256);
            const norm = vectorNorm(embedding);
            expect(norm).toBeCloseTo(1, 5);
        });
        it('should produce similar embeddings for similar text', () => {
            const e1 = createTFIDFEmbedding('machine learning algorithms', 384);
            const e2 = createTFIDFEmbedding('machine learning methods', 384);
            const e3 = createTFIDFEmbedding('cooking recipes pasta', 384);
            const sim12 = cosineSimilarity(e1, e2);
            const sim13 = cosineSimilarity(e1, e3);
            expect(sim12).toBeGreaterThan(sim13);
        });
    });
    describe('createTFIDFEmbeddingBatch', () => {
        it('should create embeddings for multiple texts', () => {
            const texts = ['Document one', 'Document two', 'Document three'];
            const embeddings = createTFIDFEmbeddingBatch(texts, 128);
            expect(embeddings.length).toBe(3);
            embeddings.forEach((e) => expect(e.length).toBe(128));
        });
        it('should use IDF for batch (more discriminative)', () => {
            const texts = [
                'the cat sat on the mat',
                'the dog sat on the mat',
                'quantum physics experiments',
            ];
            const embeddings = createTFIDFEmbeddingBatch(texts, 256);
            // First two should be more similar (common words)
            const sim01 = cosineSimilarity(embeddings[0], embeddings[1]);
            const sim02 = cosineSimilarity(embeddings[0], embeddings[2]);
            expect(sim01).toBeGreaterThan(sim02);
        });
    });
    describe('LocalEmbeddingProvider', () => {
        it('should implement EmbeddingPort interface', async () => {
            const provider = new LocalEmbeddingProvider({ dimension: 256 });
            const result = await provider.embed({ text: 'Test text' });
            expect(result.embedding.length).toBe(256);
            expect(result.model).toBe('tfidf');
            expect(result.dimension).toBe(256);
            expect(result.durationMs).toBeGreaterThanOrEqual(0);
        });
        it('should batch process texts', async () => {
            const provider = new LocalEmbeddingProvider({ dimension: 128, batchSize: 2 });
            const results = await provider.embedBatch(['One', 'Two', 'Three', 'Four', 'Five']);
            expect(results.length).toBe(5);
        });
        it('should report availability', async () => {
            const provider = new LocalEmbeddingProvider();
            expect(await provider.isAvailable()).toBe(true);
        });
    });
    describe('CachedEmbeddingProvider', () => {
        it('should cache embeddings', async () => {
            const provider = new LocalEmbeddingProvider({ dimension: 128 });
            const cached = new CachedEmbeddingProvider(provider, 100);
            // First call computes - durationMs may be 0 for fast local embedding
            const result1 = await cached.embed({ text: 'Cached text' });
            expect(result1.durationMs).toBeDefined();
            expect(result1.embedding).toBeDefined();
            // Second call returns from cache (duration 0)
            const result2 = await cached.embed({ text: 'Cached text' });
            expect(result2.durationMs).toBe(0);
            // Embeddings should be identical
            expect(result1.embedding).toEqual(result2.embedding);
        });
        it('should respect cache size limit', async () => {
            const provider = new LocalEmbeddingProvider({ dimension: 64 });
            const cached = new CachedEmbeddingProvider(provider, 2);
            await cached.embed({ text: 'Text 1' });
            await cached.embed({ text: 'Text 2' });
            await cached.embed({ text: 'Text 3' }); // Should evict Text 1
            const stats = cached.getCacheStats();
            expect(stats.size).toBeLessThanOrEqual(2);
        });
        it('should clear cache', async () => {
            const provider = new LocalEmbeddingProvider();
            const cached = new CachedEmbeddingProvider(provider);
            await cached.embed({ text: 'Test' });
            expect(cached.getCacheStats().size).toBe(1);
            cached.clearCache();
            expect(cached.getCacheStats().size).toBe(0);
        });
    });
    describe('createEmbeddingProvider', () => {
        it('should create local provider by default', () => {
            const provider = createEmbeddingProvider();
            expect(provider.getConfig().provider).toBe('local');
        });
        it('should create local provider for unknown types', async () => {
            // When an unknown provider is specified, createEmbeddingProvider falls back to LocalEmbeddingProvider
            // but the config retains the original provider value from the input
            const provider = createEmbeddingProvider({ provider: 'unknown' });
            // The provider is LocalEmbeddingProvider, verify by checking it's functional
            await expect(provider.isAvailable()).resolves.toBe(true);
            expect(provider.getConfig().dimension).toBe(384); // default dimension
        });
    });
});
describe('Semantic Manager', () => {
    let manager;
    beforeEach(() => {
        const embeddingPort = new StubEmbeddingPort(128, 'test-model');
        const storePort = new InMemorySemanticStore(embeddingPort);
        manager = createSemanticManager({
            embeddingPort,
            storePort,
            defaultNamespace: 'default',
            autoEmbed: true,
        });
    });
    describe('store', () => {
        it('should store content with auto-embedding (INV-SEM-001)', async () => {
            const result = await manager.store({
                key: 'doc-1',
                content: 'Test document content',
            });
            expect(result.success).toBe(true);
            expect(result.created).toBe(true);
            expect(result.embeddingComputed).toBe(true);
        });
        it('should cache embedding for unchanged content (INV-SEM-001)', async () => {
            // First store
            await manager.store({
                key: 'doc-1',
                content: 'Same content',
            });
            // Second store with same content
            const result = await manager.store({
                key: 'doc-1',
                content: 'Same content',
            });
            expect(result.created).toBe(false);
            expect(result.embeddingComputed).toBe(false); // Cached
        });
        it('should recompute embedding when content changes (INV-SEM-001)', async () => {
            await manager.store({
                key: 'doc-1',
                content: 'Original content',
            });
            const result = await manager.store({
                key: 'doc-1',
                content: 'Updated content',
            });
            expect(result.embeddingComputed).toBe(true);
        });
        it('should recompute embedding when forceRecompute is true', async () => {
            await manager.store({
                key: 'doc-1',
                content: 'Content',
            });
            const result = await manager.store({
                key: 'doc-1',
                content: 'Content',
                forceRecompute: true,
            });
            expect(result.embeddingComputed).toBe(true);
        });
    });
    describe('search (INV-SEM-002, INV-SEM-003)', () => {
        beforeEach(async () => {
            await manager.store({ key: 'doc-1', content: 'Machine learning algorithms' });
            await manager.store({ key: 'doc-2', content: 'Deep learning neural networks' });
            await manager.store({ key: 'doc-3', content: 'Cooking recipes and food' });
        });
        it('should return results sorted by similarity (INV-SEM-002)', async () => {
            // Use lower minSimilarity since TF-IDF local embeddings may have lower similarity scores
            const response = await manager.search({ query: 'machine learning', minSimilarity: 0 });
            expect(response.results.length).toBeGreaterThan(0);
            // Check sorting - results should be ordered by similarity descending
            for (let i = 1; i < response.results.length; i++) {
                expect(response.results[i].similarity).toBeLessThanOrEqual(response.results[i - 1].similarity);
            }
        });
        it('should normalize scores to [0, 1] (INV-SEM-003)', async () => {
            const response = await manager.search({ query: 'test query', minSimilarity: 0 });
            response.results.forEach((result) => {
                expect(result.similarity).toBeGreaterThanOrEqual(0);
                expect(result.similarity).toBeLessThanOrEqual(1);
            });
        });
        it('should filter by minSimilarity', async () => {
            const response = await manager.search({
                query: 'machine learning',
                minSimilarity: 0.8,
            });
            response.results.forEach((result) => {
                expect(result.similarity).toBeGreaterThanOrEqual(0.8);
            });
        });
        it('should respect topK limit', async () => {
            const response = await manager.search({
                query: 'content',
                topK: 2,
                minSimilarity: 0,
            });
            expect(response.results.length).toBeLessThanOrEqual(2);
        });
    });
    describe('namespace isolation (INV-SEM-004)', () => {
        it('should isolate items by namespace', async () => {
            await manager.store({
                key: 'doc-1',
                namespace: 'ns-a',
                content: 'Namespace A content',
            });
            await manager.store({
                key: 'doc-1',
                namespace: 'ns-b',
                content: 'Namespace B content',
            });
            const itemA = await manager.get('doc-1', 'ns-a');
            const itemB = await manager.get('doc-1', 'ns-b');
            expect(itemA?.content).toBe('Namespace A content');
            expect(itemB?.content).toBe('Namespace B content');
        });
        it('should search within namespace only (INV-SEM-004)', async () => {
            await manager.store({
                key: 'doc-1',
                namespace: 'ns-a',
                content: 'Machine learning',
            });
            await manager.store({
                key: 'doc-2',
                namespace: 'ns-b',
                content: 'Machine learning',
            });
            const response = await manager.search({
                query: 'machine learning',
                namespace: 'ns-a',
                minSimilarity: 0,
            });
            // Should only find items in ns-a
            response.results.forEach((result) => {
                expect(result.item.namespace).toBe('ns-a');
            });
        });
    });
    describe('get', () => {
        it('should retrieve stored item', async () => {
            await manager.store({
                key: 'doc-1',
                content: 'Test content',
                tags: ['test'],
                metadata: { source: 'unit-test' },
            });
            const item = await manager.get('doc-1');
            expect(item).not.toBeNull();
            expect(item?.key).toBe('doc-1');
            expect(item?.content).toBe('Test content');
            expect(item?.tags).toContain('test');
        });
        it('should return null for non-existent item', async () => {
            const item = await manager.get('non-existent');
            expect(item).toBeNull();
        });
    });
    describe('list', () => {
        beforeEach(async () => {
            await manager.store({ key: 'api-v1', content: 'API v1 docs' });
            await manager.store({ key: 'api-v2', content: 'API v2 docs' });
            await manager.store({ key: 'guide', content: 'User guide' });
        });
        it('should list items with pagination', async () => {
            const response = await manager.list({ limit: 2 });
            expect(response.items.length).toBe(2);
            expect(response.total).toBe(3);
            expect(response.hasMore).toBe(true);
        });
        it('should filter by key prefix', async () => {
            const response = await manager.list({ keyPrefix: 'api-' });
            expect(response.items.length).toBe(2);
            response.items.forEach((item) => {
                expect(item.key.startsWith('api-')).toBe(true);
            });
        });
    });
    describe('delete', () => {
        it('should delete existing item', async () => {
            await manager.store({ key: 'doc-1', content: 'Content' });
            const result = await manager.delete('doc-1');
            expect(result.deleted).toBe(true);
            const item = await manager.get('doc-1');
            expect(item).toBeNull();
        });
        it('should return deleted=false for non-existent item', async () => {
            const result = await manager.delete('non-existent');
            expect(result.deleted).toBe(false);
        });
    });
    describe('clear', () => {
        it('should clear namespace', async () => {
            await manager.store({ key: 'doc-1', namespace: 'temp', content: 'A' });
            await manager.store({ key: 'doc-2', namespace: 'temp', content: 'B' });
            const cleared = await manager.clear('temp');
            expect(cleared).toBe(2);
            const stats = await manager.getStats('temp');
            expect(stats.totalItems).toBe(0);
        });
    });
    describe('getStats', () => {
        it('should return statistics', async () => {
            await manager.store({ key: 'doc-1', content: 'A' });
            await manager.store({ key: 'doc-2', content: 'B' });
            const stats = await manager.getStats();
            expect(stats.totalItems).toBe(2);
            expect(stats.itemsWithEmbeddings).toBe(2);
        });
    });
    describe('getEmbeddingConfig', () => {
        it('should return embedding configuration', () => {
            const config = manager.getEmbeddingConfig();
            expect(config.model).toBe('test-model');
            expect(config.dimension).toBe(128);
        });
    });
});
describe('SemanticManagerError', () => {
    it('should create notFound error', () => {
        const error = SemanticManagerError.notFound('key', 'namespace');
        expect(error.code).toBe('SEMANTIC_NOT_FOUND');
        expect(error.message).toContain('key');
        expect(error.message).toContain('namespace');
    });
    it('should create embeddingFailed error', () => {
        const error = SemanticManagerError.embeddingFailed('timeout');
        expect(error.code).toBe('SEMANTIC_EMBEDDING_FAILED');
        expect(error.message).toContain('timeout');
    });
    it('should create searchFailed error', () => {
        const error = SemanticManagerError.searchFailed('connection error');
        expect(error.code).toBe('SEMANTIC_SEARCH_FAILED');
    });
    it('should create dimensionMismatch error', () => {
        const error = SemanticManagerError.dimensionMismatch(384, 512);
        expect(error.code).toBe('SEMANTIC_DIMENSION_MISMATCH');
        expect(error.details).toEqual({ expected: 384, actual: 512 });
    });
});
describe('InMemorySemanticStore', () => {
    let store;
    beforeEach(() => {
        store = new InMemorySemanticStore();
    });
    it('should implement SemanticStorePort interface', async () => {
        const storeResult = await store.store({
            key: 'test',
            content: 'Test content',
        });
        expect(storeResult.success).toBe(true);
        const item = await store.get('test', 'default');
        expect(item).not.toBeNull();
        const exists = await store.exists('test', 'default');
        expect(exists).toBe(true);
        const deleteResult = await store.delete('test', 'default');
        expect(deleteResult.deleted).toBe(true);
    });
    it('should search by semantic similarity', async () => {
        await store.store({ key: 'ml', content: 'Machine learning is great' });
        await store.store({ key: 'dl', content: 'Deep learning neural nets' });
        const response = await store.search({
            query: 'machine learning',
            minSimilarity: 0,
        });
        expect(response.results.length).toBeGreaterThan(0);
    });
});
//# sourceMappingURL=semantic-context.test.js.map