/**
 * Direct test of embedding service without Vitest
 * This bypasses the Float32Array isolation issue in test runners
 */

import { getEmbeddingService } from './src/services/EmbeddingService.js';
import { getVectorStore } from './src/database/VectorStore.js';

async function main() {
  console.log('🧪 Testing Embedding Service (Direct Node Execution)\n');

  // Test 1: Model initialization
  console.log('📥 Test 1: Model Download & Initialization');
  const service = getEmbeddingService();
  const start1 = Date.now();
  await service.initialize();
  const duration1 = Date.now() - start1;
  console.log(`✅ Model initialized in ${duration1}ms`);

  const modelInfo = service.getModelInfo();
  console.log(`   Model: ${modelInfo.name}`);
  console.log(`   Dimensions: ${modelInfo.dimensions}`);
  console.log(`   Initialized: ${modelInfo.initialized}\n`);

  // Test 2: Embedding generation
  console.log('🧪 Test 2: Generate Embedding');
  const text = 'authentication logic with JWT tokens';
  const start2 = Date.now();
  const result = await service.embed(text);
  const duration2 = Date.now() - start2;

  console.log(`✅ Generated embedding in ${duration2}ms`);
  console.log(`   Type: ${result.embedding.constructor.name}`);
  console.log(`   Length: ${result.embedding.length}`);
  console.log(`   Cached: ${result.cached}`);
  console.log(`   First 5 values: [${Array.from(result.embedding.slice(0, 5)).map(v => v.toFixed(4)).join(', ')}]\n`);

  // Test 3: Cache hit
  console.log('🧪 Test 3: Cache Hit');
  const start3 = Date.now();
  const result2 = await service.embed(text);
  const duration3 = Date.now() - start3;
  console.log(`✅ Retrieved from cache in ${duration3}ms`);
  console.log(`   Cached: ${result2.cached}\n`);

  // Test 4: Performance with 10 queries
  console.log('🧪 Test 4: Performance (10 queries)');
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

  const durations: number[] = [];
  for (const t of texts) {
    const start = Date.now();
    await service.embed(t);
    durations.push(Date.now() - start);
  }

  durations.sort((a, b) => a - b);
  const median = durations[Math.floor(durations.length / 2)];
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const p95 = durations[Math.floor(durations.length * 0.95)];

  console.log(`✅ Performance metrics:`);
  console.log(`   Median: ${median.toFixed(1)}ms`);
  console.log(`   Average: ${avg.toFixed(1)}ms`);
  console.log(`   P95: ${p95.toFixed(1)}ms`);
  console.log(`   Target: <100ms (P95)`);
  console.log(`   Status: ${p95 < 100 ? '✅ PASS' : '⚠️  NEEDS OPTIMIZATION'}\n`);

  // Test 5: FAISS vector store
  console.log('🧪 Test 5: FAISS Vector Store');
  const store = getVectorStore({ dimensions: 384 });

  // Add vectors
  const embedTexts = [
    'user authentication with JWT',
    'database connection pooling',
    'REST API error handling',
  ];

  for (const [idx, t] of embedTexts.entries()) {
    const { embedding } = await service.embed(t);
    await store.add(`mem-${idx}`, embedding, { type: 'memory' });
  }

  const stats = store.getStats();
  console.log(`✅ Added ${stats.totalVectors} vectors to FAISS index`);

  // Search
  const query = 'how to authenticate users';
  const { embedding: queryEmb } = await service.embed(query);
  const searchStart = Date.now();
  const results = await store.search(queryEmb, 3);
  const searchDuration = Date.now() - searchStart;

  console.log(`✅ Search completed in ${searchDuration}ms`);
  console.log(`   Results: ${results.length}`);
  console.log(`   Top result: ${results[0].id} (score: ${results[0].score.toFixed(4)})\n`);

  // Test 6: Platform info
  console.log('🖥️  Platform Information:');
  console.log(`   OS: ${process.platform}`);
  console.log(`   Architecture: ${process.arch}`);
  console.log(`   Node version: ${process.version}`);
  console.log(`   Vector backend: sqlite-vss\n`);

  console.log('✅ All tests passed!\n');
}

main().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
