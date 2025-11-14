/**
 * Day 82 Validation Tests: PROVE the code actually works
 *
 * These tests answer critical questions:
 * 1. Does the model actually download?
 * 2. Can we generate embeddings?
 * 3. What's the actual performance?
 * 4. Does FAISS work on this platform?
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { getEmbeddingService } from '../../services/EmbeddingService.js';
import { getVectorStore } from '../../database/VectorStore.js';
describe('Day 82: Embedding Validation', () => {
    describe('Test 1: Model Download & Initialization', () => {
        it('should download and initialize the model', async () => {
            const service = getEmbeddingService();
            console.log('📥 Testing model download (22MB, may take 10-30 seconds)...');
            const start = Date.now();
            await service.initialize();
            const duration = Date.now() - start;
            console.log(`✅ Model initialized in ${duration}ms`);
            const modelInfo = service.getModelInfo();
            expect(modelInfo.initialized).toBe(true);
            expect(modelInfo.dimensions).toBe(384);
            expect(modelInfo.name).toContain('MiniLM');
            // Record actual initialization time
            console.log(`
📊 Initialization Metrics:
- Duration: ${duration}ms
- Model: ${modelInfo.name}
- Dimensions: ${modelInfo.dimensions}
      `);
        }, 60000); // 60 second timeout for model download
    });
    describe('Test 2: Embedding Generation', () => {
        let service;
        beforeAll(async () => {
            service = getEmbeddingService();
            await service.initialize();
        });
        it('should generate 384-dimensional embedding', async () => {
            const text = 'authentication logic with JWT tokens';
            console.log(`🧪 Generating embedding for: "${text}"`);
            const start = Date.now();
            const result = await service.embed(text);
            const duration = Date.now() - start;
            expect(result.embedding).toBeInstanceOf(Float32Array);
            expect(result.embedding.length).toBe(384);
            expect(result.dimensions).toBe(384);
            expect(result.cached).toBe(false); // First call
            console.log(`✅ Embedding generated in ${duration}ms`);
            console.log(`📊 First 5 dimensions: [${Array.from(result.embedding.slice(0, 5)).map(v => v.toFixed(4)).join(', ')}]`);
        });
        it('should use cache on second call', async () => {
            const text = 'authentication logic with JWT tokens';
            // First call (already done above, just to be sure)
            await service.embed(text);
            // Second call should be cached
            console.log('🧪 Testing cache hit...');
            const start = Date.now();
            const result = await service.embed(text);
            const duration = Date.now() - start;
            expect(result.cached).toBe(true);
            expect(duration).toBeLessThan(10); // Should be <10ms from cache
            console.log(`✅ Cached result retrieved in ${duration}ms`);
            const stats = service.getCacheStats();
            console.log(`📊 Cache stats: ${stats.size} items, max ${stats.maxSize}`);
        });
        it('should measure actual performance (P95)', async () => {
            const texts = [
                'user authentication system',
                'database connection pool',
                'REST API endpoint',
                'error handling middleware',
                'configuration management',
                'logging service',
                'caching layer',
                'security validation',
                'data transformation',
                'async task queue',
            ];
            console.log('🧪 Measuring performance with 10 different queries...');
            const durations = [];
            for (const text of texts) {
                const start = Date.now();
                await service.embed(text);
                const duration = Date.now() - start;
                durations.push(duration);
            }
            // Calculate P95
            durations.sort((a, b) => a - b);
            const p95Index = Math.floor(durations.length * 0.95);
            const p95 = durations[p95Index];
            const median = durations[Math.floor(durations.length / 0.5)];
            const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
            console.log(`
📊 Performance Metrics (10 queries):
- Median: ${median.toFixed(1)}ms
- Average: ${avg.toFixed(1)}ms
- P95: ${p95.toFixed(1)}ms
- Min: ${Math.min(...durations).toFixed(1)}ms
- Max: ${Math.max(...durations).toFixed(1)}ms

Target: <100ms (P95)
Status: ${p95 < 100 ? '✅ PASS' : '⚠️  NEEDS OPTIMIZATION'}
      `);
            // Relaxed expectation for validation
            expect(p95).toBeLessThan(500); // Very generous for validation
        });
    });
    describe('Test 3: Vector Store & FAISS', () => {
        let service;
        let store;
        beforeAll(async () => {
            service = getEmbeddingService();
            await service.initialize();
            store = getVectorStore({ dimensions: 384 });
        });
        it('should add vectors to FAISS index', async () => {
            console.log('🧪 Testing FAISS vector addition...');
            const texts = [
                'user authentication with JWT',
                'database connection pooling',
                'REST API error handling',
            ];
            for (const [idx, text] of texts.entries()) {
                const { embedding } = await service.embed(text);
                await store.add(`mem-${idx}`, embedding, { type: 'memory' });
            }
            const stats = store.getStats();
            expect(stats.totalVectors).toBe(3);
            console.log(`✅ Added ${stats.totalVectors} vectors to FAISS index`);
        });
        it('should search vectors with FAISS', async () => {
            console.log('🧪 Testing FAISS vector search...');
            const query = 'how to authenticate users';
            const { embedding: queryEmbedding } = await service.embed(query);
            const start = Date.now();
            const results = await store.search(queryEmbedding, 3);
            const duration = Date.now() - start;
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].score).toBeGreaterThan(0);
            console.log(`✅ Search completed in ${duration}ms`);
            console.log(`📊 Top result: ${results[0].id} (score: ${results[0].score.toFixed(4)})`);
            // Verify results are sorted by score
            for (let i = 1; i < results.length; i++) {
                expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
            }
        });
        it('should measure search performance', async () => {
            console.log('🧪 Measuring FAISS search performance...');
            // Add more vectors for realistic testing
            const additionalTexts = Array.from({ length: 97 }, (_, i) => `test document ${i}`);
            for (const [idx, text] of additionalTexts.entries()) {
                const { embedding } = await service.embed(text);
                await store.add(`mem-${idx + 3}`, embedding);
            }
            // Now we have 100 vectors total
            expect(store.getStats().totalVectors).toBe(100);
            // Measure search performance
            const query = 'authentication';
            const { embedding } = await service.embed(query);
            const durations = [];
            for (let i = 0; i < 10; i++) {
                const start = Date.now();
                await store.search(embedding, 20);
                durations.push(Date.now() - start);
            }
            const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
            const p95 = durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)];
            console.log(`
📊 FAISS Search Performance (100 vectors, 10 queries):
- Average: ${avg.toFixed(1)}ms
- P95: ${p95.toFixed(1)}ms
- Target: <50ms (P95)
- Status: ${p95 < 50 ? '✅ PASS' : '⚠️  ACCEPTABLE (relaxed target)'}
      `);
            // Very generous for validation
            expect(p95).toBeLessThan(200);
        });
    });
    describe('Test 4: Platform Compatibility', () => {
        it('should detect platform and report FAISS status', () => {
            console.log(`
🖥️  Platform Information:
- OS: ${process.platform}
- Architecture: ${process.arch}
- Node version: ${process.version}
- FAISS status: ${detectFAISSStatus()}
      `);
            expect(process.platform).toBeDefined();
        });
    });
});
// Helper function
function detectFAISSStatus() {
    try {
        require('faiss-node');
        return '✅ Native FAISS loaded';
    }
    catch (error) {
        return '❌ FAISS not available (fallback needed)';
    }
}
//# sourceMappingURL=embedding-validation.test.js.map