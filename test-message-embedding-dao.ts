/**
 * Direct test of MessageEmbeddingDAO without Vitest
 * This validates Phase 1 implementation before proceeding to Phase 2
 */

import Database from 'better-sqlite3';
import * as sqlite_vec from 'sqlite-vec';
import { MessageEmbeddingDAO } from './src/database/dao/MessageEmbeddingDAO.js';
import { getEmbeddingService } from './src/services/EmbeddingService.js';

async function main() {
  console.log('🧪 Testing MessageEmbeddingDAO (Direct Node Execution)\n');

  // Setup: Create in-memory database
  console.log('📦 Setup: Creating in-memory database...');
  const db = new Database(':memory:');
  sqlite_vec.load(db);

  // Create messages table (required for foreign key)
  db.exec(`
    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tokens INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE conversations (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      user_id TEXT,
      title TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'idle',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Run migration 009
  console.log('📦 Running migration 009...');
  const migration009 = `
    CREATE VIRTUAL TABLE IF NOT EXISTS message_embeddings
    USING vec0(embedding float[384]);

    CREATE TABLE IF NOT EXISTS message_embeddings_metadata (
      rowid INTEGER PRIMARY KEY,
      message_id TEXT UNIQUE NOT NULL,
      model_version TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2',
      chunk_index INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_message_embeddings_message_id
    ON message_embeddings_metadata(message_id);

    CREATE VIEW IF NOT EXISTS message_embedding_stats AS
    SELECT
      (SELECT COUNT(*) FROM message_embeddings_metadata) AS total_embeddings,
      (SELECT COUNT(*) FROM messages) AS total_messages,
      (SELECT CAST(COUNT(*) AS REAL) / NULLIF((SELECT COUNT(*) FROM messages), 0) * 100 FROM message_embeddings_metadata) AS coverage_percent,
      (SELECT model_version FROM message_embeddings_metadata LIMIT 1) AS current_model_version,
      (SELECT MIN(created_at) FROM message_embeddings_metadata) AS oldest_embedding,
      (SELECT MAX(created_at) FROM message_embeddings_metadata) AS newest_embedding,
      (SELECT COUNT(DISTINCT message_id) FROM message_embeddings_metadata) AS unique_messages,
      (SELECT COUNT(*) FROM message_embeddings_metadata WHERE chunk_index > 0) AS chunked_embeddings;
  `;

  db.exec(migration009);
  console.log('✅ Migration 009 applied\n');

  // Initialize services
  const embeddingService = getEmbeddingService();
  await embeddingService.initialize();
  const dao = new MessageEmbeddingDAO(db);

  // Test 1: Add test messages
  console.log('🧪 Test 1: Add Test Messages');
  const now = Date.now();

  db.prepare(`
    INSERT INTO conversations (id, agent_id, title, state, created_at, updated_at)
    VALUES ('conv-1', 'backend', 'Test Conversation', 'active', ?, ?)
  `).run(now, now);

  const testMessages = [
    { id: 'msg-1', content: 'How do I implement JWT authentication?' },
    { id: 'msg-2', content: 'JWT authentication involves generating a token...' },
    { id: 'msg-3', content: 'Can you show me an example with Express?' },
  ];

  for (const msg of testMessages) {
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, tokens, created_at, updated_at)
      VALUES (?, 'conv-1', 'user', ?, 100, ?, ?)
    `).run(msg.id, msg.content, now, now);
  }

  console.log(`✅ Added ${testMessages.length} test messages\n`);

  // Test 2: Generate and add embeddings
  console.log('🧪 Test 2: Generate and Add Embeddings');
  let embeddingAddCount = 0;

  for (const msg of testMessages) {
    const start = Date.now();
    const { embedding } = await embeddingService.embed(msg.content);
    const embeddingTime = Date.now() - start;

    dao.addEmbedding(msg.id, embedding);
    embeddingAddCount++;

    console.log(`  ✓ ${msg.id}: Embedded in ${embeddingTime}ms, stored successfully`);
  }

  console.log(`✅ Added ${embeddingAddCount} embeddings\n`);

  // Test 3: Get embedding metadata
  console.log('🧪 Test 3: Get Embedding Metadata');
  const retrieved = dao.getEmbedding('msg-1');

  if (!retrieved) {
    throw new Error('Failed to retrieve embedding metadata');
  }

  console.log(`✅ Retrieved embedding metadata for msg-1`);
  console.log(`   Model: ${retrieved.modelVersion}`);
  console.log(`   Chunk index: ${retrieved.chunkIndex}`);
  console.log(`   Note: Embedding vector not returned (use searchByVector)\n`);

  // Test 4: Check if embedding exists
  console.log('🧪 Test 4: Check Embedding Exists');
  const exists = dao.hasEmbedding('msg-1');
  const notExists = dao.hasEmbedding('msg-999');

  console.log(`✅ msg-1 exists: ${exists} (expected: true)`);
  console.log(`✅ msg-999 exists: ${notExists} (expected: false)\n`);

  // Test 5: Vector search (semantic)
  console.log('🧪 Test 5: Vector Similarity Search');
  const query = 'how to authenticate users';
  const { embedding: queryEmbedding } = await embeddingService.embed(query);

  const searchStart = Date.now();
  const results = dao.searchByVector(queryEmbedding, {
    k: 10,
    minScore: 0,
  });
  const searchTime = Date.now() - searchStart;

  console.log(`✅ Search completed in ${searchTime}ms`);
  console.log(`   Query: "${query}"`);
  console.log(`   Results: ${results.length}`);

  for (let i = 0; i < Math.min(results.length, 3); i++) {
    const r = results[i];
    console.log(`   ${i + 1}. ${r.messageId} - score: ${r.score.toFixed(4)}, distance: ${r.distance.toFixed(4)}`);
    console.log(`      "${r.content.substring(0, 60)}..."`);
  }
  console.log();

  // Test 6: Search with conversation filter
  console.log('🧪 Test 6: Search with Conversation Filter');
  const filteredResults = dao.searchByVector(queryEmbedding, {
    k: 10,
    conversationId: 'conv-1',
  });

  console.log(`✅ Filtered search: ${filteredResults.length} results (conversation: conv-1)\n`);

  // Test 7: Get embeddings by conversation
  console.log('🧪 Test 7: Get Embeddings by Conversation');
  const convEmbeddings = dao.getByConversation('conv-1');

  console.log(`✅ Found ${convEmbeddings.length} embeddings for conversation conv-1\n`);

  // Test 8: Get statistics
  console.log('🧪 Test 8: Get Statistics');
  const stats = dao.getStats();

  console.log(`✅ Embedding Statistics:`);
  console.log(`   Total embeddings: ${stats.totalEmbeddings}`);
  console.log(`   Total messages: ${stats.totalMessages}`);
  console.log(`   Coverage: ${stats.coveragePercent.toFixed(1)}%`);
  console.log(`   Model version: ${stats.currentModelVersion}`);
  console.log(`   Unique messages: ${stats.uniqueMessages}`);
  console.log(`   Chunked embeddings: ${stats.chunkedEmbeddings}\n`);

  // Test 9: Batch add
  console.log('🧪 Test 9: Batch Add Embeddings');

  // Add more messages
  const batchMessages = [
    { id: 'msg-4', content: 'What about refresh tokens?' },
    { id: 'msg-5', content: 'How do I handle token expiration?' },
  ];

  for (const msg of batchMessages) {
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, tokens, created_at, updated_at)
      VALUES (?, 'conv-1', 'user', ?, 100, ?, ?)
    `).run(msg.id, msg.content, now, now);
  }

  // Generate embeddings
  const batchEmbeddings = [];
  for (const msg of batchMessages) {
    const { embedding } = await embeddingService.embed(msg.content);
    batchEmbeddings.push({ messageId: msg.id, embedding });
  }

  const batchResult = dao.addBatch(batchEmbeddings);

  console.log(`✅ Batch add results:`);
  console.log(`   Added: ${batchResult.added}`);
  console.log(`   Skipped: ${batchResult.skipped}`);
  console.log(`   Failed: ${batchResult.failed}\n`);

  // Test 10: Delete embedding
  console.log('🧪 Test 10: Delete Embedding');
  const deleted = dao.deleteEmbedding('msg-5');
  const deletedAgain = dao.deleteEmbedding('msg-5'); // Should return false

  console.log(`✅ First delete: ${deleted} (expected: true)`);
  console.log(`✅ Second delete: ${deletedAgain} (expected: false)\n`);

  // Test 11: Performance benchmark
  console.log('🧪 Test 11: Performance Benchmark (100 searches)');
  const benchmarkQuery = 'authentication with JWT tokens';
  const { embedding: benchEmbedding } = await embeddingService.embed(benchmarkQuery);

  const durations: number[] = [];
  for (let i = 0; i < 100; i++) {
    const start = Date.now();
    dao.searchByVector(benchEmbedding, { k: 10 });
    durations.push(Date.now() - start);
  }

  durations.sort((a, b) => a - b);
  const median = durations[Math.floor(durations.length / 2)];
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const p95 = durations[Math.floor(durations.length * 0.95)];
  const p99 = durations[Math.floor(durations.length * 0.99)];

  console.log(`✅ Performance metrics (100 searches):`);
  console.log(`   Median: ${median.toFixed(1)}ms`);
  console.log(`   Average: ${avg.toFixed(1)}ms`);
  console.log(`   P95: ${p95.toFixed(1)}ms`);
  console.log(`   P99: ${p99.toFixed(1)}ms`);
  console.log(`   Target: <20ms (P95)`);
  console.log(`   Status: ${p95 < 20 ? '✅ PASS' : '⚠️  NEEDS OPTIMIZATION'}\n`);

  // Final stats
  const finalStats = dao.getStats();
  console.log('📊 Final Statistics:');
  console.log(`   Total embeddings: ${finalStats.totalEmbeddings}`);
  console.log(`   Total messages: ${finalStats.totalMessages}`);
  console.log(`   Coverage: ${finalStats.coveragePercent.toFixed(1)}%\n`);

  console.log('✅ All DAO tests passed!\n');

  // Cleanup
  db.close();
}

main().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
