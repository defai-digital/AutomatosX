-- Migration 003: Create chunks and chunks_fts tables for full-text search
--
-- This migration implements contentless FTS5 for memory-efficient full-text search
-- Strategy:
--   1. chunks table stores actual content
--   2. chunks_fts is a contentless FTS5 virtual table
--   3. Triggers keep chunks_fts synchronized with chunks
--
-- Benefits:
--   - No data duplication (FTS5 doesn't store content)
--   - Fast BM25-based natural language search
--   - Automatic synchronization via triggers

-- ============================================================================
-- 1. Create chunks table (stores actual content)
-- ============================================================================

CREATE TABLE chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  content TEXT NOT NULL,           -- The actual chunk text
  start_line INTEGER NOT NULL,     -- Starting line number
  end_line INTEGER NOT NULL,       -- Ending line number
  chunk_type TEXT NOT NULL,        -- Type: 'function', 'class', 'method', 'block', 'file'
  symbol_id INTEGER,               -- Optional reference to symbols table
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE SET NULL
);

-- Indexes for chunk queries
CREATE INDEX idx_chunks_file_id ON chunks(file_id);
CREATE INDEX idx_chunks_symbol_id ON chunks(symbol_id);
CREATE INDEX idx_chunks_type ON chunks(chunk_type);
CREATE INDEX idx_chunks_lines ON chunks(file_id, start_line, end_line);

-- ============================================================================
-- 2. Create contentless FTS5 virtual table
-- ============================================================================

-- Contentless FTS5: references chunks(content) without duplicating data
-- content='chunks' means: get content from chunks table
-- content_rowid='id' means: rowid in FTS5 matches id in chunks
CREATE VIRTUAL TABLE chunks_fts USING fts5(
  content,
  content='chunks',
  content_rowid='id',
  tokenize='porter unicode61'  -- Porter stemming + Unicode normalization
);

-- ============================================================================
-- 3. Triggers to keep chunks_fts synchronized with chunks
-- ============================================================================

-- Trigger: INSERT into chunks → INSERT into chunks_fts
CREATE TRIGGER chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts(rowid, content)
  VALUES (new.id, new.content);
END;

-- Trigger: DELETE from chunks → DELETE from chunks_fts
CREATE TRIGGER chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content)
  VALUES ('delete', old.id, old.content);
END;

-- Trigger: UPDATE chunks → UPDATE chunks_fts
CREATE TRIGGER chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content)
  VALUES ('delete', old.id, old.content);
  INSERT INTO chunks_fts(rowid, content)
  VALUES (new.id, new.content);
END;

-- ============================================================================
-- Notes:
-- ============================================================================
--
-- FTS5 Query Examples:
--   SELECT * FROM chunks_fts WHERE content MATCH 'authentication'
--   SELECT * FROM chunks_fts WHERE content MATCH 'user AND login'
--   SELECT * FROM chunks_fts('authentication') ORDER BY rank
--
-- BM25 Ranking:
--   FTS5 uses BM25 algorithm by default for ranking results
--   The 'rank' column (available via ORDER BY rank) provides relevance score
--
-- Contentless FTS5:
--   To get content, JOIN with chunks table:
--   SELECT c.* FROM chunks c
--   JOIN chunks_fts fts ON c.id = fts.rowid
--   WHERE fts.content MATCH 'query'
--   ORDER BY fts.rank
