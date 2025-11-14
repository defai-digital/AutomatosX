-- Migration 009: Create message embeddings with vec0 for semantic search
-- Purpose: Replace BLOB approach from migration 008 with sqlite-vec virtual tables
-- Architecture: Two-table design (vec0 + metadata) linked by rowid
-- Model: sentence-transformers/all-MiniLM-L6-v2 via @xenova/transformers (384 dimensions)

-- ============================================================================
-- Message Embeddings (vec0 virtual table)
-- ============================================================================
-- Stores only embedding vectors, auto-generates rowid
CREATE VIRTUAL TABLE IF NOT EXISTS message_embeddings
USING vec0(
  embedding float[384]
);

-- ============================================================================
-- Message Embeddings Metadata (regular table)
-- ============================================================================
-- Stores message ID and metadata, linked to vec0 by rowid
CREATE TABLE IF NOT EXISTS message_embeddings_metadata (
  rowid INTEGER PRIMARY KEY,  -- Links to vec0 rowid
  message_id TEXT UNIQUE NOT NULL,
  model_version TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2',
  chunk_index INTEGER NOT NULL DEFAULT 0,  -- For future chunking support (P1)
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- ============================================================================
-- Indexes
-- ============================================================================
-- Fast lookup by message ID (primary access pattern)
CREATE INDEX IF NOT EXISTS idx_message_embeddings_message_id
ON message_embeddings_metadata(message_id);

-- Chunk-based queries (for future P1 enhancement)
CREATE INDEX IF NOT EXISTS idx_message_embeddings_chunks
ON message_embeddings_metadata(message_id, chunk_index);

-- Track embedding freshness for cache invalidation
CREATE INDEX IF NOT EXISTS idx_message_embeddings_updated
ON message_embeddings_metadata(updated_at);

-- Model version for migration/upgrade scenarios
CREATE INDEX IF NOT EXISTS idx_message_embeddings_model
ON message_embeddings_metadata(model_version);

-- ============================================================================
-- Embedding Statistics View
-- ============================================================================
-- Real-time statistics for embedding coverage
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

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Note: This migration creates new tables alongside the old memory_embeddings table
-- from migration 008. The old table can be safely dropped in migration 010 after
-- verifying data migration.
