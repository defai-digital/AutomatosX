-- Migration 008: Create memory_embeddings table for semantic search
-- Purpose: Store 384-dimensional embeddings for memory entries
-- Model: sentence-transformers/all-MiniLM-L6-v2 via @xenova/transformers

CREATE TABLE IF NOT EXISTS memory_embeddings (
  memory_id TEXT PRIMARY KEY,
  embedding BLOB NOT NULL,  -- 384 float32 values (1536 bytes)
  chunk_index INTEGER DEFAULT 0,  -- For chunked embeddings (future enhancement)
  model_version TEXT DEFAULT 'all-MiniLM-L6-v2',  -- Track which model generated this
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

-- Index for fast lookups by memory_id
CREATE INDEX IF NOT EXISTS idx_embeddings_memory
ON memory_embeddings(memory_id);

-- Index for chunk-based queries (future enhancement for large documents)
CREATE INDEX IF NOT EXISTS idx_embeddings_chunks
ON memory_embeddings(memory_id, chunk_index);

-- Index for tracking embedding freshness
CREATE INDEX IF NOT EXISTS idx_embeddings_updated
ON memory_embeddings(updated_at);

-- Metadata table to track embedding statistics
CREATE TABLE IF NOT EXISTS embedding_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Initialize metadata
INSERT OR REPLACE INTO embedding_metadata (key, value) VALUES
  ('model_name', 'sentence-transformers/all-MiniLM-L6-v2'),
  ('embedding_dimensions', '384'),
  ('total_embeddings', '0'),
  ('last_index_time', datetime('now'));
