/**
 * Direct test of MemoryService semantic search without Vitest
 * Validates Phase 2 implementation (searchMessagesSemantic, searchMessagesHybrid)
 */

import Database from 'better-sqlite3';
import * as sqlite_vec from 'sqlite-vec';
import { MemoryService } from './src/memory/MemoryService.js';

async function main() {
  console.log('🧪 Testing MemoryService Semantic Search (Direct Node Execution)\n');

  // Setup: Create in-memory database
  console.log('📦 Setup: Creating in-memory database...');
  const db = new Database(':memory:');
  sqlite_vec.load(db);

  // Run migrations
  console.log('📦 Running migrations...');

  // Migration 008 (memory system)
  db.exec(`
    CREATE TABLE conversations (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      user_id TEXT,
      title TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'idle',
      message_count INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      archived_at INTEGER,
      deleted_at INTEGER
    );

    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'function')),
      content TEXT NOT NULL,
      tokens INTEGER,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE VIRTUAL TABLE messages_fts USING fts5(
      content,
      content_rowid=id,
      tokenize='porter unicode61'
    );
  `);

  // Migration 009 (vector embeddings)
  db.exec(`
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
      (SELECT CAST(COUNT(*) AS REAL) / NULLIF((SELECT COUNT(*) FROM messages), 0) * 100) AS coverage_percent,
      (SELECT model_version FROM message_embeddings_metadata LIMIT 1) AS current_model_version,
      (SELECT MIN(created_at) FROM message_embeddings_metadata) AS oldest_embedding,
      (SELECT MAX(created_at) FROM message_embeddings_metadata) AS newest_embedding,
      (SELECT COUNT(DISTINCT message_id) FROM message_embeddings_metadata) AS unique_messages,
      (SELECT COUNT(*) FROM message_embeddings_metadata WHERE chunk_index > 0) AS chunked_embeddings;
  `);

  console.log('✅ Migrations applied\n');

  // Initialize MemoryService
  const memoryService = new MemoryService(db);

  // Test 1: Create conversation and messages
  console.log('🧪 Test 1: Create Conversation and Messages');
  const now = Date.now();

  const conversation = await memoryService.createConversation({
    agentId: 'backend',
    userId: 'test-user',
    title: 'Test Conversation: Authentication',
    state: 'active',
    metadata: {},
  });

  console.log(`✅ Created conversation: ${conversation.id}`);

  const testMessages = [
    { content: 'How do I implement JWT authentication in Node.js?' },
    { content: 'JWT authentication involves generating a token with user claims and signing it with a secret key.' },
    { content: 'Can you show me an example with Express middleware?' },
    { content: 'Here is an Express middleware for JWT authentication: function authenticateToken(req, res, next) { ... }' },
    { content: 'What about refresh tokens and token expiration?' },
  ];

  let messageCount = 0;
  for (const msg of testMessages) {
    await memoryService.addMessage({
      conversationId: conversation.id,
      role: 'user',
      content: msg.content,
      tokens: Math.floor(msg.content.length / 4),
    });
    messageCount++;
  }

  console.log(`✅ Added ${messageCount} messages (embeddings generated async)\n`);

  // Wait for embeddings to be generated (they're async in addMessage)
  console.log('⏳ Waiting 5 seconds for embeddings to generate...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Test 2: Check embedding coverage
  console.log('🧪 Test 2: Check Embedding Coverage');
  const stats = await memoryService.getEmbeddingStats();
  console.log(`✅ Embedding Statistics:`);
  console.log(`   Total embeddings: ${stats.totalEmbeddings}`);
  console.log(`   Total messages: ${stats.totalMessages}`);
  console.log(`   Coverage: ${stats.coveragePercent.toFixed(1)}%`);
  console.log(`   Model: ${stats.currentModelVersion}\n`);

  // Test 3: Semantic search (vector-only)
  console.log('🧪 Test 3: Semantic Search (Vector-Only)');
  const semanticQuery = 'how to authenticate users with tokens';

  try {
    const semanticStart = Date.now();
    const semanticResults = await memoryService.searchMessagesSemantic(semanticQuery, {
      conversationId: conversation.id,
      limit: 10,
      minScore: 0,
    });
    const semanticTime = Date.now() - semanticStart;

    console.log(`✅ Semantic search completed in ${semanticTime}ms`);
    console.log(`   Query: "${semanticQuery}"`);
    console.log(`   Results: ${semanticResults.messages.length}`);
    console.log(`   Mode: ${semanticResults.searchMode}`);

    for (let i = 0; i < Math.min(semanticResults.messages.length, 3); i++) {
      const r = semanticResults.messages[i];
      console.log(`   ${i + 1}. score: ${r.score.toFixed(4)}, distance: ${r.distance.toFixed(4)}`);
      console.log(`      "${r.content.substring(0, 70)}..."`);
    }
    console.log();
  } catch (error) {
    console.error(`❌ Semantic search failed:`, error);
    console.log();
  }

  // Test 4: Hybrid search (FTS5 + vector)
  console.log('🧪 Test 4: Hybrid Search (FTS5 + Vector)');
  const hybridQuery = 'JWT middleware Express';

  try {
    const hybridStart = Date.now();
    const hybridResults = await memoryService.searchMessagesHybrid(hybridQuery, {
      conversationId: conversation.id,
      limit: 10,
      ftsWeight: 0.4,
      vectorWeight: 0.6,
      minScore: 0,
    });
    const hybridTime = Date.now() - hybridStart;

    console.log(`✅ Hybrid search completed in ${hybridTime}ms`);
    console.log(`   Query: "${hybridQuery}"`);
    console.log(`   Results: ${hybridResults.messages.length}`);
    console.log(`   Mode: ${hybridResults.searchMode}`);

    for (let i = 0; i < Math.min(hybridResults.messages.length, 3); i++) {
      const r = hybridResults.messages[i];
      console.log(`   ${i + 1}. combined: ${r.score.toFixed(4)}, fts: ${r.ftsScore?.toFixed(4) || 'N/A'}, vector: ${r.vectorScore?.toFixed(4) || 'N/A'}`);
      console.log(`      "${r.content.substring(0, 70)}..."`);
    }
    console.log();
  } catch (error) {
    console.error(`❌ Hybrid search failed:`, error);
    console.log();
  }

  // Test 5: Index existing messages (backfill)
  console.log('🧪 Test 5: Index Existing Messages (Backfill)');

  // Add more messages without embeddings (by directly inserting)
  const additionalMessages = [
    { id: 'msg-batch-1', content: 'How do I secure my API endpoints?' },
    { id: 'msg-batch-2', content: 'Use authentication middleware and rate limiting.' },
  ];

  for (const msg of additionalMessages) {
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, tokens, created_at, updated_at)
      VALUES (?, ?, 'user', ?, ?, ?, ?)
    `).run(msg.id, conversation.id, msg.content, Math.floor(msg.content.length / 4), now, now);
  }

  console.log(`✅ Added ${additionalMessages.length} messages directly (without embeddings)`);

  try {
    const indexResult = await memoryService.indexExistingMessages(conversation.id, {
      force: false,
      batchSize: 10,
      onProgress: (indexed, total) => {
        console.log(`   Progress: ${indexed}/${total}`);
      },
    });

    console.log(`✅ Indexing completed:`);
    console.log(`   Indexed: ${indexResult.indexed}`);
    console.log(`   Skipped: ${indexResult.skipped}`);
    console.log(`   Failed: ${indexResult.failed}`);
    console.log(`   Duration: ${indexResult.duration}ms\n`);
  } catch (error) {
    console.error(`❌ Indexing failed:`, error);
    console.log();
  }

  // Final statistics
  const finalStats = await memoryService.getEmbeddingStats();
  console.log('📊 Final Statistics:');
  console.log(`   Total embeddings: ${finalStats.totalEmbeddings}`);
  console.log(`   Total messages: ${finalStats.totalMessages}`);
  console.log(`   Coverage: ${finalStats.coveragePercent.toFixed(1)}%\n`);

  console.log('✅ All MemoryService semantic search tests completed!\n');

  // Cleanup
  db.close();
}

main().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
